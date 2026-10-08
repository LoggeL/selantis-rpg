#!/usr/bin/env python3
"""Add separately approved external evidence after the frozen full921 build.

Offline only: no API, inference, transcript repair, audio imports or approvals.
Original word/timing failures and the numeric15 false verdicts remain immutable.
"""
from __future__ import annotations
import argparse
import base64
import copy
from contextlib import ExitStack
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import types
import part2_voice_evidence_publish as prior

base, batch, require = prior.base, prior.batch, prior.require
VERSION = 'part2-separate-external-evidence-publication-v1'
PRIOR_SHA = '0036f9afeb5287df790f51878d4324c109219f4f650d0836815daea2a4b2d6ed'
PRIOR_TEST_SHA = '8a8b93730ebe1a79dc6bb75b69ea931c7bb0eb07e39db9b68e41d0b41046d061'
GOOGLE = {
    'qc17': {'folder': 'sourcefree-google-qc-pilot16', 'count': 17, 'prefix': 'qc17', 'key_width': 3,
        'runner_sha256': '1dd449e965a73ab9c462cb94c5bf7d616382aef2b0b58f18581e43bfa98cdd19',
        'plan_sha256': '7a163bf22069ccd7ec4abf96a6c643006a27c3289eff6a85816df868b18b862c'},
    'remaining317': {'folder': 'sourcefree-google-qc-remaining', 'count': 317, 'prefix': 'qcr', 'key_width': 4,
        'runner_sha256': '6597acbe0ba4be7a6c1e8a47797b1611ec1e3195c8a462355f6e902e41a29567',
        'plan_sha256': 'bbf6a76f0a65d048a37fa4bd2be040188ba64b135e076a03f24e6aefb4a17ce4'}}
NUMERIC_PROOF_SHA = '0ce3cc8bcca3fc731931208070124d84b7a4311d397120dc25011dd74c49acb3'
NUMERIC_SCRIPT_SHA = '8e4b729f58f02a12621ddb7b638f58fcd647b609733182618a5dd1b33078e050'
TIMING15_RESULT_SHA = 'c24f03ab5c732d1e9fa3529ba14aa77ffbdfe5840dc31a29b12caadb0d896576'
digest, object_sha, read_raw = prior.digest, prior.object_sha, prior.read_raw


def google_external_key(spec, ordinal):
    return spec['prefix']+'-'+str(ordinal).zfill(spec['key_width'])


def pin_file(path, bound, expected=None):
    path = Path(path)
    require(path.is_absolute() and path.is_file() and not path.is_symlink(), 'Exact current evidence file required.')
    value = digest(path)
    require(expected is None or value == expected, 'External evidence bytes differ from their exact producer pin.')
    require(str(path) not in bound or bound[str(path)] == value, 'External producer pin conflicts with prior whole921 evidence.')
    bound[str(path)] = value
    return value


def definitions(path, expected):
    data = prior.frozen_runner_bytes(path, expected)
    module = types.ModuleType('part2_external_frozen_offline_definitions'); module.__file__ = str(path)
    exec(compile(data, str(path), 'exec'), module.__dict__)
    return module


def producer_files(folder, names, directories=()):
    files = [folder/name for name in names]
    for name in directories:
        directory = folder/name
        require(directory.is_dir() and not directory.is_symlink(), 'Complete original producer namespace missing.')
        files.extend(sorted(path for path in directory.iterdir() if path.is_file()))
    require(all(path.is_file() and not path.is_symlink() for path in files), 'Missing/symlinked whole producer evidence.')
    return files


def http_evidence(folder, job, snapshot, data, bound):
    """Bind actual bodies to receipt bytes and actual job/status/download objects."""
    http = folder/'http-raw'; intents = list(http.glob('*.intent.private.json'))
    require(intents and not list(http.glob('*.failure.private.json')), 'Actual HTTP outcomes must be complete and retained.')
    expected_files, post, get = set(), [], []
    for path in intents:
        token = path.name.removesuffix('.intent.private.json')
        receipt_path, raw_path = http/(token+'.receipt.private.json'), http/(token+'.response.private.bin')
        intent, receipt = batch.read(path), batch.read(receipt_path); raw = raw_path.read_bytes()
        require(intent.get('state') == 'ATTEMPT_RECORDED' and intent.get('method') in {'GET', 'POST'}
            and receipt == {'state': 'RESPONSE_RETAINED', 'sha256': batch.sha(raw), 'bytes': len(raw),
                'method': intent['method'], 'http_status': receipt.get('http_status')}
            and type(receipt['http_status']) is int and 200 <= receipt['http_status'] < 300,
            'Actual HTTP response bytes, method, status or receipt differ.')
        for item in [path, receipt_path, raw_path]: pin_file(item, bound); expected_files.add(item)
        (post if intent['method'] == 'POST' else get).append(raw)
    require(set(http.iterdir()) == expected_files and len(post) == 3 and data in get,
        'Complete once-only HTTP upload/create/download census differs.')
    def contains(values, obj):
        return any(raw.strip() and raw != data and read_json_bytes(raw) == obj for raw in values)
    require(contains(post, job['actual_creation_response']) and contains(get, snapshot['actual_provider_response']),
        'Actual retained HTTP bodies do not match the confirmed job and succeeded status.')
    uploaded = [read_json_bytes(raw) for raw in post if raw.strip()]
    uploaded_files = [obj['file'] for obj in uploaded if obj.get('file', {}).get('name') == job['input_file_name']]
    require(len(uploaded_files) == 1, 'Actual uploaded input-file receipt missing/ambiguous.')
    actual_file = uploaded_files[0]; request_data = (folder/'requests.jsonl').read_bytes()
    encoded_hash = base64.b64decode(actual_file.get('sha256Hash', ''), validate=True)
    require(actual_file.get('mimeType') == 'application/jsonl' and actual_file.get('state') == 'ACTIVE'
        and actual_file.get('source') == 'UPLOADED' and actual_file.get('sizeBytes') == str(len(request_data))
        and encoded_hash in {hashlib.sha256(request_data).digest(), batch.sha(request_data).encode()},
        'Actual provider uploaded file size/hash does not match the exact audio-blind request JSONL.')


