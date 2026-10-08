#!/usr/bin/env python3
"""Add current case-bound evidence to Teil-II publication, retaining all initial failures.

No API/model calls, approvals, transcript repair, audio imports or private cue
rewrites. The unchanged initial publisher supplies the complete baseline gates
and the atomic transaction. Root must independently freeze this adapter before
using dryrun/apply and explicitly approve each additional current Source.
"""
from __future__ import annotations
import argparse
from array import array
import copy
from contextlib import ExitStack
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import types
import wave
import part2_voice_batch as batch
import part2_voice_publish as base

VERSION = 'part2-additive-case-evidence-publication-v1'
SECONDARY_VERSION = 'part2-free-full-large449-actual-secondary-diagnostic-v1'
SECONDARY_RUNNER_SHA256 = 'e597dc1f226d2a3b66b640dd84ef86bfe5fd6b38eca3b2b7926228dd2e25eae0'
SECONDARY_PLAN_SHA256 = '1edd74e6e5f498a926bb8ce6df7f51649e3de9844c716f113fba5b2000b71a9a'
TIMING_VERSION = 'part2-full-large-authored-dtw20-private-timing-v1'
TIMING_RUNNER_SHA256 = '974f77ad3f14dba245fb760db62b8e104cd26717cd619ce4add2cbbf2e6b742f'
TIMING_PLAN_SHA256 = 'de39cd1f3c3b4d75506668ead461bce83b653b1d3b6f645680481e91752c0863'
TIMING_RESULT_SHA256 = 'a3844a0d2cf90fc102871c8f60364ea1899ab27744a43c9926ee130b96263614'
SOURCEFREE_TIMING_VERSION = 'part2-free-full-large-timing15-actual-secondary-diagnostic-v1'
SOURCEFREE_TIMING_RUNNER_SHA256 = '0304811935c20cefb840acdbda05893e40abe7045757158e4aaa52852fb8f23e'
SOURCEFREE_TIMING_PLAN_SHA256 = 'ad8163147a6ef40484cd9d4450b44755cdeb3eb824b12573ed5a4d228784577a'
FROZEN_BASE = {'part2_voice_publish.py': '88ef204177bc057b14645ef14c408a9ae85f5fb0db4a5cb7cc5d85d3555f8d03',
               'part2_voice_qualify.py': '2cbfeedc800e517136eab887df99ae2b595f75723822757c67cda5f36d7d57ed',
               'part2_voice_batch.py': 'bc5eed112909b621168dc761277a137435020427933f8a293c6b5a617e0ee092'}
FULL_DIMENSIONS = {**base.qualification.DIMENSIONS, 'n_text_layer': 32}
FULL_MODEL = Path('/Users/logge/Documents/Projects/SelantisRPG/.venv-transcribe/models/whisper-large-v3')
CALL_ARGS = {'language': 'de', 'temperature': 0.0, 'initial_prompt': None,
             'condition_on_previous_text': False, 'word_timestamps': True, 'fp16': True}
AUTHORED_IMPORTS = {'mlx.core', 'mlx_whisper', 'mlx_whisper.load_models', 'mlx_whisper.tokenizer', 'mlx_whisper.timing',
    'mlx_whisper.audio', 'mlx_whisper.whisper', 'numpy', 'prolog_voice_word_cues', 'story_voice_word_cues',
    'scipy', 'scipy.signal', 'numba', 'llvmlite', 'llvmlite.binding', 'tiktoken', 'regex', 'huggingface_hub'}
AUTHORED_PRODUCER_OUTPUTS = {'model-loaded.private.json', 'execution-intent.private.json'}
SOURCEFREE_TIMING_IMPORTS = {'mlx.core', 'mlx_whisper', 'numpy', 'mlx_whisper.transcribe', 'mlx_whisper.audio',
    'mlx_whisper.load_models', 'mlx_whisper.whisper', 'mlx_whisper.timing', 'mlx_whisper.tokenizer',
    'scipy', 'scipy.signal', 'numba', 'llvmlite', 'llvmlite.binding', 'tiktoken', 'regex', 'huggingface_hub'}
WORD_FAILURES = {'asr_lexical_mismatch_requires_review', 'asr_check_failed_ValueError'}
require = batch.require


def digest(path):
    """Stream model/runtime files; never allocate a whole model as a byte string."""
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): value.update(chunk)
    return value.hexdigest()


def object_sha(value): return batch.sha(batch.canonical(value).encode())


def frozen_runner_bytes(path, expected):
    """Execute only the exact once-read reviewed bytes, never a subsequent reread."""
    require(isinstance(expected, str) and re.fullmatch('[0-9a-f]{64}', expected), 'Independent exact private runner freeze is required.')
    data = Path(path).read_bytes()
    require(batch.sha(data) == expected, 'Once-read private runner bytes differ from independent freeze.')
    return data


def private_file(run, path):
    path = Path(path).expanduser()
    require(path.is_absolute() and run.resolve() in path.resolve().parents and path.resolve() == path
            and path.is_file() and not path.is_symlink(), 'Case evidence must be an existing exact private run file.')
    return path


def bound_ref(run, ref, bound):
    require(isinstance(ref, dict) and set(ref) == {'path', 'sha256'}, 'Exact private evidence path/hash required.')
    path = private_file(run, ref['path'])
    require(digest(path) == ref['sha256'], 'Private evidence is missing or stale.')
    bound[str(path)] = ref['sha256']
    return batch.read(path)


def read_raw(path):
    # Actual nonfinite model output is retained as raw evidence, then refused
    # for the affected case; it must not be replaced by an invented transcript.
    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, 'Duplicate actual raw response key.')
            result[key] = value
        return result
    return json.loads(Path(path).read_text(), object_pairs_hook=pairs)


def finite(value): return type(value) in (int, float) and math.isfinite(value)


def actual_stored_numeric_view(value):
    """Replay only the genuine metadata JSON storage boundary, with no custom coercion."""
    return json.loads(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False))


def complete_literal_response(raw, row, audio_hash, seconds):
    require(raw.get('id') == row['id'] and raw.get('audio_sha256') == audio_hash
            and raw.get('source_free') is True and raw.get('raw_saved_before_diagnosis') is True
            and raw.get('actual_call_args') == CALL_ARGS
            and raw.get('actual_runtime') == {'model_path': str(FULL_MODEL.resolve()), 'dimensions': FULL_DIMENSIONS},
            'Current genuine source-free Full-Large runtime/raw response required.')
    return literal_response_body(raw.get('actual_response'), row, seconds)


def literal_response_body(response, row, seconds):
    """Shared strict actual body gate; provenance remains specific to each real producer."""
    require(isinstance(response, dict) and isinstance(response.get('text'), str), 'Whole actual model response is missing.')
    expected = base.qa_engine.words(row['text'])
    require(expected and base.qa_engine.words(response['text']) == expected, 'Whole literal Source words differ; no word exceptions exist.')
    segments = response.get('segments')
    require(isinstance(segments, list) and segments, 'Whole actual segments are missing.')
    segment_texts, actual_words = [], []
    previous_segment = previous_word = 0.0
    for segment in segments:
        require(isinstance(segment, dict) and isinstance(segment.get('text'), str)
                and isinstance(segment.get('tokens'), list) and segment['tokens']
                and all(type(value) is int for value in segment['tokens']), 'Incomplete actual segment/token body.')
        start, end = segment.get('start'), segment.get('end')
        require(finite(start) and finite(end) and previous_segment <= start <= end <= seconds + .001,
                'Actual segment interval is nonfinite, repeated or outside current audio.')
        previous_segment = end
        for field, low, high in [('no_speech_prob', 0, .6), ('avg_logprob', -1, 0), ('compression_ratio', 0, 2.4)]:
            require(finite(segment.get(field)) and low <= segment[field] <= high, 'Actual response has uncertain/repetitive segment evidence.')
        words = segment.get('words')
        require(isinstance(words, list) and words, 'Complete actual per-word model records missing.')
        for word in words:
            require(isinstance(word, dict) and isinstance(word.get('word'), str) and word['word'].strip(), 'Actual word body missing.')
            start, end, probability = word.get('start'), word.get('end'), word.get('probability')
            require(finite(start) and finite(end) and previous_word <= start <= end <= seconds + .001
                    and finite(probability) and 0 <= probability <= 1, 'Actual word interval/probability missing, overlapping or outside audio.')
            if base.qa_engine.words(word['word']): require(start < end, 'Actual lexical model interval collapsed.')
            previous_word = end
            actual_words.append(copy.deepcopy(word))
        segment_texts.append(segment['text'])
    require(base.qa_engine.words(' '.join(segment_texts)) == expected
            and base.qa_engine.words(' '.join(word['word'] for word in actual_words)) == expected,
            'Actual complete segment/word bodies contradict the whole transcript or repeat/omit Source words.')
    return actual_words


