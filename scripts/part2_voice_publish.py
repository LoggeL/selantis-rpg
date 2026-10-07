#!/usr/bin/env python3
"""Publish only individually approved, current and actually qualified Teil-II takes.

Full QA/alignment reports and their failures remain private and unchanged. A
partial bank states its missing Sources explicitly. This adapter accepts only
the initial unmodified acoustic receipts; reviewed exceptions require a future
case-specific adapter. No Story/Prolog file is ever exported or replaced here.
"""
from __future__ import annotations
import argparse
import base64
import copy
from contextlib import contextmanager, ExitStack
import fcntl
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import wave
import part2_voice_batch as batch
import part2_voice_qualify as qualification
import story_voice_qa as qa_engine
import story_voice_word_cues as cue_engine

VERSION = 'part2-current-source-qualified-publication-v1'
require = batch.require
SCANNER_METADATA = {
    'output/audio/part2-voice/2026-10-07/derived-source-current.private.json': 'source_snapshot_manifest_sha256',
    'output/audio/part2-voice/2026-10-07/source-snapshot.private.json': 'initial_source_snapshot_manifest_sha256',
}


def scanner_metadata(manifest, target_root):
    """Exact two private scanner inputs, shared unchanged by both worktrees."""
    bound = {}
    for name, field in SCANNER_METADATA.items():
        expected = manifest.get(field)
        require(isinstance(expected, str) and len(expected) == 64, 'Frozen scanner metadata hash missing.')
        for root in [batch.ROOT, target_root]:
            path = batch.contained(root, name)
            require(path.is_file() and batch.digest(path) == expected,
                    'Production/release scanner metadata differs from frozen inventory: '+name)
            batch.read(path)  # Retain exact bytes; malformed JSON cannot be a scanner input.
            bound[str(path)] = expected
    return bound


def release_inventory(manifest, target_root, metadata_bound):
    """Replay the frozen scanner natively in the actual release worktree.

    Production QA provenance remains production provenance; this is a separate
    Source/route read-back, with no audio, models, network or public writes.
    """
    script = target_root/'scripts/part2_voice_inventory.mjs'
    with tempfile.TemporaryDirectory(prefix='part2-release-ast-') as directory:
        output = Path(directory)/'actual.json'
        result = subprocess.run(['node', str(script), '--propose', '--output', str(output)],
                                cwd=target_root, capture_output=True, text=True)
        require(result.returncode == 0 and output.is_file(), 'Native release AST replay failed.')
        actual = batch.read(output)
    fields = ['model', 'lines', 'runtime_lookup', 'source_hashes', 'aliases', 'scene_players', 'unresolved',
              'source_snapshot_manifest_sha256', 'initial_source_snapshot_manifest_sha256', 'source_validation',
              'mixed_scene_players']
    require(all(actual.get(field) == manifest.get(field) for field in fields),
            'Actual release AST/cast/routes differ from frozen production inventory.')
    stable(metadata_bound, {})


