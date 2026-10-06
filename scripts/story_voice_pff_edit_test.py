#!/usr/bin/env python3
"""Offline private-copy proof tests; never modify the actual production run."""
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import story_voice_pff_edit as p

PRODUCTION=Path(__file__).resolve().parents[1]/'output/audio/story-voice/2026-10-05-all-chapters'
@unittest.skipUnless((PRODUCTION/p.FOLDER/'actual-transform.private.json').exists(),'Requires the immutable private Pff pilot; no audio fixtures committed.')
class PffGates(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.run=Path(self.tmp.name).resolve()
  # Only fixed immutable pilot assets; credentials/inference are never used.
  evidence=p.validate_candidate(PRODUCTION)
  for name in evidence['provenance_files_sha256']:
   target=self.run/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(PRODUCTION/name,target)
  transform_path=self.run/p.FOLDER/'transform-plan.private.json';transform=p.core.read_json(transform_path)
  for role in ['body','puff']:transform[role+'_source_mp3']=str(self.run/Path(transform[role+'_source_mp3']).relative_to(PRODUCTION))
  p.qa.save(transform_path,transform);actual=p.core.read_json(self.run/p.FOLDER/'actual-transform.private.json');actual['plan_sha256']=p.qa.digest(transform_path);p.qa.save(self.run/p.FOLDER/'actual-transform.private.json',actual)
  for i in p.core.read_json(self.run/'lines.private.json')['lines']:
   # Minimal offline complete bank fixtures, distinct from the target candidate.
   audio=self.run/'clips'/(i['id']+'.mp3');audio.parent.mkdir(exist_ok=True);audio.write_bytes(('parent-'+i['id']).encode())
  (self.run/'raw').mkdir(exist_ok=True)
  for suffix in ['.wav','.receipt.json']:(self.run/'raw'/(p.ID+suffix)).write_bytes(b'prior')
  p.qa.save(self.run/'collection.private.json',{'expected':1557,'collected':1557,'failures':[]})
  for target in [p.common,p.retake]:
   name='prepared';mock=patch.object(target,name,return_value={});mock.start();self.addCleanup(mock.stop)
  mock=patch.object(p.core,'api',side_effect=AssertionError('No API'));mock.start();self.addCleanup(mock.stop)
 def approval(self):
  a=p.template(self.run);a.update(status=p.APPROVED,reviewed_by='root offline',reason='Reviewed exact original three words and isolated terminal puff.');return a
 def test_actual_complete_candidate_and_unapproved_plan(self):
  plan=p.template(self.run);self.assertEqual(plan['candidate']['google_voice'],'Zubenelgenubi');self.assertEqual(plan['status'],'root_review_required')
  with self.assertRaises(p.core.SafeError):p.root_review(plan,plan)
  p.root_review(plan,self.approval())
 def test_stale_audio_source_cast_filter_and_range(self):
  files=[self.run/p.FOLDER/'transform-plan.private.json',self.run/'profiles.private.json',self.run/'lines.private.json']
  mutations=[(files[0],'filter','anull'),(files[0],'puff_samples',[120481,140400]),(files[0],'sample_rate',16000)]
  for file,key,val in mutations:
   old=file.read_bytes();v=p.core.read_json(file);v[key]=val;p.qa.save(file,v)
   with self.assertRaises(p.core.SafeError):p.validate_candidate(self.run)
   file.write_bytes(old)
  old=files[1].read_bytes();v=p.core.read_json(files[1]);v['speakers']['azar']['google_voice']='Other';p.qa.save(files[1],v)
  with self.assertRaises(p.core.SafeError):p.validate_candidate(self.run)
  files[1].write_bytes(old)
  audio=self.run/p.FOLDER/'clips'/(p.ID+'.mp3');audio.write_bytes(b'changed')
  with self.assertRaises(p.core.SafeError):p.validate_candidate(self.run)
 def test_body_event_vowel_model_provider_and_hash_failures(self):
  f=self.run/p.FOLDER/'qc-raw.private.json';old=f.read_bytes();raw=p.core.read_json(f);obs=p.qc.response_observation(raw['response'])
  for text,events in [('Gleich Klack.',obs['events']),('Gleich Gleich Klack Zusatz',obs['events']),('Gleich Gleich Klack',obs['events']*2),('Gleich Gleich Klack',[{**obs['events'][0],'vocal_sound':'puh'}])]:
   r=copy.deepcopy(raw);r['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':text,'events':events});p.qa.save(f,r)
   with self.assertRaises(p.core.SafeError):p.validate_candidate(self.run)
  f.write_bytes(old);r=copy.deepcopy(raw);r['response']['modelVersion']='other';p.qa.save(f,r)
  with self.assertRaises(p.core.SafeError):p.validate_candidate(self.run)
 def test_explicit_apply_archives_parent_and_partial_journal_refused(self):
  a=self.approval();approval=self.run/'root.json';p.qa.save(approval,a)
  with patch.object(p.retake,'rebuild',return_value=None):receipt=p.apply(self.run,approval)
  self.assertEqual(receipt['backend'],p.BACKEND);self.assertNotIn('request_sha256',receipt)
  row=next(r for r in p.core.read_json(self.run/'lines.private.json')['lines'] if r['id']==p.ID);p.validate_imported(self.run,row,receipt)
  journal=p.core.read_json(self.run/p.FOLDER/'import.private.json');archive=Path(journal['archive']);self.assertEqual(len(list(archive.iterdir())),4)
  with self.assertRaises(p.core.SafeError):p.apply(self.run,approval)
  journal['state']='IMPORT_INTENT_RECORDED';p.qa.save(self.run/p.FOLDER/'import.private.json',journal)
  with self.assertRaises(p.core.SafeError):p.validate_imported(self.run,row,receipt)
 def test_expressive_only_after_actual_import_and_full_physical_qa(self):
  import story_voice_expressive_events as expressive
  a=self.approval();approval=self.run/'root.json';p.qa.save(approval,a)
  with patch.object(p.retake,'rebuild',return_value=None):receipt=p.apply(self.run,approval)
  row=next(r for r in p.core.read_json(self.run/'lines.private.json')['lines'] if r['id']==p.ID);sha=p.qa.digest(self.run/'clips'/(p.ID+'.mp3'))
  signal={'silent':False,'seconds':4.14,'clipped_fraction':0.,'peak':.4,'trailing_silence_seconds':.1,'leading_silence_seconds':.1,'last_frame_rms':0.,'rms':.1};report=self.run/'qa.json'
  p.qa.save(report,{'version':p.qa.VERSION,'model':p.qa.MODEL,'manifest_sha256':p.qa.digest(self.run/'lines.private.json'),'clip_sha256':{p.ID:sha},'takes':[{'id':p.ID,'text_sha256':p.qa.text_hash(p.TEXT),'signal':signal,'reasons':['asr_lexical_mismatch_requires_review']}]})
  raw=p.core.read_json(self.run/p.FOLDER/'qc-raw.private.json');template=expressive.template(self.run,row,report,raw);self.assertIsNone(expressive.review(self.run,row,report,raw))
  template.update(status=expressive.APPROVED,reviewed_by='root offline',reason='Actual scoped single pff with every body word.');self.assertTrue(expressive.review(self.run,row,report,raw,template))
  bad=copy.deepcopy(raw);bad['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':'Gleich Klack','events':p.qc.response_observation(raw['response'])['events']})
  with self.assertRaises(p.core.SafeError):expressive.template(self.run,row,report,bad)
 def test_source_model_and_origin_cast_do_not_relax(self):
  manifest=self.run/'lines.private.json';old=manifest.read_bytes();body=p.core.read_json(manifest);next(r for r in body['lines'] if r['id']==p.ID)['text']='Gleich klack Pfff.';p.qa.save(manifest,body)
  with self.assertRaises(p.core.SafeError):p.validate_candidate(self.run)
  manifest.write_bytes(old)
  receipt=self.run/'retake-batches/native-pff-pass11/raw'/(p.ID+'.receipt.json');old=receipt.read_bytes();body=p.core.read_json(receipt);body['model']='other';p.qa.save(receipt,body)
  with self.assertRaises(p.core.SafeError):p.validate_candidate(self.run)
  receipt.write_bytes(old)
  snapshot=self.run/'retake-batches/native-pff-pass11/parent-snapshot.private.json';body=p.core.read_json(snapshot);body['fixed_google_voices'][p.ID]='Other';p.qa.save(snapshot,body)
  with self.assertRaises(p.core.SafeError):p.validate_candidate(self.run)
 def test_root_parent_bank_and_receipt_provenance_bound(self):
  a=self.approval();a['reviewed_by']='worker'
  with self.assertRaises(p.core.SafeError):p.root_review(p.template(self.run),a)
  a=self.approval();(self.run/'clips'/(p.ID+'.mp3')).write_bytes(b'bank-changed')
  with self.assertRaises(p.core.SafeError):p.root_review(p.template(self.run),a)
if __name__=='__main__':unittest.main()
