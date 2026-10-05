"""Story adapters reuse the qualified prolog transport/audio hooks, unchanged.

Private artifacts: output/audio/story-voice/<run>. Public: audio/story.
QA contract: status=passed, checked_ids, clip_sha256, failures=[].
Optional alignment contract: clip_sha256 and alignment_by_id[id].words
with word/start/end seconds, lexically matching the frozen transcript.
"""
from __future__ import annotations
import copy
import fcntl
import json
import math
import os
from pathlib import Path
import re
import shutil
import time
import prolog_voice_batch as core

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / 'output/audio/story-voice'
PUBLIC = ROOT / 'game/public/audio/story'
ID = re.compile(r'story-[0-9a-f]{24}\Z')

def run_lock(run):
    stream=(run/'operation.lock').open('a+')
    try:
        fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        stream.close()
        raise core.SafeError('Another story operation is active for this run; no duplicate paid action allowed.') from None
    return stream

def configure():
    core.ROOT = ROOT
    core.PRIVATE = PRIVATE
    core.prepared = prepared


def validate(profiles, manifest):
    if manifest.get('unresolved') or manifest.get('unresolved_count',0) or manifest.get('diagnostics',{}).get('unresolved'):
        raise core.SafeError('Inventory has unresolved speech sources; final reviewed manifest must reach zero before prepare.')
    core.validate_sources(manifest)
    if manifest.get('model', core.MODEL) != core.MODEL:
        raise core.SafeError('Story production requires gemini-3.8-flash-tts.')
    speakers = profiles.get('speakers')
    lines = manifest.get('lines')
    if not isinstance(speakers, dict) or not isinstance(lines, list) or not lines:
        raise core.SafeError('Provide speakers mapping and nonempty lines inventory.')
    keys = set()
    for line in lines:
        ident = line.get('id')
        if not isinstance(ident, str) or not ID.fullmatch(ident) or ident in keys:
            raise core.SafeError('Story IDs must be unique story-<24hex>; prolog is kept separately.')
        keys.add(ident)
        profile = speakers.get(line.get('speaker'), {})
        if not isinstance(profile.get('google_voice'), str) or not profile['google_voice'].strip():
            raise core.SafeError('Every story speaker needs a fixed google_voice.')
        for field in ['text', 'display_text', 'scene', 'kind', 'direction_en']:
            if not isinstance(line.get(field), str) or not line[field].strip():
                raise core.SafeError('Each line needs text/display_text/scene/kind/direction_en.')
        if '{dynamic:' in line['text'] or '${' in line['text'] or len(line['text']) > 10000 or len(re.findall(r'[^\W_]+',line['text'])) > 800:
            raise core.SafeError('Story transcript contains unresolved placeholders or needs splitting.')
        if len(line['direction_en']) > 300 or '\n' in line['direction_en']:
            raise core.SafeError('3.8 line direction must be short: one line, at most300 characters.')
        if line['kind'] not in {'say','think','narrate','bark','choice','dialogue','thought','narration','spoken_choice','song_lyrics'}:
            raise core.SafeError('Unknown speech kind; exclude menu/layout labels.')
        if 'prolog' in line['scene'].lower() or any('/chapters/prolog/' in s.get('file','') for s in line.get('sources',[])):
            raise core.SafeError('Existing prolog recordings are KEEP, never included in story requests.')
    aliases = manifest.get('alias_map', {})
    if not isinstance(aliases, dict) or any(not isinstance(k,str) or not isinstance(v,str) for k,v in aliases.items()):
        raise core.SafeError('Invalid alias_map.')
    lookup_ids=set()
    for lookup in manifest.get('runtime_lookup', []):
        if lookup.get('asset_id') not in keys or any(not isinstance(lookup.get(k),str) for k in ['kind','speaker','text']):
            raise core.SafeError('Invalid runtime lookup.')
        if any(k in lookup and not isinstance(lookup[k],str) for k in ['scene','mood']):
            raise core.SafeError('Runtime scene/mood scope must be textual.')
        lookup_ids.add(lookup['asset_id'])
    if lookup_ids!=keys:
        raise core.SafeError('Every voiced story clip needs an authored frozen runtime lookup; unresolved mapping blocks prepare.')
    return speakers, lines


