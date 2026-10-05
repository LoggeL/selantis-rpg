#!/usr/bin/env python3
"""Review independent CTC timing proposals; explicitly scoped private adoption.

No speech inference, audio modification, API, public export or blanket approval.
Technical cue qualification does not claim acting or human phonetic review.
"""
from __future__ import annotations
import argparse
import copy
import datetime
import json
import math
from pathlib import Path
import shutil
import prolog_voice_word_cues as acoustic
import story_voice_word_cues as cues
import story_voice_ctc_align as ctc
import story_voice_common as common
import story_voice_qa as qa

VERSION = 'story-CTC-private-adoption-v1'


def spelling_shape(word):
    value = word.casefold().replace('y','i')
    return 'k'+value[1:] if value.startswith('c') else value


def internal_variant_positions(line, audio_hash, approval, independent):
    """Only current explicitly reviewed same-position named spelling pairs."""
    if not approval or not independent:
        return {}
    canonical = qa.text_hash(json.dumps(independent,sort_keys=True,ensure_ascii=False))
    if (approval.get('status') != 'accepted_word_variants' or approval.get('channel') != 'independent'
            or approval.get('clip_sha256') != audio_hash or approval.get('text_sha256') != qa.text_hash(line['text'])
            or approval.get('independent_record_sha256') != canonical
            or approval.get('transcript_sha256') != qa.text_hash(independent.get('transcript',''))
            or not approval.get('reviewed_by') or not approval.get('reason')
            or independent.get('clip_sha256') != audio_hash or independent.get('source_text_sha256') != qa.text_hash(line['text'])):
        return {}
    expected, observed = qa.words(line['text']),qa.words(independent['transcript'])
    if len(expected) != len(observed):return {}
    allowed = {(pair['expected'].casefold(),pair['observed'].casefold()) for pair in approval.get('accepted_word_variants',[])}
    required = {(a,b) for a,b in zip(expected,observed) if a != b}
    if required != allowed or any(len(a)!=len(b) or spelling_shape(a)!=spelling_shape(b) for a,b in allowed):return {}
    positions={}; lexical=0
    for index,word in enumerate(acoustic.normalized_text(line['text']).split()):
        tokens=qa.words(word)
        if len(tokens)==1 and (tokens[0],observed[lexical]) in allowed:
            a,b=tokens[0],observed[lexical]
            positions[index]=[i for i,(aa,bb) in enumerate(zip(a,b)) if aa != bb]
        lexical+=len(tokens)
    return positions


