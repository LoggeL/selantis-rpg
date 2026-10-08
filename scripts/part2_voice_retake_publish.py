#!/usr/bin/env python3
"""Compose individually Root-approved actual retake8 takes into an existing bank.

No audio generation, model inference, downloads, transcript correction, timing
adoption or old evidence writes. Propose archives the exact existing manifest
and produces unapproved case templates. Dryrun/apply require individual Root
decisions and keep every other approved recording and its original cues intact.
"""
from __future__ import annotations
import argparse
import copy
from contextlib import ExitStack
import fcntl
import json
import os
from pathlib import Path
import sys
import time
import part2_voice_retake_qualify as qualify
import part2_voice_publish as base
import part2_voice_sourcefree_timing_publish as timing_baseline
import part2_voice_orthography_publish as orthography_baseline
import part2_voice_name_case_publish as name_baseline

r, batch, qa, cues = qualify.retake, qualify.batch, qualify.qa, qualify.cues
require, digest, read = r.require, r.digest, r.read
VERSION = 'part2-individual-actual-retake8-publication-v1'
QUALIFIER_SHA = '8ee334962fd25464e70d03209ab51d5f8d8c45cb47fc305a9fc0c9741523b877'
QUALIFIER_TEST_SHA = '2252f1a7d2d92b82d06e8919cc22b1b7764fbd0df272105d6d27bdf9f89969de'
PRODUCER_PINS = {
    'qa': {'sha256': 'd6fa3d64e16f8465058aea96ab69fe4f723eb4ec12ffed12730a95b8a681a994',
           'input_count': 76, 'input_map_sha256': '54999c7a78072cf3bdcfe62ac9ea96438378e1432c276a8c753154af3ec35387'},
    'align': {'sha256': '608ec4d78128ab0989622a90e00089f56ed085459b89e1677d002ce7f45e9c9a',
              'input_count': 96, 'input_map_sha256': 'c55c12bf6ff6c784e78f883c22cac13b6e31531505d696d5f24e86f9a5cfbbd7'},
}
RESULT_REVIEW = 'independent-actual-qualification/body31-group01-result-review/body7-uff1-terminal-QA8-align8-review.private.json'
RESULT_REVIEW_SHA = '434459e144d153c885c68c13b1a59d72bb42dad86c17231c7a25861eca94f5cd'
BASELINES = {
    'part2-separate-sourcefree89-timing-publication-v1': (1028, 'sourcefree89_selection_sha256', 'approved_part2_sourcefree89_timing_selection'),
    'part2-individual-exact-orthography-publication-v1': (1056, 'orthography_selection_sha256', 'approved_part2_orthography_selection'),
    'part2-individual-source-name-casting-publication-v1': (1084, 'name_case_selection_sha256', 'approved_part2_name_case_selection'),
}


def object_sha(value): return r.sha(r.canonical(value).encode())


def exact(actual, expected, message):
    require(object_sha(actual) == object_sha(expected), message)


def pin(path, bound, expected=None):
    path = Path(path)
    require(path.is_absolute() and path.resolve() == path and path.is_file() and not path.is_symlink(), 'Exact existing regular evidence path required.')
    value = digest(path)
    require(expected is None or value == expected, 'Reviewed evidence bytes differ: '+str(path))
    require(str(path) not in bound or bound[str(path)] == value, 'Contradictory evidence pin.')
    bound[str(path)] = value
    return {'path': str(path), 'sha256': value}


def private_ref(run, ref, bound):
    require(isinstance(ref, dict) and set(ref) == {'path', 'sha256'} and isinstance(ref.get('path'), str), 'Exact private evidence reference required.')
    path = Path(ref['path'])
    require(run in path.parents, 'Case/snapshot evidence must stay inside the actual child run.')
    pin(path, bound, ref['sha256'])
    return read(path)


def model_weights(folder, weights, bound):
    """Retain real installed same-directory weight aliases, never artifact links."""
    for name, expected in weights.items():
        require(isinstance(name, str) and Path(name).name == name, 'Local weight must be a direct existing filename.')
        path = folder/name
        physical = path.resolve()
        require(physical.parent == folder and physical.name in weights and weights[physical.name] == expected,
                'A recorded model-weight alias may only resolve to the same recorded local weight bytes.')
        pin(physical, bound, expected)
        require(path.is_file() and digest(path) == expected, 'Actual recorded logical model-weight bytes differ.')
        bound[str(path)] = expected


