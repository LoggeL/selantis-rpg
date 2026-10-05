#!/usr/bin/env python3
"""Offline vocal QC schema, audio binding, no-source payload and duplicate guards."""
import copy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_vocal_qc as qc
from story_voice_vocal_qc import core,transport

class VocalQCGates(unittest.TestCase):
    def response(self,observation=None,model=qc.MODEL,finish='STOP'):
        observation=observation or {'transcript':'Hallo.','events':[{'category':'groan','description':'A brief voiced sound.','vocal_sound':'','confidence':.6}]}
        return {'modelVersion':model,'candidates':[{'finishReason':finish,'content':{'parts':[{'text':json.dumps(observation)}]}}]}

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.source=Path(self.temp.name).resolve();(self.source/'clips').mkdir()
        self.id='story-'+'1'*24
        self.rows={self.id:{'id':self.id,'text':'HIDDEN EXPECTED AUTHOR TEXT AND EFFECT'}}
        (self.source/'clips'/(self.id+'.mp3')).write_bytes(b'offline actual audio fixture')
        core.save(self.source/'prepared.json',{'model':transport.TTS_MODEL});core.save(self.source/'lines.private.json',{'lines':list(self.rows.values())})
        self.args=SimpleNamespace(only_ids=self.id,public_dir=None,key_stdin=False,keychain_service=None,keychain_account=None)
        self.scope=qc.backend();self.scope.__enter__();self.addCleanup(lambda:self.scope.__exit__(None,None,None))
        self.folder,self.run=transport.locations(self.source,'qc-test')
        self.sources=patch.object(transport,'source_rows',return_value=self.rows);self.sources.start();self.addCleanup(self.sources.stop)
        self.network=patch.object(core,'api',side_effect=AssertionError('Offline test called API'));self.network.start();self.addCleanup(self.network.stop)

    def prepare(self):transport.prepare(self.args,self.source,self.folder,self.run,self.rows)

    def normal_args(self):
        args=copy.copy(self.args);args.max_calls=1;return args
    def test_normal_journal_before_http_exact_request_and_cache(self):
        args=self.normal_args()
        def fake_http(method,url,key,request):
            intent=core.read_json(self.run/(self.id+'.normal-intent.private.json'))
            self.assertEqual(intent['state'],'RECORDED_BEFORE_HTTP')
            self.assertFalse(intent['automatic_retry'])
            self.assertEqual(request,qc.request_for((self.source/'clips'/(self.id+'.mp3')).read_bytes()))
            self.assertNotIn(self.rows[self.id]['text'],json.dumps(request))
            self.assertEqual(method,'POST');self.assertIn(qc.MODEL+':generateContent',url)
            return self.response()
        with patch.object(core,'credential',return_value='offline fake credential'),patch.object(core,'api',side_effect=fake_http) as api:
            self.assertEqual(qc.normal_requests(args,self.source,self.folder,self.run,self.rows),0)
            self.assertEqual(qc.normal_requests(args,self.source,self.folder,self.run,self.rows),0)
            self.assertEqual(api.call_count,1)
        record=core.read_json(self.folder/'comparison.private.json')['records'][0]
        self.assertEqual(record['transport'],'normal');self.assertIsNone(record['listening_verdict'])
        self.assertEqual(core.read_json(self.run/(self.id+'.normal-intent.private.json'))['state'],'RESPONSE_VALIDATED')
        self.assertEqual(core.read_json(self.folder/'report.private.json')['status'],'root_review_required')
    def test_normal_unknown_outcome_never_retries(self):
        args=self.normal_args()
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'api',side_effect=core.SafeError('uncertain')) as api:
            with self.assertRaises(core.SafeError):qc.normal_requests(args,self.source,self.folder,self.run,self.rows)
            with self.assertRaises(core.SafeError):qc.normal_requests(args,self.source,self.folder,self.run,self.rows)
            self.assertEqual(api.call_count,1)
            self.assertTrue((self.run/(self.id+'.normal-intent.private.json')).exists())
    def test_normal_local_response_recovery_no_second_http(self):
        args=self.normal_args()
        original=core.save
        def fail_cache(path,data):
            if path.name.startswith(self.id) and path.parent==self.folder:raise OSError('offline simulated cache write failure')
            return original(path,data)
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'api',return_value=self.response()) as api,patch.object(core,'save',side_effect=fail_cache):
            with self.assertRaises(OSError):qc.normal_requests(args,self.source,self.folder,self.run,self.rows)
            self.assertEqual(api.call_count,1)
        with patch.object(core,'api',side_effect=AssertionError('recovery must be offline')):
            self.assertEqual(qc.normal_requests(args,self.source,self.folder,self.run,self.rows),0)
    def test_normal_bound_unknown_ids_and_duplicate_reject_before_network(self):
        for ids,limit in [('',1),(self.id+','+self.id,2),('story-'+'9'*24,1),(self.id,0),(self.id,17)]:
            args=self.normal_args();args.only_ids=ids;args.max_calls=limit
            with self.assertRaises(core.SafeError):qc.normal_requests(args,self.source,self.folder,self.run,self.rows)
    def test_normal_invalid_response_retained_no_paid_retry(self):
        args=self.normal_args()
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'api',return_value=self.response(finish='MAX_TOKENS')) as api:
            with self.assertRaises(core.SafeError):qc.normal_requests(args,self.source,self.folder,self.run,self.rows)
            with self.assertRaises(core.SafeError):qc.normal_requests(args,self.source,self.folder,self.run,self.rows)
            self.assertEqual(api.call_count,1)
        self.assertTrue((self.run/(self.id+'.normal-response.private.json')).exists())
    def test_normal_batch_reservation_blocks_duplicate_lane(self):
        self.prepare();transport.reserve(self.source,self.run)
        _,other=transport.locations(self.source,'normal-other')
        with self.assertRaises(core.SafeError):qc.normal_requests(self.normal_args(),self.source,self.folder,other,self.rows)
    def test_normal_scope_mutation_rejected(self):
        args=self.normal_args()
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'api',return_value=self.response()):
            qc.normal_requests(args,self.source,self.folder,self.run,self.rows)
        args.max_calls=2
        with self.assertRaises(core.SafeError):qc.normal_requests(args,self.source,self.folder,self.run,self.rows)
    def test_backend_restores_after_exception(self):
        old=transport.MODEL
        with self.assertRaises(RuntimeError):
            with qc.backend():raise RuntimeError('offline fixture')
        self.assertEqual(transport.MODEL,old)
    def test_no_authored_source_or_expected_effect_only_prompt_and_exact_mp3(self):
        before=(self.source/'clips'/(self.id+'.mp3')).read_bytes();self.prepare();transport.prepared(self.run,self.source,self.rows)
        request=json.loads((self.run/'requests.jsonl').read_text())['request']
        self.assertEqual(request,qc.request_for(before));self.assertNotIn(self.rows[self.id]['text'],json.dumps(request))
        self.assertNotIn('AAAAH',qc.PROMPT);self.assertEqual(request['contents'][0]['parts'][0]['text'],qc.PROMPT)
        self.assertNotIn('timestamps',json.dumps(qc.SCHEMA));self.assertEqual((self.source/'clips'/(self.id+'.mp3')).read_bytes(),before)
        self.assertEqual(core.read_json(self.run/'prepared.json')['bank'],'independent-story-vocal-qc')
        self.assertFalse((self.source/'independent-google-asr').exists())

    def test_stale_audio_source_prompt_or_request_rejected(self):
        self.prepare();p=self.source/'clips'/(self.id+'.mp3');raw=p.read_bytes();p.write_bytes(b'changed')
        with self.assertRaises(core.SafeError):transport.prepared(self.run,self.source,self.rows)
        p.write_bytes(raw)
        with patch.object(qc,'PROMPT',qc.PROMPT+' changed'),patch.object(transport.asr,'PROMPT',qc.PROMPT+' changed'):
            with self.assertRaises(core.SafeError):transport.prepared(self.run,self.source,self.rows)
        p=self.source/'lines.private.json';p.write_text('{}')
        with self.assertRaises(core.SafeError):transport.prepared(self.run,self.source,self.rows)

    def test_request_schema_mutation_and_rehashed_wrong_payload_rejected(self):
        request=qc.request_for(b'fixture');request['generationConfig']['responseSchema']['required'].append('wrong')
        self.assertEqual(qc.SCHEMA['required'],['transcript','events'])
        self.prepare();record=json.loads((self.run/'requests.jsonl').read_text())
        record['request']['generationConfig']['responseSchema']['required'].append('wrong')
        data=(json.dumps(record)+'\n').encode();(self.run/'requests.jsonl').write_bytes(data)
        info=core.read_json(self.run/'prepared.json');info.update(input_sha256=core.digest(data),input_bytes=len(data));core.save(self.run/'prepared.json',info)
        with self.assertRaises(core.SafeError):transport.prepared(self.run,self.source,self.rows)

    def test_model_stop_and_strict_response_schema_guards(self):
        valid=qc.response_observation(self.response());self.assertEqual(valid['events'][0]['category'],'groan')
        for response in [self.response(model='other'),self.response(finish='MAX_TOKENS')]:
            with self.assertRaises(core.SafeError):qc.response_observation(response)
        invalid=[]
        for field,value in [('category','guessed_intended_scream'),('confidence',float('nan')),('confidence',True),('confidence',1.1),('description','')]:
            observation=copy.deepcopy(valid);observation['events'][0][field]=value;invalid.append(observation)
        extra=copy.deepcopy(valid);extra['events'][0]['timestamp']=.4;invalid.append(extra)
        extra=copy.deepcopy(valid);extra['expected_text']='hidden';invalid.append(extra)
        for observation in invalid:
            with self.assertRaises((core.SafeError,ValueError)):qc.response_observation(self.response(observation))
        missing=self.response();missing['candidates'][0]['content']=None
        with self.assertRaises(core.SafeError):qc.response_observation(missing)
        wrong=self.response();wrong['candidates'].append(copy.deepcopy(wrong['candidates'][0]))
        with self.assertRaises(core.SafeError):qc.response_observation(wrong)

    def test_cache_audio_text_model_prompt_and_raw_response_are_bound(self):
        _,sha,textsha=transport.current_audio(self.source,self.rows[self.id])
        record={'id':self.id,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,'source_text_sha256':textsha,'model':qc.MODEL,'prompt':qc.PROMPT,'input_mime_type':'audio/mpeg','transcript':'Hallo.','response':self.response(),**qc.cache_metadata()}
        self.assertTrue(qc.cached_record(record,sha,textsha))
        for key,value in [('upload_sha256','bad'),('source_text_sha256','bad'),('model','other'),('prompt','other'),('transcript','different'),('schema_sha256','bad'),('prompt_sha256','bad'),('qc_contract_version',0)]:
            changed=copy.deepcopy(record);changed[key]=value;self.assertFalse(qc.cached_record(changed,sha,textsha))
        changed=copy.deepcopy(record);changed['response']['candidates'][0]['finishReason']='SAFETY';self.assertFalse(qc.cached_record(changed,sha,textsha))

    def test_unknown_duplicate_selection_and_late_cache_block_paid_request(self):
        for ids in ['',self.id+','+self.id,'story-'+'9'*24]:
            args=copy.copy(self.args);args.only_ids=ids
            with self.assertRaises(core.SafeError):transport.prepare(args,self.source,self.folder,self.run,self.rows)
        self.prepare();_,sha,textsha=transport.current_audio(self.source,self.rows[self.id])
        record={'id':self.id,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,
            'source_text_sha256':textsha,'model':qc.MODEL,'prompt':qc.PROMPT,'input_mime_type':'audio/mpeg',
            'transcript':'Hallo.','response':self.response(),**qc.cache_metadata()}
        core.save(transport.cache_path(self.folder,self.id,sha),record)
        with self.assertRaises(core.SafeError):transport.prepared(self.run,self.source,self.rows,reject_cached=True)

    def test_unknown_submit_is_never_retried_and_other_batch_reservation_blocks(self):
        self.prepare()
        def uncertain(args,run):
            self.assertTrue((run/'submit-intent.private.json').exists());raise core.SafeError('Unknown outcome')
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'submit',side_effect=uncertain) as submit:
            with self.assertRaises(core.SafeError):transport.submit(self.args,self.source,self.run,self.rows)
            with self.assertRaises(core.SafeError):transport.submit(self.args,self.source,self.run,self.rows)
            self.assertEqual(submit.call_count,1)
        _,other=transport.locations(self.source,'other');transport.prepare(self.args,self.source,self.folder,other,self.rows)
        with self.assertRaises(core.SafeError):transport.reserve(self.source,other)

    def test_nested_batch_collect_retains_raw_observations_never_approves(self):
        self.prepare();result={'response':{'inlinedResponses':{'inlinedResponses':[{'key':self.id,'response':self.response()}]}}}
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=(result,'JOB_STATE_SUCCEEDED')):
            self.assertEqual(transport.collect(self.args,self.source,self.folder,self.run,self.rows),0)
        record=core.read_json(self.folder/'comparison.private.json')['records'][0]
        self.assertIsNone(record['listening_verdict']);self.assertEqual(qc.response_observation(record['response'])['events'][0]['category'],'groan')
        self.assertEqual(record['prompt'],qc.PROMPT)

if __name__=='__main__':unittest.main()
