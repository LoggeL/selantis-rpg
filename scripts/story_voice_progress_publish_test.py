"""Meaningful intermediate-bank boundaries, offline synthetic fixtures only."""
import ast
import copy
import inspect
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_progress_publish as progress
import story_voice_publish_test as fixtures
save=fixtures.save


def signal(seconds=1.):
    return {'seconds':seconds,'decoded_samples':int(seconds*24000),'peak':.5,'rms':.1,'clipped_fraction':0.,
            'leading_silence_seconds':.1,'trailing_silence_seconds':.1,'last_frame_rms':.001,'silent':False}


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.ids=['story-'+'a'*24,'story-'+'b'*24]
        self.lines=[{'id':ident,'text':'Hallo Welt'} for ident in self.ids]
        self.hashes={ident:str(i)*64 for i,ident in enumerate(self.ids)}
        self.qa={'status':'review_required','checked_ids':self.ids.copy(),'clip_sha256':self.hashes.copy(),
            'version':progress.QA_VERSION,'model':progress.QA_MODEL,'started_at':1,'finished_at':2,
            'takes':[{'id':ident,'text_sha256':progress.sha(b'Hallo Welt'),'signal':signal(),
                      'transcript':'Hallo Welt','word_error_rate':0.,'reasons':[]} for ident in self.ids],
            'failures':[{'id':self.ids[1],'reason':'asr_lexical_mismatch_requires_review'}]}
        self.qa['takes'][1]['reasons']=['asr_lexical_mismatch_requires_review']
        self.receipts=[{'id':ident,'text':'Hallo Welt','text_sha256':progress.sha(b'Hallo Welt'),
                       'audio_sha256':self.hashes[ident],'word_cues':[{'start':0.,'end':.4},{'start':.5,'end':1.}],
                       'decoded_seconds':1.,'cues_sha256':progress.acoustic.cue_sha([{'start':0.,'end':.4},{'start':.5,'end':1.}]),
                       'all_qualification_flags':[]} for ident in self.ids]
        self.receipts[1]['all_qualification_flags']=[{'word_index':1,'reason':'low_probability'}]
        self.alignment=progress.timing.report_for(self.receipts,{})
        self.alignment.update(expected_count=2,current_receipt_count=2)

    def test_complete_needs_review_reports_remain_unchanged_and_keep_every_failure(self):
        before=copy.deepcopy(self.qa);timing_before=copy.deepcopy(self.alignment)
        takes=progress._qa_consistency(self.qa,self.lines,self.hashes)
        progress._timing_consistency(self.alignment,self.lines,self.receipts,{},self.hashes)
        self.assertTrue(progress._word_clear(self.lines[0],takes[self.ids[0]],self.hashes[self.ids[0]]))
        self.assertFalse(progress._word_clear(self.lines[1],takes[self.ids[1]],self.hashes[self.ids[1]]))
        self.assertEqual(self.qa,before);self.assertEqual(self.alignment,timing_before)
        self.assertEqual(len(self.qa['failures']),1);self.assertEqual(len(self.alignment['failures']),1)

    def test_omitted_or_duplicate_source_coverage_and_stale_audio_cannot_be_projected_clean(self):
        mutations=[dict(self.qa,checked_ids=self.ids[:1]),dict(self.qa,checked_ids=self.ids*2),
                   dict(self.qa,takes=self.qa['takes'][:1]),dict(self.qa,takes=self.qa['takes']*2),
                   dict(self.qa,clip_sha256={self.ids[0]:'stale',self.ids[1]:self.hashes[self.ids[1]]})]
        for changed in mutations:
            with self.subTest(changed=changed),self.assertRaises(progress.strict.Invalid):
                progress._qa_consistency(changed,self.lines,self.hashes)

    def test_hidden_failure_removed_reason_changed_status_and_unfinished_producer_reject(self):
        mutations=[dict(self.qa,failures=[]),dict(self.qa,status='passed'),dict(self.qa,finished_at=None)]
        changed=copy.deepcopy(self.qa);changed['takes'][1]['reasons']=[];mutations.append(changed)
        changed=copy.deepcopy(self.qa);changed['failures'].append({'id':None,'reason':'audio_changed'});mutations.append(changed)
        for changed in mutations:
            with self.subTest(changed=changed),self.assertRaises(progress.strict.Invalid):
                progress._qa_consistency(changed,self.lines,self.hashes)

    def test_stale_authored_text_and_wrong_producer_reject(self):
        changed=copy.deepcopy(self.qa);changed['takes'][0]['text_sha256']='0'*64
        for body in (changed,dict(self.qa,version='fake'),dict(self.qa,model='unrelated')):
            with self.subTest(body=body),self.assertRaises(progress.strict.Invalid):
                progress._qa_consistency(body,self.lines,self.hashes)

    def test_report_cannot_hide_actual_timing_flags_or_add_unapproved_alignment(self):
        mutations=[dict(self.alignment,requires_qualification=[]),dict(self.alignment,failures=[]),
                   dict(self.alignment,status='passed'),dict(self.alignment,current_receipt_count=1)]
        changed=copy.deepcopy(self.alignment);changed['alignment_by_id'][self.ids[1]]=changed['alignment_by_id'][self.ids[0]]
        mutations.append(changed)
        for body in mutations:
            with self.subTest(body=body),self.assertRaises(progress.strict.Invalid):
                progress._timing_consistency(body,self.lines,self.receipts,{},self.hashes)

    def test_clean_reasons_alone_do_not_approve_dirty_signal_or_unproved_transcript(self):
        take=copy.deepcopy(self.qa['takes'][0]);take['signal']['silent']=True
        with self.assertRaisesRegex(progress.strict.Invalid,'signal'):
            progress._word_clear(self.lines[0],take,self.hashes[self.ids[0]])
        take=copy.deepcopy(self.qa['takes'][0]);take['transcript']='Andere Worte'
        with self.assertRaisesRegex(progress.strict.Invalid,'adjudication'):
            progress._word_clear(self.lines[0],take,self.hashes[self.ids[0]])
        take['adjudication']={'resolution':'actual','record':{'clip_sha256':'wrong','text_sha256':progress.sha(b'Hallo Welt')}}
        with self.assertRaisesRegex(progress.strict.Invalid,'binding'):
            progress._word_clear(self.lines[0],take,self.hashes[self.ids[0]])

    def test_actual_variant_record_does_not_change_transcript_or_create_timestamp(self):
        take=copy.deepcopy(self.qa['takes'][0]);take['transcript']='Hallo Welten'
        take['adjudication']={'resolution':'explicit_hash_bound_word_variants','record':{
            'clip_sha256':self.hashes[self.ids[0]],'text_sha256':progress.sha(b'Hallo Welt')}}
        before=copy.deepcopy(take)
        self.assertTrue(progress._word_clear(self.lines[0],take,self.hashes[self.ids[0]]))
        self.assertEqual(take,before)

    def test_complete_pre_qa_original_validator_prefix_preserved(self):
        protected=ast.parse(inspect.getsource(progress.strict.validate_run)).body[0]
        adapted=ast.parse(inspect.getsource(progress._whole_inputs)).body[0]
        statements=[]
        for node in protected.body:
            if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='qa' for target in node.targets):break
            statements.append(node)
        self.assertEqual(ast.dump(ast.Module(body=statements,type_ignores=[]),include_attributes=False),
                         ast.dump(ast.Module(body=adapted.body[:-1],type_ignores=[]),include_attributes=False))
        self.assertIsInstance(adapted.body[-1],ast.Return)

    def test_changed_real_report_is_not_an_allowed_new_qa_anchor(self):
        fixture=fixtures.PublisherTests();fixture.setUp();self.addCleanup(fixture.tearDown)
        with patch.object(progress.rewrite,'supports_run',return_value=True):
            with self.assertRaisesRegex(progress.strict.Invalid,'genuine complete QA'):
                progress._bound_complete_reports('rewrite',fixture.run,fixture.run/'qa.json',fixture.run/'align.json',fixture.root)

    def test_changed_real_timing_report_is_not_an_allowed_producer_anchor(self):
        fixture=fixtures.PublisherTests();fixture.setUp();self.addCleanup(fixture.tearDown)
        with patch.object(progress.rewrite,'supports_run',return_value=True),patch.dict(progress.PINNED_QA,
                {'rewrite':{'qa.json':progress.digest(fixture.run/'qa.json')}}):
            with self.assertRaisesRegex(progress.strict.Invalid,'genuine complete timing'):
                progress._bound_complete_reports('rewrite',fixture.run,fixture.run/'qa.json',fixture.run/'align.json',fixture.root)

    def test_fixed_voice_direction_and_route_body_changes_remain_forbidden(self):
        row={'id':self.ids[0],'kind':'say','speaker':'lia','text':'Hallo Welt','display_text':'Hallo Welt',
             'direction_en':'quiet','performance_variant':'same','mood':'neutral',
             'runtime_keys':[{'kind':'say','speaker':'lia','text':'Hallo Welt','scene':'scene','mood':'neutral'}]}
        profiles={'speakers':{'lia':{'google_voice':'Zephyr'}}}
        for key,value in (('direction_en','other'),('text','other'),('speaker','azar')):
            changed=copy.deepcopy(row);changed[key]=value
            with self.subTest(key=key),self.assertRaises(progress.strict.Invalid):
                progress.original._identity_without_mood(row,changed,profiles,profiles)
        with self.assertRaises(progress.strict.Invalid):
            progress.original._identity_without_mood(row,row,profiles,{'speakers':{'lia':{'google_voice':'Puck'}}})


