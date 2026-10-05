import copy
import json
from pathlib import Path
import tempfile
import unittest
import prolog_voice_word_cues as acoustic
import story_voice_word_cues as cues
import story_voice_partial_cue_review as review
import story_voice_ctc_align as primary
import story_voice_secondary_ctc as secondary
import story_voice_qa as qa


class PartialReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.run=Path(self.tmp.name)
        for name in['clips','word-cues','ctc-align','ctc-secondary','model-primary','model-secondary']:(self.run/name).mkdir()
        self.ident='story-'+'a'*24;self.line={'id':self.ident,'text':'Lia'};self.manifest={'lines':[self.line]}
        self.mp=self.run/'lines.private.json';self.mp.write_text(json.dumps(self.manifest));self.mh=qa.digest(self.mp)
        self.audio=self.run/'clips'/(self.ident+'.mp3');self.audio.write_bytes(b'offline fixture');self.ah=qa.digest(self.audio)
        self.q={'manifest_sha256':self.mh,'clip_sha256':{self.ident:self.ah},'checked_ids':[self.ident],'failures':[],
                'takes':[{'id':self.ident,'text_sha256':qa.text_hash('Lia'),'transcript':'Lia','reasons':[]}]}
        self.qp=self.run/'qa.json';self.qp.write_text(json.dumps(self.q));self.vp=self.run/'veto.json';self.vp.write_text(json.dumps({'records':[]}))
        self.dtw={'id':self.ident,'text':'Lia','audio_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),'source_manifest_sha256':self.mh,
                  'decoded_seconds':1.,'word_cues':[{'start':.2,'end':.5}],'engine_version':cues.ENGINE,
                  'words':[{'word':'Lia','start':.2,'end':.5}],'raw_word_cues':[{'start':.1,'end':.7}],
                  'all_qualification_flags':[{'word_index':0,'reasons':['low_original_DTW']}],
                  'original_qualification_flags':[{'word_index':0,'reasons':['low_original_DTW']}]}
        self.dtw['cues_sha256']=acoustic.cue_sha(self.dtw['word_cues']);self.dp=self.run/'word-cues'/(self.ident+'.json');self.dp.write_text(json.dumps(self.dtw))
        self.receipts={};self.paths={}
        for label,factory,folder,suffix in [('primary',primary,'ctc-align','.ctc.private.json'),('secondary',secondary,'ctc-secondary','.secondary-ctc.private.json')]:
            directory=self.run/('model-'+label);vocab={'<pad>':0,'|':1,'l':2,'i':3,'a':4};config={'pad_token_id':0 if label=='primary'else 1,'vocab_size':5}
            for name,data in [('vocab.json',vocab),('config.json',config),('preprocessor_config.json',{'do_normalize':True,'sampling_rate':16000})]:
                (directory/name).write_text(json.dumps(data))
            (directory/'pytorch_model.bin').write_bytes(b'offline weight fixture')
            model=factory.model_identity(directory,qa.CTC_REVISION if label=='primary'else secondary.REVISION)
            binding={'engine':factory.ENGINE,'model':model,'audio_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),'source_manifest_sha256':self.mh,
                     'script_sha256':qa.digest(Path(factory.__file__))}
            actual={'id':self.ident,'text':'Lia','binding':binding,'alignment':{'decoded_seconds':1.,'qualification_flags':[],
                    'words':[{'word':'Lia','start':.1,'end':.4,'confidence':.99,'waveform_active_fraction':1}],
                    'character_alignment':[{'character':c,'word_index':0,'start':round(.1+i*.1,4),'end':round(.2+i*.1,4),'confidence':.99}for i,c in enumerate('lia')]}}
            if label=='secondary':
                binding['parent_ctc_script_sha256']=qa.digest(Path(primary.__file__))
                actual['runtime_semantics']=secondary.validate_runtime(vocab,vocab,0,1,5,True,16000);actual['greedy_decode']={'blank_token_id':0}
            path=self.run/folder/(self.ident+suffix);path.write_text(json.dumps(actual));self.paths[label]=path;self.receipts[label]=actual
        self.diag={'id':self.ident,'clip_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),'source_manifest_sha256':self.mh,
                   'DTW_cues_sha256':self.dtw['cues_sha256'],'repeat_risk':False,
                   'word_timing_proposals':[{'word_index':0,'word':'Lia','start':.1,'end':.4,'complete_DTW_with_single_word_replacement_ordered':True}]}
        self.pp=self.run/'timing.json';self.pp.write_text(json.dumps({'results':[self.diag]}))
    def tearDown(self):self.tmp.cleanup()
    def proposal(self,veto=None):
        row=review.proposal(self.line,self.ah,self.mh,self.q,veto or{},self.run,self.diag,self.dtw,self.receipts)
        row['CTC_receipt_files']={label:str(path)for label,path in self.paths.items()};row['authored_text']='Lia'
        dependencies=[self.dp,self.audio,self.mp,self.qp,self.vp,self.pp,*self.paths.values()]
        row['input_hashes']={str(p):qa.digest(p)for p in dependencies}
        for receipt in self.receipts.values():
            model=receipt['binding']['model'];row['input_hashes'].update({str(Path(model['local_directory'])/name):h for name,h in model['file_sha256'].items()})
        return row
    def test_supported_only_actual_original_flagged_word_times(self):
        row=self.proposal();self.assertEqual(row['status'],'supported');self.assertIsNone(row['approval'])
        self.diag['word_timing_proposals'][0]['start']=.12;self.assertEqual(self.proposal()['status'],'rejected')
    def test_repeat_and_active_lexical_veto_override_clean_QA(self):
        self.diag['repeat_risk']=True;self.assertEqual(self.proposal()['reason'],'pass9_repeat_contradiction')
        self.diag['repeat_risk']=False
        veto={self.ident:{'id':self.ident,'status':'root_retake_required','reviewed_by':'fixture root','reason':'Independent repeated opening',
                         'clip_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),
                         'evidence':[{'file':str(self.paths['primary'].relative_to(self.run)),'sha256':qa.digest(self.paths['primary'])}]}}
        self.assertEqual(self.proposal(veto)['reason'],'active_lexical_veto_or_unverified_veto')
    def test_stale_QA_audio_models_flags_cues_and_nonflagged_scope_reject(self):
        self.q['clip_sha256'][self.ident]='stale';self.assertEqual(self.proposal()['status'],'rejected');self.q['clip_sha256'][self.ident]=self.ah
        self.receipts['secondary']['binding']['audio_sha256']='wrong';self.assertEqual(self.proposal()['status'],'rejected');self.receipts['secondary']['binding']['audio_sha256']=self.ah
        (self.run/'model-primary'/'pytorch_model.bin').write_bytes(b'changed');self.assertEqual(self.proposal()['status'],'rejected')
    def test_apply_scope_and_inputs_checked_before_writes(self):
        row=self.proposal();ap=self.run/'qual.json';before=self.dp.read_bytes()
        with self.assertRaises(ValueError):review.apply_scoped(self.run,{self.ident:row},set(),ap,self.manifest,self.mh,self.qp,qa.digest(self.qp),self.vp,self.pp,1)
        self.audio.write_bytes(b'changed')
        with self.assertRaises(ValueError):review.apply_scoped(self.run,{self.ident:row},{self.ident},ap,self.manifest,self.mh,self.qp,qa.digest(self.qp),self.vp,self.pp,1)
        self.assertEqual(before,self.dp.read_bytes());self.assertFalse(ap.exists())
    def test_apply_archives_preserves_flags_and_validated_cache_no_other_mutations(self):
        row=self.proposal();ap=self.run/'qual.json';sentinel=self.run/'word-cues'/'unselected';sentinel.write_bytes(b'unchanged');audio=self.audio.read_bytes()
        result=review.apply_scoped(self.run,{self.ident:row},{self.ident},ap,self.manifest,self.mh,self.qp,qa.digest(self.qp),self.vp,self.pp,1)
        self.assertEqual(result['status'],'passed');self.assertEqual(sentinel.read_bytes(),b'unchanged');self.assertEqual(self.audio.read_bytes(),audio)
        current=json.loads(self.dp.read_text());approval=json.loads(ap.read_text())['approvals'][self.ident]
        self.assertEqual(current['raw_word_cues'],self.dtw['raw_word_cues']);self.assertEqual(current['words'],self.dtw['words']);self.assertEqual(current['all_qualification_flags'],self.dtw['all_qualification_flags'])
        expected={'audio_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),'source_manifest_sha256':self.mh,'engine_version':cues.ENGINE}
        self.assertTrue(cues.qualified_CTC_cache(current,expected,approval,self.run))
        self.vp.write_text(json.dumps({'records':[],'changed':'new root review'}));self.assertFalse(cues.qualified_CTC_cache(current,expected,approval,self.run))
        self.assertTrue(list((self.run/'word-cues'/'adoption-archive').glob('*/'+self.dp.name)))


    def test_remaining_flags_nonflagged_words_and_nonfinite_evidence_cannot_be_cleared(self):
        self.dtw['all_qualification_flags']=[]
        self.assertEqual(self.proposal()['reason'],'only_original_flagged_word_indices_allowed')
        self.dtw['all_qualification_flags']=[{'word_index':0},{'word_index':1}]
        self.assertEqual(self.proposal()['reason'],'remaining_flagged_words_not_covered_no_blanket_clip_approval')
        self.dtw['all_qualification_flags']=[{'word_index':0}]
        self.receipts['primary']['alignment']['character_alignment'][0]['confidence']=float('nan')
        self.assertEqual(self.proposal()['reason'],'strict_dual_word_boundary_support_failed')


if __name__=='__main__':unittest.main()
