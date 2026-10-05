import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import prolog_voice_word_cues as acoustic
import story_voice_word_cues as cues
import story_voice_secondary_ctc as secondary
import story_voice_secondary_ctc_review as review
import story_voice_qa as qa


class SecondaryReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.run=Path(self.tmp.name)
        for name in['clips','word-cues','ctc-secondary','model']:(self.run/name).mkdir()
        self.directory=self.run/'model';vocab={'<pad>':0,'|':1,'l':2,'i':3,'a':4}
        for name,data in [('vocab.json',vocab),('config.json',{'pad_token_id':1,'vocab_size':5}),('preprocessor_config.json',{'do_normalize':True,'sampling_rate':16000})]:
            (self.directory/name).write_text(json.dumps(data))
        (self.directory/'pytorch_model.bin').write_bytes(b'offline fixture weight')
        self.model=secondary.model_identity(self.directory,secondary.REVISION)
        self.ident='story-'+'a'*24;self.line={'id':self.ident,'text':'Lia'};self.manifest={'lines':[self.line]}
        self.mp=self.run/'lines.private.json';self.mp.write_text(json.dumps(self.manifest));self.mh=qa.digest(self.mp)
        self.audio=self.run/'clips'/(self.ident+'.mp3');self.audio.write_bytes(b'offline audio');self.ah=qa.digest(self.audio)
        self.qa={'manifest_sha256':self.mh,'clip_sha256':{self.ident:self.ah},'checked_ids':[self.ident],'failures':[],
                 'takes':[{'id':self.ident,'text_sha256':qa.text_hash('Lia'),'transcript':'Lia','reasons':[]}]}
        self.qp=self.run/'qa.json';self.qp.write_text(json.dumps(self.qa))
        mapping=secondary.project_authored('Lia',vocab)
        binding={'engine':secondary.ENGINE,'model':self.model,'audio_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),
                 'source_manifest_sha256':self.mh,'script_sha256':self.model['driver_script_sha256'],
                 'parent_ctc_script_sha256':self.model['parent_ctc_script_sha256']}
        self.actual={'id':self.ident,'text':'Lia','binding':binding,'runtime_semantics':secondary.validate_runtime(vocab,vocab,0,1,5,True,16000),
                     'greedy_decode':{'blank_token_id':0},'normalized_characters':''.join(mapping['characters']),
                     'word_owners':mapping['word_owners'],'case_projection':mapping['case_projection'],
                     'alignment':{'decoded_seconds':1.,'qualification_flags':[],
                                  'words':[{'word':'Lia','start':.1,'end':.4,'confidence':.99,'waveform_active_fraction':1}],
                                  'character_alignment':[{'character':c,'word_index':0,'start':round(.1+i*.1,4),'end':round(.2+i*.1,4),'confidence':.99}for i,c in enumerate('lia')]}}
        self.cp=self.run/'ctc-secondary'/(self.ident+'.secondary-ctc.private.json');self.cp.write_text(json.dumps(self.actual))
        self.dtw={'id':self.ident,'text':'Lia','audio_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),'source_manifest_sha256':self.mh,
                  'decoded_seconds':1.,'word_cues':[{'start':.2,'end':.5}],'engine_version':cues.ENGINE,
                  'words':[{'word':'Lia','start':.2,'end':.5}],'raw_word_cues':[{'start':.1,'end':.7}],
                  'all_qualification_flags':[{'reason':'original'}],'original_qualification_flags':[{'reason':'original'}]}
        self.dtw['cues_sha256']=acoustic.cue_sha(self.dtw['word_cues']);self.dp=self.run/'word-cues'/(self.ident+'.json');self.dp.write_text(json.dumps(self.dtw))
    def tearDown(self):self.tmp.cleanup()
    def proposal(self):
        row=review.review(self.line,self.ah,self.mh,self.qa,self.actual,self.dtw,self.model)
        row['secondary_receipt_sha256']=qa.digest(self.cp)
        row['input_hashes']={str(p):qa.digest(p)for p in[self.cp,self.dp,self.audio,self.mp,self.qp]}
        row['input_hashes'].update({str(self.directory/name):h for name,h in self.model['file_sha256'].items()})
        return row
    def test_known_model_runtime_and_separate_QA_supported(self):
        row=self.proposal();self.assertEqual(row['status'],'supported');self.assertIsNone(row['approval'])
        self.actual['runtime_semantics']['blank_token_id']=1;self.assertEqual(self.proposal()['status'],'rejected')
    def test_unknown_model_changed_script_source_audio_flags_and_cue_rejected(self):
        original=copy.deepcopy(self.actual)
        for field in['audio_sha256','text_sha256','source_manifest_sha256','script_sha256','parent_ctc_script_sha256']:
            self.actual=copy.deepcopy(original);self.actual['binding'][field]='stale';self.assertEqual(self.proposal()['status'],'rejected')
        self.actual=copy.deepcopy(original);self.actual['binding']['model']['model_id']='unknown';self.assertEqual(self.proposal()['status'],'rejected')
        self.actual=copy.deepcopy(original);self.actual['alignment']['qualification_flags']=[{'reason':'low'}];self.assertEqual(self.proposal()['status'],'rejected')
        self.actual=copy.deepcopy(original);self.dtw['cues_sha256']='wrong';self.assertEqual(self.proposal()['status'],'rejected')
    def test_low_endpoints_unknown_projection_or_nonclean_QA_rejected(self):
        self.actual['alignment']['character_alignment'][0]['confidence']=.49;self.assertEqual(self.proposal()['status'],'rejected')
        self.actual['alignment']['character_alignment'][0]['confidence']=.99;self.actual['word_owners']=[0,1,0];self.assertEqual(self.proposal()['status'],'rejected')
        self.actual['word_owners']=[0,0,0];self.qa['takes'][0]['reasons']=['possible_clipping'];self.assertEqual(self.proposal()['status'],'rejected')
    def test_apply_hash_and_scope_guards_before_any_receipt_change(self):
        row=self.proposal();ap=self.run/'qual.json';before=self.dp.read_bytes()
        with self.assertRaises(ValueError):review.apply_scoped(self.run,{self.ident:row},set(),ap,self.manifest,self.mh,self.qp,qa.digest(self.qp),1)
        (self.directory/'pytorch_model.bin').write_bytes(b'changed actual weight')
        with self.assertRaises(ValueError):review.apply_scoped(self.run,{self.ident:row},{self.ident},ap,self.manifest,self.mh,self.qp,qa.digest(self.qp),1)
        self.assertEqual(before,self.dp.read_bytes());self.assertFalse(ap.exists())
    def test_apply_preserves_flags_archives_audio_and_cache_recognizes_secondary_only(self):
        row=self.proposal();ap=self.run/'qual.json';audio=self.audio.read_bytes()
        untouched=self.run/'word-cues'/'unselected.private';untouched.write_bytes(b'unselected receipt')
        result=review.apply_scoped(self.run,{self.ident:row},{self.ident},ap,self.manifest,self.mh,self.qp,qa.digest(self.qp),1)
        self.assertEqual(result['status'],'passed');self.assertEqual(untouched.read_bytes(),b'unselected receipt');self.assertEqual(self.audio.read_bytes(),audio)
        current=json.loads(self.dp.read_text());approval=json.loads(ap.read_text())['approvals'][self.ident]
        expected={'audio_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),'source_manifest_sha256':self.mh,'engine_version':cues.ENGINE}
        self.assertEqual(current['raw_word_cues'],self.dtw['raw_word_cues']);self.assertEqual(current['words'],self.dtw['words'])
        self.assertEqual(current['all_qualification_flags'],self.dtw['all_qualification_flags'])
        self.assertTrue(cues.qualified_CTC_cache(current,expected,approval,self.run))
        current['engine_version']=cues.ENGINE+'/unknown-model-adoption';self.assertFalse(cues.qualified_CTC_cache(current,expected,approval,self.run))
        current['engine_version']=cues.ENGINE+'/'+review.VERSION
        original_sha=acoustic.sha
        with patch.object(acoustic,'sha',side_effect=lambda p:'changed-driver'if Path(p).name=='story_voice_secondary_ctc.py'else original_sha(p)):
            self.assertFalse(cues.qualified_CTC_cache(current,expected,approval,self.run))
        original_ctc=self.cp.read_text()
        self.cp.write_text(original_ctc+' ');self.assertFalse(cues.qualified_CTC_cache(current,expected,approval,self.run))
        self.cp.write_text(original_ctc)
        (self.directory/'pytorch_model.bin').write_bytes(b'changed weight')
        self.assertFalse(cues.qualified_CTC_cache(current,expected,approval,self.run))
        self.assertTrue(list((self.run/'word-cues'/'adoption-archive').glob('*/'+self.dp.name)))


    def test_long_word_remains_unapproved_with_separate_technical_review_needed(self):
        self.actual['alignment']['decoded_seconds']=2.5;self.dtw['decoded_seconds']=2.5
        self.actual['alignment']['words'][0]['end']=2.2
        self.actual['alignment']['character_alignment'][-1]['end']=2.2
        row=self.proposal()
        self.assertEqual(row['status'],'rejected');self.assertIsNone(row['approval'])


if __name__=='__main__':unittest.main()
