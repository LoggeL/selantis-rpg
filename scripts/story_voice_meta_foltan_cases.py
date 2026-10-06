#!/usr/bin/env python3
"""Two explicitly reviewed Foltan cases; actual free native phones, no aliases.

No inference, text prompt, timing qualification or automatic name approval.
Word decoders remain contradictory diagnoses. Every other word must be literal
in blind Pro, Flash and actual free full large-v3.
"""
from __future__ import annotations
import copy
import hashlib
import json
import math
from pathlib import Path
import subprocess
import numpy as np
import story_voice_common as common
from story_voice_common import core
import story_voice_qa as qa
import story_voice_pro_asr as pro
import story_voice_transcribe as flash
import story_voice_meta_name_evidence as native

VERSION='two-source-foltan-native-free-word-evidence-v1'
APPROVED='approved_individual_foltan_native_full_body'
CASES={
 'story-3b903469e6b68bb3709fb021':{'text':'Der feine Herr Foltan rennt wie auf der Flucht.','index':3,'emission_start':10,'emission_end':16,'voice':'Zubenelgenubi','observed':{'pro':'voltern','flash':'foltern','large':'foltern'}},
 'story-5a268976e37fa2acd486a74d':{'text':'Foltan … wird schon seine Gründe haben. Er ist ein guter Mann. Meistens.','index':0,'emission_start':0,'emission_end':6,'voice':'Zubenelgenubi','observed':{'pro':'foltern','flash':'foltern','large':'foltern'}}}
KEYS={'qa_report_path','pro_record_path','flash_record_path','free_record_path','meta_observation_path','historical_timing_context_path'}
require=native.require
canonical=native.canonical
object_hash=native.object_hash
native_hash=native.native_hash

