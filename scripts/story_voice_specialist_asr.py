#!/usr/bin/env python3
"""Bounded, unbiased VERBATIM ASR, independent of the existing QA drivers.

prepare --run-dir RUN --name NAME --only-ids IDS --max-calls N
normal  --run-dir RUN --name NAME --key-stdin
recover --run-dir RUN --name NAME       # local raw-response recovery only
merge   --run-dir RUN --name NAME       # validate/merge all current caches

Only unchanged MP3 bytes and a fixed transcription configuration reach Google.
No expected words, vocabulary, identities, timestamps or automatic retries.
"""
from __future__ import annotations
import argparse
import base64
import copy
import fcntl
import json
import os
from pathlib import Path
import re
import sys
import time
import unicodedata
import story_voice_common as common
from story_voice_common import core

MODEL = 'gemini-3.5-transcribe'
TTS_MODEL = 'gemini-3.8-flash-tts'
CONTRACT_VERSION = 2
FOLDER = 'independent-specialist-asr'
MAX_CALLS = 150
MAX_REQUEST_BYTES = 19_000_000
SAFE_NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\Z')
SOURCE_FILES = ['prepared.json', 'profiles.private.json', 'lines.private.json',
                'requests.jsonl', 'full-inventory.private.json', 'source-snapshot.private.json']
NOTE = ('Unbiased VERBATIM specialist ASR. Exact word evidence only; no timing, '
        'acting, human listening or publication approval.')


def require(condition, message):
    if not condition:
        raise core.SafeError(message)


def text_hash(text):
    return core.digest(text.encode('utf-8'))


def object_hash(value):
    return core.digest(json.dumps(value, sort_keys=True).encode('utf-8'))


def words(text):
    """Typography/case normalization only, no contractions/name equivalences."""
    require(isinstance(text, str), 'Transcript must be text.')
    text = unicodedata.normalize('NFKC', text).replace('’', "'").casefold()
    return re.findall(r"[^\W_]+(?:['-][^\W_]+)*", text)


def request_for(audio):
    require(isinstance(audio, bytes) and bool(audio), 'Nonempty MP3 bytes required.')
    request = {'contents': [{'role': 'user', 'parts': [{'inlineData': {
        'mimeType': 'audio/mp3', 'data': base64.b64encode(audio).decode('ascii')}}]}],
        'generationConfig': {'audioTranscriptionConfig': {
            'mode': 'VERBATIM', 'languageCodes': ['de-DE'],
            'wordTimestamp': False, 'diarization': False}}}
    require(len(request_bytes(request)) <= MAX_REQUEST_BYTES,
            'Audio exceeds conservative inline request bound; no upload fallback.')
    return request


def request_bytes(request):
    # These exact bytes are persisted and supplied to core.api as bytes.
    return json.dumps(request).encode('utf-8')


def response_transcript(response):
    require(isinstance(response, dict) and response.get('modelVersion') == MODEL,
            'Unexpected specialist model version.')
    require(not response.get('error') and not response.get('promptFeedback', {}).get('blockReason'),
            'Blocked/error specialist response.')
    candidates = response.get('candidates')
    require(isinstance(candidates, list) and len(candidates) == 1,
            'Exactly one specialist candidate required.')
    candidate = candidates[0]
    require(isinstance(candidate, dict) and candidate.get('finishReason') == 'STOP',
            'Incomplete specialist response.')
    content = candidate.get('content')
    require(isinstance(content, dict) and content.get('role') == 'model',
            'Specialist response must be model content.')
    parts = content.get('parts')
    require(isinstance(parts, list) and bool(parts), 'Specialist final text missing.')
    final_text = []
    for part in parts:
        require(isinstance(part, dict), 'Invalid specialist final part.')
        keys = set(part) - {'thoughtSignature'}
        if keys == {'text'}:
            require(isinstance(part['text'], str), 'Specialist text must be a string.')
            final_text.append(part['text'])
        elif keys == {'audioTranscription'}:
            transcription = part['audioTranscription']
            require(isinstance(transcription, dict) and set(transcription) == {'text'}
                    and isinstance(transcription['text'], str),
                    'Typed specialist transcript may contain text only, no timing/speaker fields.')
            final_text.append(transcription['text'])
        else:
            raise core.SafeError('Specialist response must contain final text only, no timing/tools/thoughts.')
    transcript = ''.join(final_text)
    require(bool(transcript.strip()), 'Empty specialist transcript has no word proof.')
    return transcript