def selected_lines(manifest, args):
    lines = manifest['lines']
    if getattr(args,'chapter',None):
        wanted=set(args.chapter.split(','))
        def chapter(row):
            names=[s.get('file','') for s in row.get('sources',[])]
            return row.get('chapter') in wanted or any(any('/chapters/'+c+'/' in p for c in wanted) for p in names) or row['scene'].split('/')[0] in wanted
        lines=[r for r in lines if chapter(r)]
    if getattr(args,'speaker',None):
        wanted=set(args.speaker.split(','));lines=[r for r in lines if r['speaker'] in wanted]
    if getattr(args,'only_ids',None):
        wanted=set(args.only_ids.split(','))
        if not wanted.issubset({r['id'] for r in lines}):
            raise core.SafeError('Unknown/unselected --only-ids entry.')
        lines=[r for r in lines if r['id'] in wanted]
    if not lines:
        raise core.SafeError('Selected story segment is empty.')
    return lines


def request_for(row, speakers):
    # Voice identity belongs in voiceConfig, performance in a brief line style.
    return {'contents':[{'role':'user','parts':[{'text':row['text'],'speechMetadata':{'style':row['direction_en']}}]}],
            'generationConfig':{'responseModalities':['AUDIO'],'speechConfig':{'voiceConfig':{'voice':speakers[row['speaker']]['google_voice']},'languageCode':'de-DE'}}}


def estimate(manifest, records):
    texts=[r['text'] for r in manifest['lines']]
    chars=sum(len(t) for t in texts)
    words=sum(len(re.findall(r"[^\W_]+(?:[’'-][^\W_]+)*",t)) for t in texts)
    # Text + actual direction strings, plus estimated per-request schema overhead.
    input_chars=sum(len(p['text'])+len(p['speechMetadata']['style']) for r in records for c in r['request']['contents'] for p in c['parts'])
    tokens=[input_chars/4+len(records)*30,input_chars/3+len(records)*60]
    minutes=[words/170,words/100]
    costs={name:[minutes[i]*audio_minute+tokens[i]*input_million/1e6 for i in [0,1]] for name,audio_minute,input_million in [('batch',.00675,.25),('standard',.0135,.5)]}
    return {'currency':'USD','characters':chars,'words':words,'requests':len(records),'input_tokens_estimated':tokens,'audio_minutes_estimated':minutes,'usd_one_take':costs,
            'assumptions':'3–4 input characters/token plus30–60 schema tokens/request;100–170words/min;25audioTokens/sec;no tax,caching,voice-design,QA or retries included.',
            'pricing':{'source':'https://ai.google.dev/gemini-api/docs/pricing','verified':'2026-10-05','valid_through':'2026-12-31','model':core.MODEL,'batch_usd_per_million_input':.25,'batch_usd_per_million_audio':4.5,'standard_usd_per_million_input':.5,'standard_usd_per_million_audio':9.0},
            'prolog':'188existing approved prolog recordings excluded from paid story generation.'}


def prepare(args, run):
    if (run/'job.json').exists() or (run/'prepared.json').exists():
        raise core.SafeError('Run is frozen already; resume it or choose a fresh segment directory.')
    profiles=core.read_json(args.profiles);manifest=core.read_json(args.manifest)
    speakers,_=validate(profiles,manifest)
    original=copy.deepcopy(manifest)
    manifest['lines']=selected_lines(manifest,args)
    keys={r['id'] for r in manifest['lines']}
    manifest['runtime_lookup']=[r for r in manifest.get('runtime_lookup',[]) if r['asset_id'] in keys]
    records=[{'key':r['id'],'request':request_for(r,speakers)} for r in manifest['lines']]
    payload=''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in records).encode()
    (run/'requests.jsonl').write_bytes(payload);os.chmod(run/'requests.jsonl',0o600)
    core.save(run/'profiles.private.json',profiles);core.save(run/'lines.private.json',manifest)
    core.save(run/'full-inventory.private.json',original)
    source_archive={name:{'sha256':h,'text':(ROOT/name).read_bytes().decode('utf-8')} for name,h in manifest['source_hashes'].items() if name.startswith('game/src/') and (ROOT/name).is_file()}
    core.save(run/'source-snapshot.private.json',source_archive)
    report=estimate(manifest,records);core.save(run/'estimated-units.private.json',report)
    core.save(run/'prepared.json',{'model':core.MODEL,'request_count':len(records),'input_bytes':len(payload),'input_sha256':core.digest(payload),
             'profiles_sha256':core.digest((run/'profiles.private.json').read_bytes()),'manifest_sha256':core.digest((run/'lines.private.json').read_bytes()),
             'full_inventory_sha256':core.digest((run/'full-inventory.private.json').read_bytes()),'source_snapshot_sha256':core.digest((run/'source-snapshot.private.json').read_bytes()),'created_at':int(time.time()),'bank':'story'})
    print(json.dumps({'state':'PREPARED','requests':len(records),'input_bytes':len(payload),'cost_estimate_usd':report['usd_one_take']}))


