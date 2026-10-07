#!/usr/bin/env python3
"""Publish individually qualified current takes from unchanged complete reports.

Both genuine complete banks retain every failure. This separate intermediate
publication never certifies the full 1557 or 490 bank and never edits reports,
transcripts, private audio, cues, qualifications or the final publisher.
"""
from __future__ import annotations
import argparse
import copy
import json
import math
import os
from pathlib import Path
import shutil
import sys
import tempfile
import story_voice_publish as strict
import story_voice_incremental_publish as compositor
import story_voice_original_bank_publish as original
import story_voice_rewrite_timing_publish as rewrite
import story_voice_word_cues as timing
import story_voice_qa as qa
from story_voice_publish import (read,digest,contained,require,sha,MODEL,ID,common,
    VARIANT_TARGET,NONARCHIVED_REVIEWS,QA_VERSION,QA_MODEL,ALIGNMENT_ENGINE,acoustic,
    validate_vocal_variant)
validate_pff_derived=original.validate_pff_derived

VERSION='actual-take-qualified-partial-current-story-v1'
APPROVED='approved_actual_qualified_partial_story_selection'
PINNED_QA={
    'original':{'qa-pass69b-additive.private.json':'992c55cf83256c68a85421741ca5eec73953dd092d5f4d812c46fceb33ca147d'},
    'rewrite':{
        'qa-after-directed13-word40-primary.private.json':'3da2927e6c516a811c9645741419d831e734ef2e80ab932773fff0e8b5b20144',
        'qa-after-directed13-word40-large3.private.json':'cff8903d6d68d697f023741a2b2572c5e59d9605e49f13232e14db381f45ba19'},
}
PINNED_ALIGNMENT={
    'original':{'word-cues/alignment.private.json':'23e2e31af3579cf063b0066b101a25971da7bf9bec7d3564c72dd3170cf47067'},
    'rewrite':{'word-cues/alignment.private.json':'6e6ad20f5878b36e741d249e72283f76f3fc41748063c0a01ae6cafee63769b5'},
}
PUBLIC_FIELDS=('id','kind','speaker','text','display_text','audio','sha256','seconds','voice','word_cues','runtime_keys')
SELECTION_FIELDS={'status','reviewed_by','reason','current_inventory_sha256','profiles_sha256',
                  'source_closure_sha256','input_reports_sha256','selected_ids','existing_manifest_sha256'}


def exact_ids(values,label):
    return compositor.ids(values,label)


def _qa_consistency(report,lines,audio_hashes):
    ids={line['id'] for line in lines};rows={line['id']:line for line in lines}
    require(exact_ids(report.get('checked_ids'), 'whole QA checked IDs')==ids
            and set(report.get('clip_sha256',{}))==ids and report['clip_sha256']==audio_hashes,
            'Whole genuine QA omits or changes Source/audio coverage')
    require(report.get('version')==QA_VERSION and isinstance(report.get('model'),str)
            and (report['model']==QA_MODEL or report['model'].startswith(QA_MODEL+':')),
            'Whole QA producer/model differs')
    takes=report.get('takes');require(isinstance(takes,list) and len(takes)==len(ids), 'Whole QA take coverage incomplete')
    indexed={take.get('id'):take for take in takes}
    require(len(indexed)==len(takes) and set(indexed)==ids, 'Whole QA duplicate/unknown/missing takes')
    expected=[]
    for ident,take in indexed.items():
        require(take.get('text_sha256')==sha(rows[ident]['text'].encode())
                and isinstance(take.get('reasons'),list)
                and all(isinstance(reason,str) and reason for reason in take['reasons'])
                and len(take['reasons'])==len(set(take['reasons'])), 'Whole QA Source/reasons invalid')
        expected.extend({'id':ident,'reason':reason} for reason in take['reasons'])
    failures=report.get('failures')
    require(isinstance(failures,list) and sorted(map(strict.canonical,failures))==sorted(map(strict.canonical,expected)),
            'Whole QA hidden, extra or omitted failure reasons')
    require(report.get('status')==('review_required' if failures else 'passed'), 'Whole QA status hides actual failures')
    require(type(report.get('finished_at')) is int and report['finished_at']>=report.get('started_at',0),
            'Whole QA producer has not finished')
    return indexed


