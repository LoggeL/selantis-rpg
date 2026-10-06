#!/usr/bin/env python3
"""Two exact Child57 lexical cases, using original offline Native17 evidence.

No inference, import or approval. The historical execution bank is retained
separately from the actual six-source import and new complete Parent QA.
"""
from __future__ import annotations
import argparse
import base64
import copy
import hashlib
import json
import math
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

VERSION = 'child57-two-individual-native17-word-evidence-v1'
APPROVED = 'approved_individual_child57_full_word_evidence'
CHILD = 'retake-batches/german-diction-18-pass57'
META = 'german-diction-18-pass57/native17-pass58'
HISTORY = 'german-diction-18-pass57/offline-case-review58/native-positive2-59/original355-context'
FULL_COUNT = 1557
CHILD_COUNT = 18
STUTTER_ID = 'story-e8279fc19ea0421d15120f1f'
NAMES_ID = 'story-1aeac577ac4dc1a0ba8f00d2'
EXCLUDED_ID = 'story-a2671f9741cc8a3f38333e5e'
CHILD_IDS = ['story-1aeac577ac4dc1a0ba8f00d2', 'story-426cbccb80e972d6056d7719',
    'story-43684c454bac0db005986772', 'story-45cf6c5149543786a3a5a23b',
    'story-5bcb6a206a27e7d7e591df27', 'story-67e24e24b2c673faa711abfb',
    'story-7ea9552d0dab68561d490184', 'story-96bf3614b339ca923be41f97',
    'story-992066ca674648e66c9f732f', 'story-a0048bb6f133cd08ba01ecdb', EXCLUDED_ID,
    'story-a3cd5eb91bc73369b09a34c6', 'story-d22ce7666e5e476080d3f658',
    'story-dae3640e33adc257f65813e4', 'story-dfc39fc851835d9c5c4b9b77', STUTTER_ID,
    'story-f06a5efd19de5a02af97d1f0', 'story-f5f44c94534bc777e915aa44']
META_IDS = [i for i in CHILD_IDS if i != EXCLUDED_ID]
IMPORT_IDS = [NAMES_ID, 'story-426cbccb80e972d6056d7719', 'story-992066ca674648e66c9f732f',
    EXCLUDED_ID, STUTTER_ID, 'story-f5f44c94534bc777e915aa44']
FROZEN_PLAN_SHA256 = '734ba9c8e2e76a53d7e7e4cf40423891b2a4719da10cb4bcfab470007fe08a54'
FROZEN_RUNNER_SHA256 = 'd53cfd392006fcb50e9d30fda67051d329bf23394351966523b05fb59ddb6091'
FROZEN_NATIVE_OUTPUT_SHA256 = '2430e5a272a2e9705f50b9c4a7d0128c10adced21b7677ce2dfde0b1ffeda3a7'
FROZEN_HISTORY_SHA256 = '5422da66f48f8eec496357ebda811447798f2021dd502461a98af61f5f71000f'
FROZEN_JOURNAL_HISTORY_SHA256 = 'b1379af3b94d3b1be6c7db96528c129dc2fa01cbfea32c42a71e2f082788e2e4'
KEYS = {'qa_report_path', 'child_qc_record_path', 'child_import_journal_path'}
CASES = {
    STUTTER_ID: {'text': 'D-der sitzt jetzt. In hartem Boden. Ehrlich.', 'speaker': 'maedchen',
        'voice': 'Sadachbia', 'clip_sha256': '0b46a33d7ebfa07df94e618bb06a64d1b3094c624f0b53772bf20ebc22b10313',
        'primary_transcript': 'Der sitzt jetzt. In hartem Boden. Ehrlich.',
        'qc_transcript': 'Der sitzt jetzt in hartem Boden ehrlich',
        'raw_ipa': 'd d ɛ ɾ z ɪ ts t j ɛ ts t ɪ n h a ɾ t ə m b oː d ə n eː ɾ l ɪ ç'},
    NAMES_ID: {'text': 'Was hat Craupor wirklich gesagt, Foltan?', 'speaker': 'lia', 'voice': 'Zephyr',
        'clip_sha256': 'fac99a074677c0f97591ecccb43d13bb785cedbe058826062b83176f44155387',
        'primary_transcript': 'Was hat Kraupor wirklich gesagt foltern?',
        'qc_transcript': 'Was hat Kraupor wirklich gesagt, Voltan?',
        'raw_ipa': 'v a s h a t k r aʊ p oː ɾ v ɪ ɾ k l ɪ ç ɡ ə z a k t f ɔ l t a n'}
}
STUTTER_EVENTS = [
    {'category': 'other', 'description': 'panting breath', 'vocal_sound': 'h', 'confidence': .8},
    {'category': 'groan', 'description': 'labored breath and groan', 'vocal_sound': 'h-ə', 'confidence': .75},
    {'category': 'other', 'description': 'exhaled breath', 'vocal_sound': 'h', 'confidence': .75}]
