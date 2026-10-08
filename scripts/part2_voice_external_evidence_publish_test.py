"""Synthetic refusal/transaction tests; genuine offline readback is separately labelled."""
import ast
import base64
import copy
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import part2_voice_batch as b
import part2_voice_external_evidence_publish as e
import part2_voice_evidence_publish_test as prior_tests


class ExternalEvidence(prior_tests.EvidencePublication):
    def observation(self, text='Weiter.'):
        return {'status': 'RAW_OBSERVATION_ONLY_NOT_APPROVED', 'model': 'gemini-3.1-pro-preview',
            'actual_raw_observation': {'transcript': text, 'whole_utterance_ipa': None, 'uncertainties': [], 'vocal_events': []},
            'word_approval': None, 'vocal_approval': None, 'canonical_pronunciation': None, 'human_listening_verdict': None,
            'model_request_sha256': 'a'*64, 'actual_provider_batch_row': {'synthetic_unit_only': True}}

    def external_case(self, word=None, timing=None, mode='google_literal_initial_timeclear'):
        case = self.case(word, timing); case.update(version=e.VERSION, status='approved_part2_external_case_evidence', mode=mode)
        return case

    def test_whole_google_literal_is_only_word_proof_and_observations_stay_unchanged(self):
        observation = self.observation(); before = copy.deepcopy(observation)
        self.assertEqual(e.google_literal(observation, self.row), 'Weiter.')
        self.assertEqual(observation, before)

    def test_google_ipa_events_or_vowel_name_forms_cannot_replace_source_words(self):
        for observed in ['', 'Fremd.', 'Weiter. Weiter.']:
            observation = self.observation(observed)
            observation['actual_raw_observation'].update(whole_utterance_ipa='SYNTHETIC NOT WORD PROOF', vocal_events=[{'synthetic_only': True}])
            with self.subTest(observed=observed), self.assertRaises(b.SafeError): e.google_literal(observation, self.row)
        for source, observed in [('Foltan.', 'Voltan.'), ('Kyra.', 'Kira.'), ('Wart!', 'Warte!')]:
            with self.subTest(source=source), self.assertRaises(b.SafeError): e.google_literal(self.observation(observed), {**self.row, 'text': source})

    def test_google_uncertainty_wrong_model_or_fabricated_approval_refused(self):
        for field, value in [('model', 'gemini-3.8-flash-tts'), ('status', 'MAX_TOKENS'), ('word_approval', True),
                             ('canonical_pronunciation', 'Foltan'), ('human_listening_verdict', True)]:
            observation = self.observation(); observation[field] = value
            with self.subTest(field=field), self.assertRaises(b.SafeError): e.google_literal(observation, self.row)
        observation = self.observation(); observation['actual_raw_observation']['uncertainties'] = [{'ordinal': 1, 'description': 'Synthetic uncertainty.'}]
        with self.assertRaises(b.SafeError): e.google_literal(observation, self.row)

    def google_clip_fixture(self):
        self.take.update(reasons=['asr_lexical_mismatch_requires_review'], transcript='Fremd.', word_error_rate=1)
        run = self.run.resolve(); self.args.qa_report = self.args.qa_report.resolve()
        self.args.alignment_report = self.args.alignment_report.resolve(); self.args.qa_producer = self.args.qa_producer.resolve(); self.args.alignment_producer = self.args.alignment_producer.resolve()
        observation = self.observation(); path = run/e.GOOGLE['qc17']['folder']/'observations'/(self.ident+'.private.json'); b.core.save(path, observation)
        word = {'mode': 'google_whole_literal', 'bundle_key': 'qc17', 'observation': {'path': str(path), 'sha256': e.digest(path)},
            'provider_row_sha256': e.object_sha(observation['actual_provider_batch_row']), 'source_free_request_sha256': observation['model_request_sha256'],
            'review_note': 'Synthetic exact Root-only whole literal guard.'}
        case = self.external_case(word=word)
        case['binding'] = e.prior.case_binding(self.args, run, self.row)
        return run, observation, case

    def google_clip(self, fixture):
        run, observation, case = fixture
        return e.evidence_clip(self.row, run, self.profiles, self.qa, self.alignment, self.take, case, self.args, {},
            {'qc17': {self.ident: observation}}, {}, decode_fn=lambda _: self.signal)

    def test_google_external_clip_preserves_primary_failure_and_initial_clear_cues(self):
        fixture = self.google_clip_fixture(); before = copy.deepcopy((self.take, self.temporal, self.qa, self.alignment))
        clip, _ = self.google_clip(fixture)
        self.assertEqual(clip['word_cues'], self.cues)
        self.assertEqual(before, (self.take, self.temporal, self.qa, self.alignment))

    def test_google_lane_rejects_initial_timehold_signal_error_stale_source_or_retakes(self):
        original_row, original_temporal = copy.deepcopy(self.row), copy.deepcopy(self.temporal)
        for change in ['timing', 'signal_reason', 'source', 'retake', 'rowhash']:
            self.row, self.temporal = copy.deepcopy(original_row), copy.deepcopy(original_temporal)
            b.core.save(self.run/'word-cues'/(self.ident+'.json'), self.temporal)
            fixture = self.google_clip_fixture(); run, observation, case = fixture
            if change == 'timing':
                flag = {'word_index': 0, 'word': 'Weiter.', 'reasons': ['collapsed_acoustic_interval']}
                self.temporal['all_qualification_flags'] = [flag]; self.temporal['qualification_flags'] = [flag]; self.temporal['original_qualification_flags'] = [flag]
                b.core.save(run/'word-cues'/(self.ident+'.json'), self.temporal)
                case['binding'] = e.prior.case_binding(self.args, run, self.row); case['retained_initial_timing_flags'] = [flag]
            if change == 'signal_reason': self.take['reasons'] = ['possible_abrupt_audio_end']; case['retained_initial_take'] = copy.deepcopy(self.take)
            if change == 'source': case['binding']['source_row']['text'] = 'Fremd.'
            if change == 'retake': case['mode'] = 'retake_google'
            if change == 'rowhash': case['word']['provider_row_sha256'] = '0'*64
            with self.subTest(change=change), self.assertRaises(b.SafeError): self.google_clip(fixture)

    def test_json_parser_duplicate_nonfinite_and_partial_provider_body_refused(self):
        for data in [b'{"text":"a","text":"b"}', b'{"score":NaN}', b'{"text":']:
            with self.subTest(data=data), self.assertRaises((b.SafeError, ValueError)): e.read_json_bytes(data)

    def numeric_case_fixture(self):
        run = self.run.resolve(); raw = self.timing15_raw(); folder = run/'free-large-timing15'
        original = {'actual_intervals_valid': False, 'actual_interval_count': 1, 'actual_interval_uncertainty_reasons': ['nonfinite_actual_word_interval_or_probability']}
        paths = {label: folder/label/(self.ident+'.private.json') for label in ['raw', 'diagnosis']}
        b.core.save(paths['raw'], raw); b.core.save(paths['diagnosis'], original)
        initial_flag = {'word_index': 0, 'word': 'Weiter.', 'reasons': ['collapsed_acoustic_interval']}
        flag20 = {'word_index': 0, 'word': 'Weiter.', 'reasons': ['low_authored_token_probability']}
        temporal = {**self.temporal, 'all_qualification_flags': [initial_flag]}
        verdict = copy.deepcopy(original); revalidation = {'actual_intervals_valid': True, 'actual_interval_count': 1, 'actual_interval_uncertainty_reasons': []}
        detail = {'all_existing_case_numeric_time_guards_pass_without_root_approval': True,
            'one_to_one_actual_lexical_word_mapping': True, 'serialized_numeric_revalidation': revalidation, 'original_interval_verdict': verdict}
        candidate = {'raw': raw, 'original_diagnosis': original, 'detail': detail, 'record': {'timing20_all_qualification_flags': [flag20]}}
        approval = {'mode': 'actual_timing15_serialized_numbers', 'raw': {'path': str(paths['raw']), 'sha256': e.digest(paths['raw'])},
            'original_diagnosis': {'path': str(paths['diagnosis']), 'sha256': e.digest(paths['diagnosis'])},
            'revalidation_detail_sha256': e.object_sha(detail), 'retained_original_interval_verdict': verdict,
            'retained_serialized_numeric_revalidation': revalidation, 'retained_timing20_flags': [flag20],
            'original_native_numeric_types_unrecorded': True,
            'original_false_verdict_review': {'decision': 'approve_separate_json_numeric_evidence_keep_original_false',
                'original_interval_verdict_sha256': e.object_sha(verdict), 'review_note': 'Synthetic explicit false preservation guard.'},
            'initial_flag_decisions': [{'flag': initial_flag, 'decision': 'approve_actual_numeric15_sourcefree_times', 'review_note': 'Synthetic exact initial flag.'}],
            'timing20_flag_decisions': [{'flag': flag20, 'decision': 'approve_actual_numeric15_sourcefree_times', 'review_note': 'Synthetic exact actual20 flag.'}]}
        return run, temporal, candidate, approval

    def numeric_case(self, fixture):
        run, temporal, candidate, approval = fixture
        with patch.object(e.prior, 'SOURCEFREE_TIMING_PLAN_SHA256', '1'*64), patch.object(e.prior, 'SOURCEFREE_TIMING_RUNNER_SHA256', '2'*64):
            return e.numeric15_case(self.row, temporal, candidate, approval, run, {}, 1.)

    def test_numerical15_separate_true_keeps_original_false_and_exact_real_times(self):
        fixture = self.numeric_case_fixture(); before = copy.deepcopy(fixture[1:])
        self.assertEqual(self.numeric_case(fixture), [{'start': .123456, 'end': .765432}])
        self.assertEqual(before, fixture[1:])

    def test_numerical15_rejects_original_true_flag_drop_hold_long_or_wrong_report_binding(self):
        for change in ['false', 'report', 'initial_flags', 'new_flags', 'review', 'held', 'long', 'sourcefree']:
            fixture = self.numeric_case_fixture(); _, temporal, candidate, approval = fixture
            if change == 'false': approval['retained_original_interval_verdict']['actual_intervals_valid'] = True
            if change == 'report': approval['revalidation_detail_sha256'] = '0'*64
            if change == 'initial_flags': approval['initial_flag_decisions'].clear()
            if change == 'new_flags': approval['timing20_flag_decisions'].clear()
            if change == 'review': approval['original_false_verdict_review']['review_note'] = ''
            if change == 'held': candidate['detail']['all_existing_case_numeric_time_guards_pass_without_root_approval'] = False
            if change == 'long': candidate['raw']['actual_response']['segments'][0]['words'][0]['end'] = 2.0
            if change == 'sourcefree': candidate['raw']['source_free'] = False
            with self.subTest(change=change), self.assertRaises(b.SafeError): self.numeric_case(fixture)

    def test_external_build_first_calls_unchanged_whole921_before_any_new_source(self):
        args = SimpleNamespace(**vars(self.args)); initial, supplemental = {}, {}
        with patch.object(e, 'digest', side_effect=[e.PRIOR_SHA, e.PRIOR_TEST_SHA]), \
                patch.object(e.prior, 'build', side_effect=b.SafeError('actual whole921 guard')) as whole:
            with self.assertRaisesRegex(b.SafeError, 'actual whole921 guard'): e.build(args, initial, supplemental, {})
            whole.assert_called_once_with(args, initial, supplemental)

    def test_original0036_and8a8_are_physically_unchanged(self):
        self.assertEqual(e.digest(Path(e.prior.__file__)), e.PRIOR_SHA)
        self.assertEqual(e.digest(Path(e.__file__).with_name('part2_voice_evidence_publish_test.py')), e.PRIOR_TEST_SHA)

    def http_fixture(self):
        folder = self.run/'synthetic-http-producer'; folder.mkdir(); http = folder/'http-raw'; http.mkdir()
        request_data = b'{"synthetic_only_request":1}\n'; (folder/'requests.jsonl').write_bytes(request_data)
        data = b'{"key":"synthetic-001"}\n{"key":"synthetic-002"}\n'
        creation = {'name': 'batches/SYNTHETIC_ONLY'}; status = {'metadata': {'state': 'JOB_STATE_SUCCEEDED'}}
        upload = {'file': {'name': 'files/SYNTHETIC_ONLY', 'mimeType': 'application/jsonl', 'state': 'ACTIVE', 'source': 'UPLOADED',
            'sizeBytes': str(len(request_data)), 'sha256Hash': base64.b64encode(b.sha(request_data).encode()).decode()}}
        bodies = [('POST', b''), ('POST', b.canonical(upload).encode()), ('POST', b.canonical(creation).encode()),
            ('GET', b.canonical(status).encode()), ('GET', data)]
        for index, (method, raw) in enumerate(bodies):
            token = str(index)
            b.core.save(http/(token+'.intent.private.json'), {'state': 'ATTEMPT_RECORDED', 'method': method, 'created_at': 0})
            b.core.save(http/(token+'.receipt.private.json'), {'state': 'RESPONSE_RETAINED', 'method': method, 'bytes': len(raw), 'sha256': b.sha(raw), 'http_status': 200})
            (http/(token+'.response.private.bin')).write_bytes(raw)
        return folder, {'actual_creation_response': creation, 'input_file_name': 'files/SYNTHETIC_ONLY'}, {'actual_provider_response': status}, data

    def test_complete_http_raw_download_jsonl_is_not_reparsed_as_one_status_object(self):
        folder, job, snapshot, data = self.http_fixture(); bound = {}
        e.http_evidence(folder, job, snapshot, data, bound)
        self.assertEqual(len(bound), 15)

    def test_http_receipt_changed_body_or_uploaded_file_hash_cannot_be_self_reported(self):
        fixture = self.http_fixture(); folder, job, snapshot, data = fixture; http = folder/'http-raw'
        raw_path = http/'1.response.private.bin'; upload = e.read_json_bytes(raw_path.read_bytes())
        upload['file']['sha256Hash'] = base64.b64encode(b'0'*64).decode(); raw = b.canonical(upload).encode(); raw_path.write_bytes(raw)
        b.core.save(http/'1.receipt.private.json', {'state': 'RESPONSE_RETAINED', 'method': 'POST', 'bytes': len(raw), 'sha256': b.sha(raw), 'http_status': 200})
        with self.assertRaisesRegex(b.SafeError, 'uploaded file size/hash'): e.http_evidence(*fixture, {})
        receipt_path = http/'1.receipt.private.json'; receipt = b.read(receipt_path); receipt['bytes'] += 1; b.core.save(receipt_path, receipt)
        with self.assertRaisesRegex(b.SafeError, 'response bytes'): e.http_evidence(*fixture, {})

    def test_actual_two_google_key_formats_keep_their_different_prefix_and_width(self):
        self.assertEqual(e.google_external_key(e.GOOGLE['qc17'], 1), 'qc17-001')
        self.assertEqual(e.google_external_key(e.GOOGLE['qc17'], 17), 'qc17-017')
        self.assertEqual(e.google_external_key(e.GOOGLE['remaining317'], 1), 'qcr-0001')
        self.assertEqual(e.google_external_key(e.GOOGLE['remaining317'], 317), 'qcr-0317')
        for key, spec in e.GOOGLE.items():
            folder = Path(e.__file__).parents[1]/'output/audio/part2-voice/2026-10-08-all'/spec['folder']
            if not (folder/'plan.private.json').exists(): continue
            plan = b.read(folder/'plan.private.json'); requests = [e.read_json_bytes(line) for line in (folder/'requests.jsonl').read_bytes().splitlines() if line.strip()]
            self.assertEqual([row['key'] for row in requests], [e.google_external_key(spec, i) for i in range(1, spec['count']+1)])
            call = folder/'call-intents'/(plan['selected_ids'][0]+'.private.json')
            if call.exists(): self.assertEqual(b.read(call)['external_key'], e.google_external_key(spec, 1))


if __name__ == '__main__': unittest.main()