def model_evidence(model, bound):
    require(model.get('name') == 'mlx-community/whisper-large-v3'
            and model.get('local_directory') == str(FULL_MODEL.resolve()) and model.get('dimensions') == FULL_DIMENSIONS,
            'Full-Large model metadata must be exact 32/32/128.')
    config_path = FULL_MODEL/'config.json'
    config = batch.read(config_path)
    require(config.get('model_type') == 'whisper' and all(config.get(key) == value for key, value in FULL_DIMENSIONS.items())
            and digest(config_path) == model.get('config_sha256'), 'Actual Full-Large config differs.')
    bound[str(config_path)] = model['config_sha256']
    weights, aliases = model.get('weights_sha256'), model.get('loader_aliases')
    require(isinstance(weights, dict) and weights and isinstance(aliases, dict) and aliases, 'Actual complete model weights/loader aliases missing.')
    namespace = {path.name for path in [*FULL_MODEL.glob('*.safetensors'), *FULL_MODEL.glob('*.npz')]}
    require(namespace == set(aliases), 'Actual model loader namespace differs.')
    for name, alias in aliases.items():
        path = FULL_MODEL/name
        require(alias == {'lexical_path': str(path), 'resolved_path': str(path.resolve()),
                          'sha256': weights.get(str(path.resolve())), 'is_symlink': path.is_symlink()}, 'Actual model weight alias differs.')
        bound[str(path)] = alias['sha256']
    for path, value in weights.items():
        item = Path(path)
        require(item.is_file() and not item.is_symlink() and item.parent == FULL_MODEL.resolve() and digest(item) == value,
                'Actual Full-Large weight bytes differ.')
        stat = item.stat()
        require(model.get('weight_file_stats', {}).get(path) == {
            'device': stat.st_dev, 'inode': stat.st_ino, 'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns}, 'Actual model weight identity changed.')
        bound[path] = value


def secondary_bundle(run, rows, takes, bound, root_binding):
    folder = run/'free-large449'
    plan_path, runner_path = folder/'plan.private.json', folder/'run.private.py'
    runner_bytes = frozen_runner_bytes(runner_path, SECONDARY_RUNNER_SHA256)
    require(digest(plan_path) == SECONDARY_PLAN_SHA256,
            'Independently frozen exact secondary plan/runner differs.')
    plan, result, intent = (batch.read(folder/name) for name in ['plan.private.json', 'result.private.json', 'execution-intent.private.json'])
    expected_binding = {'files_sha256': {str(folder/name): digest(folder/name) for name in
        ['plan.private.json', 'run.private.py', 'execution-intent.private.json', 'result.private.json']},
        'outputs_sha256': object_sha(result.get('outputs_sha256'))}
    require(root_binding == expected_binding, 'Root must explicitly bind the actual completed whole secondary producer/intent/output census.')
    selected = [ident for ident, take in takes.items() if take.get('reasons')]
    require(len(rows) == 1401 and len(selected) == 449 and all(set(take.get('reasons', [])) <= WORD_FAILURES for take in takes.values()),
            'Exact initial whole 1401/449 secondary scope differs.')
    require(plan.get('version') == SECONDARY_VERSION and plan.get('selected_ids') == selected
            and plan.get('bank_count') == 1401 and plan.get('selected_count') == 449
            and plan.get('status') == 'prepared_offline_not_executed_not_approved'
            and plan.get('source_free') is True and plan.get('call_args') == CALL_ARGS
            and plan.get('runner_sha256') == SECONDARY_RUNNER_SHA256
            and plan.get('source_manifest_sha256') == digest(run/'lines.private.json')
            and plan.get('qa_sha256') == digest(run/'qa.private.json')
            and plan.get('automatic_adoption') is False and plan.get('audio_or_cues_modified') is False
            and plan.get('human_listening_or_acting_approval') is False, 'Frozen secondary full Source/QA/call contract differs.')
    inputs = plan.get('input_sha256')
    require(isinstance(inputs, dict) and inputs and plan.get('global_input_sha256') == object_sha(inputs), 'Secondary full input census/hash missing.')
    require(result.get('version') == SECONDARY_VERSION and result.get('state') == 'COMPLETED_DIAGNOSTIC_ONLY_NOT_APPROVED'
            and result.get('plan_sha256') == SECONDARY_PLAN_SHA256 and result.get('runner_sha256') == SECONDARY_RUNNER_SHA256
            and result.get('global_input_sha256_before') == result.get('global_input_sha256_after') == object_sha(inputs)
            and result.get('selected_ids') == selected and result.get('checked_count') == len(selected)
            and result.get('source_free') is True and result.get('actual_model') == plan.get('model')
            and result.get('actual_runtime') == {'model_path': str(FULL_MODEL.resolve()), 'dimensions': FULL_DIMENSIONS}
            and result.get('approval') is None and result.get('automatic_adoption') is False
            and result.get('audio_or_cues_modified') is False and result.get('human_listening_or_acting_approval') is False,
            'Actual completed whole secondary producer missing, partial or wrong model.')
    require(intent.get('version') == SECONDARY_VERSION and intent.get('state') == 'ROOT_EXECUTION_ATTEMPT_RECORDED'
            and intent.get('plan_sha256') == SECONDARY_PLAN_SHA256 and intent.get('runner_sha256') == SECONDARY_RUNNER_SHA256
            and intent.get('selected_ids') == selected and intent.get('global_input_sha256') == object_sha(inputs)
            and intent.get('model') == plan.get('model') and intent.get('root_execution_only') is True
            and intent.get('source_free') is True and intent.get('approval') is None, 'Once-only actual Root execution intent differs.')
    outputs = result.get('outputs_sha256')
    require(isinstance(outputs, dict) and outputs, 'Complete actual secondary raw/intent/diagnosis files missing.')
    for path, value in {**inputs, **outputs}.items():
        item = Path(path)
        require(item.is_absolute() and item.is_file() and not item.is_symlink() and digest(item) == value, 'Actual secondary producer input/output changed.')
        bound[path] = value
    model_evidence(plan['model'], bound)
    records = plan.get('records')
    require(isinstance(records, list) and [record.get('id') for record in records] == selected, 'Complete frozen secondary per-Source records missing.')
    imported = result.get('actual_imported_runtime')
    require(isinstance(imported, dict) and set(imported) == {'mlx.core', 'mlx_whisper', 'mlx_whisper.transcribe', 'mlx_whisper.audio'}
            and all(isinstance(value, dict) and inputs.get(value.get('path')) == value.get('sha256') for value in imported.values()),
            'Actual completed producer imported runtime differs from frozen installed bytes.')
    # Only the independently frozen, already reviewed pure diagnostic function
    # is used. Importing this runner never executes its prepare/execute entry point.
    runner = types.ModuleType('part2_frozen_free_diagnostic'); runner.__file__ = str(runner_path)
    exec(compile(runner_bytes, str(runner_path), 'exec'), runner.__dict__)
    raw_by_id, failures, diagnoses, expected_outputs = {}, 0, [], set()
    for record in records:
        ident, row = record['id'], rows[record['id']]
        mp3, wav, receipt = run/'clips'/(ident+'.mp3'), run/'raw'/(ident+'.wav'), run/'raw'/(ident+'.receipt.json')
        require(record == {'id': ident, 'source_row': row, 'source_row_sha256': object_sha(row),
            'mp3_path': str(mp3), 'mp3_sha256': digest(mp3), 'wav_path': str(wav), 'wav_sha256': digest(wav),
            'tts_receipt_path': str(receipt), 'tts_receipt_sha256': digest(receipt), 'primary_take': takes[ident]},
            'Frozen whole secondary Source/audio/receipt/primary body differs.')
        call_path = folder/'call-intents'/(ident+'.private.json')
        expected_outputs.add(str(call_path))
        require(str(call_path) in outputs, 'Actual once-only call intent missing from completed producer.')
        call = batch.read(call_path)
        require(call.get('id') == ident and call.get('audio_sha256') == digest(mp3)
                and call.get('state') == 'ONE_ACTUAL_CALL_ATTEMPT_RECORDED' and call.get('source_free') is True
                and call.get('actual_call_args') == CALL_ARGS and call.get('plan_sha256') == SECONDARY_PLAN_SHA256
                and call.get('actual_imported_runtime') == imported,
                'Actual source-free call intent differs.')
        raw_path, failure_path = folder/'raw'/(ident+'.private.json'), folder/'raw'/(ident+'.failure.private.json')
        require(raw_path.exists() != failure_path.exists(), 'Missing or ambiguous actual response/failure; no reconstruction allowed.')
        raw_path = raw_path if raw_path.exists() else failure_path
        expected_outputs.add(str(raw_path))
        require(str(raw_path) in outputs, 'Actual full raw response/failure absent from completed producer.')
        raw = read_raw(raw_path)
        require(raw.get('id') == ident and raw.get('audio_sha256') == digest(mp3)
                and raw.get('source_free') is True and raw.get('actual_call_args') == CALL_ARGS
                and raw.get('actual_audio_input') == call.get('actual_audio_input')
                and raw.get('actual_imported_runtime') == imported, 'Actual raw/call waveform/runtime binding differs.')
        waveform = raw.get('actual_audio_input', {})
        require(waveform.get('input_kind') == 'actual_decoded_waveform_array_only' and waveform.get('sample_rate') == 16000
                and waveform.get('dtype') == 'float32' and type(waveform.get('sample_count')) is int and waveform['sample_count'] > 0
                and re.fullmatch(r'[0-9a-f]{64}', waveform.get('waveform_sha256', '')), 'Actual anonymous waveform evidence missing.')
        require(waveform == actual_anonymous_waveform(mp3), 'Whole-run actual current decoder waveform differs from its retained call/raw.')
        if raw_path == failure_path:
            require(raw.get('state') == 'ACTUAL_CALL_FAILED_WITHOUT_RESPONSE' and raw.get('actual_response') is None
                    and isinstance(raw.get('exception_type'), str), 'Actual failure must remain a failure, never an invented response.')
            failures += 1
            diagnoses.append({'id': ident, 'exact_normalized_full_words': False,
                              'uncertainty_reasons': ['actual_model_call_failed'], 'actual_response_produced': False})
            continue
        diagnosis_path = folder/'diagnosis'/(ident+'.private.json')
        expected_outputs.add(str(diagnosis_path))
        require(str(diagnosis_path) in outputs, 'Actual completed raw interpretation missing.')
        diagnosis = batch.read(diagnosis_path)
        require(diagnosis.get('id') == ident and diagnosis.get('raw_path') == str(raw_path)
                and diagnosis.get('raw_sha256') == digest(raw_path) and diagnosis.get('source_row_sha256') == object_sha(row)
                and diagnosis.get('actual_response_produced') is True and diagnosis.get('approval') is None,
                'Actual diagnostic whole-Source/raw provenance differs.')
        require(raw.get('actual_runtime') == result.get('actual_runtime') and raw.get('raw_saved_before_diagnosis') is True,
                'Every actual successful Raw must retain its observed complete Full-Large runtime.')
        try:
            body = runner.diagnose(raw['actual_response'], row['text'])
        except Exception as error:
            body = {'exact_normalized_full_words': False, 'uncertainty_reasons': ['raw_interpretation_failed_'+type(error).__name__],
                    'approval': None, 'automatic_adoption': False, 'timing_adoption': False,
                    'human_listening_or_acting_approval': False}
        reproduced = {'id': ident, 'raw_path': str(raw_path), 'raw_sha256': digest(raw_path),
                      'source_row_sha256': object_sha(row), 'actual_response_produced': True, **body}
        require(diagnosis == reproduced, 'Whole real diagnostic transcript/interval/failure body differs from original Raw.')
        diagnoses.append(reproduced)
        raw_by_id[ident] = raw
    require(result.get('actual_response_count') == len(raw_by_id) and result.get('actual_call_failure_count') == failures
            and len(raw_by_id) + failures == len(selected) and set(outputs) == expected_outputs
            and result.get('exact_normalized_full_words_count') == sum(value['exact_normalized_full_words'] for value in diagnoses)
            and result.get('uncertain_count') == sum(bool(value['uncertainty_reasons']) for value in diagnoses),
            'Completed whole secondary actual raw/diagnosis/count census differs.')
    for path in [plan_path, folder/'result.private.json', folder/'execution-intent.private.json']:
        bound[str(path)] = digest(path)
    bound[str(runner_path)] = SECONDARY_RUNNER_SHA256
    return raw_by_id


def waveform_samples(path, pcm16=False):
    fmt, codec = ('s16le', 'pcm_s16le') if pcm16 else ('f32le', 'pcm_f32le')
    response = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path), '-threads', '0',
        '-f', fmt, '-ac', '1', '-acodec', codec, '-ar', '16000', 'pipe:1'], capture_output=True, timeout=120)
    require(response.returncode == 0 and response.stdout and len(response.stdout) % (2 if pcm16 else 4) == 0, 'Actual waveform decode failed.')
    samples = array('h' if pcm16 else 'f'); samples.frombytes(response.stdout)
    if sys.byteorder != 'little': samples.byteswap()
    if pcm16: samples = array('f', (value / 32768 for value in samples))
    require(samples and all(math.isfinite(value) for value in samples), 'Actual decoded waveform is nonfinite.')
    return samples, response.stdout


