#!/usr/bin/env python3
"""Add individually approved genuine89 word times after the complete external build.

No model/API/approval generation. Original flags and discarded active waveform
regions remain explicit evidence. All 89 answers, 34 original holds and physical148
are validated. Only individually approved candidates whose original discarded
active regions fit unchanged actual word intervals can be exported.
"""
from __future__ import annotations
import argparse
import copy
from contextlib import ExitStack
import fcntl
import json
import math
import os
from pathlib import Path
import sys
import time
import part2_voice_external_evidence_publish as external

prior, base, batch, require = external.prior, external.base, external.batch, external.require
digest, object_sha = external.digest, external.object_sha
VERSION = 'part2-separate-sourcefree89-timing-publication-v1'
MODE = 'actual_full_large_sourcefree89_word_intervals'
EXTERNAL_SHA = '0a56f8abb29b289edb8ef6762173f261178e345d5be5e59818b06c76c2ecd0e7'
EXTERNAL_TEST_SHA = '15357313b9916e0e3d7d2ad9a19c54d79ccbceb943202bd666ae7ff8beefb26c'
RUNNER_SHA = '0c7c958930c6df919104b1b780aa2753e9e99949164ec2d1a6e6dec0638f620d'
RUNNER_TEST_SHA = '51dd61350485e54f4d0385deb5e3ef1d27fa702b92df9f509f744481056b9edd'
PLAN_SHA = '26504906b1efc47e4ab4bfc4b2fbc909548a0093ce4e453324cd71f4b4979f44'
RESULT_SHA = '00182888e14345151288dfc7b2a7ebf15ea90dcc4dea1f606b512c38d71ab47c'
REVIEW_SHA = '5b71734f0d64c1b852a05bfb8586df9a5d89c846262025627397e794c7049637'
PHYSICAL_SHA = '52a797a06a415c7a3b26cae0d8fb496cbb77874d81631f9cce158d0d491229c1'
FOLDER = 'sourcefree-time89-preparation'
REVIEW_PATH = 'independent-actual-qualification/sourcefree-time89-runner-review/actual-whole89-result-final.private.json'
PHYSICAL_PATH = 'independent-actual-qualification/supplemental-11eb-review/actual-148-physical-review.private.json'


def whole_binding(run):
    folder = run/FOLDER; plan, result = batch.read(folder/'plan.private.json'), batch.read(folder/'result.private.json')
    return {'files_sha256': {str(folder/name): digest(folder/name) for name in
                ['run.private.py', 'test.private.py', 'plan.private.json', 'execution-intent.private.json', 'result.private.json']},
            'inputs_sha256': object_sha(plan['input_sha256']), 'outputs_sha256': object_sha(result['outputs_sha256']),
            'physical148_report': {'path': str(run/PHYSICAL_PATH), 'sha256': PHYSICAL_SHA},
            'independent_review': {'path': str(run/REVIEW_PATH), 'sha256': REVIEW_SHA}}


def strict_detail(raw, row, record, body, raw_path, diagnosis_path, waveform, seconds):
    strict_error, words = None, []
    try: words = prior.literal_response_body(raw['actual_response'], row, seconds)
    except (batch.SafeError, ValueError, TypeError, KeyError, RuntimeError, AttributeError, IndexError) as error: strict_error = str(error)
    authored = base.cue_engine.acoustic.normalized_text(row['text']).split()
    mapping = bool(words and len(words) == len(authored) and all(base.qa_engine.words(expected)
        and base.qa_engine.words(actual['word']) == base.qa_engine.words(expected) for expected, actual in zip(authored, words)))
    risks = [{'word_index': index, 'word': word['word'], 'start': word['start'], 'end': word['end'],
              'interval_seconds': word['end']-word['start'], 'probability': word['probability']}
             for index, word in enumerate(words) if not (.02 <= word['end']-word['start'] <= 1.5 and word['probability'] >= .02)]
    detail = {'id': row['id'], 'raw_sha256': digest(raw_path), 'diagnosis_sha256': digest(diagnosis_path),
        'actual_waveform_sha256': waveform['waveform_sha256'], 'exact_normalized_full_words': body['exact_normalized_full_words'],
        'actual_intervals_valid': body['actual_intervals_valid'],
        'actual_interval_uncertainty_reasons': body.get('actual_interval_uncertainty_reasons', []),
        'raw_uncertainty_reasons': body.get('uncertainty_reasons', []), 'strict_literal_body_error': strict_error,
        'one_to_one_lexical_word_mapping': mapping, 'actual_numeric_time_risks': risks,
        'strict_time_candidate_without_approval': bool(strict_error is None and mapping and not risks),
        'retained_original_timing_flags': record['original_all_qualification_flags'],
        'retained_original_discarded_activity_counterevidence': record['discarded_active_regions'], 'approval': None}
    return detail, words


