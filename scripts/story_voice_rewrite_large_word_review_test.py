"""Negative guards and provenance retention; fixtures never enter a production run."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import story_voice_qa as qa
import story_voice_rewrite_large_word_review as review


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.ident = 'story-425e3f45ea004557e50c6c0b'
        self.line = {'id':self.ident,'text':'Wunderbar. Und ich habe nicht mal einen Plan.'}
        self.preflight = {'inputs':{'current_audio_mp3_sha256':{self.ident:'audio-hash'}},
                          'model':{'model_id':review.MODEL},'runtime':{'fixture':'never_loaded'}}
        self.raw = {'text':' Wunderbar. Und ich habe nicht mal einen Plan.', 'language':'de',
                    'segments':[{'no_speech_prob':.01,'avg_logprob':-.2,'compression_ratio':1,
                                 'words':[{'word':'Wunderbar.','start':.1,'end':.5}]}]}
        self.summary = {'id':self.ident,'verbatim_transcript':self.raw['text'],
                        'raw_response_sha256':'raw-hash','actual_reader_uncertainty_flag':False,
                        'whole_source_literal_word_match':True}
        self.record = {'id':self.ident,'status':'actual_private_free_Large_diagnostic_not_approved',
            'binding':{'method':review.ACTUAL_METHOD,'id':self.ident,'audio_mp3_sha256':'audio-hash',
                'model':self.preflight['model'],'runtime':self.preflight['runtime'],
                'inputs_preflight_sha256':review.PREFLIGHT_SHA,'runner_sha256':review.RUNNER_SHA,
                'decoder_options':copy.deepcopy(review.OPTIONS),'authored_Source_supplied_to_decoder':False},
            'started_at_utc':'start','finished_at_utc':'end','actual_raw_response':'fixture.json',
            'actual_raw_response_sha256':'raw-hash','actual_model_dimensions_after_load':review.DIMS,
            'actual_ModelHolder_path':review.MODEL_DIR,'actual_encoder_conv1_weight_dtype':'mlx.core.float16',
            'actual_decoder_token_embedding_weight_dtype':'mlx.core.float16','verbatim_transcript':self.raw['text'],
            'whole_source_literal_word_match':True,'actual_reader_uncertainty_flag':False,
            'no_transcript_repairs':True,'no_timestamp_repairs':True,'Root_approval':False,
            'acting_or_human_hearing_verdict':None,'paid_calls':0,'QA_or_import_or_public_mutation':False}

    def validate(self):
        return review.validate_diagnostic(self.line,self.record,self.raw,self.summary,self.preflight,'raw-hash')

    def test_actual_literal_structure(self):
        self.assertTrue(self.validate())

    def test_source_or_whole_raw_cannot_be_repaired(self):
        for value in ['Wunderbar. Und ich habe nicht meinen Plan.', 'Und ich habe nicht mal einen Plan.']:
            with self.subTest(value=value):
                self.raw['text'] = value
                with self.assertRaises(ValueError): self.validate()

    def test_46_mismatches_not_eligible_even_if_diagnostic_is_consistent(self):
        text = 'Wunderbar. Und ich habe nicht meinen Plan.'
        self.raw['text'] = self.record['verbatim_transcript'] = self.summary['verbatim_transcript'] = text
        self.record['whole_source_literal_word_match'] = self.summary['whole_source_literal_word_match'] = False
        self.assertFalse(self.validate())

    def test_decoder_expected_text_and_previous_context_refused(self):
        for key,value in [('initial_prompt',self.line['text']), ('prefix','Wunderbar'),
                          ('condition_on_previous_text',True),('fp16',False)]:
            with self.subTest(key=key):
                self.record['binding']['decoder_options'] = {**review.OPTIONS,key:value}
                with self.assertRaises(ValueError): self.validate()

    def test_authored_source_flag_refused(self):
        self.record['binding']['authored_Source_supplied_to_decoder'] = True
        with self.assertRaises(ValueError): self.validate()

    def test_loaded_dimensions_and_dtype_refused(self):
        for field,value in [('actual_model_dimensions_after_load',{**review.DIMS,'n_text_layer':4}),
                            ('actual_ModelHolder_path',review.MODEL_DIR+'-turbo'),
                            ('actual_encoder_conv1_weight_dtype','mlx.core.float32')]:
            with self.subTest(field=field):
                record = copy.deepcopy(self.record); record[field] = value
                with self.assertRaises(ValueError):
                    review.validate_diagnostic(self.line,record,self.raw,self.summary,self.preflight,'raw-hash')

    def test_model_name_turbo_cannot_masquerade_as_full_large(self):
        model = {'model_id':qa.MODEL,'actual_local_directory':review.MODEL_DIR,
                 'actual_weight_file':review.MODEL_DIR+'/model.safetensors',
                 'actual_dimensions':review.DIMS,'config_sha256':review.CONFIG_SHA,
                 'weights_sha256':review.WEIGHTS_SHA,'download_or_model_or_alias_mutation':False}
        with self.assertRaises(ValueError): review.validate_model(model)

    def test_raw_low_confidence_cannot_be_hidden(self):
        self.raw['segments'][0]['avg_logprob'] = -2
        with self.assertRaises(ValueError): self.validate()
        self.record['actual_reader_uncertainty_flag'] = self.summary['actual_reader_uncertainty_flag'] = True
        self.assertFalse(self.validate())

    def test_empty_missing_raw_segment_refused_or_uncertain(self):
        del self.raw['segments']
        with self.assertRaises(ValueError): self.validate()

    def test_fabricated_timing_adoption_field_refused(self):
        self.record['word_cues'] = [{'start':0,'end':1}]
        with self.assertRaises(ValueError): self.validate()

    def test_raw_file_timestamp_change_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'actual-raw.json'
            path.write_text(json.dumps(self.raw)); original = hashlib.sha256(path.read_bytes()).hexdigest()
            self.raw['segments'][0]['words'][0]['start'] = .4
            path.write_text(json.dumps(self.raw))
            with self.assertRaises(ValueError): review.bound_file(path,original,{})

    def test_missing_bound_raw_response_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError): review.bound_file(Path(directory)/'missing-raw.json','original',{})


class WholeReportTests(unittest.TestCase):
    def setUp(self):
        # Pure structural fixtures have no physical audio or production output.
        self.ident = 'story-425e3f45ea004557e50c6c0b'
        ids = [self.ident] + ['story-'+format(index,'024x') for index in range(489)]
        self.lines = {ident:{'id':ident,'text':'Test.'} for ident in ids}
        self.lines[self.ident]['text'] = 'Wunderbar. Und ich habe nicht mal einen Plan.'
        self.report = {'version':qa.VERSION,'model':qa.MODEL,'manifest_sha256':review.MANIFEST_SHA,
                       'finished_at':1,'status':'review_required','checked_ids':ids,
                       'clip_sha256':{},'takes':[],'failures':[]}
        self.cache = {}
        for ident,line in self.lines.items():
            clip = qa.text_hash(ident); self.report['clip_sha256'][ident] = clip
            transcript = 'Wunderbar. Und ich habe nicht meinen Plan.' if ident == self.ident else 'Test.'
            cache = {'clip_sha256':clip,'text_sha256':qa.text_hash(line['text']),'transcript':transcript}
            key = qa.text_hash(qa.VERSION+'\0'+qa.MODEL+'\0'+clip+'\0'+line['text']);self.cache[key] = cache
            reasons = [review.LEXICAL_REASON] if ident == self.ident else []
            self.report['takes'].append({'id':ident,'text_sha256':cache['text_sha256'],'transcript':transcript,
                'word_error_rate':qa.distance(qa.words(line['text']),qa.words(transcript))/len(qa.words(line['text'])),
                'signal':{'fixture':'structural_only'},'reasons':reasons,
                'independent_asr_diagnosis':{'transcript':"Wunderbar. Und ich hab nicht mal 'n Plan."}})
            self.report['failures'].extend({'id':ident,'reason':reason} for reason in reasons)
        self.evidence = {'source_text_sha256':qa.text_hash(self.lines[self.ident]['text']),
                         'clip_sha256':self.report['clip_sha256'][self.ident], 'raw_response_sha256':'raw',
                         'diagnostic_sha256':'diagnostic', 'input_take_sha256':review.canonical_sha(self.report['takes'][0])}
        self.proof = {'source_manifest_sha256':review.MANIFEST_SHA, 'input_qa_sha256':'whole-qa',
                      'input_primary_cache_sha256':'cache', 'actual_completed_report_sha256':review.COMPLETED_SHA,
                      'preflight_sha256':review.PREFLIGHT_SHA, 'runner_sha256':review.RUNNER_SHA,
                      'root_log_sha256':review.ROOT_LOG_SHA, 'eligible_records':{self.ident:self.evidence},
                      'input_qa_path':'fixture-only-whole490.json'}
        self.selection = {'status':'root_approved_exact_literal_large_word_review','reviewed_by':'Root fixture',
            'reason':'Root selected this one complete literal whole secondary read.',
            **{key:value for key,value in self.proof.items() if key not in ['eligible_records','input_qa_path']},
            'selected_ids':[self.ident],'records':{self.ident:{**self.evidence,'reason':'Actual entire Source and raw read match without replacements.'}},
            'listening_verdict':None,'acting_verdict':None}
        self.actual = {self.ident:{'diagnostic':{'verbatim_transcript':' Wunderbar. Und ich habe nicht mal einen Plan.'}}}

    def validate(self):
        return review.validate_full_qa(self.report,self.lines,self.cache)

    def test_complete_490_cache_and_source_body_validated(self):
        self.assertEqual(len(self.validate()),490)

    def test_missing_and_duplicate_body_refused(self):
        self.report['takes'].pop()
        with self.assertRaises(ValueError): self.validate()

    def test_checked_projection_refused(self):
        self.report['checked_ids'] = [self.ident]
        with self.assertRaises(ValueError): self.validate()

    def test_audio_cache_or_source_binding_refused(self):
        self.report['clip_sha256'][self.ident] = 'new-audio'
        with self.assertRaises(ValueError): self.validate()

    def test_changed_primary_transcript_refused(self):
        self.report['takes'][0]['transcript'] = self.lines[self.ident]['text']
        with self.assertRaises(ValueError): self.validate()

    def test_original_wer_cannot_be_zeroed(self):
        self.report['takes'][0]['word_error_rate'] = 0
        with self.assertRaises(ValueError): self.validate()

    def test_input_mismatch_cannot_be_silently_cleared_before_adapter(self):
        self.report['takes'][0]['reasons'] = []
        self.report['failures'] = [];self.report['status'] = 'passed'
        with self.assertRaises(ValueError): self.validate()

    def test_empty_adjudication_does_not_certify_mismatched_input(self):
        self.report['takes'][0]['reasons'] = []
        self.report['takes'][0]['adjudication'] = {}
        self.report['failures'] = [];self.report['status'] = 'passed'
        with self.assertRaises(ValueError): self.validate()

    def test_global_fatal_failure_not_projected(self):
        self.report['failures'].append({'id':None,'reason':'manifest_changed_during_qa'})
        with self.assertRaises(ValueError): self.validate()

    def test_compound_signal_or_vocal_failure_cannot_be_removed(self):
        for reason in ['possible_clipping','vocal_adjudication_requires_review','asr_check_failed_ValueError',
                       'independent_audio_word_defect','lexical_veto_binding_requires_review']:
            with self.subTest(reason=reason):
                value = copy.deepcopy(self.report); value['takes'][0]['reasons'].append(reason)
                with self.assertRaises(ValueError): review.result_report(value,self.proof,self.actual,self.selection,'selection')

    def test_multitoken_primary_countertext_errors_and_every_other_take_retained(self):
        before = copy.deepcopy(self.report)
        result = review.result_report(self.report,self.proof,self.actual,self.selection,'selection')
        self.assertEqual(self.report,before)
        self.assertEqual(len(result['takes']),490)
        self.assertEqual(result['takes'][1:],before['takes'][1:])
        target = result['takes'][0]
        self.assertEqual(target['transcript'],'Wunderbar. Und ich habe nicht meinen Plan.')
        self.assertEqual(target['word_error_rate'],.25)
        self.assertEqual(target['independent_asr_diagnosis'],before['takes'][0]['independent_asr_diagnosis'])
        self.assertEqual(target['original_primary_reasons'],[review.LEXICAL_REASON])
        self.assertEqual(result['model'],qa.MODEL);self.assertEqual(result['version'],qa.VERSION)
        self.assertEqual(result['secondary_stage']['actual_model'],review.MODEL)
        self.assertIsNone(target['adjudication']['timing_verdict'])
        self.assertIsNone(target['adjudication']['listening_verdict'])

    def test_other_46_ids_not_selectable(self):
        unknown = next(ident for ident in self.lines if ident not in review.SUPPORTED)
        self.selection['selected_ids'] = [unknown]
        self.selection['records'] = {unknown:self.selection['records'][self.ident]}
        with self.assertRaises(ValueError): review.validate_selection(self.selection,self.proof)

    def test_each_root_input_hash_and_note_required(self):
        for key in ['input_qa_sha256','input_primary_cache_sha256','actual_completed_report_sha256',
                    'preflight_sha256','runner_sha256','root_log_sha256']:
            with self.subTest(key=key):
                selection = copy.deepcopy(self.selection);selection[key] = 'wrong'
                with self.assertRaises(ValueError): review.validate_selection(selection,self.proof)
        self.selection['reason'] = 'OK'
        with self.assertRaises(ValueError): review.validate_selection(self.selection,self.proof)

    def test_raw_diagnostic_and_take_review_hashes_required(self):
        for key in ['raw_response_sha256','diagnostic_sha256','input_take_sha256']:
            with self.subTest(key=key):
                selection = copy.deepcopy(self.selection);selection['records'][self.ident][key] = 'wrong'
                with self.assertRaises(ValueError): review.validate_selection(selection,self.proof)

    def test_truthful_primary_producer_required(self):
        self.report['model'] = review.MODEL
        with self.assertRaises(ValueError): self.validate()

    def test_chain_needs_specific_prior_approval_import_and_producer_bindings(self):
        selection = copy.deepcopy(self.selection)
        selection['status'] = 'root_approved_verified_unchanged_large3_after_disjoint13'
        with self.assertRaises(ValueError):
            review.chain_result_report(self.report,self.proof,self.actual,selection,'fixture-selection')

    def test_chain_result_keeps_whole490_and_every_unselected_case(self):
        # Isolated synthetic test fixture, never an actual Root approval/report.
        report = copy.deepcopy(self.report);actual = copy.deepcopy(self.actual)
        proof = copy.deepcopy(self.proof)
        for ident in review.SUPPORTED-{self.ident}:
            target = next(take for take in report['takes'] if take['id'] != self.ident
                          and take['id'] not in review.SUPPORTED)
            old_id = target['id'];target['id'] = ident;target['transcript'] = 'Original counterread.'
            target['word_error_rate'] = .5;target['reasons'] = [review.LEXICAL_REASON]
            report['checked_ids'][report['checked_ids'].index(old_id)] = ident
            report['clip_sha256'][ident] = report['clip_sha256'].pop(old_id)
            report['failures'].append({'id':ident,'reason':review.LEXICAL_REASON})
            proof['eligible_records'][ident] = {**self.evidence,'input_take_sha256':review.canonical_sha(target)}
            actual[ident] = {'diagnostic':{'verbatim_transcript':'Actual complete literal fixture read.'}}
        proof.update({key:'fixture-'+key for key in review.CHAIN_FIELDS})
        proof['imported_disjoint_ids'] = ['fixture-child13-'+str(index) for index in range(13)]
        selection = copy.deepcopy(self.selection)
        selection['status'] = 'root_approved_verified_unchanged_large3_after_disjoint13'
        selection['selected_ids'] = sorted(review.SUPPORTED)
        selection['records'] = {ident:{**proof['eligible_records'][ident],
            'reason':'Fixture technical review binds the entire actual unchanged read.'} for ident in review.SUPPORTED}
        selection['chain'] = {key:proof[key] for key in review.CHAIN_FIELDS}
        before = copy.deepcopy(report)
        out = review.chain_result_report(report,proof,actual,selection,'fixture-selection')
        self.assertEqual(report,before);self.assertEqual(len(out['takes']),490)
        self.assertEqual(out['model'],before['model']);self.assertEqual(out['version'],before['version'])
        for old,new in zip(before['takes'],out['takes']):
            if old['id'] not in review.SUPPORTED:self.assertEqual(old,new);continue
            self.assertEqual(old['transcript'],new['transcript'])
            self.assertEqual(old['word_error_rate'],new['word_error_rate'])
            self.assertEqual(old['reasons'],new['original_primary_reasons'])
            self.assertEqual(new['adjudication']['preserved_actual_Large3_root_selection_sha256'],review.PRIOR_SELECTION_SHA)
            self.assertIsNone(new['adjudication']['listening_verdict'])
        self.assertEqual(out['secondary_stage']['continuation_chain'],selection['chain'])
        for key in review.CHAIN_FIELDS:
            modified = copy.deepcopy(selection);modified['chain'][key] = 'wrong'
            with self.assertRaises(ValueError):
                review.chain_result_report(report,proof,actual,modified,'fixture-selection')


class AtomicOutputTests(unittest.TestCase):
    def test_new_output_only_and_existing_file_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'qa-test.json';path.write_text('original')
            with self.assertRaises(ValueError): review.save_new_atomic(path,{}, {})
            self.assertEqual(path.read_text(),'original')
            self.assertEqual(len(list(Path(directory).iterdir())),1)

    def test_pre_install_changed_evidence_leaves_no_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'qa-test.json'
            evidence = Path(directory)/'evidence';evidence.write_text('changed')
            with self.assertRaises(ValueError): review.save_new_atomic(path,{}, {str(evidence):'old'})
            self.assertFalse(path.exists());self.assertEqual(list(Path(directory).iterdir()),[evidence])

    def test_post_install_changed_evidence_rolls_back_new_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'qa-test.json';evidence = Path(directory)/'evidence';evidence.write_text('original')
            original = qa.digest(evidence)
            with patch.object(review,'digest',side_effect=[original,'changed']):
                with self.assertRaises(ValueError): review.save_new_atomic(path,{}, {str(evidence):original})
            self.assertFalse(path.exists());self.assertEqual(list(Path(directory).iterdir()),[evidence])

    def test_concurrent_writer_replacement_not_removed_by_rollback(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'qa-test.json';evidence = Path(directory)/'evidence';evidence.write_text('original')
            original = qa.digest(evidence);calls = 0
            def changed_after_install(_):
                nonlocal calls
                calls += 1
                if calls == 2:
                    path.unlink();path.write_text('concurrent writer')
                    return 'changed'
                return original
            with patch.object(review,'digest',side_effect=changed_after_install):
                with self.assertRaises(ValueError): review.save_new_atomic(path,{}, {str(evidence):original})
            self.assertEqual(path.read_text(),'concurrent writer')
            self.assertEqual(len(list(Path(directory).iterdir())),2)


class CurrentInputProvenanceTests(unittest.TestCase):
    def actual_inputs(self):
        run = Path(review.__file__).resolve().parents[1]/'output/audio/story-voice'/review.RUN_NAME
        qa_path = run/review.INPUT_QA_FILENAME
        if not qa_path.is_file(): self.skipTest('Private actual QA31 is not distributed with the repository')
        self.assertEqual(qa.digest(qa_path),review.INPUT_QA_SHA)
        return run,qa_path,json.loads(qa_path.read_text())

    def test_actual_genuine_qa31_input_is_accepted(self):
        run,path,_ = self.actual_inputs()
        self.assertEqual(review.current_qa_input(run,path),path.resolve())

    def test_other_root_private_self_hashed_report_is_not_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory);path = run/'qa-fabricated.private.json';path.write_text('{}')
            with self.assertRaises(ValueError): review.current_qa_input(run,path)

    def test_real_84_case_empty_adjudication_projection_is_rejected(self):
        run,_,report = self.actual_inputs()
        lines = {line['id']:line for line in json.loads((run/'lines.private.json').read_text())['lines']}
        cache = json.loads((run/'qa-asr-cache.private.json').read_text())
        projected_ids = []
        for take in report['takes']:
            if take['id'] not in review.SUPPORTED and take['reasons'] == [review.LEXICAL_REASON]:
                projected_ids.append(take['id']);take['reasons'] = [];take['adjudication'] = {}
        self.assertEqual(len(projected_ids),84)
        report['failures'] = [failure for failure in report['failures'] if failure['id'] not in projected_ids]
        self.assertEqual(len(report['failures']),3)
        with self.assertRaises(ValueError): review.validate_full_qa(report,lines,cache)
        # Only an isolated unittest temporary file is created. The real QA31,
        # its Primary cache and every production report remain byte-identical.
        with tempfile.TemporaryDirectory() as directory:
            fixture_run = Path(directory);fixture = fixture_run/review.INPUT_QA_FILENAME
            fixture.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            with self.assertRaises(ValueError): review.current_qa_input(fixture_run,fixture)
        self.assertEqual(qa.digest(run/review.INPUT_QA_FILENAME),review.INPUT_QA_SHA)

    def test_nonempty_invented_resolution_cannot_bypass_file_entry_gate(self):
        _,_,report = self.actual_inputs()
        for take in report['takes']:
            if take['id'] not in review.SUPPORTED and take['reasons']:
                take['reasons'] = [];take['adjudication'] = {'resolution':'invented'}
        report['failures'] = [failure for failure in report['failures'] if failure['id'] in review.SUPPORTED]
        with tempfile.TemporaryDirectory() as directory:
            fixture_run = Path(directory);fixture = fixture_run/review.INPUT_QA_FILENAME
            fixture.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            with self.assertRaises(ValueError): review.current_qa_input(fixture_run,fixture)


class FollowupTransitionTests(unittest.TestCase):
    def setUp(self):
        ids = ['story-'+format(index,'024x') for index in range(487)] + sorted(review.SUPPORTED)
        self.before = {ident:qa.text_hash('original-'+ident) for ident in ids}
        self.selected = ids[:13];self.current = dict(self.before)
        for ident in self.selected:self.current[ident] = qa.text_hash('actual-new-'+ident)
        self.snapshot = {'selected_ids':ids[:39],'bank_mp3_sha256':self.before}
        self.journal = {'state':'IMPORTED','selected_ids':self.selected,
                        'original_scope_selected_ids':ids[:39],
                        'new_mp3_sha256':{ident:self.current[ident] for ident in self.selected}}
        self.lines = {ident:{'id':ident,'text':'Test.'} for ident in ids}
        self.report = {'model':qa.MODEL,'clip_sha256':self.current}
        self.old_cache = {'old-record':{'original':'unchanged'}}
        self.new_cache = copy.deepcopy(self.old_cache);self.child_cache = {}
        for ident in self.selected:
            key = qa.text_hash(qa.VERSION+'\0'+qa.MODEL+'\0'+self.current[ident]+'\0Test.')
            record = {'clip_sha256':self.current[ident],'text_sha256':qa.text_hash('Test.'),'transcript':'Test.'}
            self.new_cache[key] = record;self.child_cache[key] = copy.deepcopy(record)

    def transition(self):
        return review.validate_import_transition(self.snapshot,self.journal,self.before,self.current,self.selected)

    def test_followup_disabled_before_actual_import_and_producer_run(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'qa-self-hashed.private.json';path.write_text('{}')
            with patch.object(review,'FOLLOWUP_BINDINGS',None):
                with self.assertRaises(ValueError):review.followup_input(Path(directory),path)

    def test_completed_disjoint13_transition(self):
        self.assertEqual(self.transition(),set(self.selected))

    def test_import_intent_is_not_completed_import(self):
        for status in ['IMPORT_INTENT_RECORDED','ORIGINALS_ARCHIVED',None]:
            with self.subTest(status=status):
                self.journal['state'] = status
                with self.assertRaises(ValueError):self.transition()

    def test_overlap_with_prior_large3_is_never_allowed(self):
        ident = next(iter(review.SUPPORTED));self.selected[-1] = ident
        self.snapshot['selected_ids'][-1] = ident
        with self.assertRaises(ValueError):self.transition()

    def test_unexplained_fourteenth_changed_audio_is_rejected(self):
        ident = next(ident for ident in self.current if ident not in self.selected)
        self.current[ident] = qa.text_hash('unexplained')
        with self.assertRaises(ValueError):self.transition()

    def test_incomplete_snapshot_or_unqualified_subset_rejected(self):
        self.snapshot['bank_mp3_sha256'] = dict(self.before)
        self.snapshot['bank_mp3_sha256'].pop(next(iter(self.before)))
        with self.assertRaises(ValueError):self.transition()

    def test_false_completed_journal_audio_does_not_explain_current_bytes(self):
        self.journal['new_mp3_sha256'][self.selected[0]] = qa.text_hash('different')
        with self.assertRaises(ValueError):self.transition()

    def test_donor_cache_entries_are_appended_unchanged(self):
        keys = review.validate_cache_transition(self.old_cache,self.new_cache,self.report,self.lines,
                                               self.selected,self.child_cache)
        self.assertEqual(len(keys),13)

    def test_old_primary_cache_rewrite_refused(self):
        self.new_cache['old-record'] = {'original':'rewritten'}
        with self.assertRaises(ValueError):
            review.validate_cache_transition(self.old_cache,self.new_cache,self.report,self.lines,
                                             self.selected,self.child_cache)

    def test_synthetic_new_reader_instead_of_actual_child_record_refused(self):
        key = next(iter(self.child_cache));self.new_cache[key] = {**self.new_cache[key],'transcript':'repaired'}
        with self.assertRaises(ValueError):
            review.validate_cache_transition(self.old_cache,self.new_cache,self.report,self.lines,
                                             self.selected,self.child_cache)

    def test_unexplained_extra_cache_entry_refused(self):
        self.new_cache['another-report'] = {'transcript':'invented'}
        with self.assertRaises(ValueError):
            review.validate_cache_transition(self.old_cache,self.new_cache,self.report,self.lines,
                                             self.selected,self.child_cache)


class ActualFollowupInputTests(unittest.TestCase):
    def actual(self):
        run = Path(review.__file__).resolve().parents[1]/'output/audio/story-voice'/review.RUN_NAME
        cfg = review.FOLLOWUP_BINDINGS
        path = run/cfg['input_qa_relative_path']
        if not path.is_file():self.skipTest('Private completed follow-up producer evidence is not distributed')
        self.assertEqual(qa.digest(path),cfg['input_qa_sha256'])
        return run,path,json.loads(path.read_text()),cfg

    def test_actual_completed_followup_qa_pin_accepted(self):
        run,path,_,_ = self.actual()
        self.assertEqual(review.followup_input(run,path),path.resolve())

    def test_actual_full490_producer_log_validated(self):
        run,_,report,cfg = self.actual()
        log = (run/cfg['producer_log_relative_path']).read_text()
        review.validate_producer_log(log,report)

    def test_fake62_to3_projection_with_nonempty_adjudications_blocked(self):
        _,_,report,cfg = self.actual()
        projected = []
        for take in report['takes']:
            if take['id'] not in review.SUPPORTED and take['reasons']:
                projected.append(take['id']);take['reasons'] = [];take['adjudication'] = {'resolution':'invented'}
        self.assertEqual(len(projected),62)
        report['failures'] = [failure for failure in report['failures'] if failure['id'] not in projected]
        self.assertEqual(len(report['failures']),3)
        with tempfile.TemporaryDirectory() as directory:
            run = Path(directory);path = run/cfg['input_qa_relative_path']
            path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            with self.assertRaises(ValueError):review.followup_input(run,path)

    def test_incomplete_or_altered_producer_progress_refused(self):
        run,_,report,cfg = self.actual()
        log = (run/cfg['producer_log_relative_path']).read_text()
        bad = '\n'.join(line for line in log.splitlines() if not line.startswith('490/490 '))
        with self.assertRaises(ValueError):review.validate_producer_log(bad,report)
        report['takes'][0]['reasons'] = ['invented_rejection']
        with self.assertRaises(ValueError):review.validate_producer_log(log,report)

    def test_fake_producer_completion_cannot_claim_fewer_open_words(self):
        run,path,report,cfg = self.actual()
        intent = json.loads((run/cfg['producer_intent_relative_path']).read_text())
        completion = json.loads((run/cfg['producer_completion_relative_path']).read_text())
        completion['open'] = 3;completion['clear'] = 487
        with self.assertRaises(ValueError):
            review.validate_producer_metadata(run,path,report,intent,completion,cfg,{})

    def test_followup_current_large3_primary_counterevidence_is_byte_identical_in_structure(self):
        run,_,report,_ = self.actual()
        original = json.loads((run/review.INPUT_QA_FILENAME).read_text())
        before = {take['id']:take for take in original['takes']}
        current = {take['id']:take for take in report['takes']}
        for ident in review.SUPPORTED:self.assertEqual(before[ident],current[ident])

    def test_original_large3_output_and_root_approval_preserved(self):
        run,_,_,_ = self.actual()
        self.assertEqual(qa.digest(run/review.PRIOR_OUTPUT_PATH),review.PRIOR_OUTPUT_SHA)
        self.assertEqual(qa.digest(run/review.PRIOR_SELECTION_PATH),review.PRIOR_SELECTION_SHA)


if __name__ == '__main__':
    unittest.main()