def _timing_consistency(report,lines,receipts,approvals,audio_hashes):
    ids={line['id'] for line in lines};expected=timing.report_for(receipts,approvals)
    for field in ('method','model','status','clip_sha256','alignment_by_id','requires_qualification','failures','authored_text_sha256'):
        require(report.get(field)==expected[field], 'Whole actual timing report hides/changes actual receipt state: '+field)
    require(report['clip_sha256']==audio_hashes and set(report['authored_text_sha256'])==ids
            and report.get('expected_count')==report.get('current_receipt_count')==len(ids),
            'Whole timing omits complete actual Source/audio/receipt coverage')
    return expected


def _word_clear(line,take,audio_sha):
    if take.get('reasons'):return False
    signal=take.get('signal')
    require(isinstance(signal,dict) and type(signal.get('seconds')) in (int,float)
            and math.isfinite(signal['seconds']) and signal['seconds']>0, 'Selected signal duration unavailable')
    require(not qa.signal_failures(signal,len(qa.words(line['text']))), 'Selected actual signal is not clear')
    transcript=take.get('transcript');adjudication=take.get('adjudication')
    if isinstance(transcript,str) and qa.words(transcript)==qa.words(line['text']):return True
    # The pinned whole producer's real per-ID adjudication is retained unchanged.
    # Bare clean reasons without any source/audio-bound actual proof are invalid.
    proofs=[adjudication] if isinstance(adjudication,dict) else []
    extra=take.get('extra_word_proof',[])
    require(isinstance(extra,list) and all(isinstance(proof,dict) for proof in extra),'Actual extra word-proof records malformed')
    proofs.extend(extra)
    require(proofs,'Selected word mismatch lacks actual per-take adjudication')
    for proof in proofs:
        require(isinstance(proof.get('resolution',proof.get('method')),str), 'Actual word-proof method missing')
        for record in [proof,*[proof.get(key,{}) for key in ('record','evidence','approval','binding')]]:
            if (isinstance(record,dict) and record.get('clip_sha256')==audio_sha
                    and (record.get('source_text_sha256') or record.get('text_sha256'))==sha(line['text'].encode())):
                return True
    raise strict.Invalid('Selected real adjudication Source/audio binding differs')


def _bound_complete_reports(bank,run,qa_path,alignment_path,root):
    run=Path(run).resolve()
    count=1557 if bank=='original' else 490
    require((original.supports_run(run,count) if bank=='original' else rewrite.supports_run(run,count)),
            'Only the two exact complete historical/current banks are allowed')
    require(Path(qa_path).resolve().is_relative_to(run) and Path(alignment_path).resolve().is_relative_to(run),
            'Whole reports must stay inside their fixed private bank')
    relative=str(Path(qa_path).resolve().relative_to(run))
    require(PINNED_QA[bank].get(relative)==digest(qa_path), 'Unrecognized or changed genuine complete QA producer output')
    alignment_relative=str(Path(alignment_path).resolve().relative_to(run))
    require(PINNED_ALIGNMENT[bank].get(alignment_relative)==digest(alignment_path),
            'Unrecognized or changed genuine complete timing producer output')
    frozen=_whole_inputs(run,qa_path,alignment_path,count,original.ORIGINAL_ROOT if bank=='original' else root)
    lines=frozen['lines'];audio_hashes={line['id']:digest(contained(run,'clips/'+line['id']+'.mp3')) for line in lines}
    report=read(qa_path);alignment=read(alignment_path);mh=digest(run/'lines.private.json')
    require(report.get('manifest_sha256')==alignment.get('source_manifest_sha256')==mh,
            'Whole reports bound to different frozen Source')
    takes=_qa_consistency(report,lines,audio_hashes)
    if bank=='rewrite' and relative=='qa-after-directed13-word40-large3.private.json':
        import story_voice_rewrite_large_word_review as large
        stage=report.get('secondary_stage',{})
        require(stage.get('version')==large.VERSION and stage.get('continuation_version')==large.FOLLOWUP_VERSION
                and set(stage.get('selected_ids',[]))==large.SUPPORTED
                and stage.get('input_qa_sha256')==PINNED_QA['rewrite']['qa-after-directed13-word40-primary.private.json']
                and stage.get('original_actual_large_approval_reproduced_from_all_real_inputs') is True
                and stage.get('audio_or_source_or_cache_or_word_cues_written') is False
                and stage.get('helper_performed_inference') is False and stage.get('paid_calls')==0,
                'Actual whole490 Large3 continuation chain differs')
    receipts=[read(contained(run,'word-cues/'+line['id']+'.json')) for line in lines]
    for line,receipt in zip(lines,receipts):
        require(receipt.get('id')==line['id'] and receipt.get('text')==acoustic.normalized_text(line['text'])
                and receipt.get('source_manifest_sha256')==mh and receipt.get('text_sha256')==sha(line['text'].encode())
                and receipt.get('audio_sha256')==audio_hashes[line['id']]
                and receipt.get('cues_sha256')==acoustic.cue_sha(receipt.get('word_cues',[])),
                'Whole actual timing receipt Source/audio/cue binding differs')
    approvals=read(contained(run,'word-cues/qualifications.private.json')).get('approvals',{})
    _timing_consistency(alignment,lines,receipts,approvals,audio_hashes)
    return frozen,report,alignment,takes,audio_hashes


