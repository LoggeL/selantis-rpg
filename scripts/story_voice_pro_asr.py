#!/usr/bin/env python3
"""Isolated, explicitly bounded Pro Batch ASR; no expected source words.

prepare --run-dir RUN --batch-name NAME --only-ids IDS --max-calls N
submit|status|collect|reconcile|merge --run-dir RUN --batch-name NAME
Network commands require --key-stdin. Root alone performs paid requests.
"""
from __future__ import annotations
import argparse
import base64
import copy
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import story_voice_asr_batch as transport
from story_voice_common import core

MODEL = 'gemini-3.1-pro-preview'
PROMPT = transport.asr.PROMPT
FOLDER = 'independent-pro-asr'
CONTRACT_VERSION = 1
SCHEMA = {'type': 'OBJECT', 'properties': {'transcript': {'type': 'STRING'}}, 'required': ['transcript']}
CONFIG = {'temperature': 0, 'responseMimeType': 'application/json', 'responseSchema': SCHEMA,
          'thinkingConfig': {'thinkingLevel': 'low', 'includeThoughts': False}, 'maxOutputTokens': 2048}
NOTE = ('Independent unprompted Pro Batch transcription, no authored dialogue/names. '
        'Word evidence only; no timing, actor changes, human hearing or publication approval.')


def require(condition, message):
    if not condition: raise core.SafeError(message)


def text_hash(value):
    return core.digest(value.encode('utf-8'))


def object_hash(value):
    return core.digest(json.dumps(value, sort_keys=True).encode())


def metadata():
    return {'pro_contract_version': CONTRACT_VERSION, 'prompt_sha256': text_hash(PROMPT),
            'request_contract_sha256': object_hash({'model': MODEL, 'prompt': PROMPT, 'config': CONFIG}),
            'driver_sha256': core.digest(Path(__file__).read_bytes()),
            'transport_sha256': core.digest(Path(transport.__file__).read_bytes())}


def request_for(audio):
    require(isinstance(audio, bytes) and bool(audio), 'Pro ASR requires nonempty original MP3 bytes.')
    request = transport_original_request(audio)
    request['generationConfig'] = copy.deepcopy(CONFIG)
    require(len(json.dumps(request).encode()) <= 19_000_000, 'Pro inline request exceeds conservative bound.')
    return request


transport_original_request = transport.asr.request_for


def response_transcript(response):
    require(isinstance(response, dict) and response.get('modelVersion') == MODEL,
            'Unexpected Pro ASR model version.')
    candidates = response.get('candidates')
    require(isinstance(candidates, list) and len(candidates) == 1 and isinstance(candidates[0], dict)
            and candidates[0].get('finishReason') == 'STOP', 'Incomplete Pro ASR candidate.')
    content = candidates[0].get('content')
    require(isinstance(content, dict), 'Pro ASR model content is missing.')
    parts = content.get('parts')
    require(isinstance(parts, list) and bool(parts) and all(isinstance(part, dict)
            and set(part) <= {'text', 'thoughtSignature'} and isinstance(part.get('text'), str)
            for part in parts), 'Pro ASR requires final text only, no thought/tools/timestamps.')
    value = json.loads(''.join(part['text'] for part in parts))
    require(isinstance(value, dict) and set(value) == {'transcript'}
            and isinstance(value['transcript'], str) and len(value['transcript']) <= 50000,
            'Invalid Pro transcript schema.')
    return value['transcript']


def private_path(source, relative):
    require(isinstance(relative, str) and not Path(relative).is_absolute(), 'Relative Pro evidence path required.')
    path = (source / relative).resolve()
    require((source / FOLDER).resolve() in path.parents, 'Pro evidence path escaped its namespace.')
    return path


