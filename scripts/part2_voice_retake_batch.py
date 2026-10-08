#!/usr/bin/env python3
"""Separate, style-only Teil-II retakes. The initial 1401 recordings are immutable.

preview/prepare are offline. Root approves preview/styles and then the exact
prepared submission separately. Provider credentials are accepted only on stdin.
An ambiguous submission/collection is never attempted again. Original provider
responses precede audio/model guards; only an offline resume may reuse them.
No import, parent rebuild, public export, ASR, timing or acting approval exists.
"""
from __future__ import annotations
import argparse
import base64
from contextlib import contextmanager
import copy
import fcntl
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid
import wave
import part2_voice_batch as batch

core, common = batch.core, batch.common
ROOT, PRIVATE = batch.ROOT, batch.PRIVATE
MODEL = 'gemini-3.8-flash-tts'
VERSION = 'part2-style-only-retake-batch-v1'
PARENT_COUNT = 1401
MAX_RETAKES = 8
SAFE_NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}\Z')
BASE_FILES = ['prepared.json', 'profiles.private.json', 'lines.private.json', 'requests.jsonl',
              'source-snapshot.private.json', 'preserved-banks.private.json', 'collection.private.json',
              'responses.private.jsonl', 'public-manifest.proposed.json', 'job.json', 'status.private.json',
              'submit-intent.private.json', 'collect-intent.private.json', 'qa.private.json', 'qa-asr-cache.private.json']
PROTECTED_DIRS = ['clips', 'raw', 'http-raw', 'asr-raw', 'word-cues']
FROZEN_FILES = {'lines.private.json', 'profiles.private.json', 'delivery-overrides.private.json',
                'root-style-approval.private.json', 'parent-snapshot.private.json', 'source-snapshot.private.json',
                'preserved-banks.private.json', 'preview.private.json'}
require, read, digest, sha, canonical = batch.require, batch.read, batch.digest, batch.sha, batch.canonical
SafeError = batch.SafeError


def write_once(path, data):
    path = Path(path)
    require(not path.is_symlink(), 'Symlink artifact refused.')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as stream:
        os.chmod(path, 0o600)
        stream.write(data)


def save_once(path, value):
    write_once(path, (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)+'\n').encode())


def records(path):
    # Retain raw provider bytes before this parser is used.
    result = []
    for line in Path(path).read_bytes().splitlines():
        if not line.strip(): continue
        def unique(pairs):
            value = {}
            for key, item in pairs:
                require(key not in value, 'Duplicate request/response JSON key.')
                value[key] = item
            return value
        result.append(json.loads(line, object_pairs_hook=unique, parse_constant=lambda _: (_ for _ in ()).throw(SafeError('Nonfinite JSON value.'))))
    return result


def locations(parent, name):
    parent = Path(parent).expanduser().resolve()
    require(PRIVATE.resolve() in parent.parents and parent.is_dir(), 'Existing private Teil-II parent required.')
    require(SAFE_NAME.fullmatch(name or ''), 'Invalid retake batch name.')
    run = parent/'retake-driver'/name
    for path in [parent/'retake-driver', run]:
        require(not path.is_symlink(), 'Retake directory symlink refused.')
        path.mkdir(exist_ok=True)
        os.chmod(path, 0o700)
    return parent, run


def safe_run(run):
    require(not run.is_symlink() and run.is_dir(), 'Private retake output directory required.')
    for path in run.rglob('*'):
        require(not path.is_symlink() and run.resolve() in path.resolve().parents,
                'Retake outputs contain a symlink/escape; originals must never be written through it.')


def wave_info(data):
    require(data.startswith(b'RIFF') and data[8:12] == b'WAVE', 'Original provider WAV required; no PCM wrapper is created.')
    with wave.open(io.BytesIO(data), 'rb') as audio:
        require(audio.getnchannels() == 1 and audio.getsampwidth() == 2 and audio.getframerate() == 24000
                and audio.getnframes() >= 4800 and audio.getcomptype() == 'NONE', 'Provider WAV format/duration differs.')
        frames = audio.getnframes()
        require(len(audio.readframes(frames)) == frames*2, 'Truncated original provider WAV.')
    return frames/24000


