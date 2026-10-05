#!/usr/bin/env python3
"""Explicit private adoption of dual-model supported originally flagged words.

Unmodified CTC character-frame intervals only; no whole-clip blanket clearance,
threshold change, inference, API, audio change or public export.
"""
import argparse
import copy
import datetime
import json
import math
from pathlib import Path
import shutil
import story_voice_common as common
import story_voice_word_cues as cues
import prolog_voice_word_cues as acoustic
import story_voice_qa as qa
import story_voice_ctc_align as primary
import story_voice_secondary_ctc as secondary
import story_voice_ctc_review as complete

VERSION='story-partial-dual-CTC-private-adoption-v1'


def word_supported(receipt,index,word):
    alignment=receipt.get('alignment')or{};words=alignment.get('words',[])
    if index>=len(words)or words[index].get('word')!=word:return None
    row=words[index];chars=[char for char in alignment.get('character_alignment',[])if char.get('word_index')==index]
    probabilities=[row.get('confidence'),row.get('waveform_active_fraction'),*[char.get('confidence')for char in chars]]
    if any(isinstance(p,bool)or not isinstance(p,(int,float))or not math.isfinite(p)or not 0<=p<=1 for p in probabilities):return None
    if (not chars or row.get('confidence',0)<.2 or row.get('waveform_active_fraction',0)<.1
        or not .02<=row['end']-row['start']<=1.5
        or min(char['confidence']for char in chars)<.05
        or chars[0]['confidence']<.5 or chars[-1]['confidence']<.5
        or abs(chars[0]['start']-row['start'])>.0001 or abs(chars[-1]['end']-row['end'])>.0001
        or any(flag.get('word_index')==index for flag in alignment.get('qualification_flags',[]))):return None
    return row


def model_current(receipt,label,cache=None):
    binding=receipt.get('binding',{});model=binding.get('model',{});factory=primary if label=='primary'else secondary
    if (binding.get('engine')!=factory.ENGINE or model.get('model_id')!=factory.MODEL_ID
        or model.get('revision')!=(qa.CTC_REVISION if label=='primary'else secondary.REVISION)):
        return False
    cache=cache if cache is not None else{};key=label+json.dumps(model,sort_keys=True)
    if key not in cache:
        try:cache[key]=factory.model_identity(Path(model['local_directory']),model['revision'])==model
        except(ValueError,KeyError,OSError):cache[key]=False
    if not cache[key]:return False
    script=Path(factory.__file__)
    if binding.get('script_sha256')!=qa.digest(script):return False
    if label=='secondary':
        from story_voice_secondary_ctc_review import runtime_matches
        if binding.get('parent_ctc_script_sha256')!=qa.digest(Path(primary.__file__))or not runtime_matches(receipt,model):return False
    return True


