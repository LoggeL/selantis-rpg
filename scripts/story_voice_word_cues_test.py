"""Offline integrity and adjudication gates; no MLX or network required."""
import copy
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import story_voice_word_cues as cues


class StoryAlignmentTests(unittest.TestCase):
    def receipt(self):
        return {'id': 'story-' + 'a' * 24, 'text': 'Wo … bist du?',
                'decoded_seconds': 3.0, 'audio_sha256': 'audio', 'text_sha256': 'text',
                'source_manifest_sha256': 'source', 'engine_version': cues.ENGINE,
                'cues_sha256': 'cues', 'all_qualification_flags': [],
                'word_cues': [{'start': .1, 'end': .3}, {'start': .3, 'end': .3},
                              {'start': 1.1, 'end': 1.3}, {'start': 1.4, 'end': 1.6}]}

    def test_exact_authored_words_and_pause_marks(self):
        row = self.receipt()
        words = cues.cue_words(row['text'], row['word_cues'], 3)
        self.assertEqual([w['word'] for w in words], ['Wo', '…', 'bist', 'du?'])
        self.assertEqual(words[1]['start'], words[1]['end'])
        report = cues.report_for([row])
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(report['clip_sha256'][row['id']], 'audio')
        self.assertEqual(report['alignment_by_id'][row['id']]['word_count'], 4)

    def test_bad_cardinality_overlap_nonfinite_and_duration_rejected(self):
        row = self.receipt()
        cases = []
        cases.append(row['word_cues'][:-1])
        for field, value in [('start', .2), ('end', float('nan')), ('end', 3.1), ('start', True)]:
            bad = copy.deepcopy(row['word_cues'])
            bad[2][field] = value
            cases.append(bad)
        for bad in cases:
            with self.subTest(cues=bad), self.assertRaises(RuntimeError):
                cues.cue_words(row['text'], bad, 3)

    def test_flagged_cues_withheld_until_current_explicit_adjudication(self):
        row = self.receipt()
        row['all_qualification_flags'] = [{'reason': 'collapsed_acoustic_interval'}]
        report = cues.report_for([row])
        self.assertEqual(report['status'], 'needs_review')
        self.assertNotIn(row['id'], report['alignment_by_id'])
        approval = {key: row[key] for key in ['audio_sha256', 'text_sha256',
                                             'source_manifest_sha256', 'cues_sha256', 'engine_version']}
        approval.update(decision='reviewed', review_note='Listened to the actual word onset and ending.')
        self.assertEqual(cues.report_for([row], {row['id']: approval})['status'], 'passed')
        for field in ['audio_sha256', 'text_sha256', 'source_manifest_sha256', 'cues_sha256', 'engine_version']:
            stale = {**approval, field: 'stale'}
            self.assertEqual(cues.report_for([row], {row['id']: stale})['alignment_by_id'], {})
        self.assertFalse(cues.adjudicated(row, {**approval, 'review_note': ''}))

    def test_waveform_refinement_cannot_erase_original_flag(self):
        row = self.receipt()
        row.update(original_qualification_flags=[{'word_index': 0, 'word': 'Wo',
                                                  'reasons': ['collapsed_acoustic_interval']}],
                   qualification_flags=[],
                   words=[{'word': text, 'spoken': text != '…', 'minimum_token_probability': .8}
                          for text in row['text'].split()])
        flags = cues.qualification_flags(row)
        self.assertTrue(any('collapsed_acoustic_interval' in f['reasons'] for f in flags))

    def test_internal_pause_and_low_probability_require_review(self):
        row = self.receipt()
        row['word_cues'][2] = {'start': 2.0, 'end': 2.2}
        row['word_cues'][3] = {'start': 2.3, 'end': 2.6}
        row['words'] = [{'word': word, 'spoken': word != '…', 'minimum_token_probability': .01}
                        for word in row['text'].split()]
        flags = cues.qualification_flags(row)
        self.assertTrue(any('long_internal_pause' in f['reasons'] for f in flags))
        self.assertTrue(any('low_authored_token_probability' in f['reasons'] for f in flags))

    def test_absolute_local_model_validation_and_default_helper(self):
        with tempfile.TemporaryDirectory() as directory:
            model = Path(directory)
            (model / 'config.json').write_text('{}')
            with self.assertRaises(RuntimeError):
                cues.resolve_model_dir(model)
            (model / 'weights.safetensors').write_bytes(b'local fixture')
            self.assertEqual(cues.resolve_model_dir(model), model.resolve())
            with patch('prolog_voice_qa.cached_model', return_value=str(model)) as helper:
                self.assertEqual(cues.resolve_model_dir(), model.resolve())
                helper.assert_called_once_with()
        with self.assertRaises(RuntimeError):
            cues.resolve_model_dir('relative/model')
        with self.assertRaises(RuntimeError):
            cues.resolve_model_dir('/nonexistent/story-model')

    def test_approval_cannot_allow_invalid_intervals(self):
        row = self.receipt()
        row['word_cues'][2]['start'] = .2
        report = cues.report_for([row])
        self.assertEqual(report['status'], 'needs_review')
        self.assertEqual(report['alignment_by_id'], {})


if __name__ == '__main__':
    unittest.main()
