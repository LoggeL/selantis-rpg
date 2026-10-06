#!/usr/bin/env python3
"""Additive offline word qualification, preserving decoder and signal evidence."""
import argparse
import copy
import json
import math
from pathlib import Path
import sys
import story_voice_common as common
from story_voice_common import core
import story_voice_qa as qa
import story_voice_ctc_lexical_variants as lexical
import story_voice_specialist_asr as specialist
import story_voice_pro_asr as pro
import story_voice_complementary_names as complementary
import story_voice_orthographic_segments as orthographic
import story_voice_expressive_events as expressive
import story_voice_meta_name_evidence as meta_name
import story_voice_native625_evidence as native625
import story_voice_a681_evidence as a681
import story_voice_meta_foltan_cases as foltan_cases

REMOVABLE={'asr_lexical_mismatch_requires_review','asr_check_failed_ValueError'}
LEXICAL_ONLY={'asr_lexical_mismatch_requires_review'}

def require(condition,message):
    if not condition:raise core.SafeError(message)

def indexed(values,ids,label):
    require(isinstance(values,list) and all(isinstance(x,dict) and x.get('id') in ids for x in values),label+' contains unknown IDs.')
    result={x['id']:x for x in values};require(len(result)==len(values),label+' contains duplicate IDs.');return result

def unique_approval_json(path):
    def unique(pairs):
        result={}
        for key,value in pairs:
            require(key not in result,'Duplicate Pro approval JSON key.');result[key]=value
        return result
    with path.open(encoding='utf-8') as stream:body=json.load(stream,object_pairs_hook=unique)
    require(isinstance(body,dict),'Approvals must be a private mapping.')
    return body

def load_pro_approvals(path):
    body=unique_approval_json(path)
    result=body.get('approvals',body)
    require(isinstance(result,dict) and all(isinstance(v,dict) and v.get('id')==k for k,v in result.items()),'Pro approval ID mapping invalid.')
    return result


def pro_variant_template(run,line,audio_sha,record):
    require(record.get('source_run')==str(run) and pro.cached_record(record,audio_sha,qa.text_hash(line['text'])),'Current raw Pro provenance required for word variants.')
    transcript=pro.response_transcript(record['response']);expected,observed=qa.words(line['text']),qa.words(transcript)
    require(len(expected)==len(observed),'Pro variants cannot insert, drop or reorder tokens.')
    variants=[]
    for index,(aa,bb) in enumerate(zip(expected,observed)):
        if aa==bb:continue
        kind='named_spelling' if qa.named_spelling_equivalent(aa,bb) else 'natural_schwa' if qa.natural_variant_allowed(line,index,aa,bb) else None
        if (line['id']=='story-566e96b3e7093edace832a22'
            and line['text']=='Und deins ist Rumsitzen? Pass auf, sonst kitzle ich dich gleich noch mal.'
            and index==7 and (aa,bb)==('kitzle','kitzel')
            and len(expected)==13
            and observed==expected[:7]+['kitzel']+expected[8:]):
            kind='colloquial_first_person_kitzeln'
        require(kind is not None,'Pro substitution is outside the existing explicit spelling/schwa rules.')
        variants.append({'word_index':index,'expected':aa,'observed':bb,'kind':kind})
    require(variants,'Exact Pro matches need no variant approval.')
    return {'id':line['id'],'status':'root_review_required','reviewed_by':'','reason':'','model':pro.MODEL,'contract':pro.metadata(),
        'clip_sha256':audio_sha,'source_text_sha256':qa.text_hash(line['text']),'source_manifest_sha256':qa.digest(run/'lines.private.json'),
        'record_sha256':pro.object_hash(record),'raw_response_sha256':pro.object_hash(record['response']),
        'transcript_sha256':qa.text_hash(transcript),'scope_sha256':record['scope_sha256'],
        'pro_driver_sha256':qa.digest(Path(pro.__file__)),'qa_driver_sha256':qa.digest(Path(qa.__file__)),
        'expected_tokens':expected,'observed_tokens':observed,'variants':variants,'listening_verdict':None}


