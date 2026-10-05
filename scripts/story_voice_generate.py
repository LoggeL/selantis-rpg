#!/usr/bin/env python3
"""Standard story retakes reuse qualified transport, normalization and override hooks.

Batch is primary production transport; standard takes require explicit --only-ids.
Existing completed Batch audio in this same frozen run is reused. Fresh retakes
archive previous audio, accept short delivery styles, and never mutate JSONL.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor,as_completed
import json
import os
import time
import story_voice_common as common
from story_voice_common import core
import prolog_voice_generate as standard


def main():
    os.umask(0o077);common.configure()
    parser=argparse.ArgumentParser(description=__doc__)
    common.shared_args(parser)
    parser.add_argument('--only-ids',required=True);parser.add_argument('--workers',type=int,choices=[1,2,3],default=2)
    parser.add_argument('--request-interval',type=float,default=6.2)
    parser.add_argument('--retake',action='store_true');parser.add_argument('--delivery-style');parser.add_argument('--retake-text')
    parser.add_argument('--export-only',action='store_true')
    args=parser.parse_args()
    if args.request_interval<.1:parser.error('Request interval must be at least0.1seconds')
    if args.key_stdin and args.keychain_service:parser.error('Choose one credential source')
    override=args.delivery_style is not None or args.retake_text is not None
    if override and (not args.retake or args.export_only):parser.error('Delivery override requires scoped generation --retake')
    try:
        run=core.directory(args.run_dir);_operation_lock=common.run_lock(run);common.prepared(run)
        manifest=core.read_json(run/'lines.private.json');profiles=core.read_json(run/'profiles.private.json')
        rows={r['id']:r for r in manifest['lines']};selected=set(args.only_ids.split(','))
        if not selected or not selected.issubset(rows):raise core.SafeError('Unknown or empty story ID selection.')
        records=[json.loads(s) for s in (run/'requests.jsonl').read_text().splitlines() if s.strip()]
        if override:records=[standard.delivery_record(r,selected,args.delivery_style,args.retake_text) for r in records]
        key=None if args.export_only else core.credential(args) # Always before archival.
        if not args.retake and not args.export_only and (run/'job.json').exists():
            # A Batch owns these IDs. Default Standard mode can resume its audio,
            # but may never race the Batch or silently regenerate missing takes.
            for ident in selected:
                p=run/'raw'/(ident+'.receipt.json');r=core.read_json(p) if p.exists() else {}
                wav=run/'raw'/(ident+'.wav');mp3=run/'clips'/(ident+'.mp3')
                if r.get('status')!='complete' or standard.valid_audio(wav) is None or not mp3.exists() or r.get('wav_sha256')!=core.digest(wav.read_bytes()) or r.get('mp3_sha256')!=core.digest(mp3.read_bytes()):
                    raise core.SafeError('Batch owns this missing/invalid clip; finish collect or request an explicit reviewed retake.')
        if args.retake and not args.export_only:
            archive=run/'rejected'/('retake-'+str(time.time_ns()))
            collection=core.read_json(run/'collection.private.json') if (run/'collection.private.json').exists() else {}
            known_failures={f.get('id') for f in collection.get('failures',[]) if f.get('reason') in {'provider_error','invalid_audio'}}
            for ident in selected:
                p=run/'raw'/(ident+'.receipt.json');receipt=core.read_json(p) if p.exists() else {}
                if receipt.get('status') not in {'complete','audio_invalid','rejected'} and ident not in known_failures:
                    raise core.SafeError('Uncertain or missing prior take; manual review required.')
            archive.mkdir(parents=True)
            for ident in selected:
                for p in [run/'raw'/(ident+'.wav'),run/'raw'/(ident+'.receipt.json'),run/'clips'/(ident+'.mp3')]:
                    if p.exists():p.rename(archive/p.name)
        elif not args.export_only:
            # No paid standard duplication of another submitted batch segment.
            if not (run/'job.json').exists():common.reserve(run,[r for r in records if r['key'] in selected],'standard')
        (run/'raw').mkdir(exist_ok=True);(run/'clips').mkdir(exist_ok=True)
        failures=[]
        if not args.export_only:
            limiter=standard.StartLimiter(args.request_interval)
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures={pool.submit(standard.make_clip,run,r,rows[r['key']],key,limiter):r['key'] for r in records if r['key'] in selected}
                for future in as_completed(futures):
                    ident=futures[future]
                    try:receipt,resumed=future.result();print(json.dumps({'id':ident,'state':'resumed' if resumed else 'complete','seconds':receipt['seconds']}),flush=True)
                    except (core.SafeError,OSError,ValueError,KeyError) as error:
                        failures.append({'id':ident,'provider_error':error.summary if isinstance(error,standard.ProviderError) else {'message':'Selected take failed; inspect private receipt.'}})
                        print(json.dumps({'id':ident,'state':'failed'}),flush=True)
        clips=[]
        for row in manifest['lines']:
            ident=row['id'];rp=run/'raw'/(ident+'.receipt.json');wav=run/'raw'/(ident+'.wav');mp3=run/'clips'/(ident+'.mp3')
            receipt=core.read_json(rp) if rp.exists() else {}
            if receipt.get('status')=='complete' and standard.valid_audio(wav) is not None and mp3.exists() and receipt.get('wav_sha256')==core.digest(wav.read_bytes()) and receipt.get('mp3_sha256')==core.digest(mp3.read_bytes()):clips.append(standard.clip_entry(run,manifest,row,receipt))
            elif not any(f['id']==ident for f in failures):failures.append({'id':ident,'reason':'missing_or_invalid_audio'})
        for clip in clips:clip['runtime_keys']=common.frozen_runtime_keys(manifest,rows[clip['id']])
        core.save(run/'collection.private.json',{'backend':'standard','collected':len(clips),'expected':len(rows),'failures':failures})
        common.publish(run,args,{'model':core.MODEL,'aliases':manifest.get('alias_map',{}),'clips':clips},manifest)
        print(json.dumps({'state':'COMPLETE' if not failures else 'INCOMPLETE','collected':len(clips),'expected':len(rows)}))
        return 0 if not failures else 1
    except (core.SafeError,OSError,ValueError,TypeError,KeyError) as error:
        print(str(error) if isinstance(error,core.SafeError) else 'Invalid story artifact; private data retained.',file=__import__('sys').stderr);return 1

if __name__=='__main__':raise SystemExit(main())
