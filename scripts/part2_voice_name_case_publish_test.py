#!/usr/bin/env python3
"""Actual offline28 evidence plus adversarial typed case controls, no adoption.

Positive approval-control fixtures exist only in unit-test memory. They are
never saved, Root-reviewed, passed to build/apply or counted as real approvals.
"""
import copy
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import part2_voice_name_case_publish as m

RUN = m.batch.ROOT/'output/audio/part2-voice/2026-10-08-all'


def required_private_bundle_paths(run):
    """Only availability, not validation: present but bad evidence still fails."""
    paths = [run/name for name in ['lines.private.json', 'profiles.private.json', 'qa.private.json',
        'word-cues/alignment.private.json', 'qualification-qa-5628dbc9de4f49a1a6432f1621d8c0e8.producer.private.json',
        'qualification-align-809b769bf7694981b0b8576a1d027cca.producer.private.json',
        'sourcefree-google-qc-remaining/responses.provider-raw.private.jsonl',
        'root-approved-external92/selection1013.private.json']]
    paths.extend(run/m.FOLDER/name for name in m.NAME_FILES)
    for ident in m.CANDIDATE_IDS:
        paths.extend(run/folder/(ident+suffix) for folder, suffix in [
            ('asr-raw', '.private.json'), ('free-large449/raw', '.private.json'),
            ('sourcefree-google-qc-remaining/observations', '.private.json'),
            ('word-cues', '.json'), ('clips', '.mp3'), ('raw', '.wav'), ('raw', '.receipt.json')])
    return paths


class SyntheticGuards(unittest.TestCase):
    def setUp(self):
        self.args = SimpleNamespace()  # No private evidence is needed by the mocked refusal case.

    def test_body_negation_is_not_a_name_exception(self):
        with self.assertRaises(m.batch.SafeError): m.body_outside_names('Kira die kommt', {'text': 'Kyra nie kommt'}, {0})


    def test_added_body_word_is_not_a_name_exception(self):
        with self.assertRaises(m.batch.SafeError): m.body_outside_names('Wo sind Kira und Flick bitte', {'text': 'Wo sind Kyra und Flick'}, {2})


    def test_changed_contraction_is_not_a_name_exception(self):
        with self.assertRaises(m.batch.SafeError): m.body_outside_names('Kira habe Angst', {'text': 'Kyra hab Angst'}, {0})


    def test_ss_and_scharfes_s_are_not_collapsed(self):
        with self.assertRaises(m.batch.SafeError): m.body_outside_names('Kira wusste nichts', {'text': 'Kyra wußte nichts'}, {0})


    def test_body_vowels_and_FV_stay_literal(self):
        for actual, source in [('Kira Helle', 'Kyra Hölle'), ('Kira Voltan', 'Kyra Foltan')]:
            with self.assertRaises(m.batch.SafeError): m.body_outside_names(actual, {'text': source}, {0})


    def test_typed_Root_json_identity_disallows_bool_for_int(self):
        with self.assertRaises(m.batch.SafeError): m.exact_value({'index': True}, {'index': 1}, 'typed mismatch')


    def test_missing_full_prior1056_is_refused(self):
        with patch.object(m.baseline, 'build', return_value=({'clips': [], 'coverage': {}}, {}, {}, {}, {})):
            with self.assertRaises(m.batch.SafeError): m.build(self.args, {}, {}, {}, {}, {}, {})