def producer(run, command, bound):
    path = run/('qualification-'+command+'.producer.private.json')
    intent_path = run/('qualification-'+command+'.intent.private.json')
    report_path = run/('qa.private.json' if command == 'qa' else 'word-cues/alignment.private.json')
    pin(path, bound, PRODUCER_PINS[command]['sha256'])
    value, intent, report = read(path), read(intent_path), read(report_path)
    require(value.get('version') == qualify.VERSION and value.get('command') == command
        and value.get('state') == 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT'
        and value.get('report_path') == str(report_path) and value.get('report_sha256') == digest(report_path)
        and value.get('report_status') == report.get('status')
        and value.get('human_listening_or_acting_or_voice_identity_approved') is False
        and not value.get('runtime_guard_failed') and value.get('selected_ids') == qualify.EXPECTED_IDS
        and value.get('input_sha256') == qualify.EXPECTED_INPUT_SHA
        and value.get('prepared_sha256') == digest(run/'prepared.json')
        and value.get('source_manifest_sha256') == digest(run/'lines.private.json')
        and value.get('helpers_sha256') == qualify.helper_hashes(), 'Completed actual immutable child producer required.')
    require(intent.get('state') == 'ONE_ROOT_ACTUAL_RUN_STARTED' and all(value.get(key) == item for key, item in intent.items() if key != 'state'),
        'Completed producer must retain its exact once-only call intent.')
    require(qualify.model_identity(Path(value['model']['local_directory'])) == value['model'], 'Actual installed local model bytes differ.')
    before = value.get('pre_existing_child_sha256'); outputs = value.get('created_outputs_sha256')
    policy = PRODUCER_PINS[command]
    require(isinstance(before, dict) and len(before) == policy['input_count']
        and object_sha(before) == policy['input_map_sha256'], 'Entire immutable actual once-run input map required, including every original provider/audio/source byte.')
    if command == 'qa':
        expected_outputs = {'qa.private.json', 'qa-asr-cache.private.json'} | {
            folder+'/'+ident+'.private.json' for folder in ['asr-raw', 'local-asr-intents'] for ident in qualify.EXPECTED_IDS}
    else:
        expected_outputs = {'word-cues/alignment.private.json'} | {
            folder+'/'+ident+'.private.json' for folder in ['alignment-raw', 'local-alignment-intents'] for ident in qualify.EXPECTED_IDS} | {
            'word-cues/'+ident+'.json' for ident in qualify.EXPECTED_IDS}
    require(isinstance(outputs, dict) and set(outputs) == expected_outputs and not set(before) & set(outputs),
        'Every genuine raw response, call intent, cache and full timing receipt must be pinned in the original producer output census.')
    for field in ['pre_existing_child_sha256', 'created_outputs_sha256']:
        mapping = value.get(field)
        require(isinstance(mapping, dict) and mapping, 'Complete actual producer input/output census required.')
        for name, expected in mapping.items(): pin(batch.contained(run, name), bound, expected)
    for item in [path, intent_path, report_path]: pin(item, bound)
    model = value['model']; folder = Path(model['local_directory'])
    pin(folder/'config.json', bound, model['config_sha256'])
    model_weights(folder, model['weights'], bound)
    return value, report


def independent_result_review(run, producers, bound):
    parent = Path(read(run/'prepared.json')['parent']); path = parent/RESULT_REVIEW
    pin(path, bound, RESULT_REVIEW_SHA); review = read(path)
    require(review.get('status') == 'PASS_GENUINE_COMPLETED_QA8_ALIGN8_EVIDENCE_RECONSTRUCTION_UNAPPROVED'
        and review.get('child') == str(run) and review.get('frozen_qualifier_sha256') == QUALIFIER_SHA
        and review.get('input_sha256') == qualify.EXPECTED_INPUT_SHA and review.get('selected_ids') == qualify.EXPECTED_IDS
        and review.get('actual_QA_producer_sha256') == PRODUCER_PINS['qa']['sha256']
        and review.get('actual_Align_producer_sha256') == PRODUCER_PINS['align']['sha256']
        and review.get('whole_Sourcefree_raw_census') == review.get('whole_forced_timing_raw_census') == len(qualify.EXPECTED_IDS)
        and review.get('original_7044_parent_and188Prolog1490Story_preserved') is True
        and review.get('qa_signal_and_timing_waveform_checks_recomputed_CPU_only') is True
        and review.get('actual_sourcefree_and_forced_report_whole_failures_reconstructed') is True
        and review.get('network_model_calls') == review.get('ASR_or_alignment_model_calls') == 0
        and all(review.get(field) is None for field in ['word_approval', 'timing_approval', 'human_listening_or_acting_or_voice_identity_approval'])
        and review.get('audio_adoption') is False, 'Whole independent actual immutable eight-result reconstruction required, without approval projection.')
    expected = {}
    for command, value in producers.items():
        for field in ['pre_existing_child_sha256', 'created_outputs_sha256']:
            for name, sha in value[field].items():
                key = str(batch.contained(run, name))
                require(key not in expected or expected[key] == sha, 'Original input/output maps contradict each other.')
                expected[key] = sha
        for suffix in ['producer', 'intent']:
            item = run/('qualification-'+command+'.'+suffix+'.private.json'); expected[str(item)] = digest(item)
    exact(review.get('all_current_completed_evidence_files_sha256'), expected,
          'Whole independent review must retain the complete exact original input/output/producer/intent union.')
    for item, sha in expected.items(): pin(Path(item), bound, sha)


