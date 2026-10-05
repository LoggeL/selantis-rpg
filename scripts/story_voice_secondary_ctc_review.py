#!/usr/bin/env python3
"""Narrow private review/adoption for the pinned German VoxPopuli checkpoint.

Independent forced timing never qualifies authored words; current separate clean
QA is mandatory. No inference, downloads, APIs, audio edits or public export.
"""
import argparse
import copy
import datetime
import json
import math
from pathlib import Path
import shutil
import prolog_voice_word_cues as acoustic
import story_voice_common as common
import story_voice_qa as qa
import story_voice_word_cues as cues
import story_voice_secondary_ctc as secondary
import story_voice_ctc_review as primary_review

VERSION='story-secondary-CTC-private-adoption-v1'


def runtime_matches(receipt,model):
    """Validate reviewed tokenizer blank0 despite checkpoint config pad1."""
    try:
        directory=Path(model['local_directory'])
        vocab=json.loads((directory/'vocab.json').read_text())
        config=json.loads((directory/'config.json').read_text())
        processor=json.loads((directory/'preprocessor_config.json').read_text())
        expected=secondary.validate_runtime(vocab,vocab,vocab['<pad>'],config['pad_token_id'],
                                            config['vocab_size'],processor['do_normalize'],processor['sampling_rate'])
        return (vocab['<pad>']==0 and config['pad_token_id']==1
                and receipt.get('runtime_semantics')==expected
                and receipt.get('greedy_decode',{}).get('blank_token_id')==0)
    except (ValueError,KeyError,OSError,TypeError):return False


def review(line,audio_hash,manifest_hash,report,receipt,dtw,identity):
    row={'id':line['id'],'status':'rejected','approval':None,'requires_root_review':True}
    binding=receipt.get('binding',{});aligned=receipt.get('alignment')
    if not secondary.parent.clean_qa(line,audio_hash,manifest_hash,report):
        row['reason']='current_individually_clean_QA_required';return row
    if (receipt.get('id')!=line['id']or receipt.get('text')!=line['text']
        or binding.get('engine')!=secondary.ENGINE or identity.get('model_id')!=secondary.MODEL_ID
        or identity.get('revision')!=secondary.REVISION or binding.get('model')!=identity
        or binding.get('audio_sha256')!=audio_hash or binding.get('text_sha256')!=qa.text_hash(line['text'])
        or binding.get('source_manifest_sha256')!=manifest_hash
        or binding.get('script_sha256')!=identity.get('driver_script_sha256')
        or binding.get('parent_ctc_script_sha256')!=identity.get('parent_ctc_script_sha256')
        or not runtime_matches(receipt,identity)):
        row['reason']='secondary_actual_model_driver_runtime_binding_mismatch';return row
    if (not aligned or dtw.get('audio_sha256')!=audio_hash or dtw.get('text_sha256')!=qa.text_hash(line['text'])
        or dtw.get('source_manifest_sha256')!=manifest_hash
        or dtw.get('cues_sha256')!=acoustic.cue_sha(dtw.get('word_cues',[]))
        or abs(aligned['decoded_seconds']-dtw.get('decoded_seconds',-1))>.001):
        row['reason']='current_DTW_audio_source_cues_or_duration_mismatch';return row
    authored=acoustic.normalized_text(line['text']).split();words=aligned.get('words',[])
    if [word.get('word')for word in words]!=authored or aligned.get('qualification_flags'):
        row['reason']='authored_sequence_or_secondary_confidence_flags';return row
    try:
        vocab=json.loads((Path(identity['local_directory'])/'vocab.json').read_text())
        mapping=secondary.project_authored(line['text'],vocab)
        if (receipt.get('normalized_characters')!=''.join(mapping['characters'])
            or receipt.get('word_owners')!=mapping['word_owners']
            or receipt.get('case_projection')!=mapping['case_projection']):
            raise ValueError('Authored character projection mismatch')
        proposed=[{'start':word['start'],'end':word['end']}for word in words]
        cues.cue_words(line['text'],proposed,dtw['decoded_seconds'])
    except (ValueError,RuntimeError)as error:row['reason']=str(error);return row
    chars=aligned.get('character_alignment',[])
    if [char.get('character')for char in chars]!=mapping['characters']or [char.get('word_index')for char in chars]!=mapping['word_owners']:
        row['reason']='actual_secondary_character_sequence_mismatch';return row
    for index,word in enumerate(words):
        owned=[char for char in chars if char['word_index']==index]
        if not owned:
            if qa.words(word['word'])or word['start']!=word['end']:
                row['reason']='unknown_or_inferred_nonverbal_interval';return row
            continue
        confidence=[char.get('confidence')for char in owned]
        if (any(isinstance(p,bool)or not isinstance(p,(int,float))or not math.isfinite(p)or not .05<=p<=1 for p in confidence)
            or confidence[0]<.5 or confidence[-1]<.5
            or not isinstance(word.get('confidence'),(int,float))or not .2<=word['confidence']<=1
            or not .02<=word['end']-word['start']<=1.5
            or word.get('waveform_active_fraction',0)<.1
            or abs(owned[0]['start']-word['start'])>.0001 or abs(owned[-1]['end']-word['end'])>.0001):
            row['reason']='secondary_low_boundary_character_word_or_waveform_confidence';return row
    row.update(status='supported',proposed_cues=proposed,proposed_cues_sha256=acoustic.cue_sha(proposed),
               binding=copy.deepcopy(binding),original_cues_sha256=dtw['cues_sha256'],
               note='Root review required: independent acoustic word timings only; separate clean word/signal QA. No human acting/phonetic claim.')
    return row


