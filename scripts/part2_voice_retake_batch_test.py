"""Offline guard/lifecycle fixtures. Synthetic audio is never production evidence."""
import argparse
import base64
import copy
from contextlib import redirect_stdout
import io
import json
import math
from pathlib import Path
import shutil
import struct
import tempfile
import unittest
from unittest.mock import patch
import wave
import part2_voice_retake_batch as r


def wav_bytes(seconds=.5, tone=False):
    stream = io.BytesIO()
    with wave.open(stream, 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(24000)
        frames = [int(6000*math.sin(2*math.pi*440*index/24000)) if tone else 0 for index in range(int(24000*seconds))]
        audio.writeframes(struct.pack('<'+'h'*len(frames), *frames))
    return stream.getvalue()


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.private = self.root/'output/audio/part2-voice'
        self.patchers = [patch.multiple(r, ROOT=self.root, PRIVATE=self.private, PARENT_COUNT=3),
                         patch.multiple(r.batch, ROOT=self.root, PRIVATE=self.private),
                         patch.object(r.batch, 'current_inventory', return_value='a'*64),
                         patch.object(r.batch, 'preserved_banks', side_effect=lambda _: copy.deepcopy(self.preserved)),
                         patch.object(r, 'dedup_roots', side_effect=lambda: [self.root])]
        self.preserved = {'prolog': {'clip_count': 188, 'files_sha256': {'manifest.json': 'a'*64}},
                          'story': {'clip_count': 1490, 'files_sha256': {'manifest.json': 'b'*64}}}
        for item in self.patchers: item.start()
        (self.root/'scripts').mkdir()
        for path in [r.__file__, r.batch.__file__, r.core.__file__, r.common.__file__]:
            (self.root/'scripts'/Path(path).name).write_bytes(Path(path).read_bytes())
        (self.root/'scripts/part2_voice_inventory.mjs').write_text('// Test-only AST stub\n')
        source = self.root/'game/src/chapters/teil-2/one.ts'
        source.parent.mkdir(parents=True)
        source.write_text("w.say('e2-lia', 'Weiter.');\n")
        self.profiles = {'speakers': {'lia': {'google_voice': 'Laomedeia'}}}
        self.ids = ['part2-'+str(index)*24 for index in [1, 2, 3]]
        self.manifest = {'model': r.MODEL, 'unresolved': [], 'aliases': {'e2-lia': 'lia'}, 'scene_players': {'e2-taverne': 'lia'},
                         'source_hashes': {str(source.relative_to(self.root)): r.digest(source)}, 'lines': [], 'runtime_lookup': []}
        for ident, text in zip(self.ids, ['Weiter.', 'Halt.', 'Uff.']):
            route = {'kind': 'say', 'speaker': 'e2-lia', 'text': text, 'scene': 'e2-taverne', 'mood': 'neutral'}
            self.manifest['lines'].append({'id': ident, 'speaker': 'lia', 'text': text, 'display_text': text,
                'scene': 'e2-taverne', 'kind': 'say', 'direction_en': 'Sachlich auf Deutsch.',
                'sources': [{'file': str(source.relative_to(self.root)), 'start': 0, 'end': 28}], 'runtime_keys': [route]})
            self.manifest['runtime_lookup'].append({**route, 'asset_id': ident})
        self.parent = r.batch.directory(self.private/'parent')
        profile_path, manifest_path = self.root/'profiles.json', self.root/'manifest.json'
        r.core.save(profile_path, self.profiles); r.core.save(manifest_path, self.manifest)
        with redirect_stdout(io.StringIO()):
            r.batch.prepare(argparse.Namespace(profiles=profile_path, manifest=manifest_path), self.parent)
        initial_requests = r.records(self.parent/'requests.jsonl')
        for record in initial_requests:
            ident = record['key']
            wav, mp3 = self.parent/'raw'/(ident+'.wav'), self.parent/'clips'/(ident+'.mp3')
            wav.parent.mkdir(exist_ok=True); mp3.parent.mkdir(exist_ok=True)
            wav.write_bytes(wav_bytes()); mp3.write_bytes(b'synthetic-fixture-not-production-'+ident.encode())
            r.core.save(self.parent/'raw'/(ident+'.receipt.json'), {'status': 'complete', 'seconds': .5,
                'request_sha256': r.sha(r.canonical(record['request']).encode()), 'wav_sha256': r.digest(wav), 'mp3_sha256': r.digest(mp3)})
        for directory in ['http-raw', 'asr-raw', 'word-cues']: (self.parent/directory).mkdir()
        r.core.save(self.parent/'word-cues/alignment.private.json', {'fixture': True})
        for name in ['qa.private.json', 'qa-asr-cache.private.json', 'public-manifest.proposed.json']:
            r.core.save(self.parent/name, {'fixture': True})
        (self.parent/'responses.private.jsonl').write_text('{"fixture":"original immutable provider bytes"}\n')
        r.core.save(self.parent/'collection.private.json', {'collected': 3, 'expected': 3, 'failures': []})
        r.core.save(self.parent/'job.json', {'state': 'JOB_STATE_SUCCEEDED'})
        r.core.save(self.parent/'status.private.json', {'state': 'JOB_STATE_SUCCEEDED'})
        r.core.save(self.parent/'submit-intent.private.json', {'state': 'CONFIRMED'})
        r.core.save(self.parent/'collect-intent.private.json', {'state': 'COLLECTED_ONCE', 'response_sha256': r.digest(self.parent/'responses.private.jsonl')})
        self.parent, self.run = r.locations(self.parent, 'retake')
        self.overrides = {ident: {'delivery_style': 'Ruhig und deutlich auf Deutsch.'} for ident in self.ids}
        self.styles_path = self.root/'styles.private.json'; r.core.save(self.styles_path, self.overrides)
        self.args = argparse.Namespace(only_ids=','.join(reversed(self.ids)), delivery_overrides=self.styles_path,
            approval=None, key_stdin=True, keychain_service=None, keychain_account=None, public_dir=None)

    def tearDown(self):
        for item in reversed(self.patchers): item.stop()
        self.temp.cleanup()

    def preview(self):
        with redirect_stdout(io.StringIO()): r.preview(self.args, self.parent, self.run)
        return r.read(self.run/'preview.private.json')

    def approve_styles(self, value):
        fields = ['model', 'parent_prepared_sha256', 'parent_manifest_sha256', 'profiles_sha256',
                  'delivery_overrides_sha256', 'selected_ids', 'new_request_sha256']
        approved = {key: value[key] for key in fields}
        approved.update(status='approved_part2_retake_styles', reviewed_by='root',
                        preview_sha256=r.digest(self.run/'preview.private.json'), source_cast_and_regie_reviewed=True)
        self.args.approval = self.root/'style-approval.private.json'; r.core.save(self.args.approval, approved)

    def freeze(self):
        self.approve_styles(self.preview())
        with redirect_stdout(io.StringIO()): r.prepare(self.args, self.parent, self.run)
        return r.prepared(self.run, self.parent)

    def approve_submit(self):
        info = r.prepared(self.run, self.parent)
        approved = {key: info[key] for key in ['model', 'input_sha256', 'request_count', 'selected_ids']}
        approved.update(status='approved_part2_retake_batch_submission', reviewed_by='root',
            prepared_sha256=r.digest(self.run/'prepared.json'), preview_sha256=r.digest(self.run/'preview.private.json'), source_cast_and_regie_reviewed=True)
        self.args.approval = self.root/'submit-approval.private.json'; r.core.save(self.args.approval, approved)

    def response(self, model=r.MODEL, data=None):
        data = wav_bytes() if data is None else data
        return [{'key': ident, 'response': {'modelVersion': model, 'usageMetadata': {'totalTokenCount': 12},
            'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'inlineData': {'mimeType': 'audio/wav', 'data': base64.b64encode(data).decode()}}]}}]}}
            for ident in self.ids]

    def retained(self, rows=None):
        rows = self.response() if rows is None else rows
        (self.run/'responses.private.jsonl').write_text(''.join(json.dumps(row)+'\n' for row in rows))
        r.core.save(self.run/'response-origin.private.json', {'response_sha256': r.digest(self.run/'responses.private.jsonl')})
        r.core.save(self.run/'collect-intent.private.json', {'state': 'COLLECT_ATTEMPT_RECORDED'})

    def fake_normalize(self, _wav, mp3):
        mp3.write_bytes(b'normalized-synthetic-fixture-only')
        return {'input_i': '-19', 'input_tp': '-1', 'input_lra': '1', 'input_thresh': '-29', 'target_offset': '0'}

    def test_style_only_frozen_subset_retains_source_preset_locale_and_routes(self):
        parent_before = r.protected_parent(self.parent)
        self.freeze()
        incoming = r.records(self.run/'requests.jsonl'); original = r.records(self.parent/'requests.jsonl')
        for old, new in zip(original, incoming):
            self.assertEqual(new['request']['contents'][0]['parts'][0]['text'], old['request']['contents'][0]['parts'][0]['text'])
            self.assertEqual(new['request']['generationConfig'], old['request']['generationConfig'])
            self.assertEqual(new['request']['generationConfig']['speechConfig']['languageCode'], 'de-DE')
        subset = r.read(self.run/'lines.private.json')
        self.assertEqual(subset['runtime_lookup'], self.manifest['runtime_lookup'])
        self.assertEqual(subset['source_hashes'], self.manifest['source_hashes'])
        self.assertEqual(parent_before, r.protected_parent(self.parent))

    def test_prepare_requires_reviewed_root_preview_and_separate_submit_approval(self):
        self.preview()
        with self.assertRaises(r.SafeError): r.prepare(self.args, self.parent, self.run)
        self.approve_styles(r.read(self.run/'preview.private.json'))
        with redirect_stdout(io.StringIO()): r.prepare(self.args, self.parent, self.run)
        with self.assertRaises(r.SafeError): r.submission_approval(self.args, self.run, self.parent)
        self.approve_submit(); r.submission_approval(self.args, self.run, self.parent)

    def test_no_refreeze_after_preview_input_change(self):
        self.approve_styles(self.preview()); self.overrides[self.ids[0]]['delivery_style'] = 'Neue Regie.'
        r.core.save(self.styles_path, self.overrides)
        with self.assertRaises(r.SafeError): r.prepare(self.args, self.parent, self.run)
        self.assertFalse((self.run/'prepared.json').exists())

    def test_text_vocal_split_or_pronunciation_experiments_are_rejected(self):
        for key in ['retake_text', 'vocal_events', 'text_part_styles', 'pronunciation_breaks']:
            value = copy.deepcopy(self.overrides); value[self.ids[0]][key] = 'unapproved'
            r.core.save(self.styles_path, value)
            with self.subTest(key=key), self.assertRaises(r.SafeError): r.load_overrides(self.styles_path, self.ids)

    def test_empty_duplicate_unknown_oversized_or_unchanged_subset_is_refused(self):
        for ids in ['', ','.join([self.ids[0], self.ids[0]]), 'part2-'+'9'*24]:
            self.args.only_ids = ids
            with self.subTest(ids=ids), self.assertRaises(r.SafeError): r.build_preview(self.args, self.parent, self.run)
        self.args.only_ids = ','.join(self.ids)
        with patch.object(r, 'MAX_RETAKES', 2), self.assertRaises(r.SafeError): r.build_preview(self.args, self.parent, self.run)
        self.overrides[self.ids[0]]['delivery_style'] = 'Sachlich auf Deutsch.'; r.core.save(self.styles_path, self.overrides)
        with self.assertRaises(r.SafeError): r.build_preview(self.args, self.parent, self.run)

    def test_wrong_parent_bank_count_or_nonterminal_collection_refused(self):
        with patch.object(r, 'PARENT_COUNT', 1401), self.assertRaises(r.SafeError): r.parent_state(self.parent)
        r.core.save(self.parent/'job.json', {'state': 'JOB_STATE_RUNNING'})
        with self.assertRaises(r.SafeError): r.parent_state(self.parent)

    def test_source_drift_blocks_paid_live_review_but_retained_frozen_take_remains_readable(self):
        self.freeze()
        source = self.root/next(iter(self.manifest['source_hashes'])); source.write_text('source changed')
        r.prepared(self.run, self.parent)
        with self.assertRaises(r.SafeError): r.prepared(self.run, self.parent, live=True)

    def test_parent_wav_mp3_receipt_qa_and_cues_are_all_hash_protected(self):
        self.freeze()
        for name in ['clips/'+self.ids[0]+'.mp3', 'raw/'+self.ids[0]+'.wav', 'raw/'+self.ids[0]+'.receipt.json',
                     'qa.private.json', 'qa-asr-cache.private.json', 'word-cues/alignment.private.json', 'responses.private.jsonl']:
            path = self.parent/name; original = path.read_bytes(); path.write_bytes(original+b'changed')
            with self.subTest(name=name), self.assertRaises((r.SafeError, ValueError)): r.prepared(self.run, self.parent)
            path.write_bytes(original)

    def test_frozen_payload_manifest_and_approval_cannot_be_forged(self):
        self.freeze()
        payload = self.run/'requests.jsonl'; payload.write_bytes(payload.read_bytes().replace(b'Weiter.', b'Anders.'))
        with self.assertRaises(r.SafeError): r.prepared(self.run, self.parent)

    def test_prepared_file_census_cannot_drop_source_or_style_guards(self):
        self.freeze(); path = self.run/'prepared.json'; info = r.read(path)
        info['frozen_sha256'].pop('lines.private.json'); r.core.save(path, info)
        with self.assertRaises(r.SafeError): r.prepared(self.run, self.parent)

    def test_child_raw_directory_symlink_cannot_overwrite_initial_provider_wav(self):
        self.freeze(); self.retained(); before = r.protected_parent(self.parent)
        (self.run/'raw').symlink_to(self.parent/'raw', target_is_directory=True)
        with patch.object(r.core, 'normalize') as normalize, self.assertRaises(r.SafeError): r.resume_collection(self.args, self.parent, self.run)
        normalize.assert_not_called(); self.assertEqual(r.protected_parent(self.parent), before)

    def test_prolog188_and_story1490_bytes_remain_bound(self):
        self.freeze(); self.preserved['story']['files_sha256']['manifest.json'] = 'c'*64
        with self.assertRaises(r.SafeError): r.prepared(self.run, self.parent)

    def test_same_request_paid_in_another_worktree_or_reserved_bank_is_refused(self):
        value = self.preview(); other = self.root/'other/output/audio/story-voice/paid'; other.mkdir(parents=True)
        (other/'requests.jsonl').write_text(json.dumps(value['records'][0])+'\n'); r.core.save(other/'submit-intent.private.json', {'state': 'OUTCOME_UNCONFIRMED'})
        with self.assertRaises(r.SafeError): r.dedup_check(self.run, value['records'], [self.root/'other'])
        ledger = self.root/'output/audio/voice-request-reservations.private.json'
        r.core.save(ledger, {next(iter(value['new_request_sha256'].values())): {'run': 'another-bank'}})
        with self.assertRaises(r.SafeError): r.dedup_check(self.run, value['records'])

    def test_actual_standard_receipt_request_hash_also_blocks_duplicate_payment(self):
        value = self.preview(); receipt = self.root/'output/audio/story-voice/standard/raw/one.receipt.json'
        legacy = r.sha(json.dumps(value['records'][0]['request'], sort_keys=True).encode())
        r.core.save(receipt, {'status': 'complete', 'request_sha256': legacy})
        with self.assertRaises(r.SafeError): r.dedup_check(self.run, value['records'])

    def test_unsubmitted_preview_lineage_is_reported_without_claiming_payment(self):
        value = self.preview(); path = self.parent/'unsubmitted/requests-body8.UNAPPROVED.jsonl'; path.parent.mkdir()
        path.write_text(json.dumps(value['records'][0])+'\n')
        census = r.dedup_check(self.run, value['records'])
        self.assertEqual(census['unsubmitted_same_request_previews'][0]['ids'], [self.ids[0]])
        self.assertFalse(census['unsubmitted_same_request_previews'][0]['paid_or_attempted'])

    def test_reservations_are_owner_bound_and_no_environment_key_source_exists(self):
        value = self.preview(); r.reserve(self.run, value['records']); r.reserve(self.run, value['records'])
        with self.assertRaises(r.SafeError): r.reserve(self.run.parent/'another', value['records'])
        with patch.dict('os.environ', {'GOOGLE_API_KEY': 'fixture-not-read'}), self.assertRaises(r.SafeError): r.credential(argparse.Namespace(key_stdin=False))
        fields = {action.dest for action in r.parser()._actions}
        for forbidden in ['keychain_service', 'api_key', 'public_dir', 'import_audio']: self.assertNotIn(forbidden, fields)
        self.assertNotIn('import', r.parser()._actions[1].choices)

    def test_unknown_submit_never_reads_credentials_or_performs_network(self):
        r.core.save(self.run/'submit-intent.private.json', {'state': 'OUTCOME_UNCONFIRMED'})
        with patch.object(r, 'credential') as credential, patch.object(r.core, 'submit') as submit, self.assertRaises(r.SafeError):
            r.submit(self.args, self.parent, self.run)
        credential.assert_not_called(); submit.assert_not_called()

    def test_new_unknown_submit_records_intent_before_api_and_cannot_repeat(self):
        self.freeze(); self.approve_submit()
        def fail(*_):
            self.assertTrue((self.run/'submit-intent.private.json').exists())
            raise r.SafeError('Synthetic unknown response')
        with patch.object(r, 'credential', return_value='fixture-not-logged'), patch.object(r.core, 'submit', side_effect=fail):
            with self.assertRaises(r.SafeError): r.submit(self.args, self.parent, self.run)
        self.assertEqual(r.read(self.run/'submit-intent.private.json')['state'], 'OUTCOME_UNCONFIRMED')
        with patch.object(r.core, 'submit') as submit, self.assertRaises(r.SafeError): r.submit(self.args, self.parent, self.run)
        submit.assert_not_called()
        self.assertNotIn('fixture-not-logged', (self.run/'submit-intent.private.json').read_text())

    def test_collect_unknown_intent_blocks_even_status_fetch(self):
        r.core.save(self.run/'collect-intent.private.json', {'state': 'COLLECT_ATTEMPT_RECORDED'})
        with patch.object(r.core, 'fetch_status') as fetch, self.assertRaises(r.SafeError): r.collect(self.args, self.parent, self.run)
        fetch.assert_not_called()

    def test_download_bytes_are_retained_before_invalid_json_or_model_guard(self):
        self.freeze()
        r.core.save(self.run/'status.private.json', {'response': {'responsesFile': 'files/test'}})
        with patch.object(r.core, 'api', return_value=(b'{invalid-json', {})):
            r.persist_responses(self.run, {'response': {'responsesFile': 'files/test'}}, 'fixture-not-logged')
        self.assertEqual((self.run/'responses.private.jsonl').read_bytes(), b'{invalid-json')
        with self.assertRaises(ValueError): r.inspect_responses(self.run)
        self.assertFalse((self.run/'raw').exists())

    def test_actual_model_unknown_ids_duplicates_and_pcm_wrapper_are_refused_before_normalization(self):
        self.freeze()
        for mutation in ['wrong-model', 'duplicate', 'unknown-id', 'pcm']:
            rows = self.response()
            if mutation == 'wrong-model': rows[0]['response']['modelVersion'] = 'not-the-requested-model'
            if mutation == 'duplicate': rows.append(copy.deepcopy(rows[0]))
            if mutation == 'unknown-id': rows[0]['key'] = 'part2-'+'9'*24
            if mutation == 'pcm': rows[0]['response']['candidates'][0]['content']['parts'][0]['inlineData']['mimeType'] = 'audio/l16'
            self.retained(rows)
            with self.subTest(mutation=mutation), patch.object(r.core, 'normalize') as normalize, self.assertRaises(r.SafeError): r.collect_offline(self.args, self.parent, self.run)
            normalize.assert_not_called(); self.assertFalse((self.run/'raw').exists())

    def test_max_tokens_audio_candidate_cannot_become_a_complete_normalized_receipt(self):
        self.freeze(); rows = self.response()
        rows[0]['response']['candidates'][0]['finishReason'] = 'MAX_TOKENS'; self.retained(rows)
        raw_before = (self.run/'responses.private.jsonl').read_bytes()
        with patch.object(r.core, 'normalize') as normalize, self.assertRaises(r.SafeError): r.collect_offline(self.args, self.parent, self.run)
        normalize.assert_not_called(); self.assertFalse((self.run/'raw').exists())
        self.assertEqual((self.run/'responses.private.jsonl').read_bytes(), raw_before)
        self.assertEqual(r.read(self.run/'collect-intent.private.json')['state'], 'COLLECT_ATTEMPT_RECORDED')

    def test_two_valid_stop_audio_candidates_are_not_silently_reduced_to_the_first(self):
        self.freeze(); rows = self.response()
        rows[0]['response']['candidates'].append(copy.deepcopy(rows[0]['response']['candidates'][0])); self.retained(rows)
        raw_before = (self.run/'responses.private.jsonl').read_bytes()
        with patch.object(r.core, 'normalize') as normalize, self.assertRaises(r.SafeError): r.collect_offline(self.args, self.parent, self.run)
        normalize.assert_not_called(); self.assertFalse((self.run/'raw').exists())
        self.assertEqual((self.run/'responses.private.jsonl').read_bytes(), raw_before)

    def test_missing_empty_or_contradictory_candidate_finish_reason_is_refused(self):
        self.freeze()
        for mode in ['missing', 'empty', 'contradictory', 'zero-candidates']:
            rows = self.response(); candidate = rows[0]['response']['candidates'][0]
            if mode == 'missing': del candidate['finishReason']
            elif mode == 'empty': candidate['finishReason'] = ''
            elif mode == 'contradictory': candidate['finish_reason'] = 'MAX_TOKENS'
            else: rows[0]['response']['candidates'] = []
            self.retained(rows)
            with self.subTest(mode=mode), patch.object(r.core, 'normalize') as normalize, self.assertRaises(r.SafeError): r.collect_offline(self.args, self.parent, self.run)
            normalize.assert_not_called(); self.assertFalse((self.run/'raw').exists())

    def test_one_explicit_stop_candidate_with_sdk_alias_is_unambiguous(self):
        self.freeze(); rows = self.response()
        for row in rows:
            candidate = row['response']['candidates'][0]
            candidate['finish_reason'] = candidate.pop('finishReason')
        self.retained(rows); self.assertEqual(set(r.inspect_responses(self.run)), set(self.ids))

    def test_offline_collection_preserves_original_wav_and_creates_actual_model_request_receipts(self):
        self.freeze(); parent_before = r.protected_parent(self.parent); self.retained()
        with patch.object(r.core, 'normalize', side_effect=self.fake_normalize), redirect_stdout(io.StringIO()):
            r.resume_collection(self.args, self.parent, self.run)
        for ident in self.ids:
            self.assertEqual((self.run/'raw'/(ident+'.wav')).read_bytes(), wav_bytes())
            receipt = r.read(self.run/'raw'/(ident+'.receipt.json'))
            self.assertEqual(receipt['model'], r.MODEL); self.assertEqual(receipt['actual_provider_model'], r.MODEL)
            self.assertEqual(receipt['normalization_input'], 'original_provider_wav_no_wrapper')
            self.assertEqual(receipt['request_sha256'], r.read(self.run/'preview.private.json')['new_request_sha256'][ident])
        self.assertEqual(r.protected_parent(self.parent), parent_before)
        proposal = r.read(self.run/'public-manifest.proposed.json')
        self.assertEqual(proposal['clips'][0]['audio'], 'audio/teil-2/'+self.ids[0]+'.mp3')
        self.assertEqual(proposal['scene_players'], self.manifest['scene_players'])
        with patch.object(r.core, 'api') as api, self.assertRaises(r.SafeError): r.resume_collection(self.args, self.parent, self.run)
        api.assert_not_called()

    def test_offline_resume_never_calls_provider_and_refuses_changed_retained_bytes(self):
        self.freeze(); self.retained()
        (self.run/'responses.private.jsonl').write_bytes(b'changed')
        with patch.object(r.core, 'api') as api, self.assertRaises(r.SafeError): r.resume_collection(self.args, self.parent, self.run)
        api.assert_not_called()

    @unittest.skipUnless(shutil.which('ffmpeg'), 'Actual ffmpeg unavailable')
    def test_real_ffmpeg_normalization_leaves_fixture_provider_wav_bytes_identical(self):
        self.freeze(); original = wav_bytes(1, tone=True); self.retained(self.response(data=original))
        with redirect_stdout(io.StringIO()): r.resume_collection(self.args, self.parent, self.run)
        for ident in self.ids:
            self.assertEqual((self.run/'raw'/(ident+'.wav')).read_bytes(), original)
            receipt = r.read(self.run/'raw'/(ident+'.receipt.json'))
            self.assertTrue((self.run/'clips'/(ident+'.mp3')).stat().st_size > 1000)
            self.assertEqual(receipt['normalization'], {'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11})
            self.assertIn('input_i', receipt['loudness_input'])

    def test_transport_restores_all_protected_driver_hooks_after_failure(self):
        self.freeze()
        old = (r.core.ROOT, r.core.PRIVATE, r.core.prepared, r.core.api, r.core.credential, r.common.prepared)
        with self.assertRaises(RuntimeError):
            with r.transport(self.run, self.parent): raise RuntimeError('fixture')
        self.assertEqual(old, (r.core.ROOT, r.core.PRIVATE, r.core.prepared, r.core.api, r.core.credential, r.common.prepared))

    def test_symlink_child_and_outside_parent_locations_are_refused(self):
        target = self.root/'foreign'; target.mkdir()
        (self.parent/'retake-driver'/'linked').symlink_to(target, target_is_directory=True)
        with self.assertRaises(r.SafeError): r.locations(self.parent, 'linked')
        with self.assertRaises(r.SafeError): r.locations(self.root, 'outside')
        with self.assertRaises(r.SafeError): r.locations(self.parent, '../escape')


if __name__ == '__main__': unittest.main()
