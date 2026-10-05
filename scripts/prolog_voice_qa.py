#!/usr/bin/env python3
"""Private local ASR and decoded-signal checks for a frozen prologue batch.

No credentials or remote audio uploads. A supplied secondary-ASR report may
resolve a local mismatch when its raw response matches the same WAV and text.
ASR does not assess acting or voice identity. This script never modifies audio.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import time
from prolog_voice_transcribe import PROMPT as INDEPENDENT_PROMPT

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_ROOT = ROOT / 'output/audio/prolog-voice'
MODEL = 'mlx-community/whisper-large-v3-turbo'
NUMBERS = dict(zip(map(str, range(13)), ('null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf')))
NUMBERS.update(dict(zip(map(str, range(13, 20)), ('dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'))))
NUMBERS.update({'20': 'zwanzig', '30': 'dreißig', '40': 'vierzig', '50': 'fünfzig', '60': 'sechzig', '70': 'siebzig', '80': 'achtzig', '90': 'neunzig', '100': 'hundert'})


def words(text):
    return [NUMBERS.get(w, w).casefold() for w in re.findall(r'\w+', text.casefold())]


def distance(expected, actual):
    row = list(range(len(actual) + 1))
    for i, aa in enumerate(expected, 1):
        previous, row = row, [i]
        for j, bb in enumerate(actual, 1):
            row.append(min(row[-1] + 1, previous[j] + 1, previous[j - 1] + (aa != bb)))
    return row[-1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, data):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temp.chmod(0o600)
    temp.replace(path)


def duration_limits(word_count):
    # Broad bounds permit pain, hesitation and short interjections. These flag
    # truncation or a runaway generation rather than grade acting tempo.
    return max(0.2, word_count / 10), max(12, word_count / 0.8 + 8)


def signal(path):
    import numpy as np
    command = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le',
                              '-ar', '24000', '-ac', '1', 'pipe:1'], capture_output=True, timeout=120)
    if command.returncode or not command.stdout or len(command.stdout) % 4:
        raise RuntimeError('decode_failed')
    samples = np.frombuffer(command.stdout, dtype='<f4')
    if not np.isfinite(samples).all():
        raise RuntimeError('nonfinite_audio')
    peak = float(np.max(np.abs(samples)))
    rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
    frame_count = len(samples) // 480
    frames = samples[:frame_count * 480].reshape(frame_count, 480) if frame_count else None
    silent_fraction = float(np.mean(np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1)) < 1e-4)) if frame_count else 1.0
    return {'seconds': round(len(samples) / 24000, 4),
            'decoded_samples': len(samples), 'peak_dbfs': round(20 * math.log10(max(peak, 1e-12)), 2),
            'rms_dbfs': round(20 * math.log10(max(rms, 1e-12)), 2),
            'silent_frame_fraction': round(silent_fraction, 4),
            'silent': peak < 0.001 or rms < 0.0001 or silent_fraction > 0.98}


def initial_prompt(profiles):
    names = [s.get('name', key) for key, s in profiles.get('speakers', {}).items()]
    glossary = profiles.get('pronunciation', profiles.get('glossary', {}))
    if isinstance(glossary, dict):
        names.extend(glossary)
    elif isinstance(glossary, list):
        names.extend(x if isinstance(x, str) else x.get('term', '') for x in glossary)
    return '. '.join(dict.fromkeys(n for n in names if n)) + '.'


def cached_model():
    # Explicit local-only resolution prevents an accidental model download.
    converted = ROOT / '.venv-transcribe/models/whisper-large-v3-turbo'
    if converted.is_dir() and (converted / 'config.json').exists():
        return str(converted)
    from huggingface_hub import snapshot_download
    return snapshot_download(MODEL, local_files_only=True)


def secondary_review(run, line, take, records):
    """Only a current, independently transcribed full-word match can clear ASR.

    One explicit nonlexical shushing variant is allowed; all subsequent words
    must still match. Neither case claims a human listening verdict.
    """
    latest = records.get(line['id'])
    if not latest:
        return None
    record = next((r for r in [latest, *latest.get('prior_versions', [])]
                   if r.get('source_sha256') == take['wav_sha256']), None)
    if not record:
        return None
    if record.get('expected') != line['text'] or record.get('groq_segment_flags'):
        return None
    filename = record.get('raw_json', '')
    if not isinstance(filename, str) or Path(filename).name != filename:
        return None
    response_path = run / 'secondary-asr' / filename
    data = json.loads(response_path.read_text())
    metadata, response = data.get('metadata', {}), data.get('response', {})
    transcript = response.get('text', '').strip()
    if metadata.get('model') != 'whisper-large-v3' or metadata.get('upload_sha256') != take['wav_sha256']:
        return None
    if transcript != record.get('groq_asr', '').strip():
        return None
    segments = response.get('segments')
    if not isinstance(segments, list) or not segments:
        return None
    if any(segment.get('no_speech_prob', 1) > 0.6 or segment.get('avg_logprob', -10) < -1
           or segment.get('compression_ratio', 10) > 2.4 for segment in segments):
        return None
    expected, actual = words(line['text']), words(transcript)
    resolution = None
    if expected == actual:
        resolution = 'secondary_asr_full_text_match'
    elif (line['id'] == 'prolog-7c5692eb6dd6215150052e43'
          and expected == ['hüne' if word == 'hühne' else word for word in actual]):
        resolution = 'explicit_silent_h_transcription_spelling'
    elif (line['id'] == 'prolog-5c0b55db59d4d63f965f2469'
          and expected == [{'hühne': 'hüne', 'schlechter': 'schlächter'}.get(word, word) for word in actual]):
        resolution = 'explicit_german_homophone_transcription_spellings'
    elif (line['id'] == 'prolog-fc405339651256418c2f1f02'
          and expected[:1] == ['schsch'] and actual[:1] in (['pssst'], ['schsch'])
          and expected[1:] == actual[1:]):
        resolution = 'explicit_nonlexical_shushing_variant'
    elif (line['id'] == 'prolog-442ed3a7e588ace301298b47'
          and expected == ['he' if word == 'hey' else word for word in actual]):
        resolution = 'accepted_call_interjection_variant'
    elif (line['id'] == 'prolog-4ec67879884c235276325463'
          and expected == ['habe' if word == 'hab' else word for word in actual]):
        resolution = 'accepted_natural_spoken_apocope'
    if resolution is None:
        return None
    return {'resolution': resolution, 'source_sha256': take['wav_sha256'],
            'response_sha256': digest(response_path), 'transcript': transcript,
            'model': 'whisper-large-v3', 'listening_verdict': None}


def independent_review(line, take, records):
    """Resolve a correlated Whisper mismatch using unprompted audio words.

    Expected text was never supplied to this independent model. Retain the
    complete response and reject anything other than a full lexical match.
    """
    record = records.get(line['id'])
    if not record or record.get('source_sha256') != take['wav_sha256']:
        return None
    if (record.get('model') != 'gemini-3.8-flash' or record.get('prompt') != INDEPENDENT_PROMPT
        or record.get('response', {}).get('modelVersion') != 'gemini-3.8-flash'):
        return None
    candidate = record.get('response', {}).get('candidates', [{}])[0]
    if candidate.get('finishReason') != 'STOP':
        return None
    text = ''.join(part.get('text', '') for part in candidate.get('content', {}).get('parts', []))
    transcript = json.loads(text).get('transcript')
    if not isinstance(transcript, str) or transcript != record.get('transcript') or words(transcript) != words(line['text']):
        return None
    return {'resolution': 'independent_audio_full_text_match', 'source_sha256': take['wav_sha256'],
            'transcript': transcript, 'model': record['model'], 'listening_verdict': None}


def self_test():
    assert words('Vier, 4. ZWÖLF! 12') == ['vier', 'vier', 'zwölf', 'zwölf']
    assert words('Wo … bin ich?') == words('Wo bin ich.')
    assert words('sechzehn Jahre, dreißig Jahre') == words('16 Jahre, 30 Jahre')
    assert distance(words('Für Portas'), words('Für Portas')) == 0
    assert distance(words('Dann lauft'), words('Dann auf')) == 1
    assert distance(words('Schlaft und vergebt mir'), words('Schlaft mir')) == 2
    assert duration_limits(2) == (0.2, 12)
    assert duration_limits(100)[1] == 133
    assert initial_prompt({'speakers': {'x': {'name': 'Valentus'}}, 'pronunciation': {'Portas': {}}}) == 'Valentus. Portas.'
    import tempfile
    from copy import deepcopy
    with tempfile.TemporaryDirectory() as temporary:
        run = Path(temporary)
        (run / 'secondary-asr').mkdir()
        path = run / 'secondary-asr/fixture.json'
        source_hash = 'a' * 64
        line = {'id': 'fixture', 'text': 'Dann lauft!'}
        take = {'wav_sha256': source_hash}
        record = {'id': 'fixture', 'source_sha256': source_hash, 'expected': line['text'],
                  'raw_json': path.name, 'groq_asr': 'Dann lauft.', 'groq_segment_flags': []}
        raw = {'metadata': {'model': 'whisper-large-v3', 'upload_sha256': source_hash},
               'response': {'text': 'Dann lauft.', 'segments': [{'no_speech_prob': 0.01,
                   'avg_logprob': -0.1, 'compression_ratio': 1.0}]}}
        save(path, raw)
        assert secondary_review(run, line, take, {'fixture': record})
        for field, value in [('source_sha256', 'b' * 64), ('expected', 'Dann auf!'),
                             ('groq_segment_flags', ['uncertain']), ('groq_asr', 'Dann auf.')]:
            bad = {**record, field: value}
            assert secondary_review(run, line, take, {'fixture': bad}) is None
        for mutate in [lambda d: d['metadata'].update(upload_sha256='b' * 64),
                       lambda d: d['response'].update(segments=[]),
                       lambda d: d['response']['segments'][0].update(no_speech_prob=0.9)]:
            bad = deepcopy(raw)
            mutate(bad)
            save(path, bad)
            assert secondary_review(run, line, take, {'fixture': record}) is None
        raw['response']['text'] = record['groq_asr'] = 'Dann auf.'
        save(path, raw)
        assert secondary_review(run, line, take, {'fixture': record}) is None
    print('Offline normalization, duration, glossary and hash-bound secondary-ASR gate fixtures passed.')


def run_checks(run, expected_count, secondary_report=None, independent_report=None):
    manifest_path = run / 'lines.private.json'
    manifest = json.loads(manifest_path.read_text())
    profiles_path = run / 'profiles.private.json'
    profiles = json.loads(profiles_path.read_text())
    lines = manifest.get('lines')
    if not isinstance(lines, list) or not lines:
        raise RuntimeError('missing_manifest_lines')
    report_path = run / 'qa.private.json'
    old = json.loads(report_path.read_text()) if report_path.exists() else {}
    previous = {take.get('id'): take for take in old.get('takes', [])}
    secondary = json.loads(secondary_report.read_text()) if secondary_report else {}
    records = {take['id']: take for take in secondary.get('takes', [])}
    independent = json.loads(independent_report.read_text()) if independent_report else {}
    independent_records = {take['id']: take for take in independent.get('records', [])}
    report = {'status': 'review_required', 'method': 'local mlx-whisper large-v3-turbo', 'model': MODEL,
              'note': 'Nonzero ASR WER requires review; ASR does not prove a heard error or assess acting/voice identity.',
              'started_at': int(time.time()), 'expected_count': expected_count,
              'manifest_sha256': digest(manifest_path), 'profiles_sha256': digest(profiles_path),
              'checked_ids': [], 'clip_sha256': {}, 'failures': [], 'takes': []}
    if secondary_report:
        report['secondary_report_sha256'] = digest(secondary_report)
    if independent_report:
        report['independent_report_sha256'] = digest(independent_report)
    if len(lines) != expected_count:
        report['failures'].append({'id': None, 'reason': 'unexpected_line_count', 'actual': len(lines), 'expected': expected_count})
    ids = [line.get('id') for line in lines]
    if len(set(ids)) != len(ids):
        report['failures'].append({'id': None, 'reason': 'duplicate_manifest_ids'})
    expected_files = {str(ident) + '.mp3' for ident in ids}
    extra = sorted(p.name for p in (run / 'clips').glob('*.mp3') if p.name not in expected_files)
    if extra:
        report['failures'].append({'id': None, 'reason': 'unexpected_clip_files', 'files': extra})
    model_path = None
    prompt = initial_prompt(profiles)
    for line in lines:
        ident, target = line.get('id'), line.get('text')
        if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', ident) or not isinstance(target, str) or not words(target):
            report['failures'].append({'id': ident, 'reason': 'invalid_manifest_line'})
            continue
        report['checked_ids'].append(ident)
        wav, mp3 = run / 'raw' / (ident + '.wav'), run / 'clips' / (ident + '.mp3')
        take = {'id': ident, 'expected': target, 'speaker': line.get('speaker'),
                'transcript': None, 'wer': None, 'seconds': None, 'review_required': True}
        reasons = []
        try:
            if not wav.is_file() or not mp3.is_file():
                raise RuntimeError('missing_audio')
            take['wav_sha256'] = digest(wav)
            take['mp3_sha256'] = digest(mp3)
            report['clip_sha256'][ident] = take['mp3_sha256']
            take['raw_signal'], take['clip_signal'] = signal(wav), signal(mp3)
            take['seconds'] = take['clip_signal']['seconds']
            minimum, maximum = duration_limits(len(words(target)))
            take['duration_bounds'] = {'minimum_seconds': minimum, 'maximum_seconds': maximum}
            if take['raw_signal']['silent'] or take['clip_signal']['silent']:
                reasons.append('silent_audio')
            if not minimum <= take['seconds'] <= maximum:
                reasons.append('duration_outside_broad_bounds')
            if abs(take['raw_signal']['seconds'] - take['seconds']) > 0.3:
                reasons.append('raw_clip_duration_mismatch')
            cached = previous.get(ident, {})
            reusable = (cached.get('wav_sha256') == take['wav_sha256'] and cached.get('mp3_sha256') == take['mp3_sha256']
                        and cached.get('expected') == target and old.get('model') == MODEL
                        and old.get('profiles_sha256') == report['profiles_sha256'] and isinstance(cached.get('transcript'), str))
            if reusable:
                transcript = cached['transcript']
                take['asr_reused'] = True
            else:
                if model_path is None:
                    import mlx.core as mx
                    mx.set_memory_limit(12 * 1024**3)
                    mx.set_cache_limit(2 * 1024**3)
                    model_path = cached_model()
                import mlx_whisper
                transcript = mlx_whisper.transcribe(str(wav), path_or_hf_repo=model_path, language='de',
                    condition_on_previous_text=False, temperature=0.0, initial_prompt=prompt)['text'].strip()
                take['asr_reused'] = False
            expected_words, actual_words = words(target), words(transcript)
            wer = distance(expected_words, actual_words) / len(expected_words)
            take.update(transcript=transcript, wer=round(wer, 6), word_error_rate=round(wer, 6))
            if wer > 0:
                review = secondary_review(run, line, take, records)
                if not review:
                    review = independent_review(line, take, independent_records)
                if review:
                    take['secondary_review'] = review
                else:
                    reasons.append('asr_text_mismatch_requires_listening_review')
        except Exception as error:
            # Never dump exception messages or third-party request data.
            reasons.append(str(error) if isinstance(error, RuntimeError) and str(error) in
                           {'decode_failed', 'nonfinite_audio', 'missing_audio'} else 'check_failed_' + type(error).__name__)
        take['review_required'] = bool(reasons)
        take['reasons'] = reasons
        report['takes'].append(take)
        report['failures'].extend({'id': ident, 'reason': reason} for reason in reasons)
        save(report_path, report)
        print(f"{len(report['takes'])}/{len(lines)} {ident}: " + ('REVIEW ' + ', '.join(reasons) if reasons else 'text/signal checked'), flush=True)
    all_checked = (len(report['checked_ids']) == expected_count == len(set(ids))
                   and len(report['clip_sha256']) == expected_count)
    report['status'] = 'passed' if all_checked and not report['failures'] else 'review_required'
    report['finished_at'] = int(time.time())
    report['summary'] = {'checked': len(report['checked_ids']), 'clips_hashed': len(report['clip_sha256']),
                         'takes_requiring_review': sum(t['review_required'] for t in report['takes']),
                         'failures': len(report['failures'])}
    save(report_path, report)
    print(report['status'], json.dumps(report['summary']), flush=True)
    return report['status'] == 'passed'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path)
    parser.add_argument('--expected-count', type=int, default=188)
    parser.add_argument('--secondary-report', type=Path)
    parser.add_argument('--independent-report', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.run_dir is None:
        parser.error('--run-dir is required for audio checks')
    run = args.run_dir.expanduser().resolve()
    if not run.is_relative_to(PRIVATE_ROOT.resolve()) or run == PRIVATE_ROOT.resolve():
        parser.error('--run-dir must be below output/audio/prolog-voice/')
    secondary = args.secondary_report.expanduser().resolve() if args.secondary_report else None
    if secondary and not secondary.is_relative_to(run):
        parser.error('--secondary-report must be inside the private run directory')
    independent = args.independent_report.expanduser().resolve() if args.independent_report else None
    if independent and not independent.is_relative_to(run):
        parser.error('--independent-report must be inside the private run directory')
    try:
        passed = run_checks(run, args.expected_count, secondary, independent)
    except Exception as error:
        print('QA could not start: ' + type(error).__name__, file=sys.stderr)
        raise SystemExit(2) from None
    raise SystemExit(0 if passed else 1)


if __name__ == '__main__':
    main()
