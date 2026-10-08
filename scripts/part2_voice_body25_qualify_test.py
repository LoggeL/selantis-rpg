"""Offline Source/provenance/call-boundary guards. No model/network execution."""
from contextlib import contextmanager, nullcontext, redirect_stdout
import copy
import io
import json
from pathlib import Path
import tempfile
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import part2_voice_body25_qualify as m
import part2_voice_retake_qualify as frozen
import part2_voice_retake_qualify_test as oldtests


@unittest.skipUnless(m.REVIEW_PATH.is_file() and all(
    (m.RUN/'retake-driver'/('body25-group-'+str(index).zfill(2))/'prepared.json').is_file() for index in range(1, 5)),
    'Private actual body25 production evidence is absent; synthetic guards remain active.')
class Scope(unittest.TestCase):
    def test_actual_root25_partition_authorizes_no_shared_source_reuse(self):
        specs = m.specifications()
        self.assertEqual([entry['request_count'] for entry in specs.values()], [8, 8, 8, 1])
        ids = [ident for entry in specs.values() for ident in entry['selected_ids']]
        self.assertEqual(len(set(ids)), 25)
        master = m.read(m.REVIEW_PATH)
        self.assertTrue(master['no_shared_take_reuse_approved'])
        self.assertEqual(master['source_case_count'], 25)

    def test_foreign_body31_family_is_refused(self):
        with self.assertRaises(m.retake.SafeError): m.group(m.RUN/'retake-driver'/'body32-group-01')

    def test_changed_provider_helper_or_independent_prepared_evidence_is_refused(self):
        with patch.object(m, 'PROVIDER_HELPER_SHA', 'f'*64), self.assertRaises(m.retake.SafeError): m.specifications()
        with patch.object(m, 'PREPARED_REVIEW_SHA', 'f'*64), self.assertRaises(m.retake.SafeError): m.specifications()

    def test_frozen_module_globals_and_source_files_are_not_changed_by_group_binding(self):
        before = (list(frozen.EXPECTED_IDS), frozen.EXPECTED_INPUT_SHA, frozen.VERSION,
                  m.digest(m.BASE_PATH), m.digest(m.ROOT/'scripts/part2_voice_retake_qualify_test.py'))
        m.group(next(iter(m.specifications())))
        self.assertIsNot(m.q, frozen)
        self.assertEqual(before, (list(frozen.EXPECTED_IDS), frozen.EXPECTED_INPUT_SHA, frozen.VERSION,
                                  m.digest(m.BASE_PATH), m.digest(m.ROOT/'scripts/part2_voice_retake_qualify_test.py')))

    def test_outside_group_and_group_symlink_are_rejected(self):
        with self.assertRaises(m.retake.SafeError): m.group(m.RUN/'retake-driver'/'body25-group-05')
        with tempfile.TemporaryDirectory() as temp:
            link = Path(temp)/'link'; link.symlink_to(next(iter(m.specifications())))
            with self.assertRaises(m.retake.SafeError): m.group(link)

    def test_changed_root_review_is_refused_before_any_transport_or_model(self):
        with patch.object(m, 'REVIEW_SHA', 'f'*64), self.assertRaises(m.retake.SafeError): m.specifications()

    def test_per_request_byte_hashes_are_recomputed_not_only_key_counted(self):
        original = m.read
        def mutate(path):
            value = original(path)
            if str(path).endswith('parent-snapshot.private.json'):
                value['new_request_sha256'][next(iter(value['new_request_sha256']))] = 'f'*64
            return value
        with patch.object(m, 'read', side_effect=mutate), self.assertRaises(m.retake.SafeError): m.specifications()