def parent_state(parent, live=False):
    info = batch.prepared(parent, live=live)
    require(info.get('request_count') == PARENT_COUNT and info.get('model') == MODEL, 'Exact initial 1401 Teil-II parent required.')
    manifest, profiles = read(parent/'lines.private.json'), read(parent/'profiles.private.json')
    rows = {row['id']: row for row in manifest['lines']}
    require(len(rows) == PARENT_COUNT, 'Complete original parent Source census differs.')
    collection = read(parent/'collection.private.json')
    require(collection.get('collected') == collection.get('expected') == PARENT_COUNT and not collection.get('failures'),
            'Initial parent collection must already be complete.')
    require(read(parent/'job.json').get('state') == 'JOB_STATE_SUCCEEDED'
            and read(parent/'collect-intent.private.json').get('state') == 'COLLECTED_ONCE'
            and read(parent/'collect-intent.private.json').get('response_sha256') == digest(parent/'responses.private.jsonl'),
            'Original successful once-only provider collection missing/stale.')
    requests = records(parent/'requests.jsonl')
    require(requests == [{'key': row['id'], 'request': batch.request_for(row, profiles['speakers'])} for row in manifest['lines']],
            'Initial complete requests/cast/Source differ.')
    request_hashes = {row['key']: sha(canonical(row['request']).encode()) for row in requests}
    bank = {}
    for ident in rows:
        wav, mp3 = parent/'raw'/(ident+'.wav'), parent/'clips'/(ident+'.mp3')
        receipt = read(parent/'raw'/(ident+'.receipt.json'))
        require(not wav.is_symlink() and not mp3.is_symlink() and mp3.is_file() and mp3.stat().st_size,
                'Original parent audio missing or unsafe.')
        require(receipt.get('status') == 'complete' and receipt.get('request_sha256') == request_hashes[ident]
                and receipt.get('wav_sha256') == digest(wav)
                and receipt.get('mp3_sha256') == digest(mp3), 'Original audio/receipt bytes differ.')
        require(receipt.get('seconds') == wave_info(wav.read_bytes()), 'Original provider duration/receipt differs.')
        bank[ident] = receipt['mp3_sha256']
    return manifest, profiles, requests, bank


def protected_parent(parent):
    paths = [parent/name for name in BASE_FILES]
    paths += list(parent.glob('qualification-*.producer.private.json'))
    for name in PROTECTED_DIRS:
        folder = parent/name
        require(folder.is_dir() and not folder.is_symlink(), 'Original protected evidence directory missing.')
        paths += [path for path in folder.rglob('*') if path.is_file()]
    require(all(path.is_file() and not path.is_symlink() for path in paths), 'Original protected evidence missing or symlinked.')
    return {str(path.relative_to(parent)): digest(path) for path in sorted(set(paths))}


def verify_protected(parent, hashes):
    require(isinstance(hashes, dict) and hashes, 'Original protection census missing.')
    for name, expected in hashes.items():
        path = batch.contained(parent, name)
        require(path.is_file() and digest(path) == expected, 'Original initial bank/evidence changed: '+name)
    current = protected_parent(parent)
    require(current == hashes, 'Initial protected evidence census changed; no inferred exception allowed.')


def load_overrides(path, selected):
    values = read(path)
    require(isinstance(values, dict) and set(values) == set(selected), 'Styles must cover exactly the selected retake IDs.')
    for value in values.values():
        require(isinstance(value, dict) and set(value) == {'delivery_style'}, 'Only speechMetadata.style may change.')
        style = value['delivery_style']
        require(isinstance(style, str) and style.strip() and len(style) <= 300 and '\n' not in style and '\r' not in style,
                'One short nonempty delivery style required.')
    return values


def changed_requests(original, selected, overrides):
    result = []
    for record in original:
        if record['key'] not in selected: continue
        value = copy.deepcopy(record)
        request = value['request']
        require(len(request.get('contents', [])) == 1 and request['contents'][0].get('role') == 'user'
                and len(request['contents'][0].get('parts', [])) == 1, 'Single original content/text part required.')
        part = request['contents'][0]['parts'][0]
        require(set(part) == {'text', 'speechMetadata'} and set(part['speechMetadata']) == {'style'}
                and isinstance(part['text'], str), 'Original Source/style schema differs.')
        require(request.get('generationConfig', {}).get('speechConfig', {}).get('languageCode') == 'de-DE', 'Fixed German locale missing.')
        style = overrides[record['key']]['delivery_style']
        require(part['speechMetadata']['style'] != style, 'Unchanged request is not a new retake.')
        part['speechMetadata']['style'] = style
        proof = copy.deepcopy(value)
        proof['request']['contents'][0]['parts'][0]['speechMetadata']['style'] = record['request']['contents'][0]['parts'][0]['speechMetadata']['style']
        require(proof == record, 'Source/config mutation outside delivery style refused.')
        result.append(value)
    require([row['key'] for row in result] == selected, 'Ordered unique retake subset differs.')
    return result