require = native.require
digest = native.digest
object_hash = native.object_hash
native_hash = native.native_hash
native_array_events = matrices.native_array_events
native_runtime = matrices.native_runtime
ctc_frames = matrices.ctc_frames


def case(line):
    require(line.get('id') in CASES, 'Only the two exact Child57 sources are supported.')
    value = CASES[line['id']]
    require(line.get('text') == value['text'] and line.get('speaker') == value['speaker'],
        'Exact authored source and speaker required.')
    return value


def words(line, transcript, channel):
    value = case(line)
    require(channel in {'primary', 'qc'} and transcript == value[channel+'_transcript'],
        'Complete original individually scoped transcript required; no additions or drops.')
    expected, observed = qa.words(line['text']), qa.words(transcript)
    result = {'channel': channel, 'full_actual_transcript': transcript, 'expected_tokens': expected,
        'observed_tokens': observed, 'decoder_text_adopted': False}
    if line['id'] == STUTTER_ID:
        require(expected[:2] == ['d', 'der'] and observed == expected[1:],
            'All seven full body words must be literal; only the written d-prefix needs separate evidence.')
        result.update(literal_seven_body_words=observed, unresolved_decoder_stutter_prefix='d',
            stutter_prefix_source_word_index=0, general_drop_or_segmentation_alias=False)
    else:
        require(len(expected) == len(observed) == 6 and expected[2] == 'craupor'
            and observed[2] == 'kraupor' and qa.named_spelling_equivalent('Craupor', 'Kraupor')
            and observed[5] == ('foltern' if channel == 'primary' else 'voltan')
            and all(a == b for j, (a, b) in enumerate(zip(expected, observed)) if j not in {2, 5}),
            'All four non-name words and individually scoped name spellings required.')
        result.update(literal_four_non_name_words=[expected[j] for j in [0, 1, 3, 4]],
            single_source_bound_existing_c_k_spelling={'source_word_index': 2, 'expected': 'Craupor',
                'observed': 'Kraupor', 'existing_named_spelling_equivalent': True},
            Foltan_decoder_spelling_alias=False)
    return result


def qc_observation(line, record):
    case(line)
    observation = qc.response_observation(record['response'])
    result = words(line, observation['transcript'], 'qc')
    events = STUTTER_EVENTS if line['id'] == STUTTER_ID else []
    require(observation['events'] == events, 'Every original QC event/category/description/sound/confidence must remain exact.')
    result.update(actual_events=copy.deepcopy(events), source_gesture_event_mapping=None,
        QC_breaths_retained_as_diagnostic_only=True, vocal_or_acting_clearance=None)
    return result


def native_frames(line, logits, probabilities, ids, vocab, observation):
    value = case(line)
    events = native_array_events(logits, probabilities, ids, vocab, observation)
    require(observation['raw_ipa'] == value['raw_ipa'], 'Entire exact genuine native output required, with every terminal phone.')
    result = {'full_verbatim_free_ipa': observation['raw_ipa'], 'full_verbatim_events': copy.deepcopy(events),
        'model_phone_to_word_timestamps': None, 'no_canonical_name_vowel_duration_or_acting_claim': True}
    if line['id'] == STUTTER_ID:
        chosen = events[:4]
        require([e['token'] for e in chosen] == ['d', 'd', 'ɛ', 'ɾ']
            and all(e['actual_argmax_softmax_probability'] >= .8 for e in chosen[:2])
            and chosen[0]['frame_index'] < chosen[1]['frame_index'], 'Two distinct actual d emissions and following Der required.')
        result.update(selected_event_indices={'start_index': 0, 'end_index_exclusive': 4},
            selected_events=copy.deepcopy(chosen), written_prefix_source_word_index=0,
            whole_Der_source_word_index=1, general_stutter_mapper=False, breath_event_mapping=None)
    else:
        craupor, foltan = events[6:12], events[25:31]
        require([e['token'] for e in craupor] == ['k', 'r', 'aʊ', 'p', 'oː', 'ɾ']
            and [e['token'] for e in foltan] == ['f', 'ɔ', 'l', 't', 'a', 'n'], 'Exactly the two actual complete selected name observations required.')
        frame = foltan[0]['frame_index']; f, v = (float(probabilities[frame, vocab[token]]) for token in ['f', 'v'])
        require(f >= .95 and v <= .02 and f > v, 'Selected native f onset lacks required actual evidence.')
        result.update(Craupor={'source_word_index': 2, 'selected_event_indices': [6, 12], 'actual_events': copy.deepcopy(craupor)},
            Foltan={'source_word_index': 5, 'selected_event_indices': [25, 31], 'actual_events': copy.deepcopy(foltan),
                'f_uncalibrated_softmax': f, 'v_uncalibrated_softmax': v}, general_F_V_or_vowel_alias=False)
    return result


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
        == {n for n in names if n.startswith('results/')}, 'Exact original complete Native17 result tree required.')
    bindings = {name: digest(path(base/name)) for name in names}
    require(object_hash(bindings) == FROZEN_NATIVE_OUTPUT_SHA256,
        'All 92 original Native17 outputs required; coordinated rehashing cannot substitute evidence.')
    return bindings


