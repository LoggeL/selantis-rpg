#!/usr/bin/env python3
"""One genuine rewrite490 e8 Full-Large result: offline review and Root adoption.

No inference, API, audio edit, report projection, public export or general model
exception. Historical DTW details remain intact. Root must explicitly select the
one ID after reviewing the actual result. This is technical timing evidence.
"""
from __future__ import annotations
import argparse
import copy
import datetime
import json
import math
from pathlib import Path
import shutil
import unicodedata
import prolog_voice_word_cues as acoustic
import story_voice_common as common
import story_voice_cue_review as free_review
import story_voice_ctc_review as ctc_review
import story_voice_qa as qa
import story_voice_word_cues as cues
from story_voice_publish import contained, require, read, sha

VERSION = 'rewrite490-one-e8-full-large-private-adoption-v1'
ENGINE = cues.ENGINE + '/' + VERSION
MODEL = 'whisper-large-v3'
RUN_NAME = '2026-10-07-rewrite-490'
IDENT = 'story-e8d0f148f8a46e1fdacbf615'
MANIFEST_SHA = 'bb243f9af44a00e2fb63779620c1fe92ec6bf1f9896b7629f88195d8a16db343'
SOURCE_ROW_SHA = 'f70c21015e0ed389a129c377a0622c36b1268163c040bf8712d5e4cfaac19597'
AUDIO_SHA = '75f7fc242697e526844ac48f796d154ec98c48f74401e0071193d7fe61ba98d3'
ORIGINAL_RECEIPT_SHA = 'e94b46366f3d2654e238b1bd59247ad19d4fce9696cf388e1cc29e3e90431a80'
NAMESPACE = 'timing-offline-review/full-large-e8-after-body4-plan2'
PLAN_SHA = 'd08457ba46b2ec1c266257596d712bd41c6638febe8f89b95a1c214bbb30217f'
RUNNER_SHA = 'bab39fb56be9ea8ad2ffe7424d62aa0a43219614b84876b504be7bd60eea62d1'
RESULT_SHA = '2a3907e18e78e408ad56e3cbd6a87bf7d9a2b6067c17ff5aabae412f2c11d0e2'
INTENT_SHA = '47a775ac9ccb1a98dca4b23fc93f1cd2040fdf5ce768d1644ce3ae284e5224ff'
MODEL_CONFIG_SHA = '34982ce6ae286095000f82ae9583b3431639e8b092bf60c961f203745e6500e3'
MODEL_WEIGHTS_SHA = '8c41a4ff9596c44de223d104845c98bc222995f34717f3f4214898d53e95a1c0'
CHANGED_FIELDS = {'engine_version', 'word_cues', 'cues_sha256', 'original_DTW_word_cues', 'FullLarge_adoption'}
ADOPTION_FIELDS = {'method','actual_model','actual_result_sha256','plan_sha256','runner_sha256',
                   'original_receipt_sha256','original_receipt_relative_path','qa_report_relative_path',
                   'qa_report_sha256','preserved_execution_inputs','legacy_parent_MODEL_constant_disclosed',
                   'actual_loaded_model_dimensions','root_journal_sha256'}
JOURNAL_FIELDS = {'method','selected_ids','review_note','input_hashes','original_receipt_sha256',
                  'original_approval_sha256','audio_modified','listening_verdict','acting_verdict'}


def digest(path):
    return qa.digest(Path(path))


def object_sha(value):
    return sha(json.dumps(value, sort_keys=True, ensure_ascii=False,
                          separators=(',', ':'), allow_nan=False).encode())


def fixed_source(run):
    run = Path(run).resolve()
    require(run.name == RUN_NAME and digest(run/'lines.private.json') == MANIFEST_SHA,
            'Full-Large scope requires the exact frozen rewrite490 bank')
    info = common.prepared(run)
    frozen = read(run/'lines.private.json')
    require(info['bank'] == 'story' and len(frozen['lines']) == info['request_count'] == 490
            and len({line['id'] for line in frozen['lines']}) == 490,
            'Full-Large requires complete real frozen490 Source')
    line = next((row for row in frozen['lines'] if row['id'] == IDENT), None)
    require(line is not None and object_sha(line) == SOURCE_ROW_SHA,
            'Full-Large exact authored e8 Source/cast/direction differs')
    return run, frozen, line