class Guards(unittest.TestCase):
    preview = oldtests.Fixture.preview
    approve_styles = oldtests.Fixture.approve_styles
    freeze = oldtests.Fixture.freeze
    response = oldtests.Fixture.response
    retained = oldtests.Fixture.retained
    def fake_normalize(self, source, target):
        result = oldtests.Fixture.fake_normalize(self, source, target)
        target.write_bytes(target.read_bytes()+target.stem.encode())
        return result

    def setUp(self):
        oldtests.Fixture.setUp(self)
        self.info = m.read(self.run/'prepared.json')
        self.scope_patch = patch.object(m, 'specifications', return_value={str(self.run): self.info})
        self.scope_patch.start(); m.group(self.run)
        self.helper_patch = patch.object(m, 'helpers', return_value={'fixture': 'synthetic-only-no-private-production-evidence'})
        self.helper_patch.start()
        self.model.update(decoders={name: {**contract, 'sha256': 'fixture-decoder-only'} for name, contract in m.DECODER_FORMATS.items()})

    def tearDown(self):
        self.helper_patch.stop(); self.scope_patch.stop(); oldtests.Fixture.tearDown(self)

    def test_actual_collected_lineage_current_source_cast_and_audio(self):
        before = m.retake.protected_parent(self.parent)
        info, rows = m.collected(self.run)
        self.assertEqual(info['selected_ids'], self.ids); self.assertEqual(set(rows), set(self.ids))
        self.assertEqual(m.retake.protected_parent(self.parent), before)

    def test_nonterminal_transport_refuses_before_model_or_run_intent(self):
        m.retake.core.save(self.run/'job.json', {'state': 'SUBMITTED', 'request_count': 3, 'model': m.retake.MODEL})
        with patch.object(m.q, 'model_identity') as model, self.assertRaises(m.retake.SafeError): m.execute(self.run, 'qa', Path('/fake'))
        model.assert_not_called(); self.assertFalse((self.run/'qualification-qa.intent.private.json').exists())

    def test_current_source_or_provider_truncation_refuses_before_model(self):
        source = self.root/next(iter(self.manifest['source_hashes']))
        source.write_text('Changed current authored Source')
        with patch.object(m.q, 'model_identity') as model, self.assertRaises(m.retake.SafeError): m.execute(self.run, 'qa', Path('/fake'))
        model.assert_not_called()

    def test_truncated_actual_response_never_becomes_completed_child(self):
        rows = self.response(); rows[0]['response']['candidates'][0]['finishReason'] = 'MAX_TOKENS'; self.retained(rows)
        m.retake.core.save(self.run/'collect-intent.private.json', {'state': 'COLLECTED_ONCE', 'expected': 3, 'collected': 3,
            'held_failures': 0, 'response_sha256': m.digest(self.run/'responses.private.jsonl')})
        with self.assertRaises(m.retake.SafeError): m.collected(self.run)

    def test_prior_cache_and_attempt_intent_block_repeat(self):
        m.q.fresh(self.run, 'qa'); m.q.fresh(self.run, 'align')
        m.retake.core.save(self.run/'qa-asr-cache.private.json', {'old': True})
        with self.assertRaises(m.retake.SafeError): m.q.fresh(self.run, 'qa')
        m.retake.core.save(self.run/'qualification-align.intent.private.json', {'state': 'UNKNOWN'})
        with self.assertRaises(m.retake.SafeError): m.q.fresh(self.run, 'align')

    def test_only_current_operation_direct_stdout_log_may_grow(self):
        active = self.run/'align-actual-producer.private.log'; active.write_text('')
        historical = self.run/'qa-actual-producer.private.log'; historical.write_text('Actual earlier progress')
        before = m.q.baseline(self.run, m.q.monitoring_log(self.run, 'align', active))
        active.write_text('Actual current progress'); m.q.unchanged(self.run, before)
        historical.write_text('Changed historical evidence')
        with self.assertRaises(m.retake.SafeError): m.q.unchanged(self.run, before)
        with self.assertRaises(m.retake.SafeError): m.q.monitoring_log(self.run, 'qa', active)
        with self.assertRaises(m.retake.SafeError): m.q.monitoring_log(self.run, 'qa', self.run/'responses.private.jsonl')

    def test_same_actual_mp3_cannot_qualify_different_request_ids(self):
        (self.run/'clips'/(self.ids[1]+'.mp3')).write_bytes((self.run/'clips'/(self.ids[0]+'.mp3')).read_bytes())
        with self.assertRaises(m.retake.SafeError): m.no_duplicate_audio(self.run)

    @contextmanager
    def calls(self, response=None, dims=None, callback=None):
        whisper, numpy = ModuleType('mlx_whisper'), ModuleType('numpy')
        waveform = SimpleNamespace(ndim=1, dtype='float32', tobytes=lambda: b'actual-fixture-float32-audio')
        class Audio:
            ndim = 1; dtype = 'float32'
            def __len__(self): return 3
            def tobytes(self): return waveform.tobytes()
        array = Audio(); numpy.float32 = 'float32'; numpy.asarray = Mock(return_value=array)
        numpy.isfinite = lambda _value: SimpleNamespace(all=lambda: True)
        holder = SimpleNamespace(model_path=self.model['local_directory'], model=SimpleNamespace(dims=SimpleNamespace(**(dims or m.q.DIMENSIONS))))
        audio = SimpleNamespace(load_audio=Mock(return_value=object()))
        calls = []
        def actual(value, **kwargs):
            calls.append((value, kwargs))
            if callback: callback(holder)
            return response if response is not None else {'text': 'Actual fixture words.', 'segments': []}
        whisper.transcribe = actual
        def module(name):
            return audio if name == 'mlx_whisper.audio' else SimpleNamespace(ModelHolder=holder)
        evidence = {'model': self.model}
        with patch.dict('sys.modules', {'mlx_whisper': whisper, 'numpy': numpy}), patch.object(m.importlib, 'import_module', side_effect=module), \
             patch.object(m, 'imported_runtime', return_value={'fixture': 'synthetic only'}), patch.object(m, 'loader_guard'), \
             m.capture_actual(self.run, 'qa', evidence):
            yield whisper, array, calls, evidence
        self.assertIs(whisper.transcribe, actual)

    def call_args(self):
        return {'path_or_hf_repo': self.model['local_directory'], 'language': 'de', 'condition_on_previous_text': False, 'temperature': 0.0}

    def test_actual_decoder_waveform_only_and_complete_raw_precedes_diagnosis(self):
        with self.calls() as (whisper, array, calls, evidence):
            answer = whisper.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **self.call_args())
            self.assertIs(calls[0][0], array); self.assertNotIsInstance(calls[0][0], (str, Path))
            self.assertEqual(calls[0][1], self.call_args()); self.assertEqual(evidence['actual_source_free_ids'], [self.ids[0]])
        raw = m.read(self.run/'asr-raw'/(self.ids[0]+'.private.json'))
        self.assertEqual(raw['actual_response'], answer); self.assertTrue(raw['source_free'])
        self.assertTrue(raw['raw_saved_before_diagnosis']); self.assertEqual(raw['actual_audio_input']['input_kind'], 'actual_decoded_waveform_array_only')
        self.assertEqual(raw['actual_audio_input']['decoder']['codec'], 'pcm_s16le')
        self.assertFalse(evidence['source32_reuse_approved']); self.assertFalse(evidence['logge_reuse_approved']); self.assertFalse(evidence['shared_take_reuse_approved'])

    def test_source_prompt_or_source_path_never_reaches_recognizer(self):
        with self.calls() as (whisper, _array, calls, _evidence):
            with self.assertRaises(m.retake.SafeError): whisper.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **{**self.call_args(), 'initial_prompt': 'authored words'})
            with self.assertRaises(m.retake.SafeError): whisper.transcribe(str(self.run/'lines.private.json'), **self.call_args())
            self.assertEqual(calls, []); self.assertFalse((self.run/'asr-raw').exists())

    def test_actual_bad_dimensions_response_is_retained_before_rejection(self):
        with self.calls(dims={**m.q.DIMENSIONS, 'n_text_layer': 32}) as (whisper, _array, calls, evidence):
            with self.assertRaises(m.retake.SafeError): whisper.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **self.call_args())
            self.assertEqual(len(calls), 1); self.assertTrue(evidence['runtime_guard_failed'])
        raw = m.read(self.run/'asr-raw'/(self.ids[0]+'.private.json'))
        self.assertEqual(raw['actual_runtime']['dimensions']['n_text_layer'], 32)
        self.assertEqual(raw['actual_response']['text'], 'Actual fixture words.')

    def test_actual_nonfinite_raw_is_retained_and_blocks_future_call(self):
        with self.calls(response={'text': 'Actual fixture words.', 'segments': [{'avg_logprob': float('nan')}]}) as (whisper, _array, calls, evidence):
            with self.assertRaises(m.retake.SafeError): whisper.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **self.call_args())
            with self.assertRaises(m.retake.SafeError): whisper.transcribe(str(self.run/'clips'/(self.ids[1]+'.mp3')), **self.call_args())
            self.assertEqual(len(calls), 1); self.assertTrue(evidence['runtime_guard_failed'])
        self.assertIn('NaN', (self.run/'asr-raw'/(self.ids[0]+'.private.json')).read_text())

    def test_actual_exception_retained_and_intent_prevents_second_call(self):
        def fail(_holder): raise ValueError('Synthetic actual-call failure')
        with self.calls(callback=fail) as (whisper, _array, calls, _evidence):
            with self.assertRaises(ValueError): whisper.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **self.call_args())
            with self.assertRaises(m.retake.SafeError): whisper.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **self.call_args())
            self.assertEqual(len(calls), 1)
        raw = m.read(self.run/'asr-raw'/(self.ids[0]+'.private.json'))
        self.assertEqual(raw['state'], 'ACTUAL_CALL_FAILED'); self.assertEqual(raw['exception_type'], 'ValueError')

    def test_changed_audio_after_call_keeps_whole_raw_response(self):
        def alter(_holder): (self.run/'clips'/(self.ids[0]+'.mp3')).write_bytes(b'Changed during actual call')
        with self.calls(callback=alter) as (whisper, _array, _calls, _evidence):
            with self.assertRaises(m.retake.SafeError): whisper.transcribe(str(self.run/'clips'/(self.ids[0]+'.mp3')), **self.call_args())
        self.assertEqual(m.read(self.run/'asr-raw'/(self.ids[0]+'.private.json'))['actual_response']['text'], 'Actual fixture words.')

    def test_fresh_process_guard_applies_to_qa_and_alignment(self):
        for command in ['qa', 'align']:
            holder = SimpleNamespace(model=object(), model_path='/loaded')
            with patch.object(m.importlib, 'import_module', return_value=SimpleNamespace(ModelHolder=holder)), \
                 patch.object(m, '_local') as local, self.assertRaises(m.retake.SafeError):
                with m.local_only_runtime(command): pass
            local.assert_not_called()

    def test_existing_local_runtime_refuses_download_and_restores_ram_aliases(self):
        original_hub, original_loader = Mock(), Mock()
        hub = SimpleNamespace(snapshot_download=original_hub)
        loader = SimpleNamespace(snapshot_download=original_loader)
        holder = SimpleNamespace(model=None, model_path=None)
        modules = {'huggingface_hub': hub, 'mlx_whisper.load_models': loader,
                   'mlx_whisper.transcribe': SimpleNamespace(ModelHolder=holder)}
        for command in ['qa', 'align']:
            with patch.object(m.importlib, 'import_module', side_effect=lambda name: modules[name]):
                with m.local_only_runtime(command):
                    with self.assertRaises(m.retake.SafeError): hub.snapshot_download('remote-model')
                    with self.assertRaises(m.retake.SafeError): loader.snapshot_download('remote-model')
                self.assertIs(hub.snapshot_download, original_hub); self.assertIs(loader.snapshot_download, original_loader)
        original_hub.assert_not_called(); original_loader.assert_not_called()

    def test_review_required_is_valid_completed_cli_exit2(self):
        args = ['body25', 'qa', '--run-dir', str(self.run), '--model-dir', '/existing']
        with patch('sys.argv', args), patch.object(m, 'execute', return_value={'status': 'review_required'}), \
             patch.object(m.q.common, 'run_lock', return_value=SimpleNamespace(close=lambda: None)), redirect_stdout(io.StringIO()) as out:
            self.assertEqual(m.main(), 2)
        self.assertEqual(json.loads(out.getvalue())['status'], 'review_required')

    def fake_completed(self, command, missing_input=False, missing_raw_pin=False, changed_raw=False):
        def execute(run, _command, _model, _workers, progress_log):
            before = m.q.baseline(run, progress_log)
            if missing_input: before.pop('responses.private.jsonl')
            if command == 'qa':
                names = ['qa.private.json', 'qa-asr-cache.private.json'] + [folder+'/'+ident+'.private.json'
                    for ident in self.ids for folder in ['asr-raw', 'local-asr-intents']]
            else:
                names = ['word-cues/alignment.private.json'] + ['word-cues/'+ident+'.json' for ident in self.ids]
                names += [folder+'/'+ident+'.private.json' for ident in self.ids for folder in ['alignment-raw', 'local-alignment-intents']]
            for name in names: m.retake.save_once(run/name, {'fixture': 'not real model evidence'})
            outputs = {name: m.digest(run/name) for name in names}
            if missing_raw_pin: outputs.pop(names[-1])
            m.retake.save_once(run/('qualification-'+command+'.intent.private.json'), {'fixture': 'only virtual call intent'})
            m.retake.save_once(run/('qualification-'+command+'.producer.private.json'), {
                'version': m.VERSION, 'state': 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT', 'pre_existing_child_sha256': before,
                'created_outputs_sha256': outputs, 'actual_model_call_ids': self.ids,
                'report_sha256': m.digest(run/names[0])})
            if changed_raw: (run/names[-1]).write_text('Changed after the virtual producer completed')
            return {'status': 'review_required'}
        return execute

    def test_immutable_completion_binds_whole_original_inputs_and_all_actual_qa_outputs(self):
        with patch.object(m.q, 'execute', side_effect=self.fake_completed('qa')):
            self.assertEqual(m.execute(self.run, 'qa', Path('/virtual-existing'))['status'], 'review_required')
        proof = m.read(self.run/'body25-qa-completed.private.json')
        self.assertEqual(len(proof['complete_original_outputs_sha256']), 2*len(self.ids)+2)
        self.assertIn('responses.private.jsonl', proof['complete_original_inputs_sha256'])
        self.assertEqual(proof['operation_intent_sha256'], m.digest(self.run/'qualification-qa.intent.private.json'))
        self.assertFalse(proof['source32_reuse_approved']); self.assertFalse(proof['logge_reuse_approved']); self.assertFalse(proof['shared_take_reuse_approved']); self.assertFalse(proof['word_time_or_human_adoption'])

    def test_immutable_completion_binds_whole_actual_authored_timing_outputs(self):
        with patch.object(m.q, 'execute', side_effect=self.fake_completed('align')):
            m.execute(self.run, 'align', Path('/virtual-existing'))
        proof = m.read(self.run/'body25-align-completed.private.json')
        self.assertEqual(len(proof['complete_original_outputs_sha256']), 3*len(self.ids)+1)

    def test_omitted_original_input_is_not_replaced_by_fresh_current_baseline(self):
        with patch.object(m.q, 'execute', side_effect=self.fake_completed('qa', missing_input=True)), self.assertRaises(m.retake.SafeError):
            m.execute(self.run, 'qa', Path('/virtual-existing'))
        self.assertFalse((self.run/'body25-qa-completed.private.json').exists())

    def test_omitted_original_raw_pin_is_not_replaced_by_fresh_current_file(self):
        with patch.object(m.q, 'execute', side_effect=self.fake_completed('qa', missing_raw_pin=True)), self.assertRaises(m.retake.SafeError):
            m.execute(self.run, 'qa', Path('/virtual-existing'))
        self.assertFalse((self.run/'body25-qa-completed.private.json').exists())

    def test_mutated_actual_output_prevents_immutable_completion(self):
        with patch.object(m.q, 'execute', side_effect=self.fake_completed('qa', changed_raw=True)), self.assertRaises(m.retake.SafeError):
            m.execute(self.run, 'qa', Path('/virtual-existing'))
        self.assertFalse((self.run/'body25-qa-completed.private.json').exists())


