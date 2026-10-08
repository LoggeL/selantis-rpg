"""Offline scoped counterexamples. Synthetic fixtures confer no audio approval."""
import copy
from pathlib import Path
import re
import tempfile
import types
import unittest
from unittest.mock import patch
import part2_voice_orthography_publish as m
import part2_voice_evidence_publish_test as original_tests

NUMBER = 'part2-1d349b6347515e4f62321098'
BOUNDARY = 'part2-b50ae20d5bbc936e75b0215d'


def body_fixture(ident=NUMBER):
    policy = m.CASES[ident]; words = re.findall(r'\w+', policy['Large'])
    response = {'text': policy['Large'], 'segments': [{'text': policy['Large'], 'tokens': [1, 2], 'start': 0.,
        'end': float(len(words)), 'no_speech_prob': .001, 'avg_logprob': -.1, 'compression_ratio': 1.,
        'words': [{'word': ' '+word, 'start': float(i), 'end': i+.5, 'probability': .95} for i, word in enumerate(words)]}]}
    raw = {'id': ident, 'audio_sha256': 'a'*64, 'actual_response': response, 'source_free': True,
        'raw_saved_before_diagnosis': True, 'actual_call_args': copy.deepcopy(m.prior.CALL_ARGS),
        'actual_runtime': {'model_path': str(m.prior.FULL_MODEL.resolve()), 'dimensions': copy.deepcopy(m.prior.FULL_DIMENSIONS)}}
    primary = {'id': ident, 'audio_sha256': 'a'*64, 'source_free': True, 'actual_response': {'text': policy['Primary']}}
    return {'id': ident, 'text': policy['Source']}, {'transcript': policy['Primary'].strip()}, raw, float(len(words)+1), primary


