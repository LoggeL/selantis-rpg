#!/usr/bin/env python3
"""Independent ASR Batch of explicitly selected current story MP3s.

prepare|submit|status|collect|reconcile --run-dir <frozen TTS run>
 --batch-name <safe private name> --only-ids <comma separated IDs> --key-stdin

Source TTS, clips and public banks remain read-only. Each ASR batch owns a
separate frozen input/journal under independent-google-asr/batches/<name>.
Only the exact proven independent-ASR prompt and MP3 bytes reach Gemini.
"""
from __future__ import annotations
import argparse
import copy
import fcntl
import json
import os
from pathlib import Path
import re
import time
import uuid
from urllib.parse import urlencode
import story_voice_common as common
from story_voice_common import core
import story_voice_transcribe as asr

TTS_MODEL = 'gemini-3.8-flash-tts'
MODEL = asr.MODEL
FOLDER_NAME = 'independent-google-asr'
BANK_NAME = 'independent-story-asr'
DISPLAY_PREFIX = 'selantis-story-asr-'
SAFE_NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\Z')
NOTE = 'No authored dialogue was supplied to Gemini; current MP3 input hashes bind every raw response. Independent ASR is not human listening.'


def source_rows(source):
    # Validate original TTS freeze before any ASR model override in shared hooks.
    old_model,old_prepared=core.MODEL,core.prepared
    try:
        core.MODEL=TTS_MODEL;core.prepared=common.prepared
        common.prepared(source)
        return {r['id']:r for r in core.read_json(source/'lines.private.json')['lines']}
    finally:
        core.MODEL=old_model;core.prepared=old_prepared


def locations(source,name):
    if not SAFE_NAME.fullmatch(name):raise core.SafeError('Invalid private ASR batch name.')
    folder=source/FOLDER_NAME;run=folder/'batches'/name
    run.mkdir(parents=True,exist_ok=True);os.chmod(run,0o700)
    return folder,run


def current_audio(source,row):
    p=source/'clips'/(row['id']+'.mp3')
    if not p.is_file():raise core.SafeError('A selected current story MP3 is missing.')
    audio=p.read_bytes()
    if not audio:raise core.SafeError('A selected current story MP3 is empty.')
    sha=core.digest(audio);text_sha=asr.text_hash(row['text'])
    return audio,sha,text_sha


def cache_path(folder,ident,sha):
    return folder/(ident+'.'+sha[:16]+'.json')


def merge_current_cache(source,folder,rows):
    """Preserve every current valid case, including prior nonselected ASR work."""
    with (folder/'comparison.lock').open('a+') as stream:
        fcntl.flock(stream,fcntl.LOCK_EX)
        records=[];stale=[]
        for ident,row in rows.items():
            path=source/'clips'/(ident+'.mp3')
            if not path.is_file():continue
            sha=core.digest(path.read_bytes());text_sha=asr.text_hash(row['text'])
            target=cache_path(folder,ident,sha)
            if not target.exists():continue
            record=core.read_json(target)
            if record.get('id')!=ident or not asr.cached_record(record,sha,text_sha):
                stale.append(ident);continue
            records.append(record)
        core.save(folder/'comparison.private.json',{'records':records,'note':NOTE,'rejected_stale_ids':stale})
        fcntl.flock(stream,fcntl.LOCK_UN)
    return len(records)


