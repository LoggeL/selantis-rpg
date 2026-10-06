#!/usr/bin/env python3
"""Private whole-event waveform cues for one root-qualified nonlexical scream.

No phoneme/human-hearing claim, model timestamps, inference, API or audio changes.
Dry run is default. Applying explicit reviewed IDs archives original DTW evidence.
"""
from __future__ import annotations
import argparse
from array import array
import copy
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import time
import story_voice_qa as qa
import story_voice_word_cues as cues
import story_voice_ctc_align as ctc

ENGINE=cues.ENGINE+'/single-root-qualified-scream-waveform-v1'
RATE=16000
METHOD={'sample_rate':RATE,'frame_samples':160,'threshold':'max(0.002, 0.08*maximum_frame_RMS, 4*lower_quintile_median_RMS)',
        'minimum_sustained_frames':3,'maximum_bridge_frames':5,'boundary_padding_frames':1,
        'ambiguous_separated_activity':'reject','timing_kind':'whole_event_acoustic_envelope_not_phonemes'}


def measure(samples):
    if len(samples)<RATE*.05 or any(not math.isfinite(x) for x in samples):raise ValueError('empty_short_or_nonfinite_waveform')
    if max(abs(x) for x in samples)>1.2 or sum(abs(x)>=.999 for x in samples)/len(samples)>.001:raise ValueError('possible_clipping')
    rms=[math.sqrt(math.fsum(x*x for x in samples[i:i+160])/len(samples[i:i+160])) for i in range(0,len(samples),160)]
    low=sorted(rms)[:max(1,len(rms)//5)];noise=low[len(low)//2];threshold=max(.002,.08*max(rms),4*noise)
    active=[i for i,x in enumerate(rms) if x>=threshold]
    if not active:raise ValueError('silent_or_no_clear_activity')
    runs=[];a=previous=active[0]
    for i in active[1:]:
        if i-previous-1>5:runs.append((a,previous+1));a=i
        previous=i
    runs.append((a,previous+1))
    if len(runs)!=1:raise ValueError('ambiguous_separated_activity')
    first,last=runs[0]
    if not any(all(rms[i+j]>=threshold for j in range(3)) for i in range(first,max(first,last-2))):raise ValueError('no_sustained_activity')
    start=max(0,(first-1)*160/RATE);end=min(len(samples)/RATE,(last+1)*160/RATE)
    if not 0<=start<end<=len(samples)/RATE or end-start<.03:raise ValueError('invalid_event_bounds')
    return {'start':start,'end':end,'decoded_seconds':len(samples)/RATE,'threshold_rms':threshold,
            'noise_floor_rms':noise,'maximum_frame_rms':max(rms),'active_frame_count':len(active),
            'frame_range':[first,last],'method':METHOD,'timing_kind':'whole_event_acoustic_envelope_not_phonemes'}


def decode(path):
    result=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(path),'-f','f32le','-ar',str(RATE),'-ac','1','pipe:1'],capture_output=True,timeout=120)
    if result.returncode or not result.stdout or len(result.stdout)%4:raise ValueError('decode_failed')
    values=array('f');values.frombytes(result.stdout)
    if sys.byteorder!='little':values.byteswap()
    return values


