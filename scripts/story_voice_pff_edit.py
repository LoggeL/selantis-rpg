#!/usr/bin/env python3
"""One fixed same-source Pff edit: offline root plan, recoverable explicit import."""
import argparse
import copy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
import wave
import story_voice_common as common
from story_voice_common import core
import story_voice_qa as qa
import story_voice_vocal_qc as qc
import story_voice_retake_batch as retake

ID='story-95c49f2ee284e215ca7615fc'
TEXT='Gleich, gleich … klack … Pfff.'
BACKEND='derived_scoped_pff_parts'
FOLDER='pff-edited-pass14'
VERSION='one-source-pff-parts-v1'
APPROVED='approved_scoped_pff_edit'
FILTER='[0:a]aresample=24000,asetpts=PTS-STARTPTS[body];[1:a]aresample=24000,atrim=start_sample=120480:end_sample=140400,asetpts=PTS-STARTPTS[puff];[body][puff]concat=n=2:v=0:a=1[out]'

def require(condition,message):
 if not condition:raise core.SafeError(message)

def path(run,name):
 p=(run/name).resolve();require(p.is_relative_to(run) and p.is_file(),'Pff evidence must remain private inside the run.');return p

def direct_qc(run,folder,audio,receipt_path):
 raw_path=path(run,folder+'/qc-raw.private.json');intent_path=path(run,folder+'/qc-intent.private.json');script=path(run,folder+'/root-qc.py')
 raw=core.read_json(raw_path);intent=core.read_json(intent_path);binding={'id':ID,'audio_sha256':qa.digest(audio),'TTS_receipt_sha256':qa.digest(receipt_path),'model':qc.MODEL,'request_sha256':qa.canonical_record_hash(qc.request_for(audio.read_bytes())),'prompt_sha256':qc.text_hash(qc.PROMPT),'driver_sha256':qa.digest(Path(qc.__file__)),'script_sha256':qa.digest(script)}
 require(raw.get('binding')==intent.get('binding')==binding and intent.get('state')=='RECORDED_BEFORE_HTTP' and intent.get('max_calls')==1 and intent.get('automatic_retry') is False,'Actual one-call direct QC source/request/driver/intent binding differs.')
 require(type(raw.get('received_at')) in (int,float) and raw['received_at']>=intent['started_at'],'Direct QC response predates intent.')
 return qc.response_observation(raw['response']),raw,[raw_path,intent_path,script]

def pcm_equal(body,puff,target):
 a=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(body),'-i',str(puff),'-filter_complex',FILTER,'-map','[out]','-ar','24000','-ac','1','-f','s16le','pipe:1'],capture_output=True,timeout=60)
 b=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(target),'-ar','24000','-ac','1','-f','s16le','pipe:1'],capture_output=True,timeout=60)
 require(a.returncode==b.returncode==0 and a.stdout and a.stdout==b.stdout,'Target WAV does not equal the exact fixed sample-range edit.')
 return core.digest(a.stdout)

