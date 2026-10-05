#!/usr/bin/env python3
"""Frozen, explicitly selected TTS retakes through Batch, never Standard fallback.

prepare --run-dir <story-parent> --batch-name NAME --only-ids IDS
        --delivery-overrides PRIVATE.json
submit|status|reconcile|collect|import --run-dir <story-parent> --batch-name NAME
collect --import performs explicit archival/import only after qualified collection.
Private journals/output live under parent/retake-batches/NAME. Original parent
requests, sources, profiles and public bank are never rewritten.
"""
from __future__ import annotations
import argparse
import copy
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import time
import uuid
import story_voice_common as common
from story_voice_common import core
import story_voice_generate as generate
import prolog_voice_generate as standard

MODEL='gemini-3.8-flash-tts'
SAFE_NAME=re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\Z')
ORIGINAL_STORY_PREPARED=common.prepared
SOURCE_FILES=['prepared.json','profiles.private.json','lines.private.json','requests.jsonl']


def bank(parent,rows):
    hashes={}
    for ident in rows:
        p=parent/'clips'/(ident+'.mp3')
        if not p.is_file() or not p.stat().st_size:raise core.SafeError('Parent bank has a missing/empty MP3; restore originals before preparing retakes.')
        hashes[ident]=core.digest(p.read_bytes())
    return hashes,core.digest(json.dumps(hashes,sort_keys=True).encode())


def locations(parent,name):
    if not SAFE_NAME.fullmatch(name):raise core.SafeError('Invalid private retake batch name.')
    run=parent/'retake-batches'/name;run.mkdir(parents=True,exist_ok=True);os.chmod(run,0o700)
    return run


def parent_state(parent):
    if core.MODEL!=MODEL:raise core.SafeError('Retake adapter requires original TTS model context.')
    ORIGINAL_STORY_PREPARED(parent)
    manifest=core.read_json(parent/'lines.private.json');profiles=core.read_json(parent/'profiles.private.json')
    rows={r['id']:r for r in manifest['lines']}
    records=[json.loads(line) for line in (parent/'requests.jsonl').read_text().splitlines() if line.strip()]
    return manifest,profiles,rows,records


def prepare(args,parent,run):
    if (run/'prepared.json').exists() or (run/'job.json').exists():raise core.SafeError('Retake batch already frozen; resume or use a fresh name.')
    manifest,profiles,rows,records=parent_state(parent)
    ids=args.only_ids.split(',') if args.only_ids else []
    selected=set(ids)
    if not ids or len(ids)!=len(selected) or not selected.issubset(rows):raise core.SafeError('Retakes need explicit unique known IDs.')
    overrides=generate.load_delivery_overrides(args.delivery_overrides,selected)
    changed=generate.apply_delivery_overrides(records,selected,overrides)
    selected_records=[r for r in changed if r['key'] in selected]
    hashes,bank_hash=bank(parent,rows)
    manifest=copy.deepcopy(manifest);manifest['lines']=[r for r in manifest['lines'] if r['id'] in selected]
    manifest['runtime_lookup']=[r for r in manifest['runtime_lookup'] if r['asset_id'] in selected]
    requests=[{'key':r['key'],'request':r['request']} for r in selected_records]
    payload=''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in requests).encode()
    (run/'requests.jsonl').write_bytes(payload);os.chmod(run/'requests.jsonl',0o600)
    core.save(run/'lines.private.json',manifest);core.save(run/'profiles.private.json',profiles)
    core.save(run/'delivery-overrides.private.json',overrides)
    snapshot={'model':MODEL,'parent':str(parent),'parent_file_sha256':{f:core.digest((parent/f).read_bytes()) for f in SOURCE_FILES},
              'bank_sha256':bank_hash,'bank_mp3_sha256':hashes,'selected_ids':[r['key'] for r in requests],
              'modified_request_sha256':{r['key']:core.digest(json.dumps(r['request'],sort_keys=True).encode()) for r in requests},
              'source_text_sha256':{i:core.digest(rows[i]['text'].encode()) for i in selected},'fixed_google_voices':{i:profiles['speakers'][rows[i]['speaker']]['google_voice'] for i in selected}}
    core.save(run/'parent-snapshot.private.json',snapshot)
    core.save(run/'prepared.json',{'bank':'story-retake','model':MODEL,'request_count':len(requests),'input_bytes':len(payload),'input_sha256':core.digest(payload),
              'frozen_sha256':{f:core.digest((run/f).read_bytes()) for f in ['lines.private.json','profiles.private.json','delivery-overrides.private.json','parent-snapshot.private.json']}})
    print(json.dumps({'state':'RETAKE_PREPARED','requests':len(requests),'input_bytes':len(payload),'parent_clips':len(rows)}))


