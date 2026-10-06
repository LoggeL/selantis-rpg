#!/usr/bin/env python3
"""Offline exact-source, raw-provider and explicit-root gesture gate tests."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import story_voice_expressive_events as e

class Gates(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.run=Path(self.tmp.name).resolve()
  self.rows={i:{'id':i,'text':c['text'],'speaker':c['speaker'],'sources':[{'file':c['location'][0],'line':c['location'][1]}]} for i,c in e.CASES.items()}
  for folder in ['clips','raw','independent-vocal-qc/batches/fixture']:(self.run/folder).mkdir(parents=True)
  e.qa.save(self.run/'lines.private.json',{'lines':list(self.rows.values())});e.qa.save(self.run/'prepared.json',{'model':e.core.MODEL})
  p=patch.object(e.common,'prepared',return_value={});p.start();self.addCleanup(p.stop)
  p=patch.object(e.core,'api',side_effect=AssertionError('No API'));p.start();self.addCleanup(p.stop)
  self.records={};hashes={};takes=[];requests=[];entries=[];raw=[]
  signal={'silent':False,'seconds':3.,'clipped_fraction':0.,'peak':.4,'trailing_silence_seconds':.1,'leading_silence_seconds':.1,'last_frame_rms':0.,'rms':.1}
  for i,l in self.rows.items():
   c=e.CASES[i];data=('fixture-'+i).encode();(self.run/'clips'/(i+'.mp3')).write_bytes(data);sha=e.core.digest(data);hashes[i]=sha
   tokens=e.qa.words(l['text']);transcript=' '.join(tokens[:c['index']]+tokens[c['index']+1:]);event={'category':c['category'],'vocal_sound':c['sound'],'description':c['description'],'confidence':.9}
   response={'modelVersion':e.qc.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':transcript,'events':[event]})}]}}]}
   rec={'id':i,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,'source_text_sha256':e.qa.text_hash(l['text']),'input_mime_type':'audio/mpeg','model':e.qc.MODEL,'prompt':e.qc.PROMPT,'transcript':transcript,'response':response,**e.qc.cache_metadata()};self.records[i]=rec
   e.qa.save(self.run/'independent-vocal-qc'/(i+'.'+sha[:16]+'.json'),rec);e.qa.save(self.run/'raw'/(i+'.receipt.json'),{'id':i,'status':'complete','model':e.core.MODEL,'backend':'batch','mp3_sha256':sha})
   takes.append({'id':i,'text_sha256':e.qa.text_hash(l['text']),'signal':copy.deepcopy(signal),'reasons':['asr_lexical_mismatch_requires_review']})
   req=e.qc.request_for(data);requests.append({'key':i,'request':req});entries.append({'id':i,'clip_sha256':sha,'source_audio_sha256':sha,'source_text_sha256':e.qa.text_hash(l['text']),'request_sha256':e.core.digest(json.dumps(req,sort_keys=True).encode())});raw.append({'key':i,'response':response})
  self.qa=self.run/'qa.json';e.qa.save(self.qa,{'version':e.qa.VERSION,'model':e.qa.MODEL,'manifest_sha256':e.qa.digest(self.run/'lines.private.json'),'clip_sha256':hashes,'takes':takes})
  self.batch=self.run/'independent-vocal-qc/batches/fixture';payload=('\n'.join(json.dumps(x) for x in requests)+'\n').encode();(self.batch/'requests.jsonl').write_bytes(payload)
  e.qa.save(self.batch/'audio-snapshot.private.json',{'clips':entries,'source_run':str(self.run),'source_manifest_sha256':e.qa.digest(self.run/'lines.private.json'),'source_tts_prepared_sha256':e.qa.digest(self.run/'prepared.json'),'model':e.qc.MODEL,'prompt':e.qc.PROMPT,'prompt_sha256':e.qc.text_hash(e.qc.PROMPT)})
  e.qa.save(self.batch/'prepared.json',{'bank':'independent-story-vocal-qc','model':e.qc.MODEL,'request_count':3,'input_bytes':len(payload),'input_sha256':e.core.digest(payload),'snapshot_sha256':e.qa.digest(self.batch/'audio-snapshot.private.json')})
  e.qa.save(self.batch/'submit-intent.private.json',{'model':e.qc.MODEL,'state':'CONFIRMED','request_count':3,'input_sha256':e.core.digest(payload)})
  e.qa.save(self.batch/'job.json',{'model':e.qc.MODEL,'state':'JOB_STATE_SUCCEEDED','request_count':3,'job_name':'batches/offline'})
  e.qa.save(self.batch/'collection.private.json',{'model':e.qc.MODEL,'expected':3,'collected':3,'failures':[]});(self.batch/'responses.private.jsonl').write_text('\n'.join(json.dumps(x) for x in raw)+'\n')
 def approved(self,i):
  a=e.template(self.run,self.rows[i],self.qa,self.records[i]);a.update(status=e.APPROVED,reviewed_by='root offline',reason='Reviewed exact scoped gesture/body.');return a
 def test_three_root_only_complete_bindings(self):
  for i in self.rows:
   self.assertIsNone(e.review(self.run,self.rows[i],self.qa,self.records[i]));proof=e.review(self.run,self.rows[i],self.qa,self.records[i],self.approved(i));self.assertIsNone(proof['timing_approval']);self.assertIsNone(proof['listening_verdict'])
   with self.assertRaises(e.core.SafeError):e.review(self.run,self.rows[i],self.qa,self.records[i],e.template(self.run,self.rows[i],self.qa,self.records[i]))
 def test_every_approval_field_stale_or_missing_refused(self):
  i=next(iter(self.rows));a=self.approved(i)
  for key in ['clip_sha256','source_row_sha256','source_manifest_sha256','raw_response_sha256','qc_contract','proof_drivers_sha256','base_take_sha256']:
   bad=copy.deepcopy(a);bad[key]='stale'
   with self.assertRaises(e.core.SafeError):e.review(self.run,self.rows[i],self.qa,self.records[i],bad)
  for who in ['', 'worker',None]:
   bad=copy.deepcopy(a);bad['reviewed_by']=who
   with self.assertRaises(e.core.SafeError):e.review(self.run,self.rows[i],self.qa,self.records[i],bad)
 def test_events_body_vowels_source_scope_refused(self):
  for i,line in self.rows.items():
   rec=self.records[i];obs=e.qc.response_observation(rec['response'])
   cases=[]
   for key,val in [('category','other'),('vocal_sound','ah'),('confidence',.79),('description','different')]:
    b=copy.deepcopy(obs);b['events'][0][key]=val;cases.append(b)
   b=copy.deepcopy(obs);b['events']*=2;cases.append(b)
   for text in [obs['transcript']+' Wort','',obs['transcript'].replace('disziplin','diszipline')]:
    if text==obs['transcript']:continue
    b=copy.deepcopy(obs);b['transcript']=text;cases.append(b)
   for b in cases:
    rr=copy.deepcopy(rec);rr['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps(b)
    with self.assertRaises(e.core.SafeError):e.observation(line,rr)
   with self.assertRaises(e.core.SafeError):e.observation({**line,'text':line['text']+' Wort'},rec)
 def test_actual_cache_schema_model_stop_and_provider_refused(self):
  i=next(iter(self.rows));a=self.approved(i)
  for key,value in [('schema_sha256','bad'),('model','bad'),('upload_sha256','bad')]:
   rec=copy.deepcopy(self.records[i]);rec[key]=value
   with self.assertRaises(e.core.SafeError):e.template(self.run,self.rows[i],self.qa,rec)
  rec=copy.deepcopy(self.records[i]);rec['response']['candidates'][0]['finishReason']='MAX_TOKENS'
  with self.assertRaises(e.core.SafeError):e.template(self.run,self.rows[i],self.qa,rec)
  for name in ['job.json','submit-intent.private.json','collection.private.json','requests.jsonl']:
   p=self.batch/name;old=p.read_bytes();p.write_text('{}')
   with self.assertRaises((e.core.SafeError,KeyError,TypeError)):e.template(self.run,self.rows[i],self.qa,self.records[i])
   p.write_bytes(old)
 def test_legacy_original_batch_needs_frozen_request_wav_provider(self):
  i=next(iter(self.rows));request={'fixture':'original'};wav=self.run/'raw'/(i+'.wav');wav.write_bytes(b'original-wav')
  (self.run/'requests.jsonl').write_text(json.dumps({'key':i,'request':request})+'\n')
  e.qa.save(self.run/'job.json',{'model':e.core.MODEL,'request_count':3});e.qa.save(self.run/'status.private.json',{'metadata':{'model':'models/'+e.core.MODEL}})
  path=self.run/'raw'/(i+'.receipt.json');receipt=e.core.read_json(path);receipt.pop('model');receipt['request_sha256']=e.core.digest(json.dumps(request,sort_keys=True).encode());receipt['wav_sha256']=e.qa.digest(wav);e.qa.save(path,receipt)
  self.assertTrue(e.template(self.run,self.rows[i],self.qa,self.records[i]))
  wav.write_bytes(b'changed')
  with self.assertRaises(e.core.SafeError):e.template(self.run,self.rows[i],self.qa,self.records[i])
 def test_audio_receipt_signal_and_whole_row_refused(self):
  i=next(iter(self.rows));a=self.approved(i)
  for p in [self.run/'clips'/(i+'.mp3'),self.run/'raw'/(i+'.receipt.json')]:
   old=p.read_bytes();p.write_bytes(b'{}')
   with self.assertRaises(e.core.SafeError):e.template(self.run,self.rows[i],self.qa,self.records[i])
   p.write_bytes(old)
  report=e.core.read_json(self.qa);report['takes'][0]['signal']['silent']=True;e.qa.save(self.qa,report)
  with self.assertRaises(e.core.SafeError):e.template(self.run,self.rows[i],self.qa,self.records[i])
if __name__=='__main__':unittest.main()