@contextmanager
def target_publish_lock(target_root):
    """One cooperative publisher per physical target, across production roots.

    This filename differs from the production publish.lock, including when the
    release and production worktree are the same; no self-lock deadlock occurs.
    """
    target_root = Path(target_root).resolve()
    folder = target_root/'output/audio/part2-voice'
    require(folder.resolve() == folder, 'Symlink in target publication-lock ancestors.')
    folder.mkdir(parents=True, exist_ok=True)
    path = folder/'target-publication.lock'
    require(not path.is_symlink(), 'Unsafe target publication lock.')
    fd = os.open(path, os.O_RDWR | os.O_CREAT | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(fd, 'r+') as stream:
        own = os.fstat(stream.fileno())
        identity = (own.st_dev, own.st_ino)
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise batch.SafeError('Another publisher holds this release target; no export attempted.') from None
        try:
            require((path.stat().st_dev, path.stat().st_ino) == identity, 'Target publication lock was replaced.')
            yield
            require((path.stat().st_dev, path.stat().st_ino) == identity, 'Target publication lock changed during export.')
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def file_map(directory):
    if not directory.exists():
        return {}
    require(directory.is_dir() and not directory.is_symlink(), 'Unsafe preserved bank.')
    result = {}
    for path in directory.rglob('*'):
        require(not path.is_symlink(), 'Symlink in preserved bank.')
        if path.is_file():
            result[str(path.relative_to(directory))] = batch.digest(path)
    return result


def producer(path, command, report_path, run):
    value = batch.read(path)
    require(value.get('version') == qualification.VERSION and value.get('command') == command
            and value.get('state') == 'ACTUAL_RUN_COMPLETED'
            and value.get('report_path') == str(report_path) and value.get('report_sha256') == batch.digest(report_path)
            and value.get('human_listening_or_acting_approval') is False
            and value.get('actual_runtime_dimensions') == qualification.DIMENSIONS,
            'Actual completed producer evidence missing/stale.')
    for field, script in [('adapter_sha256', Path(qualification.__file__)),
                          ('qa_script_sha256', Path(qa_engine.__file__)),
                          ('cue_script_sha256', Path(cue_engine.__file__)),
                          ('acoustic_script_sha256', Path(cue_engine.acoustic.__file__))]:
        require(value.get(field) == batch.digest(script), 'Qualification producer changed.')
    require(value.get('inputs_sha256') == qualification.inputs(run), 'Actual producer does not bind all current audio/input bytes.')
    require(isinstance(value.get('outputs_sha256'), dict) and value['outputs_sha256']
            and all(Path(path).is_file() and batch.digest(path) == digest for path, digest in value['outputs_sha256'].items()),
            'Actual raw output/cache/token receipt changed after model execution.')
    require(qualification.model_identity(Path(value['model']['local_directory'])) == value['model'], 'Actual local model bytes differ.')
    return value


def response_records(run, selected):
    """Verify the retained actual provider bytes, rather than a self-made receipt."""
    intent = batch.read(run/'collect-intent.private.json')
    require(intent.get('state') == 'COLLECTED_ONCE' and intent.get('response_sha256') == batch.digest(run/'responses.private.jsonl'),
            'Original actual provider output is missing or changed.')
    raw_files = intent.get('provider_http_raw_sha256')
    require(isinstance(raw_files, dict) and raw_files, 'Actual provider HTTP response archives missing.')
    for name, digest in raw_files.items():
        require(name.startswith('http-raw/') and batch.digest(batch.contained(run, name)) == digest, 'Actual HTTP raw bytes changed.')
    response_bytes = (run/'responses.private.jsonl').read_bytes()
    records = [json.loads(line) for line in response_bytes.splitlines() if line.strip()]
    keys = [record.get('key', record.get('metadata', {}).get('key')) for record in records]
    frozen_ids = {row['id'] for row in batch.read(run/'lines.private.json')['lines']}
    require(len(keys) == len(set(keys)) and set(keys) <= frozen_ids and selected <= set(keys), 'Actual response keys incomplete/unknown/duplicate.')
    retained = False
    for name in raw_files:
        raw = batch.contained(run, name).read_bytes()
        if raw == response_bytes:
            retained = True
            break
        try:
            value = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            continue
        inline = batch.common.inline_records(value)
        if inline is not None and inline == records:
            retained = True
            break
    require(retained, 'Collected records are not the actual original provider HTTP response.')
    journal = batch.read(run/'job.json')
    prepared = batch.prepared(run)
    submit = batch.read(run/'submit-intent.private.json')
    require(journal.get('model') == submit.get('model') == batch.core.MODEL
            and journal.get('state') == 'JOB_STATE_SUCCEEDED' and journal.get('job_name', '').startswith('batches/')
            and submit.get('input_sha256') == prepared['input_sha256'] and submit.get('state') in {'CONFIRMED', 'RECONCILED'},
            'Once-only successful job/request intent missing.')
    for record, ident in zip(records, keys):
        if ident not in selected:
            continue
        body = record.get('response', {})
        require(not record.get('error') and not record.get('status') and isinstance(body, dict), 'Selected response is an actual provider error.')
        version = body.get('modelVersion', body.get('model_version'))
        require(isinstance(version, str) and (version == batch.core.MODEL or version.startswith(batch.core.MODEL+'-')),
                'Actual response model version differs/missing.')
        candidates = body.get('candidates')
        require(isinstance(candidates, list) and len(candidates) == 1, 'Unexpected actual TTS candidates.')
        parts = candidates[0].get('content', {}).get('parts', [])
        blocks = [part.get('inlineData', part.get('inline_data')) for part in parts if part.get('inlineData', part.get('inline_data'))]
        blocks = [block for block in blocks if block.get('mimeType', block.get('mime_type', '')).startswith('audio/')]
        require(len(blocks) == 1, 'Actual provider audio block missing/ambiguous.')
        block = blocks[0]
        data = base64.b64decode(block['data'], validate=True)
        actual_wav = batch.contained(run, 'raw/'+ident+'.wav')
        mime = block.get('mimeType', block.get('mime_type', ''))
        if mime.startswith('audio/wav'):
            require(data == actual_wav.read_bytes(), 'Private provider WAV differs from actual returned audio bytes.')
        else:
            require(mime.startswith('audio/l16'), 'Unsupported actual provider encoding.')
            with wave.open(str(actual_wav), 'rb') as wav:
                require((wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (1, 2, 24000)
                        and wav.readframes(wav.getnframes()) == data, 'Actual returned PCM differs from collected WAV.')
    return [run/'job.json', run/'submit-intent.private.json', run/'responses.private.jsonl', run/'collect-intent.private.json',
            *[batch.contained(run, name) for name in raw_files]]


def ids(values, name):
    require(isinstance(values, list) and all(isinstance(value, str) and batch.ID.fullmatch(value) for value in values)
            and len(values) == len(set(values)), 'Invalid/duplicate ' + name)
    return set(values)


def report_coverage(qa, alignment, manifest, run):
    expected = {row['id'] for row in manifest['lines']}
    bound = batch.digest(run/'lines.private.json')
    require(qa.get('version') == qa_engine.VERSION and isinstance(qa.get('model'), str)
            and qa['model'].startswith(qa_engine.MODEL+':') and qa.get('manifest_sha256') == bound
            and qa.get('finished_at') and qa.get('status') in {'passed', 'review_required', 'needs_review'},
            'Wrong/incomplete full word/signal report.')
    takes = qa.get('takes')
    require(isinstance(takes, list) and ids([take.get('id') for take in takes], 'QA takes') == expected,
            'Full QA must retain every frozen Source, including failed/missing takes.')
    checked = ids(qa.get('checked_ids'), 'QA checked IDs')
    require(checked <= expected and set(qa.get('clip_sha256', {})) == checked, 'QA hash coverage differs.')
    failures = qa.get('failures')
    require(isinstance(failures, list) and all(isinstance(value, dict) and value.get('id') in expected for value in failures),
            'Global or unknown QA failure blocks publication.')
    actual_failures = sorted((value['id'], value.get('reason')) for value in failures)
    from_takes = sorted((take['id'], reason) for take in takes for reason in take.get('reasons', []))
    require(actual_failures == from_takes, 'Full QA failures were omitted or changed.')
    require((qa.get('status') == 'passed') == (not failures and checked == expected), 'Full QA status contradicts failures.')
    require(alignment.get('method') == cue_engine.ENGINE and alignment.get('model') == cue_engine.acoustic.MODEL
            and alignment.get('source_manifest_sha256') == bound
            and alignment.get('status') in {'passed', 'needs_review'}, 'Wrong current actual alignment report.')
    selected = ids(alignment.get('selected_ids'), 'aligned collection IDs')
    require(selected == checked and alignment.get('coverage') == 'all_collected', 'Timing census must cover every actually collected take.')
    require(set(alignment.get('clip_sha256', {})) == selected
            and set(alignment.get('authored_text_sha256', {})) == selected
            and set(alignment.get('alignment_by_id', {})) <= selected,
            'Timing report hashes/cardinality incomplete.')
    timing_failures = alignment.get('failures')
    require(isinstance(timing_failures, list) and all(value.get('id') in selected for value in timing_failures),
            'Unknown/global alignment failure blocks publication.')
    require((alignment.get('status') == 'passed') == (not timing_failures), 'Full timing status contradicts failures.')
    return {take['id']: take for take in takes}, checked


def full_timing_receipts(run, alignment, checked):
    receipts = [batch.read(batch.contained(run, 'word-cues/'+ident+'.json')) for ident in alignment['selected_ids']]
    for receipt in receipts:
        require(receipt.get('all_qualification_flags') == cue_engine.qualification_flags(receipt), 'Full actual timing flags differ.')
    actual = cue_engine.report_for(receipts)
    actual.update(source_manifest_sha256=batch.digest(run/'lines.private.json'),
                  selected_ids=alignment['selected_ids'], coverage='all_collected')
    require(actual == alignment, 'Whole actual timing report/failure bodies differ from every current raw receipt.')
    return [batch.contained(run, 'word-cues/'+ident+'.json') for ident in checked]


def current_clip(row, run, profiles, qa, alignment, takes, decode_fn=qa_engine.decode):
    ident = row['id']
    path = batch.contained(run, 'clips/'+ident+'.mp3')
    audio_hash = batch.digest(path)
    text_hash = batch.sha(row['text'].encode())
    take = takes[ident]
    require(not take.get('reasons') and not take.get('adjudication') and take.get('text_sha256') == text_hash,
            'Initial publisher accepts only actual unqualified-free complete words/signals.')
    transcript = take.get('transcript')
    require(isinstance(transcript, str) and qa_engine.words(transcript) == qa_engine.words(row['text'])
            and take.get('word_error_rate') == 0, 'Actual full-word transcript differs; keep this take private.')
    require(qa.get('clip_sha256', {}).get(ident) == alignment.get('clip_sha256', {}).get(ident) == audio_hash,
            'Current physical audio differs from actual reports.')
    signal = decode_fn(path)
    require(signal == take.get('signal') and not qa_engine.signal_failures(signal, len(qa_engine.words(row['text']))),
            'Current physical signal differs or fails.')
    receipt = batch.read(batch.contained(run, 'raw/'+ident+'.receipt.json'))
    require(receipt.get('status') == 'complete' and receipt.get('backend') == 'batch'
            and receipt.get('id') == ident and receipt.get('mp3_sha256') == audio_hash
            and receipt.get('request_sha256') == batch.sha(batch.canonical(batch.request_for(row, profiles['speakers'])).encode())
            and receipt.get('wav_sha256') == batch.digest(batch.contained(run, 'raw/'+ident+'.wav')),
            'Actual provider/normalization receipt differs from this request/audio.')
    require(receipt.get('normalization') == {'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11}
            and isinstance(receipt.get('loudness_input'), dict)
            and all(key in receipt['loudness_input'] and math.isfinite(float(receipt['loudness_input'][key]))
                    for key in ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']),
            'Actual normalization measurement/target receipt missing.')
    require(type(receipt.get('seconds')) in (int, float) and abs(receipt['seconds']-signal['seconds']) < .1,
            'Provider and decoded duration differ.')
    temporal = batch.read(batch.contained(run, 'word-cues/'+ident+'.json'))
    entry = alignment.get('alignment_by_id', {}).get(ident, {})
    words = cue_engine.acoustic.normalized_text(row['text']).split()
    require(temporal.get('engine_version') == cue_engine.ENGINE
            and temporal.get('audio_sha256') == audio_hash and temporal.get('text_sha256') == text_hash
            and temporal.get('source_manifest_sha256') == batch.digest(run/'lines.private.json')
            and not temporal.get('all_qualification_flags')
            and not cue_engine.qualification_flags(temporal)
            and not any(key in temporal for key in ['CTC_adoption', 'Partial_CTC_adoption', 'Vocal_event_adoption']),
            'Timing flags/adopted alternatives stay private until case-specific review.')
    require(abs(temporal.get('decoded_seconds', -100)-signal['seconds']) < .001
            and temporal.get('text') == row['text'] and temporal.get('authored_word_count') == len(words),
            'Actual timing duration/Source/census differs.')
    detail = temporal.get('words', [])
    cues = temporal.get('word_cues', [])
    require(len(detail) == len(cues) == len(words) and [value.get('word') for value in detail] == words,
            'Actual authored timing receipt is incomplete.')
    previous = 0
    for word, cue, data in zip(words, cues, detail):
        start, end = cue.get('start'), cue.get('end')
        require(set(cue) == {'start', 'end'} and all(type(value) in (int, float) and math.isfinite(value) for value in [start, end])
                and previous <= start <= end <= signal['seconds']+.001, 'Invalid actual cue range/order.')
        require(start < end or (data.get('spoken') is False and not re_word(word)), 'Collapsed lexical cue remains private.')
        previous = end
    cue_hash = cue_engine.acoustic.cue_sha(cues)
    require(temporal.get('cues_sha256') == entry.get('cues_sha256') == cue_hash
            and entry.get('word_count') == len(words) and entry.get('text_sha256') == text_hash
            and alignment.get('authored_text_sha256', {}).get(ident) == text_hash
            and entry.get('words') == [{'word': word, **cue} for word, cue in zip(words, cues)],
            'Current per-word alignment differs from actual receipt.')
    require(batch.digest(path) == audio_hash, 'Audio changed while qualifying publication.')
    return {'id': ident, 'kind': row['kind'], 'speaker': row['speaker'], 'text': row['text'],
            'display_text': row['display_text'], 'voice': profiles['speakers'][row['speaker']]['google_voice'],
            'audio': 'audio/teil-2/'+ident+'.mp3', 'sha256': audio_hash, 'seconds': signal['seconds'],
            'word_cues': copy.deepcopy(cues), 'runtime_keys': copy.deepcopy(row['runtime_keys'])}, path


def re_word(value):
    return bool(qa_engine.words(value))


def build(args, root_selection):
    run = Path(args.run_dir).expanduser().resolve()
    require(batch.PRIVATE.resolve() in run.parents, 'Wrong private Teil-II run.')
    batch.prepared(run, live=True)
    manifest, profiles = batch.read(run/'lines.private.json'), batch.read(run/'profiles.private.json')
    fields = {'manifest_sha256': run/'lines.private.json', 'profiles_sha256': run/'profiles.private.json',
              'prepared_sha256': run/'prepared.json', 'qa_sha256': args.qa_report,
              'alignment_sha256': args.alignment_report, 'qa_producer_sha256': args.qa_producer,
              'alignment_producer_sha256': args.alignment_producer}
    require(root_selection.get('status') == 'approved_part2_voice_selection' and root_selection.get('reviewed_by') == 'root'
            and root_selection.get('actual_word_signal_and_timing_evidence_reviewed') is True
            and root_selection.get('human_listening_or_acting_approval') is False,
            'Explicit current per-take Root selection required; no human hearing claim.')
    require(all(root_selection.get(key) == batch.digest(value) for key, value in fields.items()), 'Root selection input hashes differ.')
    qa_producer = producer(Path(args.qa_producer), 'qa', Path(args.qa_report), run)
    alignment_producer = producer(Path(args.alignment_producer), 'align', Path(args.alignment_report), run)
    qa, alignment = batch.read(args.qa_report), batch.read(args.alignment_report)
    takes, checked = report_coverage(qa, alignment, manifest, run)
    selected = ids(root_selection.get('selected_ids'), 'Root selected IDs')
    expected = {row['id'] for row in manifest['lines']}
    require(selected and selected <= checked <= expected, 'Root selection is empty/unknown/uncollected.')
    proof_paths = [*full_timing_receipts(run, alignment, checked), *response_records(run, selected)]
    qualification.verify_actual_word_raw(run, qa, qa_producer['model'])
    collection = batch.read(run/'collection.private.json')
    require(collection.get('expected') == len(expected) and collection.get('collected') == len(checked), 'Actual collection census differs.')
    intent = batch.read(run/'collect-intent.private.json')
    require(intent.get('state') == 'COLLECTED_ONCE' and intent.get('response_sha256') == batch.digest(run/'responses.private.jsonl'),
            'Original actual provider output is missing or changed.')
    clips, paths, missing = [], {}, []
    for row in manifest['lines']:
        ident = row['id']
        if ident in selected:
            clip, path = current_clip(row, run, profiles, qa, alignment, takes)
            clips.append(clip)
            paths[ident] = path
        else:
            reasons = list(takes[ident].get('reasons', []))
            reasons.extend(value.get('reason', 'timing_requires_review') for value in alignment.get('failures', []) if value['id'] == ident)
            missing.append({'id': ident, 'scene': row['scene'], 'kind': row['kind'], 'speaker': row['speaker'],
                            'reasons': reasons or ['not_selected_by_root']})
    public = {'model': batch.core.MODEL, 'aliases': manifest['aliases'], 'scene_players': manifest['scene_players'],
              'clips': clips, 'coverage': {'version': VERSION, 'status': 'complete' if not missing else 'partial',
              'expected_sources': len(expected), 'published_sources': len(clips), 'missing_sources': missing,
              'human_listening_or_acting_approval': False}}
    target_root = Path(args.target_root).expanduser().resolve() if getattr(args, 'target_root', None) else batch.ROOT.resolve()
    require(root_selection.get('target_root') == str(target_root), 'Root selection must name the exact publication worktree.')
    require(target_root.is_dir() and not target_root.is_symlink(), 'Publication worktree missing/unsafe.')
    require((target_root/'game/public/audio').resolve() == target_root/'game/public/audio', 'Symlink in publication ancestors.')
    current_preserved = batch.preserved_banks(target_root)
    require(root_selection.get('preserved_banks_sha256') == batch.sha(batch.canonical(current_preserved).encode()),
            'Root selection must bind the exact current Story/Prolog banks and census.')
    frozen_preserved = batch.read(run/'preserved-banks.private.json')
    require(set(frozen_preserved) == {'prolog', 'story'}, 'Existing 188 Prolog/1490 Story baseline missing.')
    for bank, baseline in frozen_preserved.items():
        for name, digest in baseline['files_sha256'].items():
            if bank == 'story' and name == 'manifest.json':
                continue  # A separately Root-reviewed additive Story release may coexist.
            require(current_preserved[bank]['files_sha256'].get(name) == digest, 'Existing protected '+bank+' bytes changed.')
    for name, digest in manifest['source_hashes'].items():
        require(batch.digest(batch.contained(target_root, name)) == digest, 'Release worktree Source/cast/regie differs: '+name)
    for name in ['scripts/part2_voice_inventory.mjs', 'scripts/part2_voice_batch.py', 'scripts/part2_voice_qualify.py',
                 'scripts/part2_voice_publish.py']:
        require(batch.digest(batch.contained(target_root, name)) == batch.digest(batch.ROOT/name), 'Release adapter/scanner differs.')
    metadata_bound = scanner_metadata(manifest, target_root)
    release_inventory(manifest, target_root, metadata_bound)
    preserve = {str(target_root/'game/public/audio'/name): file_map(target_root/'game/public/audio'/name) for name in ['prolog', 'story']}
    bound = {str(path): batch.digest(path) for path in [*fields.values(), run/'collect-intent.private.json',
              run/'responses.private.jsonl', *proof_paths, *paths.values(), *[batch.ROOT/name for name in manifest['source_hashes']],
              Path(__file__), Path(batch.__file__), Path(qualification.__file__), Path(qa_engine.__file__),
              Path(cue_engine.__file__), Path(cue_engine.acoustic.__file__) ]}
    bound.update(qa_producer['outputs_sha256'])
    bound.update(alignment_producer['outputs_sha256'])
    bound.update(metadata_bound)
    bound.update({str(target_root/name): digest for name, digest in manifest['source_hashes'].items()})
    for value in [qa_producer, alignment_producer]:
        model_root = Path(value['model']['local_directory'])
        bound[str(model_root/'config.json')] = value['model']['config_sha256']
        bound.update({str(model_root/name): digest for name, digest in value['model']['weights'].items()})
    for name in ['scripts/part2_voice_inventory.mjs', 'scripts/part2_voice_batch.py', 'scripts/part2_voice_qualify.py',
                 'scripts/part2_voice_publish.py']:
        bound[str(target_root/name)] = batch.digest(target_root/name)
    return public, paths, preserve, bound


def stable(bound, preserved):
    require(all(Path(path).is_file() and batch.digest(path) == value for path, value in bound.items()), 'Reviewed input changed before export.')
    require(all(file_map(Path(name) if Path(name).is_absolute() else batch.ROOT/'game/public/audio'/name) == value for name, value in preserved.items()),
            'Preserved Prolog/Story bank changed during Teil-II export.')


def existing(target, selection, public):
    expected = selection.get('existing_manifest_sha256')
    require(not target.is_symlink(), 'Dangling/public bank symlink refused.')
    if not target.exists():
        require(expected is None, 'Expected existing Teil-II bank is missing.')
        return None, {}
    require(target.is_dir() and not target.is_symlink() and (target/'manifest.json').is_file()
            and batch.digest(target/'manifest.json') == expected, 'Existing Teil-II manifest differs from Root selection.')
    manifest = batch.read(target/'manifest.json')
    old = ids([clip.get('id') for clip in manifest.get('clips', [])], 'existing Teil-II IDs')
    selected = {clip['id'] for clip in public['clips']}
    require(old <= selected, 'Previously published current takes cannot be silently removed by a partial export.')
    require(set(path.name for path in target.iterdir()) == {'manifest.json', *(ident+'.mp3' for ident in old)},
            'Unknown files in Teil-II public bank.')
    for clip in manifest['clips']:
        require(clip.get('audio') == 'audio/teil-2/'+clip['id']+'.mp3'
                and batch.digest(batch.contained(target, clip['id']+'.mp3')) == clip.get('sha256'), 'Existing public audio differs.')
    return target.stat().st_ino, file_map(target)


def apply(target, selection, public, paths, preserved, bound, finalize=None, undo=None):
    target_root = Path(selection.get('target_root', str(batch.ROOT))).resolve()
    require(target == target_root/'game/public/audio/teil-2' and not target.is_symlink(),
            'Export target must be the Root-selected worktree game/public/audio/teil-2/.')
    require(target.parent.resolve() == target.parent, 'Symlink in public bank ancestors.')
    target.parent.mkdir(parents=True, exist_ok=True)
    inode, old_files = existing(target, selection, public)
    stage = target.parent/('.teil-2-stage-'+uuid.uuid4().hex)
    backup = target.parent/('.teil-2-backup-'+uuid.uuid4().hex)
    stage.mkdir(mode=0o700)
    published = False
    moved_old = False
    try:
        for ident, path in paths.items():
            shutil.copyfile(path, stage/(ident+'.mp3'))
            os.chmod(stage/(ident+'.mp3'), 0o644)
        batch.core.save(stage/'manifest.json', public)
        os.chmod(stage/'manifest.json', 0o644)
        os.chmod(stage, 0o755)
        require(all(batch.digest(stage/(ident+'.mp3')) == clip['sha256'] for ident, clip in
                    ((clip['id'], clip) for clip in public['clips'])), 'Staged audio differs.')
        stable(bound, preserved)
        if inode is not None:
            require(target.stat().st_ino == inode and file_map(target) == old_files, 'Existing bank changed before transaction.')
            target.rename(backup)
            moved_old = True
        # mkdir provides O_EXCL destination ownership; individual hard links
        # never overwrite a concurrent file. A foreign nonempty destination is
        # preserved and the old bank can be recovered from the private backup.
        target.mkdir(mode=0o755)
        own_identity = (target.stat().st_dev, target.stat().st_ino)
        for path in stage.iterdir():
            os.link(path, target/path.name)
        published = True
        stable(bound, preserved)
        require((target.stat().st_dev, target.stat().st_ino) == own_identity and file_map(target) == file_map(stage), 'Public read-back differs.')
        if finalize is not None:
            finalize()
        stable(bound, preserved)
        require((target.stat().st_dev, target.stat().st_ino) == own_identity and file_map(target) == file_map(stage),
                'Public bank replaced/changed while finalizing coverage; original backup retained.')
        if moved_old:
            shutil.rmtree(backup)
    except BaseException:
        if undo is not None:
            undo()
        if 'own_identity' in locals() and target.exists() and (target.stat().st_dev, target.stat().st_ino) == own_identity:
            # Do not remove foreign additions/replacements in our directory.
            own_names = {path.name for path in stage.iterdir()}
            if set(path.name for path in target.iterdir()) <= own_names and all(
                    (stage/path.name).exists() and path.stat().st_ino == (stage/path.name).stat().st_ino for path in target.iterdir()):
                shutil.rmtree(target)
        if moved_old and not target.exists():
            backup.rename(target)
        raise
    finally:
        shutil.rmtree(stage)


def exclusive_report(path, report):
    path.parent.mkdir(parents=True, exist_ok=True)
    own_identity = None
    try:
        with path.open('x') as stream:
            stat = os.fstat(stream.fileno())
            own_identity = (stat.st_dev, stat.st_ino)
            os.fchmod(stream.fileno(), 0o600)
            json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write('\n')
        require(batch.read(path) == report and (path.stat().st_dev, path.stat().st_ino) == own_identity,
                'Coverage read-back changed during finalization.')
        return own_identity
    except BaseException:
        if own_identity is not None and path.exists() and (path.stat().st_dev, path.stat().st_ino) == own_identity:
            path.unlink()
        raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['dryrun', 'apply'])
    parser.add_argument('--run-dir', required=True)
    parser.add_argument('--selection', required=True, type=Path)
    parser.add_argument('--target-root', type=Path, help='Exact Root-selected release worktree; all current Sources/cast/adapters must match')
    for name in ['qa-report', 'alignment-report', 'qa-producer', 'alignment-producer']:
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--coverage-report', required=True, type=Path)
    args = parser.parse_args()
    try:
        run = Path(args.run_dir).expanduser().resolve()
        require(batch.PRIVATE.resolve() in args.coverage_report.resolve().parents, 'Coverage report must remain private.')
        batch.PRIVATE.mkdir(parents=True, exist_ok=True)
        with ExitStack() as locks:
            lock = locks.enter_context((batch.PRIVATE/'publish.lock').open('a+'))
            fcntl.flock(lock, fcntl.LOCK_EX)
            selection = batch.read(args.selection)
            target_root = args.target_root.expanduser().resolve() if args.target_root else batch.ROOT.resolve()
            require(selection.get('target_root') == str(target_root), 'Root selection must name the exact locked publication worktree.')
            locks.enter_context(target_publish_lock(target_root))
            public, paths, preserved, bound = build(args, selection)
            bound[str(args.selection)] = batch.digest(args.selection)
            target = target_root/'game/public/audio/teil-2'
            existing(target, selection, public)
            stable(bound, preserved)
            report = {'version': VERSION, 'state': 'PUBLISHED' if args.command == 'apply' else 'VALIDATED',
                      **public['coverage'], 'public_manifest_sha256': batch.sha((json.dumps(public, ensure_ascii=False, indent=2)+'\n').encode()),
                      'selection_sha256': batch.digest(args.selection), 'preserved_bank_sha256': preserved,
                      'checked_at': int(time.time())}
            require(not args.coverage_report.exists(), 'Coverage path already exists; immutable proof must not be replaced.')
            if args.command == 'apply':
                report_identity = None
                def finalize():
                    nonlocal report_identity
                    report_identity = exclusive_report(args.coverage_report, report)
                    bound[str(args.coverage_report)] = batch.digest(args.coverage_report)
                def undo():
                    if report_identity is not None and args.coverage_report.exists() and (
                            args.coverage_report.stat().st_dev, args.coverage_report.stat().st_ino) == report_identity:
                        args.coverage_report.unlink()
                apply(target, selection, public, paths, preserved, bound, finalize, undo)
            else:
                exclusive_report(args.coverage_report, report)
            print(json.dumps({'state': report['state'], 'published': len(public['clips']),
                              'missing': len(public['coverage']['missing_sources']), 'complete': public['coverage']['status'] == 'complete'}))
        return 0
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError):
        print('Teil-II export refused; public banks and real private failures remain protected.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