def read_json_bytes(data):
    def pairs(values):
        obj = {}
        for key, value in values:
            require(key not in obj, 'Duplicate external provider JSON key.'); obj[key] = value
        return obj
    return json.loads(data, object_pairs_hook=pairs,
        parse_constant=lambda _: (_ for _ in ()).throw(batch.SafeError('Nonfinite external provider JSON.')))


def google_bundle(run, key, rows, takes, bound, root_binding):
    require(key in GOOGLE and isinstance(root_binding, dict), 'Exact supported Google producer bundle required.')
    spec = GOOGLE[key]; folder = run/spec['folder']
    runner_path, plan_path = folder/'runner.private.py', folder/'plan.private.json'
    runner = definitions(runner_path, spec['runner_sha256']); pin_file(plan_path, bound, spec['plan_sha256'])
    plan = runner.check()  # Only frozen read-only original inputs/audio-blind request verification.
    require(plan.get('selected_ids') == runner.IDS and len(runner.IDS) == len(set(runner.IDS)) == spec['count']
        and plan.get('source_free') is True and plan.get('authored_reference_text_metadata_in_model_input') is False
        and plan.get('timestamps_requested') is False and plan.get('model') == runner.MODEL == 'gemini-3.1-pro-preview',
        'Whole exact Google scope/model/source-free contract differs.')
    for path, value in plan['original_evidence_files_sha256'].items(): pin_file(path, bound, value)
    names = ['runner.private.py', 'safety_test.private.py', 'plan.private.json', 'requests.jsonl', 'submit-intent.private.json',
        'upload-start-intent.private.json', 'upload-finalize-intent.private.json', 'batch-create-intent.private.json',
        'job.private.json', 'collect-intent.private.json', 'completion.private.json', 'responses.provider-raw.private.jsonl']
    files = producer_files(folder, names, ['requests', 'call-intents', 'statuses', 'observations', 'http-raw'])
    expected_binding = {'files_sha256': {str(path): digest(path) for path in files},
        'execution_review': root_binding.get('execution_review'), 'independent_review': root_binding.get('independent_review')}
    require(root_binding == expected_binding, 'Root must explicitly bind the entire actual Google producer, not only a chosen row.')
    for path in files: pin_file(path, bound)
    review = prior.bound_ref(run, root_binding['execution_review'], bound)
    independent = prior.bound_ref(run, root_binding['independent_review'], bound)
    submit, job, collect, completion = (batch.read(folder/name) for name in
        ['submit-intent.private.json', 'job.private.json', 'collect-intent.private.json', 'completion.private.json'])
    require(submit.get('plan_sha256') == job.get('plan_sha256') == collect.get('plan_sha256') == completion.get('plan_sha256') == spec['plan_sha256']
        and submit.get('runner_sha256') == spec['runner_sha256'] and submit.get('model') == job.get('model') == runner.MODEL
        and submit.get('selected_ids') == runner.IDS and submit.get('max_model_requests') == job.get('request_count') == spec['count']
        and submit.get('max_batch_creates') == 1 and submit.get('credential_retained') is False
        and submit.get('root_execution_review_sha256') == root_binding['execution_review']['sha256']
        and submit.get('independent_review_sha256') == root_binding['independent_review']['sha256']
        and review.get('plan_sha256') == independent.get('plan_sha256') == spec['plan_sha256']
        and review.get('runner_sha256') == independent.get('runner_sha256') == spec['runner_sha256']
        and independent.get('status') == 'PASS_OFFLINE_EXECUTION_BOUNDARY' and independent.get('network_model_calls') == 0
        and review.get('status') == 'Root_reviewed_exact_execution'+str(spec['count'])
        and isinstance(review.get('reviewed_by'), str) and review['reviewed_by'].startswith('root ')
        and review.get('selected_ids') == runner.IDS and review.get('max_calls') == spec['count'] and review.get('model') == runner.MODEL
        and review.get('original_waveform_and_audio_blind_prompt_reviewed') is True,
        'Actual Root/independent execution reviews and once-only whole Google submission differ.')
    cost_field = 'cost_and_max2048_contract_explicitly_reviewed' if key == 'qc17' else 'cost_and_max4096_contract_explicitly_reviewed'
    require(review.get(cost_field) is True, 'Root must have reviewed the actual frozen maximum-output/cost contract before this existing submission.')
    if key == 'remaining317':
        old_qc17 = runner.pilot_completion_guard()  # Original17/16/1MAX remains intact; read-only, no reconcile.
        require(all(submit.get(field) == value for field, value in old_qc17.items())
            and review.get('actual_full_QC17_raw_individually_reviewed') is True
            and review.get('actual_QC17_raw_sha256') == old_qc17['actual_QC17_raw_sha256']
            and review.get('actual_QC17_completion_sha256') == old_qc17['actual_QC17_completion_sha256'],
            '317 must retain the entire genuine QC17 failure/individual-review basis and all four actual17 submission pins.')
    start, finalize, create = (batch.read(folder/name) for name in
        ['upload-start-intent.private.json', 'upload-finalize-intent.private.json', 'batch-create-intent.private.json'])
    require(start == {'state': 'ATTEMPT_RECORDED_BEFORE_NETWORK', 'requests_file_sha256': digest(folder/'requests.jsonl')}
        and finalize == {'state': 'ATTEMPT_RECORDED_BEFORE_NETWORK', 'credential_or_upload_URL_retained': False}
        and create == {'state': 'ATTEMPT_RECORDED_BEFORE_NETWORK', 'model': runner.MODEL,
            'uploaded_file_name': job['input_file_name'], 'request_count': spec['count'], 'batch_requests_sha256': digest(folder/'requests.jsonl')},
        'Actual original pre-network upload/create intents must bind the exact anonymous request file and confirmed job.')
    require(collect.get('job_name') == job.get('job_name') and re.fullmatch(r'batches/[A-Za-z0-9_.-]+', job.get('job_name', '')),
        'Confirmed actual whole Google job/collection identity differs.')
    snapshots = [batch.read(path) for path in (folder/'statuses').glob('*.private.json') if digest(path) == collect.get('status_sha256')]
    require(len(snapshots) == 1, 'Actual once-collected succeeded provider status missing/ambiguous.')
    snapshot = snapshots[0]
    actual_status = snapshot.get('actual_provider_response', {}); metadata = actual_status.get('metadata', actual_status)
    destination = actual_status.get('response', {})
    require(snapshot.get('state') == 'JOB_STATE_SUCCEEDED' and snapshot.get('job_name') == job['job_name']
        and snapshot.get('plan_sha256') == spec['plan_sha256']
        and actual_status.get('done') is True and actual_status.get('name') == metadata.get('name') == job['job_name']
        and metadata.get('model') == 'models/'+runner.MODEL
        and batch.core.normalize_state(metadata.get('state', actual_status.get('state', 'UNKNOWN'))) == 'JOB_STATE_SUCCEEDED'
        and metadata.get('inputConfig', {}).get('fileName') == job['input_file_name']
        and metadata.get('batchStats', {}).get('requestCount') == str(spec['count'])
        and destination.get('responsesFile') == collect.get('response_file_name') == metadata.get('output', {}).get('responsesFile')
        and job['actual_creation_response'].get('metadata', {}).get('inputConfig', {}).get('fileName') == job['input_file_name'],
        'Google provider actual succeeded state/input/output/count metadata differs from its confirmed collection.')
    data = (folder/'responses.provider-raw.private.jsonl').read_bytes(); decoded = runner.decode_batch(data)
    http_evidence(folder, job, snapshot, data, bound)
    result, observed, failures = {}, [], []
    require([record['id'] for record in plan['records']] == runner.IDS, 'Google whole per-Source records differ.')
    for ident, provider_row in decoded:
        index = runner.IDS.index(ident); record = plan['records'][index]; row = rows[ident]
        require(record['source_row_reference_only'] == row and record['source_row_sha256'] == object_sha(row)
            and record['actual_Primary_take_reference_only'] == takes[ident]
            and record['MP3_sha256'] == digest(run/'clips'/(ident+'.mp3'))
            and record['WAV_sha256'] == digest(run/'raw'/(ident+'.wav')),
            'Whole current Google Source/primary/audio record differs.')
        call_path = folder/'call-intents'/(ident+'.private.json'); call = batch.read(call_path)
        require(call == {'state': 'RESERVED_BEFORE_BATCH_NETWORK', 'id': ident,
            'external_key': google_external_key(spec, index+1), 'WAV_sha256': record['WAV_sha256'],
            'request_sha256': record['model_request_sha256'], 'model': runner.MODEL,
            'plan_sha256': spec['plan_sha256'], 'approval': None}, 'Actual audio-blind reserved Google call differs.')
        target = folder/'observations'/(ident+'.private.json')
        try:
            require(isinstance(provider_row.get('response'), dict) and not provider_row.get('error') and not provider_row.get('status'), 'Actual provider row error remains held.')
            parsed = runner.parse_observation(batch.canonical(provider_row['response']).encode())
        except (batch.SafeError, KeyError, TypeError, ValueError):
            require(not target.exists(), 'Incomplete Google row may not have an invented successful observation.')
            failures.append({'id': ident, 'status': 'RAW_UNAPPROVED_PARSE_OR_PROVIDER_FAILURE', 'actual_provider_batch_row': provider_row})
            continue
        reproduced = {'id': ident, 'external_key': google_external_key(spec, index+1), 'WAV_sha256': record['WAV_sha256'],
            'model_request_sha256': record['model_request_sha256'], 'whole_raw_batch_sha256': batch.sha(data),
            'actual_provider_batch_row': provider_row, 'provider_response_object_sha256': object_sha(provider_row['response']),
            'per_row_copy_is_parsed_not_original_bytes': True, 'reconciliation_only_no_network': True, **parsed}
        require(batch.read(target) == reproduced, 'Actual complete parsed observation differs from the original whole provider body.')
        result[ident] = reproduced; observed.append(ident)
    reproduced_completion = {'state': 'COMPLETED_OBSERVATION_ONLY' if not failures else 'RAW_RETAINED_UNAPPROVED_WITH_FAILURES',
        'actual_row_count': len(decoded), 'observed_ids': observed, 'failures': failures, 'whole_raw_batch_sha256': batch.sha(data),
        'plan_sha256': spec['plan_sha256'], 'network_calls_by_reconciliation': 0, 'submit_retry_allowed': False,
        'word_approval': None, 'vocal_approval': None, 'timing_approval': None, 'acting_approval': None, 'human_listening_verdict': None}
    require(completion == reproduced_completion and set(path.stem.removesuffix('.private') for path in (folder/'observations').glob('*.private.json')) == set(observed),
        'Complete actual Google observation/failure census differs; no failed row can be dropped.')
    bound[str(runner_path)] = spec['runner_sha256']
    return result