def dedup_roots():
    result = subprocess.run(['git', 'worktree', 'list', '--porcelain'], cwd=ROOT, capture_output=True, text=True)
    require(result.returncode == 0, 'Cross-worktree paid-request census unavailable.')
    roots = {ROOT.resolve()}
    for line in result.stdout.splitlines():
        if line.startswith('worktree '): roots.add(Path(line[9:]).resolve())
    return sorted(roots)


def dedup_check(run, incoming, roots=None):
    wanted = {sha(canonical(row['request']).encode()): row['key'] for row in incoming}
    require(len(wanted) == len(incoming), 'Identical requests within retakes refused.')
    legacy_hashes = set(wanted)
    for row in incoming:
        legacy_hashes.add(sha(json.dumps(row['request'], sort_keys=True).encode()))
        legacy_hashes.add(sha(json.dumps(row['request'], ensure_ascii=False, sort_keys=True).encode()))
    roots = roots or dedup_roots()
    unsubmitted = []
    for root in roots:
        audio = root/'output/audio'
        if not audio.is_dir(): continue
        ledger = audio/'voice-request-reservations.private.json'
        if ledger.exists():
            values = read(ledger)
            for key in wanted:
                require(key not in values or values[key].get('run') == str(run), 'Exact request already reserved in another bank/worktree.')
        for path in sorted(audio.rglob('requests*.jsonl')):
            if path.parent.resolve() == run.resolve(): continue
            require(not path.is_symlink(), 'Dedup request symlink refused.')
            previous = path.parent
            paid = any((previous/name).exists() for name in ['job.json', 'submit-intent.private.json', 'generation.private.json', 'collection.private.json'])
            overlaps = {row.get('key') for row in records(path) if isinstance(row, dict) and isinstance(row.get('request'), dict)
                        and sha(canonical(row['request']).encode()) in wanted}
            if overlaps:
                require(not paid, 'Exact request already paid/attempted; automatic duplicate refused.')
                unsubmitted.append({'path': str(path), 'sha256': digest(path), 'ids': sorted(overlaps), 'paid_or_attempted': False})
        # Standard-API pilots often retain the exact actual request hash in a
        # receipt rather than a second modified requests.jsonl. Historical
        # default-JSON hashes are checked alongside the canonical Batch hash.
        for path in sorted({*audio.rglob('*receipt*.json'), *audio.rglob('generation.private.json')}):
            if run.resolve() in path.resolve().parents: continue
            require(not path.is_symlink(), 'Historical paid receipt symlink refused.')
            value = read(path)
            def has_request_hash(item):
                if isinstance(item, dict):
                    return any(('request' in key and 'sha256' in key and (
                        content in legacy_hashes if isinstance(content, str) else isinstance(content, dict)
                        and any(isinstance(entry, str) and entry in legacy_hashes for entry in content.values())))
                        or has_request_hash(content) for key, content in item.items())
                if isinstance(item, list): return any(has_request_hash(entry) for entry in item)
                return False
            require(not has_request_hash(value), 'Exact actual request already appears in a paid/attempted Standard receipt.')
    return {'worktrees': list(map(str, roots)), 'unsubmitted_same_request_previews': unsubmitted}


def driver_hashes():
    return {'scripts/'+Path(path).name: digest(path) for path in [__file__, batch.__file__, core.__file__, common.__file__]}


