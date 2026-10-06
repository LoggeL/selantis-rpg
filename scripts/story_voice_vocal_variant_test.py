#!/usr/bin/env python3
"""Synthetic offline derivation, review binding and archive gates."""
import copy
import io
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import wave
import story_voice_vocal_variant as v

class VariantGates(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.parent=Path(self.tmp.name).resolve()
        for folder in ['raw','clips']:(self.parent/folder).mkdir()
        data=io.BytesIO()
        with wave.open(data,'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(b''.join(struct.pack('<h',int(6000*math.sin(i*2*math.pi*330/24000))) for i in range(48000)))
        self.rows=[{'id':ident,'text':text,'speaker':'azar','kind':'say','scene':'foltan-azar','mood':'surprised'} for ident,text in [(v.SOURCE,'AAAAAAAH!'),(v.TARGET,'Aaaaah!')]]
        v.core.save(self.parent/'prepared.json',{'model':v.MODEL});v.core.save(self.parent/'lines.private.json',{'model':v.MODEL,'lines':self.rows});v.core.save(self.parent/'profiles.private.json',{'speakers':{'azar':{'google_voice':'Charon'}}})
        (self.parent/'requests.jsonl').write_text(''.join(json.dumps({'key':r['id'],'request':{'generationConfig':{'speechConfig':{'voiceConfig':{'voice':'Charon'}}}}})+'\n' for r in self.rows))
        for row in self.rows:
            ident=row['id'];(self.parent/'raw'/(ident+'.wav')).write_bytes(data.getvalue());(self.parent/'clips'/(ident+'.mp3')).write_bytes(('original-'+ident).encode())
            v.core.save(self.parent/'raw'/(ident+'.receipt.json'),{'status':'complete','model':v.MODEL,'request_sha256':'a'*64,'wav_sha256':v.core.digest(data.getvalue()),'mp3_sha256':v.core.digest((self.parent/'clips'/(ident+'.mp3')).read_bytes())})
        source_sha=v.core.digest((self.parent/'clips'/(v.SOURCE+'.mp3')).read_bytes());target_sha=v.core.digest((self.parent/'clips'/(v.TARGET+'.mp3')).read_bytes())
        q=v.vocal.qa;qc=q.vocal_qc;event={'category':'scream','description':'One sharp scream.','vocal_sound':'ah','confidence':.95}
        response={'modelVersion':qc.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':'','events':[event]})}]}}]}
        record={'id':v.SOURCE,'clip_sha256':source_sha,'source_audio_sha256':source_sha,'upload_sha256':source_sha,'source_text_sha256':q.text_hash(self.rows[0]['text']),'input_mime_type':'audio/mpeg','model':qc.MODEL,'prompt':qc.PROMPT,'transcript':'','response':response,**qc.cache_metadata()}
        approval={'channel':'vocal-qc','status':'approved_vocal_events','reviewed_by':'root offline fixture','reason':'Reviewed single cry.','clip_sha256':source_sha,'text_sha256':q.text_hash(self.rows[0]['text']),'vocal_record_sha256':q.canonical_record_hash(record),'raw_response_sha256':q.canonical_record_hash(response),'transcript_sha256':q.text_hash(''),'expected_tokens':q.words(self.rows[0]['text']),'observed_tokens':[],**qc.cache_metadata(),'source_events':[{'source_token_index':0,'source_token':q.words(self.rows[0]['text'])[0],'category':'scream','event_indices':[0],'descriptions':[event['description']],'observed_token_indices':[],'reason':'Exact source gesture.'}]}
        report={'manifest_sha256':q.digest(self.parent/'lines.private.json'),'clip_sha256':{v.SOURCE:source_sha},'checked_ids':[v.SOURCE],'takes':[{'id':v.SOURCE,'text_sha256':q.text_hash(self.rows[0]['text']),'transcript':'','adjudication':{'resolution':'root_vocal'},'reasons':[]}],'failures':[]}
        v.core.save(self.parent/'qa.json',report);v.core.save(self.parent/'qc.json',{'records':[record]});v.core.save(self.parent/'adjudications.json',{v.SOURCE:approval})
        originals={r['key']:r for r in [json.loads(s) for s in (self.parent/'requests.jsonl').read_text().splitlines()]}
        for ident in [v.SOURCE,v.TARGET]:
            path=self.parent/'raw'/(ident+'.receipt.json');r=v.core.read_json(path);r['request_sha256']=v.core.digest(json.dumps(originals[ident]['request'],sort_keys=True).encode());v.core.save(path,r)
        v.core.save(self.parent/'approval.json',{'source_id':v.SOURCE,'target_id':v.TARGET,'source_mp3_sha256':source_sha,'target_mp3_sha256':target_sha,'approved':True})
        paths=[*v.retakes.SOURCE_FILES,'qa.json','qc.json','adjudications.json','approval.json',*[f'{folder}/{ident}{suffix}' for ident in [v.SOURCE,v.TARGET] for folder,suffix in [('raw','.wav'),('raw','.receipt.json'),('clips','.mp3')]]]
        self.plan={'source_id':v.SOURCE,'target_id':v.TARGET,'source_qa_file':'qa.json','source_qc_file':'qc.json','source_vocal_adjudications_file':'adjudications.json','root_approval_file':'approval.json','artifacts':{p:v.core.digest((self.parent/p).read_bytes()) for p in paths}}
        self.plan_path=self.parent/'plan.json';v.core.save(self.plan_path,self.plan)
        patcher=patch.object(v.common,'prepared');patcher.start();self.addCleanup(patcher.stop)
        noapi=patch.object(v.core,'api',side_effect=AssertionError('No API'));noapi.start();self.addCleanup(noapi.stop)

    def test_dry_validation_no_mutation_and_synthetic_apply_archives_truthful_provenance(self):
        originals={p:p.read_bytes() for p in self.parent.rglob('*') if p.is_file()}
        v.validate(self.parent,self.plan_path);self.assertEqual(originals,{p:p.read_bytes() for p in self.parent.rglob('*') if p.is_file()})
        with patch.object(v.retakes,'rebuild') as rebuild:r=v.apply(self.parent,self.plan_path);rebuild.assert_called_once()
        self.assertEqual(r['backend'],'derived_single_nonlexical_event');self.assertNotIn('request_sha256',r);self.assertEqual(r['source_tts_request_sha256'],json.loads(originals[self.parent/'raw'/(v.SOURCE+'.receipt.json')])['request_sha256']);self.assertTrue(r['qa_required']);self.assertIsNone(r['listening_verdict'])
        self.assertAlmostEqual(r['seconds'],2/1.12,delta=.1)
        for folder,suffix in [('raw','.wav'),('raw','.receipt.json'),('clips','.mp3')]:self.assertEqual((self.parent/folder/(v.SOURCE+suffix)).read_bytes(),originals[self.parent/folder/(v.SOURCE+suffix)])
        archive=next((self.parent/'rejected').iterdir());self.assertEqual((archive/(v.TARGET+'.mp3')).read_bytes(),originals[self.parent/'clips'/(v.TARGET+'.mp3')])
        with self.assertRaises(v.core.SafeError):v.apply(self.parent,self.plan_path)

    def test_stale_artifact_and_nonlexical_contract_fail_before_archive(self):
        path=self.parent/'clips'/(v.SOURCE+'.mp3');path.write_bytes(b'changed')
        with self.assertRaises(v.core.SafeError):v.validate(self.parent,self.plan_path)
        self.assertFalse((self.parent/'rejected').exists())

    def test_actual_model_schema_qa_rootapproval_and_request_provenance_guards(self):
        mutations=[('approval.json',lambda obj:obj.update(approved=False)),('qc.json',lambda obj:obj['records'][0]['response'].update(modelVersion='wrong-model')),('qc.json',lambda obj:obj['records'][0].update(schema_sha256='bad')),('qa.json',lambda obj:obj.update(manifest_sha256='stale')),('adjudications.json',lambda obj:obj[v.SOURCE].update(raw_response_sha256='bad')),('raw/'+v.SOURCE+'.receipt.json',lambda obj:obj.update(request_sha256='b'*64))]
        for file,modify in mutations:
            before=(self.parent/file).read_bytes();obj=json.loads(before);modify(obj);v.core.save(self.parent/file,obj)
            plan=copy.deepcopy(self.plan);plan['artifacts'][file]=v.core.digest((self.parent/file).read_bytes());v.core.save(self.plan_path,plan)
            with self.assertRaises((v.core.SafeError,ValueError)):v.validate(self.parent,self.plan_path)
            (self.parent/file).write_bytes(before)
        manifest=v.core.read_json(self.parent/'lines.private.json');manifest['lines'][0]['text']='Ha!';v.core.save(self.parent/'lines.private.json',manifest)
        plan=copy.deepcopy(self.plan);plan['artifacts']['lines.private.json']=v.core.digest((self.parent/'lines.private.json').read_bytes());v.core.save(self.plan_path,plan)
        with self.assertRaises(v.core.SafeError):v.validate(self.parent,self.plan_path)
        self.assertFalse((self.parent/'rejected').exists())

if __name__=='__main__':unittest.main()