class ExactWritingGuards(unittest.TestCase):
    def test_exact_number_and_boundary_are_individual_and_unchanged(self):
        for ident in [NUMBER, BOUNDARY]:
            values = body_fixture(ident); before = copy.deepcopy(values); detail = m.exact_declaration(*values)
            self.assertEqual(values, before); self.assertEqual(detail['typed_exact_slots'][0]['kind'], m.CASES[ident]['kind'])
            self.assertIsNone(detail['canonical_pronunciation_or_IPA']); self.assertFalse(detail['human_listening_or_acting_approval'])

    def test_whole_source_raw_and_primary_text_mutations_refused(self):
        for field in ['Source', 'Large', 'Primary', 'take', 'raw_audio', 'primary_id', 'source_free']:
            row, take, raw, seconds, primary = body_fixture()
            if field == 'Source': row['text'] += ' Wieder.'
            if field == 'Large': raw['actual_response']['text'] = raw['actual_response']['text'].replace('nicht', '')
            if field == 'Primary': primary['actual_response']['text'] += ' Wieder.'
            if field == 'take': take['transcript'] += ' Wieder.'
            if field == 'raw_audio': raw['audio_sha256'] = 'b'*64
            if field == 'primary_id': primary['id'] = BOUNDARY
            if field == 'source_free': primary['source_free'] = False
            with self.subTest(field=field), self.assertRaises(m.batch.SafeError): m.exact_declaration(row, take, raw, seconds, primary)

    def test_complete_segments_and_word_records_must_agree_with_actual_whole_text(self):
        for change in ['missing', 'repeat', 'drop', 'word', 'overlap', 'nonfinite', 'uncertain']:
            values = body_fixture(); segment = values[2]['actual_response']['segments'][0]
            if change == 'missing': values[2]['actual_response']['segments'] = []
            if change == 'repeat': segment['text'] += ' nicht'
            if change == 'drop': segment['words'].pop()
            if change == 'word': segment['words'][0]['word'] = 'Foltan'
            if change == 'overlap': segment['words'][1]['start'] = 0.
            if change == 'nonfinite': segment['words'][0]['probability'] = float('nan')
            if change == 'uncertain': segment['avg_logprob'] = -1.01
            with self.subTest(change=change), self.assertRaises(m.batch.SafeError): m.exact_declaration(*values)

    def test_all_nonorthographic_cases_and_unknown_ids_are_refused(self):
        for ident in m.EXCLUDED_NON_ORTHOGRAPHY | m.BLOCKED_PRIMARY_BODY | {'part2-'+'0'*24}:
            values = list(body_fixture()); values[0]['id'] = ident
            with self.subTest(ident=ident), self.assertRaises(m.batch.SafeError): m.exact_declaration(*values)

    def test_additional_abhandengekommen_primary_counter_is_not_automatically_cleared(self):
        with self.assertRaisesRegex(m.batch.SafeError, 'additional Primary body'):
            m.exact_declaration(*body_fixture('part2-20091b857377e7b7653f0735'))

    def test_typed_char_and_token_positions_cannot_be_altered(self):
        for change in ['char', 'token', 'bool', 'surface']:
            cases = copy.deepcopy(m.CASES); slot = cases[NUMBER]['spans'][0]
            if change == 'char': slot['expected_char_span'][0] += 1
            if change == 'token': slot['actual_token_span'][0] -= 1
            if change == 'bool': slot['expected_token_span'][0] = True
            if change == 'surface': slot['expected_tokens'][0] = 'Foltan'
            with patch.object(m, 'CASES', cases), self.subTest(change=change), self.assertRaises(m.batch.SafeError): m.exact_declaration(*body_fixture())

    def test_no_broad_word_boundary_number_name_or_vowel_rewrite(self):
        for source, observed in [('Foltan.', 'Voltan.'), ('Pah.', 'Puh.'), ('Sechzehn andere.', '16 andere.'), ('Kanten Brot.', 'Kantenbrot.')]:
            values = list(body_fixture()); values[0]['text'] = source; values[2]['actual_response']['text'] = observed
            with self.subTest(source=source), self.assertRaises(m.batch.SafeError): m.exact_declaration(*values)

    def test_wrong_runtime_source_hint_or_non_sourcefree_response_refused(self):
        for change in ['turbo', 'prompt', 'source_free', 'raw_before']:
            values = body_fixture(); raw = values[2]
            if change == 'turbo': raw['actual_runtime']['dimensions']['n_text_layer'] = 4
            if change == 'prompt': raw['actual_call_args']['initial_prompt'] = values[0]['text']
            if change == 'source_free': raw['source_free'] = False
            if change == 'raw_before': raw['raw_saved_before_diagnosis'] = False
            with self.subTest(change=change), self.assertRaises(m.batch.SafeError): m.exact_declaration(*values)

    def test_exact_policy_census_is_eight_numbers_and_twenty_six_boundaries(self):
        self.assertEqual(len(m.CASES), 34)
        self.assertEqual(sum(v['kind'] == 'number_writing_pair' for v in m.CASES.values()), 8)
        self.assertEqual(sum(v['kind'] == 'word_boundary_pair' for v in m.CASES.values()), 26)
        self.assertFalse(m.EXCLUDED_NON_ORTHOGRAPHY & set(m.CASES))


