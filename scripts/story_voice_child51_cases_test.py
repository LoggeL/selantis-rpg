"""Synthetic offline Child51 guards. No model loads, forwards or approvals."""
import base64
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import story_voice_child51_cases as m


class Child51WordsAndFrames(unittest.TestCase):
    def line(self, ident=m.COMPANION_ID):
        c=m.CASES[ident];return {'id':ident,'text':c['text'],'speaker':c['speaker']}
    def record(self, ident, transcript=None, events=None):
        value={'transcript':transcript or m.CASES[ident]['qc_transcript'],
            'events':([] if ident==m.COMPANION_ID else [m.RELIEF_EVENT]) if events is None else events}
        return {'response':{'modelVersion':m.qc.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(value)}]}}]}}
    def matrices(self, ident, tokens=None):
        if tokens is None:
            tokens=(['oː','n','ə','f','ɔ','l','t','a','n','ʊ','n','t','a','z','a','a'] if ident==m.COMPANION_ID
                else ['ɑː','h','eː','m','l','ɪ','ʃ','f','ɔ','l','t','a','n','z','iː'])
        labels=['<pad>','oː','n','ə','f','ɔ','l','t','a','ʊ','z','ɑː','h','eː','m','ɪ','ʃ','iː','v','ɜ']
        labels+=['unused'+str(k) for k in range(392-len(labels))];vocab={t:i for i,t in enumerate(labels)}
        classes=[]
        for t in tokens:classes.extend([0,vocab[t]])
        logits=np.full((1,len(classes),392),-12,dtype=np.float32)
        for j,k in enumerate(classes):logits[0,j,k]=8
        ids=logits[0].argmax(axis=1);shift=logits[0].astype(np.float64)-logits[0].max(axis=1,keepdims=True)
        probabilities=np.exp(shift);probabilities/=probabilities.sum(axis=1,keepdims=True)
        events=[{'frame_index':j,'class_id':int(k),'token':labels[k],'actual_argmax_softmax_probability':float(probabilities[j,k])}
            for j,k in enumerate(ids) if k]
        raw=' '.join(e['token'] for e in events)
        return logits,probabilities,ids,vocab,{'raw_ipa':raw,'native_decode':raw,'emitted_raw_tokens':events}
    def test_exact_sources_and_complete_actual_transcripts(self):
        for i,c in m.CASES.items():
            line=self.line(i)
            for channel in ['primary','qc']:m.words(line,c[channel+'_transcript'],channel)
            proof=m.qc_observation(line,self.record(i));self.assertEqual(proof['expected_tokens'],m.qa.words(c['text']))
        companion=m.words(self.line(),m.CASES[m.COMPANION_ID]['primary_transcript'],'primary')
        self.assertEqual(companion['segmentation_only']['observed_words'],['nirgendwo','hin'])
        self.assertEqual(companion['non_name_body_characters'],'ohneundazargeheichnirgendwohin')
        self.assertEqual(proof['literal_six_body_words'],['himmlisch','sie','bleibt','ich','bestehe','darauf'])
    def test_added_dropped_changed_source_speaker_and_transcript_are_rejected(self):
        for i,c in m.CASES.items():
            line=self.line(i)
            for change in [{'id':'story-other'},{'text':line['text']+' Heute.'},{'speaker':'wrong'}]:
                with self.assertRaises(m.core.SafeError):m.case(dict(line,**change))
            for channel in ['primary','qc']:
                text=c[channel+'_transcript']
                for bad in [text+' extra',' '.join(text.split()[:-1]),'Wrong '+text,text.lower()]:
                    with self.assertRaises(m.core.SafeError):m.words(line,bad,channel)
    def test_exact_event_never_relabelled_added_dropped_or_rewritten(self):
        variants=[[],[m.RELIEF_EVENT,m.RELIEF_EVENT]]
        variants += [[dict(m.RELIEF_EVENT,**change)] for change in [{'category':'other'}, {'description':'relief'},
            {'vocal_sound':'ɑː'},{'confidence':.91}]]
        for events in variants:
            with self.assertRaises(m.core.SafeError):m.qc_observation(self.line(m.RELIEF_ID),self.record(m.RELIEF_ID,events=events))
        with self.assertRaises(m.core.SafeError):m.qc_observation(self.line(),self.record(m.COMPANION_ID,events=[m.RELIEF_EVENT]))
    def test_exact_native_phones_and_opening_no_Azar_phone_claim(self):
        for i in m.CASES:
            proof=m.native_frames(self.line(i),*self.matrices(i));self.assertGreater(proof['selected_f_uncalibrated_softmax'],.95)
            self.assertEqual([e['token'] for e in proof['selected_events']],['f','ɔ','l','t','a','n'])
            if i==m.RELIEF_ID:self.assertEqual(proof['actual_opening_event']['token'],'ɑː')
            else:self.assertIsNone(proof['Azar_phone_claim'])
            tokens=[e['token'] for e in self.matrices(i)[-1]['emitted_raw_tokens']];start=m.CASES[i]['native_name_indices'][0]
            for index,token in [(start,'v'),(start+4,'ɑː'),(start+4,'ɜ')]+([(0,'a')] if i==m.RELIEF_ID else []):
                bad=tokens[:];bad[index]=token
                with self.assertRaises(m.core.SafeError):m.native_frames(self.line(i),*self.matrices(i,bad))
    def test_complete_arrays_vocabulary_and_raw_decode_must_be_unchanged(self):
        for i in m.CASES:
            for kind in ['logits','softmax','ids','vocab','events','decode','dtype']:
                args=list(self.matrices(i))
                if kind=='logits':args[0][0,0,0]-=1
                elif kind=='softmax':args[1][0,0]-=.01
                elif kind=='ids':args[2][1]=0
                elif kind=='vocab':args[3].pop('unused0')
                elif kind=='events':args[4]['emitted_raw_tokens'].pop()
                elif kind=='decode':args[4]['native_decode']+=' f'
                else:args[0]=args[0].astype(np.float64)
                with self.assertRaises(m.core.SafeError):m.native_frames(self.line(i),*args)
    def test_explicit_root_review_and_current_bindings_required(self):
        for i in m.CASES:
            template={'status':'root_review_required','reviewed_by':'','reason':'','id':i,'method':m.VERSION,
                'clip_sha256':'actual','source_text_sha256':'authored','source_row':self.line(i),'parent_import_and_full_QA_required':False}
            approval=dict(copy.deepcopy(template),status=m.APPROVED,reviewed_by='root synthetic fixture',
                reason='Explicit individual complete actual evidence review.')
            with patch.object(m,'proof_template',return_value=template):
                self.assertIsNotNone(m.review(None,self.line(i),{},approval))
                for change in [{'status':'offline_preflight_unapproved'},{'reviewed_by':'worker'},{'reason':'ok'},
                    {'clip_sha256':'stale'},{'source_row':self.line(i)|{'text':'other'}},{'parent_import_and_full_QA_required':True}]:
                    with self.assertRaises(m.core.SafeError):m.review(None,self.line(i),{},dict(approval,**change))
                with self.assertRaises(m.core.SafeError):m.review(None,self.line(i),{},dict(approval,extra=True))
            self.assertIsNone(m.review(None,self.line(i),{},None))
        with self.assertRaises(m.core.SafeError):m.proof_template(None,self.line(),{})