def discarded_activity_coverage(row, words, counterevidence):
    """Actual old activity must fit its corresponding unchanged new word time.

    One representable binary64 step at the genuine boundary is the sole numeric
    tolerance. No time padding, breath/non-speech waiver or new cue is produced.
    """
    authored = base.cue_engine.acoustic.normalized_text(row['text']).split()
    require(len(words) == len(authored) and all(base.qa_engine.words(a['word']) == base.qa_engine.words(e)
        and base.qa_engine.words(e) for e, a in zip(authored, words)), 'Activity coverage requires genuine exact one-to-one words.')
    require(isinstance(counterevidence, list) and counterevidence, 'Measured original discarded activity cannot be omitted.')
    details = []
    for counter in counterevidence:
        flag = counter.get('flag'); index = flag.get('word_index') if isinstance(flag, dict) else None
        require(type(index) is int and 0 <= index < len(words), 'Actual discarded flag word index missing/invalid.')
        actual = words[index]; start, end = actual['start'], actual['end']
        require(prior.finite(start) and prior.finite(end) and start < end, 'Actual new lexical interval is invalid.')
        regions = counter.get('discarded_active_regions')
        require(isinstance(regions, dict) and set(regions) == {'leading', 'trailing'}, 'Actual discarded regions missing.')
        outside = []
        for side, values in regions.items():
            require(isinstance(values, list), 'Actual discarded region list missing.')
            for region in values:
                low, high, frames = region.get('start'), region.get('end'), region.get('frames')
                require(prior.finite(low) and prior.finite(high) and 0 <= low < high and type(frames) is int and frames > 0
                    and abs((high-low)*100-frames) < 1e-6, 'Only actual measured original10ms regions are supported.')
                if not math.nextafter(float(start), -math.inf) <= low < high <= math.nextafter(float(end), math.inf):
                    outside.append({'side': side, 'region': copy.deepcopy(region)})
        details.append({'flag': copy.deepcopy(flag), 'source_word': authored[index],
            'actual_new_word_interval': {'start': start, 'end': end},
            'retained_discarded_active_regions': copy.deepcopy(regions), 'outside_active_regions': outside,
            'all_original_discarded_activity_within_actual_new_word': not outside})
    return {'comparison_policy': 'actual_binary64_boundary_one_representable_step_only',
            'details': details, 'all_original_discarded_activity_within_actual_new_words': all(not d['outside_active_regions'] for d in details)}


