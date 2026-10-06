#!/usr/bin/env python3
"""Propose strictly bounded, root-reviewed lexical evidence from free CTC.

No inference, audio edits, source/transcript rewrites, QA adoption or public
export. Only explicit whole-name y/i, initial c/k, Dunkelhain/Dunkelhein pairs
and otherwise identical concatenated word spelling can qualify a proposal.
Call load_records before review; it reuses the actual QA model/receipt loader.
"""
from __future__ import annotations

import argparse
import copy
from collections import Counter
import json
import math
from pathlib import Path
import re
import unicodedata

import story_voice_qa as qa

VERSION = 'story-free-CTC-root-lexical-variants-v1'
STATUS = 'approved_ctc_lexical_variants'
SHA = re.compile(r'[0-9a-f]{64}\Z')


def file_state(path):
    stat = path.stat()
    return (stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)


def load_records(report_path, output_dir):
    """Verify real files through qa.load_ctc_records, without changing reports.

    The separate loader transport explicitly grants no lexical approval. QA's
    loader ignores rows with null approval, so diagnostic rows need this marker
    to receive the same actual model-file, vocabulary and receipt SHA checks.
    """
    report_path, output_dir = report_path.resolve(), output_dir.resolve()
    if not report_path.is_relative_to(qa.PRIVATE.resolve()) or not output_dir.is_relative_to(qa.PRIVATE.resolve()):
        raise ValueError('ctc_variants_paths_outside_private_bank')
    report = json.loads(report_path.read_text())
    directory = Path(report.get('receipt_directory', str(report_path.parent))).resolve()
    transport = {key: copy.deepcopy(report[key]) for key in ('engine', 'model')}
    transport.update(receipt_directory=str(directory), results=[],
                     method=VERSION, source_report_sha256=qa.digest(report_path),
                     note='Model/receipt loading only. No root lexical approval.')
    seen = set()
    for row in report.get('results', []):
        ident = row.get('id')
        if not isinstance(ident, str) or not qa.ID.fullmatch(ident) or ident in seen:
            raise ValueError('invalid_ctc_result_ids')
        seen.add(ident)
        if row.get('status') == 'ineligible_QA' and 'receipt_sha256' not in row and 'receipt_file' not in row:
            continue
        transport['results'].append({key: copy.deepcopy(row[key]) for key in
                                     ('id', 'receipt_file', 'receipt_sha256')})
        transport['results'][-1]['approval'] = {'status': 'load_only_not_approved'}
    loader = output_dir/'verified-loader.private.json'
    qa.save(loader, transport)
    records = qa.load_ctc_records(loader)
    model_states = {}
    for ident, envelope in records.items():
        envelope['receipt_path'] = str(directory/(ident+'.ctc.private.json'))
        envelope['input_report_sha256'] = transport['source_report_sha256']
        model = envelope['receipt']['binding']['model']
        fingerprint = model['fingerprint']
        if fingerprint not in model_states:
            model_states[fingerprint] = {str(Path(model['local_directory'])/name): file_state(Path(model['local_directory'])/name)
                                          for name in model['file_sha256']}
        envelope['actual_model_file_states'] = model_states[fingerprint]
    if qa.digest(report_path) != transport['source_report_sha256']:
        raise ValueError('ctc_input_report_changed_during_load')
    return records