class NativeScopeAndRuntimeGuards(unittest.TestCase):
    def test_all43_original_native_outputs_reject_rehashed_modified_result(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);names=['completion.private.json','execution-intent.private.json','source-context.private.json']
            for ident in m.META_IDS:
                names.extend('results/'+ident+'.'+suffix for suffix in ['observation.private.json','forward-intent.private.json',
                    'phone-logits.private.npy','frame-probabilities.private.npy','argmax-ids.private.npy'])
            for name in names:
                p=base/name;p.parent.mkdir(exist_ok=True);p.write_bytes(('synthetic original '+name).encode())
            expected=m.object_hash({name:m.digest(base/name) for name in sorted(names)})
            with patch.object(m,'FROZEN_NATIVE_OUTPUT_SHA256',expected):
                self.assertEqual(len(m.frozen_native_result_bindings(base,lambda p:p)),43)
                for name in names:
                    p=base/name;old=p.read_bytes();p.write_bytes(old+b'modified')
                    with self.subTest(file=name),self.assertRaises(m.core.SafeError):m.frozen_native_result_bindings(base,lambda p:p)
                    p.write_bytes(old)
                # Updating an accompanying observation file still cannot legitimize changed logits.
                for suffix in ['phone-logits.private.npy','observation.private.json']:
                    (base/'results'/(m.COMPANION_ID+'.'+suffix)).write_bytes(b'coordinated forged replacement')
                with self.assertRaises(m.core.SafeError):m.frozen_native_result_bindings(base,lambda p:p)
    def scope(self):
        run=Path('/synthetic-private-parent');child=run/m.CHILD
        audio={i:'synthetic-'+i for i in m.META_IDS}
        plan={'source_run':str(child),'parent_run':str(run),'model':m.native.MODEL,'revision':m.native.REVISION,
            'runner_sha256':m.FROZEN_RUNNER_SHA256,'root_forward_approval_required':True,
            'original_full_child21_guard':True,'source_child_retake_prepared_full1557_verified':True,'max_forward_calls':8}
        completion={'status':'observations_complete','calls':8,'approval':None,
            'runner_sha256':m.FROZEN_RUNNER_SHA256,'plan_sha256':m.FROZEN_PLAN_SHA256}
        execution={'max_forward_calls':8,'mp3_sha256':audio}
        observation={'model':m.native.MODEL,'revision':m.native.REVISION,'plan_sha256':m.FROZEN_PLAN_SHA256}
        gate={'status':'approved_execution_scope','reviewed_by':'root synthetic fixture',
            'reason':'Root explicitly reviewed this exact eight forward execution scope.',
            'runner_sha256':m.FROZEN_RUNNER_SHA256,'plan_sha256':m.FROZEN_PLAN_SHA256,
            'selected_ids':m.META_IDS[:],'model':m.native.MODEL,'revision':m.native.REVISION,
            'max_forward_calls':8,'audio_sha256':copy.deepcopy(audio)}
        return [run,child,plan,completion,execution,observation,gate,m.FROZEN_RUNNER_SHA256,m.FROZEN_PLAN_SHA256]
    def test_genuine_frozen_root8_gate_and_completion_required(self):
        m.native_execution_scope(*self.scope())
        for index,change in [(2,{'model':'other'}),(2,{'revision':'other'}),(2,{'source_run':'old-child45'}),
                (2,{'root_forward_approval_required':False}),(2,{'original_full_child21_guard':False}),
                (3,{'calls':7}),(3,{'approval':True}),(4,{'max_forward_calls':9}),
                (5,{'model':'other'}),(6,{'status':'root_review_required'}),(6,{'reviewed_by':'worker'}),
                (6,{'selected_ids':m.META_IDS[:-1]}),(6,{'audio_sha256':{}})]:
            args=copy.deepcopy(self.scope());args[index].update(change)
            with self.subTest(index=index,change=change),self.assertRaises(m.core.SafeError):m.native_execution_scope(*args)
        for index in [7,8]:
            args=self.scope();args[index]='modified'
            with self.assertRaises(m.core.SafeError):m.native_execution_scope(*args)
    def runtime(self, directory):
        root=Path(directory);model=root/'model';model.mkdir()
        for name,data in [('pytorch_model.bin',b'synthetic fixture weights'),('vocab.json',b'{}'),('config.json',b'{}')]:
            (model/name).write_bytes(data)
        bindings={}
        for package in ['torch','transformers','numpy','tokenizers','safetensors']:
            runtime=root/package;runtime.mkdir();(runtime/'__init__.py').write_text('# synthetic fixture bytes\n')
            meta=root/(package+'.metadata.json');meta.write_text('{}')
            bindings[package]={'root':str(root),'metadata':{meta.name:m.digest(meta)},
                'installed_tree_sha256':m.native_hash(m.native.tree(runtime))}
        ffmpeg=root/'ffmpeg';ffmpeg.write_bytes(b'synthetic decoder executable identity')
        files=m.native.tree(model);treehash=m.native_hash(files)
        plan={'model_directory':str(model),'model_files':files,'model_tree_sha256':treehash,
            'runtime_bindings':bindings,'python_binary_sha256':m.digest(Path(m.sys.executable).resolve()),
            'ffmpeg_binary':str(ffmpeg),'ffmpeg_sha256':m.digest(ffmpeg)}
        observation={'model_tree_sha256':treehash,'weights_sha256':files['pytorch_model.bin'],
            'vocab_sha256':files['vocab.json'],'runtime_bindings_sha256':m.native_hash(bindings)}
        execution={'model_files':copy.deepcopy(files),'model_tree_sha256':treehash,'weights_sha256':files['pytorch_model.bin']}
        forward=copy.deepcopy(execution)
        def path(p,external=False):p=Path(p);m.require(p.is_file(),'Fixture path missing.');return p
        return [plan,execution,observation,forward,path]
    def test_model_weights_vocabulary_runtime_metadata_and_installed_bytes_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            args=self.runtime(directory);self.assertEqual(m.native_runtime(*args),(Path(directory)/'model').resolve())
            for name in ['model/pytorch_model.bin','model/vocab.json','torch/__init__.py',
                    'numpy/__init__.py','tokenizers.metadata.json','ffmpeg']:
                p=Path(directory)/name;original=p.read_bytes();p.write_bytes(original+b'modified')
                with self.subTest(file=name),self.assertRaises(m.core.SafeError):m.native_runtime(*args)
                p.write_bytes(original)
            for index,key in [(0,'python_binary_sha256'),(1,'weights_sha256'),(2,'vocab_sha256'),
                    (2,'runtime_bindings_sha256'),(3,'model_tree_sha256')]:
                broken=args[:];broken[index]=dict(args[index],**{key:'modified'})
                with self.subTest(index=index,key=key),self.assertRaises(m.core.SafeError):m.native_runtime(*broken)


