#!/usr/bin/env python3
"""Private machine audit of DTW cues against unprompted local decoder words.

Approval proposals are technical evidence, never a human phonetic or acting
verdict. No live receipt, public manifest or audio is changed.
"""
import argparse
import copy
import json
import math
from pathlib import Path
import story_voice_qa as qa
import story_voice_word_cues as aligner
import prolog_voice_word_cues as acoustic

VERSION = 'story-free-word-cue-audit-v1'
TOLERANCE = .120


def eligible(receipt, report, current_hash):
    ident = receipt['id']
    take = next((t for t in report.get('takes', []) if t.get('id') == ident), {})
    if (current_hash != receipt.get('audio_sha256')
            or report.get('clip_sha256', {}).get(ident) != current_hash
            or report.get('manifest_sha256') != receipt.get('source_manifest_sha256')
            or take.get('text_sha256') != receipt.get('text_sha256')
            or ident not in report.get('checked_ids', []) or take.get('reasons') != []
            or any(f.get('id') == ident for f in report.get('failures', []))):
        return None
    if qa.words(take.get('transcript', '')) != qa.words(receipt['text']) and not take.get('adjudication'):
        return None
    return take


def anchored_words(receipt, decoded, take):
    expected = qa.words(receipt['text'])
    observed = []
    for word in decoded:
        start, end = word.get('start'), word.get('end')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in [start, end]):
            raise ValueError('invalid_free_word_timing')
        if not 0 <= start < end <= receipt['decoded_seconds'] + .001:
            raise ValueError('free_word_outside_audio')
        observed.extend((token, start, end) for token in qa.words(word['word']))
    if len(expected) != len(observed):
        raise ValueError('free_decoder_missing_or_extra_words')
    record = take.get('adjudication', {}).get('record', {})
    allowed = set()
    if (record.get('status') == 'accepted_word_variants'
            and record.get('clip_sha256') == receipt['audio_sha256']
            and record.get('text_sha256') == receipt['text_sha256']
            and record.get('transcript_sha256') == qa.text_hash(take.get('transcript', ''))
            and record.get('reviewed_by') and record.get('reason')):
        for pair in record.get('accepted_word_variants', []):
            aa, bb = qa.words(pair.get('expected', '')), qa.words(pair.get('observed', ''))
            if len(aa) == len(bb) == 1:
                allowed.add((aa[0], bb[0]))
    for aa, (bb, _, _) in zip(expected, observed):
        if aa != bb and (aa, bb) not in allowed:
            raise ValueError('free_decoder_lexical_mismatch')
    cues, cursor, previous = [], 0, 0.0
    for token in acoustic.normalized_text(receipt['text']).split():
        count = len(qa.words(token))
        if count:
            anchors = observed[cursor:cursor + count]
            start, end = min(w[1] for w in anchors), max(w[2] for w in anchors)
            cursor += count
        else:
            start = end = previous
        cues.append({'start': round(start, 3), 'end': round(end, 3)})
        previous = end
    aligner.cue_words(receipt['text'], cues, receipt['decoded_seconds'])
    return cues


