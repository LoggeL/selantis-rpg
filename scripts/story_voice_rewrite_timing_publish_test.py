"""Synthetic guard tests and optional read-only genuine receipt reference checks."""
import ast
import copy
import inspect
import json
from pathlib import Path
import shutil
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_publish as strict
import story_voice_publish_test as fixtures
import story_voice_rewrite_timing_publish as rewrite
import story_voice_incremental_publish as incremental
import story_voice_incremental_publish_test as incremental_fixtures

save = fixtures.save


class RewriteTimingTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.PublisherTests(); self.fixture.setUp(); self.addCleanup(self.fixture.tearDown)
        self.root = self.fixture.root.resolve(); self.run = self.root/'output/audio/story-voice'/rewrite.RUN_NAME
        self.run.parent.mkdir(parents=True); shutil.move(self.fixture.run,self.run)
        prototype = strict.read(self.run/'lines.private.json'); self.profile = strict.read(self.run/'profiles.private.json')
        self.lines=[]; self.qa_entries=[]; self.cue_entries={}; self.audio_hash={}; self.text_hash={}
        for index in range(490):
            ident='story-'+format(index,'024x'); line=copy.deepcopy(prototype['lines'][0]); line['id']=ident
            if index==0: line.update(text='Hallo … Welt',display_text='Hallo … Welt')
            line['runtime_keys'][0]['text']=line['text'];line['runtime_keys'][0]['scene']='synthetic-'+str(index); self.lines.append(line)
            path=self.run/'clips'/(ident+'.mp3'); path.write_bytes(('synthetic-clip-'+str(index)).encode())
            sha=strict.digest(path); text_sha=strict.sha(line['text'].encode()); self.audio_hash[ident]=sha;self.text_hash[ident]=text_sha
            tokens=strict.acoustic.normalized_text(line['text']).split()
            cues=[{'start':0.,'end':.5},{'start':.5,'end':1.}]
            if index==0:cues.insert(1,{'start':.5,'end':.5})
            self.cue_entries[ident]={'words':[{'word':word,**cue} for word,cue in zip(tokens,cues)],
                'word_count':len(tokens),'text_sha256':text_sha,'cues_sha256':strict.acoustic.cue_sha(cues)}
            self.qa_entries.append({'id':ident,'text_sha256':text_sha,'transcript':line['text'],'signal':{'seconds':1.},'reasons':[]})
        for path in (self.run/'clips').glob('*.mp3'):
            if path.stem not in self.audio_hash:path.unlink()
        self.frozen=copy.deepcopy(prototype);self.frozen['lines']=self.lines
        self.frozen['runtime_lookup']=[{**key,'asset_id':line['id']} for line in self.lines for key in line['runtime_keys']]
        save(self.run/'lines.private.json',self.frozen);save(self.run/'full-inventory.private.json',self.frozen)
        payload=''.join(json.dumps({'key':line['id'],'request':strict.common.request_for(line,self.profile['speakers'])})+'\n' for line in self.lines)
        (self.run/'requests.jsonl').write_text(payload)
        self.info=strict.read(self.run/'prepared.json');self.info.update(request_count=490,input_bytes=len(payload.encode()))
        self.bind_prepared()
        save(self.run/'collection.private.json',{'collected':490,'expected':490,'failures':[]})
        self.qa_path=self.run/'qa.json'; self.align_path=self.run/'align.json'
        self.qa={'status':'passed','manifest_sha256':strict.digest(self.run/'lines.private.json'),'checked_ids':list(self.audio_hash),
                 'clip_sha256':self.audio_hash,'failures':[],'takes':self.qa_entries,'version':strict.QA_VERSION,'model':strict.QA_MODEL}
        self.align={'status':'passed','source_manifest_sha256':self.qa['manifest_sha256'],'clip_sha256':self.audio_hash,
                    'authored_text_sha256':self.text_hash,'alignment_by_id':self.cue_entries,'requires_qualification':[],
                    'failures':[],'method':strict.ALIGNMENT_ENGINE,'model':strict.acoustic.MODEL}
        self.save_reports()
        for line in self.lines:self.save_receipt(line['id'])
        p=patch.object(rewrite,'FROZEN_MANIFEST_SHA256',self.qa['manifest_sha256']);p.start();self.addCleanup(p.stop)

    def bind_prepared(self):
        for filename,key in [('requests.jsonl','input_sha256'),('profiles.private.json','profiles_sha256'),
            ('lines.private.json','manifest_sha256'),('full-inventory.private.json','full_inventory_sha256'),
            ('source-snapshot.private.json','source_snapshot_sha256')]:self.info[key]=strict.digest(self.run/filename)
        save(self.run/'prepared.json',self.info)

    def save_reports(self):save(self.qa_path,self.qa);save(self.align_path,self.align)

    def save_receipt(self,ident):
        line=next(line for line in self.lines if line['id']==ident); entry=self.cue_entries[ident]
        cues=[{'start':word['start'],'end':word['end']} for word in entry['words']]
        save(self.run/'word-cues'/(ident+'.json'),{'id':ident,'text':strict.acoustic.normalized_text(line['text']),
            'audio_sha256':self.audio_hash[ident],'text_sha256':self.text_hash[ident],
            'source_manifest_sha256':self.qa['manifest_sha256'],'engine_version':strict.ALIGNMENT_ENGINE,
            'decoded_seconds':1.,'word_cues':cues,'cues_sha256':strict.acoustic.cue_sha(cues),
            'words':[{**word,'spoken':any(char.isalnum() for char in word['word'])} for word in entry['words']]})

    def validate(self):return rewrite.validate_run(self.run,self.qa_path,self.align_path,490,self.root)

    def adopt_synthetic_ctc(self):
        """Actual helper shape with synthetic files, never a genuine approval."""
        import story_voice_ctc_align as ctc
        ident=self.lines[1]['id'];path=self.run/'word-cues'/(ident+'.json');original=strict.read(path)
        archive=self.run/'word-cues/adoption-archive/synthetic'/path.name;save(archive,original)
        directory=self.run/'synthetic-model';directory.mkdir();(directory/'vocab.json').write_text('synthetic')
        hashes={'vocab.json':strict.digest(directory/'vocab.json')}
        model={'model_id':ctc.MODEL_ID,'local_directory':str(directory),'revision':ctc.qa.CTC_REVISION,'file_sha256':hashes,
            'fingerprint':strict.sha(json.dumps(hashes,sort_keys=True).encode())}
        binding={'engine':ctc.ENGINE,'audio_sha256':original['audio_sha256'],'text_sha256':original['text_sha256'],
            'source_manifest_sha256':original['source_manifest_sha256'],'model':model,
            'script_sha256':strict.digest(Path(ctc.__file__)),'qa_report_sha256':strict.digest(self.qa_path)}
        cues=[{'start':.1,'end':.4},{'start':.5,'end':.9}]
        actual=self.run/'ctc-synthetic'/(ident+'.ctc.private.json')
        chars=[]
        for index,(word,cue)in enumerate(zip(original['words'],cues)):
            if index:chars.append({'character':'|','word_index':None,'confidence':.99})
            chars.extend({'character':char,'word_index':index,'confidence':.99}for char in word['word'].casefold())
        save(actual,{'id':ident,'text':original['text'],'binding':binding,'normalized_characters':''.join(char['character']for char in chars),
            'alignment':{'decoded_seconds':1.,'character_alignment':chars,'qualification_flags':[],
            'words':[{'word':word['word'],**cue,'confidence':.99,'waveform_active_fraction':1.}for word,cue in zip(original['words'],cues)]}})
        receipt=copy.deepcopy(original);receipt.update(word_cues=cues,cues_sha256=strict.acoustic.cue_sha(cues),
            engine_version=strict.ALIGNMENT_ENGINE+'/story-CTC-private-adoption-v1',original_DTW_word_cues=original['word_cues'],
            CTC_adoption={'binding':binding,'ctc_receipt_sha256':strict.digest(actual),'qa_report_sha256':strict.digest(self.qa_path)})
        save(path,receipt);approval={key:receipt[key]for key in['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256','engine_version']}
        approval.update(decision='reviewed',review_note='Synthetic fixture only',ctc_receipt_sha256=strict.digest(actual),
            CTC_binding=binding,qa_report_sha256=strict.digest(self.qa_path))
        qualification=self.run/'word-cues/qualifications.private.json';save(qualification,{'approvals':{ident:approval}})
        entry=self.cue_entries[ident];entry['words']=[{'word':word['word'],**cue}for word,cue in zip(original['words'],cues)]
        entry['cues_sha256']=receipt['cues_sha256'];self.save_reports()
        p=patch.object(ctc,'model_identity',return_value=model);p.start();self.addCleanup(p.stop)
        return ident,path,archive,actual,qualification

    def test_guarded_ctc_keeps_original_words_and_uses_real_adopted_intervals(self):
        ident,path,archive,actual,qualification=self.adopt_synthetic_ctc();original=strict.read(archive)
        _,clips,_=self.validate();clip=next(c for c in clips if c['id']==ident)
        self.assertEqual(strict.read(path)['words'],original['words'])
        self.assertEqual(clip['word_cues'],strict.read(actual)['alignment']['words']and strict.read(path)['word_cues'])
        self.assertEqual(clip['timing_policy']['original_receipt_sha256'],strict.digest(archive))
        for file in [path,archive,actual,qualification,self.qa_path]:self.assertIn(file,rewrite.evidence_files(self.run))

    def test_forged_stale_ctc_original_archive_and_partial_or_vocal_adoption_fail(self):
        ident,path,archive,actual,qualification=self.adopt_synthetic_ctc()
        originals={p:p.read_bytes()for p in [path,archive,actual,qualification,self.qa_path]}
        mutations=[(path,lambda r:r['CTC_adoption'].update(ctc_receipt_sha256='wrong')),
            (qualification,lambda r:r['approvals'][ident].update(decision='pending')),
            (actual,lambda r:r['binding'].update(audio_sha256='wrong')),
            (actual,lambda r:r['alignment']['words'][0].update(end=.3)),
            (archive,lambda r:r['words'][0].update(start=.12)),
            (archive,lambda r:r.update(raw_word_cues=[{'start':0,'end':0}])),
            (self.qa_path,lambda r:r['clip_sha256'].update({ident:'wrong'})),
            (path,lambda r:r.update(engine_version=strict.ALIGNMENT_ENGINE+'/story-partial-dual-CTC-private-adoption-v1')),
            (path,lambda r:r.update(engine_version=strict.ALIGNMENT_ENGINE+'/single-root-qualified-scream-waveform-v1'))]
        for target,mutate in mutations:
            for file,body in originals.items():file.write_bytes(body)
            body=strict.read(target);mutate(body);save(target,body)
            with self.subTest(target=target.name),self.assertRaises(strict.Invalid):self.validate()

    def test_forged_matching_ctc_hashes_cannot_bypass_original_technical_review(self):
        ident,path,archive,actual,qualification=self.adopt_synthetic_ctc()
        originals={p:p.read_bytes()for p in [path,archive,actual,qualification,self.qa_path]}
        mutations=[lambda c:c['alignment']['character_alignment'][0].update(confidence=.01),
            lambda c:c['alignment']['words'][0].update(waveform_active_fraction=0.),
            lambda c:c['alignment']['words'][0].update(confidence=.01),
            lambda c:c['alignment'].update(qualification_flags=[{'word_index':0,'reason':'CTC_word_without_waveform_support'}]),
            lambda c:c.update(normalized_characters='forged')]
        for mutate in mutations:
            for file,body in originals.items():file.write_bytes(body)
            ctc=strict.read(actual);mutate(ctc);save(actual,ctc)
            receipt=strict.read(path);receipt['CTC_adoption']['ctc_receipt_sha256']=strict.digest(actual);save(path,receipt)
            approvals=strict.read(qualification);approvals['approvals'][ident]['ctc_receipt_sha256']=strict.digest(actual);save(qualification,approvals)
            # Provenance-only cache accepts all matching hashes. The actual
            # original technical guard must still reject weak/forged evidence.
            expected={key:receipt[key]for key in['audio_sha256','text_sha256','source_manifest_sha256']}
            self.assertTrue(rewrite.word_driver.qualified_CTC_cache(receipt,expected,approvals['approvals'][ident],self.run))
            with self.subTest(mutate=mutate),self.assertRaisesRegex(strict.Invalid,'technical CTC review rejected'):self.validate()

    def prepare_punctuation45(self):
        for index in range(42):
            line=self.lines[index];count=2 if index<3 else 1
            tokens=['Hallo',*(['…']*count),'Welt'];line.update(text=' '.join(tokens),display_text=' '.join(tokens))
            line['runtime_keys'][0]['text']=line['text'];ident=line['id'];text_sha=strict.sha(line['text'].encode())
            self.text_hash[ident]=text_sha;self.qa_entries[index]['text_sha256']=text_sha
            cues=[{'start':0.,'end':.5},*([{'start':.5,'end':.5}]*count),{'start':.5,'end':1.}]
            self.cue_entries[ident]={'words':[{'word':word,**cue}for word,cue in zip(tokens,cues)],
                'word_count':len(tokens),'text_sha256':text_sha,'cues_sha256':strict.acoustic.cue_sha(cues)}
        self.frozen['runtime_lookup']=[{**key,'asset_id':line['id']}for line in self.lines for key in line['runtime_keys']]
        save(self.run/'lines.private.json',self.frozen);save(self.run/'full-inventory.private.json',self.frozen)
        payload=''.join(json.dumps({'key':line['id'],'request':strict.common.request_for(line,self.profile['speakers'])})+'\n'for line in self.lines)
        (self.run/'requests.jsonl').write_text(payload);self.info['input_bytes']=len(payload.encode());self.bind_prepared()
        self.qa['manifest_sha256']=self.align['source_manifest_sha256']=strict.digest(self.run/'lines.private.json')
        self.save_reports()
        for line in self.lines:self.save_receipt(line['id'])
        p=patch.object(rewrite,'FROZEN_MANIFEST_SHA256',self.qa['manifest_sha256']);p.start();self.addCleanup(p.stop)

    def publisher_args(self):
        inventory=self.fixture.inventory;current=copy.deepcopy(self.frozen)
        missing=copy.deepcopy(self.lines[0]);missing.update(id='story-'+'f'*24,text='Noch offen',display_text='Noch offen')
        missing['runtime_keys'][0]['text']=missing['text'];current['lines'].append(missing)
        current['runtime_lookup'].extend({**key,'asset_id':missing['id']}for key in missing['runtime_keys']);save(inventory,current)
        profiles=self.root/'docs/voice-production/story-speakers.json';save(profiles,self.profile)
        args=SimpleNamespace(current_inventory=inventory,profiles=profiles,supplements=self.run/'supplements.json',
            root_selection=self.run/'selection.json',public_dir=self.root/'game/public/audio/story')
        record={'run_dir':str(self.run),'qa_report':str(self.qa_path),'alignment_report':str(self.align_path),
            'manifest_sha256':self.qa['manifest_sha256'],'qa_sha256':strict.digest(self.qa_path),
            'alignment_sha256':strict.digest(self.align_path),'removed_current_ids':[]}
        save(args.supplements,{'runs':[record]})
        self.selection={'status':incremental.APPROVED,'reviewed_by':'root synthetic fixture',
            'reason':'Synthetic complete scope used only in local test temporary directory.',
            'current_inventory_sha256':strict.digest(inventory),'profiles_sha256':strict.digest(profiles),
            'supplements_sha256':strict.digest(args.supplements),'requested_ids':[line['id']for line in self.lines],
            'retired_ids':[],'existing_manifest_sha256':None,'withdrawn_ids':{}}
        save(args.root_selection,self.selection)
        p=patch.object(incremental,'scanner_inventory',return_value={'synthetic_scanner_fixture':True});p.start();self.addCleanup(p.stop)
        return args,current

    def test_45_punctuation_repeated_apply_and_future_retention_keep_all_gates(self):
        self.prepare_punctuation45();args,current=self.publisher_args()
        manifest,paths,coverage=incremental.build(args)
        self.assertEqual(sum(cue['start']==cue['end']for clip in manifest['clips']for cue in clip['word_cues']),45)
        incremental.publish(args.public_dir,manifest,paths,lambda:incremental.recheck(self.root,paths,manifest,coverage))
        self.selection['existing_manifest_sha256']=strict.digest(args.public_dir/'manifest.json');save(args.root_selection,self.selection)
        again,paths,coverage=incremental.build(args);self.assertEqual(again,manifest)
        incremental.publish(args.public_dir,again,paths,lambda:incremental.recheck(self.root,paths,again,coverage))
        # Next different, original-strict one-take run replaces a positive take;
        # all forty-five collapsed punctuation cues remain retained unchanged.
        future=self.run.parent/'future-one';shutil.copytree(self.run,future)
        ident=self.lines[100]['id'];frozen=copy.deepcopy(self.frozen);frozen['lines']=[self.lines[100]]
        frozen['runtime_lookup']=[{**key,'asset_id':ident}for key in self.lines[100]['runtime_keys']]
        save(future/'lines.private.json',frozen)
        payload=json.dumps({'key':ident,'request':strict.common.request_for(self.lines[100],self.profile['speakers'])})+'\n';(future/'requests.jsonl').write_text(payload)
        info=copy.deepcopy(self.info);info.update(request_count=1,input_bytes=len(payload.encode()),manifest_sha256=strict.digest(future/'lines.private.json'),input_sha256=strict.digest(future/'requests.jsonl'));save(future/'prepared.json',info)
        save(future/'collection.private.json',{'collected':1,'expected':1,'failures':[]})
        qa=copy.deepcopy(self.qa);qa.update(manifest_sha256=info['manifest_sha256'],checked_ids=[ident],clip_sha256={ident:self.audio_hash[ident]},takes=[self.qa_entries[100]]);save(future/'qa.json',qa)
        align=copy.deepcopy(self.align);align.update(source_manifest_sha256=info['manifest_sha256'],clip_sha256={ident:self.audio_hash[ident]},authored_text_sha256={ident:self.text_hash[ident]},alignment_by_id={ident:self.cue_entries[ident]});save(future/'align.json',align)
        save(args.supplements,{'runs':[{'run_dir':str(future),'qa_report':str(future/'qa.json'),'alignment_report':str(future/'align.json'),
            'manifest_sha256':info['manifest_sha256'],'qa_sha256':strict.digest(future/'qa.json'),'alignment_sha256':strict.digest(future/'align.json'),'removed_current_ids':[]}]})
        self.selection.update(requested_ids=[ident],supplements_sha256=strict.digest(args.supplements),existing_manifest_sha256=strict.digest(args.public_dir/'manifest.json'));save(args.root_selection,self.selection)
        future_manifest,paths,coverage=incremental.build(args)
        self.assertEqual(len(future_manifest['clips']),490);self.assertEqual(len(coverage['missing_ids']),1)
        self.assertEqual(sum(cue['start']==cue['end']for clip in future_manifest['clips']for cue in clip['word_cues']),45)
        self.assertFalse(coverage['full_original_bank_approved'])
        self.assertIn(str(self.run/'word-cues'/(self.lines[0]['id']+'.json')),coverage['input_files_sha256'])
        incremental.publish(args.public_dir,future_manifest,paths,lambda:incremental.recheck(self.root,paths,future_manifest,coverage))

    def test_retention_marker_cannot_authorize_forgery_stale_source_receipt_or_spoken_zero(self):
        _,clips,_=self.validate();clip=clips[0];current=self.lines[0]
        original=copy.deepcopy(clip)
        mutations=[lambda c:c.update(timing_policy=None),lambda c:c['timing_policy'].update(method='universal'),
            lambda c:c['timing_policy'].update(extra=True),lambda c:c['timing_policy'].update(frozen_manifest_sha256='wrong'),
            lambda c:c['timing_policy'].update(receipt_sha256='wrong'),lambda c:c['timing_policy'].update(original_receipt_sha256='wrong'),
            lambda c:c['timing_policy'].update(profiles_sha256='wrong'),lambda c:c['timing_policy'].update(prepared_sha256='wrong'),
            lambda c:c.update(id='story-'+'f'*24),lambda c:c.update(sha256='wrong'),
            lambda c:c.update(voice='wrong'),lambda c:c.update(kind='bark'),lambda c:c['word_cues'][0].update(end=0.),lambda c:c.update(seconds=True)]
        for mutate in mutations:
            value=copy.deepcopy(original);mutate(value)
            with self.subTest(value=value['timing_policy']),self.assertRaises(strict.Invalid):incremental.cue_check(value,current,self.root)
        for key,value in [('kind','bark'),('speaker','wrong'),('text','Hallo ! Welt'),('direction_en','wrong'),('mood','wrong'),('runtime_keys',[])]:
            row=copy.deepcopy(current);row[key]=value
            with self.subTest(key=key),self.assertRaises(strict.Invalid):incremental.cue_check(original,row,self.root)
        path=self.run/'word-cues'/(clip['id']+'.json');body=strict.read(path);body['words'][1]['spoken']=True;save(path,body)
        with self.assertRaises(strict.Invalid):incremental.cue_check(original,current,self.root)

    def test_existing_root_manifest_audio_and_unmarked_old_zero_stay_strict(self):
        _,clips,paths=self.validate();clip=clips[0];target=self.root/'game/public/audio/story'
        manifest={'model':strict.MODEL,'clips':[clip]};incremental.publish(target,manifest,{clip['id']:paths[clip['id']]})
        expected=strict.digest(target/'manifest.json');rows={clip['id']:self.lines[0]}
        with self.assertRaisesRegex(strict.Invalid,'Root selection'):
            incremental.existing_assets(target,'wrong',rows,self.profile,set(),set(),self.root)
        (target/(clip['id']+'.mp3')).write_bytes(b'tampered')
        with self.assertRaisesRegex(strict.Invalid,'audio/path/hash'):
            incremental.existing_assets(target,expected,rows,self.profile,set(),set(),self.root)
        unmarked=copy.deepcopy(clip);del unmarked['timing_policy']
        with self.assertRaisesRegex(strict.Invalid,'collapsed'):incremental.cue_check(unmarked)

    def test_retained_marker_rejects_protected_driver_drift_on_future_strict_run(self):
        _,clips,_=self.validate()
        with patch.dict(rewrite.PROTECTED,{'story_voice_qa.py':'changed'}):
            with self.assertRaisesRegex(strict.Invalid,'Protected original'):
                incremental.cue_check(clips[0],self.lines[0],self.root)

    def test_complete_original_guard_body_identical_except_one_predicate(self):
        original=ast.parse(inspect.getsource(strict.validate_run)).body[0]
        copied=ast.parse(inspect.getsource(rewrite._original_guards)).body[0];copied.name=original.name
        def guard(node):
            matches=[call for call in ast.walk(node) if isinstance(call,ast.Call) and isinstance(call.func,ast.Name)
                     and call.func.id=='require' and len(call.args)==2 and isinstance(call.args[1],ast.Constant)
                     and call.args[1].value=='Invalid aligned timing']
            self.assertEqual(len(matches),1);return matches[0]
        new=guard(copied); self.assertEqual(ast.unparse(new.args[0]),'_valid_interval(run, line, entry, word, previous, seconds)')
        new.args[0]=copy.deepcopy(guard(original).args[0])
        self.assertEqual(ast.dump(copied),ast.dump(original))
        for name in ['require','read','digest','contained','sha','common','validate_pff_derived','validate_vocal_variant']:
            self.assertIs(getattr(rewrite,name),getattr(strict,name))

    def test_genuine_zero_punctuation_preserved_while_original_validator_stays_strict(self):
        _,clips,paths=self.validate();self.assertEqual(len(clips),490);self.assertEqual(len(paths),490)
        self.assertEqual(clips[0]['word_cues'][1],{'start':.5,'end':.5})
        with self.assertRaisesRegex(strict.Invalid,'Invalid aligned timing'):
            strict.validate_run(self.run,self.qa_path,self.align_path,490,self.root)

    def test_wrong_scope_count_frozen_hash_and_outside_private_root_fail(self):
        self.assertFalse(rewrite.supports_run(self.run,1557))
        with patch.object(rewrite,'FROZEN_MANIFEST_SHA256','wrong'):
            with self.assertRaisesRegex(strict.Invalid,'exact frozen'):self.validate()
        with self.assertRaisesRegex(strict.Invalid,'private workspace'):
            rewrite.validate_run(self.run,self.qa_path,self.align_path,490,self.root/'other')

    def test_protected_original_driver_change_is_rejected(self):
        with patch.dict(rewrite.PROTECTED,{'story_voice_publish.py':'changed'}):
            with self.assertRaisesRegex(strict.Invalid,'Protected original'):self.validate()

    def test_49_unicode_punctuation_tokens_and_unknown_symbols(self):
        punctuation=list('!#%&(),./:;?@[\\]_{}¡§«¶·»¿‐‑‒–—―‘’‚‛“”„‟†‡•‣…‹›⁂⁎')
        self.assertEqual(len(punctuation),49)
        for token in punctuation:self.assertTrue(rewrite.pure_punctuation(token),token)
        for token in ['', ' ', 'Ich', 'die', '2', '…a', '+', '★', '♪', '😀']:
            self.assertFalse(rewrite.pure_punctuation(token),token)

    def test_spoken_zero_even_false_receipt_flag_cannot_pass(self):
        ident=self.lines[1]['id'];entry=self.cue_entries[ident];entry['words'][0]['end']=0.
        entry['cues_sha256']=strict.acoustic.cue_sha([{'start':w['start'],'end':w['end']} for w in entry['words']])
        self.save_receipt(ident);self.save_reports()
        receipt_path=self.run/'word-cues'/(ident+'.json');receipt=strict.read(receipt_path);receipt['words'][0]['spoken']=False;save(receipt_path,receipt)
        with self.assertRaisesRegex(strict.Invalid,'Invalid aligned timing'):self.validate()

    def test_invalid_scalar_order_range_and_zero_not_previous_end_fail(self):
        ident=self.lines[0]['id'];original=copy.deepcopy(self.cue_entries[ident])
        for start,end in [(True,True),(float('nan'),.5),(.5,float('inf')),(-.1,-.1),(.49,.49),(.6,.6),(.5,.4),(.5,2.)]:
            self.cue_entries[ident]=copy.deepcopy(original);word=self.cue_entries[ident]['words'][1];word.update(start=start,end=end)
            self.cue_entries[ident]['cues_sha256']=strict.acoustic.cue_sha([{'start':w['start'],'end':w['end']} for w in self.cue_entries[ident]['words']])
            self.save_receipt(ident);self.save_reports()
            with self.subTest(start=start,end=end),self.assertRaises((strict.Invalid,ValueError)):self.validate()

    def test_receipt_body_classification_source_audio_engine_duration_and_hash_tampering_fail(self):
        path=self.run/'word-cues'/(self.lines[0]['id']+'.json');original=strict.read(path)
        mutations=[]
        for field,value in [('id','unknown'),('text','other'),('audio_sha256','wrong'),('text_sha256','wrong'),
            ('source_manifest_sha256','wrong'),('engine_version','unknown'),('decoded_seconds',True),('decoded_seconds',2.),('cues_sha256','wrong')]:
            body=copy.deepcopy(original);body[field]=value;mutations.append(body)
        body=copy.deepcopy(original);body['words'][1]['spoken']=True;mutations.append(body)
        body=copy.deepcopy(original);body['words'][1]['spoken']=0;mutations.append(body)
        body=copy.deepcopy(original);body['words'][1]['word']='!';mutations.append(body)
        body=copy.deepcopy(original);body['word_cues'][1]['end']=.51;mutations.append(body)
        for body in mutations:
            save(path,body)
            with self.subTest(body=body),self.assertRaises((strict.Invalid,ValueError,KeyError,TypeError)):self.validate()

    def test_fake_epsilon_projection_does_not_match_actual_receipt(self):
        ident=self.lines[0]['id'];entry=self.cue_entries[ident];entry['words'][1]['end']=.501;entry['words'][2]['start']=.501
        entry['cues_sha256']=strict.acoustic.cue_sha([{'start':w['start'],'end':w['end']} for w in entry['words']]);self.save_reports()
        with self.assertRaisesRegex(strict.Invalid,'actual receipt intervals'):self.validate()

    def test_missing_or_escaping_receipt_fails(self):
        path=self.run/'word-cues'/(self.lines[0]['id']+'.json');outside=self.root/'outside.json';shutil.copy(path,outside);path.unlink()
        with self.assertRaisesRegex(strict.Invalid,'Missing'):self.validate()
        path.symlink_to(outside)
        # Same workspace outside run still escapes the receipt namespace.
        with self.assertRaisesRegex(strict.Invalid,'escaping'):self.validate()

    def test_qa_status_model_duplicate_stale_signal_and_decoder_reasons_fail(self):
        original=copy.deepcopy(self.qa);mutations=[]
        for field,value in [('status','review_required'),('model','wrong'),('manifest_sha256','wrong'),('version','wrong'),
                            ('checked_ids',self.qa['checked_ids'][:-1]),('failures',[{'id':self.lines[0]['id'],'reason':'possible_clipping'}])]:
            body=copy.deepcopy(original);body[field]=value;mutations.append(body)
        body=copy.deepcopy(original);body['takes'].append(copy.deepcopy(body['takes'][0]));mutations.append(body)
        for reason in ['possible_clipping','asr_check_failed_ValueError','root_lexical_veto','asr_lexical_mismatch_requires_review']:
            body=copy.deepcopy(original);body['takes'][0]['reasons']=[reason];mutations.append(body)
        body=copy.deepcopy(original);body['clip_sha256'][self.lines[0]['id']]='wrong';mutations.append(body)
        body=copy.deepcopy(original);body['takes'][0]['signal']['seconds']=False;mutations.append(body)
        for body in mutations:
            save(self.qa_path,body)
            with self.subTest(body=body),self.assertRaises((strict.Invalid,KeyError,TypeError)):self.validate()

    def test_alignment_qualification_body_count_hash_model_extra_ids_fail(self):
        original=copy.deepcopy(self.align);ident=self.lines[0]['id'];mutations=[]
        for field,value in [('status','needs_review'),('requires_qualification',[ident]),('failures',[{'id':ident}]),
                            ('source_manifest_sha256','wrong'),('method','wrong'),('model','wrong')]:
            body=copy.deepcopy(original);body[field]=value;mutations.append(body)
        for key,value in [('word_count',2),('text_sha256','wrong'),('cues_sha256','wrong')]:
            body=copy.deepcopy(original);body['alignment_by_id'][ident][key]=value;mutations.append(body)
        body=copy.deepcopy(original);body['alignment_by_id'][ident]['words'][1]['word']='!';mutations.append(body)
        body=copy.deepcopy(original);body['clip_sha256']['story-'+'f'*24]='unknown';mutations.append(body)
        for body in mutations:
            save(self.align_path,body)
            with self.subTest(body=body),self.assertRaises((strict.Invalid,KeyError,TypeError)):self.validate()

    def test_prepared_requests_cast_collection_and_source_archive_guards_preserved(self):
        originals={name:(self.run/name).read_bytes() for name in ['requests.jsonl','profiles.private.json','source-snapshot.private.json','collection.private.json']}
        for name in originals:
            if name=='collection.private.json':save(self.run/name,{'expected':490,'collected':489,'failures':[]})
            else:(self.run/name).write_bytes(b'changed')
            with self.subTest(name=name),self.assertRaises(strict.Invalid):self.validate()
            (self.run/name).write_bytes(originals[name])
        snapshot=strict.read(self.run/'source-snapshot.private.json');next(iter(snapshot.values()))['text']='changed';save(self.run/'source-snapshot.private.json',snapshot);self.bind_prepared()
        with self.assertRaisesRegex(strict.Invalid,'Archived source changed'):self.validate()

    def test_receipt_hash_rechecked_after_validation(self):
        original=rewrite._original_guards;path=self.run/'word-cues'/(self.lines[-1]['id']+'.json')
        def changed(*args):
            result=original(*args);body=strict.read(path);body['unrelated_mutation']=True;save(path,body);return result
        with patch.object(rewrite,'_original_guards',side_effect=changed):
            with self.assertRaisesRegex(strict.Invalid,'evidence changed'):self.validate()


