import copy
import json
from pathlib import Path
import tempfile
import unittest
import prolog_voice_word_cues as acoustic
import story_voice_ctc_review as review
import story_voice_ctc_align as ctc
import story_voice_qa as qa


class CTCReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.run=Path(self.temp.name)
        (self.run/'clips').mkdir();(self.run/'word-cues').mkdir()
        self.ident='story-'+'a'*24;self.line={'id':self.ident,'text':'Lia'}
        self.manifest={'lines':[self.line]};(self.run/'lines.private.json').write_text(json.dumps(self.manifest))
        self.mh=qa.digest(self.run/'lines.private.json');self.audio=self.run/'clips'/(self.ident+'.mp3');self.audio.write_bytes(b'fixture')
        self.ah=qa.digest(self.audio);self.script='script'
        chars=[{'character':char,'word_index':0,'start':.1+i*.1,'end':.2+i*.1,'confidence':.99}for i,char in enumerate('lia')]
        hashes={'vocab.json':'vocab'}
        self.ctc={'id':self.ident,'text':'Lia','normalized_characters':'lia','binding':{'engine':ctc.ENGINE,'audio_sha256':self.ah,
                  'text_sha256':qa.text_hash('Lia'),'source_manifest_sha256':self.mh,'script_sha256':self.script,
                  'model':{'model_id':ctc.MODEL_ID,'revision':qa.CTC_REVISION,'file_sha256':hashes,'fingerprint':qa.text_hash(json.dumps(hashes,sort_keys=True))}},
                  'alignment':{'decoded_seconds':1.0,'words':[{'word':'Lia','start':.1,'end':.4,'confidence':.99,'waveform_active_fraction':1}],
                               'character_alignment':chars,'qualification_flags':[]}}
        self.dtw={'id':self.ident,'text':'Lia','audio_sha256':self.ah,'text_sha256':qa.text_hash('Lia'),'source_manifest_sha256':self.mh,
                  'word_cues':[{'start':.2,'end':.5}],'decoded_seconds':1.0,'engine_version':'dtw','words':[{'word':'Lia','start':.2,'end':.5}],
                  'raw_word_cues':[{'start':.1,'end':.7}],'all_qualification_flags':[{'reason':'original_flag'}],
                  'original_qualification_flags':[{'reason':'original_flag'}]}
        self.dtw['cues_sha256']=acoustic.cue_sha(self.dtw['word_cues'])
        self.qa={'manifest_sha256':self.mh,'clip_sha256':{self.ident:self.ah},'checked_ids':[self.ident],'failures':[],
                 'takes':[{'id':self.ident,'text_sha256':qa.text_hash('Lia'),'transcript':'Lia','reasons':[]}]}
        self.qp=self.run/'qa.json';self.qp.write_text(json.dumps(self.qa));self.path=self.run/'word-cues'/(self.ident+'.json');self.path.write_text(json.dumps(self.dtw))
    def tearDown(self):self.temp.cleanup()
    def proposal(self):
        row=review.review(self.line,self.ah,self.mh,self.qa,self.ctc,self.dtw,self.script)
        row['input_hashes']={str(p):qa.digest(p)for p in[self.path,self.audio,self.qp,self.run/'lines.private.json']}
        row['CTC_receipt_sha256']='ctc_receipt';return row
    def test_supported_timing_is_only_proposal(self):
        row=self.proposal();self.assertEqual(row['status'],'supported');self.assertIsNone(row['approval']);self.assertEqual(row['proposed_cues'][0]['start'],.1)
    def test_stale_QA_audio_script_and_CTC_flags_rejected(self):
        self.ctc['binding']['audio_sha256']='stale';self.assertEqual(self.proposal()['status'],'rejected')
        self.ctc['binding']['audio_sha256']=self.ah;self.ctc['binding']['script_sha256']='wrong';self.assertEqual(self.proposal()['status'],'rejected')
        self.ctc['binding']['script_sha256']=self.script;self.ctc['alignment']['qualification_flags']=[{'word_index':0,'reason':'collapsed_independent_CTC_word'}]
        self.assertEqual(self.proposal()['status'],'rejected')
        self.ctc['alignment']['qualification_flags']=[];self.qa['takes'][0]['reasons']=['possible_clipping'];self.assertEqual(self.proposal()['status'],'rejected')
    def test_cardinality_boundary_low_confidence_and_long_pause_rejected(self):
        self.ctc['alignment']['words'][0]['word']='Lea';self.assertEqual(self.proposal()['status'],'rejected')
        self.ctc['alignment']['words'][0]['word']='Lia';self.ctc['alignment']['character_alignment'][0]['confidence']=.4;self.assertEqual(self.proposal()['status'],'rejected')
    def test_apply_scope_and_hash_guard_before_any_write(self):
        proposals={self.ident:self.proposal()};approval=self.run/'qual.json'
        with self.assertRaises(ValueError):review.apply_scoped(self.run,proposals,set(),approval,self.manifest,self.mh,self.qp,qa.digest(self.qp),1)
        before=self.path.read_bytes();self.audio.write_bytes(b'changed')
        with self.assertRaises(ValueError):review.apply_scoped(self.run,proposals,{self.ident},approval,self.manifest,self.mh,self.qp,qa.digest(self.qp),1)
        self.assertEqual(self.path.read_bytes(),before);self.assertFalse(approval.exists())
    def test_apply_preserves_original_DTW_details_flags_archives_and_audio(self):
        proposal=self.proposal();approval=self.run/'qual.json';audio=self.audio.read_bytes()
        result=review.apply_scoped(self.run,{self.ident:proposal},{self.ident},approval,self.manifest,self.mh,self.qp,qa.digest(self.qp),1)
        new=json.loads(self.path.read_text());self.assertEqual(new['raw_word_cues'],self.dtw['raw_word_cues'])
        self.assertEqual(new['words'],self.dtw['words']);self.assertEqual(new['all_qualification_flags'],self.dtw['all_qualification_flags'])
        self.assertEqual(new['original_DTW_word_cues'],self.dtw['word_cues']);self.assertEqual(new['word_cues'],proposal['proposed_cues'])
        self.assertEqual(self.audio.read_bytes(),audio);self.assertEqual(result['status'],'passed')
        self.assertTrue(list((self.run/'word-cues'/'adoption-archive').glob('*/'+self.path.name)))
    def test_report_requires_complete_current_exact_coverage(self):
        report=review.complete_report(self.run,self.manifest,self.mh,{},1557);self.assertEqual(report['status'],'needs_review')
        self.audio.unlink();report=review.complete_report(self.run,self.manifest,self.mh,{},1);self.assertEqual(report['status'],'needs_review');self.assertEqual(report['current_receipt_count'],0)


    def test_only_explicit_internal_name_variant_can_exempt_low_character(self):
        self.line['text']='Lya';self.ctc['text']='Lya';self.ctc['normalized_characters']='lya'
        self.ctc['alignment']['words'][0]['word']='Lya';self.ctc['alignment']['character_alignment'][1].update(character='y',confidence=.001)
        self.ctc['alignment']['qualification_flags']=[{'word_index':0,'reason':'low_independent_CTC_character_confidence'}]
        text_hash=qa.text_hash('Lya');self.ctc['binding']['text_sha256']=text_hash;self.dtw['text_sha256']=text_hash
        self.qa['takes'][0].update(text_sha256=text_hash,transcript='Lya')
        row=review.review(self.line,self.ah,self.mh,self.qa,self.ctc,self.dtw,self.script,{0:[1]})
        self.assertEqual(row['status'],'supported_variant_internal_only');self.assertIsNone(row['approval'])
        self.ctc['alignment']['character_alignment'][0]['confidence']=.001
        row=review.review(self.line,self.ah,self.mh,self.qa,self.ctc,self.dtw,self.script,{0:[0,1]})
        self.assertEqual(row['status'],'rejected')
        independent={'clip_sha256':self.ah,'source_text_sha256':text_hash,'transcript':'Lia'}
        approval={'channel':'independent','status':'accepted_word_variants','reviewed_by':'fixture root','reason':'Explicit fixture spelling',
                  'clip_sha256':self.ah,'text_sha256':text_hash,'transcript_sha256':qa.text_hash('Lia'),
                  'independent_record_sha256':qa.text_hash(json.dumps(independent,sort_keys=True,ensure_ascii=False)),
                  'accepted_word_variants':[{'expected':'lya','observed':'lia'}]}
        self.assertEqual(review.internal_variant_positions(self.line,self.ah,approval,independent),{0:[1]})
        approval['clip_sha256']='stale';self.assertEqual(review.internal_variant_positions(self.line,self.ah,approval,independent),{})


if __name__=='__main__':unittest.main()
