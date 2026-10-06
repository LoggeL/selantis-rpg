"""Offline transport/provenance failure tests; no paid API or real audio edits."""
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch
import story_voice_specialist_asr as asr


def response(text='Foltan wartet hier.'):
    return {'modelVersion': asr.MODEL, 'candidates': [{'finishReason': 'STOP',
            'content': {'role': 'model', 'parts': [{'text': text}]}}]}


class SpecialistTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.source = Path(self.tmp.name).resolve()
        self.ids = ['story-' + ('1' * 24), 'story-' + ('2' * 24)]
        self.rows = [{'id': ident, 'text': text, 'speaker': 'foltan', 'kind': 'say',
                     'scene': 'camp', 'mood': 'neutral', 'direction_en': 'Clear.'}
                     for ident, text in zip(self.ids, ['Foltan wartet hier.', 'Lia kommt gleich.'])]
        self.profiles = {'speakers': {'foltan': {'google_voice': 'Rasalgethi'}}}
        for name in asr.SOURCE_FILES:
            (self.source / name).write_text('{}')
        asr.core.save(self.source / 'lines.private.json', {'lines': self.rows})
        asr.core.save(self.source / 'profiles.private.json', self.profiles)
        records = []
        for row in self.rows:
            request = asr.common.request_for(row, self.profiles['speakers'])
            records.append({'key': row['id'], 'request': request})
            audio, wav = ('mp3-' + row['id']).encode(), ('wav-' + row['id']).encode()
            (self.source / 'clips').mkdir(exist_ok=True)
            (self.source / 'raw').mkdir(exist_ok=True)
            (self.source / 'clips' / (row['id'] + '.mp3')).write_bytes(audio)
            (self.source / 'raw' / (row['id'] + '.wav')).write_bytes(wav)
            asr.core.save(self.source / 'raw' / (row['id'] + '.receipt.json'), {
                'id': row['id'], 'status': 'complete', 'backend': 'batch',
                'mp3_sha256': asr.core.digest(audio), 'wav_sha256': asr.core.digest(wav),
                'request_sha256': asr.object_hash(request)})
        (self.source / 'requests.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in records))
        # common.prepared is separately qualified; exercise the new binding logic
        # using synthetic source files without changing shared module state.
        self.prepared_patch = patch.object(asr.common, 'prepared', return_value={})
        self.prepared_patch.start()
        self.folder, self.run = asr.locations(self.source, 'probe')
        self.stdout = redirect_stdout(io.StringIO())
        self.stdout.__enter__()

    def tearDown(self):
        self.stdout.__exit__(None, None, None)
        self.prepared_patch.stop()
        self.tmp.cleanup()

    def prepare(self, ids=None, limit=None):
        ids = ids or [self.ids[0]]
        asr.prepare(self.source, self.run, ids, limit or len(ids))

    def execute(self, text='Foltan wartet hier.'):
        def api(method, url, key, payload, headers, raw=False):
            self.assertTrue((self.run / (self.ids[0] + '.intent.private.json')).exists())
            self.assertEqual(key, 'RAM-secret')
            self.assertEqual(json.loads(payload), asr.request_for((self.source / 'clips' / (self.ids[0] + '.mp3')).read_bytes()))
            self.assertTrue(raw)
            self.assertEqual(headers, {'Content-Type': 'application/json'})
            return json.dumps(response(text)).encode(), {}
        with patch.object(asr.core, 'api', side_effect=api) as network:
            asr.execute(self.source, self.folder, self.run, True, lambda: 'RAM-secret')
            return network.call_count

    def record(self):
        return asr.core.read_json(next((self.folder / 'cache').glob('*.json')))

    def test_request_is_verbatim_audio_only(self):
        request = asr.request_for(b'MP3')
        self.assertEqual(request['contents'][0]['parts'], [{'inlineData': {'mimeType': 'audio/mp3', 'data': 'TVAz'}}])
        self.assertEqual(request['generationConfig'], {'audioTranscriptionConfig': {
            'mode': 'VERBATIM', 'languageCodes': ['de-DE'], 'wordTimestamp': False, 'diarization': False}})
        self.assertNotIn('text', json.dumps(request))
        for value in [b'', '', None]:
            with self.assertRaises(asr.core.SafeError):
                asr.request_for(value)

    def test_request_size_has_no_upload_fallback(self):
        with patch.object(asr, 'MAX_REQUEST_BYTES', 100):
            with self.assertRaises(asr.core.SafeError):
                asr.request_for(b'MP3')

    def test_response_rejects_wrong_model_incomplete_tools_timestamps_thoughts(self):
        bad = []
        item = response(); item['modelVersion'] = 'gemini-3.8-flash'; bad.append(item)
        item = response(); item['candidates'][0]['finishReason'] = 'MAX_TOKENS'; bad.append(item)
        item = response(); item['candidates'][0]['content']['role'] = 'user'; bad.append(item)
        for part in [{'text': 'Foltan', 'thought': True}, {'audioTranscription': {'words': []}},
                     {'functionCall': {}}, {'text': ''}]:
            item = response(); item['candidates'][0]['content']['parts'] = [part]; bad.append(item)
        item = response(); item['candidates'].append(item['candidates'][0]); bad.append(item)
        item = response(); item['promptFeedback'] = {'blockReason': 'SAFETY'}; bad.append(item)
        for item in bad:
            with self.subTest(item=item), self.assertRaises(asr.core.SafeError):
                asr.response_transcript(item)

    def test_exact_proof_is_full_and_has_no_timing_or_listening_approval(self):
        self.prepare(); self.assertEqual(self.execute(), 1)
        proof = asr.exact_text_match_proof(self.source, self.record())
        self.assertEqual(proof['expected_tokens'], ['foltan', 'wartet', 'hier'])
        self.assertEqual(proof['expected_tokens'], proof['observed_tokens'])
        self.assertFalse(proof['provider_timestamps_used'])
        self.assertIsNone(proof['timing_approval'])
        self.assertIsNone(proof['listening_verdict'])

    def test_actual_typed_transcription_response_is_supported_without_timing(self):
        item = response()
        item['candidates'][0]['content']['parts'] = [{'audioTranscription': {'text': 'Foltan wartet hier.'}}]
        self.assertEqual(asr.response_transcript(item), 'Foltan wartet hier.')
        for extra in [{'words': []}, {'speakerLabel': 'spk_1'}, {'startOffset': '0.1s'}]:
            bad = copy.deepcopy(item)
            bad['candidates'][0]['content']['parts'][0]['audioTranscription'].update(extra)
            with self.subTest(extra=extra), self.assertRaises(asr.core.SafeError):
                asr.response_transcript(bad)

    def test_translated_typed_response_never_gets_exact_word_approval(self):
        self.prepare()
        item = response()
        item['candidates'][0]['content']['parts'] = [{'audioTranscription': {'text': 'Foltan waits here.'}}]
        with patch.object(asr.core, 'api', return_value=(json.dumps(item).encode(), {})):
            asr.execute(self.source, self.folder, self.run, True, lambda: 'RAM-secret')
        self.assertEqual(self.record()['transcript'], 'Foltan waits here.')
        self.assertIsNone(asr.exact_text_match_proof(self.source, self.record()))

    def test_old_config_scope_cannot_be_recovered_as_new_contract(self):
        self.prepare()
        path = self.run / 'scope.private.json'
        scope = asr.core.read_json(path); scope['contract_version'] = 1
        asr.core.save(path, scope)
        asr.core.save(self.run / 'prepared.json', {'scope_sha256': asr.core.digest(path.read_bytes())})
        with patch.object(asr.core, 'api') as network:
            with self.assertRaises(asr.core.SafeError):
                asr.execute(self.source, self.folder, self.run, False)
            network.assert_not_called()

    def test_record_proof_reads_only_own_scope_request(self):
        self.prepare(self.ids, 2)
        replies = [json.dumps(response()).encode(), json.dumps(response('Lia kommt gleich.')).encode()]
        with patch.object(asr.core, 'api', side_effect=[(raw, {}) for raw in replies]):
            asr.execute(self.source, self.folder, self.run, True, lambda: 'RAM-secret')
        scope = asr.core.read_json(self.run / 'scope.private.json')
        record = asr.core.read_json(asr.cache_path(self.folder, self.ids[0], scope['entries'][0]['binding']))
        other_path = self.source / scope['entries'][1]['request_file']
        original = Path.read_bytes
        def read_bytes(path):
            if path == other_path:
                self.fail('Single-record proof must not read another scope request')
            return original(path)
        with patch.object(Path, 'read_bytes', read_bytes):
            self.assertIsNotNone(asr.exact_text_match_proof(self.source, record))

    def test_repeated_or_missing_or_changed_name_has_no_exact_proof(self):
        for text in ['Foltan Foltan wartet hier.', 'Foltan wartet.', 'Foltern wartet hier.']:
            with self.subTest(text=text):
                record = self.make_raw_record(text)
                self.assertIsNone(asr.exact_text_match_proof(self.source, record))

    def make_raw_record(self, text):
        if not (self.run / 'prepared.json').exists(): self.prepare()
        binding = asr.prepared(self.source, self.run)['entries'][0]['binding']
        target = asr.cache_path(self.folder, self.ids[0], binding)
        if target.exists(): target.unlink()
        for suffix in ['.intent.private.json', '.response.private.json']:
            path = self.run / (self.ids[0] + suffix)
            if path.exists(): path.unlink()
        self.execute(text)
        return self.record()

    def test_words_preserve_contractions_and_name_vowels(self):
        self.assertNotEqual(asr.words("Ich hab's"), asr.words('Ich habe es'))
        self.assertNotEqual(asr.words('Foltan'), asr.words('Foltern'))
        self.assertEqual(asr.words("HE! Foltan’s..."), asr.words("he foltan's"))

    def test_unknown_duplicate_or_overbound_scope_is_rejected_before_requests(self):
        for ids, limit in [([self.ids[0], self.ids[0]], 2), (['unknown'], 1),
                           ([self.ids[0]], 0), (self.ids, 1), ([self.ids[0]], 151)]:
            with self.subTest(ids=ids, limit=limit), self.assertRaises(asr.core.SafeError):
                asr.prepare(self.source, self.run, ids, limit)
        self.assertFalse((self.run / 'prepared.json').exists())
        self.assertFalse((self.run / 'requests').exists())

    def test_network_failure_records_intent_and_never_retries(self):
        self.prepare()
        with patch.object(asr.core, 'api', side_effect=asr.core.SafeError('Network outcome unknown')) as network:
            with self.assertRaises(asr.core.SafeError):
                asr.execute(self.source, self.folder, self.run, True, lambda: 'RAM-secret')
            with self.assertRaises(asr.core.SafeError):
                asr.execute(self.source, self.folder, self.run, True, lambda: 'RAM-secret')
            self.assertEqual(network.call_count, 1)
        intent = asr.core.read_json(self.run / (self.ids[0] + '.intent.private.json'))
        self.assertEqual(intent['state'], 'RECORDED_BEFORE_HTTP')
        self.assertNotIn('RAM-secret', json.dumps(intent))

    def test_invalid_response_retained_and_recover_is_local_only(self):
        self.prepare()
        with patch.object(asr.core, 'api', return_value=(json.dumps({'modelVersion': 'wrong'}).encode(), {})) as network:
            with self.assertRaises(asr.core.SafeError):
                asr.execute(self.source, self.folder, self.run, True, lambda: 'RAM-secret')
            with self.assertRaises(asr.core.SafeError):
                asr.execute(self.source, self.folder, self.run, False)
            self.assertEqual(network.call_count, 1)
        self.assertTrue((self.run / (self.ids[0] + '.response.private.json')).exists())

    def test_raw_response_recovery_does_not_repeat_call(self):
        self.prepare(); self.execute()
        next((self.folder / 'cache').glob('*.json')).unlink()
        with patch.object(asr.core, 'api') as network:
            asr.execute(self.source, self.folder, self.run, False)
            network.assert_not_called()
        self.assertIsNotNone(asr.exact_text_match_proof(self.source, self.record()))

    def test_cache_reuses_valid_current_take_without_credential_or_network(self):
        self.prepare(); self.execute()
        with patch.object(asr.core, 'api') as network:
            asr.execute(self.source, self.folder, self.run, True,
                        lambda: self.fail('Cached take must not read key'))
            network.assert_not_called()

    def test_other_operation_cannot_duplicate_uncertain_paid_request(self):
        self.prepare()
        with patch.object(asr.core, 'api', side_effect=asr.core.SafeError('unknown')):
            with self.assertRaises(asr.core.SafeError):
                asr.execute(self.source, self.folder, self.run, True, lambda: 'RAM-secret')
        _, other = asr.locations(self.source, 'other')
        asr.prepare(self.source, other, [self.ids[0]], 1)
        with patch.object(asr.core, 'api') as network:
            with self.assertRaises(asr.core.SafeError):
                asr.execute(self.source, self.folder, other, True, lambda: 'RAM-secret')
            network.assert_not_called()

    def test_tampered_source_receipt_wav_mp3_or_raw_response_invalidates_proof(self):
        self.prepare(); self.execute(); record = self.record()
        paths = [self.source / 'lines.private.json',
                 self.source / 'raw' / (self.ids[0] + '.receipt.json'),
                 self.source / 'raw' / (self.ids[0] + '.wav'),
                 self.source / 'clips' / (self.ids[0] + '.mp3'),
                 self.run / (self.ids[0] + '.response.private.json')]
        for path in paths:
            before = path.read_bytes()
            try:
                path.write_bytes(before + b' ')
                with self.subTest(path=path), self.assertRaises(asr.core.SafeError):
                    asr.exact_text_match_proof(self.source, record)
            finally: path.write_bytes(before)

    def test_bias_in_raw_request_is_rejected_even_with_recomputed_scope_hash(self):
        self.prepare(); self.execute(); record = self.record()
        scope = asr.core.read_json(self.run / 'scope.private.json')
        path = self.source / scope['entries'][0]['request_file']
        request = json.loads(path.read_bytes())
        request['contents'][0]['parts'].append({'text': 'Expected Foltan'})
        path.write_bytes(asr.request_bytes(request))
        scope['entries'][0]['request_sha256'] = asr.core.digest(path.read_bytes())
        asr.core.save(self.run / 'scope.private.json', scope)
        asr.core.save(self.run / 'prepared.json', {'scope_sha256': asr.core.digest((self.run / 'scope.private.json').read_bytes())})
        with self.assertRaises(asr.core.SafeError):
            asr.exact_text_match_proof(self.source, record)

    def test_fabricated_transcript_or_listening_verdict_is_rejected(self):
        self.prepare(); self.execute(); original = self.record()
        for field, value in [('transcript', 'Foltan Foltan wartet hier.'), ('listening_verdict', 'heard'),
                             ('provider_timestamps_used', True), ('model', 'gemini-3.8-flash')]:
            changed = copy.deepcopy(original); changed[field] = value
            with self.subTest(field=field), self.assertRaises(asr.core.SafeError):
                asr.exact_text_match_proof(self.source, changed)

    def test_completed_intent_is_required_for_exact_proof(self):
        self.prepare(); self.execute(); record = self.record()
        path = self.run / (self.ids[0] + '.intent.private.json')
        intent = asr.core.read_json(path); intent['state'] = 'RECORDED_BEFORE_HTTP'; asr.core.save(path, intent)
        with self.assertRaises(asr.core.SafeError):
            asr.exact_text_match_proof(self.source, record)

    def test_lexically_unchanged_delivery_override_binds_actual_request(self):
        path = self.source / 'raw' / (self.ids[0] + '.receipt.json')
        receipt = asr.core.read_json(path)
        part = {'text': 'Foltan wartet hier!', 'style': 'Careful and brief.'}
        request = asr.common.request_for(self.rows[0], self.profiles['speakers'])
        request['contents'] = [{'role': 'user', 'parts': [{'text': part['text'], 'speechMetadata': {'style': part['style']}}]}]
        receipt.update(model=asr.TTS_MODEL, delivery_override={'parts': [part]}, request_sha256=asr.object_hash(request))
        asr.core.save(path, receipt)
        self.prepare(); self.execute()
        self.assertIsNotNone(asr.exact_text_match_proof(self.source, self.record()))

    def test_wrong_tts_preset_or_lexical_override_is_rejected(self):
        path = self.source / 'raw' / (self.ids[0] + '.receipt.json')
        receipt = asr.core.read_json(path)
        receipt['delivery_override'] = {'parts': [{'text': 'Foltern wartet hier.', 'style': 'Clear.'}]}
        asr.core.save(path, receipt)
        with self.assertRaises(asr.core.SafeError): self.prepare()

    def test_nonlexical_derived_receipt_has_no_specialist_word_scope(self):
        path = self.source / 'raw' / (self.ids[0] + '.receipt.json')
        receipt = asr.core.read_json(path); receipt['backend'] = 'derived_single_nonlexical_event'; asr.core.save(path, receipt)
        with self.assertRaises(asr.core.SafeError): self.prepare()

    def test_incremental_merge_preserves_unselected_records(self):
        self.prepare(); self.execute()
        _, other = asr.locations(self.source, 'second')
        asr.prepare(self.source, other, [self.ids[1]], 1)
        with patch.object(asr.core, 'api', return_value=(json.dumps(response('Lia kommt gleich.')).encode(), {})):
            asr.execute(self.source, self.folder, other, True, lambda: 'RAM-secret')
        comparison = asr.core.read_json(self.folder / 'comparison.private.json')
        self.assertEqual({r['id'] for r in comparison['records']}, set(self.ids))
        self.assertEqual(len(comparison['exact_word_proofs']), 2)

    def test_recovery_with_no_prior_intent_sends_no_network_request(self):
        self.prepare()
        with patch.object(asr.core, 'api') as network:
            with self.assertRaises(asr.core.SafeError):
                asr.execute(self.source, self.folder, self.run, False)
            network.assert_not_called()

    def test_private_paths_cannot_escape_folder(self):
        for path in ['/tmp/elsewhere', '../../elsewhere', 'clips/file.mp3']:
            with self.subTest(path=path), self.assertRaises(asr.core.SafeError):
                asr.private_path(self.source, path)


if __name__ == '__main__':
    unittest.main()
