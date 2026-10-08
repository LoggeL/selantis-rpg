#!/usr/bin/env python3
"""Publish individually approved Body25 takes after all four genuine QA/DTW runs.

The complete current1102 bank is rebuilt from its real1089/1084 snapshots
and frozen Body31/retake8 builders. Whole25 terminal proofs are independently anchored.
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
import part2_voice_body25_qualify as body
import part2_voice_retake_publish as eight
import part2_voice_body31_publish as prior

r, base, batch = eight.r, eight.base, eight.batch
require, read, digest, exact, pin, object_sha = eight.require, eight.read, eight.digest, eight.exact, eight.pin, eight.object_sha
VERSION = 'part2-individual-actual-body25-publication-v1'
BODY_SHA = '7f60cbc67e02509e528d8e51eaeb9728bb2819cc77b9cb138a319727f32285e4'
BODY_TEST_SHA = '84a12de7838315a3bcb4212648f350729e884ea5a259c7ca930a7992137a745a'
EIGHT_SHA = '924b19c25af020a3b81784cfcac9dbd708eae3c2f2ce4bbd422db84a81840262'
EIGHT_TEST_SHA = '2caffeaf761bbca7db662bd8e51cf2abb5efd87fae5be9dea288930453017c96'
PRIOR_SHA = 'ea40a1e05a4e329d18884905c924761941d9046d23aad8c60fca2a1943836e88'
PRIOR_TEST_SHA = '1f13568ae63d2996e448fff228bf09ccff3e3a421a0231f84e5ba9963a49a839'
BASE_SELECTION_SHA = '2abdb55b6cf1208b86ab540fd3775544d77559049e39435830fe21122faff2c5'
PROVIDER_CENSUS = body.RUN/'independent-actual-qualification/body25-provider-result-review/complete-body25-four-group-provider-source-media-census.UNAPPROVED.private.json'
PROVIDER_CENSUS_SHA = '88ede3b679f20d5961badabf95e622440bc94cb413ee3d774a7372c28cf9eaf9'
RUNTIME_REVIEW = body.RUN/'independent-actual-qualification/retake8-publisher-review/body31-final-4070-current24-and-group04-held.private.json'
RUNTIME_REVIEW_SHA = 'bd03a5b87c3b4e06d0c9c64c3612e08ec484dddd7f5b066bc9435def4b843197'
METHOD_REVIEW = body.RUN/'independent-actual-qualification/body25-qualifier-review/final-7f60-actual24-http-normalization-and-one-held.private.json'
METHOD_REVIEW_SHA = 'a109f11769485eebed10142477e63f53b9043fbb5c6e30d11bbd7cad111440f8'


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
    require(body.RUN in Path(args.completed_evidence).parents, 'Whole25 independent anchor must remain in the private production run.')
    pin(args.completed_evidence, bound, args.completed_evidence_sha256)
    value = read(args.completed_evidence); specs = body.specifications()
    require(value.get('state') == 'INDEPENDENT_ACTUAL_WHOLE25_COMPLETED_EVIDENCE_UNAPPROVED'
        and value.get('qualifier_sha256') == BODY_SHA and value.get('qualifier_tests_sha256') == BODY_TEST_SHA
        and value.get('provider_census_sha256') == PROVIDER_CENSUS_SHA and value.get('root_review_sha256') == body.REVIEW_SHA
        and value.get('source32_reuse_approved') is False and value.get('logge_reuse_approved') is False
        and value.get('shared_take_reuse_approved') is False and value.get('human_listening_or_acting_approval') is False
        and value.get('model_or_api_calls') == 0, 'Independent exact whole25 original completed-evidence anchor required, without any approval claim.')
    reviews = value.get('operation_reviews'); require(isinstance(reviews, list) and len(reviews) == 8, 'Eight independently anchored terminal operations required.')
    expected = {(name, command) for name in specs for command in ['qa', 'align']}
    require(all(isinstance(item, dict) and set(item) == {'run', 'command', 'review'} for item in reviews)
        and {(item['run'], item['command']) for item in reviews} == expected, 'Whole25 anchor omits/repeats/adds a group or operation.')
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
    completed_path = run/('body25-'+command+'-completed.private.json')
    inputs_path = run/('body25-'+command+'-inputs.private.json')
    intent_path = run/('qualification-'+command+'.intent.private.json')
    report_path = run/('qa.private.json' if command == 'qa' else 'word-cues/alignment.private.json')
    require(review.get('state') == 'ACTUAL_COMPLETED_ORIGINAL_INPUT_OUTPUT_RAW_WAVE_RUNTIME_SOURCE_CPU_REVIEW_PASS'
        and review.get('command') == command and review.get('run') == str(run)
        and review.get('group') == int(run.name.rsplit('-', 1)[1]) and review.get('actual_selected_count') == len(ids)
        and review.get('model_runtime_reference_sha256') == RUNTIME_REVIEW_SHA
        and review.get('current_source_cast_provider_and_7044_188_1490_rechecked') is True
        and review.get('actual_body25_method_review_sha256') == METHOD_REVIEW_SHA
        and all(review.get(key) is False for key in ['source32_reuse_approved', 'logge_reuse_approved', 'shared_take_reuse_approved'])
        and review.get('model_or_api_calls_by_reviewer') == 0
        and review.get('audio_reports_cues_or_historical_files_modified') is False
        and review.get('human_listening_or_acting_approval') is False, 'Independently anchored complete actual operation review required.')
    pin(producer_path, bound, review['producer_sha256']); pin(completed_path, bound, review['immutable_completed_proof_sha256'])
    producer, completed, inputs, intent, report = (read(path) for path in [producer_path, completed_path, inputs_path, intent_path, report_path])
    expected_helpers = body.helpers()
    if historical_tests is not None:
        require(body.RUN in Path(historical_tests).parents, 'Historical tests must remain in the private original run.')
        pin(Path(historical_tests), bound, BODY_TEST_SHA)
        require(expected_helpers.get('body25_tests') == BODY_TEST_SHA, 'Actual immutable production helper must retain the original historical test bytes.')
    require(completed.get('version') == inputs.get('version') == producer.get('version') == body.VERSION
        and completed.get('command') == inputs.get('command') == producer.get('command') == command
        and completed.get('state') == 'IMMUTABLE_ACTUAL_COMPLETED_PRODUCER_PROOF'
        and inputs.get('state') == 'ONCE_INPUT_BYTES_BEFORE_MODEL' and producer.get('state') == 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT'
        and all(completed.get(key) is False and inputs.get(key) is False and producer.get(key) is False
            for key in ['source32_reuse_approved', 'logge_reuse_approved', 'shared_take_reuse_approved'])
        and completed.get('word_time_or_human_adoption') is False and inputs.get('root_body25_review_sha256') == body.REVIEW_SHA
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
def archived_prior_reader(args, selection):
    """Replay truthful historical1089/1084 metadata inside the frozen31 builder.

    Current physical target remains1102 throughout. Every archived1089 byte and
    old clip is checked against the real snapshot and the current physical bank.
    Only the two historical baseline metadata fields are scoped to that snapshot;
    model/helper/Source/Root decision bindings are never replaced.
    """
    old_replay, old_context = prior.replay_baseline, prior.context
    snapshot = eight.private_ref(body.RUN, selection['baseline_snapshot'], {})
    binding = selection['binding']; files = binding['baseline_files_sha256']
    require(binding['baseline_manifest_sha256'] == selection['baseline_snapshot']['sha256'] == files['manifest.json'],
            'Original1089 snapshot bytes differ.')
    def archived(replay_args, bound):
        pin(Path(eight.__file__), bound, EIGHT_SHA); pin(batch.ROOT/'scripts/part2_voice_retake_publish_test.py', bound, EIGHT_TEST_SHA)
        pin(replay_args.baseline_selection, bound, prior.BASE_SELECTION_SHA)
        old_selection = read(replay_args.baseline_selection); original_report = read(replay_args.baseline_report)
        require(original_report.get('state') == 'PUBLISHED' and original_report.get('version') == eight.VERSION
            and original_report.get('published_sources') == 1089 and original_report.get('retake_selection_sha256') == prior.BASE_SELECTION_SHA
            and original_report.get('adapter_sha256') == EIGHT_SHA and original_report.get('public_manifest_sha256') == files['manifest.json'],
            'Original actual1089 complete publication lineage required.')
        original_args = copy.copy(replay_args); old_binding = old_selection['binding']
        original_args.run_dir = Path(old_binding['child_run']); original_args.selection = replay_args.baseline_selection
        original_args.baseline_report = Path(old_binding['baseline_report']['path'])
        original_args.baseline_selection = Path(old_binding['baseline_selection']['path'])
        require(original_args.run_dir == body.RUN/'retake-driver/body7-uff1-stop'
            and old_binding['target_root'] == str(args.target_root), 'Original1089 Root five-take target/scope differs.')
        with prior.archived_baseline_reader(args, old_selection): rebuilt, paths, preserved, pins, _ = eight.build(original_args, old_selection)
        exact(rebuilt, snapshot, 'Whole1089 archived manifest differs from the genuine1084 plus actual Root-five replay.')
        require(all(original_report.get(key) == value for key, value in rebuilt['coverage'].items()), 'Original1089 coverage/failures differ.')
        require(len(rebuilt['clips']) == 1089 and set(files) == {'manifest.json', *(clip['id']+'.mp3' for clip in rebuilt['clips'])},
                'Whole original1089 physical census required.')
        target = Path(args.target_root)/'game/public/audio/teil-2'
        for clip in rebuilt['clips']:
            require(digest(paths[clip['id']]) == files[clip['id']+'.mp3'] == clip['sha256'] == digest(target/(clip['id']+'.mp3')),
                    'An original1089 recording changed in current1102.')
        base.stable(pins, preserved); bound.update(pins)
        pin(replay_args.baseline_report, bound, binding['baseline_report']['sha256'])
        pin(replay_args.baseline_selection, bound, binding['baseline_selection']['sha256'])
        pin(Path(selection['baseline_snapshot']['path']), bound, selection['baseline_snapshot']['sha256'])
        return rebuilt, paths, preserved, read(body.RUN/'lines.private.json')
    def historical_context(replay_args):
        result = list(old_context(replay_args)); historical = copy.deepcopy(result[6])
        historical['baseline_manifest_sha256'] = binding['baseline_manifest_sha256']
        historical['baseline_files_sha256'] = copy.deepcopy(files); result[6] = historical
        return tuple(result)
    prior.replay_baseline, prior.context = archived, historical_context
    try: yield
    finally: prior.replay_baseline, prior.context = old_replay, old_context


def replay_baseline(args, bound):
    pin(Path(prior.__file__), bound, PRIOR_SHA); pin(batch.ROOT/'scripts/part2_voice_body31_publish_test.py', bound, PRIOR_TEST_SHA)
    pin(args.baseline_selection, bound, BASE_SELECTION_SHA); selection = read(args.baseline_selection)
    report = read(args.baseline_report); target = Path(args.target_root)/'game/public/audio/teil-2'
    require(report.get('state') == 'PUBLISHED' and report.get('version') == prior.VERSION and report.get('published_sources') == 1102
        and report.get('body31_selection_sha256') == BASE_SELECTION_SHA and report.get('adapter_sha256') == PRIOR_SHA
        and report.get('public_manifest_sha256') == digest(target/'manifest.json'), 'Genuine complete current1102 publication required.')
    old_args = copy.copy(args); binding = selection['binding']; old_args.selection = args.baseline_selection
    old_args.baseline_report = Path(binding['baseline_report']['path']); old_args.baseline_selection = Path(binding['baseline_selection']['path'])
    old_args.completed_evidence = Path(binding['completed_evidence']['path']); old_args.completed_evidence_sha256 = binding['completed_evidence']['sha256']
    require(binding['target_root'] == str(args.target_root) and binding['adapter_sha256'] == PRIOR_SHA
        and binding['adapter_tests_sha256'] == PRIOR_TEST_SHA, 'Original Root13 frozen31 target/builder/test bindings differ.')
    with archived_prior_reader(args, selection): public, paths, preserved, pins, _ = prior.build(old_args, selection)
    exact(public, read(target/'manifest.json'), 'Whole current1102 differs from original1089 plus genuine individually Root-approved13 replay.')
    require(all(report.get(key) == value for key, value in public['coverage'].items()), 'Actual1102 coverage and original holds changed.')
    base.stable(pins, preserved); bound.update(pins); pin(args.baseline_report, bound)
    return public, paths, preserved, read(body.RUN/'lines.private.json')


def context(args):
    bound = {}; pin(Path(body.__file__), bound, BODY_SHA); pin(batch.ROOT/'scripts/part2_voice_body25_qualify_test.py', bound, BODY_TEST_SHA)
    anchor = read_anchor(args, bound); pin(PROVIDER_CENSUS, bound, PROVIDER_CENSUS_SHA); census = read(PROVIDER_CENSUS)
    require(census.get('state') == 'PASS_ACTUAL_FOUR_TERMINAL_GROUPS_COMPLETE25_PROVIDER_MEDIA_SOURCE_CENSUS_UNAPPROVED'
        and census.get('actual_group_counts') == [8, 8, 8, 1] and census.get('actual_unique_new_requests') == 25
        and census.get('actual_unique_original_STOP_WAV_PCM_C2PA_MP3_receipts') == 25
        and census.get('current_source_cast_runtime_and_language_preserved') is True and census.get('audio_adoption') is False
        and census.get('new25_and_old31_ID_sets_disjoint') is True
        and census.get('source32_or_logge_or_other_route_reuse_approved') is False,
        'Whole actual25 provider/source/media census required; Source32 stays unexamined and excluded.')
    for path, sha in census['frozen_actual_completed_provider_files_sha256'].items(): pin(Path(path), bound, sha)
    pin(METHOD_REVIEW, bound, METHOD_REVIEW_SHA)
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
    require(len(rows) == 25 and set(rows) == set(census['selected_ids']), 'Exactly25 original Source IDs required; noSource32/Logge/shared-take route/adoption.')
    require(set(rows) == set(anchor.get('all_actual_selected_ids', [])) and set(candidates) == set(anchor.get('strict_word_signal_time_candidates_UNAPPROVED', []))
        and set(held) == set(anchor.get('held_ids', [])) and anchor.get('strict_count') == len(candidates) and anchor.get('held_count') == len(held),
        'Independently anchored whole25 strict/held census differs from actual original proof replay.')
    public, paths, preserved, parent = replay_baseline(args, bound)
    pin(Path(__file__), bound); pin(Path(args.target_root)/'scripts/part2_voice_body25_publish.py', bound, digest(__file__))
    binding = {'version': VERSION, 'target_root': str(args.target_root), 'adapter_sha256': digest(__file__),
        'adapter_tests_sha256': digest(batch.ROOT/'scripts/part2_voice_body25_publish_test.py'), 'qualifier_sha256': BODY_SHA,
        'completed_evidence': pin(args.completed_evidence, bound, args.completed_evidence_sha256), 'provider_census_sha256': PROVIDER_CENSUS_SHA,
        'baseline_report': pin(args.baseline_report, bound), 'baseline_selection': pin(args.baseline_selection, bound, BASE_SELECTION_SHA),
        'baseline_manifest_sha256': digest(Path(args.target_root)/'game/public/audio/teil-2/manifest.json'),
        'baseline_files_sha256': base.file_map(Path(args.target_root)/'game/public/audio/teil-2'),
        'preserved_banks_sha256': object_sha(batch.preserved_banks(Path(args.target_root)))}
    return rows, candidates, held, public, preserved, bound, binding, parent


def case_template(ident, row, candidate_clip, prior, binding):
    value = eight.case_template(ident, row, candidate_clip, prior, binding)
    value.update(version=VERSION, status='UNAPPROVED_part2_body25_case')
    return value


def propose(args):
    rows, candidates, held, public, preserved, bound, binding, parent = context(args); out = Path(args.output_dir)
    require(out.is_absolute() and body.RUN in out.parents and out.resolve() == out and not out.exists(), 'Fresh private Body25 proposal directory required.')
    out.mkdir(mode=0o700, parents=True); r.write_once(out/'baseline-manifest.private.json', (Path(args.target_root)/'game/public/audio/teil-2/manifest.json').read_bytes())
    snapshot = pin(out/'baseline-manifest.private.json', bound, binding['baseline_manifest_sha256']); old = {clip['id']: clip for clip in public['clips']}
    for ident, (clip, path) in candidates.items(): r.save_once(out/(ident+'.UNAPPROVED.private.json'), case_template(ident, rows[ident], clip, old.get(ident), binding))
    r.save_once(out/'selection.UNAPPROVED.private.json', {'version': VERSION, 'status': 'UNAPPROVED_part2_body25_selection', 'reviewed_by': None,
        'actual_whole_word_signal_and_newaudio_timing_reviewed': False, 'human_listening_or_acting_approval': False,
        'binding': binding, 'baseline_snapshot': snapshot, 'selected_retake_ids': [], 'case_approvals': []})
    r.save_once(out/'proposal.private.json', {'version': VERSION, 'status': 'whole25_actual_candidates_UNAPPROVED', 'binding': binding,
        'strictly_qualified_candidate_ids': list(candidates), 'held': held, 'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False, 'word_time_or_human_approved': False})
    base.stable(bound, preserved); require(base.file_map(Path(args.target_root)/'game/public/audio/teil-2') == binding['baseline_files_sha256'], 'Current1102 changed while preparing concrete review.')
    return candidates, held


def build(args, selection):
    rows, candidates, held, public, preserved, bound, binding, parent = context(args)
    require(set(selection) == {'version', 'status', 'reviewed_by', 'actual_whole_word_signal_and_newaudio_timing_reviewed',
        'human_listening_or_acting_approval', 'binding', 'baseline_snapshot', 'selected_retake_ids', 'case_approvals'}
        and selection.get('version') == VERSION and selection.get('status') == 'approved_part2_body25_selection'
        and selection.get('reviewed_by') == 'root' and selection.get('actual_whole_word_signal_and_newaudio_timing_reviewed') is True
        and selection.get('human_listening_or_acting_approval') is False, 'Whole25 actual evidence plus separate individual Root selection required.')
    exact(selection['binding'], binding, 'Actual whole25 completed evidence/current1102 bindings changed.')
    snapshot = eight.private_ref(body.RUN, selection['baseline_snapshot'], bound); exact(snapshot, public, 'Archived whole1102 differs.')
    require(selection['baseline_snapshot']['sha256'] == binding['baseline_manifest_sha256'], 'Original1102 exact manifestbytes required.')
    chosen = base.ids(selection['selected_retake_ids'], 'Body25 Root IDs'); require(chosen and chosen <= set(candidates), 'Only individually strict qualified actual25 takes may be selected; noSource32/word/time waiver.')
    refs = selection['case_approvals']; require(isinstance(refs, list) and len(refs) == len(chosen), 'Exactly one individual Root decision per selected actual take required.')
    old = {clip['id']: clip for clip in public['clips']}; cases = {}
    for ref in refs:
        case = eight.private_ref(body.RUN, ref, bound); ident = case.get('id'); require(ident in chosen and ident not in cases, 'Unknown/duplicate/nonselected Body25 decision.')
        expected = case_template(ident, rows[ident], candidates[ident][0], old.get(ident), binding)
        expected.update(status='approved_part2_body25_case', reviewed_by='root', actual_whole_word_signal_and_newaudio_timing_reviewed=True)
        require(isinstance(case.get('review_note'), str) and case['review_note'].strip(), 'Specific whole-evidence Root review note required.')
        expected['review_note'] = case['review_note']; exact(case, expected, 'Source/cast/runtime/newaudio/newcues/priorclip cannot be changed or waived.')
        cases[ident] = case
    require(set(cases) == chosen, 'Every selected Body25 candidate needs its exact independent Root case.')
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
        published_sources=len(clips), body25_complete_baseline_sources=len(old), body25_added_sources=len(added), body25_replaced_sources=len(replaced),
        body25_selected_sources=len(chosen), body25_held_sources=len(held), body25_strict_clear_unapproved_sources=len(set(candidates)-chosen),
        body25_actual_whole_completed_sources=25, source32_reuse_approved=False, logge_reuse_approved=False, shared_take_reuse_approved=False, all_original_word_signal_timing_failures_retained=True,
        human_listening_or_acting_approval=False, body25_selection_sha256=digest(args.selection), body25_baseline_manifest_sha256=binding['baseline_manifest_sha256'])
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
        require(digest(__file__) == args.adapter_sha256, 'Independently frozen Body25 publisher SHA required.')
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
            print(json.dumps({'state': report['state'], 'published': len(public['clips']), 'selected_body25': public['coverage']['body25_selected_sources']}))
        return 0
    except (r.SafeError, OSError, RuntimeError, ValueError, TypeError, KeyError, AttributeError, IndexError, subprocess.SubprocessError):
        print('Body25 publication refused; original proofs, current approved bank and Source32 holds preserved.', file=sys.stderr); return 1


if __name__ == '__main__': raise SystemExit(main())
