"""Small offline Source96 guards. Synthetic matrices, no inference or real approval."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import story_voice_child61_case96 as m


class Source96(unittest.TestCase):
    def line(self): return {'id':m.ID,'text':m.TEXT,'speaker':'azar'}
    def record(self, events=None, transcript=None):
        value={'transcript':transcript or m.CASES[m.ID]['qc_transcript'],
            'events':copy.deepcopy([m.HA_EVENT]) if events is None else events}
        return {'response':{'modelVersion':m.qc.MODEL,'candidates':[{'finishReason':'STOP',
            'content':{'parts':[{'text':json.dumps(value)}]}}]}}
    def arrays(self, tokens=None):
        tokens=tokens or m.CASES[m.ID]['raw_ipa'].split();labels=['<pad>']+sorted(set(tokens)|{'f','v','ɑː','a','ɜ'})
        labels+=['unused'+str(k)for k in range(392-len(labels))];vocab={t:i for i,t in enumerate(labels)}
        classes=[v for t in tokens for v in [0,vocab[t]]];logits=np.full((1,len(classes),392),-12,dtype=np.float32)
        for j,k in enumerate(classes):logits[0,j,k]=8
        ids=logits[0].argmax(axis=-1);shift=logits[0].astype(np.float64)-logits[0].max(axis=-1,keepdims=True)
        probs=np.exp(shift);probs/=probs.sum(axis=-1,keepdims=True)
        events=[{'frame_index':j,'class_id':int(k),'token':labels[k],
            'actual_argmax_softmax_probability':float(probs[j,k])}for j,k in enumerate(ids)if k]
        raw=' '.join(tokens);return [logits,probs,ids,vocab,{'raw_ipa':raw,'native_decode':raw,'emitted_raw_tokens':events}]
    def test_only_actual_Source96_and_full_three_decoder_literals(self):
        self.assertEqual(set(m.CASES),{m.ID})
        for channel in ['primary','qc','pro']:
            text=m.CASES[m.ID][channel+'_transcript'];proof=m.words(self.line(),text,channel)
            self.assertEqual(proof['literal_four_body_words'],['da','hat','sie','dich'])
            for bad in [text+' extra',' '.join(text.split()[:-1]),text.replace('dich','mich'),m.TEXT]:
                with self.assertRaises(m.core.SafeError):m.words(self.line(),bad,channel)
        for changed in [{'id':m.EXCLUDED_ID},{'speaker':'foltan'},{'text':m.TEXT+' Heute.'}]:
            with self.assertRaises(m.core.SafeError):m.case(dict(self.line(),**changed))
    def test_exact_original_one_Ha_event_and_no_word_mapper_bypass(self):
        proof=m.qc_observation(self.line(),self.record());self.assertEqual(proof['actual_events'],[m.HA_EVENT])
        self.assertIsNone(proof['generic_vocal_review_full_words_result']);self.assertFalse(proof['generic_word_adjudication_used'])
        self.assertEqual(proof['source_event_binding']['observed_token_indices'],[])
        bad=[[],[m.HA_EVENT,m.HA_EVENT]]+[[dict(m.HA_EVENT,**v)]for v in
            [{'category':'other'},{'description':'short laugh'},{'vocal_sound':'hah'},{'confidence':.9}]]
        for events in bad:
            with self.assertRaises(m.core.SafeError):m.qc_observation(self.line(),self.record(events))
    def test_complete_native_name_and_every_negative_observation_remain_literal(self):
        proof=m.native_frames(self.line(),*self.arrays())
        self.assertEqual([e['token']for e in proof['selected_name_events']],['f','ɔ','l','t','ɑː','n'])
        self.assertIsNone(proof['canonical_name_vowel']);self.assertFalse(proof['general_name_F_V_or_vowel_alias'])
        negative=proof['original_counterevidence'];self.assertEqual([e['token']for e in negative['opening']],['a','x'])
        self.assertEqual([e['token']for e in negative['extra_h_a']],['h','a'])
        self.assertEqual([e['token']for e in negative['n_instead_of_d_body_diagnostic']],['n','ɪ','ç'])
        self.assertEqual(negative['Pro_transcript'],'Da hat sie dich voll dran.')
    def test_native_arrays_logits_argmax_scores_and_phone_mutations_refused(self):
        for index in [0,1,2]:
            arrays=self.arrays();arrays[index].flat[0]+=1
            with self.assertRaises(m.core.SafeError):m.native_frames(self.line(),*arrays)
        original=m.CASES[m.ID]['raw_ipa'].split()
        for index,token in [(0,'h'),(11,'d'),(14,'v'),(18,'a'),(19,'ɜ')]:
            tokens=original[:];tokens[index]=token
            with self.assertRaises(m.core.SafeError):m.native_frames(self.line(),*self.arrays(tokens))
    def test_all62_original_output_files_bound_and_missing_Root_guard_refused(self):
        with tempfile.TemporaryDirectory()as directory:
            base=Path(directory);names=m.native_result_names();self.assertEqual(len(names),62)
            for name in names:
                p=base/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(('synthetic '+name).encode())
            expected=m.object_hash({n:m.digest(base/n)for n in names})
            def path(p):m.require(p.is_file(),'Missing original evidence.');return p
            with patch.object(m,'FROZEN_NATIVE_OUTPUT_SHA256',expected):
                m.frozen_native_result_bindings(base,path)
                p=base/'results'/(m.ID+'.phone-logits.private.npy');p.write_bytes(b'modified full array')
                with self.assertRaises(m.core.SafeError):m.frozen_native_result_bindings(base,path)
        for gate in [None,{}, {'status':'approved_execution_scope'}]:
            with self.assertRaises(m.core.SafeError):m.native_execution_scope(None,None,None,None,None,gate,None,None)
    def test_individual_Root_binding_and_lexical_only_contract(self):
        template={'id':m.ID,'status':'root_review_required','reviewed_by':'','reason':'','method':m.VERSION,
            'source_row':self.line(),'clip_sha256':'synthetic current','source_text_sha256':'synthetic source',
            'lexical_only_clearance':True,'canonical_name_vowel':None}
        # Condition testing only; never write a real approved record.
        approval=dict(copy.deepcopy(template),status=m.APPROVED,reviewed_by='root synthetic fixture',
            reason='Individually reviewed complete original and current synthetic evidence.')
        with patch.object(m,'proof_template',return_value=template):
            proof=m.review(None,self.line(),{},approval);self.assertTrue(proof['lexical_only_clearance'])
            for value in [{'status':'offline_preflight_unapproved'},{'reviewed_by':'worker'},
                {'canonical_name_vowel':'a'},{'clip_sha256':'stale'},{'lexical_only_clearance':False},{'extra':True}]:
                with self.assertRaises(m.core.SafeError):m.review(None,self.line(),{},dict(approval,**value))
        self.assertIsNone(m.review(None,self.line(),{},None))


class ParentTransport(unittest.TestCase):
    """Reuse the small bank fixture, testing only the new import boundary here.

    Source96's fixed production identity is tested above. The original retake
    disjoint validator still runs, and no Parent/model/API work is performed.
    """
    def setUp(self):
        from story_voice_child57_cases_test import CurrentParentImportAndQA
        self.fixture=CurrentParentImportAndQA();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups)
        f=self.fixture
        for p in [patch.object(m,'ID',f.ids[0]),patch.object(m,'CHILD_IDS',f.ids),patch.object(m,'FULL_COUNT',3)]:
            p.start();self.addCleanup(p.stop)
    def verify(self):
        f=self.fixture;return m.validate_current_parent(f.run,f.child,f.manifest,f.snapshot,f.bindings,
            f.path,lambda p:m.core.read_json(f.path(p)))
    def test_completed_import_current_bank_and_disjoint_origin_bound(self):
        f=self.fixture;before=copy.deepcopy(f.snapshot);self.verify()
        f.completed_disjoint();_,_,_,context=self.verify()
        self.assertEqual(context['current_delta_after_own_import_ids'],['synthetic-unselected'])
        self.assertEqual(f.snapshot,before)
    def test_wrong_import_missing_case_stale_waveform_and_unknown_delta_refused(self):
        f=self.fixture
        for change in [{'state':'IMPORT_INTENT_RECORDED'},{'selected_ids':f.ids[1:]},{'parent_snapshot_sha256':'stale'}]:
            f.save(f.jp,dict(f.journal,**change))
            with self.assertRaises(m.core.SafeError):self.verify()
            f.save(f.jp,f.journal)
        for p in [f.run/'raw'/(f.ids[0]+'.wav'),f.run/'clips/synthetic-unselected.mp3']:
            old=p.read_bytes();p.write_bytes(old+b'changed')
            with self.assertRaises(m.core.SafeError):self.verify()
            p.write_bytes(old)


if __name__=='__main__':unittest.main()