def validated_greedy(line, clip_hash, manifest_hash, envelope):
    """Reconstruct argmax evidence with QA's guards, before lexical comparison.

    This never substitutes an authored line or alters an envelope to make
    qa.ctc_review appear to pass. Forced alignment is deliberately not read.
    """
    if not isinstance(envelope, dict):
        return None
    receipt = envelope.get('receipt')
    if not isinstance(receipt, dict):
        return None
    receipt_path = Path(envelope.get('receipt_path', ''))
    if (not receipt_path.is_file() or qa.digest(receipt_path) != envelope.get('receipt_sha256')
            or json.loads(receipt_path.read_text()) != receipt):
        return None
    binding, greedy = receipt.get('binding', {}), receipt.get('greedy_decode', {})
    if not isinstance(binding, dict) or not isinstance(greedy, dict):
        return None
    model = binding.get('model', {})
    if not isinstance(model, dict):
        return None
    states = envelope.get('actual_model_file_states')
    if not isinstance(states, dict) or not states:
        return None
    try:
        if any(file_state(Path(path)) != state for path, state in states.items()):
            return None
    except OSError:
        return None
    hashes = model.get('file_sha256', {})
    required = {'config.json', 'vocab.json', 'preprocessor_config.json'}
    actual_script = qa.digest(qa.ROOT/'scripts/story_voice_ctc_align.py')
    if (receipt.get('id') != line.get('id') or receipt.get('text') != line.get('text')
            or binding.get('audio_sha256') != clip_hash
            or binding.get('text_sha256') != qa.text_hash(line['text'])
            or binding.get('source_manifest_sha256') != manifest_hash
            or binding.get('engine') != qa.CTC_ENGINE
            or model.get('model_id') != qa.CTC_MODEL_ID or model.get('revision') != qa.CTC_REVISION
            or not isinstance(hashes, dict) or not required.issubset(hashes)
            or not any(name.endswith(('.bin', '.safetensors')) for name in hashes)
            or any(not isinstance(value, str) or not SHA.fullmatch(value) for value in hashes.values())
            or model.get('fingerprint') != qa.text_hash(json.dumps(hashes, sort_keys=True))
            or binding.get('script_sha256') != actual_script
            or envelope.get('actual_script_sha256') != actual_script
            or greedy.get('method') != qa.CTC_METHOD
            or greedy.get('authored_initial_prompt', 'missing') is not None
            or greedy.get('unknown_tokens') != []):
        return None
    ids, blank, vocab = greedy.get('argmax_token_ids'), greedy.get('blank_token_id'), envelope.get('vocab')
    if (not isinstance(ids, list) or not ids or any(type(i) is not int or i < 0 for i in ids)
            or type(blank) is not int or not isinstance(vocab, dict)
            or any(not isinstance(label, str) or type(index) is not int for label, index in vocab.items())
            or len(set(vocab.values())) != len(vocab) or blank != vocab.get('<pad>')
            or greedy.get('argmax_token_ids_sha256') != qa.text_hash(json.dumps(ids, separators=(',', ':')))
            or envelope.get('vocab_sha256') != hashes['vocab.json']):
        return None
    probabilities = greedy.get('argmax_token_probabilities')
    if (not isinstance(probabilities, list) or len(probabilities) != len(ids)
            or any(type(p) not in (int, float) or not math.isfinite(p) or not 0 <= p <= 1 for p in probabilities)
            or greedy.get('frame_evidence_sha256') != qa.text_hash(json.dumps(
                {'argmax_token_ids': ids, 'argmax_token_probabilities': probabilities},
                sort_keys=True, separators=(',', ':')))):
        return None
    collapsed, previous = [], None
    for token in ids:
        if token != previous and token != blank:
            collapsed.append(token)
        previous = token
    inverse = {index: label for label, index in vocab.items()}
    if greedy.get('token_id_to_label') != {str(index): label for index, label in inverse.items()}:
        return None
    labels = [inverse.get(token) for token in collapsed]
    if any(not isinstance(label, str) or len(label) != 1 for label in labels):
        return None
    transcript = ''.join(labels).replace('|', ' ').strip()
    if collapsed != greedy.get('collapsed_token_ids') or transcript != greedy.get('transcript'):
        return None
    return transcript


def word_spans(tokens):
    offset, spans = 0, []
    for token in tokens:
        spans.append((offset, offset+len(token)))
        offset += len(token)
    return spans


