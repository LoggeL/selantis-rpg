"""Synthetic offline mutation guards; no real approvals, models or forwards."""
import copy
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
import wave
from types import SimpleNamespace
from unittest.mock import patch
import numpy as np
import story_voice_child57_cases as m


class ExactTwoCases(unittest.TestCase):
    def line(self, ident):
        value = m.CASES[ident]
        return {'id': ident, 'text': value['text'], 'speaker': value['speaker']}

    def record(self, ident, events=None):
        payload = {'transcript': m.CASES[ident]['qc_transcript'],
            'events': copy.deepcopy(m.STUTTER_EVENTS if ident == m.STUTTER_ID else []) if events is None else events}
        return {'response': {'modelVersion': m.qc.MODEL, 'candidates': [{'finishReason': 'STOP',
            'content': {'parts': [{'text': json.dumps(payload)}]}}]}}

    def arrays(self, ident, tokens=None):
        tokens = tokens or m.CASES[ident]['raw_ipa'].split()
        labels = ['<pad>'] + sorted(set(tokens) | {'f', 'v', 'd', 't', 'ɑː'})
        labels += ['unused'+str(k) for k in range(392-len(labels))]
        vocab = {label: i for i, label in enumerate(labels)}
        classes = [value for token in tokens for value in [0, vocab[token]]]
        logits = np.full((1, len(classes), 392), -12, dtype=np.float32)
        for frame, value in enumerate(classes): logits[0, frame, value] = 8
        ids = logits[0].argmax(axis=-1)
        shifted = logits[0].astype(np.float64)-logits[0].max(axis=-1, keepdims=True)
        probs = np.exp(shifted); probs /= probs.sum(axis=-1, keepdims=True)
        events = [{'frame_index': frame, 'class_id': int(value), 'token': labels[value],
            'actual_argmax_softmax_probability': float(probs[frame, value])}
            for frame, value in enumerate(ids) if value]
        raw = ' '.join(tokens)
        return [logits, probs, ids, vocab, {'raw_ipa': raw, 'native_decode': raw, 'emitted_raw_tokens': events}]

    def test_only_actual_sources_speakers_and_complete_decoder_literals(self):
        for ident, value in m.CASES.items():
            line = self.line(ident)
            for channel in ['primary', 'qc']:
                evidence = m.words(line, value[channel+'_transcript'], channel)
                self.assertFalse(evidence['decoder_text_adopted'])
                for bad in [value[channel+'_transcript']+' extra', ' '.join(value[channel+'_transcript'].split()[1:]),
                    value['text'], value[channel+'_transcript'].replace('sitzt', 'steht').replace('wirklich', 'niemals')]:
                    with self.subTest(ident=ident, channel=channel, text=bad), self.assertRaises(m.core.SafeError):
                        m.words(line, bad, channel)
            for mutation in [{'id': m.EXCLUDED_ID}, {'text': value['text']+'? Zusatz'}, {'speaker': 'other'}]:
                with self.assertRaises(m.core.SafeError): m.case(dict(line, **mutation))

    def test_stutter_body_requires_all_seven_words_and_separate_native_prefix(self):
        evidence = m.words(self.line(m.STUTTER_ID), m.CASES[m.STUTTER_ID]['primary_transcript'], 'primary')
        self.assertEqual(evidence['literal_seven_body_words'], ['der', 'sitzt', 'jetzt', 'in', 'hartem', 'boden', 'ehrlich'])
        self.assertFalse(evidence['general_drop_or_segmentation_alias'])
        self.assertNotEqual(''.join(evidence['expected_tokens']), ''.join(evidence['observed_tokens']))
        self.assertIsNone(m.qa.source_gesture_category('d'))

    def test_craupor_kraupor_is_scoped_existing_spelling_not_foltan_alias(self):
        evidence = m.words(self.line(m.NAMES_ID), m.CASES[m.NAMES_ID]['qc_transcript'], 'qc')
        self.assertEqual(evidence['literal_four_non_name_words'], ['was', 'hat', 'wirklich', 'gesagt'])
        self.assertTrue(m.qa.named_spelling_equivalent('Craupor', 'Kraupor'))
        for other in ['Foltern', 'Voltan', 'Foltann', 'Foltanr']:
            self.assertFalse(m.qa.named_spelling_equivalent('Foltan', other))
        self.assertFalse(evidence['Foltan_decoder_spelling_alias'])

    def test_all_three_exact_breaths_are_preserved(self):
        evidence = m.qc_observation(self.line(m.STUTTER_ID), self.record(m.STUTTER_ID))
        self.assertEqual(evidence['actual_events'], m.STUTTER_EVENTS)
        self.assertIsNone(evidence['source_gesture_event_mapping'])
        bad_events = [[], m.STUTTER_EVENTS[:-1], m.STUTTER_EVENTS+[m.STUTTER_EVENTS[0]]]
        for index in range(3):
            for change in [{'category': 'muffled_vocalization'}, {'description': 'stutter'}, {'vocal_sound': 'd'}, {'confidence': .99}]:
                events = copy.deepcopy(m.STUTTER_EVENTS); events[index].update(change); bad_events.append(events)
        for events in bad_events:
            with self.assertRaises(m.core.SafeError): m.qc_observation(self.line(m.STUTTER_ID), self.record(m.STUTTER_ID, events))
        with self.assertRaises(m.core.SafeError):
            m.qc_observation(self.line(m.NAMES_ID), self.record(m.NAMES_ID, [m.STUTTER_EVENTS[0]]))

    def test_actual_full_native_outputs_and_exact_selected_observations(self):
        for ident in m.CASES:
            evidence = m.native_frames(self.line(ident), *self.arrays(ident))
            self.assertEqual(evidence['full_verbatim_free_ipa'], m.CASES[ident]['raw_ipa'])
            self.assertIsNone(evidence['model_phone_to_word_timestamps'])
        stutter = m.native_frames(self.line(m.STUTTER_ID), *self.arrays(m.STUTTER_ID))
        self.assertEqual([r['token'] for r in stutter['selected_events']], ['d', 'd', 'ɛ', 'ɾ'])
        names = m.native_frames(self.line(m.NAMES_ID), *self.arrays(m.NAMES_ID))
        self.assertEqual([r['token'] for r in names['Craupor']['actual_events']], ['k', 'r', 'aʊ', 'p', 'oː', 'ɾ'])
        self.assertEqual([r['token'] for r in names['Foltan']['actual_events']], ['f', 'ɔ', 'l', 't', 'a', 'n'])

    def test_missing_changed_prefix_name_or_terminal_phone_rejected(self):
        for ident in m.CASES:
            original = m.CASES[ident]['raw_ipa'].split()
            mutations = [original[1:], original[:-1], original+['n']]
            if ident == m.STUTTER_ID:
                mutations += [['t']+original[1:], original[:1]+original[2:]]
            else:
                for index, token in [(7, 'd'), (11, 't'), (25, 'v'), (29, 'ɑː')]:
                    changed = original[:]; changed[index] = token; mutations.append(changed)
            for tokens in mutations:
                with self.assertRaises(m.core.SafeError): m.native_frames(self.line(ident), *self.arrays(ident, tokens))

    def test_full_logits_softmax_argmax_events_and_vocabulary_bound(self):
        for ident in m.CASES:
            for matrix_index in [0, 1, 2]:
                arrays = self.arrays(ident); arrays[matrix_index].flat[0] += 1
                with self.assertRaises(m.core.SafeError): m.native_frames(self.line(ident), *arrays)
            arrays = self.arrays(ident); arrays[0] = arrays[0].astype(np.float64)
            with self.assertRaises(m.core.SafeError): m.native_frames(self.line(ident), *arrays)
            arrays = self.arrays(ident); arrays[4]['emitted_raw_tokens'][0]['frame_index'] += 1
            with self.assertRaises(m.core.SafeError): m.native_frames(self.line(ident), *arrays)
            arrays = self.arrays(ident); arrays[3].pop('unused0')
            with self.assertRaises(m.core.SafeError): m.native_frames(self.line(ident), *arrays)

    def test_complete_individual_root_review_and_no_approved_template(self):
        for ident in m.CASES:
            line = self.line(ident)
            template = {'id': ident, 'status': 'root_review_required', 'reviewed_by': '', 'reason': '',
                'method': m.VERSION, 'clip_sha256': 'synthetic current', 'source_text_sha256': 'synthetic source',
                'source_row': line, 'lexical_only_clearance': True, 'parent_import_and_full_QA_required': False}
            # Synthetic in-memory condition testing only; no real approval file.
            approval = dict(copy.deepcopy(template), status=m.APPROVED, reviewed_by='root synthetic fixture',
                reason='Individually reviewed full original and current synthetic evidence.')
            with patch.object(m, 'proof_template', return_value=template):
                self.assertIsNotNone(m.review(None, line, {}, approval))
                for change in [{'status': 'offline_preflight_unapproved'}, {'reviewed_by': 'worker'}, {'reason': 'ok'},
                    {'clip_sha256': 'stale'}, {'source_row': dict(line, text='rewritten')},
                    {'parent_import_and_full_QA_required': True}, {'lexical_only_clearance': False}, {'extra': True}]:
                    with self.assertRaises(m.core.SafeError): m.review(None, line, {}, dict(approval, **change))
            self.assertIsNone(m.review(None, line, {}, None))