def prepared(run):
    info=core.read_json(run/'prepared.json')
    validate(core.read_json(run/'profiles.private.json'),core.read_json(run/'lines.private.json'))
    if info.get('bank')!='story':
        raise core.SafeError('Story adapter refuses another bank, including prolog.')
    for file,key in [('requests.jsonl','input_sha256'),('profiles.private.json','profiles_sha256'),('lines.private.json','manifest_sha256'),('full-inventory.private.json','full_inventory_sha256'),('source-snapshot.private.json','source_snapshot_sha256')]:
        if core.digest((run/file).read_bytes())!=info.get(key):
            raise core.SafeError('Frozen story request/profile/inventory changed; prepare reviewed inputs in a fresh run.')
    manifest=core.read_json(run/'lines.private.json');profiles=core.read_json(run/'profiles.private.json')
    payload=(run/'requests.jsonl').read_bytes()
    records=[json.loads(line) for line in payload.splitlines() if line.strip()]
    expected=[{'key':row['id'],'request':request_for(row,profiles['speakers'])} for row in manifest['lines']]
    if records!=expected or info.get('model')!=core.MODEL or info.get('request_count')!=len(expected) or info.get('input_bytes')!=len(payload):
        raise core.SafeError('Prepared JSONL keys/count/content differ from frozen inventory and fixed voices.')
    snapshot=core.read_json(run/'source-snapshot.private.json')
    for name,entry in snapshot.items():
        if core.digest(entry['text'].encode('utf-8'))!=manifest['source_hashes'].get(name) or entry.get('sha256')!=manifest['source_hashes'].get(name):
            raise core.SafeError('Archived source text differs from frozen source hash.')
    return info


def reserve(run, records, backend):
    PRIVATE.mkdir(parents=True,exist_ok=True)
    ledger=PRIVATE/'reservations.private.json';lock=PRIVATE/'reservations.lock'
    with lock.open('a+') as stream:
        fcntl.flock(stream,fcntl.LOCK_EX)
        values=core.read_json(ledger) if ledger.exists() else {}
        for record in records:
            old=values.get(record['key'])
            h=core.digest(json.dumps(record['request'],sort_keys=True).encode())
            if old and (old['run']!=str(run) or old['request_sha256']!=h or old['backend']!=backend):
                raise core.SafeError('Story ID is reserved by another paid segment/backend. Reuse or review that private run; duplicate submit refused.')
        for record in records:
            values[record['key']]={'run':str(run),'request_sha256':core.digest(json.dumps(record['request'],sort_keys=True).encode()),'backend':backend,'reserved_at':int(time.time())}
        core.save(ledger,values)
        fcntl.flock(stream,fcntl.LOCK_UN)


def frozen_runtime_keys(manifest,row):
    # Preserve exact authored scene/mood variants; never add broad fallback keys.
    fields=['kind','speaker','text','scene','mood']
    return [{k:copy.deepcopy(entry[k]) for k in fields if k in entry} for entry in manifest.get('runtime_lookup',[]) if entry.get('asset_id')==row['id']]