def _actual_clip(bank,run,line,take,entry,audio_sha,root,cache):
    helper=original if bank=='original' else rewrite;seconds=take['signal']['seconds']
    receipt=helper._bound_receipt(run,line,entry,seconds,cache)
    if bank=='rewrite' and receipt.get('engine_version')==rewrite.e8_large.ENGINE:
        # This producer proof is a per-take check; the genuine whole QA remains
        # unchanged and contains all other rejected IDs.
        rewrite.e8_large.clean_target_qa(cache['whole_qa'],line,receipt,audio_sha)
    words=entry['words'];previous=0.
    for word in words:
        require(helper._valid_interval(run,line,entry,word,previous,seconds),'Selected actual spoken/punctuation timing invalid')
        previous=word['end']
    cues=[{'start':word['start'],'end':word['end']} for word in words]
    require(entry.get('word_count')==len(acoustic.normalized_text(line['text']).split())
            and entry.get('cues_sha256')==acoustic.cue_sha(cues), 'Selected measured full cue coverage differs')
    profiles=read(run/'profiles.private.json');voice=profiles['speakers'][line['speaker']]['google_voice']
    clip={**{key:copy.deepcopy(line[key]) for key in ('id','kind','speaker','text','display_text')},
          'audio':'audio/story/'+line['id']+'.mp3','sha256':audio_sha,'seconds':seconds,'voice':voice,
          'word_cues':cues,'runtime_keys':copy.deepcopy(line['runtime_keys'])}
    actual_policy=helper._policy(run,line,clip,cache)
    clip['timing_policy']={'method':VERSION,'source_manifest_sha256':digest(run/'lines.private.json'),
        'source_text_sha256':sha(line['text'].encode()),'audio_sha256':audio_sha,
        'actual_receipt_sha256':digest(contained(run,'word-cues/'+line['id']+'.json')),
        'cues_sha256':acoustic.cue_sha(cues),'alignment_engine':actual_policy['alignment_engine'],
        'actual_alignment_model':actual_policy['actual_alignment_model'],
        'whole_qa_report_sha256':cache['whole_qa_sha'],'whole_alignment_report_sha256':cache['whole_alignment_sha'],
        'qualification_scope':'one_actual_take_from_unchanged_complete_reports'}
    return clip


