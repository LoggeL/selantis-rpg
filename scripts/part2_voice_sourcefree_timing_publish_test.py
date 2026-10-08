#!/usr/bin/env python3
"""Scoped offline counterexamples for the additive genuine89 publication lane."""
import copy
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
import part2_voice_sourcefree_timing_publish as m


def response(text='Eins.', start=.1, end=.6, probability=.9):
    word = {'word': ' '+text, 'start': start, 'end': end, 'probability': probability}
    return {'text': text, 'segments': [{'text': text, 'tokens': [1, 2], 'start': 0., 'end': 1.,
            'no_speech_prob': 0., 'avg_logprob': -.1, 'compression_ratio': 1., 'words': [word]}]}


class DetailGuards(unittest.TestCase):
    def detail(self, actual, source='Eins.'):
        row = {'id': 'part2-'+'1'*24, 'text': source}
        record = {'original_all_qualification_flags': [{'word_index': 0, 'reasons': ['long_acoustic_interval']}],
                  'discarded_active_regions': [{'flag': 'exact', 'discarded_active_regions': {'leading': [{'start': 0, 'end': .1, 'frames': 10}], 'trailing': []}}]}
        body = {'exact_normalized_full_words': True, 'actual_intervals_valid': True, 'uncertainty_reasons': [],
                'actual_interval_uncertainty_reasons': []}
        with patch.object(m, 'digest', return_value='a'*64):
            return m.strict_detail({'actual_response': actual}, row, record, body, Path('/tmp/raw'), Path('/tmp/diag'), {'waveform_sha256': 'b'*64}, 2.)

    def test_whole_literal_one_to_one_time_candidate(self):
        actual = response(); snapshot = copy.deepcopy(actual); detail, words = self.detail(actual)
        self.assertTrue(detail['strict_time_candidate_without_approval']); self.assertEqual(words[0]['start'], .1)
        self.assertEqual(actual, snapshot); self.assertIsNone(detail['approval'])

    def test_no_name_or_vowel_exception(self):
        detail, _ = self.detail(response('Einz.'))
        self.assertFalse(detail['strict_time_candidate_without_approval'])

    def test_probability_below_actual_threshold_remains_held(self):
        detail, _ = self.detail(response(probability=.019))
        self.assertFalse(detail['strict_time_candidate_without_approval']); self.assertEqual(len(detail['actual_numeric_time_risks']), 1)

    def test_long_actual_interval_remains_held(self):
        detail, _ = self.detail(response(end=1.7))
        self.assertFalse(detail['strict_time_candidate_without_approval'])

    def test_collapsed_real_lexical_interval_remains_held(self):
        detail, _ = self.detail(response(end=.1))
        self.assertFalse(detail['strict_time_candidate_without_approval'])

    def test_nonfinite_real_probability_remains_held(self):
        detail, _ = self.detail(response(probability=float('nan')))
        self.assertFalse(detail['strict_time_candidate_without_approval'])

    def test_whole_segment_uncertainty_remains_held(self):
        actual = response(); actual['segments'][0]['avg_logprob'] = -1.01
        detail, _ = self.detail(actual); self.assertFalse(detail['strict_time_candidate_without_approval'])

    def test_one_to_many_mapping_not_aggregated(self):
        actual = response('Eins-Zwei.'); detail, _ = self.detail(actual, 'Eins Zwei.')
        self.assertFalse(detail['one_to_one_lexical_word_mapping']); self.assertFalse(detail['strict_time_candidate_without_approval'])

    def test_standalone_punctuation_not_given_invented_time(self):
        detail, _ = self.detail(response('Eins.'), 'Eins …')
        self.assertFalse(detail['one_to_one_lexical_word_mapping'])

    def test_original_counterevidence_is_retained(self):
        detail, _ = self.detail(response())
        self.assertEqual(detail['retained_original_timing_flags'][0]['reasons'], ['long_acoustic_interval'])
        self.assertEqual(detail['retained_original_discarded_activity_counterevidence'][0]['discarded_active_regions']['leading'][0]['frames'], 10)


