"""Actual one-result read-only proof and strict negative scoped guard tests.

No model inference or genuine adoption. Transaction tests use a temporary bank
and a clearly stubbed proposal, while the genuine positive reads actual files.
"""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import story_voice_rewrite_e8_large as large
import story_voice_rewrite_timing_publish as timing


ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT/'output/audio/story-voice'/large.RUN_NAME
PROOF = RUN/large.NAMESPACE
QA = RUN/'qa-after-body4-vocal1.private.json'


class GenuineE8Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (PROOF/'actual-result.private.json').is_file():
            raise unittest.SkipTest('Actual local private one-result proof is not in this checkout')
        cls.plan = large.read(PROOF/'frozen-e8-one-take-unapproved-plan.private.json')
        cls.result = large.read(PROOF/'actual-result.private.json')
        cls.intent = large.read(PROOF/'execution-intent.private.json')
        cls.line = cls.plan['source_row']
        cls.raw = cls.result['actual_parent_align_receipt_unmodified']
        cls.refined = cls.result['actual_parent_refine_boundaries_receipt']
        cls.audio = large.acoustic.decode(RUN/'clips'/(large.IDENT+'.mp3'))
        cls.original = cls.plan['actual_old_receipt']
        cls.qa = large.read(QA)

    def objects(self, plan=None, result=None, intent=None, line=None):
        return large.validate_result_objects(plan or self.plan,result or self.result,
                                             intent or self.intent,line or self.line)

    def test_genuine_complete_actual_proof_and_waveform_without_approval(self):
        proposal = large.review(RUN,QA)
        self.assertEqual(proposal['status'],'supported')
        self.assertIsNone(proposal['approval'])
        self.assertEqual(proposal['actual_model'],'whisper-large-v3')
        self.assertEqual(proposal['loaded_model_dimensions']['n_audio_layer'],32)
        self.assertEqual(proposal['loaded_model_dimensions']['n_text_layer'],32)
        self.assertEqual(proposal['proposed_cues'][5],{'start':2.08,'end':2.2})
        self.assertEqual(proposal['proposed_cues'][6],{'start':2.2,'end':2.2})
        self.assertEqual(proposal['original_receipt']['word_cues'][5],{'start':2.28,'end':2.28})
        self.assertTrue(all(x is None or x >= .1 for x in proposal['waveform_active_fractions']))

    def test_wrong_source_id_or_model_and_partial_bank_scope_rejected(self):
        cases = [('selected_ids',['story-000000000000000000000001']),('selected_count',2),
                 ('full_manifest_count',489),('source_manifest_sha256','0'*64),
                 ('source_row_sha256','0'*64)]
        for field,value in cases:
            with self.subTest(field=field):
                obj=copy.deepcopy(self.plan);obj[field]=value
                with self.assertRaises(ValueError):self.objects(plan=obj)
        for value in ['whisper-large-v3-turbo','generic','']:
            obj=copy.deepcopy(self.result);obj['actual_model_name']=value
            with self.assertRaises(ValueError):self.objects(result=obj)

    def test_loaded_layers_model_config_weight_alias_and_runtime_record_required(self):
        for field,value in [('n_audio_layer',4),('n_text_layer',31),('n_mels',80)]:
            obj=copy.deepcopy(self.result);obj['actual_loaded_model_dimensions'][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):self.objects(result=obj)
        obj=copy.deepcopy(self.result);obj['actual_runtime_file_sha256'].pop(next(iter(obj['actual_runtime_file_sha256'])))
        with self.assertRaises(ValueError):self.objects(result=obj)
        obj=copy.deepcopy(self.result);obj['actual_model']['weights_alias']['actual_resolved_path']='/tmp/fake'
        with self.assertRaises(ValueError):self.objects(result=obj)
        obj=copy.deepcopy(self.plan);obj['required_actual_model']['config']['n_text_layer']=4
        with self.assertRaises(ValueError):self.objects(plan=obj)

    def test_forged_engine_result_source_audio_and_verdict_rejected(self):
        for field,value in [('method','CTC'),('runner_sha256','0'*64),('plan_sha256','0'*64),
                            ('audio_sha256','0'*64),('source_row_sha256','0'*64),
                            ('legacy_parent_MODEL_constant_disclosed','whisper-large-v3'),
                            ('original_cues_or_audio_modified',True),('listening_verdict','passed'),
                            ('acting_verdict','passed')]:
            obj=copy.deepcopy(self.result);obj[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):self.objects(result=obj)

    def test_current_qa_stale_audio_wrong_full_words_duplicate_scope_or_signal_fails(self):
        for change in ['audio','word','duplicate','unfinished','signal','failed']:
            report=copy.deepcopy(self.qa)
            take=next(x for x in report['takes'] if x['id']==large.IDENT)
            if change=='audio':report['clip_sha256'][large.IDENT]='0'*64
            if change=='word':take['transcript']='Elfen nehmen sie. Nur keine. Lass gut sein.'
            if change=='duplicate':report['takes'][0]=copy.deepcopy(take)
            if change=='unfinished':report.pop('finished_at')
            if change=='signal':take['signal']['silent']=True
            if change=='failed':report['failures'].append({'id':large.IDENT,'reason':'held'})
            with self.subTest(change=change),self.assertRaises(ValueError):
                large.clean_target_qa(report,self.line,self.original,large.AUDIO_SHA)

    def test_new_current_report_may_change_disjoint_clips_but_not_target_source(self):
        report=copy.deepcopy(self.qa)
        other=next(ident for ident in report['checked_ids'] if ident!=large.IDENT)
        report['clip_sha256'][other]='different future separately checked clip'
        # Genuine unrelated open cases remain open; no bank-passing projection.
        self.assertEqual(large.clean_target_qa(report,self.line,self.original,large.AUDIO_SHA)['id'],large.IDENT)
        report['clip_sha256'][large.IDENT]='different target'
        with self.assertRaises(ValueError):large.clean_target_qa(report,self.line,self.original,large.AUDIO_SHA)

    def test_actual_full_body_and_raw_refined_exact_waveform_reproduction(self):
        fractions=large.validate_alignment(self.raw,self.refined,self.line,self.audio)
        self.assertEqual(fractions[5],1.)
        self.assertIsNone(fractions[6])
        cases=['word','missing','zero_spoken','positive_punctuation','punct_shift','overlap',
               'out_of_bounds','weak','flags','refine_projection']
        for change in cases:
            raw=copy.deepcopy(self.raw);refined=copy.deepcopy(self.refined)
            if change=='word':raw['words'][0]['word']='Menschen'
            if change=='missing':raw['words'].pop()
            if change=='zero_spoken':
                raw['word_cues'][5]['end']=raw['word_cues'][5]['start'];raw['words'][5]['end']=raw['word_cues'][5]['end']
            if change=='positive_punctuation':
                raw['word_cues'][6]['end']=2.3;raw['words'][6]['end']=2.3
            if change=='punct_shift':
                raw['word_cues'][6]={'start':2.21,'end':2.21};raw['words'][6].update(raw['word_cues'][6])
            if change=='overlap':raw['word_cues'][5]['start']=2.0
            if change=='out_of_bounds':raw['word_cues'][-1]['end']=99
            if change=='weak':raw['words'][5]['minimum_token_probability']=.001
            if change=='flags':raw['qualification_flags']=[{'word_index':5,'reasons':['low_authored_token_probability']}]
            if change=='refine_projection':
                refined['word_cues'][5]['end']=2.19;refined['words'][5]['end']=2.19
            with self.subTest(change=change),self.assertRaises((ValueError,RuntimeError)):
                large.validate_alignment(raw,refined,self.line,self.audio)

    def test_unsupported_waveform_silence_does_not_qualify(self):
        import numpy as np
        with self.assertRaises(ValueError):
            large.validate_alignment(self.raw,self.refined,self.line,np.zeros_like(self.audio))

    def test_tampered_actual_result_or_runtime_hash_is_not_a_bare_metadata_approval(self):
        real=large.digest
        result_path=PROOF/'actual-result.private.json'
        with patch.object(large,'digest',side_effect=lambda p:'0'*64 if Path(p)==result_path else real(p)):
            with self.assertRaisesRegex(ValueError,'genuine once-only'):
                large.execution_proof(RUN)
        runtime=Path(next(iter(self.plan['fresh_current_runtime_file_sha256'])))
        with patch.object(large,'digest',side_effect=lambda p:'0'*64 if Path(p)==runtime else real(p)):
            with self.assertRaisesRegex(ValueError,'driver/runtime'):
                large.execution_proof(RUN)

    def test_forged_bare_retention_marker_unknown_model_or_extra_scope_fails(self):
        receipt=copy.deepcopy(self.original);receipt['engine_version']=large.ENGINE
        receipt['FullLarge_adoption']={'method':large.VERSION,'actual_model':large.MODEL}
        with self.assertRaises(ValueError):large.evidence(RUN,receipt,{})
        receipt['id']='story-000000000000000000000001'
        with self.assertRaises(ValueError):large.evidence(RUN,receipt,{})
        self.assertEqual(large.digest(PROOF/'actual-result.private.json'),large.RESULT_SHA)
        self.assertEqual(large.digest(PROOF/'root-one-case-runner.private.py'),large.RUNNER_SHA)

    def test_actual_result_with_virtual_adoption_envelope_supports_retention_and_disjoint_changes(self):
        """Real physical proof/audio; only future adoption bookkeeping is virtual."""
        proposal=large.review(RUN,QA)
        real_read,real_digest,real_contained=large.read,large.digest,large.contained
        virtual={}
        def install(path,value):
            path=Path(path).resolve()
            data=(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n').encode()
            virtual[path]=(value,large.sha(data))
        archive=RUN/'word-cues/adoption-archive/unit-test-virtual-no-files'/ (large.IDENT+'.json')
        install(archive,self.original)
        # Preserve the actual original bytes/hash, not a re-encoded approximation.
        virtual[archive.resolve()]=(copy.deepcopy(self.original),large.ORIGINAL_RECEIPT_SHA)
        preserved={}
        for index,(name,expected) in enumerate(self.plan['immutable_file_sha256'].items()):
            path=archive.parent/'historical-inputs'/(str(index)+'-'+Path(name).name)
            try:value=real_read(Path(name))
            except (json.JSONDecodeError,UnicodeDecodeError):value=None
            virtual[path.resolve()]=(value,expected)
            preserved[name]={'relative_path':str(path.relative_to(RUN)),'sha256':expected}
        note='Explicit virtual test envelope for the genuine actual result; no actual approval.'
        journal={'method':large.VERSION,'selected_ids':[large.IDENT],'review_note':note,
                 'input_hashes':proposal['input_hashes'],'original_receipt_sha256':large.ORIGINAL_RECEIPT_SHA,
                 'original_approval_sha256':real_digest(RUN/'word-cues/qualifications.private.json'),
                 'audio_modified':False,'listening_verdict':None,'acting_verdict':None}
        journal_path=archive.parent/'root-one-id-journal.private.json';install(journal_path,journal)
        adoption={'method':large.VERSION,'actual_model':large.MODEL,'actual_result_sha256':large.RESULT_SHA,
                  'plan_sha256':large.PLAN_SHA,'runner_sha256':large.RUNNER_SHA,
                  'original_receipt_sha256':large.ORIGINAL_RECEIPT_SHA,
                  'original_receipt_relative_path':str(archive.relative_to(RUN)),
                  'qa_report_relative_path':str(QA.relative_to(RUN)),'qa_report_sha256':real_digest(QA),
                  'preserved_execution_inputs':preserved,'legacy_parent_MODEL_constant_disclosed':large.acoustic.MODEL,
                  'actual_loaded_model_dimensions':self.result['actual_loaded_model_dimensions'],
                  'root_journal_sha256':virtual[journal_path.resolve()][1]}
        receipt=copy.deepcopy(self.original)
        receipt.update(engine_version=large.ENGINE,word_cues=proposal['proposed_cues'],cues_sha256=proposal['proposed_cues_sha256'],
                       original_DTW_word_cues=self.original['word_cues'],FullLarge_adoption=adoption)
        live=RUN/'word-cues'/(large.IDENT+'.json');install(live,receipt)
        approval={key:receipt[key] for key in ['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256','engine_version']}
        approval.update(decision='reviewed',review_note=note,FullLarge_adoption=adoption)
        approvals_path=RUN/'word-cues/qualifications.private.json';approvals=copy.deepcopy(real_read(approvals_path))
        approvals['approvals'][large.IDENT]=approval;install(approvals_path,approvals)
        # A future disjoint import changes the parent's collection file. Its
        # genuine historical execution copy remains fixed and e8 remains current.
        install(RUN/'collection.private.json',{'backend':'virtual-disjoint-retake','collected':490,'expected':490,'failures':[]})
        def vread(path):
            entry=virtual.get(Path(path).resolve())
            return copy.deepcopy(entry[0]) if entry is not None else real_read(Path(path))
        def vdigest(path):
            entry=virtual.get(Path(path).resolve())
            return entry[1] if entry is not None else real_digest(Path(path))
        def vcontained(root,name):
            candidate=(Path(root)/name).resolve()
            if candidate in virtual:
                self.assertTrue(candidate.is_relative_to(Path(root).resolve()))
                return candidate
            return real_contained(root,name)
        expected={key:receipt[key] for key in ['audio_sha256','text_sha256','source_manifest_sha256']}
        with patch.object(large,'read',side_effect=vread),patch.object(large,'digest',side_effect=vdigest),\
             patch.object(large,'contained',side_effect=vcontained),\
             patch.object(timing,'read',side_effect=vread),patch.object(timing,'digest',side_effect=vdigest),\
             patch.object(timing,'contained',side_effect=vcontained):
            files=large.evidence(RUN,receipt,expected)
            self.assertIn(archive,files)
            entry={'words':[{'word':token,**cue} for token,cue in zip(large.acoustic.normalized_text(self.line['text']).split(),receipt['word_cues'])],
                   'cues_sha256':receipt['cues_sha256']}
            timing._bound_receipt(RUN,self.line,entry,4.36)
            clip={'sha256':large.AUDIO_SHA,'word_cues':receipt['word_cues']}
            policy=timing._policy(RUN,self.line,clip)
            self.assertEqual(set(policy),timing.POLICY_FIELDS)
            self.assertEqual(policy['actual_alignment_model'],'whisper-large-v3')
            self.assertEqual(policy['alignment_engine'],large.ENGINE)
            bad=copy.deepcopy(receipt);bad['words'][0]['word']='Menschen'
            install(live,bad)
            with self.assertRaises(ValueError):large.evidence(RUN,bad,expected)


class ApplyScopeTests(unittest.TestCase):
    def test_empty_broad_or_unreviewed_selection_rejected_before_writes(self):
        for ids,note in [(set(),'Reviewed this actual full evidence.'),({large.IDENT,'other'},'Reviewed this actual full evidence.'),
                         ({large.IDENT},'yes'),({'other'},'Reviewed this actual full evidence.')]:
            with self.subTest(ids=ids),self.assertRaises(ValueError):
                large.apply_scoped(Path('/nonexistent'),Path('/nonexistent'),ids,note)

    def test_new_public_policy_fields_are_exact_and_honest(self):
        self.assertEqual(timing.VERSION,'one-frozen-rewrite-490-receipt-bound-punctuation-v2')
        self.assertIn('alignment_engine',timing.POLICY_FIELDS)
        self.assertIn('actual_alignment_model',timing.POLICY_FIELDS)
        self.assertNotEqual(large.ENGINE,large.cues.ENGINE)
        self.assertEqual(large.MODEL,'whisper-large-v3')

    def test_temporary_transaction_preserves_original_details_and_other_approvals(self):
        """Stubbed transaction mechanics only, never a genuine timing approval."""
        if not (PROOF/'actual-result.private.json').exists():self.skipTest('Private transaction source absent')
        original=large.read(PROOF/'frozen-e8-one-take-unapproved-plan.private.json')['actual_old_receipt']
        result=large.read(PROOF/'actual-result.private.json')
        with tempfile.TemporaryDirectory() as temporary:
            run=Path(temporary)/large.RUN_NAME;run.mkdir();(run/'word-cues').mkdir()
            live=run/'word-cues'/(large.IDENT+'.json')
            # Copy exact original bytes so the once-only original hash guard is real.
            import shutil
            shutil.copy2(RUN/'word-cues'/(large.IDENT+'.json'),live)
            if large.digest(live)!=large.ORIGINAL_RECEIPT_SHA:self.skipTest('Genuine bank has already been Root adopted')
            qa_path=run/'qa.json';large.qa.save(qa_path,{'stubbed':True})
            line_path=run/'lines.private.json';shutil.copy2(RUN/'lines.private.json',line_path)
            approvals=run/'word-cues/qualifications.private.json'
            other={'decision':'reviewed','review_note':'Other genuine approval remains unchanged','some_field':[1,2]}
            prior={'method':'preserved-other-method','approvals':{'other':other}}
            large.qa.save(approvals,prior)
            proposal={'status':'supported','proposed_cues':result['actual_parent_refine_boundaries_receipt']['word_cues'],
                      'proposed_cues_sha256':large.acoustic.cue_sha(result['actual_parent_refine_boundaries_receipt']['word_cues']),
                      'current_qa_sha256':large.digest(qa_path),'loaded_model_dimensions':result['actual_loaded_model_dimensions'],
                      'input_hashes':{str(live):large.digest(live)},
                      'historical_execution_plan':{'immutable_file_sha256':{str(live):large.digest(live)}}}
            actual_report={'status':'needs_review','alignment_by_id':{},'requires_qualification':['still-open']}
            with patch.object(large,'review',return_value=proposal),patch.object(large,'evidence',return_value=[]),patch.object(large.ctc_review,'complete_report',return_value=actual_report) as rebuild:
                returned=large.apply_scoped(run,qa_path,{large.IDENT},'Explicit reviewed unit-test transaction only.')
            adopted=large.read(live);new=large.read(approvals)
            self.assertEqual(returned['status'],'needs_review')
            self.assertEqual(new['approvals']['other'],other)
            self.assertEqual(new['method'],prior['method'])
            self.assertEqual(adopted['words'],original['words'])
            self.assertEqual(adopted['raw_word_cues'],original['raw_word_cues'])
            self.assertEqual(adopted['all_qualification_flags'],original['all_qualification_flags'])
            self.assertEqual(adopted['engine_version'],large.ENGINE)
            self.assertEqual(adopted['word_cues'],proposal['proposed_cues'])
            self.assertEqual(set(adopted['FullLarge_adoption']),large.ADOPTION_FIELDS)
            archive=run/adopted['FullLarge_adoption']['original_receipt_relative_path']
            self.assertEqual(large.digest(archive),large.ORIGINAL_RECEIPT_SHA)
            journal=large.read(archive.parent/'root-one-id-journal.private.json')
            self.assertEqual(journal['selected_ids'],[large.IDENT])
            self.assertFalse(journal['audio_modified'])
            self.assertEqual(rebuild.call_args.kwargs['expected_count'],490)
            with self.assertRaises(ValueError):
                large.apply_scoped(run,qa_path,{large.IDENT},'Repeated unit test adoption must be refused.')

    def test_failed_private_readback_rolls_back_exact_original_bytes(self):
        if not (PROOF/'actual-result.private.json').exists():self.skipTest('Private transaction source absent')
        import shutil
        with tempfile.TemporaryDirectory() as temporary:
            run=Path(temporary)/large.RUN_NAME;run.mkdir();(run/'word-cues').mkdir()
            live=run/'word-cues'/(large.IDENT+'.json');shutil.copy2(RUN/'word-cues'/(large.IDENT+'.json'),live)
            if large.digest(live)!=large.ORIGINAL_RECEIPT_SHA:self.skipTest('Already genuinely Root adopted')
            qa_path=run/'qa.json';large.qa.save(qa_path,{'stubbed':True})
            approvals=run/'word-cues/qualifications.private.json';large.qa.save(approvals,{'approvals':{'other':{'kept':True}}})
            alignment=run/'word-cues/alignment.private.json';large.qa.save(alignment,{'status':'needs_review','kept':True})
            originals={path:path.read_bytes() for path in [live,approvals,alignment]}
            result=large.read(PROOF/'actual-result.private.json')
            proposed=result['actual_parent_refine_boundaries_receipt']['word_cues']
            proposal={'status':'supported','proposed_cues':proposed,'proposed_cues_sha256':large.acoustic.cue_sha(proposed),
                      'current_qa_sha256':large.digest(qa_path),'loaded_model_dimensions':result['actual_loaded_model_dimensions'],
                      'input_hashes':{str(live):large.digest(live)},
                      'historical_execution_plan':{'immutable_file_sha256':{str(live):large.digest(live)}}}
            with patch.object(large,'review',return_value=proposal),patch.object(large,'evidence',side_effect=ValueError('Readback intentionally rejected')):
                with self.assertRaisesRegex(ValueError,'Readback intentionally rejected'):
                    large.apply_scoped(run,qa_path,{large.IDENT},'Explicit reviewed rollback unit transaction only.')
            self.assertEqual({path:path.read_bytes() for path in originals},originals)
            journals=list((run/'word-cues/adoption-archive').glob('*/root-one-id-journal.private.json'))
            self.assertEqual(len(journals),1)


if __name__ == '__main__':
    unittest.main()