class Actual28(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if any(not path.is_file() for path in required_private_bundle_paths(RUN)):
            raise unittest.SkipTest('Actual28 integration requires the complete private audio/evidence bundle; unavailable in this checkout.')
        cls.manifest = m.batch.read(RUN/'lines.private.json'); cls.rows = {r['id']: r for r in cls.manifest['lines']}
        cls.profiles = m.batch.read(RUN/'profiles.private.json'); cls.qa = m.batch.read(RUN/'qa.private.json')
        cls.alignment = m.batch.read(RUN/'word-cues/alignment.private.json')
        cls.takes, cls.checked = m.base.report_coverage(cls.qa, cls.alignment, cls.manifest, RUN)
        cls.args = SimpleNamespace(run_dir=str(RUN), qa_report=RUN/'qa.private.json', alignment_report=RUN/'word-cues/alignment.private.json',
            qa_producer=RUN/'qualification-qa-5628dbc9de4f49a1a6432f1621d8c0e8.producer.private.json',
            alignment_producer=RUN/'qualification-align-809b769bf7694981b0b8576a1d027cca.producer.private.json')
        cls.bound = {}; cls.evidence = m.name_bundle(RUN, cls.rows, cls.profiles, cls.bound, m.bundle_binding(RUN))
        cls.raw_google = {o['key']: o for o in map(json.loads, (RUN/'sourcefree-google-qc-remaining/responses.provider-raw.private.jsonl').read_text().splitlines())}
        cls.google_binding = m.batch.read(RUN/'root-approved-external92/selection1013.private.json')['google_bundles']['remaining317']
        cls.objects, cls.declarations = {}, {}
        for ident in m.CANDIDATE_IDS:
            row = cls.rows[ident]; evidence = cls.evidence[ident]
            primary = m.batch.read(RUN/'asr-raw'/(ident+'.private.json')); large = m.batch.read(RUN/'free-large449/raw'/(ident+'.private.json'))
            obs = m.batch.read(RUN/'sourcefree-google-qc-remaining/observations'/(ident+'.private.json'))
            seconds = cls.takes[ident]['signal']['seconds']
            cls.objects[ident] = (primary, large, obs)
            cls.declarations[ident] = m.exact_declaration(row, cls.takes[ident], evidence, obs, primary, large, seconds)

    def sample(self):
        ident = 'part2-130757a48d5b33c4f4932cd0'
        return ident, self.rows[ident], self.evidence[ident], self.objects[ident]

    def unapproved(self):
        ident, row, _, _ = self.sample()
        return m.case_template(self.args, row, self.takes[ident], copy.deepcopy(self.declarations[ident]), self.google_binding)

    def synthetic_control_fixture(self):
        # Unit-only controls, never an actual Root approval artifact.
        case = self.unapproved(); case.update(status='approved_part2_name_case', reviewed_by='root', actual_whole_source_and_counterevidence_reviewed=True)
        case['word']['review_note'] = 'UNIT_TEST_MEMORY_ONLY, not an actual Root review.'
        for decision in case['word']['creative_decisions']: decision['review_note'] = 'UNIT_TEST_MEMORY_ONLY exact occurrence control.'
        return case

    def evaluate_control(self, case):
        ident, row, evidence, _ = self.sample()
        return m.approved_case(row, evidence, case, self.args, RUN, self.profiles, self.qa, self.alignment,
            self.takes[ident], dict(self.bound), self.raw_google, self.google_binding)

    def mutate_declaration(self, function):
        ident, row, evidence, (primary, large, observation) = self.sample()
        evidence, primary, large, observation = map(copy.deepcopy, [evidence, primary, large, observation])
        function(evidence, primary, large, observation)
        return m.exact_declaration(row, self.takes[ident], evidence, observation, primary, large, self.takes[ident]['signal']['seconds'])

    def test_actual_exact28_freeze_and_all95_physical_evidence(self):
        self.assertEqual(len(self.evidence), 28); self.assertEqual(tuple(self.evidence), m.CANDIDATE_IDS)
        self.assertEqual(m.digest(Path(m.baseline.__file__)), m.BASELINE_SHA)
        self.assertEqual(m.digest(m.batch.ROOT/'scripts/part2_voice_orthography_publish_test.py'), m.BASELINE_TEST_SHA)
        for name, value in m.NAME_FILES.items(): self.assertEqual(m.digest(RUN/m.FOLDER/name), value)

    def test_all_actual28_whole_three_reader_declarations(self):
        self.assertEqual(len(self.declarations), 28)
        self.assertEqual(sum(len(d['typed_specific_Source_name_occurrences']) for d in self.declarations.values()), 32)
        for ident, d in self.declarations.items():
            self.assertEqual(d['whole_current_Source'], self.rows[ident]['text'])
            self.assertIsNone(d['canonical_pronunciation_or_IPA']); self.assertIsNone(d['human_listening_or_phonetic_verdict'])
            self.assertTrue(d['historical_written_casting_proposals_remain_noncanonical'])

    def test_actual_all28_physical_initial_cues_are_flagfree_and_unchanged(self):
        for ident in m.CANDIDATE_IDS:
            temporal, signal, path = m.baseline.original_clip(self.rows[ident], RUN, self.profiles, self.qa, self.alignment,
                self.takes[ident], self.args, dict(self.bound))
            self.assertEqual(temporal['all_qualification_flags'], [])
            self.assertEqual(temporal['word_cues'], m.batch.read(RUN/'word-cues'/(ident+'.json'))['word_cues'])
            self.assertEqual(m.digest(path), self.declarations[ident]['current_MP3_sha256'])
            self.assertEqual(signal, self.takes[ident]['signal'])

    def test_unapproved_template_never_passes(self):
        with self.assertRaises(m.batch.SafeError): self.evaluate_control(self.unapproved())

    def test_synthetic_in_memory_case_controls_preserve_original_public_source_and_cues(self):
        clip, path = self.evaluate_control(self.synthetic_control_fixture())
        ident, row, _, _ = self.sample()
        self.assertEqual(clip['text'], row['text']); self.assertEqual(clip['runtime_keys'], row['runtime_keys'])
        self.assertEqual(clip['word_cues'], m.batch.read(RUN/'word-cues'/(ident+'.json'))['word_cues'])
        self.assertEqual(clip['sha256'], m.digest(path))

    def test_original_primary_failures_are_never_overwritten(self):
        case = self.unapproved(); ident, _, _, _ = self.sample()
        self.assertEqual(case['retained_initial_take'], self.takes[ident]); self.assertTrue(case['retained_initial_take']['reasons'])
        self.assertIsNone(case['reviewed_by']); self.assertEqual(case['retained_initial_timing_flags'], [])

    def test_actual_missing_IPA4_are_outside_candidate_constants(self):
        report = m.batch.read(RUN/m.FOLDER/'all95-specific-name-review.UNAPPROVED.private.json')
        self.assertEqual(len(report['actual_missing_whole_model_IPA_ids']), 4)
        self.assertFalse(set(report['actual_missing_whole_model_IPA_ids']) & set(m.CANDIDATE_IDS))

    def test_null_observed_IPA_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: o['actual_raw_observation'].update(whole_utterance_ipa=None))

    def test_observed_name_uncertainty_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: o['actual_raw_observation'].update(uncertainties=[{'heard_text': 'Kira'}]))

    def test_changed_whole_Google_body_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: o['actual_raw_observation'].update(transcript='Wo sind Kira und Flick bitte?'))

    def test_changed_or_invented_target_IPA_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: o['actual_raw_observation'].update(whole_utterance_ipa='vo zɪnt ˈleːa ʊnt flɪk'))






    def test_changed_whole_ASR_name_or_body_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: l['actual_response'].update(text=' Wo sind Kira und Flick bitte?'))

    def test_wrong_primary_runtime_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: p['actual_runtime_dimensions'].update(n_text_layer=32))

    def test_turbo_is_not_full_large_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: l['actual_runtime']['dimensions'].update(n_text_layer=4))

    def test_fake_actual_audio_time_in_IPA_text_span_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: e['occurrence_case']['actual_occurrences'][0].update(audio_timestamp=0.5))

    def test_boolean_Source_index_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: e['occurrence_case']['actual_occurrences'][0].update(source_word_index=True))

    def test_boolean_IPA_character_index_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: e['occurrence_case']['actual_occurrences'][0]['actual_model_IPA_char_span'].update(start_codepoint=True))

    def test_wrong_IPA_character_span_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: e['occurrence_case']['actual_occurrences'][0]['actual_model_IPA_char_span'].update(end_codepoint=999))

    def test_canonical_status_invented_in_old_proposal_refused(self):
        with self.assertRaises(m.batch.SafeError): self.mutate_declaration(lambda e, p, l, o: e['occurrence_case']['actual_occurrences'][0]['existing_casting_guidance_provenance'][0]['actual_record'].update(status='canonical_audio'))

    def test_whole_observed_laughter_and_breath_counterevidence_not_dropped(self):
        ident = 'part2-fbe9471a09f8e955d5b44050'; row = self.rows[ident]; p, l, o = map(copy.deepcopy, self.objects[ident])
        self.assertTrue(o['actual_raw_observation']['vocal_events']); o['actual_raw_observation']['vocal_events'] = []
        with self.assertRaises(m.batch.SafeError): m.exact_declaration(row, self.takes[ident], self.evidence[ident], o, p, l, self.takes[ident]['signal']['seconds'])

    def test_root_human_claim_refused_before_physical_clip(self):
        c = self.synthetic_control_fixture(); c['human_listening_or_acting_approval'] = True
        with self.assertRaises(m.batch.SafeError): self.evaluate_control(c)

    def test_root_canonical_IPA_claim_refused(self):
        c = self.synthetic_control_fixture(); c['canonical_pronunciation_or_IPA'] = 'invented'
        with self.assertRaises(m.batch.SafeError): self.evaluate_control(c)

    def test_global_alias_metadata_has_no_route(self):
        c = self.synthetic_control_fixture(); c['accepted_name_variants'] = {'Kyra': 'Kira'}
        with self.assertRaises(m.batch.SafeError): self.evaluate_control(c)

    def test_missing_creative_name_occurrence_decision_refused(self):
        c = self.synthetic_control_fixture(); c['word']['creative_decisions'] = []
        with self.assertRaises(m.batch.SafeError): self.evaluate_control(c)

    def test_creative_decision_wrong_current_audio_refused(self):
        c = self.synthetic_control_fixture(); c['word']['creative_decisions'][0]['current_MP3_sha256'] = '0'*64
        with self.assertRaises(m.batch.SafeError): self.evaluate_control(c)

    def test_creative_decision_cannot_change_intended_Source_name(self):
        c = self.synthetic_control_fixture(); c['word']['creative_decisions'][0]['intended_Source_spelling'] = 'Lea'
        with self.assertRaises(m.batch.SafeError): self.evaluate_control(c)



    def test_original_case_input_files_still_match_after_tests(self):
        for path, value in m.batch.read(RUN/m.FOLDER/'all95-specific-name-review.UNAPPROVED.private.json')['input_sha256'].items():
            self.assertEqual(m.digest(path), value)


if __name__ == '__main__': unittest.main(verbosity=2)