class GenuineReferenceTests(unittest.TestCase):
    def test_actual_root6_ctc_adoptions_validate_individually_without_full_qa_projection(self):
        run=Path(rewrite.__file__).resolve().parent.parent/'output/audio/story-voice'/rewrite.RUN_NAME
        proof=run/'ctc-timing12-review/root-apply6/root-review.private.json'
        if not proof.exists():self.skipTest('Actual private Root6 CTC adoption proof unavailable')
        decisions=strict.read(proof)['records'];self.assertEqual(len(decisions),6)
        lines={line['id']:line for line in strict.read(run/'lines.private.json')['lines']}
        alignment=strict.read(run/'word-cues/alignment.private.json');cache={}
        before={path:strict.digest(path)for path in[proof,run/'word-cues/qualifications.private.json',run/'word-cues/alignment.private.json']}
        for decision in decisions:
            ident=decision['id'];path=run/'word-cues'/(ident+'.json');before[path]=strict.digest(path)
            receipt=strict.read(path)
            with self.subTest(ident=ident):
                self.assertEqual(rewrite._bound_receipt(run,lines[ident],alignment['alignment_by_id'][ident],
                                                       receipt['decoded_seconds'],cache),receipt)
                self.assertNotEqual(receipt['word_cues'],receipt['original_DTW_word_cues'])
        self.assertEqual(before,{path:strict.digest(path)for path in before})

    def test_actual_guarded_655_ctc_receipt_preserves_archived_dtw_and_uses_adopted_cues(self):
        run=Path(rewrite.__file__).resolve().parent.parent/'output/audio/story-voice'/rewrite.RUN_NAME
        ident='story-65575ae6bbf3db6a3fc3d4b7';path=run/'word-cues'/(ident+'.json')
        if not path.exists():self.skipTest('Actual private655 CTC receipt unavailable')
        receipt=strict.read(path)
        if receipt.get('engine_version')==strict.ALIGNMENT_ENGINE:self.skipTest('Actual655 not yet adopted')
        line=next(row for row in strict.read(run/'lines.private.json')['lines']if row['id']==ident)
        entry={'words':[{'word':detail['word'],**cue}for detail,cue in zip(receipt['words'],receipt['word_cues'])],
            'cues_sha256':receipt['cues_sha256']}
        before=path.read_bytes();self.assertEqual(rewrite._bound_receipt(run,line,entry,receipt['decoded_seconds']),receipt)
        self.assertEqual(path.read_bytes(),before)
        self.assertTrue(any(detail['start']!=cue['start']or detail['end']!=cue['end']
                            for detail,cue in zip(receipt['words'],receipt['word_cues'])))

    def test_actual_45_unspoken_zeros_accept_and_two_spoken_zeros_reject(self):
        run=Path(rewrite.__file__).resolve().parent.parent/'output/audio/story-voice'/rewrite.RUN_NAME
        if not (run/'word-cues/alignment.private.json').exists():self.skipTest('Actual private rewrite receipts unavailable')
        rows={r['id']:r for r in strict.read(run/'lines.private.json')['lines']};punctuation=spoken=0
        for ident,line in rows.items():
            receipt=strict.read(run/'word-cues'/(ident+'.json'));entry={'words':[{'word':word['word'],**cue} for word,cue in zip(receipt['words'],receipt['word_cues'])],
                'cues_sha256':receipt['cues_sha256']};previous=0.
            for detail,word in zip(receipt['words'],entry['words']):
                if word['start']==word['end']:
                    valid=rewrite._valid_interval(run,line,entry,word,previous,receipt['decoded_seconds'])
                    if detail['spoken']:spoken+=1;self.assertFalse(valid)
                    else:punctuation+=1;self.assertTrue(valid)
                previous=word['end']
        self.assertEqual(punctuation,45)
        # The timing owner may have replaced a current collapsed cue with a
        # genuinely measured interval. Its immutable initial audit retains both.
        initial=run/'timing-offline-review/spoken2-collapsed-cues.private.json'
        if initial.exists():
            cases=strict.read(initial);self.assertEqual(len(cases),2)
            for case in cases:
                word={'word':case['token'],**case['final_cue']}
                self.assertFalse(rewrite._valid_interval(run,rows[case['id']],{'words':[word]},word,
                                                         case['preceding_final_cue_end'],case['decoded_seconds']))
        self.assertLessEqual(spoken,2)