def pro_word_proof(run,line,audio_sha,record,approval=None):
    require(record.get('source_run')==str(run),'Pro comparison belongs to a different source run.')
    require(pro.cached_record(record,audio_sha,qa.text_hash(line['text'])),'Pro raw model/request/source/response/journal provenance is invalid or stale.')
    transcript=pro.response_transcript(record['response'])
    expected,observed=qa.words(line['text']),qa.words(transcript)
    adopted=None
    if expected!=observed:
        if approval is None:return None
        template=pro_variant_template(run,line,audio_sha,record)
        require(set(approval)==set(template) and approval.get('status')=='approved_pro_word_variants'
            and isinstance(approval.get('reviewed_by'),str) and approval['reviewed_by'].casefold().startswith('root')
            and isinstance(approval.get('reason'),str) and bool(approval['reason'].strip()),'Explicit complete root Pro word-variant approval required.')
        require(all(approval.get(k)==v for k,v in template.items() if k not in {'status','reviewed_by','reason'}),'Pro word-variant approval pairs/source/raw provenance differ.')
        require(all(type(pair.get('word_index')) is int for pair in approval['variants']),'Pro variant word positions must be integers.')
        adopted=copy.deepcopy(approval)
    else:require(approval is None,'Unexpected variant approval for an already exact Pro response.')
    evidence={}
    for name in [record['batch_scope_file'],record['batch_response_file']]:evidence[name]=qa.digest(pro.private_path(run,name))
    batch=pro.private_path(run,record['batch_scope_file']).parent
    for name in ['prepared.json','audio-snapshot.private.json','requests.jsonl','submit-intent.private.json','job.json']:
        evidence[str((batch/name).relative_to(run))]=qa.digest(batch/name)
    ledger=run/pro.FOLDER/'batch-reservations.private.json';evidence[str(ledger.relative_to(run))]=qa.digest(ledger)
    return {'id':line['id'],'resolution':'root_approved_pro_explicit_full_word_variants' if adopted else 'pro_unprompted_verbatim_full_exact_words','model':pro.MODEL,
        'contract':pro.metadata(),'expected_tokens':expected,'observed_tokens':observed,
        'clip_sha256':audio_sha,'source_text_sha256':qa.text_hash(line['text']),
        'record_sha256':pro.object_hash(record),'raw_response_sha256':pro.object_hash(record['response']),
        'request_sha256':record['request_sha256'],'provenance_files_sha256':evidence,
        **({'approval':adopted} if adopted else {}),'provider_timestamps_used':False,'acting_approval':None,'listening_verdict':None}


def expressive_record_mapping(payload,approvals,ids,pff_response=None):
    if 'binding' not in payload:indexed(payload.get('records'),ids,'Vocal records')
    mapping=expressive.comparison_records(payload,pff_response)
    require(not (pff_response is not None) or expressive.pff.ID in approvals,'Separate Pff evidence requires an explicit Pff root approval.')
    require(expressive.pff.ID not in approvals or expressive.pff.ID in mapping,'Pff approval requires original direct --pff-qc-response; stale standard Pff cache cannot qualify.')
    require('binding' not in payload or set(approvals)=={expressive.pff.ID},'Direct Pff-only comparison cannot qualify other source IDs.')
    return mapping


def scoped_root_envelope(run,path,keys,ident,rows,input_hashes):
    envelope=unique_approval_json(path)
    require(set(envelope)=={'bindings','approval'} and isinstance(envelope['bindings'],dict)
        and set(envelope['bindings'])==keys,'Complete scoped bindings/approval envelope required.')
    approval=envelope['approval']
    require(ident in rows and isinstance(approval,dict) and approval.get('id')==ident
        and isinstance(approval.get('reviewed_by'),str) and approval['reviewed_by'].casefold().startswith('root'),
        'Explicit single-case root approval required.')
    bindings={}
    for key,value in envelope['bindings'].items():
        require(isinstance(value,str) and bool(value),'Evidence binding must be a private path.')
        p=Path(value);p=(p if p.is_absolute() else run/p).resolve()
        require(p.is_relative_to(run) and p.is_file(),'Bound root evidence must stay inside the private run.')
        bindings[key]=str(p);input_hashes[str(p.relative_to(run))]=qa.digest(p)
    return bindings,approval


def meta_name_root_proof(run,line,base_path,audio_sha,bindings,approval):
    require(Path(bindings['qa_report_path']).resolve()==base_path.resolve(),'Meta name proof must use this exact current base QA.')
    # The helper validates every independent full-body/raw-frame binding. The
    # adapter also fixes the authored case and current output identity.
    meta_name.body(line,meta_name.TEXT.replace('Foltan','Voltan'),'voltan')
    proof=meta_name.review(run,line,bindings,approval)
    require(isinstance(proof,dict) and proof.get('id')==line['id'] and proof.get('method')==meta_name.VERSION
        and proof.get('clip_sha256')==audio_sha and proof.get('source_text_sha256')==qa.text_hash(line['text']),
        'Actual current root-reviewed Meta full-body proof required.')
    require(proof.get('proof',{}).get('source_row')==line,'Meta proof must retain the complete current source row.')
    return proof