def audit(receipt, report, current_hash, decoded, activity):
    result = {'id': receipt['id'], 'method': VERSION, 'status': 'review_required',
              'note': 'Technical machine timing audit; no human phonetic, acting or voice-identity proof.',
              'approval_proposal': None}
    take = eligible(receipt, report, current_hash)
    if not take:
        result['reason'] = 'no_current_individually_word_faithful_QA'
        return result
    if acoustic.cue_sha(receipt['word_cues']) != receipt.get('cues_sha256'):
        result['reason'] = 'current_cues_hash_mismatch'
        return result
    try:
        anchors = anchored_words(receipt, decoded, take)
        aligner.cue_words(receipt['text'], receipt['word_cues'], receipt['decoded_seconds'])
    except (ValueError, RuntimeError) as error:
        result['reason'] = str(error)
        return result
    deltas, collapsed, silent = [], [], []
    for index, (word, current, independent) in enumerate(zip(
            acoustic.normalized_text(receipt['text']).split(), receipt['word_cues'], anchors)):
        if not qa.words(word):
            continue
        deltas.extend([abs(current['start'] - independent['start']), abs(current['end'] - independent['end'])])
        if current['end'] - current['start'] < .02:
            collapsed.append(index)
        low, high = int(current['start'] * 100), int(math.ceil(current['end'] * 100))
        window = activity[low:high]
        if not window or sum(window) / len(window) < .1:
            silent.append(index)
    result['metrics'] = {'maximum_anchor_delta_seconds': max(deltas, default=0),
                         'tolerance_seconds': TOLERANCE, 'collapsed_indices': collapsed,
                         'waveform_inactive_indices': silent, 'authored_word_count': len(anchors)}
    result['proposed_corrected_cues'] = anchors
    result['proposed_corrected_cues_sha256'] = acoustic.cue_sha(anchors)
    if collapsed or silent or max(deltas, default=0) > TOLERANCE:
        result['reason'] = 'discrepant_collapsed_or_waveform_unsupported_cues'
        return result
    result['status'] = 'supported_proposal'
    result['approval_proposal'] = {key: receipt[key] for key in
                                  ['audio_sha256', 'text_sha256', 'source_manifest_sha256', 'cues_sha256', 'engine_version']}
    result['approval_proposal'].update(decision='reviewed', review_note=
        'Machine proposal only: complete free-decoder words, <=120ms word-anchor differences, noncollapsed waveform-supported intervals. Root must inspect and adopt.',
        method=VERSION, metrics=result['metrics'])
    return result



