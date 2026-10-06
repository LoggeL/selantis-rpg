#!/usr/bin/env python3
"""Three exact, root-adopted source gesture companions. Offline, no timing claims."""
import argparse
import copy
import json
import math
from pathlib import Path
import sys
import story_voice_common as common
from story_voice_common import core
import story_voice_qa as qa
import story_voice_vocal_qc as qc
import story_voice_pff_edit as pff

VERSION='fixed-source-expressive-events-v2'
APPROVED='approved_scoped_expressive_event'
CASES={
 'story-88d0095b1020d81760acbae9':{'text':'Hrrrm … Disziplin …','index':0,'speaker':'foltan','category':'groan','sound':'urrhhh','description':'deep guttural groan transitioning into a heavy sighing exhale','location':['game/src/chapters/kapitel-4/augenbinde.ts',40]},
 'story-87fc79c20da2796dd07cd75e':{'text':'Klingt nach einem guten Zauberbuch. Ha!','index':5,'speaker':'azar','category':'laughter','sound':'huh','description':'short nasal chuckle','location':['game/src/chapters/kapitel-3/leselager.ts',143]},
 pff.ID:{'text':pff.TEXT,'index':3,'speaker':'azar','category':'other','sound':'pff','description':'suppressed chuckle followed by a breathy exhale','location':['game/src/chapters/kapitel-3/leselager.ts',78]},
 'story-db519e80df5b9bdd3da3ac26':{'text':'Ha! Siehst du die Funken? Hoffnung kann Stürme beschwören.','index':0,'speaker':'azar','category':'laughter','sound':'haha','description':'a brief, soft chuckle','location':['game/src/chapters/kapitel-4/bruderschaft.ts',306]}}

def require(condition,message):
    if not condition:raise core.SafeError(message)

def private(run,path):
    path=(run/path).resolve() if not isinstance(path,Path) else path.resolve()
    require(path.is_relative_to(run) and path.is_file(),'Expressive evidence must exist inside the private run.');return path

def object_hash(value):return qa.canonical_record_hash(value)

def observation(line,record):
    case=CASES.get(line['id'])
    require(case and line['text']==case['text'] and line.get('speaker')==case['speaker'],'Only three exact expressive source rows are supported.')
    require(any([s.get('file'),s.get('line')]==case['location'] for s in line.get('sources',[])),'Expressive source context differs.')
    value=qc.response_observation(record['response']);events=value['events'];require(len(events)==1,'Exactly one scoped source gesture event required.')
    event=events[0]
    require(event['category']==case['category'] and event['vocal_sound']==case['sound'] and event['description']==case['description'] and event['confidence']>=.8,'Scoped actual event category, verbatim description, sound or confidence differs.')
    expected=qa.words(line['text']);body=expected[:case['index']]+expected[case['index']+1:]
    require(qa.words(value['transcript'])==body,'Every nongesture source word must match literally, in order, without additions.')
    return {'source_token_index':case['index'],'source_token':expected[case['index']],'event_index':0,'event':copy.deepcopy(event),'expected_body_tokens':body,'observed_tokens':qa.words(value['transcript'])}