def build_preview(args, parent, run):
    manifest, profiles, original, bank = parent_state(parent, live=True)
    ids = args.only_ids.split(',') if args.only_ids else []
    require(ids and len(ids) == len(set(ids)) and len(ids) <= MAX_RETAKES and set(ids) <= set(bank), 'Explicit unique current subset of at most eight required.')
    selected = [row['key'] for row in original if row['key'] in set(ids)]
    overrides = load_overrides(args.delivery_overrides, selected)
    incoming = changed_requests(original, selected, overrides)
    original_by_id = {record['key']: record for record in original}
    rows = {row['id']: row for row in manifest['lines']}
    return {'status': 'unapproved_part2_style_only_retake_preview', 'model': MODEL, 'parent': str(parent),
            'parent_count': PARENT_COUNT, 'parent_prepared_sha256': digest(parent/'prepared.json'),
            'parent_manifest_sha256': digest(parent/'lines.private.json'), 'profiles_sha256': digest(parent/'profiles.private.json'),
            'delivery_overrides_path': str(Path(args.delivery_overrides).resolve()), 'delivery_overrides_sha256': digest(args.delivery_overrides),
            'selected_ids': selected, 'request_count': len(selected), 'preserved_banks': batch.preserved_banks(ROOT),
            'parent_protected_file_sha256': protected_parent(parent), 'parent_mp3_sha256': bank,
            'source_hashes': manifest['source_hashes'], 'scanner_sha256': digest(ROOT/'scripts/part2_voice_inventory.mjs'),
            'new_request_sha256': {row['key']: sha(canonical(row['request']).encode()) for row in incoming},
            'original_request_sha256': {ident: sha(canonical(original_by_id[ident]['request']).encode()) for ident in selected},
            'records': incoming, 'sources': [rows[ident] for ident in selected],
            'dedup': dedup_check(run, incoming), 'driver_sha256': driver_hashes(),
            'human_or_word_or_timing_approved': False, 'paid_calls': 0, 'parent_mutations': 0}


def preview(args, parent, run):
    require(not (run/'preview.private.json').exists() and not (run/'prepared.json').exists(), 'Preview already fixed; use a new batch name.')
    value = build_preview(args, parent, run)
    save_once(run/'preview.private.json', value)
    print(json.dumps({'state': 'RETAKE_PREVIEW', 'requests': value['request_count'], 'preview_sha256': digest(run/'preview.private.json'),
                      'parent_clips': PARENT_COUNT, 'paid_calls': 0, 'approved': False}))


def style_approval(args, run, value):
    require(args.approval is not None, 'Prepare needs Root approval of the exact preview/styles.')
    approved = read(args.approval)
    fields = ['model', 'parent_prepared_sha256', 'parent_manifest_sha256', 'profiles_sha256',
              'delivery_overrides_sha256', 'selected_ids', 'new_request_sha256']
    require(approved.get('status') == 'approved_part2_retake_styles' and approved.get('reviewed_by') == 'root'
            and approved.get('preview_sha256') == digest(run/'preview.private.json')
            and approved.get('source_cast_and_regie_reviewed') is True
            and all(approved.get(key) == value[key] for key in fields), 'Root style approval does not bind this actual preview.')
    return approved


def prepare(args, parent, run):
    require(not any((run/name).exists() for name in ['prepared.json', 'job.json', 'submit-intent.private.json']), 'Retake batch already frozen/attempted.')
    value = read(run/'preview.private.json')
    # Reproduce the entire concrete Source/cast/style/protection/dedup proposal before freeze.
    require(build_preview(args, parent, run) == value, 'Preview inputs changed; no silent refreeze.')
    approved = style_approval(args, run, value)
    parent_manifest, profiles = read(parent/'lines.private.json'), read(parent/'profiles.private.json')
    manifest = copy.deepcopy(parent_manifest)
    manifest['lines'] = [row for row in manifest['lines'] if row['id'] in set(value['selected_ids'])]
    styles = load_overrides(args.delivery_overrides, value['selected_ids'])
    for row in manifest['lines']: row['direction_en'] = styles[row['id']]['delivery_style']
    manifest['runtime_lookup'] = [row for row in manifest['runtime_lookup'] if row['asset_id'] in set(value['selected_ids'])]
    batch.validate(profiles, manifest, live=True)
    for name, body in [('lines.private.json', manifest), ('profiles.private.json', profiles),
                       ('delivery-overrides.private.json', styles), ('root-style-approval.private.json', approved),
                       ('parent-snapshot.private.json', value), ('source-snapshot.private.json', read(parent/'source-snapshot.private.json')),
                       ('preserved-banks.private.json', value['preserved_banks'])]: save_once(run/name, body)
    payload = ''.join(json.dumps(row, ensure_ascii=False)+'\n' for row in value['records']).encode()
    write_once(run/'requests.jsonl', payload)
    files = ['lines.private.json', 'profiles.private.json', 'delivery-overrides.private.json', 'root-style-approval.private.json',
             'parent-snapshot.private.json', 'source-snapshot.private.json', 'preserved-banks.private.json', 'preview.private.json']
    save_once(run/'prepared.json', {'version': VERSION, 'bank': 'teil-2-retake', 'model': MODEL,
              'request_count': len(value['selected_ids']), 'parent_request_count': PARENT_COUNT,
              'selected_ids': value['selected_ids'], 'parent': str(parent), 'input_sha256': sha(payload), 'input_bytes': len(payload),
              'frozen_sha256': {name: digest(run/name) for name in files}, 'driver_sha256': driver_hashes()})
    prepared(run, parent, live=True)
    print(json.dumps({'state': 'RETAKE_PREPARED', 'requests': len(value['selected_ids']), 'input_sha256': sha(payload), 'paid_calls': 0}))