class ImportedChildFixtureTests(unittest.TestCase):
    """Full original provider request/raw identity and actual import guards run here.

    Parent source preparation is isolated; both actual raw validators still run.
    Two Parent rows stand in for 1557 only inside this synthetic test fixture.
    """
    def save(self,p,value):p.parent.mkdir(parents=True,exist_ok=True);m.core.save(p,value)
    def mutate(self,p,fn):v=m.core.read_json(p);fn(v);self.save(p,v)
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.run=Path(self.temp.name).resolve()
        self.child=self.run/m.CHILD;self.ids=list(m.CASES);self.rows=[{'id':i,'text':m.CASES[i]['text'],'speaker':m.CASES[i]['speaker']} for i in self.ids]
        self.allrows=self.rows+[{'id':'fixture-'+str(k),'text':'Hallo.','speaker':'azar'} for k in range(19)]
        self.hashes={};self.requests=[];self.raw=[];self.receipts={}
        cases=copy.deepcopy(m.CASES)
        for row in self.allrows:
            i=row['id'];audio=('synthetic-mp3-'+i).encode();wav=('synthetic-wav-'+i).encode()
            for folder,data,extension in [('clips',audio,'.mp3'),('raw',wav,'.wav')]:
                p=self.child/folder/(i+extension);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
                if i in self.ids:q=self.run/folder/(i+extension);q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(data)
            sha=m.core.digest(audio);self.hashes[i]=sha
            voice=m.CASES[i]['voice'] if i in self.ids else 'Zubenelgenubi'
            request={'contents':[{'role':'user','parts':[{'text':row['text'],'speechMetadata':{'style':'Fixture delivery.'}}]}],
                'generationConfig':{'speechConfig':{'voiceConfig':{'voice':voice},'languageCode':'de-DE'},'responseModalities':['AUDIO']}}
            self.requests.append({'key':i,'request':request})
            self.raw.append({'key':i,'response':{'modelVersion':m.core.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[
                {'inlineData':{'mimeType':'audio/wav','data':base64.b64encode(wav).decode()}}]}}]}})
            rec={'id':i,'status':'complete','backend':'batch','model':m.core.MODEL,'mp3_sha256':sha,'wav_sha256':m.core.digest(wav),
                'request_sha256':m.core.digest(json.dumps(request,sort_keys=True).encode()),'retake_parent_mp3_sha256':'original-'+i}
            self.save(self.child/'raw'/(i+'.receipt.json'),rec);self.receipts[i]=rec
            if i in self.ids:self.save(self.run/'raw'/(i+'.receipt.json'),rec);cases[i]['clip_sha256']=sha
        for name,body in [('lines.private.json',{'lines':self.rows}),('profiles.private.json',{'speakers':{c['speaker']:{'google_voice':c['voice']} for c in cases.values()}}),
                ('prepared.json',{'fixture':True}),('source-snapshot.private.json',{}),('full-inventory.private.json',{})]:self.save(self.run/name,body)
        (self.run/'requests.jsonl').write_text('{}\n')
        self.save(self.child/'lines.private.json',{'lines':self.allrows});self.save(self.child/'profiles.private.json',m.core.read_json(self.run/'profiles.private.json'))
        self.save(self.child/'delivery-overrides.private.json',{'synthetic':True})
        self.snapshot={'model':m.core.MODEL,'parent':str(self.run),'selected_ids':[r['id'] for r in self.allrows],
            'parent_file_sha256':{n:m.digest(self.run/n) for n in ['prepared.json','lines.private.json','profiles.private.json','requests.jsonl']},
            'fixed_google_voices':{r['id']:(cases[r['id']]['voice'] if r['id'] in cases else 'Zubenelgenubi') for r in self.allrows},
            'modified_request_sha256':{r['key']:m.core.digest(json.dumps(r['request'],sort_keys=True).encode()) for r in self.requests},
            'source_text_sha256':{r['id']:m.qa.text_hash(r['text']) for r in self.allrows},'bank_mp3_sha256':{r['id']:'original-'+r['id'] for r in self.allrows}}
        self.save(self.child/'parent-snapshot.private.json',self.snapshot)
        payload=''.join(json.dumps(r)+'\n' for r in self.requests).encode();(self.child/'requests.jsonl').write_bytes(payload)
        self.save(self.child/'prepared.json',{'request_count':21,'input_bytes':len(payload),'input_sha256':m.core.digest(payload),
            'frozen_sha256':{n:m.digest(self.child/n) for n in ['lines.private.json','profiles.private.json','delivery-overrides.private.json','parent-snapshot.private.json']}})
        (self.child/'responses.private.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in self.raw))
        self.save(self.child/'collection.private.json',{'collected':21,'expected':21,'failures':[]})
        self.save(self.child/'job.json',{'state':'JOB_STATE_SUCCEEDED','model':m.core.MODEL,'request_count':21})
        self.save(self.child/'submit-intent.private.json',{'state':'CONFIRMED','model':m.core.MODEL,'input_sha256':m.core.digest(payload)})
        self.journal=self.child/'import.private.json';self.save(self.journal,{'state':'IMPORTED','selected_ids':self.ids,
            'original_scope_selected_ids':self.snapshot['selected_ids'],'parent_snapshot_sha256':m.digest(self.child/'parent-snapshot.private.json'),
            'new_mp3_sha256':{i:self.hashes[i] for i in self.ids}})
        self.signal={'silent':False,'seconds':3.,'peak':.4,'rms':.1,'clipped_fraction':0.,'leading_silence_seconds':.1,'trailing_silence_seconds':.1,'last_frame_rms':0.}
        def report(rows):return {'version':m.qa.VERSION,'model':m.qa.MODEL,'manifest_sha256':m.digest((self.child if len(rows)==21 else self.run)/'lines.private.json'),
            'checked_ids':[r['id'] for r in rows],'clip_sha256':{r['id']:self.hashes[r['id']] for r in rows},
            'takes':[{'id':r['id'],'text_sha256':m.qa.text_hash(r['text']),'signal':copy.deepcopy(self.signal),
                'transcript':cases[r['id']]['primary_transcript'] if r['id'] in cases else 'Hallo.',
                'reasons':['asr_lexical_mismatch_requires_review']} for r in rows],'failures':[]}
        self.base=self.run/'new-current-parent-qa.json';self.save(self.base,report(self.rows))
        self.save(self.child/'qa-actual-primary-pass52.private.json',report(self.allrows))
        self.save(self.child/'qa-asr-cache.private.json',{m.qa.text_hash(m.qa.VERSION+'\0'+m.qa.MODEL+'\0'+self.hashes[r['id']]+'\0'+r['text']):
            {'clip_sha256':self.hashes[r['id']],'text_sha256':m.qa.text_hash(r['text']),
            'transcript':cases[r['id']]['primary_transcript'] if r['id'] in cases else 'Hallo.'} for r in self.allrows})
        batch=self.child/'independent-vocal-qc/batches/child-qc-pass52';batch.mkdir(parents=True)
        qrequests=[];qraw=[];clips=[]
        for row in self.allrows:
            i=row['id'];text=cases[i]['qc_transcript'] if i in cases else row['text'];events=[m.RELIEF_EVENT] if i==m.RELIEF_ID else []
            response={'modelVersion':m.qc.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':text,'events':events})}]}}]}
            record={'id':i,'clip_sha256':self.hashes[i],'source_audio_sha256':self.hashes[i],'upload_sha256':self.hashes[i],
                'source_text_sha256':m.qa.text_hash(row['text']),'model':m.qc.MODEL,'prompt':m.qc.PROMPT,'input_mime_type':'audio/mpeg',
                'transcript':text,'response':response,**m.qc.cache_metadata()}
            self.save(self.child/'independent-vocal-qc'/(i+'.'+self.hashes[i][:16]+'.json'),record)
            qreq=m.qc.request_for((self.child/'clips'/(i+'.mp3')).read_bytes());qrequests.append({'key':i,'request':qreq});qraw.append({'key':i,'response':response})
            clips.append({'id':i,'clip_sha256':self.hashes[i],'source_audio_sha256':self.hashes[i],'source_text_sha256':m.qa.text_hash(row['text']),
                'request_sha256':m.core.digest(json.dumps(qreq,sort_keys=True).encode())})
        self.save(batch/'audio-snapshot.private.json',{'clips':clips,'source_run':str(self.child),'source_manifest_sha256':m.digest(self.child/'lines.private.json'),
            'source_tts_prepared_sha256':m.digest(self.child/'prepared.json'),'model':m.qc.MODEL,'prompt':m.qc.PROMPT,'prompt_sha256':m.qc.text_hash(m.qc.PROMPT)})
        qpayload=''.join(json.dumps(r)+'\n' for r in qrequests).encode();(batch/'requests.jsonl').write_bytes(qpayload)
        (batch/'responses.private.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in qraw))
        self.save(batch/'prepared.json',{'bank':'independent-story-vocal-qc','model':m.qc.MODEL,'request_count':21,'input_bytes':len(qpayload),
            'input_sha256':m.core.digest(qpayload),'snapshot_sha256':m.digest(batch/'audio-snapshot.private.json')})
        self.save(batch/'submit-intent.private.json',{'state':'CONFIRMED','model':m.qc.MODEL,'request_count':21,'input_sha256':m.core.digest(qpayload)})
        self.save(batch/'job.json',{'state':'JOB_STATE_SUCCEEDED','model':m.qc.MODEL,'request_count':21,'job_name':'batches/synthetic'})
        self.save(batch/'collection.private.json',{'model':m.qc.MODEL,'collected':21,'expected':21,'failures':[]})
        for obj,name,new in [(m,'CASES',cases),(m,'FULL_COUNT',2),(m.qa,'PRIVATE',self.run),(m.common,'prepared',lambda run:None),
                (m.retake,'prepared',lambda *a,**k:None),(m,'native_proof',lambda *a,**k:{'synthetic_only':True})]:
            p=patch.object(obj,name,new);p.start();self.addCleanup(p.stop)
    def bindings(self,ident=m.RELIEF_ID):return {'qa_report_path':str(self.base),'child_import_journal_path':str(self.journal),
        'child_qc_record_path':str(self.child/'independent-vocal-qc'/(ident+'.'+self.hashes[ident][:16]+'.json'))}
    def proof(self):return m.proof_template(self.run,self.rows[1],self.bindings())
    def test_actual_import_child_identity_raw_request_and_parent_qa_bound(self):
        result=self.proof();self.assertEqual(result['source_run'],str(self.child));self.assertEqual(result['base_qa_sha256'],m.digest(self.base))
        self.assertEqual(result['actual_blind_child_QC']['actual_events'],[m.RELIEF_EVENT]);self.assertEqual(result['native_Meta_evidence'],{'synthetic_only':True})
        self.assertEqual(result['status'],'root_review_required');self.assertEqual(result['reviewed_by'],'')
    def test_preflight_is_unapproved_without_current_parent_or_import(self):
        self.journal.unlink();(self.run/'clips'/(m.RELIEF_ID+'.mp3')).write_bytes(b'old-parent-audio')
        result=m.preflight(self.run,self.rows[1]);self.assertEqual(result['status'],'offline_preflight_unapproved')
        self.assertTrue(result['parent_import_and_full_QA_required']);self.assertIsNone(result['actual_import_journal'])
        self.assertIsNone(result['qa_take']);self.assertIsNone(result['base_qa_sha256']);self.assertEqual(result['reviewed_by'],'')
        with self.assertRaises(m.core.SafeError):self.proof()
    def test_duplicate_source_rows_block_even_unapproved_preflight(self):
        self.save(self.run/'lines.private.json',{'lines':[self.rows[1],self.rows[1]]})
        with self.assertRaises(m.core.SafeError):m.preflight(self.run,self.rows[1])
    def test_wrong_parent_audio_receipt_child_voice_and_incomplete_import_block(self):
        for p,fn in [(self.journal,lambda d:d.update(state='IMPORT_INTENT_RECORDED')),
                (self.journal,lambda d:d['new_mp3_sha256'].update({m.RELIEF_ID:'other'})),
                (self.run/'raw'/(m.RELIEF_ID+'.receipt.json'),lambda d:d.update(request_sha256='changed')),
                (self.child/'profiles.private.json',lambda d:d['speakers']['azar'].update(google_voice='Other'))]:
            original=p.read_bytes();self.mutate(p,fn)
            with self.assertRaises(m.core.SafeError):self.proof()
            p.write_bytes(original)
        p=self.run/'clips'/(m.RELIEF_ID+'.mp3');p.write_bytes(b'other')
        with self.assertRaises(m.core.SafeError):self.proof()
    def test_wrong_or_partial_current_qa_hash_body_and_signal_rejected(self):
        for fn in [lambda d:d['checked_ids'].pop(),lambda d:d['clip_sha256'].update({m.RELIEF_ID:'stale'}),
                lambda d:d.update(manifest_sha256='stale'),lambda d:d['takes'][1].update(text_sha256='changed'),
                lambda d:d['takes'][1]['signal'].update(silent=True)]:
            original=self.base.read_bytes();self.mutate(self.base,fn)
            with self.assertRaises(m.core.SafeError):self.proof()
            self.base.write_bytes(original)
    def test_original_full_child_primary_and_complete_cache_reject_mutation(self):
        report=self.child/'qa-actual-primary-pass52.private.json';cache=self.child/'qa-asr-cache.private.json'
        key=m.qa.text_hash(m.qa.VERSION+'\0'+m.qa.MODEL+'\0'+self.hashes[m.RELIEF_ID]+'\0'+self.rows[1]['text'])
        for p,fn in [(report,lambda d:d['checked_ids'].pop()),(report,lambda d:d['takes'][1].update(transcript='Oh, himmlisch. Volltan, sie bleibt. Ich bleibe darauf.')),
                (report,lambda d:d.update(model='other')),(cache,lambda d:d[key].update(transcript='Invented.')),
                (cache,lambda d:d.update(extra={})),(cache,lambda d:d.pop(key))]:
            original=p.read_bytes();self.mutate(p,fn)
            with self.subTest(path=p.name),self.assertRaises(m.core.SafeError):self.proof()
            p.write_bytes(original)
    def test_forged_qc_model_source_identity_response_and_provider_request_rejected(self):
        p=Path(self.bindings()['child_qc_record_path'])
        for fn in [lambda d:d.update(model='other'),lambda d:d.update(id=m.COMPANION_ID),lambda d:d.update(source_text_sha256='other'),
                lambda d:d.update(prompt=m.qc.PROMPT+' Expected Foltan.'),lambda d:d.update(transcript='Invented.'),
                lambda d:d['response']['candidates'][0]['content']['parts'][0].update(text=json.dumps({'transcript':'Wrong words.','events':[m.RELIEF_EVENT]}))]:
            original=p.read_bytes();self.mutate(p,fn)
            with self.assertRaises(m.core.SafeError):self.proof()
            p.write_bytes(original)
        raw=self.child/'independent-vocal-qc/batches/child-qc-pass52/responses.private.jsonl';raw.write_text(raw.read_text().replace('Spontan','Foltan'))
        with self.assertRaises(m.core.SafeError):self.proof()
    def test_import_path_and_qc_path_cannot_masquerade_as_parent(self):
        for key in ['child_qc_record_path','child_import_journal_path']:
            bindings=self.bindings();p=self.run/('copied-'+key+'.json');p.write_bytes(Path(bindings[key]).read_bytes());bindings[key]=str(p)
            with self.assertRaises(m.core.SafeError):m.proof_template(self.run,self.rows[1],bindings)
    def test_joint_three_source_journal_preserves_only_two_helper_cases(self):
        third='story-c024bb8e5e1453e7839cacac'
        # This synthetic original scope has room for the explicitly approved third source.
        self.snapshot['selected_ids'][-1]=third
        self.save(self.child/'parent-snapshot.private.json',self.snapshot)
        journal=m.core.read_json(self.journal);journal['original_scope_selected_ids']=self.snapshot['selected_ids']
        journal['parent_snapshot_sha256']=m.digest(self.child/'parent-snapshot.private.json')
        journal['selected_ids'].append(third);journal['new_mp3_sha256'][third]='third-source-hash'
        self.assertEqual(m.retake.journal_import_ids(journal,self.snapshot,journal['parent_snapshot_sha256']),self.ids+[third])
        self.assertTrue(set(journal['selected_ids'])<=set(self.snapshot['selected_ids']))
        self.assertNotIn(third,m.CASES)
        journal['selected_ids'].append('fixture-unapproved');journal['new_mp3_sha256']['fixture-unapproved']='unapproved'
        self.assertFalse(set(journal['selected_ids'])<=set(self.snapshot['selected_ids']))
        with self.assertRaises(m.core.SafeError):m.retake.journal_import_ids(journal,self.snapshot,journal['parent_snapshot_sha256'])


if __name__=='__main__':unittest.main()