def publish(run,args,proposal,manifest):
    clips=proposal['clips']
    frozen={r['id']:r for r in manifest['lines']}
    ids=[c.get('id') for c in clips]
    if len(ids)!=len(set(ids)) or any(i not in frozen for i in ids):
        raise core.SafeError('Unknown or duplicate public story clip ID.')
    for clip in clips:
        row=frozen[clip['id']]
        expected_keys=frozen_runtime_keys(manifest,row)
        if clip.get('runtime_keys')!=expected_keys:
            raise core.SafeError('Public runtime keys differ from frozen authored scene/mood lookups.')
        seconds=clip.get('seconds')
        if not isinstance(seconds,(int,float)) or isinstance(seconds,bool) or not math.isfinite(seconds) or seconds<=0:
            raise core.SafeError('Public clip duration must be finite and positive.')
        clip['audio']='audio/story/'+clip['id']+'.mp3'
        clip['display_text']=row['display_text']
    for field in ['scene_players','scoped_aliases','runtime_speaker_overrides']:
        if field in manifest:proposal[field]=copy.deepcopy(manifest[field])
    proposal['runtime_lookup']=copy.deepcopy(manifest.get('runtime_lookup',[]))
    core.save(run/'public-manifest.proposed.json',proposal)
    if not getattr(args,'public_dir',None):
        return
    report=core.read_json(run/'collection.private.json')
    expected={r['id'] for r in manifest['lines']}
    if report.get('failures') or {r['id'] for r in clips}!=expected:
        raise core.SafeError('Story export requires every selected clip complete.')
    if not args.qa_report:
        raise core.SafeError('Story export needs hash-bound --qa-report.')
    frozen={r['id']:r for r in manifest['lines']}
    for c in clips:
        mp3=run/'clips'/(c['id']+'.mp3')
        if not mp3.is_file() or core.digest(mp3.read_bytes())!=c.get('sha256') or any(c.get(k)!=frozen[c['id']].get(k) for k in ['speaker','text','kind']):
            raise core.SafeError('Public proposal or audio differs from frozen reviewed clip; export refused.')
    qa=core.read_json(args.qa_report)
    if qa.get('status')!='passed' or set(qa.get('checked_ids',[]))!=expected or qa.get('failures') or any(qa.get('clip_sha256',{}).get(c['id'])!=c['sha256'] for c in clips):
        raise core.SafeError('Story QA did not pass for every current selected audio hash.')
    alignment=core.read_json(args.alignment_report) if getattr(args,'alignment_report',None) else None
    if getattr(args,'require_alignment',False) and alignment is None:
        raise core.SafeError('Word alignment required; provide --alignment-report.')
    if alignment is not None:
        for clip in clips:
            entry=alignment.get('alignment_by_id',{}).get(clip['id'],{})
            words=entry.get('words',[])
            if alignment.get('clip_sha256',{}).get(clip['id'])!=clip['sha256'] or not words:
                raise core.SafeError('Alignment missing or audio hash differs.')
            previous=0.0
            for w in words:
                if not isinstance(w.get('word'),str) or not isinstance(w.get('start'),(int,float)) or not isinstance(w.get('end'),(int,float)) or not previous<=w['start']<=w['end']<=clip['seconds']+.05:
                    raise core.SafeError('Invalid or unordered word alignment.')
                previous=w['end']
            import prolog_voice_generate as standard
            if standard.transcript_words(' '.join(w['word'] for w in words))!=standard.transcript_words(clip['text']):
                raise core.SafeError('Alignment words differ from frozen source transcript.')
            # Runtime WordCue tracks whitespace words in the spoken transcript.
            whitespace=clip['text'].split()
            if len(words)!=len(whitespace):
                raise core.SafeError('ASR lexical word count differs from spoken whitespace words; provide grouped cues first.')
            clip['word_cues']=[{'start':w['start'],'end':w['end']} for w in words]
            clip['alignment']={'words':words} # optional richer provenance; runtime uses word_cues
    target=Path(args.public_dir).resolve()
    if target!=PUBLIC:
        raise core.SafeError('Story export must target game/public/audio/story/.')
    PRIVATE.mkdir(parents=True,exist_ok=True)
    with (PRIVATE/'publish.lock').open('a+') as bank_lock:
        fcntl.flock(bank_lock,fcntl.LOCK_EX)
        target.mkdir(parents=True,exist_ok=True)
        prior=core.read_json(target/'manifest.json') if (target/'manifest.json').exists() else {'model':core.MODEL,'aliases':{},'clips':[]}
        all_clips={c['id']:c for c in prior.get('clips',[])};all_clips.update({c['id']:c for c in clips})
        aliases={**prior.get('aliases',{}),**proposal.get('aliases',{})}
        for c in clips:
            temporary=target/(c['id']+'.tmp.mp3');shutil.copyfile(run/'clips'/(c['id']+'.mp3'),temporary);os.chmod(temporary,0o644);temporary.replace(target/(c['id']+'.mp3'))
        merged=copy.deepcopy(prior);merged.update(model=core.MODEL,aliases=aliases,clips=list(all_clips.values()))
        for field in ['scene_players','scoped_aliases','runtime_speaker_overrides']:
            if field not in proposal:continue
            incoming=proposal[field];existing=prior.get(field)
            if isinstance(incoming,dict) and (existing is None or isinstance(existing,dict)):
                merged[field]={**(existing or {}),**incoming}
            elif isinstance(incoming,list) and (existing is None or isinstance(existing,list)):
                unique={json.dumps(item,sort_keys=True,ensure_ascii=False):item for item in (existing or [])+incoming}
                merged[field]=list(unique.values())
            else:merged[field]=copy.deepcopy(incoming)
        lookup={(entry.get('asset_id'),entry.get('kind'),entry.get('speaker'),entry.get('text'),entry.get('scene'),entry.get('mood')):entry for entry in prior.get('runtime_lookup',[]) if entry.get('asset_id') not in {c['id'] for c in clips}}
        lookup.update({(entry.get('asset_id'),entry.get('kind'),entry.get('speaker'),entry.get('text'),entry.get('scene'),entry.get('mood')):entry for entry in proposal.get('runtime_lookup',[])})
        merged['runtime_lookup']=list(lookup.values())
        core.save(target/'manifest.json',merged);os.chmod(target/'manifest.json',0o644)
        fcntl.flock(bank_lock,fcntl.LOCK_UN)



