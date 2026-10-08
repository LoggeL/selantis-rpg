"""Synthetic offline guard fixtures only. No MLX import, model load or network."""
import argparse
from contextlib import nullcontext, redirect_stdout
import copy
import io
import json
import math
from pathlib import Path
import tempfile
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch
import part2_voice_retake_batch_test as transport_test
import part2_voice_retake_qualify as q

r = q.retake
METRICS = {'seconds': .5, 'decoded_samples': 12000, 'peak': .1, 'rms': .05, 'clipped_fraction': 0,
           'leading_silence_seconds': .1, 'trailing_silence_seconds': .1, 'last_frame_rms': 0, 'silent': False}


class Fixture(unittest.TestCase):
    preview = transport_test.Fixture.preview
    approve_styles = transport_test.Fixture.approve_styles
    freeze = transport_test.Fixture.freeze
    response = transport_test.Fixture.response
    retained = transport_test.Fixture.retained
    fake_normalize = transport_test.Fixture.fake_normalize

    def setUp(self):
        transport_test.Fixture.setUp(self)
        info = self.freeze()
        self.qpatches = [patch.object(q, 'EXPECTED_IDS', self.ids), patch.object(q, 'EXPECTED_INPUT_SHA', info['input_sha256'])]
        for item in self.qpatches: item.start()
        self.retained()
        with patch.object(r.core, 'normalize', side_effect=self.fake_normalize), redirect_stdout(io.StringIO()):
            r.resume_collection(self.args, self.parent, self.run)
        r.core.save(self.run/'job.json', {'state': 'JOB_STATE_SUCCEEDED', 'request_count': 3, 'model': r.MODEL})
        self.model = {'local_directory': str((self.root/'existing-model-fixture').resolve()), 'dimensions': q.DIMENSIONS}

    def tearDown(self):
        for item in reversed(self.qpatches): item.stop()
        transport_test.Fixture.tearDown(self)

    def word_evidence(self, mismatch=False):
        rows = r.read(self.run/'lines.private.json')['lines']; takes = []
        for index, row in enumerate(rows):
            ident = row['id']; transcript = 'Falsche Worte.' if mismatch and index == 0 else row['text']
            args = {'path_or_hf_repo': self.model['local_directory'], 'language': 'de', 'condition_on_previous_text': False, 'temperature': 0.0}
            pin = {'id': ident, 'audio_sha256': r.digest(self.run/'clips'/(ident+'.mp3')), 'actual_call_args': args}
            r.core.save(self.run/'local-asr-intents'/(ident+'.private.json'), {**pin, 'state': 'ONE_ACTUAL_LOCAL_CALL_INTENT'})
            r.core.save(self.run/'asr-raw'/(ident+'.private.json'), {**pin, 'state': 'ACTUAL_RESPONSE_RETAINED', 'source_free': True,
                'raw_saved_before_diagnosis': True, 'actual_runtime': {'model_path': self.model['local_directory'], 'dimensions': q.DIMENSIONS},
                'actual_response': {'text': transcript, 'segments': [{'no_speech_prob': .001, 'avg_logprob': -.1, 'compression_ratio': 1}]}})
            errors = q.qa.distance(q.qa.words(row['text']), q.qa.words(transcript))
            takes.append({'id': ident, 'text_sha256': q.qa.text_hash(row['text']), 'signal': METRICS, 'asr_reused': False,
                'transcript': transcript, 'word_error_rate': errors/len(q.qa.words(row['text'])),
                'reasons': ['asr_lexical_mismatch_requires_review'] if errors else []})
        return {'manifest_sha256': r.digest(self.run/'lines.private.json'), 'model': q.qa.MODEL+':'+self.model['local_directory'],
                'takes': takes, 'checked_ids': self.ids, 'clip_sha256': {ident: r.digest(self.run/'clips'/(ident+'.mp3')) for ident in self.ids},
                'failures': [{'id': take['id'], 'reason': reason} for take in takes for reason in take['reasons']],
                'status': 'review_required' if mismatch else 'passed'}

    def timing_evidence(self, flagged=False):
        receipts = []
        for row in r.read(self.run/'lines.private.json')['lines']:
            ident = row['id']; flags = [{'word_index': 0, 'word': row['text'], 'reasons': ['fixture_flag']} ] if flagged else []
            original = {'version': q.cues.acoustic.VERSION, 'id': ident, 'text': row['text'],
                'audio_sha256': r.digest(self.run/'clips'/(ident+'.mp3')), 'decoded_seconds': .5,
                'word_cues': [{'start': .1, 'end': .4}],
                'words': [{'word': row['text'], 'start': .1, 'end': .4, 'spoken': True, 'minimum_token_probability': 1}],
                'token_alignment': [{'fixture': 'not a real model'}], 'qualification_flags': flags}
            r.core.save(self.run/'alignment-raw'/(ident+'.private.json'), {'id': ident, 'audio_sha256': original['audio_sha256'],
                'actual_runtime': {'model_path': self.model['local_directory'], 'dimensions': q.DIMENSIONS},
                'actual_loader_arguments': {'positional_model_dir': self.model['local_directory'], 'kwargs': {}},
                'source_free': False, 'teacher_forced_authored_text': True, 'word_fidelity_proof': False,
                'raw_saved_before_refinement': True, 'actual_response': original})
            receipt = copy.deepcopy(original); receipt['original_qualification_flags'] = copy.deepcopy(flags)
            receipt.update(text_sha256=q.cues.text_sha(row['text']), source_manifest_sha256=r.digest(self.run/'lines.private.json'), engine_version=q.cues.ENGINE)
            receipt['all_qualification_flags'] = q.cues.qualification_flags(receipt)
            receipt['cues_sha256'] = q.cues.acoustic.cue_sha(receipt['word_cues']); receipt['authored_word_count'] = 1
            r.core.save(self.run/'word-cues'/(ident+'.json'), receipt); receipts.append(receipt)
        report = q.cues.report_for(receipts); report.update(source_manifest_sha256=r.digest(self.run/'lines.private.json'), selected_ids=self.ids, coverage='all_collected')
        return report

    def test_actual_collected_source_request_preset_and_current_audio_lineage(self):
        before = r.protected_parent(self.parent); info, rows = q.collected(self.run)
        self.assertEqual(info['selected_ids'], self.ids); self.assertEqual(set(rows), set(self.ids))
        self.assertEqual(r.protected_parent(self.parent), before)

    def test_wrong_exact_subset_or_input_hash_is_refused(self):
        with patch.object(q, 'EXPECTED_IDS', self.ids[:2]), self.assertRaises(r.SafeError): q.collected(self.run)
        with patch.object(q, 'EXPECTED_INPUT_SHA', 'f'*64), self.assertRaises(r.SafeError): q.collected(self.run)

    def test_nonterminal_or_uncollected_job_is_refused_before_model_identity(self):
        r.core.save(self.run/'job.json', {'state': 'SUBMITTED', 'request_count': 3, 'model': r.MODEL})
        with patch.object(q, 'model_identity') as model, self.assertRaises(r.SafeError): q.execute(self.run, 'qa', Path('/fake'))
        model.assert_not_called()

    def test_current_source_drift_blocks_model_before_first_qualification_intent(self):
        source = self.root/next(iter(self.manifest['source_hashes']))
        source.write_text('Changed current authored Source')
        with patch.object(q, 'model_identity') as model, self.assertRaises(r.SafeError): q.execute(self.run, 'qa', Path('/fake'))
        model.assert_not_called(); self.assertFalse((self.run/'qualification-qa.intent.private.json').exists())

    def test_truncated_response_is_rejected_even_with_rewritten_response_hashes(self):
        rows = self.response(); rows[0]['response']['candidates'][0]['finishReason'] = 'MAX_TOKENS'
        self.retained(rows)
        r.core.save(self.run/'collect-intent.private.json', {'state': 'COLLECTED_ONCE', 'expected': 3, 'collected': 3, 'held_failures': 0,
                     'response_sha256': r.digest(self.run/'responses.private.jsonl')})
        with self.assertRaises(r.SafeError): q.collected(self.run)

    def test_current_audio_or_requested_cast_changes_are_refused(self):
        path = self.run/'public-manifest.proposed.json'; proposal = r.read(path)
        proposal['clips'][0]['voice'] = 'Wrong Voice'; r.core.save(path, proposal)
        with self.assertRaises(r.SafeError): q.collected(self.run)

    def test_actual_model_source_request_duration_and_normalization_receipt_fields(self):
        path = self.run/'raw'/(self.ids[0]+'.receipt.json'); original = r.read(path)
        for field, value in [('model', 'other'), ('request_sha256', 'f'*64), ('source_text_sha256', 'f'*64),
                             ('seconds', 999), ('normalization_input', 'new_pcm_wrapper'), ('provider_response_sha256', 'f'*64)]:
            receipt = copy.deepcopy(original); receipt[field] = value; r.core.save(path, receipt)
            with self.subTest(field=field), self.assertRaises(r.SafeError): q.collected(self.run)
        r.core.save(path, original)

    def test_old_transcript_caches_and_timing_files_are_never_reused(self):
        q.fresh(self.run, 'qa'); q.fresh(self.run, 'align')
        r.core.save(self.run/'qa-asr-cache.private.json', {'old': 'not current'} )
        with self.assertRaises(r.SafeError): q.fresh(self.run, 'qa')
        r.core.save(self.run/'word-cues'/(self.ids[0]+'.json'), {'old': 'not current'})
        with self.assertRaises(r.SafeError): q.fresh(self.run, 'align')

    def test_once_model_intent_blocks_repeat_after_failed_or_unknown_run(self):
        r.core.save(self.run/'qualification-qa.intent.private.json', {'state': 'FAILED'})
        with self.assertRaises(r.SafeError): q.fresh(self.run, 'qa')
        r.core.save(self.run/'qualification-align.intent.private.json', {'state': 'UNKNOWN'})
        with self.assertRaises(r.SafeError): q.fresh(self.run, 'align')

    def test_before_model_snapshot_preserves_all_existing_provider_and_parent_artifacts(self):
        before = q.baseline(self.run); q.unchanged(self.run, before)
        target = self.run/'raw'/(self.ids[0]+'.wav'); target.write_bytes(target.read_bytes()+b'changed')
        with self.assertRaises(r.SafeError): q.unchanged(self.run, before)

    def test_root_progress_stdout_log_can_grow_without_blessing_changed_source_or_audio(self):
        log = self.run/'qa-actual-producer.private.log'; log.write_text('')
        self.assertEqual(q.monitoring_log(self.run, 'qa', log), log)
        before = q.baseline(self.run, log); log.write_text('Actual producer progress\n')
        self.assertNotIn(log.name, before); q.unchanged(self.run, before)
        wav = self.run/'raw'/(self.ids[0]+'.wav'); wav.write_bytes(wav.read_bytes()+b'changed')
        with self.assertRaises(r.SafeError): q.unchanged(self.run, before)

    def test_historical_logs_remain_pinned_by_default_and_during_other_operation(self):
        old = self.run/'qa-actual-producer.private.log'; old.write_text('Retained actual QA progress\n')
        active = self.run/'align-actual-producer.private.log'; active.write_text('')
        before = q.baseline(self.run)
        self.assertIn(old.name, before); self.assertIn(active.name, before)
        before = q.baseline(self.run, q.monitoring_log(self.run, 'align', active))
        active.write_text('Current timing progress\n'); q.unchanged(self.run, before)
        old.write_text('Altered historical evidence\n')
        with self.assertRaises(r.SafeError): q.unchanged(self.run, before)

    def test_monitoring_log_cannot_exempt_provider_raw_source_or_another_operation(self):
        for path in [self.run/'raw'/'qa-actual-producer.private.log', self.run/'lines.private.json',
                     self.run/'responses.private.jsonl', self.run/'align-actual-producer.private.log']:
            with self.subTest(path=path), self.assertRaises(r.SafeError): q.monitoring_log(self.run, 'qa', path)
        link = self.run/'qa-actual-producer.private.log'; link.symlink_to(self.run/'lines.private.json')
        with self.assertRaises(r.SafeError): q.monitoring_log(self.run, 'qa', link)

    def test_local_word_report_needs_literal_new_audio_raw_and_signal_bytes(self):
        report = self.word_evidence()
        with patch.object(q.qa, 'decode', return_value=METRICS): self.assertEqual(q.verify_word_report(self.run, report, self.model), self.ids)
        path = self.run/'asr-raw'/(self.ids[0]+'.private.json'); raw = r.read(path)
        raw['audio_sha256'] = 'f'*64; r.core.save(path, raw)
        with patch.object(q.qa, 'decode', return_value=METRICS), self.assertRaises(r.SafeError): q.verify_word_report(self.run, report, self.model)

    def test_whole_word_mismatch_and_failures_cannot_be_projected_to_passed(self):
        report = self.word_evidence(mismatch=True)
        with patch.object(q.qa, 'decode', return_value=METRICS): q.verify_word_report(self.run, report, self.model)
        report['takes'][0]['reasons'] = []; report['failures'] = []; report['status'] = 'passed'
        with patch.object(q.qa, 'decode', return_value=METRICS), self.assertRaises(r.SafeError): q.verify_word_report(self.run, report, self.model)

    def test_uncertain_segments_or_changed_signal_cannot_be_labeled_passed(self):
        report = self.word_evidence(); path = self.run/'asr-raw'/(self.ids[0]+'.private.json'); raw = r.read(path)
        raw['actual_response']['segments'][0]['no_speech_prob'] = .99; r.core.save(path, raw)
        with patch.object(q.qa, 'decode', return_value=METRICS), self.assertRaises(r.SafeError): q.verify_word_report(self.run, report, self.model)
        report['takes'][0]['signal'] = {**METRICS, 'rms': .9}
        with patch.object(q.qa, 'decode', return_value=METRICS), self.assertRaises(r.SafeError): q.verify_word_report(self.run, report, self.model)

    def test_old_audio_hashes_and_adjudication_flags_are_refused(self):
        report = self.word_evidence(); report['clip_sha256'][self.ids[0]] = 'f'*64
        with patch.object(q.qa, 'decode', return_value=METRICS), self.assertRaises(r.SafeError): q.verify_word_report(self.run, report, self.model)
        report['takes'][0]['adjudication'] = {'approved': True}
        with patch.object(q.qa, 'decode', return_value=METRICS), self.assertRaises(r.SafeError): q.verify_word_report(self.run, report, self.model)

    def test_timing_must_reproduce_raw_dtw_on_current_audio(self):
        report = self.timing_evidence()
        with patch.object(q.cues.acoustic, 'decode', return_value=[]), patch.object(q.cues.acoustic, 'refine_boundaries', side_effect=lambda value, _: value):
            self.assertEqual(q.verify_timing_report(self.run, report, self.model), self.ids)
            path = self.run/'word-cues'/(self.ids[0]+'.json'); receipt = r.read(path)
            receipt['word_cues'][0]['start'] = .2; r.core.save(path, receipt)
            with self.assertRaises(r.SafeError): q.verify_timing_report(self.run, report, self.model)

    def test_all_original_timing_flags_and_held_report_bodies_are_retained(self):
        report = self.timing_evidence(flagged=True)
        with patch.object(q.cues.acoustic, 'decode', return_value=[]), patch.object(q.cues.acoustic, 'refine_boundaries', side_effect=lambda value, _: value):
            q.verify_timing_report(self.run, report, self.model)
            report['failures'] = []; report['requires_qualification'] = []; report['status'] = 'passed'
            with self.assertRaises(r.SafeError): q.verify_timing_report(self.run, report, self.model)

    def test_adapter_restores_old_story_and_initial_driver_globals(self):
        before = (q.common.ROOT, q.common.PRIVATE, q.common.prepared, q.qa.ROOT, q.qa.PRIVATE, q.qa.ID,
                  q.cues.STORY_ID, q.core.ROOT, q.core.PRIVATE, q.core.prepared)
        with self.assertRaises(RuntimeError):
            with q.adapter(self.run):
                self.assertTrue(q.qa.ID.fullmatch(self.ids[0])); self.assertIs(q.common.prepared, r.prepared)
                raise RuntimeError('fixture')
        self.assertEqual(before, (q.common.ROOT, q.common.PRIVATE, q.common.prepared, q.qa.ROOT, q.qa.PRIVATE, q.qa.ID,
                                 q.cues.STORY_ID, q.core.ROOT, q.core.PRIVATE, q.core.prepared))

    def test_source_free_capture_preserves_actual_raw_before_runtime_guard(self):
        module, holder_module = ModuleType('mlx_whisper'), ModuleType('mlx_whisper.transcribe')
        calls = []
        module.transcribe = lambda *_args, **kwargs: calls.append(kwargs) or {'text': 'actual fixture response', 'segments': []}
        holder_module.ModelHolder = SimpleNamespace(model_path=self.model['local_directory'], model=SimpleNamespace(dims=SimpleNamespace(**{**q.DIMENSIONS, 'n_text_layer': 32})))
        evidence = {'model': self.model}
        args = {'path_or_hf_repo': self.model['local_directory'], 'language': 'de', 'condition_on_previous_text': False, 'temperature': 0.0}
        with patch.dict('sys.modules', {'mlx_whisper': module, 'mlx_whisper.transcribe': holder_module}):
            original = module.transcribe
            with q.capture_actual(self.run, 'qa', evidence):
                with self.assertRaises(r.SafeError): module.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **args)
                raw = r.read(self.run/'asr-raw'/(self.ids[0]+'.private.json'))
                self.assertEqual(raw['actual_response']['text'], 'actual fixture response'); self.assertEqual(raw['actual_runtime']['dimensions']['n_text_layer'], 32)
                with self.assertRaises(r.SafeError): module.transcribe(str(self.run/'clips'/(self.ids[1]+'.mp3')), **args)
            self.assertIs(module.transcribe, original)
        self.assertEqual(len(calls), 1)

    def test_prompt_leak_is_rejected_before_any_model_call(self):
        module = ModuleType('mlx_whisper'); module.transcribe = unittest.mock.Mock()
        args = {'path_or_hf_repo': self.model['local_directory'], 'language': 'de', 'condition_on_previous_text': False, 'temperature': 0.0, 'initial_prompt': 'unapproved authored words'}
        with patch.dict('sys.modules', {'mlx_whisper': module}), q.capture_actual(self.run, 'qa', {'model': self.model}):
            with self.assertRaises(r.SafeError): module.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **args)
        module.transcribe.assert_not_called(); self.assertFalse((self.run/'asr-raw').exists())

    def test_returned_raw_survives_unknown_holder_path_before_runtime_rejection(self):
        module, holder_module = ModuleType('mlx_whisper'), ModuleType('mlx_whisper.transcribe')
        module.transcribe = lambda *_args, **_kwargs: {'text': 'Actual retained fixture response', 'segments': []}
        holder_module.ModelHolder = SimpleNamespace(model_path=None, model=SimpleNamespace(dims=SimpleNamespace(**q.DIMENSIONS)))
        args = {'path_or_hf_repo': self.model['local_directory'], 'language': 'de', 'condition_on_previous_text': False, 'temperature': 0.0}
        evidence = {'model': self.model}
        with patch.dict('sys.modules', {'mlx_whisper': module, 'mlx_whisper.transcribe': holder_module}), q.capture_actual(self.run, 'qa', evidence):
            with self.assertRaises(r.SafeError): module.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **args)
        raw = r.read(self.run/'asr-raw'/(self.ids[0]+'.private.json'))
        self.assertEqual(raw['actual_response']['text'], 'Actual retained fixture response')
        self.assertIsNone(raw['actual_runtime']['model_path']); self.assertTrue(evidence['runtime_guard_failed'])

    def test_nonfinite_actual_response_is_archived_then_hard_rejected(self):
        module, holder_module = ModuleType('mlx_whisper'), ModuleType('mlx_whisper.transcribe')
        module.transcribe = lambda *_args, **_kwargs: {'text': 'Actual nonfinite fixture response', 'segments': [{'avg_logprob': float('nan')}]}
        holder_module.ModelHolder = SimpleNamespace(model_path=self.model['local_directory'], model=SimpleNamespace(dims=SimpleNamespace(**q.DIMENSIONS)))
        args = {'path_or_hf_repo': self.model['local_directory'], 'language': 'de', 'condition_on_previous_text': False, 'temperature': 0.0}
        evidence = {'model': self.model}
        with patch.dict('sys.modules', {'mlx_whisper': module, 'mlx_whisper.transcribe': holder_module}), q.capture_actual(self.run, 'qa', evidence):
            with self.assertRaises(r.SafeError): module.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **args)
        path = self.run/'asr-raw'/(self.ids[0]+'.private.json')
        actual = json.loads(path.read_text())
        self.assertEqual(actual['actual_response']['text'], 'Actual nonfinite fixture response')
        self.assertTrue(math.isnan(actual['actual_response']['segments'][0]['avg_logprob']))
        with self.assertRaises(r.SafeError): r.read(path)
        self.assertTrue(evidence['runtime_guard_failed'])

    def test_actual_alignment_raw_precedes_removed_audio_post_call_guard(self):
        model = SimpleNamespace(dims=SimpleNamespace(**q.DIMENSIONS)); ident = self.ids[0]
        path = self.run/'clips'/(ident+'.mp3'); before = r.digest(path)
        def actual_align(_model, _tokenizer, clip, _audio):
            path.unlink()
            return {'id': ident, 'actual_fixture_response': 'returned before disappeared clip'}
        evidence = {'model': self.model}
        with patch.object(q.cues, 'load_local_model', return_value=(model, object())), patch.object(q.cues.acoustic, 'align', side_effect=actual_align), \
             patch.object(q, 'model_identity', return_value=self.model), q.capture_actual(self.run, 'align', evidence):
            pair = q.cues.load_local_model(Path(self.model['local_directory']))
            with self.assertRaises(r.SafeError): q.cues.acoustic.align(*pair, {'id': ident}, [])
        raw = r.read(self.run/'alignment-raw'/(ident+'.private.json'))
        self.assertEqual(raw['audio_sha256'], before)
        self.assertEqual(raw['actual_response']['actual_fixture_response'], 'returned before disappeared clip')
        self.assertFalse(raw['source_free']); self.assertTrue(raw['teacher_forced_authored_text']); self.assertFalse(raw['word_fidelity_proof'])

    def test_ram_download_block_covers_installed_direct_alias_and_resets_old_qa_model_holder(self):
        hub, loader, transcribe = ModuleType('huggingface_hub'), ModuleType('mlx_whisper.load_models'), ModuleType('mlx_whisper.transcribe')
        hub.snapshot_download = unittest.mock.Mock(return_value='NEVER ACTUALLY CALLED')
        loader.snapshot_download = hub.snapshot_download
        transcribe.ModelHolder = SimpleNamespace(model=object(), model_path=self.model['local_directory'])
        original = hub.snapshot_download
        with patch.dict('sys.modules', {'huggingface_hub': hub, 'mlx_whisper.load_models': loader, 'mlx_whisper.transcribe': transcribe}):
            with q.local_only_runtime('qa'):
                self.assertIsNone(transcribe.ModelHolder.model); self.assertIsNone(transcribe.ModelHolder.model_path)
                with self.assertRaises(r.SafeError): hub.snapshot_download(repo_id='unexpected')
                with self.assertRaises(r.SafeError): loader.snapshot_download(repo_id='disappeared_absolute_path')
            self.assertIs(hub.snapshot_download, original); self.assertIs(loader.snapshot_download, original)
            self.assertIsNone(transcribe.ModelHolder.model); self.assertIsNone(transcribe.ModelHolder.model_path)
        original.assert_not_called()

    def test_installed_turbo_config_and_actual_weight_bytes_are_required(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            with self.assertRaises(r.SafeError): q.model_identity(path)
            r.core.save(path/'config.json', {'model_type': 'whisper', **q.DIMENSIONS, 'n_text_layer': 32})
            (path/'model.safetensors').write_bytes(b'SYNTHETIC MODEL IDENTITY FIXTURE, NEVER LOADED')
            with self.assertRaises(r.SafeError): q.model_identity(path)

    def test_no_paid_keys_import_or_word_exception_flags_exist(self):
        fields = {action.dest for action in q.parser()._actions}
        for name in ['key_stdin', 'api_key', 'import_audio', 'public_dir', 'adjudications', 'qualification', 'only_ids']:
            self.assertNotIn(name, fields)

    def test_complete_producer_lifecycle_is_once_only_and_preserves_initial_and_current_raw(self):
        # Pure test doubles, never a model load or a production transcript.
        module, holder_module = ModuleType('mlx_whisper'), ModuleType('mlx_whisper.transcribe')
        source = {row['id']: row['text'] for row in r.read(self.run/'lines.private.json')['lines']}
        module.transcribe = lambda path, **_kwargs: {'text': source[Path(path).stem], 'segments': [
            {'no_speech_prob': .001, 'avg_logprob': -.1, 'compression_ratio': 1}]}
        holder_module.ModelHolder = SimpleNamespace(model_path=self.model['local_directory'], model=SimpleNamespace(dims=SimpleNamespace(**q.DIMENSIONS)))
        def asr(model):
            return lambda path: module.transcribe(str(path), path_or_hf_repo=model, language='de', condition_on_previous_text=False, temperature=0.0)['text']
        parent_before, child_before = r.protected_parent(self.parent), q.baseline(self.run)
        actual_qualify = q.qa.qualify
        with patch.dict('sys.modules', {'mlx_whisper': module, 'mlx_whisper.transcribe': holder_module}), \
             patch.object(q, 'local_only_runtime', side_effect=lambda _command: nullcontext()), \
             patch.object(q, 'model_identity', return_value=self.model), patch.object(q.qa, 'LocalASR', side_effect=asr), \
             patch.object(q.qa, 'qualify', side_effect=lambda *args, **kwargs: actual_qualify(*args, **kwargs, decode_fn=lambda _path: METRICS)), \
             patch.object(q.qa, 'decode', return_value=METRICS), redirect_stdout(io.StringIO()):
            report = q.execute(self.run, 'qa', Path(self.model['local_directory']))
            self.assertEqual(report['status'], 'passed', report.get('failures'))
            proof = r.read(self.run/'qualification-qa.producer.private.json')
            self.assertEqual(proof['state'], 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT')
            self.assertEqual(proof['actual_model_call_ids'], self.ids)
            self.assertFalse(proof['human_listening_or_acting_or_voice_identity_approved'])
            with self.assertRaises(r.SafeError): q.execute(self.run, 'qa', Path(self.model['local_directory']))
        self.assertEqual(r.protected_parent(self.parent), parent_before)
        q.unchanged(self.run, child_before)


if __name__ == '__main__': unittest.main()