class OriginalNativeScope(unittest.TestCase):
    def scope(self):
        run = Path('/synthetic-private'); child = run/m.CHILD
        audio = {ident: 'synthetic-'+ident for ident in m.META_IDS}
        plan = {'root_forward_approval_required': True, 'original_full_child18_guard': True,
            'actual_full_QC18_guard': True, 'source_child_retake_prepared_full1557_verified': True,
            'source_run': str(child), 'parent_run': str(run), 'model': m.native.MODEL, 'revision': m.native.REVISION,
            'scope': m.META_IDS[:], 'runner_sha256': m.FROZEN_RUNNER_SHA256, 'max_forward_calls': 17,
            'max_active_local_models': 1}
        completion = {'status': 'observations_complete', 'calls': 17, 'approval': None,
            'runner_sha256': m.FROZEN_RUNNER_SHA256, 'plan_sha256': m.FROZEN_PLAN_SHA256}
        execution = {'model': m.native.MODEL, 'revision': m.native.REVISION, 'ids': m.META_IDS[:],
            'runner_sha256': m.FROZEN_RUNNER_SHA256, 'plan_sha256': m.FROZEN_PLAN_SHA256,
            'max_forward_calls': 17, 'max_active_local_models': 1, 'mp3_sha256': audio}
        gate = {'model': m.native.MODEL, 'revision': m.native.REVISION, 'selected_ids': m.META_IDS[:],
            'child_scope_ids': m.CHILD_IDS[:], 'excluded_id': m.EXCLUDED_ID, 'runner_sha256': m.FROZEN_RUNNER_SHA256,
            'plan_sha256': m.FROZEN_PLAN_SHA256, 'status': 'approved_execution_scope',
            'reviewed_by': 'root synthetic fixture', 'max_forward_calls': 17, 'max_active_local_models': 1,
            'one_active_local_model': True, 'current_parent_audio_delta_ids': [], 'audio_sha256': copy.deepcopy(audio)}
        return [run, child, plan, completion, execution, gate, m.FROZEN_RUNNER_SHA256, m.FROZEN_PLAN_SHA256]

    def test_exact_seventeen_forward_root_execution_gate_and_completion(self):
        m.native_execution_scope(*self.scope())
        for index, change in [(2, {'source_run': 'old-child51'}), (2, {'actual_full_QC18_guard': False}),
            (2, {'max_active_local_models': 2}), (2, {'scope': m.META_IDS[:-1]}), (3, {'calls': 16}),
            (3, {'approval': True}), (4, {'model': 'other'}), (4, {'revision': 'other'}),
            (4, {'max_forward_calls': 18}), (5, {'status': 'unapproved'}), (5, {'reviewed_by': 'worker'}),
            (5, {'current_parent_audio_delta_ids': [m.STUTTER_ID]}), (5, {'excluded_id': m.STUTTER_ID}),
            (5, {'child_scope_ids': m.META_IDS}), (5, {'audio_sha256': {}})]:
            args = copy.deepcopy(self.scope()); args[index].update(change)
            with self.subTest(index=index, change=change), self.assertRaises(m.core.SafeError): m.native_execution_scope(*args)
        for index in [6, 7]:
            args = self.scope(); args[index] = 'modified'
            with self.assertRaises(m.core.SafeError): m.native_execution_scope(*args)

    def test_missing_separate_root_execution_guard_rejected(self):
        for guard in [None, {}, {'status': 'approved_execution_scope'}]:
            args = self.scope(); args[5] = guard
            with self.assertRaises(m.core.SafeError): m.native_execution_scope(*args)

    def test_all92_original_outputs_reject_rehashed_modified_results_and_extra_file(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory); names = m.native_result_names()
            self.assertEqual(len(names), 92)
            for name in names:
                p = base/name; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(('synthetic original '+name).encode())
            expected = m.object_hash({name: m.digest(base/name) for name in names})
            with patch.object(m, 'FROZEN_NATIVE_OUTPUT_SHA256', expected):
                self.assertEqual(len(m.frozen_native_result_bindings(base, lambda p: p)), 92)
                for name in names:
                    p = base/name; old = p.read_bytes(); p.write_bytes(old+b'modified')
                    with self.subTest(file=name), self.assertRaises(m.core.SafeError): m.frozen_native_result_bindings(base, lambda p: p)
                    p.write_bytes(old)
                (base/'results/extra.private.json').write_bytes(b'{}')
                with self.assertRaises(m.core.SafeError): m.frozen_native_result_bindings(base, lambda p: p)

    def test_actual_model_weights_runtime_metadata_and_installed_bytes(self):
        # Reuse the already-tested matrix-only runtime fixture, never model code.
        from story_voice_child51_cases_test import NativeScopeAndRuntimeGuards
        with tempfile.TemporaryDirectory() as directory:
            args = NativeScopeAndRuntimeGuards().runtime(directory)
            self.assertEqual(m.native_runtime(*args), (Path(directory)/'model').resolve())
            for name in ['model/pytorch_model.bin', 'model/vocab.json', 'torch/__init__.py',
                'numpy/__init__.py', 'tokenizers.metadata.json', 'ffmpeg']:
                p = Path(directory)/name; old = p.read_bytes(); p.write_bytes(old+b'modified')
                with self.subTest(file=name), self.assertRaises(m.core.SafeError): m.native_runtime(*args)
                p.write_bytes(old)