def validate_candidate(run):
 run=run.resolve();common.prepared(run);folder=run/FOLDER;transform_path=path(run,FOLDER+'/transform-plan.private.json');actual_path=path(run,FOLDER+'/actual-transform.private.json');transform=core.read_json(transform_path);actual=core.read_json(actual_path)
 manifest=core.read_json(run/'lines.private.json');line=next(r for r in manifest['lines'] if r['id']==ID);profiles=core.read_json(run/'profiles.private.json')
 require(line['text']==TEXT and line['speaker']=='azar' and profiles['speakers']['azar']['google_voice']=='Zubenelgenubi','Only unchanged Azar Pfff source and fixed Zubenelgenubi preset supported.')
 require(transform.get('id')==ID and transform.get('filter')==FILTER and transform.get('puff_samples')==[120480,140400] and transform.get('sample_rate')==24000 and transform.get('same_source_same_preset') is True and transform.get('source_manifest_sha256')==qa.digest(run/'lines.private.json'),'Fixed Pff transform/source/range differs.')
 require(actual.get('plan_sha256')==qa.digest(transform_path),'Actual transform plan hash differs.')
 files=[transform_path,actual_path,run/'prepared.json',run/'lines.private.json',run/'profiles.private.json',run/'requests.jsonl'];origins={};inputs={}
 for role,batchname,qcfolder in [('body','native-pff-single-pass12','native-pff-observe-pass12'),('puff','native-pff-pass11','native-pff-observe-pass11')]:
  batch=run/'retake-batches'/batchname;retake.prepared(batch,run,verify_bank=False)
  mp3=path(run,'retake-batches/'+batchname+'/clips/'+ID+'.mp3');receipt_path=path(run,'retake-batches/'+batchname+'/raw/'+ID+'.receipt.json');receipt=core.read_json(receipt_path);wav=path(run,'retake-batches/'+batchname+'/raw/'+ID+'.wav');snapshot=core.read_json(batch/'parent-snapshot.private.json')
  require(Path(transform[role+'_source_mp3']).resolve()==mp3 and transform[role+'_source_mp3_sha256']==qa.digest(mp3) and transform[role+'_receipt_sha256']==qa.digest(receipt_path),'Origin MP3 or receipt hash differs.')
  require(receipt.get('id')==ID and receipt.get('status')=='complete' and receipt.get('backend')=='batch' and receipt.get('model')==core.MODEL and receipt.get('mp3_sha256')==qa.digest(mp3) and receipt.get('wav_sha256')==qa.digest(wav) and receipt.get('request_sha256')==snapshot['modified_request_sha256'][ID] and snapshot['fixed_google_voices'][ID]=='Zubenelgenubi','Origin source/cast/model/request/audio receipt differs.')
  collection=core.read_json(batch/'collection.private.json');job=core.read_json(batch/'job.json');raws=[json.loads(s) for s in (batch/'responses.private.jsonl').read_text().splitlines() if s.strip()];selected=[r for r in raws if r.get('key')==ID]
  require(collection.get('failures')==[] and collection.get('collected')==collection.get('expected')==len(snapshot['selected_ids']) and job.get('model')==core.MODEL and job.get('state')=='JOB_STATE_SUCCEEDED' and len(selected)==1 and selected[0].get('response',{}).get('modelVersion')==core.MODEL and selected[0]['response']['candidates'][0].get('finishReason')=='STOP','Origin actual TTS provider collection/model/STOP differs.')
  obs,raw,paths=direct_qc(run,qcfolder,mp3,receipt_path);files+=paths
  require(qa.digest(paths[0])==transform[role+'_actual_QC_raw_sha256'],'Origin actual QC hash differs.')
  if role=='body':
   require(qa.words(obs['transcript'])==['gleich','gleich','klack'] and obs['events']==[],'Body must contain exactly three source words and no extra events.')
   wp=path(run,qcfolder+'/whisper-actual.private.json');words=core.read_json(wp);require(qa.digest(wp)==transform['body_actual_free_words_sha256'] and words['binding']['audio_sha256']==qa.digest(mp3) and words['binding']['TTS_receipt_sha256']==qa.digest(receipt_path) and qa.words(words['result']['text'])==['gleich','gleich','klack'],'Actual free body word proof differs.');files.append(wp)
  else:
   wp=path(run,qcfolder+'/offline-acoustic-review.private.json');require(qa.digest(wp)==transform['puff_waveform_evidence_sha256'],'Source puff waveform evidence differs.');files.append(wp)
   require(len(obs['events'])==4 and obs['events'][3]=={'category':'other','description':'soft unvoiced or weakly voiced lip puff / blow','vocal_sound':'ff-puff','confidence':.8},'Origin puff must retain its actual four-event observation and terminal event index 3.')
  files += [mp3,wav,receipt_path,*[batch/n for n in ['prepared.json','profiles.private.json','lines.private.json','delivery-overrides.private.json','parent-snapshot.private.json','requests.jsonl','responses.private.jsonl','job.json','status.private.json','submit-intent.private.json','collection.private.json']]]
  origins[role]={'batch':str(batch.relative_to(run)),'mp3_sha256':qa.digest(mp3),'wav_sha256':qa.digest(wav),'receipt_sha256':qa.digest(receipt_path),'tts_request_sha256':receipt['request_sha256'],'provider_response_sha256':qa.canonical_record_hash(selected[0]['response']),'model':core.MODEL,'google_voice':'Zubenelgenubi'};inputs[role]=mp3
 target=path(run,FOLDER+'/clips/'+ID+'.mp3');wav=path(run,FOLDER+'/raw/'+ID+'.wav')
 require(actual.get('mp3_sha256')==qa.digest(target) and actual.get('wav_sha256')==qa.digest(wav),'Actual target MP3/WAV hash differs.')
 pcm_hash=pcm_equal(inputs['body'],inputs['puff'],wav)
 obs,raw,paths=direct_qc(run,FOLDER,target,path(run,'retake-batches/native-pff-pass11/raw/'+ID+'.receipt.json'));files+=paths+[target,wav]
 require(qa.words(obs['transcript'])==['gleich','gleich','klack'] and len(obs['events'])==1,'Target must retain all three body words and exactly one event.')
 event=obs['events'][0];require(event['category']=='other' and event['vocal_sound']=='pff' and event['description']=='suppressed chuckle followed by a breathy exhale' and event['confidence']>=.8,'Only the actual single pff observation is supported, no Puh/Uff aliases.')
 return {'id':ID,'source_row_sha256':qa.canonical_record_hash(line),'source_text_sha256':qa.text_hash(TEXT),'model':core.MODEL,'google_voice':'Zubenelgenubi','origins':origins,'transform':{'filter':FILTER,'sample_rate':24000,'puff_samples':[120480,140400],'pcm_sha256':pcm_hash},'wav_sha256':qa.digest(wav),'mp3_sha256':qa.digest(target),'direct_qc_raw_sha256':qa.canonical_record_hash(raw),'provenance_files_sha256':{str(p.relative_to(run)):qa.digest(p) for p in files}}