def whole_bundle(run, rows, takes, bound, binding):
    folder = run/FOLDER
    require(binding == whole_binding(run), 'Root must bind the whole genuine89 producer and physical148 ancestry, never only selected rows.')
    for name, expected in [('run.private.py', RUNNER_SHA), ('test.private.py', RUNNER_TEST_SHA),
                           ('plan.private.json', PLAN_SHA), ('result.private.json', RESULT_SHA)]:
        external.pin_file(folder/name, bound, expected)
    require(not (folder/'failure.private.json').exists(), 'Only the actual completed89 producer is supported.')
    runner = external.definitions(folder/'run.private.py', RUNNER_SHA)
    plan, result, intent = (batch.read(folder/name) for name in ['plan.private.json', 'result.private.json', 'execution-intent.private.json'])
    runner.validate_plan(plan)  # Full physical148, initial1401, current89 and model/byte replay; no inference.
    review = prior.bound_ref(run, binding['independent_review'], bound)
    physical = prior.bound_ref(run, binding['physical148_report'], bound)
    selected = runner.actual_scope(physical)
    require(selected == plan['selected_ids'] == result['selected_ids'] and len(selected) == 89
            and set(selected) <= set(rows) and all(not takes[i]['reasons'] and takes[i]['word_error_rate'] == 0
                and base.qa_engine.words(takes[i]['transcript']) == base.qa_engine.words(rows[i]['text']) for i in selected),
            'The whole genuine89 must remain exact initially literal-clear members of actual physical148.')
    metadata = {'source_free': True, 'teacher_forced_authored_text': False, 'automatic_adoption': False,
        'audio_or_cues_modified': False, 'approval': None, 'model_download_disabled_in_ram': True, 'human_listening_or_acting_approval': False}
    inputs, outputs = plan['input_sha256'], result['outputs_sha256']
    runtime = {'model_path': str(prior.FULL_MODEL.resolve()), 'dimensions': prior.FULL_DIMENSIONS}
    require(plan['version'] == result['version'] == runner.VERSION and plan['call_args'] == runner.CALL_ARGS == prior.CALL_ARGS
        and result['state'] == 'COMPLETED_SOURCEFREE_WORDTIME_DIAGNOSTIC_ONLY_NOT_APPROVED'
        and plan['runner_sha256'] == result['runner_sha256'] == RUNNER_SHA and result['plan_sha256'] == PLAN_SHA
        and result['checked_count'] == result['actual_response_count'] == 89 and result['actual_call_failure_count'] == 0
        and plan['source_manifest_sha256'] == digest(run/'lines.private.json')
        and result['global_input_sha256_before'] == result['global_input_sha256_after'] == plan['global_input_sha256'] == object_sha(inputs)
        and result['actual_model'] == plan['model'] and result['actual_runtime'] == runtime
        and result['physical148_report_sha256'] == PHYSICAL_SHA
        and result['diagnosis_numeric_boundary'] == plan['diagnosis_numeric_boundary'] == 'actual_saved_raw_JSON_response_only'
        and all(plan.get(key) == result.get(key) == value for key, value in metadata.items()),
        'Whole genuine89 producer/count/runtime/sourcefree/current-source claims differ.')
    require(intent == {'version': runner.VERSION, 'state': 'ONE_ROOT_SOURCEFREE89_ATTEMPT', 'plan_sha256': PLAN_SHA,
        'runner_sha256': RUNNER_SHA, 'selected_ids': selected, 'source_free': True, 'approval': None, 'at': intent.get('at')},
        'Exact original before-model once-only89 intent differs.')
    for mapping in [inputs, outputs]:
        for path, value in mapping.items(): external.pin_file(path, bound, value)
    prior.model_evidence(plan['model'], bound)
    imports = result['actual_imported_runtime']
    require(set(imports) == prior.SOURCEFREE_TIMING_IMPORTS and all(inputs.get(value.get('path')) == value.get('sha256')
        and digest(value['path']) == value['sha256'] for value in imports.values()), 'All actual seventeen imported model/runtime files required.')
    expected_outputs = {str(folder/'execution-intent.private.json')}; candidates, details, diagnoses = {}, [], []
    require([record['id'] for record in plan['records']] == selected, 'Whole actual89 record order/body differs.')
    for record in plan['records']:
        ident, row = record['id'], rows[record['id']]
        require(record['source_row'] == row and record['source_row_sha256'] == object_sha(row)
            and record['primary_take'] == takes[ident], 'Current whole89 Source/word/preset record differs.')
        mp3 = run/'clips'/(ident+'.mp3'); waveform = prior.actual_timing15_waveform(mp3, plan['decoder']); seconds = waveform['sample_count']/16000
        call_path, raw_path, diagnosis_path = [folder/name/(ident+'.private.json') for name in ['call-intents', 'raw', 'diagnosis']]
        expected_outputs.update(map(str, [call_path, raw_path, diagnosis_path]))
        require(batch.read(call_path) == {'id': ident, 'state': 'ONE_SOURCEFREE_CALL_ATTEMPT', 'source_free': True,
            'plan_sha256': PLAN_SHA, 'runner_sha256': RUNNER_SHA, 'actual_call_args': prior.CALL_ARGS,
            'actual_audio_input': waveform, 'audio_sha256': record['mp3_sha256'], 'approval': None}, 'Actual reserved anonymous89 model call/waveform differs.')
        raw = prior.read_raw(raw_path)
        require(raw.get('version') == runner.VERSION and raw.get('id') == ident and raw.get('actual_call_args') == prior.CALL_ARGS
            and raw.get('actual_audio_input') == waveform and raw.get('actual_imported_runtime') == imports
            and raw.get('actual_runtime') == runtime and raw.get('plan_sha256') == PLAN_SHA and raw.get('runner_sha256') == RUNNER_SHA
            and raw.get('audio_sha256') == record['mp3_sha256'] == digest(mp3) and raw.get('source_free') is True
            and raw.get('teacher_forced_authored_text') is False and raw.get('raw_saved_before_post_call_guards_and_diagnosis') is True
            and raw.get('initial_cue_sha256') == record['initial_cue_sha256']
            and raw.get('original_all_qualification_flags') == record['original_all_qualification_flags']
            and raw.get('physical148_report_sha256') == PHYSICAL_SHA and raw.get('approval') is None
            and raw.get('automatic_adoption') is False and raw.get('human_listening_or_acting_approval') is False,
            'The genuine entire89 Raw/current model/audio/old counterevidence was changed or mislabelled.')
        try:
            body = runner.base.diagnose(raw['actual_response'], row['text'])
            body.update(runner.interval_diagnosis(raw['actual_response'], seconds)); body['diagnosis_read_exact_saved_raw_json'] = True
        except Exception as error:
            body = {'exact_normalized_full_words': False, 'uncertainty_reasons': ['raw_interpretation_failed_'+type(error).__name__],
                    'actual_intervals_valid': False, 'approval': None, 'automatic_adoption': False}
        diagnosis = {'id': ident, 'raw_path': str(raw_path), 'raw_sha256': digest(raw_path),
            'source_row_sha256': record['source_row_sha256'], 'actual_response_produced': True, **body}
        require(batch.read(diagnosis_path) == diagnosis, 'Whole saved89 diagnosis differs from actual retained JSON response.')
        diagnoses.append(diagnosis)
        detail, words = strict_detail(raw, row, record, body, raw_path, diagnosis_path, waveform, seconds); details.append(detail)
        if detail['strict_time_candidate_without_approval']:
            require(body['exact_normalized_full_words'] is True and body['actual_intervals_valid'] is True
                and body.get('uncertainty_reasons') == [] and body.get('actual_interval_uncertainty_reasons') == [],
                'A claimed strict candidate still has genuine actual uncertainty.')
            candidates[ident] = {'record': record, 'raw': raw, 'diagnosis': diagnosis, 'detail': detail, 'words': words}
            candidates[ident]['discarded_activity_coverage'] = discarded_activity_coverage(row, words, record['discarded_active_regions'])
            candidates[ident]['eligible_for_root_approval'] = candidates[ident]['discarded_activity_coverage']['all_original_discarded_activity_within_actual_new_words']
    require(set(outputs) == expected_outputs and len(outputs) == 268
        and result['exact_normalized_full_words_count'] == sum(d['exact_normalized_full_words'] for d in diagnoses) == 82
        and result['actual_valid_word_interval_count'] == sum(d['actual_intervals_valid'] for d in diagnoses) == 89
        and len(candidates) == 55, 'Entire89 raw/diagnosis/55-candidate/34-hold census differs.')
    for name in ['raw', 'diagnosis', 'call-intents']:
        require(set((folder/name).iterdir()) == {folder/name/(ident+'.private.json') for ident in selected}, 'Unknown, missing or failed original89 namespace member.')
    expected_review = {'state': 'independent_actual_whole89_sourcefree_result_readback_completed_not_approved',
        'runner_sha256': RUNNER_SHA, 'plan_sha256': PLAN_SHA, 'result_sha256': RESULT_SHA, 'actual_response_count': 89,
        'actual_call_failure_count': 0, 'exact_full_words_count': 82, 'actual_numeric_intervals_valid_count': 89,
        'strict_literal_body_count': sum(d['strict_literal_body_error'] is None for d in details),
        'one_to_one_lexical_mapping_count': sum(d['one_to_one_lexical_word_mapping'] for d in details),
        'strict_time_numeric_candidate_count_without_approval': 55, 'whole_input_map_sha256': object_sha(inputs),
        'whole_output_map_sha256': object_sha(outputs), 'actual_output_file_count': 268, 'details': details,
        'actual_failures_retained': [], 'actual_runtime': runtime, 'actual_imported_runtime': imports,
        'all_original_flags_and_discarded_activity_counterevidence_retained': True, 'model_or_api_calls': 0,
        'root_case_approval': None, 'audio_or_cues_modified': False, 'human_listening_or_acting_approval': False}
    require(review == expected_review, 'Whole exact independent89 result details must reproduce every retained case, including34 holds.')
    external.pin_file(folder/'execution-intent.private.json', bound)
    return candidates