def frozen_inputs(run, source, rows):
    """Validate a submitted freeze without requiring unrelated clips current."""
    info = core.read_json(run / 'prepared.json')
    snapshot = core.read_json(run / 'audio-snapshot.private.json')
    payload = (run / 'requests.jsonl').read_bytes()
    require(info.get('bank') == 'independent-story-pro-asr' and info.get('model') == MODEL
            and info.get('input_sha256') == core.digest(payload) and info.get('input_bytes') == len(payload)
            and info.get('snapshot_sha256') == core.digest((run / 'audio-snapshot.private.json').read_bytes()),
            'Frozen Pro payload/snapshot changed.')
    require(snapshot.get('source_run') == str(source) and snapshot.get('model') == MODEL
            and snapshot.get('prompt') == PROMPT and snapshot.get('prompt_sha256') == text_hash(PROMPT)
            and snapshot.get('source_tts_prepared_sha256') == core.digest((source / 'prepared.json').read_bytes())
            and snapshot.get('source_manifest_sha256') == core.digest((source / 'lines.private.json').read_bytes()),
            'Pro submitted source/prompt differs from original TTS freeze.')
    inputs = [json.loads(line) for line in payload.splitlines() if line.strip()]
    require(bool(inputs) and info.get('request_count') == len(inputs)
            and [item['key'] for item in inputs] == [entry['id'] for entry in snapshot['clips']]
            and len({item['key'] for item in inputs}) == len(inputs), 'Pro submitted input IDs/count differ.')
    for item, entry in zip(inputs, snapshot['clips']):
        audio = base64.b64decode(item['request']['contents'][0]['parts'][1]['inlineData']['data'], validate=True)
        require(entry['id'] in rows and entry.get('source_text_sha256') == text_hash(rows[entry['id']]['text'])
                and entry.get('clip_sha256') == core.digest(audio) == entry.get('source_audio_sha256')
                and item['request'] == request_for(audio) and entry.get('request_sha256') == object_hash(item['request']),
                'Pro submitted request/audio/source contract differs.')
    return info, inputs


def cached_record(record, clip_hash, source_hash):
    """Validate raw request/response/scope and the current TTS source freeze."""
    if transport.MODEL != MODEL or transport.FOLDER_NAME != FOLDER:
        with backend():
            return _cached_record(record, clip_hash, source_hash)
    return _cached_record(record, clip_hash, source_hash)


def _cached_record(record, clip_hash, source_hash):
    try:
        require(isinstance(record, dict), 'Invalid Pro cache record.')
        require(all(record.get(key) == clip_hash for key in ['clip_sha256', 'source_audio_sha256', 'upload_sha256'])
                and record.get('source_text_sha256') == source_hash and record.get('input_mime_type') == 'audio/mpeg'
                and record.get('model') == MODEL and record.get('prompt') == PROMPT
                and all(record.get(key) == value for key, value in metadata().items()), 'Pro cache method/audio/source mismatch.')
        source = Path(record['source_run']).resolve()
        run = private_path(source, record['batch_scope_file']).parent
        require(record['batch_scope_file'] == str((run / 'pro-scope.private.json').relative_to(source)), 'Invalid Pro scope file.')
        require(record.get('scope_sha256') == core.digest((run / 'pro-scope.private.json').read_bytes())
                and record.get('prepared_sha256') == core.digest((run / 'prepared.json').read_bytes())
                and record.get('snapshot_sha256') == core.digest((run / 'audio-snapshot.private.json').read_bytes()), 'Pro frozen scope changed.')
        rows = transport.source_rows(source)
        require(record['id'] in rows, 'Unknown Pro cache source ID.')
        audio, sha, textsha = transport.current_audio(source, rows[record['id']])
        require(sha == clip_hash and textsha == source_hash, 'Current Pro source/audio changed.')
        validate_scope(run)
        info, inputs = frozen_inputs(run, source, rows)
        intent = core.read_json(run / 'submit-intent.private.json')
        journal = core.read_json(run / 'job.json')
        require(intent.get('model') == MODEL and intent.get('input_sha256') == info['input_sha256']
                and intent.get('request_count') == info['request_count']
                and journal.get('model') == MODEL and journal.get('request_count') == info['request_count']
                and isinstance(journal.get('job_name'), str) and journal['job_name'].startswith('batches/'),
                'Pro response lacks a bound prior submission intent/journal.')
        ledger = core.read_json(source / FOLDER / 'batch-reservations.private.json')
        reservation_key = record['id'] + ':' + clip_hash + ':' + text_hash(PROMPT) + ':' + MODEL
        require(isinstance(ledger.get(reservation_key), dict)
                and ledger[reservation_key].get('run') == str(run), 'Pro paid request reservation mismatch.')
        matches = [item for item in inputs if item['key'] == record['id']]
        require(len(matches) == 1 and matches[0]['request'] == request_for(audio)
                and record.get('request_sha256') == object_hash(matches[0]['request']), 'Pro cached raw request differs.')
        path = private_path(source, record['batch_response_file'])
        require(record.get('batch_response_sha256') == core.digest(path.read_bytes()), 'Pro raw responses changed.')
        raw = [json.loads(line) for line in path.read_bytes().splitlines() if line.strip()] if path.suffix == '.jsonl' else core.read_json(path)
        matches = [item for item in raw if (item.get('key') or item.get('metadata', {}).get('key')) == record['id']]
        require(len(matches) == 1 and not matches[0].get('error') and not matches[0].get('status')
                and matches[0].get('response') == record.get('response'), 'Pro raw keyed response mismatch.')
        require(response_transcript(record['response']) == record.get('transcript')
                and record.get('listening_verdict') is None and record.get('provider_timestamps_used') is False,
                'Pro transcript/approval was altered.')
        return True
    except (core.SafeError, OSError, ValueError, TypeError, KeyError, AttributeError):
        return False