def provider_files(run,line,record,audio_sha):
    """Reconstruct the selected actual blind MP3 request and its completed raw batch."""
    matches=[];folder=run/'independent-vocal-qc'
    for snapshot_path in sorted((folder/'batches').glob('*/audio-snapshot.private.json')):
        snapshot=core.read_json(snapshot_path)
        entries=[e for e in snapshot.get('clips',[]) if e.get('id')==line['id'] and e.get('clip_sha256')==audio_sha]
        if not entries:continue
        batch=snapshot_path.parent
        response_path=batch/'responses.private.jsonl'
        if not response_path.exists():continue
        raw=[json.loads(s) for s in response_path.read_text().splitlines() if s.strip()]
        selected=[r for r in raw if r.get('key')==line['id'] and r.get('response')==record['response']]
        if not selected:continue
        require(len(entries)==len(selected)==1,'Duplicate selected provider evidence.')
        info=core.read_json(batch/'prepared.json');payload=(batch/'requests.jsonl').read_bytes();requests=[json.loads(s) for s in payload.splitlines() if s.strip()]
        keys=[r['key'] for r in requests];count=len(keys)
        require(count>0 and len(set(keys))==count and keys==[e['id'] for e in snapshot['clips']] and len(raw)==count and {r.get('key') for r in raw}==set(keys),'Provider full batch cardinality differs.')
        require(info.get('bank')=='independent-story-vocal-qc' and info.get('model')==qc.MODEL and info.get('request_count')==count and info.get('input_bytes')==len(payload) and info.get('input_sha256')==core.digest(payload) and info.get('snapshot_sha256')==qa.digest(snapshot_path),'QC prepared payload binding differs.')
        require(snapshot.get('source_run')==str(run) and snapshot.get('source_manifest_sha256')==qa.digest(run/'lines.private.json') and snapshot.get('source_tts_prepared_sha256')==qa.digest(run/'prepared.json') and snapshot.get('model')==qc.MODEL and snapshot.get('prompt')==qc.PROMPT and snapshot.get('prompt_sha256')==qc.text_hash(qc.PROMPT),'QC frozen source/model/prompt binding differs.')
        request=next(r['request'] for r in requests if r['key']==line['id']);entry=entries[0]
        require(request==qc.request_for((run/'clips'/(line['id']+'.mp3')).read_bytes()) and entry.get('source_audio_sha256')==audio_sha and entry.get('source_text_sha256')==qa.text_hash(line['text']) and entry.get('request_sha256')==core.digest(json.dumps(request,sort_keys=True).encode()),'Actual QC MP3 request differs.')
        intent=core.read_json(batch/'submit-intent.private.json');job=core.read_json(batch/'job.json');collection=core.read_json(batch/'collection.private.json')
        require(intent.get('state')=='CONFIRMED' and intent.get('model')==qc.MODEL and intent.get('request_count')==count and intent.get('input_sha256')==info['input_sha256'],'QC confirmed submission binding differs.')
        require(job.get('model')==qc.MODEL and job.get('state')=='JOB_STATE_SUCCEEDED' and job.get('request_count')==count and isinstance(job.get('job_name'),str) and job['job_name'].startswith('batches/'),'Completed QC provider job required.')
        require(collection.get('model')==qc.MODEL and collection.get('collected')==collection.get('expected')==count and collection.get('failures')==[],'QC collection incomplete.')
        paths=[batch/n for n in ['prepared.json','audio-snapshot.private.json','requests.jsonl','submit-intent.private.json','job.json','collection.private.json','responses.private.jsonl']]
        matches.append({str(p.relative_to(run)):qa.digest(p) for p in paths})
    require(len(matches)==1,'Exactly one completed actual provider batch required.');return matches[0]