def digest(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()

def case(line):
 require(line.get('id') in CASES,'Exactly the two reviewed source IDs are supported.')
 c=CASES[line['id']]
 require(line.get('text')==c['text'] and line.get('speaker')=='azar','Exact frozen source/speaker required.')
 return c

def body(line,transcript,channel):
 c=case(line);expected=qa.words(c['text']);actual=qa.words(transcript);j=c['index']
 require(channel in c['observed'] and len(actual)==len(expected) and expected[j]=='foltan'
         and actual[j]==c['observed'][channel],'Actual individually scoped spelling/count differs.')
 require(all(a==b for k,(a,b) in enumerate(zip(expected,actual)) if k!=j),'Every other source word must remain literal and ordered.')
 return {'channel':channel,'full_actual_transcript':transcript,'expected_tokens':expected,'observed_tokens':actual,
         'diagnostic_name_index':j,'diagnostic_spelling':actual[j],'name_spelling_adopted':False}

def native_case_frames(line,logits,probabilities,ids,vocab,observation):
 c=case(line)
 selected={'start_index':c['emission_start'],'end_index_exclusive':c['emission_end']}
 require(logits.dtype==np.float32 and probabilities.dtype==np.float64,'Original float32 logits/full float64 native softmax required.')
 require(sorted(vocab.values())==list(range(392)) and vocab.get('<pad>')==0,'Exact full 392 native inventory required.')
 result=native.native_frames(logits,probabilities,ids,vocab,observation,selected)
 events=result['selected_events'];require(len(events)==6,'Exactly six actual emitted phones required.')
 alternatives={}
 for event in events:
  frame=event['frame_index'];alternatives[str(frame)]={token:float(probabilities[frame,vocab[token]]) for token in ['f','v','ɑː','a','ɜ','ə','ɔ','oː','ɛ'] if token in vocab}
 result['actual_same_frame_alternative_probabilities_uncalibrated']=alternatives
 result['shape']='f ɔ l t ɑː n';result['no_global_vowel_rule']=True
 return result

def proof_template(run,line,bindings):
 run=Path(run).resolve();c=case(line);ident=line['id'];require(run.is_relative_to(qa.PRIVATE.resolve()),'Private production run required.')
 require(set(bindings)==KEYS,'Complete explicit original evidence bindings required.')
 provenance={}
 def path(value,external=False):
  p=Path(value);p=(p if p.is_absolute() else run/p).resolve();require(p.is_file() and (external or p.is_relative_to(run)),'Actual evidence path unavailable/private scope differs.');provenance[str(p)]=digest(p);return p
 def load(value):return json.loads(path(value).read_text())
 common.prepared(run)
 for n in ['prepared.json','requests.jsonl','source-snapshot.private.json','full-inventory.private.json']:path(n)
 manifest=load('lines.private.json');require([r for r in manifest['lines'] if r['id']==ident]==[line],'Full current source row differs.')
 profiles=load('profiles.private.json');require(profiles['speakers']['azar']['google_voice']==c['voice'],'Frozen voice differs.')
 audio=path('clips/'+ident+'.mp3');ah=digest(audio);sh=qa.text_hash(c['text']);receipt=load('raw/'+ident+'.receipt.json');wav=path('raw/'+ident+'.wav')
 require(receipt['id']==ident and receipt['status']=='complete' and receipt['model']==core.MODEL
         and receipt['mp3_sha256']==ah and receipt['wav_sha256']==digest(wav),'Actual current TTS source/audio receipt differs.')
 report=load(bindings['qa_report_path']);require(report.get('version')==qa.VERSION and (report.get('model')==qa.MODEL or str(report.get('model','')).startswith(qa.MODEL+':')),'Actual QA model/producer required.')
 require(report['manifest_sha256']==digest(run/'lines.private.json') and report['clip_sha256'][ident]==ah,'Current QA source/audio differs.')
 take=[r for r in report['takes'] if r['id']==ident];require(len(take)==1 and take[0]['text_sha256']==sh,'Unique actual QA take required.');take=take[0]
 sig=take['signal'];require(type(sig.get('silent')) is bool and sig['silent'] is False
         and all(type(sig.get(k)) in (int,float) and math.isfinite(sig[k]) for k in ['seconds','peak','rms','clipped_fraction','leading_silence_seconds','trailing_silence_seconds','last_frame_rms'])
         and not qa.signal_failures(sig,len(qa.words(c['text']))),'Physical signal failure blocks lexical proof.')
 require(set(take['reasons'])<={'asr_lexical_mismatch_requires_review'} and {x['reason'] for x in report['failures'] if x['id']==ident}==set(take['reasons']),'Nonlexical/inconsistent QA failure cannot be cleared.')
 word_evidence=[]
 for channel,module,key in [('pro',pro,'pro_record_path'),('flash',flash,'flash_record_path')]:
  rec=load(bindings[key]);require(rec['id']==ident and module.cached_record(rec,ah,sh),'True blind current '+channel+' record required.')
  word_evidence.append(body(line,rec['transcript'],channel))
  # Preserve original submitted raw and source/run ledgers; no cache copying.
  for n in ['batch_scope_file','batch_response_file']:
   if n in rec:path(rec[n])
  if 'batch_scope_file' in rec:
   batch=path(rec['batch_scope_file']).parent
   for n in ['prepared.json','audio-snapshot.private.json','requests.jsonl','submit-intent.private.json','job.json']:path(batch/n)
 freep=path(bindings['free_record_path']);fr=load(freep);freeplan=load(freep.parent/'plan.private.json')
 require(fr['id']==ident and fr['method']=='actual-unprompted-full-whisper-large-v3-word-timestamps-v1' and fr['approval'] is None
         and fr['binding']['clip_sha256']==ah and fr['binding']['text_sha256']==sh
         and fr['binding']['source_reference_only']['source_row']==line,'Actual complete blind full large-v3 binding required.')
 require(digest(path(freep.parent/'plan.private.json'))==fr['plan_sha256'] and digest(path(freep.parent/'root-runner.py'))==fr['runner_sha256']==freeplan['runner_sha256'],'Actual free runtime plan/runner differs.')
 params={'language':'de','initial_prompt':None,'condition_on_previous_text':False,'temperature':0,'word_timestamps':True,'verbose':False}
 require(fr['parameters']==freeplan['parameters']==params and Path(freeplan['model_directory']).name=='whisper-large-v3','Full large-v3 decoder must remain blind.')
 for key in ['model_files_sha256','runtime_files_sha256']:
  require(fr[key]==freeplan[key],'Free model/runtime differs.')
  for p,h in fr[key].items():require(digest(path(p,True))==h,'Actual free model/runtime bytes differ.')
 intent=load(freep.parent/(ident+'.intent.private.json'));require(intent['binding']==fr['binding'] and intent['plan_sha256']==fr['plan_sha256'] and intent['authored_initial_prompt'] is None,'Prior free forward intent differs.')
 require(fr['actual_words']==[w for s in fr['actual_free_result']['segments'] for w in s.get('words',[])] and fr['actual_free_result']['language']=='de','Complete actual free words required.')
 word_evidence.append(body(line,fr['actual_free_result']['text'],'large'))
 original_timing=str(run/'word-cues'/(ident+'.json'));archive=path(bindings['historical_timing_context_path']);inputs=fr['binding']['input_sha256'];require(original_timing in inputs and digest(archive)==inputs[original_timing],'Original unprompted timing-reference context must remain verifiable.')
 for p,h in inputs.items():
  if p!=original_timing:require(digest(path(p))==h,'Actual free inference provenance changed.')
 pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(audio),'-f','f32le','-ac','1','-ar','16000','pipe:1']);pcm_sha=hashlib.sha256(pcm).hexdigest();require(pcm_sha==fr['decoded_audio']['f32le_sha256'],'Actual native free PCM differs.')
 observation_path=path(bindings['meta_observation_path']);base=observation_path.parent.parent;obs=load(observation_path);plan=load(base/'plan.private.json');completion=load(base/'completion.private.json');execution=load(base/'execution-intent.private.json');context=load(base/'source-context.private.json')
 require(obs['id']==ident and obs['source_mp3_sha256']==ah and obs['source_receipt_sha256']==digest(run/'raw'/(ident+'.receipt.json'))
         and obs['provider_wav_sha256']==digest(wav) and obs['decoded_pcm_sha256']==pcm_sha
         and obs['recognizer_received_expected_text'] is False and obs['model_timestamps_used'] is False and obs['model']==native.MODEL and obs['revision']==native.REVISION,'True native blind current Meta observation required.')
 require(digest(path(base/'runner.py'))==obs['runner_sha256']==plan['runner_sha256'] and digest(path(base/'plan.private.json'))==obs['plan_sha256']==completion['plan_sha256']
         and digest(path(base/'execution-intent.private.json'))==obs['global_execution_intent_sha256'] and digest(path(base/'source-context.private.json'))==obs['source_context_sha256'],'Original Meta plan/intents/runtime references differ.')
 ctx=[z for z in context['records'] if z['id']==ident]
 require(len(ctx)==1 and ctx[0]['source_row']==line and ctx[0]['voice']==c['voice'],'Original Meta full source/profile context differs.')
 require(execution['mp3_sha256'][ident]==ah and completion['runner_sha256']==plan['runner_sha256'],'Completed original Meta execution differs.')
 require(obs['actual_params']==plan['params'] and native_hash(plan['params'])==obs['actual_params_sha256']
         and plan['params']['do_phonemize'] is False and plan['params']['beam_search'] is False and plan['params']['device']=='cpu'
         and plan['params']['source_text_input'] is False and plan['params']['lexicon'] is None and plan['params']['language_hint'] is None and plan['params']['forced_alignment'] is False,'No name input or forced alignment allowed.')
 md=Path(plan['model_directory']);require(native.tree(md)==plan['model_files'] and native_hash(plan['model_files'])==plan['model_tree_sha256'],'Pinned actual Meta model bytes differ.')
 for entry in plan['runtime_bindings'].values():
  for p,h in entry['metadata'].items():require(digest(path(Path(entry['root'])/p,True))==h,'Actual Meta metadata changed.')
 for package in ['torch','transformers','numpy','tokenizers','safetensors']:
  entry=plan['runtime_bindings'][package];require(native_hash(native.tree(Path(entry['root'])/package))==entry['installed_tree_sha256'],'Actual runtime package tree differs.')
 require(native_hash(plan['runtime_bindings'])==obs['runtime_bindings_sha256'],'Native runtime binding digest differs.')
 forward=load(base/'results'/(ident+'.forward-intent.private.json'));require(forward['id']==ident and forward['mp3_sha256']==ah and forward['pcm_sha256']==pcm_sha
         and forward['runner_sha256']==plan['runner_sha256'] and digest(path(base/'results'/(ident+'.forward-intent.private.json')))==obs['forward_intent_sha256'],'Prior actual Meta single forward differs.')
 matrix=[]
 for filekey,hashkey in [('raw_phone_logits_file','raw_phone_logits_sha256'),('actual_frame_probabilities_file','actual_frame_probabilities_sha256'),('argmax_ids_file','argmax_ids_sha256')]:
  pp=path(base/obs[filekey]);require(digest(pp)==obs[hashkey],'Actual full native raw array differs.');matrix.append(np.load(pp,allow_pickle=False))
 decoded=path(base/obs['decoded_f32le_file']);require(digest(decoded)==pcm_sha,'Original direct float32 PCM differs.')
 phones=native_case_frames(line,*matrix,load(md/'vocab.json'),obs)
 # Keep all contradictory German CTC records current-bound as diagnosis, no repairs.
 german_ctc=[]
 for folder in sorted(run.glob('ctc*')):
  if folder.is_dir():
   for p in folder.glob(ident+'.*ctc.private.json'):
    z=json.loads(p.read_text())
    if z.get('binding',{}).get('audio_sha256')==ah:german_ctc.append({'file':str(path(p)),'actual_greedy':z.get('greedy_decode'),'alignment_is_not_word_proof':True})
 return {'status':'root_review_required','reviewed_by':'','reason':'','method':VERSION,'id':ident,'clip_sha256':ah,'source_text_sha256':sh,'source_row':copy.deepcopy(line),
         'source_row_sha256':object_hash(line),'source_profiles_sha256':digest(run/'profiles.private.json'),'voice':c['voice'],'qa_take':take,'actual_three_fullbody_records':word_evidence,
         'native_Meta_evidence':phones,'contradictory_German_CTC_diagnosis':german_ctc,'historical_free_context':{'path':str(archive),'sha256':digest(archive)},
         'provenance_files_sha256':provenance,'protected_script_sha256':{str(Path(m.__file__).resolve()):digest(m.__file__) for m in [native,qa,common,core,pro,flash,pro.transport,pro.transport.asr]},
         'helper_script_sha256':digest(__file__),'no_name_spelling_alias':True,'provider_timestamps_used':False,'timing_approval':None,'acting_approval':None,'listening_verdict':None,
         'limitations':'Only two exact source cases. Native six phones plus three complete literal bodies, never an automatic Foltern/Voltern spelling exemption. Casting FOL-tan is not canon or hearing proof.'}