class OriginalAudioCueGuards(unittest.TestCase):
    def setUp(self):
        self.f = original_tests.EvidencePublication(methodName='runTest'); self.f.setUp(); self.addCleanup(self.f.tearDown)
        self.f.take['reasons'] = ['asr_lexical_mismatch_requires_review']

    def original(self):
        f = self.f
        return m.original_clip(f.row, f.run, f.profiles, f.qa, f.alignment, f.take, f.args, {}, decode_fn=lambda _: f.signal)

    def test_real_original_cues_and_all_initial_diagnostics_stay_unchanged(self):
        before = copy.deepcopy((self.f.take, self.f.temporal, self.f.qa, self.f.alignment))
        temporal, _, path = self.original(); self.assertEqual(temporal['word_cues'], self.f.cues); self.assertEqual(path, self.f.path)
        self.assertEqual(before, (self.f.take, self.f.temporal, self.f.qa, self.f.alignment))

    def test_audio_wav_request_and_report_hash_changes_refused(self):
        f = self.f
        for change in ['mp3', 'wav', 'request', 'qa', 'signal_reason', 'adjudication']:
            with self.subTest(change=change):
                path = f.path if change == 'mp3' else f.run/'raw'/(f.ident+'.wav')
                original_bytes = path.read_bytes(); receipt_path = f.run/'raw'/(f.ident+'.receipt.json'); receipt_bytes = receipt_path.read_bytes()
                original_take, original_qa = copy.deepcopy(f.take), copy.deepcopy(f.qa)
                if change in ['mp3', 'wav']: path.write_bytes(original_bytes+b'CHANGED')
                if change == 'request':
                    receipt = m.batch.read(receipt_path); receipt['request_sha256'] = '0'*64; m.batch.core.save(receipt_path, receipt)
                if change == 'qa': f.qa['clip_sha256'][f.ident] = '0'*64
                if change == 'signal_reason': f.take['reasons'] += ['possible_abrupt_audio_end']
                if change == 'adjudication': f.take['adjudication'] = {'approved': True}
                with self.assertRaises(m.batch.SafeError): self.original()
                path.write_bytes(original_bytes); receipt_path.write_bytes(receipt_bytes); f.take, f.qa = original_take, original_qa

    def test_original_flag_is_held_even_if_a_root_note_would_allow_it(self):
        f = self.f; f.temporal['all_qualification_flags'] = [{'word_index': 0, 'reasons': ['long_acoustic_interval']}]
        m.batch.core.save(f.run/'word-cues'/(f.ident+'.json'), f.temporal)
        with patch.object(m.base.cue_engine, 'qualification_flags', return_value=f.temporal['all_qualification_flags']), self.assertRaisesRegex(m.batch.SafeError, 'timing flag'):
            self.original()

    def test_original_cue_and_spoken_false_or_collapsed_lexical_mutations_refused(self):
        f = self.f
        for change in ['cue', 'spoken', 'collapsed']:
            original = copy.deepcopy(f.temporal)
            if change == 'cue': f.temporal['word_cues'][0]['start'] += .01
            if change == 'spoken': f.temporal['words'][0]['spoken'] = False
            if change == 'collapsed': f.temporal['word_cues'][0]['end'] = f.temporal['word_cues'][0]['start']
            m.batch.core.save(f.run/'word-cues'/(f.ident+'.json'), f.temporal)
            with self.subTest(change=change), self.assertRaises(m.batch.SafeError): self.original()
            f.temporal = original; m.batch.core.save(f.run/'word-cues'/(f.ident+'.json'), original)

    def test_missing_or_nonroot_approval_never_receives_clearance(self):
        f = self.f
        for status, reviewed in [('UNAPPROVED_part2_orthography_case', None), ('approved_part2_orthography_case', 'worker')]:
            with self.subTest(status=status, reviewed=reviewed), self.assertRaises(m.batch.SafeError):
                m.approved_case(f.row, f.run, f.profiles, f.qa, f.alignment, f.take,
                    {'version': m.VERSION, 'status': status, 'reviewed_by': reviewed}, f.args, {}, {})


