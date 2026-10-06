#!/usr/bin/env python3
"""Three scoped, root-reviewed orthographic segmentation proofs, offline only."""
import argparse
import copy
import json
import math
from pathlib import Path
import sys
import unicodedata
import story_voice_common as common
from story_voice_common import core
import story_voice_qa as qa
import story_voice_transcribe as flash
import story_voice_pro_asr as pro

VERSION='three-scoped-orthographic-segments-v1'
APPROVED='approved_orthographic_segments'
CASES={
 'story-07ec2f63c4b40ae2ad9b5041':{'text':'Zu Hause hatten wir Zunder. Den hätte ich besser mitgenommen. Dann eben mit trockenem Laub.','index':0,'source':['zu','hause'],'observed':['zuhause'],'channels':['Flash']},
 'story-3b5ff15632d6ea6a52aad28c':{'text':'Kyras Bett: glatt gezogen. Meins: ein Schlachtfeld. Ich hätte es heute Morgen machen sollen.','index':2,'source':['glatt','gezogen'],'observed':['glattgezogen'],'channels':['Pro']},
 'story-e5cd2416185c2fd497bcecec':{'text':'Für das Mädchen, das sie dabeihatten. Sie soll ihrem Hauptmann gefallen, hat er gesagt. Pah!','index':5,'source':['dabeihatten'],'observed':['dabei','hatten'],'channels':['Flash','Pro']}}

def require(condition,message):
    if not condition:raise core.SafeError(message)

def characters(text):return ''.join(c for c in unicodedata.normalize('NFC',text).casefold() if c.isalnum())

def segmentation(line,transcript):
    case=CASES.get(line['id']);require(case is not None and line['text']==case['text'],'Orthographic proof is limited to three exact source rows.')
    expected=qa.words(line['text']);index=case['index'];require(expected[index:index+len(case['source'])]==case['source'],'Scoped source segment differs.')
    allowed=expected[:index]+case['observed']+expected[index+len(case['source']):]
    require(qa.words(transcript)==allowed and characters(line['text'])==characters(transcript),'Only the exact scoped segmentation, with full identical character stream, is allowed.')
    return expected,allowed

def private(run,name):
    path=(run/name).resolve() if not isinstance(name,Path) else name.resolve()
    require(path.is_relative_to(run.resolve()) and path.is_file(),'Proof file must be current and private within the run.');return path

def template(run,line,qa_path,records):
    common.prepared(run);case=CASES.get(line['id']);require(case and line['text']==case['text'],'Unsupported orthographic case.')
    manifest_path=run/'lines.private.json';manifest=core.read_json(manifest_path);require([r for r in manifest['lines'] if r['id']==line['id']]==[line],'Current complete source row differs.')
    manifest_sha=qa.digest(manifest_path);sha=qa.digest(run/'clips'/(line['id']+'.mp3'));report=core.read_json(private(run,qa_path));takes=[r for r in report.get('takes',[]) if r.get('id')==line['id']]
    require(report.get('version')==qa.VERSION and (report.get('model')==qa.MODEL or str(report.get('model','')).startswith(qa.MODEL+':')) and report.get('manifest_sha256')==manifest_sha and report.get('clip_sha256',{}).get(line['id'])==sha and len(takes)==1 and takes[0].get('text_sha256')==qa.text_hash(line['text']),'Current original QA/source/audio binding required.')
    signal=takes[0].get('signal');require(isinstance(signal,dict) and type(signal.get('silent')) is bool and all(type(signal.get(k)) in (int,float) and math.isfinite(signal[k]) for k in ['seconds','clipped_fraction','peak','trailing_silence_seconds','leading_silence_seconds','last_frame_rms','rms']),'Complete finite physical QA metrics required.')
    require(not qa.signal_failures(takes[0]['signal'],len(qa.words(line['text']))),'Physical audio failure blocks segmentation proof.')
    require(set(records)==set(case['channels']),'Exactly the scoped independent raw channels are required.')
    files={str(p.relative_to(run)):qa.digest(p) for p in [manifest_path,run/'clips'/(line['id']+'.mp3'),private(run,qa_path)]};channels={}
    for channel,record in records.items():
        backend=flash if channel=='Flash' else pro
        require(record.get('id')==line['id'] and backend.cached_record(record,sha,qa.text_hash(line['text'])),'Actual current raw ASR provenance required.')
        transcript=backend.response_transcript(record['response']);expected,observed=segmentation(line,transcript)
        folder='independent-google-asr' if channel=='Flash' else pro.FOLDER
        cache=private(run,folder+'/'+line['id']+'.'+sha[:16]+'.json');require(core.read_json(cache)==record,'Actual raw cache file differs.')
        files[str(cache.relative_to(run))]=qa.digest(cache)
        if channel=='Pro':
            require(record.get('source_run')==str(run),'Pro source run differs.')
            batch=pro.private_path(run,record['batch_scope_file']).parent
            paths=[pro.private_path(run,record['batch_scope_file']),pro.private_path(run,record['batch_response_file']),*[batch/n for n in ['prepared.json','pro-prepared.private.json','audio-snapshot.private.json','requests.jsonl','submit-intent.private.json','job.json']],run/pro.FOLDER/'batch-reservations.private.json']
            for p in paths:files[str(private(run,p).relative_to(run))]=qa.digest(p)
        channels[channel]={'model':backend.MODEL,'prompt_sha256':qa.text_hash(record['prompt']),'record_sha256':qa.canonical_record_hash(record),'raw_response_sha256':qa.canonical_record_hash(record['response']),'transcript':transcript,'transcript_sha256':qa.text_hash(transcript),'expected_tokens':expected,'observed_tokens':observed}
    return {'id':line['id'],'status':'root_review_required','reviewed_by':'','reason':'','method':VERSION,'clip_sha256':sha,'source_text_sha256':qa.text_hash(line['text']),'source_manifest_sha256':manifest_sha,'source_row_sha256':qa.canonical_record_hash(line),'source_text':line['text'],'segment':copy.deepcopy({k:case[k] for k in ['index','source','observed']}),'channels':channels,'provenance_files_sha256':files,'proof_drivers_sha256':{Path(m.__file__).name:qa.digest(Path(m.__file__)) for m in [qa,flash,pro]},'helper_sha256':qa.digest(Path(__file__)),'provider_timestamps_used':False,'timing_approval':None,'acting_approval':None,'listening_verdict':None}