def native_execution_scope(run, child, plan, completion, execution, gate, runner_hash, plan_hash):
    require(isinstance(gate, dict) and {'status', 'reviewed_by', 'model', 'revision', 'selected_ids',
        'child_scope_ids', 'excluded_id', 'runner_sha256', 'plan_sha256', 'max_forward_calls',
        'max_active_local_models', 'one_active_local_model', 'current_parent_audio_delta_ids', 'audio_sha256'} <= set(gate),
        'Complete separate original Root execution guard required.')
    require(plan_hash == FROZEN_PLAN_SHA256 and runner_hash == FROZEN_RUNNER_SHA256
        and plan['root_forward_approval_required'] is True and plan['original_full_child18_guard'] is True
        and plan['actual_full_QC18_guard'] is True and plan['source_child_retake_prepared_full1557_verified'] is True,
        'Genuine exact frozen Native17 original full Child18 guards required.')
    require(plan['source_run'] == str(child) and plan['parent_run'] == str(run)
        and plan['model'] == execution['model'] == gate['model'] == native.MODEL
        and plan['revision'] == execution['revision'] == gate['revision'] == native.REVISION
        and plan['scope'] == execution['ids'] == gate['selected_ids'] == META_IDS
        and gate['child_scope_ids'] == CHILD_IDS and gate['excluded_id'] == EXCLUDED_ID,
        'Exact blind Native17 source/model/excluded-a267 scope differs.')
    require(completion['status'] == 'observations_complete' and completion['calls'] == 17 and completion['approval'] is None
        and completion['runner_sha256'] == execution['runner_sha256'] == plan['runner_sha256'] == runner_hash
        and completion['plan_sha256'] == execution['plan_sha256'] == gate['plan_sha256'] == plan_hash
        and gate['runner_sha256'] == runner_hash and gate['status'] == 'approved_execution_scope'
        and isinstance(gate['reviewed_by'], str) and gate['reviewed_by'].startswith('root ')
        and gate['max_forward_calls'] == execution['max_forward_calls'] == plan['max_forward_calls'] == 17
        and gate['max_active_local_models'] == execution['max_active_local_models'] == plan['max_active_local_models'] == 1
        and gate['one_active_local_model'] is True and gate['current_parent_audio_delta_ids'] == []
        and gate['audio_sha256'] == execution['mp3_sha256'], 'Actual prior Root execution gate/completion required, no word approval follows.')