def google_literal(observation, row):
    actual = observation.get('actual_raw_observation')
    require(observation.get('status') == 'RAW_OBSERVATION_ONLY_NOT_APPROVED' and observation.get('model') == 'gemini-3.1-pro-preview'
        and observation.get('word_approval') is None and observation.get('vocal_approval') is None
        and observation.get('canonical_pronunciation') is None and observation.get('human_listening_verdict') is None
        and isinstance(actual, dict) and isinstance(actual.get('transcript'), str)
        and actual.get('uncertainties') == [] and base.qa_engine.words(row['text'])
        and base.qa_engine.words(actual['transcript']) == base.qa_engine.words(row['text']),
        'Only the whole actual literal Google transcript without uncertainties is word proof; IPA/events cannot supply words.')
    return actual['transcript']


def numeric_detail(record, raw, original, call, waveform, runner, folder):
    """A separate JSON-number proof; never reproduce the old false as true."""
    ident = record['id']; raw_path, diagnosis_path = folder/'raw'/(ident+'.private.json'), folder/'diagnosis'/(ident+'.private.json')
    response = raw['actual_response']; seconds = waveform['sample_count']/16000
    base_body = runner.base.diagnose(response, record['source_row']['text'])
    reproduced_base = {'id': ident, 'raw_path': str(raw_path), 'raw_sha256': digest(raw_path),
        'source_row_sha256': record['source_row_sha256'], 'actual_response_produced': True, **base_body}
    interval_keys = {'actual_intervals_valid', 'actual_interval_count', 'actual_interval_uncertainty_reasons'}
    require({key: value for key, value in original.items() if key not in interval_keys} == reproduced_base
        and original.get('actual_intervals_valid') is False
        and original.get('actual_interval_uncertainty_reasons') == ['nonfinite_actual_word_interval_or_probability'],
        'Original whole timing15 diagnosis and its genuine false must remain unchanged.')
    numeric = runner.interval_diagnosis(response, seconds)
    words = prior.literal_response_body(response, record['source_row'], seconds)
    trace, previous = [], 0.0
    for index, word in enumerate(words):
        trace.append({'word_index': index, 'word': word['word'],
            'values': {name: {'json_value': word[name], 'loaded_python_type': type(word[name]).__name__, 'finite': math.isfinite(word[name])}
                for name in ['start', 'end', 'probability']},
            'positive_interval': word['end'] > word['start'], 'overlap_seconds': max(0.0, previous-word['start']),
            'inside_actual_audio': 0 <= word['start'] < word['end'] <= seconds+.001,
            'interval_seconds': word['end']-word['start'], 'probability_in_unit_interval': 0 <= word['probability'] <= 1})
        previous = word['end']
    authored = base.cue_engine.acoustic.normalized_text(record['source_row']['text']).split()
    mapping = len(authored) == len(words) and all(base.qa_engine.words(expected)
        and base.qa_engine.words(expected) == base.qa_engine.words(actual['word']) for expected, actual in zip(authored, words))
    bounded = mapping and all(.02 <= word['end']-word['start'] <= 1.5 and word['probability'] >= .02 for word in words)
    return {'id': ident, 'binding': {'raw_path': str(raw_path), 'raw_sha256': digest(raw_path),
        'original_diagnosis_path': str(diagnosis_path), 'original_diagnosis_sha256': digest(diagnosis_path),
        'call_intent_sha256': digest(folder/'call-intents'/(ident+'.private.json')), 'source_row_sha256': record['source_row_sha256'],
        'audio_sha256': record['mp3_sha256'], 'actual_waveform_sha256': waveform['waveform_sha256']},
        'original_interval_verdict': {key: original[key] for key in interval_keys}, 'original_diagnosis_retained_unchanged': True,
        'serialized_numeric_revalidation': numeric, 'strict_full_literal_body_pass': True, 'source_whitespace_words': authored,
        'actual_raw_word_count': len(words), 'one_to_one_actual_lexical_word_mapping': mapping,
        'all_existing_case_numeric_time_guards_pass_without_root_approval': bounded,
        'actual_unchanged_numeric_trace': trace, 'approval': None}