class WholeBeforeUnion(unittest.TestCase):
    def setup_fixture(self, td):
        root = Path(td); (root/'scripts').mkdir(); (root/'scripts'/Path(m.__file__).name).write_text('synthetic adapter file')
        baseline = ['part2-'+format(i, '024x') for i in range(2)]
        extra = ['part2-'+format(i, '024x') for i in range(2, 57)]
        rows = [{'id': ident, 'text': 'Eins.', 'speaker': 'flick', 'kind': 'say', 'display_text': 'Eins.', 'runtime_keys': []} for ident in baseline+extra]
        args = types.SimpleNamespace(run_dir=str(root/'run'), selection=root/'initial', supplemental_selection=root/'supplemental',
            external_selection=root/'external', sourcefree_timing_selection=root/'sourcefree', qa_report=root/'qa', alignment_report=root/'align')
        previous = {'target_root': str(root), 'preserved_banks_sha256': {'story': 's', 'prolog': 'p'}}
        selection = {'version': m.VERSION, 'status': 'approved_part2_sourcefree89_timing_selection', 'reviewed_by': 'root',
            'human_listening_or_acting_approval': False, 'initial_selection_sha256': 'a'*64, 'supplemental_selection_sha256': 'a'*64,
            'external_selection_sha256': 'a'*64, 'external_adapter_sha256': m.EXTERNAL_SHA, 'adapter_sha256': 'a'*64,
            **previous, 'selected_ids': baseline+extra, 'sourcefree89_bundle': {'whole': True},
            'case_approvals': [{'path': str(root/ident), 'sha256': 'a'*64} for ident in extra]}
        public = {'clips': [{'id': i, 'untouched': i} for i in baseline],
                  'coverage': {'missing_sources': [{'id': i} for i in extra], 'published_sources': 2}}
        cases = {str(root/i): {'binding': {'id': i}} for i in extra}
        def dig(path):
            if Path(path) == Path(m.external.__file__): return m.EXTERNAL_SHA
            if Path(path).name == 'part2_voice_external_evidence_publish_test.py': return m.EXTERNAL_TEST_SHA
            return 'a'*64
        def read(path):
            if Path(path).name == 'lines.private.json': return {'lines': rows}
            if Path(path).name == 'profiles.private.json': return {'speakers': {}}
            return {}
        return args, previous, selection, public, cases, rows, baseline, extra, dig, read

    def test_full_external_failure_blocks_before89(self):
        with tempfile.TemporaryDirectory() as td:
            args, previous, selection, public, cases, rows, old, new, dig, read = self.setup_fixture(td)
            with (patch.object(m, 'digest', side_effect=dig), patch.object(m.external, 'build', side_effect=m.batch.SafeError('actual baseline fail')),
                 patch.object(m, 'whole_bundle') as whole):
                with self.assertRaises(m.batch.SafeError): m.build(args, {'target_root': previous['target_root']}, {}, {}, selection)
                whole.assert_not_called()

    def run_fixture(self, td, edit=None):
        args, previous, selection, public, cases, rows, old, new, dig, read = self.setup_fixture(td)
        if edit: edit(selection, cases)
        def clip(row, *_): return {'id': row['id'], 'exact': True}, Path(td)/row['id']
        with (patch.object(m, 'digest', side_effect=dig), patch.object(m.external, 'build', return_value=(public, {}, {}, {}, previous)),
             patch.object(m.external, 'pin_file'), patch.object(m.batch, 'read', side_effect=read),
             patch.object(m.base, 'report_coverage', return_value=({r['id']: {} for r in rows}, set(old+new))),
             patch.object(m, 'whole_bundle', return_value={i: {'eligible_for_root_approval': True} for i in new}),
             patch.object(m.prior, 'bound_ref', side_effect=lambda run, ref, bound: cases[ref['path']]),
             patch.object(m.base, 'response_records', return_value=[]), patch.object(m, 'approved_case', side_effect=clip)):
            return m.build(args, {'target_root': previous['target_root']}, {}, {}, selection), public

    def test_preserves_entire_verified_baseline_and_truthful_union(self):
        with tempfile.TemporaryDirectory() as td:
            (union, *_), baseline = self.run_fixture(td)
            self.assertEqual(union['clips'][:2], baseline['clips']); self.assertEqual(len(union['clips']), 57)
            self.assertEqual(union['coverage']['sourcefree89_qualified_sources'], 55)
            self.assertEqual(union['coverage']['sourcefree89_whole_unapproved_holds_retained'], 34)
            self.assertFalse(union['coverage']['human_listening_or_acting_approval'])

    def test_dropped_baseline_source_refused(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(m.batch.SafeError): self.run_fixture(td, lambda s, _: s['selected_ids'].pop(0))

    def test_missing_individual_root_approval_refused(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(m.batch.SafeError): self.run_fixture(td, lambda s, _: s['case_approvals'].pop())

    def test_duplicate_root_case_refused(self):
        with tempfile.TemporaryDirectory() as td:
            def edit(s, _): s['case_approvals'][-1] = s['case_approvals'][0]
            with self.assertRaises(m.batch.SafeError): self.run_fixture(td, edit)

    def test_unapproved_root_selection_refused(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(m.batch.SafeError): self.run_fixture(td, lambda s, _: s.update(status='UNAPPROVED'))

    def test_human_approval_claim_refused(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(m.batch.SafeError): self.run_fixture(td, lambda s, _: s.update(human_listening_or_acting_approval=True))

    def test_only_individually_chosen_covered_cases_permitted(self):
        with tempfile.TemporaryDirectory() as td:
            def edit(s, _): s['selected_ids'].pop(); s['case_approvals'].pop()
            (union, *_), _ = self.run_fixture(td, edit)
            self.assertEqual(union['coverage']['sourcefree89_qualified_sources'], 54)


class PhysicalCoverage(unittest.TestCase):
    def coverage(self, low=.2, high=.5, frames=30, start=.1, end=.6):
        row = {'text': 'Eins.'}; words = [{'word': ' Eins.', 'start': start, 'end': end, 'probability': .9}]
        counter = [{'flag': {'word_index': 0, 'word': 'Eins.', 'reasons': ['long_acoustic_interval']},
                    'discarded_active_regions': {'leading': [{'start': low, 'end': high, 'frames': frames}], 'trailing': []}}]
        before = copy.deepcopy((row, words, counter)); result = m.discarded_activity_coverage(row, words, counter)
        self.assertEqual((row, words, counter), before)
        return result

    def test_actual_activity_fully_inside_same_real_word(self):
        self.assertTrue(self.coverage()['all_original_discarded_activity_within_actual_new_words'])

    def test_exact_boundaries_are_covered(self):
        self.assertTrue(self.coverage(.1, .6, 50)['all_original_discarded_activity_within_actual_new_words'])

    def test_leading_activity_outside_is_held(self):
        result = self.coverage(.0, .3, 30)
        self.assertFalse(result['all_original_discarded_activity_within_actual_new_words'])
        self.assertEqual(result['details'][0]['outside_active_regions'][0]['side'], 'leading')

    def test_trailing_activity_outside_is_held(self):
        self.assertFalse(self.coverage(.5, .9, 40)['all_original_discarded_activity_within_actual_new_words'])

    def test_no_generic10ms_padding(self):
        self.assertFalse(self.coverage(.09, .59, 50)['all_original_discarded_activity_within_actual_new_words'])

    def test_one_binary64_representable_step_only(self):
        import math
        lower = math.nextafter(.1, -math.inf)
        self.assertTrue(self.coverage(lower, .5, 40)['all_original_discarded_activity_within_actual_new_words'])
        lower = math.nextafter(lower, -math.inf)
        self.assertFalse(self.coverage(lower, .5, 40)['all_original_discarded_activity_within_actual_new_words'])

    def test_nonactual_frame_count_refused(self):
        with self.assertRaises(m.batch.SafeError): self.coverage(frames=31)

    def test_missing_counterevidence_not_waived(self):
        with self.assertRaises(m.batch.SafeError): m.discarded_activity_coverage({'text': 'Eins.'}, [{'word': ' Eins.', 'start': .1, 'end': .6}], [])

    def test_activity_cannot_be_assigned_to_a_different_word(self):
        row = {'text': 'Eins zwei.'}; words = [{'word': ' Eins', 'start': .1, 'end': .3}, {'word': ' zwei.', 'start': .4, 'end': .9}]
        counter = [{'flag': {'word_index': 0}, 'discarded_active_regions': {'leading': [{'start': .5, 'end': .7, 'frames': 20}], 'trailing': []}}]
        self.assertFalse(m.discarded_activity_coverage(row, words, counter)['all_original_discarded_activity_within_actual_new_words'])


if __name__ == '__main__': unittest.main()
