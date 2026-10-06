#!/usr/bin/env python3
"""Private, explicitly reviewed complementary full-word evidence for two takes.

The two actual unprompted ASRs must cover every nonname source word literally.
The one differing name is supported by unique, literal FREE argmax CTC labels
and exact neighboring words, never forced alignment or a name alias rule.
No inference, API, audio/source edits, automatic approvals or QA adoption.

proof_template(run, line, bindings) validates current evidence and proposes an
unapproved root template. review(run, line, bindings, approval) returns a proof
only after an explicit complete current root approval. bindings contains
flash_record, pro_record, ctc_envelope from lexical.load_records,
qa_report_path and root_veto_report_path (absolute or run-relative paths).
"""
from __future__ import annotations

import argparse
from collections import Counter
import copy
import json
import math
from pathlib import Path
import re
import unicodedata

import story_voice_common as common
from story_voice_common import core
import story_voice_ctc_align as ctc
import story_voice_ctc_lexical_variants as lexical
import story_voice_pro_asr as pro
import story_voice_qa as qa
import story_voice_transcribe as flash

VERSION = 'story-two-case-complementary-full-word-evidence-v1'
APPROVED = 'approved_complementary_full_word_evidence'
CASES = {
    'story-fb6a2d0a5db04b2db6fd944f': {
        'text': 'Ah, die junge Dame! Foltans Freunde essen bei mir umsonst. Ehrensache.',
        'word_index': 4, 'name': 'foltans', 'flash_observed': 'voltans',
        'pro_observed': 'volltanz', 'permitted_CTC_segmentation': None},
    'story-7b35ecb5658807b31efe6ab8': {
        'text': 'Steine hat man nicht immer. Jetzt mit Worten. Rede mit ihm, Lia. Er soll dich ansehen, nicht Jorin.',
        'word_index': 11, 'name': 'lia', 'flash_observed': 'lea',
        'pro_observed': 'lea', 'permitted_CTC_segmentation': ['l', 'ia']},
}
BINDING_KEYS = {'flash_record', 'pro_record', 'ctc_envelope', 'qa_report_path', 'root_veto_report_path'}
WORD_FAILURES = {'asr_lexical_mismatch_requires_review', 'asr_check_failed_ValueError'}


def require(condition, message):
    if not condition:
        raise core.SafeError(message)


def exact_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def private_file(run, value):
    path = Path(value)
    path = (path if path.is_absolute() else run/path).resolve()
    require(path.is_relative_to(run) and path.is_file(), 'Complementary evidence file must remain in the private run.')
    return path


def body_evidence(line, record, expected_observed):
    expected, observed = qa.words(line['text']), qa.words(record['transcript'])
    case = CASES[line['id']]
    require(len(expected) == len(observed), 'Complementary ASR cannot insert, omit or reorder words.')
    index = case['word_index']
    require(expected[index] == case['name'] and observed[index] in {case['name'], expected_observed},
            'ASR name observation is outside this individually scoped case.')
    require(all(aa == bb for i, (aa, bb) in enumerate(zip(expected, observed)) if i != index),
            'Every nonname ASR word must match the source literally.')
    return {'expected_tokens': expected, 'observed_tokens': observed,
            'all_source_differences': [{'word_index': i, 'expected': aa, 'observed': bb}
                                      for i, (aa, bb) in enumerate(zip(expected, observed)) if aa != bb],
            'selected_name_word_index': index, 'every_nonname_source_word_exact': True}


def freely_decoded_characters(envelope):
    """Actual nonblank repeat-collapse runs, retaining each emitted frame p."""
    greedy = envelope['receipt']['greedy_decode']
    ids, probabilities = greedy['argmax_token_ids'], greedy['argmax_token_probabilities']
    characters, index = [], 0
    while index < len(ids):
        token, end = ids[index], index+1
        while end < len(ids) and ids[end] == token:
            end += 1
        if token != greedy['blank_token_id']:
            label = greedy['token_id_to_label'][str(token)]
            folded = ' ' if label == '|' else unicodedata.normalize('NFC', label).casefold()
            for character in folded:
                characters.append({'character': character, 'raw_label': label, 'token_id': token,
                                   'frame_start': index, 'frame_end': end,
                                   'argmax_probabilities': probabilities[index:end],
                                   'minimum_probability': min(probabilities[index:end])})
        index = end
    return characters