def template(run,line,current_base_qa,current_qc):
    run=run.resolve();common.prepared(run);qa_path=private(run,current_base_qa)
    manifest=core.read_json(run/'lines.private.json');require([r for r in manifest['lines'] if r['id']==line['id']]==[line],'Current complete source row differs.')
    audio=run/'clips'/(line['id']+'.mp3');sha=qa.digest(audio);text_sha=qa.text_hash(line['text']);record=current_qc
    is_pff=line['id']==pff.ID
    if is_pff:
        receipt=core.read_json(run/'raw'/(pff.ID+'.receipt.json'));pff_evidence=pff.validate_imported(run,line,receipt)
        cache=private(run,pff.FOLDER+'/qc-raw.private.json');require(record==core.read_json(cache),'Actual direct QC envelope differs; no fake Batch cache accepted.')
    else:
        require(isinstance(record,dict) and record.get('id')==line['id'] and qc.cached_record(record,sha,text_sha),'Actual current QC cache/model/schema/STOP/prompt/source/audio required.')
        cache=private(run,'independent-vocal-qc/'+line['id']+'.'+sha[:16]+'.json');require(core.read_json(cache)==record,'Actual QC raw cache differs.')
    binding=observation(line,record)
    report=core.read_json(qa_path);takes=[t for t in report.get('takes',[]) if t.get('id')==line['id']]
    require(report.get('version')==qa.VERSION and (report.get('model')==qa.MODEL or str(report.get('model','')).startswith(qa.MODEL+':')) and report.get('manifest_sha256')==qa.digest(run/'lines.private.json') and report.get('clip_sha256',{}).get(line['id'])==sha and len(takes)==1 and takes[0].get('text_sha256')==text_sha,'Current original physical QA/source/audio required.')
    signal=takes[0].get('signal');require(isinstance(signal,dict) and type(signal.get('silent')) is bool and all(type(signal.get(k)) in (int,float) and math.isfinite(signal[k]) for k in ['seconds','clipped_fraction','peak','trailing_silence_seconds','leading_silence_seconds','last_frame_rms','rms']),'Finite complete physical QA required.')
    require(not qa.signal_failures(signal,len(qa.words(line['text']))),'Physical audio defects block expressive proof.')
    receipt_path=private(run,'raw/'+line['id']+'.receipt.json');receipt=core.read_json(receipt_path)
    require(receipt.get('id')==line['id'] and receipt.get('status')=='complete' and receipt.get('mp3_sha256')==sha and receipt.get('backend')==(pff.BACKEND if is_pff else 'batch'),'Current complete TTS MP3 receipt required.')
    legacy_paths=[]
    if 'model' in receipt:require(receipt['model']==core.MODEL,'Current TTS model differs.')
    else:
        # Original frozen Batch receipts predate the explicit model field.
        # Apply the existing finalizer's stronger frozen request/WAV/provider rule.
        requests=[json.loads(s) for s in (run/'requests.jsonl').read_text().splitlines() if s.strip()]
        selected=[r for r in requests if r.get('key')==line['id']]
        job=core.read_json(run/'job.json');status=core.read_json(run/'status.private.json');wav=run/'raw'/(line['id']+'.wav')
        require(len(selected)==1 and 'delivery_override' not in receipt and receipt.get('request_sha256')==core.digest(json.dumps(selected[0]['request'],sort_keys=True).encode()),'Legacy receipt must bind unchanged frozen original request.')
        require(receipt.get('wav_sha256')==qa.digest(wav) and job.get('model')==core.MODEL and job.get('request_count')==len(manifest['lines']) and status.get('metadata',{}).get('model','').removeprefix('models/')==core.MODEL,'Legacy WAV/frozen provider model differs.')
        legacy_paths=[run/'requests.jsonl',run/'job.json',run/'status.private.json',wav]
    files={str(p.relative_to(run)):qa.digest(p) for p in [audio,run/'lines.private.json',run/'prepared.json',qa_path,cache,receipt_path,*legacy_paths]};files.update(pff_evidence['provenance_files_sha256'] if is_pff else provider_files(run,line,record,sha))
    if is_pff:
        journal=core.read_json(run/pff.FOLDER/'import.private.json')
        for name in [pff.FOLDER+'/import.private.json',journal['root_approval_file']]:files[name]=qa.digest(private(run,name))
    return {'id':line['id'],'status':'root_review_required','reviewed_by':'','reason':'','method':VERSION,'source_text':line['text'],'source_text_sha256':text_sha,'source_row_sha256':object_hash(line),'source_manifest_sha256':qa.digest(run/'lines.private.json'),'clip_sha256':sha,'qc_record_sha256':object_hash(record),'raw_response_sha256':object_hash(record['response']),'qc_contract':qc.cache_metadata(),'model':qc.MODEL,'binding':binding,'base_take_sha256':object_hash(takes[0]),'provenance_files_sha256':files,'proof_drivers_sha256':{Path(m.__file__).name:qa.digest(Path(m.__file__)) for m in [qa,qc,common,qc.transport,core,pff]},'helper_sha256':qa.digest(Path(__file__)),'provider_timestamps_used':False,'timing_approval':None,'acting_approval':None,'listening_verdict':None}

