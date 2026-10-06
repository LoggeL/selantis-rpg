#!/usr/bin/env python3
"""Offline, individually reviewed word proof for two actual pass45 child takes.

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

VERSION = 'two-child-source-full-word-evidence-v1'
APPROVED = 'approved_individual_child_source_full_word_evidence'
CHILD = 'retake-batches/pronunciation-coaching-pass45'
META = 'meta-coaching-selected2-pass49'
META_IDS = ['story-1aeac577ac4dc1a0ba8f00d2', 'story-5e005372d4e466a90c5f5d03']
FULL_COUNT = 1557
CHILD_COUNT = 23
KEYS = {'qa_report_path', 'child_qc_record_path', 'child_import_journal_path'}
ATTENTION_ID = 'story-5e005372d4e466a90c5f5d03'
FILLER_ID = 'story-968f5dc3dfc93e230c96b7db'
# A separately qualified orthographic source shares the one permanent import.
# Its presence here never grants it this helper's word evidence.
IMPORT_IDS = {ATTENTION_ID, FILLER_ID, 'story-c024bb8e5e1453e7839cacac'}
CASES = {
    ATTENTION_ID: {'text': 'He! Foltan! Die Kleine ist ungeduldig!', 'speaker': 'azar',
        'voice': 'Zubenelgenubi', 'clip_sha256': 'b5159fc19806b262a8ef8299c9a998254550067cdeaa39cce2e6e2e5555e04e5',
        'primary_tokens': ['hey', 'foltern', 'die', 'kleine', 'ist', 'ungeduldig'],
        'qc_tokens': ['hey', 'voltan', 'die', 'kleine', 'ist', 'ungeduldig']},
    FILLER_ID: {'text': 'Ich, äh … Sprich mit Foltan, Mädchen. Das ist besser so.', 'speaker': 'craupor',
        'voice': 'Algieba', 'clip_sha256': 'cea247483cb32851670c8a11fff63cee9792adda48319d8461095128c3d010c4',
        'primary_tokens': ['ich', 'äh', 'sprich', 'mit', 'volltan', 'mädchen', 'das', 'ist', 'besser', 'so']}
}
FILLER_EVENT = {'category': 'groan', 'description': 'low guttural vocal hesitation and breath',
    'vocal_sound': 'äh', 'confidence': .85}
require = native.require
digest = native.digest
object_hash = native.object_hash
native_hash = native.native_hash


def case(line):
    require(line.get('id') in CASES, 'Only the two exact pass45 child sources are supported.')
    value = CASES[line['id']]
    require(line.get('text') == value['text'] and line.get('speaker') == value['speaker'],
        'Exact authored source and speaker required.')
    return value


def words(line, transcript, channel):
    value = case(line)
    expected = qa.words(line['text'])
    actual = qa.words(transcript)
    target = value['primary_tokens'] if channel == 'primary' else value.get('qc_tokens', expected)
    require(channel in {'primary', 'qc'} and actual == target,
        'Complete individually scoped decoder body differs; no insertions, drops or other substitutions.')
    return {'channel': channel, 'full_actual_transcript': transcript, 'expected_tokens': expected,
        'observed_tokens': actual, 'decoder_spelling_adopted': False}


def qc_observation(line, record):
    case(line)
    value = qc.response_observation(record['response'])
    result = words(line, value['transcript'], 'qc')
    expected_events = [] if line['id'] == ATTENTION_ID else [FILLER_EVENT]
    require(value['events'] == expected_events,
        'Exact original event list required; never relabel, omit or add an event.')
    result['actual_events'] = copy.deepcopy(value['events'])
    if line['id'] == FILLER_ID:
        require(result['expected_tokens'][1] == 'äh' and len(result['expected_tokens']) == 10,
            'Written filler and all ten literal source words required.')
        result['scoped_written_filler'] = {'source_word_index': 1, 'source_word': 'äh',
            'event_index': 0, 'event_category_preserved': 'groan', 'event_location_qualified': False}
    return result


def native_frames(logits, probabilities, ids, vocab, observation):
    require(logits.dtype == np.float32 and probabilities.dtype == np.float64,
        'Original full float32 logits and float64 softmax required.')
    require(sorted(vocab.values()) == list(range(392)) and vocab.get('<pad>') == 0,
        'Original complete native 392-class vocabulary required.')
    result = native.native_frames(logits, probabilities, ids, vocab, observation,
        {'start_index': 2, 'end_index_exclusive': 8})
    require([e['token'] for e in observation['emitted_raw_tokens'][:2]] == ['h', 'eː'],
        'Actual opening attention phones h eː required.')
    result['actual_attention_events'] = copy.deepcopy(observation['emitted_raw_tokens'][:2])
    result['attention_source_word_index'] = 0
    result['name_source_word_index'] = 1
    result['no_name_spelling_alias'] = True
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
    generator = Path(retake.generate.__file__).resolve()
    for binding in plan['source_file_bindings']:
        original = Path(binding['path']).resolve()
        actual = original
        if not original.is_file() or digest(original) != binding['sha256']:
            actual = run/'root-pre-textparts49/story_voice_generate.py'
            require(original == generator and actual.is_file() and digest(actual) == binding['sha256'],
                'Original execution bytes changed without the exact Root generator archive.')
        require(digest(path(actual, external=True)) == binding['sha256'], 'Original execution binding changed.')
        result.append({'recorded_path': str(original), 'recorded_sha256': binding['sha256'],
            'actual_verified_original_bytes_path': str(actual), 'archive_only_not_new_forward': actual != original})
    return result


def native_proof(run, child, line, audio_hash, path, load):
    ident = line['id']; base = run/META
    observation = load(base/'results'/(ident+'.observation.private.json'))
    plan = load(base/'plan.private.json'); completion = load(base/'completion.private.json')
    execution = load(base/'execution-intent.private.json'); context = load(base/'source-context.private.json')
    runner = path(base/'runner.py'); forward_path = path(base/'results'/(ident+'.forward-intent.private.json'))
    forward = load(forward_path)
    require(plan['source_run'] == str(child) and plan['parent_run'] == str(run)
        and plan['model'] == observation['model'] == native.MODEL
        and plan['revision'] == observation['revision'] == native.REVISION,
        'Original blind Meta child/model identity differs.')
    require(completion['status'] == 'observations_complete' and completion['calls'] == 2
        and completion['approval'] is None and completion['runner_sha256'] == plan['runner_sha256'] == digest(runner)
        and completion['plan_sha256'] == observation['plan_sha256'] == digest(path(base/'plan.private.json')),
        'Actual completed original Meta execution required.')
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
    original_takes = load(child/'qa-actual-primary-pass46.private.json')['takes']
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
    expected_sources = {str((run/p).resolve()) for p in ['prepared.json', 'lines.private.json', 'profiles.private.json', 'requests.jsonl',
        META+'/input-plan.private.json', 'meta-phoneme-probe-pass10-german-pilots/evidence/model-downloads.private.json']}
    expected_sources.update(str((child/p).resolve()) for p in ['lines.private.json', 'profiles.private.json',
        'qa-actual-primary-pass46.private.json', 'prepared.json', 'parent-snapshot.private.json',
        'delivery-overrides.private.json', 'requests.jsonl', 'responses.private.jsonl', 'collection.private.json'])
    expected_sources.update(str(Path(module.__file__).resolve()) for module in [retake, common, retake.generate])
    require([clip['id'] for clip in plan['clips']] == META_IDS, 'Original Meta prepared clip scope differs.')
    for clip in plan['clips']:
        other = clip['id']
        expected_sources.update(str((child/folder/(other+extension)).resolve()) for folder, extension in
            [('clips', '.mp3'), ('raw', '.receipt.json'), ('raw', '.wav')])
        expected_sources.add(str((child/'independent-vocal-qc'/(other+'.'+clip['mp3_sha256'][:16]+'.json')).resolve()))
    recorded_sources = [str(Path(binding['path']).resolve()) for binding in plan['source_file_bindings']]
    require(len(recorded_sources) == len(set(recorded_sources)) == 26 and set(recorded_sources) == expected_sources,
        'All 26 original Meta execution file bindings required, without omissions or exceptions.')
    historical = original_execution_bindings(run, plan, path)
    arrays = []
    for file_key, hash_key in [('raw_phone_logits_file', 'raw_phone_logits_sha256'),
            ('actual_frame_probabilities_file', 'actual_frame_probabilities_sha256'), ('argmax_ids_file', 'argmax_ids_sha256')]:
        p = path(base/observation[file_key]); require(digest(p) == observation[hash_key], 'Original complete native array changed.')
        arrays.append(np.load(p, allow_pickle=False))
    pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(child/'clips'/(ident+'.mp3')),
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
    result = native_frames(*arrays, load(model/'vocab.json', external=True), observation)
    result['historical_execution_context_bindings'] = historical
    result['model'] = native.MODEL; result['revision'] = native.REVISION
    return result


def proof_template(run, line, bindings):
    run = Path(run).resolve(); value = case(line); ident = line['id']
    require(run.is_relative_to(qa.PRIVATE.resolve()) and set(bindings) == KEYS, 'Private run and complete child bindings required.')
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
    require(len(manifest['lines']) == FULL_COUNT and [r for r in manifest['lines'] if r['id'] == ident] == [line],
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
        and info['input_bytes'] == len(payload), 'Original complete 23-request Child payload differs.')
    selected = [r['request'] for r in requests if r['key'] == ident]; require(len(selected) == 1, 'Unique original Child request required.')
    request = selected[0]; request_hash = core.digest(json.dumps(request, sort_keys=True).encode())
    require(request_hash == snapshot['modified_request_sha256'][ident]
        and request['generationConfig']['speechConfig']['voiceConfig']['voice'] == value['voice']
        and ''.join(p.get('text', '') for c in request['contents'] for p in c['parts']) == value['text']
        and snapshot['source_text_sha256'][ident] == qa.text_hash(value['text']), 'Original complete source text/voice/request differs.')
    audio = path(child/'clips'/(ident+'.mp3')); audio_hash = digest(audio)
    require(audio_hash == value['clip_sha256'] == digest(path(run/'clips'/(ident+'.mp3'))),
        'Exact original selected Child MP3 must be the actual current Parent clip.')
    receipt = load(child/'raw'/(ident+'.receipt.json')); wav = path(child/'raw'/(ident+'.wav'))
    require(receipt['id'] == ident and receipt['status'] == 'complete' and receipt['backend'] == 'batch'
        and receipt['model'] == core.MODEL and receipt['mp3_sha256'] == audio_hash and receipt['wav_sha256'] == digest(wav)
        and receipt['request_sha256'] == request_hash and receipt['retake_parent_mp3_sha256'] == snapshot['bank_mp3_sha256'][ident],
        'Original actual TTS receipt/WAV/request differs.')
    require(load(run/'raw'/(ident+'.receipt.json')) == receipt and digest(path(run/'raw'/(ident+'.wav'))) == digest(wav),
        'Actual imported Parent receipt/WAV differs from original Child bytes.')
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
    journal_path = path(bindings['child_import_journal_path'])
    require(journal_path == child/'import.private.json', 'Actual original Child import journal required.')
    journal = load(journal_path)
    imported = retake.journal_import_ids(journal, snapshot, digest(snapshot_path))
    require(journal['state'] == 'IMPORTED' and ident in imported and journal['new_mp3_sha256'][ident] == audio_hash
        and set(imported) <= IMPORT_IDS, 'Actual completed scoped selected-source Parent import required.')
    qc_path = path(bindings['child_qc_record_path'])
    require(qc_path == child/'independent-vocal-qc'/(ident+'.'+audio_hash[:16]+'.json'), 'Original Child QC cache identity required.')
    record = load(qc_path); require(record.get('id') == ident and qc.cached_record(record, audio_hash, qa.text_hash(line['text'])),
        'Genuine blind Child QC model/schema/prompt/source/audio required.')
    provider_files = expressive.provider_files(child, line, record, audio_hash)
    qc_batch = child/'independent-vocal-qc/batches/child-qc-pass46'
    require(set(provider_files) == {str((qc_batch/n).relative_to(child)) for n in
        ['prepared.json', 'audio-snapshot.private.json', 'requests.jsonl', 'submit-intent.private.json',
         'job.json', 'collection.private.json', 'responses.private.jsonl']}
        and load(qc_batch/'prepared.json')['request_count'] == CHILD_COUNT,
        'Exactly the original complete blind 23-request Child QC batch required.')
    for p, h in provider_files.items():
        require(digest(path(child/p)) == h, 'Original genuine complete blind Child QC provider bytes differ.')
    qc_evidence = qc_observation(line, record)
    child_qa = load(child/'qa-actual-primary-pass46.private.json')
    child_takes = [r for r in child_qa['takes'] if r['id'] == ident]
    require(child_qa['manifest_sha256'] == digest(child/'lines.private.json') and child_qa['clip_sha256'][ident] == audio_hash
        and len(child_takes) == 1 and child_takes[0]['text_sha256'] == qa.text_hash(line['text']), 'Actual original Child Primary QA differs.')
    primary = words(line, child_takes[0]['transcript'], 'primary')
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
    phones = native_proof(run, child, line, audio_hash, path, load) if ident == ATTENTION_ID else None
    protected = {str(Path(m.__file__).resolve()): digest(m.__file__) for m in
        [qa, qc, expressive, native, common, core, retake, retake.generate, qc.transport]}
    return {'status': 'root_review_required', 'reviewed_by': '', 'reason': '', 'method': VERSION, 'id': ident,
        'clip_sha256': audio_hash, 'source_text_sha256': qa.text_hash(line['text']), 'source_row': copy.deepcopy(line),
        'source_row_sha256': object_hash(line), 'source_profiles_sha256': digest(run/'profiles.private.json'), 'voice': value['voice'],
        'source_run': str(child), 'current_parent_run': str(run), 'actual_child_request': request,
        'actual_import_journal': journal, 'base_qa_file': str(qa_path), 'base_qa_sha256': digest(qa_path), 'qa_take': copy.deepcopy(take),
        'actual_child_primary_evidence': primary, 'actual_blind_child_QC': qc_evidence,
        'qc_record_sha256': object_hash(record), 'raw_response_sha256': object_hash(record['response']), 'qc_contract': qc.cache_metadata(),
        'native_Meta_evidence': phones, 'provenance_files_sha256': provenance, 'protected_script_sha256': protected,
        'helper_script_sha256': digest(__file__), 'no_name_spelling_alias': True, 'provider_timestamps_used': False,
        'timing_approval': None, 'acting_approval': None, 'listening_verdict': None,
        'limitations': 'Exactly this source and original Child audio/QC. No category rewrite, canonical name, vowel duration, acting, timing or human hearing claim.'}


def review(run, line, bindings, approval=None):
    if approval is None: return None
    template = proof_template(run, line, bindings)
    require(isinstance(approval, dict) and set(approval) == set(template) and approval.get('status') == APPROVED
        and isinstance(approval.get('reviewed_by'), str) and approval['reviewed_by'].startswith('root ')
        and len(approval['reviewed_by'].strip()) > 5 and isinstance(approval.get('reason'), str)
        and len(approval['reason'].strip()) >= 20 and len(qa.words(approval['reason'])) >= 4,
        'Meaningful exact individual Root review required.')
    require(all(approval[k] == v for k, v in template.items() if k not in {'status', 'reviewed_by', 'reason'}),
        'Root proof differs from actual complete current Child/Parent evidence.')
    return {'id': line['id'], 'method': VERSION, 'resolution': 'root_approved_individual_child_source_full_words',
        'clip_sha256': template['clip_sha256'], 'source_text_sha256': template['source_text_sha256'], 'proof': copy.deepcopy(approval),
        'provider_timestamps_used': False, 'timing_approval': None, 'acting_approval': None, 'listening_verdict': None}


def main():
    common.configure(); parser = argparse.ArgumentParser(description=__doc__)
    for name in ['run-dir', 'bindings', 'output']: parser.add_argument('--'+name, type=Path, required=True)
    parser.add_argument('--id', choices=tuple(CASES), required=True); args = parser.parse_args(); run = args.run_dir.resolve()
    require(not args.output.exists() and args.output.resolve().is_relative_to(run), 'New private unapproved output required.')
    line = next(r for r in core.read_json(run/'lines.private.json')['lines'] if r['id'] == args.id)
    template = proof_template(run, line, core.read_json(args.bindings))
    qa.save(args.output, template)


if __name__ == '__main__':
    try: main()
    except (core.SafeError, OSError, ValueError, KeyError, TypeError, StopIteration) as error:
        raise SystemExit(str(error) if isinstance(error, core.SafeError) else 'Invalid actual child source evidence; nothing imported or approved.')
