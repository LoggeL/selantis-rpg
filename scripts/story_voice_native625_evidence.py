#!/usr/bin/env python3
"""Offline, one-case child evidence guard; never creates a parent ASR/QC cache.

build_template() prepares an unapproved review document. validate() is read-only
and only succeeds after explicit root review AND a byte-identical parent import.
Timing and acting remain outside this contract.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import re
import story_voice_vocal_qc as qc
import story_voice_qa as protected_qa

ID = 'story-625496d155f52051d7a52069'
SOURCE = 'Ugh. Dann … dann laufe ich eben … bis ich umfalle.'
VOICE = 'Zubenelgenubi'
TTS_MODEL = 'gemini-3.8-flash-tts'
BODY = ['dann', 'dann', 'lauf', 'ich', 'eben', 'bis', 'ich', 'umfalle']
CTC_MODEL = 'jonatasgrosman/wav2vec2-large-xlsr-53-german'
CTC_REVISION = '4b8a02957378d0f2da2ef74091156b032c485a89'
CONTRACT = 'native625-child-evidence-v1'

class EvidenceError(ValueError):
    pass

def require(ok, message):
    if not ok:
        raise EvidenceError(message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()

def read(path):
    return json.loads(Path(path).read_text())

def file_hash(path):
    return digest(Path(path).read_bytes())

def tokens(text):
    return re.findall(r'[a-zäöüß]+', text.lower())

def one(rows, key, value):
    matches = [r for r in rows if r.get(key) == value]
    require(len(matches) == 1, 'Evidence must contain exactly one scoped record.')
    return matches[0]

def jsonl(path):
    return [json.loads(s) for s in Path(path).read_text().splitlines() if s.strip()]

def source_row(manifest):
    row = one(manifest['lines'], 'id', ID)
    require(row['text'] == SOURCE and row['speaker'] == 'azar', 'Exact 625 source/speaker required.')
    return row

def validate_ctc(value, audio_hash, source_hash, manifest_hash, qa_hash):
    require(value['id'] == ID and value['text'] == SOURCE, 'CTC ID/source differs.')
    binding = value['binding']
    require(binding['audio_sha256'] == audio_hash and binding['text_sha256'] == source_hash
            and binding['source_manifest_sha256'] == manifest_hash
            and binding['qa_report_sha256'] == qa_hash, 'CTC audio/source/child-QA binding differs.')
    require(binding['engine'] == 'story-german-ctc-expanded-blank-v2'
            and binding['model']['model_id'] == CTC_MODEL
            and binding['model']['revision'] == CTC_REVISION
            and binding['model'].get('fingerprint') == '1a1dd773490ce94681628574d3f74813827bb8858c662dcc7ab41c4fe3f88b7f', 'CTC model/engine differs.')
    driver = Path(__file__).with_name('story_voice_ctc_align.py')
    require(binding.get('script_sha256') == file_hash(driver), 'Protected CTC producer differs.')
    model = binding['model']; directory = Path(model['local_directory'])
    required_files = {'config.json', 'preprocessor_config.json', 'pytorch_model.bin', 'special_tokens_map.json', 'vocab.json'}
    require(directory.is_absolute() and set(model.get('file_sha256', {})) == required_files,
            'Actual cached CTC model identity is incomplete.')
    for name, expected_hash in model['file_sha256'].items():
        hasher = hashlib.sha256()
        with (directory/name).open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024*1024), b''):
                hasher.update(chunk)
        require(hasher.hexdigest() == expected_hash, 'Actual cached CTC model bytes differ.')
    greedy = value['greedy_decode']
    require(greedy.get('authored_initial_prompt') is None and greedy.get('unknown_tokens') == []
            and greedy.get('method') == 'unprompted_acoustic_argmax_CTC_blank_repeat_collapse',
            'Free CTC must have no authored prompt or unknown tokens.')
    ids, probs = greedy['argmax_token_ids'], greedy['argmax_token_probabilities']
    require(len(ids) == len(probs) > 0 and all(type(i) is int and i >= 0 for i in ids), 'Invalid CTC frames.')
    require(all(isinstance(p, (int, float)) and math.isfinite(p) and 0 <= p <= 1 for p in probs), 'Invalid CTC probabilities.')
    require(digest(json.dumps(ids, separators=(',', ':')).encode()) == greedy['argmax_token_ids_sha256'], 'CTC raw IDs hash differs.')
    # Reconstruct the original driver's JSON raw-frame digest, never forced timing.
    packed = json.dumps({'argmax_token_ids': ids, 'argmax_token_probabilities': probs}, sort_keys=True, separators=(',', ':')).encode()
    require(digest(packed) == greedy['frame_evidence_sha256'], 'CTC frame evidence hash differs.')
    collapsed, previous = [], None
    for i in ids:
        if i != previous and i != greedy['blank_token_id']:
            collapsed.append(i)
        previous = i
    require(collapsed == greedy['collapsed_token_ids'], 'CTC collapse differs.')
    labels = greedy['token_id_to_label']
    actual = ''.join(labels[str(i)] for i in collapsed).replace('|', ' ').strip()
    require(actual == greedy['transcript'], 'CTC transcript differs from actual argmax frames.')
    # Only these independent lexical anchors are used. No is/unfalle repair.
    require(tokens(actual)[:4] == ['dann', 'dann', 'laufe', 'ich'], 'Free CTC must actually retain both Dann and laufe ich.')
    return actual

def build_template(child_run, child_qa, qc_record, qc_batch, ctc_record):
    child = Path(child_run).resolve()
    paths = {'child_manifest': child/'lines.private.json', 'child_profiles': child/'profiles.private.json',
             'child_prepared': child/'prepared.json', 'child_snapshot': child/'parent-snapshot.private.json',
             'child_requests': child/'requests.jsonl', 'child_provider_raw': child/'responses.private.jsonl',
             'child_receipt': child/'raw'/f'{ID}.receipt.json', 'child_wav': child/'raw'/f'{ID}.wav',
             'child_mp3': child/'clips'/f'{ID}.mp3', 'child_qa': Path(child_qa).resolve(),
             'qc_record': Path(qc_record).resolve(), 'ctc_record': Path(ctc_record).resolve()}
    batch = Path(qc_batch).resolve()
    for name in ['prepared.json', 'audio-snapshot.private.json', 'requests.jsonl', 'responses.private.jsonl', 'collection.private.json', 'job.json', 'submit-intent.private.json']:
        paths['qc_' + name] = batch/name
    require(all(p.is_file() for p in paths.values()), 'An actual evidence artifact is missing.')
    manifest = read(paths['child_manifest']); row = source_row(manifest)
    profile = read(paths['child_profiles'])['speakers']['azar']
    require(profile['google_voice'] == VOICE and manifest['model'] == TTS_MODEL, 'Fixed voice/model differs.')
    receipt = read(paths['child_receipt']); audio_hash = file_hash(paths['child_mp3']); source_hash = digest(SOURCE.encode())
    require(receipt['id'] == ID and receipt['status'] == 'complete' and receipt.get('backend') == 'batch' and receipt['model'] == TTS_MODEL
            and receipt['mp3_sha256'] == audio_hash and receipt['wav_sha256'] == file_hash(paths['child_wav']), 'Actual TTS receipt differs.')
    provider = one(jsonl(paths['child_provider_raw']), 'key', ID)['response']
    require(provider['modelVersion'] == TTS_MODEL and len(provider['candidates']) == 1,
            'Actual TTS provider model/candidate differs.')
    audio_parts = provider['candidates'][0]['content']['parts']
    require(len(audio_parts) == 1 and audio_parts[0]['inlineData']['mimeType'] == 'audio/wav'
            and base64.b64decode(audio_parts[0]['inlineData']['data'], validate=True) == paths['child_wav'].read_bytes(),
            'Actual TTS raw provider WAV differs.')
    request = one(jsonl(paths['child_requests']), 'key', ID)['request']
    require(request['generationConfig']['speechConfig']['voiceConfig']['voice'] == VOICE, 'Actual TTS request voice differs.')
    require(digest(json.dumps(request, sort_keys=True).encode()) == receipt['request_sha256'], 'TTS request hash differs.')
    event = receipt['delivery_override']
    require(event.get('type') == 'explicit_vocal_events' and event['source_text_sha256'] == source_hash
            and event['vocal_events'] == [{'word_index': 0, 'source_word': 'Ugh.', 'tag': '<groan>'}]
            and request['contents'][0]['parts'][0]['text'] == '<groan>. Dann … dann laufe ich eben … bis ich umfalle.', 'Native source gesture substitution differs.')
    snapshot = read(paths['child_snapshot'])
    require(snapshot['modified_request_sha256'][ID] == receipt['request_sha256']
            and snapshot['source_text_sha256'][ID] == source_hash
            and snapshot['fixed_google_voices'][ID] == VOICE, 'Child TTS snapshot differs.')
    prepared = read(paths['child_prepared'])
    require(prepared['model'] == TTS_MODEL and all(file_hash(child/name) == h for name, h in prepared['frozen_sha256'].items()), 'Child freeze differs.')
    qa = read(paths['child_qa']); take = one(qa['takes'], 'id', ID)
    require(qa['clip_sha256'][ID] == audio_hash and take['text_sha256'] == source_hash
            and take['signal']['silent'] is False and take['signal']['seconds'] == receipt['seconds'], 'Actual child QA differs.')
    require(qa.get('version') == protected_qa.VERSION and
            (qa.get('model') == protected_qa.MODEL or
             (isinstance(qa.get('model'), str) and qa['model'].startswith(protected_qa.MODEL + ':/')))
            and qa.get('manifest_sha256') == file_hash(paths['child_manifest']),
            'Child QA producer/model/manifest differs.')
    signal = take['signal']
    metrics = {'seconds', 'decoded_samples', 'peak', 'rms', 'clipped_fraction',
               'leading_silence_seconds', 'trailing_silence_seconds', 'last_frame_rms'}
    require(metrics <= set(signal) and type(signal.get('silent')) is bool
            and all(type(signal[k]) in (int, float) and math.isfinite(signal[k]) and signal[k] >= 0 for k in metrics)
            and type(signal['decoded_samples']) is int and signal['decoded_samples'] > 0
            and signal['peak'] > 0 and signal['rms'] > 0 and signal['clipped_fraction'] <= 1,
            'Child QA signal metrics are incomplete/nonfinite.')
    require(protected_qa.signal_failures(signal, len(protected_qa.words(SOURCE))) == [],
            'Protected signal checks reject child audio.')
    require(set(take['reasons']) <= {'asr_lexical_mismatch_requires_review'}, 'Unaccounted technical child QA failure.')
    record = read(paths['qc_record'])
    require(record['id'] == ID and record['clip_sha256'] == audio_hash
            and record['source_audio_sha256'] == audio_hash and record['upload_sha256'] == audio_hash
            and record['source_text_sha256'] == source_hash and record['prompt'] == qc.PROMPT
            and record['model'] == qc.MODEL and all(record.get(k) == v for k, v in qc.cache_metadata().items()), 'Actual child QC binding/model/prompt differs.')
    observation = qc.response_observation(record['response'])
    require(observation['transcript'] == record['transcript'] and tokens(record['transcript']) == BODY, 'Complete QC body, including both Dann, is required.')
    require(observation['events'] == [{'category': 'groan', 'description': 'exhausted sigh or groan', 'vocal_sound': 'haah', 'confidence': .85}], 'Exactly the actual single source-groan observation is required.')
    require(one(jsonl(paths['qc_responses.private.jsonl']), 'key', ID)['response'] == record['response'], 'QC provider raw response differs.')
    qrequest = one(jsonl(paths['qc_requests.jsonl']), 'key', ID)['request']
    require(qrequest == qc.request_for(paths['child_mp3'].read_bytes()), 'QC request is not the expected blind actual-audio request.')
    qs = read(paths['qc_audio-snapshot.private.json'])
    clip = one(qs['clips'], 'id', ID)
    require(Path(qs['source_run']).resolve() == child and qs['source_manifest_sha256'] == file_hash(paths['child_manifest'])
            and clip['clip_sha256'] == audio_hash and clip['source_text_sha256'] == source_hash, 'QC source-run/manifest snapshot differs.')
    qc_prepared = read(paths['qc_prepared.json'])
    qc_collection = read(paths['qc_collection.private.json'])
    qc_job = read(paths['qc_job.json'])
    qc_intent = read(paths['qc_submit-intent.private.json'])
    require(all(value.get('model') == qc.MODEL for value in [qs, qc_prepared, qc_collection, qc_job, qc_intent]),
            'QC provider ledger model differs.')
    require(qs['prompt'] == qc.PROMPT and qc_prepared['input_sha256'] == file_hash(paths['qc_requests.jsonl'])
            and qc_intent['input_sha256'] == qc_prepared['input_sha256'], 'QC blind request ledger differs.')
    require(qc_collection['failures'] == [] and qc_collection['collected'] == qc_collection['expected']
            and qc_job['state'] == 'JOB_STATE_SUCCEEDED' and qc_intent['state'] == 'CONFIRMED',
            'Actual QC provider collection is incomplete.')
    ctc = read(paths['ctc_record'])
    actual_ctc = validate_ctc(ctc, audio_hash, source_hash, file_hash(paths['child_manifest']), file_hash(paths['child_qa']))
    evidence = {'contract': CONTRACT, 'id': ID, 'source': SOURCE, 'voice': VOICE, 'tts_model': TTS_MODEL,
                'source_run': str(child), 'audio_sha256': audio_hash, 'source_text_sha256': source_hash,
                'files': {k: {'path': str(p.resolve()), 'sha256': file_hash(p)} for k, p in paths.items()},
                'actual_QC': observation, 'actual_free_CTC': actual_ctc,
                'source_event': {'source_token_index': 0, 'source_token': 'ugh', 'event_indices': [0]},
                'word_variant': {'source': 'laufe', 'observed': 'lauf', 'person': 'first_singular', 'scope': ID},
                'producer_sha256': {'protected_qa': file_hash(Path(protected_qa.__file__)),
                                   'protected_ctc': file_hash(Path(__file__).with_name('story_voice_ctc_align.py')),
                                   'qc_helper': file_hash(Path(qc.__file__))},
                'timing_approval': None, 'listening_verdict': None}
    return {'evidence': evidence, 'evidence_sha256': digest(canonical(evidence)), 'root_approval': None}

def validate(parent_run, document):
    """Called by a finalizer with an explicit reviewed document after real import."""
    doc = read(document) if isinstance(document, (str, Path)) else document
    e = doc['evidence']; require(e['contract'] == CONTRACT and e['id'] == ID and e['source'] == SOURCE, 'One-case evidence scope differs.')
    require(doc['evidence_sha256'] == digest(canonical(e)), 'Review evidence hash differs.')
    approval = doc.get('root_approval')
    require(isinstance(approval, dict) and approval.get('status') == 'approved_native625_evidence'
            and isinstance(approval.get('reviewed_by'), str) and approval['reviewed_by'].startswith('root ') and len(approval['reviewed_by'].strip()) > 5
            and isinstance(approval.get('reason'), str) and len(approval['reason'].strip()) >= 20 and len(tokens(approval['reason'])) >= 4
            and approval.get('id') == ID
            and approval.get('audio_sha256') == e['audio_sha256']
            and approval.get('evidence_sha256') == doc['evidence_sha256'], 'Explicit current root approval required.')
    f = e['files']
    current = build_template(e['source_run'], f['child_qa']['path'], f['qc_record']['path'],
                             Path(f['qc_prepared.json']['path']).parent, f['ctc_record']['path'])
    require(current['evidence'] == e, 'Reviewed child evidence changed.')
    parent = Path(parent_run).resolve(); parent_manifest = read(parent/'lines.private.json')
    parent_row = source_row(parent_manifest)
    require(parent_row == source_row(read(f['child_manifest']['path'])), 'Parent full source row differs from frozen child.')
    require(parent_manifest['model'] == TTS_MODEL, 'Parent model differs.')
    require(read(parent/'profiles.private.json')['speakers']['azar']['google_voice'] == VOICE, 'Parent fixed voice differs.')
    require(file_hash(parent/'clips'/f'{ID}.mp3') == e['audio_sha256'], 'Real parent import must be byte-identical to child.')
    require(file_hash(parent/'raw'/f'{ID}.receipt.json') == f['child_receipt']['sha256']
            and file_hash(parent/'raw'/f'{ID}.wav') == f['child_wav']['sha256'],
            'Parent imported raw WAV/receipt must retain actual child provenance.')
    require(parent != Path(e['source_run']), 'Parent must not impersonate child run.')
    journal_path = Path(e['source_run'])/'import.private.json'
    journal = read(journal_path)
    require(journal.get('state') == 'IMPORTED' and journal.get('selected_ids') == [ID]
            and journal.get('new_mp3_sha256') == {ID: e['audio_sha256']}
            and journal.get('parent_snapshot_sha256') == f['child_snapshot']['sha256'],
            'Actual exact-625 root import journal required.')
    return {'id': ID, 'source_run': e['source_run'], 'audio_sha256': e['audio_sha256'],
            'source': SOURCE, 'child_receipt_sha256': f['child_receipt']['sha256'],
            'producer_sha256': e['producer_sha256'], 'import_journal_path': str(journal_path),
            'import_journal_sha256': file_hash(journal_path),
            'evidence_sha256': doc['evidence_sha256'], 'actual_QC': e['actual_QC'],
            'source_event': e['source_event'], 'word_variant': e['word_variant'],
            'timing_approval': None, 'listening_verdict': None}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    template = sub.add_parser('template')
    for name in ['child-run', 'child-qa', 'qc-record', 'qc-batch', 'ctc-record']:
        template.add_argument('--' + name, required=True, type=Path)
    template.add_argument('--output', required=True, type=Path)
    check = sub.add_parser('validate'); check.add_argument('--parent-run', required=True, type=Path); check.add_argument('--review', required=True, type=Path)
    args = parser.parse_args()
    if args.command == 'template':
        result = build_template(args.child_run, args.child_qa, args.qc_record, args.qc_batch, args.ctc_record)
        require(not args.output.exists(), 'Refusing to overwrite an existing review.')
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    else:
        print(json.dumps(validate(args.parent_run, args.review), ensure_ascii=False))

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, qc.core.SafeError):
        raise SystemExit('Native625 evidence rejected; no cache, import, or approval mutation.')