def actual_anonymous_waveform(path):
    samples, _ = waveform_samples(path, pcm16=True)
    if sys.byteorder != 'little': samples.byteswap()
    return {'input_kind': 'actual_decoded_waveform_array_only', 'sample_rate': 16000,
            'sample_count': len(samples), 'dtype': 'float32', 'waveform_sha256': batch.sha(samples.tobytes())}


def actual_timing15_waveform(path, decoder):
    selected = shutil.which('ffmpeg')
    require(selected and decoder == {'command': 'ffmpeg', 'selected_path': selected,
        'resolved_path': str(Path(selected).resolve()), 'sha256': digest(selected), 'sample_rate': 16000,
        'channels': 1, 'format': 's16le', 'codec': 'pcm_s16le',
        'method': 'mlx_whisper.audio.load_audio then numpy.asarray(dtype=float32)',
        'pcm_to_float_conversion': 'mlx.float32(int16_pcm)/32768.0'},
        'Separate actual timing15 decoder bytes/anonymous int16-to-float32 conversion differ.')
    return {**actual_anonymous_waveform(path), 'decoder': decoder}


def validate_authored_time(row, receipt, audio_hash, seconds):
    """Check real full word/token detail, not only declared qualification flags."""
    text = base.cue_engine.acoustic.normalized_text(row['text']); authored = ' ' + text
    require(receipt.get('version') == base.cue_engine.acoustic.VERSION and receipt.get('id') == row['id']
            and receipt.get('text') == text and receipt.get('audio_sha256') == audio_hash
            and finite(receipt.get('decoded_seconds')) and abs(receipt['decoded_seconds']-seconds) < .001,
            'New genuine whole authored receipt Source/audio/duration differs.')
    pieces = receipt.get('token_alignment'); words = receipt.get('words'); cues = receipt.get('word_cues')
    require(isinstance(pieces, list) and pieces and isinstance(words, list) and isinstance(cues, list), 'New complete actual token/word/cue bodies missing.')
    cursor, previous_start, previous_end = 0, 0.0, 0.0
    for piece in pieces:
        require(isinstance(piece, dict) and isinstance(piece.get('text'), str) and piece['text']
                and type(piece.get('char_start')) is int and piece['char_start'] == cursor
                and type(piece.get('char_end')) is int and piece['char_end'] == cursor+len(piece['text'])
                and finite(piece.get('probability')) and 0 <= piece['probability'] <= 1
                and finite(piece.get('start')) and finite(piece.get('end'))
                and previous_start <= piece['start'] <= piece['end'] and previous_end <= piece['end'] <= 30.001,
                'Actual new token characters/times/probability are incomplete, nonfinite or out of model scope.')
        cursor, previous_start, previous_end = piece['char_end'], piece['start'], piece['end']
    require(''.join(piece['text'] for piece in pieces) == authored, 'Whole actual new authored token sequence differs from complete Source.')
    spans = list(re.finditer(r'\S+', authored))
    require(len(spans) == len(words) == len(cues), 'New genuine word/cue Source census differs.')
    base.cue_engine.cue_words(text, cues, seconds)
    previous_end = 0.0
    for match, detail, cue in zip(spans, words, cues):
        overlapping = [piece for piece in pieces if piece['char_end'] > match.start() and piece['char_start'] < match.end()]
        spoken = any(char.isalnum() for char in match.group())
        require(overlapping and isinstance(detail, dict) and detail.get('word') == match.group()
                and type(detail.get('spoken')) is bool and detail['spoken'] == spoken
                and finite(detail.get('minimum_token_probability')) and 0 <= detail['minimum_token_probability'] <= 1
                and detail['minimum_token_probability'] == min(piece['probability'] for piece in overlapping)
                and finite(detail.get('start')) and finite(detail.get('end'))
                and detail['start'] == cue['start'] and detail['end'] == cue['end'],
                'New actual Source word/spoken classification/probability/cue detail differs from original token pieces.')
        if not spoken:
            require(cue['start'] == cue['end'] == previous_end, 'Actual standalone visual pause must use its real previous acoustic endpoint.')
        previous_end = cue['end']