def template(run):
 run=run.resolve();evidence=validate_candidate(run);rows={r['id']:r for r in core.read_json(run/'lines.private.json')['lines']};bank,bankhash=retake.bank(run,rows)
 collection=core.read_json(run/'collection.private.json');require(collection.get('failures')==[] and collection.get('collected')==collection.get('expected')==len(rows),'Parent collection must be complete before deriving a new bank scope.')
 parents={name:qa.digest(path(run,name)) for name in ['raw/'+ID+'.wav','raw/'+ID+'.receipt.json','clips/'+ID+'.mp3','collection.private.json']}
 return {'id':ID,'status':'root_review_required','reviewed_by':'','reason':'','method':VERSION,'candidate':evidence,'parent_artifacts_sha256':parents,'parent_bank_sha256':bankhash,'helper_sha256':qa.digest(Path(__file__)),'timing_approval':None,'acting_approval':None,'listening_verdict':None}

def root_review(expected,approval):
 require(isinstance(approval,dict) and set(approval)==set(expected) and approval.get('status')==APPROVED and isinstance(approval.get('reviewed_by'),str) and approval['reviewed_by'].casefold().startswith('root') and isinstance(approval.get('reason'),str) and approval['reason'].strip(),'Explicit complete root Pff edit decision required.')
 require(all(json.dumps(approval[k],sort_keys=True)==json.dumps(v,sort_keys=True) for k,v in expected.items() if k not in {'status','reviewed_by','reason'}),'Pff root decision stale or differs from current evidence.')

def wave_seconds(file):
 with wave.open(str(file),'rb') as stream:return stream.getnframes()/stream.getframerate()

def apply(run,approval_path):
 run=run.resolve();approval_path=path(run,approval_path);approval=core.read_json(approval_path);journal_path=run/FOLDER/'import.private.json'
 with common.run_lock(run):
  require(not journal_path.exists(),'Pff import journal exists. Do not automatically repeat or resume a partial import; inspect the preserved archive.')
  expected=template(run);root_review(expected,approval);archive=run/'rejected'/('pff-parts-'+str(time.time_ns()))
  journal={'state':'IMPORT_INTENT_RECORDED','id':ID,'archive':str(archive),'root_approval_file':str(approval_path.relative_to(run)),'root_approval_sha256':qa.digest(approval_path),'plan':copy.deepcopy(approval)}
  qa.save(journal_path,journal);archive.mkdir(parents=True)
  for name,h in expected['parent_artifacts_sha256'].items():
   src=path(run,name);require(qa.digest(src)==h,'Parent changed before Pff archival.');shutil.copy2(src,archive/src.name)
  e=expected['candidate'];receipt={'id':ID,'status':'complete','backend':BACKEND,'model':core.MODEL,'google_voice':'Zubenelgenubi','wav_sha256':e['wav_sha256'],'mp3_sha256':e['mp3_sha256'],'seconds':wave_seconds(run/FOLDER/'raw'/(ID+'.wav')),'source_text_sha256':e['source_text_sha256'],'source_row_sha256':e['source_row_sha256'],'origins':e['origins'],'transform':e['transform'],'root_approval_sha256':qa.digest(approval_path),'derived_plan_sha256':qa.canonical_record_hash(approval),'vocal_qc_required':True}
  shutil.copy2(run/FOLDER/'raw'/(ID+'.wav'),run/'raw'/(ID+'.wav'));shutil.copy2(run/FOLDER/'clips'/(ID+'.mp3'),run/'clips'/(ID+'.mp3'));qa.save(run/'raw'/(ID+'.receipt.json'),receipt)
  retake.rebuild(run,None);journal['state']='IMPORTED_REQUIRES_FRESH_QA';journal['derived_receipt_sha256']=qa.digest(run/'raw'/(ID+'.receipt.json'));qa.save(journal_path,journal)
 return receipt