def review(line, audio_hash, manifest_hash, current_qa, receipt, dtw, script_hash, variant_positions=None):
    result={'id':line['id'],'status':'rejected','approval':None,'requires_root_review':True}
    binding=receipt.get('binding',{});model=binding.get('model',{});alignment=receipt.get('alignment')
    if not ctc.clean_qa(line,audio_hash,manifest_hash,current_qa):
        result['reason']='current_individually_clean_QA_required';return result
    if (receipt.get('id')!=line['id'] or receipt.get('text')!=line['text']
            or binding.get('audio_sha256')!=audio_hash or binding.get('text_sha256')!=qa.text_hash(line['text'])
            or binding.get('source_manifest_sha256')!=manifest_hash or binding.get('script_sha256')!=script_hash
            or binding.get('engine')!=ctc.ENGINE or model.get('model_id')!=ctc.MODEL_ID
            or model.get('revision')!=qa.CTC_REVISION
            or model.get('fingerprint')!=qa.text_hash(json.dumps(model.get('file_sha256',{}),sort_keys=True))):
        result['reason']='CTC_source_audio_model_script_binding_mismatch';return result
    if (dtw.get('audio_sha256')!=audio_hash or dtw.get('text_sha256')!=qa.text_hash(line['text'])
            or dtw.get('source_manifest_sha256')!=manifest_hash or not alignment):
        result['reason']='current_DTW_or_CTC_alignment_missing';return result
    if not alignment.get('words') or alignment['decoded_seconds']!=dtw.get('decoded_seconds'):
        if not alignment or abs(alignment.get('decoded_seconds',0)-dtw.get('decoded_seconds',-1))>.001:
            result['reason']='CTC_decoded_duration_mismatch';return result
    authored=acoustic.normalized_text(line['text']).split();words=alignment.get('words',[])
    if [word.get('word')for word in words]!=authored:
        result['reason']='CTC_authored_word_cardinality_or_sequence_mismatch';return result
    proposed=[{'start':word['start'],'end':word['end']}for word in words]
    try:cues.cue_words(line['text'],proposed,dtw['decoded_seconds'])
    except RuntimeError as error:result['reason']=str(error);return result
    characters=alignment.get('character_alignment',[])
    if not characters or ''.join(char['character']for char in characters)!=receipt.get('normalized_characters'):
        result['reason']='CTC_authored_characters_missing';return result
    variant_positions=variant_positions or {};exceptions=[]
    for index,word in enumerate(words):
        owned=[char for char in characters if char.get('word_index')==index]
        if any(not isinstance(char.get('confidence'),(int,float)) or not math.isfinite(char['confidence']) or not 0<=char['confidence']<=1 for char in owned):
            result['reason']='invalid_CTC_character_confidence';return result
        if not qa.words(word['word']):
            if word['start']!=word['end']:
                result['reason']='nonspoken_punctuation_has_inferred_interval';return result
            continue
        if (not owned or word['end']-word['start']<.02 or word.get('waveform_active_fraction',0)<.1
                or word['end']-word['start']>1.5 or owned[0]['confidence']<.5 or owned[-1]['confidence']<.5):
            result['reason']='unsupported_word_waveform_or_boundary_character';return result
        low=[j for j,char in enumerate(owned)if char['confidence']<.05]
        flagged=[flag for flag in alignment.get('qualification_flags',[])if flag.get('word_index')==index]
        if flagged or low:
            allowed=variant_positions.get(index,[])
            if (not low or any(j in(0,len(owned)-1)or j not in allowed for j in low)
                    or any(char['confidence']<.5 for j,char in enumerate(owned)if j not in low)
                    or any(flag.get('reason')!='low_independent_CTC_character_confidence'for flag in flagged)):
                result['reason']='CTC_low_confidence_or_other_flags';return result
            exceptions.append({'word_index':index,'word':word['word'],'internal_character_indices':low,
                               'requires_explicit_root_name_variant_review':True})
        elif word.get('confidence',0)<.2:
            result['reason']='low_CTC_word_confidence';return result
    unowned=[flag for flag in alignment.get('qualification_flags',[])if flag.get('word_index')not in range(len(words))]
    if unowned:
        result['reason']='CTC_unmapped_qualification_flags';return result
    result.update(status='supported_variant_internal_only'if exceptions else 'supported',
                  proposed_cues=proposed,proposed_cues_sha256=acoustic.cue_sha(proposed),
                  variant_exceptions=exceptions,original_cues_sha256=dtw.get('cues_sha256'),
                  binding=copy.deepcopy(binding),note='Technical independent CTC word timing only; root must inspect scoped IDs. No acting/listening claim.')
    return result


def complete_report(run,manifest,manifest_hash,approvals,expected_count=1557):
    receipts=[];failures=[];expected={line['id']for line in manifest['lines']}
    if {path.stem for path in(run/'clips').glob('*.mp3')}!=expected:failures.append({'id':None,'reason':'current_audio_ID_coverage_mismatch'})
    if len(expected)!=expected_count:failures.append({'id':None,'reason':'frozen_inventory_coverage_count_mismatch'})
    for line in manifest['lines']:
        path=run/'word-cues'/(line['id']+'.json');audio=run/'clips'/(line['id']+'.mp3')
        if not path.is_file()or not audio.is_file():
            failures.append({'id':line['id'],'reason':'missing_current_audio_or_receipt'});continue
        row=json.loads(path.read_text())
        if (row.get('audio_sha256')!=qa.digest(audio)or row.get('text_sha256')!=qa.text_hash(line['text'])
                or row.get('source_manifest_sha256')!=manifest_hash or row.get('text')!=acoustic.normalized_text(line['text'])
                or row.get('cues_sha256')!=acoustic.cue_sha(row.get('word_cues',[]))):
            failures.append({'id':line['id'],'reason':'stale_audio_source_or_cues_receipt'});continue
        receipts.append(row)
    report=cues.report_for(receipts,approvals)
    report['failures'].extend(failures)
    report.update(source_manifest_sha256=manifest_hash,expected_count=expected_count,current_receipt_count=len(receipts))
    if failures or set(report['clip_sha256'])!=expected:report['status']='needs_review'
    return report


