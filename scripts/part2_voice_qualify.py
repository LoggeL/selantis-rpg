#!/usr/bin/env python3
"""Root-only local Teil-II QA/alignment using unchanged acoustic producers.

One model operation per invocation. No credentials, network downloads, invented
transcripts, timing interpolation, blanket word exceptions or acting approval.
The initial adapter accepts no adjudication overrides; flagged recordings stay
private until a separately reviewed evidence adapter is implemented.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
import json
import importlib
import os
from pathlib import Path
import sys
import time
import uuid
import part2_voice_batch as batch
import story_voice_common as common
import story_voice_qa as qa
import story_voice_word_cues as cues

VERSION = 'part2-actual-local-qualification-v1'
DIMENSIONS = {'n_mels': 128, 'n_audio_ctx': 1500, 'n_audio_state': 1280, 'n_audio_head': 20,
              'n_audio_layer': 32, 'n_vocab': 51866, 'n_text_ctx': 448, 'n_text_state': 1280,
              'n_text_head': 20, 'n_text_layer': 4}


@contextmanager
def adapter():
    old = (common.ROOT, common.PRIVATE, common.prepared, qa.ID, cues.STORY_ID,
           common.core.ROOT, common.core.PRIVATE, common.core.prepared)
    common.ROOT, common.PRIVATE, common.prepared = batch.ROOT, batch.PRIVATE, batch.prepared
    qa.ID, cues.STORY_ID = batch.ID, batch.ID
    try:
        yield
    finally:
        (common.ROOT, common.PRIVATE, common.prepared, qa.ID, cues.STORY_ID,
         common.core.ROOT, common.core.PRIVATE, common.core.prepared) = old


def model_identity(path):
    path = Path(path).expanduser().resolve()
    batch.require(path.is_dir() and (path/'config.json').is_file(), 'Existing absolute local model required.')
    config = batch.read(path/'config.json')
    batch.require(config.get('model_type') == 'whisper' and all(config.get(key) == value for key, value in DIMENSIONS.items()),
                  'Initial adapter requires actual Whisper large-v3-turbo dimensions, not a mislabeled different model.')
    weights = sorted([*path.glob('*.safetensors'), *path.glob('*.npz')])
    batch.require(weights, 'Local model weights missing; no download is performed.')
    return {'local_directory': str(path), 'model': qa.MODEL, 'dimensions': DIMENSIONS,
            'config_sha256': batch.digest(path/'config.json'),
            'weights': {item.name: batch.digest(item) for item in weights}}


def inputs(run):
    paths = [run/'prepared.json', run/'lines.private.json', run/'profiles.private.json', run/'preserved-banks.private.json',
             run/'public-manifest.proposed.json', *(run/'clips').glob('*.mp3')]
    return {str(path): batch.digest(path) for path in paths}


def outputs(run):
    """Full real records, including raw token details and held failures."""
    paths = [run/name for name in ['requests.jsonl', 'source-snapshot.private.json', 'job.json',
             'submit-intent.private.json', 'collect-intent.private.json', 'collection.private.json',
             'responses.private.jsonl', 'qa-asr-cache.private.json'] if (run/name).is_file()]
    for directory in ['raw', 'http-raw', 'asr-raw', 'word-cues']:
        paths.extend(path for path in (run/directory).rglob('*') if path.is_file())
    return {str(path): batch.digest(path) for path in paths}


def runtime_dimensions(model):
    dimensions = {key: getattr(model.dims, key, None) for key in DIMENSIONS}
    batch.require(dimensions == DIMENSIONS, 'Actual loaded model dimensions differ from fixed turbo model.')
    return dimensions


@contextmanager
def actual_outputs(run, command, evidence):
    if command == 'qa':
        import mlx_whisper
        original = mlx_whisper.transcribe
        def capture(path, *args, **kwargs):
            result = original(path, *args, **kwargs)
            holder = importlib.import_module('mlx_whisper.transcribe').ModelHolder
            dimensions = runtime_dimensions(holder.model)
            actual_path = Path(path).resolve()
            batch.require(actual_path.parent == (run/'clips').resolve(), 'Actual ASR clip escapes frozen run.')
            batch.require(not kwargs.get('initial_prompt') and kwargs.get('condition_on_previous_text') is False,
                          'Authored-text leakage into word ASR is refused.')
            batch.core.save(run/'asr-raw'/(actual_path.stem+'.private.json'), {
                'id': actual_path.stem, 'audio_sha256': batch.digest(actual_path), 'source_free': True,
                'language': kwargs.get('language'), 'temperature': kwargs.get('temperature'),
                'actual_runtime_dimensions': dimensions, 'actual_model_path': str(Path(holder.model_path).resolve()),
                'actual_response': result})
            evidence['actual_runtime_dimensions'] = dimensions
            return result
        mlx_whisper.transcribe = capture
        try:
            yield
        finally:
            mlx_whisper.transcribe = original
    else:
        original = cues.load_local_model
        def capture(*args, **kwargs):
            model, tokenizer = original(*args, **kwargs)
            evidence['actual_runtime_dimensions'] = runtime_dimensions(model)
            return model, tokenizer
        cues.load_local_model = capture
        try:
            yield
        finally:
            cues.load_local_model = original


def verify_actual_word_raw(run, report, model):
    rows = {row['id']: row for row in batch.read(run/'lines.private.json')['lines']}
    for take in report['takes']:
        if not isinstance(take.get('transcript'), str):
            continue  # A real failed model/decoding call remains a failure.
        raw = batch.read(run/'asr-raw'/(take['id']+'.private.json'))
        batch.require(raw.get('id') == take['id'] and raw.get('audio_sha256') == report['clip_sha256'][take['id']]
                      and raw.get('source_free') is True and raw.get('language') == 'de' and raw.get('temperature') == 0
                      and raw.get('actual_model_path') == model['local_directory']
                      and raw.get('actual_runtime_dimensions') == DIMENSIONS
                      and raw.get('actual_response', {}).get('text', '').strip() == take['transcript'],
                      'Whole real ASR response missing/stale; cached strings alone cannot qualify this bank.')


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['qa', 'align'])
    parser.add_argument('--run-dir', required=True)
    parser.add_argument('--model-dir', required=True, type=Path, help='Already installed absolute local MLX model; never downloaded')
    parser.add_argument('--decode-workers', type=int, default=4)
    args = parser.parse_args()
    evidence_path = None
    try:
        run = batch.directory(args.run_dir)
        lock = common.run_lock(run)
        batch.prepared(run)
        batch.require(batch.read(run/'job.json').get('state') == 'JOB_STATE_SUCCEEDED'
                      and batch.read(run/'collect-intent.private.json').get('state') == 'COLLECTED_ONCE',
                      'Actual successful provider job must be collected once before any local model run.')
        batch.require(1 <= args.decode_workers <= 8, 'Decode workers must be 1..8.')
        batch.require(args.model_dir.is_absolute(), 'Model directory must be absolute.')
        if args.command == 'qa':
            batch.require(not (run/'qa.private.json').exists() and not (run/'qa-asr-cache.private.json').exists()
                          and not list((run/'asr-raw').glob('*')), 'Initial QA runs once from empty outputs; earlier evidence is never overwritten.')
        else:
            batch.require(not (run/'word-cues/alignment.private.json').exists()
                          and not list((run/'word-cues').glob('part2-*.json')),
                          'Initial alignment runs once from empty receipts; earlier evidence is never overwritten.')
        evidence_path = run/('qualification-'+args.command+'-'+uuid.uuid4().hex+'.producer.private.json')
        evidence = {'version': VERSION, 'command': args.command, 'state': 'ACTUAL_RUN_STARTED',
                    'started_at': int(time.time()), 'model': model_identity(args.model_dir),
                    'inputs_sha256': inputs(run), 'adapter_sha256': batch.digest(Path(__file__)),
                    'qa_script_sha256': batch.digest(Path(qa.__file__)),
                    'cue_script_sha256': batch.digest(Path(cues.__file__)),
                    'acoustic_script_sha256': batch.digest(Path(cues.acoustic.__file__)),
                    'human_listening_or_acting_approval': False}
        batch.core.save(evidence_path, evidence)
        with adapter(), actual_outputs(run, args.command, evidence):
            if args.command == 'qa':
                target = run/'qa.private.json'
                report = qa.qualify(run, target, workers=args.decode_workers,
                                    asr=qa.LocalASR(str(args.model_dir.resolve())),
                                    model_id=qa.MODEL+':'+str(args.model_dir.resolve()))
            else:
                target = run/'word-cues/alignment.private.json'
                report = cues.align_run(run, run/'word-cues', model_dir=cues.resolve_model_dir(args.model_dir))
        batch.require(inputs(run) == evidence['inputs_sha256'], 'Audio/frozen inputs changed during qualification.')
        batch.require(model_identity(args.model_dir) == evidence['model'], 'Model bytes changed during qualification.')
        if args.command == 'qa':
            verify_actual_word_raw(run, report, evidence['model'])
            evidence['actual_runtime_dimensions'] = DIMENSIONS
        batch.require(evidence.get('actual_runtime_dimensions') == DIMENSIONS, 'Actual runtime model receipt missing.')
        evidence.update(state='ACTUAL_RUN_COMPLETED', finished_at=int(time.time()),
                        report_path=str(target), report_sha256=batch.digest(target), report_status=report['status'],
                        outputs_sha256=outputs(run))
        batch.core.save(evidence_path, evidence)
        lock.close()
        print(json.dumps({'status': report['status'], 'command': args.command,
                          'human_listening_or_acting_approval': False, 'producer_evidence': str(evidence_path)}))
        return 0 if report['status'] == 'passed' else 2
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError):
        if evidence_path is not None and evidence_path.exists():
            evidence = batch.read(evidence_path)
            evidence.update(state='FAILED_WITHOUT_APPROVAL', finished_at=int(time.time()))
            batch.core.save(evidence_path, evidence)
        print('Teil-II qualification failed; real private evidence retained and no approval issued.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
