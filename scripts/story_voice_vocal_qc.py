#!/usr/bin/env python3
"""Explicitly scoped independent MP3 gesture QC using the safe ASR Batch transport.

No authored transcript, expected effect, speaker identity, or performance cue is
sent to the model. Observations require root review and never approve audio.
"""
from __future__ import annotations
import base64
import copy
from contextlib import contextmanager
import json
import math
from pathlib import Path
import sys
from types import SimpleNamespace
import story_voice_asr_batch as transport
from story_voice_common import core

MODEL = 'gemini-3.8-flash'
PROMPT = ('Observe only the supplied audio. Transcribe all actual spoken German words verbatim, '
          'preserving repetitions, contractions and errors. Do not correct, complete, translate, '
          'infer unheard words, or invent an intended sound. Separately describe any observed voiced '
          'nonlexical events in their occurrence order. If an event cannot be identified, say so and '
          'use low confidence. Describe the audible vowel or consonant impression only when discernible. '
          'Do not give timestamps. Return only JSON matching the supplied schema.')
CATEGORIES = ['laughter','scream','groan','hiccup','muffled_vocalization','other']
SCHEMA = {'type':'OBJECT','properties':{
    'transcript':{'type':'STRING'},
    'events':{'type':'ARRAY','items':{'type':'OBJECT','properties':{
        'category':{'type':'STRING','enum':CATEGORIES},
        'description':{'type':'STRING'},
        'vocal_sound':{'type':'STRING'},
        'confidence':{'type':'NUMBER'}},
        'required':['category','description','vocal_sound','confidence']}}},
    'required':['transcript','events']}
NOTE = ('Independent acoustic model observations, no expected script/effect supplied. '
        'Occurrence order only; no precise word cues, human-hearing claim or approval.')


def text_hash(value):
    return core.digest(value.encode('utf-8'))


def request_for(audio):
    if not isinstance(audio,bytes) or not audio:
        raise core.SafeError('Vocal QC needs nonempty current MP3 bytes.')
    # The source text is deliberately absent from this interface.
    return {'contents':[{'role':'user','parts':[{'text':PROMPT},
        {'inlineData':{'mimeType':'audio/mpeg','data':base64.b64encode(audio).decode('ascii')}}]}],
        'generationConfig':{'temperature':0,'responseMimeType':'application/json','responseSchema':copy.deepcopy(SCHEMA)}}


def response_observation(response):
    if not isinstance(response,dict) or response.get('modelVersion')!=MODEL:
        raise core.SafeError('Unexpected vocal QC model version.')
    candidates=response.get('candidates')
    if not isinstance(candidates,list) or len(candidates)!=1 or not isinstance(candidates[0],dict) or candidates[0].get('finishReason')!='STOP':
        raise core.SafeError('Vocal QC response is incomplete.')
    content=candidates[0].get('content')
    if not isinstance(content,dict):raise core.SafeError('Vocal QC content is missing.')
    parts=content.get('parts')
    if not isinstance(parts,list) or not parts or any(not isinstance(p,dict) or set(p)-{'text','thoughtSignature'} or not isinstance(p.get('text'),str) or p.get('thought') for p in parts):
        raise core.SafeError('Vocal QC response must contain only final text.')
    value=json.loads(''.join(p['text'] for p in parts))
    if not isinstance(value,dict) or set(value)!={'transcript','events'} or not isinstance(value['transcript'],str) or not isinstance(value['events'],list):
        raise core.SafeError('Invalid vocal QC observation schema.')
    if len(value['transcript'])>50000 or len(value['events'])>100:
        raise core.SafeError('Vocal QC observation exceeds bounded schema.')
    for event in value['events']:
        if not isinstance(event,dict) or set(event)!={'category','description','vocal_sound','confidence'} or event.get('category') not in CATEGORIES:
            raise core.SafeError('Unknown vocal QC event or extra fields/timestamps.')
        if any(not isinstance(event[k],str) or len(event[k])>2000 for k in ['description','vocal_sound']) or not event['description'].strip():
            raise core.SafeError('Invalid vocal QC event description.')
        confidence=event['confidence']
        if not isinstance(confidence,(int,float)) or isinstance(confidence,bool) or not math.isfinite(confidence) or not 0<=confidence<=1:
            raise core.SafeError('Invalid vocal QC confidence.')
    return value


def response_transcript(response):
    return response_observation(response)['transcript']


def cached_record(record,clip_hash,source_hash):
    if not isinstance(record,dict):return False
    if any(record.get(k)!=clip_hash for k in ['clip_sha256','source_audio_sha256','upload_sha256']) or record.get('source_text_sha256')!=source_hash:
        return False
    if any(record.get(k)!=v for k,v in cache_metadata().items()):return False
    if record.get('prompt')!=PROMPT or record.get('model')!=MODEL or record.get('input_mime_type')!='audio/mpeg':return False
    try:return response_transcript(record['response'])==record.get('transcript')
    except (core.SafeError,ValueError,TypeError,KeyError,AttributeError):return False


def cache_metadata():
    return {'schema_sha256':text_hash(json.dumps(SCHEMA,sort_keys=True,separators=(',',':'))),
            'prompt_sha256':text_hash(PROMPT),'qc_contract_version':1}


@contextmanager
def backend():
    # Single CLI process: all shared module globals are restored on every exit.
    overrides={'asr':SimpleNamespace(MODEL=MODEL,PROMPT=PROMPT,text_hash=text_hash,request_for=request_for,
        response_transcript=response_transcript,cached_record=cached_record,CACHE_METADATA=cache_metadata()),
        'MODEL':MODEL,'FOLDER_NAME':'independent-vocal-qc','BANK_NAME':'independent-story-vocal-qc',
        'DISPLAY_PREFIX':'selantis-story-vocal-qc-','NOTE':NOTE}
    missing=[k for k in overrides if not hasattr(transport,k)]
    if missing:raise core.SafeError('Safe Batch transport lacks vocal QC namespace hooks.')
    prior={k:getattr(transport,k) for k in overrides}
    try:
        for k,v in overrides.items():setattr(transport,k,v)
        yield
    finally:
        for k,v in prior.items():setattr(transport,k,v)


def main():
    with backend():
        status=transport.main()
        # Derive a small review view solely from hash-validated immutable cache.
        if status==0 and len(sys.argv)>1 and sys.argv[1] in {'collect','merge'}:
            index=sys.argv.index('--run-dir') if '--run-dir' in sys.argv else None
            if index is not None:
                source=Path(sys.argv[index+1]).expanduser().resolve()
                comparison=core.read_json(source/'independent-vocal-qc/comparison.private.json')
                observations=[]
                for record in comparison['records']:
                    observation=response_observation(record['response'])
                    observations.append({k:record[k] for k in ['id','clip_sha256','source_text_sha256','model','prompt']} |
                        observation | {'status':'root_review_required','approval':None})
                core.save(source/'independent-vocal-qc/report.private.json',{'status':'root_review_required',
                    'records':observations,'note':NOTE})
        return status

if __name__=='__main__':
    try:raise SystemExit(main())
    except (core.SafeError,OSError,ValueError,TypeError,KeyError):
        print('Vocal QC failed; private results retained. No automatic retry.',file=sys.stderr)
        raise SystemExit(1)
