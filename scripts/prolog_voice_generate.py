#!/usr/bin/env python3
"""Generate the reviewed prolog through standard Gemini GenerateContent.

Uses prolog_voice_batch.prepare/validate/normalize and its frozen JSONL requests.
Default: two workers, globally spaced request starts (6.2 seconds / under10RPM).
Only explicit HTTP429 rejection is retried, at most three attempts per line.
Unknown transport outcomes are journaled and never automatically retried.
No public export until every clip passes a supplied hash-bound QA report.
"""
from __future__ import annotations
import argparse
import base64
import copy
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import os
from pathlib import Path
import re
import shutil
import sys
import threading
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import wave
import prolog_voice_batch as batch

class ProviderError(batch.SafeError):
    def __init__(self, summary, code=None, retry_after=0, uncertain=False):
        super().__init__('Provider request failed; safe details saved in private line receipt.')
        self.summary = summary
        self.code = code
        self.retry_after = retry_after
        self.uncertain = uncertain

class StartLimiter:
    def __init__(self, interval):
        self.interval = interval
        self.last = 0.0
        self.lock = threading.Lock()
    def wait(self):
        with self.lock:
            delay = self.interval - (time.monotonic() - self.last)
            if delay > 0:
                time.sleep(delay)
            self.last = time.monotonic()

