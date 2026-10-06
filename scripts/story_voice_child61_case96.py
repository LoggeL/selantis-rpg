#!/usr/bin/env python3
"""One exact Child61 Source96 combination proof. Offline and lexical only.

Original Child12/Native11 evidence is immutable. No alias, inference, import,
vowel norm, acting, timing or human listening acceptance is supplied.
"""
from __future__ import annotations
import argparse, ast, base64, copy, hashlib, json, math
from pathlib import Path
import subprocess
import numpy as np
import story_voice_common as common
from story_voice_common import core
import story_voice_qa as qa
import story_voice_vocal_qc as qc
import story_voice_expressive_events as expressive
import story_voice_meta_name_evidence as native
import story_voice_retake_batch as retake
import story_voice_child51_cases as matrices
import story_voice_pro_asr as pro

VERSION = 'child61-exact96-native11-Ha-name-word-evidence-v1'
APPROVED = 'approved_individual_child61_case96_full_word_evidence'
CHILD = 'retake-batches/contextual-diction-12-pass61'
META = 'contextual-diction-12-pass61/native11-pass65'
FULL_COUNT = 1557
CHILD_COUNT = 12
ID = 'story-96bf3614b339ca923be41f97'
TEXT = 'Ha! Da hat sie dich, Foltan.'
EXCLUDED_ID = 'story-43684c454bac0db005986772'
CHILD_IDS = [EXCLUDED_ID, 'story-45cf6c5149543786a3a5a23b', 'story-5bcb6a206a27e7d7e591df27',
    'story-67e24e24b2c673faa711abfb', 'story-7ea9552d0dab68561d490184', ID,
    'story-a0048bb6f133cd08ba01ecdb', 'story-a3cd5eb91bc73369b09a34c6',
    'story-d22ce7666e5e476080d3f658', 'story-dae3640e33adc257f65813e4',
    'story-dfc39fc851835d9c5c4b9b77', 'story-f06a5efd19de5a02af97d1f0']
META_IDS = [i for i in CHILD_IDS if i != EXCLUDED_ID]
FROZEN_PLAN_SHA256 = '69319ab668201cf7a0e7ed40d629c7c518cb63f3517665d159d3cf324c317cbe'
FROZEN_RUNNER_SHA256 = 'd336b170dd02df19c1ccfa3db548b4e9cf9def0668023ba6181e2e4730ec3d02'
FROZEN_NATIVE_OUTPUT_SHA256 = '6a7c305b4bb53274a9a6e80d5f09ad8704cf845a09a13f30cffa146ea32aaa90'
KEYS = {'qa_report_path', 'child_qc_record_path', 'child_pro_record_path', 'child_import_journal_path'}
CASES = {ID: {'text': TEXT, 'speaker': 'azar', 'voice': 'Zubenelgenubi',
    'clip_sha256': '254889e6195099bb098c478eeed29db7cac272669926475f7c6cf859ede4ab31',
    'primary_transcript': 'Ha, da hat sie dich foltern!', 'qc_transcript': 'Da hat sie dich foltern',
    'pro_transcript': 'Da hat sie dich voll dran.',
    'raw_ipa': 'a x d a h a h a t ts iː n ɪ ç f ɔ l t ɑː n'}}
HA_EVENT = {'category': 'laughter', 'description': 'a short scoffing chuckle or puff of air',
    'vocal_sound': 'ha', 'confidence': .85}
require, digest, object_hash, native_hash = native.require, native.digest, native.object_hash, native.native_hash
native_array_events, native_runtime, ctc_frames = matrices.native_array_events, matrices.native_runtime, matrices.ctc_frames


def case(line):
    require(line.get('id') == ID and line.get('text') == TEXT and line.get('speaker') == 'azar',
        'Only the exact authored Source96/Azar row is supported.')
    return CASES[ID]


def words(line, transcript, channel):
    value = case(line); require(channel in {'primary', 'qc', 'pro'} and transcript == value[channel+'_transcript'],
        'Complete original decoder literal required, no repaired/dropped/extra body words.')
    actual = qa.words(transcript); expected = qa.words(TEXT)
    require(expected == ['ha', 'da', 'hat', 'sie', 'dich', 'foltan'], 'Exact authored six-token source required.')
    if channel == 'primary': require(actual == expected[:5]+['foltern'], 'Primary Ha and every body word required.')
    elif channel == 'qc': require(actual == expected[1:5]+['foltern'], 'Every actual non-Ha QC body word required.')
    else: require(actual == expected[1:5]+['voll', 'dran'], 'Original contradictory Pro split phrase must be retained.')
    return {'channel': channel, 'full_actual_transcript': transcript, 'expected_tokens': expected,
        'observed_tokens': actual, 'literal_four_body_words': expected[1:5], 'decoder_spelling_adopted': False,
        'Foltan_Foltern_or_VollDran_alias': False, 'whole_channel_word_acceptance': None}


def qc_observation(line, record):
    case(line); obs = qc.response_observation(record['response']); result = words(line, obs['transcript'], 'qc')
    require(obs['events'] == [HA_EVENT] and qa.CONTEXTUAL_GESTURES['ha'] == ({'laughter'}, {'ha'}),
        'Exactly the original one Ha/laughter event, sound, description and confidence required.')
    result.update(actual_events=copy.deepcopy(obs['events']), source_event_binding={'source_token_index': 0,
        'source_token': 'ha', 'category': 'laughter', 'event_indices': [0], 'descriptions': [HA_EVENT['description']],
        'observed_token_indices': [], 'vocal_sound': 'ha'},
        original_contextual_Ha_rules_satisfied=True, generic_vocal_review_full_words_result=None,
        generic_word_adjudication_used=False, acting_approval=None)
    return result


