#!/usr/bin/env python3
"""One explicitly reviewed c83b word case. Offline evidence only; no inference.

Pro and actual free large-v3 cover every other authored word literally. Native
Meta frames support only the selected onset observation. No primary Foltern
approval, duration/canonical pronunciation or human listening claim follows.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import subprocess
import numpy as np
import story_voice_common as common
import story_voice_qa as qa
import story_voice_pro_asr as pro
from story_voice_common import core

VERSION='story-c83b-meta-full-body-word-evidence-v1'
APPROVED='approved_c83b_meta_full_body_word_evidence'
ID='story-c83b8874d9d1aa88ac244abd'
TEXT='Er lügt. Und er weiß, dass er lügt. Ich merke mir das, Foltan.'
INDEX=12  # zero based: thirteenth authored token
MODEL='facebook/wav2vec2-xlsr-53-espeak-cv-ft'
REVISION='2c733782da5604684829819a5eb744c193fe9398'
KEYS={'qa_report_path','pro_record_path','free_record_path','meta_evaluation_path','historical_timing_context_path'}

def require(ok,message):
    if not ok:raise core.SafeError(message)

def canonical(x):return json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False)
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def object_hash(x):return hashlib.sha256(canonical(x).encode()).hexdigest()
def native_hash(x):return hashlib.sha256(json.dumps(x,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def tree(root):return {str(p.relative_to(root)):digest(p) for p in sorted(Path(root).rglob('*')) if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc'}

def body(line,transcript,observed):
    require(line.get('id')==ID and line.get('text')==TEXT,'Only exact c83b authored source supported.')
    a,b=qa.words(TEXT),qa.words(transcript)
    require(len(a)==len(b) and a[INDEX]=='foltan' and b[INDEX]==observed,'Exact whole-body count and scoped name required.')
    require(all(x==y for i,(x,y) in enumerate(zip(a,b)) if i!=INDEX),'Every other source word must remain literal.')
    return {'transcript':transcript,'transcript_sha256':qa.text_hash(transcript),'expected_tokens':a,'observed_tokens':b,'word_index':INDEX,'expected':'foltan','observed':observed}

def native_frames(logits,probabilities,ids,vocab,observation,selected):
    require(logits.ndim==3 and logits.shape[0]==1 and logits.shape[2]==392 and logits.shape[1]>0,'Complete native 392-class matrix required.')
    require(np.isfinite(logits).all() and probabilities.shape==logits.shape[1:] and np.isfinite(probabilities).all(),'Invalid raw matrices.')
    require(ids.shape==(logits.shape[1],) and np.array_equal(ids,logits[0].argmax(axis=-1)),'Actual argmax differs.')
    shifted=logits[0].astype(np.float64)-logits[0].max(axis=-1,keepdims=True)
    calculated=np.exp(shifted);calculated/=calculated.sum(axis=-1,keepdims=True)
    require(np.array_equal(calculated,probabilities),'Actual full softmax matrix differs.')
    labels={int(v):k for k,v in vocab.items()};events=[];previous=None
    for frame,token in enumerate(ids):
        token=int(token)
        if token!=previous and token!=0:events.append({'frame_index':frame,'class_id':token,'token':labels[token],'actual_argmax_softmax_probability':float(probabilities[frame,token])})
        previous=token
    require(events==observation['emitted_raw_tokens'] and ' '.join(e['token'] for e in events)==observation['raw_ipa']==observation['native_decode'],'Native full collapsed output differs.')
    start,end=selected['start_index'],selected['end_index_exclusive'];chosen=events[start:end]
    require([e['token'] for e in chosen]==['f','ɔ','l','t','ɑː','n'],'Only the actual scoped six-phone observation supported.')
    first=chosen[0];f=float(probabilities[first['frame_index'],vocab['f']]);v=float(probabilities[first['frame_index'],vocab['v']])
    require(f>=.95 and v<=.02 and f>v,'Selected actual f onset lacks required native evidence.')
    return {'full_verbatim_free_ipa':observation['raw_ipa'],'selected_event_indices':selected,'selected_events':chosen,'selected_f_uncalibrated_softmax':f,'selected_v_uncalibrated_softmax':v,'no_vowel_duration_or_canonical_name_claim':True}

def validate_free_inputs(run,record,historical_path,register_path):
    """Timing was reference metadata, never inference input; retain exact archive."""
    run=Path(run).resolve()
    old_path=str(run/'word-cues'/ (ID+'.json'))
    inputs=record['binding']['input_sha256']
    require(old_path in inputs,'Original exact scoped timing reference required.')
    archive=register_path(historical_path)
    require(str(archive)!=old_path,'Historical timing reference must use a separate archive.')
    require(digest(archive)==inputs[old_path],'Historical timing archive differs from original reference.')
    for value,expected in inputs.items():
        if value==old_path:continue
        require(digest(register_path(value))==expected,'Free current source/audio/raw input changed.')
    return {'original_reference_path':old_path,'original_reference_sha256':inputs[old_path],
            'immutable_archive_path':str(archive),'immutable_archive_sha256':digest(archive),
            'role':'Historical reference metadata only, never passed into free word inference.'}


def proof_template(run,line,bindings):
    run=Path(run).resolve();require(run.is_relative_to(qa.PRIVATE.resolve()),'Private run required.')
    body(line,TEXT.replace('Foltan','Voltan'),'voltan')
    require(set(bindings)==KEYS,'Complete explicit binding paths required.')
    provenance={}
    def path(value,external=False):
        p=Path(value);p=(p if p.is_absolute() else run/p).resolve()
        require(p.is_file() and (external or p.is_relative_to(run)),'Evidence path unavailable or outside run.')
        provenance[str(p)]=digest(p);return p
    def load(value):return json.loads(path(value).read_text())
    common.prepared(run)
    for name in ['prepared.json','requests.jsonl','source-snapshot.private.json','full-inventory.private.json']:path(name)
    manifest=load('lines.private.json');require([x for x in manifest['lines'] if x['id']==ID]==[line],'Current frozen source row differs.')
    profiles=load('profiles.private.json');require(profiles['speakers'][line['speaker']]['google_voice']=='Zephyr','Frozen c83b cast changed.');audio=path('clips/'+ID+'.mp3');ah=digest(audio);sh=qa.text_hash(TEXT)
    report=load(bindings['qa_report_path']);require(report.get('version')==qa.VERSION and (report.get('model')==qa.MODEL or str(report.get('model','')).startswith(qa.MODEL+':')),'Original QA decoder/version required.');require(report['manifest_sha256']==provenance[str(run/'lines.private.json')] and report['clip_sha256'][ID]==ah,'QA source/audio changed.')
    take=[x for x in report['takes'] if x['id']==ID];require(len(take)==1 and take[0]['text_sha256']==sh,'Unique bound QA take required.');take=take[0]
    signal=take['signal'];require(all(isinstance(signal.get(k),(int,float)) and math.isfinite(signal[k]) for k in ['seconds','peak','rms','clipped_fraction','leading_silence_seconds','trailing_silence_seconds','last_frame_rms']) and signal.get('silent') is False and not qa.signal_failures(signal,len(qa.words(TEXT))),'Physical QA failure.')
    allowed={'asr_lexical_mismatch_requires_review','asr_check_failed_ValueError'};require(set(take['reasons'])<=allowed and {x['reason'] for x in report['failures'] if x['id']==ID}==set(take['reasons']),'Nonword or inconsistent QA failure.')
    pr=load(bindings['pro_record_path']);require(pr['id']==ID and pro.cached_record(pr,ah,sh),'Actual blind Pro raw/model/prompt/source/audio proof invalid.')
    for key in ['batch_scope_file','batch_response_file']:path(pr[key])
    child=path(pr['batch_scope_file']).parent
    for name in ['prepared.json','audio-snapshot.private.json','submit-intent.private.json','job.json']:path(child/name)
    path('independent-pro-asr/batch-reservations.private.json')
    pe=body(line,pr['transcript'],'voltan')
    fr=load(bindings['free_record_path']);require(fr['id']==ID and fr['method']=='actual-unprompted-full-whisper-large-v3-word-timestamps-v1' and fr['approval'] is None,'True unapproved full large-v3 record required.')
    require(fr['binding']['source_reference_only']['source_row']==line and fr['binding']['clip_sha256']==ah and fr['binding']['text_sha256']==sh,'Free source/audio differs.')
    fp=Path(bindings['free_record_path']);fp=(fp if fp.is_absolute() else run/fp).resolve();plan=load(fp.parent/'plan.private.json');require(digest(path(fp.parent/'plan.private.json'))==fr['plan_sha256'] and digest(path(fp.parent/'root-runner.py'))==fr['runner_sha256']==plan['runner_sha256'],'Free plan/runner differs.')
    params={'language':'de','initial_prompt':None,'condition_on_previous_text':False,'temperature':0,'word_timestamps':True,'verbose':False};require(fr['parameters']==plan['parameters']==params,'Free decoder must be complete and blind.')
    for key in ['model_files_sha256','runtime_files_sha256']:
        require(fr[key]==plan[key],'Free model/runtime identity differs.')
        for p,h in fr[key].items():require(digest(path(p,True))==h,'Free model/runtime bytes changed.')
    intent=load(fp.parent/(ID+'.intent.private.json'));require(intent['binding']==fr['binding'] and intent['plan_sha256']==fr['plan_sha256'] and intent['authored_initial_prompt'] is None,'Prior free intent differs.')
    historical=validate_free_inputs(run,fr,bindings['historical_timing_context_path'],path)
    require(Path(plan['model_directory']).name=='whisper-large-v3' and fr['actual_free_result']['language']=='de' and set(fr['actual_free_result'])=={'text','segments','language'},'Actual full large-v3 schema/model differs.')
    require(fr['actual_words']==[w for s in fr['actual_free_result']['segments'] for w in s.get('words',[])],'Free full words incomplete.')
    fe=body(line,fr['actual_free_result']['text'],'volltan')
    pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(audio),'-f','f32le','-ac','1','-ar','16000','pipe:1']);require(hashlib.sha256(pcm).hexdigest()==fr['decoded_audio']['f32le_sha256'] and len(pcm)//4==fr['decoded_audio']['sample_count'],'Actual free PCM differs.')
    me=load(bindings['meta_evaluation_path']);z=[x for x in me['records'] if x['id']==ID];require(len(z)==1,'Unique Meta case required.');z=z[0]
    mp=Path(bindings['meta_evaluation_path']);mp=(mp if mp.is_absolute() else run/mp).resolve();mp=mp.parent;pl=load(mp/'plan.private.json')
    completed=load(mp/'completion.private.json');execution=load(mp/'execution-intent.private.json')
    require(digest(path(mp/'completion.private.json'))==me['completion_sha256'] and digest(path(mp/'execution-intent.private.json'))==me['execution_intent_sha256'] and completed['plan_sha256']==digest(path(mp/'plan.private.json')) and completed['runner_sha256']==pl['runner_sha256'] and execution['model']==MODEL and execution['revision']==REVISION and execution['mp3_sha256'][ID]==ah,'Actual Meta prior execution/completion differs.')
    require(pl['model']==MODEL and pl['revision']==REVISION and pl['params']['source_text_input'] is False and pl['params']['forced_alignment'] is False and pl['params']['lexicon'] is None and pl['params']['language_hint'] is None,'Meta model/blind decoder differs.')
    require(digest(path(mp/'runner.py'))==pl['runner_sha256']==me['runner_sha256'],'Meta runner differs.')
    modeldir=Path(pl['model_directory']);require(tree(modeldir)==pl['model_files'] and native_hash(pl['model_files'])==pl['model_tree_sha256'],'Meta pinned model bytes differ.')
    for entry in pl['runtime_bindings'].values():
        for p,h in entry['metadata'].items():require(digest(path(Path(entry['root'])/p,True))==h,'Meta runtime metadata differs.')
    for package in ['torch','transformers','numpy','tokenizers','safetensors']:
        entry=pl['runtime_bindings'][package];require(native_hash(tree(Path(entry['root'])/package))==entry['installed_tree_sha256'],'Meta actual runtime tree differs.')
    observation=load(z['observation_file']);require(z['voice']==profiles['speakers'][line['speaker']]['google_voice'],'Actual Meta fixed voice differs.');require(observation['id']==ID and observation['source_mp3_sha256']==ah and observation['recognizer_received_expected_text'] is False and observation['model']==MODEL and observation['revision']==REVISION,'Native observation identity differs.')
    for key in ['observation','forward_intent','raw_logits','full_frame_probabilities','argmax_ids']:require(digest(path(z[key+'_file']))==z[key+'_sha256'],'Meta original raw file differs.')
    intent=load(z['forward_intent_file']);require(intent['id']==ID and intent['mp3_sha256']==ah and intent['pcm_sha256']==hashlib.sha256(pcm).hexdigest() and intent['runner_sha256']==pl['runner_sha256'] and intent['model_tree_sha256']==pl['model_tree_sha256'] and observation['forward_intent_sha256']==digest(path(z['forward_intent_file'])),'Meta prior intent changed.');require(observation['runtime_bindings_sha256']==native_hash(pl['runtime_bindings']) and observation['plan_sha256']==digest(path(mp/'plan.private.json')) and observation['actual_params']==pl['params'] and observation['actual_params_sha256']==native_hash(pl['params']),'Meta raw runtime/parameters changed.');
    require(observation['decoded_pcm_sha256']==hashlib.sha256(pcm).hexdigest() and z['source_text_context_only']==TEXT and z['speaker']==line['speaker'],'Meta source/PCM/speaker differs.')
    native=native_frames(np.load(path(z['raw_logits_file']),allow_pickle=False),np.load(path(z['full_frame_probabilities_file']),allow_pickle=False),np.load(path(z['argmax_ids_file']),allow_pickle=False),json.loads((modeldir/'vocab.json').read_text()),observation,z['posthoc_emission_indices'])
    require(native['full_verbatim_free_ipa']==z['full_verbatim_free_ipa'] and observation['emitted_raw_tokens']==z['full_verbatim_emissions'],'Evaluation full native events differ.')
    require(native['selected_f_uncalibrated_softmax']==z['onset_f_uncalibrated_softmax'] and native['selected_v_uncalibrated_softmax']==z['onset_v_uncalibrated_softmax'],'Evaluation selected frame differs.')
    return {'status':'root_review_required','reviewed_by':'','reason':'','method':VERSION,'id':ID,'clip_sha256':ah,'source_text_sha256':sh,'source_row':copy.deepcopy(line),'source_row_sha256':object_hash(line),'source_profiles_sha256':provenance[str(run/'profiles.private.json')],'voice':z['voice'],'qa_take':take,'pro_evidence':pe,'actual_free_large_v3_evidence':fe,'historical_timing_context':historical,'native_Meta_evidence':native,'model':MODEL,'revision':REVISION,'model_files':pl['model_files'],'runtime_bindings':pl['runtime_bindings'],'provenance_files_sha256':provenance,'protected_script_sha256':{str(Path(module.__file__).resolve()):digest(module.__file__) for module in [qa,common,core,pro,pro.transport,pro.transport.asr]},'helper_script_sha256':digest(__file__),'limitations':'Only this source-bound case; no Primary Foltern approval, source correction, timestamps, vowel duration, canonical name or human hearing verdict.'}

def review(run,line,bindings,approval=None):
    if approval is None:return None
    template=proof_template(run,line,bindings)
    require(isinstance(approval,dict) and set(approval)==set(template) and approval.get('status')==APPROVED and isinstance(approval.get('reviewed_by'),str) and approval['reviewed_by'].casefold().startswith('root') and isinstance(approval.get('reason'),str) and bool(approval['reason'].strip()),'Explicit complete Root review required.')
    require(all(canonical(approval[k])==canonical(v) for k,v in template.items() if k not in {'status','reviewed_by','reason'}),'Approval differs from exact current proof.')
    return {'id':ID,'resolution':'root_approved_c83b_meta_full_body_word_evidence','method':VERSION,'clip_sha256':template['clip_sha256'],'source_text_sha256':template['source_text_sha256'],'proof':template,'approval':copy.deepcopy(approval),'listening_verdict':None,'provider_timestamps_used':False}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True)
    for key in sorted(KEYS):p.add_argument('--'+key.replace('_','-'),type=Path,required=True)
    p.add_argument('--dry-run',action='store_true',required=True);a=p.parse_args();run=a.source.resolve();manifest=json.loads((run/'lines.private.json').read_text());line=next(x for x in manifest['lines'] if x['id']==ID)
    print(json.dumps({ID:proof_template(run,line,{k:str(getattr(a,k)) for k in KEYS})},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