def authored_bundle(run, rows, takes, bound, root_binding):
    """A separate complete real forced-timing run can never prove spoken words."""
    folder = run/'full-large-timing20'
    plan_path, runner_path = folder/'plan.private.json', folder/'run.private.py'
    runner_bytes = frozen_runner_bytes(runner_path, TIMING_RUNNER_SHA256)
    require(TIMING_PLAN_SHA256 and digest(plan_path) == TIMING_PLAN_SHA256, 'Independently frozen authored timing plan/runner required.')
    plan, result, intent = (batch.read(folder/name) for name in ['plan.private.json', 'result.private.json', 'execution-intent.private.json'])
    expected_binding = {'files_sha256': {str(folder/name): digest(folder/name) for name in
        ['plan.private.json', 'run.private.py', 'execution-intent.private.json', 'result.private.json']},
        'outputs_sha256': object_sha(result.get('outputs_sha256'))}
    require(root_binding == expected_binding, 'Root must bind the actual completed whole forced-timing producer/intent/output census.')
    runner = types.ModuleType('part2_frozen_authored_diagnostic'); runner.__file__ = str(runner_path)
    exec(compile(runner_bytes, str(runner_path), 'exec'), runner.__dict__)
    runner.validate(plan)  # Frozen read-only Source/20-risk/model/receipt/runtime proof validation; no execution.
    selected = plan.get('selected_ids')
    require(plan.get('version') == TIMING_VERSION and plan.get('source_manifest_sha256') == digest(run/'lines.private.json')
            and isinstance(selected, list) and len(selected) == len(set(selected)) == 20 and set(selected) <= set(rows)
            and all(not takes[ident].get('reasons') and takes[ident].get('word_error_rate') == 0
                    and base.qa_engine.words(takes[ident].get('transcript', '')) == base.qa_engine.words(rows[ident]['text']) for ident in selected),
            'Whole authored timing scope requires genuine complete initial primary-clear words.')
    metadata = {'source_free': False, 'teacher_forced_authored_text': True, 'word_fidelity_proof': False,
                'timing_approval': None, 'automatic_adoption': False, 'original_audio_or_cues_modified': False,
                'human_listening_or_acting_approval': False}
    require(all(plan.get(key) == value and result.get(key) == value for key, value in metadata.items())
            and result.get('version') == TIMING_VERSION and result.get('state') == 'COMPLETED_PRIVATE_FORCED_TIMING_NOT_APPROVED'
            and result.get('selected_ids') == selected and result.get('selected_count') == 20
            and result.get('plan_sha256') == TIMING_PLAN_SHA256 and result.get('runner_sha256') == TIMING_RUNNER_SHA256
            and result.get('actual_model') == plan.get('model')
            and result.get('global_input_sha256_before') == result.get('global_input_sha256_after') == object_sha(plan.get('input_sha256')),
            'Actual completed forced-timing producer missing/partial/mislabeled as word fidelity.')
    require(intent.get('version') == TIMING_VERSION and intent.get('state') == 'ONE_ROOT_ATTEMPT_RECORDED'
            and intent.get('plan_sha256') == TIMING_PLAN_SHA256 and intent.get('runner_sha256') == TIMING_RUNNER_SHA256
            and intent.get('selected_ids') == selected and intent.get('source_free') is False
            and intent.get('teacher_forced_authored_text') is True and intent.get('approval') is None, 'Actual once-only forced timing intent differs.')
    inputs, outputs = plan['input_sha256'], result.get('outputs_sha256')
    require(isinstance(outputs, dict) and outputs, 'Complete actual forced-timing outputs missing.')
    for path, value in {**inputs, **outputs}.items():
        item = Path(path)
        require(item.is_absolute() and item.is_file() and not item.is_symlink() and digest(item) == value, 'Actual forced-timing producer bytes changed.')
        bound[path] = value
    model_evidence(plan['model'], bound)
    runtime = {'load_method': 'mlx_whisper.load_models.load_model',
               'actual_load_args': {'path_or_hf_repo': str(FULL_MODEL), 'dtype': 'mlx.core.float16'},
               'model_path': str(FULL_MODEL), 'model_class': 'mlx_whisper.whisper.Whisper', 'dimensions': FULL_DIMENSIONS}
    require(result.get('actual_runtime') == runtime, 'Observed authored model is not genuine loaded Full-Large 32/32/128.')
    imports = result.get('actual_imported_runtime')
    require(isinstance(imports, dict) and set(imports) == AUTHORED_IMPORTS
        and all(isinstance(value, dict) and inputs.get(value.get('path')) == value.get('sha256') for value in imports.values()),
        'Actual loaded authored model/aligner/tokenizer/refiner/runtime differs from frozen bytes.')
    loaded_path = folder/'model-loaded.private.json'; loaded = batch.read(loaded_path)
    require(loaded == {'actual_runtime': runtime, 'actual_imported_runtime': imports, 'plan_sha256': TIMING_PLAN_SHA256,
        'runner_sha256': TIMING_RUNNER_SHA256, 'approval': None} and str(loaded_path) in outputs, 'Actual loaded-model receipt differs.')
    completed, failed, candidates, expected_outputs = [], [], {}, {str(folder/name) for name in AUTHORED_PRODUCER_OUTPUTS}
    import numpy as np  # Only waveform verification; never imports or invokes a model.
    for record in plan['records']:
        ident = record['id']; mp3 = run/'clips'/(ident+'.mp3'); original = batch.read(run/'word-cues'/(ident+'.json'))
        require(record['source_row'] == rows[ident] and record['source_row_sha256'] == object_sha(rows[ident])
                and record['primary_take'] == takes[ident] and record['original_receipt'] == original
                and record['mp3_sha256'] == digest(mp3) and record['original_receipt_sha256'] == digest(run/'word-cues'/(ident+'.json')),
                'Actual forced timing current Source/original receipt differs.')
        samples, pcm = waveform_samples(mp3)
        audio_binding = {'sample_rate': 16000, 'samples': len(samples), 'dtype': 'float32', 'waveform_sha256': batch.sha(pcm),
            'kind': 'actual_whole_decoded_mp3_waveform', 'mp3_path': str(mp3), 'mp3_sha256': digest(mp3), 'decoder': plan['decoder']}
        call_path = folder/'call-intents'/(ident+'.private.json'); call = batch.read(call_path); expected_outputs.add(str(call_path))
        require(call.get('id') == ident and call.get('state') == 'ONE_ACTUAL_AUTHORED_CALL_ATTEMPT'
                and call.get('plan_sha256') == TIMING_PLAN_SHA256 and call.get('runner_sha256') == TIMING_RUNNER_SHA256
                and call.get('source_row_sha256') == object_sha(rows[ident]) and call.get('actual_audio_input') == audio_binding
                and call.get('source_free') is False and call.get('teacher_forced_authored_text') is True
                and call.get('approval') is None, 'Actual Source-guided call/whole waveform binding differs.')
        raw_path, failure_path = folder/'raw'/(ident+'.private.json'), folder/'raw'/(ident+'.failure.private.json')
        require(raw_path.exists() != failure_path.exists(), 'Actual forced timing response/failure missing or ambiguous.')
        actual_path = raw_path if raw_path.exists() else failure_path; raw = read_raw(actual_path); expected_outputs.add(str(actual_path))
        require(raw.get('version') == TIMING_VERSION and raw.get('id') == ident and raw.get('audio_sha256') == digest(mp3)
                and raw.get('source_row_sha256') == object_sha(rows[ident]) and raw.get('original_receipt_sha256') == record['original_receipt_sha256']
                and raw.get('plan_sha256') == TIMING_PLAN_SHA256 and raw.get('runner_sha256') == TIMING_RUNNER_SHA256
                and raw.get('actual_runtime') == runtime and raw.get('actual_imported_runtime') == imports
                and raw.get('actual_audio_input') == audio_binding and raw.get('source_free') is False
                and raw.get('teacher_forced_authored_text') is True and raw.get('word_fidelity_proof') is False
                and raw.get('timing_approval') is None and raw.get('human_listening_or_acting_approval') is False,
                'Actual full forced timing Raw provenance differs.')
        if actual_path == failure_path:
            require(raw.get('state') == 'ACTUAL_AUTHORED_CALL_FAILED_WITHOUT_RECEIPT' and raw.get('actual_authored_dtw') is None,
                    'Failed authored model call cannot be reconstructed as a receipt.')
            failed.append(ident); continue
        require(raw.get('raw_saved_before_refinement_and_guards') is True
                and raw.get('original_all_qualification_flags') == original['all_qualification_flags'], 'Genuine pre-refinement Raw/original flags missing.')
        actual = raw.get('actual_authored_dtw')
        require(isinstance(actual, dict) and actual.get('id') == ident and actual.get('text') == rows[ident]['text']
                and actual.get('audio_sha256') == digest(mp3) and abs(actual.get('decoded_seconds', -1)-len(samples)/16000) < .001,
                'Whole genuine actual authored response differs from current physical Source/audio.')
        validate_authored_time(rows[ident], actual, digest(mp3), len(samples)/16000)
        candidate = copy.deepcopy(actual); candidate['original_qualification_flags'] = copy.deepcopy(actual['qualification_flags'])
        candidate = base.cue_engine.acoustic.refine_boundaries(candidate, np.asarray(samples, dtype=np.float32))
        candidate['all_qualification_flags'] = base.cue_engine.qualification_flags(candidate)
        candidate['cues_sha256'] = base.cue_engine.acoustic.cue_sha(candidate['word_cues'])
        # The frozen producer's save_once serializes refinement's NumPy float64
        # scalars as genuine JSON numbers. Validate the identical stored value
        # domain, not its pre-storage subclass types; no interval is modified.
        candidate = actual_stored_numeric_view(candidate)
        validate_authored_time(rows[ident], candidate, digest(mp3), len(samples)/16000)
        refined_path = folder/'refined'/(ident+'.private.json'); refined = read_raw(refined_path); expected_outputs.add(str(refined_path))
        require(refined.get('version') == TIMING_VERSION and refined.get('id') == ident
                and refined.get('raw_path') == str(raw_path) and refined.get('raw_sha256') == digest(raw_path)
                and refined.get('actual_runtime') == runtime and refined.get('actual_imported_runtime') == imports
                and refined.get('actual_audio_input') == audio_binding and refined.get('actual_refined_dtw') == candidate
                and refined.get('original_all_qualification_flags') == original['all_qualification_flags']
                and refined.get('plan_sha256') == TIMING_PLAN_SHA256 and refined.get('runner_sha256') == TIMING_RUNNER_SHA256
                and all(refined.get(key) == value for key, value in metadata.items()), 'Real whole refinement/counterflags were changed or incompletely retained.')
        candidates[ident] = refined; completed.append(ident)
    require(result.get('completed_ids') == completed and result.get('failed_ids') == failed
            and result.get('actual_raw_count') == result.get('actual_refined_count') == len(completed)
            and result.get('actual_call_failure_count') == len(failed) and len(completed)+len(failed) == 20
            and set(outputs) == expected_outputs, 'Whole actual authored timing response/failure/output census differs.')
    for name in ['plan.private.json', 'execution-intent.private.json', 'result.private.json']:
        bound[str(folder/name)] = digest(folder/name)
    bound[str(runner_path)] = TIMING_RUNNER_SHA256
    return candidates


def authored_timing(row, original, approval, refined, run, bound, path, wav):
    raw_ref, candidate_ref = approval.get('raw'), approval.get('candidate')
    require(isinstance(raw_ref, dict) and raw_ref.get('path') == str(run/'full-large-timing20/raw'/(row['id']+'.private.json'))
            and isinstance(candidate_ref, dict) and candidate_ref.get('path') == str(run/'full-large-timing20/refined'/(row['id']+'.private.json')),
            'Root must bind both exact actual authored raw and genuine saved refinement.')
    raw, candidate = bound_ref(run, raw_ref, bound), bound_ref(run, candidate_ref, bound)
    require(candidate == refined and candidate.get('raw_sha256') == digest(raw_ref['path'])
            and raw.get('word_fidelity_proof') is False, 'Root candidate differs from actual complete forced-timing producer.')
    flags = original['all_qualification_flags']; decisions = approval.get('flag_decisions')
    require(isinstance(decisions, list) and [decision.get('flag') for decision in decisions] == flags
            and all(decision.get('decision') == 'approve_actual_full_large_authored_timing'
                    and isinstance(decision.get('review_note'), str) and decision['review_note'].strip() for decision in decisions),
            'Every retained original timing failure needs an exact separate Root decision.')
    temporal = candidate['actual_refined_dtw']
    require(approval.get('retained_candidate_timing_flags') == temporal['all_qualification_flags'], 'Every new actual model flag must remain explicitly retained.')
    # These Source hashes are derived bindings only; the raw/refined model files
    # stay byte-for-byte untouched and are never relabeled as the initial engine.
    if temporal['all_qualification_flags']:
        review = bound_ref(run, approval.get('candidate_offline_review'), bound)
        view = {**copy.deepcopy(temporal), 'text_sha256': batch.sha(row['text'].encode()),
                'source_manifest_sha256': digest(run/'lines.private.json')}
        return unchanged_timing(row, view, review, approval.get('candidate_flag_decisions'), path, wav)
    require(approval.get('candidate_flag_decisions') == [] and approval.get('candidate_offline_review') is None,
            'Flag-free saved candidate needs no fabricated review/flag substitution.')
    return copy.deepcopy(temporal['word_cues'])


