#!/usr/bin/env python3
"""Frozen story Batch prepare/submit/status/cancel/collect. No automatic submit retry."""
import argparse
import json
import os
import time
import story_voice_common as common
from story_voice_common import core


def main():
    os.umask(0o077);common.configure()
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['prepare','submit','status','reconcile','cancel','collect'])
    common.shared_args(parser);common.selection_args(parser)
    args=parser.parse_args()
    if args.key_stdin and args.keychain_service:parser.error('Choose one credential source')
    try:
        run=core.directory(args.run_dir);_operation_lock=common.run_lock(run)
        if args.command=='prepare':common.prepare(args,run);return 0
        common.prepared(run)
        if any([args.chapter,args.speaker,args.only_ids]):
            raise core.SafeError('Paid batch selection is frozen at prepare; use a separate prepared segment.')
        if args.command=='submit':
            if (run/'job.json').exists():raise core.SafeError('Submit journal exists; no duplicate creation allowed.')
            key=core.credential(args) # Credential validation before reservation/submit journal.
            records=[json.loads(s) for s in (run/'requests.jsonl').read_text().splitlines() if s.strip()]
            common.reserve(run,records,'batch')
            intent=common.new_submit_intent(run) # Persisted before the first upload/network call.
            original=core.credential;original_api=core.api
            def story_api(method,url,key,body=None,headers=None,raw=False):
                if isinstance(body,dict):
                    body=__import__('copy').deepcopy(body)
                    for field in ['file','batch']:
                        if isinstance(body.get(field),dict) and isinstance(body[field].get('display_name'),str):
                            body[field]['display_name']=intent['display_name']
                return original_api(method,url,key,body,headers,raw)
            try:
                core.api=story_api
                core.credential=lambda _:key
                core.submit(args,run)
                intent.update(state='CONFIRMED');core.save(run/'submit-intent.private.json',intent)
            except core.SafeError:
                intent.update(state='OUTCOME_UNCONFIRMED');core.save(run/'submit-intent.private.json',intent)
                raise
            finally:core.credential=original;core.api=original_api
        elif args.command=='status':core.status(args,run)
        elif args.command=='reconcile':common.reconcile(args,run)
        elif args.command=='cancel':
            receipt=core.read_json(run/'job.json')
            if receipt.get('cancel_requested_at'):raise core.SafeError('Cancellation already requested; use status.')
            key=core.credential(args);result,state=core.fetch_status(args,run,key)
            if state in core.TERMINAL:print(json.dumps({'state':state,'cancelled':False}));return 0
            name=receipt.get('job_name')
            if not isinstance(name,str) or not __import__('re').fullmatch(r'batches/[A-Za-z0-9_.-]+',name):raise core.SafeError('No valid confirmed batch job.')
            receipt.update(cancel_requested_at=int(time.time()));core.save(run/'job.json',receipt)
            result=core.api('POST',core.BASE+'/v1beta/'+name+':cancel',key,{})
            core.save(run/'cancel.private.json',result);print(json.dumps({'state':'CANCEL_REQUESTED'}))
        else:
            common.collect(args,run)
        return 0
    except (core.SafeError,OSError,ValueError,TypeError,KeyError) as error:
        print(str(error) if isinstance(error,core.SafeError) else 'Invalid story artifact; private data retained.',file=__import__('sys').stderr);return 1

if __name__=='__main__':raise SystemExit(main())