class CurrentParentImportAndQA(unittest.TestCase):
    def save(self, p, value):
        p.parent.mkdir(parents=True, exist_ok=True); m.core.save(p, value)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.run = Path(self.temp.name).resolve(); self.child = self.run/m.CHILD
        self.ids = [m.NAMES_ID, m.STUTTER_ID]
        self.rows = [{'id': i, 'text': m.CASES[i]['text'], 'speaker': m.CASES[i]['speaker']} for i in self.ids]
        self.rows += [{'id': 'synthetic-unselected', 'text': 'Hallo.', 'speaker': 'lia'}]
        self.manifest = {'lines': self.rows, 'runtime_lookup': [{'asset_id': row['id']} for row in self.rows]}
        self.save(self.run/'lines.private.json', self.manifest)
        bank = {}; previous = {}; self.archive = self.run/'rejected/synthetic-import-originals'
        self.archive.mkdir(parents=True)
        for row in self.rows:
            ident = row['id']; data = ('synthetic new '+ident).encode()
            p = self.run/'clips'/(ident+'.mp3'); p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data)
            bank[ident] = m.digest(p)
            if ident not in self.ids:
                previous[ident] = bank[ident]; continue
            old = self.archive/(ident+'.mp3'); old.write_bytes(('synthetic previous '+ident).encode()); previous[ident] = m.digest(old)
            cp = self.child/'clips'/(ident+'.mp3'); cp.parent.mkdir(parents=True, exist_ok=True); cp.write_bytes(data)
            for directory in [self.run, self.child]:
                wav = directory/'raw'/(ident+'.wav'); wav.parent.mkdir(parents=True, exist_ok=True); wav.write_bytes(b'synthetic WAV')
                self.save(directory/'raw'/(ident+'.receipt.json'), {'id': ident, 'wav_sha256': m.digest(wav)})
        self.snapshot = {'selected_ids': self.ids[:], 'bank_mp3_sha256': previous}
        self.save(self.child/'parent-snapshot.private.json', self.snapshot)
        self.journal = {'state': 'IMPORTED', 'archive': str(self.archive), 'selected_ids': self.ids[:],
            'original_scope_selected_ids': self.ids[:], 'parent_snapshot_sha256': m.digest(self.child/'parent-snapshot.private.json'),
            'new_mp3_sha256': {i: bank[i] for i in self.ids}, 'validated_disjoint_import_journal_sha256': {}}
        self.jp = self.child/'import.private.json'; self.save(self.jp, self.journal)
        self.report = {'version': m.qa.VERSION, 'model': m.qa.MODEL, 'finished_at': 2, 'started_at': 1,
            'manifest_sha256': m.digest(self.run/'lines.private.json'), 'clip_sha256': bank,
            'checked_ids': list(bank), 'takes': [{'id': row['id'], 'text_sha256': m.qa.text_hash(row['text']),
                'transcript': m.CASES[row['id']]['primary_transcript'] if row['id'] in m.CASES else row['text'],
                'reasons': ['asr_lexical_mismatch_requires_review']} for row in self.rows]}
        self.qp = self.run/'qa-current.private.json'; self.save(self.qp, self.report)
        self.bindings = {'child_import_journal_path': str(self.jp), 'qa_report_path': str(self.qp)}
        self.patches = [patch.object(m, 'FULL_COUNT', 3), patch.object(m, 'IMPORT_IDS', self.ids)]
        for p in self.patches: p.start(); self.addCleanup(p.stop)

    def path(self, p, external=False):
        p = Path(p); m.require(p.is_file() and (external or p.is_relative_to(self.run)), 'Synthetic evidence path invalid.'); return p

    def verify(self):
        return m.validate_current_parent(self.run, self.child, self.manifest, self.snapshot, self.bindings,
            self.path, lambda p: m.core.read_json(self.path(p)))

    def test_actual_exact_import_and_full_current_QA(self):
        journal, path, report, context = self.verify()
        self.assertEqual(journal, self.journal); self.assertEqual(path, self.qp); self.assertEqual(report, self.report)
        self.assertEqual(context['derived_post_own_import_bank_mp3_sha256'], self.report['clip_sha256'])
        self.assertEqual(context['current_delta_after_own_import_ids'], [])
        self.assertEqual(context['validated_completed_disjoint_import_journal_sha256'], {})
        self.assertEqual(m.core.read_json(self.child/'parent-snapshot.private.json'), self.snapshot)

    def completed_disjoint(self, ids=None):
        """Original retake preparation/validator run on a full synthetic bank.

        Only the broad production source extractor is replaced for this tiny
        fixture. Frozen requests/profiles, original prepared(), WAV validation,
        receipt bindings and original validated_disjoint_imports are unchanged.
        """
        m.common.configure()
        guard = patch.object(m.retake, 'ORIGINAL_STORY_PREPARED', return_value=None)
        guard.start(); self.addCleanup(guard.stop)
        self.save(self.run/'prepared.json', {'model': m.retake.MODEL})
        self.save(self.run/'profiles.private.json', {'speakers': {'lia': {'google_voice': 'Zephyr'},
            'maedchen': {'google_voice': 'Sadachbia'}}})
        original_requests = [{'key': row['id'], 'request': {'contents': [{'role': 'user', 'parts': [{'text': row['text']}]}],
            'generationConfig': {'speechConfig': {'voiceConfig': {'voice': 'Sadachbia' if row['speaker'] == 'maedchen' else 'Zephyr'}}}}}
            for row in self.rows]
        (self.run/'requests.jsonl').write_text(''.join(json.dumps(r, ensure_ascii=False)+'\n' for r in original_requests))
        ids = ids or ['synthetic-unselected']; other = self.run/'retake-batches/synthetic-completed-disjoint'
        other.mkdir(); overrides = self.run/'synthetic-disjoint-overrides.private.json'
        self.save(overrides, {ident: {'delivery_style': 'Ruhig sprechen.'} for ident in ids})
        with contextlib.redirect_stdout(io.StringIO()):
            m.retake.prepare(SimpleNamespace(only_ids=','.join(ids), delivery_overrides=str(overrides)), self.run, other)
        snapshot_path = other/'parent-snapshot.private.json'; snapshot = m.core.read_json(snapshot_path)
        ids = snapshot['selected_ids']
        hashes = {}
        for ident in ids:
            if ident in self.ids:
                # An overlap is rejected even if its claimed selected output
                # equals the still-protected current bytes.
                for folder, extension in [('clips', '.mp3'), ('raw', '.wav'), ('raw', '.receipt.json')]:
                    p = other/folder/(ident+extension); p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_bytes((self.run/folder/(ident+extension)).read_bytes())
                hashes[ident] = m.digest(other/'clips'/(ident+'.mp3')); continue
            wav = other/'raw'/(ident+'.wav'); wav.parent.mkdir(parents=True, exist_ok=True)
            with wave.open(str(wav), 'wb') as writer:
                writer.setnchannels(1); writer.setsampwidth(2); writer.setframerate(24000); writer.writeframes(b'\0\0'*4800)
            mp3 = other/'clips'/(ident+'.mp3'); mp3.parent.mkdir(exist_ok=True); mp3.write_bytes(b'synthetic completed disjoint MP3')
            receipt = {'id': ident, 'status': 'complete', 'model': m.retake.MODEL,
                'request_sha256': snapshot['modified_request_sha256'][ident], 'mp3_sha256': m.digest(mp3),
                'wav_sha256': m.digest(wav), 'retake_parent_mp3_sha256': snapshot['bank_mp3_sha256'][ident]}
            self.save(other/'raw'/(ident+'.receipt.json'), receipt)
            for folder, extension in [('clips', '.mp3'), ('raw', '.wav'), ('raw', '.receipt.json')]:
                p = self.run/folder/(ident+extension); p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes((other/folder/(ident+extension)).read_bytes())
            hashes[ident] = m.digest(mp3); self.report['clip_sha256'][ident] = hashes[ident]
        journal = {'state': 'IMPORTED', 'selected_ids': ids, 'original_scope_selected_ids': ids,
            'parent_snapshot_sha256': m.digest(snapshot_path), 'new_mp3_sha256': hashes}
        self.save(other/'import.private.json', journal); self.save(self.qp, self.report)
        return other

    def test_genuine_original_disjoint_validator_accepts_completed_source_bound_import(self):
        other = self.completed_disjoint(); before = copy.deepcopy(self.snapshot)
        provenance = {}
        def registered(p, external=False):
            p = self.path(p, external); provenance[str(p)] = m.digest(p); return p
        journal, qa_path, report, context = m.validate_current_parent(self.run, self.child, self.manifest, self.snapshot,
            self.bindings, registered, lambda p: m.core.read_json(registered(p)))
        self.assertEqual(context['current_delta_after_own_import_ids'], ['synthetic-unselected'])
        expected = {str(other/'import.private.json'): m.digest(other/'import.private.json')}
        self.assertEqual(context['validated_completed_disjoint_import_journal_sha256'], expected)
        self.assertEqual(context['derived_post_own_import_bank_mp3_sha256']['synthetic-unselected'],
            before['bank_mp3_sha256']['synthetic-unselected'])
        self.assertEqual(context['derived_post_own_import_bank_mp3_sha256'][self.ids[0]], self.report['clip_sha256'][self.ids[0]])
        self.assertEqual(self.snapshot, before)
        self.assertEqual(m.core.read_json(self.child/'parent-snapshot.private.json'), before)
        for name in ['prepared.json', 'parent-snapshot.private.json', 'requests.jsonl', 'delivery-overrides.private.json',
            'lines.private.json', 'profiles.private.json', 'import.private.json', 'clips/synthetic-unselected.mp3',
            'raw/synthetic-unselected.wav', 'raw/synthetic-unselected.receipt.json']:
            self.assertIn(str(other/name), provenance)

    def test_stale_disjoint_origin_even_with_consistent_rehashes_is_refused(self):
        other = self.completed_disjoint(); sp = other/'parent-snapshot.private.json'; snapshot = m.core.read_json(sp)
        snapshot['bank_mp3_sha256']['synthetic-unselected'] = 'stale-origin'
        snapshot['bank_sha256'] = m.native_hash(snapshot['bank_mp3_sha256']); self.save(sp, snapshot)
        info = m.core.read_json(other/'prepared.json'); info['frozen_sha256']['parent-snapshot.private.json'] = m.digest(sp)
        self.save(other/'prepared.json', info)
        jp = other/'import.private.json'; journal = m.core.read_json(jp); journal['parent_snapshot_sha256'] = m.digest(sp); self.save(jp, journal)
        with self.assertRaisesRegex(m.core.SafeError, 'does not originate'): self.verify()

    def test_disjoint_overlap_is_refused_even_when_protected_bytes_are_unchanged(self):
        self.completed_disjoint(['synthetic-unselected', self.ids[0]])
        with self.assertRaisesRegex(m.core.SafeError, 'overlaps selected'): self.verify()

    def test_disjoint_incomplete_source_receipt_WAV_and_unknown_bytes_refused(self):
        other = self.completed_disjoint(); jp = other/'import.private.json'; original = m.core.read_json(jp)
        for change in [{'state': 'IMPORT_INTENT_RECORDED'}, {'new_mp3_sha256': {'synthetic-unselected': 'stale'}}]:
            self.save(jp, dict(original, **change))
            with self.assertRaises(m.core.SafeError): self.verify()
            self.save(jp, original)
        for p in [other/'raw/synthetic-unselected.receipt.json', other/'raw/synthetic-unselected.wav',
            self.run/'raw/synthetic-unselected.wav', self.run/'requests.jsonl']:
            old = p.read_bytes(); p.write_bytes(old+b'changed')
            with self.subTest(file=p.name), self.assertRaises((m.core.SafeError, ValueError)): self.verify()
            p.write_bytes(old)
        # With no completed explaining journal, current source/audio QA cannot
        # legitimize an unknown bank change.
        jp.unlink()
        with self.assertRaisesRegex(m.core.SafeError, 'Unexplained parent audio changes'): self.verify()

    def test_incomplete_wrong_subset_duplicate_or_stale_import_rejected(self):
        for change in [{'state': 'IMPORT_INTENT_RECORDED'}, {'selected_ids': self.ids[:-1]},
            {'selected_ids': self.ids+[self.ids[0]]}, {'parent_snapshot_sha256': 'stale'},
            {'new_mp3_sha256': {}}, {'validated_disjoint_import_journal_sha256': {'unrelated': 'stale'}}]:
            self.save(self.jp, dict(self.journal, **change))
            with self.subTest(change=change), self.assertRaises(m.core.SafeError): self.verify()
            self.save(self.jp, self.journal)

    def test_stale_current_QA_hash_scope_source_finish_or_audio_rejected(self):
        changes = [{'manifest_sha256': 'stale'}, {'finished_at': None}, {'finished_at': 0},
            {'checked_ids': self.report['checked_ids'][:-1]}, {'checked_ids': [self.ids[0]]*3}, {'takes': self.report['takes'][:-1]},
            {'clip_sha256': dict(self.report['clip_sha256'], **{self.ids[0]: 'stale'})}]
        for change in changes:
            self.save(self.qp, dict(self.report, **change))
            with self.subTest(change=change), self.assertRaises(m.core.SafeError): self.verify()
            self.save(self.qp, self.report)
        broken = copy.deepcopy(self.report); broken['takes'][2]['text_sha256'] = 'stale-unselected'
        self.save(self.qp, broken)
        with self.assertRaises(m.core.SafeError): self.verify()

    def test_every_current_bank_change_and_receipt_WAV_and_archive_is_bound(self):
        paths = [self.run/'clips/synthetic-unselected.mp3', self.run/'clips'/(self.ids[0]+'.mp3'),
            self.run/'raw'/(self.ids[0]+'.wav'), self.run/'raw'/(self.ids[0]+'.receipt.json'),
            self.child/'raw'/(self.ids[0]+'.wav'), self.archive/(self.ids[0]+'.mp3')]
        for p in paths:
            old = p.read_bytes(); p.write_bytes(old+b'changed')
            with self.subTest(file=p.name), self.assertRaises((m.core.SafeError, ValueError)): self.verify()
            p.write_bytes(old)


if __name__ == '__main__': unittest.main()