def native625_root_proof(run,line,base_path,audio_sha,bindings,approval):
    require(line.get('id')==native625.ID and line.get('text')==native625.SOURCE and line.get('speaker')=='azar',
        'Native625 proof requires the exact current authored case.')
    document=unique_approval_json(Path(bindings['native625_document_path']))
    require(document.get('root_approval')==approval,'Envelope approval must equal the actual Native625 document approval.')
    evidence=document.get('evidence',{})
    require(evidence.get('id')==line['id'] and evidence.get('source')==line['text']
        and evidence.get('audio_sha256')==audio_sha and evidence.get('source_text_sha256')==qa.text_hash(line['text']),
        'Native625 current full source/audio binding differs.')
    files=evidence.get('files');require(isinstance(files,dict) and bool(files),'Complete native child provenance required.')
    for record in files.values():
        require(isinstance(record,dict) and isinstance(record.get('path'),str),'Invalid native provenance path.')
        p=Path(record['path']).resolve()
        require(p.is_relative_to(run) and p.is_file() and qa.digest(p)==record.get('sha256'),
            'Native child inputs must remain current and inside the private run.')
    observation=native625.validate(run,document)
    require(isinstance(observation,dict) and observation.get('id')==line['id'] and observation.get('audio_sha256')==audio_sha
        and observation.get('evidence_sha256')==document.get('evidence_sha256'),'Actual Native625 validation required.')
    journal=Path(observation['import_journal_path']).resolve()
    require(journal.is_relative_to(run) and journal.is_file() and qa.digest(journal)==observation['import_journal_sha256'],
        'Native625 actual scoped import journal must remain inside the private run.')
    return {'id':line['id'],'method':native625.CONTRACT,'resolution':'root_approved_native625_source_word_evidence',
        'clip_sha256':audio_sha,'source_text_sha256':qa.text_hash(line['text']),'source_row':copy.deepcopy(line),
        'base_qa_file':str(base_path.resolve().relative_to(run)),'base_qa_sha256':qa.digest(base_path),
        'proof':copy.deepcopy(document),'actual_validated_observation':observation,
        'helper_script_sha256':qa.digest(Path(native625.__file__)),
        'provenance_files_sha256':{**{record['path']:record['sha256'] for record in files.values()},str(journal):observation['import_journal_sha256']},
        'protected_script_sha256':{**{str(Path(m.__file__).resolve()):qa.digest(Path(m.__file__)) for m in [qa,common,core,native625.qc]},
            str(Path(native625.__file__).with_name('story_voice_ctc_align.py').resolve()):qa.digest(Path(native625.__file__).with_name('story_voice_ctc_align.py'))},
        'provider_timestamps_used':False,'timing_approval':None,'acting_approval':None,'listening_verdict':None}


def a681_root_proof(run,line,base_path,audio_sha,bindings,approval):
    require(Path(bindings['qa_report_path']).resolve()==base_path.resolve(),'A681 proof must use this exact current base QA.')
    a681.words(line,a681.TEXT.replace('Mmh','Mhh').replace('hab ich','habe ich'),True)
    proof=a681.review(run,line,bindings,approval)
    require(isinstance(proof,dict) and proof.get('id')==line['id'] and proof.get('method')==a681.VERSION
        and proof.get('clip_sha256')==audio_sha and proof.get('source_text_sha256')==qa.text_hash(line['text'])
        and proof.get('proof',{}).get('source_row')==line,'Actual complete current root-reviewed A681 proof required.')
    return proof



def foltan_cases_root_proof(run,line,base_path,audio_sha,bindings,approval):
    require(Path(bindings['qa_report_path']).resolve()==base_path.resolve(),'Foltan case proof must use exact current base QA.')
    foltan_cases.case(line)
    proof=foltan_cases.review(run,line,bindings,approval)
    require(isinstance(proof,dict) and proof.get('id')==line['id'] and proof.get('method')==foltan_cases.VERSION
        and proof.get('clip_sha256')==audio_sha and proof.get('source_text_sha256')==qa.text_hash(line['text'])
        and proof.get('proof',{}).get('source_row')==line,'Actual individual native/full-body proof required.')
    return proof


def foltan_cases_envelopes(run,path,rows,input_hashes):
    payload=unique_approval_json(path)
    require(set(payload)=={'records'} and isinstance(payload['records'],list) and 0<len(payload['records'])<=2,
        'Explicit one/two Foltan root envelope records required.')
    result={}
    for envelope in payload['records']:
        require(isinstance(envelope,dict) and set(envelope)=={'bindings','approval'},'Complete Foltan bindings/approval required.')
        approval=envelope['approval'];bindings=envelope['bindings']
        require(isinstance(approval,dict) and approval.get('id') in foltan_cases.CASES
            and approval['id'] not in result and isinstance(bindings,dict) and set(bindings)==foltan_cases.KEYS,
            'Duplicate/unsupported Foltan source or missing raw binding.')
        ident=approval['id'];require(ident in rows,'Foltan source absent from current inventory.');foltan_cases.case(rows[ident])
        paths={}
        for key,value in bindings.items():
            require(isinstance(value,str) and bool(value),'Foltan evidence path required.')
            p=Path(value);p=(p if p.is_absolute() else run/p).resolve()
            require(p.is_relative_to(run) and p.is_file(),'Foltan inputs must stay inside private run.')
            paths[key]=str(p);input_hashes[str(p.relative_to(run))]=qa.digest(p)
        result[ident]=(foltan_cases,paths,approval)
    return result

