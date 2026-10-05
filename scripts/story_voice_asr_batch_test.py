#!/usr/bin/env python3
"""Offline independent ASR freeze, cache, model, merge and submit guards."""
import copy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_asr_batch as batch
from story_voice_asr_batch import core,asr

class IndependentASRBatchGates(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.source=Path(self.temp.name).resolve();(self.source/'clips').mkdir()
        self.ids=['story-'+str(i)*24 for i in [1,2,3]]
        self.rows={ident:{'id':ident,'text':'SECRET AUTHOR TEXT '+str(n)} for n,ident in enumerate(self.ids)}
        for n,ident in enumerate(self.ids):(self.source/'clips'/(ident+'.mp3')).write_bytes(b'offline MP3 fixture '+str(n).encode())
        core.save(self.source/'prepared.json',{'model':batch.TTS_MODEL})
        core.save(self.source/'lines.private.json',{'lines':list(self.rows.values())})
        self.folder,self.run=batch.locations(self.source,'fixture')
        self.args=SimpleNamespace(only_ids=','.join(self.ids[:2]),public_dir=None,key_stdin=False,keychain_service=None,keychain_account=None)
        self.source_patch=patch.object(batch,'source_rows',return_value=self.rows);self.source_patch.start();self.addCleanup(self.source_patch.stop)
        self.network=patch.object(core,'api',side_effect=AssertionError('Unexpected real API call'));self.network.start();self.addCleanup(self.network.stop)

    def response(self,text='Gehört, ohne Vorlage.',model=batch.MODEL):
        return {'modelVersion':model,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':text})}]}}]}

    def record(self,ident):
        _,sha,text_sha=batch.current_audio(self.source,self.rows[ident])
        return {'id':ident,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,'source_text_sha256':text_sha,'input_mime_type':'audio/mpeg','model':batch.MODEL,'prompt':asr.PROMPT,'transcript':'Gehört, ohne Vorlage.','response':self.response(),'listening_verdict':'keep human review'}

    def prepare(self):batch.prepare(self.args,self.source,self.folder,self.run,self.rows)

    def test_exact_prompt_payload_no_author_text_and_source_immutability(self):
        before={p:p.read_bytes() for p in (self.source/'clips').iterdir()};self.prepare();batch.prepared(self.run,self.source,self.rows)
        records=[json.loads(s) for s in (self.run/'requests.jsonl').read_text().splitlines()]
        self.assertEqual(len(records),2)
        for r in records:
            audio=(self.source/'clips'/(r['key']+'.mp3')).read_bytes();self.assertEqual(r['request'],asr.request_for(audio))
            self.assertNotIn('SECRET AUTHOR TEXT',json.dumps(r['request']))
        self.assertEqual(before,{p:p.read_bytes() for p in (self.source/'clips').iterdir()})

    def test_stale_audio_or_prompt_or_payload_rejected(self):
        self.prepare();path=self.source/'clips'/(self.ids[0]+'.mp3');original=path.read_bytes();path.write_bytes(b'changed')
        with self.assertRaises(core.SafeError):batch.prepared(self.run,self.source,self.rows)
        path.write_bytes(original)
        snapshot=core.read_json(self.run/'audio-snapshot.private.json');snapshot['prompt']='Different prompt';core.save(self.run/'audio-snapshot.private.json',snapshot)
        with self.assertRaises(core.SafeError):batch.prepared(self.run,self.source,self.rows)

    def test_current_cached_id_skipped_and_all_prior_cases_merged(self):
        old=self.record(self.ids[2]);core.save(batch.cache_path(self.folder,old['id'],old['clip_sha256']),old)
        cached=self.record(self.ids[0]);core.save(batch.cache_path(self.folder,cached['id'],cached['clip_sha256']),cached)
        self.prepare();self.assertEqual(core.read_json(self.run/'prepared.json')['request_count'],1)
        comparison=core.read_json(self.folder/'comparison.private.json');self.assertEqual({r['id'] for r in comparison['records']},{self.ids[0],self.ids[2]})

    def test_nested_inline_results_validated_and_existing_cases_preserved(self):
        old=self.record(self.ids[2]);core.save(batch.cache_path(self.folder,old['id'],old['clip_sha256']),old);self.prepare()
        result={'response':{'inlinedResponses':{'inlinedResponses':[{'metadata':{'key':i},'response':self.response()} for i in self.ids[:2]]}}}
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=(result,'JOB_STATE_SUCCEEDED')):
            self.assertEqual(batch.collect(self.args,self.source,self.folder,self.run,self.rows),0)
        records=core.read_json(self.folder/'comparison.private.json')['records'];self.assertEqual({r['id'] for r in records},set(self.ids))
        prior=next(r for r in records if r['id']==self.ids[2]);self.assertEqual(prior['listening_verdict'],'keep human review')

    def test_duplicate_missing_unexpected_or_wrong_model_results_rejected(self):
        self.prepare()
        cases=[[{'key':self.ids[0],'response':self.response()}]*2,[{'key':self.ids[0],'response':self.response()}],[{'key':self.ids[0],'response':self.response()},{'key':'unexpected','response':self.response()}]]
        for records in cases:
            with patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=({'response':{'inlinedResponses':records}},'JOB_STATE_SUCCEEDED')):
                with self.assertRaises(core.SafeError):batch.collect(self.args,self.source,self.folder,self.run,self.rows)
        records=[{'key':i,'response':self.response(model='another-model')} for i in self.ids[:2]]
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=({'response':{'inlinedResponses':records}},'JOB_STATE_SUCCEEDED')):
            self.assertEqual(batch.collect(self.args,self.source,self.folder,self.run,self.rows),1)
        self.assertFalse(list(self.folder.glob('story-*.json')))

    def test_unknown_submit_intent_before_network_never_retries(self):
        self.prepare()
        def failed_submit(args,run):
            self.assertTrue((run/'submit-intent.private.json').exists())
            self.assertEqual(core.MODEL,batch.MODEL)
            raise core.SafeError('Unknown transport outcome')
        before=core.MODEL
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'submit',side_effect=failed_submit) as submit:
            with self.assertRaises(core.SafeError):batch.submit(self.args,self.source,self.run,self.rows)
            with self.assertRaises(core.SafeError):batch.submit(self.args,self.source,self.run,self.rows)
            self.assertEqual(submit.call_count,1)
        self.assertEqual(core.MODEL,before)

    def test_audio_reservation_blocks_overlapping_second_asr_batch(self):
        self.prepare();batch.reserve(self.source,self.run)
        _,other=batch.locations(self.source,'other');args=copy.copy(self.args)
        batch.prepare(args,self.source,self.folder,other,self.rows)
        with self.assertRaises(core.SafeError):batch.reserve(self.source,other)

    def test_default_contract_and_namespace_isolation(self):
        self.prepare()
        original=(self.run/'requests.jsonl').read_bytes()
        self.assertEqual(core.read_json(self.run/'prepared.json')['bank'],'independent-story-asr')
        self.assertEqual(self.folder,self.source/'independent-google-asr')
        with patch.object(batch,'FOLDER_NAME','vocal-qc'),patch.object(batch,'BANK_NAME','vocal-qc-bank'),patch.object(batch,'DISPLAY_PREFIX','vocal-qc-'):
            folder,run=batch.locations(self.source,'fixture');batch.prepare(self.args,self.source,folder,run,self.rows)
            self.assertEqual((run/'requests.jsonl').read_bytes(),original)
            self.assertEqual(core.read_json(run/'prepared.json')['bank'],'vocal-qc-bank')
            with self.assertRaises(core.SafeError):batch.prepared(self.run,self.source,self.rows)
            batch.prepared(run,self.source,self.rows)
        batch.prepared(self.run,self.source,self.rows)
        self.assertEqual((self.run/'requests.jsonl').read_bytes(),original)

    def test_additional_cache_metadata_is_copied_without_provenance_override(self):
        self.prepare()
        result={'response':{'inlinedResponses':[{'key':i,'response':self.response()} for i in self.ids[:2]]}}
        metadata={'schema_sha256':'offline-schema','qc_contract_version':1}
        with patch.object(asr,'CACHE_METADATA',metadata,create=True),patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=(result,'JOB_STATE_SUCCEEDED')):
            self.assertEqual(batch.collect(self.args,self.source,self.folder,self.run,self.rows),0)
        records=core.read_json(self.folder/'comparison.private.json')['records']
        self.assertEqual(records[0]['schema_sha256'],'offline-schema');self.assertIsNone(records[0]['listening_verdict'])
        with patch.object(asr,'CACHE_METADATA',{'model':'fake'},create=True),patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=(result,'JOB_STATE_SUCCEEDED')):
            with self.assertRaises(core.SafeError):batch.collect(self.args,self.source,self.folder,self.run,self.rows)

if __name__=='__main__':unittest.main()
