"""Synthetic supplemental guards only. No fixture is audio/model/listening evidence."""
from array import array
import ast
import copy
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import wave
import part2_voice_batch as b
import part2_voice_evidence_publish as e
import part2_voice_publish_test as initial_tests


class EvidencePublication(initial_tests.Publication):
    def setUp(self):
        super().setUp()
        self.args = SimpleNamespace(qa_report=self.run/'qa.private.json', alignment_report=self.run/'alignment.private.json',
                                    qa_producer=self.run/'qa.producer.private.json', alignment_producer=self.run/'align.producer.private.json')
        for path, value in [(self.args.qa_report, self.qa), (self.args.alignment_report, self.alignment),
                            (self.args.qa_producer, {'synthetic_unit_only': True}), (self.args.alignment_producer, {'synthetic_unit_only': True}),
                            (self.run/'prepared.json', {'synthetic_unit_only': True}), (self.run/'profiles.private.json', self.profiles)]:
            b.core.save(path, value)
        (self.run/'requests.jsonl').write_bytes(b'SYNTHETIC UNIT REQUEST, NOT A PROVIDER CALL')
        self.raw = {'id': self.ident, 'audio_sha256': self.audio_hash, 'source_free': True, 'raw_saved_before_diagnosis': True,
                    'actual_call_args': copy.deepcopy(e.CALL_ARGS),
                    'actual_runtime': {'model_path': str(e.FULL_MODEL.resolve()), 'dimensions': copy.deepcopy(e.FULL_DIMENSIONS)},
                    'actual_response': {'text': 'Weiter.', 'segments': [{'text': 'Weiter.', 'tokens': [101, 102],
                        'start': .1, 'end': .8, 'no_speech_prob': .001, 'avg_logprob': -.1, 'compression_ratio': 1.1,
                        'words': [{'word': ' Weiter.', 'start': .123456, 'end': .765432, 'probability': .95}]}]}}

    def case(self, word=None, timing=None):
        return {'version': e.VERSION, 'status': 'approved_part2_case_evidence', 'reviewed_by': 'root',
                'actual_whole_source_and_counterevidence_reviewed': True, 'human_listening_or_acting_approval': False,
                'binding': e.case_binding(self.args, self.run, self.row), 'retained_initial_take': copy.deepcopy(self.take),
                'retained_initial_timing_flags': copy.deepcopy(self.temporal['all_qualification_flags']), 'word': word, 'timing': timing}

    def supplemental_clip(self, case):
        return e.evidence_clip(self.row, self.run, self.profiles, self.qa, self.alignment, self.take, case,
                               self.args, {}, {self.ident: self.raw}, decode_fn=lambda _: self.signal)

    def literal(self, raw=None):
        return e.complete_literal_response(raw or self.raw, self.row, self.audio_hash, self.signal['seconds'])

    def test_complete_actual_source_free_literal_body_is_preserved(self):
        before = copy.deepcopy(self.raw)
        words = self.literal()
        self.assertEqual(words, self.raw['actual_response']['segments'][0]['words'])
        self.assertEqual(before, self.raw)

    def test_missing_or_incomplete_raw_never_qualifies(self):
        for field in ['actual_response', 'actual_runtime', 'actual_call_args', 'raw_saved_before_diagnosis']:
            raw = copy.deepcopy(self.raw); del raw[field]
            with self.subTest(field=field), self.assertRaises(b.SafeError): self.literal(raw)

    def test_wrong_model_or_mislabeled_turbo_refused(self):
        for field, value in [('n_text_layer', 4), ('n_audio_layer', 4), ('n_mels', 80)]:
            raw = copy.deepcopy(self.raw); raw['actual_runtime']['dimensions'][field] = value
            with self.subTest(field=field), self.assertRaises(b.SafeError): self.literal(raw)
        raw = copy.deepcopy(self.raw); raw['actual_runtime']['model_path'] += '-turbo'
        with self.assertRaises(b.SafeError): self.literal(raw)

    def test_source_prompt_filename_prior_context_and_non_source_free_refused(self):
        for change in ['prompt', 'previous', 'source_free', 'filename']:
            raw = copy.deepcopy(self.raw)
            if change == 'prompt': raw['actual_call_args']['initial_prompt'] = 'Weiter.'
            if change == 'previous': raw['actual_call_args']['condition_on_previous_text'] = True
            if change == 'source_free': raw['source_free'] = False
            if change == 'filename': raw['actual_call_args']['audio'] = 'chapter-source-weiter.mp3'
            with self.subTest(change=change), self.assertRaises(b.SafeError): self.literal(raw)

    def test_complete_text_cannot_hide_partial_repeated_or_contradicting_segments(self):
        for change in ['missing', 'partial', 'repeated', 'words']:
            raw = copy.deepcopy(self.raw); segment = raw['actual_response']['segments'][0]
            if change == 'missing': raw['actual_response']['segments'] = []
            if change == 'partial': segment['text'] = ''
            if change == 'repeated': segment['text'] = 'Weiter. Weiter.'
            if change == 'words': segment['words'][0]['word'] = 'Fremd.'
            with self.subTest(change=change), self.assertRaises(b.SafeError): self.literal(raw)

    def test_no_name_vowel_contraction_or_inflection_exceptions(self):
        for expected, observed in [('Foltan.', 'Voltan.'), ('Kyra.', 'Kira.'), ('Hab’s!', 'Haps!'), ('Komme.', 'Komm.')]:
            row, raw = {**self.row, 'text': expected}, copy.deepcopy(self.raw)
            raw['actual_response']['text'] = observed
            raw['actual_response']['segments'][0]['text'] = observed
            raw['actual_response']['segments'][0]['words'][0]['word'] = observed
            with self.subTest(expected=expected), self.assertRaises(b.SafeError): e.complete_literal_response(raw, row, self.audio_hash, 1)

    def test_actual_uncertainty_or_repetition_metrics_refused(self):
        for field, value in [('no_speech_prob', .8), ('avg_logprob', -1.1), ('compression_ratio', 2.5), ('avg_logprob', float('nan'))]:
            raw = copy.deepcopy(self.raw); raw['actual_response']['segments'][0][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(b.SafeError): self.literal(raw)

    def test_real_full_word_intervals_are_copied_without_rounding_or_interpolation(self):
        flag = {'word_index': 0, 'word': 'Weiter.', 'reasons': ['collapsed_acoustic_interval']}
        decisions = [{'flag': flag, 'decision': 'approve_actual_full_large_word_intervals', 'review_note': 'Synthetic guard review.'}]
        cues = e.model_timing(self.row, self.raw, self.audio_hash, 1, [flag], decisions)
        self.assertEqual(cues, [{'start': .123456, 'end': .765432}])

    def test_new_model_timing_refuses_collapsed_long_missing_or_low_actual_intervals(self):
        for change in ['collapse', 'long', 'missing', 'probability']:
            raw = copy.deepcopy(self.raw); word = raw['actual_response']['segments'][0]['words'][0]
            if change == 'collapse': word['end'] = word['start']
            if change == 'long': word['start'] = 0; word['end'] = 1.6
            if change == 'missing': del word['end']
            if change == 'probability': word['probability'] = .001
            with self.subTest(change=change), self.assertRaises(b.SafeError): e.model_timing(self.row, raw, self.audio_hash, 2, [], [])

    def test_real_word_timestamps_cannot_invent_a_visual_punctuation_cue(self):
        row = {**self.row, 'text': 'Weiter. …'}
        with self.assertRaises(b.SafeError): e.model_timing(row, self.raw, self.audio_hash, 1, [], [])

    def test_exact_root_case_and_original_failures_remain_unchanged(self):
        before = copy.deepcopy((self.qa, self.alignment, self.temporal, self.take))
        clip, path = self.supplemental_clip(self.case())
        self.assertEqual(clip['word_cues'], self.cues); self.assertEqual(path, self.path)
        self.assertEqual(before, (self.qa, self.alignment, self.temporal, self.take))

    def test_missing_fake_or_stale_root_case_refused(self):
        for change in ['status', 'root', 'source', 'audio', 'initial_failure', 'hearing']:
            case = self.case()
            if change == 'status': case['status'] = 'UNAPPROVED'
            if change == 'root': case['reviewed_by'] = 'worker'
            if change == 'source': case['binding']['source_row']['text'] = 'Fremd.'
            if change == 'audio': case['binding']['files_sha256'][str(self.path)] = '0'*64
            if change == 'initial_failure': case['retained_initial_take']['transcript'] = 'Fake.'
            if change == 'hearing': case['human_listening_or_acting_approval'] = True
            with self.subTest(change=change), self.assertRaises(b.SafeError): self.supplemental_clip(case)

    def test_primary_failure_requires_actual_secondary_and_root_review(self):
        self.take.update(reasons=['asr_lexical_mismatch_requires_review'], transcript='Fremd.', word_error_rate=1)
        with self.assertRaises(b.SafeError): self.supplemental_clip(self.case())
        word = {'mode': 'literal_source_free_full_large', 'review_note': 'Synthetic guard review.'}
        with self.assertRaises(b.SafeError): self.supplemental_clip(self.case(word=word))
        with patch.object(e, 'case_secondary', return_value=self.raw):
            clip, _ = self.supplemental_clip(self.case(word=word))
        self.assertEqual(clip['text'], 'Weiter.'); self.assertEqual(self.take['transcript'], 'Fremd.')
        self.assertEqual(self.take['reasons'], ['asr_lexical_mismatch_requires_review'])

    def test_signal_failure_cannot_be_overridden_by_literal_secondary(self):
        self.take['reasons'] = ['possible_abrupt_audio_end']
        word = {'mode': 'literal_source_free_full_large', 'review_note': 'Synthetic guard review.'}
        with self.assertRaises(b.SafeError): self.supplemental_clip(self.case(word=word))

    def test_current_receipt_request_and_audio_must_be_exact(self):
        self.receipt['request_sha256'] = '0'*64; self.write_receipts()
        with self.assertRaises(b.SafeError): self.supplemental_clip(self.case())

    def timing_fixture(self, old_long=False):
        flag = {'word_index': 0, 'word': 'Weiter.', 'reasons': ['long_acoustic_interval' if old_long else 'low_authored_token_probability']}
        duration = 3 if old_long else 1
        cue = {'start': .9, 'end': 1.4} if old_long else {'start': .1, 'end': .8}
        raw = {'start': 0., 'end': 2.} if old_long else dict(cue)
        tokens = [{'text': ' Weiter', 'char_start': 0, 'char_end': 7, 'start': raw['start'], 'end': .7 if not old_long else 1.4, 'probability': .95},
                  {'text': '.', 'char_start': 7, 'char_end': 8, 'start': .7 if not old_long else 1.4, 'end': raw['end'], 'probability': .8 if old_long else .001}]
        temporal = {**copy.deepcopy(self.temporal), 'word_cues': [cue], 'raw_word_cues': [raw], 'token_alignment': tokens,
                    'original_qualification_flags': [flag], 'qualification_flags': [] if old_long else [flag], 'all_qualification_flags': [flag],
                    'refinement': {'version': 2, 'rms_threshold': .003},
                    'cues_sha256': e.base.cue_engine.acoustic.cue_sha([cue]),
                    'words': [{'word': 'Weiter.', 'spoken': True, 'minimum_token_probability': min(t['probability'] for t in tokens)}]}
        samples = array('f', [.05] * (duration*16000)); decoded = samples.tobytes()
        wav = self.run/'raw'/(self.ident+'.wav')
        pcm = array('h', [1638]*(duration*24000)).tobytes()
        with wave.open(str(wav), 'wb') as stream:
            stream.setnchannels(1); stream.setsampwidth(2); stream.setframerate(24000); stream.writeframes(pcm)
        wav_samples = array('f', [1638/32768]*(duration*24000))
        rms, threshold = e.rms_frames(samples, 16000); wav_rms, wav_threshold = e.rms_frames(wav_samples, 24000)
        evidence = {'word_index': 0, 'source_word': 'Weiter.', 'source_char_span': [0, 7], 'actual_authored_dtw_tokens': [
            {**token, 'token_class': 'lexical_or_mixed' if index == 0 else 'actual_punctuation_only'} for index, token in enumerate(tokens)],
            'raw_interval': raw, 'current_refined_interval': cue, 'remaining_exact_risks': []}
        intervals = {'mp3_decoded_current_activity': (cue['start'], cue['end']), 'mp3_decoded_raw_activity': (raw['start'], raw['end']),
                     'mp3_decoded_discarded_leading': (raw['start'], max(raw['start'], cue['start'])),
                     'mp3_decoded_discarded_trailing': (min(cue['end'], raw['end']), raw['end'])}
        evidence.update({name: e.activity_window(rms, start, end, threshold) for name, (start, end) in intervals.items()})
        evidence['original_provider_wav_current_activity'] = e.activity_window(wav_rms, cue['start'], cue['end'], wav_threshold)
        review = {'id': self.ident, 'text': self.row['text'], 'text_sha256': self.text_hash,
                  'source_manifest_sha256': temporal['source_manifest_sha256'], 'current_clip_sha256': self.audio_hash,
                  'provider_wav_sha256': e.digest(wav), 'current_cues_sha256': temporal['cues_sha256'],
                  'all_qualification_flags': [flag], 'original_qualification_flags': [flag], 'current_refined_flags': temporal['qualification_flags'],
                  'status': 'offline_exact_evidence_unapproved', 'no_cues_changed': True, 'automatic_approval': False,
                  'human_listening_or_acting_approval': False, 'whole_current_cue_validity_problems': [], 'flagged_words': [evidence],
                  'waveforms': {'actual_mp3_decode': {'pcm_sha256': b.sha(decoded), 'samples': len(samples), 'sample_rate': 16000, 'dtype': 'little_endian_float32'},
                                'provider_original': {'pcm_sha256': b.sha(pcm)}}}
        decision = {'flag': flag, 'decision': 'approve_unchanged_initial_refined_interval',
                    'proof_sha256': e.object_sha(evidence), 'review_note': 'Synthetic exact flag guard.'}
        return temporal, review, [decision], samples, decoded, wav

    def unchanged(self, fixture):
        temporal, review, decisions, samples, pcm, wav = fixture
        with patch.object(e, 'waveform_samples', return_value=(samples, pcm)):
            return e.unchanged_timing(self.row, temporal, review, decisions, self.path, wav)

    def test_exact_punctuation_piece_low_probability_keeps_whole_lexical_source_and_current_cue(self):
        fixture = self.timing_fixture(); before = copy.deepcopy(fixture[:3])
        self.assertEqual(self.unchanged(fixture), fixture[0]['word_cues'])
        self.assertEqual(fixture[:3], before)

    def test_fake_waveform_measurement_missing_flag_or_wrong_root_scope_refused(self):
        for change in ['wave', 'missing', 'scope', 'empty_note']:
            fixture = self.timing_fixture(); temporal, review, decisions, *_ = fixture
            if change == 'wave': review['flagged_words'][0]['mp3_decoded_current_activity']['active_frames'] = 0
            if change == 'missing': decisions.clear()
            if change == 'scope': decisions[0]['proof_sha256'] = '0'*64
            if change == 'empty_note': decisions[0]['review_note'] = ''
            with self.subTest(change=change), self.assertRaises(b.SafeError): self.unchanged(fixture)

    def test_lexical_low_probability_cannot_be_called_punctuation(self):
        fixture = self.timing_fixture(); temporal, review, decisions, *_ = fixture
        temporal['token_alignment'][0]['probability'] = .001
        review['flagged_words'][0]['actual_authored_dtw_tokens'][0]['probability'] = .001
        decisions[0]['proof_sha256'] = e.object_sha(review['flagged_words'][0])
        with self.assertRaises(b.SafeError): self.unchanged(fixture)

    def test_old_raw_long_flag_retains_actual_discarded_activity_until_scoped_root_review(self):
        fixture = self.timing_fixture(old_long=True)
        with self.assertRaises(b.SafeError): self.unchanged(fixture)
        evidence = fixture[1]['flagged_words'][0]
        fixture[2][0]['discarded_active_regions_review'] = {'regions': {
            'leading': evidence['mp3_decoded_discarded_leading']['active_intervals'],
            'trailing': evidence['mp3_decoded_discarded_trailing']['active_intervals']}, 'review_note': 'Synthetic scoped retained contradiction guard.'}
        self.assertEqual(self.unchanged(fixture), fixture[0]['word_cues'])

    def test_current_long_or_collapsed_cannot_pass_old_raw_long_mode(self):
        for end in [.9, 2.6]:
            fixture = self.timing_fixture(old_long=True)
            fixture[0]['word_cues'][0]['end'] = end
            fixture[1]['flagged_words'][0]['current_refined_interval']['end'] = end
            fixture[2][0]['proof_sha256'] = e.object_sha(fixture[1]['flagged_words'][0])
            with self.subTest(end=end), self.assertRaises(b.SafeError): self.unchanged(fixture)

    def test_private_evidence_path_hash_symlink_and_foreign_bytes_guards(self):
        path = (self.run/'unit-proof.private.json').resolve(); b.core.save(path, {'unit': True})
        bound = {}; self.assertEqual(e.bound_ref(self.run, {'path': str(path), 'sha256': e.digest(path)}, bound), {'unit': True})
        with self.assertRaises(b.SafeError): e.bound_ref(self.run, {'path': str(path), 'sha256': '0'*64}, {})
        alias = self.run/'symlink.private.json'; alias.symlink_to(path)
        with self.assertRaises(b.SafeError): e.private_file(self.run, alias)
        with self.assertRaises(b.SafeError): e.private_file(self.run, self.root/'foreign.json')

    def authored_fixture(self):
        run = self.run.resolve()
        raw_path = run/'full-large-timing20/raw'/(self.ident+'.private.json')
        candidate_path = run/'full-large-timing20/refined'/(self.ident+'.private.json')
        raw = {'word_fidelity_proof': False, 'source_free': False, 'teacher_forced_authored_text': True,
               'actual_authored_dtw': {'synthetic_unit_only': True}}
        b.core.save(raw_path, raw)
        candidate = {'raw_sha256': e.digest(raw_path), 'actual_refined_dtw': {
            'word_cues': [{'start': .234567, 'end': .876543}], 'all_qualification_flags': []}}
        b.core.save(candidate_path, candidate)
        flag = {'word_index': 0, 'word': 'Weiter.', 'reasons': ['collapsed_acoustic_interval']}
        original = {**copy.deepcopy(self.temporal), 'all_qualification_flags': [flag]}
        approval = {'mode': 'actual_full_large_authored_receipt', 'raw': {'path': str(raw_path), 'sha256': e.digest(raw_path)},
                    'candidate': {'path': str(candidate_path), 'sha256': e.digest(candidate_path)},
                    'flag_decisions': [{'flag': flag, 'decision': 'approve_actual_full_large_authored_timing', 'review_note': 'Synthetic Root-only new actual receipt guard.'}],
                    'retained_candidate_timing_flags': [], 'candidate_flag_decisions': [], 'candidate_offline_review': None}
        return run, original, approval, candidate

    def test_source_guided_authored_timing_is_never_source_free_word_evidence(self):
        raw = copy.deepcopy(self.raw); raw.update(source_free=False, teacher_forced_authored_text=True, word_fidelity_proof=False)
        with self.assertRaises(b.SafeError): self.literal(raw)

    def test_authored_timing_uses_saved_real_candidate_intervals_without_rounding(self):
        run, original, approval, candidate = self.authored_fixture()
        before = copy.deepcopy((original, candidate))
        cues = e.authored_timing(self.row, original, approval, candidate, run, {}, self.path, run/'raw'/(self.ident+'.wav'))
        self.assertEqual(cues, [{'start': .234567, 'end': .876543}])
        self.assertEqual(before, (original, candidate))

    def test_authored_candidate_cannot_drop_initial_or_new_flags_or_root_scope(self):
        for change in ['initial', 'new', 'case', 'candidate']:
            run, original, approval, candidate = self.authored_fixture()
            if change == 'initial': approval['flag_decisions'] = []
            if change == 'new': approval['retained_candidate_timing_flags'] = [{'word_index': 0, 'word': 'Weiter.', 'reasons': ['low_authored_token_probability']}]
            if change == 'case': approval['flag_decisions'][0]['decision'] = 'approve_words'
            if change == 'candidate': candidate['actual_refined_dtw']['word_cues'][0]['start'] = .4
            with self.subTest(change=change), self.assertRaises(b.SafeError):
                e.authored_timing(self.row, original, approval, candidate, run, {}, self.path, run/'raw'/(self.ident+'.wav'))

    def test_build_always_runs_original_whole_gates_before_any_supplement(self):
        args = SimpleNamespace(**vars(self.args), run_dir=str(self.run), selection=self.run/'initial-selection.private.json')
        initial = {'synthetic_unit_only': True}; b.core.save(args.selection, initial)
        with patch.object(e, 'FROZEN_BASE', {}), patch.object(e.base, 'build', side_effect=b.SafeError('whole real initial failure')) as original:
            with self.assertRaisesRegex(b.SafeError, 'whole real initial failure'): e.build(args, initial, {'fake_supplement': True})
            original.assert_called_once_with(args, initial)

    def test_entire_secondary_missing_root_producer_binding_is_refused_before_model_checks(self):
        folder = self.run/'free-large449'; folder.mkdir()
        for name, value in [('plan.private.json', {}), ('result.private.json', {}), ('execution-intent.private.json', {})]: b.core.save(folder/name, value)
        runner = folder/'run.private.py'; runner.write_bytes(b'# synthetic contract fixture, not an actual inference producer\n')
        with patch.object(e, 'SECONDARY_PLAN_SHA256', e.digest(folder/'plan.private.json')), patch.object(e, 'SECONDARY_RUNNER_SHA256', e.digest(runner)), patch.object(e, 'model_evidence') as model:
            with self.assertRaisesRegex(b.SafeError, 'Root must explicitly bind'): e.secondary_bundle(self.run, {}, {}, {}, None)
            model.assert_not_called()

    def test_wrong_or_unfrozen_authored_plan_is_refused_without_model_inference(self):
        folder = self.run/'full-large-timing20'; folder.mkdir()
        (folder/'plan.private.json').write_bytes(b'SYNTHETIC UNKNOWN PLAN')
        (folder/'run.private.py').write_bytes(b'# SYNTHETIC UNKNOWN RUNNER\n')
        with self.assertRaisesRegex(b.SafeError, 'Once-read private runner bytes'): e.authored_bundle(self.run, {}, {}, {}, None)

    def test_current_anonymous_waveform_binding_cannot_be_a_self_reported_hash(self):
        values = array('f', [0, .25, -.5])
        with patch.object(e, 'waveform_samples', return_value=(values, b'SYNTHETIC PCM')) as decoded:
            binding = e.actual_anonymous_waveform(self.path)
            decoded.assert_called_once_with(self.path, pcm16=True)
            self.assertEqual(binding['waveform_sha256'], b.sha(values.tobytes()))
            self.assertEqual(binding['sample_count'], 3)

    def test_frozen_authored_runner_real_import_and_producer_output_schema(self):
        # Read immutable real code only. No import, model, fake runtime or execution.
        runner = Path(e.__file__).parents[1]/'output/audio/part2-voice/2026-10-08-all/full-large-timing20/run.private.py'
        if not runner.is_file(): self.skipTest('Private actual producer is not exported with the repository.')
        self.assertEqual(e.digest(runner), e.TIMING_RUNNER_SHA256)
        execute = next(node for node in ast.parse(runner.read_text()).body if isinstance(node, ast.FunctionDef) and node.name == 'execute')
        assigns = [node for node in ast.walk(execute) if isinstance(node, ast.Assign)]
        modules = next(node.value for node in assigns if any(isinstance(target, ast.Name) and target.id == 'modules' for target in node.targets))
        dependencies = next(node.value for node in assigns if any(isinstance(target, ast.Name) and target.id == 'dependency_modules' for target in node.targets))
        imported = {node.value for node in modules.keys} | {node.value for node in dependencies.generators[0].iter.elts}
        self.assertEqual(imported, e.AUTHORED_IMPORTS)
        outputs = next(node.value for node in assigns if any(isinstance(target, ast.Name) and target.id == 'outputs' for target in node.targets))
        self.assertEqual(len(outputs.keys), 2)
        self.assertIn('execution-intent.private.json', ast.unparse(outputs))
        self.assertEqual(e.AUTHORED_PRODUCER_OUTPUTS, {'model-loaded.private.json', 'execution-intent.private.json'})

    def new_authored_receipt(self):
        return {'version': e.base.cue_engine.acoustic.VERSION, 'id': self.ident, 'text': 'Weiter.',
                'audio_sha256': self.audio_hash, 'decoded_seconds': 1., 'qualification_flags': [], 'all_qualification_flags': [],
                'word_cues': [{'start': .1, 'end': .8}],
                'words': [{'word': 'Weiter.', 'start': .1, 'end': .8, 'spoken': True, 'minimum_token_probability': .7}],
                'token_alignment': [{'text': ' Weiter', 'char_start': 0, 'char_end': 7, 'start': .1, 'end': .7, 'probability': .95},
                                    {'text': '.', 'char_start': 7, 'char_end': 8, 'start': .7, 'end': .8, 'probability': .7}]}

    def test_new_actual_authored_full_tokens_and_word_receipt_match_exactly(self):
        receipt = self.new_authored_receipt(); before = copy.deepcopy(receipt)
        e.validate_authored_time(self.row, receipt, self.audio_hash, 1.)
        self.assertEqual(before, receipt)

    def test_flagfree_claim_cannot_hide_new_nan_wrong_source_or_changed_word_details(self):
        for change in ['token_nan', 'word_nan', 'time_nan', 'word_count', 'spoken', 'probability', 'charspan', 'cue_data', 'source']:
            receipt = self.new_authored_receipt()
            if change == 'token_nan': receipt['token_alignment'][0]['probability'] = float('nan')
            if change == 'word_nan': receipt['words'][0]['minimum_token_probability'] = float('nan')
            if change == 'time_nan': receipt['token_alignment'][0]['start'] = float('nan')
            if change == 'word_count': receipt['words'].clear()
            if change == 'spoken': receipt['words'][0]['spoken'] = False
            if change == 'probability': receipt['words'][0]['minimum_token_probability'] = .99
            if change == 'charspan': receipt['token_alignment'][0]['char_end'] = 6
            if change == 'cue_data': receipt['words'][0]['start'] = .15
            if change == 'source': receipt['text'] = 'Fremd.'
            with self.subTest(change=change), self.assertRaises(b.SafeError): e.validate_authored_time(self.row, receipt, self.audio_hash, 1.)

    def timing15_raw(self):
        raw = copy.deepcopy(self.raw)
        raw.pop('raw_saved_before_diagnosis')
        raw.update(version=e.SOURCEFREE_TIMING_VERSION, teacher_forced_authored_text=False,
            raw_saved_before_post_call_guards_and_diagnosis=True, plan_sha256='1'*64, runner_sha256='2'*64,
            actual_audio_input={'synthetic_wave_input_only': True}, approval=None, automatic_adoption=False,
            human_listening_or_acting_approval=False)
        return raw

    def timing15_literal(self, raw):
        with patch.object(e, 'SOURCEFREE_TIMING_PLAN_SHA256', '1'*64), patch.object(e, 'SOURCEFREE_TIMING_RUNNER_SHA256', '2'*64):
            return e.complete_timing15_response(raw, self.row, self.audio_hash, 1.)

    def test_separate_timing15_body_uses_actual_times_and_keeps_raw_untouched(self):
        raw = self.timing15_raw(); before = copy.deepcopy(raw)
        self.assertEqual(self.timing15_literal(raw), raw['actual_response']['segments'][0]['words'])
        self.assertEqual(raw, before)
        with self.assertRaises(b.SafeError): self.literal(raw)
        with self.assertRaises(b.SafeError): self.timing15_literal(self.raw)

    def test_timing15_cannot_reuse_449_or_forced_body_headers_or_stale_frozen_runtime(self):
        for change in ['source_free', 'teacher', 'before_raw', 'plan', 'runner', 'version', 'turbo', 'prompt', 'partial', 'repeat', 'nonfinite', 'late']:
            raw = self.timing15_raw()
            if change == 'source_free': raw['source_free'] = False
            if change == 'teacher': raw['teacher_forced_authored_text'] = True
            if change == 'before_raw': del raw['raw_saved_before_post_call_guards_and_diagnosis']
            if change == 'plan': raw['plan_sha256'] = '0'*64
            if change == 'runner': raw['runner_sha256'] = '0'*64
            if change == 'version': raw['version'] = e.SECONDARY_VERSION
            if change == 'turbo': raw['actual_runtime']['dimensions']['n_text_layer'] = 4
            if change == 'prompt': raw['actual_call_args']['initial_prompt'] = 'Weiter.'
            if change == 'partial': raw['actual_response']['segments'][0]['words'].clear()
            if change == 'repeat': raw['actual_response']['segments'][0]['text'] = 'Weiter. Weiter.'
            if change == 'nonfinite': raw['actual_response']['segments'][0]['words'][0]['end'] = float('nan')
            if change == 'late': raw['actual_response']['segments'][0]['words'][0]['end'] = 1.1
            with self.subTest(change=change), self.assertRaises(b.SafeError): self.timing15_literal(raw)

    def timing15_fixture(self):
        run = self.run.resolve(); raw = self.timing15_raw()
        raw_path = run/'free-large-timing15/raw'/(self.ident+'.private.json'); b.core.save(raw_path, raw)
        initial_flag = {'word_index': 0, 'word': 'Weiter.', 'reasons': ['collapsed_acoustic_interval']}
        actual20_flag = {'word_index': 0, 'word': 'Weiter.', 'reasons': ['long_acoustic_interval']}
        initial = {**copy.deepcopy(self.temporal), 'all_qualification_flags': [initial_flag]}
        authored = {self.ident: {'actual_refined_dtw': {'all_qualification_flags': [actual20_flag]}}}
        approval = {'mode': 'actual_full_large_sourcefree_timing15_intervals', 'raw': {'path': str(raw_path), 'sha256': e.digest(raw_path)},
            'retained_timing20_flags': [actual20_flag], 'flag_decisions': [{'flag': initial_flag,
                'decision': 'approve_actual_full_large_sourcefree_timing15_intervals', 'review_note': 'Synthetic scoped original failure guard.'}],
            'timing20_flag_decisions': [{'flag': actual20_flag, 'decision': 'approve_actual_full_large_sourcefree_timing15_intervals',
                'review_note': 'Synthetic separate new20 counterevidence guard.'}]}
        return run, raw, initial, authored, approval

    def timing15_case(self, fixture):
        run, raw, initial, authored, approval = fixture
        with patch.object(e, 'SOURCEFREE_TIMING_PLAN_SHA256', '1'*64), patch.object(e, 'SOURCEFREE_TIMING_RUNNER_SHA256', '2'*64), \
                patch.object(e, 'actual_timing15_waveform', return_value=raw['actual_audio_input']):
            return e.sourcefree_timing_case(self.row, initial, approval, {self.ident: raw}, authored, run, self.path, 1., {})

    def test_timing15_copies_exact_real_words_and_keeps_both_failed_producers(self):
        fixture = self.timing15_fixture(); before = copy.deepcopy(fixture[1:])
        self.assertEqual(self.timing15_case(fixture), [{'start': .123456, 'end': .765432}])
        self.assertEqual(fixture[1:], before)

    def test_timing15_cannot_drop_original_or_new20_flags_or_change_root_scope(self):
        for change in ['initial_flags', 'new_flags', 'retained20', 'old_decision', 'new_decision', 'missing20', 'path', 'hash', 'different_raw']:
            fixture = self.timing15_fixture(); run, raw, initial, authored, approval = fixture
            if change == 'initial_flags': approval['flag_decisions'].clear()
            if change == 'new_flags': approval['timing20_flag_decisions'].clear()
            if change == 'retained20': approval['retained_timing20_flags'].clear()
            if change == 'old_decision': approval['flag_decisions'][0]['decision'] = 'approve_words'
            if change == 'new_decision': approval['timing20_flag_decisions'][0]['review_note'] = ''
            if change == 'missing20': authored.clear()
            if change == 'path': approval['raw']['path'] = str(run/'free-large449/raw'/(self.ident+'.private.json'))
            if change == 'hash': approval['raw']['sha256'] = '0'*64
            if change == 'different_raw': raw['actual_response']['text'] = 'Fremd.'
            with self.subTest(change=change), self.assertRaises(b.SafeError): self.timing15_case(fixture)

    def test_entire_timing15_missing_root_and_timing20_bundle_binding_refused_before_runtime_checks(self):
        folder = self.run/'free-large-timing15'; folder.mkdir()
        for name in ['plan.private.json', 'result.private.json', 'execution-intent.private.json']: b.core.save(folder/name, {})
        runner = folder/'run.private.py'; runner.write_bytes(b'# SYNTHETIC UNIT ONLY, NOT AN ACTUAL MODEL PRODUCER\n')
        with patch.object(e, 'SOURCEFREE_TIMING_PLAN_SHA256', e.digest(folder/'plan.private.json')), \
                patch.object(e, 'SOURCEFREE_TIMING_RUNNER_SHA256', e.digest(runner)), patch.object(e, 'model_evidence') as model:
            with self.assertRaisesRegex(b.SafeError, 'Root must bind the complete actual separate'):
                e.sourcefree_timing_bundle(self.run, {}, {}, {}, {}, None, None)
            model.assert_not_called()

    def test_separate_timing15_real_producer_schema_is_not_a_449_mutation(self):
        runner = Path(e.__file__).parents[1]/'output/audio/part2-voice/2026-10-08-all/free-large-timing15/run.private.py'
        if not runner.is_file() or not e.SOURCEFREE_TIMING_RUNNER_SHA256: self.skipTest('Final private actual15 producer is not frozen/exported.')
        self.assertEqual(e.digest(runner), e.SOURCEFREE_TIMING_RUNNER_SHA256)
        execute = next(node for node in ast.parse(runner.read_text()).body if isinstance(node, ast.FunctionDef) and node.name == 'execute')
        assignments = [node for node in ast.walk(execute) if isinstance(node, ast.Assign)]
        modules = next(node.value for node in assignments if any(isinstance(target, ast.Name) and target.id == 'modules' for target in node.targets))
        update = next(node for node in ast.walk(execute) if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name) and node.func.value.id == 'modules' and node.func.attr == 'update')
        self.assertEqual({node.value for node in modules.keys} | {node.value for node in update.args[0].generators[0].iter.elts}, e.SOURCEFREE_TIMING_IMPORTS)
        self.assertIn('execution-intent.private.json', runner.read_text())
        self.assertNotEqual(e.SOURCEFREE_TIMING_RUNNER_SHA256, e.SECONDARY_RUNNER_SHA256)

    def test_timing15_decoder_binds_real_bytes_and_exact_signed_pcm_conversion(self):
        decoder = {'command': 'ffmpeg', 'selected_path': '/synthetic/ffmpeg', 'resolved_path': '/synthetic/ffmpeg',
            'sha256': '3'*64, 'sample_rate': 16000, 'channels': 1, 'format': 's16le', 'codec': 'pcm_s16le',
            'method': 'mlx_whisper.audio.load_audio then numpy.asarray(dtype=float32)',
            'pcm_to_float_conversion': 'mlx.float32(int16_pcm)/32768.0'}
        actual_wave = {'synthetic_wave_only': True}
        with patch.object(e.shutil, 'which', return_value='/synthetic/ffmpeg'), patch.object(e, 'digest', return_value='3'*64), \
                patch.object(e, 'actual_anonymous_waveform', return_value=actual_wave) as actual:
            self.assertEqual(e.actual_timing15_waveform(self.path, decoder), {**actual_wave, 'decoder': decoder})
            actual.assert_called_once_with(self.path)
            for change in ['format', 'sha256', 'method', 'pcm_to_float_conversion']:
                wrong = {**decoder, change: 'FOREIGN SYNTHETIC VALUE'}
                with self.subTest(change=change), self.assertRaises(b.SafeError): e.actual_timing15_waveform(self.path, wrong)

    def test_reviewed_runner_bytes_are_read_once_and_never_replaced_at_compile(self):
        path = self.run/'synthetic-source-byte-race.private.py'
        original = b'SYNTHETIC_GUARD_VALUE = 1\n'; sha = b.sha(original); path.write_bytes(original)
        with patch.object(Path, 'read_bytes', autospec=True, return_value=original) as read:
            captured = e.frozen_runner_bytes(path, sha)
            read.assert_called_once_with(path)
        path.write_bytes(b'SYNTHETIC_GUARD_VALUE = 9\n')
        namespace = {}; exec(compile(captured, str(path), 'exec'), namespace)
        self.assertEqual(namespace['SYNTHETIC_GUARD_VALUE'], 1)
        with self.assertRaises(b.SafeError): e.frozen_runner_bytes(path, sha)
        with self.assertRaises(b.SafeError): e.base.stable({str(path): sha}, {})

    def test_all_real_producer_compiles_use_captured_frozen_bytes_and_fixed_final_hash(self):
        tree = ast.parse(Path(e.__file__).read_text())
        expected = {'secondary_bundle': 'SECONDARY_RUNNER_SHA256', 'authored_bundle': 'TIMING_RUNNER_SHA256',
            'sourcefree_timing_bundle': 'SOURCEFREE_TIMING_RUNNER_SHA256'}
        for name, constant in expected.items():
            function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name)
            compiles = [node for node in ast.walk(function) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'compile']
            self.assertEqual(len(compiles), 1)
            self.assertEqual(ast.unparse(compiles[0].args[0]), 'runner_bytes')
            self.assertIn('bound[str(runner_path)] = '+constant, ast.unparse(function))

    def test_numeric_storage_boundary_preserves_values_and_keeps_strict_finite_gate(self):
        class NumericFloat(float): pass
        value = {'start': NumericFloat(.123456789012345), 'end': NumericFloat(.765432109876543)}
        self.assertFalse(e.finite(value['start']))
        stored = e.actual_stored_numeric_view(value)
        self.assertEqual(value, stored)
        self.assertIs(type(stored['start']), float)
        self.assertTrue(e.finite(stored['start']))
        with self.assertRaises(ValueError): e.actual_stored_numeric_view({'start': NumericFloat(float('nan'))})
        with self.assertRaises(TypeError): e.actual_stored_numeric_view({'start': object()})

    def test_actual_saved20_refinement_numpy_scalars_match_unchanged_json_storage_values(self):
        try: import numpy as np
        except ImportError: self.skipTest('Actual offline waveform replay requires the existing NumPy runtime.')
        run = Path(e.__file__).parents[1]/'output/audio/part2-voice/2026-10-08-all'
        paths = sorted((run/'full-large-timing20/raw').glob('part2-01b113*.private.json'))
        if len(paths) != 1: self.skipTest('Private genuine model receipts are not exported with the repository.')
        raw_path = paths[0]; raw = e.read_raw(raw_path); ident = raw['id']
        row = next(row for row in e.batch.read(run/'lines.private.json')['lines'] if row['id'] == ident)
        mp3 = run/'clips'/(ident+'.mp3'); samples, _ = e.waveform_samples(mp3)
        candidate = copy.deepcopy(raw['actual_authored_dtw'])
        candidate['original_qualification_flags'] = copy.deepcopy(candidate['qualification_flags'])
        candidate = e.base.cue_engine.acoustic.refine_boundaries(candidate, np.asarray(samples, dtype=np.float32))
        candidate['all_qualification_flags'] = e.base.cue_engine.qualification_flags(candidate)
        candidate['cues_sha256'] = e.base.cue_engine.acoustic.cue_sha(candidate['word_cues'])
        genuine_saved = e.read_raw(run/'full-large-timing20/refined'/(ident+'.private.json'))['actual_refined_dtw']
        self.assertEqual(candidate, genuine_saved)
        self.assertTrue(any(not e.finite(cue['start']) or not e.finite(cue['end']) for cue in candidate['word_cues']))
        stored = e.actual_stored_numeric_view(candidate)
        self.assertEqual(stored, genuine_saved)
        e.validate_authored_time(row, stored, e.digest(mp3), len(samples)/16000)


if __name__ == '__main__': unittest.main()