def native_frames(line, logits, probabilities, ids, vocab, observation):
    case(line); events = native_array_events(logits, probabilities, ids, vocab, observation)
    require(observation['raw_ipa'] == CASES[ID]['raw_ipa'], 'Every original opening/body/terminal native phone required.')
    chosen = events[14:20]; require([e['token'] for e in chosen] == ['f','ɔ','l','t','ɑː','n'],
        'Exactly the actual complete six name emissions required, no normalized vowel.')
    frame = chosen[0]['frame_index']; f, v = (float(probabilities[frame,vocab[token]]) for token in ['f','v'])
    require(f >= .95 and v <= .02 and f > v, 'Actual native f onset lacks required evidence.')
    vowel_frame = chosen[4]['frame_index']
    return {'full_verbatim_free_ipa': observation['raw_ipa'], 'full_verbatim_events': copy.deepcopy(events),
        'name_source_word_index': 5, 'selected_event_indices': [14,20], 'selected_name_events': copy.deepcopy(chosen),
        'f_uncalibrated_softmax': f, 'v_uncalibrated_softmax': v, 'canonical_name_vowel': None,
        'actual_unqualified_vowel_class_scores': {t:float(probabilities[vowel_frame,vocab[t]]) for t in ['ɑː','ɜ','a']},
        'original_counterevidence': {'opening': copy.deepcopy(events[:2]), 'body':copy.deepcopy(events[2:14]),
            'extra_h_a':copy.deepcopy(events[6:8]), 'n_instead_of_d_body_diagnostic':copy.deepcopy(events[11:14]),
            'Pro_transcript':CASES[ID]['pro_transcript'], 'Primary_and_QC_name': 'foltern'},
        'model_phone_to_word_timestamps': None, 'name_vowel_duration_or_canonical_claim': None,
        'general_name_F_V_or_vowel_alias': False}


def original_pro_evidence(run, child, line, audio_hash, bindings, path, load):
    """Original Pro validators with the honest retake rows, no false source hook.

    The default cached_record() requires a canonical story prepared run. This
    real child was collected through its original retake adapter. Validate the
    same request/scope/response contracts directly without reinvoking the old
    Parent-delta-zero adapter after import.
    """
    batch = child/'independent-pro-asr/batches/child-pro-pass64'
    freeze = load(run/META/'freeze.private.json')
    adapter_path = path(freeze['pro_guard_adapter_file'])
    require(digest(adapter_path) == freeze['pro_guard_adapter_sha256'], 'Original honest Pro12 adapter bytes required.')
    adapter = ast.parse(adapter_path.read_text())
    embedded = [ast.literal_eval(node.value) for node in adapter.body if isinstance(node, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == 'FROZEN_PROOF' for t in node.targets)]
    adapter_freeze = load(adapter_path.parent/'freeze.private.json')
    require(embedded == [adapter_freeze] and adapter_freeze['full_scope_ids'] == CHILD_IDS
        and adapter_freeze['Pro_contract']['model'] == pro.MODEL and adapter_freeze['Pro_contract']['prompt'] == pro.PROMPT
        and adapter_freeze['Pro_contract']['config'] == pro.CONFIG and adapter_freeze['Pro_contract']['metadata'] == pro.metadata(),
        'Original Pro model/prompt/schema/retake-context contract differs.')
    for p, h in adapter_freeze['original_script_sha256'].items():
        require(digest(path(common.ROOT/'scripts'/p, external=True)) == h, 'Original Pro/transcription/transport implementation changed.')
    rows = {r['id']:r for r in load(child/'lines.private.json')['lines']}
    with pro.backend():
        scope = pro.validate_scope(batch)
        info, inputs = pro.frozen_inputs(batch, child, rows)
    require(scope['selected_ids'] == CHILD_IDS and scope['max_calls'] == info['request_count'] == CHILD_COUNT,
        'Exactly the original full12 blind Pro scope required.')
    raw_path = path(batch/'responses.private.jsonl')
    raw = [json.loads(s) for s in raw_path.read_text().splitlines() if s.strip()]
    require(len(raw) == CHILD_COUNT and {r['key'] for r in raw} == set(CHILD_IDS), 'Complete unique Pro12 original raw ledger required.')
    intent, job, collection = (load(batch/n) for n in ['submit-intent.private.json','job.json','collection.private.json'])
    require(intent['state'] == 'CONFIRMED' and job['state'] == 'JOB_STATE_SUCCEEDED'
        and intent['model'] == job['model'] == collection['model'] == pro.MODEL
        and intent['input_sha256'] == info['input_sha256'] and intent['request_count'] == job['request_count'] == CHILD_COUNT
        and collection['collected'] == collection['expected'] == CHILD_COUNT and collection['failures'] == [],
        'Actual completed original Pro12 provider ledgers required.')
    reservations = load(child/'independent-pro-asr/batch-reservations.private.json')
    chosen = None
    for ident in CHILD_IDS:
        sha = digest(path(child/'clips'/(ident+'.mp3'))); sh = qa.text_hash(rows[ident]['text'])
        record_path = path(child/'independent-pro-asr'/(ident+'.'+sha[:16]+'.json')); record = load(record_path)
        original = [r for r in raw if r['key'] == ident]; request = [r['request'] for r in inputs if r['key'] == ident]
        require(record['id'] == ident and record['source_run'] == str(child)
            and all(record[k] == sha for k in ['clip_sha256','source_audio_sha256','upload_sha256'])
            and record['source_text_sha256'] == sh and record['model'] == pro.MODEL and record['prompt'] == pro.PROMPT
            and all(record[k] == v for k,v in pro.metadata().items()) and record['input_mime_type'] == 'audio/mpeg'
            and len(original) == len(request) == 1 and original[0]['response'] == record['response']
            and pro.response_transcript(record['response']) == record['transcript']
            and request[0] == pro.request_for(path(child/'clips'/(ident+'.mp3')).read_bytes())
            and record['request_sha256'] == pro.object_hash(request[0])
            and record['scope_sha256'] == digest(path(batch/'pro-scope.private.json'))
            and record['prepared_sha256'] == digest(path(batch/'prepared.json'))
            and record['snapshot_sha256'] == digest(path(batch/'audio-snapshot.private.json'))
            and record['batch_scope_file'] == str((batch/'pro-scope.private.json').relative_to(child))
            and record['batch_response_file'] == str(raw_path.relative_to(child)) and record['batch_response_sha256'] == digest(raw_path)
            and record['listening_verdict'] is None and record['provider_timestamps_used'] is False
            and reservations[ident+':'+sha+':'+pro.text_hash(pro.PROMPT)+':'+pro.MODEL]['run'] == str(batch),
            'Actual complete Pro request/audio/response/cache/reservation contract differs.')
        if ident == ID:
            require(sha == audio_hash and (bindings is None or path(bindings['child_pro_record_path']) == record_path),
                'Exact genuine Source96 Pro cache identity required.')
            chosen = {'actual_record':copy.deepcopy(record), 'record_file_sha256':digest(record_path),
                'literal_diagnostic':words(line,record['transcript'],'pro'),
                'original_adapter_sha256':digest(adapter_path), 'default_canonical_cached_record_boundary_used':False,
                'actual_retakescope_full_contract_validated_without_old_parent_guard':True}
    require(chosen is not None, 'Actual Source96 Pro evidence unavailable.')
    return chosen