def prepared(run, parent=None, live=False):
    safe_run(run)
    info = read(run/'prepared.json')
    parent = Path(info['parent']) if parent is None else Path(parent)
    require(info.get('version') == VERSION and info.get('bank') == 'teil-2-retake' and info.get('model') == MODEL
            and info.get('parent') == str(parent) and info.get('parent_request_count') == PARENT_COUNT, 'Wrong fixed retake bank/parent/model.')
    require(set(info.get('frozen_sha256', {})) == FROZEN_FILES
            and isinstance(info.get('selected_ids'), list) and 0 < len(info['selected_ids']) <= MAX_RETAKES,
            'Complete frozen artifact census and bounded subset required.')
    for name, expected in info['frozen_sha256'].items(): require(digest(batch.contained(run, name)) == expected, 'Frozen retake artifact changed: '+name)
    require(info['driver_sha256'] == driver_hashes(), 'Frozen retake/helper code changed.')
    value = read(run/'parent-snapshot.private.json')
    require(value == read(run/'preview.private.json'), 'Retake preview/parent snapshot differ.')
    manifest, profiles, original, bank = parent_state(parent, live=live)
    require(digest(parent/'prepared.json') == value['parent_prepared_sha256']
            and digest(parent/'lines.private.json') == value['parent_manifest_sha256']
            and digest(parent/'profiles.private.json') == value['profiles_sha256'] and bank == value['parent_mp3_sha256'], 'Initial parent freeze changed.')
    verify_protected(parent, value['parent_protected_file_sha256'])
    require(batch.preserved_banks(ROOT) == value['preserved_banks'], 'Preserved 188 Prolog/1490 Story bank changed.')
    subset, cast = read(run/'lines.private.json'), read(run/'profiles.private.json')
    batch.validate(cast, subset, live=live)
    expected_manifest = copy.deepcopy(manifest)
    expected_manifest['lines'] = [row for row in expected_manifest['lines'] if row['id'] in set(value['selected_ids'])]
    expected_manifest['runtime_lookup'] = [row for row in expected_manifest['runtime_lookup'] if row['asset_id'] in set(value['selected_ids'])]
    overrides = load_overrides(run/'delivery-overrides.private.json', value['selected_ids'])
    for row in expected_manifest['lines']: row['direction_en'] = overrides[row['id']]['delivery_style']
    require(subset == expected_manifest and cast == profiles and read(run/'source-snapshot.private.json') == read(parent/'source-snapshot.private.json'),
            'Retake Source/preset/routes/archive differs from initial parent.')
    incoming = changed_requests(original, value['selected_ids'], overrides)
    payload = (run/'requests.jsonl').read_bytes()
    require(incoming == records(run/'requests.jsonl') == value['records'] and info['selected_ids'] == value['selected_ids']
            and info['request_count'] == len(incoming) and info['input_bytes'] == len(payload) and info['input_sha256'] == sha(payload), 'Frozen style-only payload differs.')
    require({row['key']: sha(canonical(row['request']).encode()) for row in incoming} == value['new_request_sha256'], 'Actual modified request hashes differ.')
    approved = read(run/'root-style-approval.private.json')
    style_approval(argparse.Namespace(approval=run/'root-style-approval.private.json'), run, value)
    return info


def submission_approval(args, run, parent):
    info = prepared(run, parent, live=True)
    require(args.approval is not None, 'Submit needs separate exact Root frozen-batch approval.')
    approved = read(args.approval)
    require(approved.get('status') == 'approved_part2_retake_batch_submission' and approved.get('reviewed_by') == 'root'
            and approved.get('prepared_sha256') == digest(run/'prepared.json') and approved.get('preview_sha256') == digest(run/'preview.private.json')
            and approved.get('source_cast_and_regie_reviewed') is True
            and all(approved.get(key) == info[key] for key in ['model', 'input_sha256', 'request_count', 'selected_ids']),
            'Root approval does not bind the exact frozen subset submission.')
    return info


