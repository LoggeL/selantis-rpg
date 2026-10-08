#!/usr/bin/env python3
"""Publish individually approved Body31 takes after all four genuine QA/DTW runs.

The complete original1089 bank is rebuilt from its real1084 archived snapshot
and frozen retake8 builder. Whole31 terminal proofs are independently anchored.
No model calls, generation, exceptions, transcript rewriting or Source32 reuse.
"""
from __future__ import annotations
import argparse
import copy
from contextlib import ExitStack, contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import part2_voice_body31_qualify as body
import part2_voice_retake_publish as eight

r, base, batch = eight.r, eight.base, eight.batch
require, read, digest, exact, pin, object_sha = eight.require, eight.read, eight.digest, eight.exact, eight.pin, eight.object_sha
VERSION = 'part2-individual-actual-body31-publication-v1'
BODY_SHA = '4070e45333cebcb74674b9ab8e8d0a8cca1c0fa4c81b628aefd795acebcc0fa8'
BODY_TEST_SHA = 'e71206b72fab45beb85d47c2ecbd99708cfce79058979bf27cb9927f8bda7368'
EIGHT_SHA = '924b19c25af020a3b81784cfcac9dbd708eae3c2f2ce4bbd422db84a81840262'
EIGHT_TEST_SHA = '2caffeaf761bbca7db662bd8e51cf2abb5efd87fae5be9dea288930453017c96'
BASE_SELECTION_SHA = '3332e192c2c09c0af4d35830544c137a670faef4a1a5ab689c8f58303f049551'
PROVIDER_CENSUS = body.RUN/'independent-actual-qualification/body31-group01-result-review/complete-body31-four-group-provider-source-media-census.UNAPPROVED.private.json'
PROVIDER_CENSUS_SHA = 'f9d6067e5cb4d43333f2131748a5608bbad9779b109e0ae13150e1c8e0b2ed83'
RUNTIME_REVIEW = body.RUN/'independent-actual-qualification/retake8-publisher-review/body31-final-4070-current24-and-group04-held.private.json'
RUNTIME_REVIEW_SHA = 'bd03a5b87c3b4e06d0c9c64c3612e08ec484dddd7f5b066bc9435def4b843197'