def source_state(source):
    require(core.MODEL == TTS_MODEL, 'Original TTS model context required.')
    common.prepared(source)
    manifest = core.read_json(source / 'lines.private.json')
    profiles = core.read_json(source / 'profiles.private.json')
    rows = {row['id']: row for row in manifest['lines']}
    requests = {record['key']: record['request'] for record in
                [json.loads(line) for line in (source / 'requests.jsonl').read_bytes().splitlines()]}
    hashes = {name: core.digest((source / name).read_bytes()) for name in SOURCE_FILES}
    return rows, profiles, requests, hashes


def current_binding(source, ident, state):
    rows, profiles, originals, hashes = state
    require(ident in rows and common.ID.fullmatch(ident), 'Unknown recording ID.')
    row = rows[ident]
    audio = (source / 'clips' / (ident + '.mp3')).read_bytes()
    wav = (source / 'raw' / (ident + '.wav')).read_bytes()
    receipt_path = source / 'raw' / (ident + '.receipt.json')
    receipt = core.read_json(receipt_path)
    require(bool(audio) and bool(wav), 'Current source audio is empty.')
    audio_sha, wav_sha = core.digest(audio), core.digest(wav)
    require(receipt.get('id') == ident and receipt.get('status') == 'complete'
            and receipt.get('backend') in {'batch', 'standard'}
            and receipt.get('model', TTS_MODEL) == TTS_MODEL
            and receipt.get('mp3_sha256') == audio_sha and receipt.get('wav_sha256') == wav_sha,
            'Current MP3/WAV receipt does not bind a completed TTS take.')
    request = copy.deepcopy(originals[ident])
    override = receipt.get('delivery_override')
    if override is not None:
        require(isinstance(override, dict) and isinstance(override.get('parts'), list)
                and bool(override['parts']) and override.get('type') != 'explicit_vocal_events',
                'Only lexical TTS delivery receipts are supported.')
        parts = override['parts']
        require(all(isinstance(part, dict) and set(part) == {'text', 'style'}
                    and isinstance(part['text'], str) and isinstance(part['style'], str)
                    for part in parts), 'Invalid actual TTS delivery parts.')
        require(words(' '.join(part['text'] for part in parts)) == words(row['text']),
                'TTS delivery changed the frozen lexical words.')
        request['contents'] = [{'role': 'user', 'parts': [
            {'text': part['text'], 'speechMetadata': {'style': part['style']}} for part in parts]}]
    voice = request['generationConfig']['speechConfig']['voiceConfig']['voice']
    require(voice == profiles['speakers'][row['speaker']]['google_voice']
            and receipt.get('request_sha256') == object_hash(request),
            'Actual TTS request/preset differs from the frozen delivery receipt.')
    require(bool(words(row['text'])), 'This checker requires lexical source words.')
    return audio, {'id': ident, 'clip_sha256': audio_sha, 'source_audio_sha256': audio_sha,
        'source_text_sha256': text_hash(row['text']), 'source_row_sha256': object_hash(row),
        'source_files_sha256': hashes, 'tts_model': TTS_MODEL, 'google_voice': voice,
        'tts_receipt_sha256': core.digest(receipt_path.read_bytes()),
        'tts_wav_sha256': wav_sha, 'tts_request_sha256': object_hash(request),
        'asr_model': MODEL, 'contract_version': CONTRACT_VERSION,
        'driver_sha256': core.digest(Path(__file__).read_bytes())}


def locations(source, name):
    require(isinstance(name, str) and SAFE_NAME.fullmatch(name), 'Invalid private operation name.')
    folder = source / FOLDER
    run = folder / 'runs' / name
    run.mkdir(parents=True, exist_ok=True)
    os.chmod(run, 0o700)
    return folder, run


def private_path(source, relative):
    require(isinstance(relative, str) and not Path(relative).is_absolute(), 'Relative private path required.')
    path = (source / relative).resolve()
    require((source / FOLDER).resolve() in path.parents, 'Evidence path escaped specialist folder.')
    return path


def cache_path(folder, ident, binding):
    return folder / 'cache' / (ident + '.' + binding['clip_sha256'] + '.json')


