"""Offline contract tests; synthetic fixtures are never production evidence."""
import argparse
import copy
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
import part2_voice_batch as b


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.private = self.root/'output/audio/part2-voice'
        self.root_patch = patch.multiple(b, ROOT=self.root, PRIVATE=self.private)
        self.root_patch.start()
        (self.root/'scripts').mkdir()
        for path in [b.__file__, b.core.__file__, b.common.__file__]:
            (self.root/'scripts'/Path(path).name).write_bytes(Path(path).read_bytes())
        source = self.root/'game/src/chapters/teil-2/one.ts'
        source.parent.mkdir(parents=True)
        source.write_text("w.say('e2-lia', 'Weiter.');\n")
        route = {'kind': 'say', 'speaker': 'e2-lia', 'text': 'Weiter.', 'scene': 'e2-taverne', 'mood': 'neutral'}
        self.profiles = {'speakers': {'lia': {'google_voice': 'Laomedeia', 'api_prompt_en': 'Fixed reference only'}}}
        self.manifest = {'model': b.core.MODEL, 'unresolved': [], 'aliases': {'e2-lia': 'lia'},
                         'scene_players': {'e2-taverne': 'lia'}, 'source_hashes': {str(source.relative_to(self.root)): b.digest(source)},
                         'lines': [{'id': 'part2-'+'1'*24, 'speaker': 'lia', 'text': 'Weiter.', 'display_text': 'Weiter.',
                                    'scene': 'e2-taverne', 'kind': 'say', 'direction_en': 'Entschlossen auf Deutsch.',
                                    'sources': [{'file': str(source.relative_to(self.root)), 'start': 0, 'end': 28}], 'runtime_keys': [route]}],
                         'runtime_lookup': [{**route, 'asset_id': 'part2-'+'1'*24}]}
        self.run = b.directory(self.private/'one')
        self.profiles_path, self.manifest_path = self.root/'profiles.json', self.root/'lines.json'
        b.core.save(self.profiles_path, self.profiles)
        b.core.save(self.manifest_path, self.manifest)
        self.args = argparse.Namespace(profiles=self.profiles_path, manifest=self.manifest_path, approval=None,
                                       key_stdin=True, keychain_service=None, keychain_account=None, public_dir=None)

    def tearDown(self):
        self.root_patch.stop()
        self.temp.cleanup()

    def freeze(self):
        with patch.object(b, 'current_inventory', return_value='a'*64), patch.object(b, 'preserved_banks', return_value={}):
            b.prepare(self.args, self.run)

    def test_prepare_verbatim_text_short_style_fixed_preset_and_german(self):
        self.freeze()
        b.prepared(self.run)
        request = json.loads((self.run/'requests.jsonl').read_text())['request']
        self.assertEqual(request['contents'][0]['parts'], [{'text': 'Weiter.', 'speechMetadata': {'style': 'Entschlossen auf Deutsch.'}}])
        self.assertEqual(request['generationConfig']['speechConfig'], {'voiceConfig': {'voice': 'Laomedeia'}, 'languageCode': 'de-DE'})
        self.assertNotIn('Fixed reference only', json.dumps(request))

    def test_current_source_drift_blocks_live_but_keeps_paid_frozen_receipts_readable(self):
        self.freeze()
        path = self.root/next(iter(self.manifest['source_hashes']))
        path.write_text('changed')
        b.prepared(self.run)
        with self.assertRaises(b.SafeError):
            b.prepared(self.run, live=True)

    def test_frozen_payload_cannot_be_edited(self):
        self.freeze()
        (self.run/'requests.jsonl').write_text('{}\n')
        with self.assertRaises(b.SafeError):
            b.prepared(self.run)

    def test_invalid_inventory_guards(self):
        for mutation in ['unresolved', 'dynamic', 'duplicate', 'routes', 'voice', 'bank']:
            manifest, profiles = copy.deepcopy(self.manifest), copy.deepcopy(self.profiles)
            if mutation == 'unresolved': manifest['unresolved'] = [{'source': 'unknown'}]
            if mutation == 'dynamic': manifest['lines'][0]['text'] = '${name}'
            if mutation == 'duplicate': manifest['lines'].append(copy.deepcopy(manifest['lines'][0]))
            if mutation == 'routes': manifest['runtime_lookup'] = []
            if mutation == 'voice': profiles['speakers']['lia']['google_voice'] = ''
            if mutation == 'bank': manifest['lines'][0]['id'] = 'story-'+'1'*24
            with self.subTest(mutation=mutation), self.assertRaises(b.SafeError):
                b.validate(profiles, manifest)

    def test_ambiguous_routes_are_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        row = copy.deepcopy(manifest['lines'][0]); row['id'] = 'part2-'+'2'*24
        manifest['lines'].append(row)
        manifest['runtime_lookup'].append({**row['runtime_keys'][0], 'asset_id': row['id']})
        with self.assertRaises(b.SafeError): b.validate(self.profiles, manifest)

    def test_scanner_owned_performance_variant_is_retained_without_new_runtime_behavior(self):
        manifest = copy.deepcopy(self.manifest)
        manifest['lines'][0]['runtime_keys'][0]['performance_variant'] = 'neutral'
        manifest['runtime_lookup'][0]['performance_variant'] = 'neutral'
        b.validate(self.profiles, manifest)
        self.assertEqual(manifest['lines'][0]['runtime_keys'][0]['performance_variant'], 'neutral')
        manifest['lines'][0]['runtime_keys'][0]['performance_variant'] = 42
        with self.assertRaises(b.SafeError): b.validate(self.profiles, manifest)

    def test_prepare_twice_is_refused(self):
        self.freeze()
        with self.assertRaises(b.SafeError): b.prepare(self.args, self.run)

    def test_run_cannot_target_story_or_public(self):
        for path in [self.root/'output/audio/story-voice/run', self.root/'game/public/audio/teil-2', self.private]:
            with self.subTest(path=path), self.assertRaises(b.SafeError): b.directory(path)

    def test_credential_surface_has_no_env_or_keychain_switch(self):
        actions = {action.dest for action in b.parser()._actions}
        self.assertIn('key_stdin', actions)
        self.assertNotIn('keychain_service', actions)
        self.assertNotIn('api_key', actions)

    def test_cross_bank_same_request_reservation_refused(self):
        self.freeze()
        previous = self.root/'output/audio/story-voice/paid'
        previous.mkdir(parents=True)
        (previous/'requests.jsonl').write_bytes((self.run/'requests.jsonl').read_bytes())
        b.core.save(previous/'job.json', {'state': 'SUBMITTED'})
        with self.assertRaises(b.SafeError): b.reserve(self.run)

    def test_global_reservations_refuse_other_run_and_allow_same_frozen_owner(self):
        self.freeze()
        b.reserve(self.run); b.reserve(self.run)
        other = b.directory(self.private/'other')
        (other/'requests.jsonl').write_bytes((self.run/'requests.jsonl').read_bytes())
        with self.assertRaises(b.SafeError): b.reserve(other)

    def test_ambiguous_submit_is_never_retried_and_does_not_read_credential(self):
        b.core.save(self.run/'submit-intent.private.json', {'state': 'OUTCOME_UNCONFIRMED'})
        with patch.object(b.core, 'credential') as credential, self.assertRaises(b.SafeError): b.submit(self.args, self.run)
        credential.assert_not_called()

    def test_collect_once_guard_prevents_network(self):
        b.core.save(self.run/'collect-intent.private.json', {'state': 'COLLECT_ATTEMPT_RECORDED'})
        with patch.object(b.core, 'fetch_status') as fetch, self.assertRaises(b.SafeError): b.collect(self.args, self.run)
        fetch.assert_not_called()

    def test_root_approval_binds_exact_prepared_bytes(self):
        self.freeze()
        info = b.prepared(self.run)
        self.args.approval = self.run/'root.private.json'
        approved = {key: info[key] for key in ['model', 'input_sha256', 'profiles_sha256', 'manifest_sha256', 'request_count']}
        approved.update(status='approved_part2_batch_submission', reviewed_by='root',
                        prepared_sha256=b.digest(self.run/'prepared.json'), source_cast_and_regie_reviewed=True)
        b.core.save(self.args.approval, approved)
        with patch.object(b, 'current_inventory', return_value='a'*64): b.approval(self.args, self.run)
        approved['input_sha256'] = 'f'*64; b.core.save(self.args.approval, approved)
        with patch.object(b, 'current_inventory', return_value='a'*64), self.assertRaises(b.SafeError): b.approval(self.args, self.run)

    def test_invalid_json_response_is_retained_before_parse(self):
        class Response:
            headers = {}; status = 200
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self): return b'{not-json'
        with patch.object(b, 'provider_open', return_value=Response()), self.assertRaises(b.SafeError):
            b.response_api(self.run, None)('GET', b.core.BASE+'/v1beta/batches/test', 'unit-test-value')
        files = list((self.run/'http-raw').glob('*.response.private.bin'))
        self.assertEqual(len(files), 1); self.assertEqual(files[0].read_bytes(), b'{not-json')
        self.assertNotIn('unit-test-value', ''.join(path.read_text() for path in (self.run/'http-raw').glob('*.json')))

    def test_http_error_body_retained_without_printing_it(self):
        error = HTTPError(b.core.BASE, 400, 'bad', {}, BytesIO(b'{"error":"actual error body"}'))
        with patch.object(b, 'provider_open', side_effect=error), self.assertRaises(b.SafeError):
            b.response_api(self.run, None)('POST', b.core.BASE+'/v1beta/models/test', 'unit-test-value', {})
        files = list((self.run/'http-raw').glob('*.response.private.bin'))
        self.assertEqual(files[0].read_bytes(), b'{"error":"actual error body"}')

    def test_redirect_handler_never_follows_a_foreign_or_provider_redirect(self):
        from urllib.request import Request
        request = Request(b.core.BASE+'/v1beta/test', headers={'x-goog-api-key': 'unit-test-value'})
        handler = b.RejectRedirect()
        for destination in ['https://foreign.invalid/extract', b.core.BASE+'/other']:
            self.assertIsNone(handler.redirect_request(request, None, 302, 'redirect', {}, destination))

    def test_transport_context_restores_unchanged_drivers_on_failure(self):
        old = (b.core.ROOT, b.core.PRIVATE, b.core.prepared, b.core.api, b.common.prepared)
        with self.assertRaises(RuntimeError):
            with b.transport(self.run):
                self.assertIs(b.core.prepared, b.prepared)
                self.assertIs(b.common.prepared, b.prepared)
                raise RuntimeError('unit test')
        self.assertEqual(old, (b.core.ROOT, b.core.PRIVATE, b.core.prepared, b.core.api, b.common.prepared))


if __name__ == '__main__': unittest.main()