def name_evidence(line, envelope):
    characters = freely_decoded_characters(envelope)
    text = ''.join(char['character'] for char in characters)
    matches = list(re.finditer(r'\w+', text))
    free_words = [match.group() for match in matches]
    require(free_words == qa.words(envelope['receipt']['greedy_decode']['transcript']),
            'Actual freely decoded word reconstruction differs.')
    case = CASES[line['id']]
    source = qa.words(line['text'])
    index, name = case['word_index'], case['name']
    left, right = source[max(0, index-2):index], source[index+1:index+3]
    choices = [(i, i+1, None) for i, word in enumerate(free_words) if word == name]
    split = case['permitted_CTC_segmentation']
    if split is not None:
        choices.extend((i, i+2, copy.deepcopy(split)) for i in range(len(free_words)-1)
                       if free_words[i:i+2] == split)
    require(len(choices) == 1, 'The complete literal name must occur exactly once in free CTC.')
    start, end, segmentation = choices[0]
    require(start >= len(left) and free_words[start-len(left):start] == left
            and free_words[end:end+len(right)] == right,
            'Two available source-exact neighbors on both sides are required.')
    context = left + free_words[start:end] + right
    hits = [i for i in range(len(free_words)-len(context)+1)
            if free_words[i:i+len(context)] == context]
    require(len(hits) == 1, 'The literal CTC name context is not unique.')
    selected = [char for match in matches[start:end]
                for char in characters[match.start():match.end()]]
    require(''.join(char['character'] for char in selected) == name,
            'Only the exact scoped l+ia segmentation may concatenate name letters.')
    require(all(char['minimum_probability'] >= .5 for char in selected),
            'Every emitted name-character argmax frame probability must be at least 0.5.')
    # A free decoder restart remains unresolved even when both ASRs normalize it.
    for length in range(3, min(6, len(source)+1)):
        authored = Counter(tuple(source[i:i+length]) for i in range(len(source)-length+1))
        heard = Counter(tuple(free_words[i:i+length]) for i in range(len(free_words)-length+1))
        require(not any(heard[words] > count for words, count in authored.items()),
                'Extra repeated source sequence in free CTC requires review.')
    return {'source_word_index': index, 'expected_name': name, 'actual_free_CTC_name_tokens': free_words[start:end],
            'explicit_name_segmentation': segmentation, 'CTC_word_start': start, 'CTC_word_end': end,
            'source_exact_left_neighbors': left, 'source_exact_right_neighbors': right,
            'unique_context_start': hits[0], 'literal_name_occurrence_count': len(choices),
            'characters': selected, 'minimum_name_frame_probability': min(char['minimum_probability'] for char in selected),
            'context': context}