def numeric15_bundle(run, rows, takes, bound, root_binding, authored_binding):
    folder = run/'free-large-timing15'; proof_folder = run/'independent-actual-qualification/free-large-timing15-result-review'
    proof_path = proof_folder/'actual15-raw-json-numeric-revalidation.private.json'
    proof = batch.read(proof_path); pin_file(proof_path, bound, NUMERIC_PROOF_SHA)
    require(isinstance(root_binding, dict), 'Root must bind the entire genuine numerical15 revalidation.')
    plan, result, intent = (batch.read(folder/name) for name in ['plan.private.json', 'result.private.json', 'execution-intent.private.json'])
    expected = {'producer_files_sha256': proof['producer_files_sha256'], 'proof': {'path': str(proof_path), 'sha256': NUMERIC_PROOF_SHA},
        'whole_input_map_sha256': object_sha(plan['input_sha256']), 'whole_output_map_sha256': object_sha(result['outputs_sha256']),
        'details_sha256': object_sha(proof['details']), 'authored20_bundle_sha256': object_sha(authored_binding)}
    require(root_binding == expected, 'Root must bind whole numerical15 producer/report/details and genuine authored20 ancestry.')
    require(proof.get('version') == 'part2-timing15-immutable-raw-json-numeric-revalidation-v1'
        and proof.get('state') == 'offline_separate_serialized_numeric_revalidation_not_approved'
        and proof.get('original_completed_result_valid_intervals_count_retained') == 0
        and proof.get('original_diagnosis_false_count_retained') == 15 and proof.get('original_runtime_numeric_types_recorded') is False
        and proof.get('numbers_transcripts_times_changed_or_generated') is False and proof.get('original_files_changed') is False
        and proof.get('model_or_api_calls') == 0 and proof.get('root_case_approval') is None
        and proof.get('human_listening_or_acting_approval') is False, 'Separate genuine15 report may not replace false verdicts or invent native types.')
    for path, value in proof['producer_files_sha256'].items(): pin_file(path, bound, value)
    require(proof['producer_files_sha256'].get(str(proof_folder/'revalidate.private.py')) == NUMERIC_SCRIPT_SHA
        and digest(folder/'result.private.json') == TIMING15_RESULT_SHA, 'Independent numeric proof script/result bytes differ.')
    runner_path = folder/'run.private.py'; runner = definitions(runner_path, prior.SOURCEFREE_TIMING_RUNNER_SHA256)
    require(digest(folder/'plan.private.json') == prior.SOURCEFREE_TIMING_PLAN_SHA256, 'Frozen actual timing15 plan differs.')
    runner.validate_plan(plan)  # Full original20, actual15 scope/current Source/model/wave/producer pins.
    require(len(rows) == len(takes) == 1401 and result.get('state') == 'COMPLETED_SOURCEFREE_WORDTIME_DIAGNOSTIC_ONLY_NOT_APPROVED'
        and result.get('version') == prior.SOURCEFREE_TIMING_VERSION and result.get('selected_ids') == plan['selected_ids']
        and result.get('checked_count') == result.get('actual_response_count') == result.get('exact_normalized_full_words_count') == 15
        and result.get('actual_call_failure_count') == 0 and result.get('actual_valid_word_interval_count') == 0
        and result.get('plan_sha256') == prior.SOURCEFREE_TIMING_PLAN_SHA256 and result.get('runner_sha256') == prior.SOURCEFREE_TIMING_RUNNER_SHA256
        and result.get('global_input_sha256_before') == result.get('global_input_sha256_after') == object_sha(plan['input_sha256'])
        and result.get('actual_model') == plan['model'] and result.get('actual_runtime') == {'model_path': str(prior.FULL_MODEL.resolve()), 'dimensions': prior.FULL_DIMENSIONS}
        and result.get('source_free') is True and result.get('teacher_forced_authored_text') is False
        and result.get('approval') is None and result.get('automatic_adoption') is False,
        'Whole actual source-free15 result must retain original valid count0, actual Full-Large32/32 and all15 responses.')
    require(intent.get('state') == 'ONE_ROOT_SOURCEFREE15_ATTEMPT' and intent.get('selected_ids') == plan['selected_ids']
        and intent.get('plan_sha256') == prior.SOURCEFREE_TIMING_PLAN_SHA256 and intent.get('runner_sha256') == prior.SOURCEFREE_TIMING_RUNNER_SHA256
        and intent.get('source_free') is True and intent.get('approval') is None, 'Actual once-only15 intent differs.')
    expected_outputs = {str(folder/'execution-intent.private.json')} | {str(folder/label/(ident+'.private.json'))
        for label in ['call-intents', 'raw', 'diagnosis'] for ident in plan['selected_ids']}
    require(set(result['outputs_sha256']) == expected_outputs and len(expected_outputs) == 46, 'Whole actual15 output census differs.')
    for path, value in {**plan['input_sha256'], **result['outputs_sha256']}.items(): pin_file(path, bound, value)
    prior.model_evidence(plan['model'], bound)
    imports = result.get('actual_imported_runtime')
    require(isinstance(imports, dict) and set(imports) == prior.SOURCEFREE_TIMING_IMPORTS
        and all(plan['input_sha256'].get(value.get('path')) == value.get('sha256') for value in imports.values()), 'Actual15 imported runtime is not the exact pinned seventeen modules.')
    details, candidates = [], {}
    require([record['id'] for record in plan['records']] == plan['selected_ids'], 'Entire actual15 per-Source census differs.')
    for record in plan['records']:
        ident = record['id']; raw_path = folder/'raw'/(ident+'.private.json'); diagnosis_path = folder/'diagnosis'/(ident+'.private.json')
        call_path = folder/'call-intents'/(ident+'.private.json'); raw, original, call = read_raw(raw_path), batch.read(diagnosis_path), batch.read(call_path)
        mp3 = run/'clips'/(ident+'.mp3'); waveform = prior.actual_timing15_waveform(mp3, plan['decoder'])
        require(record['source_row'] == rows[ident] and record['source_row_sha256'] == object_sha(rows[ident])
            and record['primary_take'] == takes[ident] and not takes[ident]['reasons'] and takes[ident]['word_error_rate'] == 0
            and base.qa_engine.words(takes[ident]['transcript']) == base.qa_engine.words(rows[ident]['text']), 'Timing15 must keep independent initial literal0WER word proof.')
        require(raw.get('id') == ident and raw.get('audio_sha256') == record['mp3_sha256'] == digest(mp3)
            and raw.get('actual_audio_input') == call.get('actual_audio_input') == waveform
            and raw.get('actual_imported_runtime') == imports and raw.get('actual_runtime') == result['actual_runtime']
            and raw.get('actual_call_args') == call.get('actual_call_args') == prior.CALL_ARGS
            and raw.get('plan_sha256') == call.get('plan_sha256') == prior.SOURCEFREE_TIMING_PLAN_SHA256
            and raw.get('runner_sha256') == call.get('runner_sha256') == prior.SOURCEFREE_TIMING_RUNNER_SHA256
            and raw.get('source_free') is True and call.get('source_free') is True and raw.get('teacher_forced_authored_text') is False
            and raw.get('raw_saved_before_post_call_guards_and_diagnosis') is True
            and raw.get('timing20_refined_sha256') == record['timing20_refined_sha256']
            and raw.get('timing20_all_qualification_flags') == record['timing20_all_qualification_flags'],
            'Actual15 whole source-free response/call/runtime/physical waveform and actual20 flags differ.')
        detail = numeric_detail(record, raw, original, call, waveform, runner, folder)
        details.append(detail); candidates[ident] = {'raw': raw, 'original_diagnosis': original, 'detail': detail, 'record': record}
    require(details == proof['details'] and proof.get('whole_input_map_sha256') == object_sha(plan['input_sha256'])
        and proof.get('whole_output_map_sha256') == object_sha(result['outputs_sha256'])
        and proof.get('actual_raw_response_count') == proof.get('serialized_numeric_intervals_valid_count') == proof.get('strict_full_literal_body_count') == 15
        and proof.get('one_to_one_actual_lexical_word_mapping_count') == sum(d['one_to_one_actual_lexical_word_mapping'] for d in details) == 13
        and proof.get('all_existing_case_numeric_time_guards_pass_count') == sum(d['all_existing_case_numeric_time_guards_pass_without_root_approval'] for d in details) == 9,
        'Entire separate actual15 numeric trace/body/mapping/count proof differs; all original false verdicts stay retained.')
    bound[str(runner_path)] = prior.SOURCEFREE_TIMING_RUNNER_SHA256
    return candidates


