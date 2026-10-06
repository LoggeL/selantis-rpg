#!/usr/bin/env python3
"""Offline frozen Batch retake and full-parent merge tests. No TTS/API inference."""
import base64
import copy
import contextlib
import sys
import io
import json
import math
from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import wave
import story_voice_retake_batch as batch
from story_voice_retake_batch import core,common,standard

class RetakeBatchGates(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.parent=Path(self.temp.name).resolve();(self.parent/'raw').mkdir();(self.parent/'clips').mkdir()
        self.ids=['story-'+str(i)*24 for i in [1,2,3]]
        self.rows=[{'id':i,'scene':'k1-wiese','speaker':'lia','text':t,'display_text':t,'kind':'say','direction_en':'Warm.','runtime_speakers':['lia']} for i,t in zip(self.ids,['in seine Hand','Wer ist da?','Schon qualifiziert.'])]
        self.manifest={'model':batch.MODEL,'lines':self.rows,'alias_map':{'lia':'lia'},'scene_players':{'k1-wiese':'lia'},'runtime_lookup':[{'asset_id':r['id'],'kind':'say','speaker':'lia','text':r['text'],'scene':'k1-wiese','mood':'neutral'} for r in self.rows]}
        self.profiles={'speakers':{'lia':{'google_voice':'Kore'}}}
        self.records=[{'key':r['id'],'request':common.request_for(r,self.profiles['speakers'])} for r in self.rows]
        core.save(self.parent/'prepared.json',{'model':batch.MODEL});core.save(self.parent/'profiles.private.json',self.profiles);core.save(self.parent/'lines.private.json',self.manifest)
        (self.parent/'requests.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in self.records))
        self.wav=self.wave_bytes(220)
        for ident in self.ids:
            (self.parent/'raw'/(ident+'.wav')).write_bytes(self.wav)
            (self.parent/'clips'/(ident+'.mp3')).write_bytes(b'fixture parent '+ident.encode())
            core.save(self.parent/'raw'/(ident+'.receipt.json'),{'status':'complete','seconds':1,'wav_sha256':core.digest(self.wav),'mp3_sha256':core.digest((self.parent/'clips'/(ident+'.mp3')).read_bytes())})
        self.plan={self.ids[0]:{'delivery_style':'Warm, deliberate.','retake_text':'IN SEINE <short pause> HAND.'},self.ids[1]:{'delivery_style':'Afraid, questioning.'}}
        self.path=self.parent/'plan.json';core.save(self.path,self.plan)
        self.args=SimpleNamespace(only_ids=','.join(self.ids[:2]),delivery_overrides=str(self.path),batch_name='fixture',public_dir=None,import_audio=False)
        self.run=batch.locations(self.parent,self.args.batch_name)
        guard=patch.object(batch,'ORIGINAL_STORY_PREPARED');guard.start();self.addCleanup(guard.stop)
        api=patch.object(core,'api',side_effect=AssertionError('No actual API calls permitted'));api.start();self.addCleanup(api.stop)

    def wave_bytes(self,hz):
        buffer=io.BytesIO()
        with wave.open(buffer,'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
            w.writeframes(b''.join(struct.pack('<h',int(math.sin(i*2*math.pi*hz/24000)*5000)) for i in range(24000)))
        return buffer.getvalue()

    def prepare(self):batch.prepare(self.args,self.parent,self.run)

    def test_prepare_keeps_presets_source_and_full_parent_bank(self):
        before={f:(self.parent/f).read_bytes() for f in batch.SOURCE_FILES};old=[(self.parent/'clips'/(i+'.mp3')).read_bytes() for i in self.ids]
        self.prepare();batch.prepared(self.run,self.parent)
        snapshots=core.read_json(self.run/'parent-snapshot.private.json');self.assertEqual(len(snapshots['bank_mp3_sha256']),3)
        changed=[json.loads(s) for s in (self.run/'requests.jsonl').read_text().splitlines()]
        self.assertEqual(len(changed),2);self.assertEqual(changed[0]['request']['generationConfig']['speechConfig']['voiceConfig']['voice'],'Kore')
        self.assertEqual(changed[0]['request']['contents'][0]['parts'][0]['text'],'IN SEINE <short pause> HAND.')
        self.assertEqual(before,{f:(self.parent/f).read_bytes() for f in batch.SOURCE_FILES});self.assertEqual(old,[(self.parent/'clips'/(i+'.mp3')).read_bytes() for i in self.ids])

    def test_changed_audio_source_or_style_blocks_frozen_transport(self):
        self.prepare();p=self.parent/'clips'/(self.ids[2]+'.mp3');old=p.read_bytes();p.write_bytes(b'changed nonselected bank')
        with self.assertRaises(core.SafeError):batch.prepared(self.run,self.parent)
        p.write_bytes(old)
        frozen=self.parent/'requests.jsonl';source=frozen.read_bytes();frozen.write_bytes(source+b' ')
        with self.assertRaises(core.SafeError):batch.prepared(self.run,self.parent)
        frozen.write_bytes(source)
        core.save(self.run/'delivery-overrides.private.json',{self.ids[0]:{'delivery_style':'different'}})
        with self.assertRaises(core.SafeError):batch.prepared(self.run,self.parent)

    def test_illegal_text_scope_missing_bank_or_duplicate_intent(self):
        self.plan[self.ids[0]]['retake_text']='in seiner Hand';core.save(self.path,self.plan)
        with self.assertRaises(core.SafeError):self.prepare()
        self.plan[self.ids[0]]['retake_text']='in seine Hand';core.save(self.path,self.plan);self.prepare()
        core.save(self.run/'submit-intent.private.json',{'state':'UNKNOWN'})
        with patch.object(core,'credential',side_effect=AssertionError('No key read')):
            with self.assertRaises(core.SafeError):batch.submit(self.args,self.parent,self.run)

    def test_reservation_prevents_duplicate_current_audio_and_modified_request(self):
        self.prepare();batch.reserve(self.parent,self.run)
        other=batch.locations(self.parent,'other');batch.prepare(self.args,self.parent,other)
        with self.assertRaises(core.SafeError):batch.reserve(self.parent,other)

    def test_unknown_submit_journal_before_network_never_retries(self):
        self.prepare()
        def fail(a,r):
            self.assertTrue((r/'submit-intent.private.json').exists());self.assertEqual(core.MODEL,batch.MODEL)
            raise core.SafeError('Unknown outcome')
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'submit',side_effect=fail) as submit:
            with self.assertRaises(core.SafeError):batch.submit(self.args,self.parent,self.run)
            with self.assertRaises(core.SafeError):batch.submit(self.args,self.parent,self.run)
            self.assertEqual(submit.call_count,1)

    def test_collect_normalizes_privately_then_archives_and_merges_parent_once(self):
        self.prepare();source_before={f:(self.parent/f).read_bytes() for f in batch.SOURCE_FILES};untouched=(self.parent/'clips'/(self.ids[2]+'.mp3')).read_bytes()
        core.save(self.run/'job.json',{'job_name':'batches/offline'})
        data=self.wave_bytes(330);body={'modelVersion':batch.MODEL,'usageMetadata':{'candidatesTokenCount':25},'candidates':[{'content':{'parts':[{'inlineData':{'mimeType':'audio/wav','data':base64.b64encode(data).decode()}}]}}]}
        result={'metadata':{'state':'BATCH_STATE_SUCCEEDED'},'response':{'inlinedResponses':{'inlinedResponses':[{'metadata':{'key':i},'response':body} for i in self.ids[:2]]}}}
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=(result,'JOB_STATE_SUCCEEDED')):
            self.assertEqual(batch.collect(self.args,self.parent,self.run),0)
        self.assertFalse((self.parent/'rejected').exists())
        new=core.read_json(self.run/'raw'/(self.ids[0]+'.receipt.json'));self.assertEqual(new['status'],'complete');self.assertEqual(new['usage']['candidatesTokenCount'],25)
        self.assertEqual(new['delivery_override']['type'],'brief_delivery')
        self.assertEqual(batch.import_audio(self.args,self.parent,self.run),0)
        proposal=core.read_json(self.parent/'public-manifest.proposed.json');self.assertEqual(len(proposal['clips']),3)
        self.assertEqual((self.parent/'clips'/(self.ids[2]+'.mp3')).read_bytes(),untouched)
        self.assertEqual(source_before,{f:(self.parent/f).read_bytes() for f in batch.SOURCE_FILES})
        archives=list((self.parent/'rejected').iterdir());self.assertEqual(len(archives),1)
        self.assertEqual(batch.import_audio(self.args,self.parent,self.run),0);self.assertEqual(len(list((self.parent/'rejected').iterdir())),1)
        self.assertEqual(len(core.read_json(self.parent/'public-manifest.proposed.json')['clips']),3)

    def disjoint_fixture(self):
        runs=[]
        for n,ident in enumerate(self.ids[:2]):
            plan=self.parent/('plan-'+str(n)+'.json');core.save(plan,{ident:self.plan[ident]})
            args=SimpleNamespace(only_ids=ident,delivery_overrides=str(plan),batch_name='split'+str(n),public_dir=None,import_audio=False,allow_completed_disjoint_retakes=False)
            run=batch.locations(self.parent,args.batch_name);batch.prepare(args,self.parent,run)
            core.save(run/'job.json',{'job_name':'batches/offline'})
            body={'modelVersion':batch.MODEL,'candidates':[{'content':{'parts':[{'inlineData':{'mimeType':'audio/wav','data':base64.b64encode(self.wave_bytes(330+n*80)).decode()}}]}}]}
            result={'metadata':{'state':'BATCH_STATE_SUCCEEDED'},'response':{'inlinedResponses':{'inlinedResponses':[{'metadata':{'key':ident},'response':body}]}}}
            with patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=(result,'JOB_STATE_SUCCEEDED')):batch.collect(args,self.parent,run)
            runs.append((args,run))
        batch.import_audio(*[runs[0][0],self.parent,runs[0][1]])
        return runs

    def test_completed_disjoint_import_explicit_and_preserves_both(self):
        runs=self.disjoint_fixture();args,run=runs[1]
        first=(self.parent/'clips'/(self.ids[0]+'.mp3')).read_bytes()
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)
        args.allow_completed_disjoint_retakes=True
        batch.import_audio(args,self.parent,run)
        self.assertEqual(first,(self.parent/'clips'/(self.ids[0]+'.mp3')).read_bytes())
        self.assertEqual(len(core.read_json(self.parent/'public-manifest.proposed.json')['clips']),3)
        self.assertEqual(len(core.read_json(run/'import.private.json')['validated_disjoint_import_journal_sha256']),1)

    def test_disjoint_forged_journal_and_unexplained_audio_rejected(self):
        runs=self.disjoint_fixture();args,run=runs[1];args.allow_completed_disjoint_retakes=True
        journal_path=runs[0][1]/'import.private.json';journal=core.read_json(journal_path)
        bad=copy.deepcopy(journal);bad['new_mp3_sha256'][self.ids[0]]='forged';core.save(journal_path,bad)
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)
        bad=copy.deepcopy(journal);bad['state']='ORIGINALS_ARCHIVED';core.save(journal_path,bad)
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)
        core.save(journal_path,journal)
        p=self.parent/'clips'/(self.ids[2]+'.mp3');p.write_bytes(b'unexplained')
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)

    def test_selected_changes_and_overlapping_completed_import_rejected(self):
        runs=self.disjoint_fixture();args,run=runs[1];args.allow_completed_disjoint_retakes=True
        p=self.parent/'clips'/(self.ids[1]+'.mp3');old=p.read_bytes();p.write_bytes(b'selected changed')
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)
        p.write_bytes(old)
        snapshot_path=runs[0][1]/'parent-snapshot.private.json';snapshot=core.read_json(snapshot_path)
        snapshot['selected_ids'].append(self.ids[1]);core.save(snapshot_path,snapshot)
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)

    def test_readonly_status_allows_audio_drift_but_keeps_frozen_contract(self):
        self.prepare();core.save(self.run/'job.json',{'job_name':'batches/offline'})
        (self.parent/'clips'/(self.ids[2]+'.mp3')).write_bytes(b'new unrelated audio')
        def invoke(command):
            argv=['story_voice_retake_batch.py',command,'--run-dir',str(self.parent),'--batch-name',self.args.batch_name]
            with patch.object(sys,'argv',argv),patch.object(common,'configure'),patch.object(common,'run_lock'),patch.object(core,'directory',side_effect=lambda p:Path(p).resolve()),contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):return batch.main()
        def readonly(method,url,key,*args,**kwargs):
            self.assertEqual(method,'GET');self.assertTrue(url.endswith('/batches/offline'))
            return {'metadata':{'state':'BATCH_STATE_RUNNING'},'done':False}
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'api',side_effect=readonly) as api:
            self.assertEqual(invoke('status'),0);self.assertEqual(api.call_count,1)
            for command in ['submit','collect','import']:
                self.assertEqual(invoke(command),1)
            self.assertEqual(api.call_count,1)
            original=self.parent/'requests.jsonl';data=original.read_bytes();original.write_bytes(data+b' ')
            self.assertEqual(invoke('status'),1);self.assertEqual(api.call_count,1)
            original.write_bytes(data)
            payload=self.run/'requests.jsonl';payload.write_bytes(payload.read_bytes()+b' ')
            self.assertEqual(invoke('status'),1);self.assertEqual(api.call_count,1)

    def test_superseded_historical_overlap_cannot_block_current_disjoint_proof(self):
        # Historical job spans both IDs, but neither affected output remains
        # authoritative after a later disjoint import. Its frozen input is valid.
        self.prepare()
        snapshot=core.read_json(self.run/'parent-snapshot.private.json')
        core.save(self.run/'import.private.json',{'state':'IMPORTED','selected_ids':self.ids[:2],
                  'new_mp3_sha256':{i:snapshot['bank_mp3_sha256'][i] for i in self.ids[:2]}})
        runs=self.disjoint_fixture();args,target=runs[1];args.allow_completed_disjoint_retakes=True
        self.assertEqual(batch.import_audio(args,self.parent,target),0)
        validated=core.read_json(target/'import.private.json')['validated_disjoint_import_journal_sha256']
        self.assertEqual(set(validated),{str(runs[0][1]/'import.private.json')})
        self.assertEqual(len(core.read_json(self.parent/'public-manifest.proposed.json')['clips']),3)

    def test_current_matching_proof_with_unverified_multihop_ancestry_rejected(self):
        runs=self.disjoint_fixture();args,target=runs[1];args.allow_completed_disjoint_retakes=True
        other=runs[0][1];p=other/'parent-snapshot.private.json';snapshot=core.read_json(p)
        snapshot['bank_mp3_sha256'][self.ids[0]]='a'*64;core.save(p,snapshot)
        info=core.read_json(other/'prepared.json');info['frozen_sha256']['parent-snapshot.private.json']=core.digest(p.read_bytes());core.save(other/'prepared.json',info)
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,target)

    def collected_three(self,name='three'):
        plan=self.parent/('plan-'+name+'.json');core.save(plan,{i:{'delivery_style':'Clear, emotional.'} for i in self.ids})
        args=SimpleNamespace(only_ids=','.join(self.ids),delivery_overrides=str(plan),batch_name=name,public_dir=None,import_audio=False,allow_completed_disjoint_retakes=False,import_only_ids=None)
        run=batch.locations(self.parent,name);batch.prepare(args,self.parent,run);core.save(run/'job.json',{'job_name':'batches/offline'})
        body={'modelVersion':batch.MODEL,'candidates':[{'content':{'parts':[{'inlineData':{'mimeType':'audio/wav','data':base64.b64encode(self.wave_bytes(350)).decode()}}]}}]}
        result={'response':{'inlinedResponses':[{'key':i,'response':body} for i in self.ids]}}
        with patch.object(core,'credential',return_value='offline'),patch.object(core,'fetch_status',return_value=(result,'JOB_STATE_SUCCEEDED')):batch.collect(args,self.parent,run)
        return args,run

    def test_three_collected_one_imported_once_preserves_other_private_takes_and_scope(self):
        before={i:(self.parent/'clips'/(i+'.mp3')).read_bytes() for i in self.ids};args,run=self.collected_three();frozen=(run/'requests.jsonl').read_bytes()
        args.import_only_ids=self.ids[0];self.assertEqual(batch.import_audio(args,self.parent,run),0)
        journal=core.read_json(run/'import.private.json');self.assertEqual(journal['selected_ids'],self.ids[:1]);self.assertEqual(journal['original_scope_selected_ids'],self.ids)
        self.assertEqual((run/'requests.jsonl').read_bytes(),frozen);self.assertEqual(core.read_json(run/'collection.private.json')['collected'],3)
        for ident in self.ids[1:]:self.assertEqual((self.parent/'clips'/(ident+'.mp3')).read_bytes(),before[ident]);self.assertTrue((run/'clips'/(ident+'.mp3')).exists())
        self.assertEqual(len(core.read_json(self.parent/'public-manifest.proposed.json')['clips']),3)
        archives=list((self.parent/'rejected').iterdir());self.assertEqual(len(archives),1);self.assertEqual(len(list(archives[0].iterdir())),3)
        self.assertEqual(batch.import_audio(args,self.parent,run),0);self.assertEqual(len(list((self.parent/'rejected').iterdir())),1)
        args.import_only_ids=self.ids[1]
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)
        args.import_only_ids=None
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)

    def test_invalid_subset_or_tampered_scope_never_archives(self):
        args,run=self.collected_three()
        for value in ['',self.ids[0]+','+self.ids[0],'story-'+'f'*24]:
            args.import_only_ids=value
            with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)
        self.assertFalse((self.parent/'rejected').exists())
        args.import_only_ids=self.ids[0];batch.import_audio(args,self.parent,run)
        path=run/'import.private.json';journal=core.read_json(path);journal['original_scope_selected_ids']=self.ids[:1];core.save(path,journal)
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)

    def test_disjoint_import_uses_actual_subset_not_unimported_original_scope(self):
        first,run1=self.collected_three('subset-one');second,run2=self.collected_three('subset-two')
        first.import_only_ids=self.ids[0];batch.import_audio(first,self.parent,run1)
        second.import_only_ids=self.ids[1];second.allow_completed_disjoint_retakes=True
        self.assertEqual(batch.import_audio(second,self.parent,run2),0)
        journals=core.read_json(run2/'import.private.json')['validated_disjoint_import_journal_sha256'];self.assertEqual(len(journals),1)
        self.assertEqual(core.read_json(run1/'import.private.json')['selected_ids'],self.ids[:1]);self.assertEqual(core.read_json(run2/'import.private.json')['selected_ids'],self.ids[1:2])
        path=run1/'import.private.json';journal=core.read_json(path);journal['selected_ids'].append(self.ids[0]);core.save(path,journal)
        with self.assertRaises(core.SafeError):batch.validated_disjoint_imports(run2,self.parent,core.read_json(run2/'parent-snapshot.private.json'),batch.bank(self.parent,{i:None for i in self.ids})[0],self.ids[2:])

    def test_subset_repeat_rejects_changed_wav_or_receipt_and_legacy_subset_unbound(self):
        args,run=self.collected_three();args.import_only_ids=self.ids[0];batch.import_audio(args,self.parent,run)
        wav=self.parent/'raw'/(self.ids[0]+'.wav');old=wav.read_bytes();wav.write_bytes(b'changed')
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)
        wav.write_bytes(old)
        journal=core.read_json(run/'import.private.json');journal.pop('original_scope_selected_ids');journal.pop('parent_snapshot_sha256');core.save(run/'import.private.json',journal)
        with self.assertRaises(core.SafeError):batch.import_audio(args,self.parent,run)

if __name__=='__main__':unittest.main()