def prepare(args,source,folder,run,rows):
    if (run/'prepared.json').exists() or (run/'job.json').exists():raise core.SafeError('ASR batch is frozen already; use submit/status/collect or a fresh name.')
    requested=args.only_ids.split(',') if args.only_ids else []
    if not requested or len(requested)!=len(set(requested)) or not set(requested).issubset(rows):raise core.SafeError('Select unique known recording IDs explicitly.')
    records=[];snapshots=[];cached=[]
    for ident in requested:
        audio,sha,text_sha=current_audio(source,rows[ident]);target=cache_path(folder,ident,sha)
        if target.exists():
            record=core.read_json(target)
            if record.get('id')!=ident or not asr.cached_record(record,sha,text_sha):raise core.SafeError('Selected cached ASR belongs to another source/prompt/model/version.')
            cached.append(ident);continue
        request=asr.request_for(audio)
        records.append({'key':ident,'request':request})
        snapshots.append({'id':ident,'clip_sha256':sha,'source_audio_sha256':sha,'source_text_sha256':text_sha,
                          'request_sha256':core.digest(json.dumps(request,sort_keys=True).encode())})
    merge_current_cache(source,folder,rows)
    if not records:raise core.SafeError('All selected current audio already has validated independent ASR; no paid batch needed.')
    payload=''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records).encode()
    (run/'requests.jsonl').write_bytes(payload);os.chmod(run/'requests.jsonl',0o600)
    snapshot={'bank':BANK_NAME,'model':MODEL,'prompt':asr.PROMPT,'prompt_sha256':asr.text_hash(asr.PROMPT),
              'source_run':str(source),'source_tts_prepared_sha256':core.digest((source/'prepared.json').read_bytes()),
              'source_manifest_sha256':core.digest((source/'lines.private.json').read_bytes()),'clips':snapshots,'cached_ids':cached}
    core.save(run/'audio-snapshot.private.json',snapshot)
    core.save(run/'prepared.json',{'bank':BANK_NAME,'model':MODEL,'request_count':len(records),'input_bytes':len(payload),
              'input_sha256':core.digest(payload),'snapshot_sha256':core.digest((run/'audio-snapshot.private.json').read_bytes()),'created_at':int(time.time())})
    print(json.dumps({'state':'ASR_PREPARED','requests':len(records),'cached_skipped':len(cached),'input_bytes':len(payload),'transport':'JSONL Files API'}))


def prepared(run,source=None,rows=None,reject_cached=False):
    info=core.read_json(run/'prepared.json');snapshot=core.read_json(run/'audio-snapshot.private.json')
    if info.get('bank')!=BANK_NAME or info.get('model')!=MODEL or snapshot.get('model')!=MODEL or snapshot.get('prompt')!=asr.PROMPT or snapshot.get('prompt_sha256')!=asr.text_hash(asr.PROMPT):raise core.SafeError('ASR model/prompt/frozen-bank mismatch.')
    source=source or Path(snapshot['source_run']).resolve();rows=rows or source_rows(source)
    if snapshot.get('source_run')!=str(source) or snapshot.get('source_tts_prepared_sha256')!=core.digest((source/'prepared.json').read_bytes()) or snapshot.get('source_manifest_sha256')!=core.digest((source/'lines.private.json').read_bytes()):raise core.SafeError('Frozen TTS source inventory changed since ASR prepare.')
    payload=(run/'requests.jsonl').read_bytes()
    if info.get('input_sha256')!=core.digest(payload) or info.get('snapshot_sha256')!=core.digest((run/'audio-snapshot.private.json').read_bytes()) or info.get('input_bytes')!=len(payload):raise core.SafeError('Frozen ASR payload/snapshot changed.')
    records=[json.loads(line) for line in payload.splitlines() if line.strip()]
    if info.get('request_count')!=len(records) or not records or len({r['key'] for r in records})!=len(records):raise core.SafeError('ASR key/count mismatch.')
    if [r['key'] for r in records]!=[r['id'] for r in snapshot['clips']]:raise core.SafeError('ASR payload IDs differ from audio snapshot.')
    for record,entry in zip(records,snapshot['clips']):
        ident=entry['id']
        if ident not in rows:raise core.SafeError('ASR snapshot contains an unknown story ID.')
        audio,sha,text_sha=current_audio(source,rows[ident])
        if entry.get('clip_sha256')!=sha or entry.get('source_audio_sha256')!=sha or entry.get('source_text_sha256')!=text_sha or record['request']!=asr.request_for(audio) or entry.get('request_sha256')!=core.digest(json.dumps(record['request'],sort_keys=True).encode()):raise core.SafeError('Current MP3/source text/prompt request differs from frozen independent ASR input.')
        target=cache_path(source/FOLDER_NAME,ident,sha)
        if reject_cached and target.exists():raise core.SafeError('A selected ASR cache became available after prepare. Do not duplicate its paid request; prepare remaining IDs under a fresh batch name.')
    return info