def _existing_snapshot(target,expected_sha):
    if not target.exists():
        require(expected_sha is None,'Expected existing partial Story bank unavailable');return {}
    require(target.is_dir() and not target.is_symlink(),'Unsafe existing Story bank')
    path=target/'manifest.json';require(path.is_file() and not path.is_symlink() and digest(path)==expected_sha,
                                     'Existing Story manifest differs from Root selection')
    manifest=compositor.unique_json(path);ids=exact_ids([clip.get('id') for clip in manifest.get('clips',[])],'existing Story IDs')
    require({file.name for file in target.iterdir()}=={'manifest.json',*(ident+'.mp3' for ident in ids)}
            and all(file.is_file() and not file.is_symlink() for file in target.iterdir()),'Unknown existing Story files')
    for clip in manifest['clips']:
        require(clip.get('audio')=='audio/story/'+clip['id']+'.mp3'
                and digest(target/(clip['id']+'.mp3'))==clip.get('sha256'),'Existing Story audio/path/hash differs')
    return {str(file):digest(file) for file in target.iterdir()}


def candidates(args):
    inventory=Path(args.current_inventory).resolve();root=strict.source_root(inventory);profiles_path=Path(args.profiles).resolve()
    require(digest(inventory)==original.CURRENT_SHA,'Only exact measured current1576 inventory allowed')
    require(profiles_path==root/'docs/voice-production/story-speakers.json','Actual complete current fixed-cast profile required')
    current=read(inventory);profiles=read(profiles_path);strict.validate_sources(current,root)
    scanner=compositor.scanner_inventory(inventory,root);rows,current_ids=compositor.current_rows(current)
    closure=original.validate_closure(args.source_closure,original.ORIGINAL_RUN,current,inventory,profiles,root)
    require(Path(args.public_dir).resolve()==root/'game/public/audio/story' and not Path(args.public_dir).is_symlink(),
            'Exact current Story destination required')
    original._protected();rewrite._protected_originals()
    candidate_clips=[];paths={};diagnostics={};inputs={};whole=[];seen=set()
    banks=[('original',original.ORIGINAL_RUN,Path(args.original_qa_report).resolve(),Path(args.original_alignment_report).resolve()),
           ('rewrite',root/'output/audio/story-voice'/rewrite.RUN_NAME,Path(args.rewrite_qa_report).resolve(),Path(args.rewrite_alignment_report).resolve())]
    for bank,run,qa_path,alignment_path in banks:
        frozen,report,alignment,takes,audio_hashes=_bound_complete_reports(bank,run,qa_path,alignment_path,root)
        cache={'whole_qa':report,'whole_qa_sha':digest(qa_path),'whole_alignment_sha':digest(alignment_path)}
        helper=original if bank=='original' else rewrite
        for line in frozen['lines']:
            ident=line['id'];require(ident not in seen,'The complete input banks overlap');seen.add(ident)
            if ident not in current_ids:continue
            if bank=='original':voice=original._identity_without_mood(line,rows[ident],read(run/'profiles.private.json'),profiles)
            else:voice=compositor.exact_source(line,rows[ident],profiles)
            require(read(run/'profiles.private.json')['speakers'][line['speaker']]['google_voice']==voice,
                    'Current fixed voice differs from charged input')
            take=takes[ident];reasons=copy.deepcopy(take['reasons'])
            if reasons:
                diagnostics[ident]={'word_signal_reasons':reasons,'timing_requires_qualification':ident in alignment['requires_qualification']};continue
            if ident not in alignment['alignment_by_id']:
                diagnostics[ident]={'word_signal_reasons':[],'timing_requires_qualification':True};continue
            try:
                require(_word_clear(line,take,audio_hashes[ident]),'Selected word/signal actual check is not clear')
                token=original._VALIDATION_CACHE.set(cache) if bank=='original' else None
                try:clip=_actual_clip(bank,run,line,take,alignment['alignment_by_id'][ident],audio_hashes[ident],root,cache)
                finally:
                    if token is not None:original._VALIDATION_CACHE.reset(token)
            except strict.Invalid as error:
                # A genuine report entry cannot waive an unsupported actual
                # receipt/proof. Hold this exact ID with the real guard reason.
                diagnostics[ident]={'word_signal_reasons':[], 'timing_requires_qualification':False,
                                   'actual_receipt_or_word_guard_rejection':str(error)}
                continue
            clip['runtime_keys']=copy.deepcopy(rows[ident]['runtime_keys'])
            clip['source_text_sha256']=sha(rows[ident]['text'].encode())
            clip['current_source_row_sha256']=sha(strict.canonical(rows[ident]).encode())
            candidate_clips.append(clip);paths[ident]=contained(run,'clips/'+ident+'.mp3')
        evidence=helper.evidence_files(run)
        files=[run/name for name in ('lines.private.json','profiles.private.json','prepared.json','requests.jsonl',
               'full-inventory.private.json','source-snapshot.private.json','collection.private.json')]
        files.extend(contained(run,'raw/'+line['id']+'.receipt.json') for line in frozen['lines'])
        files.extend(contained(run,'clips/'+line['id']+'.mp3') for line in frozen['lines'])
        for file in [*files,*evidence,qa_path,alignment_path]:
            if str(file) not in inputs:inputs[str(file)]=digest(file)
        whole.append({'bank':bank,'frozen_count':len(frozen['lines']),'frozen_manifest_sha256':digest(run/'lines.private.json'),
                      'qa_report':str(qa_path),'qa_sha256':digest(qa_path),'qa_status':report['status'],
                      'qa_failures':copy.deepcopy(report['failures']),'alignment_report':str(alignment_path),
                      'alignment_sha256':digest(alignment_path),'alignment_status':alignment['status'],
                      'alignment_failures':copy.deepcopy(alignment['failures']),
                      'alignment_requires_qualification':copy.deepcopy(alignment['requires_qualification'])})
    require(len(seen)==2047 and current_ids<=seen,'Whole original1557/rewrite490 current Source closure incomplete')
    require(set(paths)|set(diagnostics)==current_ids and not set(paths)&set(diagnostics),'Qualified/held Source coverage is incomplete')
    for file in (inventory,profiles_path,Path(args.source_closure).resolve()):inputs[str(file)]=digest(file)
    return root,current,profiles,scanner,closure,candidate_clips,paths,diagnostics,inputs,whole