def apply_scoped(run,proposals,reviewed,approval_path,manifest,manifest_hash,qa_path,qa_hash,expected_count=1557):
    if not reviewed or not reviewed<=set(proposals)or any(proposals[i]['status']!='supported'for i in reviewed):
        raise ValueError('Explicit reviewed IDs must be supported secondary proposals')
    lock=common.run_lock(run)
    try:
        inputs={}
        for ident in reviewed:
            for path,h in proposals[ident]['input_hashes'].items():
                if path in inputs and inputs[path]!=h:raise ValueError('Conflicting proposal bindings')
                inputs[path]=h
        for path,h in inputs.items():
            if qa.digest(Path(path))!=h:raise ValueError('Secondary proposal input changed before adoption')
        if qa.digest(run/'lines.private.json')!=manifest_hash or qa.digest(qa_path)!=qa_hash:
            raise ValueError('Current source or QA changed')
        payload=json.loads(approval_path.read_text())if approval_path.exists()else{'approvals':{}}
        approvals=payload.get('approvals',{})
        archive=run/'word-cues'/'adoption-archive'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
        archive.mkdir(parents=True)
        if approval_path.exists():shutil.copy2(approval_path,archive/'prior-qualifications.private.json')
        for ident in sorted(reviewed):
            path=run/'word-cues'/(ident+'.json');shutil.copy2(path,archive/path.name)
            old=json.loads(path.read_text());new=copy.deepcopy(old);proposal=proposals[ident]
            new.setdefault('original_DTW_word_cues',copy.deepcopy(old['word_cues']))
            new.update(word_cues=copy.deepcopy(proposal['proposed_cues']),cues_sha256=proposal['proposed_cues_sha256'],
                       engine_version=cues.ENGINE+'/'+VERSION)
            new['CTC_adoption']={'ctc_receipt_sha256':proposal['secondary_receipt_sha256'],'binding':proposal['binding'],
                                 'qa_report_sha256':qa_hash,'secondary':True}
            approval={key:new[key]for key in['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256','engine_version']}
            approval.update(decision='reviewed',review_note='Root explicitly selected current clean-QA/source/audio/driver/model-bound secondary CTC acoustic intervals. Technical timing only, no human acting or phonetic verdict.',
                            ctc_receipt_sha256=proposal['secondary_receipt_sha256'],CTC_binding=proposal['binding'],qa_report_sha256=qa_hash)
            qa.save(path,new);approvals[ident]=approval
        payload['approvals']=approvals;qa.save(approval_path,payload)
        report=primary_review.complete_report(run,manifest,manifest_hash,approvals,expected_count)
        qa.save(run/'word-cues'/'alignment.private.json',report)
        return report
    finally:lock.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',type=Path,required=True);parser.add_argument('--qa-report',type=Path,required=True)
    parser.add_argument('--only-ids',required=True);parser.add_argument('--apply',action='store_true');parser.add_argument('--reviewed-ids')
    parser.add_argument('--approval-file',type=Path);parser.add_argument('--expected-count',type=int,default=1557)
    args=parser.parse_args();run=args.run_dir.resolve()
    if not run.is_relative_to(common.PRIVATE.resolve()):parser.error('Run must be in private story bank')
    approval_path=args.approval_file.resolve()if args.approval_file else run/'word-cues'/'qualifications.private.json'
    if not approval_path.is_relative_to(run):parser.error('Approvals must remain inside run')
    selected=set(args.only_ids.split(','));reviewed=set(args.reviewed_ids.split(','))if args.reviewed_ids else set()
    if args.apply and(not reviewed or not reviewed<=selected):parser.error('--apply needs scoped --reviewed-ids subset of --only-ids')
    manifest_path=run/'lines.private.json';manifest=json.loads(manifest_path.read_text());mh=qa.digest(manifest_path)
    qp=args.qa_report.resolve();report=json.loads(qp.read_text());qh=qa.digest(qp)
    lines={line['id']:line for line in manifest['lines']}
    if not selected<=set(lines):parser.error('Unknown selected IDs')
    proposals={};models={}
    for ident in sorted(selected):
        path=run/'ctc-secondary'/(ident+'.secondary-ctc.private.json');dp=run/'word-cues'/(ident+'.json');mp3=run/'clips'/(ident+'.mp3')
        if not all(p.is_file()for p in[path,dp,mp3]):
            proposals[ident]={'id':ident,'status':'rejected','reason':'missing_actual_input'};continue
        actual=json.loads(path.read_text());dtw=json.loads(dp.read_text());model=actual.get('binding',{}).get('model',{})
        key=json.dumps(model,sort_keys=True)
        if key not in models:
            try:models[key]=secondary.model_identity(Path(model['local_directory']),model['revision'])
            except(ValueError,KeyError,OSError):models[key]=None
        identity=models[key]
        if identity!=model:
            proposals[ident]={'id':ident,'status':'rejected','reason':'secondary_actual_weights_or_scripts_changed'};continue
        row=review(lines[ident],qa.digest(mp3),mh,report,actual,dtw,identity)
        row['secondary_receipt_sha256']=qa.digest(path)
        dependencies=[path,dp,mp3,qp,manifest_path,Path(secondary.__file__),Path(secondary.parent.__file__)]
        row['input_hashes']={str(p):qa.digest(p)for p in dependencies}
        row['input_hashes'].update({str(Path(identity['local_directory'])/name):h for name,h in identity['file_sha256'].items()})
        proposals[ident]=row
    if qa.digest(qp)!=qh or qa.digest(manifest_path)!=mh:raise ValueError('Source/QA changed during proposals')
    qa.save(run/'ctc-secondary-review'/'proposals.private.json',{'method':VERSION,'requires_root_review':True,'proposals':proposals})
    if args.apply:
        result=apply_scoped(run,proposals,reviewed,approval_path,manifest,mh,qp,qh,args.expected_count)
        print(json.dumps({'status':result['status'],'aligned':len(result['alignment_by_id'])}))
    else:
        from collections import Counter
        print(json.dumps(dict(Counter(p['status']for p in proposals.values()))))


if __name__=='__main__':main()