class ModelBoundaries(unittest.TestCase):
    def test_actual_forced_decoder_uses_f32le_not_qa_s16_conversion(self):
        numpy = ModuleType('numpy'); observed = {}
        class Audio:
            def __len__(self): return 3
        audio = Audio()
        def frombuffer(value, dtype):
            observed.update(stdout=value, dtype=dtype)
            return SimpleNamespace(copy=lambda: audio)
        numpy.frombuffer = frombuffer; numpy.isfinite = lambda _value: SimpleNamespace(all=lambda: True)
        with patch.dict('sys.modules', {'numpy': numpy}), patch.object(m.q.cues.acoustic.subprocess, 'run', return_value=SimpleNamespace(stdout=b'actual-f32-fixture')) as decoder:
            self.assertIs(m.q.cues.acoustic.decode(Path('/opaque-actual-fixture.mp3')), audio)
        command = decoder.call_args[0][0]
        self.assertEqual(command[command.index('-f')+1], m.DECODER_FORMATS['align']['format'])
        self.assertEqual(observed['dtype'], '<f4')
        self.assertNotEqual(m.DECODER_FORMATS['align']['format'], m.DECODER_FORMATS['qa']['format'])
        self.assertNotIn('32768', m.DECODER_FORMATS['align']['pcm_to_float_conversion'])

    def test_model_identity_declares_both_actual_decoders_and_rejects_wrong_format(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp); (directory/'config.json').write_text('{}'); (directory/'weights.npz').write_bytes(b'offline synthetic weights only')
            value = {'local_directory': str(directory), 'config_sha256': m.digest(directory/'config.json'), 'weights': {'weights.npz': m.digest(directory/'weights.npz')}}
            with patch.object(m, 'MODEL', directory), patch.object(m, '_model_identity', return_value=value), patch.object(m, 'runtime_files', return_value={}):
                model = m.model_identity(directory)
            self.assertEqual(set(model['decoders']), {'qa', 'align'}); m.loader_guard(model)
            model['decoders']['align']['format'] = 's16le'
            with self.assertRaises(m.retake.SafeError): m.loader_guard(model)

    def test_actual_import_origin_must_belong_to_pinned_runtime_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'unknown.py'; path.write_text('offline fixture only')
            with patch.object(m.importlib, 'import_module', return_value=SimpleNamespace(__file__=str(path))), self.assertRaises(m.retake.SafeError):
                m.imported_runtime({'runtime_files_sha256': {}})

    def test_unknown_runtime_receipt_is_observed_without_discarding_response(self):
        class Broken:
            @property
            def model_path(self): raise RuntimeError('Synthetic holder property failure')
        value = m.observed_holder(Broken())
        self.assertIsNone(value['model_path']); self.assertEqual(value['runtime_receipt_error'], 'RuntimeError')

    def test_model_directory_rejects_network_name_or_other_existing_model(self):
        with self.assertRaises(m.retake.SafeError): m.model_identity('mlx-community/whisper-large-v3-turbo')
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(m.retake.SafeError): m.model_identity(Path(temp))


if __name__ == '__main__': unittest.main()