@contextmanager
def backend():
    replacements = {'asr': SimpleNamespace(MODEL=MODEL, PROMPT=PROMPT, text_hash=text_hash,
        request_for=request_for, response_transcript=response_transcript, cached_record=cached_record),
        'MODEL': MODEL, 'FOLDER_NAME': FOLDER, 'BANK_NAME': 'independent-story-pro-asr',
        'DISPLAY_PREFIX': 'selantis-story-pro-asr-', 'NOTE': NOTE}
    originals = {key: getattr(transport, key) for key in replacements}
    try:
        for key, value in replacements.items(): setattr(transport, key, value)
        yield
    finally:
        for key, value in originals.items(): setattr(transport, key, value)


def validate_scope(run):
    scope = core.read_json(run / 'pro-scope.private.json')
    require(core.read_json(run / 'pro-prepared.private.json').get('scope_sha256')
            == core.digest((run / 'pro-scope.private.json').read_bytes()), 'Pro scope changed after freeze.')
    require(scope.get('model') == MODEL and scope.get('metadata') == metadata()
            and type(scope.get('max_calls')) is int and 1 <= scope['max_calls'] <= 150,
            'Pro model/request contract/call bound changed.')
    ids = scope.get('selected_ids')
    require(isinstance(ids, list) and bool(ids) and len(ids) == len(set(ids)) and len(ids) <= scope['max_calls'],
            'Invalid frozen Pro scope IDs.')
    snapshot = core.read_json(run / 'audio-snapshot.private.json')
    require(set(entry['id'] for entry in snapshot['clips']) <= set(ids)
            and len(snapshot['clips']) <= scope['max_calls']
            and set(snapshot.get('cached_ids', [])) <= set(ids)
            and set(entry['id'] for entry in snapshot['clips']) | set(snapshot.get('cached_ids', [])) == set(ids),
            'Pro frozen request/cached IDs exceed explicit selection.')
    return scope


def prepare(args, source, folder, run, rows):
    ids = args.only_ids.split(',') if args.only_ids else []
    require(type(args.max_calls) is int and 1 <= args.max_calls <= 150 and bool(ids)
            and len(ids) == len(set(ids)) and set(ids) <= set(rows) and len(ids) <= args.max_calls,
            'Select unique known Pro IDs within explicit max-calls (1..150).')
    require(not (run / 'pro-scope.private.json').exists(), 'Pro scope already frozen.')
    transport.prepare(args, source, folder, run, rows)
    core.save(run / 'pro-scope.private.json', {'model': MODEL, 'metadata': metadata(),
                                             'selected_ids': ids, 'max_calls': args.max_calls})
    core.save(run / 'pro-prepared.private.json', {'scope_sha256': core.digest((run / 'pro-scope.private.json').read_bytes())})
    validate_scope(run)