def actual_child(run, bound):
    require(digest(Path(qualify.__file__)) == QUALIFIER_SHA
        and digest(batch.ROOT/'scripts/part2_voice_retake_qualify_test.py') == QUALIFIER_TEST_SHA,
        'Frozen independently reviewed retake8 qualifier/test bytes required.')
    info, rows = qualify.collected(run, live=True)
    qproducer, word = producer(run, 'qa', bound)
    tproducer, timing = producer(run, 'align', bound)
    independent_result_review(run, {'qa': qproducer, 'align': tproducer}, bound)
    exact(qproducer['model'], tproducer['model'], 'Word and timing must use the same actual installed turbo model.')
    actual_words = qualify.verify_word_report(run, word, qproducer['model'])
    actual_times = qualify.verify_timing_report(run, timing, tproducer['model'])
    exact(qproducer.get('actual_model_call_ids'), actual_words, 'Actual complete word-call census differs.')
    exact(qproducer.get('actual_source_free_ids'), actual_words, 'Whole actual source-free call evidence differs.')
    exact(tproducer.get('actual_model_call_ids'), actual_times, 'Actual complete timing-call census differs.')
    exact(tproducer.get('actual_timing_ids'), actual_times, 'Whole actual teacher-forced call evidence differs.')
    manifest, profiles = read(run/'lines.private.json'), read(run/'profiles.private.json')
    takes, checked = base.report_coverage(word, timing, manifest, run)
    require(set(rows) == set(qualify.EXPECTED_IDS) and checked == set(rows), 'All eight actual new-audio signals and times must remain accounted for.')
    for name, value in qualify.baseline(run).items(): pin(batch.contained(run, name), bound, value)
    parent = Path(info['parent']); snapshot = read(run/'parent-snapshot.private.json')
    for name, value in snapshot['parent_protected_file_sha256'].items(): pin(batch.contained(parent, name), bound, value)
    for helper in [Path(__file__), Path(qualify.__file__), batch.ROOT/'scripts/part2_voice_retake_qualify_test.py',
                   Path(base.__file__), Path(r.__file__), Path(qa.__file__), Path(cues.__file__), Path(cues.acoustic.__file__)]: pin(helper, bound)
    return info, rows, profiles, takes, word, timing