def proposal(line,audio_hash,mh,current_qa,veto,run,diagnostic,dtw,ctc_receipts,model_cache=None):
    result={'id':line['id'],'status':'rejected','approval':None,'requires_root_review':True}
    if not primary.clean_qa(line,audio_hash,mh,current_qa):result['reason']='current_individually_clean_QA_required';return result
    veto_state=qa.lexical_veto_review(run,line,audio_hash,veto)
    if veto_state and(veto_state.get('applicable')or veto_state.get('binding_requires_review')):
        result['reason']='active_lexical_veto_or_unverified_veto';return result
    if (diagnostic.get('repeat_risk')or diagnostic.get('status')=='dual_CTC_repeat_contradiction_requires_lexical_review'):
        result['reason']='pass9_repeat_contradiction';return result
    if (diagnostic.get('clip_sha256')!=audio_hash or diagnostic.get('text_sha256')!=qa.text_hash(line['text'])
        or diagnostic.get('source_manifest_sha256')!=mh or diagnostic.get('DTW_cues_sha256')!=dtw.get('cues_sha256')
        or dtw.get('audio_sha256')!=audio_hash or dtw.get('text_sha256')!=qa.text_hash(line['text'])
        or dtw.get('source_manifest_sha256')!=mh or dtw.get('cues_sha256')!=acoustic.cue_sha(dtw.get('word_cues',[]))):
        result['reason']='stale_pass9_or_current_DTW_binding';return result
    authored=acoustic.normalized_text(line['text']).split()
    for label,receipt in ctc_receipts.items():
        binding=receipt.get('binding',{})
        if (not model_current(receipt,label,model_cache)or binding.get('audio_sha256')!=audio_hash
            or binding.get('text_sha256')!=qa.text_hash(line['text'])or binding.get('source_manifest_sha256')!=mh
            or [row.get('word')for row in(receipt.get('alignment')or{}).get('words',[])]!=authored):
            result['reason']='current_dual_CTC_provenance_or_source_failed';return result
        try:
            vocab=json.loads((Path(binding['model']['local_directory'])/'vocab.json').read_text())
            mapping=primary.authored_tokens(line['text'],vocab)if label=='primary'else secondary.project_authored(line['text'],vocab)
        except(ValueError,KeyError,OSError):result['reason']='unknown_authored_CTC_projection';return result
        chars=receipt['alignment'].get('character_alignment',[])
        if ([char.get('character')for char in chars]!=mapping['characters']
            or [char.get('word_index')for char in chars]!=mapping['word_owners']
            or abs(receipt['alignment'].get('decoded_seconds',-1)-dtw.get('decoded_seconds',-2))>.001):
            result['reason']='actual_CTC_character_sequence_or_duration_mismatch';return result
    if set(ctc_receipts)!={'primary','secondary'}:result['reason']='both_pinned_CTC_paths_required';return result
    flagged={flag.get('word_index')for flag in dtw.get('all_qualification_flags',[])}
    changed=[];new=copy.deepcopy(dtw['word_cues'])
    for row in diagnostic.get('word_timing_proposals',[]):
        if not row.get('complete_DTW_with_single_word_replacement_ordered'):continue
        index=row.get('word_index')
        if type(index)is not int or index not in flagged or not 0<=index<len(authored):
            result['reason']='only_original_flagged_word_indices_allowed';return result
        aa=word_supported(ctc_receipts['primary'],index,authored[index]);bb=word_supported(ctc_receipts['secondary'],index,authored[index])
        if not aa or not bb or max(abs(aa[key]-bb[key])for key in['start','end'])>.12:
            result['reason']='strict_dual_word_boundary_support_failed';return result
        if row.get('word')!=authored[index]or any(row.get(key)!=aa[key]for key in['start','end']):
            result['reason']='proposal_interval_not_actual_primary_CTC_frames';return result
        new[index]={'start':aa['start'],'end':aa['end']};changed.append(index)
    if not changed:result['reason']='no_scoped_ordered_flagged_word_proposal';return result
    try:cues.cue_words(line['text'],new,dtw['decoded_seconds'])
    except RuntimeError as error:result['reason']=str(error);return result
    # Every flagged source word must be technically covered before a full-clip
    # qualification can be granted, even though only those words are replaced.
    if not flagged<=set(changed):
        result['reason']='remaining_flagged_words_not_covered_no_blanket_clip_approval';return result
    result.update(status='supported',changed_word_indices=sorted(set(changed)),proposed_cues=new,
                  proposed_cues_sha256=acoustic.cue_sha(new),root_review_required=True,
                  source_manifest_sha256=mh,audio_sha256=audio_hash,text_sha256=qa.text_hash(line['text']))
    return result