def lexical_comparison(source, transcript):
    """Whole named tokens at exact character positions, then literal join.

    Name replacements inside joined/split observed words are refused. Each
    named pair must replace a complete token with the same character extent.
    Capitalization of the authored token is only a proposal filter; the root
    reviewer must explicitly identify each pair as a name in its approval.
    """
    expected, observed = qa.words(source), qa.words(transcript)
    if not expected or not observed or expected == observed:
        return None
    source_tokens = re.findall(r'\w+', unicodedata.normalize('NFC', source))
    expected_spans, observed_spans = word_spans(expected), word_spans(observed)
    if expected_spans[-1][1] != observed_spans[-1][1]:
        return None
    observed_positions = {span: index for index, span in enumerate(observed_spans)}
    variants, corrected = [], list(observed)
    for expected_index, expected_word in enumerate(expected):
        observed_index = observed_positions.get(expected_spans[expected_index])
        if observed_index is None or expected_word == observed[observed_index]:
            continue
        observed_word = observed[observed_index]
        if (not source_tokens[expected_index][0].isupper()
                or not qa.named_spelling_equivalent(expected_word, observed_word)):
            continue
        variants.append({'expected_index': expected_index, 'observed_index': observed_index,
                         'expected': expected_word, 'observed': observed_word})
        corrected[observed_index] = expected_word
    if ''.join(expected) != ''.join(corrected):
        return None
    return {'expected_tokens': expected, 'observed_tokens': observed,
            'named_spelling_variants': variants,
            'accept_word_segmentation': expected != corrected}


def proposal(line, clip_hash, manifest_hash, envelope):
    transcript = validated_greedy(line, clip_hash, manifest_hash, envelope)
    if transcript is None:
        return {'id': line['id'], 'status': 'rejected', 'reason': 'invalid_current_free_CTC_evidence'}
    comparison = lexical_comparison(line['text'], transcript)
    if comparison is None:
        return {'id': line['id'], 'status': 'rejected', 'reason': 'not_a_strict_named_spelling_or_segmentation_variant',
                'transcript': transcript}
    receipt = envelope['receipt']
    template = {'id': line['id'], 'status': 'proposal_not_approved', 'channel': VERSION,
                'reviewed_by': None, 'reason': None, 'listening_verdict': None,
                'clip_sha256': clip_hash, 'text_sha256': qa.text_hash(line['text']),
                'source_manifest_sha256': manifest_hash,
                'receipt_sha256': envelope['receipt_sha256'],
                'transcript_sha256': qa.text_hash(transcript),
                'frame_evidence_sha256': receipt['greedy_decode']['frame_evidence_sha256'],
                'ctc_script_sha256': envelope['actual_script_sha256'],
                'qa_script_sha256': qa.digest(Path(qa.__file__)),
                'variant_script_sha256': qa.digest(Path(__file__)),
                'model_fingerprint': receipt['binding']['model']['fingerprint'],
                **comparison}
    return {'id': line['id'], 'status': 'root_review_required', 'requires_root_review': True,
            'transcript': transcript, 'source_text': line['text'], 'approval_template': template,
            'listening_verdict': None}