def scoped_proof_function(module):
    return {meta_name:meta_name_root_proof,native625:native625_root_proof,a681:a681_root_proof,foltan_cases:foltan_cases_root_proof}[module]


def scoped_proof_method(module):
    return native625.CONTRACT if module is native625 else module.VERSION


def recheck_scoped_proof_files(module,proof):
    template=proof if module is native625 else proof['proof']
    require(qa.digest(Path(module.__file__))==template['helper_script_sha256'],'Scoped word helper changed before write.')
    for key in ['protected_script_sha256','provenance_files_sha256']:
        files=template.get(key,{})
        require(isinstance(files,dict) and all(isinstance(p,str) and isinstance(h,str) and qa.digest(Path(p))==h for p,h in files.items()),
            'Scoped raw/helper/protected evidence changed before write.')


def finalize(run,base_path,output_path,specialist_path=None,ctc_path=None,approvals_path=None,veto_path=None,expected_count=1557,pro_path=None,pro_approvals_path=None,complementary_approvals_path=None,complementary_ctc_path=None,flash_path=None,complementary_qa_path=None,orthographic_approvals_path=None,orthographic_qa_path=None,expressive_approvals_path=None,expressive_qa_path=None,vocal_path=None,pff_qc_path=None,meta_name_root_evidence_path=None,native625_root_evidence_path=None,a681_root_evidence_path=None,meta_foltan_cases_root_evidence_path=None):
    run=run.resolve();common.prepared(run)
    scoped_driver_hashes={str(Path(m.__file__).resolve()):qa.digest(Path(m.__file__)) for m in [sys.modules[__name__],qa,common,core,*([meta_name] if meta_name_root_evidence_path else []),*([native625,native625.qc] if native625_root_evidence_path else []),*([a681] if a681_root_evidence_path else []),*([foltan_cases,foltan_cases.native] if meta_foltan_cases_root_evidence_path else [])]} if meta_name_root_evidence_path or native625_root_evidence_path or a681_root_evidence_path or meta_foltan_cases_root_evidence_path else {}
    if native625_root_evidence_path:
        driver=Path(native625.__file__).with_name('story_voice_ctc_align.py').resolve();scoped_driver_hashes[str(driver)]=qa.digest(driver)
    if a681_root_evidence_path:scoped_driver_hashes.update(a681.protected_scripts())
    inputs=[base_path,*[p for p in [specialist_path,ctc_path,approvals_path,veto_path,pro_path,pro_approvals_path,complementary_approvals_path,complementary_ctc_path,flash_path,complementary_qa_path,orthographic_approvals_path,orthographic_qa_path,expressive_approvals_path,expressive_qa_path,vocal_path,pff_qc_path,meta_name_root_evidence_path,native625_root_evidence_path,a681_root_evidence_path,meta_foltan_cases_root_evidence_path] if p]]
    require(not output_path.exists() and output_path.resolve() not in {p.resolve() for p in inputs},'Choose a new private final report, never overwrite evidence.')
    require(output_path.resolve().is_relative_to(run) and all(p.resolve().is_relative_to(run) for p in inputs),'Reports must stay within the frozen private run.')
    complementary_requested=any([complementary_approvals_path,complementary_ctc_path,complementary_qa_path])
    require(not complementary_requested or all([complementary_approvals_path,complementary_ctc_path,flash_path,complementary_qa_path,pro_path,veto_path]),'Complementary proof requires root approvals, separate QA, CTC, Flash, Pro and root-veto reports.')
    orthographic_requested=any([orthographic_approvals_path,orthographic_qa_path])
    require(not orthographic_requested or all([orthographic_approvals_path,orthographic_qa_path,flash_path,pro_path]),'Orthographic proof requires root approvals, separate current QA and actual Flash/Pro comparisons.')
    require(flash_path is None or complementary_requested or orthographic_requested,'Flash comparison needs a scoped complementary or orthographic proof.')
    expressive_requested=any([expressive_approvals_path,expressive_qa_path,vocal_path,pff_qc_path])
    require(not expressive_requested or all([expressive_approvals_path,expressive_qa_path,vocal_path]),'Expressive proof requires explicit root approvals, current physical QA and actual vocal comparison.')
    input_hashes={str(p.resolve().relative_to(run)):qa.digest(p) for p in inputs}
    manifest=core.read_json(run/'lines.private.json');manifest_sha=qa.digest(run/'lines.private.json');rows={r['id']:r for r in manifest['lines']};ids=set(rows)
    require(len(ids)==len(manifest['lines'])==expected_count,'Frozen inventory coverage differs.')
    base=core.read_json(base_path)
    require(base.get('version')==qa.VERSION and (base.get('model')==qa.MODEL or str(base.get('model','')).startswith(qa.MODEL+':')),'Wrong base QA decoder/version.')
    require(base.get('manifest_sha256')==manifest_sha,'Stale base QA source manifest.')
    require(isinstance(base.get('checked_ids'),list) and len(base['checked_ids'])==len(set(base['checked_ids']))==len(ids) and set(base['checked_ids'])==ids,'Base QA coverage is incomplete or duplicated.')
    takes=indexed(base.get('takes'),ids,'Base QA takes');require(set(takes)==ids and set(base.get('clip_sha256',{}))==ids,'Base QA cardinality differs.')
    audio={i:qa.digest(run/'clips'/(i+'.mp3')) for i in ids}
    require(base['clip_sha256']==audio,'Base QA audio hashes are stale.')
    requests={r['key']:r['request'] for r in [json.loads(s) for s in (run/'requests.jsonl').read_text().splitlines() if s.strip()]}
    receipts={};legacy_batch_provenance={}
    for ident in ids:
        path=run/'raw'/(ident+'.receipt.json');receipt=core.read_json(path)
        require(receipt.get('status')=='complete' and receipt.get('mp3_sha256')==audio[ident],'Current TTS receipt/audio binding differs.')
        raw_model=receipt.get('model');legacy='model' not in receipt
        if legacy:
            require(receipt.get('backend')=='batch' and 'delivery_override' not in receipt and receipt.get('request_sha256')==core.digest(json.dumps(requests[ident],sort_keys=True).encode()),'Missing model requires an unchanged original frozen Batch request receipt.')
            require(receipt.get('wav_sha256')==qa.digest(run/'raw'/(ident+'.wav')),'Legacy original Batch WAV hash differs.')
            if not legacy_batch_provenance:
                job=core.read_json(run/'job.json');status=core.read_json(run/'status.private.json')
                require(job.get('model')==core.MODEL and job.get('request_count')==expected_count and status.get('metadata',{}).get('model','').removeprefix('models/')==core.MODEL,'Legacy Batch provider/frozen model provenance differs.')
                legacy_batch_provenance={name:qa.digest(run/name) for name in ['job.json','status.private.json','prepared.json','requests.jsonl']}
        else:require(raw_model==core.MODEL,'Current TTS receipt model differs.')
        receipts[ident]={'sha256':qa.digest(path),'model':raw_model,'effective_model':core.MODEL,'model_provenance':'frozen_original_batch_and_provider_metadata' if legacy else 'explicit_receipt','wav_sha256_verified':receipt.get('wav_sha256') if legacy else None,'backend':receipt.get('backend'),'actual_request_sha256':receipt.get('request_sha256'),'source_tts_request_sha256':receipt.get('source_tts_request_sha256')}
    failures=base.get('failures');require(isinstance(failures,list) and all(isinstance(f,dict) and f.get('id') in ids|{None} and isinstance(f.get('reason'),str) for f in failures),'Malformed base QA failures.')
    for ident,take in takes.items():
        require(take.get('text_sha256')==qa.text_hash(rows[ident]['text']) and isinstance(take.get('reasons'),list) and all(isinstance(r,str) for r in take['reasons']),'Base take source/reasons invalid.')
        require(all(any(f.get('id')==ident and f['reason']==r for f in failures) for r in take['reasons']),'Base take reason missing from failure ledger.')
        require(isinstance(take.get('signal'),dict),'Base take lacks full signal evidence.')
        require(type(take['signal'].get('silent')) is bool and all(isinstance(take['signal'].get(k),(int,float)) and not isinstance(take['signal'].get(k),bool) and math.isfinite(take['signal'][k]) for k in ['seconds','clipped_fraction','peak','trailing_silence_seconds','leading_silence_seconds','last_frame_rms','rms']),'Base signal metrics invalid.')
        signal_reasons=qa.signal_failures(take['signal'],len(qa.words(rows[ident]['text'])))
        require(set(signal_reasons)<=set(take['reasons']),'Base signal failures were omitted.')
    specialists=indexed(core.read_json(specialist_path).get('records'),ids,'Specialist records') if specialist_path else {}
    pro_records=indexed(core.read_json(pro_path).get('records'),ids,'Pro records') if pro_path else {}
    pro_approvals=load_pro_approvals(pro_approvals_path) if pro_approvals_path else {}
    require(not pro_approvals_path or pro_path is not None,'Pro root approvals require actual Pro comparison.')
    require(set(pro_approvals)<=set(pro_records),'Pro approvals outside supplied current Pro records.')
    if ctc_path:
        require(approvals_path is not None,'CTC variants require explicit root approvals.')
        loader=output_path.parent/(output_path.stem+'.ctc-loader');require(not loader.exists(),'CTC loader directory exists; use a fresh final report.');loader.mkdir(parents=True)
        ctc=lexical.load_records(ctc_path,loader);approvals=core.read_json(approvals_path).get('approvals',{})
        require(isinstance(approvals,dict) and set(approvals)<=ids and set(ctc)<=ids,'Unknown CTC approval/record ID.')
    else:require(approvals_path is None,'CTC approvals require their bound report.');ctc={};approvals={}
    veto=qa.load_lexical_veto_records(veto_path) if veto_path else {};require(set(veto)<=ids,'Unknown root veto ID.')
    complementary_bindings={};complementary_approvals={}
    if complementary_requested:
        # Accept an approval map or the original proposal envelope, but the
        # helper itself requires explicit root-adopted status on every case.
        envelope=unique_approval_json(complementary_approvals_path)
        require(isinstance(envelope,dict),'Invalid complementary root approval envelope.')
        complementary_approvals=envelope.get('approvals',envelope.get('proposals',envelope))
        require(isinstance(complementary_approvals,dict) and bool(complementary_approvals) and set(complementary_approvals)<=set(complementary.CASES)&ids,'Complementary approvals exceed the fixed two cases.')
        flash_records=indexed(core.read_json(flash_path).get('records'),ids,'Flash records')
        require(set(complementary_approvals)<=set(flash_records)&set(pro_records),'Complementary actual raw comparison records missing.')
        loader=output_path.parent/(output_path.stem+'.complementary-ctc-loader');require(not loader.exists(),'Use a fresh complementary loader namespace.');loader.mkdir(parents=True)
        complementary_ctc=lexical.load_records(complementary_ctc_path,loader)
        require(set(complementary_approvals)<=set(complementary_ctc),'Complementary free CTC evidence missing.')
        for ident in complementary_approvals:
            complementary_bindings[ident]={'flash_record':flash_records[ident],'pro_record':pro_records[ident],
                'ctc_envelope':complementary_ctc[ident],'qa_report_path':complementary_qa_path.resolve(),'root_veto_report_path':veto_path.resolve()}
    orthographic_bindings={};orthographic_approvals={}
    if orthographic_requested:
        envelope=unique_approval_json(orthographic_approvals_path)
        orthographic_approvals=envelope.get('approvals',envelope.get('proposals',envelope))
        require(isinstance(orthographic_approvals,dict) and bool(orthographic_approvals) and set(orthographic_approvals)<=set(orthographic.CASES)&ids,'Orthographic approvals exceed three fixed source cases.')
        flash_records=indexed(core.read_json(flash_path).get('records'),ids,'Flash records')
        for ident in orthographic_approvals:
            channels=orthographic.CASES[ident]['channels'];mapping={'Flash':flash_records,'Pro':pro_records}
            require(all(ident in mapping[ch] for ch in channels),'Actual scoped orthographic raw records missing.')
            orthographic_bindings[ident]={ch:mapping[ch][ident] for ch in channels}
    expressive_records={};expressive_approvals={}
    if expressive_requested:
        envelope=unique_approval_json(expressive_approvals_path)
        expressive_approvals=envelope.get('approvals',envelope.get('proposals',envelope))
        require(isinstance(expressive_approvals,dict) and bool(expressive_approvals) and set(expressive_approvals)<=set(expressive.CASES)&ids,'Expressive approvals exceed three fixed source cases.')
        vocal_payload=core.read_json(vocal_path)
        expressive_records=expressive_record_mapping(vocal_payload,expressive_approvals,ids,core.read_json(pff_qc_path) if pff_qc_path else None)
        require(set(expressive_approvals)<=set(expressive_records),'Actual expressive raw records missing.')
    scoped={}
    if meta_name_root_evidence_path:
        bindings,approval=scoped_root_envelope(run,meta_name_root_evidence_path,meta_name.KEYS,meta_name.ID,rows,input_hashes)
        scoped[meta_name.ID]=(meta_name,bindings,approval)
    if native625_root_evidence_path:
        bindings,approval=scoped_root_envelope(run,native625_root_evidence_path,{'native625_document_path'},native625.ID,rows,input_hashes)
        scoped[native625.ID]=(native625,bindings,approval)
    if a681_root_evidence_path:
        bindings,approval=scoped_root_envelope(run,a681_root_evidence_path,a681.KEYS,a681.ID,rows,input_hashes)
        scoped[a681.ID]=(a681,bindings,approval)
    if meta_foltan_cases_root_evidence_path:
        scoped.update(foltan_cases_envelopes(run,meta_foltan_cases_root_evidence_path,rows,input_hashes))
    result=copy.deepcopy(base);result['base_decoder_evidence']={'file':str(base_path.resolve().relative_to(run)),'sha256':input_hashes[str(base_path.resolve().relative_to(run))],'version':base['version'],'model':base['model']}
    removed={};extra_failures=[]
    for take in result['takes']:
        ident=take['id'];line=rows[ident];proofs=[]
        if ident in ctc:
            proof=lexical.review(line,audio[ident],manifest_sha,ctc,approvals)
            if proof:proofs.append(proof)
        if ident in specialists:
            proof=specialist.exact_text_match_proof(run,specialists[ident])
            if proof:proofs.append(proof)
        if ident in pro_records:
            proof=pro_word_proof(run,line,audio[ident],pro_records[ident],pro_approvals.get(ident))
            if proof:proofs.append(proof)
        if ident in complementary_approvals:
            proof=complementary.review(run,line,complementary_bindings[ident],complementary_approvals[ident])
            require(proof is not None,'Explicit adopted complementary proof required.')
            proofs.append(proof)
        if ident in orthographic_approvals:
            proof=orthographic.review(run,line,orthographic_qa_path,orthographic_bindings[ident],orthographic_approvals[ident])
            require(proof is not None,'Explicit root-adopted orthographic proof required.');proofs.append(proof)
        if ident in expressive_approvals:
            proof=expressive.review(run,line,expressive_qa_path,expressive_records[ident],expressive_approvals[ident])
            require(proof is not None,'Explicit root-adopted expressive proof required.');proofs.append(proof)
        legacy_word_proof=any(p.get('method')!=expressive.VERSION for p in proofs)
        if ident in scoped:
            module,bindings,approval=scoped[ident]
            proof=scoped_proof_function(module)(run,line,base_path,audio[ident],bindings,approval)
            proofs.append(proof)
        if proofs:
            take['extra_word_proof']=proofs;take['original_decoder_reasons']=copy.deepcopy(take['reasons']);take['original_decoder_transcript']=copy.deepcopy(take.get('transcript'))
            removable=set(take['reasons'])&(REMOVABLE if legacy_word_proof else LEXICAL_ONLY);take['reasons']=[r for r in take['reasons'] if r not in removable];removed[ident]=removable
        diagnosis=qa.lexical_veto_review(run,line,audio[ident],veto)
        if diagnosis:
            take['finalizer_lexical_veto_diagnosis']=diagnosis
            reason='independent_audio_word_defect' if diagnosis.get('applicable') else 'lexical_veto_binding_requires_review' if diagnosis.get('binding_requires_review') else None
            if reason:
                if reason not in take['reasons']:take['reasons'].append(reason)
                extra_failures.append({'id':ident,'reason':reason})
    result['failures']=[copy.deepcopy(f) for f in failures if f['reason'] not in removed.get(f.get('id'),set())]
    for f in extra_failures:
        if f not in result['failures']:result['failures'].append(f)
    result['status']='passed' if not result['failures'] and all(not t['reasons'] for t in result['takes']) else 'review_required'
    result['finalizer']={'method':'additive-full-word-qualification-v1','script_sha256':qa.digest(Path(__file__)),'input_files_sha256':input_hashes,'manifest_sha256':manifest_sha,'clip_sha256':audio,'removed_reasons':{i:sorted(rs) for i,rs in removed.items()},'legacy_batch_provenance_sha256':legacy_batch_provenance,'current_tts_receipts':receipts,'proof_driver_sha256':{Path(module.__file__).name:qa.digest(Path(module.__file__)) for module in [qa,lexical,specialist,pro,complementary,orthographic,expressive]},'signal_decoder_unchanged':True,'acting_approval':None,'listening_verdict':None}
    common.prepared(run)
    require(qa.digest(run/'lines.private.json')==manifest_sha and all(qa.digest(run/'clips'/(i+'.mp3'))==h for i,h in audio.items()),'Source/audio changed during final qualification.')
    require(all(qa.digest(run/name)==h for name,h in legacy_batch_provenance.items()),'Legacy provider provenance changed during qualification.')
    require(all(not r['wav_sha256_verified'] or qa.digest(run/'raw'/(i+'.wav'))==r['wav_sha256_verified'] for i,r in receipts.items()),'Legacy WAV changed during qualification.')
    require(all(qa.digest(run/'raw'/(i+'.receipt.json'))==r['sha256'] for i,r in receipts.items()),'Current TTS receipts changed during final qualification.')
    require(all(qa.digest(run/name)==h for take in result['takes'] for proof in take.get('extra_word_proof',[]) for name,h in proof.get('provenance_files_sha256',{}).items()),'Pro raw provenance changed during final qualification.')
    for ident,bindings in complementary_bindings.items():
        repeated=complementary.review(run,rows[ident],bindings,complementary_approvals[ident])
        stored=next(proof for take in result['takes'] if take['id']==ident for proof in take.get('extra_word_proof',[]) if proof.get('method')==complementary.VERSION)
        require(repeated==stored,'Complementary source/model/frame/root proof changed before write.')
        require(all(qa.digest(Path(complementary.__file__).parent/name)==h for name,h in stored['proof_drivers_sha256'].items()),'Complementary proof driver changed before write.')
    for ident,records in orthographic_bindings.items():
        repeated=orthographic.review(run,rows[ident],orthographic_qa_path,records,orthographic_approvals[ident])
        stored=next(p for take in result['takes'] if take['id']==ident for p in take.get('extra_word_proof',[]) if p.get('method')==orthographic.VERSION)
        require(repeated==stored and qa.digest(Path(orthographic.__file__))==stored['helper_sha256'],'Orthographic current raw/root proof changed before write.')
        require(all(qa.digest(Path(orthographic.__file__).parent/name)==h for name,h in stored['proof_drivers_sha256'].items()),'Orthographic proof driver changed before write.')
    for ident,approval in expressive_approvals.items():
        repeated=expressive.review(run,rows[ident],expressive_qa_path,expressive_records[ident],approval)
        stored=next(p for take in result['takes'] if take['id']==ident for p in take.get('extra_word_proof',[]) if p.get('method')==expressive.VERSION)
        require(repeated==stored and qa.digest(Path(expressive.__file__))==stored['helper_sha256'],'Expressive source/raw/root proof changed before write.')
        require(all(qa.digest(Path(expressive.__file__).parent/name)==h for name,h in stored['proof_drivers_sha256'].items()),'Expressive driver changed before write.')
    for ident,(module,bindings,approval) in scoped.items():
        repeated=scoped_proof_function(module)(run,rows[ident],base_path,audio[ident],bindings,approval)
        stored=next(p for take in result['takes'] if take['id']==ident for p in take.get('extra_word_proof',[]) if p.get('method')==scoped_proof_method(module))
        require(repeated==stored,'Scoped current source/raw/root proof changed before write.')
        recheck_scoped_proof_files(module,stored)
    require(all(qa.digest(Path(p))==h for p,h in scoped_driver_hashes.items()),'Scoped finalizer/helper/protected driver changed before write.')
    require(all(qa.digest(run/name)==h for name,h in input_hashes.items()),'Evidence report changed during final qualification.')
    qa.save(output_path,result);return result

