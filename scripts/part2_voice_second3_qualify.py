#!/usr/bin/env python3
"""Fresh Root-only QA/DTW for the exact genuine second3 prepared child.

Frozen8ee3 definitions are reused in an independent in-memory module. The
Source parent is the complete original1401 bank; bad8/QC3 are retained separate
counterevidence. QA receives only a decoded waveform. Authored DTW supplies
timing evidence and never independent word proof or audio adoption.
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
VERSION = 'part2-current-second3-actual-local-qualification-v1'
RUN = ROOT/'output/audio/part2-voice/2026-10-08-all'
CHILD = RUN/'retake-driver/retake8-second3-preparation'
REVIEW_PATH = CHILD/'root-style-approval.private.json'
REVIEW_SHA = 'f95d42fa45a43ef73e6795840ab69e43224e70af0189d839526ad27661c9c228'
PROVIDER_HELPER = CHILD/'root-provider-stdin.private.py'
PROVIDER_HELPER_SHA = '33e37981951470fdc395835586f9566a2e0cd11e0a39b28b6fbfc357e7bf4eaf'
PREPARED_REVIEW = CHILD/'prepared-independent-review/actual-prepared3-current-source-and-regie.private.json'
PREPARED_REVIEW_SHA = '9679d12645840814819ef6c89a950d7fe051c89caab04142f470968b15c18159'
PROVIDER_REVIEW = RUN/'independent-actual-qualification/second3-provider-review/second3-actual-provider-source-media-review.private.json'
PROVIDER_REVIEW_SHA = '6e1e876e1f3c1dab46640176930eae66f7b58724d94e5c55926cf2664913aa56'
SIDECAR_PATH = CHILD/'bad8-QC3-and-Regie-sidecar.UNAPPROVED.private.json'
SIDECAR_SHA = '23f238edab2150bcd1883f9bfb2ea6fa1d4e47634fbe55363305ac654d475e5d'
PREPARED_SHA = '742e64564f7789adb1165607d7b4fe3adfdc8ad499c1f1c6745ab9d243d13ebe'
INPUT_SHA = '693ff2ac0b7e8bdc30283efad16373f7785df464cdedb9c1865b06dd25d4bed9'
IDS = ['part2-0a56cf6acd799d18d670ff77', 'part2-1cca8245d03805bff27f3189', 'part2-66042dcbf2141bee6be93b37']
PRIOR_AUDIO = RUN/'retake-driver/body7-uff1-stop'
METHOD_PATH = ROOT/'scripts/part2_voice_body25_qualify.py'
METHOD_SHA = '7f60cbc67e02509e528d8e51eaeb9728bb2819cc77b9cb138a319727f32285e4'
METHOD_TEST_SHA = '84a12de7838315a3bcb4212648f350729e884ea5a259c7ca930a7992137a745a'
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
q = types.ModuleType('second3_frozen8_readonly'); q.__file__ = str(BASE_PATH)
exec(compile(blob, str(BASE_PATH), 'exec'), q.__dict__)
retake, batch, require, read, digest = q.retake, q.batch, q.require, q.read, q.digest
_collected, _helpers, _model_identity, _capture, _local = q.collected, q.helper_hashes, q.model_identity, q.capture_actual, q.local_only_runtime
IMPORTS = ['mlx.core', 'mlx_whisper', 'numpy', 'mlx_whisper.transcribe', 'mlx_whisper.audio', 'mlx_whisper.load_models',
           'mlx_whisper.whisper', 'mlx_whisper.timing', 'mlx_whisper.tokenizer', 'scipy', 'scipy.signal', 'numba',
           'llvmlite', 'llvmlite.binding', 'tiktoken', 'regex', 'huggingface_hub']


def specifications():
    require(digest(BASE_PATH) == BASE_SHA and digest(REVIEW_PATH) == REVIEW_SHA
            and digest(ROOT/'scripts/part2_voice_retake_qualify_test.py') == BASE_TEST_SHA
            and digest(Path(retake.__file__)) == DRIVER_SHA
            and digest(METHOD_PATH) == METHOD_SHA
            and digest(ROOT/'scripts/part2_voice_body25_qualify_test.py') == METHOD_TEST_SHA,
            'Frozen second3/8ee3/7f60/test/driver contract changed.')
    require(digest(PROVIDER_HELPER) == PROVIDER_HELPER_SHA and digest(PREPARED_REVIEW) == PREPARED_REVIEW_SHA
            and digest(SIDECAR_PATH) == SIDECAR_SHA and digest(CHILD/'prepared.json') == PREPARED_SHA
            and digest(PROVIDER_REVIEW) == PROVIDER_REVIEW_SHA,
            'Actual stdin helper, independent prepared3 or original bad8/QC3 evidence changed.')
    info, approval, sidecar, independent = read(CHILD/'prepared.json'), read(REVIEW_PATH), read(SIDECAR_PATH), read(PREPARED_REVIEW)
    require(info['parent'] == str(RUN) and info['parent_request_count'] == 1401
            and info['request_count'] == 3 and info['selected_ids'] == IDS
            and info['input_sha256'] == INPUT_SHA == digest(CHILD/'requests.jsonl')
            and [record['key'] for record in retake.records(CHILD/'requests.jsonl')] == IDS,
            'Only exact genuine3 requests with original1401 Source parent are supported.')
    for name, sha in info['frozen_sha256'].items():
        require(digest(batch.contained(CHILD, name)) == sha, 'A frozen prepared3 artifact changed.')
    snapshot = read(CHILD/'parent-snapshot.private.json')
    actual_requests = {row['key']: retake.sha(retake.canonical(row['request']).encode())
                       for row in retake.records(CHILD/'requests.jsonl')}
    require(snapshot['parent'] == str(RUN) and snapshot['parent_count'] == 1401
            and snapshot['selected_ids'] == IDS and snapshot['request_count'] == 3
            and snapshot['new_request_sha256'] == actual_requests
            and len(set(actual_requests.values())) == 3,
            'Source1401 parent and exact per-ID new request bytes required, never a relabelled8 parent.')
    require(approval['status'] == 'approved_part2_retake_styles' and approval['reviewed_by'] == 'root'
            and approval['source_cast_and_regie_reviewed'] is True and approval['selected_ids'] == IDS
            and approval['new_request_sha256'] == actual_requests
            and approval['preview_sha256'] == digest(CHILD/'preview.private.json')
            and approval['actual_bad8_QC3_Regie_sidecar_sha256'] == SIDECAR_SHA
            and approval['actual_bad8_QC3_Regie_sidecar_reviewed'] is True
            and approval['human_listening_or_acting_approval'] is False
            and approval['creative_target_not_a_canonical_phonetic_or_word_exception'] is True,
            'Actual Root creative3 approval cannot become word, pronunciation or hearing approval.')
    require(sidecar['supported_source_parent'] == str(RUN) and sidecar['supported_source_parent_count'] == 1401
            and sidecar['actual_immediately_preceding_failed_audio_bank'] == str(PRIOR_AUDIO)
            and sidecar['actual_failed_audio_bank_count'] == 8 and sidecar['selected_ids'] == IDS
            and sidecar['retained_QC3_all3_nonliteral'] is True and sidecar['retained_bad8_all3_original_lexical_failures'] is True
            and sidecar['human_listening_or_acting_approval'] is False,
            'Actual bad8/QC3 counterevidence must remain separate and retained.')
    require(independent['status'] == 'PASS_INDEPENDENT_PREPARED3_CURRENT_SOURCE_ROOT_CREATIVE_APPROVAL_BAD8_QC3_AND7044_188_1490'
            and independent['actual_prepared_file_sha256'] == PREPARED_SHA
            and independent['actual_payload_sha256'] == INPUT_SHA
            and independent['new_bounded_request_count'] == 3 and independent['supported_Source_parent_count'] == 1401
            and independent['actual_bad8_QC3_sidecar_sha256'] == SIDECAR_SHA,
            'Independent genuine prepared3 evidence must bind the same actual Source/regie scope.')
    provider = read(PROVIDER_REVIEW)
    require(provider['state'] == 'PASS_GENUINE_CURRENT_GROUP_PROVIDER_SOURCE_CAST_STYLE_NORMALIZATION_PRESERVATION_UNAPPROVED'
            and provider['family'] == 'separate_second3_after_failed_body7_uff1' and provider['child'] == str(CHILD)
            and provider['parent'] == str(RUN) and provider['count'] == 3 and provider['selected_ids'] == IDS
            and provider['prepared_file_sha256'] == PREPARED_SHA and provider['actual_requests_input_sha256'] == INPUT_SHA
            and provider['actual_sidecar_sha256'] == SIDECAR_SHA and provider['prior_independent_before_submit_proof_sha256'] == PREPARED_REVIEW_SHA
            and provider['provider_job_succeeded_collected_once'] is True
            and provider['separate_failed8_and_QC3_held_facts_preserved'] is True and provider['audio_adoption'] is False,
            'Actual completed3 media proof required; prepared proof alone is insufficient.')
    for value, field, count in [(sidecar, 'whole_evidence_files_sha256', 'whole_evidence_file_count'),
                                (independent, 'whole_bound_files_sha256', 'whole_bound_file_count')]:
        require(len(value[field]) == value[count], 'Whole historical3 file census differs.')
        for name, sha in value[field].items():
            path = Path(name)
            require(path.is_absolute() and path.is_file() and digest(path) == sha, 'Prior original3 evidence changed: '+name)
    return {str(CHILD): info}


def group(run):
    run = Path(run)
    require(run.is_absolute() and run.resolve() == run and not run.is_symlink(), 'Exact lexical prepared group path required.')
    specs = specifications(); require(str(run) in specs, 'Only the exact genuine second3 child is allowed.')
    info = specs[str(run)]
    q.EXPECTED_IDS, q.EXPECTED_INPUT_SHA, q.VERSION = list(info['selected_ids']), info['input_sha256'], VERSION
    return info


def prior_evidence():
    """Original1401 plus actual bad8/QC3 facts, never a substituted parent."""
    require(digest(SIDECAR_PATH) == SIDECAR_SHA and digest(PREPARED_REVIEW) == PREPARED_REVIEW_SHA
            and digest(PROVIDER_REVIEW) == PROVIDER_REVIEW_SHA,
            'Original prior evidence documents changed.')
    values = [read(SIDECAR_PATH)['whole_evidence_files_sha256'], read(PREPARED_REVIEW)['whole_bound_files_sha256'],
              read(PROVIDER_REVIEW)['entire_child_frozen_completed_files_sha256']]
    result = {str(SIDECAR_PATH): SIDECAR_SHA, str(PREPARED_REVIEW): PREPARED_REVIEW_SHA,
              str(PROVIDER_REVIEW): PROVIDER_REVIEW_SHA}
    for value in values:
        for name, sha in value.items():
            require(name not in result or result[name] == sha, 'Contradictory original prior evidence.')
            require(digest(name) == sha, 'Original prior evidence bytes changed.')
            result[name] = sha
    return result


def no_duplicate_audio(run):
    specs = specifications()
    if not (run/'collection.private.json').exists():
        return
    snapshot = read(run/'parent-snapshot.private.json')
    forbidden = set(snapshot['parent_mp3_sha256'].values())
    forbidden.update(digest(path) for path in (PRIOR_AUDIO/'clips').glob('*.mp3'))
    seen = set()
    for ident in specs[str(run)]['selected_ids']:
        path = run/'clips'/(ident+'.mp3')
        require(path.is_file() and not path.is_symlink(), 'Actual second3 media missing or unsafe.')
        sha = digest(path)
        require(sha not in seen and sha not in forbidden, 'An old or shared actual MP3 cannot be reused as a genuine new second3 take.')
        seen.add(sha)


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
    value.update(second3_adapter=digest(__file__), second3_tests=digest(ROOT/'scripts/part2_voice_second3_qualify_test.py'),
                 root_second3_review=digest(REVIEW_PATH), provider_stdin_helper=digest(PROVIDER_HELPER), independent_prepared3_review=digest(PREPARED_REVIEW),
                 second3_bad8_QC3_sidecar=digest(SIDECAR_PATH), independent_actual3_provider_review=digest(PROVIDER_REVIEW),
                 prior_body25_method=digest(METHOD_PATH), prior_body25_method_tests=METHOD_TEST_SHA)
    return value


@contextmanager
def local_only_runtime(command):
    holder = importlib.import_module('mlx_whisper.transcribe').ModelHolder
    require(holder.model is None and holder.model_path is None, 'Each QA/align operation requires its own fresh process without an earlier loaded model.')
    with _local(command): yield


@contextmanager
def capture_actual(run, command, evidence):
    evidence.update(root_second3_review_sha256=REVIEW_SHA, source_case_count=3, unique_prepared_request_count=3,
                    original_source_parent_count=1401, retained_prior_failed_audio_count=8,
                    original_prior_evidence_sha256=prior_evidence(), prior_bad8_QC3_counterevidence_retained=True,
                    source32_reuse_approved=False, logge_reuse_approved=False, shared_take_reuse_approved=False, operation_source_kind='sourcefree_words' if command == 'qa' else 'authored_timing_only',
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
    outside = prior_evidence()
    input_path = run/('second3-'+command+'-inputs.private.json')
    proof_path = run/('second3-'+command+'-completed.private.json')
    require(not input_path.exists() and not proof_path.exists(), 'Second3 operation was previously attempted; no repeat.')
    retake.save_once(input_path, {'version': VERSION, 'command': command, 'state': 'ONCE_INPUT_BYTES_BEFORE_MODEL',
        'root_second3_review_sha256': REVIEW_SHA, 'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False,
        'complete_pre_existing_child_sha256': inputs, 'helpers_sha256': helpers(),
        'original_source_parent_count': 1401, 'retained_prior_failed_audio_count': 8,
        'original_prior_evidence_sha256': outside})
    report = q.execute(run, command, model_dir, workers, progress_log)
    producer_path = run/('qualification-'+command+'.producer.private.json'); producer = read(producer_path)
    require(producer.get('state') == 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT'
        and producer.get('version') == VERSION and producer['pre_existing_child_sha256'] == {**inputs, input_path.name: digest(input_path)},
        'Completed producer must retain the whole original input set, never only fresh current pins.')
    require(producer.get('original_prior_evidence_sha256') == outside == prior_evidence()
            and producer.get('original_source_parent_count') == 1401 and producer.get('retained_prior_failed_audio_count') == 8
            and producer.get('prior_bad8_QC3_counterevidence_retained') is True,
            'Original prior Source1401/bad8/QC3 evidence cannot be replaced after a model call.')
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
        'original_prior_evidence_sha256': outside, 'original_source_parent_count': 1401, 'retained_prior_failed_audio_count': 8,
        'actual_model_call_ids': call_ids, 'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False, 'word_time_or_human_adoption': False})
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
                print(json.dumps({'status': 'actual_exact_second3_group_ready_for_fresh_qualification', 'requests': info['request_count'],
                                  'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False,
                                  'word_signal_time_or_human_approved': False})); return 0
            require(args.model_dir is not None, 'QA/align require exact installed absolute Turbo model.')
            report = execute(run, args.command, args.model_dir, args.decode_workers, args.progress_log)
        finally: lock.close()
        print(json.dumps({'command': args.command, 'status': report['status'], 'checked_source_count': len(q.EXPECTED_IDS),
                          'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False,
                          'human_listening_or_acting_approved': False}))
        return 0 if report['status'] == 'passed' else 2
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError):
        print('Exact second3 qualification refused/failed; original evidence retained, no automatic retry or reuse approval.', file=sys.stderr); return 1


if __name__ == '__main__': raise SystemExit(main())