def selection_args(parser):
    parser.add_argument('--chapter',help='Comma-separated kapitel-1..kapitel-5/common segment')
    parser.add_argument('--speaker',help='Comma-separated canonical speaker IDs')
    parser.add_argument('--only-ids',help='Comma-separated story request IDs')


def shared_args(parser):
    parser.add_argument('--run-dir',required=True,help='Private child of output/audio/story-voice/')
    parser.add_argument('--profiles',default=str(ROOT/'docs/voice-production/story-speakers.json'))
    parser.add_argument('--manifest',default=str(ROOT/'docs/voice-production/story-lines.json'))
    parser.add_argument('--key-stdin',action='store_true');parser.add_argument('--keychain-service');parser.add_argument('--keychain-account')
    parser.add_argument('--public-dir');parser.add_argument('--qa-report');parser.add_argument('--alignment-report');parser.add_argument('--require-alignment',action='store_true')


def inline_records(result):
    """REST nested InlinedResponses and SDK flattened lists, without assumptions."""
    meta=result.get('metadata',{})
    candidates=[result.get('dest'),meta.get('output'),result.get('response'),result]
    for candidate in candidates:
        if not isinstance(candidate,dict):continue
        value=candidate.get('inlinedResponses',candidate.get('inlined_responses'))
        while isinstance(value,dict):
            value=value.get('inlinedResponses',value.get('inlined_responses'))
        if isinstance(value,list):return value
    return None


def collect(args,run):
    """Normalize REST inline wrapper and bridge qualified Batch receipts."""
    original_fetch=core.fetch_status;original_api=core.api;cached={}
    def fetch(a,r,key=None):
        result,state=original_fetch(a,r,key)
        records=inline_records(result)
        if records is None:return result,state
        # Original status remains untouched in status.private.json. Bridge only
        # the in-memory output into the core's qualified keyed JSONL collector.
        cached['inline']=(''.join(json.dumps(rec,ensure_ascii=False)+'\n' for rec in records)).encode()
        bridged=copy.deepcopy(result);bridged.pop('dest',None)
        if isinstance(bridged.get('metadata'),dict):
            for k in ['output','outputConfig','output_config']:bridged['metadata'].pop(k,None)
        bridged['response']={'responsesFile':'files/story-inline-cache'}
        return bridged,state
    def api(method,url,key,body=None,headers=None,raw=False):
        if method=='GET' and '/files/story-inline-cache:download' in url:
            return cached['inline'],{}
        return original_api(method,url,key,body,headers,raw)
    public=args.public_dir;args.public_dir=None
    try:
        core.fetch_status=fetch;core.api=api;core.collect(args,run)
    finally:
        core.fetch_status=original_fetch;core.api=original_api;args.public_dir=public
    proposal=core.read_json(run/'public-manifest.proposed.json')
    requests={r['key']:r['request'] for r in [json.loads(s) for s in (run/'requests.jsonl').read_text().splitlines() if s.strip()]}
    manifest=core.read_json(run/'lines.private.json');rows={r['id']:r for r in manifest['lines']}
    for clip in proposal['clips']:
        clip['runtime_keys']=frozen_runtime_keys(manifest,rows[clip['id']])
        path=run/'raw'/(clip['id']+'.receipt.json');receipt=core.read_json(path)
        receipt.update(status='complete',backend='batch',request_sha256=core.digest(json.dumps(requests[clip['id']],sort_keys=True).encode()))
        core.save(path,receipt)
    publish(run,args,proposal,core.read_json(run/'lines.private.json'))


