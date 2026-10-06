"""Synthetic offline fixtures; no provider, key, GPU, real bank edits or approvals."""
import base64
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import story_voice_native625_evidence as e

class Native625EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.child = self.root/'child'; self.parent = self.root/'parent'
        self.batch = self.child/'qc-batch'; self.ctcp = self.root/'ctc.json'
        self.qap = self.child/'qa.json'; self.qcp = self.child/'qc.json'
        self.mp3 = b'synthetic normalized MP3 fixture'; self.wav = b'synthetic raw WAV fixture'
        self.write(self.child/'lines.private.json', {'model':e.TTS_MODEL,'lines':[{'id':e.ID,'text':e.SOURCE,'speaker':'azar'}]})
        self.write(self.child/'profiles.private.json', {'speakers':{'azar':{'google_voice':e.VOICE}}})
        request = {'contents':[{'role':'user','parts':[{'text':'<groan>. Dann … dann laufe ich eben … bis ich umfalle.'}]}],
                   'generationConfig':{'speechConfig':{'voiceConfig':{'voice':e.VOICE}}}}
        request_hash = e.digest(json.dumps(request,sort_keys=True).encode())
        source_hash = e.digest(e.SOURCE.encode()); audio_hash = e.digest(self.mp3)
        self.bytes(self.child/'clips'/f'{e.ID}.mp3', self.mp3); self.bytes(self.child/'raw'/f'{e.ID}.wav',self.wav)
        self.write(self.child/'requests.jsonl',{'key':e.ID,'request':request})
        self.write(self.child/'responses.private.jsonl',{'key':e.ID,'response':{'modelVersion':e.TTS_MODEL,'candidates':[{'content':{'parts':[{'inlineData':{'mimeType':'audio/wav','data':base64.b64encode(self.wav).decode()}}]}}]}})
        receipt={'id':e.ID,'model':e.TTS_MODEL,'status':'complete','backend':'batch','seconds':2,'mp3_sha256':audio_hash,'wav_sha256':e.digest(self.wav),'request_sha256':request_hash,
                 'delivery_override':{'type':'explicit_vocal_events','source_text_sha256':source_hash,'vocal_events':[{'word_index':0,'source_word':'Ugh.','tag':'<groan>'}]}}
        self.write(self.child/'raw'/f'{e.ID}.receipt.json',receipt)
        self.write(self.child/'parent-snapshot.private.json',{'modified_request_sha256':{e.ID:request_hash},'source_text_sha256':{e.ID:source_hash},'fixed_google_voices':{e.ID:e.VOICE}})
        self.write(self.child/'prepared.json',{'model':e.TTS_MODEL,'frozen_sha256':{p:e.file_hash(self.child/p) for p in ['lines.private.json','profiles.private.json','parent-snapshot.private.json']}})
        self.write(self.qap,{'version':e.protected_qa.VERSION,'model':e.protected_qa.MODEL,'manifest_sha256':e.file_hash(self.child/'lines.private.json'),'clip_sha256':{e.ID:audio_hash},'takes':[{'id':e.ID,'text_sha256':source_hash,'signal':{'silent':False,'seconds':2,'decoded_samples':48000,'peak':.8,'rms':.1,'clipped_fraction':0,'leading_silence_seconds':.1,'trailing_silence_seconds':.1,'last_frame_rms':.0001},'reasons':['asr_lexical_mismatch_requires_review']}]})
        observation={'transcript':'Dann dann lauf ich eben bis ich umfalle.','events':[{'category':'groan','description':'exhausted sigh or groan','vocal_sound':'haah','confidence':.85}]}
        response={'modelVersion':e.qc.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(observation)}]}}]}
        record={'id':e.ID,'clip_sha256':audio_hash,'source_audio_sha256':audio_hash,'upload_sha256':audio_hash,'source_text_sha256':source_hash,'prompt':e.qc.PROMPT,'model':e.qc.MODEL,'transcript':observation['transcript'],'response':response,**e.qc.cache_metadata()}
        self.write(self.qcp,record)
        self.write(self.batch/'requests.jsonl',{'key':e.ID,'request':e.qc.request_for(self.mp3)})
        self.write(self.batch/'responses.private.jsonl',{'key':e.ID,'response':response})
        self.write(self.batch/'audio-snapshot.private.json',{'model':e.qc.MODEL,'prompt':e.qc.PROMPT,'source_run':str(self.child),'source_manifest_sha256':e.file_hash(self.child/'lines.private.json'),'clips':[{'id':e.ID,'clip_sha256':audio_hash,'source_text_sha256':source_hash}]})
        self.write(self.batch/'prepared.json',{'model':e.qc.MODEL,'input_sha256':e.file_hash(self.batch/'requests.jsonl')})
        self.write(self.batch/'collection.private.json',{'model':e.qc.MODEL,'collected':1,'expected':1,'failures':[]})
        self.write(self.batch/'job.json',{'model':e.qc.MODEL,'state':'JOB_STATE_SUCCEEDED'})
        self.write(self.batch/'submit-intent.private.json',{'model':e.qc.MODEL,'state':'CONFIRMED','input_sha256':e.file_hash(self.batch/'requests.jsonl')})
        chars='dann|dann|laufe|ich|eben|bis|ich|umfalle'; labels={'0':'<blank>'}; ids=[]
        for char in chars:
            token=next((int(k) for k,v in labels.items() if v==char),len(labels)); labels[str(token)]=char;ids.extend([token,0])
        probs=[.99]*len(ids); collapsed=[i for i in ids if i];greedy={'transcript':chars.replace('|',' '),'argmax_token_ids':ids,'argmax_token_probabilities':probs,'argmax_token_ids_sha256':e.digest(json.dumps(ids,separators=(',',':')).encode()),'frame_evidence_sha256':e.digest(json.dumps({'argmax_token_ids':ids,'argmax_token_probabilities':probs},sort_keys=True,separators=(',',':')).encode()),'blank_token_id':0,'collapsed_token_ids':collapsed,'token_id_to_label':labels,'unknown_tokens':[],'authored_initial_prompt':None,'method':'unprompted_acoustic_argmax_CTC_blank_repeat_collapse'}
        modeldir=self.root/'model';modeldir.mkdir()
        for name in ['config.json','preprocessor_config.json','pytorch_model.bin','special_tokens_map.json','vocab.json']:(modeldir/name).write_bytes(b'synthetic model bytes '+name.encode())
        model_files={p.name:e.file_hash(p) for p in modeldir.iterdir()}
        self.write(self.ctcp,{'id':e.ID,'text':e.SOURCE,'binding':{'engine':'story-german-ctc-expanded-blank-v2','script_sha256':e.file_hash(Path(e.__file__).with_name('story_voice_ctc_align.py')),'model':{'local_directory':str(modeldir.resolve()),'file_sha256':model_files,'model_id':e.CTC_MODEL,'revision':e.CTC_REVISION,'fingerprint':'1a1dd773490ce94681628574d3f74813827bb8858c662dcc7ab41c4fe3f88b7f'},'audio_sha256':audio_hash,'text_sha256':source_hash,'source_manifest_sha256':e.file_hash(self.child/'lines.private.json'),'qa_report_sha256':e.file_hash(self.qap)},'greedy_decode':greedy})
        self.parent.mkdir();shutil.copy(self.child/'lines.private.json',self.parent/'lines.private.json');shutil.copy(self.child/'profiles.private.json',self.parent/'profiles.private.json')
    def bytes(self,p,data):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    def write(self,p,d):self.bytes(p,(json.dumps(d)+'\n').encode())
    def mutate(self,p,fn):d=e.read(p);fn(d);self.write(p,d)
    def template(self):return e.build_template(self.child,self.qap,self.qcp,self.batch,self.ctcp)
    def approve(self,d):d['root_approval']={'status':'approved_native625_evidence','reviewed_by':'root fixture individual review','reason':'Explicit one-case full-source review in synthetic fixture','id':e.ID,'audio_sha256':d['evidence']['audio_sha256'],'evidence_sha256':d['evidence_sha256']};return d
    def import_fixture(self):
        for name in [f'clips/{e.ID}.mp3',f'raw/{e.ID}.wav',f'raw/{e.ID}.receipt.json']:
            dest=self.parent/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy(self.child/name,dest)
        self.write(self.child/'import.private.json',{'state':'IMPORTED','selected_ids':[e.ID],'new_mp3_sha256':{e.ID:e.digest(self.mp3)},'parent_snapshot_sha256':e.file_hash(self.child/'parent-snapshot.private.json')})
    def test_unapproved_and_preimport_fail_then_exact_import_succeeds(self):
        d=self.template()
        with self.assertRaises(e.EvidenceError):e.validate(self.parent,d)
        self.approve(d)
        with self.assertRaises(OSError):e.validate(self.parent,d)
        self.import_fixture();result=e.validate(self.parent,d);self.assertEqual(result['source_run'],str(self.child.resolve()));self.assertIsNone(result['timing_approval']);self.assertEqual(len(list((self.parent).rglob('qc*'))),0)
    def test_source_id_voice_model_changed_rejected(self):
        for key,value in [('text','Changed source'),('id','story-other'),('speaker','lia')]:
            original=e.read(self.child/'lines.private.json');self.mutate(self.child/'lines.private.json',lambda d:d['lines'][0].update({key:value}))
            with self.assertRaises((e.EvidenceError,KeyError)):self.template()
            self.write(self.child/'lines.private.json',original)
        self.mutate(self.child/'profiles.private.json',lambda d:d['speakers']['azar'].update(google_voice='Puck'))
        with self.assertRaises(e.EvidenceError):self.template()
    def test_missing_dann_extra_body_and_extra_event_rejected(self):
        original=e.read(self.qcp)
        for transcript in ['Dann lauf ich eben bis ich umfalle.', 'Dann dann lauf ich eben bis ich umfalle heute.']:
            d=copy.deepcopy(original);obs=json.loads(d['response']['candidates'][0]['content']['parts'][0]['text']);obs['transcript']=transcript;d['transcript']=transcript;d['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps(obs);self.write(self.qcp,d)
            with self.assertRaises(e.EvidenceError):self.template()
        d=copy.deepcopy(original);obs=json.loads(d['response']['candidates'][0]['content']['parts'][0]['text']);obs['events']*=2;d['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps(obs);self.write(self.qcp,d)
        with self.assertRaises(e.EvidenceError):self.template()
    def test_model_and_raw_provider_mismatch_rejected(self):
        original=e.read(self.qcp);self.mutate(self.qcp,lambda d:d.update(model='another-model'))
        with self.assertRaises(e.EvidenceError):self.template()
        self.write(self.qcp,original);self.mutate(self.batch/'responses.private.jsonl',lambda d:d['response'].update(modelVersion='another-model'))
        with self.assertRaises(e.EvidenceError):self.template()
    def test_audio_receipt_and_child_qa_stale_rejected(self):
        p=self.child/'clips'/f'{e.ID}.mp3';p.write_bytes(b'changed')
        with self.assertRaises(e.EvidenceError):self.template()
        p.write_bytes(self.mp3);self.mutate(self.child/'raw'/f'{e.ID}.receipt.json',lambda d:d.update(model='other'))
        with self.assertRaises(e.EvidenceError):self.template()
    def test_ctc_frames_model_and_qa_binding_fail_closed(self):
        original=e.read(self.ctcp)
        mutations=[lambda d:d['binding']['model'].update(revision='changed'),lambda d:d['binding'].update(qa_report_sha256='stale'),lambda d:d['greedy_decode']['argmax_token_ids'].__setitem__(0,0),lambda d:d['greedy_decode'].update(transcript='dann laufe ich eben bis ich umfalle')]
        for fn in mutations:
            d=copy.deepcopy(original);fn(d);self.write(self.ctcp,d)
            with self.assertRaises(e.EvidenceError):self.template()
    def test_approval_and_parent_provenance_stale_rejected(self):
        d=self.approve(self.template());self.import_fixture();d['root_approval']['audio_sha256']='stale'
        with self.assertRaises(e.EvidenceError):e.validate(self.parent,d)
        self.approve(d);self.mutate(self.parent/'raw'/f'{e.ID}.receipt.json',lambda z:z.update(seconds=99))
        with self.assertRaises(e.EvidenceError):e.validate(self.parent,d)
    def test_child_qa_and_actual_tts_raw_wav_rejected(self):
        qa=e.read(self.qap);self.mutate(self.qap,lambda z:z['takes'][0]['signal'].update(silent=True))
        with self.assertRaises(e.EvidenceError):self.template()
        self.write(self.qap,qa);self.mutate(self.child/'responses.private.jsonl',lambda z:z['response']['candidates'][0]['content']['parts'][0]['inlineData'].update(data=base64.b64encode(b'other WAV').decode()))
        with self.assertRaises(e.EvidenceError):self.template()
    def test_actual_request_voice_and_provider_collection_rejected(self):
        original=e.read(self.child/'requests.jsonl');self.mutate(self.child/'requests.jsonl',lambda z:z['request']['generationConfig']['speechConfig']['voiceConfig'].update(voice='Puck'))
        with self.assertRaises(e.EvidenceError):self.template()
        self.write(self.child/'requests.jsonl',original);self.mutate(self.batch/'collection.private.json',lambda z:z.update(collected=0))
        with self.assertRaises(e.EvidenceError):self.template()
    def test_reviewed_evidence_edit_even_with_rehashed_document_rejected(self):
        d=self.approve(self.template());self.import_fixture();d['evidence']['voice']='Puck';d['evidence_sha256']=e.digest(e.canonical(d['evidence']));self.approve(d)
        with self.assertRaises(e.EvidenceError):e.validate(self.parent,d)
    def test_root_review_identity_and_meaningful_reason_required(self):
        d=self.approve(self.template());self.import_fixture()
        for field,value in [('reviewed_by','worker approval'),('reviewed_by','root '),('reason',''),('reason','aaaaaaaaaaaaaaaaaaaaaaaaa')]:
            x=copy.deepcopy(d);x['root_approval'][field]=value
            with self.assertRaises(e.EvidenceError):e.validate(self.parent,x)
    def test_qa_version_model_manifest_and_signal_fail_closed(self):
        original=e.read(self.qap)
        mutations=[lambda z:z.update(version='other'),lambda z:z.update(model='other'),lambda z:z.update(manifest_sha256='stale'),lambda z:z['takes'][0]['signal'].update(peak=float('nan')),lambda z:z['takes'][0]['signal'].pop('rms'),lambda z:z['takes'][0]['signal'].update(clipped_fraction=.02)]
        for fn in mutations:
            z=copy.deepcopy(original);fn(z);self.write(self.qap,z)
            with self.assertRaises(e.EvidenceError):self.template()
    def test_actual_cached_weights_and_protected_driver_hash_checked(self):
        c=e.read(self.ctcp);self.mutate(self.ctcp,lambda z:z['binding'].update(script_sha256='other'))
        with self.assertRaises(e.EvidenceError):self.template()
        self.write(self.ctcp,c);weights=Path(c['binding']['model']['local_directory'])/'pytorch_model.bin';weights.write_bytes(b'changed model bytes')
        with self.assertRaises(e.EvidenceError):self.template()
    def test_full_parent_row_and_exact_import_journal_scope_checked(self):
        d=self.approve(self.template());self.import_fixture();self.mutate(self.parent/'lines.private.json',lambda z:z['lines'][0].update(scene='different scene with same text'))
        with self.assertRaises(e.EvidenceError):e.validate(self.parent,d)
        shutil.copy(self.child/'lines.private.json',self.parent/'lines.private.json');self.mutate(self.child/'import.private.json',lambda z:z.update(selected_ids=[e.ID,'story-another']))
        with self.assertRaises(e.EvidenceError):e.validate(self.parent,d)
    def test_changed_parent_source_and_voice_rejected(self):
        d=self.approve(self.template());self.import_fixture();self.mutate(self.parent/'lines.private.json',lambda z:z['lines'][0].update(text='Ugh. Different.'))
        with self.assertRaises(e.EvidenceError):e.validate(self.parent,d)

if __name__=='__main__':unittest.main()