def candidate(row, run, profiles, take, word, timing, decode_fn=None):
    """Literal full words, actual signal and original new-audio DTW, no waivers."""
    ident = row['id']; path = run/'clips'/(ident+'.mp3'); audio_hash = digest(path)
    require(not take.get('reasons') and not take.get('adjudication') and not take.get('asr_reused')
        and take.get('text_sha256') == qa.text_hash(row['text']) and take.get('word_error_rate') == 0
        and isinstance(take.get('transcript'), str) and qa.words(take['transcript']) == qa.words(row['text']),
        'Every complete word/signal failure stays held; Root cannot waive it.')
    signal = (decode_fn or qa.decode)(path)
    exact(signal, take.get('signal'), 'Actual current decoded signal differs.')
    require(not qa.signal_failures(signal, len(qa.words(row['text']))) and qualify.finite(signal.get('seconds')),
        'Current new audio fails signal qualification.')
    require(word['clip_sha256'].get(ident) == timing['clip_sha256'].get(ident) == audio_hash, 'Actual newaudio report hashes differ.')
    temporal = read(run/'word-cues'/(ident+'.json')); entry = timing['alignment_by_id'].get(ident)
    require(temporal.get('id') == ident and temporal.get('audio_sha256') == audio_hash
        and temporal.get('text_sha256') == qa.text_hash(row['text'])
        and temporal.get('source_manifest_sha256') == digest(run/'lines.private.json')
        and temporal.get('engine_version') == cues.ENGINE and temporal.get('text') == row['text']
        and not temporal.get('all_qualification_flags') and not cues.qualification_flags(temporal)
        and not any(key in temporal for key in ['CTC_adoption', 'Partial_CTC_adoption', 'Vocal_event_adoption'])
        and abs(temporal.get('decoded_seconds', -100)-signal['seconds']) < .001,
        'New audio requires its own complete clear original timing receipt.')
    actual = cues.cue_words(row['text'], temporal['word_cues'], signal['seconds'])
    words = cues.acoustic.normalized_text(row['text']).split()
    require(temporal.get('authored_word_count') == len(words) and len(temporal.get('words', [])) == len(words)
        and [item.get('word') for item in temporal['words']] == words, 'New audio whole authored timing census differs.')
    for detail, cue in zip(temporal['words'], temporal['word_cues']):
        require(cue['start'] < cue['end'] or (detail.get('spoken') is False and not qa.words(detail['word'])), 'Collapsed lexical timing remains held.')
    require(entry == {'words': actual, 'word_count': len(words), 'text_sha256': qa.text_hash(row['text']),
        'cues_sha256': cues.acoustic.cue_sha(temporal['word_cues'])}
        and temporal.get('cues_sha256') == entry['cues_sha256']
        and timing['authored_text_sha256'].get(ident) == qa.text_hash(row['text']), 'Actual complete newaudio cues/report differ.')
    receipt = read(run/'raw'/(ident+'.receipt.json'))
    require(abs(receipt['seconds']-signal['seconds']) < .1 and receipt['mp3_sha256'] == audio_hash, 'Provider/actual decoded duration differs.')
    require(digest(path) == audio_hash, 'Actual newaudio changed during qualification.')
    return {'id': ident, 'kind': row['kind'], 'speaker': row['speaker'], 'text': row['text'], 'display_text': row['display_text'],
        'voice': profiles['speakers'][row['speaker']]['google_voice'], 'audio': 'audio/teil-2/'+ident+'.mp3',
        'sha256': audio_hash, 'seconds': signal['seconds'], 'word_cues': copy.deepcopy(temporal['word_cues']),
        'runtime_keys': copy.deepcopy(row['runtime_keys'])}, path