def prepare(source, run, ids, max_calls):
    require(type(max_calls) is int and 1 <= max_calls <= MAX_CALLS
            and bool(ids) and len(ids) == len(set(ids)) and len(ids) <= max_calls,
            'Select unique known IDs within explicit max-calls (1..150).')
    require(not (run / 'prepared.json').exists(), 'Specialist scope already frozen.')
    state = source_state(source)
    require(set(ids).issubset(state[0]), 'Unknown recording ID in explicit specialist scope.')
    entries = []
    for ident in ids:
        audio, binding = current_binding(source, ident, state)
        payload = request_bytes(request_for(audio))
        path = run / 'requests' / (ident + '.json')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
        os.chmod(path, 0o600)
        entries.append({'binding': binding, 'request_file': str(path.relative_to(source)),
                        'request_sha256': core.digest(payload)})
    plan = {'model': MODEL, 'contract_version': CONTRACT_VERSION, 'source_run': str(source),
            'max_calls': max_calls, 'selected_ids': ids, 'entries': entries,
            'automatic_retry': False, 'provider_timestamps_used': False}
    core.save(run / 'scope.private.json', plan)
    core.save(run / 'prepared.json', {'scope_sha256': core.digest((run / 'scope.private.json').read_bytes()),
                                   'created_at': int(time.time())})
    print(json.dumps({'state': 'SPECIALIST_PREPARED', 'selected': len(ids), 'max_calls': max_calls}))


def prepared(source, run, validate_current=True, only_id=None):
    plan = core.read_json(run / 'scope.private.json')
    info = core.read_json(run / 'prepared.json')
    require(info.get('scope_sha256') == core.digest((run / 'scope.private.json').read_bytes())
            and plan.get('source_run') == str(source) and plan.get('model') == MODEL
            and plan.get('contract_version') == CONTRACT_VERSION
            and plan.get('automatic_retry') is False and plan.get('provider_timestamps_used') is False,
            'Frozen specialist scope changed.')
    ids = plan.get('selected_ids')
    require(isinstance(ids, list) and bool(ids) and len(ids) == len(set(ids))
            and type(plan.get('max_calls')) is int and len(ids) <= plan['max_calls'] <= MAX_CALLS
            and [entry['binding']['id'] for entry in plan['entries']] == ids,
            'Invalid bounded specialist scope.')
    require(only_id is None or only_id in ids, 'Own-record validation ID is outside frozen scope.')
    state = source_state(source) if validate_current else None
    for entry in plan['entries']:
        if only_id is not None and entry['binding']['id'] != only_id:
            continue
        payload = private_path(source, entry['request_file']).read_bytes()
        require(core.digest(payload) == entry['request_sha256'], 'Frozen specialist request changed.')
        if validate_current:
            audio, binding = current_binding(source, entry['binding']['id'], state)
            require(binding == entry['binding'] and payload == request_bytes(request_for(audio)),
                    'Current source/audio/delivery differs from specialist input.')
    return plan


def validate_record(source, record, state=None):
    """Revalidate all immutable evidence; returns transcript, never a timing proof."""
    require(isinstance(record, dict) and record.get('model') == MODEL
            and record.get('contract_version') == CONTRACT_VERSION,
            'Invalid specialist cache model/contract.')
    state = state or source_state(source)
    audio, binding = current_binding(source, record['id'], state)
    require(record.get('binding') == binding, 'Specialist cache source/audio/delivery is stale.')
    run = private_path(source, record['run_file']).parent
    require(record['run_file'] == str((run / 'scope.private.json').relative_to(source)),
            'Specialist cache scope path is invalid.')
    # The entire scope is SHA-bound. A record's proof needs its own exact raw
    # request, not quadratic re-reads of unrelated requests in a large scope.
    plan = prepared(source, run, validate_current=False, only_id=record['id'])
    require(record.get('scope_sha256') == core.digest((run / 'scope.private.json').read_bytes())
            and record.get('prepared_sha256') == core.digest((run / 'prepared.json').read_bytes()),
            'Cached specialist frozen scope/prepared hashes changed.')
    matches = [entry for entry in plan['entries'] if entry['binding']['id'] == record['id']]
    require(len(matches) == 1 and matches[0]['binding'] == binding, 'Cache is outside frozen scope.')
    entry = matches[0]
    request = private_path(source, entry['request_file']).read_bytes()
    require(request == request_bytes(request_for(audio)) and record.get('request_sha256') == core.digest(request),
            'Specialist raw request is biased or differs from current MP3 bytes.')
    intent_path = run / (record['id'] + '.intent.private.json')
    raw_path = run / (record['id'] + '.response.private.json')
    intent = core.read_json(intent_path)
    require(intent.get('binding') == binding and intent.get('request_sha256') == core.digest(request)
            and intent.get('automatic_retry') is False,
            'Missing bound pre-HTTP specialist intent.')
    require(record.get('raw_response_file') == str(raw_path.relative_to(source))
            and record.get('raw_response_sha256') == core.digest(raw_path.read_bytes()),
            'Raw specialist response file/hash changed.')
    transcript = response_transcript(core.read_json(raw_path))
    require(record.get('transcript') == transcript and record.get('listening_verdict') is None
            and record.get('provider_timestamps_used') is False,
            'Specialist transcript/approval was altered.')
    reservation = core.read_json(source / FOLDER / 'reservations.private.json').get(binding_key(binding, core.digest(request)))
    require(isinstance(reservation, dict) and reservation.get('run') == str(run)
            and reservation.get('binding') == binding and reservation.get('request_sha256') == core.digest(request),
            'Specialist call reservation does not bind this raw response.')
    return transcript