def clean_target_qa(report, line, original, audio_hash, expected_ids=None):
    require(report.get('finished_at') is not None and report.get('manifest_sha256') == MANIFEST_SHA
            and report.get('version') == qa.VERSION
            and isinstance(report.get('model'), str)
            and (report['model'] == qa.MODEL or report['model'].startswith(qa.MODEL+':')),
            'Full-Large requires genuine completed current word/signal QA')
    checked = report.get('checked_ids', [])
    require(len(checked) == len(set(checked)) == len(report.get('takes', [])) == 490
            and len({take.get('id') for take in report.get('takes',[])}) == 490
            and {take.get('id') for take in report.get('takes',[])} == set(checked)
            and IDENT in checked and set(report.get('clip_sha256', {})) == set(checked),
            'Full-Large current full QA coverage differs')
    require(expected_ids is None or set(checked) == set(expected_ids),
            'Full-Large QA ID body differs from full actual Source')
    take = free_review.eligible(original, report, audio_hash)
    require(take is not None and qa.words(take.get('transcript', '')) == qa.words(line['text'])
            and not qa.signal_failures(take['signal'], len(qa.words(line['text'])))
            and 0 < take['signal']['seconds'] <= 30,
            'Full-Large exact current e8 complete word/signal QA required')
    return take


def validate_result_objects(plan, result, intent, line):
    """Structural checks supplement fixed actual file hashes; no synthetic trust."""
    require(plan.get('status') == 'prepared_offline_not_executed_not_approved'
            and plan.get('root_approval') is False and plan.get('approval') is None
            and plan.get('selected_count') == 1 and plan.get('selected_ids') == [IDENT]
            and plan.get('full_manifest_count') == 490
            and plan.get('source_manifest_sha256') == MANIFEST_SHA
            and plan.get('source_row_sha256') == SOURCE_ROW_SHA
            and plan.get('source_row') == line,
            'Full-Large actual execution plan Source/scope differs')
    method = 'actual-full-large-v3-authored-DTW-one-e8-rewrite490-after-body4-private-v2'
    require(result.get('method') == intent.get('method') == method
            and result.get('id') == intent.get('id') == IDENT
            and result.get('plan_sha256') == intent.get('plan_sha256') == PLAN_SHA
            and result.get('runner_sha256') == intent.get('runner_sha256') == RUNNER_SHA
            and intent.get('heavy_execution_root_only') is True and intent.get('approval') is None,
            'Full-Large actual once-only Root execution binding differs')
    model = plan.get('required_actual_model', {}); config = model.get('config', {})
    require(model.get('name') == result.get('actual_model_name') == MODEL
            and Path(model.get('local_directory', '')).is_absolute()
            and Path(model['local_directory']).name == MODEL
            and config.get('n_audio_layer') == config.get('n_text_layer') == 32
            and result.get('actual_loaded_model_dimensions') == {k:v for k,v in config.items() if k != 'model_type'}
            and result.get('actual_model') == model,
            'Full-Large genuine loaded32/32 model identity differs')
    require(len(plan.get('fresh_current_runtime_file_sha256', {})) == 2484
            and result.get('actual_runtime_file_sha256') == plan['fresh_current_runtime_file_sha256']
            and result.get('actual_after_body4_context') == plan.get('actual_disjoint_body4_import')
            and result.get('actual_current_QA_path') == plan.get('current_QA_path')
            and result.get('actual_current_QA_sha256') == plan.get('immutable_file_sha256', {}).get(plan['current_QA_path'])
            and result.get('predecessor_zero_model_execution_proof') == plan.get('predecessor'),
            'Full-Large actual runtime/historical execution proof differs')
    require(result.get('source_manifest_sha256') == MANIFEST_SHA
            and result.get('source_row_sha256') == SOURCE_ROW_SHA
            and result.get('audio_sha256') == AUDIO_SHA
            and result.get('legacy_parent_MODEL_constant_disclosed') == acoustic.MODEL
            and result.get('complete_raw_and_refined_flags_preserved') is True
            and result.get('authored_DTW_is_not_independent_word_fidelity_proof') is True
            and result.get('original_cues_or_audio_modified') is False
            and all(result.get(key) is None for key in ['approval','timing_approval','listening_verdict','acting_verdict']),
            'Full-Large actual Source or honest technical verdict differs')
    return model