class SelectionAndAtomicTests(unittest.TestCase):
    def setUp(self):
        self.fixture=fixtures.PublisherTests();self.fixture.setUp();self.addCleanup(self.fixture.tearDown)
        self.root=self.fixture.root.resolve();self.ident=self.fixture.ident;self.missing='story-'+'d'*24
        self.current=progress.read(self.fixture.inventory);row=copy.deepcopy(self.current['lines'][0])
        row.update(id=self.missing,text='Fehlende Worte',display_text='Fehlende Worte');row['runtime_keys'][0]['text']=row['text']
        self.current['lines'].append(row)
        self.current['runtime_lookup'].extend({**route,'asset_id':self.missing} for route in row['runtime_keys'])
        save(self.fixture.inventory,self.current)
        self.profiles=self.root/'docs/voice-production/story-speakers.json';save(self.profiles,progress.read(self.fixture.run/'profiles.private.json'))
        private=self.root/'output/audio/story-voice';private.mkdir(parents=True)
        self.closure=private/'source-closure.json';save(self.closure,{'synthetic_source_only':True})
        self.selection=private/'selection.json'
        self.args=SimpleNamespace(current_inventory=self.fixture.inventory.resolve(),profiles=self.profiles,
            source_closure=self.closure,root_selection=self.selection,public_dir=self.root/'game/public/audio/story')
        line=self.current['lines'][0];audio=self.fixture.run/'clips'/(self.ident+'.mp3')
        cues=[{'start':0.,'end':.5},{'start':.5,'end':1.}]
        self.clip={**{key:copy.deepcopy(line[key]) for key in ('id','kind','speaker','text','display_text','runtime_keys')},
            'audio':'audio/story/'+self.ident+'.mp3','sha256':progress.digest(audio),'seconds':1.,'voice':'Zephyr','word_cues':cues,
            'timing_policy':{'method':progress.VERSION}}
        self.paths={self.ident:audio}
        self.held={self.missing:{'word_signal_reasons':['asr_lexical_mismatch_requires_review'],'timing_requires_qualification':True}}
        self.whole=[{'bank':bank,'frozen_count':count,'qa_sha256':bank+'-QA','alignment_sha256':bank+'-alignment',
            'qa_status':'review_required','alignment_status':'needs_review',
            'qa_failures':[{'id':self.missing,'reason':'asr_lexical_mismatch_requires_review'}],
            'alignment_failures':[{'id':self.missing,'reason':'Explicit current private qualification required'}]}
            for bank,count in (('original',1557),('rewrite',490))]
        prolog=self.root/'game/public/audio/prolog';prolog.mkdir(parents=True)
        for i in range(188):(prolog/(str(i)+'.mp3')).write_bytes(b'synthetic kept prolog')
        (prolog/'manifest.json').write_text('{}')
        self.initial_prolog={str(file):progress.digest(file) for file in prolog.iterdir()}
        self.result=(self.root,self.current,progress.read(self.profiles),{'inventory_sha256':progress.digest(self.fixture.inventory)},
            {'synthetic_source_only':True},[self.clip],self.paths,self.held,
            {str(self.fixture.inventory.resolve()):progress.digest(self.fixture.inventory)},self.whole)
        proposal=progress.selection_proposal(self.args,self.result);proposal.update(status=progress.APPROVED,
            reviewed_by='root synthetic guard fixture',reason='Only the synthetic individually qualified current Source is selected.')
        save(self.selection,proposal)
        patched=patch.object(progress,'candidates',return_value=self.result);patched.start();self.addCleanup(patched.stop)

    def test_partial_build_discloses_missing_and_whole_review_status_without_clearing_any_report(self):
        before=copy.deepcopy(self.whole);manifest,paths,coverage=progress.build(self.args)
        self.assertEqual(set(paths),{self.ident});self.assertEqual(coverage['missing_ids'],[self.missing])
        self.assertFalse(coverage['full_original_bank_approved']);self.assertEqual(coverage['status'],'qualified_partial_story_bank')
        self.assertEqual(coverage['unchanged_complete_input_reports'],before);self.assertEqual(self.whole,before)
        self.assertFalse(manifest['current_source_coverage']['full_original_bank_approved'])
        self.assertEqual(manifest['current_source_coverage']['missing_ids'],[self.missing])
        self.assertNotIn('transcript',json.dumps(manifest));self.assertFalse(self.args.public_dir.exists())

    def test_dirty_unknown_or_duplicate_root_selected_id_rejects(self):
        initial=progress.read(self.selection)
        for ids in ([self.missing],[self.ident,self.ident],['story-'+'e'*24]):
            save(self.selection,dict(initial,selected_ids=ids))
            with self.subTest(ids=ids),self.assertRaises(progress.strict.Invalid):progress.build(self.args)

    def test_unapproved_root_or_changed_full_report_binding_rejects(self):
        initial=progress.read(self.selection)
        for changed in (dict(initial,status='root_review_required'),dict(initial,reviewed_by='worker'),
                        dict(initial,input_reports_sha256={}),dict(initial,source_closure_sha256='stale')):
            save(self.selection,changed)
            with self.subTest(changed=changed),self.assertRaises(progress.strict.Invalid):progress.build(self.args)

    def test_atomic_copy_preserves_188_prolog_and_pre_swap_failure_keeps_old_bank(self):
        manifest,paths,coverage=progress.build(self.args)
        progress.compositor.publish(self.args.public_dir,manifest,paths)
        progress.compositor.recheck_prolog(self.root,coverage)
        self.assertEqual(self.initial_prolog,{str(file):progress.digest(file) for file in (self.root/'game/public/audio/prolog').iterdir()})
        before={file.name:file.read_bytes() for file in self.args.public_dir.iterdir()}
        with self.assertRaisesRegex(RuntimeError,'changed'):
            progress.compositor.publish(self.args.public_dir,manifest,paths,before_swap=lambda:(_ for _ in ()).throw(RuntimeError('changed')))
        self.assertEqual(before,{file.name:file.read_bytes() for file in self.args.public_dir.iterdir()})

    def test_later_source_audio_or_prolog_change_is_detected_before_swap(self):
        manifest,paths,coverage=progress.build(self.args)
        self.fixture.inventory.write_text('{}')
        with self.assertRaises(progress.strict.Invalid):progress.compositor.recheck(self.root,paths,manifest,coverage)
        prolog=next((self.root/'game/public/audio/prolog').glob('*.mp3'));prolog.write_bytes(b'changed')
        with self.assertRaisesRegex(progress.strict.Invalid,'Prolog'):progress.compositor.recheck_prolog(self.root,coverage)

    def test_unknown_existing_bank_content_cannot_be_removed(self):
        manifest,paths,coverage=progress.build(self.args)
        progress.compositor.publish(self.args.public_dir,manifest,paths)
        (self.args.public_dir/'private-extra.json').write_text('{}')
        with self.assertRaisesRegex(progress.strict.Invalid,'Unknown existing'):
            progress._existing_snapshot(self.args.public_dir,progress.digest(self.args.public_dir/'manifest.json'))

    def existing_for_transaction(self):
        manifest,paths,coverage=progress.build(self.args)
        progress.compositor.publish(self.args.public_dir,manifest,paths)
        proposal=progress.read(self.selection);proposal['existing_manifest_sha256']=progress.digest(self.args.public_dir/'manifest.json')
        save(self.selection,proposal)
        return progress.build(self.args)

    def test_apply_coverage_collision_after_install_rolls_back_and_preserves_foreign_output(self):
        manifest,paths,coverage=self.existing_for_transaction()
        before={file.name:file.read_bytes() for file in self.args.public_dir.iterdir()}
        output=self.root/'output/audio/story-voice/apply-coverage.json'
        actual=progress.os.link
        def collide(source,target):
            Path(target).write_bytes(b'foreign concurrently-created coverage');return actual(source,target)
        with patch.object(progress.os,'link',side_effect=collide),self.assertRaises(FileExistsError):
            progress.apply_transaction(self.root,self.args.public_dir,manifest,paths,coverage,output)
        self.assertEqual(before,{file.name:file.read_bytes() for file in self.args.public_dir.iterdir()})
        self.assertEqual(output.read_bytes(),b'foreign concurrently-created coverage')

    def test_post_swap_prolog_failure_rolls_back_and_does_not_commit_coverage(self):
        manifest,paths,coverage=self.existing_for_transaction()
        before={file.name:file.read_bytes() for file in self.args.public_dir.iterdir()}
        output=self.root/'output/audio/story-voice/apply-coverage.json'
        real=progress.compositor.recheck_prolog;calls=[]
        def reject_post(root,cov):
            calls.append(True)
            if len(calls)>1:raise progress.strict.Invalid('Prolog changed after swap')
            return real(root,cov)
        with patch.object(progress.compositor,'recheck_prolog',side_effect=reject_post),self.assertRaisesRegex(progress.strict.Invalid,'after swap'):
            progress.apply_transaction(self.root,self.args.public_dir,manifest,paths,coverage,output)
        self.assertEqual(before,{file.name:file.read_bytes() for file in self.args.public_dir.iterdir()})
        self.assertFalse(output.exists())

    def test_concurrent_target_replacement_is_preserved_and_old_backup_retained(self):
        manifest,paths,coverage=self.existing_for_transaction()
        before={file.name:file.read_bytes() for file in self.args.public_dir.iterdir()}
        output=self.root/'output/audio/story-voice/apply-coverage.json';calls=[]
        real=progress.compositor.recheck_prolog
        moved=self.args.public_dir.parent/'concurrently-moved-own-bank'
        def replace_post(root,cov):
            calls.append(True)
            if len(calls)>1:
                self.args.public_dir.rename(moved);self.args.public_dir.mkdir()
                (self.args.public_dir/'foreign.txt').write_bytes(b'concurrent foreign directory')
            return real(root,cov)
        with patch.object(progress.compositor,'recheck_prolog',side_effect=replace_post),self.assertRaisesRegex(progress.strict.Invalid,'readback'):
            progress.apply_transaction(self.root,self.args.public_dir,manifest,paths,coverage,output)
        self.assertEqual((self.args.public_dir/'foreign.txt').read_bytes(),b'concurrent foreign directory')
        backups=list(self.args.public_dir.parent.glob('.story-progress-*/previous-story'))
        self.assertEqual(len(backups),1);self.assertEqual(before,{file.name:file.read_bytes() for file in backups[0].iterdir()})
        self.assertTrue(moved.is_dir());self.assertFalse(output.exists())

    def test_identical_byte_coverage_replacement_has_foreign_inode_and_is_preserved(self):
        manifest,paths,coverage=self.existing_for_transaction()
        before={file.name:file.read_bytes() for file in self.args.public_dir.iterdir()}
        output=self.root/'output/audio/story-voice/apply-coverage.json';real=progress.os.link;identities=[]
        def replace_identical(source,target):
            real(source,target);data=Path(target).read_bytes();own=progress._identity(source)
            Path(target).unlink();Path(target).write_bytes(data)
            identities.extend([own,progress._identity(target)])
        with patch.object(progress.os,'link',side_effect=replace_identical),self.assertRaisesRegex(progress.strict.Invalid,'coverage identity'):
            progress.apply_transaction(self.root,self.args.public_dir,manifest,paths,coverage,output)
        self.assertNotEqual(*identities);self.assertEqual(progress.read(output),coverage)
        self.assertEqual(before,{file.name:file.read_bytes() for file in self.args.public_dir.iterdir()})

    def test_report_temp_collision_is_foreign_and_never_deleted(self):
        manifest,paths,coverage=self.existing_for_transaction()
        before={file.name:file.read_bytes() for file in self.args.public_dir.iterdir()}
        output=self.root/'output/audio/story-voice/apply-coverage.json';real=progress.tempfile.mkdtemp;collisions=[]
        def collide_temp(*args,**kwargs):
            folder=real(*args,**kwargs);foreign=output.parent/(Path(folder).name+'.coverage.private.json')
            foreign.write_bytes(b'foreign temporary report');collisions.append(foreign);return folder
        with patch.object(progress.tempfile,'mkdtemp',side_effect=collide_temp),self.assertRaises(FileExistsError):
            progress.apply_transaction(self.root,self.args.public_dir,manifest,paths,coverage,output)
        self.assertEqual(collisions[0].read_bytes(),b'foreign temporary report')
        self.assertEqual(before,{file.name:file.read_bytes() for file in self.args.public_dir.iterdir()})
        self.assertFalse(output.exists())

    def test_successful_apply_commits_exact_coverage_and_preserves_prolog(self):
        manifest,paths,coverage=progress.build(self.args);output=self.root/'output/audio/story-voice/apply-coverage.json'
        progress.apply_transaction(self.root,self.args.public_dir,manifest,paths,coverage,output)
        self.assertEqual(progress.read(output),coverage)
        self.assertEqual(progress.read(self.args.public_dir/'manifest.json'),manifest)
        self.assertEqual(self.initial_prolog,{str(file):progress.digest(file) for file in (self.root/'game/public/audio/prolog').iterdir()})


if __name__=='__main__':unittest.main()
