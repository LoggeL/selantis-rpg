"""Offline CTC path, character mapping, confidence and frozen-state fixtures."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import numpy as np
import story_voice_ctc_align as ctc
import story_voice_qa as qa


class GermanCTCAlignmentTests(unittest.TestCase):
    def vocab(self):
        return {char:index for index,char in enumerate(['<pad>','|',"'",'-',*'abcdefghijklmnopqrstuvwxyzäöü'])}
    def emissions(self, labels, vocab):
        probabilities=np.full((len(labels),len(vocab)),.0001)
        for frame,label in enumerate(labels):
            probabilities[frame,vocab[label]]=.99
        probabilities/=probabilities.sum(axis=1,keepdims=True)
        return np.log(probabilities)
    def test_authored_names_case_unicode_and_punctuation_word_cardinality(self):
        mapping=ctc.authored_tokens('„Straße“ … Lia! Honig-Apfelkuchen.',self.vocab())
        self.assertEqual(mapping['display_words'],['„Straße“','…','Lia!','Honig-Apfelkuchen.'])
        self.assertEqual(''.join(mapping['characters']),'strasse|lia|honig-apfelkuchen')
        self.assertNotIn(1,mapping['word_owners'])
        with self.assertRaises(ValueError):ctc.authored_tokens('256',self.vocab())
        with self.assertRaises(ValueError):ctc.authored_tokens('René',self.vocab())
    def test_adjacent_repeated_characters_need_blank(self):
        vocab=self.vocab();emission=self.emissions(['<pad>','l','<pad>','l','<pad>'],vocab)
        frames,score=ctc.ctc_viterbi(emission,[vocab['l'],vocab['l']],vocab['<pad>'])
        self.assertEqual(frames,[[1],[3]])
        self.assertTrue(np.isfinite(score))
        with self.assertRaises(ValueError):ctc.ctc_viterbi(emission[:2],[vocab['l'],vocab['l']],0)
    def test_distinct_characters_can_skip_intermediate_blank(self):
        vocab=self.vocab();emission=self.emissions(['<pad>','l','i','a','<pad>'],vocab)
        frames,_=ctc.ctc_viterbi(emission,[vocab[c]for c in 'lia'],0)
        self.assertEqual(frames,[[1],[2],[3]])
    def test_word_times_from_actual_model_frames_no_duration_proportions(self):
        vocab=self.vocab();mapping=ctc.authored_tokens('Lia … Lia!',vocab)
        labels=['<pad>','l','i','a','|','<pad>','<pad>','l','i','a','<pad>']
        emission=self.emissions(labels,vocab)
        config={'conv_kernel':[1],'conv_stride':[320]}
        samples=(len(labels)-1)*320+1
        result=ctc.align_emissions(emission,mapping,0,samples,config)
        self.assertEqual([w['word']for w in result['words']],['Lia','…','Lia!'])
        self.assertLess(result['words'][0]['end'],result['words'][2]['start'])
        self.assertEqual(result['words'][1]['start'],result['words'][0]['end'])
        self.assertEqual(result['qualification_flags'],[])
        with self.assertRaises(ValueError):ctc.align_emissions(emission,mapping,0,samples+640,config)
    def test_nonfinite_and_bad_labels_rejected(self):
        vocab=self.vocab();emission=self.emissions(['<pad>','a','<pad>'],vocab)
        emission[0,0]=float('nan')
        with self.assertRaises(ValueError):ctc.ctc_viterbi(emission,[vocab['a']],0)
        with self.assertRaises(ValueError):ctc.ctc_viterbi(np.zeros((3,3)),[0],0)
    def test_forced_low_confidence_is_flagged_not_blessed(self):
        vocab=self.vocab();mapping=ctc.authored_tokens('Lia',vocab)
        emission=self.emissions(['<pad>','x','x','x','<pad>'],vocab)
        result=ctc.align_emissions(emission,mapping,0,1281,{'conv_kernel':[1],'conv_stride':[320]})
        self.assertTrue(any(f['reason']=='low_independent_CTC_character_confidence'for f in result['qualification_flags']))
    def test_QA_requires_current_audio_source_text_individually_clean_take(self):
        line={'id':'story-'+'a'*24,'text':'Hallo Lia'}
        take={'id':line['id'],'text_sha256':qa.text_hash(line['text']),'transcript':'Hallo Lia','reasons':[]}
        report={'status':'review_required','manifest_sha256':'source','clip_sha256':{line['id']:'audio'},'checked_ids':[line['id']],'takes':[take],'failures':[]}
        self.assertTrue(ctc.clean_qa(line,'audio','source',report))
        self.assertFalse(ctc.clean_qa(line,'changed','source',report))
        self.assertFalse(ctc.clean_qa(line,'audio','changed',report))
        take['reasons']=['pending_retake'];self.assertFalse(ctc.clean_qa(line,'audio','source',report))
    def test_missing_pending_clip_skips_without_model_inference(self):
        with tempfile.TemporaryDirectory()as directory:
            root=Path(directory);model=root/'model';model.mkdir()
            for name,data in [('config.json',{}),('preprocessor_config.json',{}),('vocab.json',self.vocab())]:
                (model/name).write_text(json.dumps(data))
            (model/'pytorch_model.bin').write_bytes(b'offline fixture')
            run=root/'run';run.mkdir();target=root/'proposals'
            (run/'lines.private.json').write_text(json.dumps({'lines':[{'id':'story-'+'a'*24,'text':'Lia'}]}))
            qa_path=run/'qa.private.json';qa_path.write_text(json.dumps({'manifest_sha256':qa.digest(run/'lines.private.json')}))
            ctc.proposals(run,qa_path,model,'a'*40,target)
            report=json.loads((target/'ctc-proposals.private.json').read_text())
            self.assertEqual(report['results'][0]['status'],'missing_current_audio')
            self.assertIsNone(report['approval'])
            self.assertTrue(report['requires_root_review'])
            with self.assertRaises(ValueError):ctc.model_identity(model,'main')


    def test_greedy_decode_is_unprompted_and_repeat_blank_aware(self):
        vocab=self.vocab()
        emission=self.emissions(['<pad>','l','l','<pad>','l','|','i','<pad>'],vocab)
        decoded=ctc.greedy_decode(emission,vocab,0)
        self.assertEqual(decoded['transcript'],'ll i')
        self.assertIsNone(decoded['authored_initial_prompt'])
        self.assertEqual(decoded['unknown_tokens'],[])
        self.assertEqual(len(decoded['argmax_token_ids']),len(emission))
        self.assertEqual(decoded['blank_token_id'],0)
        self.assertEqual(decoded['argmax_token_ids_sha256'],qa.text_hash(json.dumps(decoded['argmax_token_ids'],separators=(',',':'))))

    def test_diagnostic_allows_only_current_lexical_failure_never_signal_or_stale(self):
        line={'id':'story-'+'a'*24,'text':'Hallo Lia'}
        take={'id':line['id'],'text_sha256':qa.text_hash(line['text']),
              'transcript':'Hallo Lea','reasons':['asr_lexical_mismatch_requires_review']}
        report={'manifest_sha256':'source','clip_sha256':{line['id']:'audio'},
                'checked_ids':[line['id']],'takes':[take],
                'failures':[{'id':line['id'],'reason':'asr_lexical_mismatch_requires_review'}]}
        self.assertTrue(ctc.diagnostic_qa(line,'audio','source',report))
        self.assertFalse(ctc.clean_qa(line,'audio','source',report))
        for reason in ['possible_clipping','silent_audio','decode_failed','audio_changed_before_finalization']:
            changed=copy.deepcopy(report);changed['takes'][0]['reasons'].append(reason)
            self.assertFalse(ctc.diagnostic_qa(line,'audio','source',changed))
            changed=copy.deepcopy(report);changed['failures'].append({'id':line['id'],'reason':reason})
            self.assertFalse(ctc.diagnostic_qa(line,'audio','source',changed))
        self.assertFalse(ctc.diagnostic_qa(line,'wrong','source',report))
        self.assertFalse(ctc.diagnostic_qa(line,'audio','wrong',report))
        report['clip_sha256']={}
        self.assertFalse(ctc.diagnostic_qa(line,'audio','source',report))


if __name__=='__main__':unittest.main()
