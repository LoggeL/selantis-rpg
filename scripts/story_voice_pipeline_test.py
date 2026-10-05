#!/usr/bin/env python3
"""Offline safety/interface gates. python3 scripts/story_voice_pipeline_test.py"""
import copy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_common as common
from story_voice_common import core

class StoryPipelineGates(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.home=Path(self.temp.name).resolve()
        self.patch=patch.object(common,'PRIVATE',self.home/'private');self.patch.start();self.addCleanup(self.patch.stop)
        common.configure()
        self.network=patch.object(core,'api',side_effect=AssertionError('Offline gates must never call an API'));self.network.start();self.addCleanup(self.network.stop)
        self.id='story-'+'0'*24
        source='scripts/story_voice_common.py'
        self.profiles={'speakers':{'lia':{'google_voice':'Kore','api_prompt_en':'Ignored long voice identity description.'}}}
        self.line={'id':self.id,'scene':'k1-wiese','chapter':'kapitel-1','speaker':'lia','text':'Hallo Lia.','display_text':'Hallo Lia.','kind':'say','direction_en':'Warm and slightly worried.','runtime_speakers':['k1-lia'],'sources':[]}
        self.manifest={'model':core.MODEL,'language':'de','source_hashes':{source:core.digest((common.ROOT/source).read_bytes())},'alias_map':{'k1-lia':'lia'},'lines':[self.line],'runtime_lookup':[{'asset_id':self.id,'kind':'say','speaker':'k1-lia','text':'Hallo Lia.'}]}
        core.save(self.home/'profiles.json',self.profiles);core.save(self.home/'lines.json',self.manifest)
        self.args=SimpleNamespace(profiles=str(self.home/'profiles.json'),manifest=str(self.home/'lines.json'),chapter='kapitel-1',speaker=None,only_ids=None,public_dir=None,qa_report=None,alignment_report=None,require_alignment=False)
        self.run=self.home/'run';self.run.mkdir()

    def test_frozen_prepare_short_style_and_hash_guard(self):
        common.prepare(self.args,self.run);common.prepared(self.run)
        request=json.loads((self.run/'requests.jsonl').read_text())['request']
        self.assertNotIn('responseFormat',request['generationConfig'])
        self.assertEqual(request['contents'][0]['parts'][0]['speechMetadata']['style'],self.line['direction_en'])
        self.assertNotIn('Ignored long voice',json.dumps(request))
        with (self.run/'requests.jsonl').open('a') as f:f.write(' ')
        with self.assertRaises(core.SafeError):common.prepared(self.run)

    def test_keep_prolog_and_long_or_unresolved_lines(self):
        for mutate in [lambda m:m['lines'][0].update(id='prolog-test'),lambda m:m['lines'][0].update(direction_en='x'*301),lambda m:m['lines'][0].update(text='{dynamic:unknown}'),lambda m:m['lines'][0].update(scene='prolog-rat')]:
            manifest=copy.deepcopy(self.manifest);mutate(manifest)
            with self.assertRaises(core.SafeError):common.validate(self.profiles,manifest)

    def test_ledger_prevents_cross_segment_duplicate_paid_ids(self):
        record={'key':self.id,'request':common.request_for(self.line,self.profiles['speakers'])}
        common.reserve(self.run,[record],'batch')
        with self.assertRaises(core.SafeError):common.reserve(self.home/'other',[record],'batch')
        with self.assertRaises(core.SafeError):common.reserve(self.run,[record],'standard')

    def test_public_qa_requires_current_hash_and_all_ids(self):
        (self.run/'clips').mkdir();mp3=self.run/'clips'/(self.id+'.mp3');mp3.write_bytes(b'offline fixture')
        clip={'id':self.id,'speaker':'lia','kind':'say','text':'Hallo Lia.','audio':'audio/prolog/'+self.id+'.mp3','seconds':1,'sha256':core.digest(mp3.read_bytes()),'runtime_keys':[{'kind':'say','speaker':'k1-lia','text':'Hallo Lia.'}]}
        proposal={'model':core.MODEL,'aliases':self.manifest['alias_map'],'clips':[clip]}
        core.save(self.run/'collection.private.json',{'failures':[]})
        self.args.public_dir=str(self.home/'public');self.args.qa_report=str(self.home/'qa.json')
        core.save(self.args.qa_report,{'status':'passed','checked_ids':[self.id],'clip_sha256':{self.id:clip['sha256']},'failures':[]})
        with patch.object(common,'PUBLIC',self.home/'public'):
            common.publish(self.run,self.args,proposal,self.manifest)
            public=core.read_json(self.home/'public/manifest.json');self.assertTrue(public['clips'][0]['audio'].startswith('audio/story/'))
            self.assertNotIn('api_prompt_en',json.dumps(public))
            mp3.write_bytes(b'tampered')
            with self.assertRaises(core.SafeError):common.publish(self.run,self.args,proposal,self.manifest)

    def test_alignment_word_or_hash_mismatch_blocks_export(self):
        (self.run/'clips').mkdir();mp3=self.run/'clips'/(self.id+'.mp3');mp3.write_bytes(b'fixture');h=core.digest(mp3.read_bytes())
        clip={'id':self.id,'speaker':'lia','kind':'say','text':'Hallo Lia.','audio':'','seconds':1,'sha256':h,'runtime_keys':common.frozen_runtime_keys(self.manifest,self.line)};proposal={'model':core.MODEL,'aliases':{},'clips':[clip]}
        core.save(self.run/'collection.private.json',{'failures':[]});self.args.public_dir=str(self.home/'public');self.args.qa_report=str(self.home/'qa.json');self.args.alignment_report=str(self.home/'alignment.json')
        core.save(self.args.qa_report,{'status':'passed','checked_ids':[self.id],'clip_sha256':{self.id:h},'failures':[]})
        core.save(self.args.alignment_report,{'clip_sha256':{self.id:h},'alignment_by_id':{self.id:{'words':[{'word':'Falsch','start':0,'end':.5}]}}})
        with patch.object(common,'PUBLIC',self.home/'public'):
            with self.assertRaises(core.SafeError):common.publish(self.run,self.args,proposal,self.manifest)

    def test_prepared_crosschecks_count_keys_and_request_content(self):
        common.prepare(self.args,self.run)
        info=core.read_json(self.run/'prepared.json');info['request_count']=2;core.save(self.run/'prepared.json',info)
        with self.assertRaises(core.SafeError):common.prepared(self.run)
        info['request_count']=1
        record=json.loads((self.run/'requests.jsonl').read_text());record['request']['generationConfig']['speechConfig']['voiceConfig']['voice']='WrongVoice'
        data=(json.dumps(record)+'\n').encode();(self.run/'requests.jsonl').write_bytes(data)
        info['input_sha256']=core.digest(data);info['input_bytes']=len(data);core.save(self.run/'prepared.json',info)
        with self.assertRaises(core.SafeError):common.prepared(self.run)

    def test_unresolved_inventory_blocks_prepare(self):
        self.manifest['unresolved']=[{'expression':'dynamic text'}]
        with self.assertRaises(core.SafeError):common.validate(self.profiles,self.manifest)

    def test_duplicate_nan_or_mutated_runtime_keys_block_proposal(self):
        clip={'id':self.id,'speaker':'lia','kind':'say','text':'Hallo Lia.','audio':'','seconds':1,'sha256':'0'*64,'runtime_keys':common.frozen_runtime_keys(self.manifest,self.line)}
        for clips in [[clip,copy.deepcopy(clip)],[{**clip,'seconds':float('nan')}],[{**clip,'runtime_keys':[{'kind':'say','speaker':'wrong','text':'Hallo Lia.'}]}]]:
            with self.assertRaises(core.SafeError):common.publish(self.run,self.args,{'model':core.MODEL,'aliases':{},'clips':clips},self.manifest)

    def test_unique_paid_intent_and_reconcile_adoption(self):
        common.prepare(self.args,self.run)
        intent=common.new_submit_intent(self.run)
        with self.assertRaises(core.SafeError):common.new_submit_intent(self.run)
        core.save(self.run/'job.json',{'state':'BATCH_CREATE_ATTEMPTED','input_file':'files/testinput'})
        op={'name':'batches/test','metadata':{'displayName':intent['display_name'],'model':'models/'+core.MODEL,'inputConfig':{'fileName':'files/testinput'},'batchStats':{'requestCount':'1'},'state':'BATCH_STATE_RUNNING'}}
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'api',side_effect=[{'operations':[op]},op]) as api:
            common.reconcile(self.args,self.run)
            self.assertEqual([c.args[0] for c in api.call_args_list],['GET','GET'])
        journal=core.read_json(self.run/'job.json');self.assertEqual(journal['job_name'],'batches/test');self.assertEqual(journal['state'],'JOB_STATE_RUNNING')

    def test_unknown_submit_reconcile_never_creates_or_resubmits(self):
        common.prepare(self.args,self.run);common.new_submit_intent(self.run)
        core.save(self.run/'job.json',{'state':'BATCH_CREATE_ATTEMPTED','input_file':'files/testinput'})
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'api',return_value={'operations':[]}) as api:
            with self.assertRaises(core.SafeError):common.reconcile(self.args,self.run)
            self.assertEqual(api.call_count,1);self.assertEqual(api.call_args.args[0],'GET')
        self.assertNotIn('job_name',core.read_json(self.run/'job.json'))
        with self.assertRaises(core.SafeError):common.new_submit_intent(self.run)

    def test_nested_inline_batch_bridge_and_complete_receipts(self):
        import io,wave,math,struct,base64
        common.prepare(self.args,self.run)
        core.save(self.run/'job.json',{'job_name':'batches/offline'})
        buffer=io.BytesIO()
        with wave.open(buffer,'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
            w.writeframes(b''.join(struct.pack('<h',int(math.sin(i*2*math.pi*220/24000)*5000)) for i in range(24000)))
        response={'candidates':[{'content':{'parts':[{'inlineData':{'mimeType':'audio/wav','data':base64.b64encode(buffer.getvalue()).decode()}}]}}]}
        op={'name':'batches/offline','metadata':{'state':'BATCH_STATE_SUCCEEDED'},'response':{'inlinedResponses':{'inlinedResponses':[{'metadata':{'key':self.id},'response':response}]}}}
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'api',return_value=op) as api:
            common.collect(self.args,self.run)
            self.assertEqual(api.call_count,1) # statusGET only; inline audio never downloads.
        receipt=core.read_json(self.run/'raw'/(self.id+'.receipt.json'))
        self.assertEqual(receipt['status'],'complete');self.assertEqual(receipt['backend'],'batch');self.assertEqual(len(receipt['request_sha256']),64)
        proposal=core.read_json(self.run/'public-manifest.proposed.json')
        self.assertEqual(proposal['clips'][0]['runtime_keys'],common.frozen_runtime_keys(self.manifest,self.line))
        self.assertTrue(proposal['clips'][0]['audio'].startswith('audio/story/'))

if __name__=='__main__':unittest.main()