def native_result_names():
    names = ['completion.private.json', 'execution-intent.private.json', 'source-context.private.json',
        'root-execution-review.private.json', 'results/comparison.private.json',
        'results/native-model-runtime.private.json', 'results/phone-inventory.private.json']
    for ident in META_IDS:
        names.extend('results/'+ident+'.'+suffix for suffix in ['observation.private.json', 'forward-intent.private.json',
            'phone-logits.private.npy', 'frame-probabilities.private.npy', 'argmax-ids.private.npy'])
    return sorted(names)


def frozen_native_result_bindings(base, path):
    names = native_result_names()
    require({str(p.relative_to(base)) for p in (base/'results').iterdir() if p.is_file()}
        == {n for n in names if n.startswith('results/')}, 'Exact original complete Native11 result tree required.')
    bindings = {name: digest(path(base/name)) for name in names}
    require(object_hash(bindings) == FROZEN_NATIVE_OUTPUT_SHA256,
        'All 62 original Native11 outputs required; coordinated rehashing cannot substitute evidence.')
    return bindings


def native_execution_scope(run, child, plan, completion, execution, gate, runner_hash, plan_hash):
    require(isinstance(gate, dict) and {'status', 'reviewed_by', 'model', 'revision', 'selected_ids',
        'child_scope_ids', 'excluded_id', 'runner_sha256', 'plan_sha256', 'max_forward_calls',
        'max_active_local_models', 'one_active_local_model', 'current_parent_audio_delta_ids', 'audio_sha256'} <= set(gate),
        'Complete separate original Root execution guard required.')
    require(plan_hash == FROZEN_PLAN_SHA256 and runner_hash == FROZEN_RUNNER_SHA256
        and plan['root_forward_approval_required'] is True and plan['original_full_child12_guard'] is True
        and plan['actual_full_QC12_guard'] is True and plan['actual_full_Pro12_honest_retakescope_guard'] is True and plan['source_child_retake_prepared_full1557_verified'] is True,
        'Genuine exact frozen Native11 original full Child12 guards required.')
    require(plan['source_run'] == str(child) and plan['parent_run'] == str(run)
        and plan['model'] == execution['model'] == gate['model'] == native.MODEL
        and plan['revision'] == execution['revision'] == gate['revision'] == native.REVISION
        and plan['scope'] == execution['ids'] == gate['selected_ids'] == META_IDS
        and gate['child_scope_ids'] == CHILD_IDS and gate['excluded_id'] == EXCLUDED_ID,
        'Exact blind Native11 source/model/excluded436 scope differs.')
    require(completion['status'] == 'observations_complete' and completion['calls'] == 11 and completion['approval'] is None
        and completion['runner_sha256'] == execution['runner_sha256'] == plan['runner_sha256'] == runner_hash
        and completion['plan_sha256'] == execution['plan_sha256'] == gate['plan_sha256'] == plan_hash
        and gate['runner_sha256'] == runner_hash and gate['status'] == 'approved_execution_scope'
        and isinstance(gate['reviewed_by'], str) and gate['reviewed_by'].startswith('root ')
        and gate['max_forward_calls'] == execution['max_forward_calls'] == plan['max_forward_calls'] == 11
        and gate['max_active_local_models'] == execution['max_active_local_models'] == plan['max_active_local_models'] == 1
        and gate['one_active_local_model'] is True and gate['current_parent_audio_delta_ids'] == []
        and gate['audio_sha256'] == execution['mp3_sha256'], 'Actual prior Root execution gate/completion required, no word approval follows.')


def historical_parent_context(run, snapshot, freeze, path, load):
    qa_path = path(freeze['parent_actual_QA59_file'])
    require(digest(qa_path) == freeze['parent_actual_QA59_sha256'], 'Original complete historical QA59 bytes required.')
    report = load(qa_path)
    require(freeze['expected_parent_audio_delta_ids'] == [] and freeze['current_parent_bank_count'] == FULL_COUNT
        and snapshot['bank_sha256'] == freeze['current_parent_bank_sha256'] == native_hash(snapshot['bank_mp3_sha256'])
        and report['clip_sha256'] == snapshot['bank_mp3_sha256'] and len(report['takes']) == FULL_COUNT
        and len(report['checked_ids']) == len(set(report['checked_ids'])) == FULL_COUNT
        and report['finished_at'] >= report['started_at'], 'Original immutable Native Parent361/delta0/1557 context differs.')
    return {'historical_Parent_bank_sha256':snapshot['bank_sha256'], 'historical_Parent_audio_delta_ids':[],
        'original_Parent_QA_file':str(qa_path), 'original_Parent_QA_sha256':digest(qa_path),
        'historical_files_are_not_current_bank':True, 'caption_or_wordtime_anchor_count':0,
        'old_guard_reinvoked_against_current_bank':False}