def validate_alignment(raw, refined, line, audio):
    """Reproduce only the original offline waveform helper, never new timings."""
    tokens = acoustic.normalized_text(line['text']).split()
    for receipt in [raw, refined]:
        require(receipt.get('version') == acoustic.VERSION and receipt.get('id') == IDENT
                and receipt.get('text') == acoustic.normalized_text(line['text'])
                and receipt.get('audio_sha256') == AUDIO_SHA
                and receipt.get('decoded_seconds') == len(audio)/16000
                and len(receipt.get('words', [])) == len(tokens)
                and [word.get('word') for word in receipt['words']] == tokens
                and ''.join(part.get('text', '') for part in receipt.get('token_alignment', [])) == ' '+receipt['text']
                and receipt.get('qualification_flags') == [],
                'Full-Large complete actual word/token body, duration or flags differ')
        cues.cue_words(line['text'], receipt['word_cues'], receipt['decoded_seconds'])
        previous = 0
        for token, detail, cue in zip(tokens, receipt['words'], receipt['word_cues']):
            spoken = any(char.isalnum() for char in token)
            require(type(detail.get('spoken')) is bool and detail['spoken'] == spoken
                    and detail.get('start') == cue['start'] and detail.get('end') == cue['end'],
                    'Full-Large actual word details/cue classification differs')
            if spoken:
                probability = detail.get('minimum_token_probability')
                require(type(probability) in (int,float) and math.isfinite(probability) and .02 <= probability <= 1
                        and .02 <= cue['end']-cue['start'] <= 1.5
                        and cue['start']-previous <= 1.5,
                        'Full-Large weak, collapsed or unsupported spoken word')
            else:
                require(token and all(unicodedata.category(char).startswith('P') for char in token)
                        and cue['start'] == cue['end'] == previous,
                        'Full-Large punctuation must have its actual preceding zero interval')
            previous = cue['end']
    require(acoustic.refine_boundaries(copy.deepcopy(raw), audio) == refined,
            'Full-Large actual waveform refinement cannot be reproduced')
    # Independently measure actual waveform energy for every chosen spoken word.
    import numpy as np
    size = 160; frames = audio[:len(audio)//size*size].reshape(-1,size)
    rms = np.sqrt(np.mean(frames.astype(np.float64)**2, axis=1))
    threshold = refined['refinement']['rms_threshold']; active = rms >= threshold
    fractions = []
    for detail, cue in zip(refined['words'], refined['word_cues']):
        if not detail['spoken']:
            fractions.append(None); continue
        window = active[int(cue['start']*100):int(math.ceil(cue['end']*100))]
        fraction = float(np.mean(window)) if len(window) else 0
        require(fraction >= .1, 'Full-Large chosen spoken interval lacks actual waveform support')
        fractions.append(fraction)
    return fractions


def _historical_file(run, path, expected, adoption):
    path = Path(path)
    require(path.is_relative_to(run), 'Historical execution dependency escaped private bank')
    if adoption:
        preserved = adoption.get('preserved_execution_inputs', {}).get(str(path), {})
        actual = contained(run, preserved.get('relative_path', ''))
        require(preserved.get('sha256') == expected and digest(actual) == expected,
                'Archived actual execution input differs')
        # Only collection and the adopted e8 live receipt may legitimately change.
        if path not in [run/'collection.private.json', run/'word-cues'/(IDENT+'.json')]:
            require(digest(path) == expected, 'Protected historical execution input changed')
        return actual
    require(digest(path) == expected, 'Actual pre-adoption execution input changed')
    return path


def execution_proof(run, adoption=None):
    directory = contained(run, NAMESPACE+'/actual-result.private.json').parent
    names = {'frozen-e8-one-take-unapproved-plan.private.json':PLAN_SHA,
             'root-one-case-runner.private.py':RUNNER_SHA,
             'actual-result.private.json':RESULT_SHA,'execution-intent.private.json':INTENT_SHA}
    files = [contained(run, NAMESPACE+'/'+name) for name in names]
    for path in files:
        require(digest(path) == names[path.name], 'The genuine once-only Full-Large execution file changed: '+path.name)
    plan = read(files[0]); result = read(files[2]); intent = read(files[3])
    require(Path(plan['run_dir']).resolve() == run, 'Full-Large historical execution bank differs')
    historical = {}
    for path, expected in plan['immutable_file_sha256'].items():
        historical[path] = _historical_file(run, path, expected, adoption)
    files.extend(historical.values())
    model = plan['required_actual_model']; model_dir = Path(model['local_directory'])
    require(model['file_sha256'] == {str(model_dir/'config.json'):MODEL_CONFIG_SHA,
                                    str(model_dir/'model.safetensors'):MODEL_WEIGHTS_SHA},
            'Full-Large exact full model file identity differs')
    require((model_dir/'weights.safetensors').resolve() == Path(model['weights_alias']['actual_resolved_path'])
            == model_dir/'model.safetensors' and read(model_dir/'config.json') == model['config'],
            'Full-Large actual config or weights alias differs')
    for field in ['protected_driver_file_sha256', 'fresh_current_runtime_file_sha256']:
        for name, expected in plan[field].items():
            path = Path(name); require(path.is_file() and digest(path) == expected,
                                       'Full-Large protected driver/runtime changed: '+name); files.append(path)
    for name, expected in model['file_sha256'].items():
        path = Path(name); require(digest(path) == expected, 'Full-Large actual model weight/config changed'); files.append(path)
    # Validate historical full490 and exact disjoint subset4 from immutable records.
    proof = read(historical[str(run/'root-body9-subset4/root-review.private.json')])
    journal = read(historical[str(run/'retake-batches/rewrite-body9-pass1/import.private.json')])
    context = plan['actual_disjoint_body4_import']; selected = context['selected_ids']
    require(len(selected) == len(set(selected)) == 4 and IDENT not in selected
            and proof['selected_ids'] == journal['selected_ids'] == selected
            and journal['state'] == 'IMPORTED'
            and proof['status'] == 'root_approved_once_permanent_child9_subset4_for_parent_import'
            and proof['parent_source_sha256'] == MANIFEST_SHA
            and len(proof['parent_audio_before_sha256']) == len(context['current_clip_sha256']) == 490
            and context['current_clip_sha256'][IDENT] == AUDIO_SHA,
            'Full-Large genuine historical490/subset4 execution records differ')
    historical_qa = read(historical[plan['current_QA_path']])
    require(historical_qa['clip_sha256'] == context['current_clip_sha256'],
            'Full-Large historical full490 actual QA hash record differs')
    for ident, before in proof['parent_audio_before_sha256'].items():
        after = context['current_clip_sha256'][ident]
        require((ident in selected and after == journal['new_mp3_sha256'][ident] and before != after)
                or (ident not in selected and before == after),
                'Full-Large historical4-import/486-unchanged proof differs')
    return plan, result, intent, historical, list(dict.fromkeys(files))


def review(run, qa_path, adoption=None):
    run, frozen, line = fixed_source(run)
    qa_path = Path(qa_path).resolve()
    require(qa_path.is_relative_to(run), 'Full-Large QA must remain private in this bank')
    plan, result, intent, historical, files = execution_proof(run, adoption)
    validate_result_objects(plan, result, intent, line)
    original = plan['actual_old_receipt']
    require(object_sha(plan['source_row']) == SOURCE_ROW_SHA
            and original['audio_sha256'] == AUDIO_SHA
            and digest(historical[str(run/'word-cues'/(IDENT+'.json'))]) == ORIGINAL_RECEIPT_SHA
            and read(historical[str(run/'word-cues'/(IDENT+'.json'))]) == original,
            'Full-Large archived original DTW body differs')
    audio_path = contained(run, 'clips/'+IDENT+'.mp3')
    require(digest(audio_path) == AUDIO_SHA, 'Full-Large current e8 audio changed')
    source_ids = {row['id'] for row in frozen['lines']}
    current_qa = read(qa_path); take = clean_target_qa(current_qa, line, original, AUDIO_SHA,source_ids)
    historical_qa = read(historical[plan['current_QA_path']])
    prior_take = clean_target_qa(historical_qa, line, original, AUDIO_SHA,source_ids)
    require(prior_take == plan['current_QA_after_body4_exact_take'] == plan['historical_QA29_exact_target_take'],
            'Full-Large genuine historical exact word/signal target differs')
    for folder in ['free-time13','free-time13-large-v3']:
        path = historical[str(run/folder/(IDENT+'.free-words.json'))]; observed = read(path)
        require(observed['audio_sha256'] == AUDIO_SHA and observed['initial_prompt'] is None
                and observed['condition_on_previous_text'] is False
                and qa.words(observed['response']['text']) == qa.words(line['text']),
                'Full-Large genuine independent unprompted full words differ')
    require(qa.decode(audio_path) == take['signal'], 'Full-Large actual decoded signal differs from current QA')
    audio = acoustic.decode(audio_path)
    fractions = validate_alignment(result['actual_parent_align_receipt_unmodified'],
                                   result['actual_parent_refine_boundaries_receipt'], line, audio)
    proposed = result['actual_parent_refine_boundaries_receipt']['word_cues']
    files.extend([run/'lines.private.json', run/'prepared.json', run/'profiles.private.json',run/'full-inventory.private.json',
                  run/'requests.jsonl', run/'source-snapshot.private.json', qa_path, audio_path, Path(__file__)])
    for location in line.get('sources',[]):
        current_source = contained(Path(__file__).resolve().parents[1],location['file'])
        require(digest(current_source) == frozen['source_hashes'][location['file']],
                'Full-Large current authored e8 game Source changed')
        files.append(current_source)
    return {'id':IDENT,'status':'supported','requires_root_review':True,'approval':None,
            'proposed_cues':copy.deepcopy(proposed),'proposed_cues_sha256':acoustic.cue_sha(proposed),
            'original_receipt':original,'original_receipt_sha256':ORIGINAL_RECEIPT_SHA,
            'plan_sha256':PLAN_SHA,'runner_sha256':RUNNER_SHA,'actual_result_sha256':RESULT_SHA,
            'actual_model':MODEL,'loaded_model_dimensions':result['actual_loaded_model_dimensions'],
            'current_qa_path':str(qa_path),'current_qa_sha256':digest(qa_path),
            'waveform_active_fractions':fractions,'historical_execution_plan':plan,
            'input_hashes':{str(path):digest(path) for path in dict.fromkeys(files)},
            'note':'Actual one-case authored timing and waveform evidence; no listening or acting verdict.'}


def evidence(run, receipt, expected, provenance_cache=None):
    """Validate an already Root-adopted exact e8 receipt and return real files."""
    require(receipt.get('id') == IDENT and receipt.get('engine_version') == ENGINE,
            'Only exact one-e8 Full-Large adoption supported')
    require(all(receipt.get(key) == value for key,value in expected.items() if key != 'engine_version'),
            'Full-Large current Source/audio receipt binding differs')
    adoption = receipt.get('FullLarge_adoption', {})
    require(isinstance(adoption,dict) and set(adoption) == ADOPTION_FIELDS
            and adoption.get('method') == VERSION and adoption.get('actual_model') == MODEL
            and adoption.get('actual_result_sha256') == RESULT_SHA
            and adoption.get('original_receipt_sha256') == ORIGINAL_RECEIPT_SHA
            and adoption.get('plan_sha256') == PLAN_SHA and adoption.get('runner_sha256') == RUNNER_SHA
            and adoption.get('legacy_parent_MODEL_constant_disclosed') == acoustic.MODEL,
            'Full-Large actual adoption evidence differs')
    archive = contained(run, adoption.get('original_receipt_relative_path', ''))
    require(archive.is_relative_to(Path(run)/'word-cues/adoption-archive')
            and digest(archive) == ORIGINAL_RECEIPT_SHA, 'Full-Large original full DTW archive missing/changed')
    qa_path = contained(run, adoption.get('qa_report_relative_path', ''))
    require(digest(qa_path) == adoption.get('qa_report_sha256'), 'Full-Large reviewed complete QA report changed')
    approval_path = contained(run, 'word-cues/qualifications.private.json')
    approval = read(approval_path).get('approvals', {}).get(IDENT, {})
    require(cues.adjudicated(receipt, approval) and approval.get('FullLarge_adoption') == adoption,
            'Full-Large explicit Root one-case approval is missing/forged')
    journal_path = archive.parent/'root-one-id-journal.private.json'; journal = read(journal_path)
    require(set(journal) == JOURNAL_FIELDS and digest(journal_path) == adoption['root_journal_sha256'] and journal.get('method') == VERSION
            and journal.get('selected_ids') == [IDENT] and journal.get('audio_modified') is False
            and journal.get('original_receipt_sha256') == ORIGINAL_RECEIPT_SHA
            and journal.get('review_note') == approval['review_note']
            and len(approval['review_note'].strip()) >= 20
            and journal.get('listening_verdict') is None and journal.get('acting_verdict') is None,
            'Full-Large genuine explicit once-one-ID Root journal differs')
    # Cache only after a complete proof; snapshots are rehashed by the publisher.
    cache_key = ('FullLarge', str(Path(run).resolve()), object_sha(receipt), digest(qa_path), digest(approval_path))
    if provenance_cache is not None and cache_key in provenance_cache:
        cached = provenance_cache[cache_key]
        if all((path.stat().st_size,path.stat().st_mtime_ns,path.stat().st_ctime_ns,path.stat().st_ino) == state
               for path,state in cached['states'].items()):
            return cached['files']
    proposal = review(run, qa_path, adoption)
    plan = proposal['historical_execution_plan']
    original_inputs = dict(plan['immutable_file_sha256'])
    for field in ['protected_driver_file_sha256','fresh_current_runtime_file_sha256']:
        original_inputs.update(plan[field])
    original_inputs.update(plan['required_actual_model']['file_sha256'])
    original_inputs.update({str(contained(run,NAMESPACE+'/'+name)):value for name,value in {
        'frozen-e8-one-take-unapproved-plan.private.json':PLAN_SHA,'root-one-case-runner.private.py':RUNNER_SHA,
        'actual-result.private.json':RESULT_SHA,'execution-intent.private.json':INTENT_SHA}.items()})
    for path in [Path(run)/'lines.private.json',Path(run)/'prepared.json',Path(run)/'profiles.private.json',
                 Path(run)/'full-inventory.private.json',Path(run)/'requests.jsonl',Path(run)/'source-snapshot.private.json',
                 qa_path,Path(run)/'clips'/(IDENT+'.mp3'),Path(__file__)]:
        original_inputs[str(path)] = digest(path)
    source_line = plan['source_row']
    for location in source_line.get('sources',[]):
        path = contained(Path(__file__).resolve().parents[1],location['file'])
        original_inputs[str(path)] = digest(path)
    require(set(adoption['preserved_execution_inputs']) == set(plan['immutable_file_sha256'])
            and adoption['actual_loaded_model_dimensions'] == proposal['loaded_model_dimensions']
            and journal.get('input_hashes') == original_inputs,
            'Full-Large exact historical inputs, loaded dimensions or reviewed driver differ')
    original = read(archive)
    require(original == proposal['original_receipt']
            and receipt.get('original_DTW_word_cues') == original['word_cues']
            and {key:value for key,value in receipt.items() if key not in CHANGED_FIELDS}
            == {key:value for key,value in original.items() if key not in CHANGED_FIELDS}
            and receipt['word_cues'] == proposal['proposed_cues']
            and receipt['cues_sha256'] == proposal['proposed_cues_sha256'],
            'Full-Large adopted cues or preserved historical raw/details/flags differ')
    files = list(dict.fromkeys([*map(Path,proposal['input_hashes']), archive, qa_path, approval_path, journal_path]))
    if provenance_cache is not None:
        provenance_cache[cache_key] = {'files':files,'states':{
            path:(path.stat().st_size,path.stat().st_mtime_ns,path.stat().st_ctime_ns,path.stat().st_ino) for path in files}}
    return files


def apply_scoped(run, qa_path, reviewed_ids, review_note):
    """Root-only explicit once-one-ID apply; no unrelated approval or audio edits."""
    require(set(reviewed_ids) == {IDENT} and isinstance(review_note,str) and len(review_note.strip()) >= 20,
            'Explicit reviewed exact e8 ID and meaningful Root review note required')
    run = Path(run).resolve(); lock = common.run_lock(run)
    try:
        live = contained(run,'word-cues/'+IDENT+'.json')
        require(digest(live) == ORIGINAL_RECEIPT_SHA, 'Full-Large adoption is once-only and requires untouched original DTW')
        proposal = review(run, qa_path)
        require(proposal['status'] == 'supported', 'Only actual fully supported Full-Large result may be adopted')
        for name, expected in proposal['input_hashes'].items():
            require(digest(Path(name)) == expected, 'Full-Large scoped input changed before first write')
        approval_path = run/'word-cues/qualifications.private.json'
        prior = read(approval_path) if approval_path.exists() else {'approvals':{}}
        original = read(live)
        archive = run/'word-cues/adoption-archive'/('e8-full-large-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ'))
        archive.mkdir(parents=True)
        shutil.copy2(live, archive/live.name)
        prior_approval_exists = approval_path.exists()
        if prior_approval_exists: shutil.copy2(approval_path, archive/'prior-qualifications.private.json')
        alignment_path = run/'word-cues/alignment.private.json'
        prior_alignment_exists = alignment_path.exists()
        if prior_alignment_exists: shutil.copy2(alignment_path,archive/'prior-alignment.private.json')
        preserved = {}
        for index,(name, expected) in enumerate(proposal['historical_execution_plan']['immutable_file_sha256'].items()):
            destination = archive/'historical-inputs'/(str(index).zfill(3)+'-'+Path(name).name)
            destination.parent.mkdir(exist_ok=True); shutil.copy2(name,destination)
            require(digest(destination) == expected, 'Historical Full-Large input copy differs before adoption')
            preserved[name] = {'relative_path':str(destination.relative_to(run)),'sha256':expected}
        qa.save(archive/'root-one-id-journal.private.json',{'method':VERSION,'selected_ids':[IDENT],
                'review_note':review_note.strip(),'input_hashes':proposal['input_hashes'],
                'original_receipt_sha256':ORIGINAL_RECEIPT_SHA,'original_approval_sha256':digest(approval_path) if approval_path.exists() else None,
                'audio_modified':False,'listening_verdict':None,'acting_verdict':None})
        adoption = {'method':VERSION,'actual_model':MODEL,'actual_result_sha256':RESULT_SHA,
                    'plan_sha256':PLAN_SHA,'runner_sha256':RUNNER_SHA,'original_receipt_sha256':ORIGINAL_RECEIPT_SHA,
                    'original_receipt_relative_path':str((archive/live.name).relative_to(run)),
                    'qa_report_relative_path':str(Path(qa_path).resolve().relative_to(run)),
                    'qa_report_sha256':proposal['current_qa_sha256'],'preserved_execution_inputs':preserved,
                    'legacy_parent_MODEL_constant_disclosed':acoustic.MODEL,
                    'actual_loaded_model_dimensions':proposal['loaded_model_dimensions'],
                    'root_journal_sha256':digest(archive/'root-one-id-journal.private.json')}
        new = copy.deepcopy(original)
        new.update(engine_version=ENGINE,word_cues=proposal['proposed_cues'],
                   cues_sha256=proposal['proposed_cues_sha256'],original_DTW_word_cues=copy.deepcopy(original['word_cues']),
                   FullLarge_adoption=adoption)
        approval = {key:new[key] for key in ['audio_sha256','text_sha256','source_manifest_sha256','cues_sha256','engine_version']}
        approval.update(decision='reviewed',review_note=review_note.strip(),FullLarge_adoption=adoption)
        updated = copy.deepcopy(prior);updated.setdefault('approvals',{})[IDENT] = approval
        # Original approval metadata and every other approval remain unchanged.
        try:
            qa.save(live,new);qa.save(approval_path,updated)
            expected = {key:new[key] for key in ['audio_sha256','text_sha256','source_manifest_sha256']}
            evidence(run,new,expected)  # Complete genuine private read-back before the bank report.
            # Rebuild the actual complete bank report from all actual current receipts.
            manifest = read(run/'lines.private.json')
            report = ctc_review.complete_report(run,manifest,MANIFEST_SHA,updated['approvals'],expected_count=490)
            qa.save(alignment_path,report)
            return report
        except Exception:
            # Keep the evidence archive/journal, restore exact original bytes.
            for target, saved, existed in [(live,archive/live.name,True),
                    (approval_path,archive/'prior-qualifications.private.json',prior_approval_exists),
                    (alignment_path,archive/'prior-alignment.private.json',prior_alignment_exists)]:
                if existed:
                    temporary = target.with_suffix(target.suffix+'.rollback.tmp')
                    shutil.copy2(saved,temporary);temporary.replace(target)
                elif target.exists():
                    target.unlink()
            raise
    finally:
        lock.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',type=Path,required=True);parser.add_argument('--qa-report',type=Path,required=True)
    parser.add_argument('--apply',action='store_true');parser.add_argument('--reviewed-ids');parser.add_argument('--review-note')
    args = parser.parse_args()
    if args.apply:
        report = apply_scoped(args.run_dir,args.qa_report,set((args.reviewed_ids or '').split(',')),args.review_note)
        print(json.dumps({'status':report['status'],'aligned':len(report['alignment_by_id']),
                          'open':len(report['requires_qualification']),'selected_ids':[IDENT]}))
    else:
        proposal = review(args.run_dir,args.qa_report)
        print(json.dumps({key:proposal[key] for key in ['id','status','requires_root_review','approval','proposed_cues_sha256','actual_result_sha256','actual_model','waveform_active_fractions']}))


if __name__ == '__main__':
    main()