def actual_baseline(args, parent_manifest, profiles, bound):
    target_root = Path(args.target_root); target = target_root/'game/public/audio/teil-2'
    require(target_root.is_absolute() and target_root.resolve() == target_root and target.is_dir()
        and target.parent.resolve() == target.parent, 'Exact existing release worktree/bank required.')
    report, selection = read(args.baseline_report), read(args.baseline_selection)
    policy = BASELINES.get(report.get('version'))
    require(policy is not None, 'Only explicit reviewed1028/1056/1084 baseline families supported.')
    count, selection_field, status = policy
    require(report.get('state') == 'PUBLISHED' and report.get('published_sources') == count
        and report.get('human_listening_or_acting_approval') is False
        and selection.get('version') == report['version'] and selection.get('status') == status
        and selection.get('reviewed_by') == 'root' and selection.get('target_root') == str(target_root)
        and selection.get('human_listening_or_acting_approval') is False
        and report.get(selection_field) == digest(args.baseline_selection)
        and report.get('adapter_sha256') == selection.get('adapter_sha256'), 'Exact completed current Root baseline publication required.')
    public = read(target/'manifest.json'); manifest_hash = digest(target/'manifest.json')
    require(report.get('public_manifest_sha256') == manifest_hash and len(public.get('clips', [])) == count
        and public.get('model') == parent_manifest['model'] and public.get('aliases') == parent_manifest['aliases']
        and public.get('scene_players') == parent_manifest['scene_players'], 'Current full baseline manifest/aliases/player maps differ.')
    # Replay every original builder and individually Root-adopted case. A
    # published count/report label alone never qualifies an existing bank.
    replay_args = copy.copy(args); replay_args.run_dir = str(args.parent_run)
    replay_args.selection = args.initial_selection
    values = [read(path) for path in [args.initial_selection, args.supplemental_selection,
              args.external_selection, args.sourcefree_timing_selection]]
    paths = [args.initial_selection, args.supplemental_selection, args.external_selection, args.sourcefree_timing_selection]
    if report['version'] == timing_baseline.VERSION:
        require(args.baseline_selection == args.sourcefree_timing_selection, '1028 must name its exact current Root89 selection.')
        replay = timing_baseline.build(replay_args, *values)
    elif report['version'] == orthography_baseline.VERSION:
        require(args.orthography_selection is not None and args.baseline_selection == args.orthography_selection,
                '1056 must name its exact current Root orthography selection.')
        paths.append(args.orthography_selection); values.append(read(args.orthography_selection))
        replay = orthography_baseline.build(replay_args, *values)
    else:
        require(args.orthography_selection is not None and args.name_case_selection is not None
            and args.baseline_selection == args.name_case_selection, '1084 requires its full Root orthography/name-case lineage.')
        paths.extend([args.orthography_selection, args.name_case_selection])
        values.extend([read(args.orthography_selection), read(args.name_case_selection)])
        replay = name_baseline.build(replay_args, *values)
    rebuilt, replay_paths, replay_preserved, replay_bound, replay_selection = replay
    exact(rebuilt, public, 'Whole current baseline differs from its genuine complete original builder replay.')
    exact(replay_selection, selection, 'Actual baseline replay selected another Root scope.')
    # Original builders already validate their actual installed model identities
    # and keep the logical weight alias paths in their historical pin maps.
    # Preserve that exact proof rather than rewriting its alias provenance.
    base.stable(replay_bound, replay_preserved)
    for path, expected in replay_bound.items():
        require(path not in bound or bound[path] == expected, 'Conflicting full original baseline evidence pin.')
        bound[path] = expected
    for path in paths: pin(path, bound)
    require(set(replay_paths) == {clip['id'] for clip in public['clips']}
        and all(digest(replay_paths[clip['id']]) == clip['sha256'] for clip in public['clips']),
        'Whole original candidate audio lineage differs from current baseline.')
    exact(selection.get('manifest_sha256'), digest(Path(args.parent_run)/'lines.private.json'), 'Baseline Source provenance changed.')
    exact(selection.get('profiles_sha256'), digest(Path(args.parent_run)/'profiles.private.json'), 'Baseline cast provenance changed.')
    require(all(report.get(key) == value for key, value in public['coverage'].items()), 'Actual baseline coverage/old failures differ from its completed report.')
    require(set(selection.get('selected_ids', [])) == {clip['id'] for clip in public['clips']}, 'Whole prior Root-selected census differs.')
    file_map = base.file_map(target)
    rows = {row['id']: row for row in parent_manifest['lines']}; ids = set()
    for clip in public['clips']:
        ident = clip['id']; require(ident in rows and ident not in ids, 'Unknown/duplicate existing Source.'); ids.add(ident)
        row = rows[ident]
        require(all(clip.get(key) == row.get(key) for key in ['kind', 'speaker', 'text', 'display_text', 'runtime_keys'])
            and clip.get('voice') == profiles['speakers'][row['speaker']]['google_voice']
            and clip.get('audio') == 'audio/teil-2/'+ident+'.mp3'
            and file_map.get(ident+'.mp3') == clip.get('sha256'), 'Existing approved Source/cast/routes/audio changed.')
    require(set(file_map) == {'manifest.json', *(ident+'.mp3' for ident in ids)}, 'Unknown current bank files remain protected.')
    missing = public['coverage']['missing_sources']
    require(len(ids)+len(missing) == len(rows) and {item['id'] for item in missing} == set(rows)-ids
        and public['coverage'].get('expected_sources') == len(rows)
        and public['coverage'].get('published_sources') == len(ids), 'Complete truthful existing Source coverage required.')
    for name, expected in parent_manifest['source_hashes'].items():
        pin(batch.contained(target_root, name), bound, expected)
        pin(batch.contained(batch.ROOT, name), bound, expected)
    for name in ['scripts/part2_voice_inventory.mjs', 'scripts/part2_voice_batch.py', 'scripts/part2_voice_publish.py',
                 'scripts/part2_voice_retake_publish.py']:
        pin(target_root/name, bound, digest(batch.ROOT/name)); pin(batch.ROOT/name, bound)
    metadata = base.scanner_metadata(parent_manifest, target_root)
    bound.update(metadata); base.release_inventory(parent_manifest, target_root, metadata)
    preserved = {str(target_root/'game/public/audio'/name): base.file_map(target_root/'game/public/audio'/name) for name in ['prolog', 'story']}
    exact(replay_preserved, preserved, 'Whole original baseline replay preserves different current banks.')
    current = batch.preserved_banks(target_root)
    for bank, frozen in read(Path(args.parent_run)/'preserved-banks.private.json').items():
        for name, expected in frozen['files_sha256'].items():
            if bank == 'story' and name == 'manifest.json': continue
            require(current[bank]['files_sha256'].get(name) == expected, 'Original188/1490 protected bank bytes changed.')
    pin(args.baseline_report, bound); pin(args.baseline_selection, bound)
    return public, file_map, preserved, current


