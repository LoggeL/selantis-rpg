"""Offline guard/transaction fixtures. Synthetic bytes confer no audio approval."""
import argparse
import copy
from contextlib import redirect_stdout
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import part2_voice_retake_publish as m
import part2_voice_retake_qualify_test as fixtures

r, q = m.r, m.qualify


class Publication(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.Fixture(methodName='runTest')
        temporary = tempfile.TemporaryDirectory
        with patch.object(tempfile, 'TemporaryDirectory', side_effect=lambda: temporary(dir=Path(tempfile.gettempdir()).resolve())):
            self.f.setUp()
        self.addCleanup(self.f.tearDown)
        self.run, self.root, self.parent = self.f.run, self.f.root, self.f.parent
        self.ids = self.f.ids
        for item in [Path(q.__file__), Path(fixtures.__file__), Path(m.__file__), Path(__file__), Path(m.base.__file__)]:
            (self.root/'scripts'/item.name).write_bytes(item.read_bytes())
        model = Path(self.f.model['local_directory']); model.mkdir()
        (model/'config.json').write_text('Synthetic model identity fixture, never loaded')
        (model/'weights.npz').write_bytes(b'No actual model weights')
        self.model = {**self.f.model, 'config_sha256': r.digest(model/'config.json'), 'weights': {'weights.npz': r.digest(model/'weights.npz')}}
        self.producer_pins = {}
        qa_before = q.baseline(self.run)
        self.word = self.f.word_evidence(); self.word.update(version=q.qa.VERSION, finished_at=10)
        r.core.save(self.run/'qa.private.json', self.word)
        r.core.save(self.run/'qa-asr-cache.private.json', {'synthetic_fixture': True})
        self.write_fixture_producer('qa', qa_before)
        align_before = q.baseline(self.run)
        self.timing = self.f.timing_evidence()
        for ident in self.ids:
            r.core.save(self.run/'local-alignment-intents'/(ident+'.private.json'), {'id': ident,
                'audio_sha256': r.digest(self.run/'clips'/(ident+'.mp3')), 'state': 'ONE_ACTUAL_LOCAL_FORCED_ALIGNMENT_INTENT'})
        r.core.save(self.run/'word-cues/alignment.private.json', self.timing)
        self.write_fixture_producer('align', align_before)
        self.write_fixture_independent_review()
        self.target = self.root/'game/public/audio/teil-2'; self.target.mkdir(parents=True)
        rows = r.read(self.parent/'lines.private.json')['lines']
        self.old = {'model': r.MODEL, 'aliases': self.f.manifest['aliases'], 'scene_players': self.f.manifest['scene_players'], 'clips': [],
            'coverage': {'version': m.timing_baseline.VERSION, 'status': 'partial', 'expected_sources': 3,
                'published_sources': 2, 'human_listening_or_acting_approval': False,
                'missing_sources': [{'id': self.ids[-1], 'scene': 'e2-taverne', 'kind': 'say', 'speaker': 'lia', 'reasons': ['original held fixture']}],
                'retained_old_failure_count': 1}}
        for row in rows[:2]:
            ident = row['id']; path = self.target/(ident+'.mp3'); path.write_bytes((self.parent/'clips'/(ident+'.mp3')).read_bytes())
            self.old['clips'].append({'id': ident, **{key: copy.deepcopy(row[key]) for key in ['kind', 'speaker', 'text', 'display_text', 'runtime_keys']},
                'voice': 'Laomedeia', 'audio': 'audio/teil-2/'+ident+'.mp3', 'sha256': r.digest(path), 'seconds': .5,
                'word_cues': [{'start': .05, 'end': .45}]})
        r.core.save(self.target/'manifest.json', self.old)
        for name in ['prolog', 'story']:
            folder = self.target.parent/name; folder.mkdir(); (folder/'manifest.json').write_text('Preserved fixture '+name)
        self.baseline_selection = self.parent/'baseline-selection.private.json'
        selection = {'version': m.timing_baseline.VERSION, 'status': 'approved_part2_sourcefree89_timing_selection',
            'reviewed_by': 'root', 'target_root': str(self.root), 'human_listening_or_acting_approval': False,
            'adapter_sha256': 'c'*64, 'manifest_sha256': r.digest(self.parent/'lines.private.json'),
            'profiles_sha256': r.digest(self.parent/'profiles.private.json'), 'selected_ids': self.ids[:2]}
        r.core.save(self.baseline_selection, selection)
        self.baseline_report = self.parent/'baseline-report.private.json'
        r.core.save(self.baseline_report, {**self.old['coverage'], 'state': 'PUBLISHED', 'adapter_sha256': 'c'*64,
            'public_manifest_sha256': r.digest(self.target/'manifest.json'), 'sourcefree89_selection_sha256': r.digest(self.baseline_selection)})
        self.args = argparse.Namespace(run_dir=self.run, target_root=self.root, baseline_report=self.baseline_report,
            baseline_selection=self.baseline_selection, parent_run=self.parent, initial_selection=self.baseline_selection,
            supplemental_selection=self.baseline_selection, external_selection=self.baseline_selection,
            sourcefree_timing_selection=self.baseline_selection, orthography_selection=None, name_case_selection=None,
            qa_report=self.parent/'qa.private.json', alignment_report=self.parent/'word-cues/alignment.private.json',
            qa_producer=self.parent/'qualification-qa.producer.private.json', alignment_producer=self.parent/'qualification-align.producer.private.json',
            selection=self.run/'approved-selection.private.json', output_dir=self.run/'publication-proposal',
            coverage_report=self.run/'publication-coverage.private.json')
        self.patches = [patch.object(m, 'BASELINES', {m.timing_baseline.VERSION: (2, 'sourcefree89_selection_sha256', 'approved_part2_sourcefree89_timing_selection')}),
            patch.object(m, 'PRODUCER_PINS', self.producer_pins), patch.object(m, 'RESULT_REVIEW_SHA', self.result_review_sha),
            patch.object(q, 'model_identity', return_value=self.model), patch.object(q.qa, 'decode', return_value=fixtures.METRICS),
            patch.object(q.cues.acoustic, 'decode', return_value=[]), patch.object(q.cues.acoustic, 'refine_boundaries', side_effect=lambda value, _: value),
            patch.object(m.base, 'scanner_metadata', return_value={}), patch.object(m.base, 'release_inventory'),
            patch.object(m.timing_baseline, 'build', side_effect=self.replay)]
        for item in self.patches: item.start(); self.addCleanup(item.stop)

    def replay(self, *_args):
        return copy.deepcopy(self.old), {ident: self.parent/'clips'/(ident+'.mp3') for ident in self.ids[:2]}, self.preserved(), {}, r.read(self.baseline_selection)

    def write_fixture_producer(self, command, before):
        target = self.run/('qa.private.json' if command == 'qa' else 'word-cues/alignment.private.json')
        created = {str(path.relative_to(self.run)): r.digest(path) for path in self.run.rglob('*') if path.is_file()
                   and path.parent.name in ({'asr-raw', 'local-asr-intents'} if command == 'qa' else {'word-cues', 'alignment-raw', 'local-alignment-intents'})}
        created[str(target.relative_to(self.run))] = r.digest(target)
        if command == 'qa': created['qa-asr-cache.private.json'] = r.digest(self.run/'qa-asr-cache.private.json')
        intent = {'version': q.VERSION, 'state': 'ONE_ROOT_ACTUAL_RUN_STARTED', 'command': command,
            'selected_ids': self.ids, 'input_sha256': q.EXPECTED_INPUT_SHA, 'prepared_sha256': r.digest(self.run/'prepared.json'),
            'source_manifest_sha256': r.digest(self.run/'lines.private.json'), 'helpers_sha256': q.helper_hashes(),
            'pre_existing_child_sha256': before, 'model': self.model, 'human_listening_or_acting_or_voice_identity_approved': False}
        proof = {**intent, 'state': 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT', 'report_path': str(target),
            'report_sha256': r.digest(target), 'report_status': r.read(target)['status'], 'actual_model_call_ids': self.ids,
            'created_outputs_sha256': created}
        proof['actual_source_free_ids' if command == 'qa' else 'actual_timing_ids'] = self.ids
        r.core.save(self.run/('qualification-'+command+'.intent.private.json'), intent)
        path = self.run/('qualification-'+command+'.producer.private.json'); r.core.save(path, proof)
        self.producer_pins[command] = {'sha256': r.digest(path), 'input_count': len(before), 'input_map_sha256': m.object_sha(before)}

    def write_fixture_independent_review(self):
        expected = {}
        for command in ['qa', 'align']:
            value = r.read(self.run/('qualification-'+command+'.producer.private.json'))
            for field in ['pre_existing_child_sha256', 'created_outputs_sha256']:
                expected.update({str(self.run/name): sha for name, sha in value[field].items()})
            for suffix in ['producer', 'intent']:
                path = self.run/('qualification-'+command+'.'+suffix+'.private.json'); expected[str(path)] = r.digest(path)
        report = {'status': 'PASS_GENUINE_COMPLETED_QA8_ALIGN8_EVIDENCE_RECONSTRUCTION_UNAPPROVED',
            'child': str(self.run), 'frozen_qualifier_sha256': m.QUALIFIER_SHA, 'input_sha256': q.EXPECTED_INPUT_SHA,
            'selected_ids': self.ids, 'actual_QA_producer_sha256': self.producer_pins['qa']['sha256'],
            'actual_Align_producer_sha256': self.producer_pins['align']['sha256'],
            'whole_Sourcefree_raw_census': len(self.ids), 'whole_forced_timing_raw_census': len(self.ids),
            'original_7044_parent_and188Prolog1490Story_preserved': True, 'qa_signal_and_timing_waveform_checks_recomputed_CPU_only': True,
            'actual_sourcefree_and_forced_report_whole_failures_reconstructed': True, 'network_model_calls': 0, 'ASR_or_alignment_model_calls': 0,
            'word_approval': None, 'timing_approval': None, 'human_listening_or_acting_or_voice_identity_approval': None,
            'audio_adoption': False, 'all_current_completed_evidence_files_sha256': expected, 'synthetic_fixture_only': True}
        path = self.parent/m.RESULT_REVIEW; r.core.save(path, report); self.result_review_sha = r.digest(path)

    def preserved(self):
        return {str(self.target.parent/name): m.base.file_map(self.target.parent/name) for name in ['prolog', 'story']}

    def approve(self, chosen=None):
        chosen = chosen or [self.ids[0], self.ids[-1]]
        m.propose(self.args)
        selection = r.read(self.args.output_dir/'selection.UNAPPROVED.private.json')
        selection.update(status='approved_part2_actual_retake_selection', reviewed_by='root',
            actual_whole_word_signal_and_newaudio_timing_reviewed=True, selected_retake_ids=chosen)
        for ident in chosen:
            case = r.read(self.args.output_dir/(ident+'.UNAPPROVED.private.json'))
            case.update(status='approved_part2_actual_retake_case', reviewed_by='root',
                actual_whole_word_signal_and_newaudio_timing_reviewed=True, review_note='Synthetic fixture only, no actual audio approval')
            path = self.run/(ident+'.approved.private.json'); r.core.save(path, case)
            selection['case_approvals'].append({'path': str(path), 'sha256': r.digest(path)})
        r.core.save(self.args.selection, selection)
        return selection

    def refresh_fixture_report_pins(self, command):
        """Only synthetic test records, never a production producer rewrite."""
        path = self.run/('qualification-'+command+'.producer.private.json'); value = r.read(path)
        target = self.run/('qa.private.json' if command == 'qa' else 'word-cues/alignment.private.json')
        value['report_sha256'] = r.digest(target); value['report_status'] = r.read(target)['status']
        value['created_outputs_sha256'] = {name: r.digest(self.run/name) for name in value['created_outputs_sha256']}
        r.core.save(path, value)
        self.producer_pins[command]['sha256'] = r.digest(path)
        if command == 'qa':
            for suffix in ['producer', 'intent']:
                path = self.run/('qualification-align.'+suffix+'.private.json'); proof = r.read(path)
                proof['pre_existing_child_sha256'] = {name: r.digest(self.run/name) for name in proof['pre_existing_child_sha256']}
                r.core.save(path, proof)
            self.producer_pins['align']['sha256'] = r.digest(self.run/'qualification-align.producer.private.json')
            self.producer_pins['align']['input_map_sha256'] = m.object_sha(proof['pre_existing_child_sha256'])
        self.write_fixture_independent_review(); m.RESULT_REVIEW_SHA = self.result_review_sha

    def test_actual_full_child_and_both_completed_producers_are_required(self):
        info, rows, *_ = m.actual_child(self.run, {})
        self.assertEqual(info['selected_ids'], self.ids); self.assertEqual(set(rows), set(self.ids))

    def test_missing_failed_wrong_model_or_changed_once_intent_producer_refused(self):
        path = self.run/'qualification-qa.producer.private.json'; original = r.read(path)
        for field, value in [('state', 'FAILED_WITH_REAL_PRIVATE_EVIDENCE_NO_APPROVAL'), ('actual_model_call_ids', self.ids[:1]),
                             ('report_sha256', 'f'*64), ('runtime_guard_failed', True), ('source_manifest_sha256', 'f'*64)]:
            proof = copy.deepcopy(original); proof[field] = value; r.core.save(path, proof)
            with self.subTest(field=field), self.assertRaises(r.SafeError): m.actual_child(self.run, {})
        r.core.save(path, original)

    def test_removed_raw_report_only_or_extra_output_census_is_refused_even_with_outer_fixture_pin(self):
        for command in ['qa', 'align']:
            path = self.run/('qualification-'+command+'.producer.private.json'); original = r.read(path)
            for change in ['remove_raw', 'report_only', 'extra']:
                value = copy.deepcopy(original); outputs = value['created_outputs_sha256']
                if change == 'remove_raw': outputs.pop(next(name for name in outputs if '-raw/' in name))
                if change == 'report_only': value['created_outputs_sha256'] = {str(Path(value['report_path']).relative_to(self.run)): value['report_sha256']}
                if change == 'extra': outputs['prepared.json'] = r.digest(self.run/'prepared.json')
                r.core.save(path, value)
                with self.subTest(command=command, change=change), patch.dict(m.PRODUCER_PINS[command], {'sha256': r.digest(path)}), self.assertRaisesRegex(r.SafeError, 'output census'):
                    m.producer(self.run, command, {})
            r.core.save(path, original)

    def test_prepared_only_input_omission_or_same_count_replacement_is_refused(self):
        for command in ['qa', 'align']:
            path = self.run/('qualification-'+command+'.producer.private.json'); original = r.read(path)
            for change in ['prepared_only', 'omit', 'replace_value']:
                value = copy.deepcopy(original); before = value['pre_existing_child_sha256']
                if change == 'prepared_only': value['pre_existing_child_sha256'] = {'prepared.json': r.digest(self.run/'prepared.json')}
                if change == 'omit': before.pop(next(name for name in before if name != 'prepared.json'))
                if change == 'replace_value': before['prepared.json'] = 'f'*64
                r.core.save(path, value)
                intent = self.run/('qualification-'+command+'.intent.private.json'); original_intent = r.read(intent)
                changed_intent = copy.deepcopy(original_intent); changed_intent['pre_existing_child_sha256'] = value['pre_existing_child_sha256']; r.core.save(intent, changed_intent)
                with self.subTest(command=command, change=change), patch.dict(m.PRODUCER_PINS[command], {'sha256': r.digest(path)}), self.assertRaisesRegex(r.SafeError, 'entire|Entire'):
                    m.producer(self.run, command, {})
                r.core.save(intent, original_intent)
            r.core.save(path, original)

    def test_changed_original_producer_bytes_cannot_be_blessed_by_root_selection(self):
        path = self.run/'qualification-qa.producer.private.json'; value = r.read(path)
        value['created_outputs_sha256'].pop(next(name for name in value['created_outputs_sha256'] if name.startswith('asr-raw/')))
        r.core.save(path, value)
        with self.assertRaisesRegex(r.SafeError, 'Reviewed evidence bytes differ'): m.actual_child(self.run, {})

    def test_complete_independent_review_union_cannot_omit_raw_or_add_current_projection(self):
        path = self.parent/m.RESULT_REVIEW; original = r.read(path)
        for change in ['omit', 'extra']:
            value = copy.deepcopy(original); mapping = value['all_current_completed_evidence_files_sha256']
            if change == 'omit': mapping.pop(str(self.run/'asr-raw'/(self.ids[0]+'.private.json')))
            if change == 'extra': mapping[str(self.run/'projection.private.json')] = 'f'*64
            r.core.save(path, value)
            with self.subTest(change=change), patch.object(m, 'RESULT_REVIEW_SHA', r.digest(path)), self.assertRaisesRegex(r.SafeError, 'complete exact'):
                m.actual_child(self.run, {})
        r.core.save(path, original)

    def test_original_provider_stop_and_word_raw_changes_are_refused(self):
        raw = self.run/'asr-raw'/(self.ids[0]+'.private.json'); raw.write_text('{}')
        with self.assertRaises(r.SafeError): m.actual_child(self.run, {})

    def test_source_style_cast_presets_and_provider_response_cannot_change(self):
        path = self.run/'public-manifest.proposed.json'; original = r.read(path)
        for field, value in [('voice', 'Wrong'), ('text', 'Andere Worte.'), ('runtime_keys', [])]:
            proposal = copy.deepcopy(original); proposal['clips'][0][field] = value; r.core.save(path, proposal)
            with self.subTest(field=field), self.assertRaises(r.SafeError): m.actual_child(self.run, {})
        r.core.save(path, original)

    def test_candidate_never_waives_whole_words_signal_or_time_flags(self):
        row = r.read(self.run/'lines.private.json')['lines'][0]; take = self.word['takes'][0]
        for field, value in [('word_error_rate', .1), ('transcript', 'Foltan.'), ('reasons', ['possible_abrupt_audio_end']), ('adjudication', {'approved': True})]:
            changed = copy.deepcopy(take); changed[field] = value
            with self.subTest(field=field), self.assertRaises(r.SafeError): m.candidate(row, self.run, self.f.profiles, changed, self.word, self.timing)
        temporal = self.run/'word-cues'/(self.ids[0]+'.json'); value = r.read(temporal); value['original_qualification_flags'] = [{'word_index': 0, 'reasons': ['original_bad']}]; r.core.save(temporal, value)
        with self.assertRaises(r.SafeError): m.candidate(row, self.run, self.f.profiles, take, self.word, self.timing)

    def test_old_audio_cues_nonfinite_or_collapsed_new_cues_are_refused(self):
        row = r.read(self.run/'lines.private.json')['lines'][0]; temporal = self.run/'word-cues'/(self.ids[0]+'.json'); original = r.read(temporal)
        for field, value in [('audio_sha256', 'f'*64), ('word_cues', [{'start': .1, 'end': .1}]), ('CTC_adoption', {})]:
            changed = copy.deepcopy(original); changed[field] = value; r.core.save(temporal, changed)
            with self.subTest(field=field), self.assertRaises(r.SafeError): m.candidate(row, self.run, self.f.profiles, self.word['takes'][0], self.word, self.timing)
        r.core.save(temporal, original)

    def test_baseline_report_status_and_label_do_not_replace_whole_builder_replay(self):
        with patch.object(m.timing_baseline, 'build', return_value=({**self.old, 'aliases': {}}, {}, self.preserved(), {}, r.read(self.baseline_selection))), self.assertRaises(r.SafeError):
            m.actual_baseline(self.args, self.f.manifest, self.f.profiles, {})

    def test_changed_current_baseline_source_route_audio_or_coverage_is_refused(self):
        path = self.target/'manifest.json'; original = r.read(path)
        for field in ['source', 'route', 'alias', 'coverage']:
            public = copy.deepcopy(original)
            if field == 'source': public['clips'][0]['text'] = 'Andere Worte.'
            if field == 'route': public['clips'][0]['runtime_keys'] = []
            if field == 'alias': public['aliases'] = {}
            if field == 'coverage': public['coverage']['retained_old_failure_count'] = 0
            r.core.save(path, public)
            with self.subTest(field=field), self.assertRaises(r.SafeError): m.actual_baseline(self.args, self.f.manifest, self.f.profiles, {})
        r.core.save(path, original)

    def test_baseline_wrong_target_hash_unknown_files_and_stale_selection_refused(self):
        (self.target/'foreign.txt').write_text('Preserve this unrelated file')
        with self.assertRaises(r.SafeError): m.actual_baseline(self.args, self.f.manifest, self.f.profiles, {})
        self.assertTrue((self.target/'foreign.txt').exists())

    def test_propose_has_no_approval_and_preserves_every_existing_byte(self):
        before, parent = m.base.file_map(self.target), r.protected_parent(self.parent)
        candidates, held = m.propose(self.args)
        self.assertEqual(len(candidates), 3); self.assertFalse(held)
        selection = r.read(self.args.output_dir/'selection.UNAPPROVED.private.json')
        self.assertIsNone(selection['reviewed_by']); self.assertEqual(selection['selected_retake_ids'], [])
        self.assertFalse(selection['actual_whole_word_signal_and_newaudio_timing_reviewed'])
        self.assertEqual(r.digest(self.args.output_dir/'baseline-manifest.private.json'), before['manifest.json'])
        self.assertEqual(m.base.file_map(self.target), before); self.assertEqual(r.protected_parent(self.parent), parent)
        with self.assertRaises(r.SafeError): m.propose(self.args)

    def test_whole_bank_failure_keeps_individual_candidates_separate_without_all8_projection(self):
        word = self.f.word_evidence(mismatch=True); word.update(version=q.qa.VERSION, finished_at=10)
        r.core.save(self.run/'qa.private.json', word); self.refresh_fixture_report_pins('qa')
        candidates, held = m.propose(self.args)
        self.assertEqual(set(candidates), set(self.ids[1:])); self.assertEqual(set(held), {self.ids[0]})
        self.assertEqual(held[self.ids[0]]['original_word_reasons'], ['asr_lexical_mismatch_requires_review'])
        self.assertFalse((self.args.output_dir/(self.ids[0]+'.UNAPPROVED.private.json')).exists())
        selection = r.read(self.args.output_dir/'selection.UNAPPROVED.private.json')
        selection.update(status='approved_part2_actual_retake_selection', reviewed_by='root',
            actual_whole_word_signal_and_newaudio_timing_reviewed=True, selected_retake_ids=[self.ids[0]])
        with self.assertRaises(r.SafeError): m.build(self.args, selection)

    def test_all_original_timing_failures_stay_held_without_root_waiver_route(self):
        timing = self.f.timing_evidence(flagged=True)
        r.core.save(self.run/'word-cues/alignment.private.json', timing); self.refresh_fixture_report_pins('align')
        candidates, held = m.propose(self.args)
        self.assertEqual(candidates, {}); self.assertEqual(set(held), set(self.ids))
        self.assertTrue(all(value['original_timing_failures'] for value in held.values()))
        self.assertEqual(r.read(self.run/'word-cues/alignment.private.json')['status'], 'needs_review')

    def test_compose_adds_and_replaces_only_approved_ids_with_actual_new_cues(self):
        selection = self.approve(); public, paths, preserved, bound, transition = m.build(self.args, selection)
        clips = {clip['id']: clip for clip in public['clips']}
        self.assertEqual(clips[self.ids[1]], self.old['clips'][1])
        self.assertEqual(clips[self.ids[0]]['word_cues'], [{'start': .1, 'end': .4}])
        self.assertEqual(paths[self.ids[0]], self.run/'clips'/(self.ids[0]+'.mp3'))
        self.assertEqual(public['aliases'], self.old['aliases']); self.assertEqual(public['scene_players'], self.old['scene_players'])
        self.assertEqual(public['coverage']['retained_old_failure_count'], 1)
        self.assertEqual(public['coverage']['retake_replaced_sources'], 1); self.assertEqual(public['coverage']['retake_added_sources'], 1)
        self.assertEqual(public['coverage']['missing_sources'], [])
        m.base.existing(self.target, transition, public); m.base.stable(bound, preserved)

    def test_unapproved_selection_or_global_all8_claim_is_refused(self):
        m.propose(self.args); selection = r.read(self.args.output_dir/'selection.UNAPPROVED.private.json')
        with self.assertRaises(r.SafeError): m.build(self.args, selection)

    def test_each_approved_case_requires_exact_source_newaudio_cues_and_specific_note(self):
        selection = self.approve()
        path = Path(selection['case_approvals'][0]['path']); original = r.read(path)
        for change in ['source', 'cue', 'old_clip', 'root', 'human', 'note']:
            case = copy.deepcopy(original)
            if change == 'source': case['actual_new_clip']['text'] = 'Foltan.'
            if change == 'cue': case['actual_new_clip']['word_cues'][0]['start'] = 0
            if change == 'old_clip': case['prior_public_clip']['sha256'] = 'f'*64
            if change == 'root': case['reviewed_by'] = 'model'
            if change == 'human': case['human_listening_or_acting_approval'] = True
            if change == 'note': case['review_note'] = ''
            r.core.save(path, case); changed = copy.deepcopy(selection); changed['case_approvals'][0]['sha256'] = r.digest(path)
            with self.subTest(change=change), self.assertRaises(r.SafeError): m.build(self.args, changed)
        r.core.save(path, original)

    def test_duplicate_unknown_or_missing_selected_case_is_refused(self):
        selection = self.approve()
        for change in ['duplicate', 'missing', 'unknown']:
            changed = copy.deepcopy(selection)
            if change == 'duplicate': changed['case_approvals'][1] = changed['case_approvals'][0]
            if change == 'missing': changed['case_approvals'].pop()
            if change == 'unknown': changed['selected_retake_ids'] = ['part2-'+'f'*24]
            with self.subTest(change=change), self.assertRaises(r.SafeError): m.build(self.args, changed)

    def test_baseline_changed_after_review_requires_new_concrete_approval(self):
        selection = self.approve(); path = self.target/(self.ids[1]+'.mp3'); path.write_bytes(b'Concurrent audio edit')
        with self.assertRaises(r.SafeError): m.build(self.args, selection)
        self.assertEqual(path.read_bytes(), b'Concurrent audio edit')

    def test_actual_apply_transaction_preserves_unselected_bank_parent_and_raw_evidence(self):
        selection = self.approve(); parent, child = r.protected_parent(self.parent), q.baseline(self.run)
        old = (self.target/(self.ids[1]+'.mp3')).read_bytes()
        public, paths, preserved, bound, transition = m.build(self.args, selection)
        m.base.apply(self.target, transition, public, paths, preserved, bound)
        self.assertEqual(r.read(self.target/'manifest.json'), public)
        self.assertEqual((self.target/(self.ids[1]+'.mp3')).read_bytes(), old)
        self.assertEqual(r.protected_parent(self.parent), parent)
        self.assertEqual(q.baseline(self.run), child)
        self.assertEqual(set(m.base.file_map(self.target)), {'manifest.json', *(ident+'.mp3' for ident in self.ids)})

    def test_finalize_failure_rolls_back_original_approved_bank(self):
        selection = self.approve(); before = m.base.file_map(self.target)
        public, paths, preserved, bound, transition = m.build(self.args, selection)
        with self.assertRaises(RuntimeError): m.base.apply(self.target, transition, public, paths, preserved, bound,
            finalize=lambda: (_ for _ in ()).throw(RuntimeError('Real transaction fixture failure')))
        self.assertEqual(m.base.file_map(self.target), before)

    def test_no_credentials_model_calls_generic_exceptions_or_future31_flags(self):
        fields = {item.dest for item in m.parser()._actions}
        for field in ['api_key', 'key_stdin', 'model_dir', 'adjudications', 'only_ids', 'allow_name_exception', 'future31']:
            self.assertNotIn(field, fields)

    def test_genuine_same_local_weight_alias_is_preserved_but_external_or_unrecorded_target_refused(self):
        folder = Path(self.model['local_directory']); alias = folder/'model.safetensors'; alias.symlink_to('weights.npz')
        weights = {**self.model['weights'], alias.name: self.model['weights']['weights.npz']}; bound = {}
        m.model_weights(folder, weights, bound)
        self.assertIn(str(alias), bound); self.assertIn(str(folder/'weights.npz'), bound)
        outside = self.root/'outside-weight.npz'; outside.write_bytes((folder/'weights.npz').read_bytes())
        alias.unlink(); alias.symlink_to(outside)
        with self.assertRaises(r.SafeError): m.model_weights(folder, weights, {})


if __name__ == '__main__': unittest.main()