def prepared(run,parent=None,verify_bank=True,allow_completed_disjoint=False):
    info=core.read_json(run/'prepared.json');snapshot=core.read_json(run/'parent-snapshot.private.json')
    if info.get('bank')!='story-retake' or info.get('model')!=MODEL or snapshot.get('model')!=MODEL:raise core.SafeError('Retake model/frozen bank mismatch.')
    parent=parent or Path(snapshot['parent']).resolve()
    if snapshot.get('parent')!=str(parent):raise core.SafeError('Unexpected retake parent run.')
    manifest,profiles,rows,original=parent_state(parent)
    for f,h in snapshot['parent_file_sha256'].items():
        if core.digest((parent/f).read_bytes())!=h:raise core.SafeError('Frozen parent source/profile/requests changed.')
    for f,h in info['frozen_sha256'].items():
        if core.digest((run/f).read_bytes())!=h:raise core.SafeError('Retake subset/style/snapshot changed after freeze.')
    selected=set(snapshot['selected_ids'])
    if len(selected)!=len(snapshot['selected_ids']) or not selected.issubset(rows):raise core.SafeError('Retake snapshot ID mismatch.')
    overrides=generate.load_delivery_overrides(run/'delivery-overrides.private.json',selected)
    changed=generate.apply_delivery_overrides(original,selected,overrides)
    expected=[{'key':r['key'],'request':r['request']} for r in changed if r['key'] in selected]
    payload=(run/'requests.jsonl').read_bytes();requests=[json.loads(s) for s in payload.splitlines() if s.strip()]
    if requests!=expected or info.get('request_count')!=len(expected) or info.get('input_bytes')!=len(payload) or info.get('input_sha256')!=core.digest(payload):raise core.SafeError('Retake payload/IDs/count differ from validated original words and selected delivery plan.')
    for r in requests:
        ident=r['key'];voice=r['request']['generationConfig']['speechConfig']['voiceConfig']['voice']
        if voice!=snapshot['fixed_google_voices'][ident] or voice!=profiles['speakers'][rows[ident]['speaker']]['google_voice'] or snapshot['source_text_sha256'][ident]!=core.digest(rows[ident]['text'].encode()) or snapshot['modified_request_sha256'][ident]!=core.digest(json.dumps(r['request'],sort_keys=True).encode()):raise core.SafeError('Fixed source words/voice or modified request hash mismatch.')
    if verify_bank:
        hashes,h=bank(parent,rows)
        if hashes!=snapshot['bank_mp3_sha256'] or h!=snapshot['bank_sha256']:
            if not allow_completed_disjoint:raise core.SafeError('Parent MP3 bank changed since retake freeze; no import or paid submit allowed.')
            validated_disjoint_imports(run,parent,snapshot,hashes)
    return info