def exact_text_match_proof(source, record, state=None):
    """Full exact word proof or None; invalid provenance raises SafeError.

    No spelling aliases, source prompts, phoneme assumptions, contractions,
    model timestamps, acting verdicts or suppression of other QA flags.
    """
    state = state or source_state(source)
    transcript = validate_record(source, record, state)
    intent = core.read_json(private_path(source, record['run_file']).parent /
                            (record['id'] + '.intent.private.json'))
    require(intent.get('state') == 'RESPONSE_VALIDATED'
            and intent.get('raw_response_sha256') == record['raw_response_sha256'],
            'Exact word evidence requires a completed bound response intent.')
    expected = words(state[0][record['id']]['text'])
    observed = words(transcript)
    if expected != observed:
        return None
    return {'id': record['id'], 'resolution': 'specialist_verbatim_full_exact_words',
        'model': MODEL, 'contract_version': CONTRACT_VERSION, 'binding': record['binding'],
        'expected_tokens': expected, 'observed_tokens': observed,
        'transcript_sha256': text_hash(transcript), 'record_sha256': object_hash(record),
        'raw_response_sha256': record['raw_response_sha256'], 'request_sha256': record['request_sha256'],
        'provider_timestamps_used': False, 'timing_approval': None,
        'acting_approval': None, 'listening_verdict': None}


def binding_key(binding, request_sha):
    return binding['id'] + ':' + binding['clip_sha256'] + ':' + MODEL + ':' + request_sha