def validate_cached_adoption(receipt,expected,approval,run,provenance_cache=None):
    if (receipt.get('engine_version')!=cues.ENGINE+'/'+VERSION or not cues.adjudicated(receipt,approval)
        or any(receipt.get(key)!=value for key,value in expected.items()if key!='engine_version')
        or receipt.get('cues_sha256')!=acoustic.cue_sha(receipt.get('word_cues',[]))):return False
    adoption=receipt.get('Partial_CTC_adoption',{})
    if not adoption or adoption!=approval.get('Partial_CTC_adoption'):return False
    try:
        file_cache=provenance_cache if provenance_cache is not None else{}
        for path,h in adoption['input_hashes'].items():
            cache_key='partial-input:'+path
            if cache_key not in file_cache:file_cache[cache_key]=qa.digest(Path(path))
            if file_cache[cache_key]!=h:return False
        qa_report=json.loads(Path(adoption['qa_report_file']).read_text())
        veto=qa.load_lexical_veto_records(Path(adoption['lexical_veto_file']))
        line={'id':receipt['id'],'text':adoption['authored_text']}
        if not primary.clean_qa(line,expected['audio_sha256'],expected['source_manifest_sha256'],qa_report):return False
        state=qa.lexical_veto_review(run,line,expected['audio_sha256'],veto)
        if state and(state.get('applicable')or state.get('binding_requires_review')):return False
        original=json.loads(Path(adoption['original_receipt_archive']).read_text())
        diagnostic=json.loads(Path(adoption['proposal_file']).read_text())
        row=next(row for row in diagnostic['results']if row['id']==receipt['id'])
        actual={label:json.loads(Path(path).read_text())for label,path in adoption['CTC_receipt_files'].items()}
        checked=proposal(line,expected['audio_sha256'],expected['source_manifest_sha256'],qa_report,veto,run,row,original,actual,provenance_cache)
        return checked['status']=='supported'and checked['proposed_cues']==receipt['word_cues']
    except(OSError,ValueError,KeyError,StopIteration,TypeError):return False