def review(run,line,qa_path,records,approval=None):
    if approval is None:return None
    expected=template(run,line,qa_path,records)
    require(isinstance(approval,dict) and set(approval)==set(expected) and approval.get('status')==APPROVED and isinstance(approval.get('reviewed_by'),str) and approval['reviewed_by'].casefold().startswith('root') and isinstance(approval.get('reason'),str) and approval['reason'].strip(),'Explicit complete root segmentation approval required.')
    require(all(json.dumps(approval[k],sort_keys=True)==json.dumps(v,sort_keys=True) for k,v in expected.items() if k not in {'status','reviewed_by','reason'}),'Segmentation approval is stale or differs from actual complete raw evidence.')
    return {'id':line['id'],'resolution':'root_approved_scoped_full_character_orthographic_segmentation','method':VERSION,'approval':copy.deepcopy(approval),'provenance_files_sha256':expected['provenance_files_sha256'],'proof_drivers_sha256':expected['proof_drivers_sha256'],'helper_sha256':expected['helper_sha256'],'timing_approval':None,'acting_approval':None,'listening_verdict':None}

def main():
    common.configure();p=argparse.ArgumentParser(description=__doc__)
    for name in ['run-dir','qa-report','flash-comparison','pro-comparison','output']:p.add_argument('--'+name,type=Path,required=True)
    a=p.parse_args();run=core.directory(str(a.run_dir));require(a.output.resolve().is_relative_to(run) and not a.output.exists(),'Use a new private proposal output.')
    comparisons={}
    for channel,path in [('Flash',a.flash_comparison),('Pro',a.pro_comparison)]:
        values=core.read_json(private(run,path))['records'];comparisons[channel]={r['id']:r for r in values};require(len(values)==len(comparisons[channel]),'Duplicate raw comparison IDs.')
    rows={r['id']:r for r in core.read_json(run/'lines.private.json')['lines']}
    proposals={i:template(run,rows[i],a.qa_report,{ch:comparisons[ch][i] for ch in case['channels']}) for i,case in CASES.items()}
    qa.save(a.output,{'method':VERSION,'requires_root_review':True,'proposals':proposals});print(json.dumps({'state':'UNAPPROVED_PRIVATE_PROPOSALS','count':len(proposals)}));return 0
if __name__=='__main__':
    try:raise SystemExit(main())
    except (core.SafeError,OSError,ValueError,KeyError,TypeError) as e:print(str(e) if isinstance(e,core.SafeError) else 'Invalid private segmentation evidence.',file=sys.stderr);raise SystemExit(1)
