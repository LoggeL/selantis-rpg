#!/usr/bin/env python3
"""Resumable private Gemini TTS Batch adapter. No API request retries.

prepare --profiles profiles.json --manifest lines.json [--run-dir ...]
submit|status|collect [--key-stdin | --keychain-service SERVICE]

Profiles: {"speakers": {id: {"google_voice": str, "api_prompt_en": str}}}
Manifest: {"lines": [{"id", "speaker", "text", "kind", "direction_en"}],
           "source_hashes": {"game/src/...": "sha256"}}
Private artifacts stay under ignored output/audio/prolog-voice/.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import io
import json
import math
import shutil
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import wave

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / 'output/audio/prolog-voice'
MODEL = 'gemini-3.8-flash-tts'
BASE = 'https://generativelanguage.googleapis.com'
TERMINAL = {'JOB_STATE_SUCCEEDED', 'JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'}
def normalize_state(state):
    return 'JOB_STATE_' + state[len('BATCH_STATE_'):] if isinstance(state, str) and state.startswith('BATCH_STATE_') else state

SAFE_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\Z')

class SafeError(Exception):
    pass

def read_json(path):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        raise SafeError('Cannot read a valid JSON input or private receipt.') from None

def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    os.chmod(tmp, 0o600)
    tmp.replace(path)

def error_summary(error):
    if not isinstance(error, dict):
        return {'code': None, 'message': 'Provider did not return structured error details.'}
    message = str(error.get('message', ''))
    message = re.sub(r'AIza[A-Za-z0-9_-]+', '[REDACTED_KEY]', message)
    message = re.sub(r'(?i)Bearer\s+[A-Za-z0-9._~+/=-]+', 'Bearer [REDACTED]', message)
    message = re.sub(r'(?i)(x-goog-api-key|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+', r'\1=[REDACTED]', message)
    message = re.split(r'(?i)(?:request[_ ]?body|request[_ ]?headers|raw[_ ]?request)\s*[:=]', message)[0]
    return {'code': error.get('code'), 'status': error.get('status'), 'message': message[:2000]}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def directory(value):
    p = Path(value).expanduser().resolve()
    if p == PRIVATE or PRIVATE not in p.parents:
        raise SafeError('Run directory must be a child of output/audio/prolog-voice/.')
    p.mkdir(parents=True, exist_ok=True)
    os.chmod(p, 0o700)
    return p

def credential(args):
    if args.key_stdin:
        key = sys.stdin.readline().strip()
    elif args.keychain_service:
        cmd = ['security', 'find-generic-password', '-s', args.keychain_service]
        if args.keychain_account:
            cmd += ['-a', args.keychain_account]
        result = subprocess.run(cmd + ['-w'], capture_output=True, text=True)
        if result.returncode:
            raise SafeError('Explicit Keychain lookup failed.')
        key = result.stdout.strip()
    else:
        key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY') or ''
    if not key or '\n' in key or '\r' in key:
        raise SafeError('Provide a valid key using --key-stdin, environment, or explicit Keychain service.')
    return key

def api(method, url, key, body=None, headers=None, raw=False):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname != 'generativelanguage.googleapis.com':
        raise SafeError('Refusing an unexpected API/download host.')
    hs = {'x-goog-api-key': key, **(headers or {})}
    if isinstance(body, dict):
        body = json.dumps(body).encode()
        hs.setdefault('Content-Type', 'application/json')
    try:
        with urlopen(Request(url, data=body, headers=hs, method=method), timeout=180) as r:
            data = r.read()
            result_headers = dict(r.headers.items())
    except HTTPError as e:
        # Never print API error bodies, URLs, headers, or credentials.
        raise SafeError(f'API returned HTTP {e.code}; no automatic retry performed.') from None
    except (URLError, TimeoutError, OSError):
        raise SafeError('API transport failed; outcome may be unknown. No automatic retry performed.') from None
    if raw:
        return data, result_headers
    try:
        return json.loads(data)
    except ValueError:
        raise SafeError('API returned invalid JSON; outcome may be unknown.') from None

def validate_sources(manifest):
    hashes = manifest.get('source_hashes')
    if not isinstance(hashes, dict) or not hashes:
        raise SafeError('Manifest must contain nonempty source_hashes mapping.')
    for name, expected in hashes.items():
        p = (ROOT / name).resolve()
        if ROOT not in p.parents or not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected):
            raise SafeError('Invalid source hash entry.')
        if not p.is_file() or digest(p.read_bytes()) != expected:
            raise SafeError('Source snapshot no longer matches manifest; prepare a reviewed manifest again.')

def validate(profiles, manifest):
    validate_sources(manifest)
    cast = profiles.get('speakers')
    lines = manifest.get('lines')
    if not isinstance(cast, dict) or not isinstance(lines, list) or not lines:
        raise SafeError('Profiles need speakers and manifest needs a nonempty lines list.')
    keys = set()
    for row in lines:
        if not isinstance(row, dict):
            raise SafeError('Invalid line record.')
        ident, speaker, text = row.get('id'), row.get('speaker'), row.get('text')
        if not isinstance(ident, str) or not SAFE_ID.fullmatch(ident) or ident in keys:
            raise SafeError('Line IDs must be unique safe filenames.')
        keys.add(ident)
        if not isinstance(text, str) or not text.strip() or '{dynamic:' in text or '${' in text:
            raise SafeError('Every line needs resolved, nonempty speech text.')
        if not isinstance(row.get('kind'), str) or not isinstance(row.get('direction_en', ''), str):
            raise SafeError('Each line needs kind and an optional textual direction_en.')
        profile = cast.get(speaker)
        if not isinstance(profile, dict) or not all(isinstance(profile.get(k), str) and profile[k].strip() for k in ['google_voice', 'api_prompt_en']):
            raise SafeError('Every referenced speaker needs google_voice and api_prompt_en.')
        # Oversized requests must be split rather than silently truncated.
        if len(text) + len(profile['api_prompt_en']) + len(row.get('direction_en', '')) > 12000:
            raise SafeError('A line is too long for this conservative adapter; split it before prepare.')
    lookups = manifest.get('runtime_lookup', [])
    if not isinstance(lookups, list) or any(not isinstance(l, dict) or l.get('asset_id') not in keys or not all(isinstance(l.get(k), str) for k in ['kind', 'speaker', 'text']) for l in lookups):
        raise SafeError('Manifest runtime_lookup contains an invalid key or mapping.')
    return cast, lines

def prepare(args, run):
    if (run / 'job.json').exists():
        raise SafeError('Run already has a submit journal. Use a fresh run directory.')
    profiles, manifest = read_json(args.profiles), read_json(args.manifest)
    cast, lines = validate(profiles, manifest)
    records = []
    for row in lines:
        p = cast[row['speaker']]
        suffixes = [profiles.get(k, '') for k in ['common_prompt_en', 'sharedPromptSuffixEn', 'global_api_suffix_en']]
        pronunciation = []
        for name, guidance in profiles.get('pronunciation', {}).items():
            reading = guidance.get('german_reading') if isinstance(guidance, dict) else guidance
            if isinstance(reading, str) and re.search(r'\b' + re.escape(name) + r'\b', row['text'], re.I):
                pronunciation.append(name + ': ' + reading)
        style = '\n'.join([p['api_prompt_en'], *[x for x in suffixes if isinstance(x, str) and x],
                           *(['German name pronunciation: ' + '; '.join(pronunciation)] if pronunciation else []),
                           *(['Delivery: ' + row['direction_en']] if row.get('direction_en') else [])])
        request = {
            'contents': [{'role': 'user', 'parts': [{'text': row['text'], 'speechMetadata': {'style': style}}]}],
            'generationConfig': {
                'responseModalities': ['AUDIO'],
                'speechConfig': {'voiceConfig': {'voice': p['google_voice']}, 'languageCode': 'de-DE'},
                # Default unary output is WAV/24 kHz. The live endpoint rejects
                # explicit responseFormat.audio for this model (HTTP 400), while
                # the identical request without it succeeds with audio/wav.
            },
        }
        records.append({'key': row['id'], 'request': request})
    payload = ''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in records).encode()
    (run / 'requests.jsonl').write_bytes(payload)
    os.chmod(run / 'requests.jsonl', 0o600)
    save(run / 'profiles.private.json', profiles)
    save(run / 'lines.private.json', manifest)
    save(run / 'prepared.json', {'model': MODEL, 'request_count': len(records), 'input_bytes': len(payload),
                                'input_sha256': digest(payload), 'profiles_sha256': digest((run / 'profiles.private.json').read_bytes()),
                                'manifest_sha256': digest((run / 'lines.private.json').read_bytes()), 'created_at': int(time.time())})
    print(json.dumps({'state': 'PREPARED', 'requests': len(records), 'input_bytes': len(payload)}))

def prepared(run):
    info = read_json(run / 'prepared.json')
    validate(read_json(run / 'profiles.private.json'), read_json(run / 'lines.private.json'))
    for filename, key in [('requests.jsonl', 'input_sha256'), ('profiles.private.json', 'profiles_sha256'), ('lines.private.json', 'manifest_sha256')]:
        if digest((run / filename).read_bytes()) != info.get(key):
            raise SafeError('Prepared input changed; prepare in a fresh directory.')
    return info

def submit(args, run):
    info = prepared(run)
    journal_path = run / 'job.json'
    if journal_path.exists():
        raise SafeError('Submission journal exists. Use status/collect; an ambiguous submission must be reviewed, never resubmitted automatically.')
    key = credential(args)
    journal = {'model': MODEL, 'state': 'UPLOAD_START_ATTEMPTED', 'request_count': info['request_count'], 'started_at': int(time.time())}
    save(journal_path, journal)
    data = (run / 'requests.jsonl').read_bytes()
    _, headers = api('POST', BASE + '/upload/v1beta/files', key,
                     {'file': {'display_name': 'selantis-prolog-voice-input'}},
                     {'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
                      'X-Goog-Upload-Header-Content-Length': str(len(data)),
                      'X-Goog-Upload-Header-Content-Type': 'application/jsonl'}, raw=True)
    upload_url = next((v for k, v in headers.items() if k.lower() == 'x-goog-upload-url'), None)
    if not upload_url:
        raise SafeError('Upload start returned no upload URL. Do not resubmit automatically.')
    journal['state'] = 'UPLOAD_FINALIZE_ATTEMPTED'
    save(journal_path, journal)
    uploaded = api('POST', upload_url, key, data,
                   {'Content-Length': str(len(data)), 'Content-Type': 'application/jsonl',
                    'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize'})
    name = uploaded.get('file', {}).get('name')
    if not isinstance(name, str) or not re.fullmatch(r'files/[A-Za-z0-9_-]+', name):
        raise SafeError('Upload returned no valid file name.')
    journal.update(state='BATCH_CREATE_ATTEMPTED', input_file=name)
    save(journal_path, journal)
    result = api('POST', BASE + '/v1beta/models/' + MODEL + ':batchGenerateContent', key,
                 {'batch': {'display_name': 'selantis-prolog-voice', 'input_config': {'file_name': name}}})
    job_name = result.get('name')
    if not isinstance(job_name, str) or not re.fullmatch(r'batches/[A-Za-z0-9_.-]+', job_name):
        raise SafeError('Batch creation returned no valid job name; inspect the private journal and provider console before any resubmission.')
    journal.update(state='SUBMITTED', job_name=job_name, submitted_at=int(time.time()), creation_response=result)
    save(journal_path, journal)
    print(json.dumps({'state': 'SUBMITTED', 'requests': info['request_count'], 'target_turnaround_hours': 24}))

def fetch_status(args, run, key=None):
    journal = read_json(run / 'job.json')
    name = journal.get('job_name')
    if not isinstance(name, str) or not re.fullmatch(r'batches/[A-Za-z0-9_.-]+', name):
        raise SafeError('No confirmed job name. Submission outcome needs manual provider review; this command will not create a job.')
    result = api('GET', BASE + '/v1beta/' + name, key if key is not None else credential(args))
    save(run / 'status.private.json', result)
    # REST operation metadata holds batch state; SDK wraps this as BatchJob.
    meta = result.get('metadata', result)
    raw_state = meta.get('state', result.get('state', 'UNKNOWN'))
    state = normalize_state(raw_state)
    journal.update(state=state, raw_state=raw_state, checked_at=int(time.time()))
    save(run / 'job.json', journal)
    return result, state

def status(args, run):
    result, state = fetch_status(args, run)
    meta = result.get('metadata', result)
    print(json.dumps({'state': state, 'done': result.get('done', state in TERMINAL), 'counts': meta.get('batchStats', meta.get('batch_stats', {}))}))

def command(argv):
    try:
        result = subprocess.run(argv, capture_output=True, text=True, check=False)
    except OSError:
        raise SafeError('ffmpeg is required for audio collection.') from None
    if result.returncode:
        raise SafeError('Audio conversion or normalization failed; private inputs retained.')
    return result

def normalize(wav_path, mp3_path):
    analysis = command(['ffmpeg', '-hide_banner', '-nostats', '-i', str(wav_path), '-af',
                        'loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    match = re.search(r'\{\s*"input_i".*?\}', analysis.stderr, re.S)
    if not match:
        raise SafeError('Loudness analysis returned no measurement.')
    measured = json.loads(match.group())
    needed = ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']
    if not all(math.isfinite(float(measured[k])) for k in needed):
        raise SafeError('Audio is silent or has invalid loudness.')
    filt = ('loudnorm=I=-18:TP=-1.5:LRA=11:linear=true:'
            f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
            f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
            f"offset={measured['target_offset']}")
    temp = mp3_path.with_suffix('.tmp.mp3')
    command(['ffmpeg', '-v', 'error', '-y', '-i', str(wav_path), '-af', filt, '-ar', '24000', '-ac', '1',
             '-c:a', 'libmp3lame', '-b:a', '128k', str(temp)])
    temp.replace(mp3_path)
    return measured

def collect(args, run):
    key = credential(args)
    result, state = fetch_status(args, run, key)
    manifest = read_json(run / 'lines.private.json')
    expected = {r['id']: r for r in manifest['lines']}
    meta = result.get('metadata', result)
    response = result.get('response', {})
    # REST BatchGenerateContent returns an operation; destination location differs from SDK.
    destination = result.get('dest') or meta.get('output') or meta.get('outputConfig') or meta.get('output_config') or response.get('dest') or response.get('output') or response
    filename = destination.get('fileName') or destination.get('file_name') or destination.get('responsesFile') or destination.get('responses_file')
    if state != 'JOB_STATE_SUCCEEDED':
        diagnostic = {'state': state, 'raw_state': meta.get('state', result.get('state')),
                      'batch_stats': meta.get('batchStats', meta.get('batch_stats', {})),
                      'provider_error': error_summary(result.get('error', meta.get('error'))), 'has_response_file': bool(filename)}
        save(run / 'batch-failure.private.json', diagnostic)
        if state not in TERMINAL or not filename:
            raise SafeError('Batch is not successfully complete; private failure/status diagnosis saved. No response file available yet or batch remains active.')
    if filename:
        if not re.fullmatch(r'files/[A-Za-z0-9_-]+', filename):
            raise SafeError('Unexpected output file name.')
        output, _ = api('GET', BASE + '/download/v1beta/' + filename + ':download?alt=media', key, raw=True)
        (run / 'responses.private.jsonl').write_bytes(output)
        os.chmod(run / 'responses.private.jsonl', 0o600)
        try:
            records = [json.loads(line) for line in output.splitlines() if line.strip()]
        except ValueError:
            raise SafeError('Invalid JSONL output; private response retained.') from None
    else:
        records = destination.get('inlinedResponses') or destination.get('inlined_responses')
        if not isinstance(records, list):
            raise SafeError('No recognized output destination. Inspect private status receipt before adapting schema.')
    seen = set()
    public, failures = [], []
    for record in records:
        ident = record.get('key') or record.get('metadata', {}).get('key')
        if ident not in expected or ident in seen:
            raise SafeError('Batch response contains an unknown or duplicate request key.')
        seen.add(ident)
        body = record.get('response')
        if not isinstance(body, dict) or record.get('error') or record.get('status'):
            failures.append({'id': ident, 'reason': 'provider_error', 'provider_error': error_summary(record.get('error', record.get('status')))})
            continue
        try:
            parts = body['candidates'][0]['content']['parts']
            blocks = [p.get('inlineData') or p.get('inline_data') for p in parts if p.get('inlineData') or p.get('inline_data')]
            audio_blocks = [b for b in blocks if (b.get('mimeType') or b.get('mime_type', '')).startswith('audio/')]
            if len(audio_blocks) != 1:
                raise ValueError()
            b = audio_blocks[0]
            data = base64.b64decode(b['data'], validate=True)
            mime = b.get('mimeType') or b.get('mime_type')
            wav_path = run / 'raw' / (ident + '.wav')
            wav_path.parent.mkdir(exist_ok=True)
            if mime.startswith('audio/wav') and data.startswith(b'RIFF'):
                wav_path.write_bytes(data)
            elif mime.startswith('audio/l16') and data and len(data) % 2 == 0:
                with wave.open(str(wav_path), 'wb') as w:
                    w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data)
            else:
                raise ValueError()
            with wave.open(str(wav_path), 'rb') as w:
                if w.getnchannels() != 1 or w.getsampwidth() != 2 or w.getframerate() != 24000 or w.getnframes() < 4800:
                    raise ValueError()
                seconds = w.getnframes() / w.getframerate()
        except (KeyError, IndexError, ValueError, wave.Error, EOFError):
            failures.append({'id': ident, 'reason': 'invalid_audio'})
            continue
        row = expected[ident]
        mp3_path = run / 'clips' / (ident + '.mp3')
        mp3_path.parent.mkdir(exist_ok=True)
        receipt_path = run / 'raw' / (ident + '.receipt.json')
        wav_hash = digest(wav_path.read_bytes())
        receipt = read_json(receipt_path) if receipt_path.exists() else {}
        if not mp3_path.exists() or receipt.get('wav_sha256') != wav_hash or receipt.get('mp3_sha256') != digest(mp3_path.read_bytes()):
            measurements = normalize(wav_path, mp3_path)
            receipt = {'id': ident, 'usage': body.get('usageMetadata', body.get('usage_metadata', {})), 'seconds': seconds,
                       'wav_sha256': wav_hash, 'mp3_sha256': digest(mp3_path.read_bytes()), 'loudness_input': measurements,
                       'normalization': {'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11}}
            save(receipt_path, receipt)
        runtime_keys = [{k: lookup[k] for k in ['kind', 'speaker', 'text']} for lookup in manifest.get('runtime_lookup', []) if lookup.get('asset_id') == ident]
        if not runtime_keys:
            runtime_keys = row.get('runtime_lookup')
        if not isinstance(runtime_keys, list):
            runtime_keys = [{'kind': row['kind'], 'speaker': speaker, 'text': row.get('display_text', row['text'])}
                            for speaker in row.get('runtime_speakers', [row['speaker']])]
        # Runtime speaker and cast voice can differ for the two vote calls.
        # Preserve original caller IDs even for previously frozen manifests.
        for speaker in row.get('runtime_speakers', []):
            original = {'kind': row['kind'], 'speaker': speaker, 'text': row.get('display_text', row['text'])}
            if original not in runtime_keys:
                runtime_keys.append(original)
        if not runtime_keys or any(not isinstance(k, dict) or not all(isinstance(k.get(f), str) for f in ['kind', 'speaker', 'text']) for k in runtime_keys):
            raise SafeError('Invalid runtime lookup mapping; private collection retained.')
        public.append({'id': ident, 'speaker': row['speaker'], 'text': row['text'], 'kind': row['kind'],
                       'audio': 'audio/prolog/' + ident + '.mp3', 'seconds': round(seconds, 3),
                       'sha256': receipt['mp3_sha256'], 'runtime_keys': runtime_keys})
    if state != 'JOB_STATE_SUCCEEDED':
        failures.append({'id': None, 'reason': 'batch_terminal_failure', 'state': state})
    failures.extend({'id': ident, 'reason': 'missing_response'} for ident in expected if ident not in seen)
    save(run / 'collection.private.json', {'collected': len(public), 'expected': len(expected), 'failures': failures})
    profiles = read_json(run / 'profiles.private.json')
    aliases = manifest.get('alias_map', manifest.get('aliases', profiles.get('speaker_aliases', profiles.get('aliases', {}))))
    if not isinstance(aliases, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in aliases.items()):
        raise SafeError('Invalid speaker aliases mapping.')
    proposal = {'model': MODEL, 'aliases': aliases, 'clips': public}
    save(run / 'public-manifest.proposed.json', proposal)
    if args.public_dir:
        if failures:
            raise SafeError('Public export refused: collection is incomplete or has invalid audio.')
        if not args.qa_report:
            raise SafeError('Public export requires --qa-report with status=passed and checked_ids covering every clip.')
        qa = read_json(args.qa_report)
        if qa.get('status') != 'passed' or set(qa.get('checked_ids', [])) != set(expected) or qa.get('failures'):
            raise SafeError('Public export refused: QA report has not passed for every current clip.')
        qa_hashes = qa.get('clip_sha256', {})
        if any(qa_hashes.get(c['id']) != c['sha256'] for c in public):
            raise SafeError('Public export refused: QA hashes do not match all current audio clips.')
        out = Path(args.public_dir).resolve()
        if out != ROOT / 'game/public/audio/prolog':
            raise SafeError('Public export must target game/public/audio/prolog/.')
        out.mkdir(parents=True, exist_ok=True)
        for c in public:
            shutil.copyfile(run / 'clips' / (c['id'] + '.mp3'), out / (c['id'] + '.mp3'))
            os.chmod(out / (c['id'] + '.mp3'), 0o644)
        save(out / 'manifest.json', proposal)
        os.chmod(out / 'manifest.json', 0o644)
    print(json.dumps({'state': 'COLLECTED', 'collected': len(public), 'expected': len(expected), 'failed_or_missing': len(failures)}))

def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', choices=['prepare', 'submit', 'status', 'collect'])
    parser.add_argument('--run-dir', default=str(PRIVATE / 'prolog-2026-10-05'))
    parser.add_argument('--profiles')
    parser.add_argument('--manifest')
    parser.add_argument('--public-dir', help='Opt-in export, only game/public/audio/prolog allowed')
    parser.add_argument('--qa-report', help='JSON status=passed, checked_ids, clip_sha256 mapping; required for export')
    access = parser.add_mutually_exclusive_group()
    access.add_argument('--key-stdin', action='store_true')
    access.add_argument('--keychain-service')
    parser.add_argument('--keychain-account')
    args = parser.parse_args()
    if args.command == 'prepare' and (not args.profiles or not args.manifest):
        parser.error('prepare requires --profiles and --manifest')
    if args.keychain_account and not args.keychain_service:
        parser.error('--keychain-account requires --keychain-service')
    try:
        run = directory(args.run_dir)
        globals()[args.command](args, run)
    except SafeError as e:
        print(str(e), file=sys.stderr)
        return 1
    except (OSError, ValueError, TypeError):
        print('Invalid local artifact or filesystem operation; private inputs retained.', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