def main():
    common.configure();p=argparse.ArgumentParser(description=__doc__)
    for name in ['run-dir','base-qa-report','output']:p.add_argument('--'+name,type=Path,required=True)
    for name in ['specialist-comparison','ctc-variant-report','ctc-root-approvals','root-lexical-veto-report','pro-comparison','pro-root-approvals','complementary-root-approvals','complementary-ctc-report','flash-comparison','complementary-qa-report','orthographic-root-approvals','orthographic-qa-report','expressive-root-approvals','expressive-qa-report','vocal-comparison','pff-qc-response','meta-name-root-evidence','native625-root-evidence','a681-root-evidence','meta-foltan-cases-root-evidence']:p.add_argument('--'+name,type=Path)
    a=p.parse_args()
    try:
        result=finalize(a.run_dir,a.base_qa_report,a.output,a.specialist_comparison,a.ctc_variant_report,a.ctc_root_approvals,a.root_lexical_veto_report,pro_path=a.pro_comparison,pro_approvals_path=a.pro_root_approvals,complementary_approvals_path=a.complementary_root_approvals,complementary_ctc_path=a.complementary_ctc_report,flash_path=a.flash_comparison,complementary_qa_path=a.complementary_qa_report,orthographic_approvals_path=a.orthographic_root_approvals,orthographic_qa_path=a.orthographic_qa_report,expressive_approvals_path=a.expressive_root_approvals,expressive_qa_path=a.expressive_qa_report,vocal_path=a.vocal_comparison,pff_qc_path=a.pff_qc_response,meta_name_root_evidence_path=a.meta_name_root_evidence,native625_root_evidence_path=a.native625_root_evidence,a681_root_evidence_path=a.a681_root_evidence,meta_foltan_cases_root_evidence_path=a.meta_foltan_cases_root_evidence)
        print(json.dumps({'status':result['status'],'failures':len(result['failures']),'checked':len(result['checked_ids'])}));return 0 if result['status']=='passed' else 2
    except (core.SafeError,OSError,ValueError,KeyError,TypeError) as e:
        print(str(e) if isinstance(e,core.SafeError) else 'Invalid bound final-QA evidence; no reports overwritten.',file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