def validated_disjoint_imports(run,parent,snapshot,current):
    """Explain every changed unselected byte through completed, frozen imports."""
    changed={i for i,h in current.items() if h!=snapshot['bank_mp3_sha256'].get(i)}
    selected=set(snapshot['selected_ids']);explained=set();journals={}
    if changed & selected:raise core.SafeError('Selected retake audio changed since freeze.')
    for other in sorted((parent/'retake-batches').iterdir()):
        if not other.is_dir() or other==run or not (other/'import.private.json').exists():continue
        journal=core.read_json(other/'import.private.json')
        if journal.get('state')!='IMPORTED':continue
        other_snapshot=core.read_json(other/'parent-snapshot.private.json')
        ids=set(other_snapshot['selected_ids'])
        if not ids & changed:continue
        if ids & selected:raise core.SafeError('Completed retake overlaps selected IDs.')
        prepared(other,parent,verify_bank=False)
        if set(journal.get('selected_ids',[]))!=ids or set(journal.get('new_mp3_sha256',{}))!=ids:raise core.SafeError('Completed retake import journal scope is invalid.')
        for ident in ids:
            if other_snapshot['bank_mp3_sha256'].get(ident)!=snapshot['bank_mp3_sha256'].get(ident):raise core.SafeError('Disjoint retake does not originate from this frozen audio snapshot.')
            receipt=core.read_json(other/'raw'/(ident+'.receipt.json'))
            if receipt.get('status')!='complete' or receipt.get('model')!=MODEL or receipt.get('request_sha256')!=other_snapshot['modified_request_sha256'][ident]:raise core.SafeError('Completed retake receipt does not bind its frozen request.')
            for bank_run in [other,parent]:
                wav=bank_run/'raw'/(ident+'.wav');mp3=bank_run/'clips'/(ident+'.mp3');r=core.read_json(bank_run/'raw'/(ident+'.receipt.json'))
                if r!=receipt or standard.valid_audio(wav) is None or core.digest(wav.read_bytes())!=receipt.get('wav_sha256') or core.digest(mp3.read_bytes())!=receipt.get('mp3_sha256'):raise core.SafeError('Completed disjoint retake audio or receipt is invalid.')
            if journal['new_mp3_sha256'][ident]!=current[ident] or current[ident]!=receipt['mp3_sha256']:raise core.SafeError('Completed retake import hash differs from current audio.')
        if explained & ids:raise core.SafeError('Multiple completed imports claim changed audio.')
        explained.update(ids);journals[str(other/'import.private.json')]=core.digest((other/'import.private.json').read_bytes())
    if changed-explained:raise core.SafeError('Unexplained parent audio changes; disjoint import refused.')
    return journals


