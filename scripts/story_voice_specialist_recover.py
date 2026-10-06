#!/usr/bin/env python3
"""Offline completion of a validated specialist cache's unfinished intent.

No requests, credentials, cache rewriting or automatic merging. Dry-run first;
apply only finishes RECORDED_BEFORE_HTTP intents whose response/cache exist.
"""
import argparse
import copy
import json
from pathlib import Path
import sys
import story_voice_specialist_asr as specialist
from story_voice_specialist_asr import common,core


def proposals(source,run,ids):
    plan=specialist.prepared(source,run,validate_current=False)
    known={entry['binding']['id']:entry for entry in plan['entries']}
    specialist.require(ids and len(ids)==len(set(ids)) and set(ids)<=set(known),'Select unique known frozen specialist IDs.')
    state=specialist.source_state(source);result=[]
    for ident in ids:
        _,binding=specialist.current_binding(source,ident,state)
        cache=specialist.cache_path(source/specialist.FOLDER,ident,binding)
        specialist.require(cache.is_file(),'Existing cache required; this helper cannot recover unknown HTTP outcomes.')
        record=core.read_json(cache)
        specialist.require(record.get('run_file')==str((run/'scope.private.json').relative_to(source)),'Cached response belongs to another frozen scope.')
        specialist.validate_record(source,record,state)
        intent_path=run/(ident+'.intent.private.json');intent=core.read_json(intent_path)
        specialist.require(intent.get('state') in {'RECORDED_BEFORE_HTTP','RESPONSE_VALIDATED'},'Ambiguous specialist intent state; no recovery allowed.')
        if intent['state']=='RESPONSE_VALIDATED':
            specialist.require(intent.get('raw_response_sha256')==record['raw_response_sha256'],'Completed specialist intent has mismatched raw response.')
            changed=False;updated=intent
        else:
            specialist.require('raw_response_sha256' not in intent,'Unfinished specialist intent has ambiguous completion metadata.')
            changed=True;updated=copy.deepcopy(intent);updated.update(state='RESPONSE_VALIDATED',raw_response_sha256=record['raw_response_sha256'])
        result.append({'id':ident,'intent':intent,'updated_intent':updated,'intent_file':intent_path,'intent_sha256':core.digest(intent_path.read_bytes()),'cache_file':cache,'cache_sha256':core.digest(cache.read_bytes()),'changed':changed})
    return result


def recover(source,run,ids,apply=False):
    # Same source lock as normal specialist execution; never race its cache writes.
    with common.run_lock(source):
        reviewed=proposals(source,run,ids)
        if apply:
            for item in reviewed:
                fresh=proposals(source,run,[item['id']])[0]
                specialist.require(fresh==item,'Specialist recovery evidence changed before write.')
                if item['changed']:core.save(item['intent_file'],item['updated_intent'])
        return {'state':'OFFLINE_INTENTS_COMPLETED' if apply else 'VALIDATED_ONLY','ids':ids,'completed':sum(item['changed'] for item in reviewed),'already_complete':sum(not item['changed'] for item in reviewed),'network_requests':0}


def main():
    common.configure();parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['dry-run','apply']);parser.add_argument('--run-dir',required=True);parser.add_argument('--name',required=True);parser.add_argument('--only-ids',required=True)
    args=parser.parse_args()
    try:
        source=core.directory(args.run_dir);specialist.require(specialist.SAFE_NAME.fullmatch(args.name),'Invalid frozen specialist scope name.')
        run=source/specialist.FOLDER/'runs'/args.name
        specialist.require(run.is_dir(),'Existing specialist scope required.')
        print(json.dumps(recover(source,run,args.only_ids.split(','),args.command=='apply')));return 0
    except (core.SafeError,OSError,ValueError,KeyError,TypeError) as error:
        print(str(error) if isinstance(error,core.SafeError) else 'Invalid specialist recovery evidence; no requests sent.',file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