def reserve(source,run):
    folder=source/FOLDER_NAME;ledger=folder/'batch-reservations.private.json'
    snapshot=core.read_json(run/'audio-snapshot.private.json')
    with (folder/'batch-reservations.lock').open('a+') as stream:
        fcntl.flock(stream,fcntl.LOCK_EX)
        values=core.read_json(ledger) if ledger.exists() else {}
        keys=[entry['id']+':'+entry['clip_sha256']+':'+snapshot['prompt_sha256']+':'+MODEL for entry in snapshot['clips']]
        if any(k in values and values[k]['run']!=str(run) for k in keys):raise core.SafeError('Independent ASR input reserved by another batch; no duplicate paid submission.')
        for key in keys:values[key]={'run':str(run),'reserved_at':int(time.time())}
        core.save(ledger,values);fcntl.flock(stream,fcntl.LOCK_UN)


def submit(args,source,run,rows):
    if (run/'job.json').exists() or (run/'submit-intent.private.json').exists():raise core.SafeError('ASR submit intent/journal exists. Use status/reconcile; never resubmit automatically.')
    info=prepared(run,source,rows,reject_cached=True);key=core.credential(args)
    reserve(source,run)
    intent={'display_name':DISPLAY_PREFIX+uuid.uuid4().hex,'model':MODEL,'input_sha256':info['input_sha256'],'request_count':info['request_count'],'state':'RECORDED_BEFORE_NETWORK'}
    core.save(run/'submit-intent.private.json',intent)
    original_model,original_prepared,original_key,original_api=core.MODEL,core.prepared,core.credential,core.api
    def api(method,url,k,body=None,headers=None,raw=False):
        if isinstance(body,dict):
            body=copy.deepcopy(body)
            for field in ['batch','file']:
                if isinstance(body.get(field),dict) and 'display_name' in body[field]:body[field]['display_name']=intent['display_name']
        return original_api(method,url,k,body,headers,raw)
    try:
        core.MODEL=MODEL;core.prepared=lambda r:prepared(r,source,rows,reject_cached=True);core.credential=lambda _:key;core.api=api
        core.submit(args,run)
        intent['state']='CONFIRMED';core.save(run/'submit-intent.private.json',intent)
    except core.SafeError:
        intent['state']='OUTCOME_UNCONFIRMED';core.save(run/'submit-intent.private.json',intent);raise
    finally:
        core.MODEL,core.prepared,core.credential,core.api=original_model,original_prepared,original_key,original_api


def response_records(result):
    inline=common.inline_records(result)
    if inline is not None:return None,inline
    meta=result.get('metadata',{});response=result.get('response',{})
    dest=result.get('dest') or meta.get('output') or response.get('output') or response
    if not isinstance(dest,dict):raise core.SafeError('Unrecognized ASR Batch output destination.')
    file=dest.get('responsesFile') or dest.get('responses_file') or dest.get('fileName') or dest.get('file_name')
    if not isinstance(file,str) or not re.fullmatch(r'files/[A-Za-z0-9_-]+',file):raise core.SafeError('No valid independent ASR result file available.')
    return file,None