def native_proof(run, child, line, path, load):
    base = run/META; results = frozen_native_result_bindings(base, path)
    plan = load(base/'plan.private.json'); completion = load(base/'completion.private.json')
    execution = load(base/'execution-intent.private.json'); gate = load(base/'root-execution-review.private.json')
    context = load(base/'source-context.private.json'); freeze = load(base/'freeze.private.json')
    native_execution_scope(run, child, plan, completion, execution, gate,
        digest(path(base/'runner.py')), digest(path(base/'plan.private.json')))
    context_hash, gate_hash, execution_hash = (digest(path(base/name)) for name in
        ['source-context.private.json', 'root-execution-review.private.json', 'execution-intent.private.json'])
    require(plan['source_context_sha256'] == gate['source_context_sha256'] == context_hash
        and plan['freeze_sha256'] == gate['freeze_sha256'] == digest(path(base/'freeze.private.json'))
        and execution['root_execution_review_sha256'] == gate_hash
        and gate['input_plan_sha256'] == digest(path(base/'input-plan.private.json'))
        and plan['expected_text_passed_to_recognizer'] is False and context['expected_text_passed_to_recognizer'] is False,
        'Actual native original plan/context/Root gate bytes differ.')
    require(freeze['child_full_scope_ids'] == CHILD_IDS and freeze['selected_ids'] == META_IDS
        and freeze['excluded_id'] == EXCLUDED_ID and freeze['Child12_import_subset'] is None,
        'Original preimport full12 provenance/11 forward scope required.')
    for table in ['qc12_original_provenance_file_sha256', 'pro12_original_provenance_file_sha256', 'verified_native17_baseline_file_sha256']:
        for p, h in freeze[table].items():
            require(digest(path(p)) == h, 'Actual original QC12/Pro12 or native baseline provenance changed.')
    qc_freeze_path = path(run/'contextual-diction-12-pass61/qc-adapter62/freeze.private.json')
    qc_freeze = load(qc_freeze_path)
    # The actual adapter is a frozen plan input; its embedded FROZEN_PROOF must
    # match this original companion JSON without executing its historical guard.
    import ast
    adapter = ast.parse(path(freeze['guard_adapter_file']).read_text())
    embedded = [ast.literal_eval(node.value) for node in adapter.body if isinstance(node, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == 'FROZEN_PROOF' for t in node.targets)]
    require(embedded == [qc_freeze] and qc_freeze['full_scope_ids'] == CHILD_IDS
        and qc_freeze['parent_delta_ids'] == [] and qc_freeze['current_parent_bank_matches_snapshot'] is True,
        'Exact original historical QC adapter/freeze required, never executed against the new bank.')
    for p, h in qc_freeze['child_file_sha256'].items():
        require(digest(path(child/p)) == h, 'Original full12 TTS/Primary evidence changed.')
    for p, h in qc_freeze['original_script_sha256'].items():
        require(digest(path(common.ROOT/'scripts'/p, external=True)) == h, 'Original protected TTS/QA/QC implementation changed.')
    original_bindings = plan['source_file_bindings']
    require(len(original_bindings) == len({b['path'] for b in original_bindings}) == 112,
        'Exactly all original 112 native execution input bindings required.')
    for binding in original_bindings:
        require(digest(path(binding['path'], external=True)) == binding['sha256'], 'Original frozen native source/runtime input changed.')
    history = historical_parent_context(run, load(child/'parent-snapshot.private.json'), freeze, path, load)
    params = plan['params']
    require(params == execution['actual_params'] and native_hash(params) == plan['params_sha256'] == execution['actual_params_sha256']
        and params['do_phonemize'] is False and params['source_text_input'] is False and params['forced_alignment'] is False
        and params['beam_search'] is False and params['timestamps'] is False and params['lexicon'] is None
        and params['language_hint'] is None and params['device'] == 'cpu' and params['sample_rate'] == 16000
        and params['max_forward_calls'] == 11, 'Original complete blind native parameters differ.')
    runtime = load(base/'results/native-model-runtime.private.json')
    require(runtime['model_loaded_only_after_exact_root_review'] is True and runtime['serialized_forwards'] is True
        and runtime['loaded_acoustic_model_instances'] == 1 and runtime['parameter_dtypes'] == ['torch.float32']
        and runtime['root_execution_review_sha256'] == gate_hash and runtime['approval'] is None,
        'Genuine one-model serialized Root runtime execution record required.')
    require([c['id'] for c in plan['clips']] == [c['id'] for c in context['records']] == META_IDS,
        'Exactly every native forward/context required.')
    child_rows = {r['id']: r for r in load(child/'lines.private.json')['lines']}
    requests = [json.loads(s) for s in path(child/'requests.jsonl').read_text().splitlines() if s.strip()]
    takes = {t['id']: t for t in load(child/'qa-actual-primary-pass62.private.json')['takes']}
    raw_pro = [json.loads(s) for s in path(child/'independent-pro-asr/batches/child-pro-pass64/responses.private.jsonl').read_text().splitlines() if s.strip()]
    raw_qc = [json.loads(s) for s in path(child/'independent-vocal-qc/batches/child-qc-pass62/responses.private.jsonl').read_text().splitlines() if s.strip()]
    target = line['id']; target_obs = load(base/'results'/(target+'.observation.private.json'))
    target_forward = load(base/'results'/(target+'.forward-intent.private.json'))
    model = native_runtime(plan, execution, target_obs, target_forward, path)
    vocab, config = load(model/'vocab.json', external=True), load(model/'config.json', external=True)
    complete = []; selected = None
    for clip, source in zip(plan['clips'], context['records']):
        ident = clip['id']; obs_path = path(base/'results'/(ident+'.observation.private.json'))
        forward_path = path(base/'results'/(ident+'.forward-intent.private.json'))
        obs, forward = load(obs_path), load(forward_path)
        receipt = load(child/'raw'/(ident+'.receipt.json'))
        qc_path = child/'independent-vocal-qc'/(ident+'.'+clip['mp3_sha256'][:16]+'.json')
        record = load(qc_path)
        require(source['source_row'] == child_rows[ident] and source['source_row_sha256'] == native_hash(child_rows[ident])
            and source['speaker'] == child_rows[ident]['speaker'] and source['voice'] == source['full_voice_profile']['google_voice']
            and source['actual_receipt'] == receipt and source['actual_child_QA'] == takes[ident]
            and [r for r in requests if r['key'] == ident] == [source['actual_child_modified_request']]
            and source['actual_original_QC_cache_record'] == record
            and [r for r in raw_qc if r['key'] == ident] == [source['actual_original_QC_raw_item']]
            and source['actual_original_Pro_cache_record'] == load(child/'independent-pro-asr'/(ident+'.'+clip['mp3_sha256'][:16]+'.json'))
            and [r for r in raw_pro if r['key'] == ident] == [source['actual_original_Pro_raw_item']]
            and source['caption_or_wordtime_anchor_count'] == 0
            and source['authored_text_passed_to_recognizer'] is False,
            'Original actual whole source/request/Primary/QC context differs.')
        pcm = subprocess.check_output([plan['ffmpeg_binary'], '-v', 'error', '-i', str(child/'clips'/(ident+'.mp3')),
            '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1'])
        pcm_hash = hashlib.sha256(pcm).hexdigest()
        require(obs['id'] == forward['id'] == ident and obs['status'] == 'observation_only'
            and all(obs[k] is None for k in ['word_approval', 'phonetic_approval', 'acting_approval', 'timing_approval', 'listening_verdict'])
            and obs['source_mp3_sha256'] == forward['mp3_sha256'] == clip['mp3_sha256'] == execution['mp3_sha256'][ident]
                == digest(path(child/'clips'/(ident+'.mp3'))) == gate['audio_sha256'][ident]
            and obs['source_receipt_sha256'] == clip['receipt_sha256'] == digest(path(child/'raw'/(ident+'.receipt.json'))) == gate['receipt_sha256'][ident]
            and obs['provider_wav_sha256'] == clip['provider_wav_sha256'] == digest(path(child/'raw'/(ident+'.wav'))) == gate['provider_wav_sha256'][ident]
            and obs['decoded_pcm_sha256'] == forward['pcm_sha256'] == clip['pcm_sha256'] == pcm_hash == gate['pcm_sha256'][ident]
                == digest(path(base/obs['decoded_f32le_file']))
            and obs['feature_bindings'] == forward['features'] == clip['prepared_official_normalized_feature_bindings'] == gate['official_feature_bindings'][ident]
            and obs['runner_sha256'] == forward['runner_sha256'] == FROZEN_RUNNER_SHA256
            and obs['plan_sha256'] == forward['plan_sha256'] == FROZEN_PLAN_SHA256
            and obs['source_context_sha256'] == context_hash and obs['forward_intent_sha256'] == digest(forward_path)
            and obs['global_execution_intent_sha256'] == forward['global_execution_intent_sha256'] == execution_hash
            and obs['root_execution_review_sha256'] == forward['root_execution_review_sha256'] == gate_hash
            and obs['actual_params'] == params and obs['actual_params_sha256'] == forward['actual_params_sha256'] == plan['params_sha256']
            and obs['model'] == native.MODEL and obs['revision'] == native.REVISION
            and obs['model_tree_sha256'] == forward['model_tree_sha256'] == plan['model_tree_sha256']
            and obs['weights_sha256'] == forward['weights_sha256'] == plan['model_files']['pytorch_model.bin']
            and forward['model_files'] == plan['model_files'] and obs['vocab_sha256'] == plan['model_files']['vocab.json']
            and obs['runtime_bindings_sha256'] == native_hash(plan['runtime_bindings'])
            and obs['recognizer_received_expected_text'] is False and obs['model_timestamps_used'] is False
            and forward['state'] == 'RECORDED_BEFORE_FORWARD' and forward['max_forward_calls'] == 1 and forward['approval'] is None,
            'Completed native forward differs from exact original full scope/provenance.')
        arrays = []
        for file_key, hash_key in [('raw_phone_logits_file', 'raw_phone_logits_sha256'),
                ('actual_frame_probabilities_file', 'actual_frame_probabilities_sha256'), ('argmax_ids_file', 'argmax_ids_sha256')]:
            p = path(base/obs[file_key]); require(digest(p) == obs[hash_key], 'Original full Native11 matrix changed.')
            arrays.append(np.load(p, allow_pickle=False))
        require(arrays[0].shape[1] == ctc_frames(len(pcm)//4, config) == clip['expected_native_convolution_output_frames']
            and len(pcm)//4 == clip['pcm_frames'] and obs['actual_native_output_frames'] == arrays[0].shape[1]
            and list(arrays[0].shape) == obs['score_shape'] and list(arrays[1].shape) == obs['actual_probability_shape']
            and obs['actual_logit_dtype'] == 'float32' and obs['actual_probability_dtype'] == 'float64'
            and obs['actual_native_convolutions'] == obs['native_convolution_contract'] == plan['native_convolution_contract']
                == execution['native_convolution_contract'], 'Actual complete native matrix/PCM/convolution geometry differs.')
        native_array_events(*arrays, vocab, obs)
        if ident == target: selected = native_frames(line, *arrays, vocab, obs)
        complete.append({'id': ident, 'observation_sha256': digest(obs_path), 'forward_intent_sha256': digest(forward_path),
            'full_native_arrays_verified': True})
    require(selected is not None, 'Exact native case unavailable.')
    selected.update(model=native.MODEL, revision=native.REVISION, frozen_plan_sha256=FROZEN_PLAN_SHA256,
        original_native_result_files_sha256=results, complete_eleven_forward_verification=complete,
        historical_execution_context_bindings=copy.deepcopy(original_bindings), historical_parent_context=history,
        execution_gate_sha256=gate_hash)
    return selected


def validate_current_parent(run, child, manifest, snapshot, bindings, path, load):
    journal_path = path(bindings['child_import_journal_path'])
    require(journal_path == child/'import.private.json', 'Actual original Child61 import journal required.')
    journal = load(journal_path); snapshot_path = path(child/'parent-snapshot.private.json')
    imported = retake.journal_import_ids(journal, snapshot, digest(snapshot_path))
    require(journal['state'] == 'IMPORTED' and ID in imported and set(imported) <= set(CHILD_IDS) and journal['validated_disjoint_import_journal_sha256'] == {},
        'Actual single completed exact selected-source Child12 import required.')
    rows = {r['id']: r for r in manifest['lines']}; bank = {i: digest(path(run/'clips'/(i+'.mp3'))) for i in rows}
    require(set(bank) == set(snapshot['bank_mp3_sha256']), 'Exact original full bank source scope required.')
    archive = Path(journal['archive']).resolve(); require(archive.is_relative_to(run/'rejected'), 'Genuine private import archive required.')
    for ident in imported:
        receipt = load(child/'raw'/(ident+'.receipt.json'))
        require(journal['new_mp3_sha256'][ident] == bank[ident] == digest(path(child/'clips'/(ident+'.mp3')))
            and load(run/'raw'/(ident+'.receipt.json')) == receipt
            and digest(path(run/'raw'/(ident+'.wav'))) == digest(path(child/'raw'/(ident+'.wav'))) == receipt['wav_sha256']
            and digest(path(archive/(ident+'.mp3'))) == snapshot['bank_mp3_sha256'][ident],
            'Actual selected Parent MP3/WAV/receipt or preserved previous audio differs.')
    # Derive an in-memory bank after our actual import. The historical Child12
    # snapshot stays byte-identical and continues to describe the native inputs.
    derived = copy.deepcopy(snapshot)
    derived['bank_mp3_sha256'].update(journal['new_mp3_sha256'])
    derived['bank_sha256'] = native_hash(derived['bank_mp3_sha256'])
    explained = retake.validated_disjoint_imports(child, run, derived, bank, selected_ids=imported)
    for p, h in explained.items():
        jp = path(p); require(digest(jp) == h, 'Validated disjoint import journal changed during proof collection.')
        other = jp.parent; other_snapshot_path = path(other/'parent-snapshot.private.json')
        other_snapshot = load(other_snapshot_path)
        other_ids = retake.journal_import_ids(load(jp), other_snapshot, digest(other_snapshot_path))
        other_info = load(other/'prepared.json')
        for name in {'prepared.json', 'parent-snapshot.private.json', 'requests.jsonl', *other_info['frozen_sha256']}:
            path(other/name)
        for name in other_snapshot['parent_file_sha256']: path(run/name)
        for ident in other_ids:
            for location in [other, run]:
                for folder, extension in [('clips', '.mp3'), ('raw', '.wav'), ('raw', '.receipt.json')]:
                    path(location/folder/(ident+extension))
    current_context = {'original_child_snapshot_sha256': digest(snapshot_path),
        'actual_own_import_journal_sha256': digest(journal_path), 'protected_own_import_ids': imported,
        'derived_post_own_import_bank_mp3_sha256': copy.deepcopy(derived['bank_mp3_sha256']),
        'derived_post_own_import_bank_sha256': derived['bank_sha256'],
        'derived_bank_is_in_memory_only_historical_snapshot_unchanged': True,
        'current_delta_after_own_import_ids': sorted(i for i, h in bank.items() if h != derived['bank_mp3_sha256'][i]),
        'validated_completed_disjoint_import_journal_sha256': explained,
        'disjoint_validator_script_sha256': digest(path(Path(retake.__file__).resolve(), external=True))}
    qa_path = path(bindings['qa_report_path']); report = load(qa_path); ids = set(rows)
    require(report['version'] == qa.VERSION and (report['model'] == qa.MODEL or report['model'].startswith(qa.MODEL+':'))
        and report['manifest_sha256'] == digest(path(run/'lines.private.json'))
        and type(report.get('finished_at')) is int and type(report.get('started_at')) is int
        and report['finished_at'] >= report['started_at'] and report['clip_sha256'] == bank
        and len(report['checked_ids']) == len(set(report['checked_ids'])) == FULL_COUNT and set(report['checked_ids']) == ids
        and len(report['takes']) == FULL_COUNT and {t['id'] for t in report['takes']} == ids
        and all(t['text_sha256'] == qa.text_hash(rows[t['id']]['text']) for t in report['takes']),
        'Actual complete finished current1557 Parent QA required, no stale source/audio/cache bank.')
    return journal, qa_path, report, current_context


def collect_evidence(run, line, bindings=None):
    run = Path(run).resolve(); value = case(line); ident = line['id']
    require(run.is_relative_to(qa.PRIVATE.resolve()) and (bindings is None or set(bindings) == KEYS),
        'Private run and complete explicit current Parent bindings required.')
    provenance = {}
    def path(value, external=False):
        p = Path(value); p = (p if p.is_absolute() else run/p).resolve()
        require(p.is_file() and (external or p.is_relative_to(run)), 'Evidence file unavailable or outside private run.')
        provenance[str(p)] = digest(p); return p
    def load(value, external=False): return core.read_json(path(value, external))
    common.prepared(run); child = run/CHILD
    retake.prepared(child, run, verify_bank=False)
    for name in ['prepared.json', 'requests.jsonl', 'source-snapshot.private.json', 'full-inventory.private.json']: path(run/name)
    manifest = load(run/'lines.private.json'); child_manifest = load(child/'lines.private.json')
    require(len(manifest['lines']) == len({r['id'] for r in manifest['lines']}) == FULL_COUNT
        and [r for r in manifest['lines'] if r['id'] == ident] == [line]
        and [r for r in child_manifest['lines'] if r['id'] == ident] == [line]
        and [r['id'] for r in child_manifest['lines']] == CHILD_IDS, 'Exact entire Parent and original full12 Child source inventory required.')
    profiles = load(run/'profiles.private.json')
    require(profiles == load(child/'profiles.private.json')
        and profiles['speakers'][value['speaker']]['google_voice'] == value['voice'], 'Original full fixed profiles/voice differ.')
    info = load(child/'prepared.json'); snapshot = load(child/'parent-snapshot.private.json')
    require(info['request_count'] == CHILD_COUNT and snapshot['parent'] == str(run) and snapshot['selected_ids'] == CHILD_IDS
        and snapshot['fixed_google_voices'][ident] == value['voice'], 'Actual frozen original full Child12 context differs.')
    requests = [json.loads(s) for s in path(child/'requests.jsonl').read_text().splitlines() if s.strip()]
    raw = [json.loads(s) for s in path(child/'responses.private.jsonl').read_text().splitlines() if s.strip()]
    require([r['key'] for r in requests] == [r['key'] for r in raw] == CHILD_IDS, 'Complete original unique twelve TTS requests/responses required.')
    request = next(r['request'] for r in requests if r['key'] == ident)
    req_hash = core.digest(json.dumps(request, sort_keys=True).encode()); parts = [p for c in request['contents'] for p in c['parts']]
    require(len(parts) == 2 and ''.join(p['text'] for p in parts) == line['text'] and [p['text'] for p in parts] == ['Ha! ', 'Da hat sie dich, Foltan.']
        and request['generationConfig']['speechConfig']['voiceConfig']['voice'] == value['voice']
        and snapshot['modified_request_sha256'][ident] == req_hash, 'Actual complete original two-part Source/request/voice differs.')
    audio_hash = digest(path(child/'clips'/(ident+'.mp3'))); wav = path(child/'raw'/(ident+'.wav'))
    receipt = load(child/'raw'/(ident+'.receipt.json'))
    require(audio_hash == value['clip_sha256'] and receipt['id'] == ident and receipt['status'] == 'complete'
        and receipt['model'] == core.MODEL and receipt['backend'] == 'batch' and receipt['mp3_sha256'] == audio_hash
        and receipt['wav_sha256'] == digest(wav) and receipt['request_sha256'] == req_hash
        and receipt['retake_parent_mp3_sha256'] == snapshot['bank_mp3_sha256'][ident], 'Actual original Child audio/receipt/WAV differs.')
    response = next(r['response'] for r in raw if r['key'] == ident); candidate = response['candidates'][0]
    require(response['modelVersion'] == core.MODEL and len(response['candidates']) == 1 and candidate['finishReason'] == 'STOP'
        and len(candidate['content']['parts']) == 1, 'Actual original complete TTS response differs.')
    inline = candidate['content']['parts'][0]['inlineData']
    require(inline['mimeType'] == 'audio/wav' and base64.b64decode(inline['data'], validate=True) == wav.read_bytes(), 'Actual raw provider WAV differs.')
    collection, job, intent = (load(child/name) for name in ['collection.private.json', 'job.json', 'submit-intent.private.json'])
    require(collection['collected'] == collection['expected'] == job['request_count'] == CHILD_COUNT and collection['failures'] == []
        and job['state'] == 'JOB_STATE_SUCCEEDED' and job['model'] == intent['model'] == core.MODEL
        and intent['state'] == 'CONFIRMED' and intent['input_sha256'] == info['input_sha256'], 'Actual completed original TTS12 ledgers required.')
    report = load(child/'qa-actual-primary-pass62.private.json')
    require(report['version'] == qa.VERSION and (report['model'] == qa.MODEL or report['model'].startswith(qa.MODEL+':'))
        and report['manifest_sha256'] == digest(path(child/'lines.private.json'))
        and report['checked_ids'] == CHILD_IDS and len(report['takes']) == CHILD_COUNT and {t['id'] for t in report['takes']} == set(CHILD_IDS)
        and report['finished_at'] >= report['started_at']
        and report['clip_sha256'] == {i: digest(path(child/'clips'/(i+'.mp3'))) for i in CHILD_IDS}, 'Actual complete original Primary12 required.')
    take = next(t for t in report['takes'] if t['id'] == ident)
    require(take['text_sha256'] == qa.text_hash(line['text']), 'Original Primary authored source differs.')
    primary = words(line, take['transcript'], 'primary'); cache = load(child/'qa-asr-cache.private.json')
    expected_keys = {qa.text_hash(qa.VERSION+'\0'+report['model']+'\0'+report['clip_sha256'][r['id']]+'\0'+r['text']) for r in child_manifest['lines']}
    require(set(cache) == expected_keys and len(cache) == CHILD_COUNT, 'Exactly the full actual original Primary12 cache required.')
    cache_key = qa.text_hash(qa.VERSION+'\0'+report['model']+'\0'+audio_hash+'\0'+line['text'])
    require(cache[cache_key] == {'clip_sha256': audio_hash, 'text_sha256': qa.text_hash(line['text']), 'transcript': take['transcript']},
        'Original unmodified actual Primary cache/transcript differs.')
    qc_path = path(child/'independent-vocal-qc'/(ident+'.'+audio_hash[:16]+'.json'))
    require(bindings is None or path(bindings['child_qc_record_path']) == qc_path, 'Actual original Child QC cache identity required.')
    record = load(qc_path); require(record['id'] == ident and qc.cached_record(record, audio_hash, qa.text_hash(line['text'])),
        'Genuine original blind QC model/prompt/schema/audio/source required.')
    provider_files = expressive.provider_files(child, line, record, audio_hash)
    batch = child/'independent-vocal-qc/batches/child-qc-pass62'
    require(set(provider_files) == {str((batch/n).relative_to(child)) for n in ['prepared.json', 'audio-snapshot.private.json',
        'requests.jsonl', 'submit-intent.private.json', 'job.json', 'collection.private.json', 'responses.private.jsonl']}
        and load(batch/'prepared.json')['request_count'] == CHILD_COUNT, 'Actual original full12 blind QC provider batch required.')
    for p, h in provider_files.items(): require(digest(path(child/p)) == h, 'Actual original complete QC12 provider ledger bytes differ.')
    qc_evidence = qc_observation(line, record); pro_evidence = original_pro_evidence(run, child, line, audio_hash, bindings, path, load)
    phones = native_proof(run, child, line, path, load)
    protected = {str(Path(m.__file__).resolve()): digest(m.__file__) for m in
        [qa, qc, expressive, native, matrices, common, core, retake, retake.generate, qc.transport, pro, pro.transport, pro.transport.asr]}
    result = {'status': 'root_review_required' if bindings is not None else 'offline_preflight_unapproved',
        'reviewed_by': '', 'reason': '', 'method': VERSION, 'id': ident, 'clip_sha256': audio_hash,
        'source_text_sha256': qa.text_hash(line['text']), 'source_row': copy.deepcopy(line), 'source_row_sha256': object_hash(line),
        'source_profiles_sha256': digest(run/'profiles.private.json'), 'voice': value['voice'], 'source_run': str(child),
        'current_parent_run': str(run), 'actual_child_request': request, 'actual_child_primary_evidence': primary,
        'actual_child_primary_take': take, 'actual_child_primary_cache_record': cache[cache_key],
        'actual_blind_child_QC': qc_evidence, 'actual_blind_child_Pro': pro_evidence, 'canonical_name_vowel': None, 'qc_record_sha256': object_hash(record),
        'raw_response_sha256': object_hash(record['response']), 'qc_contract': qc.cache_metadata(), 'native_Meta_evidence': phones,
        'actual_import_journal': None, 'base_qa_file': None, 'base_qa_sha256': None, 'qa_take': None,
        'parent_import_and_full_QA_required': True, 'provenance_files_sha256': provenance, 'protected_script_sha256': protected,
        'helper_script_sha256': digest(__file__), 'lexical_only_clearance': True, 'provider_timestamps_used': False,
        'timing_approval': None, 'acting_approval': None, 'listening_verdict': None,
        'limitations': 'Only Source96 on the exact original Child61 audio. Prime/QC foltern, Pro voll dran, native a x/extra h a/n ɪ ç and weak competing vowel scores remain literal. No generic alias, canonical vowel, acting, timing or hearing claim.'}
    if bindings is None: return result
    journal, qa_path, parent_report, current_context = validate_current_parent(run, child, manifest, snapshot, bindings, path, load)
    current_take = next(t for t in parent_report['takes'] if t['id'] == ident)
    words(line, current_take['transcript'], 'primary')
    signal = current_take['signal']
    require(type(signal.get('silent')) is bool and all(type(signal.get(k)) in (int, float) and math.isfinite(signal[k]) for k in
        ['seconds', 'peak', 'rms', 'clipped_fraction', 'leading_silence_seconds', 'trailing_silence_seconds', 'last_frame_rms'])
        and not qa.signal_failures(signal, len(qa.words(line['text']))), 'Current physical signal defects block this word proof.')
    result.update(actual_import_journal=journal, base_qa_file=str(qa_path), base_qa_sha256=digest(qa_path),
        qa_take=copy.deepcopy(current_take), parent_import_and_full_QA_required=False,
        current_parent_import_context=current_context)
    return result


def preflight(run, line):
    return collect_evidence(run, line)


def proof_template(run, line, bindings):
    require(isinstance(bindings, dict) and set(bindings) == KEYS, 'Complete actual current Parent bindings required.')
    return collect_evidence(run, line, bindings)


generate_record = proof_template


def review(run, line, bindings, approval=None):
    if approval is None: return None
    template = proof_template(run, line, bindings)
    require(isinstance(approval, dict) and set(approval) == set(template) and approval.get('status') == APPROVED
        and isinstance(approval.get('reviewed_by'), str) and approval['reviewed_by'].startswith('root ')
        and len(approval['reviewed_by'].strip()) > 5 and isinstance(approval.get('reason'), str)
        and len(approval['reason'].strip()) >= 20 and len(qa.words(approval['reason'])) >= 4,
        'Meaningful complete individual Root review required.')
    require(all(object_hash(approval[k]) == object_hash(v) for k, v in template.items() if k not in {'status', 'reviewed_by', 'reason'}),
        'Root proof differs from actual complete original and current evidence.')
    return {'id': line['id'], 'method': VERSION, 'resolution': 'root_approved_individual_child61_full_words',
        'clip_sha256': template['clip_sha256'], 'source_text_sha256': template['source_text_sha256'], 'proof': copy.deepcopy(approval),
        'lexical_only_clearance': True, 'provider_timestamps_used': False, 'timing_approval': None,
        'acting_approval': None, 'listening_verdict': None}


def main():
    common.configure(); parser = argparse.ArgumentParser(description=__doc__)
    for name in ['run-dir', 'output']: parser.add_argument('--'+name, type=Path, required=True)
    parser.add_argument('--bindings', type=Path); parser.add_argument('--preflight', action='store_true')
    parser.add_argument('--id', choices=tuple(CASES), required=True); args = parser.parse_args(); run = args.run_dir.resolve()
    require(not args.output.exists() and args.output.resolve().is_relative_to(run), 'New private unapproved output required.')
    require(args.preflight != (args.bindings is not None), 'Choose unapproved preflight or actual complete current Parent bindings.')
    line = next(r for r in core.read_json(run/'lines.private.json')['lines'] if r['id'] == args.id)
    template = preflight(run, line) if args.preflight else proof_template(run, line, core.read_json(args.bindings))
    qa.save(args.output, template)


if __name__ == '__main__':
    try: main()
    except (core.SafeError, OSError, ValueError, KeyError, TypeError, StopIteration) as error:
        raise SystemExit(str(error) if isinstance(error, core.SafeError) else 'Invalid actual Child61 evidence; nothing imported or approved.')