def waveform(path, decoder):
    import numpy as np
    require(decoder.get('format') == 's16le' and decoder.get('codec') == 'pcm_s16le', 'Actual source-free QA uses its original s16le decoder contract.')
    pcm = subprocess.run([decoder['selected_path'], '-nostdin', '-i', str(path), '-threads', '0', '-f', 's16le',
        '-ac', '1', '-acodec', 'pcm_s16le', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, dtype='<i2').astype(np.float32)/np.float32(32768.0)
    require(audio.ndim == 1 and len(audio) and np.isfinite(audio).all(), 'Actual current source-free waveform invalid.')
    return {'input_kind': 'actual_decoded_waveform_array_only', 'sample_rate': 16000, 'sample_count': int(len(audio)),
        'dtype': str(audio.dtype), 'waveform_sha256': hashlib.sha256(audio.tobytes()).hexdigest(), 'decoder': decoder}


def read_anchor(args, bound):
    require(body.RUN in Path(args.completed_evidence).parents, 'Whole31 independent anchor must remain in the private production run.')
    pin(args.completed_evidence, bound, args.completed_evidence_sha256)
    value = read(args.completed_evidence); specs = body.specifications()
    require(value.get('state') == 'INDEPENDENT_ACTUAL_WHOLE31_COMPLETED_EVIDENCE_UNAPPROVED'
        and value.get('qualifier_sha256') == BODY_SHA and value.get('qualifier_tests_sha256') == BODY_TEST_SHA
        and value.get('provider_census_sha256') == PROVIDER_CENSUS_SHA and value.get('root_review_sha256') == body.REVIEW_SHA
        and value.get('source32_reuse_approved') is False and value.get('human_listening_or_acting_approval') is False
        and value.get('model_or_api_calls') == 0, 'Independent exact whole31 original completed-evidence anchor required, without any approval claim.')
    reviews = value.get('operation_reviews'); require(isinstance(reviews, list) and len(reviews) == 8, 'Eight independently anchored terminal operations required.')
    expected = {(name, command) for name in specs for command in ['qa', 'align']}
    require(all(isinstance(item, dict) and set(item) == {'run', 'command', 'review'} for item in reviews)
        and {(item['run'], item['command']) for item in reviews} == expected, 'Whole31 anchor omits/repeats/adds a group or operation.')
    historical_test = value.get('historical_qualifier_tests')
    require(isinstance(historical_test, dict) and set(historical_test) == {'path', 'sha256'} and historical_test.get('sha256') == BODY_TEST_SHA,
            'Original historical model-run test bytes must remain separately archived.')
    require(body.RUN in Path(historical_test['path']).parents, 'Historical test archive must remain private.')
    pin(Path(historical_test['path']), bound, BODY_TEST_SHA)
    return value


def historical(run, command, ref, bound, model, historical_tests=None):
    review = eight.private_ref(body.RUN, ref, bound)
    info = body.group(run); ids = info['selected_ids']
    producer_path = run/('qualification-'+command+'.producer.private.json')
    completed_path = run/('body31-'+command+'-completed.private.json')
    inputs_path = run/('body31-'+command+'-inputs.private.json')
    intent_path = run/('qualification-'+command+'.intent.private.json')
    report_path = run/('qa.private.json' if command == 'qa' else 'word-cues/alignment.private.json')
    require(review.get('state') == 'ACTUAL_COMPLETED_ORIGINAL_INPUT_OUTPUT_RAW_WAVE_RUNTIME_SOURCE_CPU_REVIEW_PASS'
        and review.get('command') == command and review.get('run') == str(run)
        and review.get('group') == int(run.name.rsplit('-', 1)[1]) and review.get('actual_selected_count') == len(ids)
        and review.get('model_runtime_reference_sha256') == RUNTIME_REVIEW_SHA
        and review.get('current_source_cast_provider_and_7044_188_1490_rechecked') is True
        and review.get('source32_reuse_approved') is False and review.get('model_or_api_calls_by_reviewer') == 0
        and review.get('audio_reports_cues_or_historical_files_modified') is False
        and review.get('human_listening_or_acting_approval') is False, 'Independently anchored complete actual operation review required.')
    pin(producer_path, bound, review['producer_sha256']); pin(completed_path, bound, review['immutable_completed_proof_sha256'])
    producer, completed, inputs, intent, report = (read(path) for path in [producer_path, completed_path, inputs_path, intent_path, report_path])
    expected_helpers = body.helpers()
    if historical_tests is not None:
        require(body.RUN in Path(historical_tests).parents, 'Historical tests must remain in the private original run.')
        pin(Path(historical_tests), bound, BODY_TEST_SHA)
        require(expected_helpers.get('body31_tests') == BODY_TEST_SHA, 'Actual immutable production helper must retain the original historical test bytes.')
    require(completed.get('version') == inputs.get('version') == producer.get('version') == body.VERSION
        and completed.get('command') == inputs.get('command') == producer.get('command') == command
        and completed.get('state') == 'IMMUTABLE_ACTUAL_COMPLETED_PRODUCER_PROOF'
        and inputs.get('state') == 'ONCE_INPUT_BYTES_BEFORE_MODEL' and producer.get('state') == 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT'
        and completed.get('source32_reuse_approved') is False and completed.get('word_time_or_human_adoption') is False
        and inputs.get('source32_reuse_approved') is False and inputs.get('root_body31_review_sha256') == body.REVIEW_SHA
        and inputs.get('helpers_sha256') == producer.get('helpers_sha256') == expected_helpers
        and completed.get('producer_sha256') == digest(producer_path) and completed.get('input_proof_sha256') == digest(inputs_path)
        and completed.get('operation_intent_sha256') == digest(intent_path) and intent.get('state') == 'ONE_ROOT_ACTUAL_RUN_STARTED'
        and all(producer.get(key) == value for key, value in intent.items() if key != 'state'), 'Original before-model inputs/once-intent/immutable completion linkage changed.')
    original = inputs.get('complete_pre_existing_child_sha256'); require(isinstance(original, dict) and original, 'Whole original before-model input census required.')
    complete = {**original, inputs_path.name: digest(inputs_path)}
    exact(producer.get('pre_existing_child_sha256'), complete, 'Original producer input omissions cannot be repaired with current pins.')
    exact(completed.get('complete_original_inputs_sha256'), complete, 'Immutable completion must retain every original input byte.')
    calls = producer.get('actual_model_call_ids'); require(isinstance(calls, list) and len(calls) == len(set(calls)) and set(calls) <= set(ids), 'Actual model-call scope differs.')
    if command == 'qa':
        expected = {'qa.private.json'} | {folder+'/'+ident+'.private.json' for folder in ['asr-raw', 'local-asr-intents'] for ident in calls}
        if (run/'qa-asr-cache.private.json').exists(): expected.add('qa-asr-cache.private.json')
    else:
        require(calls == ids, 'Whole prepared group needs original authored timing calls.')
        expected = {'word-cues/alignment.private.json'} | {'word-cues/'+ident+'.json' for ident in ids}
        expected |= {folder+'/'+ident+'.private.json' for folder in ['alignment-raw', 'local-alignment-intents'] for ident in ids}
    outputs = producer.get('created_outputs_sha256')
    require(isinstance(outputs, dict) and set(outputs) == expected and not set(outputs) & set(complete), 'Every actual raw/intent/cache/cue/report output is mandatory.')
    exact(completed.get('complete_original_outputs_sha256'), outputs, 'Completion cannot omit/relabel original raw outputs.')
    require(review.get('original_input_count') == len(complete) and review.get('original_input_map_sha256') == object_sha(complete)
        and review.get('original_output_count') == len(outputs) and review.get('original_output_map_sha256') == object_sha(outputs)
        and review.get('actual_model_call_count') == len(calls) and completed.get('actual_model_call_ids') == calls,
        'Independently frozen whole original input/output/call census differs.')
    exact(producer.get('model'), model, 'Actual complete installed model/runtime/aliases/decoder differ from the original reviewed model.')
    require(producer.get('selected_ids') == ids and producer.get('prepared_sha256') == digest(run/'prepared.json')
        and producer.get('input_sha256') == info['input_sha256'] and producer.get('source_manifest_sha256') == digest(run/'lines.private.json')
        and producer.get('source32_reuse_approved') is False and producer.get('human_listening_or_acting_or_voice_identity_approved') is False
        and not producer.get('runtime_guard_failed') and producer.get('operation_decoder') == model['decoders'][command]
        and producer.get('operation_source_kind') == ('sourcefree_words' if command == 'qa' else 'authored_timing_only')
        and producer.get('report_path') == str(report_path) and producer.get('report_sha256') == completed.get('report_sha256') == digest(report_path)
        and producer.get('report_status') == review.get('report_status') == report.get('status'), 'Actual whole Source/model/report operation lineage differs.')
    exact(review.get('retained_failures'), report['failures'], 'Whole original report failures must remain in the independent review.')
    imports = producer.get('actual_imported_runtime'); require(isinstance(imports, dict) and set(imports) == set(body.IMPORTS), 'All17 actual runtime origins required.')
    for observed in imports.values():
        expected_sha = model['runtime_files_sha256'].get(observed.get('path'))
        require(expected_sha is not None and observed.get('sha256') == expected_sha, 'Actual imported origin must belong to the original model runtime and retain its recorded byte SHA.')
        pin(Path(observed['path']), bound, expected_sha)
    union = {str(batch.contained(run, name)): value for name, value in {**complete, **outputs}.items()}
    for path in [producer_path, completed_path, intent_path]: union[str(path)] = digest(path)
    exact(review.get('complete_current_historical_files_sha256'), union, 'The independent review must preserve the whole exact historical union, not a fresh projection.')
    for path, value in union.items(): pin(Path(path), bound, value)
    verified = body.q.verify_word_report(run, report, model) if command == 'qa' else body.q.verify_timing_report(run, report, model)
    exact(calls, verified, 'Actual whole raw-response census differs.')
    if command == 'qa':
        exact(producer.get('actual_source_free_ids'), calls, 'Actual source-free call census differs.')
        for ident in calls:
            raw = read(run/'asr-raw'/(ident+'.private.json')); call = read(run/'local-asr-intents'/(ident+'.private.json'))
            actual = waveform(run/'clips'/(ident+'.mp3'), model['decoders']['qa'])
            exact(raw.get('actual_audio_input'), actual, 'Raw recognizer input must be the actual independently decoded waveform.')
            exact(call.get('actual_audio_input'), actual, 'Original waveform call-intent differs.')
            exact(raw.get('actual_imported_runtime'), imports, 'Original actual recognizer import receipts differ.')
            exact(call.get('actual_imported_runtime'), imports, 'Original import-intent receipts differ.')
    else: exact(producer.get('actual_timing_ids'), calls, 'Actual authored timing call census differs.')
    return producer, report


@contextmanager
def archived_baseline_reader(args, selection):
    """Truthful original1084 snapshot replay; never simulate current target bytes."""
    old = eight.actual_baseline
    def archived(replay_args, manifest, profiles, bound):
        snapshot = eight.private_ref(body.RUN, selection['baseline_snapshot'], bound)
        binding = selection['binding']; files = binding['baseline_files_sha256']
        require(binding['baseline_manifest_sha256'] == selection['baseline_snapshot']['sha256'] == files['manifest.json'], 'Original1084 snapshot bytes differ.')
        original_report = read(replay_args.baseline_report); original_selection = read(replay_args.baseline_selection)
        require(original_report.get('state') == 'PUBLISHED' and original_report.get('published_sources') == 1084
            and original_report.get('public_manifest_sha256') == files['manifest.json']
            and original_report.get('name_case_selection_sha256') == digest(replay_args.name_case_selection), 'Original actual1084 publication lineage required.')
        legacy = copy.copy(replay_args); legacy.run_dir = str(body.RUN); legacy.selection = replay_args.initial_selection
        lineage = [read(path) for path in [legacy.initial_selection, legacy.supplemental_selection, legacy.external_selection,
                   legacy.sourcefree_timing_selection, legacy.orthography_selection, legacy.name_case_selection]]
        rebuilt, paths, preserved, pins, previous = eight.name_baseline.build(legacy, *lineage)
        exact(rebuilt, snapshot, 'Whole1084 archived manifest differs from genuine complete original name/orthography/89/external builder replay.')
        exact(previous, original_selection, 'Original1084 replay uses another Root selection.')
        require(len(rebuilt['clips']) == 1084 and set(files) == {'manifest.json', *(clip['id']+'.mp3' for clip in rebuilt['clips'])}, 'Entire original1084 physical census required.')
        target = Path(args.target_root)/'game/public/audio/teil-2'
        for clip in rebuilt['clips']:
            require(digest(paths[clip['id']]) == files[clip['id']+'.mp3'] == clip['sha256'] == digest(target/(clip['id']+'.mp3')), 'An original1084 clip changed in current1089.')
        base.stable(pins, preserved); bound.update(pins)
        pin(replay_args.baseline_report, bound, binding['baseline_report']['sha256'])
        pin(replay_args.baseline_selection, bound, binding['baseline_selection']['sha256'])
        return rebuilt, files, preserved, batch.preserved_banks(Path(args.target_root))
    eight.actual_baseline = archived
    try: yield
    finally: eight.actual_baseline = old


def replay_baseline(args, bound):
    pin(Path(eight.__file__), bound, EIGHT_SHA); pin(batch.ROOT/'scripts/part2_voice_retake_publish_test.py', bound, EIGHT_TEST_SHA)
    pin(args.baseline_selection, bound, BASE_SELECTION_SHA); selection = read(args.baseline_selection)
    report = read(args.baseline_report); target = Path(args.target_root)/'game/public/audio/teil-2'
    require(report.get('state') == 'PUBLISHED' and report.get('version') == eight.VERSION and report.get('published_sources') == 1089
        and report.get('retake_selection_sha256') == BASE_SELECTION_SHA and report.get('adapter_sha256') == EIGHT_SHA
        and report.get('public_manifest_sha256') == digest(target/'manifest.json'), 'Genuine complete current1089 publication required.')
    old_args = copy.copy(args); binding = selection['binding']; old_args.run_dir = Path(binding['child_run'])
    old_args.selection = args.baseline_selection; old_args.baseline_report = Path(binding['baseline_report']['path'])
    old_args.baseline_selection = Path(binding['baseline_selection']['path'])
    require(old_args.run_dir == body.RUN/'retake-driver/body7-uff1-stop' and binding['target_root'] == str(args.target_root), 'Exact existing approved five-retake scope required.')
    with archived_baseline_reader(args, selection): public, paths, preserved, pins, _ = eight.build(old_args, selection)
    exact(public, read(target/'manifest.json'), 'Whole current1089 differs from original1084 plus genuine Root-approved five-retake replay.')
    require(all(report.get(key) == value for key, value in public['coverage'].items()), 'Actual1089 coverage and original holds changed.')
    base.stable(pins, preserved); bound.update(pins); pin(args.baseline_report, bound)
    parent = read(body.RUN/'lines.private.json')
    return public, paths, preserved, parent


def context(args):
    bound = {}; pin(Path(body.__file__), bound, BODY_SHA); pin(batch.ROOT/'scripts/part2_voice_body31_qualify_test.py', bound, BODY_TEST_SHA)
    anchor = read_anchor(args, bound); pin(PROVIDER_CENSUS, bound, PROVIDER_CENSUS_SHA); census = read(PROVIDER_CENSUS)
    require(census.get('status') == 'PASS_ACTUAL_FOUR_TERMINAL_GROUPS_COMPLETE31_PROVIDER_MEDIA_SOURCE_CENSUS_UNAPPROVED'
        and census.get('request_group_counts') == [8, 8, 8, 7] and census.get('actual_unique_new_TTS_request_count') == 31
        and census.get('actual_unique_STOP_original_WAV_MP3_receipt_count') == 31 and census.get('actual_new32_audio_or_request_claim') is False
        and census.get('current_source_cast_runtime_language_preserved') is True and census.get('audio_adoption') is False,
        'Whole actual31 provider/source/media census required; Source32 stays unexamined and excluded.')
    for path, sha in census['frozen_files_sha256'].items(): pin(Path(path), bound, sha)
    pin(RUNTIME_REVIEW, bound, RUNTIME_REVIEW_SHA); model = read(RUNTIME_REVIEW)['actual_runtime_metadata_without_loading_model']
    exact(body.model_identity(body.MODEL), model, 'Original reviewed installed model/runtime bytes changed.'); body.loader_guard(model)
    for path, sha in model['runtime_files_sha256'].items(): pin(Path(path), bound, sha)
    pin(Path(model['local_directory'])/'config.json', bound, model['config_sha256']); eight.model_weights(Path(model['local_directory']), model['weights'], bound)
    refs = {(item['run'], item['command']): item['review'] for item in anchor['operation_reviews']}
    rows, candidates, held = {}, {}, {}
    for name, spec in body.specifications().items():
        run = Path(name); info, source = body.collected(run, live=True)
        historical_test_path = Path(anchor['historical_qualifier_tests']['path'])
        qp, word = historical(run, 'qa', refs[(name, 'qa')], bound, model, historical_test_path)
        tp, timing = historical(run, 'align', refs[(name, 'align')], bound, model, historical_test_path)
        manifest, profiles = read(run/'lines.private.json'), read(run/'profiles.private.json')
        takes, checked = base.report_coverage(word, timing, manifest, run)
        require(checked == set(source), 'Every actual whole group signal/timing must remain accounted for.')
        rows.update(source)
        for ident, row in source.items():
            try: candidates[ident] = eight.candidate(row, run, profiles, takes[ident], word, timing)
            except (r.SafeError, RuntimeError, ValueError, TypeError, KeyError, IndexError):
                held[ident] = {'original_word_reasons': copy.deepcopy(takes[ident].get('reasons', [])),
                    'original_timing_failures': [copy.deepcopy(item) for item in timing['failures'] if item['id'] == ident], 'status': 'held_no_waiver_route'}
        snapshot = read(run/'parent-snapshot.private.json')
        for relative, sha in snapshot['parent_protected_file_sha256'].items(): pin(batch.contained(body.RUN, relative), bound, sha)
    require(len(rows) == 31 and set(rows) == set(census['selected_new_request_ids']), 'Exactly31 original Source IDs required; noSource32 route/adoption.')
    public, paths, preserved, parent = replay_baseline(args, bound)
    pin(Path(__file__), bound); pin(Path(args.target_root)/'scripts/part2_voice_body31_publish.py', bound, digest(__file__))
    binding = {'version': VERSION, 'target_root': str(args.target_root), 'adapter_sha256': digest(__file__),
        'adapter_tests_sha256': digest(batch.ROOT/'scripts/part2_voice_body31_publish_test.py'), 'qualifier_sha256': BODY_SHA,
        'completed_evidence': pin(args.completed_evidence, bound, args.completed_evidence_sha256), 'provider_census_sha256': PROVIDER_CENSUS_SHA,
        'baseline_report': pin(args.baseline_report, bound), 'baseline_selection': pin(args.baseline_selection, bound, BASE_SELECTION_SHA),
        'baseline_manifest_sha256': digest(Path(args.target_root)/'game/public/audio/teil-2/manifest.json'),
        'baseline_files_sha256': base.file_map(Path(args.target_root)/'game/public/audio/teil-2'),
        'preserved_banks_sha256': object_sha(batch.preserved_banks(Path(args.target_root)))}
    return rows, candidates, held, public, preserved, bound, binding, parent


def case_template(ident, row, candidate_clip, prior, binding):
    value = eight.case_template(ident, row, candidate_clip, prior, binding)
    value.update(version=VERSION, status='UNAPPROVED_part2_body31_case')
    return value


def propose(args):
    rows, candidates, held, public, preserved, bound, binding, parent = context(args); out = Path(args.output_dir)
    require(out.is_absolute() and body.RUN in out.parents and out.resolve() == out and not out.exists(), 'Fresh private Body31 proposal directory required.')
    out.mkdir(mode=0o700, parents=True); r.write_once(out/'baseline-manifest.private.json', (Path(args.target_root)/'game/public/audio/teil-2/manifest.json').read_bytes())
    snapshot = pin(out/'baseline-manifest.private.json', bound, binding['baseline_manifest_sha256']); old = {clip['id']: clip for clip in public['clips']}
    for ident, (clip, path) in candidates.items(): r.save_once(out/(ident+'.UNAPPROVED.private.json'), case_template(ident, rows[ident], clip, old.get(ident), binding))
    r.save_once(out/'selection.UNAPPROVED.private.json', {'version': VERSION, 'status': 'UNAPPROVED_part2_body31_selection', 'reviewed_by': None,
        'actual_whole_word_signal_and_newaudio_timing_reviewed': False, 'human_listening_or_acting_approval': False,
        'binding': binding, 'baseline_snapshot': snapshot, 'selected_retake_ids': [], 'case_approvals': []})
    r.save_once(out/'proposal.private.json', {'version': VERSION, 'status': 'whole31_actual_candidates_UNAPPROVED', 'binding': binding,
        'strictly_qualified_candidate_ids': list(candidates), 'held': held, 'source32_reuse_approved': False, 'word_time_or_human_approved': False})
    base.stable(bound, preserved); require(base.file_map(Path(args.target_root)/'game/public/audio/teil-2') == binding['baseline_files_sha256'], 'Current1089 changed while preparing concrete review.')
    return candidates, held


def build(args, selection):
    rows, candidates, held, public, preserved, bound, binding, parent = context(args)
    require(set(selection) == {'version', 'status', 'reviewed_by', 'actual_whole_word_signal_and_newaudio_timing_reviewed',
        'human_listening_or_acting_approval', 'binding', 'baseline_snapshot', 'selected_retake_ids', 'case_approvals'}
        and selection.get('version') == VERSION and selection.get('status') == 'approved_part2_body31_selection'
        and selection.get('reviewed_by') == 'root' and selection.get('actual_whole_word_signal_and_newaudio_timing_reviewed') is True
        and selection.get('human_listening_or_acting_approval') is False, 'Whole31 actual evidence plus separate individual Root selection required.')
    exact(selection['binding'], binding, 'Actual whole31 completed evidence/current1089 bindings changed.')
    snapshot = eight.private_ref(body.RUN, selection['baseline_snapshot'], bound); exact(snapshot, public, 'Archived whole1089 differs.')
    require(selection['baseline_snapshot']['sha256'] == binding['baseline_manifest_sha256'], 'Original1089 exact manifestbytes required.')
    chosen = base.ids(selection['selected_retake_ids'], 'Body31 Root IDs'); require(chosen and chosen <= set(candidates), 'Only individually strict qualified actual31 takes may be selected; noSource32/word/time waiver.')
    refs = selection['case_approvals']; require(isinstance(refs, list) and len(refs) == len(chosen), 'Exactly one individual Root decision per selected actual take required.')
    old = {clip['id']: clip for clip in public['clips']}; cases = {}
    for ref in refs:
        case = eight.private_ref(body.RUN, ref, bound); ident = case.get('id'); require(ident in chosen and ident not in cases, 'Unknown/duplicate/nonselected Body31 decision.')
        expected = case_template(ident, rows[ident], candidates[ident][0], old.get(ident), binding)
        expected.update(status='approved_part2_body31_case', reviewed_by='root', actual_whole_word_signal_and_newaudio_timing_reviewed=True)
        require(isinstance(case.get('review_note'), str) and case['review_note'].strip(), 'Specific whole-evidence Root review note required.')
        expected['review_note'] = case['review_note']; exact(case, expected, 'Source/cast/runtime/newaudio/newcues/priorclip cannot be changed or waived.')
        cases[ident] = case
    require(set(cases) == chosen, 'Every selected Body31 candidate needs its exact independent Root case.')
    target = Path(args.target_root)/'game/public/audio/teil-2'; paths = {ident: target/(ident+'.mp3') for ident in old}; clips = copy.deepcopy(old)
    for ident in chosen:
        old_path = str(target/(ident+'.mp3'))
        if old_path in bound:
            require(ident in old and bound[old_path] == old[ident]['sha256'], 'Only the exact explicitly approved prior public recording may be replaced.')
            del bound[old_path]
        clips[ident], paths[ident] = candidates[ident]
    for ident in set(old)-chosen: pin(paths[ident], bound, old[ident]['sha256'])
    for ident in chosen: pin(paths[ident], bound, clips[ident]['sha256'])
    public = copy.deepcopy(public); public['clips'] = [clips[row['id']] for row in parent['lines'] if row['id'] in clips]
    added, replaced = chosen-set(old), chosen & set(old)
    public['coverage'].update(version=VERSION, missing_sources=[value for value in public['coverage']['missing_sources'] if value['id'] not in added],
        published_sources=len(clips), body31_complete_baseline_sources=len(old), body31_added_sources=len(added), body31_replaced_sources=len(replaced),
        body31_selected_sources=len(chosen), body31_held_sources=len(held), body31_strict_clear_unapproved_sources=len(set(candidates)-chosen),
        body31_actual_whole_completed_sources=31, source32_reuse_approved=False, all_original_word_signal_timing_failures_retained=True,
        human_listening_or_acting_approval=False, body31_selection_sha256=digest(args.selection), body31_baseline_manifest_sha256=binding['baseline_manifest_sha256'])
    public['coverage']['status'] = 'complete' if not public['coverage']['missing_sources'] else 'partial'
    require(len(clips)+len(public['coverage']['missing_sources']) == len(parent['lines']), 'Truthful complete Source coverage differs.')
    pin(args.selection, bound); return public, paths, preserved, bound, {'target_root': str(args.target_root), 'existing_manifest_sha256': binding['baseline_manifest_sha256']}


def parser():
    value = argparse.ArgumentParser(description=__doc__); value.add_argument('command', choices=['propose', 'dryrun', 'apply'])
    for name in ['target-root', 'baseline-report', 'baseline-selection', 'initial-selection', 'supplemental-selection', 'external-selection',
                 'sourcefree-timing-selection', 'orthography-selection', 'name-case-selection', 'qa-report', 'alignment-report',
                 'qa-producer', 'alignment-producer', 'completed-evidence']: value.add_argument('--'+name, type=Path, required=True)
    value.add_argument('--completed-evidence-sha256', required=True); value.add_argument('--adapter-sha256', required=True)
    for name in ['output-dir', 'selection', 'coverage-report']: value.add_argument('--'+name, type=Path)
    return value


def main():
    os.umask(0o077); args = parser().parse_args()
    try:
        require(digest(__file__) == args.adapter_sha256, 'Independently frozen Body31 publisher SHA required.')
        for key, path in vars(args).items():
            if isinstance(path, Path): require(path.is_absolute() and path.resolve() == path, 'Exact absolute input/output paths required.')
        with ExitStack() as locks:
            lock = locks.enter_context((r.PRIVATE/'publish.lock').open('a+')); fcntl.flock(lock, fcntl.LOCK_EX)
            locks.enter_context(base.target_publish_lock(args.target_root))
            if args.command == 'propose':
                require(args.output_dir is not None and args.selection is None and args.coverage_report is None, 'Fresh proposal directory alone required.')
                candidates, held = propose(args); print(json.dumps({'state': 'UNAPPROVED', 'strict_candidates': len(candidates), 'held': len(held)})); return 0
            require(args.selection is not None and args.coverage_report is not None and args.output_dir is None
                and body.RUN in args.coverage_report.parents and not args.coverage_report.exists(), 'Separate Root selection plus fresh private coverage path required.')
            public, paths, preserved, bound, transition = build(args, read(args.selection)); target = args.target_root/'game/public/audio/teil-2'
            base.existing(target, transition, public); base.stable(bound, preserved)
            report = {'state': 'PUBLISHED' if args.command == 'apply' else 'VALIDATED', **public['coverage'], 'adapter_sha256': digest(__file__),
                'public_manifest_sha256': r.sha((json.dumps(public, ensure_ascii=False, indent=2)+'\n').encode()), 'preserved_bank_sha256': preserved, 'checked_at': int(time.time())}
            if args.command == 'apply':
                identity = None
                def finalize():
                    nonlocal identity
                    identity = base.exclusive_report(args.coverage_report, report); bound[str(args.coverage_report)] = digest(args.coverage_report)
                def undo():
                    if identity is not None and args.coverage_report.exists() and (args.coverage_report.stat().st_dev, args.coverage_report.stat().st_ino) == identity: args.coverage_report.unlink()
                base.apply(target, transition, public, paths, preserved, bound, finalize, undo)
            else: base.exclusive_report(args.coverage_report, report)
            print(json.dumps({'state': report['state'], 'published': len(public['clips']), 'selected_body31': public['coverage']['body31_selected_sources']}))
        return 0
    except (r.SafeError, OSError, RuntimeError, ValueError, TypeError, KeyError, AttributeError, IndexError, subprocess.SubprocessError):
        print('Body31 publication refused; original proofs, current approved bank and Source32 holds preserved.', file=sys.stderr); return 1


if __name__ == '__main__': raise SystemExit(main())
