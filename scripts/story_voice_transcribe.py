#!/usr/bin/env python3
"""Private, explicitly scoped independent ASR of current story MP3s.

The authored transcript is never supplied to Gemini. No automatic network retry,
no source/audio changes, and no unscoped whole-bank transcription.
"""
from __future__ import annotations
import argparse
import base64
import json
import os
from pathlib import Path
import time
import story_voice_common as common
from story_voice_common import core

MODEL = 'gemini-3.8-flash'
PROMPT = 'Transcribe the spoken German words in this audio exactly. Preserve repetitions, colloquial contractions and grammatical errors. Do not correct, paraphrase, complete or translate. No expected transcript is supplied. Return JSON with a single transcript string.'


def text_hash(value):
    return core.digest(value.encode('utf-8'))


def request_for(audio):
    return {'contents':[{'role':'user','parts':[{'text':PROMPT},
            {'inlineData':{'mimeType':'audio/mpeg','data':base64.b64encode(audio).decode('ascii')}}]}],
            'generationConfig':{'temperature':0,'responseMimeType':'application/json',
                'responseSchema':{'type':'OBJECT','properties':{'transcript':{'type':'STRING'}},'required':['transcript']}}}


def response_transcript(response):
    if response.get('modelVersion') != MODEL: raise core.SafeError('Unexpected independent ASR model version.')
    candidates=response.get('candidates')
    if not isinstance(candidates,list) or len(candidates)!=1 or candidates[0].get('finishReason')!='STOP':
        raise core.SafeError('Independent ASR response is incomplete.')
    parts=candidates[0].get('content',{}).get('parts',[])
    if not isinstance(parts,list) or not parts or any(not isinstance(p.get('text'),str) for p in parts):
        raise core.SafeError('Independent ASR response is not text.')
    decoded=json.loads(''.join(p['text'] for p in parts))
    if not isinstance(decoded,dict) or set(decoded)!={'transcript'} or not isinstance(decoded['transcript'],str):
        raise core.SafeError('Invalid independent transcription schema.')
    return decoded['transcript']


def cached_record(record,clip_hash,source_hash):
    if not isinstance(record,dict):return False
    if (record.get('clip_sha256')!=clip_hash or record.get('source_audio_sha256')!=clip_hash
        or record.get('upload_sha256')!=clip_hash or record.get('source_text_sha256')!=source_hash
        or record.get('prompt')!=PROMPT or record.get('model')!=MODEL
        or record.get('input_mime_type')!='audio/mpeg'):return False
    try:return response_transcript(record['response'])==record.get('transcript')
    except (core.SafeError,KeyError,TypeError,ValueError):return False


def main():
    os.umask(0o077);common.configure()
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',required=True)
    parser.add_argument('--only-ids',required=True)
    parser.add_argument('--key-stdin',action='store_true')
    parser.add_argument('--keychain-service');parser.add_argument('--keychain-account')
    args=parser.parse_args()
    if args.key_stdin and args.keychain_service:parser.error('Choose one credential source')
    try:
        run=core.directory(args.run_dir);_lock=common.run_lock(run);common.prepared(run)
        rows={r['id']:r for r in core.read_json(run/'lines.private.json')['lines']}
        selected=list(dict.fromkeys(args.only_ids.split(',')))
        if not selected or not set(selected).issubset(rows):raise core.SafeError('Unknown or empty recording IDs.')
        if any(not (run/'clips'/(ident+'.mp3')).is_file() for ident in selected):raise core.SafeError('Missing selected MP3.')
        folder=run/'independent-google-asr';folder.mkdir(exist_ok=True)
        records=[];key=None
        for ident in selected:
            clip=run/'clips'/(ident+'.mp3');audio=clip.read_bytes();sha=core.digest(audio)
            source_hash=text_hash(rows[ident]['text'])
            target=folder/(ident+'.'+sha[:16]+'.json')
            record=core.read_json(target) if target.exists() else None
            if record is not None and not cached_record(record,sha,source_hash):
                raise core.SafeError('Cached transcription belongs to another source or method.')
            if record is None:
                if key is None:key=core.credential(args)
                response=core.api('POST',core.BASE+'/v1beta/models/'+MODEL+':generateContent',key,request_for(audio))
                transcript=response_transcript(response)
                if core.digest(clip.read_bytes())!=sha:raise core.SafeError('MP3 changed during independent transcription.')
                record={'id':ident,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,
                        'source_text_sha256':source_hash,'input_mime_type':'audio/mpeg','model':MODEL,'prompt':PROMPT,
                        'transcript':transcript,'response':response,'listening_verdict':None}
                core.save(target,record)
                time.sleep(1)
            records.append(record)
            # Preserve progress even if a later explicitly selected request fails.
            core.save(folder/'comparison.private.json',{'records':records,
                'note':'No authored dialogue was supplied to Gemini; current MP3 input hashes bind every raw response. Independent ASR is not human listening.'})
            print(json.dumps({'id':ident,'status':'transcribed','clip_sha256':sha}),flush=True)
        key=None
        return 0
    except (core.SafeError,OSError,ValueError,KeyError,TypeError):
        print('Independent story transcription failed; private results retained, no automatic retry.')
        return 1


if __name__=='__main__':raise SystemExit(main())