def context(args):
    run = Path(args.run_dir).expanduser().resolve(); bound = {}
    require(r.PRIVATE.resolve() in run.parents and run.parent.name == 'retake-driver', 'Actual isolated retake child required.')
    info, rows, profiles, takes, word, timing = actual_child(run, bound)
    parent = Path(info['parent']); args.parent_run = parent
    parent_manifest = read(parent/'lines.private.json')
    public, files, preserved, current_preserved = actual_baseline(args, parent_manifest, profiles, bound)
    binding = {'version': VERSION, 'child_run': str(run), 'parent_run': str(parent), 'target_root': str(args.target_root),
        'adapter_sha256': digest(__file__), 'adapter_tests_sha256': digest(batch.ROOT/'scripts/part2_voice_retake_publish_test.py'),
        'qualifier_sha256': QUALIFIER_SHA, 'prepared_sha256': digest(run/'prepared.json'), 'request_sha256': info['input_sha256'],
        'child_manifest_sha256': digest(run/'lines.private.json'), 'profiles_sha256': digest(run/'profiles.private.json'),
        'provider_response_sha256': digest(run/'responses.private.jsonl'), 'qa_sha256': digest(run/'qa.private.json'),
        'alignment_sha256': digest(run/'word-cues/alignment.private.json'),
        'qa_producer_sha256': digest(run/'qualification-qa.producer.private.json'),
        'alignment_producer_sha256': digest(run/'qualification-align.producer.private.json'),
        'baseline_manifest_sha256': files['manifest.json'], 'baseline_files_sha256': files,
        'baseline_report': pin(args.baseline_report, bound), 'baseline_selection': pin(args.baseline_selection, bound),
        'preserved_banks_sha256': object_sha(current_preserved)}
    candidates, held = {}, {}
    for ident, row in rows.items():
        try: candidates[ident] = candidate(row, run, profiles, takes[ident], word, timing)
        except (r.SafeError, RuntimeError, ValueError, TypeError, KeyError, IndexError):
            held[ident] = {'original_word_reasons': copy.deepcopy(takes[ident].get('reasons', [])),
                'original_timing_failures': [copy.deepcopy(item) for item in timing['failures'] if item['id'] == ident],
                'status': 'not_strictly_word_signal_time_clear_no_approval_route'}
    return run, parent_manifest, rows, candidates, held, public, preserved, bound, binding


def case_template(ident, row, candidate_clip, prior, binding):
    return {'version': VERSION, 'status': 'UNAPPROVED_part2_actual_retake_case', 'reviewed_by': None,
        'actual_whole_word_signal_and_newaudio_timing_reviewed': False, 'human_listening_or_acting_approval': False,
        'binding_sha256': object_sha(binding), 'id': ident, 'whole_child_source_row_sha256': object_sha(row),
        'prior_public_clip': copy.deepcopy(prior), 'actual_new_clip': copy.deepcopy(candidate_clip), 'review_note': ''}


def propose(args):
    values = context(args)
    run, parent_manifest, rows, candidates, held, public, preserved, bound, binding = values
    out = Path(args.output_dir)
    require(out.is_absolute() and run in out.parents and out.resolve() == out and not out.exists(), 'Fresh exact private proposal directory required.')
    out.mkdir(mode=0o700, parents=True)
    r.write_once(out/'baseline-manifest.private.json', (Path(args.target_root)/'game/public/audio/teil-2/manifest.json').read_bytes())
    snapshot = pin(out/'baseline-manifest.private.json', bound, binding['baseline_manifest_sha256'])
    old = {clip['id']: clip for clip in public['clips']}; cases = []
    for ident, (clip, _) in candidates.items():
        path = out/(ident+'.UNAPPROVED.private.json')
        r.save_once(path, case_template(ident, rows[ident], clip, old.get(ident), binding)); cases.append(pin(path, bound))
    selection = {'version': VERSION, 'status': 'UNAPPROVED_part2_actual_retake_selection', 'reviewed_by': None,
        'actual_whole_word_signal_and_newaudio_timing_reviewed': False, 'human_listening_or_acting_approval': False,
        'binding': binding, 'baseline_snapshot': snapshot, 'selected_retake_ids': [], 'case_approvals': []}
    r.save_once(out/'selection.UNAPPROVED.private.json', selection)
    r.save_once(out/'proposal.private.json', {'version': VERSION, 'status': 'actual_evidence_candidates_UNAPPROVED',
        'binding': binding, 'strictly_qualified_candidate_ids': list(candidates), 'held': held, 'case_templates': cases,
        'word_signal_time_or_human_approved': False})
    base.stable(bound, preserved)
    require(base.file_map(Path(args.target_root)/'game/public/audio/teil-2') == binding['baseline_files_sha256'], 'Baseline changed while preparing reviewable proposal.')
    return candidates, held


