"""Small synthetic offline receipts exercise publication boundaries without inference."""
import copy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_publish as pub

def save(path,data):
    path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(data))

class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name); self.run=self.root/'private/run'
        source=self.root/'game/src/chapter.ts'; source.parent.mkdir(parents=True); source.write_text("say('Hallo Welt');")
        self.ident='story-'+'a'*24
        key={'kind':'say','speaker':'lia','text':'Hallo Welt','scene':'rettung','mood':'neutral','performance_variant':'same'}
        line={'id':self.ident,'kind':'say','speaker':'lia','text':'Hallo Welt','display_text':'Hallo Welt','direction_en':'same','performance_variant':'same','runtime_keys':[key]}
        frozen={'model':pub.MODEL,'source_hashes':{'game/src/chapter.ts':pub.digest(source)},'lines':[line],'runtime_lookup':[{**key,'asset_id':self.ident}],'aliases':{'lia':'lia'},'scene_players':{'rettung':'lia'},'unresolved':[]}
        profiles={'model':pub.MODEL,'speakers':{'lia':{'google_voice':'Zephyr'}}}
        save(self.run/'lines.private.json',frozen); save(self.run/'full-inventory.private.json',frozen);save(self.run/'profiles.private.json',profiles)
        save(self.run/'source-snapshot.private.json',{'game/src/chapter.ts':{'sha256':pub.digest(source),'text':source.read_text()}})
        payload=json.dumps({'key':self.ident,'request':pub.common.request_for(line,profiles['speakers'])})+'\n'; (self.run/'requests.jsonl').write_text(payload)
        info={'bank':'story','model':pub.MODEL,'request_count':1,'input_bytes':len(payload.encode())}
        for file,keyname in [('requests.jsonl','input_sha256'),('lines.private.json','manifest_sha256'),('full-inventory.private.json','full_inventory_sha256'),('profiles.private.json','profiles_sha256'),('source-snapshot.private.json','source_snapshot_sha256')]:info[keyname]=pub.digest(self.run/file)
        save(self.run/'prepared.json',info);save(self.run/'collection.private.json',{'collected':1,'expected':1,'failures':[]})
        clip=self.run/'clips'/(self.ident+'.mp3');clip.parent.mkdir();clip.write_bytes(b'fixture-mp3-bytes')
        h=pub.digest(clip);textsha=pub.sha(b'Hallo Welt');cues=[{'start':0.,'end':.5},{'start':.5,'end':1.}]
        qa={'status':'passed','manifest_sha256':info['manifest_sha256'],'checked_ids':[self.ident],'clip_sha256':{self.ident:h},'failures':[],'takes':[{'id':self.ident,'text_sha256':textsha,'signal':{'seconds':1.},'reasons':[]}]}
        align={'status':'passed','source_manifest_sha256':info['manifest_sha256'],'clip_sha256':{self.ident:h},'authored_text_sha256':{self.ident:textsha},'alignment_by_id':{self.ident:{'words':[{'word':w,**c}for w,c in zip(['Hallo','Welt'],cues)],'word_count':2,'text_sha256':textsha,'cues_sha256':pub.acoustic.cue_sha(cues)}},'requires_qualification':[],'failures':[]}
        save(self.run/'qa.json',qa);save(self.run/'align.json',align)
        current=copy.deepcopy(frozen);current['lines'][0]['runtime_keys'][0]['mood']='scared';current['runtime_lookup'][0]['mood']='scared'
        self.inventory=self.root/'docs/voice-production/story-lines.json';save(self.inventory,current)
        audit={'frozen_inventory_sha256':info['manifest_sha256'],'frozen_lines':1,'fixed_lines':1,'frozen_runtime_keys':1,'fixed_runtime_keys':1,'id_set_same':True,'fixed_unresolved':0,'changed_lines':1,'changed_runtime_keys':1,'changed':[{'id':self.ident,'kind':'say','speaker':'lia','text':'Hallo Welt','old_mood':'neutral','new_mood':'scared','direction_same':True,'direction_en':'same','runtime_keys_before':frozen['lines'][0]['runtime_keys'],'runtime_keys_after':current['lines'][0]['runtime_keys']}]}
        save(self.run/'audit.json',audit)
        self.args=SimpleNamespace(run_dir=self.run,qa_report=self.run/'qa.json',alignment_report=self.run/'align.json',current_inventory=self.inventory,routing_audit=self.run/'audit.json',root_reviewed_routing=True,supplement_run_dir=None,supplement_qa_report=None,supplement_alignment_report=None,current_supplement_inventory=None,public_dir=self.root/'game/public/audio/story')
    def tearDown(self):self.tmp.cleanup()
    def build(self):return pub.build(self.args,expected_count=1,expected_changes=1)
    def add_unarchived_reviews(self,names):
        frozen=pub.read(self.run/'lines.private.json');current=pub.read(self.inventory)
        for name in names:
            path=self.root/name;save(path,{'review':'approved fixture'})
            frozen['source_hashes'][name]=current['source_hashes'][name]=pub.digest(path)
        save(self.run/'lines.private.json',frozen);save(self.run/'full-inventory.private.json',frozen);save(self.inventory,current)
        info=pub.read(self.run/'prepared.json');info['manifest_sha256']=pub.digest(self.run/'lines.private.json');info['full_inventory_sha256']=pub.digest(self.run/'full-inventory.private.json');save(self.run/'prepared.json',info)
        qa=pub.read(self.args.qa_report);qa['manifest_sha256']=info['manifest_sha256'];save(self.args.qa_report,qa)
        alignment=pub.read(self.args.alignment_report);alignment['source_manifest_sha256']=info['manifest_sha256'];save(self.args.alignment_report,alignment)
        audit=pub.read(self.args.routing_audit);audit['frozen_inventory_sha256']=info['manifest_sha256'];save(self.args.routing_audit,audit)

    def test_prepare_compatible_game_archives_plus_exact_six_live_review_bindings(self):
        self.add_unarchived_reviews(sorted(pub.NONARCHIVED_REVIEWS))
        manifest,paths=self.build();self.assertEqual(len(paths),1)
        self.assertEqual(manifest['clips'][0]['runtime_keys'][0]['mood'],'scared')
        with self.assertRaisesRegex(pub.Invalid,'source root required'):
            pub.validate_run(self.run,self.args.qa_report,self.args.alignment_report,1)

    def test_known_nonarchived_review_changed_bytes_are_rejected(self):
        self.add_unarchived_reviews(sorted(pub.NONARCHIVED_REVIEWS))
        (self.root/'docs/voice-production/directions/kapitel-1.json').write_text('changed')
        with self.assertRaisesRegex(pub.Invalid,'Nonarchived frozen review changed'):self.build()

    def test_unknown_nonarchived_source_is_never_accepted_as_review(self):
        self.add_unarchived_reviews(['docs/voice-production/other.json'])
        with self.assertRaisesRegex(pub.Invalid,'unknown archived sources'):self.build()

    def test_missing_game_source_archive_remains_rejected(self):
        save(self.run/'source-snapshot.private.json',{})
        info=pub.read(self.run/'prepared.json');info['source_snapshot_sha256']=pub.digest(self.run/'source-snapshot.private.json');save(self.run/'prepared.json',info)
        with self.assertRaisesRegex(pub.Invalid,'unknown archived sources'):self.build()

    def test_audited_rebind_preserves_audio_cues_and_only_exports_public_material(self):
        manifest,paths=self.build();clip=manifest['clips'][0]
        self.assertEqual(clip['runtime_keys'][0]['mood'],'scared');self.assertEqual(clip['sha256'],pub.digest(paths[self.ident]));self.assertEqual(len(clip['word_cues']),2)
        self.assertFalse(self.args.public_dir.exists());pub.publish(self.args.public_dir,manifest,paths)
        self.assertEqual(set(p.name for p in self.args.public_dir.iterdir()),{'manifest.json',self.ident+'.mp3'})
        self.assertEqual((self.args.public_dir/(self.ident+'.mp3')).read_bytes(),paths[self.ident].read_bytes())
    def test_requires_explicit_review_and_exact_audited_mood(self):
        self.args.root_reviewed_routing=False
        with self.assertRaises(pub.Invalid):self.build()
        self.args.root_reviewed_routing=True; current=pub.read(self.inventory);current['lines'][0]['runtime_keys'][0]['mood']='angry';save(self.inventory,current)
        with self.assertRaises(pub.Invalid):self.build()
    def test_rejects_stale_audio_qa_and_current_source(self):
        (self.run/'clips'/(self.ident+'.mp3')).write_bytes(b'new take')
        with self.assertRaises(pub.Invalid):self.build()
        (self.run/'clips'/(self.ident+'.mp3')).write_bytes(b'fixture-mp3-bytes');(self.root/'game/src/chapter.ts').write_text('changed')
        with self.assertRaises(pub.Invalid):self.build()
    def test_rejects_partial_or_changed_cues_and_missing_reports(self):
        alignment=pub.read(self.args.alignment_report);alignment['alignment_by_id'][self.ident]['words'][1]['start']=.7;save(self.args.alignment_report,alignment)
        with self.assertRaises(pub.Invalid):self.build()
        self.args.qa_report.unlink()
        with self.assertRaises(FileNotFoundError):self.build()
    def test_rejects_source_bound_supplement_text_or_scope_changes(self):
        frozen=pub.read(self.run/'lines.private.json'); current=copy.deepcopy(frozen)
        current['lines'][0]['text']='Other words'
        with self.assertRaises(pub.Invalid):pub.validate_supplement_source(frozen,current,self.root)
        current=copy.deepcopy(frozen)
        with self.assertRaises(pub.Invalid):pub.validate_supplement_source(frozen,current,self.root)

    def test_exact_current_supplement_literal_ast_rebind(self):
        frozen=pub.read(self.run/'lines.private.json')
        frozen['lines'][0]['kind']='bark'; frozen['lines'][0]['runtime_keys'][0]['kind']='bark'; frozen['runtime_lookup'][0]['kind']='bark'
        current=copy.deepcopy(frozen); source=self.root/'game/src/chapter.ts'; source.write_text("// changed visual setup\nsay('Hallo Welt');")
        expression="'Hallo Welt'"; start=source.read_text().index(expression)
        current['source_hashes']['game/src/chapter.ts']=pub.digest(source)
        current['lines'][0]['sources']=[{'file':'game/src/chapter.ts','start':start,'end':start+len(expression),'expression_sha256':pub.sha(expression.encode())}]
        package=Path(pub.__file__).resolve().parents[1]/'game/node_modules/typescript'
        modules=self.root/'game/node_modules';modules.mkdir();(modules/'typescript').symlink_to(package,target_is_directory=True)
        pub.validate_supplement_source(frozen,current,self.root)
        current['lines'][0]['sources'][0]['end']-=1
        with self.assertRaises(pub.Invalid):pub.validate_supplement_source(frozen,current,self.root)

    def test_atomic_replacement_restores_prior_bank_on_install_failure(self):
        manifest,paths=self.build();pub.publish(self.args.public_dir,manifest,paths)
        before=(self.args.public_dir/'manifest.json').read_bytes(); real_rename=Path.rename
        def fail_install(path,target):
            if path.name.startswith('.story-staging-'):raise OSError('simulated install failure')
            return real_rename(path,target)
        with patch.object(Path,'rename',fail_install):
            with self.assertRaises(OSError):pub.publish(self.args.public_dir,manifest,paths)
        self.assertEqual((self.args.public_dir/'manifest.json').read_bytes(),before)
        self.assertFalse(list(self.args.public_dir.parent.glob('.story-staging-*')))

    def test_duplicate_and_extra_report_receipts_are_rejected(self):
        qa=pub.read(self.args.qa_report); original=copy.deepcopy(qa)
        qa['checked_ids'].append(self.ident);save(self.args.qa_report,qa)
        with self.assertRaises(pub.Invalid):self.build()
        qa=copy.deepcopy(original);qa['takes'].append(copy.deepcopy(qa['takes'][0]));save(self.args.qa_report,qa)
        with self.assertRaises(pub.Invalid):self.build()
        qa=copy.deepcopy(original);qa['clip_sha256']['story-'+'b'*24]='0'*64;save(self.args.qa_report,qa)
        with self.assertRaises(pub.Invalid):self.build()

    def test_zero_length_cues_and_wrong_producer_are_rejected(self):
        alignment=pub.read(self.args.alignment_report);alignment['alignment_by_id'][self.ident]['words'][0]['end']=0
        save(self.args.alignment_report,alignment)
        with self.assertRaises(pub.Invalid):self.build()
        qa=pub.read(self.args.qa_report);qa['model']='unreviewed-asr';save(self.args.qa_report,qa)
        with self.assertRaises(pub.Invalid):self.build()

    def test_current_supplement_cast_scene_duplicates_and_source_hash_are_rejected(self):
        frozen=pub.read(self.run/'lines.private.json');frozen['lines'][0]['kind']='bark';frozen['runtime_lookup'][0]['kind']='bark'
        current=copy.deepcopy(frozen)
        current['lines'][0]['speaker']='gira'
        with self.assertRaises(pub.Invalid):pub.validate_supplement_source(frozen,current,self.root)
        current=copy.deepcopy(frozen);current['runtime_lookup'][0]['scene']='other'
        with self.assertRaises(pub.Invalid):pub.validate_supplement_source(frozen,current,self.root)
        current=copy.deepcopy(frozen);current['source_hashes']['game/src/chapter.ts']='0'*64
        with self.assertRaises(pub.Invalid):pub.validate_supplement_source(frozen,current,self.root)
        current=copy.deepcopy(frozen);expr="'Hallo Welt'";start=(self.root/'game/src/chapter.ts').read_text().index(expr)
        binding={'file':'game/src/chapter.ts','start':start,'end':start+len(expr),'expression_sha256':pub.sha(expr.encode())}
        current['lines'][0]['sources']=[binding,binding]
        modules=self.root/'game/node_modules';modules.mkdir();(modules/'typescript').symlink_to(Path(pub.__file__).resolve().parents[1]/'game/node_modules/typescript',target_is_directory=True)
        with self.assertRaisesRegex(pub.Invalid,'Ambiguous supplement'):pub.validate_supplement_source(frozen,current,self.root)

    def test_supplement_id_collision_is_rejected_before_publication(self):
        self.args.supplement_run_dir=self.run;self.args.supplement_qa_report=self.args.qa_report;self.args.supplement_alignment_report=self.args.alignment_report;self.args.current_supplement_inventory=self.inventory
        with patch.object(pub,'validate_supplement_source'):
            with self.assertRaisesRegex(pub.Invalid,'ID collision'):pub.build(self.args,expected_count=1,expected_changes=1,supplement_count=1)

    def derived_fixture(self):
        source={'id':pub.VARIANT_SOURCE,'kind':'say','speaker':'azar','scene':'ueberfall','mood':'scared','text':'AAAH!','direction_en':'cry'}
        target={**source,'id':pub.VARIANT_TARGET,'text':'AAAAH!'}
        frozen={'model':pub.MODEL,'lines':[source,target]};profiles={'speakers':{'azar':{'google_voice':'Charon'}}}
        request=pub.common.request_for(source,profiles['speakers']);request_sha=pub.sha(json.dumps(request,sort_keys=True).encode())
        for ident,data in [(pub.VARIANT_SOURCE,b'source'),(pub.VARIANT_TARGET,b'derived')]:
            (self.run/'raw').mkdir(exist_ok=True);(self.run/'raw'/(ident+'.wav')).write_bytes(data+b'wave');(self.run/'clips'/(ident+'.mp3')).write_bytes(data+b'mp3')
        source_receipt={'status':'complete','model':pub.MODEL,'request_sha256':request_sha,'wav_sha256':pub.digest(self.run/'raw'/(pub.VARIANT_SOURCE+'.wav')),'mp3_sha256':pub.digest(self.run/'clips'/(pub.VARIANT_SOURCE+'.mp3'))}
        save(self.run/'raw'/(pub.VARIANT_SOURCE+'.receipt.json'),source_receipt)
        archive=self.run/'rejected/variant';archive.mkdir(parents=True)
        for suffix in ['.wav','.mp3','.receipt.json']:(archive/(pub.VARIANT_TARGET+suffix)).write_bytes(b'original'+suffix.encode())
        proof={'proof':'source-vocal-proof'}
        plan={'source_id':pub.VARIANT_SOURCE,'target_id':pub.VARIANT_TARGET,'source_qa_file':'sourceQA.json','source_qc_file':'sourceQC.json','source_vocal_adjudications_file':'sourceApproval.json','root_approval_file':'rootApproval.json','artifacts':{}}
        for file in ['sourceQA.json','sourceQC.json','sourceApproval.json']:save(self.run/file,{'evidence':file})
        approval={'approved':True,'source_id':pub.VARIANT_SOURCE,'target_id':pub.VARIANT_TARGET,'source_mp3_sha256':source_receipt['mp3_sha256'],'target_mp3_sha256':pub.digest(archive/(pub.VARIANT_TARGET+'.mp3'))};save(self.run/'rootApproval.json',approval)
        files=['prepared.json','profiles.private.json','lines.private.json','requests.jsonl','sourceQA.json','sourceQC.json','sourceApproval.json','rootApproval.json']
        for name in files:plan['artifacts'][name]=pub.digest(self.run/name)
        for ident in [pub.VARIANT_SOURCE,pub.VARIANT_TARGET]:
            for folder,suffix in [('raw','.wav'),('raw','.receipt.json'),('clips','.mp3')]:
                path=archive/(ident+suffix) if ident==pub.VARIANT_TARGET else self.run/folder/(ident+suffix)
                plan['artifacts'][folder+'/'+ident+suffix]=pub.digest(path)
        plan_path=self.run/'variant-plan.json';save(plan_path,plan)
        receipt={'id':pub.VARIANT_TARGET,'status':'complete','backend':'derived_single_nonlexical_event','model':pub.MODEL,'google_voice':'Charon','source_id':pub.VARIANT_SOURCE,'source_tts_request_sha256':request_sha,'source_receipt_sha256':plan['artifacts']['raw/'+pub.VARIANT_SOURCE+'.receipt.json'],'source_wav_sha256':source_receipt['wav_sha256'],'source_mp3_sha256':source_receipt['mp3_sha256'],'target_original_text_sha256':pub.sha(target['text'].encode()),'transform':{'filter':'atempo=1.12','pitch_preserved':True},'source_vocal_proof':proof,'vocal_qc_required':True,'mp3_sha256':pub.digest(self.run/'clips'/(pub.VARIANT_TARGET+'.mp3')),'wav_sha256':pub.digest(self.run/'raw'/(pub.VARIANT_TARGET+'.wav'))}
        save(self.run/'vocal-variants/azar-first-cry.private.json',{'state':'IMPORTED_REQUIRES_FRESH_QA','plan_sha256':pub.digest(plan_path),'archive':str(archive),'source_id':pub.VARIANT_SOURCE,'target_id':pub.VARIANT_TARGET,'rate':1.12,'new_mp3_sha256':receipt['mp3_sha256']})
        self.variant_qc,self.variant_adjudications=self.target_qc_fixture(target,receipt)
        return frozen,profiles,receipt,plan_path,proof

    def target_qc_fixture(self,target,receipt,category='scream',confidence=.92,transcript=''):
        import story_voice_qa as qa
        import story_voice_vocal_qc as qc
        event={'category':category,'description':'One observed vocal event','vocal_sound':'aaah','confidence':confidence}
        response={'modelVersion':qc.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':transcript,'events':[event]})}]}}]}
        clipsha=receipt['mp3_sha256'];textsha=qa.text_hash(target['text'])
        record={'id':pub.VARIANT_TARGET,'clip_sha256':clipsha,'source_audio_sha256':clipsha,'upload_sha256':clipsha,'source_text_sha256':textsha,'input_mime_type':'audio/mpeg','model':qc.MODEL,'prompt':qc.PROMPT,'transcript':transcript,'response':response,**qc.cache_metadata()}
        approval={'channel':'vocal-qc','status':'approved_vocal_events','reviewed_by':'root fixture reviewer','reason':'Explicit current target event binding',
            'clip_sha256':clipsha,'text_sha256':textsha,'vocal_record_sha256':qa.canonical_record_hash(record),'raw_response_sha256':qa.canonical_record_hash(response),'transcript_sha256':qa.text_hash(transcript),
            'expected_tokens':qa.words(target['text']),'observed_tokens':qa.words(transcript),**qc.cache_metadata(),
            'source_events':[{'source_token_index':0,'source_token':qa.words(target['text'])[0],'category':category,'event_indices':[0],'descriptions':[event['description']],'reason':'Reviewed one event','observed_token_indices':list(range(len(qa.words(transcript))))}]}
        qcpath=self.run/'target-current-QC.json';adjpath=self.run/'target-current-adjudications.json'
        save(qcpath,{'records':[record]});save(adjpath,{pub.VARIANT_TARGET:approval})
        return qcpath,adjpath

    def test_target_actual_scream_qc_is_required_separately_from_source_proof(self):
        frozen,profiles,receipt,plan,proof=self.derived_fixture();target=frozen['lines'][1]
        pub.validate_variant_target_qc(self.run,target,receipt,self.variant_qc,self.variant_adjudications)
        for category,confidence,transcript in [('laughter',.85,'ha'),('scream',.79,''),('scream',.99,'Hallo'),('scream',.99,'ha')]:
            qc,adj=self.target_qc_fixture(target,receipt,category,confidence,transcript)
            with self.assertRaises(pub.Invalid):pub.validate_variant_target_qc(self.run,target,receipt,qc,adj)
        qc,adj=self.target_qc_fixture(target,receipt)
        save(adj,{})
        with self.assertRaises(pub.Invalid):pub.validate_variant_target_qc(self.run,target,receipt,qc,adj)
        with self.assertRaises(pub.Invalid):pub.validate_variant_target_qc(self.run,target,receipt,None,None)
        receipt['vocal_qc_required']=False
        with self.assertRaises(pub.Invalid):pub.validate_variant_target_qc(self.run,target,receipt,qc,adj)

    def test_target_qc_cannot_be_stale_or_duplicate_even_with_approval(self):
        frozen,profiles,receipt,plan,proof=self.derived_fixture();target=frozen['lines'][1]
        report=pub.read(self.variant_qc);report['records'][0]['clip_sha256']='0'*64;save(self.variant_qc,report)
        with self.assertRaises(pub.Invalid):pub.validate_variant_target_qc(self.run,target,receipt,self.variant_qc,self.variant_adjudications)
        qc,adj=self.target_qc_fixture(target,receipt);report=pub.read(qc);report['records'].append(copy.deepcopy(report['records'][0]));save(qc,report)
        with self.assertRaises(pub.Invalid):pub.validate_variant_target_qc(self.run,target,receipt,qc,adj)

    def test_only_bound_nonlexical_variant_accepted_with_verified_transform(self):
        frozen,profiles,receipt,plan,proof=self.derived_fixture()
        import story_voice_vocal_cues as vocal
        result=SimpleNamespace(returncode=0,stdout=b'identical PCM')
        with patch.object(vocal,'proof',return_value=proof),patch.object(pub.subprocess,'run',return_value=result) as command:
            pub.validate_vocal_variant(self.run,frozen,profiles,receipt,plan,self.variant_qc,self.variant_adjudications)
            self.assertIn('atempo=1.12',command.call_args_list[0].args[0]);self.assertEqual(command.call_args_list[1].args[0][-1],'pipe:1')
            for field,value in [('source_id','story-'+'f'*24),('model','other'),('transform',{'filter':'atempo=1.2','pitch_preserved':True}),('source_tts_request_sha256','0'*64)]:
                changed=copy.deepcopy(receipt);changed[field]=value
                with self.assertRaises(pub.Invalid):pub.validate_vocal_variant(self.run,frozen,profiles,changed,plan,self.variant_qc,self.variant_adjudications)
            fake_api=copy.deepcopy(receipt);fake_api['request_sha256']='0'*64
            with self.assertRaises(pub.Invalid):pub.validate_vocal_variant(self.run,frozen,profiles,fake_api,plan,self.variant_qc,self.variant_adjudications)
        with self.assertRaises(pub.Invalid):pub.validate_vocal_variant(self.run,frozen,profiles,receipt,None)

    def test_derived_waveform_or_bound_proof_changes_are_rejected(self):
        frozen,profiles,receipt,plan,proof=self.derived_fixture();import story_voice_vocal_cues as vocal
        with patch.object(vocal,'proof',return_value=proof),patch.object(pub.subprocess,'run',side_effect=[SimpleNamespace(returncode=0,stdout=b'correct'),SimpleNamespace(returncode=0,stdout=b'wrong')]):
            with self.assertRaisesRegex(pub.Invalid,'waveform'):pub.validate_vocal_variant(self.run,frozen,profiles,receipt,plan,self.variant_qc,self.variant_adjudications)
        (self.run/'raw'/(pub.VARIANT_SOURCE+'.wav')).write_bytes(b'changed source')
        with self.assertRaisesRegex(pub.Invalid,'artifact changed'):pub.validate_vocal_variant(self.run,frozen,profiles,receipt,plan,self.variant_qc,self.variant_adjudications)

    def test_other_derived_recordings_are_rejected_even_with_passing_qa(self):
        save(self.run/'raw'/(self.ident+'.receipt.json'),{'backend':'derived_single_nonlexical_event','id':self.ident})
        with self.assertRaisesRegex(pub.Invalid,'Unsupported derived'):self.build()

    def test_refuses_unrelated_destination_and_traversal(self):
        manifest,paths=self.build();self.args.public_dir.mkdir(parents=True);(self.args.public_dir/'KEEP.txt').write_text('keep')
        with self.assertRaises(pub.Invalid):pub.publish(self.args.public_dir,manifest,paths)
        self.assertEqual((self.args.public_dir/'KEEP.txt').read_text(),'keep')
        with self.assertRaises(pub.Invalid):pub.contained(self.run,'../outside')

class PffPublisherGates(unittest.TestCase):
    @unittest.skipUnless((Path(__file__).resolve().parents[1]/'output/audio/story-voice/2026-10-05-all-chapters/pff-edited-pass14/actual-transform.private.json').exists(),'Requires immutable private Pff pilot, no committed audio.')
    def test_real_derived_receipt_only_fixed_source_current_root_and_journal(self):
        import story_voice_pff_edit_test as fixtures
        import story_voice_pff_edit as pff
        fixture=fixtures.PffGates();fixture.setUp();self.addCleanup(fixture.doCleanups);run=fixture.run
        approval=run/'root.json';pff.qa.save(approval,fixture.approval())
        with patch.object(pff.retake,'rebuild',return_value=None):receipt=pff.apply(run,approval)
        line=next(r for r in pff.core.read_json(run/'lines.private.json')['lines'] if r['id']==pff.ID)
        self.assertTrue(pub.validate_pff_derived(run,line,receipt))
        for key,value in [('model','other'),('google_voice','Other'),('backend','batch'),('request_sha256','fake'),('transform',{'filter':'anull'})]:
            bad=copy.deepcopy(receipt);bad[key]=value
            with self.assertRaises(pub.Invalid):pub.validate_pff_derived(run,line,bad)
        with self.assertRaises(pub.Invalid):pub.validate_pff_derived(run,{**line,'id':pub.VARIANT_TARGET},receipt)
        journal=run/pff.FOLDER/'import.private.json';body=pff.core.read_json(journal);body['state']='IMPORT_INTENT_RECORDED';pff.qa.save(journal,body)
        with self.assertRaises(pub.Invalid):pub.validate_pff_derived(run,line,receipt)

if __name__=='__main__':unittest.main()