def proof_template(run, line, bindings):
    """Validate original current evidence; return no approval or QA mutation."""
    run = Path(run).resolve()
    require(run.is_relative_to(qa.PRIVATE.resolve()), 'Complementary proof must use the private story bank.')
    require(isinstance(line, dict) and line.get('id') in CASES, 'Only the two explicitly scoped complementary cases are supported.')
    case = CASES[line['id']]
    require(line.get('text') == case['text'], 'The scoped authored source text changed.')
    require(isinstance(bindings, dict) and set(bindings) == BINDING_KEYS, 'Complete explicitly named complementary bindings required.')
    common.prepared(run)
    manifest_path = private_file(run, 'lines.private.json')
    manifest = json.loads(manifest_path.read_text())
    actual = [row for row in manifest['lines'] if row.get('id') == line['id']]
    require(len(actual) == 1 and actual[0] == line, 'Actual frozen source row differs.')
    ident, source_hash = line['id'], qa.text_hash(line['text'])
    audio_path = private_file(run, 'clips/'+ident+'.mp3')
    audio_hash, manifest_hash = qa.digest(audio_path), qa.digest(manifest_path)
    qa_path = private_file(run, bindings['qa_report_path'])
    veto_path = private_file(run, bindings['root_veto_report_path'])
    report = json.loads(qa_path.read_text())
    require(report.get('version') == qa.VERSION and (report.get('model') == qa.MODEL
            or str(report.get('model', '')).startswith(qa.MODEL+':')),
            'Current original QA decoder/version required.')
    require(report.get('manifest_sha256') == manifest_hash and report.get('clip_sha256', {}).get(ident) == audio_hash,
            'Current QA source/audio binding differs.')
    takes = [take for take in report.get('takes', []) if take.get('id') == ident]
    require(len(takes) == 1 and takes[0].get('text_sha256') == source_hash,
            'Current unique QA take required.')
    take = takes[0]
    signal = take.get('signal')
    require(isinstance(signal, dict) and type(signal.get('silent')) is bool
            and all(type(signal.get(key)) in (int, float) and math.isfinite(signal[key]) for key in
                    ['seconds', 'clipped_fraction', 'peak', 'trailing_silence_seconds',
                     'leading_silence_seconds', 'last_frame_rms', 'rms']), 'Complete finite physical QA metrics required.')
    require(not qa.signal_failures(signal, len(qa.words(line['text']))), 'Physical audio QA is not clean.')
    require(isinstance(take.get('reasons'), list) and set(take['reasons']) <= WORD_FAILURES,
            'An outstanding physical or independent word defect blocks complementary proof.')
    failures = report.get('failures')
    require(isinstance(failures, list) and all(isinstance(item, dict) and isinstance(item.get('reason'), str)
            for item in failures), 'Original QA failure ledger required.')
    selected_reasons = {item['reason'] for item in failures if item.get('id') == ident}
    require(selected_reasons == set(take['reasons']) and selected_reasons <= WORD_FAILURES,
            'A selected QA failure or inconsistent defect ledger blocks complementary proof.')
    vetoes = qa.load_lexical_veto_records(veto_path)
    diagnosis = qa.lexical_veto_review(run, line, audio_hash, vetoes)
    require(not diagnosis or (not diagnosis.get('applicable') and not diagnosis.get('binding_requires_review')),
            'Current or unresolved root lexical veto blocks complementary proof.')
    flash_record, pro_record = bindings['flash_record'], bindings['pro_record']
    require(isinstance(flash_record, dict) and flash_record.get('id') == ident
            and flash.cached_record(flash_record, audio_hash, source_hash)
            and flash_record.get('listening_verdict') is None, 'Actual current 3.8 ASR record required.')
    flash_path = private_file(run, 'independent-google-asr/'+ident+'.'+audio_hash[:16]+'.json')
    require(json.loads(flash_path.read_text()) == flash_record, 'Actual 3.8 cache file differs from the supplied raw record.')
    require(isinstance(pro_record, dict) and pro_record.get('id') == ident
            and pro_record.get('source_run') == str(run)
            and pro.cached_record(pro_record, audio_hash, source_hash), 'Actual current fully bound Pro record required.')
    pro_path = private_file(run, pro.FOLDER+'/'+ident+'.'+audio_hash[:16]+'.json')
    require(json.loads(pro_path.read_text()) == pro_record, 'Actual Pro cache file differs from the supplied raw record.')
    flash_body = body_evidence(line, flash_record, case['flash_observed'])
    pro_body = body_evidence(line, pro_record, case['pro_observed'])
    envelope = bindings['ctc_envelope']
    free_text = lexical.validated_greedy(line, audio_hash, manifest_hash, envelope)
    require(free_text is not None, 'Actual pinned unprompted free CTC frames/model/source/audio/script required.')
    ctc_path = private_file(run, envelope['receipt_path'])
    name = name_evidence(line, envelope)
    model = envelope['receipt']['binding']['model']
    config = json.loads((Path(model['local_directory'])/'config.json').read_text())
    stride, receptive = ctc.frame_geometry(config)
    samples = round(signal['seconds']*16000)
    greedy = envelope['receipt']['greedy_decode']
    require(len(greedy['argmax_token_ids']) == (samples-receptive)//stride+1,
            'Actual greedy frame count differs from current audio/model geometry.')
    receipt_path = private_file(run, 'raw/'+ident+'.receipt.json')
    wav_path = private_file(run, 'raw/'+ident+'.wav')
    receipt = json.loads(receipt_path.read_text())
    require(receipt.get('id') == ident and receipt.get('status') == 'complete'
            and receipt.get('mp3_sha256') == audio_hash and receipt.get('wav_sha256') == qa.digest(wav_path),
            'Current completed TTS WAV/MP3 receipt required.')
    evidence_files = {str(path.relative_to(run)): qa.digest(path) for path in
                      [manifest_path, audio_path, wav_path, receipt_path, qa_path, veto_path,
                       flash_path, pro_path, ctc_path]}
    batch = pro.private_path(run, pro_record['batch_scope_file']).parent
    for path in [pro.private_path(run, pro_record['batch_scope_file']),
                 pro.private_path(run, pro_record['batch_response_file']),
                 *[batch/name for name in ['prepared.json', 'pro-prepared.private.json',
                   'audio-snapshot.private.json', 'requests.jsonl', 'submit-intent.private.json', 'job.json']],
                 run/pro.FOLDER/'batch-reservations.private.json']:
        path = private_file(run, path)
        evidence_files[str(path.relative_to(run))] = qa.digest(path)
    drivers = {Path(module.__file__).name: qa.digest(Path(module.__file__))
               for module in [qa, flash, pro, lexical, ctc]}
    drivers[Path(__file__).name] = qa.digest(Path(__file__))
    return {'id': ident, 'status': 'root_review_required', 'reviewed_by': '', 'reason': '',
            'method': VERSION, 'clip_sha256': audio_hash, 'source_text_sha256': source_hash,
            'source_manifest_sha256': manifest_hash, 'source_row_sha256': qa.canonical_record_hash(line),
            'source_text': line['text'], 'expected_tokens': qa.words(line['text']),
            'flash_evidence': {'model': flash.MODEL, 'transcript': flash_record['transcript'],
                'record_sha256': qa.canonical_record_hash(flash_record),
                'raw_response_sha256': qa.canonical_record_hash(flash_record['response']),
                'prompt_sha256': qa.text_hash(flash_record['prompt']), **flash_body},
            'pro_evidence': {'model': pro.MODEL, 'transcript': pro_record['transcript'],
                'record_sha256': pro.object_hash(pro_record), 'raw_response_sha256': pro.object_hash(pro_record['response']),
                'prompt_sha256': qa.text_hash(pro_record['prompt']), 'contract': pro.metadata(),
                'request_sha256': pro_record['request_sha256'], 'scope_sha256': pro_record['scope_sha256'], **pro_body},
            'free_CTC_evidence': {'transcript': free_text, 'receipt_sha256': envelope['receipt_sha256'],
                'model': copy.deepcopy(model), 'engine': qa.CTC_ENGINE, 'method': qa.CTC_METHOD,
                'argmax_token_ids_sha256': greedy['argmax_token_ids_sha256'],
                'frame_evidence_sha256': greedy['frame_evidence_sha256'],
                'CTC_script_sha256': envelope['actual_script_sha256'],
                'geometry': {'frame_stride_samples': stride, 'frame_receptive_samples': receptive,
                             'decoded_16k_samples': samples, 'greedy_frame_count': len(greedy['argmax_token_ids'])},
                'name': name},
            'provenance_files_sha256': evidence_files, 'proof_drivers_sha256': drivers,
            'current_root_veto_diagnosis': diagnosis, 'provider_timestamps_used': False,
            'timing_approval': None, 'acting_approval': None, 'listening_verdict': None}