def collect(args, source, folder, run, rows):
    require(not (run / 'collection.private.json').exists(), 'Pro Batch already collected; use merge without rewriting raw evidence.')
    validate_scope(run)
    info = transport.prepared(run, source, rows)
    key = core.credential(args)
    result, state = core.fetch_status(args, run, key)
    require(state == 'JOB_STATE_SUCCEEDED', 'Pro Batch must succeed fully before collection.')
    filename, records = transport.response_records(result)
    path = run / ('responses.private.jsonl' if filename else 'responses.private.json')
    if filename:
        raw, _headers = core.api('GET', core.BASE + '/download/v1beta/' + filename + ':download?alt=media', key, raw=True)
        path.write_bytes(raw); os.chmod(path, 0o600)
        records = [json.loads(line) for line in raw.splitlines() if line.strip()]
    else: core.save(path, records)
    expected = {entry['id']: entry for entry in core.read_json(run / 'audio-snapshot.private.json')['clips']}
    identities = [item.get('key') or item.get('metadata', {}).get('key') for item in records]
    require(len(identities) == len(set(identities)) and set(identities) == set(expected), 'Pro response IDs duplicate/missing/unexpected.')
    accepted, failures = [], []
    for item, ident in zip(records, identities):
        try:
            require(isinstance(item.get('response'), dict) and not item.get('error') and not item.get('status'), 'Pro provider error.')
            transcript = response_transcript(item['response'])
            entry = expected[ident]
            record = {'id': ident, 'source_run': str(source), 'clip_sha256': entry['clip_sha256'],
                'source_audio_sha256': entry['clip_sha256'], 'upload_sha256': entry['clip_sha256'],
                'source_text_sha256': entry['source_text_sha256'], 'input_mime_type': 'audio/mpeg',
                'model': MODEL, 'prompt': PROMPT, 'transcript': transcript, 'response': item['response'],
                'request_sha256': entry['request_sha256'], 'listening_verdict': None, 'provider_timestamps_used': False,
                'batch_scope_file': str((run / 'pro-scope.private.json').relative_to(source)),
                'scope_sha256': core.digest((run / 'pro-scope.private.json').read_bytes()),
                'prepared_sha256': core.digest((run / 'prepared.json').read_bytes()),
                'snapshot_sha256': core.digest((run / 'audio-snapshot.private.json').read_bytes()),
                'batch_response_file': str(path.relative_to(source)), 'batch_response_sha256': core.digest(path.read_bytes()), **metadata()}
            require(cached_record(record, entry['clip_sha256'], entry['source_text_sha256']), 'Pro raw cache provenance rejected.')
            accepted.append(record)
        except (core.SafeError, ValueError, TypeError, KeyError):
            failures.append({'id': ident, 'reason': 'provider_or_model_schema_provenance_rejected'})
    transport.prepared(run, source, transport.source_rows(source))
    for record in accepted:
        target = transport.cache_path(folder, record['id'], record['clip_sha256'])
        require(not target.exists() or core.read_json(target) == record, 'Existing Pro cache conflicts; raw retained.')
        if not target.exists(): core.save(target, record)
    count = transport.merge_current_cache(source, folder, rows)
    core.save(run / 'collection.private.json', {'model': MODEL, 'collected': len(accepted),
        'expected': info['request_count'], 'merged_current_records': count, 'failures': failures})
    print(json.dumps({'state': 'PRO_ASR_COLLECTED' if not failures else 'PRO_ASR_INCOMPLETE',
                      'collected': len(accepted), 'expected': info['request_count'], 'failed': len(failures)}))
    return 0 if not failures else 1


def main():
    os.umask(0o077); transport.common.configure()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'submit', 'status', 'collect', 'reconcile', 'merge'])
    parser.add_argument('--run-dir', required=True); parser.add_argument('--batch-name', required=True)
    parser.add_argument('--only-ids'); parser.add_argument('--max-calls', type=int)
    parser.add_argument('--key-stdin', action='store_true')
    args = parser.parse_args()
    args.keychain_service = None; args.keychain_account = None
    if args.command == 'prepare' and (not args.only_ids or args.max_calls is None): parser.error('prepare requires only-ids/max-calls')
    if args.command != 'prepare' and (args.only_ids or args.max_calls is not None): parser.error('IDs/max-calls are frozen at prepare')
    if args.command in {'submit', 'status', 'collect', 'reconcile'} and not args.key_stdin: parser.error('Network commands require key-stdin')
    with backend():
        source = core.directory(args.run_dir); rows = transport.source_rows(source)
        folder, run = transport.locations(source, args.batch_name); _lock = transport.common.run_lock(run)
        if args.command == 'prepare': prepare(args, source, folder, run, rows); return 0
        if args.command == 'merge':
            count = transport.merge_current_cache(source, folder, rows)
            print(json.dumps({'state': 'PRO_ASR_MERGED', 'current_records': count})); return 0
        validate_scope(run); transport.prepared(run, source, rows)
        if args.command == 'submit': transport.submit(args, source, run, rows); return 0
        if args.command == 'status': core.status(args, run); return 0
        if args.command == 'reconcile':
            original = transport.common.prepared
            try:
                transport.common.prepared = lambda target: transport.prepared(target, source, rows)
                transport.common.reconcile(args, run)
            finally: transport.common.prepared = original
            return 0
        return collect(args, source, folder, run, rows)


if __name__ == '__main__':
    try: raise SystemExit(main())
    except (core.SafeError, OSError, ValueError, TypeError, KeyError, AttributeError):
        print('Pro Batch ASR failed; private raw results retained. No automatic retry.', file=sys.stderr)
        raise SystemExit(1)