class EntirePriorUnionGuards(unittest.TestCase):
    def fixture(self, td):
        root = Path(td); (root/'scripts').mkdir(); (root/'scripts'/Path(m.__file__).name).write_text('synthetic byte-identity test')
        args = types.SimpleNamespace(run_dir=str(root/'run'), selection=root/'initial', supplemental_selection=root/'supplemental',
            external_selection=root/'external', sourcefree_timing_selection=root/'sourcefree', orthography_selection=root/'orthography',
            qa_report=root/'qa', alignment_report=root/'align')
        old = 'part2-'+'f'*24; previous = {'target_root': str(root), 'preserved_banks_sha256': {'old188': 'p', 'old1490': 's'}}
        selected = {'version': m.VERSION, 'status': 'approved_part2_orthography_selection', 'reviewed_by': 'root',
            'human_listening_or_acting_approval': False, 'initial_selection_sha256': 'a'*64, 'supplemental_selection_sha256': 'a'*64,
            'external_selection_sha256': 'a'*64, 'sourcefree_timing_selection_sha256': 'a'*64,
            'baseline_adapter_sha256': m.BASELINE_SHA, 'adapter_sha256': 'a'*64, **previous,
            'selected_ids': [old, NUMBER], 'secondary_bundle': {'whole449': True}, 'case_approvals': [{'path': str(root/'case'), 'sha256': 'a'*64}]}
        public = {'clips': [{'id': old, 'old_flags': ['KEEP'], 'original_false': False}],
            'coverage': {'missing_sources': [{'id': NUMBER}, {'id': BOUNDARY, 'reasons': ['held original']}],
                'retained_239': 239, 'all_original_flags_and_discarded_active_counterevidence_retained': True}}
        rows = [{'id': i} for i in [old, NUMBER, BOUNDARY]]
        def dig(path):
            if Path(path) == Path(m.baseline.__file__): return m.BASELINE_SHA
            if Path(path).name == 'part2_voice_sourcefree_timing_publish_test.py': return m.BASELINE_TEST_SHA
            return 'a'*64
        def read(path):
            if Path(path).name == 'lines.private.json': return {'lines': rows}
            if Path(path).name == 'profiles.private.json': return {'speakers': {}}
            return {}
        return args, previous, selected, public, rows, dig, read

    def run_build(self, fixture, side_effect=None):
        args, previous, selected, public, rows, dig, read = fixture
        with patch.object(m, 'digest', side_effect=dig), patch.object(m.baseline, 'build', return_value=(public, {}, {'p': 's'}, {}, previous)) as whole, \
            patch.object(m.external, 'pin_file'), patch.object(m.batch, 'read', side_effect=read), \
            patch.object(m.base, 'report_coverage', return_value=({r['id']: {} for r in rows}, {r['id'] for r in rows})), \
            patch.object(m.prior, 'secondary_bundle', side_effect=side_effect, return_value={}) as secondary, \
            patch.object(m.prior, 'bound_ref', return_value={'binding': {'id': NUMBER}}), \
            patch.object(m.base, 'response_records', return_value=[]), \
            patch.object(m, 'approved_case', return_value=({'id': NUMBER, 'cues': 'unchanged'}, Path('/synthetic-only'))):
            result = m.build(args, previous, {}, {}, {}, selected)
            whole.assert_called_once_with(args, previous, {}, {}, {}); secondary.assert_called_once()
            return result

    def test_full_prior_failure_blocks_before_any_writing_case_or_model_bundle(self):
        with patch.object(m, 'digest', side_effect=[m.BASELINE_SHA, m.BASELINE_TEST_SHA]), \
            patch.object(m.baseline, 'build', side_effect=m.batch.SafeError('whole baseline failed')) as whole, \
            patch.object(m.prior, 'secondary_bundle') as secondary:
            with self.assertRaisesRegex(m.batch.SafeError, 'whole baseline failed'): m.build(None, {}, {}, {}, {}, {})
            whole.assert_called_once(); secondary.assert_not_called()

    def test_whole_original449_failure_blocks_no_subset_only_runtime_route(self):
        with tempfile.TemporaryDirectory() as td, self.assertRaisesRegex(m.batch.SafeError, 'full32 runtime'):
            self.run_build(self.fixture(td), side_effect=m.batch.SafeError('full32 runtime differs'))

    def test_complete_old_union_flags_false_239_and_other_holds_remain(self):
        with tempfile.TemporaryDirectory() as td:
            fixture = self.fixture(td); before = copy.deepcopy(fixture[3]); public, _, preserved, _, _ = self.run_build(fixture)
            self.assertEqual(fixture[3], before); self.assertEqual(public['clips'][0], before['clips'][0])
            self.assertEqual(public['coverage']['retained_239'], 239); self.assertEqual(public['coverage']['missing_sources'], [before['coverage']['missing_sources'][1]])
            self.assertEqual(preserved, {'p': 's'})

    def test_duplicate_or_unknown_approval_and_drop_prior_case_refused(self):
        for change in ['duplicate', 'unknown', 'drop', 'clitic']:
            with tempfile.TemporaryDirectory() as td:
                fixture = self.fixture(td); selected = fixture[2]
                if change == 'duplicate': selected['case_approvals'] *= 2
                if change == 'unknown': selected['selected_ids'].append('part2-'+'0'*24)
                if change == 'drop': selected['selected_ids'].pop(0)
                if change == 'clitic': selected['selected_ids'].append(next(iter(m.EXCLUDED_NON_ORTHOGRAPHY)))
                with self.subTest(change=change), self.assertRaises(m.batch.SafeError): self.run_build(fixture)

    def test_frozen_whole_baseline_and_tests_are_actual_bytes(self):
        self.assertEqual(m.digest(Path(m.baseline.__file__)), m.BASELINE_SHA)
        self.assertEqual(m.digest(Path(m.baseline.__file__).with_name('part2_voice_sourcefree_timing_publish_test.py')), m.BASELINE_TEST_SHA)


if __name__ == '__main__': unittest.main()