def review(run,line,bindings,approval=None):
 if approval is None:return None
 template=proof_template(run,line,bindings)
 require(isinstance(approval,dict) and set(approval)==set(template) and approval.get('status')==APPROVED
         and isinstance(approval.get('reviewed_by'),str) and approval['reviewed_by'].startswith('root ') and len(approval['reviewed_by'].strip())>5
         and isinstance(approval.get('reason'),str) and len(approval['reason'].strip())>=20 and len(qa.words(approval['reason']))>=4,'Meaningful exact current root review required.')
 require(all(approval[k]==v for k,v in template.items() if k not in {'status','reviewed_by','reason'}),'Root proof differs from current complete native/body evidence.')
 return {'id':line['id'],'method':VERSION,'clip_sha256':template['clip_sha256'],'source_text_sha256':template['source_text_sha256'],'proof':copy.deepcopy(approval),
         'timing_approval':None,'acting_approval':None,'listening_verdict':None}


def main():
 import argparse
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--run-dir',type=Path,required=True)
 parser.add_argument('--id',choices=tuple(CASES),required=True)
 parser.add_argument('--bindings',type=Path,required=True,help='Private mapping of all six original evidence paths')
 parser.add_argument('--output',type=Path,required=True,help='New private unapproved template; never overwrites')
 args=parser.parse_args();run=args.run_dir.resolve()
 require(not args.output.exists() and args.output.resolve().is_relative_to(run),'New private review output required.')
 manifest=json.loads((run/'lines.private.json').read_text());line=next(r for r in manifest['lines'] if r['id']==args.id)
 result=proof_template(run,line,json.loads(args.bindings.read_text()))
 args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':
 try:main()
 except (core.SafeError,OSError,ValueError,KeyError,TypeError,StopIteration):
  raise SystemExit('Individual Foltan proof rejected; no audio, source, cache or approval mutation.')
