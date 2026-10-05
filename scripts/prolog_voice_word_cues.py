#!/usr/bin/env python3
"""Offline authored-text/acoustic DTW alignment for delivered prologue MP3s.

Uses the installed MLX Whisper attention aligner in teacher-forced mode. No ASR
text replaces the script and no network model download or speech generation is
performed. Private receipts retain the token alignment and qualification flags.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'mlx-whisper-authored-dtw-v1'
MODEL = 'mlx-community/whisper-large-v3-turbo'


def normalized_text(text):
    # Port of ui/text.ts parseMarkup + normalizeVoiceText, preserving lone marks.
    output, style, index = [], 'plain', 0
    while index < len(text):
        ch = text[index]
        if ch == '\\' and index + 1 < len(text) and text[index + 1] in '*~':
            index += 1
            output.append(text[index])
        elif ch in '*~' and style in ('plain', 'em' if ch == '*' else 'magic'):
            if style == 'plain' and text.find(ch, index + 1) < 0:
                output.append(ch)
            else:
                style = ('em' if ch == '*' else 'magic') if style == 'plain' else 'plain'
        else:
            output.append(' ' if ch == '\n' else ch)
        index += 1
    return re.sub(r'\s+', ' ', ''.join(output)).strip()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def decode(path):
    import numpy as np
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ar', '16000', '-ac', '1',
                             '-f', 'f32le', 'pipe:1'], capture_output=True, check=True)
    audio = np.frombuffer(result.stdout, dtype='<f4').copy()
    if not len(audio) or not np.isfinite(audio).all():
        raise RuntimeError('MP3 decode yielded invalid audio')
    if len(audio) > 30 * 16000:
        raise RuntimeError('Clip exceeds single-window alignment scope')
    return audio


def cue_sha(cues):
    encoded = json.dumps(cues, sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(encoded).hexdigest()


def validate_cues(clip):
    cues = clip.get('word_cues')
    if not isinstance(cues, list) or len(cues) != len(normalized_text(clip['text']).split()):
        raise RuntimeError('Word cue count does not match runtime words')
    previous_start = previous_end = 0.0
    for cue in cues:
        if set(cue) != {'start', 'end'}:
            raise RuntimeError('Public cue contains fields beyond start/end')
        start, end = cue['start'], cue['end']
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in (start, end)):
            raise RuntimeError('Nonfinite word cue')
        if not 0 <= start <= end <= clip['seconds'] + 0.001 or start < previous_start or end < previous_end:
            raise RuntimeError('Word cue range or monotonicity failed')
        previous_start, previous_end = start, end


def apply_asr_evidence(receipt, path):
    if not path.exists():
        return receipt
    evidence = json.loads(path.read_text())
    if evidence.get('audio_sha256') != receipt['audio_sha256']:
        raise RuntimeError('ASR temporal audit does not cover current MP3 SHA')
    recognized = [w for seg in evidence['segments'] for w in seg.get('words', [])]
    authored = [w for w in receipt['words'] if w['spoken']]
    def lexical(word):
        return ''.join(re.findall(r'\w+', word.casefold()))
    if len(recognized) != len(authored):
        raise RuntimeError('ASR audit requires explicit authored word sequence mapping')
    for expected, actual in zip(authored, recognized):
        pair = (lexical(expected['word']), lexical(actual['word']))
        if pair[0] != pair[1] and pair not in {('habe', 'hab')}:
            raise RuntimeError('ASR word cannot be explicitly mapped to authored token')
    if 'authored_dtw_word_cues' not in receipt:
        receipt['authored_dtw_word_cues'] = receipt.get('raw_word_cues', receipt['word_cues'])
    cues = []
    cursor = 0
    last_end = 0.0
    for detail in receipt['words']:
        if detail['spoken']:
            timing = recognized[cursor]
            cue = {'start': round(float(timing['start']), 3), 'end': round(float(timing['end']), 3)}
            cursor += 1
        else:
            cue = {'start': last_end, 'end': last_end}
        cues.append(cue)
        last_end = cue['end']
    receipt['raw_word_cues'] = cues
    receipt['temporal_audit'] = {'method': 'local ASR word timestamps plus explicit authored word mapping',
                               'evidence_file': path.name, 'evidence_sha256': sha(path),
                               'spoken_word_count': cursor,
                               'variant_mapping': {'hab': 'habe'}}
    return receipt


def refine_boundaries(receipt, audio):
    """Remove acoustic silence attached to DTW token intervals, at 10 ms steps."""
    import numpy as np
    frame_size = 160
    frame_count = len(audio) // frame_size
    frames = audio[:frame_count * frame_size].reshape(frame_count, frame_size)
    rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    threshold = max(0.001, min(0.003, float(np.percentile(rms, 5)) * 3))
    active = rms >= threshold
    if 'raw_word_cues' not in receipt:
        receipt['raw_word_cues'] = receipt['word_cues']
    cues, flags = [], []
    previous_end = 0.0
    for index, (detail, raw) in enumerate(zip(receipt['words'], receipt['raw_word_cues'])):
        start, end = raw['start'], raw['end']
        if detail['spoken'] and end - start >= 0.04:
            low = max(0, int(start * 100))
            high = min(frame_count, int(math.ceil(end * 100)))
            window = active[low:high]
            # A pause that starts within 160 ms of the DTW boundary may contain
            # a short tail of the preceding word; use its measured end as onset.
            pause_start = None
            for k, voiced in enumerate(window):
                if not voiced and pause_start is None:
                    pause_start = k
                if voiced and pause_start is not None:
                    if k - pause_start >= 8 and pause_start <= 16 and k < len(window) - 3:
                        start = max(start, (low + k) / 100 - 0.02)
                        break
                    pause_start = None
            # Long intervals can begin in the fading previous word or a breath.
            # A measured >=300 ms low-energy pause inside such an interval
            # identifies a later restart; keep 40 ms of acoustic pre-roll.
            if end - raw['start'] > 1.5:
                local_rms = rms[low:high]
                speech_threshold = max(0.008, min(0.012, float(np.percentile(local_rms, 95)) * 0.05))
                speech_window = local_rms >= speech_threshold
                silence_start, restart = None, None
                for k, voiced in enumerate(speech_window):
                    if not voiced and silence_start is None:
                        silence_start = k
                    if voiced and silence_start is not None:
                        if k - silence_start >= 30 and k < len(speech_window) - 3:
                            restart = k
                        silence_start = None
                if restart is not None:
                    start = max(start, (low + restart) / 100 - 0.04)
                elif start <= raw['start'] + 0.3:
                    strong_indices = np.flatnonzero(speech_window)
                    if len(strong_indices):
                        start = max(start, (low + strong_indices[0]) / 100 - 0.02)
            # Pure leading silence shorter than 80 ms still gets removed.
            voiced_indices = np.flatnonzero(window)
            if len(voiced_indices) and voiced_indices[0] > 0:
                start = max(start, (low + voiced_indices[0]) / 100 - 0.02)
            if len(voiced_indices) and len(window) - 1 - voiced_indices[-1] >= 8:
                end = min(end, (low + voiced_indices[-1] + 1) / 100 + 0.02)
        elif not detail['spoken']:
            start = end = previous_end
        start = min(end, max(start, cues[-1]['start'] if cues else 0))
        cue = {'start': round(start, 3), 'end': round(end, 3)}
        cues.append(cue)
        detail.update(cue)
        reasons = []
        if detail['spoken'] and end - start < 0.02:
            reasons.append('collapsed_acoustic_interval')
        if detail['spoken'] and end - start > 1.5:
            reasons.append('long_acoustic_interval')
        if detail['spoken'] and detail['minimum_token_probability'] < 0.02:
            reasons.append('low_authored_token_probability')
        if reasons:
            flags.append({'word_index': index, 'word': detail['word'], 'reasons': reasons})
        previous_end = end
    receipt.update(word_cues=cues, qualification_flags=flags,
                   refinement={'method': 'decoded waveform silence boundary refinement',
                               'version': 2, 'frame_seconds': 0.01, 'rms_threshold': threshold,
                               'pre_roll_seconds': 0.02})
    return receipt


def align(model, tokenizer, clip, audio):
    import mlx.core as mx
    from mlx_whisper.audio import log_mel_spectrogram, pad_or_trim, N_FRAMES, HOP_LENGTH
    from mlx_whisper.timing import find_alignment
    text = normalized_text(clip['text'])
    authored = ' ' + text
    tokens = tokenizer.encode(authored)
    mel = log_mel_spectrogram(audio, n_mels=model.dims.n_mels, padding=0)
    num_frames = min(N_FRAMES, len(audio) // HOP_LENGTH)
    mel = pad_or_trim(mel, N_FRAMES, axis=-2)
    aligned = find_alignment(model, tokenizer, tokens, mel, num_frames)
    pieces = []
    offset = 0
    for item in aligned:
        word = item.word
        pieces.append({'text': word, 'char_start': offset, 'char_end': offset + len(word),
                       'start': float(item.start), 'end': float(item.end), 'probability': float(item.probability)})
        offset += len(word)
    if ''.join(p['text'] for p in pieces) != authored:
        raise RuntimeError('Aligner did not preserve the complete authored token sequence')
    seconds = len(audio) / 16000
    cues, details, flags = [], [], []
    previous_end = 0.0
    for index, match in enumerate(re.finditer(r'\S+', authored)):
        word = match.group()
        overlaps = [p for p in pieces if p['char_end'] > match.start() and p['char_start'] < match.end()]
        if not overlaps:
            raise RuntimeError('Authored whitespace word has no acoustic token interval')
        spoken = any(ch.isalnum() for ch in word)
        start = min(p['start'] for p in overlaps)
        end = max(p['end'] for p in overlaps)
        # Punctuation-only whitespace tokens are unspoken visual pause marks.
        # Reveal these at the acoustic end of the preceding word, not on a
        # fabricated share of the clip duration.
        if not spoken:
            start = end = previous_end
        start, end = max(0.0, min(seconds, start)), max(0.0, min(seconds, end))
        if end < start or (cues and start < cues[-1]['start'] - 1e-8):
            raise RuntimeError('Nonmonotonic acoustic alignment')
        cue = {'start': round(start, 3), 'end': round(end, 3)}
        cues.append(cue)
        probability = min(p['probability'] for p in overlaps)
        reasons = []
        if spoken and end - start < 0.02:
            reasons.append('collapsed_acoustic_interval')
        if spoken and end - start > 1.5:
            reasons.append('long_acoustic_interval')
        if spoken and probability < 0.02:
            reasons.append('low_authored_token_probability')
        if reasons:
            flags.append({'word_index': index, 'word': word, 'reasons': reasons})
        details.append({'word': word, **cue, 'spoken': spoken, 'minimum_token_probability': probability})
        previous_end = end
    mx.clear_cache()
    return {'version': VERSION, 'id': clip['id'], 'text': text, 'audio_sha256': clip['sha256'],
            'decoded_seconds': round(seconds, 4), 'word_cues': cues, 'words': details,
            'token_alignment': pieces, 'qualification_flags': flags}


def self_test():
    assert normalized_text('*Warm.*\n Wie ein ~Herzschlag.~') == 'Warm. Wie ein Herzschlag.'
    assert normalized_text('5 * 3') == '5 * 3'
    assert normalized_text('\\*ja\\*') == '*ja*'
    assert normalized_text('Wo … bin ich?').split() == ['Wo', '…', 'bin', 'ich?']
    valid = {'text': 'Wo … bin ich?', 'seconds': 3.0, 'word_cues': [
        {'start': 0.1, 'end': 0.4}, {'start': 0.4, 'end': 0.4},
        {'start': 1.0, 'end': 1.3}, {'start': 1.3, 'end': 1.5}]}
    validate_cues(valid)
    import copy
    for bad_kind in ('cardinality', 'range', 'monotonicity', 'nonfinite'):
        invalid = copy.deepcopy(valid)
        if bad_kind == 'cardinality': invalid['word_cues'].pop()
        if bad_kind == 'range': invalid['word_cues'][-1]['end'] = 3.1
        if bad_kind == 'monotonicity': invalid['word_cues'][2]['start'] = 0.2
        if bad_kind == 'nonfinite': invalid['word_cues'][0]['start'] = float('nan')
        try:
            validate_cues(invalid)
        except RuntimeError:
            pass
        else:
            raise AssertionError('Invalid cue fixture accepted: ' + bad_kind)
    print('Offline normalization, cue cardinality/range/monotonicity/nonfinite fixtures passed.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'game/public/audio/prolog/manifest.json')
    parser.add_argument('--private-dir', type=Path, default=ROOT / 'output/audio/prolog-word-cues/2026-10-05')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--qualification', type=Path, help='Private per-clip approval covering audio SHA, cues SHA and engine version')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    from huggingface_hub import snapshot_download
    import mlx.core as mx
    from mlx_whisper.load_models import load_model
    from mlx_whisper.tokenizer import get_tokenizer
    manifest = json.loads(args.manifest.read_text())
    before = {c['id']: sha(ROOT / 'game/public' / c['audio']) for c in manifest['clips']}
    if any(before[c['id']] != c['sha256'] for c in manifest['clips']):
        raise RuntimeError('Delivered MP3 differs from manifest hash')
    mx.set_memory_limit(12 * 1024**3)
    mx.set_cache_limit(2 * 1024**3)
    model = load_model(snapshot_download(MODEL, local_files_only=True), dtype=mx.float16)
    tokenizer = get_tokenizer(model.is_multilingual, num_languages=model.num_languages, language='de', task='transcribe')
    receipts = []
    for clip in manifest['clips'][:args.limit]:
        path = args.private_dir / (clip['id'] + '.json')
        receipt = json.loads(path.read_text()) if path.exists() else None
        if not receipt or receipt.get('version') != VERSION or receipt.get('audio_sha256') != before[clip['id']] or receipt.get('text') != normalized_text(clip['text']):
            receipt = align(model, tokenizer, clip, decode(ROOT / 'game/public' / clip['audio']))
            save(path, receipt)
        initial_cues = receipt.get('authored_dtw_word_cues', receipt.get('raw_word_cues', receipt['word_cues']))
        original_flags = []
        for index, (word, cue) in enumerate(zip(receipt['words'], initial_cues)):
            reasons = []
            if word['spoken'] and cue['end'] - cue['start'] < 0.02: reasons.append('collapsed_acoustic_interval')
            if word['spoken'] and cue['end'] - cue['start'] > 1.5: reasons.append('long_acoustic_interval')
            if word['spoken'] and word['minimum_token_probability'] < 0.02: reasons.append('low_authored_token_probability')
            if reasons: original_flags.append({'word_index': index, 'word': word['word'], 'reasons': reasons})
        receipt['original_qualification_flags'] = original_flags
        receipt = apply_asr_evidence(receipt, args.private_dir / (clip['id'] + '.asr-words.json'))
        receipt = refine_boundaries(receipt, decode(ROOT / 'game/public' / clip['audio']))
        receipt['engine_version'] = VERSION + '/waveform-v3' + ('/asr-sequence-audit-v1' if receipt.get('temporal_audit') else '')
        save(path, receipt)
        if len(receipt['word_cues']) != len(normalized_text(clip['text']).split()):
            raise RuntimeError('Word cue cardinality differs from runtime whitespace words')
        clip['word_cues'] = receipt['word_cues']
        validate_cues(clip)
        receipts.append(receipt)
        print(len(receipts), clip['id'], len(clip['word_cues']), 'words', len(receipt['qualification_flags']), 'flags', flush=True)
    report = {'method': VERSION, 'model': MODEL, 'clip_count': len(receipts),
              'audio_hashes': before, 'flags': {r['id']: r['qualification_flags'] for r in receipts if r['qualification_flags']},
              'requires_qualification': [r['id'] for r in receipts if r['qualification_flags'] or r.get('original_qualification_flags')],
              'note': 'Authored token cross-attention/DTW acoustic alignment. No proportional duration scheduling. Whitespace punctuation-only tokens use preceding acoustic word end. Measured decoded-signal silence refines token onsets/offsets at 10 ms resolution.'}
    save(args.private_dir / 'alignment.private.json', report)
    after = {c['id']: sha(ROOT / 'game/public' / c['audio']) for c in manifest['clips']}
    if before != after:
        raise RuntimeError('Delivered audio changed during alignment')
    if args.publish:
        if len(receipts) != len(manifest['clips']):
            raise RuntimeError('Cannot publish partial word-cue coverage')
        qualifications = json.loads(args.qualification.read_text()) if args.qualification else {}
        approvals = qualifications.get('approvals', {})
        for receipt in receipts:
            if receipt['qualification_flags'] or receipt.get('original_qualification_flags'):
                approval = approvals.get(receipt['id'], {})
                if approval.get('decision') != 'reviewed' or approval.get('audio_sha256') != receipt['audio_sha256'] or approval.get('cues_sha256') != cue_sha(receipt['word_cues']) or approval.get('engine_version') != receipt['engine_version']:
                    raise RuntimeError('Flagged clip lacks current explicit private qualification: ' + receipt['id'])
        for clip in manifest['clips']:
            validate_cues(clip)
        save(args.manifest, manifest)
    print('COMPLETE',len(receipts),'clips;',len(report['flags']),'clips with qualification flags',flush=True)


if __name__ == '__main__':
    main()