def reserve(parent,run):
    root=parent/'retake-batches';ledger=root/'reservations.private.json';snapshot=core.read_json(run/'parent-snapshot.private.json')
    keys=[i+':'+snapshot['bank_mp3_sha256'][i]+':'+snapshot['modified_request_sha256'][i]+':'+MODEL for i in snapshot['selected_ids']]
    with (root/'reservations.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        entries=core.read_json(ledger) if ledger.exists() else {}
        if any(k in entries and entries[k]['run']!=str(run) for k in keys):raise core.SafeError('This exact current-audio/request/model retake is already reserved by another batch.')
        for k in keys:entries[k]={'run':str(run),'reserved_at':int(time.time())}
        core.save(ledger,entries);fcntl.flock(lock,fcntl.LOCK_UN)


def submit(args,parent,run):
    if (run/'job.json').exists() or (run/'submit-intent.private.json').exists():raise core.SafeError('Retake submit intent exists; use status/reconcile, never automatically resubmit.')
    info=prepared(run,parent);key=core.credential(args);reserve(parent,run)
    intent={'display_name':'selantis-story-retake-'+uuid.uuid4().hex,'model':MODEL,'input_sha256':info['input_sha256'],'request_count':info['request_count'],'state':'RECORDED_BEFORE_NETWORK'}
    core.save(run/'submit-intent.private.json',intent)
    original_key,original_api,original_prepared=core.credential,core.api,core.prepared
    def api(method,url,k,body=None,headers=None,raw=False):
        if isinstance(body,dict):
            body=copy.deepcopy(body)
            for field in ['file','batch']:
                if isinstance(body.get(field),dict) and 'display_name' in body[field]:body[field]['display_name']=intent['display_name']
        return original_api(method,url,k,body,headers,raw)
    try:
        core.credential=lambda _:key;core.api=api;core.prepared=lambda r:prepared(r,parent)
        core.submit(args,run);intent['state']='CONFIRMED';core.save(run/'submit-intent.private.json',intent)
    except core.SafeError:
        intent['state']='OUTCOME_UNCONFIRMED';core.save(run/'submit-intent.private.json',intent);raise
    finally:core.credential,core.api,core.prepared=original_key,original_api,original_prepared


def collect(args,parent,run):
    prepared(run,parent,allow_completed_disjoint=getattr(args,'allow_completed_disjoint_retakes',False))
    # Qualified Batch decoding, two-pass normalization and receipt/request hashes.
    common.collect(args,run)
    snapshot=core.read_json(run/'parent-snapshot.private.json');overrides=core.read_json(run/'delivery-overrides.private.json')
    originals={r['key']:r for r in [json.loads(s) for s in (parent/'requests.jsonl').read_text().splitlines() if s.strip()]}
    selected=set(snapshot['selected_ids']);changed={r['key']:r for r in generate.apply_delivery_overrides(list(originals.values()),selected,overrides)}
    proposal=core.read_json(run/'public-manifest.proposed.json')
    for clip in proposal['clips']:
        p=run/'raw'/(clip['id']+'.receipt.json');r=core.read_json(p)
        r.update(model=MODEL,delivery_override=changed[clip['id']]['delivery_override'],retake_parent_mp3_sha256=snapshot['bank_mp3_sha256'][clip['id']])
        core.save(p,r)
    if args.import_audio:return import_audio(args,parent,run)
    return 0 if not core.read_json(run/'collection.private.json').get('failures') else 1


def import_audio(args,parent,run):
    # Repeat-safe import completes parent reconstruction, never archives twice.
    done=run/'import.private.json'
    if done.exists():
        journal=core.read_json(done)
        if journal.get('state')=='IMPORTED':
            for ident,h in journal['new_mp3_sha256'].items():
                if core.digest((parent/'clips'/(ident+'.mp3')).read_bytes())!=h:raise core.SafeError('Previously imported retake changed; manual review required.')
            rebuild(parent,args);return 0
        raise core.SafeError('Import journal is incomplete. Do not repeat archive/import automatically; inspect preserved private files.')
    prepared(run,parent,allow_completed_disjoint=getattr(args,'allow_completed_disjoint_retakes',False))
    result=core.read_json(run/'collection.private.json');snapshot=core.read_json(run/'parent-snapshot.private.json')
    selected=snapshot['selected_ids']
    if result.get('failures') or result.get('collected')!=len(selected):raise core.SafeError('Retake collection incomplete; no parent clips changed.')
    receipts={}
    for ident in selected:
        r=core.read_json(run/'raw'/(ident+'.receipt.json'));wav=run/'raw'/(ident+'.wav');mp3=run/'clips'/(ident+'.mp3')
        if r.get('status')!='complete' or r.get('model')!=MODEL or r.get('request_sha256')!=snapshot['modified_request_sha256'][ident] or standard.valid_audio(wav) is None or r.get('wav_sha256')!=core.digest(wav.read_bytes()) or r.get('mp3_sha256')!=core.digest(mp3.read_bytes()):raise core.SafeError('A collected normalized retake/receipt is invalid; import refused before mutation.')
        receipts[ident]=r
    with common.run_lock(parent):
        prepared(run,parent,allow_completed_disjoint=getattr(args,'allow_completed_disjoint_retakes',False)) # Final full bank/source freeze check under mutation lock.
        current,_=bank(parent,{r['id']:r for r in core.read_json(parent/'lines.private.json')['lines']})
        validated=validated_disjoint_imports(run,parent,snapshot,current) if getattr(args,'allow_completed_disjoint_retakes',False) else {}
        archive=parent/'rejected'/('batch-retake-'+args.batch_name+'-'+str(time.time_ns()))
        journal={'state':'IMPORT_INTENT_RECORDED','archive':str(archive),'selected_ids':selected,'new_mp3_sha256':{i:r['mp3_sha256'] for i,r in receipts.items()},'validated_disjoint_import_journal_sha256':validated}
        core.save(done,journal);archive.mkdir(parents=True)
        for ident in selected:
            for relative in ['raw/'+ident+'.wav','raw/'+ident+'.receipt.json','clips/'+ident+'.mp3']:
                prior=parent/relative
                if prior.exists():shutil.copyfile(prior,archive/prior.name)
        journal['state']='ORIGINALS_ARCHIVED';core.save(done,journal)
        for ident in selected:
            for relative in ['raw/'+ident+'.wav','raw/'+ident+'.receipt.json','clips/'+ident+'.mp3']:
                target=parent/relative;temporary=target.with_name(target.name+'.retake-import.tmp')
                shutil.copyfile(run/relative,temporary);os.chmod(temporary,0o600);temporary.replace(target)
        journal['state']='IMPORTED';core.save(done,journal)
        rebuild(parent,args)
        print(json.dumps({'state':'RETAKES_IMPORTED','selected':len(selected)}));return 0


def rebuild(parent,args):
    manifest=core.read_json(parent/'lines.private.json');profiles=core.read_json(parent/'profiles.private.json');clips=[];failures=[]
    for row in manifest['lines']:
        ident=row['id'];path=parent/'raw'/(ident+'.receipt.json');r=core.read_json(path) if path.exists() else {}
        wav=parent/'raw'/(ident+'.wav');mp3=parent/'clips'/(ident+'.mp3')
        if r.get('status')=='complete' and standard.valid_audio(wav) is not None and mp3.is_file() and r.get('wav_sha256')==core.digest(wav.read_bytes()) and r.get('mp3_sha256')==core.digest(mp3.read_bytes()):
            c=standard.clip_entry(parent,manifest,row,r);c['runtime_keys']=common.frozen_runtime_keys(manifest,row);clips.append(c)
        else:failures.append({'id':ident,'reason':'missing_or_invalid_audio'})
    core.save(parent/'collection.private.json',{'backend':'batch-retake-merge','collected':len(clips),'expected':len(manifest['lines']),'failures':failures})
    # Private proposal only: a changed audio bank must receive fresh QA/alignment.
    common.publish(parent,SimpleNamespacePublic(),{'model':MODEL,'aliases':manifest.get('alias_map',{}),'clips':clips},manifest)


class SimpleNamespacePublic:
    public_dir=None


def main():
    os.umask(0o077);common.configure()
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['prepare','submit','status','reconcile','collect','import'])
    parser.add_argument('--run-dir',required=True);parser.add_argument('--batch-name',required=True)
    parser.add_argument('--only-ids');parser.add_argument('--delivery-overrides');parser.add_argument('--import',dest='import_audio',action='store_true')
    parser.add_argument('--allow-completed-disjoint-retakes',action='store_true')
    parser.add_argument('--key-stdin',action='store_true');parser.add_argument('--keychain-service');parser.add_argument('--keychain-account')
    args=parser.parse_args();args.public_dir=None
    if args.allow_completed_disjoint_retakes and args.command not in ['collect','import']:parser.error('Disjoint completion allowance is restricted to collect/import')
    if args.key_stdin and args.keychain_service:parser.error('Choose one credential source')
    if args.command=='prepare' and (not args.only_ids or not args.delivery_overrides):parser.error('prepare requires only-ids and delivery-overrides')
    if args.command!='prepare' and (args.only_ids or args.delivery_overrides):parser.error('Retake IDs/styles are frozen at prepare')
    if args.import_audio and args.command!='collect':parser.error('--import is only valid with collect; import command is explicit already')
    try:
        parent=core.directory(args.run_dir);parent_state(parent)
        run=locations(parent,args.batch_name);_lock=common.run_lock(run)
        if args.command=='prepare':prepare(args,parent,run);return 0
        if args.command=='import':return import_audio(args,parent,run)
        prepared(run,parent,verify_bank=args.command!='status',allow_completed_disjoint=args.allow_completed_disjoint_retakes)
        if args.command=='submit':submit(args,parent,run);return 0
        if args.command=='status':core.status(args,run);return 0
        if args.command=='reconcile':
            original=common.prepared
            try:common.prepared=lambda r:prepared(r,parent);common.reconcile(args,run)
            finally:common.prepared=original
            return 0
        return collect(args,parent,run)
    except (core.SafeError,OSError,ValueError,KeyError,TypeError) as error:
        print(str(error) if isinstance(error,core.SafeError) else 'Invalid private retake artifact; originals retained. No automatic retry.',file=__import__('sys').stderr);return 1

if __name__=='__main__':raise SystemExit(main())