class IncrementalRoutingTests(unittest.TestCase):
    def setUp(self):
        self.fixture=incremental_fixtures.IncrementalTests();self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)

    def test_other_run_uses_unchanged_original_strict_validator(self):
        with patch.object(rewrite,'validate_run',side_effect=AssertionError('Must not select rewrite policy')):
            manifest,_,_=incremental.build(self.fixture.args)
        self.assertEqual(len(manifest['clips']),1)

    def test_scoped_route_binds_all_receipts_and_rechecks_them_before_swap(self):
        fixture=self.fixture;receipt=fixture.run/'word-cues'/(fixture.ident+'.json');save(receipt,{'engine_version':strict.ALIGNMENT_ENGINE,'synthetic_routing_fixture':True})
        with patch.object(rewrite,'supports_run',return_value=True),patch.object(rewrite,'validate_run',wraps=strict.validate_run) as called:
            manifest,paths,coverage=incremental.build(fixture.args)
        self.assertEqual(called.call_count,1)
        self.assertEqual(coverage['input_files_sha256'][str(receipt.resolve())],strict.digest(receipt))
        self.assertIn(str(Path(rewrite.__file__)),coverage['protected_driver_sha256'])
        save(receipt,{'synthetic_routing_fixture':'changed after strict validation'})
        with self.assertRaisesRegex(strict.Invalid,'evidence changed'):
            incremental.recheck(fixture.root,paths,manifest,coverage)


if __name__=='__main__':unittest.main()