def apply_scoped(run,rows,reviewed,approval_path,manifest,mh,qa_path,qa_hash,veto_path,proposal_path,expected_count=1557):
    if not reviewed or not reviewed<=set(rows)or any(rows[i]['status']!='supported'for i in reviewed):
        raise ValueError('Explicit scoped root-reviewed IDs must all be supported')
    lock=common.run_lock(run)
    try:
        hashes={}
        for ident in reviewed:
            for path,h in rows[ident]['input_hashes'].items():
                if path in hashes and hashes[path]!=h:raise ValueError('Conflicting proposal bindings')
                hashes[path]=h
        for path,h in hashes.items():
            if qa.digest(Path(path))!=h:raise ValueError('Input changed before any partial-cue adoption')
        if qa.digest(run/'lines.private.json')!=mh or qa.digest(qa_path)!=qa_hash:raise ValueError('Source/QA changed')
        payload=json.loads(approval_path.read_text())if approval_path.exists()else{'approvals':{}};approvals=payload.get('approvals',{})
        archive=run/'word-cues'/'adoption-archive'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ');archive.mkdir(parents=True)
        if approval_path.exists():shutil.copy2(approval_path,archive/'prior-qualifications.private.json')
        for ident in sorted(reviewed):
            path=run/'word-cues'/(ident+'.json');archived=archive/path.name;shutil.copy2(path,archived)
            old=json.loads(path.read_text());row=rows[ident];new=copy.deepcopy(old)
            new.setdefault('original_DTW_word_cues',copy.deepcopy(old['word_cues']))
            inputs={str(archived)if Path(p)==path else p:h for p,h in row['input_hashes'].items()}
            adoption={'input_hashes':inputs,'original_receipt_archive':str(archived),
                      'CTC_receipt_files':row['CTC_receipt_files'],'proposal_file':str(proposal_path),
                      'qa_report_file':str(qa_path),'lexical_veto_file':str(veto_path),
                      'authored_text':row['authored_text'],'changed_word_indices':row['changed_word_indices'],
                      'method':VERSION,'note':'Root-selected technical acoustic timing; separate current word/signal QA. No human phonetic or acting verdict.'}
            new.update(word_cues=copy.deepcopy(row['proposed_cues']),cues_sha256=row['proposed_cues_sha256'],
                       engine_version=cues.ENGINE+'/'+VERSION,Partial_CTC_adoption=adoption)
            approval={key:new[key]for key in['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256','engine_version']}
            approval.update(decision='reviewed',review_note=adoption['note'],Partial_CTC_adoption=adoption)
            qa.save(path,new);approvals[ident]=approval
        payload['approvals']=approvals;qa.save(approval_path,payload)
        report=complete.complete_report(run,manifest,mh,approvals,expected_count)
        qa.save(run/'word-cues'/'alignment.private.json',report);return report
    finally:lock.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',type=Path,required=True);parser.add_argument('--qa-report',type=Path,required=True)
    parser.add_argument('--lexical-veto-report',type=Path,required=True);parser.add_argument('--proposal-file',type=Path)
    parser.add_argument('--only-ids',required=True);parser.add_argument('--apply',action='store_true');parser.add_argument('--reviewed-ids')
    parser.add_argument('--approval-file',type=Path);parser.add_argument('--expected-count',type=int,default=1557)
    args=parser.parse_args();run=args.run_dir.resolve();qp=args.qa_report.resolve();vp=args.lexical_veto_report.resolve()
    pp=args.proposal_file.resolve()if args.proposal_file else run/'timing-review-pass9.private.json'
    ap=args.approval_file.resolve()if args.approval_file else run/'word-cues'/'qualifications.private.json'
    if not run.is_relative_to(common.PRIVATE.resolve())or any(not p.is_relative_to(run)for p in[qp,vp,pp,ap]):parser.error('All inputs/approvals must stay inside private run')
    selected=set(args.only_ids.split(','));reviewed=set(args.reviewed_ids.split(','))if args.reviewed_ids else set()
    if args.apply and(not reviewed or not reviewed<=selected):parser.error('--apply requires reviewed IDs subset of selected IDs')
    manifest_path=run/'lines.private.json';manifest=json.loads(manifest_path.read_text());mh=qa.digest(manifest_path)
    report=json.loads(qp.read_text());qh=qa.digest(qp);veto=qa.load_lexical_veto_records(vp)
    diagnostics={row['id']:row for row in json.loads(pp.read_text())['results']};lines={line['id']:line for line in manifest['lines']}
    if not selected<=set(lines):parser.error('Unknown selected IDs')
    rows={};model_cache={}
    for ident in sorted(selected):
        dp=run/'word-cues'/(ident+'.json');mp3=run/'clips'/(ident+'.mp3')
        paths={'primary':run/'ctc-align'/(ident+'.ctc.private.json'),'secondary':run/'ctc-secondary'/(ident+'.secondary-ctc.private.json')}
        if ident not in diagnostics or not all(p.is_file()for p in[dp,mp3,*paths.values()]):rows[ident]={'id':ident,'status':'rejected','reason':'missing_actual_inputs'};continue
        diagnostic=diagnostics[ident];dtw=json.loads(dp.read_text());actual={label:json.loads(path.read_text())for label,path in paths.items()}
        if (diagnostic.get('DTW_receipt_sha256')!=qa.digest(dp)or any(diagnostic.get('CTC_paths',{}).get(label,{}).get('receipt_sha256')!=qa.digest(path)for label,path in paths.items())):
            rows[ident]={'id':ident,'status':'rejected','reason':'pass9_receipt_hashes_changed'};continue
        row=proposal(lines[ident],qa.digest(mp3),mh,report,veto,run,diagnostic,dtw,actual,model_cache)
        dependencies=[dp,mp3,qp,vp,pp,manifest_path,*paths.values(),Path(primary.__file__),Path(secondary.__file__)]
        row['input_hashes']={str(path):qa.digest(path)for path in dependencies}
        for receipt in actual.values():
            model=receipt['binding']['model'];row['input_hashes'].update({str(Path(model['local_directory'])/name):h for name,h in model['file_sha256'].items()})
        row.update(CTC_receipt_files={label:str(path)for label,path in paths.items()},authored_text=lines[ident]['text']);rows[ident]=row
    qa.save(run/'partial-cue-review'/'proposals.private.json',{'method':VERSION,'requires_root_review':True,'proposals':rows})
    if args.apply:
        result=apply_scoped(run,rows,reviewed,ap,manifest,mh,qp,qh,vp,pp,args.expected_count);print(json.dumps({'status':result['status'],'aligned':len(result['alignment_by_id'])}))
    else:
        from collections import Counter
        print(json.dumps(dict(Counter(row['status']for row in rows.values()))))


if __name__=='__main__':main()