def proof(run,line,paths):
    if not re.fullmatch(r'[Aa]{2,}[Hh]+[!?.,…]*',line['text']) or len(line['text'].split())!=1:raise ValueError('source_is_not_one_AAH_scream_token')
    clip=run/'clips'/(line['id']+'.mp3');sha=qa.digest(clip);manifest_hash=qa.digest(run/'lines.private.json')
    for path in paths.values():
        if not path.resolve().is_relative_to(run.resolve()):raise ValueError('proof_file_outside_frozen_run')
    report=json.loads(paths['qa_report'].read_text());records=json.loads(paths['vocal_report'].read_text()).get('records',[])
    if len({x['id'] for x in records})!=len(records):raise ValueError('duplicate_vocal_records')
    records={x['id']:x for x in records};approvals=json.loads(paths['vocal_adjudications'].read_text())
    if not ctc.clean_qa(line,sha,manifest_hash,report):raise ValueError('current_individually_clean_QA_required')
    record=records.get(line['id']);accepted=qa.vocal_review(line,sha,'',records,approvals)
    if not accepted or accepted['remaining_source_tokens'] or accepted['remaining_observed_tokens']:raise ValueError('current_root_vocal_event_proof_required')
    observation=qa.vocal_qc.response_observation(record['response'])
    if (len(observation['events'])!=1 or observation['events'][0]['category']!='scream'
        or observation['events'][0]['confidence']<.8
        or any(not re.fullmatch(r'a+h|ha',w) for w in qa.words(observation['transcript']))):raise ValueError('one_nonlexical_high_confidence_scream_required')
    return {'audio_sha256':sha,'text_sha256':qa.text_hash(line['text']),'source_manifest_sha256':manifest_hash,
            'proof_files':{k:{'file':str(p.resolve().relative_to(run.resolve())),'sha256':qa.digest(p)} for k,p in paths.items()},
            'vocal_record_sha256':qa.canonical_record_hash(record),'raw_response_sha256':qa.canonical_record_hash(record['response']),
            'vocal_adjudication_sha256':qa.canonical_record_hash(approvals[line['id']]),
            'driver_script_sha256':qa.digest(Path(__file__)),'word_cues_script_sha256':qa.digest(Path(cues.__file__)),'vocal_qa_script_sha256':qa.digest(Path(qa.__file__)),
            'vocal_qc_script_sha256':qa.digest(Path(qa.vocal_qc.__file__)),
            'accepted_vocal_proof':accepted,'event':observation['events'][0]}


def propose(run,line,paths,decode_fn=decode):
    binding=proof(run,line,paths);old_path=run/'word-cues'/(line['id']+'.json')
    old=json.loads(old_path.read_text())
    if old.get('id')!=line['id'] or old.get('text')!=line['text'] or old.get('audio_sha256')!=binding['audio_sha256'] or old.get('text_sha256')!=binding['text_sha256'] or old.get('source_manifest_sha256')!=binding['source_manifest_sha256']:
        raise ValueError('old_DTW_source_audio_binding_stale')
    if old.get('Vocal_event_adoption'):raise ValueError('already_adopted_event_cache')
    timing=measure(decode_fn(run/'clips'/(line['id']+'.mp3')))
    if qa.digest(run/'clips'/(line['id']+'.mp3'))!=binding['audio_sha256']:raise ValueError('audio_changed_during_measurement')
    return {'id':line['id'],'text':line['text'],'binding':binding,'measurement':timing,
            'old_DTW_file':str(old_path.relative_to(run)),'old_DTW_sha256':qa.digest(old_path),
            'word_cues':[{'start':timing['start'],'end':timing['end']}],
            'status':'root_review_required','approval':None,'engine_version':ENGINE,
            'original_DTW_flags':copy.deepcopy(old.get('all_qualification_flags',[])),
            'note':'One whole nonlexical event measured from waveform. No phoneme/human-hearing proof; original DTW flags retained.'}


