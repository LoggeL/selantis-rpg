#!/usr/bin/env python3
"""Additive local word/signal/time producers for the actual eight Teil-II retakes.

Root invokes qa or align once, using an already installed local turbo model.
Only child outputs are created. Every original transcript, raw response, parent
WAV/MP3/receipt and timing stays immutable. No paid API, model download, import,
public export, adjudication, names/vowel exemptions or human approval exists.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
import copy
import importlib
import json
import math
import os
from pathlib import Path
import sys
import time
import part2_voice_retake_batch as retake
import part2_voice_qualify as initial

batch, core, common = retake.batch, retake.core, retake.common
qa, cues = initial.qa, initial.cues
require, read, digest = retake.require, retake.read, retake.digest
DIMENSIONS = initial.DIMENSIONS
VERSION = 'part2-current-retake8-actual-local-qualification-v1'
EXPECTED_IDS = ['part2-'+value for value in ['0a56cf6acd799d18d670ff77', '1cca8245d03805bff27f3189',
    '33cd0d984781da1f7c309e6d', '66042dcbf2141bee6be93b37', 'bb20d3b8e23dce0bc02deeeb',
    'd1e46fb7e0eb473cfee55d43', 'dc79250c739a694e33d11e94', 'de7f6de65801a26316e472a1']]
EXPECTED_INPUT_SHA = '995195a240baf6593f38f224ead47399ecda9c6753c14d656ca34a01cc9f267b'


def finite(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)


def collected(run, live=False):
    info = retake.prepared(run, live=live)
    require(info['selected_ids'] == EXPECTED_IDS and info['input_sha256'] == EXPECTED_INPUT_SHA
            and info['request_count'] == len(EXPECTED_IDS), 'Only the exact Root-prepared body7/Uff1 retake bank is supported.')
    require(read(run/'job.json').get('state') == 'JOB_STATE_SUCCEEDED'
            and read(run/'job.json').get('request_count') == len(EXPECTED_IDS)
            and read(run/'job.json').get('model') == retake.MODEL, 'Actual successful fixed-model job required.')
    intent, result = read(run/'collect-intent.private.json'), read(run/'collection.private.json')
    require(intent.get('state') == 'COLLECTED_ONCE' and intent.get('expected') == intent.get('collected') == len(EXPECTED_IDS)
            and intent.get('held_failures') == 0 and result.get('expected') == result.get('collected') == len(EXPECTED_IDS)
            and not result.get('failures'), 'All eight actual responses must already be collected once, without provider failures.')
    origin = read(run/'response-origin.private.json')
    require(digest(run/'responses.private.jsonl') == origin['response_sha256'] == intent['response_sha256'], 'Retained original provider bytes changed.')
    actual = retake.inspect_responses(run)  # One actual STOP/WAV candidate is mandatory before any model.
    require(set(actual) == set(EXPECTED_IDS), 'Complete actual STOP/WAV census differs.')
    manifest, profiles = read(run/'lines.private.json'), read(run/'profiles.private.json')
    rows = {row['id']: row for row in manifest['lines']}
    require([row['id'] for row in manifest['lines']] == EXPECTED_IDS, 'Retake Source order/census differs.')
    proposal = read(run/'public-manifest.proposed.json')
    clips = proposal.get('clips')
    require(proposal.get('model') == retake.MODEL and proposal.get('aliases') == manifest['aliases']
            and proposal.get('scene_players') == manifest['scene_players'] and isinstance(clips, list)
            and [clip.get('id') for clip in clips] == EXPECTED_IDS, 'Current actual private clip proposal differs.')
    require({path.name for path in (run/'clips').iterdir()} == {ident+'.mp3' for ident in EXPECTED_IDS}, 'Unexpected/missing child MP3 files.')
    snapshot = read(run/'parent-snapshot.private.json')
    for clip in clips:
        ident = clip['id']; row = rows[ident]; receipt = read(run/'raw'/(ident+'.receipt.json'))
        mp3, wav = run/'clips'/(ident+'.mp3'), run/'raw'/(ident+'.wav')
        require(all(clip.get(key) == row.get(key) for key in ['text', 'display_text', 'speaker', 'kind', 'runtime_keys'])
                and clip.get('audio') == 'audio/teil-2/'+ident+'.mp3'
                and clip.get('voice') == profiles['speakers'][row['speaker']]['google_voice'], 'Whole Source/routes/requested cast changed.')
        require(receipt.get('status') == 'complete' and receipt.get('model') == receipt.get('actual_provider_model') == retake.MODEL
                and receipt.get('backend') == 'part2-retake-batch'
                and receipt.get('request_sha256') == snapshot['new_request_sha256'][ident]
                and receipt.get('fixed_google_voice') == clip['voice'] and receipt.get('source_text_sha256') == retake.sha(row['text'].encode())
                and receipt.get('retake_parent_mp3_sha256') == snapshot['parent_mp3_sha256'][ident]
                and receipt.get('prepared_sha256') == digest(run/'prepared.json')
                and receipt.get('provider_response_sha256') == actual[ident]['provider_response_sha256'], 'Retake receipt lost Source/cast/request/provider lineage.')
        require(receipt.get('wav_sha256') == actual[ident]['wav_sha256'] == digest(wav)
                and receipt.get('mp3_sha256') == clip.get('sha256') == digest(mp3)
                and receipt.get('seconds') == actual[ident]['seconds'] == retake.wave_info(wav.read_bytes())
                and finite(clip.get('seconds')) and clip['seconds'] == round(actual[ident]['seconds'], 3), 'Current provider WAV/MP3/duration bytes differ.')
        require(receipt.get('normalization_input') == 'original_provider_wav_no_wrapper'
                and receipt.get('normalization') == {'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11}, 'Actual fixed normalization provenance missing.')
        metrics = receipt.get('loudness_input', {})
        require(all(key in metrics and math.isfinite(float(metrics[key])) for key in
                    ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']), 'Actual finite loudness measurements missing.')
    return info, rows


def monitoring_log(run, command, path):
    if path is None: return None
    require(command in {'qa', 'align'}, 'Unknown monitoring operation.')
    candidate = Path(path).expanduser()
    expected = run/(command+'-actual-producer.private.log')
    require(candidate.is_absolute() and candidate == expected and not candidate.is_symlink()
            and (not candidate.exists() or candidate.is_file()),
            'Only the exact direct-child current-operation stdout log may grow.')
    return candidate


def baseline(run, progress_log=None):
    retake.safe_run(run)
    if progress_log is not None:
        require(progress_log.name in {'qa-actual-producer.private.log', 'align-actual-producer.private.log'},
                'Unexpected monitoring log name.')
        monitoring_log(run, progress_log.name.split('-')[0], progress_log)
    return {str(path.relative_to(run)): digest(path) for path in run.rglob('*')
            if path.is_file() and path.name != 'operation.lock' and path != progress_log}


def finite_body(value):
    if isinstance(value, float): return math.isfinite(value)
    if isinstance(value, dict): return all(finite_body(item) for item in value.values())
    if isinstance(value, (list, tuple)): return all(finite_body(item) for item in value)
    return True


def save_actual_raw(path, value):
    # Preserve Python's actual NaN/Infinity values in an explicitly nonstandard
    # raw JSON archive. The strict artifact parser and the following guard
    # reject these bytes for qualification. No protected serializer changes.
    retake.write_once(path, (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=True)+'\n').encode())
    return finite_body(value)


def unchanged(run, before):
    for name, value in before.items(): require(digest(batch.contained(run, name)) == value, 'Pre-existing retake evidence changed: '+name)
    collected(run, live=True)  # Rechecks current AST, original1401 evidence and public188/1490 banks.


def fresh(run, command):
    require(command in {'qa', 'align'}, 'Unknown local producer.')
    require(not (run/('qualification-'+command+'.intent.private.json')).exists()
            and not (run/('qualification-'+command+'.producer.private.json')).exists(), 'This model operation was already attempted; no automatic repeat.')
    files, dirs = (['qa.private.json', 'qa-asr-cache.private.json'], ['asr-raw', 'local-asr-intents']) if command == 'qa' else (
        ['word-cues/alignment.private.json'], ['word-cues', 'alignment-raw', 'local-alignment-intents'])
    require(not any((run/name).exists() for name in files) and not any(list((run/name).rglob('*')) for name in dirs),
            'Fresh retake-specific outputs required; cached old transcripts/times are forbidden.')


def runtime(model):
    return {key: getattr(getattr(model, 'dims', None), key, None) for key in DIMENSIONS}


def model_identity(path):
    require(Path(path).is_absolute(), 'Already installed absolute local model directory required.')
    return initial.model_identity(path)


def helper_hashes():
    return {'adapter': digest(Path(__file__)), 'retake_driver': digest(Path(retake.__file__)),
            'initial_local_helper': digest(Path(initial.__file__)), 'qa': digest(Path(qa.__file__)),
            'cues': digest(Path(cues.__file__)), 'acoustic': digest(Path(cues.acoustic.__file__)),
            'common': digest(Path(common.__file__))}


@contextmanager
def local_only_runtime(command):
    """RAM-only download refusal and fresh QA cache; no installed files change."""
    hub = importlib.import_module('huggingface_hub')
    old_hub = hub.snapshot_download
    def refuse(*_args, **_kwargs): raise retake.SafeError('Model download is forbidden; existing local model only.')
    hub.snapshot_download = refuse
    loader = None
    old_loader = None
    holder = None
    try:
        loader = importlib.import_module('mlx_whisper.load_models')
        old_loader = loader.snapshot_download
        if old_loader is refuse: old_loader = old_hub  # Alias imported while our hub RAM block was active.
        loader.snapshot_download = refuse  # The installed loader holds this direct import alias.
        if command == 'qa':
            holder = importlib.import_module('mlx_whisper.transcribe').ModelHolder
            holder.model, holder.model_path = None, None
        yield
    finally:
        if holder is not None:
            holder.model, holder.model_path = None, None
        if loader is not None: loader.snapshot_download = old_loader
        hub.snapshot_download = old_hub


@contextmanager
def adapter(run):
    old = (common.ROOT, common.PRIVATE, common.prepared, qa.ROOT, qa.PRIVATE, qa.ID, cues.STORY_ID,
           core.ROOT, core.PRIVATE, core.prepared)
    common.ROOT, common.PRIVATE, common.prepared = retake.ROOT, retake.PRIVATE, retake.prepared
    qa.ROOT, qa.PRIVATE, qa.ID, cues.STORY_ID = retake.ROOT, retake.PRIVATE, batch.ID, batch.ID
    core.ROOT, core.PRIVATE, core.prepared = retake.ROOT, retake.PRIVATE, retake.prepared
    try: yield
    finally:
        (common.ROOT, common.PRIVATE, common.prepared, qa.ROOT, qa.PRIVATE, qa.ID, cues.STORY_ID,
         core.ROOT, core.PRIVATE, core.prepared) = old


@contextmanager
def capture_actual(run, command, evidence):
    """Full actual responses are saved before diagnosis; no model is called by preparation/tests."""
    if command == 'qa':
        import mlx_whisper
        original = mlx_whisper.transcribe
        def capture(path, *args, **kwargs):
            ident = Path(path).stem
            require(ident in EXPECTED_IDS and Path(path).resolve() == (run/'clips'/(ident+'.mp3')).resolve(), 'Unexpected local ASR clip.')
            require(not evidence.get('runtime_guard_failed') and not args
                    and kwargs == {'path_or_hf_repo': evidence['model']['local_directory'], 'language': 'de',
                                   'condition_on_previous_text': False, 'temperature': 0.0},
                    'Source-free actual ASR parameters differ; no inferred exceptions.')
            actual_hash = digest(path)
            retake.save_once(run/'local-asr-intents'/(ident+'.private.json'), {'id': ident, 'audio_sha256': actual_hash,
                             'actual_call_args': kwargs, 'state': 'ONE_ACTUAL_LOCAL_CALL_INTENT'})
            try: response = original(path, **kwargs)
            except Exception as error:
                retake.save_once(run/'asr-raw'/(ident+'.private.json'), {'id': ident, 'audio_sha256': actual_hash,
                                 'state': 'ACTUAL_CALL_FAILED', 'exception_type': type(error).__name__, 'actual_call_args': kwargs})
                raise
            runtime_error = None
            try:
                holder = importlib.import_module('mlx_whisper.transcribe').ModelHolder
                path_value = getattr(holder, 'model_path', None)
                observed = {'model_path': str(Path(path_value).resolve()) if isinstance(path_value, (str, Path)) else None,
                            'dimensions': runtime(getattr(holder, 'model', None))}
            except Exception as error:
                # An unknown/missing runtime receipt must never discard the
                # actual returned body before the strict model guard runs.
                runtime_error = type(error).__name__
                observed = {'model_path': None, 'dimensions': runtime(None)}
            raw_is_finite = save_actual_raw(run/'asr-raw'/(ident+'.private.json'), {'id': ident, 'audio_sha256': actual_hash,
                'actual_call_args': kwargs, 'actual_runtime': observed, 'source_free': True,
                'runtime_receipt_error': runtime_error, 'raw_saved_before_diagnosis': True,
                'state': 'ACTUAL_RESPONSE_RETAINED', 'actual_response': response})
            if not raw_is_finite:
                evidence['runtime_guard_failed'] = True
                raise retake.SafeError('Nonfinite actual response archived raw without any qualification.')
            if observed != {'model_path': evidence['model']['local_directory'], 'dimensions': DIMENSIONS}:
                evidence['runtime_guard_failed'] = True
                raise retake.SafeError('Actual local ASR runtime differs; raw retained without approval.')
            require(digest(path) == actual_hash, 'Audio changed during actual local ASR.')
            evidence.setdefault('actual_source_free_ids', []).append(ident)
            return response
        mlx_whisper.transcribe = capture
        try: yield
        finally: mlx_whisper.transcribe = original
    else:
        original_load, original_align = cues.load_local_model, cues.acoustic.align
        loaded = {}
        def load(*args, **kwargs):
            require(len(args) == 1 and not kwargs and isinstance(args[0], (str, Path))
                    and Path(args[0]).is_absolute() and str(Path(args[0]).resolve()) == evidence['model']['local_directory'],
                    'Actual timing loader must receive only the fixed absolute existing model path.')
            require(model_identity(Path(args[0])) == evidence['model'], 'Local model bytes changed before timing load.')
            pair = original_load(*args, **kwargs)
            loaded['dimensions'] = runtime(pair[0])
            require(loaded['dimensions'] == DIMENSIONS, 'Actual timing model runtime differs.')
            evidence['actual_timing_runtime'] = {'model_path': str(Path(args[0]).resolve()), 'dimensions': loaded['dimensions']}
            evidence['actual_timing_loader_arguments'] = {'positional_model_dir': str(Path(args[0]).resolve()), 'kwargs': {}}
            return pair
        def align(model, tokenizer, clip, audio):
            ident = clip['id']; path = run/'clips'/(ident+'.mp3')
            require(ident in EXPECTED_IDS and runtime(model) == DIMENSIONS and loaded.get('dimensions') == DIMENSIONS,
                    'Actual timing model/clip differs.')
            audio_hash = digest(path)
            retake.save_once(run/'local-alignment-intents'/(ident+'.private.json'), {'id': ident, 'audio_sha256': audio_hash,
                             'state': 'ONE_ACTUAL_LOCAL_FORCED_ALIGNMENT_INTENT'})
            response = original_align(model, tokenizer, clip, audio)
            raw_is_finite = save_actual_raw(run/'alignment-raw'/(ident+'.private.json'), {'id': ident, 'audio_sha256': audio_hash,
                'actual_runtime': evidence['actual_timing_runtime'], 'raw_saved_before_refinement': True,
                'actual_loader_arguments': evidence['actual_timing_loader_arguments'], 'source_free': False,
                'teacher_forced_authored_text': True, 'word_fidelity_proof': False,
                'actual_response': response, 'word_or_human_approved': False})
            require(raw_is_finite, 'Nonfinite actual DTW archived raw without qualification.')
            require(path.is_file() and digest(path) == audio_hash, 'Audio changed during alignment; actual raw retained first.')
            evidence.setdefault('actual_timing_ids', []).append(ident)
            return response
        cues.load_local_model, cues.acoustic.align = load, align
        try: yield
        finally: cues.load_local_model, cues.acoustic.align = original_load, original_align


def verify_word_report(run, report, model):
    rows = {row['id']: row for row in read(run/'lines.private.json')['lines']}
    require(report.get('manifest_sha256') == digest(run/'lines.private.json') and report.get('model') == qa.MODEL+':'+model['local_directory']
            and [take.get('id') for take in report.get('takes', [])] == EXPECTED_IDS, 'Whole actual word/signal report binding/census differs.')
    calls = []
    checked = []
    for take in report['takes']:
        ident = take['id']; path = run/'asr-raw'/(ident+'.private.json')
        require(take.get('text_sha256') == qa.text_hash(rows[ident]['text']) and not take.get('adjudication') and not take.get('asr_reused'), 'Old/corrected transcript or word override refused.')
        if take.get('signal') is not None:
            metrics = qa.decode(run/'clips'/(ident+'.mp3'))
            require(take['signal'] == metrics
                    and all(reason in take.get('reasons', []) for reason in qa.signal_failures(metrics, len(qa.words(rows[ident]['text'])))),
                    'Real current signal metrics/failures were replaced or waived.')
            checked.append(ident)
        if not path.exists():
            require(take.get('signal') is None and take.get('reasons'), 'Actual local ASR response missing without a held signal failure.')
            continue
        calls.append(ident); raw = read(path); intent = read(run/'local-asr-intents'/(ident+'.private.json'))
        require(raw.get('id') == intent.get('id') == ident and raw.get('audio_sha256') == intent.get('audio_sha256') == digest(run/'clips'/(ident+'.mp3'))
                and raw.get('actual_call_args') == intent.get('actual_call_args') == {'path_or_hf_repo': model['local_directory'], 'language': 'de',
                    'condition_on_previous_text': False, 'temperature': 0.0}, 'Actual Source-free local call lineage differs.')
        if raw.get('state') == 'ACTUAL_CALL_FAILED':
            require(not isinstance(take.get('transcript'), str) and take.get('reasons'), 'Failed local call cannot approve a transcript.')
            continue
        require(raw.get('state') == 'ACTUAL_RESPONSE_RETAINED' and raw.get('source_free') is True and raw.get('raw_saved_before_diagnosis') is True
                and raw.get('actual_runtime') == {'model_path': model['local_directory'], 'dimensions': DIMENSIONS}, 'Whole actual local runtime/raw receipt differs.')
        if isinstance(take.get('transcript'), str):
            response = raw.get('actual_response', {})
            require(isinstance(response.get('text'), str) and response['text'].strip() == take['transcript'], 'Report transcript differs from literal actual response.')
            segments = response.get('segments')
            require(isinstance(segments, list) and segments and all(isinstance(segment, dict)
                    and finite(segment.get('no_speech_prob')) and 0 <= segment['no_speech_prob'] <= .6
                    and finite(segment.get('avg_logprob')) and -1 <= segment['avg_logprob'] <= 0
                    and finite(segment.get('compression_ratio')) and 0 <= segment['compression_ratio'] <= 2.4 for segment in segments),
                    'Uncertain actual local segments cannot approve literal word text.')
            errors = qa.distance(qa.words(rows[ident]['text']), qa.words(take['transcript']))
            require(take.get('word_error_rate') == errors/len(qa.words(rows[ident]['text']))
                    and (not errors or 'asr_lexical_mismatch_requires_review' in take.get('reasons', [])), 'Literal whole word differences were waived.')
        else: require(take.get('reasons'), 'An uncertain local response must remain held.')
    failures = [{'id': take['id'], 'reason': reason} for take in report['takes'] for reason in take.get('reasons', [])]
    require(report.get('checked_ids') == checked
            and report.get('clip_sha256') == {ident: digest(run/'clips'/(ident+'.mp3')) for ident in checked},
            'Current signal checked-ID/audio-hash census differs.')
    require(report.get('failures') == failures and report.get('status') == ('passed' if not failures and checked == EXPECTED_IDS else 'review_required'),
            'Word/signal report failure bodies/status were projected or dropped.')
    return calls


def verify_timing_report(run, report, model):
    rows = {row['id']: row for row in read(run/'lines.private.json')['lines']}
    receipts = []
    for ident in EXPECTED_IDS:
        raw = read(run/'alignment-raw'/(ident+'.private.json')); receipt = read(run/'word-cues'/(ident+'.json'))
        require(raw.get('id') == ident and raw.get('audio_sha256') == digest(run/'clips'/(ident+'.mp3'))
                and raw.get('raw_saved_before_refinement') is True
                and raw.get('source_free') is False and raw.get('teacher_forced_authored_text') is True and raw.get('word_fidelity_proof') is False
                and raw.get('actual_loader_arguments') == {'positional_model_dir': model['local_directory'], 'kwargs': {}}
                and raw.get('actual_runtime') == {'model_path': model['local_directory'], 'dimensions': DIMENSIONS}, 'Actual new-audio timing model/raw response missing.')
        original = raw.get('actual_response')
        require(isinstance(original, dict) and original.get('id') == ident
                and original.get('audio_sha256') == raw['audio_sha256']
                and original.get('text') == cues.acoustic.normalized_text(rows[ident]['text']), 'Raw DTW does not bind current whole Source/audio.')
        actual = copy.deepcopy(original)
        actual['original_qualification_flags'] = copy.deepcopy(actual['qualification_flags'])
        actual = cues.acoustic.refine_boundaries(actual, cues.acoustic.decode(run/'clips'/(ident+'.mp3')))
        actual.update(audio_sha256=raw['audio_sha256'], text_sha256=cues.text_sha(rows[ident]['text']),
                      source_manifest_sha256=digest(run/'lines.private.json'), engine_version=cues.ENGINE)
        actual['all_qualification_flags'] = cues.qualification_flags(actual)
        actual['cues_sha256'] = cues.acoustic.cue_sha(actual['word_cues'])
        actual['authored_word_count'] = len(cues.acoustic.normalized_text(rows[ident]['text']).split())
        require(actual == receipt, 'Current timing receipt differs from actual DTW plus actual waveform refinement; old times/adoptions refused.')
        receipts.append(receipt)
    expected = cues.report_for(receipts)
    expected.update(source_manifest_sha256=digest(run/'lines.private.json'), selected_ids=EXPECTED_IDS, coverage='all_collected')
    require(report == expected, 'Current timing report/failure bodies differ from all actual new-audio receipts.')
    return EXPECTED_IDS


def execute(run, command, model_dir, workers=4, progress_log=None):
    info, _ = collected(run, live=True)
    fresh(run, command)
    require(1 <= workers <= 8, 'Decoder workers must be 1..8.')
    progress_log = monitoring_log(run, command, progress_log)
    model = model_identity(model_dir)
    before, helpers = baseline(run, progress_log), helper_hashes()
    intent_path = run/('qualification-'+command+'.intent.private.json')
    producer_path = run/('qualification-'+command+'.producer.private.json')
    evidence = {'version': VERSION, 'state': 'ONE_ROOT_ACTUAL_RUN_STARTED', 'command': command, 'started_at': int(time.time()),
        'prepared_sha256': digest(run/'prepared.json'), 'input_sha256': info['input_sha256'], 'selected_ids': EXPECTED_IDS,
        'source_manifest_sha256': digest(run/'lines.private.json'), 'model': model, 'helpers_sha256': helpers,
        'pre_existing_child_sha256': before, 'mutable_progress_stdout_log': str(progress_log) if progress_log else None,
        'human_listening_or_acting_or_voice_identity_approved': False}
    retake.save_once(intent_path, evidence)
    retake.save_once(producer_path, evidence)
    try:
        with local_only_runtime(command), adapter(run), capture_actual(run, command, evidence):
            if command == 'qa':
                target = run/'qa.private.json'
                report = qa.qualify(run, target, workers=workers, asr=qa.LocalASR(model['local_directory']),
                                    model_id=qa.MODEL+':'+model['local_directory'])
            else:
                target = run/'word-cues/alignment.private.json'
                report = cues.align_run(run, run/'word-cues', model_dir=Path(model['local_directory']))
        unchanged(run, before)
        require(model_identity(model_dir) == model and helper_hashes() == helpers, 'Model or protected producer code bytes changed.')
        actual_ids = verify_word_report(run, report, model) if command == 'qa' else verify_timing_report(run, report, model)
        require(not evidence.get('runtime_guard_failed'), 'Actual runtime guard failed; no completed producer approval.')
        evidence.update(state='ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT', finished_at=int(time.time()),
            actual_model_call_ids=actual_ids, report_path=str(target), report_sha256=digest(target), report_status=report['status'],
            created_outputs_sha256={name: value for name, value in baseline(run, progress_log).items()
                                    if name not in before and name not in {intent_path.name, producer_path.name}})
        core.save(producer_path, evidence)
        return report
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError):
        evidence.update(state='FAILED_WITH_REAL_PRIVATE_EVIDENCE_NO_APPROVAL', finished_at=int(time.time()))
        core.save(producer_path, evidence)
        raise


def parser():
    value = argparse.ArgumentParser(description=__doc__)
    value.add_argument('command', choices=['preflight', 'qa', 'align'])
    value.add_argument('--run-dir', required=True, type=Path, help='Collected retake child directory, never the original1401 parent')
    value.add_argument('--model-dir', type=Path)
    value.add_argument('--decode-workers', type=int, default=4)
    value.add_argument('--progress-log', type=Path, help='Only <child>/<qa|align>-actual-producer.private.log may grow during that operation')
    return value


def main():
    os.umask(0o077)
    args = parser().parse_args()
    try:
        run = args.run_dir.expanduser().resolve()
        require(retake.PRIVATE.resolve() in run.parents and run.parent.name == 'retake-driver', 'Existing isolated retake child required.')
        require(not (run/'operation.lock').is_symlink(), 'Operation lock symlink refused.')
        lock = common.run_lock(run)
        try:
            if args.command == 'preflight':
                require(args.progress_log is None, 'Preflight has no mutable producer log.')
                info, _ = collected(run, live=True)
                print(json.dumps({'status': 'actual_retakes_ready_for_fresh_local_qa', 'requests': info['request_count'],
                                  'word_signal_timing_or_human_approved': False}))
                return 0
            require(args.model_dir is not None, 'qa/align require an already installed absolute local model.')
            report = execute(run, args.command, args.model_dir, args.decode_workers, args.progress_log)
        finally: lock.close()
        print(json.dumps({'command': args.command, 'status': report['status'], 'checked_source_count': len(EXPECTED_IDS),
                          'human_listening_or_acting_or_voice_identity_approved': False}))
        return 0 if report['status'] == 'passed' else 2
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError):
        print('Current retake qualification refused/failed; real private evidence retained, no automatic model retry or approval.', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
