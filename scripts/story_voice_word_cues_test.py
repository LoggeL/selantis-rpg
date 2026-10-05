"""Offline integrity and adjudication gates; no MLX or network required."""
import copy
import unittest
import tempfile
import json
import prolog_voice_word_cues as acoustic
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


    def test_qualified_CTC_reuse_preserves_original_flags_without_loading_model(self):
        with tempfile.TemporaryDirectory() as directory:
            run=Path(directory);(run/'clips').mkdir();(run/'word-cues').mkdir();(run/'ctc-align').mkdir()
            row=self.receipt();ident=row['id'];mp3=run/'clips'/(ident+'.mp3');mp3.write_bytes(b'offline MP3 fixture')
            line={'id':ident,'text':row['text'],'kind':'say','speaker':'lia'}
            (run/'lines.private.json').write_text(json.dumps({'lines':[line]}))
            expected={'audio_sha256':acoustic.sha(mp3),'text_sha256':cues.text_sha(row['text']),
                      'source_manifest_sha256':acoustic.sha(run/'lines.private.json'),'engine_version':cues.ENGINE}
            model={'local_directory':directory,'revision':'a'*40,'fingerprint':'fixture'}
            binding={**{k:v for k,v in expected.items()if k!='engine_version'},
                     'engine':'story-german-ctc-expanded-blank-v2','script_sha256':acoustic.sha(Path(cues.__file__).with_name('story_voice_ctc_align.py')),'model':model}
            actual={'binding':binding,'alignment':{'words':[{'word':word,**cue}for word,cue in zip(row['text'].split(),row['word_cues'])]}}
            cp=run/'ctc-align'/(ident+'.ctc.private.json');cp.write_text(json.dumps(actual))
            row.update(expected);row['engine_version']=cues.ENGINE+'/story-CTC-private-adoption-v1'
            row['cues_sha256']=acoustic.cue_sha(row['word_cues'])
            row['CTC_adoption']={'ctc_receipt_sha256':acoustic.sha(cp),'binding':binding}
            row['all_qualification_flags']=[{'reason':'original_DTW_collapsed'}];row['raw_word_cues']=copy.deepcopy(row['word_cues'])
            row['original_qualification_flags']=copy.deepcopy(row['all_qualification_flags'])
            approval={k:row[k]for k in['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256','engine_version']}
            approval.update(decision='reviewed',review_note='Explicit fixture root timing review',ctc_receipt_sha256=acoustic.sha(cp),CTC_binding=binding)
            ap=run/'qualifications.json';ap.write_text(json.dumps({'approvals':{ident:approval}}))
            (run/'word-cues'/(ident+'.json')).write_text(json.dumps(row))
            (run/'public-manifest.proposed.json').write_text(json.dumps({'clips':[{**line,'sha256':expected['audio_sha256'],'seconds':3.0}]}))
            with patch('story_voice_ctc_align.model_identity',return_value=model), patch.object(cues.story,'prepared'), patch.object(acoustic,'decode',return_value=[0]*48000), patch.object(cues,'load_local_model',side_effect=AssertionError('GPU model must remain unloaded')) as load:
                result=cues.align_run(run,run/'word-cues',ap)
                load.assert_not_called();self.assertEqual(result['status'],'passed')
                saved=json.loads((run/'word-cues'/(ident+'.json')).read_text())
                self.assertEqual(saved['all_qualification_flags'],row['all_qualification_flags'])
                self.assertEqual(saved['raw_word_cues'],row['raw_word_cues'])
                for field in ['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256']:
                    bad=copy.deepcopy(row);bad[field]='stale'
                    self.assertFalse(cues.qualified_CTC_cache(bad,expected,approval,run))
                bad_approval={**approval,'decision':'unreviewed'}
                self.assertFalse(cues.qualified_CTC_cache(row,expected,bad_approval,run))
                with patch('story_voice_ctc_align.model_identity',return_value={'changed':'model'}):
                    self.assertFalse(cues.qualified_CTC_cache(row,expected,approval,run))
                original_sha=acoustic.sha
                with patch.object(acoustic,'sha',side_effect=lambda p: 'changed-script' if Path(p).name=='story_voice_ctc_align.py' else original_sha(p)):
                    self.assertFalse(cues.qualified_CTC_cache(row,expected,approval,run))
                changed=copy.deepcopy(actual);changed['binding']['script_sha256']='stale';cp.write_text(json.dumps(changed))
                self.assertFalse(cues.qualified_CTC_cache(row,expected,approval,run))
                cp.write_text(json.dumps(actual)+' ')
                self.assertFalse(cues.qualified_CTC_cache(row,expected,approval,run))


if __name__ == '__main__':
    unittest.main()
