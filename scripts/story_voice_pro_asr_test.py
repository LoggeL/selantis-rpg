"""Offline Pro Batch namespace, scope, request and provenance gates."""
import copy
import io
import json
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_pro_asr as pro


class ProASRTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name).resolve(); (self.source / 'clips').mkdir()
        self.ids = ['story-' + str(i) * 24 for i in [1, 2, 3]]
        self.rows = {ident: {'id': ident, 'text': 'PRIVATE EXPECTED NAME ' + str(index)}
                     for index, ident in enumerate(self.ids)}
        for index, ident in enumerate(self.ids):
            (self.source / 'clips' / (ident + '.mp3')).write_bytes(('MP3' + str(index)).encode())
        pro.core.save(self.source / 'prepared.json', {'model': pro.transport.TTS_MODEL})
        pro.core.save(self.source / 'lines.private.json', {'lines': list(self.rows.values())})
        self.patch = patch.object(pro.transport, 'source_rows', return_value=self.rows)
        self.patch.start(); self.addCleanup(self.patch.stop)
        self.no_network = patch.object(pro.core, 'api', side_effect=AssertionError('No real network allowed'))
        self.no_network.start(); self.addCleanup(self.no_network.stop)
        self.args = SimpleNamespace(only_ids=','.join(self.ids[:2]), max_calls=4,
                                    key_stdin=True, keychain_service=None, keychain_account=None)
        with pro.backend():
            self.folder, self.run = pro.transport.locations(self.source, 'probe')
        self.stdout = redirect_stdout(io.StringIO()); self.stdout.__enter__()
        self.addCleanup(self.stdout.__exit__, None, None, None)

    def response(self, text='Actual words.', model=pro.MODEL, reason='STOP'):
        return {'modelVersion': model, 'candidates': [{'finishReason': reason,
                'content': {'role': 'model', 'parts': [{'text': json.dumps({'transcript': text})}]}}]}

    def prepare(self):
        with pro.backend():
            pro.prepare(self.args, self.source, self.folder, self.run, self.rows)

    def bind_submit(self):
        with pro.backend():
            info = pro.transport.prepared(self.run, self.source, self.rows)
            pro.transport.reserve(self.source, self.run)
        pro.core.save(self.run / 'submit-intent.private.json', {'model': pro.MODEL,
            'request_count': info['request_count'], 'input_sha256': info['input_sha256'], 'state': 'CONFIRMED'})
        pro.core.save(self.run / 'job.json', {'model': pro.MODEL, 'request_count': info['request_count'],
                                           'job_name': 'batches/pro-offline-fixture'})

    def collect(self, records=None):
        if records is None: records = [{'key': ident, 'response': self.response()} for ident in self.ids[:2]]
        result = {'response': {'inlinedResponses': records}}
        with pro.backend(), patch.object(pro.core, 'credential', return_value='RAM-only'), \
             patch.object(pro.core, 'fetch_status', return_value=(result, 'JOB_STATE_SUCCEEDED')):
            return pro.collect(self.args, self.source, self.folder, self.run, self.rows)

    def record(self, ident=None):
        ident = ident or self.ids[0]
        _, sha, text_sha = pro.transport.current_audio(self.source, self.rows[ident])
        return pro.core.read_json(pro.transport.cache_path(self.folder, ident, sha)), sha, text_sha

    def test_same_original_prompt_and_audio_no_expected_names(self):
        self.prepare()
        self.assertEqual(pro.PROMPT, pro.transport.asr.PROMPT)
        request = json.loads((self.run / 'requests.jsonl').read_text().splitlines()[0])['request']
        self.assertEqual(request['contents'][0]['parts'][0]['text'], pro.PROMPT)
        self.assertNotIn('PRIVATE EXPECTED NAME', json.dumps(request))
        self.assertEqual(request['generationConfig']['maxOutputTokens'], 2048)
        self.assertEqual(request['generationConfig']['thinkingConfig'], {'thinkingLevel': 'low', 'includeThoughts': False})
        self.assertNotIn('wordTimestamp', json.dumps(request))
        self.assertEqual((self.source / 'clips' / (self.ids[0] + '.mp3')).read_bytes(), b'MP30')

    def test_namespace_and_shared_model_globals_restored_on_failure(self):
        original = {name: getattr(pro.transport, name) for name in ['MODEL', 'asr', 'FOLDER_NAME', 'BANK_NAME']}
        with self.assertRaises(RuntimeError):
            with pro.backend():
                self.assertEqual(pro.transport.MODEL, pro.MODEL)
                self.assertEqual(pro.transport.FOLDER_NAME, 'independent-pro-asr')
                raise RuntimeError('offline')
        for name, value in original.items(): self.assertIs(getattr(pro.transport, name), value)

    def test_unknown_duplicate_and_overbound_ids_rejected(self):
        for ids, maximum in [('unknown', 1), (self.ids[0] + ',' + self.ids[0], 2),
                             (','.join(self.ids[:2]), 1), (self.ids[0], 151), (self.ids[0], 0)]:
            args = copy.copy(self.args); args.only_ids = ids; args.max_calls = maximum
            with self.subTest(ids=ids, maximum=maximum), pro.backend(), self.assertRaises(pro.core.SafeError):
                pro.prepare(args, self.source, self.folder, self.run, self.rows)
        self.assertFalse((self.run / 'prepared.json').exists())

    def test_strict_model_stop_schema_and_nontext_response(self):
        cases = [self.response(model='gemini-3.8-flash'), self.response(reason='MAX_TOKENS')]
        for part in [{'text': '{}'}, {'text': '{"transcript":"x","timestamps":[]}'},
                     {'text': 'null'}, {'text': '{"transcript":42}'},
                     {'audioTranscription': {'text': 'x'}}, {'text': '{"transcript":"x"}', 'thought': True}]:
            item = self.response(); item['candidates'][0]['content']['parts'] = [part]; cases.append(item)
        item = self.response(); item['candidates'] *= 2; cases.append(item)
        for item in cases:
            with self.subTest(item=item), self.assertRaises((pro.core.SafeError, ValueError)):
                pro.response_transcript(item)

    def test_complete_collection_and_standalone_validator(self):
        self.prepare(); self.bind_submit(); self.assertEqual(self.collect(), 0)
        record, sha, textsha = self.record()
        self.assertTrue(pro.cached_record(record, sha, textsha))
        self.assertFalse(record['provider_timestamps_used']); self.assertIsNone(record['listening_verdict'])
        comparison = pro.core.read_json(self.folder / 'comparison.private.json')
        self.assertEqual(len(comparison['records']), 2)
        self.assertEqual(comparison['records'][0]['model'], pro.MODEL)

    def test_changed_source_or_audio_invalidates_current_cache(self):
        self.prepare(); self.bind_submit(); self.collect(); record, sha, textsha = self.record()
        path = self.source / 'clips' / (self.ids[0] + '.mp3')
        path.write_bytes(b'changed')
        self.assertFalse(pro.cached_record(record, sha, textsha))

    def test_neighbor_retake_does_not_discard_current_unselected_word_evidence(self):
        self.prepare(); self.bind_submit(); self.collect(); record, sha, textsha = self.record()
        (self.source / 'clips' / (self.ids[1] + '.mp3')).write_bytes(b'neighbor retake')
        self.assertTrue(pro.cached_record(record, sha, textsha))
        with pro.backend():
            self.assertEqual(pro.transport.merge_current_cache(self.source, self.folder, self.rows), 1)

    def test_tampered_response_request_scope_intent_and_ledger_rejected(self):
        self.prepare(); self.bind_submit(); self.collect(); record, sha, textsha = self.record()
        for path in [self.run / 'responses.private.json', self.run / 'requests.jsonl',
                     self.run / 'pro-scope.private.json', self.run / 'prepared.json',
                     self.run / 'audio-snapshot.private.json', self.run / 'submit-intent.private.json',
                     self.folder / 'batch-reservations.private.json']:
            original = path.read_bytes()
            try:
                if path.name in {'submit-intent.private.json', 'batch-reservations.private.json'}:
                    path.write_text('{}')
                else: path.write_bytes(original + b' ')
                with self.subTest(path=path): self.assertFalse(pro.cached_record(record, sha, textsha))
            finally: path.write_bytes(original)

    def test_fabricated_response_transcript_or_hash_metadata_rejected(self):
        self.prepare(); self.bind_submit(); self.collect(); original, sha, textsha = self.record()
        for key, value in [('transcript', 'Fabricated'), ('model', 'different'),
                           ('request_sha256', '0' * 64), ('driver_sha256', '0' * 64),
                           ('request_contract_sha256', '0' * 64), ('listening_verdict', 'approved'),
                           ('provider_timestamps_used', True)]:
            changed = copy.deepcopy(original); changed[key] = value
            with self.subTest(key=key): self.assertFalse(pro.cached_record(changed, sha, textsha))

    def test_unknown_missing_duplicate_raw_response_keys_rejected(self):
        self.prepare(); self.bind_submit()
        cases = [[{'key': self.ids[0], 'response': self.response()}],
                 [{'key': self.ids[0], 'response': self.response()}] * 2,
                 [{'key': 'unexpected', 'response': self.response()}, {'key': self.ids[1], 'response': self.response()}]]
        for records in cases:
            with self.subTest(records=records), self.assertRaises(pro.core.SafeError): self.collect(records)
        self.assertFalse(list(self.folder.glob('story-*.json')))

    def test_wrong_model_and_max_tokens_never_enter_cache(self):
        self.prepare(); self.bind_submit()
        records = [{'key': self.ids[0], 'response': self.response(model='wrong')},
                   {'key': self.ids[1], 'response': self.response(reason='MAX_TOKENS')}]
        self.assertEqual(self.collect(records), 1)
        self.assertFalse(list(self.folder.glob('story-*.json')))

    def test_collect_refuses_active_batch_and_raw_overwrite_after_collection(self):
        self.prepare(); self.bind_submit()
        with pro.backend(), patch.object(pro.core, 'credential', return_value='RAM-only'), \
             patch.object(pro.core, 'fetch_status', return_value=({}, 'JOB_STATE_RUNNING')):
            with self.assertRaises(pro.core.SafeError): pro.collect(self.args, self.source, self.folder, self.run, self.rows)
        self.collect()
        with self.assertRaises(pro.core.SafeError): self.collect()

    def test_download_collection_reads_credential_only_once(self):
        self.prepare(); self.bind_submit()
        data = ''.join(json.dumps({'key': ident, 'response': self.response()}) + '\n' for ident in self.ids[:2]).encode()
        with pro.backend(), patch.object(pro.core, 'credential', return_value='RAM-only') as key, \
             patch.object(pro.core, 'fetch_status', return_value=({'response': {'responsesFile': 'files/pro-result'}}, 'JOB_STATE_SUCCEEDED')), \
             patch.object(pro.core, 'api', return_value=(data, {})):
            self.assertEqual(pro.collect(self.args, self.source, self.folder, self.run, self.rows), 0)
            self.assertEqual(key.call_count, 1)

    def test_unknown_submission_intent_never_duplicates_paid_job(self):
        self.prepare()
        def failed(args, run):
            self.assertTrue((run / 'submit-intent.private.json').exists())
            self.assertEqual(pro.core.MODEL, pro.MODEL)
            raise pro.core.SafeError('Unknown outcome')
        with pro.backend(), patch.object(pro.core, 'credential', return_value='RAM-only'), \
             patch.object(pro.core, 'submit', side_effect=failed) as submit:
            with self.assertRaises(pro.core.SafeError): pro.transport.submit(self.args, self.source, self.run, self.rows)
            with self.assertRaises(pro.core.SafeError): pro.transport.submit(self.args, self.source, self.run, self.rows)
            self.assertEqual(submit.call_count, 1)

    def test_pro_scope_bound_cannot_be_changed_after_prepare(self):
        self.prepare()
        scope = pro.core.read_json(self.run / 'pro-scope.private.json'); scope['max_calls'] = 1
        pro.core.save(self.run / 'pro-scope.private.json', scope)
        with self.assertRaises(pro.core.SafeError): pro.validate_scope(self.run)
        scope['max_calls'] = 3
        pro.core.save(self.run / 'pro-scope.private.json', scope)
        with self.assertRaises(pro.core.SafeError): pro.validate_scope(self.run)

    def test_empty_or_oversized_audio_has_no_paid_fallback(self):
        with self.assertRaises(pro.core.SafeError): pro.request_for(b'')
        with patch.object(pro, 'transport_original_request', return_value={'contents': 'x' * 19_000_001}):
            with self.assertRaises(pro.core.SafeError): pro.request_for(b'MP3')

    def test_private_response_path_cannot_escape_namespace(self):
        self.prepare(); self.bind_submit(); self.collect(); record, sha, textsha = self.record()
        for value in ['/tmp/raw.json', '../../elsewhere', 'clips/raw.json']:
            changed = copy.deepcopy(record); changed['batch_response_file'] = value
            with self.subTest(value=value): self.assertFalse(pro.cached_record(changed, sha, textsha))


if __name__ == '__main__': unittest.main()