def approved_case(row, candidate, case, args, run, profiles, qa, alignment, take, bound, binding, decode_fn=None):
    ident = row['id']; original = batch.read(run/'word-cues'/(ident+'.json')); path = run/'clips'/(ident+'.mp3')
    require(case.get('version') == VERSION and case.get('status') == 'approved_part2_sourcefree89_timing_case'
        and case.get('reviewed_by') == 'root' and case.get('mode') == MODE and case.get('word') is None
        and case.get('actual_whole_source_and_counterevidence_reviewed') is True
        and case.get('human_listening_or_acting_approval') is False and case.get('binding') == prior.case_binding(args, run, row)
        and case.get('retained_initial_take') == take and case.get('retained_initial_timing_flags') == original['all_qualification_flags']
        and not take.get('reasons') and take.get('word_error_rate') == 0
        and base.qa_engine.words(take.get('transcript', '')) == base.qa_engine.words(row['text'])
        and not take.get('adjudication'), 'Exact individual Root89 timing decision/current literal initial words and retained old flags required.')
    for name, sha in case['binding']['files_sha256'].items(): external.pin_file(name, bound, sha)
    # Existing audited physical gate is used with its own original metadata
    # schema in an explicit nested Root approval. No approval is fabricated.
    physical = case.get('physical_source_approval')
    require(isinstance(physical, dict) and physical.get('binding') == case['binding']
        and physical.get('retained_initial_take') == case['retained_initial_take']
        and physical.get('retained_initial_timing_flags') == case['retained_initial_timing_flags'], 'Actual physical Source approval must be explicit.')
    temporal, signal, path = external.physical_clip(row, run, profiles, qa, alignment, take, physical, args, bound, decode_fn)
    timing = case.get('timing'); require(isinstance(timing, dict) and timing.get('mode') == MODE
        and timing.get('whole_bundle_sha256') == object_sha(binding), 'Exact genuine entire89 Root binding required.')
    for field, directory, actual in [('raw', 'raw', candidate['raw']), ('diagnosis', 'diagnosis', candidate['diagnosis'])]:
        ref = timing.get(field)
        require(isinstance(ref, dict) and ref.get('path') == str(run/FOLDER/directory/(ident+'.private.json'))
            and prior.bound_ref(run, ref, bound) == actual, 'Root case must retain exact genuine89 whole raw and diagnosis.')
    record = candidate['record']; detail = candidate['detail']
    current_coverage = discarded_activity_coverage(row, candidate['words'], record['discarded_active_regions'])
    require(candidate.get('eligible_for_root_approval') is True and current_coverage == candidate.get('discarded_activity_coverage')
        and current_coverage['all_original_discarded_activity_within_actual_new_words'] is True
        and timing.get('retained_discarded_activity_coverage') == current_coverage,
        'Actual discarded activity outside the unchanged corresponding new word remains held; no breath/silence waiver exists.')
    require(timing.get('reproduced_detail_sha256') == object_sha(detail)
        and timing.get('retained_original_discarded_activity_counterevidence') == record['discarded_active_regions']
        and timing.get('retained_physical148_member') == record['physical148_member'], 'Root must retain complete measured discarded activity/physical148 evidence.')
    decisions = timing.get('discarded_activity_decisions')
    require(isinstance(decisions, list) and len(decisions) == len(record['discarded_active_regions'])
        and all(decision.get('counterevidence') == counter and decision.get('decision') == 'approve_actual_sourcefree89_times_keep_original_discarded_activity'
            and isinstance(decision.get('review_note'), str) and decision['review_note'].strip()
            for counter, decision in zip(record['discarded_active_regions'], decisions)), 'Every measured active-region counterexample requires a separate explicit Root decision.')
    words = prior.literal_response_body(candidate['raw']['actual_response'], row, signal['seconds'])
    require(words == candidate['words'], 'Actual bounded whole89 words must be unchanged on current physical audio.')
    cues = prior.actual_word_interval_cues(row, words, signal['seconds'], original['all_qualification_flags'],
        timing.get('flag_decisions'), 'approve_actual_sourcefree89_word_intervals_keep_original_flags')
    require(alignment.get('authored_text_sha256', {}).get(ident) == original['text_sha256'], 'Original complete Source timing census differs.')
    return {'id': ident, 'kind': row['kind'], 'speaker': row['speaker'], 'text': row['text'], 'display_text': row['display_text'],
        'voice': profiles['speakers'][row['speaker']]['google_voice'], 'audio': 'audio/teil-2/'+ident+'.mp3',
        'sha256': original['audio_sha256'], 'seconds': signal['seconds'], 'word_cues': copy.deepcopy(cues),
        'runtime_keys': copy.deepcopy(row['runtime_keys'])}, path