prooftemplate = proof_template


def review(run, line, bindings, approval=None):
    if approval is None:
        return None
    template = proof_template(run, line, bindings)
    require(isinstance(approval, dict) and set(approval) == set(template)
            and approval.get('status') == APPROVED
            and isinstance(approval.get('reviewed_by'), str) and approval['reviewed_by'].casefold().startswith('root')
            and isinstance(approval.get('reason'), str) and bool(approval['reason'].strip()),
            'Explicit complete root complementary-word approval required.')
    require(all(exact_json(approval[key]) == exact_json(value) for key, value in template.items()
                if key not in {'status', 'reviewed_by', 'reason'}),
            'Complementary approval differs from current exact source/raw/model/frame/file bindings.')
    return {'id': line['id'], 'resolution': 'root_approved_complementary_complete_full_word_evidence',
            'method': VERSION, 'clip_sha256': template['clip_sha256'],
            'source_text_sha256': template['source_text_sha256'], 'expected_tokens': template['expected_tokens'],
            'flash_evidence': copy.deepcopy(template['flash_evidence']),
            'pro_evidence': copy.deepcopy(template['pro_evidence']),
            'free_CTC_evidence': copy.deepcopy(template['free_CTC_evidence']),
            'provenance_files_sha256': copy.deepcopy(template['provenance_files_sha256']),
            'proof_drivers_sha256': copy.deepcopy(template['proof_drivers_sha256']),
            'approval': copy.deepcopy(approval), 'provider_timestamps_used': False,
            'timing_approval': None, 'acting_approval': None, 'listening_verdict': None,
            'note': 'Full source body words proved by two original unprompted ASRs; scoped name proved by literal free CTC labels. No phonetic alias, transcript rewriting or QA adoption.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['run-dir', 'qa-report', 'root-veto-report', 'ctc-report', 'flash-comparison', 'pro-comparison', 'output-dir']:
        parser.add_argument('--'+name, type=Path, required=True)
    parser.add_argument('--dry-run', action='store_true', help='Explicit diagnostic mode; no adoption option exists.')
    args = parser.parse_args()
    common.configure()
    run, output = args.run_dir.resolve(), args.output_dir.resolve()
    require(output.is_relative_to(run) and not output.exists(), 'Use a fresh output folder inside the private run.')
    reports = [args.qa_report, args.root_veto_report, args.ctc_report, args.flash_comparison, args.pro_comparison]
    report_hashes = {str(private_file(run, path.resolve()).relative_to(run)): qa.digest(path) for path in reports}
    manifest = json.loads((run/'lines.private.json').read_text())
    rows = {line['id']: line for line in manifest['lines']}
    def records(path):
        values = json.loads(path.read_text())['records']
        result = {record['id']: record for record in values}
        require(len(result) == len(values), 'Comparison records contain duplicate IDs.')
        return result
    flash_records, pro_records = records(args.flash_comparison), records(args.pro_comparison)
    ctc_records = lexical.load_records(args.ctc_report, output/'ctc-loader')
    proposals = {}
    for ident in CASES:
        bindings = {'flash_record': flash_records[ident], 'pro_record': pro_records[ident],
                    'ctc_envelope': ctc_records[ident], 'qa_report_path': args.qa_report.resolve(),
                    'root_veto_report_path': args.root_veto_report.resolve()}
        proposals[ident] = proof_template(run, rows[ident], bindings)
    require(all(qa.digest(run/name) == sha for name, sha in report_hashes.items()),
            'Input reports changed during complementary proposal preparation.')
    qa.save(output/'proposals.private.json', {'method': VERSION, 'requires_root_review': True,
            'no_QA_adoption': True, 'input_files_sha256': report_hashes,
            'proposals': proposals, 'listening_verdict': None})
    print(json.dumps({'state': 'UNAPPROVED_PRIVATE_COMPLEMENTARY_PROPOSALS', 'proposals': len(proposals)}))


if __name__ == '__main__':
    main()