def build(args, selection):
    run, parent_manifest, rows, candidates, held, public, preserved, bound, binding = context(args)
    require(set(selection) == {'version', 'status', 'reviewed_by', 'actual_whole_word_signal_and_newaudio_timing_reviewed',
        'human_listening_or_acting_approval', 'binding', 'baseline_snapshot', 'selected_retake_ids', 'case_approvals'}
        and selection.get('version') == VERSION and selection.get('status') == 'approved_part2_actual_retake_selection'
        and selection.get('reviewed_by') == 'root' and selection.get('actual_whole_word_signal_and_newaudio_timing_reviewed') is True
        and selection.get('human_listening_or_acting_approval') is False, 'Separate explicit Root actual retake selection required.')
    exact(selection['binding'], binding, 'Current child evidence or complete current baseline changed; prepare a fresh concrete review.')
    snapshot = private_ref(run, selection['baseline_snapshot'], bound)
    exact(snapshot, public, 'Archived actual whole prior manifest differs.')
    require(selection['baseline_snapshot']['sha256'] == binding['baseline_manifest_sha256'], 'Prior manifest exact bytes must be preserved privately.')
    chosen = base.ids(selection['selected_retake_ids'], 'Root retake IDs')
    require(chosen and chosen <= set(candidates), 'Only individually strict-clear actual retakes have an approval route.')
    refs = selection['case_approvals']; require(isinstance(refs, list) and len(refs) == len(chosen), 'Each selected retake needs one exact separate Root case.')
    old = {clip['id']: clip for clip in public['clips']}; cases = {}
    for ref in refs:
        case = private_ref(run, ref, bound); ident = case.get('id')
        require(ident in chosen and ident not in cases, 'Unknown/duplicate/nonselected actual retake case.')
        expected = case_template(ident, rows[ident], candidates[ident][0], old.get(ident), binding)
        expected.update(status='approved_part2_actual_retake_case', reviewed_by='root', actual_whole_word_signal_and_newaudio_timing_reviewed=True)
        require(isinstance(case.get('review_note'), str) and case['review_note'].strip(), 'Individual whole-evidence Root note required.')
        expected['review_note'] = case['review_note']; exact(case, expected, 'Root may not alter actual Source/cast/raw words/newaudio/cues or prior clip.')
        cases[ident] = case
    require(set(cases) == chosen, 'Every actual selected retake must have its own Root case.')
    paths = {ident: Path(args.target_root)/'game/public/audio/teil-2'/(ident+'.mp3') for ident in old}
    clips = copy.deepcopy(old)
    for ident in chosen: clips[ident], paths[ident] = candidates[ident]
    for ident in set(old)-chosen: pin(paths[ident], bound, old[ident]['sha256'])
    for ident in chosen: pin(paths[ident], bound, clips[ident]['sha256'])
    public = copy.deepcopy(public); public['clips'] = [clips[row['id']] for row in parent_manifest['lines'] if row['id'] in clips]
    added, replaced = chosen-set(old), chosen & set(old)
    coverage = public['coverage']; coverage.update(version=VERSION, missing_sources=[item for item in coverage['missing_sources'] if item['id'] not in added],
        published_sources=len(clips), retake_complete_baseline_sources=len(old), retake_added_sources=len(added), retake_replaced_sources=len(replaced),
        retake_selected_sources=len(chosen), retake_unselected_actual_sources=len(rows)-len(chosen),
        retake_strict_clear_unapproved_sources=len(set(candidates)-chosen), retake_held_sources=len(held),
        all_original_word_signal_time_failures_retained=True, retake_cues_from_actual_newaudio_only=True,
        human_listening_or_acting_approval=False, retake_selection_sha256=digest(args.selection),
        retake_baseline_manifest_sha256=binding['baseline_manifest_sha256'])
    coverage['status'] = 'complete' if not coverage['missing_sources'] else 'partial'
    require(len(clips)+len(coverage['missing_sources']) == len(parent_manifest['lines']), 'Full truthful composed Source coverage differs.')
    pin(args.selection, bound)
    transition = {'target_root': str(args.target_root), 'existing_manifest_sha256': binding['baseline_manifest_sha256']}
    return public, paths, preserved, bound, transition


