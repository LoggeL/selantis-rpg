#!/usr/bin/env python3
"""One source-bound A681 gesture/word companion. Offline; no inference or caches.

Actual full Large-v3 supplies every word. Actual free CTC supplies the complete
nongesture body. Blind QC supplies only its one mmmh event, never its Zehen word.
"""
from __future__ import annotations
import argparse
import base64
import copy
import hashlib
import json
import math
from pathlib import Path
import subprocess
import story_voice_common as common
from story_voice_common import core
import story_voice_qa as qa
import story_voice_ctc_lexical_variants as ctc
import story_voice_vocal_qc as qc
import story_voice_expressive_events as expressive

ID='story-a681e6abd96e79331d717fc1'
TEXT='Mmh … Bei allen Zehn. So was hab ich seit Jahren nicht gegessen.'
VOICE='Algenib'
VERSION='story-a681-source-gesture-full-body-word-evidence-v1'
APPROVED='approved_a681_source_gesture_full_body_word_evidence'
KEYS={'qa_report_path','free_record_path','ctc_record_path','qc_record_path','historical_timing_context_path'}
FREE_PARAMS={'language':'de','initial_prompt':None,'condition_on_previous_text':False,'temperature':0,'word_timestamps':True,'verbose':False}
EVENT={'category':'groan','description':'deep, satisfied vocal groan or hum','vocal_sound':'mmmh','confidence':.85}

def require(ok,message):
    if not ok:raise core.SafeError(message)
def canonical(x):return json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False)
def object_hash(x):return hashlib.sha256(canonical(x).encode()).hexdigest()
def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def protected_scripts():
    return {**{str(Path(m.__file__).resolve()):digest(m.__file__) for m in [common,core,qa,ctc,qc,expressive]},
        str(Path(__file__).with_name('story_voice_ctc_align.py').resolve()):digest(Path(__file__).with_name('story_voice_ctc_align.py'))}

def words(line,transcript,gesture):
    require(line.get('id')==ID and line.get('text')==TEXT and line.get('speaker')=='algard','Only the exact authored A681 case is supported.')
    expected=qa.words(TEXT);actual=qa.words(transcript)
    body=expected[1:];body[5]='habe'
    require(expected[6]=='hab' and qa.natural_variant_allowed(line,6,'hab','habe'),'Existing adjacent-ich hab/habe guard required.')
    observed=['mhh',*body] if gesture else body
    require(actual==observed,'Complete literal A681 body with only its explicit Mmh/Mhh and hab/habe pairs required.')
    return {'expected_tokens':expected if gesture else expected[1:],'observed_tokens':actual,'transcript':transcript,
        'transcript_sha256':qa.text_hash(transcript),'hab_habe_pair':{'source_word_index':6,'expected':'hab','observed':'habe','existing_natural_schwa_guard':True},
        'gesture_pair':{'source_word_index':0,'expected':'mmh','observed':'mhh','scope':ID,'kind':'single_written_nonlexical_mmh_variant'} if gesture else None}

def complete_free_words(line,actual,raw_words):
    require(isinstance(actual,dict) and set(actual)=={'text','segments','language'} and actual['language']=='de'
        and isinstance(actual['text'],str) and isinstance(actual['segments'],list),'Complete actual free German schema required.')
    require(isinstance(raw_words,list) and bool(raw_words) and raw_words==[w for s in actual['segments'] for w in s.get('words',[])],
        'Original full raw words must equal all actual segment words.')
    for word in raw_words:
        require(isinstance(word,dict) and set(word)=={'word','start','end','probability'} and isinstance(word['word'],str)
            and all(type(word[k]) in (int,float) and math.isfinite(word[k]) for k in ['start','end','probability'])
            and 0<=word['start']<=word['end'] and 0<=word['probability']<=1,'Original raw full word record schema invalid.')
    require(qa.words(''.join(w['word'] for w in raw_words))==qa.words(actual['text']),'Full raw word records differ from complete actual text.')
    return words(line,actual['text'],True)

def native_ctc_frames(sample_count,config):
    require(type(sample_count) is int and sample_count>0 and isinstance(config.get('conv_kernel'),list)
        and isinstance(config.get('conv_stride'),list) and len(config['conv_kernel'])==len(config['conv_stride'])>0,'Actual CTC convolution geometry missing.')
    count=sample_count
    for kernel,stride in zip(config['conv_kernel'],config['conv_stride']):
        require(type(kernel) is int and type(stride) is int and kernel>0 and stride>0,'Invalid actual CTC convolution geometry.')
        count=(count-kernel)//stride+1
    require(count>0,'Actual CTC audio must yield complete frames.')
    return count