def receipt_bytes_hash(value):
    encoded=(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n').encode('utf-8')
    return qa.text_hash(encoded.decode('utf-8'))


def recover_apply(run,proposal,paths,journal_path,decode_fn=decode):
    journal=json.loads(journal_path.read_text());plan=journal.get('plan',{})
    if journal.get('state') not in {'RECORDED_BEFORE_LIVE_WRITES','APPLIED_VALIDATED'}:
        raise ValueError('unknown_apply_journal_state')
    if journal.get('plan_sha256')!=qa.canonical_record_hash(plan) or plan.get('proposal')!=proposal:
        raise ValueError('apply_journal_proposal_or_hash_mismatch')
    ident=proposal['id'];receipt=plan['receipt'];approval=plan['approval']
    if (plan.get('id')!=ident or receipt.get('id')!=ident
        or receipt_bytes_hash(receipt)!=plan.get('receipt_sha256')
        or qa.canonical_record_hash(approval)!=plan.get('approval_sha256')):
        raise ValueError('apply_journal_target_mismatch')
    rows={x['id']:x for x in json.loads((run/'lines.private.json').read_text())['lines']}
    if proof(run,rows[ident],paths)!=proposal['binding']:
        raise ValueError('apply_journal_current_proof_changed')
    expected={k:proposal['binding'][k] for k in ['audio_sha256','text_sha256','source_manifest_sha256']}
    if not validate_cached_adoption(receipt,expected,approval,run,decode_fn=decode_fn):
        raise ValueError('apply_journal_archive_or_measurement_invalid')
    prior_document=json.loads((run/receipt['Vocal_event_adoption']['prior_qualifications_file']).read_text())
    if prior_document.get('approvals',{}).get(ident)!=plan.get('prior_target_approval'):
        raise ValueError('apply_journal_prior_approval_archive_mismatch')
    cue_dir=run/'word-cues';receipt_path=cue_dir/(ident+'.json');qualification_path=cue_dir/'qualifications.private.json'
    current_receipt_hash=qa.digest(receipt_path)
    if current_receipt_hash not in {proposal['old_DTW_sha256'],plan['receipt_sha256']}:
        raise ValueError('unknown_current_receipt_state_no_overwrite')
    qualifications=json.loads(qualification_path.read_text()) if qualification_path.exists() else {'approvals':{}}
    if not isinstance(qualifications.get('approvals'),dict):raise ValueError('invalid_current_approval_document')
    existing=qualifications['approvals'].get(ident)
    if existing not in [plan['prior_target_approval'],approval]:
        raise ValueError('unknown_current_target_approval_no_overwrite')
    if journal['state']=='APPLIED_VALIDATED' and (current_receipt_hash!=plan['receipt_sha256'] or existing!=approval):
        raise ValueError('completed_apply_state_changed_no_overwrite')
    if current_receipt_hash==proposal['old_DTW_sha256'] and existing==approval:
        raise ValueError('approval_ahead_of_receipt_unknown_state')
    # Recovery only traverses the recorded states; unrelated approvals survive.
    if current_receipt_hash!=plan['receipt_sha256']:qa.save(receipt_path,receipt)
    if existing!=approval:
        qualifications['approvals'][ident]=approval;qa.save(qualification_path,qualifications)
    if qa.digest(receipt_path)!=plan['receipt_sha256'] or json.loads(qualification_path.read_text())['approvals'].get(ident)!=approval:
        raise ValueError('apply_final_readback_mismatch')
    qa.save(journal_path,{'state':'APPLIED_VALIDATED','plan':plan,'plan_sha256':journal['plan_sha256']})
    return receipt


def apply(run,proposal,paths,decode_fn=decode):
    ident=proposal['id']
    if not cues.STORY_ID.fullmatch(ident):raise ValueError('invalid_apply_id')
    cue_dir=run/'word-cues';journal_path=cue_dir/'vocal-event-intents'/(ident+'.json')
    if journal_path.exists():return recover_apply(run,proposal,paths,journal_path,decode_fn)
    current_path=cue_dir/(ident+'.json');current=json.loads(current_path.read_text())
    qualification_path=cue_dir/'qualifications.private.json'
    qualifications=json.loads(qualification_path.read_text()) if qualification_path.exists() else {'approvals':{}}
    if current.get('Vocal_event_adoption'):
        expected={k:proposal['binding'][k] for k in ['audio_sha256','text_sha256','source_manifest_sha256']}
        if (current['Vocal_event_adoption'].get('proposal')==proposal
            and proof(run,{'id':ident,'text':proposal['text']},paths)==proposal['binding']
            and validate_cached_adoption(current,expected,qualifications.get('approvals',{}).get(ident,{}),run,decode_fn=decode_fn)):
            return current  # Fully validated identical prior adoption, no write.
        raise ValueError('unknown_already_adopted_state_no_overwrite')
    rows={x['id']:x for x in json.loads((run/'lines.private.json').read_text())['lines']}
    fresh=propose(run,rows[ident],paths,decode_fn)
    if fresh!=proposal:raise ValueError('reviewed_proposal_proof_or_measurement_changed')
    cue_dir=run/'word-cues';old_path=cue_dir/(ident+'.json');old=json.loads(old_path.read_text())
    qualification_path=cue_dir/'qualifications.private.json'
    qualifications=json.loads(qualification_path.read_text()) if qualification_path.exists() else {'approvals':{}}
    archive=cue_dir/'vocal-event-archive'/str(time.time_ns());archive.mkdir(parents=True)
    archived=archive/(ident+'.json');archived.write_bytes(old_path.read_bytes());archived.chmod(0o600)
    prior_path=archive/'prior-qualifications.private.json'
    if qualification_path.exists():prior_path.write_bytes(qualification_path.read_bytes());prior_path.chmod(0o600)
    else:qa.save(prior_path,qualifications)
    receipt=copy.deepcopy(old);binding=proposal['binding']
    receipt.update({k:binding[k] for k in ['audio_sha256','text_sha256','source_manifest_sha256']})
    receipt.update(engine_version=ENGINE,word_cues=proposal['word_cues'],decoded_seconds=proposal['measurement']['decoded_seconds'],
        authored_word_count=1,all_qualification_flags=copy.deepcopy(old.get('all_qualification_flags',[])))
    receipt['cues_sha256']=cues.acoustic.cue_sha(receipt['word_cues'])
    receipt['Vocal_event_adoption']={'proposal':proposal,'archive_file':str(archived.relative_to(run)),
        'archive_sha256':qa.digest(archived),'prior_qualifications_file':str((archive/'prior-qualifications.private.json').relative_to(run)),
        'prior_qualifications_sha256':qa.digest(archive/'prior-qualifications.private.json')}
    approval={k:receipt[k] for k in ['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256','engine_version']}
    approval.update(decision='reviewed',review_note='Root explicitly applied the reviewed single-scream whole-event waveform proposal; no phoneme/human-hearing claim.',
                    vocal_event_proposal_sha256=qa.canonical_record_hash(proposal))

    plan={'id':ident,'proposal':proposal,'receipt':receipt,'receipt_sha256':receipt_bytes_hash(receipt),
          'approval':approval,'approval_sha256':qa.canonical_record_hash(approval),
          'prior_target_approval':copy.deepcopy(qualifications.get('approvals',{}).get(ident))}
    # Archives and exact planned transition are durable before either live write.
    qa.save(journal_path,{'state':'RECORDED_BEFORE_LIVE_WRITES','plan':plan,'plan_sha256':qa.canonical_record_hash(plan)})
    return recover_apply(run,proposal,paths,journal_path,decode_fn)


def validate_cached_adoption(receipt,expected,approval,run,provenance_cache=None,decode_fn=decode):
    try:
        if receipt.get('engine_version')!=ENGINE or not cues.adjudicated(receipt,approval):return False
        if any(receipt.get(k)!=v for k,v in expected.items() if k!='engine_version'):return False
        adoption=receipt['Vocal_event_adoption'];proposal=adoption['proposal']
        if approval.get('vocal_event_proposal_sha256')!=qa.canonical_record_hash(proposal):return False
        for file_key,hash_key in [('archive_file','archive_sha256'),('prior_qualifications_file','prior_qualifications_sha256')]:
            path=(run/adoption[file_key]).resolve()
            if not path.is_relative_to(run.resolve()) or qa.digest(path)!=adoption[hash_key]:return False
        old=json.loads((run/adoption['archive_file']).read_text())
        if qa.digest(run/adoption['archive_file'])!=proposal['old_DTW_sha256']:return False
        rows={x['id']:x for x in json.loads((run/'lines.private.json').read_text())['lines']};line=rows[receipt['id']]
        if receipt.get('text')!=line['text'] or proposal.get('text')!=line['text']:return False
        paths={k:run/v['file'] for k,v in proposal['binding']['proof_files'].items()}
        if proof(run,line,paths)!=proposal['binding']:return False
        if measure(decode_fn(run/'clips'/(receipt['id']+'.mp3')))!=proposal['measurement']:return False
        if receipt['word_cues']!=proposal['word_cues'] or receipt['decoded_seconds']!=proposal['measurement']['decoded_seconds']:return False
        if receipt['cues_sha256']!=cues.acoustic.cue_sha(receipt['word_cues']):return False
        # Preserve every original flag and raw detail; acceptance is explicitly bound.
        for key in ['original_qualification_flags','qualification_flags','all_qualification_flags','words','raw_word_cues']:
            if receipt.get(key)!=old.get(key):return False
        cues.cue_words(receipt['text'],receipt['word_cues'],receipt['decoded_seconds'])
        return True
    except (KeyError,ValueError,TypeError,OSError,RuntimeError):return False


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',type=Path,required=True);parser.add_argument('--qa-report',type=Path,required=True)
    parser.add_argument('--vocal-report',type=Path,required=True);parser.add_argument('--vocal-adjudications',type=Path,required=True)
    parser.add_argument('--only-ids',required=True)
    actions=parser.add_mutually_exclusive_group()
    actions.add_argument('--dry-run',action='store_true',help='Write proposals only (default)')
    actions.add_argument('--apply',action='store_true',help='Apply only previously reviewed, unchanged proposals')
    parser.add_argument('--reviewed-proposals',type=Path)
    args=parser.parse_args();run=args.run_dir.resolve()
    if not run.is_relative_to(cues.story.PRIVATE.resolve()) or run==cues.story.PRIVATE.resolve():parser.error('Private frozen story run required')
    ids=args.only_ids.split(',')
    if not ids or len(set(ids))!=len(ids):parser.error('Explicit unique IDs required')
    if args.apply and not args.reviewed_proposals:parser.error('Apply requires previously reviewed proposal report')
    paths={k:getattr(args,k).resolve() for k in ['qa_report','vocal_report','vocal_adjudications']}
    cues.story.configure();cues.story.prepared(run)
    _lock=cues.story.run_lock(run/'word-cues')
    rows={x['id']:x for x in json.loads((run/'lines.private.json').read_text())['lines']}
    if not set(ids)<=set(rows):parser.error('Unknown source IDs')
    review=json.loads(args.reviewed_proposals.read_text()) if args.reviewed_proposals else {}
    reviewed={x['id']:x for x in review.get('proposals',[])}
    output={'status':'dry_run_proposals_only','proposals':[],'rejections':[],'model_timestamps_used':False}
    for ident in ids:
        try:
            if args.apply:
                proposal=reviewed.get(ident)
                if not isinstance(proposal,dict):raise ValueError('explicit_reviewed_proposal_required')
                apply(run,proposal,paths)
            else:
                proposal=propose(run,rows[ident],paths)
            output['proposals'].append(proposal)
        except (ValueError,KeyError,TypeError,OSError) as error:output['rejections'].append({'id':ident,'reason':str(error) if isinstance(error,ValueError) else type(error).__name__})
    if args.apply:output['status']='applied_explicit_reviewed_ids' if not output['rejections'] else 'partial_rejection'
    qa.save(run/'word-cues'/'vocal-event-proposals.private.json',output)
    print(json.dumps({'status':output['status'],'proposed':len(output['proposals']),'rejected':len(output['rejections'])}))
    return 1 if output['rejections'] else 0


if __name__=='__main__':raise SystemExit(main())
