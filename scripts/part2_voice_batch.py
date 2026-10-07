#!/usr/bin/env python3
"""Isolated Teil-II Batch transport. Preparation is offline; credentials arrive on stdin.

Existing Story/Prolog drivers remain unchanged. A submit intent and a global
request reservation are written before networking. Ambiguous outcomes never
authorize a second submission. All provider response bytes are retained before
JSON parsing; collection is attempted once and can be resumed from those bytes.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, HTTPRedirectHandler, build_opener
import uuid
import prolog_voice_batch as core
import story_voice_common as common

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT/'output/audio/part2-voice'
PUBLIC = ROOT/'game/public/audio/teil-2'
ID = re.compile(r'part2-[0-9a-f]{24}\Z')
VERSION = 'part2-frozen-batch-v1'
KINDS = {'say', 'think', 'narrate', 'bark', 'choice'}
SafeError = core.SafeError


def require(condition, message):
    if not condition:
        raise SafeError(message)


def sha(value):
    return hashlib.sha256(value).hexdigest()


def digest(path):
    return sha(Path(path).read_bytes())


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def read(path):
    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, 'Duplicate JSON key in Teil-II artifact.')
            result[key] = value
        return result
    return json.loads(Path(path).read_text(), object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(SafeError('Nonfinite JSON value.')))


def contained(base, name):
    candidate = Path(name)
    require(not candidate.is_absolute() and '..' not in candidate.parts, 'Unsafe relative artifact path.')
    path = base/candidate
    require(base.resolve() in path.resolve().parents and not path.is_symlink(), 'Artifact escapes its bank.')
    return path


def directory(value):
    path = Path(value).expanduser().resolve()
    require(PRIVATE.resolve() in path.parents, 'Run must be below output/audio/part2-voice/.')
    path.mkdir(parents=True, exist_ok=True)
    os.chmod(path, 0o700)
    return path


def validate(profiles, manifest, live=False):
    require(manifest.get('model') == core.MODEL, 'Teil-II requires the fixed Gemini model.')
    require(not manifest.get('unresolved') and not manifest.get('unresolved_count', 0)
            and not manifest.get('diagnostics', {}).get('unresolved'), 'Unresolved Teil-II Sources block production.')
    speakers, lines = profiles.get('speakers'), manifest.get('lines')
    require(isinstance(speakers, dict) and isinstance(lines, list) and lines, 'Nonempty inventory and fixed cast required.')
    keys = set()
    for row in lines:
        ident = row.get('id')
        require(isinstance(ident, str) and ID.fullmatch(ident) and ident not in keys, 'Invalid or duplicate Teil-II ID.')
        keys.add(ident)
        require(row.get('kind') in KINDS, 'Unknown voiced Source kind.')
        require(all(isinstance(row.get(k), str) and row[k].strip()
                    for k in ['speaker', 'text', 'display_text', 'scene', 'direction_en']), 'Incomplete Source row.')
        require('${' not in row['text'] and '{dynamic:' not in row['text']
                and len(row['text']) <= 10000 and len(re.findall(r'\w+', row['text'])) <= 800,
                'Unresolved or oversized Source text.')
        require(len(row['direction_en']) <= 300 and '\n' not in row['direction_en'], 'Style must be one short line.')
        profile = speakers.get(row['speaker'], {})
        require(isinstance(profile.get('google_voice'), str) and profile['google_voice'].strip(), 'Fixed voice missing.')
        sources = row.get('sources')
        require(isinstance(sources, list) and sources and all(isinstance(s, dict) for s in sources), 'Source spans missing.')
        routes = row.get('runtime_keys')
        require(isinstance(routes, list) and routes, 'Every Source needs explicit runtime routes.')
        for route in routes:
            require(set(route) <= {'kind', 'speaker', 'text', 'scene', 'mood', 'performance_variant'}
                    and all(isinstance(route.get(k), str) and route[k] for k in ['kind', 'speaker', 'text', 'scene'])
                    and ('performance_variant' not in route or isinstance(route['performance_variant'], str) and bool(route['performance_variant']))
                    and route['kind'] == row['kind'] and route['scene'].startswith('e2-'), 'Invalid scoped Teil-II runtime route.')
    expected = [{**route, 'asset_id': row['id']} for row in lines for route in row['runtime_keys']]
    lookup = manifest.get('runtime_lookup')
    require(isinstance(lookup, list) and sorted(map(canonical, lookup)) == sorted(map(canonical, expected)),
            'Complete inventory/runtime lookup differs.')
    require(len(expected) == len(set(map(canonical, expected))), 'Duplicate authored runtime route.')
    seen = {}
    for route in lookup:
        key = canonical({k: v for k, v in route.items() if k != 'asset_id'})
        require(key not in seen or seen[key] == route['asset_id'], 'Conflicting scoped runtime routes.')
        seen[key] = route['asset_id']
    for field in ['aliases', 'scene_players']:
        require(isinstance(manifest.get(field), dict)
                and all(isinstance(k, str) and isinstance(v, str) for k, v in manifest[field].items()), 'Invalid speaker routing.')
    hashes = manifest.get('source_hashes')
    require(isinstance(hashes, dict) and hashes, 'Complete Source hashes missing.')
    for name, value in hashes.items():
        path = contained(ROOT, name)
        require(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value), 'Invalid Source hash.')
        if live:
            require(path.is_file() and digest(path) == value, 'Current Source changed: ' + name)
    return speakers, lines


def current_inventory(manifest_path):
    script = ROOT/'scripts/part2_voice_inventory.mjs'
    require(script.is_file(), 'Teil-II AST scanner missing.')
    with tempfile.TemporaryDirectory(prefix='selantis-part2-census-') as temp:
        path = Path(temp)/'actual.json'
        result = subprocess.run(['node', str(script), '--propose', '--output', str(path)], cwd=ROOT,
                                capture_output=True, text=True)
        require(result.returncode == 0 and path.is_file(), 'Actual Teil-II AST census failed.')
        actual = read(path)
    expected = read(manifest_path)
    # Generated timestamps/audit prose may differ. All production identities,
    # whole Sources, styles, routing and the complete hash inventory must match.
    fields = ['model', 'lines', 'runtime_lookup', 'source_hashes', 'aliases', 'scene_players', 'unresolved']
    require(all(actual.get(k) == expected.get(k) for k in fields), 'Reviewed inventory differs from actual complete AST census.')
    return digest(script)


def preserved_banks(root):
    result = {}
    for bank, minimum in [('prolog', 188), ('story', 1490)]:
        folder = root/'game/public/audio'/bank
        require(folder.is_dir() and not folder.is_symlink(), 'Existing '+bank+' bank must be preserved, not recreated.')
        manifest = read(folder/'manifest.json')
        clips = manifest.get('clips')
        require(isinstance(clips, list) and (len(clips) == minimum if bank == 'prolog' else len(clips) >= minimum),
                'Existing '+bank+' recording census differs/missing.')
        files = {}
        for path in folder.rglob('*'):
            require(not path.is_symlink(), 'Symlink in preserved '+bank+' bank.')
            if path.is_file():
                files[str(path.relative_to(folder))] = digest(path)
        for clip in clips:
            audio = clip.get('audio')
            require(isinstance(audio, str) and audio.startswith('audio/'+bank+'/'), 'Invalid preserved audio path.')
            relative = audio[len('audio/'+bank+'/'):]
            path = contained(folder, relative)
            require(path.is_file() and files.get(relative) == clip.get('sha256'), 'Preserved clip actual bytes differ.')
        result[bank] = {'clip_count': len(clips), 'manifest_sha256': digest(folder/'manifest.json'), 'files_sha256': files}
    return result


def request_for(row, cast):
    return common.request_for(row, cast)


def prepare(args, run):
    require(not any((run/name).exists() for name in ['prepared.json', 'job.json', 'submit-intent.private.json']),
            'Run is already frozen; choose a new directory.')
    profiles, manifest = read(args.profiles), read(args.manifest)
    cast, lines = validate(profiles, manifest, live=True)
    scanner_hash = current_inventory(args.manifest)
    records = [{'key': row['id'], 'request': request_for(row, cast)} for row in lines]
    payload = ''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in records).encode()
    snapshot = {name: {'sha256': value, 'text': contained(ROOT, name).read_bytes().decode('utf-8')}
                for name, value in manifest['source_hashes'].items()}
    for name, value in [('profiles.private.json', profiles), ('lines.private.json', manifest),
                        ('source-snapshot.private.json', snapshot), ('preserved-banks.private.json', preserved_banks(ROOT))]:
        core.save(run/name, value)
    (run/'requests.jsonl').write_bytes(payload)
    os.chmod(run/'requests.jsonl', 0o600)
    validate(profiles, manifest, live=True)
    info = {'version': VERSION, 'bank': 'teil-2', 'model': core.MODEL, 'request_count': len(lines),
            'input_bytes': len(payload), 'input_sha256': sha(payload), 'scanner_sha256': scanner_hash,
            'profiles_sha256': digest(run/'profiles.private.json'), 'manifest_sha256': digest(run/'lines.private.json'),
            'source_snapshot_sha256': digest(run/'source-snapshot.private.json'),
            'preserved_banks_sha256': digest(run/'preserved-banks.private.json'),
            'driver_sha256': {'scripts/'+Path(path).name: digest(path)
                              for path in [__file__, core.__file__, common.__file__]}, 'created_at': int(time.time())}
    core.save(run/'prepared.json', info)
    core.save(run/'estimated-units.private.json', common.estimate(manifest, records))
    print(json.dumps({'state': 'PREPARED', 'bank': 'teil-2', 'requests': len(lines), 'submission_approved': False}))


def prepared(run, live=False):
    info = read(run/'prepared.json')
    profiles, manifest = read(run/'profiles.private.json'), read(run/'lines.private.json')
    cast, lines = validate(profiles, manifest, live=live)
    require(info.get('version') == VERSION and info.get('bank') == 'teil-2' and info.get('model') == core.MODEL,
            'Wrong frozen bank/model/version.')
    for name, field in [('requests.jsonl', 'input_sha256'), ('profiles.private.json', 'profiles_sha256'),
                        ('lines.private.json', 'manifest_sha256'), ('source-snapshot.private.json', 'source_snapshot_sha256')]:
        require(digest(run/name) == info.get(field), 'Frozen production bytes changed: ' + name)
    require(digest(run/'preserved-banks.private.json') == info.get('preserved_banks_sha256'), 'Preserved-bank baseline changed.')
    require(isinstance(info.get('driver_sha256'), dict) and info['driver_sha256']
            and all(digest(contained(ROOT, name)) == value for name, value in info['driver_sha256'].items()),
            'Frozen transport/helper code changed.')
    payload = (run/'requests.jsonl').read_bytes()
    records = [json.loads(line) for line in payload.splitlines() if line.strip()]
    require(records == [{'key': row['id'], 'request': request_for(row, cast)} for row in lines]
            and info.get('request_count') == len(lines) and info.get('input_bytes') == len(payload), 'Frozen requests differ.')
    snapshot = read(run/'source-snapshot.private.json')
    require(set(snapshot) == set(manifest['source_hashes']), 'Incomplete frozen Source archive.')
    for name, entry in snapshot.items():
        require(entry.get('sha256') == manifest['source_hashes'][name] == sha(entry['text'].encode()), 'Archived Source changed.')
    if live:
        require(info['scanner_sha256'] == current_inventory(run/'lines.private.json'), 'AST scanner changed after prepare.')
    return info


def approval(args, run):
    require(args.approval is not None, 'Submit requires a concrete Root hash approval.')
    value = read(args.approval)
    info = prepared(run, live=True)
    require(value.get('status') == 'approved_part2_batch_submission' and value.get('reviewed_by') == 'root'
            and value.get('prepared_sha256') == digest(run/'prepared.json')
            and all(value.get(k) == info[k] for k in ['model', 'input_sha256', 'profiles_sha256', 'manifest_sha256', 'request_count'])
            and value.get('source_cast_and_regie_reviewed') is True,
            'Root approval does not bind the current exact batch/cast/regie.')
    return value


def reserve(run):
    """Cross-bank exact-request duplication is refused, including old paid runs."""
    audio_root = ROOT/'output/audio'
    audio_root.mkdir(parents=True, exist_ok=True)
    ledger = audio_root/'voice-request-reservations.private.json'
    with (audio_root/'voice-request-reservations.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        values = read(ledger) if ledger.exists() else {}
        incoming = [json.loads(line) for line in (run/'requests.jsonl').read_text().splitlines() if line.strip()]
        hashes = [sha(canonical(row['request']).encode()) for row in incoming]
        require(len(hashes) == len(set(hashes)), 'Identical requests within this batch; reuse instead of double paying.')
        for path in audio_root.rglob('requests.jsonl'):
            previous = path.parent
            if previous.resolve() == run.resolve() or not any((previous/p).exists() for p in
                    ['job.json', 'submit-intent.private.json', 'generation.private.json', 'collection.private.json']):
                continue
            for line in path.read_text().splitlines():
                if not line.strip():
                    continue
                record = json.loads(line)
                value = sha(canonical(record['request']).encode())
                require(value not in hashes, 'Exact request already paid/reserved in another bank; duplicate refused.')
        for value in hashes:
            require(value not in values or values[value].get('run') == str(run), 'Exact request reserved by another run.')
        for row, value in zip(incoming, hashes):
            values[value] = {'run': str(run), 'id': row['key'], 'reserved_at': int(time.time()), 'backend': 'batch'}
        core.save(ledger, values)


class RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        # Never send x-goog-api-key, upload tokens or response bytes to a second
        # request destination, even if a provider or intermediary redirects.
        return None


def provider_open(request, timeout):
    return build_opener(RejectRedirect()).open(request, timeout=timeout)


def response_api(run, original):
    """Retain success/error response bodies before parsing, with no retry.

    The existing transport's error handler discards HTTP bodies. This small
    isolated boundary keeps them private without changing that protected driver.
    Upload locations stay in RAM and are not copied into diagnostic receipts.
    """
    def api(method, url, key, body=None, headers=None, raw=False):
        require(urlparse(url).scheme == 'https' and urlparse(url).hostname == 'generativelanguage.googleapis.com',
                'Unexpected provider host.')
        response_dir = run/'http-raw'
        response_dir.mkdir(exist_ok=True)
        token = uuid.uuid4().hex
        intent_path = response_dir/(token+'.intent.private.json')
        core.save(intent_path, {'method': method, 'created_at': int(time.time()), 'state': 'ATTEMPT_RECORDED'})
        request_headers = {'x-goog-api-key': key, **(headers or {})}
        if isinstance(body, dict):
            body = json.dumps(body).encode()
            request_headers.setdefault('Content-Type', 'application/json')
        status = 200
        try:
            with provider_open(Request(url, data=body, headers=request_headers, method=method), timeout=180) as response:
                data, received_headers, status = response.read(), dict(response.headers.items()), response.status
        except HTTPError as error:
            data, received_headers, status = error.read(), dict(error.headers.items()), error.code
        except (URLError, TimeoutError, OSError):
            core.save(response_dir/(token+'.failure.private.json'), {'state': 'OUTCOME_UNCONFIRMED'})
            raise SafeError('Provider transport failed; outcome may be unknown. No automatic retry.') from None
        raw_path = response_dir/(token+'.response.private.bin')
        with raw_path.open('xb') as stream:
            os.chmod(raw_path, 0o600)
            stream.write(data)
        core.save(response_dir/(token+'.receipt.private.json'), {'state': 'RESPONSE_RETAINED',
                  'sha256': sha(data), 'bytes': len(data), 'method': method, 'http_status': status})
        require(200 <= status < 300, 'Provider HTTP failure; raw private response retained. No retry.')
        if raw:
            return data, received_headers
        try:
            return json.loads(data) if data.strip() else {}
        except ValueError:
            raise SafeError('Provider JSON invalid; exact private response retained. No retry.') from None
    return api


@contextmanager
def transport(run):
    old = (core.ROOT, core.PRIVATE, core.prepared, core.api, common.prepared)
    core.ROOT, core.PRIVATE, core.prepared = ROOT, PRIVATE, prepared
    common.prepared = prepared
    core.api = response_api(run, old[3])
    try:
        yield
    finally:
        core.ROOT, core.PRIVATE, core.prepared, core.api, common.prepared = old


def submit(args, run):
    require(not (run/'job.json').exists() and not (run/'submit-intent.private.json').exists(),
            'Submission already attempted; use status/reconcile, never submit again.')
    approval(args, run)
    key = core.credential(args)
    reserve(run)
    info = prepared(run)
    intent = {'display_name': 'selantis-teil-2-'+uuid.uuid4().hex, 'model': core.MODEL,
              'input_sha256': info['input_sha256'], 'request_count': info['request_count'],
              'state': 'SUBMIT_INTENT_RECORDED', 'created_at': int(time.time()), 'approval_sha256': digest(args.approval)}
    core.save(run/'submit-intent.private.json', intent)
    original_api, original_credential = core.api, core.credential
    def named_api(method, url, key, body=None, headers=None, raw=False):
        if isinstance(body, dict):
            body = copy.deepcopy(body)
            for field in ['file', 'batch']:
                if isinstance(body.get(field), dict) and 'display_name' in body[field]:
                    body[field]['display_name'] = intent['display_name']
        return original_api(method, url, key, body, headers, raw)
    try:
        core.api, core.credential = named_api, lambda _: key
        core.submit(args, run)
        intent['state'] = 'CONFIRMED'
    except (SafeError, OSError, ValueError, TypeError):
        intent['state'] = 'OUTCOME_UNCONFIRMED'
        raise
    finally:
        core.save(run/'submit-intent.private.json', intent)
        core.api, core.credential = original_api, original_credential
        key = None


def collect(args, run):
    require(not (run/'collection.private.json').exists() and not (run/'collect-intent.private.json').exists(),
            'Collection already attempted; retain original response and resume offline, never download again.')
    key = core.credential(args)
    original_credential = core.credential
    try:
        core.credential = lambda _: key
        result, state = core.fetch_status(args, run, key)
        require(state == 'JOB_STATE_SUCCEEDED', 'Batch has not succeeded; no collection attempted.')
        core.save(run/'collect-intent.private.json', {'state': 'COLLECT_ATTEMPT_RECORDED', 'created_at': int(time.time())})
        collect_result(args, run, result, allow_download=True)
    finally:
        core.credential = original_credential
        key = None


def collect_result(args, run, result, allow_download):
    original_fetch, original_api = core.fetch_status, core.api
    records = common.inline_records(result)
    saved = run/'responses.private.jsonl'
    def fetch(*_args, **_kwargs):
        bridged = copy.deepcopy(result)
        bridged.pop('dest', None)
        if isinstance(bridged.get('metadata'), dict):
            for key in ['output', 'outputConfig', 'output_config']:
                bridged['metadata'].pop(key, None)
        if records is not None or saved.exists():
            bridged['response'] = {'responsesFile': 'files/part2-offline-cache'}
        return bridged, 'JOB_STATE_SUCCEEDED'
    def api(method, url, key, body=None, headers=None, raw=False):
        if method == 'GET' and '/files/part2-offline-cache:download' in url:
            if saved.exists():
                return saved.read_bytes(), {}
            data = ''.join(json.dumps(row, ensure_ascii=False)+'\n' for row in records).encode()
            saved.write_bytes(data)
            os.chmod(saved, 0o600)
            return data, {}
        require(allow_download, 'Offline resume refuses any provider request.')
        return original_api(method, url, key, body, headers, raw)
    old_credential = core.credential
    try:
        core.fetch_status, core.api = fetch, api
        if not allow_download:
            core.credential = lambda _: 'offline-no-provider'
        args.public_dir = None
        core.collect(args, run)
    finally:
        core.fetch_status, core.api, core.credential = original_fetch, original_api, old_credential
    manifest, profiles = read(run/'lines.private.json'), read(run/'profiles.private.json')
    rows = {row['id']: row for row in manifest['lines']}
    proposal = read(run/'public-manifest.proposed.json')
    for clip in proposal['clips']:
        row = rows[clip['id']]
        clip.update(audio='audio/teil-2/'+clip['id']+'.mp3', display_text=row['display_text'],
                    runtime_keys=row['runtime_keys'], voice=profiles['speakers'][row['speaker']]['google_voice'])
        path = run/'raw'/(clip['id']+'.receipt.json')
        receipt = read(path)
        receipt.update(status='complete', backend='batch', request_sha256=sha(canonical(request_for(row, profiles['speakers'])).encode()))
        core.save(path, receipt)
    proposal['aliases'], proposal['scene_players'] = manifest['aliases'], manifest['scene_players']
    core.save(run/'public-manifest.proposed.json', proposal)
    core.save(run/'collect-intent.private.json', {'state': 'COLLECTED_ONCE', 'response_sha256': digest(saved),
              'provider_http_raw_sha256': {str(path.relative_to(run)): digest(path)
                 for path in (run/'http-raw').glob('*.response.private.bin')},
                                                 'finished_at': int(time.time())})


def parser():
    value = argparse.ArgumentParser(description=__doc__)
    value.add_argument('command', choices=['prepare', 'submit', 'status', 'reconcile', 'cancel', 'collect', 'resume-collection'])
    value.add_argument('--run-dir', required=True)
    value.add_argument('--profiles', default=str(ROOT/'docs/voice-production/teil-2/speakers.json'))
    value.add_argument('--manifest', default=str(ROOT/'docs/voice-production/teil-2/lines.json'))
    value.add_argument('--approval', type=Path)
    value.add_argument('--key-stdin', action='store_true')
    return value


def main():
    os.umask(0o077)
    args = parser().parse_args()
    args.keychain_service = args.keychain_account = args.public_dir = args.qa_report = None
    try:
        run = directory(args.run_dir)
        lock = common.run_lock(run)
        with transport(run):
            if args.command == 'prepare':
                prepare(args, run)
                return 0
            prepared(run)
            if args.command in {'submit', 'status', 'reconcile', 'cancel', 'collect'}:
                require(args.key_stdin, 'Credentials must be supplied only through --key-stdin.')
            if args.command == 'submit':
                submit(args, run)
            elif args.command == 'status':
                core.status(args, run)
            elif args.command == 'reconcile':
                common.reconcile(args, run)
            elif args.command == 'cancel':
                journal = read(run/'job.json')
                require(not journal.get('cancel_requested_at'), 'Cancellation already attempted.')
                key = core.credential(args)
                _, state = core.fetch_status(args, run, key)
                if state not in core.TERMINAL:
                    journal['cancel_requested_at'] = int(time.time())
                    core.save(run/'job.json', journal)
                    core.save(run/'cancel.private.json', core.api('POST', core.BASE+'/v1beta/'+journal['job_name']+':cancel', key, {}))
                print(json.dumps({'state': state if state in core.TERMINAL else 'CANCEL_REQUESTED'}))
            elif args.command == 'collect':
                collect(args, run)
            else:
                require((run/'collect-intent.private.json').exists() and (run/'responses.private.jsonl').is_file(),
                        'Offline resume needs the original persisted response bytes.')
                require(read(run/'collect-intent.private.json').get('state') != 'COLLECTED_ONCE', 'Collection already completed.')
                collect_result(args, run, read(run/'status.private.json'), allow_download=False)
        lock.close()
        return 0
    except (SafeError, OSError, ValueError, TypeError, KeyError):
        print('Teil-II operation refused or failed; exact private artifacts retained. No automatic API retry.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
