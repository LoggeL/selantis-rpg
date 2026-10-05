import copy
import unittest
import importlib.util
import prolog_voice_word_cues as acoustic
import story_voice_cue_review as review
import story_voice_qa as qa


class CueReviewTests(unittest.TestCase):
    def setUp(self):
        self.id = 'story-' + 'a'*24
        cues = [{'start': .1, 'end': .4}, {'start': .4, 'end': .4}, {'start': .6, 'end': .9}]
        self.receipt = {'id': self.id, 'text': 'Hallo … Lia!', 'decoded_seconds': 1.2,
                        'audio_sha256': 'audio', 'text_sha256': qa.text_hash('Hallo … Lia!'),
                        'source_manifest_sha256': 'source', 'engine_version': 'engine',
                        'word_cues': cues, 'cues_sha256': acoustic.cue_sha(cues)}
        self.take = {'id': self.id, 'reasons': [], 'text_sha256': self.receipt['text_sha256'],
                     'transcript': 'Hallo Lia!'}
        self.qa = {'status': 'review_required', 'manifest_sha256': 'source', 'checked_ids': [self.id],
                   'clip_sha256': {self.id: 'audio'}, 'takes': [self.take], 'failures': []}
        self.words = [{'word': 'Hallo', 'start': .11, 'end': .39}, {'word': 'Lia', 'start': .61, 'end': .89}]
    def audit(self):
        return review.audit(self.receipt, self.qa, 'audio', self.words, [True]*120)
    def test_individual_valid_take_can_support_proposal_in_incomplete_report(self):
        result = self.audit()
        self.assertEqual(result['status'], 'supported_proposal')
        self.assertEqual(result['approval_proposal']['audio_sha256'], 'audio')
        self.assertEqual(len(result['proposed_corrected_cues']), 3)
    def test_wrong_words_and_unapproved_names_rejected(self):
        self.words[1]['word'] = 'Lea'
        self.assertEqual(self.audit()['reason'], 'free_decoder_lexical_mismatch')
    def test_per_clip_bound_explicit_variant_only(self):
        self.words[1]['word'] = 'Lea'
        self.take['transcript'] = 'Hallo Lea!'
        record = {'status': 'accepted_word_variants', 'clip_sha256': 'audio',
                  'text_sha256': self.receipt['text_sha256'], 'transcript_sha256': qa.text_hash(self.take['transcript']),
                  'reviewed_by': 'fixture reviewer', 'reason': 'Explicit fixture pair',
                  'accepted_word_variants': [{'expected': 'Lia', 'observed': 'Lea'}]}
        self.take['adjudication'] = {'record': record}
        self.assertEqual(self.audit()['status'], 'supported_proposal')
        record['clip_sha256'] = 'wrong'
        self.assertEqual(self.audit()['reason'], 'free_decoder_lexical_mismatch')
    def test_wrong_hash_missing_qa_and_failed_take_rejected(self):
        for field in ['audio_sha256', 'source_manifest_sha256', 'text_sha256']:
            original = self.receipt[field]; self.receipt[field] = 'wrong'
            self.assertIsNone(self.audit()['approval_proposal'])
            self.receipt[field] = original
        self.take['reasons'] = ['asr_lexical_mismatch_requires_review']
        self.assertIsNone(self.audit()['approval_proposal'])
        self.take['reasons'] = []
        self.qa['failures'] = [{'id': self.id, 'reason': 'changed_audio'}]
        self.assertIsNone(self.audit()['approval_proposal'])
    def test_large_discrepancy_keeps_corrected_proposal_private(self):
        self.words[1].update(start=.8, end=1.1)
        result = self.audit()
        self.assertIsNone(result['approval_proposal'])
        self.assertEqual(result['proposed_corrected_cues'][-1]['end'], 1.1)
    def test_collapsed_and_silent_intervals_never_approved(self):
        self.receipt['word_cues'][0]['end'] = .11
        self.receipt['cues_sha256'] = acoustic.cue_sha(self.receipt['word_cues'])
        self.assertIsNone(self.audit()['approval_proposal'])
        self.setUp()
        result = review.audit(self.receipt, self.qa, 'audio', self.words, [False]*120)
        self.assertIsNone(result['approval_proposal'])
    def test_wrong_cues_hash_and_extra_decoder_word_rejected(self):
        self.receipt['cues_sha256'] = 'wrong'
        self.assertEqual(self.audit()['reason'], 'current_cues_hash_mismatch')
        self.setUp(); self.words.append({'word': 'Ja', 'start': 1.0, 'end': 1.1})
        self.assertEqual(self.audit()['reason'], 'free_decoder_missing_or_extra_words')


    @unittest.skipUnless(importlib.util.find_spec('numpy'), 'waveform fixture requires local numpy')
    def test_correction_only_when_displaced_region_is_measured_silence(self):
        import numpy as np
        audio = np.zeros(19200, dtype=np.float32)
        audio[1600:6400] = .1
        audio[9600:14400] = .1
        self.words[0]['probability'] = .95
        self.words[1]['probability'] = .95
        self.words[0].update(start=.1, end=.4)
        self.words[1].update(start=.6, end=.9)
        self.receipt['word_cues'][0]['end'] = .59
        self.receipt['word_cues'][1] = {'start': .59, 'end': .59}
        self.receipt['cues_sha256'] = acoustic.cue_sha(self.receipt['word_cues'])
        result = review.correction_plan(self.receipt, self.qa, 'audio', self.words, audio)
        self.assertEqual(result['status'], 'correction_proposed')
        self.assertIsNone(result['approval_proposal'])
        self.assertAlmostEqual(result['proposed_cues'][0]['end'], .4, places=2)
        audio[6400:9440] = .1
        result = review.correction_plan(self.receipt, self.qa, 'audio', self.words, audio)
        self.assertEqual(result['status'], 'retained_for_review')
        self.assertEqual(result['proposed_cues'][0]['end'], .59)

    @unittest.skipUnless(importlib.util.find_spec('numpy'), 'waveform fixture requires local numpy')
    def test_free_collapse_retains_supported_DTW_only_for_root_review(self):
        import numpy as np
        audio = np.full(19200, .1, dtype=np.float32)
        self.words[0].update(start=.2, end=.2, probability=.95)
        self.words[1]['probability'] = .95
        self.receipt['words'] = [{'minimum_token_probability': .8}]*3
        result = review.correction_plan(self.receipt, self.qa, 'audio', self.words, audio)
        self.assertIsNone(result['approval_proposal'])
        self.assertEqual(result['DTW_fallback_indices'], [0])
        self.assertEqual(result['proposed_cues'][0], self.receipt['word_cues'][0])
        self.receipt['words'][0] = {'minimum_token_probability': .01}
        result = review.correction_plan(self.receipt, self.qa, 'audio', self.words, audio)
        self.assertEqual(result['DTW_fallback_indices'], [])
        self.assertTrue(result['unresolved'])


if __name__ == '__main__':
    unittest.main()