def validate_imported(run,line,receipt):
 run=run.resolve();require(line['id']==ID and line['text']==TEXT and line['speaker']=='azar','Unsupported derived Pff source.')
 journal=core.read_json(path(run,FOLDER+'/import.private.json'));require(journal.get('state')=='IMPORTED_REQUIRES_FRESH_QA' and journal.get('id')==ID,'Incomplete Pff import journal.')
 approval_path=path(run,journal['root_approval_file']);approval=core.read_json(approval_path);require(qa.digest(approval_path)==journal['root_approval_sha256'] and approval==journal['plan'],'Imported Pff root decision changed.')
 require(set(approval)=={'id','status','reviewed_by','reason','method','candidate','parent_artifacts_sha256','parent_bank_sha256','helper_sha256','timing_approval','acting_approval','listening_verdict'} and approval.get('id')==ID and approval.get('method')==VERSION and all(approval.get(k) is None for k in ['timing_approval','acting_approval','listening_verdict']),'Imported Pff root plan schema/source/method differs.')
 require(set(approval.get('parent_artifacts_sha256',{}))=={'raw/'+ID+'.wav','raw/'+ID+'.receipt.json','clips/'+ID+'.mp3','collection.private.json'},'Exactly three parent files and original collection must be archived.')
 evidence=validate_candidate(run);expected=copy.deepcopy(approval);expected['candidate']=evidence;expected['helper_sha256']=qa.digest(Path(__file__));root_review(expected,approval)
 archive=Path(journal['archive']).resolve();require(archive.is_relative_to(run/'rejected') and archive.is_dir(),'Unsafe/missing Pff archive.')
 for name,h in approval['parent_artifacts_sha256'].items():require(qa.digest(path(run,str((archive/Path(name).name).relative_to(run))))==h,'Archived Pff parent changed.')
 require(receipt.get('id')==ID and receipt.get('backend')==BACKEND and receipt.get('status')=='complete' and receipt.get('model')==core.MODEL and receipt.get('google_voice')=='Zubenelgenubi' and 'request_sha256' not in receipt and receipt.get('vocal_qc_required') is True,'Derived receipt cannot masquerade as direct TTS.')
 for key in ['wav_sha256','mp3_sha256','source_text_sha256','source_row_sha256','origins','transform']:require(receipt.get(key)==evidence[key],'Derived Pff receipt provenance differs.')
 require(receipt.get('root_approval_sha256')==qa.digest(approval_path) and receipt.get('derived_plan_sha256')==qa.canonical_record_hash(approval) and journal['derived_receipt_sha256']==qa.digest(run/'raw'/(ID+'.receipt.json')),'Derived decision/receipt hash differs.')
 require(qa.digest(run/'raw'/(ID+'.wav'))==evidence['wav_sha256'] and qa.digest(run/'clips'/(ID+'.mp3'))==evidence['mp3_sha256'],'Current imported Pff audio differs.')
 return evidence

def main():
 common.configure();p=argparse.ArgumentParser(description=__doc__);p.add_argument('command',choices=['template','apply']);p.add_argument('--run-dir',type=Path,required=True);p.add_argument('--output',type=Path);p.add_argument('--root-approval',type=Path);a=p.parse_args();run=core.directory(str(a.run_dir))
 if a.command=='template':require(a.output is not None and a.output.resolve().is_relative_to(run) and not a.output.exists(),'Choose a new private unapproved plan.');qa.save(a.output,template(run));print('UNAPPROVED_PRIVATE_PLAN')
 else:require(a.root_approval is not None,'Explicit root decision file required.');apply(run,a.root_approval);print('IMPORTED_REQUIRES_FRESH_QA')
 return 0
if __name__=='__main__':
 try:raise SystemExit(main())
 except (core.SafeError,OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as e:print(str(e) if isinstance(e,core.SafeError) else 'Invalid scoped Pff evidence; no automatic retry.',file=sys.stderr);raise SystemExit(1)