def sourcefree_timing_bundle(run, rows, takes, authored, bound, root_binding, timing_binding):
    """The exact new fifteen whole anonymous recognitions, separate from the 449 run."""
    folder = run/'free-large-timing15'
    plan_path, runner_path = folder/'plan.private.json', folder/'run.private.py'
    runner_bytes = frozen_runner_bytes(runner_path, SOURCEFREE_TIMING_RUNNER_SHA256)
    require(SOURCEFREE_TIMING_PLAN_SHA256 and digest(plan_path) == SOURCEFREE_TIMING_PLAN_SHA256,
            'Independently frozen separate source-free timing15 plan/runner required.')
    plan, result, intent = (batch.read(folder/name) for name in ['plan.private.json', 'result.private.json', 'execution-intent.private.json'])
    expected_binding = {'files_sha256': {str(folder/name): digest(folder/name) for name in
        ['plan.private.json', 'run.private.py', 'execution-intent.private.json', 'result.private.json']},
        'outputs_sha256': object_sha(result.get('outputs_sha256')), 'timing_bundle_sha256': object_sha(timing_binding)}
    require(root_binding == expected_binding, 'Root must bind the complete actual separate timing15 producer and its whole genuine timing20 ancestry.')
    require(digest(run/'full-large-timing20/result.private.json') == TIMING_RESULT_SHA256,
            'The new source-free timing15 must bind the exact actual completed timing20 result.')
    runner = types.ModuleType('part2_frozen_sourcefree_timing_diagnostic'); runner.__file__ = str(runner_path)
    exec(compile(runner_bytes, str(runner_path), 'exec'), runner.__dict__)
    runner.validate_plan(plan)  # Entire frozen Source/model/audio/20-result/15-scope readback, no execution.
    plan20 = batch.read(run/'full-large-timing20/plan.private.json')
    selected = [ident for ident in plan20['selected_ids'] if ident in authored and authored[ident]['actual_refined_dtw']['all_qualification_flags']]
    require(len(rows) == 1401 and len(authored) == 20 and len(selected) == len(set(selected)) == 15
            and plan.get('selected_ids') == selected and plan.get('selected_count') == 15 and plan.get('bank_count') == 1401
            and all(not takes[ident].get('reasons') and takes[ident].get('word_error_rate') == 0
                and base.qa_engine.words(takes[ident].get('transcript', '')) == base.qa_engine.words(rows[ident]['text']) for ident in selected),
            'Separate timing15 must be exactly the actual twenty-run holds with complete initial literal word proof.')
    metadata = {'source_free': True, 'teacher_forced_authored_text': False, 'automatic_adoption': False,
        'audio_or_cues_modified': False, 'approval': None, 'human_listening_or_acting_approval': False,
        'model_download_disabled_in_ram': True}
    inputs, outputs = plan.get('input_sha256'), result.get('outputs_sha256')
    require(isinstance(inputs, dict) and inputs and isinstance(outputs, dict) and outputs
            and plan.get('global_input_sha256') == object_sha(inputs)
            and plan.get('version') == SOURCEFREE_TIMING_VERSION and plan.get('runner_sha256') == SOURCEFREE_TIMING_RUNNER_SHA256
            and plan.get('shared_free449_runner_sha256') == SECONDARY_RUNNER_SHA256 and plan.get('call_args') == CALL_ARGS
            and plan.get('source_manifest_sha256') == digest(run/'lines.private.json')
            and plan.get('timing20_result_path') == str(run/'full-large-timing20/result.private.json')
            and plan.get('timing20_result_sha256') == TIMING_RESULT_SHA256
            and all(plan.get(key) == value and result.get(key) == value for key, value in metadata.items()),
            'Separate timing15 full immutable producer/source-free/ancestry contract differs.')
    runtime = {'model_path': str(FULL_MODEL.resolve()), 'dimensions': FULL_DIMENSIONS}
    require(result.get('version') == SOURCEFREE_TIMING_VERSION
            and result.get('state') == 'COMPLETED_SOURCEFREE_WORDTIME_DIAGNOSTIC_ONLY_NOT_APPROVED'
            and result.get('plan_sha256') == SOURCEFREE_TIMING_PLAN_SHA256 and result.get('runner_sha256') == SOURCEFREE_TIMING_RUNNER_SHA256
            and result.get('selected_ids') == selected and result.get('checked_count') == 15
            and result.get('global_input_sha256_before') == result.get('global_input_sha256_after') == object_sha(inputs)
            and result.get('actual_model') == plan.get('model') and result.get('actual_runtime') == runtime,
            'Actual complete separate source-free timing15 result is partial/stale/wrong model.')
    require(intent.get('version') == SOURCEFREE_TIMING_VERSION and intent.get('state') == 'ONE_ROOT_SOURCEFREE15_ATTEMPT'
            and intent.get('plan_sha256') == SOURCEFREE_TIMING_PLAN_SHA256 and intent.get('runner_sha256') == SOURCEFREE_TIMING_RUNNER_SHA256
            and intent.get('selected_ids') == selected and intent.get('source_free') is True and intent.get('approval') is None,
            'Separate actual once-only source-free timing15 intent differs.')
    for path, value in {**inputs, **outputs}.items():
        item = Path(path)
        require(item.is_absolute() and item.is_file() and not item.is_symlink() and digest(item) == value,
                'Actual source-free timing15 producer/ancestry/model/input/output bytes changed.')
        bound[path] = value
    model_evidence(plan['model'], bound)
    imports = result.get('actual_imported_runtime')
    require(isinstance(imports, dict) and set(imports) == SOURCEFREE_TIMING_IMPORTS
            and all(isinstance(value, dict) and inputs.get(value.get('path')) == value.get('sha256') for value in imports.values()),
            'Separate timing15 actual imported whole runtime differs from frozen bytes.')
    records = plan.get('records')
    require(isinstance(records, list) and [record.get('id') for record in records] == selected, 'Whole timing15 per-Source record census differs.')
    raw_by_id, failures, diagnoses = {}, 0, []
    expected_outputs = {str(folder/'execution-intent.private.json')}
    for record in records:
        ident, row = record['id'], rows[record['id']]
        mp3, wav, receipt = run/'clips'/(ident+'.mp3'), run/'raw'/(ident+'.wav'), run/'raw'/(ident+'.receipt.json')
        raw20, refined20 = run/'full-large-timing20/raw'/(ident+'.private.json'), run/'full-large-timing20/refined'/(ident+'.private.json')
        original = batch.read(run/'word-cues'/(ident+'.json'))
        require(record == {'id': ident, 'source_row': row, 'source_row_sha256': object_sha(row), 'primary_take': takes[ident],
            'mp3_path': str(mp3), 'mp3_sha256': digest(mp3), 'wav_path': str(wav), 'wav_sha256': digest(wav),
            'tts_receipt_path': str(receipt), 'tts_receipt_sha256': digest(receipt),
            'timing20_raw_path': str(raw20), 'timing20_raw_sha256': digest(raw20),
            'timing20_refined_path': str(refined20), 'timing20_refined_sha256': digest(refined20),
            'timing20_all_qualification_flags': authored[ident]['actual_refined_dtw']['all_qualification_flags'],
            'original_all_qualification_flags': original['all_qualification_flags']},
            'Separate timing15 exact current Source/primary/audio/TTS/old and actual20 flags differ.')
        call_path = folder/'call-intents'/(ident+'.private.json'); call = batch.read(call_path); expected_outputs.add(str(call_path))
        waveform = actual_timing15_waveform(mp3, plan['decoder'])
        require(call == {'id': ident, 'state': 'ONE_SOURCEFREE_CALL_ATTEMPT', 'source_free': True,
            'plan_sha256': SOURCEFREE_TIMING_PLAN_SHA256, 'runner_sha256': SOURCEFREE_TIMING_RUNNER_SHA256,
            'actual_call_args': CALL_ARGS, 'actual_audio_input': waveform, 'audio_sha256': digest(mp3), 'approval': None},
            'Separate actual anonymous source-free timing15 call/waveform differs.')
        raw_path, failure_path = folder/'raw'/(ident+'.private.json'), folder/'raw'/(ident+'.failure.private.json')
        require(raw_path.exists() != failure_path.exists(), 'Separate actual timing15 raw/failure is missing or ambiguous.')
        actual_path = raw_path if raw_path.exists() else failure_path; raw = read_raw(actual_path); expected_outputs.add(str(actual_path))
        require(raw.get('version') == SOURCEFREE_TIMING_VERSION and raw.get('id') == ident
            and raw.get('actual_call_args') == CALL_ARGS and raw.get('actual_audio_input') == waveform
            and raw.get('actual_imported_runtime') == imports and raw.get('actual_runtime') == runtime
            and raw.get('plan_sha256') == SOURCEFREE_TIMING_PLAN_SHA256 and raw.get('runner_sha256') == SOURCEFREE_TIMING_RUNNER_SHA256
            and raw.get('source_free') is True and raw.get('approval') is None,
            'Separate whole timing15 Raw/call/actual imported model/waveform differs.')
        if actual_path == failure_path:
            require(raw.get('state') == 'ACTUAL_SOURCEFREE_CALL_FAILED_WITHOUT_RESPONSE' and raw.get('actual_response') is None
                and isinstance(raw.get('exception_type'), str), 'Actual timing15 failure cannot be turned into a transcript/time receipt.')
            failures += 1
            diagnoses.append({'id': ident, 'actual_response_produced': False, 'exact_normalized_full_words': False,
                'uncertainty_reasons': ['actual_model_call_failed'], 'actual_intervals_valid': False})
            continue
        require(raw.get('audio_sha256') == digest(mp3) and raw.get('teacher_forced_authored_text') is False
            and raw.get('timing20_refined_sha256') == digest(refined20)
            and raw.get('timing20_all_qualification_flags') == record['timing20_all_qualification_flags']
            and raw.get('raw_saved_before_post_call_guards_and_diagnosis') is True
            and raw.get('automatic_adoption') is False and raw.get('human_listening_or_acting_approval') is False,
            'Separate successful timing15 Raw lacks whole current audio/real20 counterevidence/before-diagnosis provenance.')
        try:
            body = runner.base.diagnose(raw['actual_response'], row['text'])
            body.update(runner.interval_diagnosis(raw['actual_response'], waveform['sample_count']/16000))
        except Exception as error:
            body = {'exact_normalized_full_words': False, 'uncertainty_reasons': ['raw_interpretation_failed_'+type(error).__name__],
                'actual_intervals_valid': False, 'approval': None, 'automatic_adoption': False}
        reproduced = {'id': ident, 'raw_path': str(raw_path), 'raw_sha256': digest(raw_path),
            'source_row_sha256': object_sha(row), 'actual_response_produced': True, **body}
        diagnosis_path = folder/'diagnosis'/(ident+'.private.json'); expected_outputs.add(str(diagnosis_path))
        require(batch.read(diagnosis_path) == reproduced, 'Whole actual timing15 diagnosis differs from retained complete Raw response.')
        diagnoses.append(reproduced); raw_by_id[ident] = raw
    require(set(outputs) == expected_outputs and result.get('actual_response_count') == len(raw_by_id)
        and result.get('actual_call_failure_count') == failures and len(raw_by_id)+failures == 15
        and result.get('exact_normalized_full_words_count') == sum(value['exact_normalized_full_words'] for value in diagnoses)
        and result.get('actual_valid_word_interval_count') == sum(value['actual_intervals_valid'] for value in diagnoses),
        'Whole separate timing15 actual raw/diagnosis/interval/output census differs.')
    for name in ['plan.private.json', 'execution-intent.private.json', 'result.private.json']:
        bound[str(folder/name)] = digest(folder/name)
    bound[str(runner_path)] = SOURCEFREE_TIMING_RUNNER_SHA256
    return raw_by_id


