#!/usr/bin/env python3
"""Offline, hash-bound publication of approved story recordings and audited routing."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import story_voice_common as common
import prolog_voice_word_cues as acoustic
from story_voice_qa import VERSION as QA_VERSION, MODEL as QA_MODEL
from story_voice_word_cues import ENGINE as ALIGNMENT_ENGINE

MODEL = 'gemini-3.8-flash-tts'
ID = re.compile(r'story-[a-f0-9]{24}\Z')
class Invalid(ValueError): pass

def require(condition, message):
    if not condition: raise Invalid(message)
def sha(data): return hashlib.sha256(data).hexdigest()
def read(path): return json.loads(Path(path).read_text())
def digest(path): return sha(Path(path).read_bytes())
def canonical(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
def contained(root, name):
    require(isinstance(name, str) and not Path(name).is_absolute() and '..' not in Path(name).parts, 'Unsafe relative path')
    path = (root / name).resolve()
    require(path.is_relative_to(root.resolve()) and path.is_file(), 'Missing or escaping file')
    return path

def source_root(inventory):
    for parent in inventory.resolve().parents:
        if (parent / 'game/src').is_dir(): return parent
    raise Invalid('Current inventory must belong to a source workspace')

def validate_sources(manifest, root):
    require(manifest.get('source_hashes') and not manifest.get('unresolved'), 'Missing source bindings or unresolved inventory')
    for name, expected in manifest['source_hashes'].items():
        require(digest(contained(root, name)) == expected, 'Current source hash differs: ' + name)

VARIANT_SOURCE='story-d2dfa57bf2ba5cd1750a6a23'
VARIANT_TARGET='story-59a013e852c0a30868258880'

def validate_variant_target_qc(run,target,receipt,qc_path,adjudications_path):
    require(receipt.get('vocal_qc_required') is True,'Derived target must require actual vocal QC')
    require(qc_path is not None and adjudications_path is not None,'Derived target requires current QC and root adjudications')
    for path in [qc_path,adjudications_path]:
        require(Path(path).resolve().is_relative_to(run.resolve()) and Path(path).is_file(),'Target QC/adjudication must be an existing private run snapshot')
    import story_voice_qa as qa
    import story_voice_vocal_qc as qc
    raw_records=read(qc_path).get('records',[])
    require(isinstance(raw_records,list) and all(isinstance(record,dict) for record in raw_records),'Invalid actual target QC snapshot')
    records={record.get('id'):record for record in raw_records}
    require(len(records)==len(raw_records),'Duplicate target QC records')
    record=records.get(VARIANT_TARGET);audio_sha=digest(contained(run,f'clips/{VARIANT_TARGET}.mp3'))
    require(qc.cached_record(record,audio_sha,qa.text_hash(target['text'])) and record.get('id')==VARIANT_TARGET,'Target actual QC is missing or stale')
    observation=qc.response_observation(record['response']);events=observation['events']
    require(len(events)==1 and events[0]['category']=='scream' and events[0]['confidence']>=.8,'Target actual QC must observe one confident scream')
    require(all(re.fullmatch(r'a{2,}h',word) for word in qa.words(observation['transcript'])),'Derived target QC contains lexical or laughter tokens')
    accepted=qa.vocal_review(target,audio_sha,'',records,read(adjudications_path))
    require(accepted and not accepted['remaining_source_tokens'] and not accepted['remaining_observed_tokens'],'Target actual scream lacks hash-bound root approval')

def validate_vocal_variant(run,frozen,profiles,receipt,plan_path,target_qc_path=None,target_adjudications_path=None):
    require(plan_path is not None,'Derived event requires explicit --vocal-variant-plan')
    plan=read(plan_path);journal=read(contained(run,'vocal-variants/azar-first-cry.private.json'))
    require(plan.get('source_id')==journal.get('source_id')==VARIANT_SOURCE and plan.get('target_id')==journal.get('target_id')==receipt.get('id')==VARIANT_TARGET,'Only reviewed Azar cry pair may be derived')
    require(journal.get('plan_sha256')==digest(plan_path) and journal.get('state')=='IMPORTED_REQUIRES_FRESH_QA' and journal.get('rate')==1.12,'Derivation journal/plan incomplete')
    archive=Path(journal.get('archive','')).resolve()
    require(archive.is_relative_to(run.resolve()) and archive.is_dir(),'Unsafe/missing original target archive')
    artifacts=plan.get('artifacts',{})
    required={'prepared.json','profiles.private.json','lines.private.json','requests.jsonl'}
    required.update(f'{folder}/{ident}{suffix}' for ident in [VARIANT_SOURCE,VARIANT_TARGET] for folder,suffix in [('raw','.wav'),('raw','.receipt.json'),('clips','.mp3')])
    for key in ['source_qa_file','source_qc_file','source_vocal_adjudications_file','root_approval_file']:
        require(isinstance(plan.get(key),str),'Missing reviewed derivation evidence')
        required.add(plan[key])
    require(required<=set(artifacts),'Incomplete derivation artifact bindings')
    for name,expected in artifacts.items():
        # Only old target artifacts moved into the immutable rejected archive.
        if name in {f'raw/{VARIANT_TARGET}.wav',f'raw/{VARIANT_TARGET}.receipt.json',f'clips/{VARIANT_TARGET}.mp3'}:
            path=contained(archive,Path(name).name)
        else:path=contained(run,name)
        require(digest(path)==expected,'Derivation plan artifact changed')
    rows={line['id']:line for line in frozen['lines']};source=rows[VARIANT_SOURCE];target=rows[VARIANT_TARGET]
    require(all(re.fullmatch(r'[Aa]{2,}[Hh][!?.…]*',row['text']) for row in [source,target]),'Derived event must be a single nonlexical cry')
    require(source['speaker']=='azar' and all(source.get(k)==target.get(k) for k in ['speaker','kind','scene','mood']),'Derived role/scene/mood differs')
    voice=profiles['speakers']['azar']['google_voice']
    require(receipt.get('model')==MODEL and receipt.get('google_voice')==voice and receipt.get('source_id')==VARIANT_SOURCE and 'request_sha256' not in receipt,'Invalid derived model/voice/API provenance')
    require(receipt.get('transform')=={'filter':'atempo=1.12','pitch_preserved':True},'Unapproved derivation transform')
    source_receipt_path=contained(run,f'raw/{VARIANT_SOURCE}.receipt.json');source_receipt=read(source_receipt_path)
    require(source_receipt.get('status')=='complete' and source_receipt.get('model')==MODEL and re.fullmatch(r'[a-f0-9]{64}',source_receipt.get('request_sha256','')),'Missing source TTS provenance')
    for field,name in [('source_receipt_sha256',f'raw/{VARIANT_SOURCE}.receipt.json'),('source_wav_sha256',f'raw/{VARIANT_SOURCE}.wav'),('source_mp3_sha256',f'clips/{VARIANT_SOURCE}.mp3')]:
        require(receipt.get(field)==artifacts[name]==digest(contained(run,name)),'Derived source hash differs')
    require(source_receipt.get('wav_sha256')==receipt['source_wav_sha256'] and source_receipt.get('mp3_sha256')==receipt['source_mp3_sha256'],'Source receipt/audio differs')
    request=common.request_for(source,profiles['speakers'])
    parts=[part for content in request['contents'] for part in content['parts'] if isinstance(part.get('text'),str)]
    overrides=source_receipt.get('delivery_override',{}).get('parts')
    if overrides is not None:
        require(isinstance(overrides,list) and len(overrides)==len(parts),'Bad source delivery override')
        for part,override in zip(parts,overrides):part['text']=override['text'];part.setdefault('speechMetadata',{})['style']=override['style']
    request_sha=sha(json.dumps(request,sort_keys=True).encode())
    require(request_sha==source_receipt['request_sha256']==receipt.get('source_tts_request_sha256'),'Actual source TTS request differs')
    current_mp3=digest(contained(run,f'clips/{VARIANT_TARGET}.mp3'));current_wav=digest(contained(run,f'raw/{VARIANT_TARGET}.wav'))
    require(receipt.get('status')=='complete' and receipt.get('mp3_sha256')==journal.get('new_mp3_sha256')==current_mp3 and receipt.get('wav_sha256')==current_wav and receipt.get('target_original_text_sha256')==sha(target['text'].encode()),'Current derived files/text differ')
    approval=read(contained(run,plan['root_approval_file']))
    require(approval.get('approved') is True and approval.get('source_id')==VARIANT_SOURCE and approval.get('target_id')==VARIANT_TARGET and approval.get('source_mp3_sha256')==receipt['source_mp3_sha256'] and approval.get('target_mp3_sha256')==artifacts[f'clips/{VARIANT_TARGET}.mp3'],'Missing original hash-bound derivation approval')
    import story_voice_vocal_cues as vocal
    proof=vocal.proof(run,source,{'qa_report':contained(run,plan['source_qa_file']),'vocal_report':contained(run,plan['source_qc_file']),'vocal_adjudications':contained(run,plan['source_vocal_adjudications_file'])})
    require(proof==receipt.get('source_vocal_proof'),'Current source vocal proof differs')
    validate_variant_target_qc(run,target,receipt,target_qc_path,target_adjudications_path)
    # Recompute PCM in memory, without creating/changing audio or invoking models.
    source_pcm=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(contained(run,f'raw/{VARIANT_SOURCE}.wav')),'-af','atempo=1.12','-ar','24000','-ac','1','-f','s16le','pipe:1'],capture_output=True,timeout=60)
    target_pcm=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(contained(run,f'raw/{VARIANT_TARGET}.wav')),'-ar','24000','-ac','1','-f','s16le','pipe:1'],capture_output=True,timeout=60)
    require(source_pcm.returncode==target_pcm.returncode==0 and source_pcm.stdout and source_pcm.stdout==target_pcm.stdout,'Derived waveform does not equal approved pitch-preserved transform')

def validate_pff_derived(run,line,receipt):
    import story_voice_pff_edit as pff
    try:return pff.validate_imported(run,line,receipt)
    except (common.core.SafeError,OSError,ValueError,KeyError,TypeError,subprocess.SubprocessError) as error:raise Invalid('Invalid scoped Pff postproduction provenance') from error

NONARCHIVED_REVIEWS = {f'docs/voice-production/directions/kapitel-{i}.json' for i in range(1,6)} | {'docs/voice-production/directions/supplemental.json'}

def validate_run(run, qa_path, alignment_path, expected_count, review_source_root=None, vocal_variant_plan=None, vocal_variant_target_qc=None, vocal_variant_target_adjudications=None):
    info = read(run / 'prepared.json')
    for file, key in [('requests.jsonl','input_sha256'), ('profiles.private.json','profiles_sha256'), ('lines.private.json','manifest_sha256'), ('full-inventory.private.json','full_inventory_sha256'), ('source-snapshot.private.json','source_snapshot_sha256')]:
        require(digest(contained(run, file)) == info.get(key), 'Prepared input changed: ' + file)
    frozen = read(run / 'lines.private.json'); profiles = read(run / 'profiles.private.json')
    require(info.get('bank') == 'story' and info.get('model') == frozen.get('model') == profiles.get('model') == MODEL, 'Wrong production bank/model')
    lines = frozen.get('lines', [])
    require(len(lines) == expected_count and info.get('request_count') == expected_count and not frozen.get('unresolved'), 'Incomplete frozen inventory')
    ids = [line.get('id') for line in lines]
    require(len(set(ids)) == len(ids) and all(isinstance(i,str) and ID.fullmatch(i) for i in ids), 'Invalid/duplicate recording ID')
    payload = (run / 'requests.jsonl').read_bytes()
    records = [json.loads(row) for row in payload.splitlines() if row.strip()]
    require(info.get('input_bytes') == len(payload) and records == [{'key':line['id'], 'request':common.request_for(line, profiles['speakers'])} for line in lines], 'Frozen requests/cast differ')
    derived=[]
    for line in lines:
        receipt_path=run/'raw'/(line['id']+'.receipt.json')
        if receipt_path.is_file():
            receipt=read(contained(run,'raw/'+line['id']+'.receipt.json'))
            if str(receipt.get('backend','')).startswith('derived'):
                require((receipt.get('backend')=='derived_single_nonlexical_event' and line['id']==VARIANT_TARGET) or (receipt.get('backend')=='derived_scoped_pff_parts' and line['id']=='story-95c49f2ee284e215ca7615fc'),'Unsupported derived recording')
                derived.append(receipt)
    require(len(derived)<=2,'More than the two fixed derived cases forbidden')
    for receipt in derived:
        if receipt.get('backend')=='derived_scoped_pff_parts':
            validate_pff_derived(run,next(row for row in lines if row['id']==receipt['id']),receipt)
        else:validate_vocal_variant(run,frozen,profiles,receipt,vocal_variant_plan,vocal_variant_target_qc,vocal_variant_target_adjudications)
    snapshot = read(run / 'source-snapshot.private.json')
    bound_sources=set(frozen.get('source_hashes', {})); archived=set(snapshot)
    missing=bound_sources-archived
    require(not(archived-bound_sources) and missing <= NONARCHIVED_REVIEWS, 'Incomplete or unknown archived sources')
    if missing:
        require(review_source_root is not None, 'Current source root required for nonarchived reviews')
        for name in missing:
            require(digest(contained(review_source_root,name)) == frozen['source_hashes'][name], 'Nonarchived frozen review changed: '+name)
    for name, entry in snapshot.items():
        require(entry.get('sha256') == frozen['source_hashes'][name] == sha(entry['text'].encode()), 'Archived source changed')
    collection = read(run / 'collection.private.json')
    require(not collection.get('failures') and collection.get('collected') == collection.get('expected') == expected_count, 'Collection incomplete')
    qa = read(qa_path); alignment = read(alignment_path); bound = digest(run / 'lines.private.json')
    require(qa.get('status') == alignment.get('status') == 'passed' and not qa.get('failures') and not alignment.get('failures') and not alignment.get('requires_qualification'), 'QA/alignment not final passing')
    require(qa.get('manifest_sha256') == alignment.get('source_manifest_sha256') == bound, 'Stale report manifest')
    checked=qa.get('checked_ids', [])
    require(len(checked)==len(set(checked))==len(ids) and set(checked)==set(ids), 'Incomplete or duplicate QA coverage')
    for field, expected in [('version',QA_VERSION),('model',QA_MODEL)]:
        if field in qa: require(qa[field]==expected or (field=='model' and isinstance(qa[field],str) and qa[field].startswith(expected+':')), 'Wrong QA producer/model')
    for field, expected in [('method',ALIGNMENT_ENGINE),('model',acoustic.MODEL)]:
        if field in alignment: require(alignment[field]==expected, 'Wrong alignment producer/model')
    require(all(set(mapping)==set(ids) for mapping in [qa.get('clip_sha256',{}),alignment.get('clip_sha256',{}),alignment.get('alignment_by_id',{}),alignment.get('authored_text_sha256',{})]), 'Incomplete or extra report hashes/entries')
    raw_takes=qa.get('takes', [])
    takes = {take['id']:take for take in raw_takes}
    require(len(raw_takes)==len(takes)==len(ids) and set(takes)==set(ids), 'Missing or duplicate QA signal receipts')
    paths = {}; clips = []
    for line in lines:
        ident = line['id']; path = contained(run, 'clips/' + ident + '.mp3'); audio_sha = digest(path)
        require(qa.get('clip_sha256', {}).get(ident) == alignment.get('clip_sha256', {}).get(ident) == audio_sha, 'Stale current MP3 qualification')
        text_sha = sha(line['text'].encode()); take = takes[ident]; entry = alignment['alignment_by_id'][ident]
        require(take.get('text_sha256') == entry.get('text_sha256') == alignment.get('authored_text_sha256', {}).get(ident) == text_sha and not take.get('reasons'), 'Stale text qualification')
        seconds = take.get('signal', {}).get('seconds')
        require(isinstance(seconds,(int,float)) and not isinstance(seconds,bool) and math.isfinite(seconds) and seconds > 0, 'Invalid decoded duration')
        words = entry.get('words', []); tokens = acoustic.normalized_text(line['text']).split()
        require([word.get('word') for word in words] == tokens, 'Alignment differs from full authored words')
        cues = []; previous = 0
        for word in words:
            start, end = word.get('start'), word.get('end')
            require(all(isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) for v in (start,end)) and previous <= start < end <= seconds + .001, 'Invalid aligned timing')
            cues.append({'start':start,'end':end}); previous = end
        require(entry.get('word_count') == len(tokens) and tokens and entry.get('cues_sha256') == acoustic.cue_sha(cues), 'Incomplete or changed word cues')
        voice = profiles['speakers'][line['speaker']]['google_voice']
        clips.append({'id':ident,'kind':line['kind'],'speaker':line['speaker'],'text':line['text'],'display_text':line['display_text'],'audio':'audio/story/' + ident + '.mp3','sha256':audio_sha,'seconds':seconds,'voice':voice,'word_cues':cues,'runtime_keys':line.get('runtime_keys', common.frozen_runtime_keys(frozen,line))})
        paths[ident] = path
    return frozen, clips, paths

def validate_routing(frozen, current, audit, frozen_sha, expected_changes=85):
    require(audit.get('frozen_inventory_sha256') == frozen_sha and audit.get('id_set_same') is True and audit.get('fixed_unresolved') == 0, 'Audit not bound to frozen inventory')
    require(audit.get('frozen_lines') == audit.get('fixed_lines') == len(frozen['lines']) and audit.get('frozen_runtime_keys') == len(frozen['runtime_lookup']) and audit.get('fixed_runtime_keys') == len(current['runtime_lookup']), 'Audit census differs')
    old = {line['id']:line for line in frozen['lines']}; new = {line['id']:line for line in current['lines']}
    require(set(old) == set(new), 'Current inventory recording IDs changed')
    changes = {row['id']:row for row in audit.get('changed', [])}
    require(len(changes) == len(audit.get('changed', [])) == audit.get('changed_lines'), 'Duplicate/incomplete routing audit')
    if expected_changes == 85: require(len(changes) == 83, 'Production routing audit must cover exactly 83 recorded assets')
    count = 0
    for ident, line in old.items():
        incoming = new[ident]
        for field in ['kind','speaker','text','display_text','direction_en','performance_variant']:
            require(line.get(field) == incoming.get(field), 'Reviewed recording identity changed: '+ident+'/'+field)
        before, after = line['runtime_keys'], incoming['runtime_keys']
        if before == after:
            require(ident not in changes, 'Audited correction was not applied')
            continue
        row = changes.get(ident)
        require(row and row.get('direction_same') is True and row.get('kind') == 'say' and row.get('speaker') == 'lia' and row.get('text') == line['text'] and row.get('direction_en') == line['direction_en'], 'Unaudited runtime correction')
        require(row.get('runtime_keys_before') == before and row.get('runtime_keys_after') == after, 'Runtime correction differs from exact audit')
        require(len(before) == len(after), 'Runtime route removed/added')
        for a, b in zip(before, after):
            require({k:v for k,v in a.items() if k != 'mood'} == {k:v for k,v in b.items() if k != 'mood'}, 'Scene/kind/speaker/text/performance changed')
            if a.get('mood') != b.get('mood'):
                require(a.get('mood') == row.get('old_mood') == 'neutral' and b.get('mood') == row.get('new_mood'), 'Invalid source mood correction')
                count += 1
    require(count == audit.get('changed_runtime_keys') == expected_changes, 'Missing audited mood corrections')
    for field in ['aliases','scene_players']:
        require(frozen.get(field) == current.get(field), 'Unaudited speaker/player routing change')
    expected_lookup = [{**key,'asset_id':line['id']} for line in current['lines'] for key in line['runtime_keys']]
    require(sorted(map(canonical,expected_lookup)) == sorted(map(canonical,current.get('runtime_lookup',[]))), 'Current lookup differs from clip keys')

def validate_supplement_source(frozen, current, root):
    validate_sources(current,root)
    old={line['id']:line for line in frozen['lines']}; new={line['id']:line for line in current['lines']}
    require(set(old)==set(new), 'Current supplement IDs changed')
    ranges=set()
    for ident,line in old.items():
        row=new[ident]
        require(row.get('speaker')=='lia' and row.get('kind')=='bark', 'Supplement must be Lia battle barks')
        for field in ['kind','speaker','text','display_text','direction_en','performance_variant']:
            require(row.get(field)==line.get(field), 'Current supplement recording identity changed')
        before=common.frozen_runtime_keys(frozen,line); after=common.frozen_runtime_keys(current,row)
        require(before==after and after and all(key.get('kind')=='bark' and key.get('speaker')=='lia' and key.get('scene')=='rettung' and key.get('mood')=='neutral' for key in after), 'Supplement routes must remain exact Lia/neutral/rettung')
        require(row.get('sources'), 'Supplement lacks literal source range')
        for source in row['sources']:
            name=source['file']; source_path=contained(root,name)
            require(name in current['source_hashes'], 'Supplement source missing full hash')
            start,end=source.get('start'),source.get('end')
            require(isinstance(start,int) and isinstance(end,int) and 0<=start<end, 'Invalid literal AST range')
            binding=(name,start,end)
            require(binding not in ranges, 'Ambiguous supplement literal range');ranges.add(binding)
            # Node offsets are UTF-16, so use the same TypeScript parser instead of Python substring indices.
            script="""const fs=require('fs'),crypto=require('crypto');const ts=require(process.argv[1]);const p=JSON.parse(process.argv[2]);const text=fs.readFileSync(p.file,'utf8');const sf=ts.createSourceFile(p.file,text,ts.ScriptTarget.Latest,true);let found=[];function visit(n){if(ts.isStringLiteral(n)&&n.getStart(sf)===p.start&&n.getEnd()===p.end)found.push(n);ts.forEachChild(n,visit)}visit(sf);if(found.length!==1||found[0].text!==p.text||crypto.createHash('sha256').update(found[0].getText(sf)).digest('hex')!==p.hash)process.exit(2);"""
            result=subprocess.run(['node','-e',script,str(root/'game/node_modules/typescript'),json.dumps({'file':str(source_path),'start':start,'end':end,'text':line['text'],'hash':source.get('expression_sha256')})],capture_output=True)
            require(result.returncode==0, 'Supplement actual literal AST/text/hash differs')

def build(args, expected_count=1557, expected_changes=85, supplement_count=3):
    run = args.run_dir.resolve(); inventory_path = args.current_inventory.resolve()
    root=source_root(inventory_path)
    frozen, clips, paths = validate_run(run,args.qa_report,args.alignment_report,expected_count,root,getattr(args,'vocal_variant_plan',None),getattr(args,'vocal_variant_target_qc',None),getattr(args,'vocal_variant_target_adjudications',None))
    current = read(inventory_path); validate_sources(current,root)
    require(args.public_dir.resolve() == (root/'game/public/audio/story').resolve(), 'Public destination must belong to the reviewed current source workspace')
    require(args.root_reviewed_routing, 'Explicit --root-reviewed-routing required')
    audit = read(args.routing_audit)
    validate_routing(frozen,current,audit,digest(run/'lines.private.json'),expected_changes)
    rows = {line['id']:line for line in current['lines']}
    for clip in clips: clip['runtime_keys'] = rows[clip['id']]['runtime_keys']
    result = {key:current[key] for key in ['aliases','scene_players','runtime_lookup'] if key in current}
    result.update(model=MODEL,clips=clips)
    if args.supplement_run_dir:
        require(args.supplement_qa_report and args.supplement_alignment_report, 'Supplement needs independent final reports')
        mini, extra, extra_paths = validate_run(args.supplement_run_dir.resolve(),args.supplement_qa_report,args.supplement_alignment_report,supplement_count,root)
        require(args.current_supplement_inventory, 'Explicit current supplement inventory required')
        current_mini=read(args.current_supplement_inventory)
        require(source_root(args.current_supplement_inventory)==root, 'Supplement belongs to another source workspace')
        validate_supplement_source(mini,current_mini,root)
        require(not(set(paths) & set(extra_paths)), 'Supplement recording ID collision')
        for clip in extra:
            require(clip['speaker']=='lia' and clip['voice']=='Zephyr' and clip['kind']=='bark' and all(key.get('scene')=='rettung' and key.get('speaker')=='lia' for key in clip['runtime_keys']), 'Supplement scope/cast differs')
        clips.extend(extra); paths.update(extra_paths)
        result['runtime_lookup'].extend({**key,'asset_id':clip['id']} for clip in extra for key in clip['runtime_keys'])
    require(len(clips)==expected_count+(supplement_count if args.supplement_run_dir else 0),'Incorrect final coverage')
    selectors = {}
    for route in result['runtime_lookup']:
        selector = (route['kind'], result.get('aliases',{}).get(route['speaker'],route['speaker']), acoustic.normalized_text(route['text']), route.get('scene','*'), route.get('mood','neutral'))
        require(selector not in selectors or selectors[selector] == route['asset_id'], 'Conflicting final runtime recordings')
        selectors[selector] = route['asset_id']
    validate_destination(args.public_dir,paths)
    return result,paths

def validate_destination(target,paths):
    target=target.resolve()
    require(target.name=='story' and target.parent.name=='audio', 'Explicit story-bank destination required')
    if target.exists():
        expected={'manifest.json',*(ident+'.mp3' for ident in paths)}
        require(all(p.is_file() and not p.is_symlink() and p.name in expected for p in target.iterdir()), 'Refusing unrelated existing destination content')

def publish(target,manifest,paths):
    target=target.resolve()
    require(target.name=='story' and target.parent.name=='audio', 'Explicit story-bank destination required')
    validate_destination(target,paths)
    target.parent.mkdir(parents=True,exist_ok=True)
    staging=Path(tempfile.mkdtemp(prefix='.story-staging-',dir=target.parent)); staging.chmod(0o755); backup=None
    try:
        for ident,path in paths.items():
            dest=staging/(ident+'.mp3'); shutil.copyfile(path,dest); dest.chmod(0o644)
            require(digest(dest)==next(clip['sha256'] for clip in manifest['clips'] if clip['id']==ident),'Audio changed while copying')
        (staging/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        (staging/'manifest.json').chmod(0o644)
        if target.exists():
            backup=Path(tempfile.mkdtemp(prefix='.story-backup-',dir=target.parent)); backup.rmdir(); target.rename(backup)
        try: staging.rename(target)
        except BaseException:
            if backup: backup.rename(target)
            raise
        if backup: shutil.rmtree(backup)
    finally:
        if staging.exists(): shutil.rmtree(staging)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['run-dir','qa-report','alignment-report','current-inventory','routing-audit','public-dir']:
        parser.add_argument('--'+name,type=Path,required=True)
    for name in ['supplement-run-dir','supplement-qa-report','supplement-alignment-report','current-supplement-inventory']:
        parser.add_argument('--'+name,type=Path)
    parser.add_argument('--vocal-variant-plan',type=Path)
    parser.add_argument('--vocal-variant-target-qc',type=Path)
    parser.add_argument('--vocal-variant-target-adjudications',type=Path)
    parser.add_argument('--root-reviewed-routing',action='store_true')
    mode=parser.add_mutually_exclusive_group(required=True);mode.add_argument('--dry-run',action='store_true');mode.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    try:
        manifest,paths=build(args)
        if args.apply: publish(args.public_dir,manifest,paths)
        print(json.dumps({'status':'published' if args.apply else 'validated','clips':len(paths),'bytes':sum(path.stat().st_size for path in paths.values()),'routing_audit_sha256':digest(args.routing_audit)},indent=2))
        return 0
    except (Invalid,OSError,KeyError,ValueError) as error:
        parser.exit(1,str(error)+'\n')
if __name__=='__main__': raise SystemExit(main())