def reserve(folder, run, binding, request_sha):
    ledger_path = folder / 'reservations.private.json'
    with (folder / 'reservations.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ledger = core.read_json(ledger_path) if ledger_path.exists() else {}
        key = binding_key(binding, request_sha)
        require(key not in ledger or ledger[key]['run'] == str(run),
                'Specialist input already reserved elsewhere; no duplicate paid request.')
        ledger[key] = {'run': str(run), 'binding': binding, 'request_sha256': request_sha}
        core.save(ledger_path, ledger)


def merge_current_cache(source, folder):
    state = source_state(source)
    records, proofs, stale = [], [], []
    with (folder / 'comparison.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for path in sorted((folder / 'cache').glob('*.json')):
            record = core.read_json(path)
            ident = record.get('id')
            if ident not in state[0]:
                raise core.SafeError('Unknown specialist cached ID.')
            current_audio = source / 'clips' / (ident + '.mp3')
            if record.get('binding', {}).get('clip_sha256') != core.digest(current_audio.read_bytes()):
                stale.append(ident)
                continue
            proof = exact_text_match_proof(source, record, state)
            require(path == cache_path(folder, ident, record['binding']), 'Unexpected specialist cache filename.')
            records.append(record)
            if proof is not None:
                proofs.append(proof)
        require(len({record['id'] for record in records}) == len(records), 'Duplicate current specialist cache IDs.')
        core.save(folder / 'comparison.private.json', {'model': MODEL, 'contract_version': CONTRACT_VERSION,
            'records': records, 'exact_word_proofs': proofs, 'rejected_stale_ids': stale, 'note': NOTE})
    return len(records), len(proofs)


def execute(source, folder, run, allow_network=False, key_supplier=None):
    plan = prepared(source, run)
    calls = 0
    key = None
    for entry in plan['entries']:
        binding = entry['binding']
        ident = binding['id']
        target = cache_path(folder, ident, binding)
        if target.exists():
            validate_record(source, core.read_json(target))
            continue
        intent_path = run / (ident + '.intent.private.json')
        raw_path = run / (ident + '.response.private.json')
        if intent_path.exists():
            require(raw_path.exists(), 'Specialist intent has no recoverable response; outcome unknown. No retry.')
        else:
            require(not raw_path.exists(), 'Orphan specialist response requires review.')
            require(allow_network, 'Recovery cannot send a paid request.')
            require(calls < plan['max_calls'], 'Explicit specialist call bound reached.')
            if key is None:
                key = key_supplier()
            prepared(source, run)
            reserve(folder, run, binding, entry['request_sha256'])
            core.save(intent_path, {'state': 'RECORDED_BEFORE_HTTP', 'binding': binding,
                'request_sha256': entry['request_sha256'], 'created_at': int(time.time()), 'automatic_retry': False})
            payload = private_path(source, entry['request_file']).read_bytes()
            calls += 1
            raw, _headers = core.api('POST', core.BASE + '/v1beta/models/' + MODEL + ':generateContent',
                                    key, payload, {'Content-Type': 'application/json'}, raw=True)
            require(isinstance(raw, bytes) and bool(raw), 'Specialist raw response is empty.')
            raw_path.write_bytes(raw)
            os.chmod(raw_path, 0o600)
        # Retain every raw response even if schema/current source validation fails.
        transcript = response_transcript(core.read_json(raw_path))
        record = {'id': ident, 'model': MODEL, 'contract_version': CONTRACT_VERSION,
            'binding': binding, 'run_file': str((run / 'scope.private.json').relative_to(source)),
            'scope_sha256': core.digest((run / 'scope.private.json').read_bytes()),
            'prepared_sha256': core.digest((run / 'prepared.json').read_bytes()),
            'request_sha256': entry['request_sha256'],
            'raw_response_file': str(raw_path.relative_to(source)),
            'raw_response_sha256': core.digest(raw_path.read_bytes()), 'transcript': transcript,
            'provider_timestamps_used': False, 'listening_verdict': None}
        validate_record(source, record)
        core.save(target, record)
        intent = core.read_json(intent_path)
        intent.update(state='RESPONSE_VALIDATED', raw_response_sha256=record['raw_response_sha256'])
        core.save(intent_path, intent)
        merge_current_cache(source, folder)
        print(json.dumps({'id': ident, 'state': 'SPECIALIST_TRANSCRIBED', 'clip_sha256': binding['clip_sha256']}), flush=True)
    key = None
    count, exact = merge_current_cache(source, folder)
    print(json.dumps({'state': 'SPECIALIST_COMPLETE', 'calls': calls, 'current_records': count, 'exact_word_proofs': exact}))
    return 0


def main():
    os.umask(0o077)
    common.configure()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'normal', 'recover', 'merge'])
    parser.add_argument('--run-dir', required=True)
    parser.add_argument('--name', required=True)
    parser.add_argument('--only-ids')
    parser.add_argument('--max-calls', type=int)
    parser.add_argument('--key-stdin', action='store_true')
    args = parser.parse_args()
    if args.command == 'prepare' and (not args.only_ids or args.max_calls is None):
        parser.error('prepare requires unique --only-ids and explicit --max-calls')
    if args.command != 'prepare' and (args.only_ids or args.max_calls is not None):
        parser.error('IDs/max-calls are frozen at prepare; omit them when resuming')
    if args.command == 'normal' and not args.key_stdin:
        parser.error('normal requires --key-stdin; no environment/keychain fallback')
    if args.command != 'normal' and args.key_stdin:
        parser.error('Only normal needs a credential')
    source = core.directory(args.run_dir)
    folder, run = locations(source, args.name)
    _lock = common.run_lock(source)
    if args.command == 'prepare':
        prepare(source, run, args.only_ids.split(','), args.max_calls)
        return 0
    if args.command == 'merge':
        count, exact = merge_current_cache(source, folder)
        print(json.dumps({'state': 'SPECIALIST_MERGED', 'current_records': count, 'exact_word_proofs': exact}))
        return 0
    def credential():
        key = sys.stdin.readline().strip()
        require(bool(key) and '\r' not in key and '\n' not in key, 'Valid key on stdin required.')
        return key
    return execute(source, folder, run, allow_network=args.command == 'normal', key_supplier=credential)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (core.SafeError, OSError, ValueError, TypeError, KeyError, AttributeError):
        print('Specialist ASR failed; private raw results retained. No automatic retry.', file=sys.stderr)
        raise SystemExit(1)