def rms_frames(samples, rate):
    size = rate // 100
    values = [math.sqrt(math.fsum(value * value for value in samples[index:index+size]) / size)
              for index in range(0, len(samples) // size * size, size)]
    require(values, 'Actual waveform has no complete 10 ms frames.')
    ordered = sorted(values); location = (len(ordered)-1) * .05; low = math.floor(location)
    quantile = ordered[low] + (ordered[min(low+1, len(ordered)-1)]-ordered[low]) * (location-low)
    return values, max(.001, min(.003, quantile * 3))


def activity_window(rms, start, end, threshold):
    low, high = max(0, math.floor(start*100)), min(len(rms), math.ceil(end*100))
    values = rms[low:high]; active = [value >= threshold for value in values]
    def spans(mask):
        found, began = [], None
        for index, on in enumerate(mask):
            if on and began is None: began = index
            if began is not None and (not on or index == len(mask)-1):
                end_index = index if not on else index+1
                found.append({'start': round((began+low)/100, 3), 'end': round((end_index+low)/100, 3), 'frames': end_index-began})
                began = None
        return found
    live, quiet = spans(active), spans([not on for on in active])
    return {'requested_start': start, 'requested_end': end, 'frame_start': low/100, 'frame_end': high/100,
            'rms_threshold': threshold, 'frames': len(values), 'active_frames': sum(active), 'quiet_frames': len(values)-sum(active),
            'max_rms': max(values, default=0.0), 'mean_rms': math.fsum(values)/len(values) if values else 0.0,
            'active_intervals': live, 'quiet_intervals': quiet, 'longest_quiet_seconds': max((span['frames']/100 for span in quiet), default=0),
            'first_active': live[0]['start'] if live else None, 'last_active': live[-1]['end'] if live else None}


def same_measurement(actual, expected):
    if isinstance(actual, dict): return isinstance(expected, dict) and set(actual) == set(expected) and all(same_measurement(actual[key], expected[key]) for key in actual)
    if isinstance(actual, list): return isinstance(expected, list) and len(actual) == len(expected) and all(same_measurement(a, b) for a, b in zip(actual, expected))
    if type(actual) is float and finite(expected): return math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-12)
    return type(actual) is type(expected) and actual == expected


def unchanged_timing(row, temporal, review, decisions, mp3, wav):
    flags = temporal['all_qualification_flags']
    require(review.get('id') == row['id'] and review.get('text') == row['text']
            and review.get('text_sha256') == temporal['text_sha256'] and review.get('source_manifest_sha256') == temporal['source_manifest_sha256']
            and review.get('current_clip_sha256') == digest(mp3) and review.get('provider_wav_sha256') == digest(wav)
            and review.get('current_cues_sha256') == temporal['cues_sha256'] and review.get('all_qualification_flags') == flags
            and review.get('original_qualification_flags') == temporal['original_qualification_flags']
            and review.get('current_refined_flags') == temporal['qualification_flags']
            and review.get('status') == 'offline_exact_evidence_unapproved' and review.get('no_cues_changed') is True
            and review.get('automatic_approval') is False and review.get('human_listening_or_acting_approval') is False
            and review.get('whole_current_cue_validity_problems') == [], 'Exact full original timing review is missing/stale.')
    require(isinstance(decisions, list) and len(decisions) == len(flags)
            and [decision.get('flag') for decision in decisions] == flags, 'Every exact original flag needs its own ordered Root decision.')
    authored = ' ' + row['text']; pieces = temporal.get('token_alignment')
    require(isinstance(pieces, list) and pieces and ''.join(piece.get('text', '') for piece in pieces) == authored,
            'Complete actual authored token string differs from whole Source.')
    cursor = 0
    for piece in pieces:
        require(isinstance(piece.get('text'), str) and piece.get('char_start') == cursor
                and piece.get('char_end') == cursor+len(piece['text']) and finite(piece.get('probability'))
                and 0 <= piece['probability'] <= 1, 'Actual full token piece/character/probability receipt differs.')
        cursor = piece['char_end']
    spans = list(re.finditer(r'\S+', authored))
    require([match.group() for match in spans] == [word['word'] for word in temporal['words']], 'Actual token/word Source mapping differs.')
    samples, pcm = waveform_samples(mp3); rms, threshold = rms_frames(samples, 16000)
    decoded = review.get('waveforms', {}).get('actual_mp3_decode', {})
    require(decoded.get('pcm_sha256') == batch.sha(pcm) and decoded.get('samples') == len(samples)
            and decoded.get('sample_rate') == 16000 and decoded.get('dtype') == 'little_endian_float32'
            and math.isclose(threshold, temporal['refinement']['rms_threshold'], abs_tol=1e-10), 'Actual MP3 waveform/threshold differs from original review.')
    with wave.open(str(wav), 'rb') as stream:
        require((stream.getframerate(), stream.getnchannels(), stream.getsampwidth()) == (24000, 1, 2), 'Original provider PCM format differs.')
        original = stream.readframes(stream.getnframes())
    wav_values = array('h'); wav_values.frombytes(original)
    if sys.byteorder != 'little': wav_values.byteswap()
    wav_samples = array('f', (value / 32768 for value in wav_values))
    wav_rms, wav_threshold = rms_frames(wav_samples, 24000)
    require(review.get('waveforms', {}).get('provider_original', {}).get('pcm_sha256') == batch.sha(original), 'Original provider waveform review differs.')
    reviewed_words = review.get('flagged_words')
    require(isinstance(reviewed_words, list) and len({word.get('word_index') for word in reviewed_words}) == len(reviewed_words)
            and {word.get('word_index') for word in reviewed_words} == {flag['word_index'] for flag in flags}, 'Full flagged-word review census differs.')
    word_reviews = {word['word_index']: word for word in reviewed_words}
    for flag, decision in zip(flags, decisions):
        index = flag['word_index']; evidence = word_reviews[index]; match = spans[index]
        cue, raw = temporal['word_cues'][index], temporal['raw_word_cues'][index]
        tokens = [{**piece, 'token_class': 'lexical_or_mixed' if any(char.isalnum() for char in piece['text']) else 'actual_punctuation_only'}
                  for piece in pieces if piece['char_end'] > match.start() and piece['char_start'] < match.end()]
        lexical = [piece for piece in tokens if piece['token_class'] == 'lexical_or_mixed']
        weak = [piece for piece in tokens if piece['probability'] < .02]
        require(tokens and min(piece['probability'] for piece in tokens) == temporal['words'][index]['minimum_token_probability']
                and evidence.get('source_word') == match.group() and evidence.get('source_char_span') == [match.start()-1, match.end()-1]
                and evidence.get('actual_authored_dtw_tokens') == tokens and evidence.get('raw_interval') == raw
                and evidence.get('current_refined_interval') == cue and evidence.get('remaining_exact_risks') == [], 'Exact Source/token/current interval evidence contradicts approval.')
        require(lexical and all(piece['probability'] >= .02 for piece in lexical)
                and .02 <= cue['end']-cue['start'] <= 1.5 and temporal['refinement'].get('version') == 2,
                'Current lexical low/collapsed/long interval requires new actual evidence.')
        measurements = {'mp3_decoded_current_activity': activity_window(rms, cue['start'], cue['end'], threshold),
            'mp3_decoded_raw_activity': activity_window(rms, raw['start'], raw['end'], threshold),
            'mp3_decoded_discarded_leading': activity_window(rms, raw['start'], max(raw['start'], cue['start']), threshold),
            'mp3_decoded_discarded_trailing': activity_window(rms, min(cue['end'], raw['end']), raw['end'], threshold),
            'original_provider_wav_current_activity': activity_window(wav_rms, cue['start'], cue['end'], wav_threshold)}
        require(all(same_measurement(value, evidence.get(key)) for key, value in measurements.items())
                and measurements['mp3_decoded_current_activity']['active_frames'] > 0, 'Actual repeated waveform measurement differs from review.')
        for reason in flag['reasons']:
            if reason == 'long_acoustic_interval': require(raw['end']-raw['start'] > 1.5, 'Current long interval has no supported original refinement.')
            elif reason == 'low_authored_token_probability': require(weak and all(piece['token_class'] == 'actual_punctuation_only' for piece in weak), 'Low probability is lexical/mixed, not an exact pure-punctuation token case.')
            else: require(False, 'This initial interval flag requires new actual model/event evidence.')
        require(decision.get('decision') == 'approve_unchanged_initial_refined_interval'
                and decision.get('proof_sha256') == object_sha(evidence)
                and isinstance(decision.get('review_note'), str) and decision['review_note'].strip(), 'Concrete per-flag Root review/proof binding missing.')
        discarded = {'leading': measurements['mp3_decoded_discarded_leading']['active_intervals'],
                     'trailing': measurements['mp3_decoded_discarded_trailing']['active_intervals']}
        if discarded['leading'] or discarded['trailing']:
            accepted = decision.get('discarded_active_regions_review', {})
            require(accepted.get('regions') == discarded and isinstance(accepted.get('review_note'), str) and accepted['review_note'].strip(),
                    'Actual discarded activity/counterevidence requires additional scoped Root review.')
    return copy.deepcopy(temporal['word_cues'])


def model_timing(row, raw, audio_hash, seconds, flags, decisions):
    words = complete_literal_response(raw, row, audio_hash, seconds)
    return actual_word_interval_cues(row, words, seconds, flags, decisions, 'approve_actual_full_large_word_intervals')


def actual_word_interval_cues(row, words, seconds, flags, decisions, decision_name):
    authored = base.cue_engine.acoustic.normalized_text(row['text']).split()
    require(len(words) == len(authored) and all(base.qa_engine.words(actual['word']) == base.qa_engine.words(expected)
            and base.qa_engine.words(expected) for expected, actual in zip(authored, words)),
            'New model timing needs exact one-to-one whole authored whitespace words; no interpolation/aggregation/punctuation invention.')
    require(isinstance(decisions, list) and len(decisions) == len(flags) and [decision.get('flag') for decision in decisions] == flags
            and all(decision.get('decision') == decision_name
                    and isinstance(decision.get('review_note'), str) and decision['review_note'].strip() for decision in decisions),
            'Every original timing failure needs its own Root decision.')
    cues = [{'start': word['start'], 'end': word['end']} for word in words]
    base.cue_engine.cue_words(row['text'], cues, seconds)
    require(all(cue['end']-cue['start'] >= .02 and cue['end']-cue['start'] <= 1.5
                and word['probability'] >= .02 for cue, word in zip(cues, words)), 'New actual lexical model intervals remain uncertain.')
    return cues


def complete_timing15_response(raw, row, audio_hash, seconds):
    require(raw.get('version') == SOURCEFREE_TIMING_VERSION and raw.get('id') == row['id']
        and raw.get('audio_sha256') == audio_hash and raw.get('source_free') is True
        and raw.get('teacher_forced_authored_text') is False and raw.get('raw_saved_before_post_call_guards_and_diagnosis') is True
        and raw.get('actual_runtime') == {'model_path': str(FULL_MODEL.resolve()), 'dimensions': FULL_DIMENSIONS}
        and raw.get('plan_sha256') == SOURCEFREE_TIMING_PLAN_SHA256 and raw.get('runner_sha256') == SOURCEFREE_TIMING_RUNNER_SHA256
        and SOURCEFREE_TIMING_PLAN_SHA256 and SOURCEFREE_TIMING_RUNNER_SHA256 and raw.get('actual_call_args') == CALL_ARGS
        and raw.get('approval') is None and raw.get('automatic_adoption') is False
        and raw.get('human_listening_or_acting_approval') is False,
        'Selected timing15 requires its separate actual whole anonymous Full-Large Raw provenance.')
    return literal_response_body(raw.get('actual_response'), row, seconds)


def sourcefree_timing_case(row, original, approval, secondary, authored, run, path, seconds, bound):
    ref = approval.get('raw')
    require(isinstance(ref, dict) and ref.get('path') == str(run/'free-large-timing15/raw'/(row['id']+'.private.json')),
        'Root must bind the exact separate timing15 Raw, never a 449 or authored20 substitution.')
    raw = bound_ref(run, ref, bound)
    require(raw == secondary.get(row['id']) and row['id'] in authored
        and raw.get('actual_audio_input') == actual_timing15_waveform(path, raw.get('actual_audio_input', {}).get('decoder')),
        'Root timing15 Raw must be the actual whole producer/current waveform.')
    flags20 = authored[row['id']]['actual_refined_dtw']['all_qualification_flags']
    decisions20 = approval.get('timing20_flag_decisions')
    require(flags20 and approval.get('retained_timing20_flags') == flags20
        and isinstance(decisions20, list) and [decision.get('flag') for decision in decisions20] == flags20
        and all(decision.get('decision') == 'approve_actual_full_large_sourcefree_timing15_intervals'
            and isinstance(decision.get('review_note'), str) and decision['review_note'].strip() for decision in decisions20),
        'Every actual new authored20 failure remains visible and needs its own scoped Root timing15 decision.')
    words = complete_timing15_response(raw, row, digest(path), seconds)
    return actual_word_interval_cues(row, words, seconds, original['all_qualification_flags'],
        approval.get('flag_decisions'), 'approve_actual_full_large_sourcefree_timing15_intervals')


def case_binding(args, run, row):
    paths = [run/'prepared.json', run/'lines.private.json', run/'profiles.private.json', run/'requests.jsonl',
             run/'raw'/(row['id']+'.receipt.json'), run/'raw'/(row['id']+'.wav'), run/'clips'/(row['id']+'.mp3'),
             run/'word-cues'/(row['id']+'.json'), Path(args.qa_report), Path(args.alignment_report),
             Path(args.qa_producer), Path(args.alignment_producer)]
    receipt = batch.read(paths[4])
    return {'id': row['id'], 'source_row': row, 'source_row_sha256': object_sha(row),
            'source_text_sha256': batch.sha(row['text'].encode()), 'tts_request_sha256': receipt.get('request_sha256'),
            'files_sha256': {str(path): digest(path) for path in paths}}


def case_secondary(run, ident, approval, secondary, path, bound):
    ref = approval.get('raw')
    require(isinstance(ref, dict) and ref.get('path') == str(run/'free-large449/raw'/(ident+'.private.json')),
            'Root must bind this exact actual whole secondary raw file.')
    raw = bound_ref(run, ref, bound)
    require(raw == secondary.get(ident), 'Root raw binding differs from actual completed whole secondary producer.')
    require(raw.get('actual_audio_input') == actual_anonymous_waveform(path), 'Actual current anonymous decoder waveform differs from model-call raw.')
    return raw


def evidence_clip(row, run, profiles, qa, alignment, take, case, args, bound, secondary, decode_fn=None, authored=None, sourcefree_timing=None):
    ident = row['id']; path = run/'clips'/(ident+'.mp3'); audio_hash = digest(path); text_hash = batch.sha(row['text'].encode())
    temporal = batch.read(run/'word-cues'/(ident+'.json'))
    require(case.get('version') == VERSION and case.get('status') == 'approved_part2_case_evidence'
            and case.get('reviewed_by') == 'root' and case.get('actual_whole_source_and_counterevidence_reviewed') is True
            and case.get('human_listening_or_acting_approval') is False and case.get('binding') == case_binding(args, run, row)
            and case.get('retained_initial_take') == take and case.get('retained_initial_timing_flags') == temporal['all_qualification_flags'],
            'Explicit exact current per-Source Root approval and complete original failures required.')
    require(not take.get('adjudication') and take.get('text_sha256') == text_hash
            and qa.get('clip_sha256', {}).get(ident) == alignment.get('clip_sha256', {}).get(ident) == audio_hash,
            'Initial actual Source/audio/report differs or was adjudicated in place.')
    signal = (decode_fn or base.qa_engine.decode)(path)
    require(signal == take.get('signal') and not base.qa_engine.signal_failures(signal, len(base.qa_engine.words(row['text']))), 'Current physical signal differs/fails.')
    receipt = batch.read(run/'raw'/(ident+'.receipt.json')); wav = run/'raw'/(ident+'.wav')
    require(receipt.get('status') == 'complete' and receipt.get('backend') == 'batch' and receipt.get('id') == ident
            and receipt.get('mp3_sha256') == audio_hash and receipt.get('wav_sha256') == digest(wav)
            and receipt.get('request_sha256') == batch.sha(batch.canonical(batch.request_for(row, profiles['speakers'])).encode()),
            'Actual provider/normalization receipt differs from this current Source request/audio.')
    require(receipt.get('normalization') == {'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11}
            and isinstance(receipt.get('loudness_input'), dict)
            and all(key in receipt['loudness_input'] and math.isfinite(float(receipt['loudness_input'][key])) for key in
                    ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'])
            and finite(receipt.get('seconds')) and abs(receipt['seconds']-signal['seconds']) < .1,
            'Actual normalization/duration measurement missing or changed.')
    words = base.cue_engine.acoustic.normalized_text(row['text']).split()
    require(temporal.get('engine_version') == base.cue_engine.ENGINE and temporal.get('audio_sha256') == audio_hash
            and temporal.get('text_sha256') == text_hash and temporal.get('text') == row['text']
            and temporal.get('source_manifest_sha256') == digest(run/'lines.private.json')
            and abs(temporal.get('decoded_seconds', -100)-signal['seconds']) < .001
            and temporal.get('authored_word_count') == len(words) and len(temporal.get('word_cues', [])) == len(words)
            and [word.get('word') for word in temporal.get('words', [])] == words
            and temporal.get('cues_sha256') == base.cue_engine.acoustic.cue_sha(temporal['word_cues'])
            and temporal.get('all_qualification_flags') == base.cue_engine.qualification_flags(temporal)
            and not any(key in temporal for key in ['CTC_adoption', 'Partial_CTC_adoption', 'Vocal_event_adoption']),
            'Exact complete initial real timing receipt was changed or substituted.')
    word_approval, timing_approval = case.get('word'), case.get('timing')
    if take.get('reasons'):
        require(set(take['reasons']) <= WORD_FAILURES and isinstance(word_approval, dict)
                and word_approval.get('mode') == 'literal_source_free_full_large'
                and isinstance(word_approval.get('review_note'), str) and word_approval['review_note'].strip(), 'Initial lexical failure needs scoped genuine literal secondary evidence.')
        raw = case_secondary(run, ident, word_approval, secondary, path, bound)
        complete_literal_response(raw, row, audio_hash, signal['seconds'])
    else:
        require(word_approval is None and isinstance(take.get('transcript'), str)
                and base.qa_engine.words(take['transcript']) == base.qa_engine.words(row['text'])
                and take.get('word_error_rate') == 0, 'Actual initial whole-word literal evidence differs.')
    flags = temporal['all_qualification_flags']
    if flags:
        require(isinstance(timing_approval, dict), 'Initial timing failure needs scoped per-flag genuine evidence.')
        if timing_approval.get('mode') == 'unchanged_initial_refined':
            review = bound_ref(run, timing_approval.get('offline_review'), bound)
            for pin in review.get('proofs', []) + review.get('global_proof_pins', []):
                current = batch.contained(batch.ROOT, pin['path']); require(digest(current) == pin['sha256'], 'Original timing-review evidence changed.'); bound[str(current)] = pin['sha256']
            cues = unchanged_timing(row, temporal, review, timing_approval.get('flag_decisions'), path, wav)
        elif timing_approval.get('mode') == 'actual_full_large_word_intervals':
            raw = case_secondary(run, ident, timing_approval, secondary, path, bound)
            cues = model_timing(row, raw, audio_hash, signal['seconds'], flags, timing_approval.get('flag_decisions'))
        elif timing_approval.get('mode') == 'actual_full_large_authored_receipt':
            require(not take.get('reasons') and word_approval is None and ident in (authored or {}),
                    'Forced authored timing may only serve initially literal-clear words, never word approval.')
            cues = authored_timing(row, temporal, timing_approval, authored[ident], run, bound, path, wav)
        elif timing_approval.get('mode') == 'actual_full_large_sourcefree_timing15_intervals':
            require(not take.get('reasons') and word_approval is None and ident in (sourcefree_timing or {}),
                'The separate timing15 route requires independent initial whole literal-clear words, never a forced-word proof.')
            cues = sourcefree_timing_case(row, temporal, timing_approval, sourcefree_timing, authored or {}, run, path, signal['seconds'], bound)
        else: require(False, 'Unknown/estimated timing evidence mode.')
    else:
        require(timing_approval is None, 'Flag-free initial timing may not be silently changed.')
        entry = alignment.get('alignment_by_id', {}).get(ident, {})
        cues = temporal['word_cues']
        require(entry.get('cues_sha256') == temporal['cues_sha256'] and entry.get('word_count') == len(words)
                and entry.get('text_sha256') == text_hash and entry.get('words') == [{'word': word, **cue} for word, cue in zip(words, cues)],
                'Flag-free initial alignment differs from actual full report.')
    detail = base.cue_engine.cue_words(row['text'], cues, signal['seconds'])
    previous_end = 0.0
    for word, cue, data in zip(words, cues, temporal['words']):
        require(cue['start'] < cue['end'] or (data.get('spoken') is False and not base.re_word(word)), 'Collapsed lexical public cue remains private.')
        if not base.re_word(word):
            require(data.get('spoken') is False and cue['start'] == cue['end'] == previous_end,
                    'Standalone visual punctuation must retain its genuine preceding acoustic endpoint.')
        previous_end = cue['end']
    require(len(detail) == len(words) and alignment.get('authored_text_sha256', {}).get(ident) == text_hash, 'Full current timing Source census differs.')
    for name, value in case['binding']['files_sha256'].items(): bound[name] = value
    require(digest(path) == audio_hash, 'Audio changed during supplemental qualification.')
    return {'id': ident, 'kind': row['kind'], 'speaker': row['speaker'], 'text': row['text'], 'display_text': row['display_text'],
            'voice': profiles['speakers'][row['speaker']]['google_voice'], 'audio': 'audio/teil-2/'+ident+'.mp3',
            'sha256': audio_hash, 'seconds': signal['seconds'], 'word_cues': copy.deepcopy(cues),
            'runtime_keys': copy.deepcopy(row['runtime_keys'])}, path


def build(args, initial_selection, selection=None):
    for name, expected in FROZEN_BASE.items(): require(digest(batch.ROOT/'scripts'/name) == expected, 'Frozen initial publisher/qualifier/transport changed.')
    public, paths, preserved, bound = base.build(args, initial_selection)
    target_root = Path(initial_selection['target_root'])
    target_adapter = target_root/'scripts'/Path(__file__).name
    require(target_adapter.is_file() and digest(target_adapter) == digest(__file__), 'Release worktree supplemental adapter differs from independently frozen production code.')
    bound[str(target_adapter)] = digest(target_adapter)
    bound[str(Path(args.selection))] = digest(args.selection)
    bound[str(Path(__file__))] = digest(__file__)
    if selection is None: return public, paths, preserved, bound, initial_selection
    run = Path(args.run_dir).expanduser().resolve()
    require(selection.get('version') == VERSION and selection.get('status') == 'approved_part2_supplemental_voice_selection'
            and selection.get('reviewed_by') == 'root' and selection.get('human_listening_or_acting_approval') is False
            and selection.get('initial_selection_sha256') == digest(args.selection)
            and selection.get('adapter_sha256') == digest(__file__) and selection.get('target_root') == initial_selection.get('target_root')
            and selection.get('preserved_banks_sha256') == initial_selection.get('preserved_banks_sha256'), 'Exact independently reviewed additive Root selection missing/stale.')
    for field in ['manifest_sha256', 'profiles_sha256', 'prepared_sha256', 'qa_sha256', 'alignment_sha256', 'qa_producer_sha256', 'alignment_producer_sha256']:
        require(selection.get(field) == initial_selection.get(field), 'Supplemental Root selection changes initial evidence.')
    manifest, profiles = batch.read(run/'lines.private.json'), batch.read(run/'profiles.private.json')
    qa, alignment = batch.read(args.qa_report), batch.read(args.alignment_report)
    takes, checked = base.report_coverage(qa, alignment, manifest, run)
    rows = {row['id']: row for row in manifest['lines']}
    baseline_ids = {clip['id'] for clip in public['clips']}
    chosen = base.ids(selection.get('selected_ids'), 'supplemental whole Root selected IDs')
    additional = chosen-baseline_ids
    require(baseline_ids <= chosen <= checked and additional, 'Supplement must add actual checked Sources without dropping baseline takes.')
    references = selection.get('case_approvals')
    require(isinstance(references, list) and len(references) == len(additional), 'Exact per-case Root approval census missing.')
    cases = {}
    for ref in references:
        case = bound_ref(run, ref, bound); ident = case.get('binding', {}).get('id')
        require(ident in additional and ident not in cases, 'Unknown/duplicate/out-of-selection case approval.'); cases[ident] = case
    require(set(cases) == additional, 'Per-case approvals do not cover the exact additional selection.')
    needs_secondary = any(case.get('word') or (case.get('timing') or {}).get('mode') == 'actual_full_large_word_intervals' for case in cases.values())
    secondary = secondary_bundle(run, rows, takes, bound, selection.get('secondary_bundle')) if needs_secondary else {}
    needs_sourcefree_timing = any((case.get('timing') or {}).get('mode') == 'actual_full_large_sourcefree_timing15_intervals' for case in cases.values())
    needs_authored = needs_sourcefree_timing or any((case.get('timing') or {}).get('mode') == 'actual_full_large_authored_receipt' for case in cases.values())
    authored = authored_bundle(run, rows, takes, bound, selection.get('timing_bundle')) if needs_authored else {}
    sourcefree_timing = sourcefree_timing_bundle(run, rows, takes, authored, bound, selection.get('sourcefree_timing_bundle'), selection.get('timing_bundle')) if needs_sourcefree_timing else {}
    proof_paths = base.response_records(run, additional)
    bound.update({str(path): digest(path) for path in proof_paths})
    clips = {clip['id']: clip for clip in public['clips']}
    for ident, case in cases.items():
        for approval in [case.get('word'), case.get('timing')]:
            if isinstance(approval, dict) and approval.get('mode') in {'literal_source_free_full_large', 'actual_full_large_word_intervals'}:
                require(approval.get('secondary_bundle_sha256') == object_sha(selection.get('secondary_bundle')),
                        'This Root case must bind the same complete real secondary producer approved in its selection.')
            if isinstance(approval, dict) and approval.get('mode') == 'actual_full_large_authored_receipt':
                require(approval.get('timing_bundle_sha256') == object_sha(selection.get('timing_bundle')),
                        'This Root case must bind the same complete real forced-timing producer approved in its selection.')
            if isinstance(approval, dict) and approval.get('mode') == 'actual_full_large_sourcefree_timing15_intervals':
                require(approval.get('sourcefree_timing_bundle_sha256') == object_sha(selection.get('sourcefree_timing_bundle'))
                    and approval.get('timing_bundle_sha256') == object_sha(selection.get('timing_bundle')),
                    'This Root timing15 case must bind both complete actual anonymous15 and unchanged authored20 producer ancestry.')
        clip, path = evidence_clip(rows[ident], run, profiles, qa, alignment, takes[ident], case, args, bound, secondary,
            authored=authored, sourcefree_timing=sourcefree_timing)
        clips[ident], paths[ident] = clip, path
    public['clips'] = [clips[row['id']] for row in manifest['lines'] if row['id'] in clips]
    coverage = public['coverage']
    coverage.update(version=VERSION, missing_sources=[missing for missing in coverage['missing_sources'] if missing['id'] not in additional],
                    published_sources=len(clips), initial_qualified_sources=len(baseline_ids), supplemental_qualified_sources=len(additional),
                    retained_initial_word_failures=len(qa['failures']), retained_initial_timing_failures=len(alignment['failures']),
                    initial_qa_sha256=digest(args.qa_report), initial_alignment_sha256=digest(args.alignment_report),
                    supplemental_selection_sha256=digest(args.supplemental_selection), human_listening_or_acting_approval=False)
    coverage['status'] = 'complete' if not coverage['missing_sources'] else 'partial'
    require(len(public['clips'])+len(coverage['missing_sources']) == len(rows), 'Honest whole Source coverage cardinality differs.')
    bound[str(args.supplemental_selection)] = digest(args.supplemental_selection)
    return public, paths, preserved, bound, selection


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['dryrun', 'apply'])
    parser.add_argument('--run-dir', required=True)
    parser.add_argument('--selection', required=True, type=Path, help='Original separately Root-approved initial selection')
    parser.add_argument('--supplemental-selection', type=Path, help='Optional additional per-case Root selection; never modifies initial reports')
    parser.add_argument('--adapter-sha256', required=True, help='Independent reviewed/frozen adapter hash, supplied explicitly by Root')
    parser.add_argument('--target-root', type=Path)
    for name in ['qa-report', 'alignment-report', 'qa-producer', 'alignment-producer', 'coverage-report']:
        parser.add_argument('--'+name, required=True, type=Path)
    args = parser.parse_args()
    try:
        require(digest(__file__) == args.adapter_sha256, 'Root must supply the independently frozen adapter hash.')
        run = Path(args.run_dir).expanduser().resolve()
        require(batch.PRIVATE.resolve() in args.coverage_report.resolve().parents and args.coverage_report.resolve() == args.coverage_report,
                'Immutable coverage report must remain at an exact private path.')
        with ExitStack() as locks:
            lock = locks.enter_context((batch.PRIVATE/'publish.lock').open('a+')); fcntl.flock(lock, fcntl.LOCK_EX)
            initial_selection = batch.read(args.selection)
            selection = batch.read(args.supplemental_selection) if args.supplemental_selection else None
            target_root = args.target_root.expanduser().resolve() if args.target_root else batch.ROOT.resolve()
            require(initial_selection.get('target_root') == str(target_root), 'Initial selection must bind the exact locked publication worktree.')
            locks.enter_context(base.target_publish_lock(target_root))
            public, paths, preserved, bound, transaction_selection = build(args, initial_selection, selection)
            target = target_root/'game/public/audio/teil-2'
            base.existing(target, transaction_selection, public); base.stable(bound, preserved)
            report = {'state': 'PUBLISHED' if args.command == 'apply' else 'VALIDATED', **public['coverage'], 'version': VERSION,
                      'public_manifest_sha256': batch.sha((json.dumps(public, ensure_ascii=False, indent=2)+'\n').encode()),
                      'initial_selection_sha256': digest(args.selection), 'supplemental_selection_sha256': digest(args.supplemental_selection) if args.supplemental_selection else None,
                      'adapter_sha256': digest(__file__), 'preserved_bank_sha256': preserved, 'checked_at': int(time.time())}
            require(not args.coverage_report.exists(), 'Immutable coverage proof already exists; no overwrite.')
            if args.command == 'apply':
                report_identity = None
                def finalize():
                    nonlocal report_identity
                    report_identity = base.exclusive_report(args.coverage_report, report); bound[str(args.coverage_report)] = digest(args.coverage_report)
                def undo():
                    if report_identity is not None and args.coverage_report.exists() and (args.coverage_report.stat().st_dev, args.coverage_report.stat().st_ino) == report_identity: args.coverage_report.unlink()
                base.apply(target, transaction_selection, public, paths, preserved, bound, finalize, undo)
            else: base.exclusive_report(args.coverage_report, report)
            print(json.dumps({'state': report['state'], 'published': len(public['clips']), 'missing': len(public['coverage']['missing_sources']),
                              'human_listening_or_acting_approval': False}))
        return 0
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError, AttributeError, IndexError):
        print('Additive Teil-II evidence publication refused; initial reports, failures and public banks remain protected.', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