def historical_parent_context(run, snapshot, freeze, path, load):
    """Read historical bytes; never run the former delta-zero guard on today's bank."""
    archive_path = path(run/HISTORY/'archive-bindings.private.json')
    require(digest(archive_path) == FROZEN_HISTORY_SHA256, 'Exact genuine preimport history archive required.')
    archive = load(archive_path)
    require(archive['original_full_parent_bank_matches_child18_snapshot'] is True
        and archive['parent_audio_delta_ids'] == freeze['expected_parent_audio_delta_ids'] == []
        and archive['bank_count'] == freeze['current_parent_bank_count'] == FULL_COUNT
        and archive['bank_sha256'] == freeze['current_parent_bank_sha256'] == snapshot['bank_sha256']
        and native_hash(snapshot['bank_mp3_sha256']) == snapshot['bank_sha256'], 'Original full historical bank/hash/delta differs.')
    for original, binding in archive['original_path_archive_bindings'].items():
        require(binding['historical_only_not_native_input'] is True
            and digest(path(binding['archive'])) == binding['sha256'], 'Original historical QA/cache/cue/receipt archive changed.')
    old_qa = load(archive['original_path_archive_bindings'][str(run/'qa-pass56.private.json')]['archive'])
    require(old_qa['clip_sha256'] == snapshot['bank_mp3_sha256']
        and len(old_qa['takes']) == len(old_qa['checked_ids']) == len(set(old_qa['checked_ids'])) == FULL_COUNT
        and old_qa['finished_at'] >= old_qa['started_at'], 'Actual original full preimport QA archive differs.')
    journal_path = path(run/HISTORY/'completed355-imports.private.json')
    require(digest(journal_path) == FROZEN_JOURNAL_HISTORY_SHA256, 'Exact original factual historical journal inventory required.')
    history = load(journal_path); total = 0
    for p, binding in history['completed_import_journals'].items():
        require(digest(path(p)) == binding['sha256'], 'Original previous completed import journal changed.')
        journal = load(p)
        if 'snapshot_path' in binding:
            snap_path = path(binding['snapshot_path']); other_snapshot = load(snap_path)
            require(digest(snap_path) == binding['snapshot_sha256'] and journal['state'] == 'IMPORTED'
                and retake.journal_import_ids(journal, other_snapshot, digest(snap_path)) == binding['selected_ids'],
                'Original previous completed retake subset differs.')
            total += len(binding['selected_ids'])
        else:
            require(journal['state'] == binding['state'] and journal['id'] == binding['id'], 'Actual original single Pff journal differs.')
    require(total == history['actual_retakes_selected_id_sum'] == 323, 'Actual historical selected-ID count differs.')
    for p, h in freeze['completed_previous_import_journal_sha256'].items():
        require(digest(path(p)) == h and load(p)['state'] == 'IMPORTED', 'Original Native17 preceding Child51/Child9 completed imports differ.')
    return {'historical_bank_sha256': snapshot['bank_sha256'], 'historical_audio_delta_ids': [],
        'historical_files_are_not_current_bank': True, 'original_qa_archive': str(run/HISTORY/'qa-pass56.private.json'),
        'factual_historical_import_inventory_sha256': digest(journal_path),
        'root_reported_action_counter_not_used_as_evidence': True}


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
        and freeze['excluded_id'] == EXCLUDED_ID and freeze['Child18_import_subset'] is None,
        'Original preimport full18 provenance/17 forward scope required.')
    for table in ['qc18_original_provenance_file_sha256', 'verified_native55_baseline_file_sha256']:
        for p, h in freeze[table].items():
            require(digest(path(p)) == h, 'Actual original QC18 or native baseline provenance changed.')
    qc_freeze_path = path(run/'german-diction-18-pass57/qc-adapter58/freeze.private.json')
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
        require(digest(path(child/p)) == h, 'Original full18 TTS/Primary evidence changed.')
    for p, h in qc_freeze['original_script_sha256'].items():
        require(digest(path(common.ROOT/'scripts'/p, external=True)) == h, 'Original protected TTS/QA/QC implementation changed.')
    original_bindings = plan['source_file_bindings']
    require(len(original_bindings) == len({b['path'] for b in original_bindings}) == 110,
        'Exactly all original 110 native execution input bindings required.')
    for binding in original_bindings:
        require(digest(path(binding['path'], external=True)) == binding['sha256'], 'Original frozen native source/runtime input changed.')
    history = historical_parent_context(run, load(child/'parent-snapshot.private.json'), freeze, path, load)
    params = plan['params']
    require(params == execution['actual_params'] and native_hash(params) == plan['params_sha256'] == execution['actual_params_sha256']
        and params['do_phonemize'] is False and params['source_text_input'] is False and params['forced_alignment'] is False
        and params['beam_search'] is False and params['timestamps'] is False and params['lexicon'] is None
        and params['language_hint'] is None and params['device'] == 'cpu' and params['sample_rate'] == 16000
        and params['max_forward_calls'] == 17, 'Original complete blind native parameters differ.')
    runtime = load(base/'results/native-model-runtime.private.json')
    require(runtime['model_loaded_only_after_exact_root_review'] is True and runtime['serialized_forwards'] is True
        and runtime['loaded_acoustic_model_instances'] == 1 and runtime['parameter_dtypes'] == ['torch.float32']
        and runtime['root_execution_review_sha256'] == gate_hash and runtime['approval'] is None,
        'Genuine one-model serialized Root runtime execution record required.')
    require([c['id'] for c in plan['clips']] == [c['id'] for c in context['records']] == META_IDS,
        'Exactly every native forward/context required.')
    child_rows = {r['id']: r for r in load(child/'lines.private.json')['lines']}
    requests = [json.loads(s) for s in path(child/'requests.jsonl').read_text().splitlines() if s.strip()]
    takes = {t['id']: t for t in load(child/'qa-actual-primary-pass57.private.json')['takes']}
    raw_qc = [json.loads(s) for s in path(child/'independent-vocal-qc/batches/child-qc-pass58/responses.private.jsonl').read_text().splitlines() if s.strip()]
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
            p = path(base/obs[file_key]); require(digest(p) == obs[hash_key], 'Original full Native17 matrix changed.')
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
        original_native_result_files_sha256=results, complete_seventeen_forward_verification=complete,
        historical_execution_context_bindings=copy.deepcopy(original_bindings), historical_parent_context=history,
        execution_gate_sha256=gate_hash)
    return selected


