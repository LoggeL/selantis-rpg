"""Offline waveform and immutable event-cache fixtures; no models or paid calls."""
import copy
import json
import math
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import story_voice_vocal_cues as vocal

class VocalCues(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.run=Path(self.tmp.name);(self.run/'clips').mkdir();(self.run/'word-cues').mkdir()
        self.ident='story-'+'a'*24;self.line={'id':self.ident,'text':'AAH!'}
        self.samples=[0.0]*3200+[.2*math.sin(i*.1) for i in range(8000)]+[0.0]*3200
        self.clip=self.run/'clips'/(self.ident+'.mp3');self.clip.write_bytes(b'fixture')
        vocal.qa.save(self.run/'lines.private.json',{'lines':[self.line]})
        self.paths={k:self.run/(k+'.json') for k in ['qa_report','vocal_report','vocal_adjudications']}
        for path in self.paths.values():vocal.qa.save(path,{})
        self.binding={'audio_sha256':vocal.qa.digest(self.clip),'text_sha256':vocal.qa.text_hash('AAH!'),
            'source_manifest_sha256':vocal.qa.digest(self.run/'lines.private.json'),
            'proof_files':{k:{'file':p.name,'sha256':vocal.qa.digest(p)} for k,p in self.paths.items()},'driver_script_sha256':'fixture'}
        self.old={'id':self.ident,'text':'AAH!','audio_sha256':self.binding['audio_sha256'],'text_sha256':self.binding['text_sha256'],
            'source_manifest_sha256':self.binding['source_manifest_sha256'],'engine_version':vocal.cues.ENGINE,
            'decoded_seconds':.9,'word_cues':[{'start':0,'end':.01}],
            'all_qualification_flags':[{'reason':'collapsed'}],'qualification_flags':[{'reason':'original'}],
            'original_qualification_flags':[{'reason':'low_probability'}],'words':[{'word':'AAH!','spoken':True,'minimum_token_probability':.001}],
            'raw_word_cues':[{'start':0,'end':.01}]}
        vocal.qa.save(self.run/'word-cues'/(self.ident+'.json'),self.old)
    def actual_proof_fixture(self,category='scream',confidence=.9,actual='',event_count=1):
        qc=vocal.qa.vocal_qc;sha=vocal.qa.digest(self.clip)
        event={'category':category,'description':'One sudden voiced cry.','vocal_sound':'ah','confidence':confidence}
        response={'modelVersion':qc.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':actual,'events':[event]*event_count})}]}}]}
        record={'id':self.ident,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,
                'source_text_sha256':vocal.qa.text_hash('AAH!'),'input_mime_type':'audio/mpeg',
                'model':qc.MODEL,'prompt':qc.PROMPT,'transcript':actual,'response':response,**qc.cache_metadata()}
        approval={'channel':'vocal-qc','status':'approved_vocal_events','reviewed_by':'root fixture reviewer','reason':'One explicitly reviewed source cry.',
                'clip_sha256':sha,'text_sha256':vocal.qa.text_hash('AAH!'),'vocal_record_sha256':vocal.qa.canonical_record_hash(record),
                'raw_response_sha256':vocal.qa.canonical_record_hash(response),'transcript_sha256':vocal.qa.text_hash(actual),
                'expected_tokens':['aah'],'observed_tokens':vocal.qa.words(actual),**qc.cache_metadata(),
                'source_events':[{'source_token_index':0,'source_token':'aah','category':category,
                 'event_indices':list(range(event_count)),'descriptions':[event['description']]*event_count,
                 'observed_token_indices':[],'reason':'Root fixture mapped this sole event.'}]}
        report={'manifest_sha256':vocal.qa.digest(self.run/'lines.private.json'),'clip_sha256':{self.ident:sha},'checked_ids':[self.ident],
                'takes':[{'id':self.ident,'text_sha256':vocal.qa.text_hash('AAH!'),'transcript':'','adjudication':{'resolution':'root_vocal'},'reasons':[]}],'failures':[]}
        vocal.qa.save(self.paths['qa_report'],report);vocal.qa.save(self.paths['vocal_report'],{'records':[record]})
        vocal.qa.save(self.paths['vocal_adjudications'],{self.ident:approval})
        return record,approval
    def test_actual_strict_approved_single_scream_proof(self):
        self.actual_proof_fixture()
        result=vocal.proof(self.run,self.line,self.paths)
        self.assertEqual(result['event']['category'],'scream')
        self.assertEqual(result['accepted_vocal_proof']['remaining_source_tokens'],[])
    def test_actual_low_confidence_words_multiple_events_wrong_category_rejected(self):
        for kwargs in [{'confidence':.79},{'category':'groan'},{'actual':'Hallo'},{'event_count':2}]:
            self.actual_proof_fixture(**kwargs)
            with self.assertRaises(ValueError):vocal.proof(self.run,self.line,self.paths)
    def test_actual_current_approval_audio_qa_and_proof_hash_guards(self):
        record,approval=self.actual_proof_fixture();approval['raw_response_sha256']='wrong'
        vocal.qa.save(self.paths['vocal_adjudications'],{self.ident:approval})
        with self.assertRaises(ValueError):vocal.proof(self.run,self.line,self.paths)
        self.actual_proof_fixture();self.clip.write_bytes(b'changed')
        with self.assertRaises(ValueError):vocal.proof(self.run,self.line,self.paths)
    def test_waveform_whole_event_bounds(self):
        result=vocal.measure(self.samples)
        self.assertAlmostEqual(result['start'],.19);self.assertAlmostEqual(result['end'],.71)
        self.assertEqual(result['timing_kind'],'whole_event_acoustic_envelope_not_phonemes')
    def test_reject_silence_nonfinite_clipping_separated_bursts(self):
        for samples in [[0]*16000,[float('nan')]*1000,[1.]*16000,
            [0]*1600+[.2]*1600+[0]*3200+[.2]*1600+[0]*1600]:
            with self.assertRaises(ValueError):vocal.measure(samples)
    def test_single_brief_pulse_not_sustained(self):
        with self.assertRaises(ValueError):vocal.measure([0]*3000+[.2]*100+[0]*3000)
    def test_source_shape_strict(self):
        for text in ['Ah!','Au!','Autsch!','AAH! Hilfe','Hihi','AAAA','AAH! …']:
            with self.assertRaises(ValueError):vocal.proof(self.run,{'id':self.ident,'text':text},self.paths)
    def test_mixed_case_scream_source_passes_shape_only(self):
        for text in ['Aaaah!','AAAAAH','aaHH…']:
            line={'id':self.ident,'text':text}
            with patch.object(vocal.ctc,'clean_qa',side_effect=RuntimeError('shape accepted')):
                with self.assertRaisesRegex(RuntimeError,'shape accepted'):
                    vocal.proof(self.run,line,self.paths)
    def test_clean_qa_and_vocal_proof_required(self):
        with self.assertRaises(ValueError):vocal.proof(self.run,self.line,self.paths)
        with patch.object(vocal.ctc,'clean_qa',return_value=True),patch.object(vocal.qa,'vocal_review',return_value=None):
            with self.assertRaises(ValueError):vocal.proof(self.run,self.line,self.paths)
    def test_resume_interrupted_live_writes_idempotent_and_preserves_other_approvals(self):
        real_save=vocal.qa.save
        for stop_name in [self.ident+'.json','qualifications.private.json','after-qualifications']:
            with self.subTest(interruption=stop_name):
                # Fresh original cue state for each simulated interruption.
                intents=self.run/'word-cues/vocal-event-intents'
                if intents.exists():
                    for f in intents.glob('*.json'):f.unlink()
                real_save(self.run/'word-cues'/(self.ident+'.json'),self.old)
                qpath=self.run/'word-cues/qualifications.private.json'
                if qpath.exists():qpath.unlink()
                fired=[False]
                def interrupted(path,data):
                    if path.parent==self.run/'word-cues' and path.name==stop_name and not fired[0]:
                        fired[0]=True;raise OSError('offline interrupted live write')
                    result=real_save(path,data)
                    if path.parent==self.run/'word-cues' and path.name=='qualifications.private.json' and stop_name=='after-qualifications' and not fired[0]:
                        fired[0]=True;raise OSError('offline crash after approval commit')
                    return result
                with patch.object(vocal,'proof',return_value=self.binding):
                    proposal=vocal.propose(self.run,self.line,self.paths,decode_fn=lambda p:self.samples)
                    with patch.object(vocal.qa,'save',side_effect=interrupted):
                        with self.assertRaises(OSError):vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
                    journal=self.run/'word-cues/vocal-event-intents'/(self.ident+'.json')
                    self.assertEqual(json.loads(journal.read_text())['state'],'RECORDED_BEFORE_LIVE_WRITES')
                    document=json.loads(qpath.read_text()) if qpath.exists() else {'approvals':{}}
                    document['approvals']['other-story-id']={'review_note':'Preserve unrelated root work'};real_save(qpath,document)
                    receipt=vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
                    self.assertEqual(json.loads(qpath.read_text())['approvals']['other-story-id']['review_note'],'Preserve unrelated root work')
                    before=(self.run/'word-cues'/(self.ident+'.json')).read_bytes();approval_before=qpath.read_bytes()
                    repeated=vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
                    self.assertEqual(receipt,repeated);self.assertEqual(before,(self.run/'word-cues'/(self.ident+'.json')).read_bytes())
                    self.assertEqual(approval_before,qpath.read_bytes())
    def test_recovery_refuses_unknown_receipt_approval_or_archive(self):
        real_save=vocal.qa.save
        with patch.object(vocal,'proof',return_value=self.binding):
            proposal=vocal.propose(self.run,self.line,self.paths,decode_fn=lambda p:self.samples)
            def interrupted(path,data):
                if path.parent==self.run/'word-cues' and path.name=='qualifications.private.json':raise OSError('offline crash')
                return real_save(path,data)
            with patch.object(vocal.qa,'save',side_effect=interrupted):
                with self.assertRaises(OSError):vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            receipt_path=self.run/'word-cues'/(self.ident+'.json');intended=receipt_path.read_bytes()
            receipt_path.write_bytes(b'unknown receipt bytes')
            with self.assertRaises(ValueError):vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            receipt_path.write_bytes(intended)
            real_save(self.run/'word-cues/qualifications.private.json',{'approvals':{self.ident:{'decision':'unknown'}}})
            with self.assertRaises(ValueError):vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            (self.run/'word-cues/qualifications.private.json').unlink()
            journal=json.loads((self.run/'word-cues/vocal-event-intents'/(self.ident+'.json')).read_text())
            archive=self.run/journal['plan']['receipt']['Vocal_event_adoption']['archive_file'];archive.write_bytes(b'changed')
            with self.assertRaises(ValueError):vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
    def test_unknown_or_changed_completed_state_never_overwrites(self):
        with patch.object(vocal,'proof',return_value=self.binding):
            proposal=vocal.propose(self.run,self.line,self.paths,decode_fn=lambda p:self.samples)
            vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            journal_path=self.run/'word-cues/vocal-event-intents'/(self.ident+'.json')
            journal=json.loads(journal_path.read_text());bad=copy.deepcopy(journal);bad['state']='UNKNOWN'
            vocal.qa.save(journal_path,bad)
            with self.assertRaises(ValueError):vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            vocal.qa.save(journal_path,journal)
            vocal.qa.save(self.run/'word-cues/qualifications.private.json',{'approvals':{}})
            with self.assertRaises(ValueError):vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
    def test_validated_legacy_identical_adoption_without_journal_is_idempotent(self):
        with patch.object(vocal,'proof',return_value=self.binding):
            proposal=vocal.propose(self.run,self.line,self.paths,decode_fn=lambda p:self.samples)
            original=vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            (self.run/'word-cues/vocal-event-intents'/(self.ident+'.json')).unlink()
            with patch.object(vocal.qa,'save',side_effect=AssertionError('Identical legacy adoption must not write')):
                result=vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            self.assertEqual(result,original)
    def test_recovery_rejects_changed_reviewed_proposal(self):
        with patch.object(vocal,'proof',return_value=self.binding):
            proposal=vocal.propose(self.run,self.line,self.paths,decode_fn=lambda p:self.samples)
            vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            changed=copy.deepcopy(proposal);changed['measurement']['end']+=.01
            with self.assertRaises(ValueError):vocal.apply(self.run,changed,self.paths,decode_fn=lambda p:self.samples)
    def test_archive_raw_bytes_flags_and_cache_revalidation(self):
        original=(self.run/'word-cues'/(self.ident+'.json')).read_bytes()
        with patch.object(vocal,'proof',return_value=self.binding):
            proposal=vocal.propose(self.run,self.line,self.paths,decode_fn=lambda p:self.samples)
            receipt=vocal.apply(self.run,proposal,self.paths,decode_fn=lambda p:self.samples)
            approval=json.loads((self.run/'word-cues/qualifications.private.json').read_text())['approvals'][self.ident]
            expected={k:self.binding[k] for k in ['audio_sha256','text_sha256','source_manifest_sha256']};expected['engine_version']=vocal.cues.ENGINE
            self.assertEqual((self.run/receipt['Vocal_event_adoption']['archive_file']).read_bytes(),original)
            self.assertEqual(receipt['all_qualification_flags'],self.old['all_qualification_flags'])
            self.assertTrue(vocal.validate_cached_adoption(receipt,expected,approval,self.run,decode_fn=lambda p:self.samples))
            self.assertFalse(vocal.validate_cached_adoption(receipt,expected,approval,self.run,decode_fn=lambda p:[0]*16000))
            bad=copy.deepcopy(receipt);bad['all_qualification_flags']=[]
            self.assertFalse(vocal.validate_cached_adoption(bad,expected,approval,self.run,decode_fn=lambda p:self.samples))
            bad=copy.deepcopy(approval);bad['vocal_event_proposal_sha256']='wrong'
            self.assertFalse(vocal.validate_cached_adoption(receipt,expected,bad,self.run,decode_fn=lambda p:self.samples))
            (self.run/receipt['Vocal_event_adoption']['archive_file']).write_bytes(b'changed')
            self.assertFalse(vocal.validate_cached_adoption(receipt,expected,approval,self.run,decode_fn=lambda p:self.samples))
    def test_stale_dtw_and_changed_reviewed_measurement_reject(self):
        with patch.object(vocal,'proof',return_value=self.binding):
            proposal=vocal.propose(self.run,self.line,self.paths,decode_fn=lambda p:self.samples)
            bad=copy.deepcopy(proposal);bad['measurement']['end']+=.01
            with self.assertRaises(ValueError):vocal.apply(self.run,bad,self.paths,decode_fn=lambda p:self.samples)
        old=copy.deepcopy(self.old);old['audio_sha256']='stale'
        vocal.qa.save(self.run/'word-cues'/(self.ident+'.json'),old)
        with patch.object(vocal,'proof',return_value=self.binding):
            with self.assertRaises(ValueError):vocal.propose(self.run,self.line,self.paths,decode_fn=lambda p:self.samples)

if __name__=='__main__':unittest.main()