def review(run,line,current_base_qa,current_qc,rootapproval=None):
    if rootapproval is None:return None
    expected=template(run,line,current_base_qa,current_qc)
    require(isinstance(rootapproval,dict) and set(rootapproval)==set(expected) and rootapproval.get('status')==APPROVED and isinstance(rootapproval.get('reviewed_by'),str) and rootapproval['reviewed_by'].casefold().startswith('root') and isinstance(rootapproval.get('reason'),str) and bool(rootapproval['reason'].strip()),'Explicit complete root expressive approval required.')
    require(all(json.dumps(rootapproval[k],sort_keys=True)==json.dumps(v,sort_keys=True) for k,v in expected.items() if k not in {'status','reviewed_by','reason'}),'Expressive approval stale or differs from complete raw evidence.')
    return {'id':line['id'],'method':VERSION,'resolution':'root_approved_fixed_source_gesture_full_literal_body','approval':copy.deepcopy(rootapproval),'provenance_files_sha256':expected['provenance_files_sha256'],'proof_drivers_sha256':expected['proof_drivers_sha256'],'helper_sha256':expected['helper_sha256'],'provider_timestamps_used':False,'timing_approval':None,'acting_approval':None,'listening_verdict':None}

def comparison_records(payload,pff_response=None):
    # Standard QC caches are never a direct Pff response, even with the same ID.
    if isinstance(payload,dict) and 'binding' in payload:
        require(pff_response is None and payload.get('binding',{}).get('id')==pff.ID and isinstance(payload.get('response'),dict),'Only the original direct Pff response envelope is supported.')
        return {pff.ID:payload}
    records=payload.get('records') if isinstance(payload,dict) else None
    require(isinstance(records,list) and all(isinstance(r,dict) and isinstance(r.get('id'),str) for r in records),'Invalid standard QC comparison.')
    mapping={r['id']:r for r in records};require(len(mapping)==len(records),'Duplicate QC records.')
    mapping.pop(pff.ID,None)
    if pff_response is not None:
        require(isinstance(pff_response,dict) and pff_response.get('binding',{}).get('id')==pff.ID and isinstance(pff_response.get('response'),dict) and 'records' not in pff_response,'Pff requires the original direct response envelope, never a standard cache.')
        mapping[pff.ID]=pff_response
    return mapping


def main():
    common.configure();parser=argparse.ArgumentParser(description=__doc__)
    for name in ['run-dir','base-qa-report','vocal-comparison','output']:parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--pff-qc-response',type=Path,help='Original direct pff-edited-pass14/qc-raw.private.json, separate from standard comparison.')
    args=parser.parse_args();run=core.directory(str(args.run_dir));require(args.output.resolve().is_relative_to(run) and not args.output.exists(),'Choose a new private proposal output.')
    payload=core.read_json(private(run,args.vocal_comparison))
    direct=core.read_json(private(run,args.pff_qc_response)) if args.pff_qc_response else None
    mapping=comparison_records(payload,direct)
    rows={r['id']:r for r in core.read_json(run/'lines.private.json')['lines']}
    proposals={i:template(run,rows[i],args.base_qa_report,mapping[i]) for i in CASES if i in mapping}
    require(bool(proposals),'No fixed-case actual QC supplied.')
    qa.save(args.output,{'method':VERSION,'requires_root_review':True,'proposals':proposals});print(json.dumps({'state':'UNAPPROVED_PRIVATE_PROPOSALS','count':len(proposals)}));return 0
if __name__=='__main__':
    try:raise SystemExit(main())
    except (core.SafeError,OSError,ValueError,KeyError,TypeError) as error:print(str(error) if isinstance(error,core.SafeError) else 'Invalid private expressive evidence.',file=sys.stderr);raise SystemExit(1)
