#!/usr/bin/env python3
"""Offline authored-text DTW alignment for collected story MP3s.

Produces a private export-compatible report. Never changes a public manifest,
transcribes replacement text, fetches models remotely, or generates audio.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import prolog_voice_word_cues as acoustic
import story_voice_common as story

ENGINE = acoustic.VERSION + '/story-waveform-v1'
STORY_ID = re.compile(r'story-[0-9a-f]{24}\Z')


def text_sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def cue_words(text, cues, seconds):
    """Preserve each authored whitespace token, including visual pause marks."""
    words = acoustic.normalized_text(text).split()
    if len(words) != len(cues) or not words:
        raise RuntimeError('Alignment cardinality differs from authored text')
    result = []
    previous = 0.0
    for word, cue in zip(words, cues):
        start, end = cue.get('start'), cue.get('end')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in (start, end)):
            raise RuntimeError('Alignment has nonfinite or nonnumeric timestamps')
        if not previous <= start <= end <= seconds + .001:
            raise RuntimeError('Alignment is overlapping, unordered or outside decoded MP3')
        result.append({'word': word, 'start': start, 'end': end})
        previous = end
    return result


def qualification_flags(receipt):
    """Keep original failures; acoustic refinement cannot bless bad DTW."""
    flags = copy.deepcopy(receipt.get('original_qualification_flags', []))
    flags.extend(copy.deepcopy(receipt.get('qualification_flags', [])))
    raw = receipt.get('raw_word_cues', receipt['word_cues'])
    previous = 0.0
    for index, (detail, cue) in enumerate(zip(receipt['words'], raw)):
        if not detail.get('spoken'):
            continue
        reasons = []
        duration = cue['end'] - cue['start']
        if duration < .02:
            reasons.append('collapsed_acoustic_interval')
        if duration > 1.5:
            reasons.append('long_acoustic_interval')
        if detail.get('minimum_token_probability', 0) < .02:
            reasons.append('low_authored_token_probability')
        if cue['start'] - previous > 1.5:
            reasons.append('long_internal_pause')
        if reasons:
            flags.append({'word_index': index, 'word': detail['word'], 'reasons': reasons})
        previous = cue['end']
    unique = {}
    for flag in flags:
        unique[json.dumps(flag, sort_keys=True)] = flag
    return list(unique.values())


def adjudicated(receipt, approval):
    return (approval.get('decision') == 'reviewed'
            and isinstance(approval.get('review_note'), str) and bool(approval['review_note'].strip())
            and all(approval.get(key) == receipt.get(key) for key in
                    ['audio_sha256', 'text_sha256', 'source_manifest_sha256', 'cues_sha256', 'engine_version']))


def report_for(receipts, approvals=None):
    approvals = approvals or {}
    report = {'method': ENGINE, 'model': acoustic.MODEL, 'status': 'passed',
              'clip_sha256': {}, 'alignment_by_id': {}, 'requires_qualification': [],
              'failures': [], 'authored_text_sha256': {}}
    for receipt in receipts:
        ident = receipt['id']
        report['clip_sha256'][ident] = receipt['audio_sha256']
        report['authored_text_sha256'][ident] = receipt['text_sha256']
        if receipt['all_qualification_flags'] and not adjudicated(receipt, approvals.get(ident, {})):
            report['requires_qualification'].append(ident)
            report['failures'].append({'id': ident, 'reason': 'Explicit current private qualification required',
                                       'flags': receipt['all_qualification_flags']})
            continue
        try:
            words = cue_words(receipt['text'], receipt['word_cues'], receipt['decoded_seconds'])
        except RuntimeError as error:
            report['failures'].append({'id': ident, 'reason': str(error)})
            continue
        report['alignment_by_id'][ident] = {'words': words, 'word_count': len(words),
                                           'text_sha256': receipt['text_sha256'],
                                           'cues_sha256': receipt['cues_sha256']}
    if report['failures'] or not receipts:
        report['status'] = 'needs_review'
    return report


def resolve_model_dir(model_dir=None):
    if model_dir is None:
        from prolog_voice_qa import cached_model
        model_dir = cached_model()
    path = Path(model_dir).expanduser()
    if not path.is_absolute():
        raise RuntimeError('--model-dir must be an absolute local directory')
    path = path.resolve()
    config = path / 'config.json'
    if not path.is_dir() or not config.is_file() or not any(
            (path / name).is_file() for name in ['weights.safetensors', 'model.safetensors', 'weights.npz']):
        raise RuntimeError('Local MLX model needs config.json and converted weights')
    if not isinstance(json.loads(config.read_text()), dict):
        raise RuntimeError('Invalid local MLX model config')
    return path



def qualified_CTC_cache(receipt, expected, approval, run, provenance_cache=None):
    """Retain only explicitly adopted, currently proven independent CTC cues."""
    if not receipt or receipt.get('engine_version') != ENGINE+'/story-CTC-private-adoption-v1':
        return False
    if any(receipt.get(key) != value for key,value in expected.items() if key != 'engine_version'):
        return False
    if not adjudicated(receipt, approval) or receipt.get('cues_sha256') != acoustic.cue_sha(receipt.get('word_cues', [])):
        return False
    adoption = receipt.get('CTC_adoption', {})
    if adoption.get('ctc_receipt_sha256') != approval.get('ctc_receipt_sha256'):
        return False
    paths = list(run.glob('ctc*/'+receipt['id']+'.ctc.private.json'))
    actual_path = next((path for path in paths if acoustic.sha(path) == adoption.get('ctc_receipt_sha256')), None)
    if actual_path is None:
        return False
    actual = json.loads(actual_path.read_text())
    binding = actual.get('binding', {})
    if binding != adoption.get('binding') or binding != approval.get('CTC_binding'):
        return False
    if any(binding.get(key) != expected[key] for key in ['audio_sha256','text_sha256','source_manifest_sha256']):
        return False
    from story_voice_ctc_align import model_identity, ENGINE as ctc_engine
    if binding.get('engine') != ctc_engine or binding.get('script_sha256') != acoustic.sha(Path(__file__).with_name('story_voice_ctc_align.py')):
        return False
    model = binding.get('model', {})
    cache = provenance_cache if provenance_cache is not None else {}
    key = json.dumps(model, sort_keys=True)
    if key not in cache:
        try:
            cache[key] = model_identity(Path(model['local_directory']), model['revision']) == model
        except (ValueError, KeyError, OSError):
            cache[key] = False
    if not cache[key]:
        return False
    words = actual.get('alignment', {}).get('words', [])
    if [word.get('word') for word in words] != acoustic.normalized_text(receipt['text']).split():
        return False
    if [{'start':word.get('start'),'end':word.get('end')} for word in words] != receipt['word_cues']:
        return False
    try:
        cue_words(receipt['text'], receipt['word_cues'], receipt['decoded_seconds'])
    except RuntimeError:
        return False
    return True


def load_local_model(model_dir=None):
    import mlx.core as mx
    from mlx_whisper.load_models import load_model
    from mlx_whisper.tokenizer import get_tokenizer
    mx.set_memory_limit(12 * 1024**3)
    mx.set_cache_limit(2 * 1024**3)
    # local_files_only explicitly forbids network downloads.
    model = load_model(str(resolve_model_dir(model_dir)), dtype=mx.float16)
    tokenizer = get_tokenizer(model.is_multilingual, num_languages=model.num_languages,
                              language='de', task='transcribe')
    return model, tokenizer


def align_run(run, private_dir, qualification=None, only_ids=None, model_dir=None):
    story.configure()
    story.prepared(run)
    frozen = json.loads((run / 'lines.private.json').read_text())
    manifest_sha = acoustic.sha(run / 'lines.private.json')
    proposal = json.loads((run / 'public-manifest.proposed.json').read_text())
    source = {row['id']: row for row in frozen['lines']}
    clips = proposal['clips']
    if only_ids:
        if not only_ids <= {c['id'] for c in clips}:
            raise RuntimeError('Unknown requested collected clip')
        clips = [c for c in clips if c['id'] in only_ids]
    if not clips:
        raise RuntimeError('No collected clips to align')
    approvals = json.loads(qualification.read_text()).get('approvals', {}) if qualification else {}
    receipts, before, model_pair = [], {}, None
    provenance_cache = {}
    for clip in clips:
        ident = clip['id']
        if not STORY_ID.fullmatch(ident) or ident not in source:
            raise RuntimeError('Invalid or unfrozen story clip ID')
        if any(clip.get(key) != source[ident].get(key) for key in ['text', 'kind', 'speaker']):
            raise RuntimeError('Clip differs from frozen authored line')
        mp3 = run / 'clips' / (ident + '.mp3')
        before[ident] = acoustic.sha(mp3)
        if before[ident] != clip['sha256']:
            raise RuntimeError('Collected MP3 differs from proposal hash')
        audio = acoustic.decode(mp3)
        seconds = len(audio) / 16000
        if abs(seconds - clip['seconds']) > .05:
            raise RuntimeError('Proposal duration differs from decoded MP3 duration')
        path = private_dir / (ident + '.json')
        receipt = json.loads(path.read_text()) if path.exists() else None
        expected = {'audio_sha256': before[ident], 'text_sha256': text_sha(clip['text']),
                    'source_manifest_sha256': manifest_sha, 'engine_version': ENGINE}
        retained_CTC = qualified_CTC_cache(receipt, expected, approvals.get(ident, {}), run, provenance_cache)
        base_cache = receipt and not receipt.get('CTC_adoption') and all(receipt.get(k) == v for k,v in expected.items())
        if not retained_CTC and not base_cache:
            if model_pair is None:
                model_pair = load_local_model(model_dir)
            receipt = acoustic.align(*model_pair, clip, audio)
            receipt['original_qualification_flags'] = copy.deepcopy(receipt['qualification_flags'])
            receipt = acoustic.refine_boundaries(receipt, audio)
            receipt.update(expected)
        if not retained_CTC:
            receipt['all_qualification_flags'] = qualification_flags(receipt)
        receipt['cues_sha256'] = acoustic.cue_sha(receipt['word_cues'])
        receipt['authored_word_count'] = len(acoustic.normalized_text(clip['text']).split())
        acoustic.save(path, receipt)
        receipts.append(receipt)
        print(ident, receipt['authored_word_count'], 'words', len(receipt['all_qualification_flags']), 'flags', flush=True)
    if any(acoustic.sha(run / 'clips' / (ident + '.mp3')) != value for ident, value in before.items()):
        raise RuntimeError('Audio changed during alignment')
    if acoustic.sha(run / 'lines.private.json') != manifest_sha:
        raise RuntimeError('Frozen text changed during alignment')
    report = report_for(receipts, approvals)
    report['source_manifest_sha256'] = manifest_sha
    report['selected_ids'] = [c['id'] for c in clips]
    report['coverage'] = 'selected' if only_ids else 'all_collected'
    acoustic.save(private_dir / 'alignment.private.json', report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', required=True, type=Path)
    parser.add_argument('--private-dir', type=Path)
    parser.add_argument('--model-dir', type=Path, help='Absolute converted local MLX model directory; default uses the Prolog local cache helper')
    parser.add_argument('--qualification', type=Path, help='Private approvals bound to source/text/audio/cues/engine hashes')
    parser.add_argument('--only-ids', help='Comma-separated collected story IDs; export still requires complete coverage')
    args = parser.parse_args()
    run = args.run_dir.resolve()
    if not run.is_relative_to(story.PRIVATE.resolve()) or run == story.PRIVATE.resolve():
        parser.error('--run-dir must be a child of output/audio/story-voice')
    private_dir = args.private_dir.resolve() if args.private_dir else run / 'word-cues'
    if not private_dir.is_relative_to(story.PRIVATE.resolve()):
        parser.error('--private-dir must remain in the private story bank')
    model_dir = resolve_model_dir(args.model_dir) if args.model_dir else None
    report = align_run(run, private_dir, args.qualification,
                       set(args.only_ids.split(',')) if args.only_ids else None, model_dir)
    print(json.dumps({'status': report['status'], 'aligned': len(report['alignment_by_id']),
                      'requires_qualification': len(report['requires_qualification'])}))
    return 0 if report['status'] == 'passed' else 2


if __name__ == '__main__':
    raise SystemExit(main())