def retry_seconds(value):
    try:
        return max(0.0, float(value))
    except (ValueError, TypeError):
        try:
            return max(0.0, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
        except (ValueError, TypeError, OverflowError):
            return 0.0

def provider_error(body, code):
    try:
        error = json.loads(body).get('error', {})
    except (ValueError, AttributeError):
        error = {'code': code, 'message': 'Non-JSON provider error.'}
    summary = batch.error_summary(error)
    summary['code'] = summary.get('code') or code
    retry_delay = 0.0
    details = []
    for item in error.get('details', []):
        if not isinstance(item, dict):
            continue
        kind = item.get('@type', '').rsplit('/', 1)[-1]
        if kind.endswith('RetryInfo'):
            delay = item.get('retryDelay', '')
            if re.fullmatch(r'[0-9]+(?:\.[0-9]+)?s', str(delay)):
                retry_delay = max(retry_delay, float(delay[:-1]))
                details.append({'type': 'RetryInfo', 'retry_delay_seconds': retry_delay})
        elif kind.endswith('QuotaFailure'):
            violations = []
            for v in item.get('violations', []):
                if isinstance(v, dict):
                    clean = batch.error_summary({'message': v.get('description', '')})['message']
                    violations.append({'description': clean[:500], 'quota_id': v.get('quotaId'), 'quota_metric': v.get('quotaMetric')})
            details.append({'type': 'QuotaFailure', 'violations': violations})
    if details:
        summary['details'] = details
    return summary, retry_delay

CLARITY_DIRECTION = (
    'Verbatim clarity retake: Read every supplied German word exactly once, completely and in the supplied order. '
    'Speak slightly more slowly with clearly separated consonants and complete word endings. '
    'Do not slur words, omit schwa syllables, replace pronouns, add words, or improvise repetitions. '
    'Keep the same selected voice identity and the original emotion. '
    'The supplied transcript is authoritative; directions are silent metadata.'
)

def clarity_record(record, selected, note=''):
    """Return an isolated override only for explicitly selected request keys."""
    if record['key'] not in selected:
        return record
    changed = copy.deepcopy(record)
    direction = CLARITY_DIRECTION + (' Additional clarity instruction: ' + note if note else '')
    count = 0
    for content in changed['request'].get('contents', []):
        for part in content.get('parts', []):
            if isinstance(part.get('text'), str):
                metadata = part.setdefault('speechMetadata', {})
                metadata['style'] = metadata.get('style', '').rstrip() + '\n' + direction
                count += 1
    if not count:
        raise batch.SafeError('Selected clarity request has no text part.')
    changed['delivery_override'] = {'type': 'verbatim_clarity', 'instruction': direction}
    return changed

def transcript_words(text):
    text = unicodedata.normalize('NFC', text).replace('’', "'")
    return [word.casefold() for word in re.findall(r"[^\W_]+(?:['-][^\W_]+)*", text, flags=re.UNICODE)]

def validate_retake_text(original, override):
    if not isinstance(override, str) or not override.strip():
        raise batch.SafeError('Retake transcript must be nonempty.')
    # Only the two documented pause tags are permitted; reject all other tags.
    plain = re.sub(r'<(?:short|long) pause>', ' ', override)
    if '<' in plain or '>' in plain:
        raise batch.SafeError('Retake transcript permits only <short pause> and <long pause> tags.')
    if any(unicodedata.category(c)[0] == 'S' for c in plain):
        raise batch.SafeError('Retake transcript permits casing, punctuation and pause tags, not added symbols.')
    if transcript_words(plain) != transcript_words(original):
        raise batch.SafeError('Retake transcript words differ from the frozen source; override refused before credential access or archiving.')

def delivery_record(record, selected, style=None, text=None):
    """Validate and isolate brief delivery overrides; never modify frozen input."""
    if record['key'] not in selected:
        return record
    changed = copy.deepcopy(record)
    parts = [p for content in changed['request'].get('contents', []) for p in content.get('parts', []) if isinstance(p.get('text'), str)]
    if not parts:
        raise batch.SafeError('Selected delivery override request has no text part.')
    if text is not None:
        if len(selected) != 1 or len(parts) != 1:
            raise batch.SafeError('--retake-text requires exactly one selected ID and one text part.')
        validate_retake_text(parts[0]['text'], text)
        parts[0]['text'] = text
    if style is not None:
        if not style.strip() or len(style) > 300 or '\n' in style or '\r' in style:
            raise batch.SafeError('--delivery-style must be one nonempty line of at most300 characters.')
        for part in parts:
            part.setdefault('speechMetadata', {})['style'] = style
    changed['delivery_override'] = {'type': 'brief_delivery', 'parts': [
        {'text': p['text'], 'style': p.get('speechMetadata', {}).get('style', '')} for p in parts]}
    return changed

def generate_request(request, key):
    # No responseFormat.audio: live probe confirms the model accepts default WAV.
    body = json.loads(json.dumps(request))
    body.setdefault('generationConfig', {}).pop('responseFormat', None)
    req = Request(batch.BASE + '/v1beta/models/' + batch.MODEL + ':generateContent',
                  data=json.dumps(body).encode(), method='POST',
                  headers={'x-goog-api-key': key, 'Content-Type': 'application/json'})
    try:
        with urlopen(req, timeout=180) as response:
            data = response.read()
    except HTTPError as error:
        summary, advised = provider_error(error.read(), error.code)
        delay = max(retry_seconds(error.headers.get('Retry-After')), advised)
        raise ProviderError(summary, error.code, delay) from None
    except (URLError, TimeoutError, OSError):
        raise ProviderError({'code': None, 'message': 'Unknown transport outcome. No automatic retry.'}, uncertain=True) from None
    try:
        return json.loads(data)
    except ValueError:
        raise ProviderError({'code': None, 'message': 'HTTP success returned invalid JSON. No automatic retry.'}, uncertain=True) from None

def valid_audio(path):
    try:
        with wave.open(str(path), 'rb') as w:
            if w.getnchannels() != 1 or w.getsampwidth() != 2 or w.getframerate() != 24000 or w.getnframes() < 4800:
                return None
            return w.getnframes() / w.getframerate()
    except (OSError, wave.Error, EOFError):
        return None

def decode_audio(response, path):
    try:
        parts = response['candidates'][0]['content']['parts']
        blocks = [p.get('inlineData') or p.get('inline_data') for p in parts if p.get('inlineData') or p.get('inline_data')]
        blocks = [b for b in blocks if str(b.get('mimeType') or b.get('mime_type', '')).lower().startswith('audio/')]
        if len(blocks) != 1:
            raise ValueError()
        block = blocks[0]
        data = base64.b64decode(block['data'], validate=True)
        mime = str(block.get('mimeType') or block.get('mime_type')).lower()
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix('.tmp.wav')
        if mime.startswith('audio/wav') and data.startswith(b'RIFF'):
            temp.write_bytes(data)
        elif mime.startswith('audio/l16') and data and len(data) % 2 == 0:
            with wave.open(str(temp), 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data)
        else:
            raise ValueError()
        seconds = valid_audio(temp)
        if seconds is None:
            raise ValueError()
        temp.replace(path)
        return seconds
    except (KeyError, IndexError, TypeError, ValueError, wave.Error, EOFError):
        raise batch.SafeError('Generated audio was missing or invalid; response usage retained and no automatic generation retry.') from None

def runtime_keys(manifest, row):
    keys = [{k: item[k] for k in ['kind', 'speaker', 'text']} for item in manifest.get('runtime_lookup', []) if item.get('asset_id') == row['id']]
    for speaker in row.get('runtime_speakers', [row['speaker']]):
        item = {'kind': row['kind'], 'speaker': speaker, 'text': row.get('display_text', row['text'])}
        if item not in keys:
            keys.append(item)
    if not keys or any(not all(isinstance(k.get(field), str) for field in ['kind', 'speaker', 'text']) for k in keys):
        raise batch.SafeError('Invalid runtime keys mapping.')
    return keys

def clip_entry(run, manifest, row, receipt):
    return {'id': row['id'], 'speaker': row['speaker'], 'kind': row['kind'], 'text': row['text'],
            'audio': 'audio/prolog/' + row['id'] + '.mp3', 'seconds': round(receipt['seconds'], 3),
            'sha256': receipt['mp3_sha256'], 'runtime_keys': runtime_keys(manifest, row)}

def make_clip(run, record, row, key, limiter):
    ident = row['id']
    effective_request = copy.deepcopy(record['request'])
    effective_request.setdefault('generationConfig', {}).pop('responseFormat', None)
    request_hash = batch.digest(json.dumps(effective_request, sort_keys=True).encode())
    receipt_path = run / 'raw' / (ident + '.receipt.json')
    wav = run / 'raw' / (ident + '.wav')
    mp3 = run / 'clips' / (ident + '.mp3')
    receipt = batch.read_json(receipt_path) if receipt_path.exists() else {}
    if receipt.get('request_sha256') is not None and receipt.get('request_sha256') != request_hash:
        raise batch.SafeError('Existing line receipt belongs to a different prepared request; use a fresh run directory.')
    seconds = valid_audio(wav)
    wav_valid = seconds is not None and receipt.get('wav_sha256') == batch.digest(wav.read_bytes())
    if wav_valid:
        if mp3.exists() and receipt.get('status') == 'complete' and receipt.get('mp3_sha256') == batch.digest(mp3.read_bytes()):
            if receipt.get('request_sha256') is None:
                receipt.update(request_sha256=request_hash, imported_from_batch=True)
                batch.save(receipt_path, receipt)
            return receipt, True
        # Recover local normalization without another paid request.
        measurements = batch.normalize(wav, mp3)
        receipt.update(status='complete', request_sha256=request_hash, seconds=seconds, mp3_sha256=batch.digest(mp3.read_bytes()),
                       loudness_input=measurements, normalization={'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11})
        batch.save(receipt_path, receipt)
        return receipt, True
    if receipt.get('status') in {'request_started', 'uncertain', 'audio_invalid', 'audio_saved', 'complete'}:
        raise batch.SafeError('Line has an uncertain outcome or damaged generated audio. Manual review required; generation will not be retried automatically.')
    attempts = receipt.get('attempts', 0)
    while attempts < 3:
        if receipt.get('status') == 'rejected' and receipt.get('provider_error', {}).get('code') != 429:
            raise batch.SafeError('Line was rejected by provider; correct the input and use a reviewed fresh run.')
        if receipt.get('status') == 'rejected':
            delay = max(receipt.get('retry_after_seconds', 0), 15 * (2 ** max(0, attempts - 1)))
            time.sleep(delay)
        limiter.wait()
        attempts += 1
        receipt = {'id': ident, 'model': batch.MODEL, 'status': 'request_started', 'attempts': attempts,
                   'request_sha256': request_hash, 'started_at': int(time.time())}
        if record.get('delivery_override'):
            receipt['delivery_override'] = copy.deepcopy(record['delivery_override'])
        batch.save(receipt_path, receipt)
        try:
            response = generate_request(effective_request, key)
        except ProviderError as error:
            receipt.update(status='uncertain' if error.uncertain else 'rejected', provider_error=error.summary,
                           retry_after_seconds=error.retry_after, finished_at=int(time.time()))
            batch.save(receipt_path, receipt)
            if error.code == 429 and attempts < 3:
                continue
            raise
        receipt.update(usage=response.get('usageMetadata', response.get('usage_metadata', {})),
                       model_version=response.get('modelVersion'), finished_at=int(time.time()))
        try:
            seconds = decode_audio(response, wav)
        except batch.SafeError:
            receipt.update(status='audio_invalid')
            batch.save(receipt_path, receipt)
            raise
        receipt.update(status='audio_saved', seconds=seconds, wav_sha256=batch.digest(wav.read_bytes()))
        batch.save(receipt_path, receipt)
        measurements = batch.normalize(wav, mp3)
        receipt.update(status='complete', mp3_sha256=batch.digest(mp3.read_bytes()), loudness_input=measurements,
                       normalization={'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11})
        batch.save(receipt_path, receipt)
        return receipt, False
    raise batch.SafeError('Maximum three HTTP429 attempts reached for this line.')

def export(run, args, manifest, profiles, clips, failures):
    aliases = manifest.get('alias_map', profiles.get('speaker_aliases', {}))
    proposal = {'model': batch.MODEL, 'aliases': aliases, 'clips': clips}
    batch.save(run / 'public-manifest.proposed.json', proposal)
    batch.save(run / 'collection.private.json', {'backend': 'standard', 'collected': len(clips), 'expected': len(manifest['lines']), 'failures': failures})
    if not args.public_dir:
        return
    if failures or len(clips) != len(manifest['lines']):
        raise batch.SafeError('Public export refused: collection is incomplete.')
    if not args.qa_report:
        raise batch.SafeError('Public export requires a hash-bound --qa-report.')
    qa = batch.read_json(args.qa_report)
    expected = {r['id'] for r in manifest['lines']}
    if qa.get('status') != 'passed' or set(qa.get('checked_ids', [])) != expected or qa.get('failures'):
        raise batch.SafeError('Public export refused: QA did not pass for all current clips.')
    if any(qa.get('clip_sha256', {}).get(c['id']) != c['sha256'] for c in clips):
        raise batch.SafeError('Public export refused: QA audio hashes differ.')
    target = Path(args.public_dir).resolve()
    if target != batch.ROOT / 'game/public/audio/prolog':
        raise batch.SafeError('Public export must target game/public/audio/prolog/.')
    target.mkdir(parents=True, exist_ok=True)
    for row in clips:
        out = target / (row['id'] + '.mp3')
        shutil.copyfile(run / 'clips' / out.name, out)
        os.chmod(out, 0o644)
    batch.save(target / 'manifest.json', proposal)
    os.chmod(target / 'manifest.json', 0o644)

def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', default=str(batch.PRIVATE / '2026-10-05-prolog-standard'))
    parser.add_argument('--profiles', default=str(batch.ROOT / 'docs/voice-production/prolog-speakers.json'))
    parser.add_argument('--manifest', default=str(batch.ROOT / 'docs/voice-production/prolog-lines.json'))
    parser.add_argument('--key-stdin', action='store_true')
    parser.add_argument('--keychain-service')
    parser.add_argument('--keychain-account')
    parser.add_argument('--workers', type=int, choices=[1, 2, 3], default=2)
    parser.add_argument('--request-interval', type=float, default=6.2)
    parser.add_argument('--only-ids', help='Comma-separated request IDs; unselected IDs never generate')
    parser.add_argument('--retake', action='store_true', help='Archive selected completed audio before fresh generation; requires --only-ids')
    parser.add_argument('--clarity-retake', action='store_true', help='Verbatim clarity directions only for explicit retake IDs')
    parser.add_argument('--clarity-note', help='Short additional delivery note, only with --clarity-retake')
    parser.add_argument('--delivery-style', help='Replace selected speechMetadata.style, max300 characters; requires scoped --retake')
    parser.add_argument('--retake-text', help='One selected ID: same frozen words with casing/punctuation and documented pause tags')
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--export-only', action='store_true')
    parser.add_argument('--public-dir')
    parser.add_argument('--qa-report')
    args = parser.parse_args()
    if args.request_interval < 0.1:
        parser.error('--request-interval must be at least0.1 seconds')
    direct_override = args.delivery_style is not None or args.retake_text is not None
    if direct_override and (not args.retake or not args.only_ids):
        parser.error('--delivery-style/--retake-text require --retake and --only-ids')
    if direct_override and (args.prepare_only or args.export_only or args.clarity_retake or args.clarity_note):
        parser.error('Brief delivery overrides cannot combine with prepare/export or legacy clarity directives')
    if args.retake_text is not None and len(set(args.only_ids.split(','))) != 1:
        parser.error('--retake-text requires exactly one selected request ID')
    if args.clarity_retake and (not args.retake or not args.only_ids):
        parser.error('--clarity-retake requires both --retake and --only-ids')
    if args.clarity_note and not args.clarity_retake:
        parser.error('--clarity-note requires --clarity-retake')
    if args.clarity_note and (len(args.clarity_note) > 500 or '\n' in args.clarity_note):
        parser.error('--clarity-note must be one short line of at most500 characters')
    if args.clarity_retake and (args.prepare_only or args.export_only):
        parser.error('--clarity-retake applies only to generation, not prepare/export')
    if args.retake and not args.only_ids:
        parser.error('--retake requires an explicit --only-ids scope')
    if args.key_stdin and args.keychain_service:
        parser.error('Choose one credential source')
    try:
        run = batch.directory(args.run_dir)
        if not (run / 'prepared.json').exists():
            batch.prepare(args, run)
        batch.prepared(run)
        profiles = batch.read_json(run / 'profiles.private.json')
        manifest = batch.read_json(run / 'lines.private.json')
        records = [json.loads(line) for line in (run / 'requests.jsonl').read_text().splitlines() if line.strip()]
        rows = {r['id']: r for r in manifest['lines']}
        if len(records) != len(rows) or {r.get('key') for r in records} != set(rows):
            raise batch.SafeError('Prepared JSONL keys do not match line manifest.')
        (run / 'clips').mkdir(exist_ok=True)
        (run / 'raw').mkdir(exist_ok=True)
        if args.prepare_only:
            return 0
        selected = set(args.only_ids.split(',')) if args.only_ids else set(rows)
        if not selected or not selected.issubset(rows):
            raise batch.SafeError('--only-ids contains an unknown or empty request ID.')
        if args.clarity_retake:
            records = [clarity_record(record, selected, args.clarity_note or '') for record in records]
        if direct_override:
            records = [delivery_record(record, selected, args.delivery_style, args.retake_text) for record in records]
        # Missing credentials must leave completed takes untouched.
        key = None if args.export_only else batch.credential(args)
        failures, receipts = [], {}
        if not args.export_only:
            for ident in rows:
                rp = run / 'raw' / (ident + '.receipt.json')
                w = run / 'raw' / (ident + '.wav');p = run / 'clips' / (ident + '.mp3')
                r = batch.read_json(rp) if rp.exists() else {}
                if r.get('status') == 'complete' and valid_audio(w) is not None and p.exists() and r.get('wav_sha256') == batch.digest(w.read_bytes()) and r.get('mp3_sha256') == batch.digest(p.read_bytes()):
                    receipts[ident] = r
            if args.retake:
                archived = run / 'rejected' / ('retake-' + str(time.time_ns()))
                for ident in selected:
                    rp = run / 'raw' / (ident + '.receipt.json')
                    old = batch.read_json(rp) if rp.exists() else {}
                    if old.get('status') not in {'complete', 'audio_invalid', 'rejected'}:
                        raise batch.SafeError('Retake scope includes an uncertain or incomplete request. Manual review required.')
                archived.mkdir(parents=True)
                for ident in selected:
                    receipts.pop(ident, None)
                    for old in [run / 'raw' / (ident + '.wav'), run / 'raw' / (ident + '.receipt.json'), run / 'clips' / (ident + '.mp3')]:
                        if old.exists():
                            old.rename(archived / old.name)
        if args.export_only:
            for ident, row in rows.items():
                path = run / 'raw' / (ident + '.receipt.json')
                receipt = batch.read_json(path) if path.exists() else {}
                wav = run / 'raw' / (ident + '.wav');mp3 = run / 'clips' / (ident + '.mp3')
                if receipt.get('status') != 'complete' or valid_audio(wav) is None or not mp3.exists() or receipt.get('wav_sha256') != batch.digest(wav.read_bytes()) or receipt.get('mp3_sha256') != batch.digest(mp3.read_bytes()):
                    failures.append({'id': ident, 'reason': 'missing_or_invalid_completed_audio'})
                else:
                    receipts[ident] = receipt
        else:
            limiter = StartLimiter(args.request_interval)
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures = {pool.submit(make_clip, run, record, rows[record['key']], key, limiter): record['key'] for record in records if record['key'] in selected}
                for future in as_completed(futures):
                    ident = futures[future]
                    try:
                        receipt, resumed = future.result()
                        receipts[ident] = receipt
                        print(json.dumps({'id': ident, 'status': 'resumed' if resumed else 'complete', 'seconds': receipt['seconds'], 'completed': len(receipts), 'total': len(rows)}), flush=True)
                    except (batch.SafeError, OSError, ValueError, KeyError) as error:
                        detail = error.summary if isinstance(error, ProviderError) else {'message': str(error) if isinstance(error, batch.SafeError) else 'Local generation/normalization operation failed.'}
                        failures.append({'id': ident, 'reason': 'generation_failed', 'provider_error': detail})
                        print(json.dumps({'id': ident, 'status': 'failed', 'error_code': detail.get('code')}), flush=True)
        if not args.export_only:
            reported = {f['id'] for f in failures}
            failures.extend({'id': ident, 'reason': 'unselected_missing_or_invalid_audio'} for ident in rows if ident not in receipts and ident not in reported)
        clips = [clip_entry(run, manifest, row, receipts[row['id']]) for row in manifest['lines'] if row['id'] in receipts]
        export(run, args, manifest, profiles, clips, failures)
        print(json.dumps({'state': 'COMPLETE' if not failures else 'INCOMPLETE', 'completed': len(clips), 'total': len(rows), 'failed': len(failures)}), flush=True)
        return 0 if not failures else 1
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError) as error:
        print(str(error) if isinstance(error, batch.SafeError) else 'Invalid local artifact or filesystem operation; private data retained.', file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