def build(args, initial, supplemental, external_selection, selection):
    require(digest(Path(external.__file__)) == EXTERNAL_SHA
        and digest(batch.ROOT/'scripts/part2_voice_external_evidence_publish_test.py') == EXTERNAL_TEST_SHA, 'Frozen whole external0a56 and tests must remain unchanged.')
    public, paths, preserved, bound, previous = external.build(args, initial, supplemental, external_selection)
    # Future narrow wrappers reuse this function and receive the full verified
    # baseline. No orthography or phonetic exceptions are implemented here.
    target_root = Path(initial['target_root']); target_script = target_root/'scripts'/Path(__file__).name
    require(target_script.is_file() and digest(target_script) == digest(__file__), 'Release new89 adapter must match frozen production bytes.')
    for path in [target_script, Path(__file__).resolve(), Path(args.sourcefree_timing_selection)]: external.pin_file(path, bound)
    require(selection.get('version') == VERSION and selection.get('status') == 'approved_part2_sourcefree89_timing_selection'
        and selection.get('reviewed_by') == 'root' and selection.get('human_listening_or_acting_approval') is False
        and selection.get('initial_selection_sha256') == digest(args.selection)
        and selection.get('supplemental_selection_sha256') == digest(args.supplemental_selection)
        and selection.get('external_selection_sha256') == digest(args.external_selection)
        and selection.get('external_adapter_sha256') == EXTERNAL_SHA and selection.get('adapter_sha256') == digest(__file__)
        and selection.get('target_root') == previous['target_root']
        and selection.get('preserved_banks_sha256') == previous['preserved_banks_sha256'], 'Separate exact Root89 selection must preserve the entire approved external baseline.')
    for field in ['manifest_sha256', 'profiles_sha256', 'prepared_sha256', 'qa_sha256', 'alignment_sha256', 'qa_producer_sha256', 'alignment_producer_sha256']:
        require(selection.get(field) == previous.get(field), 'Source89 union changes initial full production/provenance.')
    run = Path(args.run_dir).expanduser().resolve(); manifest, profiles = batch.read(run/'lines.private.json'), batch.read(run/'profiles.private.json')
    qa, alignment = batch.read(args.qa_report), batch.read(args.alignment_report)
    takes, checked = base.report_coverage(qa, alignment, manifest, run); rows = {row['id']: row for row in manifest['lines']}
    baseline_ids = {clip['id'] for clip in public['clips']}; chosen = base.ids(selection.get('selected_ids'), 'sourcefree89 Root union IDs')
    require(baseline_ids <= chosen <= checked, 'Source89 lane must preserve every approved baseline Source and cannot invent new IDs.')
    candidates = whole_bundle(run, rows, takes, bound, selection.get('sourcefree89_bundle'))
    additional = chosen-baseline_ids
    eligible = {ident for ident, value in candidates.items() if value['eligible_for_root_approval']}
    require(additional and additional <= eligible, 'Only individually approved physically covered genuine89 candidates may be added; all outside activity remains held.')
    refs = selection.get('case_approvals'); require(isinstance(refs, list) and len(refs) == len(additional), 'Exact selected individual Source89 Root case approvals required.')
    cases = {}
    for ref in refs:
        case = prior.bound_ref(run, ref, bound); ident = case.get('binding', {}).get('id')
        require(ident in additional and ident not in cases, 'Unknown/duplicate/noncandidate Source89 Root case.'); cases[ident] = case
    require(set(cases) == additional, 'All selected actual Root approvals must be explicit.')
    for path in base.response_records(run, additional): external.pin_file(path, bound)
    clips = {clip['id']: copy.deepcopy(clip) for clip in public['clips']}
    for ident, case in cases.items():
        clips[ident], paths[ident] = approved_case(rows[ident], candidates[ident], case, args, run, profiles, qa,
            alignment, takes[ident], bound, selection['sourcefree89_bundle'])
    public = copy.deepcopy(public); public['clips'] = [clips[row['id']] for row in manifest['lines'] if row['id'] in clips]
    coverage = public['coverage']; coverage.update(version=VERSION,
        missing_sources=[entry for entry in coverage['missing_sources'] if entry['id'] not in additional],
        published_sources=len(clips), complete_external_baseline_sources=len(baseline_ids), sourcefree89_qualified_sources=len(additional),
        sourcefree89_strict_wordtime_candidates_without_approval=55,
        sourcefree89_physical_activity_covered_candidates_without_approval=len(eligible),
        sourcefree89_outside_activity_holds_retained=55-len(eligible),
        sourcefree89_whole_checked_sources=89, sourcefree89_whole_unapproved_holds_retained=34,
        sourcefree89_independent_review_sha256=REVIEW_SHA, sourcefree89_selection_sha256=digest(args.sourcefree_timing_selection),
        all_original_flags_and_discarded_active_counterevidence_retained=True, human_listening_or_acting_approval=False)
    coverage['status'] = 'complete' if not coverage['missing_sources'] else 'partial'
    require(len(clips)+len(coverage['missing_sources']) == len(rows), 'Truthful full Source89 union coverage differs.')
    return public, paths, preserved, bound, selection


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['dryrun', 'apply']); parser.add_argument('--run-dir', required=True)
    for name in ['selection', 'supplemental-selection', 'external-selection', 'sourcefree-timing-selection',
                 'qa-report', 'alignment-report', 'qa-producer', 'alignment-producer', 'coverage-report']:
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--adapter-sha256', required=True); parser.add_argument('--target-root', type=Path); args = parser.parse_args()
    try:
        require(digest(__file__) == args.adapter_sha256, 'Root must supply the independently frozen new89 adapter SHA.')
        require(batch.PRIVATE.resolve() in args.coverage_report.resolve().parents and args.coverage_report.resolve() == args.coverage_report,
                'Immutable exact private89 coverage path required.')
        with ExitStack() as locks:
            lock = locks.enter_context((batch.PRIVATE/'publish.lock').open('a+')); fcntl.flock(lock, fcntl.LOCK_EX)
            initial, supplemental, external_selection, selection = (batch.read(path) for path in
                [args.selection, args.supplemental_selection, args.external_selection, args.sourcefree_timing_selection])
            target_root = args.target_root.expanduser().resolve() if args.target_root else batch.ROOT.resolve()
            require(initial.get('target_root') == str(target_root), 'Root89 selection must name the exact target lock worktree.')
            locks.enter_context(base.target_publish_lock(target_root))
            public, paths, preserved, bound, selection = build(args, initial, supplemental, external_selection, selection)
            target = target_root/'game/public/audio/teil-2'; base.existing(target, selection, public); base.stable(bound, preserved)
            report = {'state': 'PUBLISHED' if args.command == 'apply' else 'VALIDATED', **public['coverage'], 'version': VERSION,
                'public_manifest_sha256': batch.sha((json.dumps(public, ensure_ascii=False, indent=2)+'\n').encode()),
                'adapter_sha256': digest(__file__), 'external_adapter_sha256': EXTERNAL_SHA, 'preserved_bank_sha256': preserved,
                'checked_at': int(time.time())}
            require(not args.coverage_report.exists(), 'Original immutable89 coverage report already exists.')
            if args.command == 'apply':
                identity = None
                def finalize():
                    nonlocal identity
                    identity = base.exclusive_report(args.coverage_report, report); bound[str(args.coverage_report)] = digest(args.coverage_report)
                def undo():
                    if identity is not None and args.coverage_report.exists() and (args.coverage_report.stat().st_dev, args.coverage_report.stat().st_ino) == identity:
                        args.coverage_report.unlink()
                base.apply(target, selection, public, paths, preserved, bound, finalize, undo)
            else: base.exclusive_report(args.coverage_report, report)
            print(json.dumps({'state': report['state'], 'published': len(public['clips']), 'missing': len(public['coverage']['missing_sources']),
                              'human_listening_or_acting_approval': False}))
        return 0
    except (batch.SafeError, OSError, ValueError, TypeError, KeyError, RuntimeError, AttributeError, IndexError):
        print('Separate89 publication refused; existing evidence and banks remain protected.', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