def validate_current_parent(run, child, manifest, snapshot, bindings, path, load):
    journal_path = path(bindings['child_import_journal_path'])
    require(journal_path == child/'import.private.json', 'Actual original Child57 import journal required.')
    journal = load(journal_path); snapshot_path = path(child/'parent-snapshot.private.json')
    imported = retake.journal_import_ids(journal, snapshot, digest(snapshot_path))
    require(journal['state'] == 'IMPORTED' and imported == IMPORT_IDS and journal['validated_disjoint_import_journal_sha256'] == {},
        'Actual single completed exact six-source Child18 import required.')
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
    # Derive an in-memory bank after our actual import. The historical Child18
    # snapshot stays byte-identical and continues to describe the native inputs.
    derived = copy.deepcopy(snapshot)
    derived['bank_mp3_sha256'].update(journal['new_mp3_sha256'])
    derived['bank_sha256'] = native_hash(derived['bank_mp3_sha256'])
    explained = retake.validated_disjoint_imports(child, run, derived, bank, selected_ids=IMPORT_IDS)
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
        and [r['id'] for r in child_manifest['lines']] == CHILD_IDS, 'Exact entire Parent and original full18 Child source inventory required.')
    profiles = load(run/'profiles.private.json')
    require(profiles == load(child/'profiles.private.json')
        and profiles['speakers'][value['speaker']]['google_voice'] == value['voice'], 'Original full fixed profiles/voice differ.')
    info = load(child/'prepared.json'); snapshot = load(child/'parent-snapshot.private.json')
    require(info['request_count'] == CHILD_COUNT and snapshot['parent'] == str(run) and snapshot['selected_ids'] == CHILD_IDS
        and snapshot['fixed_google_voices'][ident] == value['voice'], 'Actual frozen original full Child18 context differs.')
    requests = [json.loads(s) for s in path(child/'requests.jsonl').read_text().splitlines() if s.strip()]
    raw = [json.loads(s) for s in path(child/'responses.private.jsonl').read_text().splitlines() if s.strip()]
    require([r['key'] for r in requests] == [r['key'] for r in raw] == CHILD_IDS, 'Complete original unique eighteen TTS requests/responses required.')
    request = next(r['request'] for r in requests if r['key'] == ident)
    req_hash = core.digest(json.dumps(request, sort_keys=True).encode()); parts = [p for c in request['contents'] for p in c['parts']]
    require(len(parts) == 1 and parts[0]['text'] == line['text']
        and request['generationConfig']['speechConfig']['voiceConfig']['voice'] == value['voice']
        and snapshot['modified_request_sha256'][ident] == req_hash, 'Actual full Singlepart Source/request/voice differs.')
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
        and intent['state'] == 'CONFIRMED' and intent['input_sha256'] == info['input_sha256'], 'Actual completed original TTS18 ledgers required.')
    report = load(child/'qa-actual-primary-pass57.private.json')
    require(report['version'] == qa.VERSION and (report['model'] == qa.MODEL or report['model'].startswith(qa.MODEL+':'))
        and report['manifest_sha256'] == digest(path(child/'lines.private.json'))
        and report['checked_ids'] == CHILD_IDS and len(report['takes']) == CHILD_COUNT and {t['id'] for t in report['takes']} == set(CHILD_IDS)
        and report['finished_at'] >= report['started_at']
        and report['clip_sha256'] == {i: digest(path(child/'clips'/(i+'.mp3'))) for i in CHILD_IDS}, 'Actual complete original Primary18 required.')
    take = next(t for t in report['takes'] if t['id'] == ident)
    require(take['text_sha256'] == qa.text_hash(line['text']), 'Original Primary authored source differs.')
    primary = words(line, take['transcript'], 'primary'); cache = load(child/'qa-asr-cache.private.json')
    expected_keys = {qa.text_hash(qa.VERSION+'\0'+report['model']+'\0'+report['clip_sha256'][r['id']]+'\0'+r['text']) for r in child_manifest['lines']}
    require(set(cache) == expected_keys and len(cache) == CHILD_COUNT, 'Exactly the full actual original Primary18 cache required.')
    cache_key = qa.text_hash(qa.VERSION+'\0'+report['model']+'\0'+audio_hash+'\0'+line['text'])
    require(cache[cache_key] == {'clip_sha256': audio_hash, 'text_sha256': qa.text_hash(line['text']), 'transcript': take['transcript']},
        'Original unmodified actual Primary cache/transcript differs.')
    qc_path = path(child/'independent-vocal-qc'/(ident+'.'+audio_hash[:16]+'.json'))
    require(bindings is None or path(bindings['child_qc_record_path']) == qc_path, 'Actual original Child QC cache identity required.')
    record = load(qc_path); require(record['id'] == ident and qc.cached_record(record, audio_hash, qa.text_hash(line['text'])),
        'Genuine original blind QC model/prompt/schema/audio/source required.')
    provider_files = expressive.provider_files(child, line, record, audio_hash)
    batch = child/'independent-vocal-qc/batches/child-qc-pass58'
    require(set(provider_files) == {str((batch/n).relative_to(child)) for n in ['prepared.json', 'audio-snapshot.private.json',
        'requests.jsonl', 'submit-intent.private.json', 'job.json', 'collection.private.json', 'responses.private.jsonl']}
        and load(batch/'prepared.json')['request_count'] == CHILD_COUNT, 'Actual original full18 blind QC provider batch required.')
    for p, h in provider_files.items(): require(digest(path(child/p)) == h, 'Actual original complete QC18 provider ledger bytes differ.')
    qc_evidence = qc_observation(line, record); phones = native_proof(run, child, line, path, load)
    protected = {str(Path(m.__file__).resolve()): digest(m.__file__) for m in
        [qa, qc, expressive, native, matrices, common, core, retake, retake.generate, qc.transport]}
    result = {'status': 'root_review_required' if bindings is not None else 'offline_preflight_unapproved',
        'reviewed_by': '', 'reason': '', 'method': VERSION, 'id': ident, 'clip_sha256': audio_hash,
        'source_text_sha256': qa.text_hash(line['text']), 'source_row': copy.deepcopy(line), 'source_row_sha256': object_hash(line),
        'source_profiles_sha256': digest(run/'profiles.private.json'), 'voice': value['voice'], 'source_run': str(child),
        'current_parent_run': str(run), 'actual_child_request': request, 'actual_child_primary_evidence': primary,
        'actual_child_primary_take': take, 'actual_child_primary_cache_record': cache[cache_key],
        'actual_blind_child_QC': qc_evidence, 'qc_record_sha256': object_hash(record),
        'raw_response_sha256': object_hash(record['response']), 'qc_contract': qc.cache_metadata(), 'native_Meta_evidence': phones,
        'actual_import_journal': None, 'base_qa_file': None, 'base_qa_sha256': None, 'qa_take': None,
        'parent_import_and_full_QA_required': True, 'provenance_files_sha256': provenance, 'protected_script_sha256': protected,
        'helper_script_sha256': digest(__file__), 'lexical_only_clearance': True, 'provider_timestamps_used': False,
        'timing_approval': None, 'acting_approval': None, 'listening_verdict': None,
        'limitations': 'Only this exact original audio/source. All decoder diagnoses and QC breaths remain literal. No generic stutter, F/V or vowel/name alias, canonical pronunciation, acting, timing or hearing claim.'}
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
    return {'id': line['id'], 'method': VERSION, 'resolution': 'root_approved_individual_child57_full_words',
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
        raise SystemExit(str(error) if isinstance(error, core.SafeError) else 'Invalid actual Child57 evidence; nothing imported or approved.')
