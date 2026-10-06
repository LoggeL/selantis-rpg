#!/usr/bin/env python3
"""Bounded, reviewed offline derivation of one same-voice nonlexical cry."""
import argparse
import copy
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
import story_voice_common as common
from story_voice_common import core
import prolog_voice_generate as standard
import story_voice_retake_batch as retakes
import story_voice_vocal_cues as vocal

SOURCE='story-d2dfa57bf2ba5cd1750a6a23'
TARGET='story-59a013e852c0a30868258880'
MODEL='gemini-3.8-flash-tts'
RATE=1.12

def artifact(parent,name):
    if not isinstance(name,str):raise core.SafeError('Evidence artifact path must be relative.')
    path=(parent/name).resolve()
    if parent not in path.parents or not path.is_file():raise core.SafeError('Missing or unsafe private evidence artifact.')
    return path

def validate(parent,plan_path):
    common.prepared(parent)
    plan=core.read_json(plan_path)
    if plan.get('source_id')!=SOURCE or plan.get('target_id')!=TARGET:raise core.SafeError('Variant is limited to the reviewed Azar cry pair.')
    hashes=plan.get('artifacts',{})
    required={*retakes.SOURCE_FILES,*[f'{folder}/{ident}{suffix}' for ident in [SOURCE,TARGET] for folder,suffix in [('raw','.wav'),('raw','.receipt.json'),('clips','.mp3')]]}
    for key in ['source_qa_file','source_qc_file','source_vocal_adjudications_file','root_approval_file']:
        name=plan.get(key)
        if not isinstance(name,str):raise core.SafeError('Reviewed QA/QC/root approval evidence is required.')
        required.add(name)
    if not isinstance(hashes,dict) or not required.issubset(hashes):raise core.SafeError('Plan must bind all frozen files, audio, receipts and approval evidence.')
    for name,sha in hashes.items():
        if core.digest(artifact(parent,name).read_bytes())!=sha:raise core.SafeError('Reviewed plan artifact changed; no derivation or archival allowed.')
    manifest=core.read_json(parent/'lines.private.json');rows={r['id']:r for r in manifest['lines']}
    source,target=rows[SOURCE],rows[TARGET]
    for row in [source,target]:
        if not re.fullmatch(r'[Aa]{2,}[Hh][!?.…]*',row['text']):raise core.SafeError('Variant requires one nonlexical AAH cry token, never lexical content.')
    if any(source.get(k)!=target.get(k) for k in ['speaker','kind','scene','mood']) or source['speaker']!='azar':raise core.SafeError('Variant role/kind/scene/mood must match exactly.')
    profiles=core.read_json(parent/'profiles.private.json');voice=profiles['speakers'][source['speaker']]['google_voice']
    if manifest.get('model')!=MODEL:raise core.SafeError('Unexpected frozen TTS model.')
    records={r['key']:r for r in [json.loads(s) for s in (parent/'requests.jsonl').read_text().splitlines() if s.strip()]}
    for ident in [SOURCE,TARGET]:
        if records[ident]['request']['generationConfig']['speechConfig']['voiceConfig']['voice']!=voice:raise core.SafeError('Frozen voice preset differs.')
        r=core.read_json(parent/'raw'/(ident+'.receipt.json'))
        if r.get('status')!='complete' or standard.valid_audio(parent/'raw'/(ident+'.wav')) is None or r.get('wav_sha256')!=hashes['raw/'+ident+'.wav'] or r.get('mp3_sha256')!=hashes['clips/'+ident+'.mp3']:raise core.SafeError('Current qualified audio receipt/hash is invalid.')
    receipt=core.read_json(parent/'raw'/(SOURCE+'.receipt.json'))
    if receipt.get('model')!=MODEL or not re.fullmatch(r'[0-9a-f]{64}',receipt.get('request_sha256','')):raise core.SafeError('Source actual TTS request/model provenance is missing.')
    proof=vocal.proof(parent,source,{'qa_report':artifact(parent,plan['source_qa_file']),'vocal_report':artifact(parent,plan['source_qc_file']),'vocal_adjudications':artifact(parent,plan['source_vocal_adjudications_file'])})
    records_qc=core.read_json(artifact(parent,plan['source_qc_file']))['records']
    source_qc=next(r for r in records_qc if r['id']==SOURCE)
    observed=vocal.qa.vocal_qc.response_observation(source_qc['response'])
    if any(not re.fullmatch(r'a{2,}h',word) for word in vocal.qa.words(observed['transcript'])):raise core.SafeError('QC contains lexical words, not a sole nonlexical cry.')
    actual=copy.deepcopy(records[SOURCE]['request'])
    parts=[p for c in actual.get('contents',[]) for p in c.get('parts',[]) if isinstance(p.get('text'),str)]
    overrides=receipt.get('delivery_override',{}).get('parts')
    if overrides is not None:
        if not isinstance(overrides,list) or len(overrides)!=len(parts):raise core.SafeError('Source actual delivery provenance is invalid.')
        for part,override in zip(parts,overrides):
            part['text']=override['text'];part.setdefault('speechMetadata',{})['style']=override['style']
    if core.digest(json.dumps(actual,sort_keys=True).encode())!=receipt['request_sha256']:raise core.SafeError('Source receipt actual request hash differs from frozen request and recorded delivery.')
    approval=core.read_json(artifact(parent,plan['root_approval_file']))
    source_sha=hashes['clips/'+SOURCE+'.mp3'];target_sha=hashes['clips/'+TARGET+'.mp3']
    if approval.get('approved') is not True or approval.get('source_id')!=SOURCE or approval.get('target_id')!=TARGET or approval.get('source_mp3_sha256')!=source_sha or approval.get('target_mp3_sha256')!=target_sha:raise core.SafeError('Explicit hash-bound root approval is required.')
    return plan,source,target,receipt,voice,proof

