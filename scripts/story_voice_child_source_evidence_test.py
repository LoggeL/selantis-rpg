"""Synthetic offline guard tests, never production evidence or approvals."""
import base64
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import story_voice_child_source_evidence as m


class ChildWordAndNativeGuards(unittest.TestCase):
    def line(self, ident=m.ATTENTION_ID):
        c=m.CASES[ident]; return {'id':ident,'text':c['text'],'speaker':c['speaker']}
    def record(self, ident=m.FILLER_ID, transcript=None, events=None):
        line=self.line(ident)
        text=transcript or ('Hey, Voltan! Die Kleine ist ungeduldig.' if ident==m.ATTENTION_ID else line['text'])
        value={'transcript':text,'events':([] if ident==m.ATTENTION_ID else [m.FILLER_EVENT]) if events is None else events}
        return {'response':{'modelVersion':m.qc.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(value)}]}}]}}
    def matrices(self, tokens=None):
        tokens=tokens or ['h','eː','f','ɔ','l','t','ɑː','n','d','iː']
        labels=['<pad>','h','eː','f','ɔ','l','t','ɑː','n','v','a','ɜ','d','iː']
        labels+=['unused'+str(k) for k in range(392-len(labels))]; vocab={t:i for i,t in enumerate(labels)}
        classes=[]
        for token in tokens:classes.extend([0,vocab[token]])
        logits=np.full((1,len(classes),392),-12,dtype=np.float32)
        for j,k in enumerate(classes):logits[0,j,k]=8
        ids=logits[0].argmax(axis=1);shift=logits[0].astype(np.float64)-logits[0].max(axis=1,keepdims=True)
        probabilities=np.exp(shift);probabilities/=probabilities.sum(axis=1,keepdims=True)
        events=[{'frame_index':j,'class_id':int(k),'token':labels[k],'actual_argmax_softmax_probability':float(probabilities[j,k])}
                for j,k in enumerate(ids) if k]
        raw=' '.join(e['token'] for e in events)
        return logits,probabilities,ids,vocab,{'raw_ipa':raw,'native_decode':raw,'emitted_raw_tokens':events}
    def test_two_sources_exact_complete_bodies_and_original_event(self):
        for ident,c in m.CASES.items():
            line=self.line(ident);m.words(line,' '.join(c['primary_tokens']),'primary')
            proof=m.qc_observation(line,self.record(ident));self.assertEqual(proof['expected_tokens'],m.qa.words(c['text']))
        self.assertEqual(proof['actual_events'],[m.FILLER_EVENT]);self.assertEqual(len(proof['observed_tokens']),10)
    def test_other_source_voice_speaker_and_literal_body_edits_block(self):
        for ident in m.CASES:
            line=self.line(ident)
            for change in [{'id':'story-other'},{'text':line['text']+' Heute.'},{'speaker':'lia'}]:
                with self.assertRaises(m.core.SafeError):m.case(dict(line,**change))
            text=' '.join(m.CASES[ident].get('qc_tokens',m.qa.words(line['text'])))
            for bad in [text+' extra',' '.join(text.split()[:-1]),text.replace('die','der').replace('sprich','sprichst')]:
                with self.assertRaises(m.core.SafeError):m.words(line,bad,'qc')
    def test_exact_scoped_name_diagnostics_no_general_alias(self):
        line=self.line()
        for word in ['Foltan','Volltan','Foltern','Voltans']:
            with self.assertRaises(m.core.SafeError):m.words(line,'Hey '+word+' Die Kleine ist ungeduldig','qc')
        with self.assertRaises(m.core.SafeError):m.words(line,'He Voltan Die Kleine ist ungeduldig','qc')
    def test_filler_must_remain_in_complete_transcript(self):
        line=self.line(m.FILLER_ID)
        for text in ['Ich sprich mit Foltan Mädchen Das ist besser so','Ich äh sprich mit Voltan Mädchen Das ist besser so']:
            with self.assertRaises(m.core.SafeError):m.qc_observation(line,self.record(transcript=text))
    def test_extra_missing_wrong_category_description_sound_and_confidence_rejected(self):
        variants=[[],[m.FILLER_EVENT,m.FILLER_EVENT]]
        variants += [[dict(m.FILLER_EVENT,**change)] for change in
            [{'category':'other'},{'description':'other hesitation'},{'vocal_sound':'ah'},{'confidence':.86}]]
        for events in variants:
            with self.assertRaises(m.core.SafeError):m.qc_observation(self.line(m.FILLER_ID),self.record(events=events))
        with self.assertRaises(m.core.SafeError):m.qc_observation(self.line(),self.record(m.ATTENTION_ID,events=[m.FILLER_EVENT]))
    def test_native_whole_matrices_and_exact_attention_name_phones(self):
        proof=m.native_frames(*self.matrices());self.assertEqual([e['token'] for e in proof['actual_attention_events']],['h','eː'])
        self.assertGreater(proof['selected_f_uncalibrated_softmax'],.95)
        for tokens in [['h','eː','v','ɔ','l','t','ɑː','n'],['h','eː','f','ɔ','l','t','a','n'],['h','eː','f','ɔ','l','t','ɜ','n'],
            ['h','a','f','ɔ','l','t','ɑː','n'],['h','eː','d','f','ɔ','l','t','ɑː','n']]:
            with self.assertRaises(m.core.SafeError):m.native_frames(*self.matrices(tokens))
    def test_modified_full_logits_softmax_ids_inventory_and_decode_block(self):
        for kind in ['logits','softmax','ids','vocab','events','decode','dtype']:
            args=list(self.matrices())
            if kind=='logits':args[0][0,0,0]-=1
            elif kind=='softmax':args[1][0,0]-=.01
            elif kind=='ids':args[2][1]=0
            elif kind=='vocab':args[3].pop('unused0')
            elif kind=='events':args[4]['emitted_raw_tokens'].pop()
            elif kind=='decode':args[4]['native_decode']+=' f'
            else:args[0]=args[0].astype(np.float64)
            with self.assertRaises(m.core.SafeError):m.native_frames(*args)
    def test_current_exact_complete_root_review_required(self):
        template={'status':'root_review_required','reviewed_by':'','reason':'','id':m.FILLER_ID,'method':m.VERSION,
            'clip_sha256':'actual','source_text_sha256':'authored','source_row':self.line(m.FILLER_ID),'qc_record_sha256':'genuine'}
        approval=dict(copy.deepcopy(template),status=m.APPROVED,reviewed_by='root offline fixture',reason='Explicit individual full source evidence review.')
        with patch.object(m,'proof_template',return_value=template):
            self.assertIsNotNone(m.review(None,self.line(m.FILLER_ID),{},approval))
            for change in [{'status':'root_review_required'},{'reviewed_by':'worker'},{'reason':'ok'},
                    {'clip_sha256':'other'},{'source_row':self.line()},{'qc_record_sha256':'forged'}]:
                with self.assertRaises(m.core.SafeError):m.review(None,self.line(m.FILLER_ID),{},dict(approval,**change))
            with self.assertRaises(m.core.SafeError):m.review(None,self.line(m.FILLER_ID),{},dict(approval,extra=True))
        self.assertIsNone(m.review(None,self.line(m.FILLER_ID),{},None))
    def test_only_exact_original_generator_archive_may_resolve_historical_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            run=Path(directory);archive=run/'root-pre-textparts49/story_voice_generate.py';archive.parent.mkdir()
            archive.write_bytes(b'actual historical generator fixture bytes')
            recorded=str(Path(m.retake.generate.__file__).resolve());expected=m.digest(archive)
            plan={'source_file_bindings':[{'path':recorded,'sha256':expected}]}
            def path(value,external=False):
                p=Path(value);m.require(p.is_file(),'Missing original bytes.');return p
            result=m.original_execution_bindings(run,plan,path)
            self.assertTrue(result[0]['archive_only_not_new_forward']);self.assertEqual(result[0]['actual_verified_original_bytes_path'],str(archive))
            for binding in [{'path':str(Path(m.qa.__file__).resolve()),'sha256':expected},
                    {'path':recorded,'sha256':'other'},{'path':str(run/'missing.py'),'sha256':expected}]:
                with self.assertRaises(m.core.SafeError):m.original_execution_bindings(run,{'source_file_bindings':[binding]},path)


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
        self.allrows=self.rows+[{'id':'fixture-'+str(k),'text':'Hallo.','speaker':'azar'} for k in range(21)]
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
        self.save(self.child/'prepared.json',{'request_count':23,'input_bytes':len(payload),'input_sha256':m.core.digest(payload),
            'frozen_sha256':{n:m.digest(self.child/n) for n in ['lines.private.json','profiles.private.json','delivery-overrides.private.json','parent-snapshot.private.json']}})
        (self.child/'responses.private.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in self.raw))
        self.save(self.child/'collection.private.json',{'collected':23,'expected':23,'failures':[]})
        self.save(self.child/'job.json',{'state':'JOB_STATE_SUCCEEDED','model':m.core.MODEL,'request_count':23})
        self.save(self.child/'submit-intent.private.json',{'state':'CONFIRMED','model':m.core.MODEL,'input_sha256':m.core.digest(payload)})
        self.journal=self.child/'import.private.json';self.save(self.journal,{'state':'IMPORTED','selected_ids':self.ids,
            'original_scope_selected_ids':self.snapshot['selected_ids'],'parent_snapshot_sha256':m.digest(self.child/'parent-snapshot.private.json'),
            'new_mp3_sha256':{i:self.hashes[i] for i in self.ids}})
        self.signal={'silent':False,'seconds':3.,'peak':.4,'rms':.1,'clipped_fraction':0.,'leading_silence_seconds':.1,'trailing_silence_seconds':.1,'last_frame_rms':0.}
        def report(rows):return {'version':m.qa.VERSION,'model':m.qa.MODEL,'manifest_sha256':m.digest((self.child if len(rows)==23 else self.run)/'lines.private.json'),
            'checked_ids':[r['id'] for r in rows],'clip_sha256':{r['id']:self.hashes[r['id']] for r in rows},
            'takes':[{'id':r['id'],'text_sha256':m.qa.text_hash(r['text']),'signal':copy.deepcopy(self.signal),
                'transcript':' '.join(cases[r['id']]['primary_tokens']) if r['id'] in cases else 'Hallo.',
                'reasons':['asr_lexical_mismatch_requires_review']} for r in rows],'failures':[]}
        self.base=self.run/'new-current-parent-qa.json';self.save(self.base,report(self.rows))
        self.save(self.child/'qa-actual-primary-pass46.private.json',report(self.allrows))
        batch=self.child/'independent-vocal-qc/batches/child-qc-pass46';batch.mkdir(parents=True)
        qrequests=[];qraw=[];clips=[]
        for row in self.allrows:
            i=row['id'];text='Hey Voltan Die Kleine ist ungeduldig.' if i==m.ATTENTION_ID else row['text'];events=[m.FILLER_EVENT] if i==m.FILLER_ID else []
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
        self.save(batch/'prepared.json',{'bank':'independent-story-vocal-qc','model':m.qc.MODEL,'request_count':23,'input_bytes':len(qpayload),
            'input_sha256':m.core.digest(qpayload),'snapshot_sha256':m.digest(batch/'audio-snapshot.private.json')})
        self.save(batch/'submit-intent.private.json',{'state':'CONFIRMED','model':m.qc.MODEL,'request_count':23,'input_sha256':m.core.digest(qpayload)})
        self.save(batch/'job.json',{'state':'JOB_STATE_SUCCEEDED','model':m.qc.MODEL,'request_count':23,'job_name':'batches/synthetic'})
        self.save(batch/'collection.private.json',{'model':m.qc.MODEL,'collected':23,'expected':23,'failures':[]})
        for obj,name,new in [(m,'CASES',cases),(m,'FULL_COUNT',2),(m.qa,'PRIVATE',self.run),(m.common,'prepared',lambda run:None),
                (m.retake,'prepared',lambda *a,**k:None)]:
            p=patch.object(obj,name,new);p.start();self.addCleanup(p.stop)
    def bindings(self,ident=m.FILLER_ID):return {'qa_report_path':str(self.base),'child_import_journal_path':str(self.journal),
        'child_qc_record_path':str(self.child/'independent-vocal-qc'/(ident+'.'+self.hashes[ident][:16]+'.json'))}
    def proof(self):return m.proof_template(self.run,self.rows[1],self.bindings())
    def test_actual_import_child_identity_raw_request_and_parent_qa_bound(self):
        result=self.proof();self.assertEqual(result['source_run'],str(self.child));self.assertEqual(result['base_qa_sha256'],m.digest(self.base))
        self.assertEqual(result['actual_blind_child_QC']['actual_events'],[m.FILLER_EVENT]);self.assertIsNone(result['native_Meta_evidence'])
        self.assertEqual(result['status'],'root_review_required');self.assertEqual(result['reviewed_by'],'')
    def test_wrong_parent_audio_receipt_child_voice_and_incomplete_import_block(self):
        for p,fn in [(self.journal,lambda d:d.update(state='IMPORT_INTENT_RECORDED')),
                (self.journal,lambda d:d['new_mp3_sha256'].update({m.FILLER_ID:'other'})),
                (self.run/'raw'/(m.FILLER_ID+'.receipt.json'),lambda d:d.update(request_sha256='changed')),
                (self.child/'profiles.private.json',lambda d:d['speakers']['craupor'].update(google_voice='Other'))]:
            original=p.read_bytes();self.mutate(p,fn)
            with self.assertRaises(m.core.SafeError):self.proof()
            p.write_bytes(original)
        p=self.run/'clips'/(m.FILLER_ID+'.mp3');p.write_bytes(b'other')
        with self.assertRaises(m.core.SafeError):self.proof()
    def test_wrong_or_partial_current_qa_hash_body_and_signal_rejected(self):
        for fn in [lambda d:d['checked_ids'].pop(),lambda d:d['clip_sha256'].update({m.FILLER_ID:'stale'}),
                lambda d:d.update(manifest_sha256='stale'),lambda d:d['takes'][1].update(text_sha256='changed'),
                lambda d:d['takes'][1]['signal'].update(silent=True)]:
            original=self.base.read_bytes();self.mutate(self.base,fn)
            with self.assertRaises(m.core.SafeError):self.proof()
            self.base.write_bytes(original)
    def test_forged_qc_model_source_identity_response_and_provider_request_rejected(self):
        p=Path(self.bindings()['child_qc_record_path'])
        for fn in [lambda d:d.update(model='other'),lambda d:d.update(id=m.ATTENTION_ID),lambda d:d.update(source_text_sha256='other'),
                lambda d:d.update(prompt=m.qc.PROMPT+' Expected Foltan.'),lambda d:d.update(transcript='Invented.'),
                lambda d:d['response']['candidates'][0]['content']['parts'][0].update(text=json.dumps({'transcript':'Wrong words.','events':[m.FILLER_EVENT]}))]:
            original=p.read_bytes();self.mutate(p,fn)
            with self.assertRaises(m.core.SafeError):self.proof()
            p.write_bytes(original)
        raw=self.child/'independent-vocal-qc/batches/child-qc-pass46/responses.private.jsonl';raw.write_text(raw.read_text().replace('Foltan','Voltan'))
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
        self.assertTrue(set(journal['selected_ids'])<=m.IMPORT_IDS)
        self.assertNotIn(third,m.CASES)
        journal['selected_ids'].append('fixture-unapproved');journal['new_mp3_sha256']['fixture-unapproved']='unapproved'
        self.assertFalse(set(journal['selected_ids'])<=m.IMPORT_IDS)
        with self.assertRaises(m.core.SafeError):m.retake.journal_import_ids(journal,self.snapshot,journal['parent_snapshot_sha256'])


if __name__=='__main__':unittest.main()