def correction_plan(receipt, report, current_hash, decoded, audio):
    """Suggest only waveform-supported boundaries; never create approvals.

    Divergent voiced regions remain unresolved. A free-decoder collapse may use
    the current DTW interval as a candidate only when its authored probability,
    waveform activity, and free neighbors all support it, requiring root review.
    """
    import numpy as np
    result = {'id': receipt['id'], 'method': VERSION + '/conservative-corrections-v1',
              'status': 'rejected', 'approval_proposal': None,
              'requires_root_inspection': True, 'boundary_decisions': []}
    if abs(len(audio)/16000 - receipt['decoded_seconds']) > .001:
        result['reason'] = 'decoded_waveform_duration_differs_from_receipt'
        return result
    take = eligible(receipt, report, current_hash)
    if not take or acoustic.cue_sha(receipt['word_cues']) != receipt.get('cues_sha256'):
        result['reason'] = 'current_QA_or_cue_hash_gate_failed'
        return result
    try:
        # Collapsed free intervals are admitted only for a separately tested
        # DTW fallback; all lexical and ordering gates still apply.
        working = copy.deepcopy(decoded)
        collapsed_free = []
        for index, word in enumerate(working):
            if word.get('end') == word.get('start'):
                collapsed_free.append(index)
                word['end'] = word['start'] + .001
        free = anchored_words(receipt, working, take)
    except (ValueError, RuntimeError) as error:
        result['reason'] = str(error)
        return result
    lexical_probs = [float(w.get('probability', 0)) for w in working for _ in qa.words(w['word'])]
    if any(not math.isfinite(p) or not 0 <= p <= 1 for p in lexical_probs):
        result['reason'] = 'invalid_free_decoder_probability'
        return result
    details, cursor = [], 0
    tokens = acoustic.normalized_text(receipt['text']).split()
    for token in tokens:
        count = len(qa.words(token))
        probability = min(lexical_probs[cursor:cursor+count], default=0)
        details.append({'word': token, 'spoken': bool(count), 'minimum_token_probability': probability})
        cursor += count
    refined = acoustic.refine_boundaries({'words': details, 'word_cues': free}, audio)
    free = refined['word_cues']
    frames = audio[:len(audio)//160*160].reshape(-1, 160)
    rms = np.sqrt(np.mean(frames.astype(np.float64)**2, axis=1))
    threshold = max(.001, min(.003, float(np.percentile(rms, 5))*3))
    active = rms >= threshold
    def fraction(start, end):
        window = active[max(0, int(start*100)):min(len(active), int(math.ceil(end*100)))]
        return float(np.mean(window)) if len(window) else 0.0
    current = receipt['word_cues']
    candidate = copy.deepcopy(current)
    uncertain, corrections, fallbacks = [], [], []
    for index, (detail, dtw, independent) in enumerate(zip(details, current, free)):
        if not detail['spoken']:
            continue
        minimum = detail['minimum_token_probability']
        duration = independent['end'] - independent['start']
        if duration < .02:
            authored_probability = receipt['words'][index].get('minimum_token_probability', 0)
            before = next((free[j]['end'] for j in range(index-1, -1, -1) if details[j]['spoken']), 0.0)
            after = next((free[j]['start'] for j in range(index+1, len(free)) if details[j]['spoken']), receipt['decoded_seconds'])
            if (dtw['end'] - dtw['start'] >= .02 and authored_probability >= .5
                    and before <= dtw['start'] <= dtw['end'] <= after
                    and fraction(dtw['start'], dtw['end']) >= .5):
                fallbacks.append(index)
                result['boundary_decisions'].append({'index': index, 'word': detail['word'],
                    'action': 'retain_DTW_for_collapsed_free_word', 'authored_probability': authored_probability,
                    'requires_root_listening': True})
            else:
                uncertain.append({'index': index, 'reason': 'free_collapse_without_supported_DTW_fallback'})
            continue
        if minimum < .5 or fraction(independent['start'], independent['end']) < .1:
            uncertain.append({'index': index, 'reason': 'low_free_probability_or_inactive_interval',
                              'minimum_free_probability': minimum})
            continue
        for boundary in ['start', 'end']:
            old, proposed = dtw[boundary], independent[boundary]
            delta = abs(old-proposed)
            if delta <= TOLERANCE:
                continue
            occupancy = fraction(min(old, proposed), max(old, proposed))
            decision = {'index': index, 'word': detail['word'], 'boundary': boundary,
                        'current_seconds': old, 'free_refined_seconds': proposed,
                        'delta_seconds': delta, 'difference_region_active_fraction': occupancy,
                        'minimum_free_probability': minimum}
            # A displaced boundary inside silence has acoustic evidence for
            # moving it. A disagreement crossing voiced samples has no such
            # evidence and must be retained for local listening/another model.
            if occupancy <= .2:
                candidate[index][boundary] = proposed
                decision['action'] = 'propose_silence_boundary_correction'
                corrections.append(decision)
            else:
                decision['action'] = 'retain_DTW_pending_voiced_boundary_review'
                uncertain.append(decision)
            result['boundary_decisions'].append(decision)
    # Visual punctuation always follows the actual preceding chosen word end.
    for index, detail in enumerate(details):
        if not detail['spoken']:
            end = candidate[index-1]['end'] if index else 0.0
            candidate[index] = {'start': end, 'end': end}
    try:
        aligner.cue_words(receipt['text'], candidate, receipt['decoded_seconds'])
        for index, (detail, cue) in enumerate(zip(details, candidate)):
            if detail['spoken'] and (cue['end']-cue['start'] < .02 or fraction(cue['start'], cue['end']) < .1):
                uncertain.append({'index': index, 'reason': 'candidate_collapsed_or_inactive'})
    except RuntimeError as error:
        result['reason'] = str(error)
        return result
    result.update(status='correction_proposed' if corrections and not uncertain and not fallbacks else
                  'uncertain_partial_proposal' if corrections else 'retained_for_review' if uncertain or fallbacks else 'corroborated_current_cues',
                  proposed_cues=candidate, proposed_cues_sha256=acoustic.cue_sha(candidate),
                  original_cues_sha256=receipt['cues_sha256'],
                  free_waveform_cues=free, waveform_rms_threshold=threshold,
                  corrections_count=len(corrections), unresolved=uncertain, DTW_fallback_indices=fallbacks,
                  bounds={key: receipt[key] for key in ['audio_sha256','text_sha256','source_manifest_sha256','engine_version']},
                  note='Private technical proposal only. No tolerance relaxation or automatic approval. Voiced disagreements and collapsed-free DTW fallbacks need root inspection/listening.')
    return result


def plan_cached_corrections(run, qa_path, target, selected=None):
    """CPU-only, read-only inputs; write only plan*.json artifacts."""
    report = json.loads(qa_path.read_text())
    qa_hash = acoustic.sha(qa_path)
    manifest_path = run / 'lines.private.json'
    manifest_hash = acoustic.sha(manifest_path)
    if report.get('manifest_sha256') != manifest_hash:
        raise RuntimeError('QA does not cover current frozen manifest')
    frozen = {line['id']: line for line in json.loads(manifest_path.read_text())['lines']}
    results = []
    for audit_path in sorted((run/'cue-review').glob('*.audit.json')):
        previous = json.loads(audit_path.read_text())
        if previous.get('reason') != 'discrepant_collapsed_or_waveform_unsupported_cues':
            continue
        ident = previous['id']
        if selected and ident not in selected:
            continue
        receipt_path = run/'word-cues'/(ident+'.json')
        evidence_path = run/'cue-review'/(ident+'.free-words.json')
        mp3 = run/'clips'/(ident+'.mp3')
        hashes = {str(p): acoustic.sha(p) for p in [receipt_path, evidence_path, mp3]}
        receipt = json.loads(receipt_path.read_text())
        evidence = json.loads(evidence_path.read_text())
        line = frozen.get(ident)
        if (not line or receipt['text'] != acoustic.normalized_text(line['text'])
                or receipt['text_sha256'] != qa.text_hash(line['text'])
                or evidence.get('audio_sha256') != hashes[str(mp3)]
                or evidence.get('method') != VERSION or evidence.get('initial_prompt') is not None
                or evidence.get('condition_on_previous_text') is not False):
            raise RuntimeError('Evidence or receipt source/audio binding failed')
        result = correction_plan(receipt, report, hashes[str(mp3)], evidence['words'], acoustic.decode(mp3))
        result.update(input_hashes=hashes, qa_report_sha256=qa_hash)
        if any(acoustic.sha(Path(p)) != h for p,h in hashes.items()):
            raise RuntimeError('Plan input changed during waveform inspection')
        results.append(result)
    if acoustic.sha(qa_path) != qa_hash or acoustic.sha(manifest_path) != manifest_hash:
        raise RuntimeError('QA/source changed during correction planning')
    from collections import Counter
    plan = {'method': VERSION+'/conservative-corrections-v1', 'requires_root_inspection': True,
            'counts': dict(Counter(result['status'] for result in results)), 'results': results,
            'note': 'No GPU inference. Cached unprompted words plus decoded waveform only. Current receipts/approvals/public/audio unchanged.'}
    qa.save(target/'plan-corrections.private.json', plan)
    print(json.dumps(plan['counts']))
    return plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--qa-report', type=Path, required=True)
    parser.add_argument('--model-dir', type=Path, required=True)
    parser.add_argument('--private-dir', type=Path)
    parser.add_argument('--only-ids')
    parser.add_argument('--plan-corrections', action='store_true', help='CPU-only proposals from existing free-word evidence, write only plan*.json')
    args = parser.parse_args()
    run = args.run_dir.resolve()
    if not run.is_relative_to(aligner.story.PRIVATE.resolve()):
        parser.error('Run must remain in private story bank')
    target = args.private_dir.resolve() if args.private_dir else run / 'cue-review'
    if not target.is_relative_to(aligner.story.PRIVATE.resolve()):
        parser.error('Review artifacts must remain in private story bank')
    if args.plan_corrections:
        plan_cached_corrections(run, args.qa_report, target, set(args.only_ids.split(',')) if args.only_ids else None)
        return
    model = str(aligner.resolve_model_dir(args.model_dir))
    report = json.loads(args.qa_report.read_text())
    report_hash = acoustic.sha(args.qa_report)
    manifest_path = run / 'lines.private.json'
    manifest_hash = acoustic.sha(manifest_path)
    if report.get('manifest_sha256') != manifest_hash:
        raise RuntimeError('QA report differs from current frozen source manifest')
    frozen = {line['id']: line for line in json.loads(manifest_path.read_text())['lines']}
    selected = set(args.only_ids.split(',')) if args.only_ids else None
    results, proposals = [], {}
    transcribe = None
    for path in sorted((run / 'word-cues').glob('story-*.json')):
        receipt_hash = acoustic.sha(path)
        receipt = json.loads(path.read_text())
        ident = receipt['id']
        if selected and ident not in selected:
            continue
        line = frozen.get(ident)
        if (not line or receipt.get('text') != acoustic.normalized_text(line['text'])
                or receipt.get('text_sha256') != qa.text_hash(line['text'])
                or receipt.get('source_manifest_sha256') != manifest_hash):
            raise RuntimeError('Receipt differs from frozen authored source')
        if not receipt.get('all_qualification_flags'):
            continue
        mp3 = run / 'clips' / (ident + '.mp3')
        current_hash = acoustic.sha(mp3)
        if not eligible(receipt, report, current_hash):
            results.append(audit(receipt, report, current_hash, [], []))
            continue
        cache_path = target / (ident + '.free-words.json')
        evidence = json.loads(cache_path.read_text()) if cache_path.exists() else None
        if not evidence or evidence.get('audio_sha256') != current_hash or evidence.get('method') != VERSION or evidence.get('model_dir') != model or evidence.get('initial_prompt') is not None or evidence.get('condition_on_previous_text') is not False:
            if transcribe is None:
                import mlx.core as mx
                mx.set_memory_limit(12 * 1024**3); mx.set_cache_limit(2 * 1024**3)
                import mlx_whisper
                transcribe = mlx_whisper.transcribe
            response = transcribe(str(mp3), path_or_hf_repo=model, language='de', word_timestamps=True,
                                  initial_prompt=None, condition_on_previous_text=False, temperature=0)
            decoded = [w for segment in response.get('segments', []) for w in segment.get('words', [])]
            evidence = {'method': VERSION, 'audio_sha256': current_hash, 'model_dir': model,
                        'initial_prompt': None, 'condition_on_previous_text': False,
                        'words': decoded, 'response': response}
            qa.save(cache_path, evidence)
        audio = acoustic.decode(mp3)
        import numpy as np
        size = 160; frames = audio[:len(audio)//size*size].reshape(-1, size)
        rms = np.sqrt(np.mean(frames.astype(np.float64)**2, axis=1))
        threshold = max(.001, min(.003, float(np.percentile(rms, 5))*3))
        result = audit(receipt, report, current_hash, evidence['words'], (rms >= threshold).tolist())
        result.update(evidence_sha256=acoustic.sha(cache_path), qa_report_sha256=report_hash,
                      receipt_sha256=receipt_hash, waveform_rms_threshold=threshold)
        if acoustic.sha(mp3) != current_hash or acoustic.sha(args.qa_report) != report_hash or acoustic.sha(path) != receipt_hash or acoustic.sha(manifest_path) != manifest_hash:
            raise RuntimeError('Audio or QA changed during review')
        if result['approval_proposal']:
            result['approval_proposal'].update(evidence_sha256=result['evidence_sha256'], qa_report_sha256=report_hash)
            proposals[ident] = result['approval_proposal']
        qa.save(target / (ident + '.audit.json'), result)
        results.append(result)
        print(ident, result['status'], flush=True)
    qa.save(target / 'qualification-proposals.private.json', {'method': VERSION,
            'requires_root_inspection': True, 'approvals': proposals, 'results': results})


if __name__ == '__main__':
    main()