def new_submit_intent(run):
    path=run/'submit-intent.private.json'
    if path.exists():
        raise core.SafeError('Submit intent already exists. Use reconcile/status; never create a second paid batch automatically.')
    import uuid
    info=prepared(run)
    intent={'display_name':'selantis-story-'+uuid.uuid4().hex,'model':core.MODEL,
            'input_sha256':info['input_sha256'],'request_count':info['request_count'],
            'state':'SUBMIT_INTENT_RECORDED','created_at':int(time.time())}
    core.save(path,intent)
    return intent


def matching_operation(operation,intent,journal):
    meta=operation.get('metadata',operation)
    if not isinstance(meta,dict):return False
    display=meta.get('displayName',meta.get('display_name'))
    model=str(meta.get('model','')).removeprefix('models/')
    config=meta.get('inputConfig',meta.get('input_config',{}))
    file=config.get('fileName',config.get('file_name')) if isinstance(config,dict) else None
    stats=meta.get('batchStats',meta.get('batch_stats',{}))
    count=stats.get('requestCount',stats.get('request_count')) if isinstance(stats,dict) else None
    return (display==intent['display_name'] and model==intent['model'] and
            file==journal.get('input_file') and file is not None and
            (count is None or str(count)==str(intent['request_count'])))


def reconcile(args,run):
    """Read/list only; recovering zero/ambiguous matches NEVER authorizes resubmit."""
    intent=core.read_json(run/'submit-intent.private.json')
    journal=core.read_json(run/'job.json') if (run/'job.json').exists() else {}
    if intent.get('input_sha256')!=prepared(run)['input_sha256']:
        raise core.SafeError('Submit intent does not bind current frozen input.')
    if journal.get('job_name'):
        print(json.dumps({'state':'ALREADY_CONFIRMED'}));return
    key=core.credential(args)
    from urllib.parse import urlencode
    token=None;matches=[];pages=[]
    for _ in range(100):
        query={'pageSize':100}
        if token:query['pageToken']=token
        result=core.api('GET',core.BASE+'/v1beta/batches?'+urlencode(query),key)
        operations=result.get('operations',result.get('batches',[]))
        if not isinstance(operations,list):raise core.SafeError('Batch list schema unrecognized; no resubmit allowed.')
        pages.append(result)
        matches.extend(op for op in operations if isinstance(op,dict) and matching_operation(op,intent,journal))
        token=result.get('nextPageToken',result.get('next_page_token'))
        if not token:break
    else:
        core.save(run/'reconcile.private.json',{'state':'PAGINATION_INCOMPLETE','pages':pages})
        raise core.SafeError('Batch reconciliation listing incomplete; no resubmit allowed.')
    core.save(run/'reconcile.private.json',{'state':'MATCHED' if len(matches)==1 else 'UNCONFIRMED','matches':matches,'pages':pages})
    if len(matches)!=1:
        raise core.SafeError('Batch outcome remains unconfirmed or ambiguous; no automatic paid resubmission allowed.')
    candidate=matches[0];name=candidate.get('name',candidate.get('metadata',{}).get('name'))
    if not isinstance(name,str) or not re.fullmatch(r'batches/[A-Za-z0-9_.-]+',name):raise core.SafeError('Matched operation has invalid resource name.')
    result=core.api('GET',core.BASE+'/v1beta/'+name,key)
    if not matching_operation(result,intent,journal):raise core.SafeError('Detailed operation does not match paid intent; no adoption/resubmit allowed.')
    raw=result.get('metadata',result).get('state','UNKNOWN')
    journal.update(job_name=name,state=core.normalize_state(raw),raw_state=raw,reconciled_at=int(time.time()))
    intent.update(state='RECONCILED',reconciled_at=int(time.time()))
    core.save(run/'job.json',journal);core.save(run/'submit-intent.private.json',intent);core.save(run/'status.private.json',result)
    print(json.dumps({'state':'RECONCILED','requests':intent['request_count']}))