def physical_clip(row, run, profiles, qa, alignment, take, case, args, bound, decode_fn=None):
    ident = row['id']; path = run/'clips'/(ident+'.mp3'); audio_hash = digest(path); text_hash = batch.sha(row['text'].encode())
    temporal = batch.read(run/'word-cues'/(ident+'.json'))
    require(case.get('version') == VERSION and case.get('status') == 'approved_part2_external_case_evidence'
            and case.get('reviewed_by') == 'root' and case.get('actual_whole_source_and_counterevidence_reviewed') is True
            and case.get('human_listening_or_acting_approval') is False and case.get('binding') == prior.case_binding(args, run, row)
            and case.get('retained_initial_take') == take and case.get('retained_initial_timing_flags') == temporal['all_qualification_flags'],
            'Explicit exact current per-Source Root approval and complete original failures required.')
    require(not take.get('adjudication') and take.get('text_sha256') == text_hash
            and qa.get('clip_sha256', {}).get(ident) == alignment.get('clip_sha256', {}).get(ident) == audio_hash,
            'Initial actual Source/audio/report differs or was adjudicated in place.')
    signal = (decode_fn or base.qa_engine.decode)(path)
    require(signal == take.get('signal') and not base.qa_engine.signal_failures(signal, len(base.qa_engine.words(row['text']))), 'Current physical signal differs/fails.')
    receipt = batch.read(run/'raw'/(ident+'.receipt.json')); wav = run/'raw'/(ident+'.wav')
    require(receipt.get('status') == 'complete' and receipt.get('backend') == 'batch' and receipt.get('id') == ident
            and receipt.get('mp3_sha256') == audio_hash and receipt.get('wav_sha256') == digest(wav)
            and receipt.get('request_sha256') == batch.sha(batch.canonical(batch.request_for(row, profiles['speakers'])).encode()),
            'Actual provider/normalization receipt differs from this current Source request/audio.')
    require(receipt.get('normalization') == {'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11}
            and isinstance(receipt.get('loudness_input'), dict)
            and all(key in receipt['loudness_input'] and math.isfinite(float(receipt['loudness_input'][key])) for key in
                    ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'])
            and prior.finite(receipt.get('seconds')) and abs(receipt['seconds']-signal['seconds']) < .1,
            'Actual normalization/duration measurement missing or changed.')
    words = base.cue_engine.acoustic.normalized_text(row['text']).split()
    require(temporal.get('engine_version') == base.cue_engine.ENGINE and temporal.get('audio_sha256') == audio_hash
            and temporal.get('text_sha256') == text_hash and temporal.get('text') == row['text']
            and temporal.get('source_manifest_sha256') == digest(run/'lines.private.json')
            and abs(temporal.get('decoded_seconds', -100)-signal['seconds']) < .001
            and temporal.get('authored_word_count') == len(words) and len(temporal.get('word_cues', [])) == len(words)
            and [word.get('word') for word in temporal.get('words', [])] == words
            and temporal.get('cues_sha256') == base.cue_engine.acoustic.cue_sha(temporal['word_cues'])
            and temporal.get('all_qualification_flags') == base.cue_engine.qualification_flags(temporal)
            and not any(key in temporal for key in ['CTC_adoption', 'Partial_CTC_adoption', 'Vocal_event_adoption']),
            'Exact complete initial real timing receipt was changed or substituted.')
    for name, value in case['binding']['files_sha256'].items(): pin_file(name, bound, value)
    return temporal, signal, path


def flag_decisions(flags, decisions, decision_name):
    require(isinstance(decisions, list) and [decision.get('flag') for decision in decisions] == flags
        and all(decision.get('decision') == decision_name and isinstance(decision.get('review_note'), str)
            and decision['review_note'].strip() for decision in decisions), 'Every actual retained flag requires its exact separate Root decision.')


def numeric15_case(row, temporal, candidate, approval, run, bound, seconds):
    require(isinstance(approval, dict) and approval.get('mode') == 'actual_timing15_serialized_numbers', 'Exact separate actual numerical15 timing mode required.')
    detail, raw, original = candidate['detail'], candidate['raw'], candidate['original_diagnosis']
    require(detail['all_existing_case_numeric_time_guards_pass_without_root_approval'] is True
        and detail['one_to_one_actual_lexical_word_mapping'] is True and detail['serialized_numeric_revalidation']['actual_intervals_valid'] is True,
        'Only the nine actual strict one-to-one bounded numerical15 cases may be selected.')
    require(original.get('actual_intervals_valid') is False
        and detail['original_interval_verdict'] == {key: original[key] for key in ['actual_intervals_valid', 'actual_interval_count', 'actual_interval_uncertainty_reasons']}
        and approval.get('original_native_numeric_types_unrecorded') is True,
        'Actual original false and unknown original in-memory numeric types must remain explicit.')
    for field, label, actual in [('raw', 'raw', raw), ('original_diagnosis', 'diagnosis', original)]:
        ref = approval.get(field)
        require(isinstance(ref, dict) and ref.get('path') == str(run/'free-large-timing15'/label/(row['id']+'.private.json'))
            and prior.bound_ref(run, ref, bound) == actual, 'Root must pin exact real15 Raw and unchanged false original diagnosis.')
    require(approval.get('revalidation_detail_sha256') == object_sha(detail)
        and approval.get('retained_original_interval_verdict') == detail['original_interval_verdict']
        and approval.get('retained_serialized_numeric_revalidation') == detail['serialized_numeric_revalidation']
        and approval.get('retained_timing20_flags') == candidate['record']['timing20_all_qualification_flags'],
        'Root case must retain both actual false and separate JSON numeric verdicts with full current20 flags.')
    false_review = approval.get('original_false_verdict_review', {})
    require(false_review.get('decision') == 'approve_separate_json_numeric_evidence_keep_original_false'
        and false_review.get('original_interval_verdict_sha256') == object_sha(detail['original_interval_verdict'])
        and isinstance(false_review.get('review_note'), str) and false_review['review_note'].strip(),
        'Original false/type-boundary uncertainty needs an explicit distinct Root decision, never an in-place True.')
    flag_decisions(candidate['record']['timing20_all_qualification_flags'], approval.get('timing20_flag_decisions'), 'approve_actual_numeric15_sourcefree_times')
    words = prior.complete_timing15_response(raw, row, temporal['audio_sha256'], seconds)
    return prior.actual_word_interval_cues(row, words, seconds, temporal['all_qualification_flags'], approval.get('initial_flag_decisions'), 'approve_actual_numeric15_sourcefree_times')


def evidence_clip(row, run, profiles, qa, alignment, take, case, args, bound, google, numeric, decode_fn=None):
    temporal, signal, path = physical_clip(row, run, profiles, qa, alignment, take, case, args, bound, decode_fn)
    mode = case.get('mode'); word, timing = case.get('word'), case.get('timing')
    if mode == 'google_literal_initial_timeclear':
        require(set(take.get('reasons', [])) <= prior.WORD_FAILURES and take.get('reasons')
            and temporal['all_qualification_flags'] == [] and timing is None and isinstance(word, dict)
            and word.get('mode') == 'google_whole_literal' and isinstance(word.get('review_note'), str) and word['review_note'].strip(),
            'Google word-only lane requires an original word failure, original clear timing and no timing substitution.')
        key = word.get('bundle_key'); observation = google.get(key, {}).get(row['id'])
        require(isinstance(observation, dict) and word.get('observation', {}).get('path') == str(run/GOOGLE[key]['folder']/'observations'/(row['id']+'.private.json'))
            and prior.bound_ref(run, word['observation'], bound) == observation
            and word.get('provider_row_sha256') == object_sha(observation['actual_provider_batch_row'])
            and word.get('source_free_request_sha256') == observation['model_request_sha256'], 'Root whole Google row/request/observation binding differs.')
        google_literal(observation, row)
        entry = alignment.get('alignment_by_id', {}).get(row['id'], {}); cues = temporal['word_cues']
        require(entry.get('cues_sha256') == temporal['cues_sha256'] and entry.get('word_count') == len(cues)
            and entry.get('text_sha256') == temporal['text_sha256']
            and entry.get('words') == [{'word': text, **cue} for text, cue in zip(row['text'].split(), cues)], 'Original flag-free timing must be unchanged and fully reported.')
    elif mode == 'actual_numeric15_times_initial_literal':
        require(word is None and not take.get('reasons') and take.get('word_error_rate') == 0
            and base.qa_engine.words(take.get('transcript', '')) == base.qa_engine.words(row['text'])
            and temporal['all_qualification_flags'] and row['id'] in numeric,
            'Separate numerical15 timing requires genuine initial full literal word proof and retained original timing failure.')
        cues = numeric15_case(row, temporal, numeric[row['id']], timing, run, bound, signal['seconds'])
    else: require(False, 'Unknown/retake/phonetic/projected external evidence mode.')
    words = base.cue_engine.acoustic.normalized_text(row['text']).split()
    details = base.cue_engine.cue_words(row['text'], cues, signal['seconds']); previous = 0.0
    for text, cue, data in zip(words, cues, temporal['words']):
        require(cue['start'] < cue['end'] or (data.get('spoken') is False and not base.re_word(text)), 'Collapsed lexical public interval cannot be published.')
        if not base.re_word(text): require(data.get('spoken') is False and cue['start'] == cue['end'] == previous, 'Standalone Source punctuation must keep its genuine preceding endpoint.')
        previous = cue['end']
    require(len(details) == len(words) and alignment.get('authored_text_sha256', {}).get(row['id']) == temporal['text_sha256'], 'Complete current public word/source census differs.')
    require(digest(path) == temporal['audio_sha256'], 'Current external clip changed during qualification.')
    return {'id': row['id'], 'kind': row['kind'], 'speaker': row['speaker'], 'text': row['text'], 'display_text': row['display_text'],
        'voice': profiles['speakers'][row['speaker']]['google_voice'], 'audio': 'audio/teil-2/'+row['id']+'.mp3',
        'sha256': temporal['audio_sha256'], 'seconds': signal['seconds'], 'word_cues': copy.deepcopy(cues),
        'runtime_keys': copy.deepcopy(row['runtime_keys'])}, path


def build(args, initial, supplemental, selection):
    require(digest(Path(prior.__file__)) == PRIOR_SHA
        and digest(batch.ROOT/'scripts/part2_voice_evidence_publish_test.py') == PRIOR_TEST_SHA, 'Frozen0036/8a8 prior adapter must remain unchanged.')
    public, paths, preserved, bound, prior_selection = prior.build(args, initial, supplemental)
    require(len(public['clips']) == 921 and len(supplemental.get('case_approvals', [])) == 137, 'Exact full initial784 plus separately approved137 baseline required.')
    target_root = Path(initial['target_root']); target_script = target_root/'scripts'/Path(__file__).name
    require(target_script.is_file() and digest(target_script) == digest(__file__), 'Release worktree new external adapter must match independently frozen production bytes.')
    pin_file(target_script, bound); pin_file(Path(__file__).resolve(), bound)
    require(selection.get('version') == VERSION and selection.get('status') == 'approved_part2_external_voice_selection'
        and selection.get('reviewed_by') == 'root' and selection.get('human_listening_or_acting_approval') is False
        and selection.get('initial_selection_sha256') == digest(args.selection)
        and selection.get('prior_supplemental_selection_sha256') == digest(args.supplemental_selection)
        and selection.get('prior_adapter_sha256') == PRIOR_SHA and selection.get('adapter_sha256') == digest(__file__)
        and selection.get('target_root') == prior_selection['target_root']
        and selection.get('preserved_banks_sha256') == prior_selection['preserved_banks_sha256'], 'Exact separately approved external Root union must preserve frozen921 baseline.')
    for field in ['manifest_sha256', 'profiles_sha256', 'prepared_sha256', 'qa_sha256', 'alignment_sha256', 'qa_producer_sha256', 'alignment_producer_sha256']:
        require(selection.get(field) == prior_selection.get(field), 'External Root selection changes original Source/report/producer provenance.')
    run = Path(args.run_dir).expanduser().resolve(); manifest, profiles = batch.read(run/'lines.private.json'), batch.read(run/'profiles.private.json')
    qa, alignment = batch.read(args.qa_report), batch.read(args.alignment_report)
    takes, checked = base.report_coverage(qa, alignment, manifest, run); rows = {row['id']: row for row in manifest['lines']}
    baseline_ids = {clip['id'] for clip in public['clips']}; chosen = base.ids(selection.get('selected_ids'), 'external Root union Source IDs')
    additional = chosen-baseline_ids
    require(baseline_ids <= chosen <= checked and additional, 'External lane cannot drop baseline921 or add unchecked/absent Sources.')
    refs = selection.get('case_approvals'); require(isinstance(refs, list) and len(refs) == len(additional), 'Exact external per-case Root approval census missing.')
    cases = {}
    for ref in refs:
        case = prior.bound_ref(run, ref, bound); ident = case.get('binding', {}).get('id')
        require(ident in additional and ident not in cases, 'Unknown/duplicate/excluded external Root case.'); cases[ident] = case
    require(set(cases) == additional, 'Exact whole external approval coverage differs.')
    bundles = selection.get('google_bundles') or {}; require(isinstance(bundles, dict), 'Typed Google whole bundles required.')
    needed = {case.get('word', {}).get('bundle_key') for case in cases.values() if case.get('mode') == 'google_literal_initial_timeclear' and isinstance(case.get('word'), dict)}
    require(needed <= set(GOOGLE) and set(bundles) == needed, 'Exact Google17/317 bundle selection differs.')
    google = {key: google_bundle(run, key, rows, takes, bound, bundles[key]) for key in needed}
    numeric_needed = any(case.get('mode') == 'actual_numeric15_times_initial_literal' for case in cases.values())
    numeric = numeric15_bundle(run, rows, takes, bound, selection.get('numeric15_bundle'), supplemental.get('timing_bundle')) if numeric_needed else {}
    for path in base.response_records(run, additional): pin_file(path, bound)
    clips = {clip['id']: clip for clip in public['clips']}
    for ident, case in cases.items():
        if case.get('mode') == 'google_literal_initial_timeclear':
            require(case['word'].get('google_bundle_sha256') == object_sha(bundles.get(case['word'].get('bundle_key'))), 'Root Google case must bind the exact whole producer in its selection.')
        if case.get('mode') == 'actual_numeric15_times_initial_literal':
            require(case.get('timing', {}).get('numeric15_bundle_sha256') == object_sha(selection.get('numeric15_bundle')), 'Root numerical15 case must bind entire report/producer/ancestry in its selection.')
        clips[ident], paths[ident] = evidence_clip(rows[ident], run, profiles, qa, alignment, takes[ident], case, args, bound, google, numeric)
    public['clips'] = [clips[row['id']] for row in manifest['lines'] if row['id'] in clips]
    coverage = public['coverage']; coverage.update(version=VERSION, missing_sources=[entry for entry in coverage['missing_sources'] if entry['id'] not in additional],
        published_sources=len(clips), prior_qualified_sources=921, external_qualified_sources=len(additional),
        retained_initial_word_failures=len(qa['failures']), retained_initial_timing_failures=len(alignment['failures']),
        original_numeric15_valid_count_retained=0 if numeric_needed else None,
        original_numeric15_false_count_retained=15 if numeric_needed else None,
        external_selection_sha256=digest(args.external_selection), human_listening_or_acting_approval=False)
    coverage['status'] = 'complete' if not coverage['missing_sources'] else 'partial'
    require(len(clips)+len(coverage['missing_sources']) == len(rows), 'Honest full external coverage census differs.')
    pin_file(Path(args.external_selection), bound)
    return public, paths, preserved, bound, selection


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['dryrun', 'apply']); parser.add_argument('--run-dir', required=True)
    for name in ['selection', 'supplemental-selection', 'external-selection', 'qa-report', 'alignment-report', 'qa-producer', 'alignment-producer', 'coverage-report']:
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--adapter-sha256', required=True); parser.add_argument('--target-root', type=Path); args = parser.parse_args()
    try:
        require(digest(__file__) == args.adapter_sha256, 'Root must explicitly supply the independently frozen external adapter hash.')
        require(batch.PRIVATE.resolve() in args.coverage_report.resolve().parents and args.coverage_report.resolve() == args.coverage_report, 'Coverage proof must be an immutable exact private path.')
        with ExitStack() as locks:
            lock = locks.enter_context((batch.PRIVATE/'publish.lock').open('a+')); fcntl.flock(lock, fcntl.LOCK_EX)
            initial, supplemental, selection = (batch.read(path) for path in [args.selection, args.supplemental_selection, args.external_selection])
            target_root = args.target_root.expanduser().resolve() if args.target_root else batch.ROOT.resolve()
            require(initial.get('target_root') == str(target_root), 'Root selection must name the exact locked release worktree.')
            locks.enter_context(base.target_publish_lock(target_root))
            public, paths, preserved, bound, selection = build(args, initial, supplemental, selection)
            target = target_root/'game/public/audio/teil-2'; base.existing(target, selection, public); base.stable(bound, preserved)
            report = {'state': 'PUBLISHED' if args.command == 'apply' else 'VALIDATED', **public['coverage'], 'version': VERSION,
                'public_manifest_sha256': batch.sha((json.dumps(public, ensure_ascii=False, indent=2)+'\n').encode()),
                'adapter_sha256': digest(__file__), 'prior_adapter_sha256': PRIOR_SHA, 'preserved_bank_sha256': preserved, 'checked_at': int(time.time())}
            require(not args.coverage_report.exists(), 'Immutable external publication report already exists; no overwrite.')
            if args.command == 'apply':
                identity = None
                def finalize():
                    nonlocal identity
                    identity = base.exclusive_report(args.coverage_report, report); bound[str(args.coverage_report)] = digest(args.coverage_report)
                def undo():
                    if identity is not None and args.coverage_report.exists() and (args.coverage_report.stat().st_dev, args.coverage_report.stat().st_ino) == identity: args.coverage_report.unlink()
                base.apply(target, selection, public, paths, preserved, bound, finalize, undo)
            else: base.exclusive_report(args.coverage_report, report)
            print(json.dumps({'state': report['state'], 'published': len(public['clips']), 'missing': len(public['coverage']['missing_sources']), 'human_listening_or_acting_approval': False}))
        return 0
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError, AttributeError, IndexError):
        print('Separate external evidence publication refused; original failures, Sources, audio and existing banks stay protected.', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
