#!/usr/bin/env python3
"""Offline, individually reviewed word proof for two actual Child51 takes.

This preserves Child QC identity, the complete authored text and every original
decoder diagnosis. It neither performs inference nor imports or approves audio.
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
import sys
import numpy as np
import story_voice_common as common
from story_voice_common import core
import story_voice_qa as qa
import story_voice_vocal_qc as qc
import story_voice_expressive_events as expressive
import story_voice_meta_name_evidence as native
import story_voice_retake_batch as retake

VERSION = 'child51-two-individual-full-word-evidence-v1'
APPROVED = 'approved_individual_child51_full_word_evidence'
CHILD = 'retake-batches/final-word-pilots51'
META = 'final-word-pilots51/offline-qc-native52/meta-final-word-selected8-pass52'
META_IDS = ['story-1aeac577ac4dc1a0ba8f00d2', 'story-36d28c8dd3cae91142321344',
    'story-5d344ec2246a034dc657814d', 'story-96bf3614b339ca923be41f97',
    'story-992066ca674648e66c9f732f', 'story-d22ce7666e5e476080d3f658',
    'story-f06a5efd19de5a02af97d1f0', 'story-e8279fc19ea0421d15120f1f']
FROZEN_PLAN_SHA256 = '6b492f5b33149db1c700c0f80b45defdf00b6c7899d71fc446a6b7e07f8d0d2c'
FROZEN_RUNNER_SHA256 = '9aa1d4a33d11821f46e257249845d092d14203c723a00d962139d78e78ca6852'
# Exact original Root pass52 outputs, including every full array for all eight
# forwards. A rehashed observation cannot substitute a modified result.
FROZEN_NATIVE_OUTPUT_SHA256 = '2db5b2a21fad3fbda6372f043379cc57191bbfa21d9c48ba710d4bf9194f717d'
FULL_COUNT = 1557
CHILD_COUNT = 21
KEYS = {'qa_report_path', 'child_qc_record_path', 'child_import_journal_path'}
COMPANION_ID = 'story-36d28c8dd3cae91142321344'
RELIEF_ID = 'story-5d344ec2246a034dc657814d'
CASES = {
    COMPANION_ID: {'text': 'Ohne Foltan und Azar gehe ich nirgendwohin.', 'speaker': 'lia',
        'voice': 'Zephyr', 'clip_sha256': '53ee641038617fd0c7bb1eea2c3470bff33b3ac8e707d9444f9ccde5ba7d4c34',
        'primary_transcript': 'Ohne Foltern und Azar gehe ich nirgendwo hin.',
        'qc_transcript': 'Ohne Voltan und Asara geh ich nirgendswohin.', 'name_word_index': 1,
        'native_name_indices': [3, 9]},
    RELIEF_ID: {'text': 'Ahhh … himmlisch. Foltan, sie bleibt. Ich bestehe darauf.', 'speaker': 'azar',
        'voice': 'Zubenelgenubi', 'clip_sha256': '9fb1e4bd0ea57646c1c1d77de37194a67fa3247b23310bd62639e12687c609cb',
        'primary_transcript': 'Oh, himmlisch. Volltan, sie bleibt. Ich bestehe darauf.',
        'qc_transcript': 'Ah, himmlisch. Spontan, sie bleibt. Ich bestehe darauf.', 'name_word_index': 2,
        'native_name_indices': [7, 13]}
}
RELIEF_EVENT = {'category': 'groan', 'description': 'deep sigh of relief and satisfaction',
    'vocal_sound': 'aːːh', 'confidence': .9}
require = native.require
digest = native.digest
object_hash = native.object_hash
native_hash = native.native_hash


def case(line):
    require(line.get('id') in CASES, 'Only the two exact Child51 sources are supported.')
    value = CASES[line['id']]
    require(line.get('text') == value['text'] and line.get('speaker') == value['speaker'],
        'Exact authored source and speaker required.')
    return value


def words(line, transcript, channel):
    value = case(line)
    expected = qa.words(line['text'])
    actual = qa.words(transcript)
    require(channel in {'primary', 'qc'} and transcript == value[channel+'_transcript'],
        'Complete individually scoped decoder body differs; no insertions, drops or other substitutions.')
    result = {'channel': channel, 'full_actual_transcript': transcript, 'expected_tokens': expected,
        'observed_tokens': actual, 'decoder_spelling_adopted': False}
    if line['id'] == COMPANION_ID and channel == 'primary':
        source_body = expected[:1]+expected[2:]
        actual_body = actual[:1]+actual[2:]
        require(''.join(source_body) == ''.join(actual_body), 'All non-name Primary characters must be exact.')
        require(actual[-2:] == ['nirgendwo', 'hin'] and expected[-1] == 'nirgendwohin', 'Exact scoped segmentation required.')
        result['non_name_body_characters'] = ''.join(source_body)
        result['segmentation_only'] = {'source_word': 'nirgendwohin', 'observed_words': ['nirgendwo', 'hin'],
            'general_orthographic_alias': False}
    elif line['id'] == RELIEF_ID:
        body = [w for j,w in enumerate(actual) if j not in {0,2}]
        require(body == [w for j,w in enumerate(expected) if j not in {0,2}] and len(body) == 6,
            'All six written body words must be exact.')
        result['literal_six_body_words'] = body
    else:
        result['role'] = 'Retained actual QC diagnosis only; no Azar, verb or body word clearance.'
    return result


def qc_observation(line, record):
    case(line)
    value = qc.response_observation(record['response'])
    result = words(line, value['transcript'], 'qc')
    expected_events = [] if line['id'] == COMPANION_ID else [RELIEF_EVENT]
    require(value['events'] == expected_events,
        'Exact original event list required; never relabel, omit or add an event.')
    result['actual_events'] = copy.deepcopy(value['events'])
    if line['id'] == RELIEF_ID:
        result['scoped_written_exclamation'] = {'source_word_index': 0, 'source_word': 'Ahhh',
            'event_index': 0, 'event_category_preserved': 'groan', 'event_location_qualified': False,
            'vowel_duration_qualified': False}
    return result


def native_array_events(logits, probabilities, ids, vocab, observation):
    require(logits.dtype == np.float32 and probabilities.dtype == np.float64,
        'Original full float32 logits and float64 softmax required.')
    require(sorted(vocab.values()) == list(range(392)) and vocab.get('<pad>') == 0,
        'Original complete native 392-class vocabulary required.')
    require(logits.ndim == 3 and logits.shape[0] == 1 and logits.shape[2] == 392 and logits.shape[1] > 0,
        'Complete native 392-class matrix required.')
    require(np.isfinite(logits).all() and probabilities.shape == logits.shape[1:] and np.isfinite(probabilities).all(),
        'Invalid complete native matrices.')
    require(np.issubdtype(ids.dtype, np.integer) and ids.shape == (logits.shape[1],)
        and np.array_equal(ids, logits[0].argmax(axis=-1)), 'Actual full native argmax differs.')
    shifted = logits[0].astype(np.float64)-logits[0].max(axis=-1, keepdims=True)
    calculated = np.exp(shifted); calculated /= calculated.sum(axis=-1, keepdims=True)
    require(np.array_equal(calculated, probabilities), 'Actual complete softmax differs.')
    labels = {v:k for k,v in vocab.items()}; events = []; previous = None
    for frame, token in enumerate(ids):
        token = int(token)
        if token != previous and token != 0:
            events.append({'frame_index': frame, 'class_id': token, 'token': labels[token],
                'actual_argmax_softmax_probability': float(probabilities[frame, token])})
        previous = token
    require(events == observation['emitted_raw_tokens'] and ' '.join(e['token'] for e in events)
        == observation['raw_ipa'] == observation['native_decode'], 'Complete native collapsed output differs.')
    return events


def native_frames(line, logits, probabilities, ids, vocab, observation):
    value = case(line)
    events = native_array_events(logits, probabilities, ids, vocab, observation)
    start, end = value['native_name_indices']; chosen = events[start:end]
    require([e['token'] for e in chosen] == ['f', 'ɔ', 'l', 't', 'a', 'n'],
        'Exactly the actual six scoped Foltan phones required.')
    onset = chosen[0]['frame_index']; f = float(probabilities[onset, vocab['f']]); v = float(probabilities[onset, vocab['v']])
    require(f >= .95 and v <= .02 and f > v, 'Selected native f onset lacks required evidence.')
    result = {'full_verbatim_free_ipa': observation['raw_ipa'], 'selected_event_indices':
        {'start_index': start, 'end_index_exclusive': end}, 'selected_events': copy.deepcopy(chosen),
        'selected_f_uncalibrated_softmax': f, 'selected_v_uncalibrated_softmax': v,
        'name_source_word_index': value['name_word_index'], 'no_name_spelling_alias': True,
        'no_vowel_duration_or_canonical_name_claim': True}
    if line['id'] == RELIEF_ID:
        require(events[0]['token'] == 'ɑː', 'Actual literal opening native vowel required.')
        result['actual_opening_event'] = copy.deepcopy(events[0])
        result['opening_source_word_index'] = 0
    else:
        result['Azar_phone_claim'] = None
    return result


def ctc_frames(sample_count, config):
    kernels, strides = config.get('conv_kernel'), config.get('conv_stride')
    require(type(sample_count) is int and sample_count > 0 and isinstance(kernels, list)
        and isinstance(strides, list) and len(kernels) == len(strides) > 0, 'Native convolution geometry required.')
    for kernel, stride in zip(kernels, strides):
        require(type(kernel) is int and type(stride) is int and kernel > 0 and stride > 0,
            'Invalid native convolution geometry.')
        sample_count = (sample_count-kernel)//stride+1
    require(sample_count > 0, 'Native audio yields no complete frames.')
    return sample_count


def original_execution_bindings(run, plan, path):
    result = []
    for binding in plan['source_file_bindings']:
        original = Path(binding['path']).resolve()
        require(digest(path(original, external=True)) == binding['sha256'], 'Original Child51 execution binding changed.')
        result.append({'recorded_path': str(original), 'recorded_sha256': binding['sha256'],
            'actual_verified_original_bytes_path': str(original), 'archive_only_not_new_forward': False})
    return result


def frozen_native_result_bindings(base, path):
    names = ['completion.private.json', 'execution-intent.private.json', 'source-context.private.json']
    for ident in META_IDS:
        names.extend('results/'+ident+'.'+suffix for suffix in ['observation.private.json', 'forward-intent.private.json',
            'phone-logits.private.npy', 'frame-probabilities.private.npy', 'argmax-ids.private.npy'])
    bindings = {name: digest(path(base/name)) for name in sorted(names)}
    require(object_hash(bindings) == FROZEN_NATIVE_OUTPUT_SHA256,
        'All 43 exact original Root eight-forward result/context files required; rehashed substitutions are invalid.')
    return bindings


def native_runtime(plan, execution, observation, forward, path):
    model = Path(plan['model_directory']).resolve()
    require(native.tree(model) == plan['model_files'] == execution['model_files'] == forward['model_files']
        and native_hash(plan['model_files']) == plan['model_tree_sha256'] == observation['model_tree_sha256']
        == execution['model_tree_sha256'] == forward['model_tree_sha256'], 'Actual pinned model bytes differ.')
    for name in plan['model_files']: path(model/name, external=True)
    require(observation['weights_sha256'] == execution['weights_sha256'] == forward['weights_sha256']
        == plan['model_files']['pytorch_model.bin'] and observation['vocab_sha256'] == plan['model_files']['vocab.json'],
        'Original model weights/vocabulary identity differs.')
    for package, binding in plan['runtime_bindings'].items():
        for p, h in binding['metadata'].items():
            require(digest(path(Path(binding['root'])/p, external=True)) == h, 'Actual runtime metadata changed.')
        if 'installed_tree_sha256' in binding:
            actual_tree = native.tree(Path(binding['root'])/package)
            require(native_hash(actual_tree) == binding['installed_tree_sha256'], 'Actual installed runtime tree changed.')
            # tree() already hashed these exact bytes; the finalizer rechecks them.
            for name, h in actual_tree.items():
                provenance_path = path(Path(binding['root'])/package/name, external=True)
                require(digest(provenance_path) == h, 'Actual runtime tree bytes changed while collecting evidence.')
    require(set(plan['runtime_bindings']) >= {'torch', 'transformers', 'numpy', 'tokenizers', 'safetensors'}
        and all('installed_tree_sha256' in plan['runtime_bindings'][p] for p in ['torch', 'transformers', 'numpy', 'tokenizers', 'safetensors'])
        and observation['runtime_bindings_sha256'] == native_hash(plan['runtime_bindings']), 'Native runtime binding differs.')
    require(digest(path(Path(sys.executable).resolve(), external=True)) == plan['python_binary_sha256']
        and digest(path(plan['ffmpeg_binary'], external=True)) == plan['ffmpeg_sha256'],
        'Original Python/FFmpeg executable bytes differ.')
    return model


def native_execution_scope(run, child, plan, completion, execution, observation, gate, runner_hash, plan_hash):
    require(plan_hash == FROZEN_PLAN_SHA256
        and runner_hash == FROZEN_RUNNER_SHA256 and plan['root_forward_approval_required'] is True
        and plan['original_full_child21_guard'] is True and plan['source_child_retake_prepared_full1557_verified'] is True,
        'Exactly the genuine frozen Root Child51 plan/runner required.')
    require(plan['source_run'] == str(child) and plan['parent_run'] == str(run)
        and plan['model'] == observation['model'] == native.MODEL
        and plan['revision'] == observation['revision'] == native.REVISION,
        'Original blind Meta child/model identity differs.')
    require(completion['status'] == 'observations_complete' and completion['calls'] == 8
        and completion['approval'] is None and completion['runner_sha256'] == plan['runner_sha256'] == runner_hash
        and completion['plan_sha256'] == observation['plan_sha256'] == plan_hash,
        'Actual completed original Meta execution required.')
    require(gate['status'] == 'approved_execution_scope' and isinstance(gate['reviewed_by'], str)
        and gate['reviewed_by'].startswith('root ') and isinstance(gate['reason'], str) and len(gate['reason']) >= 20
        and gate['runner_sha256'] == plan['runner_sha256'] and gate['plan_sha256'] == FROZEN_PLAN_SHA256
        and gate['selected_ids'] == META_IDS and gate['model'] == native.MODEL and gate['revision'] == native.REVISION
        and gate['max_forward_calls'] == execution['max_forward_calls'] == plan['max_forward_calls'] == 8
        and gate['audio_sha256'] == execution['mp3_sha256'], 'Actual separate Root eight-forward execution gate differs.')


def native_proof(run, child, line, audio_hash, path, load):
    ident = line['id']; base = run/META
    frozen_results = frozen_native_result_bindings(base, path)
    observation = load(base/'results'/(ident+'.observation.private.json'))
    plan = load(base/'plan.private.json'); completion = load(base/'completion.private.json')
    execution = load(base/'execution-intent.private.json'); context = load(base/'source-context.private.json')
    runner = path(base/'runner.py'); forward_path = path(base/'results'/(ident+'.forward-intent.private.json'))
    forward = load(forward_path)
    gate = load(base/'root-execution-review.private.json')
    native_execution_scope(run, child, plan, completion, execution, observation, gate,
        digest(runner), digest(path(base/'plan.private.json')))
    require(observation['id'] == ident and observation['source_mp3_sha256'] == audio_hash
        and observation['source_receipt_sha256'] == digest(path(child/'raw'/(ident+'.receipt.json')))
        and observation['provider_wav_sha256'] == digest(path(child/'raw'/(ident+'.wav')))
        and observation['runner_sha256'] == digest(runner)
        and observation['recognizer_received_expected_text'] is False and observation['model_timestamps_used'] is False
        and plan['expected_text_passed_to_recognizer'] is False and context['expected_text_passed_to_recognizer'] is False,
        'Actual blind native observation differs.')
    require(observation['global_execution_intent_sha256'] == digest(path(base/'execution-intent.private.json'))
        and observation['source_context_sha256'] == plan['source_context_sha256'] == digest(path(base/'source-context.private.json'))
        and observation['forward_intent_sha256'] == digest(forward_path), 'Original Meta intent/context bytes differ.')
    contexts = [r for r in context['records'] if r['id'] == ident]
    require(len(contexts) == 1 and contexts[0]['source_row'] == line
        and contexts[0]['source_row_sha256'] == native_hash(line) and contexts[0]['speaker'] == line['speaker']
        and contexts[0]['voice'] == CASES[ident]['voice'] and contexts[0]['authored_text_passed_to_recognizer'] is False
        and contexts[0]['actual_receipt'] == load(child/'raw'/(ident+'.receipt.json')),
        'Original full authored source/voice context differs.')
    original_requests = [json.loads(s) for s in path(child/'requests.jsonl').read_text().splitlines() if s.strip()]
    original_takes = load(child/'qa-actual-primary-pass52.private.json')['takes']
    require([r for r in original_requests if r['key'] == ident] == [contexts[0]['actual_child_modified_request']]
        and [t for t in original_takes if t['id'] == ident] == [contexts[0]['actual_child_QA']],
        'Original full Child request/Primary context differs.')
    params = plan['params']
    require(observation['actual_params'] == execution['actual_params'] == params
        and native_hash(params) == plan['params_sha256'] == observation['actual_params_sha256'] == execution['actual_params_sha256']
        and params['do_phonemize'] is False and params['source_text_input'] is False
        and params['forced_alignment'] is False and params['beam_search'] is False
        and params['timestamps'] is False and params['lexicon'] is None and params['language_hint'] is None
        and params['device'] == 'cpu' and params['sample_rate'] == 16000, 'Blind native decoder parameters differ.')
    require(execution['ids'] == plan['scope'] == META_IDS and ident in plan['scope'] and execution['mp3_sha256'][ident] == audio_hash
        and execution['runner_sha256'] == plan['runner_sha256'] and execution['plan_sha256'] == digest(path(base/'plan.private.json')),
        'Original execution scope/audio differs.')
    model = native_runtime(plan, execution, observation, forward, path)
    expected_sources = {str((run/p).resolve()) for p in ['prepared.json', 'lines.private.json', 'profiles.private.json', 'requests.jsonl',
        META+'/input-plan.private.json', 'meta-phoneme-probe-pass10-german-pilots/evidence/model-downloads.private.json',
        'final-word-pilots51/offline-qc-native52/adapter.private.py',
        'final-word-pilots51/offline-qc-native52/full-scope-frozen-proof.private.json',
        'meta-coaching-selected2-pass49/runner.py']}
    expected_sources.update(str((child/p).resolve()) for p in ['lines.private.json', 'profiles.private.json',
        'qa-actual-primary-pass52.private.json', 'prepared.json', 'parent-snapshot.private.json',
        'delivery-overrides.private.json', 'requests.jsonl', 'responses.private.jsonl', 'collection.private.json'])
    expected_sources.update(str(Path(module.__file__).resolve()) for module in [retake, common, retake.generate])
    require([clip['id'] for clip in plan['clips']] == META_IDS, 'Original Meta prepared clip scope differs.')
    for clip in plan['clips']:
        other = clip['id']
        expected_sources.update(str((child/folder/(other+extension)).resolve()) for folder, extension in
            [('clips', '.mp3'), ('raw', '.receipt.json'), ('raw', '.wav')])
    recorded_sources = [str(Path(binding['path']).resolve()) for binding in plan['source_file_bindings']]
    require(len(recorded_sources) == len(set(recorded_sources)) == 45 and set(recorded_sources) == expected_sources,
        'All 45 original Child51 Meta execution file bindings required, without omissions or exceptions.')
    input_plan = load(base/'input-plan.private.json')
    require(input_plan['selected_ids'] == META_IDS and input_plan['source_run'] == str(child)
        and input_plan['child_scope_ids'] == load(child/'parent-snapshot.private.json')['selected_ids']
        and input_plan['child_QA_sha256'] == digest(path(child/'qa-actual-primary-pass52.private.json'))
        and input_plan['child_manifest_sha256'] == digest(path(child/'lines.private.json'))
        and input_plan['parent_frames_used_as_new_audio'] is False, 'Full original Child21 native input plan differs.')
    historical = original_execution_bindings(run, plan, path)
    require(sorted(p.name for p in (base/'results').glob('*.observation.private.json'))
        == sorted(i+'.observation.private.json' for i in META_IDS)
        and sorted(p.name for p in (base/'results').glob('*.forward-intent.private.json'))
        == sorted(i+'.forward-intent.private.json' for i in META_IDS),
        'Exactly eight original observations and prior single-forward intents required.')
    vocab = load(model/'vocab.json', external=True); config = load(model/'config.json', external=True)
    complete_scope = []
    for clip in plan['clips']:
        other = clip['id']; other_observation = load(base/'results'/(other+'.observation.private.json'))
        other_forward_path = path(base/'results'/(other+'.forward-intent.private.json'))
        other_forward = load(other_forward_path)
        other_pcm = subprocess.check_output([plan['ffmpeg_binary'], '-v', 'error', '-i', str(child/'clips'/(other+'.mp3')),
            '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1'])
        ph = hashlib.sha256(other_pcm).hexdigest()
        require(other_observation['id'] == other_forward['id'] == other
            and other_observation['status'] == 'observation_only'
            and all(other_observation[k] is None for k in ['word_approval', 'phonetic_approval', 'acting_approval', 'timing_approval', 'listening_verdict'])
            and other_observation['source_mp3_sha256'] == other_forward['mp3_sha256'] == clip['mp3_sha256'] == execution['mp3_sha256'][other]
            and other_observation['source_receipt_sha256'] == clip['receipt_sha256']
            and other_observation['provider_wav_sha256'] == clip['provider_wav_sha256']
            and other_observation['plan_sha256'] == other_forward['plan_sha256'] == FROZEN_PLAN_SHA256
            and other_observation['runner_sha256'] == other_forward['runner_sha256'] == FROZEN_RUNNER_SHA256
            and other_observation['global_execution_intent_sha256'] == other_forward['global_execution_intent_sha256']
                == digest(path(base/'execution-intent.private.json'))
            and other_observation['forward_intent_sha256'] == digest(other_forward_path)
            and other_observation['source_context_sha256'] == plan['source_context_sha256']
            and other_observation['decoded_pcm_sha256'] == other_forward['pcm_sha256'] == clip['pcm_sha256'] == ph
                == digest(path(base/other_observation['decoded_f32le_file']))
            and other_observation['feature_bindings'] == other_forward['features'] == clip['prepared_official_normalized_feature_bindings']
            and other_observation['actual_params'] == params
            and other_observation['actual_params_sha256'] == other_forward['actual_params_sha256'] == plan['params_sha256']
            and other_observation['model'] == native.MODEL and other_observation['revision'] == native.REVISION
            and other_observation['model_tree_sha256'] == other_forward['model_tree_sha256'] == plan['model_tree_sha256']
            and other_observation['weights_sha256'] == other_forward['weights_sha256'] == plan['model_files']['pytorch_model.bin']
            and other_forward['model_files'] == plan['model_files']
            and other_observation['vocab_sha256'] == plan['model_files']['vocab.json']
            and other_observation['runtime_bindings_sha256'] == native_hash(plan['runtime_bindings'])
            and other_observation['recognizer_received_expected_text'] is False
            and other_observation['model_timestamps_used'] is False
            and other_forward['state'] == 'RECORDED_BEFORE_FORWARD' and other_forward['max_forward_calls'] == 1
            and other_forward['approval'] is None, 'A completed Root native forward is not bound to the exact frozen scope.')
        other_arrays = []
        for file_key, hash_key in [('raw_phone_logits_file', 'raw_phone_logits_sha256'),
                ('actual_frame_probabilities_file', 'actual_frame_probabilities_sha256'), ('argmax_ids_file', 'argmax_ids_sha256')]:
            p = path(base/other_observation[file_key])
            require(digest(p) == other_observation[hash_key], 'Original full eight-forward native array changed.')
            other_arrays.append(np.load(p, allow_pickle=False))
        require(other_arrays[0].shape[1] == ctc_frames(len(other_pcm)//4, config) == clip['expected_native_convolution_output_frames']
            and len(other_pcm)//4 == clip['pcm_frames'] and other_observation['actual_native_output_frames'] == other_arrays[0].shape[1]
            and list(other_arrays[0].shape) == other_observation['score_shape'] and list(other_arrays[1].shape) == other_observation['actual_probability_shape']
            and other_observation['actual_logit_dtype'] == 'float32' and other_observation['actual_probability_dtype'] == 'float64'
            and other_observation['actual_native_convolutions'] == other_observation['native_convolution_contract']
                == plan['native_convolution_contract'], 'Original complete eight-forward native matrix geometry differs.')
        native_array_events(*other_arrays, vocab, other_observation)
        complete_scope.append({'id': other, 'observation_sha256': digest(path(base/'results'/(other+'.observation.private.json'))),
            'forward_intent_sha256': digest(other_forward_path), 'full_native_arrays_verified': True})
    arrays = []
    for file_key, hash_key in [('raw_phone_logits_file', 'raw_phone_logits_sha256'),
            ('actual_frame_probabilities_file', 'actual_frame_probabilities_sha256'), ('argmax_ids_file', 'argmax_ids_sha256')]:
        p = path(base/observation[file_key]); require(digest(p) == observation[hash_key], 'Original complete native array changed.')
        arrays.append(np.load(p, allow_pickle=False))
    pcm = subprocess.check_output([plan['ffmpeg_binary'], '-v', 'error', '-i', str(child/'clips'/(ident+'.mp3')),
        '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1'])
    pcm_hash = hashlib.sha256(pcm).hexdigest()
    require(digest(path(base/observation['decoded_f32le_file'])) == pcm_hash == observation['decoded_pcm_sha256']
        and forward['state'] == 'RECORDED_BEFORE_FORWARD' and forward['id'] == ident
        and forward['mp3_sha256'] == audio_hash and forward['pcm_sha256'] == pcm_hash
        and forward['runner_sha256'] == plan['runner_sha256'] and forward['plan_sha256'] == observation['plan_sha256']
        and forward['global_execution_intent_sha256'] == observation['global_execution_intent_sha256']
        and forward['actual_params_sha256'] == observation['actual_params_sha256']
        and forward['features'] == observation['feature_bindings'] and forward['max_forward_calls'] == 1,
        'Actual direct PCM or prior single forward intent differs.')
    require(arrays[0].shape[1] == ctc_frames(len(pcm)//4, load(model/'config.json', external=True)),
        'Complete native frames differ from actual PCM/model geometry.')
    require(list(arrays[0].shape) == observation['score_shape'] and list(arrays[1].shape) == observation['actual_probability_shape']
        and observation['actual_probability_dtype'] == 'float64', 'Original complete native array metadata differs.')
    require(observation['actual_logit_dtype'] == 'float32' and observation['actual_native_output_frames'] == arrays[0].shape[1]
        and observation['actual_native_convolutions'] == observation['native_convolution_contract']
        == plan['native_convolution_contract'] == execution['native_convolution_contract'], 'Actual full native convolution contract differs.')
    result = native_frames(line, *arrays, vocab, observation)
    result['historical_execution_context_bindings'] = historical
    result['model'] = native.MODEL; result['revision'] = native.REVISION
    result['execution_gate_sha256'] = digest(path(base/'root-execution-review.private.json'))
    result['frozen_plan_sha256'] = FROZEN_PLAN_SHA256
    result['completed_scope'] = META_IDS
    result['complete_eight_forward_verification'] = complete_scope
    result['original_native_result_files_sha256'] = frozen_results
    return result


def collect_evidence(run, line, bindings=None):
    run = Path(run).resolve(); value = case(line); ident = line['id']
    require(run.is_relative_to(qa.PRIVATE.resolve()) and (bindings is None or set(bindings) == KEYS),
        'Private run and complete child bindings required.')
    provenance = {}
    def path(value, external=False):
        p = Path(value); p = (p if p.is_absolute() else run/p).resolve()
        require(p.is_file() and (external or p.is_relative_to(run)), 'Actual evidence path unavailable or outside private run.')
        provenance[str(p)] = digest(p); return p
    def load(value, external=False): return core.read_json(path(value, external))
    common.prepared(run); child = run/CHILD
    retake.prepared(child, run, verify_bank=False)
    for name in ['prepared.json', 'requests.jsonl', 'profiles.private.json', 'source-snapshot.private.json', 'full-inventory.private.json']:
        path(run/name)
    manifest = load('lines.private.json')
    require(len(manifest['lines']) == FULL_COUNT and len({r['id'] for r in manifest['lines']}) == FULL_COUNT
        and [r for r in manifest['lines'] if r['id'] == ident] == [line],
        'Exact full parent inventory/source row required.')
    require([r for r in load(child/'lines.private.json')['lines'] if r['id'] == ident] == [line], 'Original Child source row differs.')
    for location in [run, child]:
        require(load(location/'profiles.private.json')['speakers'][value['speaker']]['google_voice'] == value['voice'], 'Frozen fixed voice differs.')
    info = load(child/'prepared.json'); snapshot_path = path(child/'parent-snapshot.private.json'); snapshot = load(snapshot_path)
    require(info['request_count'] == CHILD_COUNT and snapshot['parent'] == str(run)
        and snapshot['fixed_google_voices'][ident] == value['voice'], 'Original Child preparation/snapshot scope differs.')
    for p, h in info['frozen_sha256'].items(): require(digest(path(child/p)) == h, 'Frozen Child source/request context changed.')
    for p, h in snapshot['parent_file_sha256'].items(): require(digest(path(run/p)) == h, 'Original Parent source context changed.')
    requests_path = path(child/'requests.jsonl'); payload = requests_path.read_bytes()
    requests = [json.loads(s) for s in payload.splitlines() if s.strip()]
    require(len(requests) == CHILD_COUNT and [r['key'] for r in requests] == snapshot['selected_ids']
        and len(set(snapshot['selected_ids'])) == CHILD_COUNT and info['input_sha256'] == core.digest(payload)
        and info['input_bytes'] == len(payload), 'Original complete 21-request Child payload differs.')
    selected = [r['request'] for r in requests if r['key'] == ident]; require(len(selected) == 1, 'Unique original Child request required.')
    request = selected[0]; request_hash = core.digest(json.dumps(request, sort_keys=True).encode())
    require(request_hash == snapshot['modified_request_sha256'][ident]
        and request['generationConfig']['speechConfig']['voiceConfig']['voice'] == value['voice']
        and ''.join(p.get('text', '') for c in request['contents'] for p in c['parts']) == value['text']
        and snapshot['source_text_sha256'][ident] == qa.text_hash(value['text']), 'Original complete source text/voice/request differs.')
    audio = path(child/'clips'/(ident+'.mp3')); audio_hash = digest(audio)
    require(audio_hash == value['clip_sha256'], 'Exactly the original actual Child51 MP3 required.')
    receipt = load(child/'raw'/(ident+'.receipt.json')); wav = path(child/'raw'/(ident+'.wav'))
    require(receipt['id'] == ident and receipt['status'] == 'complete' and receipt['backend'] == 'batch'
        and receipt['model'] == core.MODEL and receipt['mp3_sha256'] == audio_hash and receipt['wav_sha256'] == digest(wav)
        and receipt['request_sha256'] == request_hash and receipt['retake_parent_mp3_sha256'] == snapshot['bank_mp3_sha256'][ident],
        'Original actual TTS receipt/WAV/request differs.')
    raw_path = path(child/'responses.private.jsonl'); raw = [json.loads(s) for s in raw_path.read_text().splitlines() if s.strip()]
    selected_raw = [r['response'] for r in raw if r.get('key') == ident]; require(len(selected_raw) == 1, 'Original unique TTS raw response required.')
    provider = selected_raw[0]; candidate = provider['candidates'][0]
    require(provider['modelVersion'] == core.MODEL and candidate['finishReason'] == 'STOP'
        and len(provider['candidates']) == 1 and len(candidate['content']['parts']) == 1, 'Actual complete TTS provider response differs.')
    raw_wav = candidate['content']['parts'][0]['inlineData']
    require(raw_wav['mimeType'] == 'audio/wav' and base64.b64decode(raw_wav['data'], validate=True) == wav.read_bytes(),
        'Original submitted provider WAV differs.')
    collection = load(child/'collection.private.json'); job = load(child/'job.json'); intent = load(child/'submit-intent.private.json')
    require(collection['collected'] == collection['expected'] == CHILD_COUNT and collection['failures'] == []
        and job['state'] == 'JOB_STATE_SUCCEEDED' and job['model'] == core.MODEL and job['request_count'] == CHILD_COUNT
        and intent['state'] == 'CONFIRMED' and intent['model'] == core.MODEL and intent['input_sha256'] == info['input_sha256'],
        'Actual completed original Child TTS batch required.')
    qc_path = path(child/'independent-vocal-qc'/(ident+'.'+audio_hash[:16]+'.json'))
    require(bindings is None or path(bindings['child_qc_record_path']) == qc_path, 'Original Child QC cache identity required.')
    record = load(qc_path); require(record.get('id') == ident and qc.cached_record(record, audio_hash, qa.text_hash(line['text'])),
        'Genuine blind Child QC model/schema/prompt/source/audio required.')
    provider_files = expressive.provider_files(child, line, record, audio_hash)
    qc_batch = child/'independent-vocal-qc/batches/child-qc-pass52'
    require(set(provider_files) == {str((qc_batch/n).relative_to(child)) for n in
        ['prepared.json', 'audio-snapshot.private.json', 'requests.jsonl', 'submit-intent.private.json',
         'job.json', 'collection.private.json', 'responses.private.jsonl']}
        and load(qc_batch/'prepared.json')['request_count'] == CHILD_COUNT,
        'Exactly the original complete blind 21-request Child QC batch required.')
    for p, h in provider_files.items():
        require(digest(path(child/p)) == h, 'Original genuine complete blind Child QC provider bytes differ.')
    qc_evidence = qc_observation(line, record)
    child_qa = load(child/'qa-actual-primary-pass52.private.json')
    child_ids = snapshot['selected_ids']
    child_takes = [r for r in child_qa['takes'] if r['id'] == ident]
    require(child_qa['version'] == qa.VERSION and (child_qa['model'] == qa.MODEL or str(child_qa['model']).startswith(qa.MODEL+':'))
        and child_qa['manifest_sha256'] == digest(child/'lines.private.json')
        and len(child_qa['checked_ids']) == len(set(child_qa['checked_ids'])) == CHILD_COUNT and set(child_qa['checked_ids']) == set(child_ids)
        and child_qa['clip_sha256'] == {i:digest(path(child/'clips'/(i+'.mp3'))) for i in child_ids}
        and len(child_qa['takes']) == CHILD_COUNT and {t['id'] for t in child_qa['takes']} == set(child_ids)
        and len(child_takes) == 1 and child_takes[0]['text_sha256'] == qa.text_hash(line['text']), 'Actual original Child Primary QA differs.')
    primary = words(line, child_takes[0]['transcript'], 'primary')
    primary_cache = load(child/'qa-asr-cache.private.json')
    child_lines = load(child/'lines.private.json')['lines']
    cache_keys = {qa.text_hash(qa.VERSION+'\0'+child_qa['model']+'\0'+child_qa['clip_sha256'][r['id']]+'\0'+r['text'])
        for r in child_lines}
    require(set(primary_cache) == cache_keys and len(cache_keys) == CHILD_COUNT,
        'Original complete actual Child21 Primary cache required.')
    primary_key = qa.text_hash(qa.VERSION+'\0'+child_qa['model']+'\0'+audio_hash+'\0'+line['text'])
    require(primary_cache[primary_key] == {'clip_sha256': audio_hash, 'text_sha256': qa.text_hash(line['text']),
        'transcript': child_takes[0]['transcript']}, 'Original actual blind Primary cache/source/audio differs.')
    phones = native_proof(run, child, line, audio_hash, path, load)
    protected = {str(Path(m.__file__).resolve()): digest(m.__file__) for m in
        [qa, qc, expressive, native, common, core, retake, retake.generate, qc.transport]}
    result = {'status': 'root_review_required' if bindings is not None else 'offline_preflight_unapproved',
        'reviewed_by': '', 'reason': '', 'method': VERSION, 'id': ident,
        'clip_sha256': audio_hash, 'source_text_sha256': qa.text_hash(line['text']), 'source_row': copy.deepcopy(line),
        'source_row_sha256': object_hash(line), 'source_profiles_sha256': digest(run/'profiles.private.json'), 'voice': value['voice'],
        'source_run': str(child), 'current_parent_run': str(run), 'actual_child_request': request,
        'actual_import_journal': None, 'base_qa_file': None, 'base_qa_sha256': None, 'qa_take': None,
        'actual_child_primary_evidence': primary, 'actual_blind_child_QC': qc_evidence,
        'actual_child_primary_cache_record': copy.deepcopy(primary_cache[primary_key]),
        'qc_record_sha256': object_hash(record), 'raw_response_sha256': object_hash(record['response']), 'qc_contract': qc.cache_metadata(),
        'native_Meta_evidence': phones, 'provenance_files_sha256': provenance, 'protected_script_sha256': protected,
        'helper_script_sha256': digest(__file__), 'no_name_spelling_alias': True, 'provider_timestamps_used': False,
        'timing_approval': None, 'acting_approval': None, 'listening_verdict': None,
        'parent_import_and_full_QA_required': True,
        'limitations': 'Exactly this source and original Child51 audio/QC. Lexical evidence only. No category rewrite, Azar phone proof, canonical name, vowel duration, acting, timing or human hearing claim.'}
    if bindings is None:
        return result
    require(digest(path(run/'clips'/(ident+'.mp3'))) == audio_hash,
        'Exact original selected Child MP3 must be the actual current Parent clip.')
    require(load(run/'raw'/(ident+'.receipt.json')) == receipt and digest(path(run/'raw'/(ident+'.wav'))) == digest(wav),
        'Actual imported Parent receipt/WAV differs from original Child bytes.')
    journal_path = path(bindings['child_import_journal_path'])
    require(journal_path == child/'import.private.json', 'Actual original Child51 import journal required.')
    journal = load(journal_path)
    imported = retake.journal_import_ids(journal, snapshot, digest(snapshot_path))
    require(journal['state'] == 'IMPORTED' and ident in imported and journal['new_mp3_sha256'][ident] == audio_hash
        and set(imported) <= set(child_ids), 'Actual completed exact selected-source Parent import required.')
    qa_path = path(bindings['qa_report_path']); report = load(qa_path)
    ids = [r['id'] for r in manifest['lines']]
    require(report['version'] == qa.VERSION and (report['model'] == qa.MODEL or str(report['model']).startswith(qa.MODEL+':'))
        and report['manifest_sha256'] == digest(run/'lines.private.json')
        and len(report['checked_ids']) == len(set(report['checked_ids'])) == FULL_COUNT and set(report['checked_ids']) == set(ids)
        and report['clip_sha256'] == {i: digest(path(run/'clips'/(i+'.mp3'))) for i in ids}
        and len(report['takes']) == FULL_COUNT and {t['id'] for t in report['takes']} == set(ids),
        'Exact new full1557 current Parent base QA required.')
    take = next(t for t in report['takes'] if t['id'] == ident)
    require(take['text_sha256'] == qa.text_hash(line['text']), 'Current Parent QA authored text differs.')
    signal = take['signal']
    require(type(signal.get('silent')) is bool and all(type(signal.get(k)) in (int, float) and math.isfinite(signal[k])
        for k in ['seconds', 'peak', 'rms', 'clipped_fraction', 'leading_silence_seconds', 'trailing_silence_seconds', 'last_frame_rms']),
        'Complete finite current physical signal evidence required.')
    require(not qa.signal_failures(signal, len(qa.words(line['text']))), 'Physical signal defects block child source proof.')
    result.update(actual_import_journal=journal, base_qa_file=str(qa_path), base_qa_sha256=digest(qa_path),
        qa_take=copy.deepcopy(take), parent_import_and_full_QA_required=False)
    return result


def proof_template(run, line, bindings):
    require(isinstance(bindings, dict) and set(bindings) == KEYS, 'Complete explicit current Parent bindings required.')
    return collect_evidence(run, line, bindings)


def preflight(run, line):
    """Unapproved Child-only evidence, never usable as a finalizer approval."""
    return collect_evidence(run, line)


def review(run, line, bindings, approval=None):
    if approval is None: return None
    template = proof_template(run, line, bindings)
    require(isinstance(approval, dict) and set(approval) == set(template) and approval.get('status') == APPROVED
        and isinstance(approval.get('reviewed_by'), str) and approval['reviewed_by'].startswith('root ')
        and len(approval['reviewed_by'].strip()) > 5 and isinstance(approval.get('reason'), str)
        and len(approval['reason'].strip()) >= 20 and len(qa.words(approval['reason'])) >= 4,
        'Meaningful exact individual Root review required.')
    require(all(object_hash(approval[k]) == object_hash(v) for k, v in template.items() if k not in {'status', 'reviewed_by', 'reason'}),
        'Root proof differs from actual complete current Child/Parent evidence.')
    return {'id': line['id'], 'method': VERSION, 'resolution': 'root_approved_individual_child51_full_words',
        'clip_sha256': template['clip_sha256'], 'source_text_sha256': template['source_text_sha256'], 'proof': copy.deepcopy(approval),
        'provider_timestamps_used': False, 'timing_approval': None, 'acting_approval': None, 'listening_verdict': None}


def main():
    common.configure(); parser = argparse.ArgumentParser(description=__doc__)
    for name in ['run-dir', 'output']: parser.add_argument('--'+name, type=Path, required=True)
    parser.add_argument('--bindings', type=Path)
    parser.add_argument('--preflight', action='store_true')
    parser.add_argument('--id', choices=tuple(CASES), required=True); args = parser.parse_args(); run = args.run_dir.resolve()
    require(not args.output.exists() and args.output.resolve().is_relative_to(run), 'New private unapproved output required.')
    line = next(r for r in core.read_json(run/'lines.private.json')['lines'] if r['id'] == args.id)
    require(args.preflight != (args.bindings is not None), 'Choose either unapproved preflight or exact current Parent bindings.')
    template = preflight(run, line) if args.preflight else proof_template(run, line, core.read_json(args.bindings))
    qa.save(args.output, template)


if __name__ == '__main__':
    try: main()
    except (core.SafeError, OSError, ValueError, KeyError, TypeError, StopIteration) as error:
        raise SystemExit(str(error) if isinstance(error, core.SafeError) else 'Invalid actual child source evidence; nothing imported or approved.')