def selection_proposal(args,result):
    root,current,profiles,scanner,closure,clips,paths,held,inputs,whole=result
    target=Path(args.public_dir).resolve();manifest=target/'manifest.json'
    return {'status':'root_review_required','reviewed_by':None,'reason':None,
            'current_inventory_sha256':digest(args.current_inventory),'profiles_sha256':digest(args.profiles),
            'source_closure_sha256':digest(args.source_closure),
            'input_reports_sha256':{record['bank']:{'qa':record['qa_sha256'],'alignment':record['alignment_sha256']} for record in whole},
            'selected_ids':sorted(paths),'existing_manifest_sha256':digest(manifest) if manifest.is_file() else None}


def build(args):
    result=candidates(args);root,current,profiles,scanner,closure,clips,paths,held,inputs,whole=result
    actual=compositor.unique_json(args.root_selection);proposal=selection_proposal(args,result)
    require(isinstance(actual,dict) and set(actual)==SELECTION_FIELDS and actual.get('status')==APPROVED
            and isinstance(actual.get('reviewed_by'),str) and actual['reviewed_by'].casefold().startswith('root ')
            and isinstance(actual.get('reason'),str) and len(actual['reason'].strip())>=20,'Explicit Root actual partial-bank selection required')
    selected=exact_ids(actual['selected_ids'],'selected actual qualified partial IDs')
    require(selected and selected<=set(paths),'Unqualified, unknown or dirty Source selected')
    require(all(actual[key]==proposal[key] for key in SELECTION_FIELDS-{'status','reviewed_by','reason','selected_ids'}),
            'Root partial selection Source/profile/complete-report bindings differ')
    inputs.update(_existing_snapshot(Path(args.public_dir).resolve(),actual['existing_manifest_sha256']))
    inputs[str(Path(args.root_selection).resolve())]=digest(args.root_selection)
    chosen=[clip for clip in clips if clip['id'] in selected];chosen_paths={ident:path for ident,path in paths.items() if ident in selected}
    current_ids={row['id'] for row in current['lines']};missing=sorted(current_ids-selected)
    manifest={'model':MODEL,'aliases':copy.deepcopy(current.get('aliases',{})),
              'scene_players':copy.deepcopy(current.get('scene_players',{})),'clips':chosen,
              'runtime_lookup':compositor.selectors(chosen,current.get('aliases',{}))}
    manifest['current_source_coverage']={'method':VERSION,'status':'qualified_partial_story_bank','full_original_bank_approved':False,
        'current_inventory_sha256':digest(args.current_inventory),'current_source_count':len(current_ids),
        'included_ids':sorted(selected),'missing_ids':missing,'source_files_sha256':copy.deepcopy(current['source_hashes']),
        'whole_input_summaries':[{key:record[key] for key in ('bank','frozen_count','qa_status','alignment_status')}
              | {'word_signal_failures':len(record['qa_failures']),'timing_failures':len(record['alignment_failures'])} for record in whole]}
    prolog=root/'game/public/audio/prolog';prolog_files={str(file):digest(file) for file in prolog.iterdir()} if prolog.is_dir() else {}
    require(len(list(prolog.glob('*.mp3')))==188,'Exact existing188 Prolog takes required and preserved')
    drivers=['story_voice_progress_publish.py','story_voice_incremental_publish.py','story_voice_original_bank_publish.py',
             'story_voice_rewrite_timing_publish.py','story_voice_rewrite_e8_large.py',*original.PROTECTED]
    driver_hashes={str(Path(__file__).with_name(name)):digest(Path(__file__).with_name(name)) for name in set(drivers)}
    coverage={'method':VERSION,'status':'qualified_partial_story_bank','full_original_bank_approved':False,
        'current_source_count':len(current_ids),'included_ids':sorted(selected),'missing_ids':missing,
        'qualified_but_unselected_ids':sorted(set(paths)-selected),'held_actual_reasons':held,'unchanged_complete_input_reports':whole,
        'Root_selection_sha256':digest(args.root_selection),'source_closure_sha256':digest(args.source_closure),
        'source_hashes':current['source_hashes'],'scanner':scanner,'input_files_sha256':inputs,
        'protected_driver_sha256':driver_hashes,'prolog_files_sha256':prolog_files}
    return manifest,chosen_paths,coverage


