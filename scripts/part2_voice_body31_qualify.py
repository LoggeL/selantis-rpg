#!/usr/bin/env python3
"""Fresh Root-only QA/DTW for exact prepared body31 groups01..04 (8/8/8/7).

Frozen8ee3 definitions are reused in a separate in-memory module, never edited.
QA receives actual decoded waveform only, with fixed German options and no
Source text/path hints. Alignment is explicitly authored timing, never word
proof. The32nd Source reuse remains unapproved metadata, outside these31 calls.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
import hashlib
import importlib
import json
import os
from pathlib import Path
import shutil
import sys
import types

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT/'scripts/part2_voice_retake_qualify.py'
BASE_SHA = '8ee334962fd25464e70d03209ab51d5f8d8c45cb47fc305a9fc0c9741523b877'
BASE_TEST_SHA = '2252f1a7d2d92b82d06e8919cc22b1b7764fbd0df272105d6d27bdf9f89969de'
DRIVER_SHA = '0dff176b86bc6a26afce0feb2a819d65239822d1b55f0718548d62d06072e404'
VERSION = 'part2-current-body31-actual-local-qualification-v1'
RUN = ROOT/'output/audio/part2-voice/2026-10-08-all'
REVIEW_PATH = RUN/'root-body31-prepared-review.private.json'
REVIEW_SHA = '6fab66837a10dc50e9a3b21bbc0513279e7a09f61351a89f7d7e33c66fcdb02a'
REUSE_SHA = 'd9d84e845e60167e158767c5d14ef096747bda6cf79d10e90c261bb50cf50fd2'
VENV = Path('/Users/logge/Documents/Projects/SelantisRPG/.venv-transcribe')
MODEL = VENV/'models/whisper-large-v3-turbo'
DECODER_FORMATS = {
    'qa': {'format': 's16le', 'codec': 'pcm_s16le', 'sample_rate': 16000, 'channels': 1,
           'pcm_to_float_conversion': 'mlx.float32(int16_pcm)/32768.0; numpy.asarray(dtype=float32)'},
    'align': {'format': 'f32le', 'sample_rate': 16000, 'channels': 1,
              'pcm_to_float_conversion': 'numpy.frombuffer(stdout,dtype="<f4").copy()'},
}
blob = BASE_PATH.read_bytes()
if hashlib.sha256(blob).hexdigest() != BASE_SHA: raise RuntimeError('Frozen8ee3 definitions changed; not executed.')
q = types.ModuleType('body31_frozen8_readonly'); q.__file__ = str(BASE_PATH)
exec(compile(blob, str(BASE_PATH), 'exec'), q.__dict__)
retake, batch, require, read, digest = q.retake, q.batch, q.require, q.read, q.digest
_collected, _helpers, _model_identity, _capture, _local = q.collected, q.helper_hashes, q.model_identity, q.capture_actual, q.local_only_runtime
IMPORTS = ['mlx.core', 'mlx_whisper', 'numpy', 'mlx_whisper.transcribe', 'mlx_whisper.audio', 'mlx_whisper.load_models',
           'mlx_whisper.whisper', 'mlx_whisper.timing', 'mlx_whisper.tokenizer', 'scipy', 'scipy.signal', 'numba',
           'llvmlite', 'llvmlite.binding', 'tiktoken', 'regex', 'huggingface_hub']


def specifications():
    require(digest(BASE_PATH) == BASE_SHA and digest(REVIEW_PATH) == REVIEW_SHA
            and digest(ROOT/'scripts/part2_voice_retake_qualify_test.py') == BASE_TEST_SHA
            and digest(Path(retake.__file__)) == DRIVER_SHA, 'Frozen Root body31/8ee3/test/driver contract changed.')
    value = read(REVIEW_PATH)
    require(value.get('state') == 'ROOT32_WHOLE_SOURCE_ACTUAL_COUNTERWORDS_AND_SHORT_STYLE_REVIEWED'
            and value.get('source_case_count') == 32 and value.get('unique_request_count') == 31
            and value.get('reviewed_by') == 'root' and value.get('human_listening_or_acting_approval') is False,
            'Exact Root32-prepared/31-request review required.')
    reuse_ref = value['reuse_pair_unpublished_and_requires_actual_audio_word_time_proof']
    require(reuse_ref['sha256'] == REUSE_SHA and digest(reuse_ref['path']) == REUSE_SHA, 'Original unapproved32nd Source reuse evidence changed.')
    reuse = read(reuse_ref['path'])
    require(reuse.get('audio_or_cue_adoption') is False and reuse.get('original_source_or_cast_changed') is False,
            'A prospective Source reuse may not become adoption through qualification.')
    groups, all_ids, request_hashes = {}, [], []
    require(len(value['groups']) == 4, 'Exactly four original prepared groups required.')
    for index, entry in enumerate(value['groups'], 1):
        run = RUN/'retake-driver'/('body32-group-'+str(index).zfill(2)); info = read(run/'prepared.json')
        expected_count = 7 if index == 4 else 8
        require(entry['directory'] == str(run) and entry['count'] == info['request_count'] == expected_count
            and digest(run/'prepared.json') == entry['prepared_sha256']
            and info['input_sha256'] == entry['input_sha256'] == digest(run/'requests.jsonl')
            and len(info['selected_ids']) == len(set(info['selected_ids'])) == expected_count
            and [record['key'] for record in retake.records(run/'requests.jsonl')] == info['selected_ids'],
            'Exact group directory/prepared/request bytes/IDs differ.')
        for name, sha in info['frozen_sha256'].items(): require(digest(batch.contained(run, name)) == sha, 'A frozen group artifact changed.')
        snapshot = read(run/'parent-snapshot.private.json')
        actual_requests = {row['key']: retake.sha(retake.canonical(row['request']).encode())
                           for row in retake.records(run/'requests.jsonl')}
        require(snapshot['new_request_sha256'] == actual_requests, 'Whole per-ID actual request bytes/scope differ.')
        all_ids.extend(info['selected_ids']); request_hashes.extend(snapshot['new_request_sha256'].values())
        groups[str(run)] = info
    require(len(all_ids) == len(set(all_ids)) == len(set(request_hashes)) == 31
        and reuse['representative_request_id'] in all_ids and reuse['target_source_id'] not in all_ids,
        '31unique actual calls plus explicitly excluded32nd Source reuse required.')
    return groups


def group(run):
    run = Path(run)
    require(run.is_absolute() and run.resolve() == run and not run.is_symlink(), 'Exact lexical prepared group path required.')
    specs = specifications(); require(str(run) in specs, 'Only the four exact Root-prepared body31 groups are allowed.')
    info = specs[str(run)]
    q.EXPECTED_IDS, q.EXPECTED_INPUT_SHA, q.VERSION = list(info['selected_ids']), info['input_sha256'], VERSION
    return info


def no_duplicate_audio(run):
    seen = {}
    for name in specifications():
        child = Path(name)
        if not (child/'collection.private.json').exists(): continue
        completion = read(child/'collection.private.json')
        for ident in read(child/'prepared.json')['selected_ids']:
            path = child/'clips'/(ident+'.mp3')
            if not path.exists():
                require(completion.get('expected') != completion.get('collected'), 'A fully collected group has incomplete audio.')
                continue
            require(path.is_file() and not path.is_symlink(), 'Unsafe actual peer-group audio.')
            sha = digest(path)
            require(sha not in seen or seen[sha] == ident, 'Same actual audio may not be qualified twice for different body31 requests.')
            seen[sha] = ident


def collected(run, live=False):
    group(run); info, rows = _collected(run, live=live)
    no_duplicate_audio(run)
    return info, rows


def runtime_files():
    sites = list((VENV/'lib').glob('python*/site-packages')); require(len(sites) == 1, 'Exact installed runtime site required.')
    files = []
    for name in ['mlx', 'mlx_whisper', 'numpy', 'scipy', 'numba', 'llvmlite', 'tiktoken', 'regex', 'huggingface_hub']:
        directory = sites[0]/name; require(directory.is_dir(), 'Installed runtime dependency missing; no download.')
        files.extend(path for path in directory.rglob('*') if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc')
        files.extend(sites[0].glob(name+'-*.dist-info/METADATA'))
    ffmpeg = shutil.which('ffmpeg'); require(ffmpeg, 'Actual existing decoder missing; no install.')
    files.append(Path(ffmpeg))
    return {str(path.resolve()): digest(path) for path in files}


def model_identity(path):
    require(Path(path).is_absolute() and Path(path).resolve() == MODEL.resolve(), 'Exact existing installed Turbo directory only.')
    value = _model_identity(path); aliases, stats = {}, {}
    for name, sha in value['weights'].items():
        item = MODEL/name; target = item.resolve(); stat = target.stat()
        aliases[name] = {'lexical_path': str(item), 'resolved_path': str(target), 'is_symlink': item.is_symlink(), 'sha256': sha}
        stats[str(target)] = {'device': stat.st_dev, 'inode': stat.st_ino, 'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns}
    ffmpeg = shutil.which('ffmpeg'); require(ffmpeg, 'Existing decoder missing.')
    binary = {'selected_path': ffmpeg, 'resolved_path': str(Path(ffmpeg).resolve()), 'sha256': digest(ffmpeg)}
    value.update(loader_aliases=aliases, weight_file_stats=stats, runtime_files_sha256=runtime_files(),
                 decoders={name: {**binary, **contract} for name, contract in DECODER_FORMATS.items()})
    return value


def loader_guard(model):
    root = Path(model['local_directory'])
    require(digest(root/'config.json') == model['config_sha256']
        and {p.name for p in [*root.glob('*.safetensors'), *root.glob('*.npz')]} == set(model['loader_aliases']), 'Actual model config/loader namespace changed.')
    for name, alias in model['loader_aliases'].items():
        p = root/name; require(str(p.resolve()) == alias['resolved_path'] and p.is_symlink() == alias['is_symlink'], 'Model loader alias changed.')
    for path, expected in model['weight_file_stats'].items():
        stat = Path(path).stat()
        require({'device': stat.st_dev, 'inode': stat.st_ino, 'size': stat.st_size, 'mtime_ns': stat.st_mtime_ns} == expected, 'Actual model weights changed.')
    actual = shutil.which('ffmpeg')
    for command, decoder in model['decoders'].items():
        require(command in DECODER_FORMATS and decoder == {**DECODER_FORMATS[command], 'selected_path': actual,
            'resolved_path': str(Path(actual).resolve()), 'sha256': digest(actual)}, 'Actual operation-specific decoder path/bytes/format changed.')
    require(set(model['decoders']) == set(DECODER_FORMATS), 'Both actual decoder contracts required.')


def imported_runtime(model):
    observed = {}
    for name in IMPORTS:
        module = importlib.import_module(name); path = Path(module.__file__).resolve()
        require(str(path) in model['runtime_files_sha256'] and digest(path) == model['runtime_files_sha256'][str(path)], 'Actual runtime import outside pinned installed bytes.')
        observed[name] = {'path': str(path), 'sha256': digest(path)}
    return observed


def helpers():
    value = _helpers()
    value.update(body31_adapter=digest(__file__), body31_tests=digest(ROOT/'scripts/part2_voice_body31_qualify_test.py'),
                 root_body31_review=digest(REVIEW_PATH), excluded_source32_reuse=REUSE_SHA)
    return value


@contextmanager
def local_only_runtime(command):
    holder = importlib.import_module('mlx_whisper.transcribe').ModelHolder
    require(holder.model is None and holder.model_path is None, 'Each QA/align operation requires its own fresh process without an earlier loaded model.')
    with _local(command): yield


@contextmanager
def capture_actual(run, command, evidence):
    evidence.update(root_body31_review_sha256=REVIEW_SHA, source_case_count=32, unique_prepared_request_count=31,
                    source32_reuse_approved=False, operation_source_kind='sourcefree_words' if command == 'qa' else 'authored_timing_only',
                    operation_decoder=evidence['model']['decoders'][command])
    if command == 'align':
        evidence['actual_imported_runtime'] = imported_runtime(evidence['model']); loader_guard(evidence['model'])
        with _capture(run, command, evidence): yield
        loader_guard(evidence['model']); return
    import mlx_whisper
    import numpy as np
    audio_module = importlib.import_module('mlx_whisper.audio'); holder = importlib.import_module('mlx_whisper.transcribe').ModelHolder
    original = mlx_whisper.transcribe
    def capture(path, *args, **kwargs):
        ident = Path(path).stem
        expected = {'path_or_hf_repo': evidence['model']['local_directory'], 'language': 'de', 'condition_on_previous_text': False, 'temperature': 0.0}
        require(ident in q.EXPECTED_IDS and Path(path).resolve() == (run/'clips'/(ident+'.mp3')).resolve()
            and not evidence.get('runtime_guard_failed') and not args and kwargs == expected, 'Unexpected or Source-hinted local QA call.')
        require(not (run/'local-asr-intents'/(ident+'.private.json')).exists()
                and not (run/'asr-raw'/(ident+'.private.json')).exists(), 'Actual Source-free call was already attempted; no repeat.')
        imports = imported_runtime(evidence['model']); loader_guard(evidence['model'])
        actual_hash = digest(path); waveform = np.asarray(audio_module.load_audio(str(path)), dtype=np.float32)
        require(waveform.ndim == 1 and len(waveform) > 0 and np.isfinite(waveform).all(), 'Actual decoded waveform invalid.')
        binding = {'input_kind': 'actual_decoded_waveform_array_only', 'sample_rate': 16000, 'sample_count': int(len(waveform)),
                   'dtype': str(waveform.dtype), 'waveform_sha256': hashlib.sha256(waveform.tobytes()).hexdigest(), 'decoder': evidence['model']['decoders']['qa']}
        intent = {'id': ident, 'audio_sha256': actual_hash, 'actual_call_args': kwargs, 'actual_audio_input': binding,
                  'actual_imported_runtime': imports, 'state': 'ONE_ACTUAL_LOCAL_CALL_INTENT'}
        retake.save_once(run/'local-asr-intents'/(ident+'.private.json'), intent)
        try: response = original(waveform, **kwargs)
        except Exception as error:
            q.save_actual_raw(run/'asr-raw'/(ident+'.private.json'), {**intent, 'state': 'ACTUAL_CALL_FAILED',
                'source_free': True, 'actual_runtime': observed_holder(holder), 'exception_type': type(error).__name__})
            raise
        observed = observed_holder(holder)
        finite = q.save_actual_raw(run/'asr-raw'/(ident+'.private.json'), {**intent, 'state': 'ACTUAL_RESPONSE_RETAINED',
            'actual_runtime': observed, 'source_free': True, 'raw_saved_before_diagnosis': True, 'actual_response': response})
        if not finite or observed != {'model_path': evidence['model']['local_directory'], 'dimensions': q.DIMENSIONS}:
            evidence['runtime_guard_failed'] = True
            raise retake.SafeError('Actual bad/nonfinite runtime response retained before refusal.')
        loader_guard(evidence['model']); require(digest(path) == actual_hash, 'Audio changed during actual QA.')
        evidence.setdefault('actual_source_free_ids', []).append(ident); evidence['actual_imported_runtime'] = imports
        return response
    mlx_whisper.transcribe = capture
    try: yield
    finally: mlx_whisper.transcribe = original


def observed_holder(holder):
    try:
        path = getattr(holder, 'model_path', None)
        return {'model_path': str(Path(path).resolve()) if isinstance(path, (str, Path)) else None,
                'dimensions': q.runtime(getattr(holder, 'model', None))}
    except Exception as error:
        return {'model_path': None, 'dimensions': q.runtime(None), 'runtime_receipt_error': type(error).__name__}


def execute(run, command, model_dir, workers=4, progress_log=None):
    group(run)
    collected(run, live=True); q.fresh(run, command)
    log = q.monitoring_log(run, command, progress_log)
    inputs = q.baseline(run, log)
    input_path = run/('body31-'+command+'-inputs.private.json')
    proof_path = run/('body31-'+command+'-completed.private.json')
    require(not input_path.exists() and not proof_path.exists(), 'Body31 operation was previously attempted; no repeat.')
    retake.save_once(input_path, {'version': VERSION, 'command': command, 'state': 'ONCE_INPUT_BYTES_BEFORE_MODEL',
        'root_body31_review_sha256': REVIEW_SHA, 'source32_reuse_approved': False,
        'complete_pre_existing_child_sha256': inputs, 'helpers_sha256': helpers()})
    report = q.execute(run, command, model_dir, workers, progress_log)
    producer_path = run/('qualification-'+command+'.producer.private.json'); producer = read(producer_path)
    require(producer.get('state') == 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT'
        and producer.get('version') == VERSION and producer['pre_existing_child_sha256'] == {**inputs, input_path.name: digest(input_path)},
        'Completed producer must retain the whole original input set, never only fresh current pins.')
    for name, sha in producer['pre_existing_child_sha256'].items(): require(digest(batch.contained(run, name)) == sha, 'Original model input byte changed.')
    call_ids = producer['actual_model_call_ids']
    require(len(call_ids) == len(set(call_ids)) and set(call_ids) <= set(q.EXPECTED_IDS), 'Actual call census differs.')
    if command == 'qa':
        expected = {'qa.private.json'} | {folder+'/'+ident+'.private.json' for ident in call_ids for folder in ['asr-raw', 'local-asr-intents']}
        if (run/'qa-asr-cache.private.json').exists(): expected.add('qa-asr-cache.private.json')
    else:
        require(call_ids == q.EXPECTED_IDS, 'Authored alignment must retain the whole prepared group.')
        expected = {'word-cues/alignment.private.json'} | {'word-cues/'+ident+'.json' for ident in call_ids}
        expected |= {folder+'/'+ident+'.private.json' for ident in call_ids for folder in ['alignment-raw', 'local-alignment-intents']}
    current_outputs = {name: sha for name, sha in q.baseline(run, log).items()
        if name not in producer['pre_existing_child_sha256'] and name not in {
            'qualification-'+command+'.intent.private.json', producer_path.name}}
    require(set(producer['created_outputs_sha256']) == expected and producer['created_outputs_sha256'] == current_outputs,
        'Completed producer must pin every real original raw/intent/report/cache/cue output exactly.')
    retake.save_once(proof_path, {'version': VERSION, 'command': command, 'state': 'IMMUTABLE_ACTUAL_COMPLETED_PRODUCER_PROOF',
        'producer_sha256': digest(producer_path), 'input_proof_sha256': digest(input_path), 'report_sha256': producer['report_sha256'],
        'operation_intent_sha256': digest(run/('qualification-'+command+'.intent.private.json')),
        'complete_original_inputs_sha256': producer['pre_existing_child_sha256'],
        'complete_original_outputs_sha256': producer['created_outputs_sha256'],
        'actual_model_call_ids': call_ids, 'source32_reuse_approved': False, 'word_time_or_human_adoption': False})
    return report


# Only this independent RAM module is adapted. Frozen8ee3 files/imported module
# objects are never modified; protected generic helpers retain their old API.
q.collected, q.helper_hashes, q.model_identity = collected, helpers, model_identity
q.local_only_runtime, q.capture_actual = local_only_runtime, capture_actual


def main():
    os.umask(0o077); args = q.parser().parse_args()
    try:
        candidate = args.run_dir.expanduser().absolute(); require(candidate.resolve() == candidate, 'Group symlink path refused.')
        run = candidate; group(run)
        require(not (run/'operation.lock').is_symlink(), 'Group lock symlink refused.')
        lock = q.common.run_lock(run)
        try:
            if args.command == 'preflight':
                require(args.progress_log is None, 'Preflight cannot exempt a mutable log.')
                info, _ = collected(run, live=True)
                print(json.dumps({'status': 'actual_exact_body31_group_ready_for_fresh_qualification', 'requests': info['request_count'],
                                  'source32_reuse_approved': False, 'word_signal_time_or_human_approved': False})); return 0
            require(args.model_dir is not None, 'QA/align require exact installed absolute Turbo model.')
            report = execute(run, args.command, args.model_dir, args.decode_workers, args.progress_log)
        finally: lock.close()
        print(json.dumps({'command': args.command, 'status': report['status'], 'checked_source_count': len(q.EXPECTED_IDS),
                          'source32_reuse_approved': False, 'human_listening_or_acting_approved': False}))
        return 0 if report['status'] == 'passed' else 2
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError):
        print('Exact body31 qualification refused/failed; original evidence retained, no automatic retry or reuse approval.', file=sys.stderr); return 1


if __name__ == '__main__': raise SystemExit(main())