def review(line, clip_hash, manifest_hash, records, approvals):
    """Return evidence only for one explicit current, exact root approval."""
    envelope = records.get(line['id'], {})
    result = proposal(line, clip_hash, manifest_hash, envelope)
    if result['status'] != 'root_review_required':
        return None
    approval = approvals.get(line['id']) if isinstance(approvals, dict) else None
    if not isinstance(approval, dict):
        return None
    template = result['approval_template']
    if (approval.get('status') != STATUS or approval.get('id') != line['id']
            or not isinstance(approval.get('reviewed_by'), str)
            or not approval['reviewed_by'].casefold().startswith('root')
            or not isinstance(approval.get('reason'), str) or not approval['reason'].strip()
            or approval.get('listening_verdict', 'missing') is not None):
        return None
    if (set(approval) != set(template) or type(approval.get('accept_word_segmentation')) is not bool
            or not isinstance(approval.get('named_spelling_variants'), list)):
        return None
    for pair in approval['named_spelling_variants']:
        if (not isinstance(pair, dict) or set(pair) != {'expected_index', 'observed_index', 'expected', 'observed'}
                or type(pair.get('expected_index')) is not int or type(pair.get('observed_index')) is not int
                or not isinstance(pair.get('expected'), str) or not isinstance(pair.get('observed'), str)):
            return None
    for key, value in template.items():
        if key not in {'status', 'reviewed_by', 'reason'} and approval.get(key, 'missing') != value:
            return None
    return {'resolution': 'root_approved_unprompted_CTC_explicit_lexical_variants',
            'method': VERSION, 'clip_sha256': clip_hash,
            'source_text_sha256': qa.text_hash(line['text']), 'source_manifest_sha256': manifest_hash,
            'transcript': result['transcript'], 'receipt_sha256': envelope['receipt_sha256'],
            'model': copy.deepcopy(envelope['receipt']['binding']['model']),
            'engine': qa.CTC_ENGINE, 'greedy_method': qa.CTC_METHOD,
            'named_spelling_variants': copy.deepcopy(template['named_spelling_variants']),
            'accept_word_segmentation': template['accept_word_segmentation'],
            'approval': copy.deepcopy(approval), 'listening_verdict': None,
            'note': 'Technical full-word spelling evidence only; signal, timing, acting and voice identity require their own checks.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, required=True)
    parser.add_argument('--qa-report', type=Path, required=True)
    parser.add_argument('--ctc-report', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--root-approvals', type=Path)
    parser.add_argument('--dry-run', action='store_true', help='Explicit diagnostic mode; no adoption exists.')
    args = parser.parse_args()
    run = args.run_dir.resolve()
    output = args.output_dir.resolve() if args.output_dir else run/'ctc-lexical-variants'
    paths = [run, args.qa_report.resolve(), args.ctc_report.resolve(), output]
    if args.root_approvals:
        paths.append(args.root_approvals.resolve())
    if any(not path.is_relative_to(run) for path in paths[1:]) or not run.is_relative_to(qa.PRIVATE.resolve()):
        parser.error('All reports and outputs must remain within the private run.')
    manifest_path = run/'lines.private.json'
    manifest, current_qa = json.loads(manifest_path.read_text()), json.loads(args.qa_report.read_text())
    manifest_hash, qa_hash = qa.digest(manifest_path), qa.digest(args.qa_report)
    if current_qa.get('manifest_sha256') != manifest_hash:
        raise ValueError('QA_source_manifest_mismatch')
    lines = {line['id']: line for line in manifest['lines']}
    selected = {row['id'] for row in current_qa['failures']}
    if not selected <= lines.keys():
        raise ValueError('unknown_QA_failure_ID')
    records = load_records(args.ctc_report, output)
    approvals = json.loads(args.root_approvals.read_text()).get('approvals', {}) if args.root_approvals else {}
    results = []
    for ident in sorted(selected):
        line, audio = lines[ident], run/'clips'/(ident+'.mp3')
        audio_hash = qa.digest(audio)
        if current_qa.get('clip_sha256', {}).get(ident) != audio_hash:
            results.append({'id': ident, 'status': 'rejected', 'reason': 'QA_current_audio_mismatch'})
            continue
        row = proposal(line, audio_hash, manifest_hash, records.get(ident, {}))
        if args.root_approvals and row['status'] == 'root_review_required':
            proof = review(line, audio_hash, manifest_hash, records, approvals)
            if proof:
                row.update(status='root_approved_private_evidence', proof=proof)
            elif ident in approvals:
                row.update(status='rejected', reason='invalid_or_stale_explicit_root_approval')
        results.append(row)
    if qa.digest(manifest_path) != manifest_hash or qa.digest(args.qa_report) != qa_hash:
        raise ValueError('Source_or_QA_changed_during_proposals')
    report = {'method': VERSION, 'requires_root_review': True, 'no_QA_adoption': True,
              'source_manifest_sha256': manifest_hash, 'qa_report_sha256': qa_hash,
              'ctc_report_sha256': qa.digest(args.ctc_report), 'results': results,
              'QA_failure_records': len(current_qa['failures']), 'unique_flagged_IDs': len(selected),
              'listening_verdict': None}
    qa.save(output/'proposals.private.json', report)
    print(json.dumps({'checked': len(results), 'statuses': dict(Counter(row['status'] for row in results))}))


if __name__ == '__main__':
    main()