def reserve(run, incoming):
    roots = dedup_roots()
    dedup_check(run, incoming, roots)
    audio = ROOT/'output/audio'
    ledger = audio/'voice-request-reservations.private.json'
    require(not ledger.is_symlink() and not (audio/'voice-request-reservations.lock').is_symlink(), 'Reservation ledger/lock symlink refused.')
    with (audio/'voice-request-reservations.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        dedup_check(run, incoming, roots)
        values = read(ledger) if ledger.exists() else {}
        for row in incoming:
            key = sha(canonical(row['request']).encode())
            require(key not in values or values[key].get('run') == str(run), 'Exact request already reserved.')
            values[key] = {'run': str(run), 'id': row['key'], 'reserved_at': int(time.time()), 'backend': 'part2-retake-batch'}
        core.save(ledger, values)


def credential(args):
    require(getattr(args, 'key_stdin', False), 'Google key must arrive only via --key-stdin.')
    value = sys.stdin.readline().strip()
    require(value and '\n' not in value and '\r' not in value, 'Nonempty single-line stdin credential required.')
    return value


@contextmanager
def transport(run, parent):
    old = (core.ROOT, core.PRIVATE, core.prepared, core.api, core.credential, common.prepared)
    core.ROOT, core.PRIVATE = ROOT, PRIVATE
    core.prepared = lambda target: prepared(target, parent)
    common.prepared = core.prepared
    core.api, core.credential = batch.response_api(run, old[3]), credential
    try: yield
    finally:
        core.ROOT, core.PRIVATE, core.prepared, core.api, core.credential, common.prepared = old


def submit(args, parent, run):
    require(not (run/'job.json').exists() and not (run/'submit-intent.private.json').exists(), 'Submission already attempted/unknown; never retry.')
    info = submission_approval(args, run, parent)
    reserve(run, records(run/'requests.jsonl'))
    intent = {'state': 'RECORDED_BEFORE_NETWORK', 'display_name': 'selantis-part2-retake-'+uuid.uuid4().hex,
              'model': MODEL, 'input_sha256': info['input_sha256'], 'request_count': info['request_count'],
              'approval_sha256': digest(args.approval), 'created_at': int(time.time())}
    save_once(run/'submit-intent.private.json', intent)
    key = credential(args)
    old_api, old_credential = core.api, core.credential
    def named(method, url, secret, body=None, headers=None, raw=False):
        if isinstance(body, dict):
            body = copy.deepcopy(body)
            for field in ['file', 'batch']:
                if isinstance(body.get(field), dict) and 'display_name' in body[field]: body[field]['display_name'] = intent['display_name']
        return old_api(method, url, secret, body, headers, raw)
    try:
        core.api, core.credential = named, lambda _: key
        core.submit(args, run)
        intent['state'] = 'CONFIRMED'
    except (SafeError, OSError, ValueError, TypeError, KeyError):
        intent['state'] = 'OUTCOME_UNCONFIRMED'
        raise
    finally:
        core.save(run/'submit-intent.private.json', intent)
        core.api, core.credential = old_api, old_credential
        key = None


def destination(result):
    metadata, response = result.get('metadata', result), result.get('response', {})
    value = result.get('dest') or metadata.get('output') or metadata.get('outputConfig') or metadata.get('output_config') or response.get('dest') or response.get('output') or response
    return value.get('fileName') or value.get('file_name') or value.get('responsesFile') or value.get('responses_file')


def persist_responses(run, result, key):
    inline = common.inline_records(result)
    if inline is not None:
        output = ''.join(json.dumps(row, ensure_ascii=False)+'\n' for row in inline).encode()
        origin = 'inline_records_derived_from_retained_provider_http_response'
    else:
        filename = destination(result)
        require(isinstance(filename, str) and re.fullmatch(r'files/[A-Za-z0-9_-]+', filename), 'Unrecognized retained Batch output destination; never redownload automatically.')
        output, _ = core.api('GET', core.BASE+'/download/v1beta/'+filename+':download?alt=media', key, raw=True)
        origin = 'original_provider_jsonl_download'
    # This precedes duplicate-ID/model/base64/WAV guards, including invalid JSON.
    write_once(run/'responses.private.jsonl', output)
    save_once(run/'response-origin.private.json', {'origin': origin, 'response_sha256': sha(output),
              'status_sha256': digest(run/'status.private.json'), 'provider_http_raw_sha256': {
                  str(path.relative_to(run)): digest(path) for path in (run/'http-raw').glob('*.response.private.bin')}})


def inspect_responses(run):
    expected = set(read(run/'prepared.json')['selected_ids'])
    result, seen = {}, set()
    for line in (run/'responses.private.jsonl').read_bytes().splitlines(keepends=True):
        if not line.strip(): continue
        record = records_from_line(line)
        ident = record.get('key') or record.get('metadata', {}).get('key')
        require(ident in expected and ident not in seen, 'Unknown/duplicate provider response ID; raw bytes retained.')
        seen.add(ident)
        body = record.get('response')
        if not isinstance(body, dict) or record.get('error') or record.get('status'): continue
        require(body.get('modelVersion') == MODEL, 'Actual response model differs; raw bytes retained before normalization.')
        candidates = body.get('candidates')
        require(isinstance(candidates, list) and len(candidates) == 1 and isinstance(candidates[0], dict),
                'Exactly one complete audio candidate required; ambiguous original response retained.')
        candidate = candidates[0]
        finish = candidate.get('finishReason', candidate.get('finish_reason'))
        require(finish == 'STOP' and all(candidate[field] == 'STOP' for field in ['finishReason', 'finish_reason'] if field in candidate),
                'Audio candidate must explicitly finish STOP; truncated/unknown original response retained.')
        blocks = [part.get('inlineData') or part.get('inline_data') for part in candidate.get('content', {}).get('parts', [])]
        audio = [block for block in blocks if isinstance(block, dict) and (block.get('mimeType') or block.get('mime_type', '')).startswith('audio/')]
        require(len(audio) == 1 and (audio[0].get('mimeType') or audio[0].get('mime_type', '')).startswith('audio/wav'), 'One actual original WAV response required; no wrapper fallback.')
        data = base64.b64decode(audio[0]['data'], validate=True)
        seconds = wave_info(data)
        wav_path = run/'raw'/(ident+'.wav')
        if wav_path.exists(): require(not wav_path.is_symlink() and wav_path.read_bytes() == data, 'Earlier retained provider WAV changed; no overwrite.')
        result[ident] = {'provider_response_sha256': sha(line), 'wav_sha256': sha(data), 'seconds': seconds,
                         'actual_provider_model': body['modelVersion'], 'id': ident}
    return result


def records_from_line(line):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate provider JSON key; raw bytes retained.')
            result[key] = value
        return result
    return json.loads(line, object_pairs_hook=unique)


def collect_offline(args, parent, run):
    prepared(run, parent)
    origin = read(run/'response-origin.private.json')
    require(digest(run/'responses.private.jsonl') == origin['response_sha256'], 'Original retained response bytes changed.')
    actual = inspect_responses(run)
    previous = (core.fetch_status, core.api, core.credential)
    def offline_api(method, url, key, body=None, headers=None, raw=False):
        require(method == 'GET' and '/files/part2-retake-offline-cache:download' in url, 'Offline resume refuses any provider call.')
        return (run/'responses.private.jsonl').read_bytes(), {}
    core.fetch_status = lambda *_args, **_kwargs: ({'response': {'responsesFile': 'files/part2-retake-offline-cache'}}, 'JOB_STATE_SUCCEEDED')
    core.api, core.credential = offline_api, lambda _: 'offline-no-provider'
    args.public_dir = None
    try: core.collect(args, run)
    finally: core.fetch_status, core.api, core.credential = previous
    value = read(run/'parent-snapshot.private.json')
    manifest, profiles = read(run/'lines.private.json'), read(run/'profiles.private.json')
    rows = {row['id']: row for row in manifest['lines']}
    proposal = read(run/'public-manifest.proposed.json')
    for clip in proposal['clips']:
        ident = clip['id']; row = rows[ident]
        receipt_path = run/'raw'/(ident+'.receipt.json'); receipt = read(receipt_path)
        require(receipt['wav_sha256'] == actual[ident]['wav_sha256'] == digest(run/'raw'/(ident+'.wav'))
                and receipt['mp3_sha256'] == digest(run/'clips'/(ident+'.mp3'))
                and receipt['seconds'] == actual[ident]['seconds'], 'Normalized retake does not bind exact actual provider WAV.')
        receipt.update(status='complete', backend='part2-retake-batch', model=MODEL,
                       actual_provider_model=actual[ident]['actual_provider_model'], request_sha256=value['new_request_sha256'][ident],
                       source_text_sha256=sha(row['text'].encode()), fixed_google_voice=profiles['speakers'][row['speaker']]['google_voice'],
                       retake_parent_mp3_sha256=value['parent_mp3_sha256'][ident], provider_response_sha256=actual[ident]['provider_response_sha256'],
                       normalization_input='original_provider_wav_no_wrapper', prepared_sha256=digest(run/'prepared.json'))
        core.save(receipt_path, receipt)
        clip.update(audio='audio/teil-2/'+ident+'.mp3', display_text=row['display_text'], runtime_keys=row['runtime_keys'],
                    voice=profiles['speakers'][row['speaker']]['google_voice'])
    proposal['aliases'], proposal['scene_players'] = manifest['aliases'], manifest['scene_players']
    core.save(run/'public-manifest.proposed.json', proposal)
    prepared(run, parent)  # All initial audio/QA/cues and 188/1490 public bytes remain intact.
    collection = read(run/'collection.private.json')
    core.save(run/'collect-intent.private.json', {'state': 'COLLECTED_ONCE', 'response_sha256': origin['response_sha256'],
              'expected': collection['expected'], 'collected': collection['collected'], 'held_failures': len(collection.get('failures', [])),
              'word_or_timing_or_human_approved': False, 'finished_at': int(time.time())})


def collect(args, parent, run):
    require(not any((run/name).exists() for name in ['collect-intent.private.json', 'collection.private.json', 'responses.private.jsonl']),
            'Collection already attempted/unknown; offline resume only, never redownload.')
    prepared(run, parent)
    key = credential(args)
    try:
        result, state = core.fetch_status(args, run, key)
        require(state == 'JOB_STATE_SUCCEEDED', 'Batch not successful yet; no collection attempted.')
        save_once(run/'collect-intent.private.json', {'state': 'COLLECT_ATTEMPT_RECORDED', 'created_at': int(time.time())})
        persist_responses(run, result, key)
    finally: key = None
    collect_offline(args, parent, run)


def resume_collection(args, parent, run):
    require((run/'collect-intent.private.json').exists() and (run/'responses.private.jsonl').is_file()
            and read(run/'collect-intent.private.json').get('state') != 'COLLECTED_ONCE', 'Only incomplete collection with original response bytes may resume offline.')
    collect_offline(args, parent, run)


def parser():
    value = argparse.ArgumentParser(description=__doc__)
    value.add_argument('command', choices=['preview', 'prepare', 'submit', 'status', 'reconcile', 'collect', 'resume-collection'])
    value.add_argument('--run-dir', required=True, help='Initial immutable 1401 parent, not the retake output directory')
    value.add_argument('--batch-name', required=True)
    value.add_argument('--only-ids')
    value.add_argument('--delivery-overrides', type=Path)
    value.add_argument('--approval', type=Path)
    value.add_argument('--key-stdin', action='store_true')
    return value


def main():
    os.umask(0o077)
    args = parser().parse_args()
    args.keychain_service = args.keychain_account = args.public_dir = None
    if args.command in {'preview', 'prepare'} and (not args.only_ids or not args.delivery_overrides): parser().error('Offline preview/prepare requires exact IDs/styles.')
    if args.command not in {'preview', 'prepare'} and (args.only_ids or args.delivery_overrides): parser().error('IDs/styles are immutable after prepare.')
    try:
        parent, run = locations(args.run_dir, args.batch_name)
        require(not (run/'operation.lock').is_symlink(), 'Operation lock symlink refused.')
        lock = common.run_lock(run)
        try:
            if args.command == 'preview': preview(args, parent, run); return 0
            if args.command == 'prepare': prepare(args, parent, run); return 0
            prepared(run, parent)
            with transport(run, parent):
                if args.command == 'submit': submit(args, parent, run)
                elif args.command == 'status': core.status(args, run)
                elif args.command == 'reconcile': common.reconcile(args, run)
                elif args.command == 'collect': collect(args, parent, run)
                else: resume_collection(args, parent, run)
        finally: lock.close()
        return 0
    except (SafeError, OSError, ValueError, TypeError, KeyError, IndexError, wave.Error, EOFError):
        print('Teil-II retake operation refused or failed; original and response artifacts retained. No automatic API retry.', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