def apply_scoped(run,proposals,reviewed_ids,approval_path,manifest,manifest_hash,qa_path,qa_hash,expected_count=1557):
    if not reviewed_ids or not reviewed_ids<=set(proposals):raise ValueError('Explicit known --reviewed-ids required')
    if any(proposals[ident]['status']not in{'supported','supported_variant_internal_only'}for ident in reviewed_ids):
        raise ValueError('Every scoped ID must have a supported current proposal')
    lock=common.run_lock(run)
    try:
        # Every dependency rechecked before the first write, including selected
        # receipt/model/source/QA hashes captured by proposal preparation.
        to_verify={}
        for ident in reviewed_ids:
            for path,h in proposals[ident]['input_hashes'].items():
                if path in to_verify and to_verify[path]!=h:raise ValueError('Conflicting scoped input bindings')
                to_verify[path]=h
        for path,h in to_verify.items():
            if qa.digest(Path(path))!=h:raise ValueError('Scoped proposal input changed before adoption')
        if qa.digest(run/'lines.private.json')!=manifest_hash or qa.digest(qa_path)!=qa_hash:
            raise ValueError('QA/source changed before adoption')
        approvals=json.loads(approval_path.read_text()).get('approvals',{})if approval_path.exists()else{}
        archive=run/'word-cues'/'adoption-archive'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
        archive.mkdir(parents=True)
        if approval_path.exists():shutil.copy2(approval_path,archive/'prior-qualifications.private.json')
        for ident in sorted(reviewed_ids):
            path=run/'word-cues'/(ident+'.json');shutil.copy2(path,archive/path.name)
            old=json.loads(path.read_text());new=copy.deepcopy(old);proposal=proposals[ident]
            new.setdefault('original_DTW_word_cues',copy.deepcopy(old['word_cues']))
            new['word_cues']=copy.deepcopy(proposal['proposed_cues']);new['cues_sha256']=acoustic.cue_sha(new['word_cues'])
            new['engine_version']=old['engine_version']+'/'+VERSION
            new['CTC_adoption']={'ctc_receipt_sha256':proposal['CTC_receipt_sha256'],
                                 'binding':proposal['binding'],'qa_report_sha256':qa_hash,
                                 'variant_exceptions':proposal['variant_exceptions']}
            # Every original DTW/raw/qualification detail remains unchanged;
            # the adopted public timing proposal lives only in word_cues.
            approval={key:new[key]for key in['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256','engine_version']}
            approval.update(decision='reviewed',review_note='Root explicitly selected this source/audio/model/script/QA-bound independent CTC proposal. Technical word timing, no human acting or phonetic verdict.',
                            ctc_receipt_sha256=proposal['CTC_receipt_sha256'],CTC_binding=proposal['binding'],qa_report_sha256=qa_hash,
                            variant_exceptions=proposal['variant_exceptions'])
            qa.save(path,new);approvals[ident]=approval
        qa.save(approval_path,{'approvals':approvals,'method':VERSION})
        report=complete_report(run,manifest,manifest_hash,approvals,expected_count)
        qa.save(run/'word-cues'/'alignment.private.json',report)
        return report
    finally:lock.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',type=Path,required=True);parser.add_argument('--qa-report',type=Path,required=True)
    parser.add_argument('--ctc-dir',type=Path);parser.add_argument('--approval-file',type=Path)
    parser.add_argument('--word-approvals',type=Path);parser.add_argument('--only-ids')
    parser.add_argument('--apply',action='store_true');parser.add_argument('--reviewed-ids')
    parser.add_argument('--expected-count',type=int,default=1557)
    args=parser.parse_args();run=args.run_dir.resolve()
    if not run.is_relative_to(common.PRIVATE.resolve()):parser.error('Run must be inside private story bank')
    ctc_dir=args.ctc_dir.resolve()if args.ctc_dir else run/'ctc-align'
    approval_path=args.approval_file.resolve()if args.approval_file else run/'word-cues'/'qualifications.private.json'
    if not ctc_dir.is_relative_to(run)or not approval_path.is_relative_to(run):parser.error('CTC and qualification paths must stay in run')
    selected=set(args.only_ids.split(','))if args.only_ids else None
    reviewed=set(args.reviewed_ids.split(','))if args.reviewed_ids else set()
    if args.apply and not reviewed:parser.error('--apply requires explicit --reviewed-ids')
    manifest_path=run/'lines.private.json';manifest=json.loads(manifest_path.read_text());manifest_hash=qa.digest(manifest_path)
    qa_report=json.loads(args.qa_report.read_text());qa_hash=qa.digest(args.qa_report)
    script_hash=qa.digest(Path(ctc.__file__))
    variants=json.loads(args.word_approvals.read_text())if args.word_approvals else{}
    results={};checked_models={}
    for line in manifest['lines']:
        ident=line['id']
        if selected and ident not in selected:continue
        ctc_path=ctc_dir/(ident+'.ctc.private.json');dtw_path=run/'word-cues'/(ident+'.json');audio=run/'clips'/(ident+'.mp3')
        if not ctc_path.is_file()or not dtw_path.is_file()or not audio.is_file():continue
        receipt=json.loads(ctc_path.read_text());dtw=json.loads(dtw_path.read_text());h=qa.digest(audio)
        identity=receipt.get('binding',{}).get('model',{});key=identity.get('fingerprint')
        if key not in checked_models:
            try:checked_models[key]=ctc.model_identity(Path(identity['local_directory']),identity['revision'])
            except(ValueError,KeyError):checked_models[key]=None
        if checked_models[key]!=identity:
            results[ident]={'id':ident,'status':'rejected','reason':'actual_model_files_changed'};continue
        independent=None
        for path in(run/'independent-google-asr').glob(ident+'.*.json'):
            candidate=json.loads(path.read_text())
            if qa.text_hash(json.dumps(candidate,sort_keys=True,ensure_ascii=False))==variants.get(ident,{}).get('independent_record_sha256'):
                independent=candidate;break
        positions=internal_variant_positions(line,h,variants.get(ident),independent)
        proposal=review(line,h,manifest_hash,qa_report,receipt,dtw,script_hash,positions)
        proposal['CTC_receipt_sha256']=qa.digest(ctc_path)
        proposal['input_hashes']={str(path):qa.digest(path)for path in[ctc_path,dtw_path,audio,args.qa_report,manifest_path,Path(ctc.__file__)]}
        proposal['input_hashes'].update({str(Path(identity['local_directory'])/name):value for name,value in identity['file_sha256'].items()})
        results[ident]=proposal
    if qa.digest(args.qa_report)!=qa_hash or qa.digest(manifest_path)!=manifest_hash:
        raise ValueError('Source/QA changed during proposal review; use a completed hash-bound report')
    out=run/'ctc-review';qa.save(out/'proposals.private.json',{'method':VERSION,'requires_root_review':True,'proposals':results})
    if args.apply:
        result=apply_scoped(run,results,reviewed,approval_path,manifest,manifest_hash,args.qa_report,qa_hash,args.expected_count)
        print(json.dumps({'status':result['status'],'aligned':len(result['alignment_by_id'])}))
    else:
        from collections import Counter
        print(json.dumps(dict(Counter(row['status']for row in results.values()))))


if __name__=='__main__':main()
