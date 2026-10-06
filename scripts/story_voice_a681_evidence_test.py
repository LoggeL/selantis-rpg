#!/usr/bin/env python3
"""Offline one-case body/root guards. No API, audio inference or production edits."""
import copy
import unittest
from unittest.mock import patch
import story_voice_a681_evidence as a

class A681Guards(unittest.TestCase):
    def setUp(self):
        self.line={'id':a.ID,'text':a.TEXT,'speaker':'algard'}
        self.full=' Mhh, bei allen zehn. So was habe ich seit Jahren nicht gegessen.'
        self.ctc='bei allen zehn so was habe ich seit jahren nicht gegessen'
    def test_actual_complete_large_and_ctc_bodies_with_only_fixed_pairs(self):
        full=a.words(self.line,self.full,True);ctc=a.words(self.line,self.ctc,False)
        self.assertEqual(full['gesture_pair']['scope'],a.ID)
        self.assertEqual(full['hab_habe_pair']['source_word_index'],6)
        self.assertEqual(full['observed_tokens'][1:],ctc['observed_tokens'])
    def test_wrong_source_id_speaker_and_changed_source_refused(self):
        for change in [{'id':'story-other'},{'text':a.TEXT+'!'},{'speaker':'lia'},{'text':a.TEXT.replace('Zehn','Zehen')}]:
            with self.assertRaises(a.core.SafeError):a.words(dict(self.line,**change),self.full,True)
    def test_missing_extra_repeated_reordered_and_zehen_refused(self):
        for text in [self.full.replace('seit ',''),self.full+' Extra.',self.full.replace('ich seit','ich ich seit'),
                     self.full.replace('So was','was So'),self.full.replace('zehn','Zehen'),self.full.replace('So was','Sowas')]:
            with self.assertRaises(a.core.SafeError):a.words(self.line,text,True)
    def test_other_mmh_spelling_or_unbound_event_prefix_refused(self):
        for prefix in ['Mmh','Mhm','Hm','Mhhh','Mmmpf','']:
            with self.assertRaises(a.core.SafeError):a.words(self.line,self.full.replace('Mhh',prefix),True)
    def test_gesture_never_made_a_required_ctc_lexical_word(self):
        self.assertIsNone(a.words(self.line,self.ctc,False)['gesture_pair'])
        for text in ['Mhh '+self.ctc,self.ctc.replace('zehn','zehen'),self.ctc.replace('habe','hab'),self.ctc+' heute']:
            with self.assertRaises(a.core.SafeError):a.words(self.line,text,False)
    def raw_words(self):
        return [{'word':' '+w,'start':i*.2,'end':i*.2+.1,'probability':.44 if i==0 else .99}
            for i,w in enumerate(self.full.strip().split())]
    def test_actual_full_raw_words_must_match_segments_and_whole_body(self):
        raw=self.raw_words();actual={'text':self.full,'segments':[{'words':copy.deepcopy(raw)}],'language':'de'}
        self.assertEqual(a.complete_free_words(self.line,actual,raw)['observed_tokens'][0],'mhh')
        for mutate in [lambda x:x['segments'][0]['words'].pop(),lambda x:x.update(language='en'),
                       lambda x:x.update(text=self.full.replace('zehn','Zehen')),lambda x:x.update(text=self.full+' Extra.')]:
            d=copy.deepcopy(actual);mutate(d)
            with self.assertRaises(a.core.SafeError):a.complete_free_words(self.line,d,raw)
    def test_raw_word_probability_schema_and_nonfinite_values_rejected(self):
        for changes in [{'probability':float('nan')},{'probability':2},{'start':True},{'word':None},{'start':.7,'end':.1},{'extra':'invented'}]:
            raw=self.raw_words();raw[0].update(changes);actual={'text':self.full,'segments':[{'words':raw}],'language':'de'}
            with self.assertRaises(a.core.SafeError):a.complete_free_words(self.line,actual,raw)
    def test_native_ctc_actual_geometry_and_unknown_geometry_refused(self):
        config={'conv_kernel':[10,3,3,3,3,2,2],'conv_stride':[5,2,2,2,2,2,2]}
        self.assertEqual(a.native_ctc_frames(119680,config),373)
        for d in [{},{'conv_kernel':[10],'conv_stride':[]},{'conv_kernel':[0],'conv_stride':[5]},dict(config,conv_stride=[5,2,2,2,2,2,True])]:
            with self.assertRaises(a.core.SafeError):a.native_ctc_frames(119680,d)
    def template(self):
        return {'id':a.ID,'method':a.VERSION,'status':'root_review_required','reviewed_by':'','reason':'',
            'clip_sha256':'actual-audio','source_text_sha256':'actual-source','source_row':self.line,
            'actual_full_LargeV3_words':{'actual':'complete'},'actual_free_CTC_body':{'actual':'body'},
            'actual_source_gesture_event':copy.deepcopy(a.EVENT),'QC_diagnosis_only':{'transcript':'actual Zehen','QC_words_used_as_body_proof':False},
            'helper_script_sha256':'helper','protected_script_sha256':{'CTC':'driver'},'provenance_files_sha256':{'actual':'sha'}}
    def approve(self):
        return dict(copy.deepcopy(self.template()),status=a.APPROVED,reviewed_by='root offline test',reason='Explicit complete synthetic evidence review.')
    def test_no_implicit_approval_or_partial_root_document(self):
        self.assertIsNone(a.review(None,self.line,{},None))
        for approval in [self.template(),{'id':a.ID,'status':a.APPROVED},dict(self.approve(),reviewed_by='agent'),dict(self.approve(),reason='ok')]:
            with patch.object(a,'proof_template',return_value=self.template()):
                with self.assertRaises(a.core.SafeError):a.review(None,self.line,{},approval)
    def test_full_current_root_review_retains_diagnosis_and_no_timing_claim(self):
        approval=self.approve()
        with patch.object(a,'proof_template',return_value=self.template()):proof=a.review(None,self.line,{},approval)
        self.assertEqual(proof['method'],a.VERSION);self.assertEqual(proof['proof']['QC_diagnosis_only']['transcript'],'actual Zehen')
        self.assertFalse(proof['proof']['QC_diagnosis_only']['QC_words_used_as_body_proof'])
        self.assertIsNone(proof['timing_approval']);self.assertIsNone(proof['acting_approval']);self.assertIsNone(proof['listening_verdict'])
        self.assertFalse(proof['provider_timestamps_used']);self.assertEqual(approval,self.approve())
    def test_changed_source_audio_model_body_frame_event_and_driver_proof_refused(self):
        for key in ['id','clip_sha256','source_text_sha256','source_row','actual_full_LargeV3_words','actual_free_CTC_body',
                    'actual_source_gesture_event','QC_diagnosis_only','helper_script_sha256','protected_script_sha256','provenance_files_sha256']:
            approval=self.approve();approval[key]='stale'
            with patch.object(a,'proof_template',return_value=self.template()):
                with self.assertRaises(a.core.SafeError):a.review(None,self.line,{},approval)

if __name__=='__main__':unittest.main()