def proof_template(run,line,bindings):
    run=Path(run).resolve();require(run.is_relative_to(qa.PRIVATE.resolve()),'Private story run required.')
    require(set(bindings)==KEYS,'Complete A681 binding paths required.')
    words(line,TEXT.replace('Mmh','Mhh').replace('hab ich','habe ich'),True)
    provenance={}
    def path(value,external=False):
        p=Path(value);p=(p if p.is_absolute() else run/p).resolve()
        require(p.is_file() and (external or p.is_relative_to(run)),'Missing or nonprivate A681 evidence.')
        provenance[str(p)]=digest(p);return p
    def load(value):return json.loads(path(value).read_text())
    common.prepared(run)
    manifest=load('lines.private.json');require([r for r in manifest['lines'] if r['id']==ID]==[line],'Complete current A681 source row differs.')
    for name in ['prepared.json','requests.jsonl','source-snapshot.private.json','full-inventory.private.json']:path(name)
    profiles=load('profiles.private.json');require(profiles['speakers']['algard']['google_voice']==VOICE,'Fixed A681 voice differs.')
    audio=path('clips/'+ID+'.mp3');wav=path('raw/'+ID+'.wav');receipt=load('raw/'+ID+'.receipt.json');ah=digest(audio);sh=qa.text_hash(TEXT)
    require(receipt['id']==ID and receipt['status']=='complete' and receipt['model']==core.MODEL and receipt['mp3_sha256']==ah and receipt['wav_sha256']==digest(wav),'Current original TTS audio/receipt/model differs.')
    delivery=receipt.get('delivery_override',{});require(delivery.get('type')=='brief_delivery' and ''.join(p['text'] for p in delivery['parts'])==TEXT,'A681 delivery must preserve every authored word.')
    # Retain the actual submitted TTS request/provider WAV and exact fixed cast.
    matching=[p.parent.parent for p in (run/'retake-batches').glob('*/raw/'+ID+'.receipt.json') if digest(p)==digest(run/'raw'/(ID+'.receipt.json'))]
    require(len(matching)==1,'One actual current A681 TTS batch required.');child=matching[0]
    for name in ['lines.private.json','profiles.private.json','prepared.json','parent-snapshot.private.json','requests.jsonl','responses.private.jsonl','submit-intent.private.json','job.json','collection.private.json','raw/'+ID+'.receipt.json','raw/'+ID+'.wav','clips/'+ID+'.mp3']:path(child/name)
    cm=load(child/'lines.private.json');require([r for r in cm['lines'] if r['id']==ID]==[line],'Submitted child source row differs.')
    cp=load(child/'profiles.private.json');require(cp['speakers']['algard']['google_voice']==VOICE,'Submitted child voice differs.')
    requests=[json.loads(s) for s in (child/'requests.jsonl').read_text().splitlines() if s.strip()];selected=[r for r in requests if r['key']==ID]
    require(len(selected)==1,'Unique actual TTS request required.');request=selected[0]['request']
    require(core.digest(json.dumps(request,sort_keys=True).encode())==receipt['request_sha256'] and request['generationConfig']['speechConfig']['voiceConfig']['voice']==VOICE,'Actual TTS request/cast hash differs.')
    require(''.join(p['text'] for c in request['contents'] for p in c['parts'])==TEXT,'Actual TTS request changed authored words.')
    responses=[json.loads(s) for s in (child/'responses.private.jsonl').read_text().splitlines() if s.strip()];selected=[r['response'] for r in responses if r['key']==ID]
    require(len(selected)==1,'Unique actual TTS provider response required.');response=selected[0]
    require(response.get('modelVersion')==core.MODEL and len(response['candidates'])==1 and response['candidates'][0]['finishReason']=='STOP','Actual complete TTS model response required.')
    parts=response['candidates'][0]['content']['parts'];require(len(parts)==1 and parts[0]['inlineData']['mimeType']=='audio/wav' and base64.b64decode(parts[0]['inlineData']['data'],validate=True)==wav.read_bytes(),'Actual TTS raw WAV differs.')
    report=load(bindings['qa_report_path']);require(report.get('version')==qa.VERSION and (report.get('model')==qa.MODEL or str(report.get('model','')).startswith(qa.MODEL+':')) and report['manifest_sha256']==digest(run/'lines.private.json') and report['clip_sha256'][ID]==ah,'Current base QA decoder/source/audio differs.')
    takes=[t for t in report['takes'] if t['id']==ID];require(len(takes)==1 and takes[0]['text_sha256']==sh,'Unique current QA take required.');take=takes[0];signal=take['signal']
    require(signal.get('silent') is False and all(type(signal.get(k)) in (int,float) and math.isfinite(signal[k]) for k in ['seconds','peak','rms','clipped_fraction','leading_silence_seconds','trailing_silence_seconds','last_frame_rms']) and not qa.signal_failures(signal,len(qa.words(TEXT))),'A681 physical QA failure.')
    require(set(take['reasons'])<={'asr_lexical_mismatch_requires_review','asr_check_failed_ValueError'} and {f['reason'] for f in report['failures'] if f['id']==ID}==set(take['reasons']),'Unaccounted or inconsistent A681 QA failure.')
    fr=load(bindings['free_record_path']);require(fr['id']==ID and fr['method']=='actual-unprompted-full-whisper-large-v3-word-timestamps-v1' and fr['approval'] is None,'Original actual full Large-v3 result required.')
    fp=path(bindings['free_record_path']).parent;plan=load(fp/'plan.private.json');require(fr['plan_sha256']==digest(fp/'plan.private.json') and fr['runner_sha256']==digest(path(fp/'root-runner.py'))==plan['runner_sha256'],'Original free plan/runner differs.')
    require(fr['parameters']==plan['parameters']==FREE_PARAMS and Path(plan['model_directory']).name=='whisper-large-v3','Blind complete Large-v3 model/parameters required.')
    for key in ['model_files_sha256','runtime_files_sha256']:
        require(fr[key]==plan[key] and bool(fr[key]),'Free actual model/runtime fingerprint differs.')
        for p,h in fr[key].items():require(digest(path(p,True))==h,'Actual free model/runtime bytes differ.')
    b=fr['binding'];require(b['id']==ID and b['clip_sha256']==ah and b['text_sha256']==sh and b['source_manifest_sha256']==digest(run/'lines.private.json') and b['source_reference_only']['source_row']==line and fr['source_reference_only']==b['source_reference_only'],'Actual free source-only context/audio differs.')
    clips=[x for x in plan['clips'] if x['id']==ID];require(clips==[b],'Exact original free planned case required.')
    intent=load(fp/(ID+'.intent.private.json'));session=load(fp/'root-run-intent.private.json');completed=load(fp/'root-run-complete.private.json')
    require(intent['binding']==b and intent['plan_sha256']==fr['plan_sha256'] and intent['parameters']==FREE_PARAMS and intent['authored_initial_prompt'] is None and session['plan_sha256']==fr['plan_sha256'] and session['runner_sha256']==fr['runner_sha256'] and session['parameters']==FREE_PARAMS and completed['plan_sha256']==fr['plan_sha256'] and completed['count']==session['count']==len(plan['clips']) and completed['model_and_runtime_reverified'] is True,'Actual prior free intent/completion differs.')
    historical=path(bindings['historical_timing_context_path']);cue=run/'word-cues'/(ID+'.json');require(digest(historical)==b['input_sha256'][str(cue)],'Exact original cue-reference bytes required, never a timing approval.')
    references={}
    for p,h in b['input_sha256'].items():
        if Path(p).resolve()==cue:references[p]={'original_sha256':h,'historical_file':str(historical),'timing_used':False};continue
        require(digest(path(p))==h,'Free actual audio/receipt input changed.')
    actual=fr['actual_free_result'];free_words=complete_free_words(line,actual,fr['actual_words'])
    pcm=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(audio),'-f','f32le','-ac','1','-ar','16000','pipe:1'])
    require(fr['decoded_audio']['sample_rate']==16000 and fr['decoded_audio']['f32le_sha256']==hashlib.sha256(pcm).hexdigest() and fr['decoded_audio']['sample_count']==len(pcm)//4,'Actual free PCM differs.')
    cr=load(bindings['ctc_record_path']);model=cr['binding']['model'];md=Path(model['local_directory']);require(bool(model['file_sha256']),'Actual CTC model files required.')
    for name,h in model['file_sha256'].items():require(digest(path(md/name,True))==h,'Actual pinned CTC model bytes differ.')
    cpath=path(bindings['ctc_record_path']);envelope={'receipt':cr,'receipt_path':str(cpath),'receipt_sha256':digest(cpath),'vocab':load(md/'vocab.json') if md.is_relative_to(run) else json.loads(path(md/'vocab.json',True).read_text()),
        'vocab_sha256':digest(md/'vocab.json'),'actual_script_sha256':digest(Path(__file__).with_name('story_voice_ctc_align.py')),
        'actual_model_file_states':{str(md/name):ctc.file_state(md/name) for name in model['file_sha256']}}
    ct=ctc.validated_greedy(line,ah,digest(run/'lines.private.json'),envelope);require(isinstance(ct,str),'Actual current free CTC frames/source/model binding invalid.');ctc_words=words(line,ct,False)
    cfg=json.loads(path(md/'config.json',True).read_text());require(len(cr['greedy_decode']['argmax_token_ids'])==native_ctc_frames(len(pcm)//4,cfg),'Actual complete CTC frame count differs from the current audio/model geometry.')
    qr=load(bindings['qc_record_path']);require(qr['id']==ID and qc.cached_record(qr,ah,sh),'Actual current blind QC model/response/schema/source/audio required.')
    observation=qc.response_observation(qr['response']);require(observation['events']==[EVENT],'Only the actual single mmmh source-groan observation is supported.')
    provider=expressive.provider_files(run,line,qr,ah)
    for p,h in provider.items():require(digest(path(p))==h,'Original QC provider ledger changed.')
    return {'id':ID,'method':VERSION,'status':'root_review_required','reviewed_by':'','reason':'','clip_sha256':ah,'source_text_sha256':sh,
        'source_row':copy.deepcopy(line),'source_row_sha256':object_hash(line),'source_profiles_sha256':digest(run/'profiles.private.json'),'voice':VOICE,
        'qa_take':copy.deepcopy(take),'actual_full_LargeV3_words':free_words,'actual_free_CTC_body':ctc_words,
        'original_full_LargeV3_raw_word_records':copy.deepcopy(fr['actual_words']),'actual_source_gesture_event':copy.deepcopy(EVENT),
        'QC_diagnosis_only':{'transcript':qr['transcript'],'raw_response_sha256':qa.canonical_record_hash(qr['response']),'QC_words_used_as_body_proof':False},
        'historical_reference_only':references,'provenance_files_sha256':provenance,'protected_script_sha256':protected_scripts(),'helper_script_sha256':digest(__file__),
        'limits':'Only exact A681 Mmh/Mhh and adjacent-ich hab/habe. QC Zehen is retained, never approved as Zehn. No missing/extra/name/F-V/vowel allowance, timing, acting or human listening.'}

def review(run,line,bindings,approval=None):
    if approval is None:return None
    template=proof_template(run,line,bindings)
    require(isinstance(approval,dict) and set(approval)==set(template) and approval.get('status')==APPROVED and isinstance(approval.get('reviewed_by'),str) and approval['reviewed_by'].casefold().startswith('root ') and isinstance(approval.get('reason'),str) and len(approval['reason'].strip())>=20 and len(approval['reason'].split())>=4,'Complete explicit A681 Root review required.')
    require(all(canonical(approval[k])==canonical(v) for k,v in template.items() if k not in {'status','reviewed_by','reason'}),'A681 review differs from exact current source/raw/model proof.')
    return {'id':ID,'method':VERSION,'resolution':'root_approved_a681_gesture_full_body_word_evidence','clip_sha256':template['clip_sha256'],
        'source_text_sha256':template['source_text_sha256'],'proof':template,'approval':copy.deepcopy(approval),
        'provider_timestamps_used':False,'timing_approval':None,'acting_approval':None,'listening_verdict':None}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run-dir',required=True,type=Path)
    for key in sorted(KEYS):p.add_argument('--'+key.replace('_','-'),required=True,type=Path)
    p.add_argument('--dry-run',required=True,action='store_true');a=p.parse_args();run=a.run_dir.resolve();line=next(r for r in json.loads((run/'lines.private.json').read_text())['lines'] if r['id']==ID)
    print(json.dumps({ID:proof_template(run,line,{k:str(getattr(a,k)) for k in KEYS})},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