def save_new(path,value):
    require(not path.exists() and not path.is_symlink(),'New private output path required')
    path.parent.mkdir(parents=True,exist_ok=True);fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as stream:stream.write(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def apply_transaction(root,target,manifest,paths,coverage,coverage_path):
    """Keep the previous bank until Prolog readback and coverage commit succeed."""
    root=Path(root).resolve();target=Path(target).resolve();coverage_path=Path(coverage_path)
    require(not coverage_path.exists() and not coverage_path.is_symlink(),'New private coverage commit required')
    target.parent.mkdir(parents=True,exist_ok=True);coverage_path.parent.mkdir(parents=True,exist_ok=True)
    stage=Path(tempfile.mkdtemp(prefix='.story-progress-',dir=target.parent))
    staged=stage/'audio/story';backup=stage/'previous-story';installed=False;linked=False;committed=False
    installed_identity=None;report_identity=None
    previous_identity=_identity(target) if target.exists() else None
    report_temp=coverage_path.parent/(stage.name+'.coverage.private.json')
    try:
        strict.publish(staged,manifest,paths)
        fd=os.open(report_temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        stat=os.fstat(fd);report_identity=(stat.st_dev,stat.st_ino)
        with os.fdopen(fd,'w') as stream:stream.write(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n')
        report_bytes=report_temp.read_bytes()
        require(_same_identity(report_temp,report_identity),'Own staged coverage identity changed')
        compositor.recheck(root,paths,manifest,coverage)
        require((_same_identity(target,previous_identity) if previous_identity is not None else not target.exists()),
                'Existing Story destination identity changed before swap')
        if target.exists():target.rename(backup)
        installed_identity=_identity(staged)
        try:staged.rename(target);installed=True
        except BaseException:
            if backup.exists() and not target.exists():backup.rename(target)
            raise
        compositor.recheck_prolog(root,coverage)
        require(_same_identity(target,installed_identity)
                and all(digest(target/(clip['id']+'.mp3'))==clip['sha256'] for clip in manifest['clips'])
                and read(target/'manifest.json')==manifest,'Installed actual partial bank readback differs')
        # Hard-link creation has O_EXCL semantics: no race can replace a foreign
        # coverage file. The old bank remains recoverable until this succeeds.
        os.link(report_temp,coverage_path);linked=True
        require(_same_identity(coverage_path,report_identity) and coverage_path.read_bytes()==report_bytes,
                'Committed private coverage identity/readback differs')
        require(_same_identity(target,installed_identity),'Installed partial bank identity changed before commit')
        committed=True
    except BaseException:
        if installed and _same_identity(target,installed_identity):target.rename(stage/'failed-story')
        # A concurrently replaced destination belongs to its replacer. Retain
        # our recoverable previous bank rather than moving or overwriting it.
        if backup.exists() and not target.exists():backup.rename(target)
        if linked and _same_identity(coverage_path,report_identity):coverage_path.unlink()
        raise
    finally:
        if _same_identity(report_temp,report_identity):report_temp.unlink()
        # A failed rollback retains its only recoverable bank. After commitment
        # a cleanup failure may retain a backup, but cannot invalidate the bank.
        if committed or not backup.exists():shutil.rmtree(stage,ignore_errors=True)


def _identity(path):
    stat=Path(path).lstat()
    return stat.st_dev,stat.st_ino


def _same_identity(path,identity):
    if identity is None:return False
    try:return _identity(path)==identity
    except FileNotFoundError:return False


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('current-inventory','profiles','source-closure','original-qa-report','original-alignment-report',
                 'rewrite-qa-report','rewrite-alignment-report','public-dir'):
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--root-selection',type=Path);parser.add_argument('--coverage-report',type=Path)
    parser.add_argument('--proposal-file',type=Path)
    modes=parser.add_mutually_exclusive_group(required=True);modes.add_argument('--dry-run',action='store_true')
    modes.add_argument('--apply',action='store_true');modes.add_argument('--propose-selection',action='store_true')
    args=parser.parse_args()
    try:
        root=strict.source_root(args.current_inventory);private=root/'output/audio/story-voice'
        for path in (args.source_closure,args.root_selection,args.coverage_report,args.proposal_file):
            if path is not None:require(path.resolve().is_relative_to(private),'Inputs/output must remain private inside current workspace')
        with compositor.publication_lock(root):
            if args.propose_selection:
                require(args.proposal_file is not None,'New private proposal path required')
                result=candidates(args);proposal=selection_proposal(args,result);save_new(args.proposal_file,proposal)
                print(json.dumps({'status':'root_review_required','qualified_actual_sources':len(proposal['selected_ids']),
                                  'missing':1576-len(proposal['selected_ids']),'proposal':str(args.proposal_file)}));return 0
            require(args.root_selection is not None and args.coverage_report is not None,'Root selection and private coverage output required')
            require(not args.coverage_report.exists(),'New private coverage report required')
            manifest,paths,coverage=build(args);again,again_paths,again_coverage=build(args)
            require(manifest==again and paths==again_paths and coverage==again_coverage,'Actual complete inputs changed before partial publication')
            if args.apply:
                apply_transaction(root,args.public_dir,manifest,paths,coverage,args.coverage_report)
            else:save_new(args.coverage_report,coverage)
        print(json.dumps({'status':'published_partial' if args.apply else 'validated_partial','included':len(paths),
                          'missing':len(coverage['missing_ids']),'full_original_bank_approved':False}));return 0
    except (strict.Invalid,OSError,ValueError,KeyError,TypeError) as error:
        parser.exit(1,str(error)+'\n')


def _whole_inputs(run, qa_path, alignment_path, expected_count, review_source_root=None, vocal_variant_plan=None, vocal_variant_target_qc=None, vocal_variant_target_adjudications=None):
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
    return frozen


if __name__=='__main__':raise SystemExit(main())