def collect(args,source,folder,run,rows):
    info=prepared(run,source,rows);key=core.credential(args)
    result,state=core.fetch_status(args,run,key)
    if state not in core.TERMINAL:raise core.SafeError('ASR batch remains active; collect later without another submit.')
    file,records=response_records(result)
    if file:
        data,_=core.api('GET',core.BASE+'/download/v1beta/'+file+':download?alt=media',key,raw=True)
        (run/'responses.private.jsonl').write_bytes(data);os.chmod(run/'responses.private.jsonl',0o600)
        records=[json.loads(line) for line in data.splitlines() if line.strip()]
    else:core.save(run/'responses.private.json',records)
    snapshot=core.read_json(run/'audio-snapshot.private.json');expected={r['id']:r for r in snapshot['clips']}
    identities=[r.get('key') or r.get('metadata',{}).get('key') for r in records]
    if len(identities)!=len(set(identities)) or set(identities)!=set(expected):raise core.SafeError('ASR responses duplicate/unexpected/missing keys; raw batch retained, no subset accepted.')
    accepted=[];failures=[]
    for item,ident in zip(records,identities):
        body=item.get('response')
        if not isinstance(body,dict) or item.get('error') or item.get('status'):
            failures.append({'id':ident,'reason':'provider_error','provider_error':core.error_summary(item.get('error',item.get('status')))})
            continue
        try:transcript=asr.response_transcript(body)
        except (core.SafeError,ValueError,TypeError,KeyError):
            failures.append({'id':ident,'reason':'invalid_model_version_or_transcript_response'});continue
        entry=expected[ident]
        record={'id':ident,'clip_sha256':entry['clip_sha256'],'source_audio_sha256':entry['clip_sha256'],'upload_sha256':entry['clip_sha256'],
                'source_text_sha256':entry['source_text_sha256'],'input_mime_type':'audio/mpeg','model':MODEL,'prompt':asr.PROMPT,
                'transcript':transcript,'response':body,'listening_verdict':None}
        metadata=copy.deepcopy(getattr(asr,'CACHE_METADATA',{}))
        if not isinstance(metadata,dict) or set(metadata)&set(record):raise core.SafeError('Cache metadata may not overwrite transport provenance.')
        record.update(metadata)
        if not asr.cached_record(record,entry['clip_sha256'],entry['source_text_sha256']):raise core.SafeError('Independent ASR cache validator rejected Batch record.')
        accepted.append(record)
    # Recheck every audio byte immediately before shared cache writes.
    prepared(run,source,source_rows(source))
    for record in accepted:
        target=cache_path(folder,record['id'],record['clip_sha256'])
        if target.exists():
            prior=core.read_json(target)
            if not asr.cached_record(prior,record['clip_sha256'],record['source_text_sha256']) or prior.get('id')!=record['id'] or prior['transcript']!=record['transcript']:raise core.SafeError('Existing independent cache conflicts with Batch result; raw results retained for manual review.')
            continue # preserve existing human verdict and full raw provenance.
        core.save(target,record)
    if state!='JOB_STATE_SUCCEEDED':failures.append({'id':None,'reason':'terminal_batch_failure','state':state})
    count=merge_current_cache(source,folder,rows)
    core.save(run/'collection.private.json',{'model':MODEL,'collected':len(accepted),'expected':info['request_count'],'merged_current_records':count,'failures':failures})
    print(json.dumps({'state':'ASR_COLLECTED' if not failures else 'ASR_INCOMPLETE','collected':len(accepted),'expected':info['request_count'],'merged_current_records':count,'failed':len(failures)}))
    return 0 if not failures else 1


def main():
    os.umask(0o077);common.configure()
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['prepare','submit','status','collect','reconcile','merge'])
    parser.add_argument('--run-dir',required=True);parser.add_argument('--batch-name',required=True);parser.add_argument('--only-ids')
    parser.add_argument('--key-stdin',action='store_true');parser.add_argument('--keychain-service');parser.add_argument('--keychain-account')
    args=parser.parse_args()
    if args.key_stdin and args.keychain_service:parser.error('Choose one credential source')
    if args.command=='prepare' and not args.only_ids:parser.error('prepare requires --only-ids')
    if args.command!='prepare' and args.only_ids:parser.error('Selected ASR IDs are frozen at prepare; omit --only-ids later')
    try:
        source=core.directory(args.run_dir);rows=source_rows(source) # TTS model untouched here.
        folder,run=locations(source,args.batch_name);_lock=common.run_lock(run)
        if args.command=='prepare':prepare(args,source,folder,run,rows);return 0
        if args.command=='merge':
            count=merge_current_cache(source,folder,rows);print(json.dumps({'state':'ASR_CACHE_MERGED','current_records':count}));return 0
        prepared(run,source,rows)
        if args.command=='submit':submit(args,source,run,rows);return 0
        if args.command=='status':core.status(args,run);return 0
        if args.command=='reconcile':
            original=common.prepared
            try:common.prepared=lambda r:prepared(r,source,rows);common.reconcile(args,run)
            finally:common.prepared=original
            return 0
        return collect(args,source,folder,run,rows)
    except (core.SafeError,OSError,ValueError,TypeError,KeyError) as error:
        print(str(error) if isinstance(error,core.SafeError) else 'Invalid independent ASR artifact; private results retained. No automatic retry.',file=__import__('sys').stderr)
        return 1

if __name__=='__main__':raise SystemExit(main())