def parser():
    value = argparse.ArgumentParser(description=__doc__)
    value.add_argument('command', choices=['propose', 'dryrun', 'apply'])
    for name in ['run-dir', 'target-root', 'baseline-report', 'baseline-selection', 'initial-selection',
                 'supplemental-selection', 'external-selection', 'sourcefree-timing-selection',
                 'qa-report', 'alignment-report', 'qa-producer', 'alignment-producer']:
        value.add_argument('--'+name, required=True, type=Path)
    for name in ['orthography-selection', 'name-case-selection']: value.add_argument('--'+name, type=Path)
    for name in ['output-dir', 'selection', 'coverage-report']: value.add_argument('--'+name, type=Path)
    value.add_argument('--adapter-sha256', required=True)
    return value


def main():
    os.umask(0o077); args = parser().parse_args()
    try:
        require(digest(__file__) == args.adapter_sha256, 'Root must provide the independently frozen publication adapter hash.')
        args.run_dir = args.run_dir.expanduser().resolve()
        for field in ['target_root', 'baseline_report', 'baseline_selection', 'initial_selection', 'supplemental_selection',
                      'external_selection', 'sourcefree_timing_selection', 'qa_report', 'alignment_report', 'qa_producer', 'alignment_producer',
                      'orthography_selection', 'name_case_selection']:
            if getattr(args, field) is None: continue
            path = getattr(args, field); require(path.is_absolute() and path.resolve() == path, 'Exact absolute input path required.')
        with ExitStack() as locks:
            lock = locks.enter_context((r.PRIVATE/'publish.lock').open('a+')); fcntl.flock(lock, fcntl.LOCK_EX)
            locks.enter_context(base.target_publish_lock(args.target_root))
            if args.command == 'propose':
                require(args.output_dir is not None and args.selection is None and args.coverage_report is None, 'Propose needs only a fresh private output directory.')
                candidates, held = propose(args)
                print(json.dumps({'state': 'UNAPPROVED', 'strict_clear_candidates': len(candidates), 'held': len(held)})); return 0
            require(args.selection is not None and args.coverage_report is not None and args.output_dir is None,
                'Dryrun/apply require a separate exact Root selection and fresh private coverage file.')
            require(args.run_dir in args.coverage_report.parents and args.coverage_report.resolve() == args.coverage_report
                and not args.coverage_report.exists(), 'Fresh exact private retake coverage path required.')
            selection = read(args.selection); public, paths, preserved, bound, transition = build(args, selection)
            target = args.target_root/'game/public/audio/teil-2'; base.existing(target, transition, public); base.stable(bound, preserved)
            report = {'state': 'PUBLISHED' if args.command == 'apply' else 'VALIDATED', **public['coverage'],
                'public_manifest_sha256': r.sha((json.dumps(public, ensure_ascii=False, indent=2)+'\n').encode()),
                'adapter_sha256': digest(__file__), 'preserved_bank_sha256': preserved, 'checked_at': int(time.time())}
            if args.command == 'apply':
                identity = None
                def finalize():
                    nonlocal identity
                    identity = base.exclusive_report(args.coverage_report, report); bound[str(args.coverage_report)] = digest(args.coverage_report)
                def undo():
                    if identity is not None and args.coverage_report.exists() and (args.coverage_report.stat().st_dev, args.coverage_report.stat().st_ino) == identity:
                        args.coverage_report.unlink()
                base.apply(target, transition, public, paths, preserved, bound, finalize, undo)
            else: base.exclusive_report(args.coverage_report, report)
            print(json.dumps({'state': report['state'], 'published': len(public['clips']), 'selected_retakes': len(selection['selected_retake_ids'])}))
        return 0
    except (r.SafeError, OSError, RuntimeError, ValueError, TypeError, KeyError, AttributeError, IndexError):
        print('Actual retake publication refused; original evidence and current approved banks remain protected.', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