def apply(parent,plan_path):
    with common.run_lock(parent):
        plan,source,target,receipt,voice,proof=validate(parent,plan_path)
        journal_path=parent/'vocal-variants'/'azar-first-cry.private.json'
        if journal_path.exists():raise core.SafeError('Variant journal already exists; never automatically overwrite or repeat a partial import.')
        with tempfile.TemporaryDirectory(prefix='vocal-variant-') as temp:
            wav=Path(temp)/'variant.wav';mp3=Path(temp)/'variant.mp3'
            core.command(['ffmpeg','-v','error','-y','-i',str(parent/'raw'/(SOURCE+'.wav')),'-af','atempo=1.12','-ar','24000','-ac','1','-c:a','pcm_s16le',str(wav)])
            seconds=standard.valid_audio(wav)
            if seconds is None:raise core.SafeError('Derived event failed WAV validation.')
            measurements=core.normalize(wav,mp3)
            validate(parent,plan_path) # Nothing has mutated; evidence still exact.
            archive=parent/'rejected'/('derived-azar-cry-'+str(time.time_ns()))
            journal={'state':'IMPORT_INTENT_RECORDED','plan_sha256':core.digest(Path(plan_path).read_bytes()),'archive':str(archive),'source_id':SOURCE,'target_id':TARGET,'rate':RATE,'new_mp3_sha256':core.digest(mp3.read_bytes())}
            core.save(journal_path,journal);archive.mkdir(parents=True)
            for folder,suffix in [('raw','.wav'),('raw','.receipt.json'),('clips','.mp3')]:shutil.copyfile(parent/folder/(TARGET+suffix),archive/(TARGET+suffix))
            journal['state']='ORIGINAL_ARCHIVED';core.save(journal_path,journal)
            derived={'id':TARGET,'status':'complete','backend':'derived_single_nonlexical_event','model':MODEL,'google_voice':voice,'seconds':seconds,'wav_sha256':core.digest(wav.read_bytes()),'mp3_sha256':core.digest(mp3.read_bytes()),'measurements':measurements,'source_vocal_proof':proof,'source_id':SOURCE,'source_tts_request_sha256':receipt['request_sha256'],'source_receipt_sha256':plan['artifacts']['raw/'+SOURCE+'.receipt.json'],'source_wav_sha256':plan['artifacts']['raw/'+SOURCE+'.wav'],'source_mp3_sha256':plan['artifacts']['clips/'+SOURCE+'.mp3'],'target_original_text_sha256':core.digest(target['text'].encode()),'transform':{'filter':'atempo=1.12','pitch_preserved':True},'qa_required':True,'vocal_qc_required':True,'word_cues_required':True,'listening_verdict':None}
            for src,dst in [(wav,parent/'raw'/(TARGET+'.wav')),(mp3,parent/'clips'/(TARGET+'.mp3'))]:
                tmp=dst.with_name(dst.name+'.variant.tmp');shutil.copyfile(src,tmp);os.chmod(tmp,0o600);tmp.replace(dst)
            core.save(parent/'raw'/(TARGET+'.receipt.json'),derived)
            journal['state']='IMPORTED_REQUIRES_FRESH_QA';core.save(journal_path,journal)
            retakes.rebuild(parent,None)
    return derived

def main():
    os.umask(0o077);common.configure();p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('command',choices=['dry-run','apply']);p.add_argument('--run-dir',required=True);p.add_argument('--plan',required=True);args=p.parse_args()
    try:
        parent=core.directory(args.run_dir)
        if args.command=='dry-run':validate(parent,args.plan);print(json.dumps({'state':'VALIDATED_ONLY','source_id':SOURCE,'target_id':TARGET,'rate':RATE}))
        else:apply(parent,args.plan);print(json.dumps({'state':'DERIVED_REQUIRES_FRESH_QA','target_id':TARGET}))
        return 0
    except (core.SafeError,OSError,ValueError,KeyError,TypeError) as error:
        print(str(error) if isinstance(error,core.SafeError) else 'Invalid private variant plan or evidence; no automatic retry.',file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
