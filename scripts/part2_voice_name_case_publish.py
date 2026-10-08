#!/usr/bin/env python3
"""Add exactly28 individually Root-decided Source names to the full prior build.

Creative spelling/pronunciation decisions apply to one exact existing audio.
No canonical IPA, human phonetic verdict, transcript rewrite or cue replacement.
All historical failures and written casting proposals remain unchanged.
"""
from __future__ import annotations
import argparse
import copy
from contextlib import ExitStack
import fcntl
import json
import os
from pathlib import Path
import re
import sys
import time
import part2_voice_orthography_publish as baseline

external, prior, base, batch = baseline.external, baseline.prior, baseline.base, baseline.batch
require, digest, object_sha = baseline.require, baseline.digest, baseline.object_sha
VERSION = 'part2-individual-source-name-casting-publication-v1'
MODE = 'creative_root_specific_Source_name_casting_on_current_audio_initial_timeclear'
BASELINE_SHA = '928f26707069410a24e79a7f735d71821da3eeff710a24328af31f6996f9790a'
BASELINE_TEST_SHA = 'd1951360af840fcf8d2b90e2bb60d2ef1c42cc270f5c69948070e366b452888d'
FOLDER = 'offline-word-review/google317/name-case-review'
NAME_FILES = {
    'build.private.py': '93aa783570462b240c645128ebb7028da4f89bab6b7015da9a61842e2867b9f9',
    'test.private.py': 'ad84a1f530ff66841b4a645295df52d04daf75b929a2966c213843c1ea4da374',
    'individual-notes.private.json': 'fe29027c0141fe7b379298f7d36a2a5fe0668794ae9d181268db9a68198015b0',
    'occurrence-bindings.private.py': 'afdc0e6cbc1b4b55373c45c53aa232331c647b644849f5d634ab62a71bf6a468',
    'all95-specific-name-review.UNAPPROVED.private.json': '01ad407b0734f2bbc39de712361eac5a46c8bd5e5321caa62785e57ea20ae67c',
    'specific-casting-decision-candidates.UNAPPROVED.private.json': 'f841e6778c0f7ccac757e28c417a9c64596e8586de6999549b25b896c2c053d1',
    'all95-actual-IPA-occurrence-text-bindings.UNAPPROVED.private.json': 'f29f4880e876c8ed7b2d34ac7a9bcd23efe8c68956452771b489de60a4bdef0c',
    'handoff.private.json': '3d873377cd1dbd8b03070ab1966fa7703b63b7da568cd142d13b452e5f6e86a8'}
CANDIDATE_IDS = (
    'part2-0b4295f0f49cf8369cf60ae8', 'part2-130757a48d5b33c4f4932cd0', 'part2-197a80d8857a02748041c8b2',
    'part2-1d974564dc7f54ac8cbd47b0', 'part2-2dab08b7579acf96101f8769', 'part2-2ea4c9e3d5f601004f30e836',
    'part2-3b5fd1953596259834c14112', 'part2-532cb5588fba579344866fe1', 'part2-559d65c8bf452aba091edcb7',
    'part2-55e991cfa21ab1c957798d26', 'part2-564319c370361488eef31fdf', 'part2-5aea1bc15a62504824709be4',
    'part2-642e0878fd218ab05dec5837', 'part2-932221712a3c654f45cd32b4', 'part2-93deaf4a73c9a3bc9cde83c5',
    'part2-9675e2db3c865350d45ed7f8', 'part2-a76810c4994f6b6d499b115d', 'part2-b21a3e63e1a322ff6a368d1d',
    'part2-ce2d28e31a616e046463cfac', 'part2-d4ddd3e3c262a52adf5fbc4d', 'part2-dd88bba441c2dd0e8d84bfd3',
    'part2-ec9b7c1e78af1b52e106fb88', 'part2-f27903efbeb4cec47591b5ed', 'part2-f292735cdfb53c53b0763d5a',
    'part2-fae545f9ddbe398a99a0aaca', 'part2-fbe9471a09f8e955d5b44050', 'part2-fe0f566a9f8fb9a09c49e484',
    'part2-fefab858dc949a8a92cc1206')


def exact_value(actual, expected, message):
    """JSON identity preserves typed indices: True is never the integer1."""
    require(object_sha(actual) == object_sha(expected), message)


def bundle_binding(run):
    return {'files_sha256': {str(run/FOLDER/name): value for name, value in NAME_FILES.items()}}


def name_bundle(run, rows, profiles, bound, binding):
    require(binding == bundle_binding(run), 'Exactly the immutable individually read95/28 Source-name bundle is required.')
    for name, value in NAME_FILES.items(): external.pin_file(run/FOLDER/name, bound, value)
    report = batch.read(run/FOLDER/'all95-specific-name-review.UNAPPROVED.private.json')
    subset = batch.read(run/FOLDER/'specific-casting-decision-candidates.UNAPPROVED.private.json')
    occurrences = batch.read(run/FOLDER/'all95-actual-IPA-occurrence-text-bindings.UNAPPROVED.private.json')
    require(report.get('status') == 'all95_individual_source_modelIPA_and_three_ASR_review_UNAPPROVED'
        and report.get('count') == 95 and report.get('initial_timing_flag_clear_count') == 69
        and report.get('creative_Root_decision_candidate_count') == 28
        and report.get('creative_Root_decision_candidate_ids') == list(CANDIDATE_IDS)
        and report.get('actual_canonical_audio_or_IPA_provenance_count') == 0
        and report.get('network_or_model_calls') == 0 and report.get('original_files_changed') == 0
        and report.get('canonical_target_IPA_invented') is False and report.get('approval') is None
        and report.get('human_listening_or_acting_approval') is False, 'Whole original95 claims or exact28 scope differ.')
    pins = report.get('input_sha256')
    require(isinstance(pins, dict) and len(pins) == 921 and object_sha(pins) == report.get('input_map_sha256'), 'Complete original95 Source/provider/audio input census differs.')
    for path, value in pins.items(): external.pin_file(path, bound, value)
    require(subset.get('status') == 'exact_per_case_Root_creative_decision_candidates_not_approved'
        and subset.get('count') == 28 and subset.get('input_report_sha256') == NAME_FILES['all95-specific-name-review.UNAPPROVED.private.json']
        and subset.get('approval') is None and subset.get('canonical_pronunciation') is None
        and subset.get('human_listening_or_acting_approval') is False, 'Historical28 candidate proposal must remain unapproved.')
    require(occurrences.get('count') == 95 and occurrences.get('specific_Source_name_occurrences') == 108
        and occurrences.get('actual_existing_model_IPA_quoted_occurrences') == 104
        and occurrences.get('creative_candidate_specific_name_occurrences') == 32
        and occurrences.get('individual95_report_sha256') == subset['input_report_sha256']
        and occurrences.get('generated_canonical_IPA_or_audio_timestamps') is False
        and occurrences.get('network_or_model_calls') == 0 and occurrences.get('approval') is None,
        'Exact original text-character occurrence evidence differs; it is never audio time.')
    byid = {row['id']: row for row in report['rows']}; spans = {row['id']: row for row in occurrences['rows']}
    require(len(byid) == len(report['rows']) == len(spans) == len(occurrences['rows']) == 95
        and [row.get('id') for row in subset['rows']] == list(CANDIDATE_IDS), 'Whole95/28 unique Source census differs.')
    result = {}
    for candidate in subset['rows']:
        ident = candidate['id']; row = rows[ident]; span = spans[ident]
        exact_value(candidate, byid[ident], 'The28 subset changed its original individual95 evidence.')
        require(candidate.get('creative_Root_specific_casting_decision_candidate') is True
            and candidate.get('candidate_exclusion_reasons') == [] and candidate.get('initial_timing_flag_clear') is True
            and candidate.get('actual_Google_uncertainties') == [] and candidate.get('whole_Google_remaining_Source_words_exact') is True
            and isinstance(candidate.get('whole_actual_Google_model_IPA'), str) and candidate['whole_actual_Google_model_IPA']
            and candidate.get('individual_read_note', {}).get('assessment') == 'proposal-compatible'
            and candidate.get('whole_primary_ASR', {}).get('all_remaining_Source_word_indices_equal') is True
            and candidate.get('whole_FullLarge_ASR', {}).get('all_remaining_Source_word_indices_equal') is True
            and candidate.get('canonical_target_IPA') is None and candidate.get('human_listening_or_phonetic_verdict') is None
            and not candidate.get('audio_adoption') and all(candidate.get(k) is None for k in ['word_approval', 'timing_approval', 'acting_approval']),
            'Null IPA, uncertain/outside-body/name cases or old approval claims remain held.')
        exact_value(candidate['source_row'], row, 'Complete actual current Source row differs from its named case.')
        require(candidate['source_row_sha256'] == object_sha(row) and candidate['whole_Source'] == row['text']
            and candidate['original_cast_profile'] == profiles['speakers'][row['speaker']]
            and candidate['original_cast_profile_sha256'] == object_sha(profiles['speakers'][row['speaker']])
            and candidate['profiles_file_sha256'] == digest(run/'profiles.private.json'), 'Current whole Source/cast identity differs.')
        require(span['whole_Source'] == row['text'] and span['whole_Google_transcript'] == candidate['whole_Google_transcript']
            and span['whole_actual_model_IPA'] == candidate['whole_actual_Google_model_IPA']
            and span['Source_row_sha256'] == object_sha(row) and span['creative_Root_candidate'] is True
            and span['initial_timing_flagclear'] is True and span['approval'] is None
            and span['human_listening_or_phonetic_verdict'] is None, 'Whole original actual IPA-span case changed.')
        for context in candidate['Source_contexts']:
            source = context['source_reference']; path = batch.contained(batch.ROOT, source['file'])
            external.pin_file(path, bound, context['file_sha256'])
            expression = path.read_text().encode('utf-16-le')[source['start']*2:source['end']*2].decode('utf-16-le')
            require(expression == context['actual_source_expression'] == source['expression']
                and batch.sha(expression.encode()) == source['expression_sha256'], 'Actual named Source UTF16 expression changed.')
        result[ident] = {'candidate': candidate, 'occurrence_case': span}
    return result


def already_verified_producers(run, selection, external_selection, orthography_selection, bound):
    """Reuse the full frozen baseline's actual317/449 gates, never a status shim."""
    google = external_selection.get('google_bundles', {}).get('remaining317')
    secondary = orthography_selection.get('secondary_bundle')
    exact_value(selection.get('google317_bundle'), google, 'Names must retain the whole already-built actual317 producer.')
    exact_value(selection.get('secondary_bundle'), secondary, 'Names must retain the whole already-built actual449 producer.')
    require(isinstance(google, dict) and isinstance(google.get('files_sha256'), dict)
        and isinstance(secondary, dict) and isinstance(secondary.get('files_sha256'), dict), 'Full prior producer maps are mandatory.')
    for binding in [google, secondary]:
        for path, value in binding['files_sha256'].items():
            require(bound.get(path) == value, 'Prior full build did not verify this actual producer file.')
            external.pin_file(path, bound, value)
    for key in ['execution_review', 'independent_review']:
        ref = google[key]; require(bound.get(ref['path']) == ref['sha256'], 'Prior full317 execution review is missing.')
        external.pin_file(ref['path'], bound, ref['sha256'])
    folder = run/'sourcefree-google-qc-remaining'
    require(bound.get(str(folder/'plan.private.json')) == external.GOOGLE['remaining317']['plan_sha256']
        and bound.get(str(folder/'runner.private.py')) == external.GOOGLE['remaining317']['runner_sha256'],
        'Frozen complete317 runner/plan was not checked by the whole baseline.')
    data = (folder/'responses.provider-raw.private.jsonl').read_bytes(); parsed = {}
    for line in data.splitlines():
        value = external.read_json_bytes(line); key = value['key']
        require(key not in parsed, 'Duplicate actual317 raw key.'); parsed[key] = value
    require(len(parsed) == 317 and digest(folder/'responses.provider-raw.private.jsonl') == bound.get(str(folder/'responses.provider-raw.private.jsonl')),
        'Complete actual317 raw collection changed after the prior whole build.')
    return parsed


def typed_occurrences(row, candidate, span, observation):
    actual = observation.get('actual_raw_observation')
    require(observation.get('status') == 'RAW_OBSERVATION_ONLY_NOT_APPROVED' and observation.get('model') == 'gemini-3.1-pro-preview'
        and all(observation.get(k) is None for k in ['word_approval', 'vocal_approval', 'canonical_pronunciation', 'human_listening_verdict', 'timing_approval', 'acting_approval'])
        and isinstance(actual, dict) and actual.get('uncertainties') == []
        and actual.get('transcript') == candidate['whole_Google_transcript']
        and actual.get('whole_utterance_ipa') == candidate['whole_actual_Google_model_IPA']
        and actual.get('vocal_events') == candidate['actual_Google_vocal_events'], 'Actual entire model IPA/transcript/counterevidence differs or remains uncertain.')
    text, transcript, ipa = row['text'], actual['transcript'], actual['whole_utterance_ipa']
    require(isinstance(ipa, str) and ipa, 'A missing IPA cannot receive a specific spelling/pronunciation decision.')
    source_tokens, actual_tokens = list(re.finditer(r'\w+', text)), list(re.finditer(r'\w+', transcript))
    references = candidate['name_references']; occurrences = span['actual_occurrences']; previous_source = previous_actual = previous_ipa = -1
    require(len(source_tokens) == len(actual_tokens) and len(occurrences) == len(references) and occurrences,
        'This narrow route requires actual one-to-one Source/name occurrences.')
    allowed = set(); declarations = []
    for ordinal, (reference, occurrence) in enumerate(zip(references, occurrences), 1):
        index, actual_index = occurrence.get('source_word_index'), occurrence.get('actual_Google_transcript_word_index')
        ss, gs, ps = (occurrence.get(k) for k in ['actual_Source_char_span', 'actual_Google_transcript_char_span', 'actual_model_IPA_char_span'])
        require(type(index) is int and type(actual_index) is int and index == actual_index == reference['source_word_index']
            and previous_source < index < len(source_tokens) and previous_actual < actual_index < len(actual_tokens)
            and type(occurrence.get('ordinal')) is int and occurrence['ordinal'] == ordinal
            and isinstance(ss, dict) and isinstance(gs, dict) and isinstance(ps, dict),
            'Typed ordered exact Source/name/IPA spans are mandatory.')
        for value, original, token in [(ss, text, source_tokens[index]), (gs, transcript, actual_tokens[actual_index])]:
            start, end = value.get('start_codepoint'), value.get('end_codepoint')
            require(type(start) is int and type(end) is int and [start, end] == [token.start(), token.end()]
                and value.get('actual_substring') == token.group() == original[start:end], 'Exact whole-text name token characters differ.')
        start, end = ps.get('start_codepoint'), ps.get('end_codepoint')
        require(type(start) is int and type(end) is int and previous_ipa <= start < end <= len(ipa)
            and ps.get('actual_exact_IPA_substring') == ipa[start:end]
            and ps['actual_exact_IPA_substring'] in candidate['actual_specific_model_IPA_quotes']
            and occurrence.get('canonical_target_IPA') is None and occurrence.get('audio_timestamp') is None,
            'Actual literal model-IPA text occurrence required; no target IPA or invented audio time.')
        guides = occurrence['existing_casting_guidance_provenance']
        require(guides and guides == reference['existing_written_casting_guidance'], 'The specific original casting proposal is missing.')
        for guide in guides:
            record = guide['actual_record']
            require(record.get('status') == 'production_proposal_not_canonical_audio'
                and isinstance(record.get('german_reading'), str) and record['german_reading']
                and guide['record_sha256'] == object_sha(record), 'Historical casting proposals must retain their exact noncanonical status.')
        declarations.append(copy.deepcopy(occurrence)); allowed.add(index)
        previous_source, previous_actual, previous_ipa = index, actual_index, end
    require(all(source.group().lower() == actual_tokens[index].group().lower()
        for index, source in enumerate(source_tokens) if index not in allowed),
        'Every whole Source word outside these exact named indices must be literal; no name/vowel/F/V rule exists.')
    return declarations, allowed


def body_outside_names(text, row, allowed):
    source, actual = list(re.finditer(r'\w+', row['text'])), list(re.finditer(r'\w+', text))
    require(len(source) == len(actual) and all(s.group().lower() == actual[i].group().lower()
        for i, s in enumerate(source) if i not in allowed), 'Additional ASR body/negation/word-boundary changes remain held.')


def exact_declaration(row, take, evidence, observation, primary_raw, large_raw, seconds):
    ident = row['id']; candidate, span = evidence['candidate'], evidence['occurrence_case']
    require(ident in CANDIDATE_IDS and candidate['id'] == span['id'] == ident
        and candidate['source_row_sha256'] == object_sha(row), 'No route for any case outside exact28/f841.')
    declarations, allowed = typed_occurrences(row, candidate, span, observation)
    require(primary_raw.get('id') == large_raw.get('id') == ident and primary_raw.get('source_free') is True
        and large_raw.get('source_free') is True and primary_raw.get('audio_sha256') == large_raw.get('audio_sha256')
        and primary_raw.get('language') == 'de' and primary_raw.get('temperature') == 0.0
        and {k: primary_raw.get('actual_runtime_dimensions', {}).get(k) for k in ['n_audio_layer', 'n_text_layer', 'n_mels']}
            == {'n_audio_layer': 32, 'n_text_layer': 4, 'n_mels': 128}
        and large_raw.get('actual_runtime') == {'model_path': str(prior.FULL_MODEL.resolve()), 'dimensions': prior.FULL_DIMENSIONS}
        and large_raw.get('actual_call_args') == prior.CALL_ARGS and large_raw.get('raw_saved_before_diagnosis') is True,
        'Actual full three-reader source-free identities differ.')
    ptext, ltext = primary_raw['actual_response']['text'], large_raw['actual_response']['text']
    require(ptext.strip() == take['transcript'] == candidate['whole_primary_ASR']['complete_actual_transcript'].strip()
        and ltext == candidate['whole_FullLarge_ASR']['complete_actual_transcript'], 'Whole original ASR counterevidence changed.')
    body_outside_names(ptext, row, allowed); body_outside_names(ltext, row, allowed)
    records = prior.literal_response_body(large_raw['actual_response'], {'text': ltext}, seconds)
    return {'id': ident, 'whole_current_Source': row['text'], 'Source_row_sha256': object_sha(row),
        'current_MP3_sha256': large_raw['audio_sha256'], 'whole_actual_Google_transcript': observation['actual_raw_observation']['transcript'],
        'whole_actual_Google_model_IPA': observation['actual_raw_observation']['whole_utterance_ipa'],
        'actual_Google_observation_sha256': object_sha(observation), 'typed_specific_Source_name_occurrences': declarations,
        'whole_actual_primary_transcript': ptext, 'whole_actual_FullLarge_transcript': ltext,
        'actual_primary_raw_object_sha256': object_sha(primary_raw), 'actual_FullLarge_raw_object_sha256': object_sha(large_raw),
        'actual_complete_FullLarge_records_sha256': object_sha(records),
        'retained_Google_vocal_events': copy.deepcopy(observation['actual_raw_observation']['vocal_events']),
        'retained_whole_original_primary_take': copy.deepcopy(take),
        'historical_written_casting_proposals_remain_noncanonical': True, 'canonical_pronunciation_or_IPA': None,
        'human_listening_or_phonetic_verdict': None, 'no_model_transcript_or_audio_times_changed': True}


def creative_decision_templates(declaration):
    return [{'source_name_word_index': item['source_word_index'],
        'intended_Source_spelling': item['actual_Source_char_span']['actual_substring'],
        'observed_model_name_spelling': item['actual_Google_transcript_char_span']['actual_substring'],
        'accepted_actual_model_IPA_text_span_on_this_audio': copy.deepcopy(item['actual_model_IPA_char_span']),
        'existing_written_casting_proposal_provenance': copy.deepcopy(item['existing_casting_guidance_provenance']),
        'current_MP3_sha256': declaration['current_MP3_sha256'],
        'decision': 'use_Source_spelling_with_this_specific_existing_casting_reading_on_this_current_audio',
        'canonical_pronunciation_or_IPA': None, 'human_listening_or_phonetic_verdict': None,
        'review_note': ''} for item in declaration['typed_specific_Source_name_occurrences']]


def case_template(args, row, take, declaration, google_binding):
    run = Path(args.run_dir).expanduser().resolve()
    return {'version': VERSION, 'status': 'UNAPPROVED_part2_name_case', 'reviewed_by': None,
        'actual_whole_source_and_counterevidence_reviewed': False, 'human_listening_or_acting_approval': False,
        'binding': prior.case_binding(args, run, row), 'retained_initial_take': copy.deepcopy(take),
        'retained_initial_timing_flags': [], 'mode': MODE, 'timing': None,
        'canonical_pronunciation_or_IPA': None, 'name_evidence_bundle': bundle_binding(run),
        'word': {'mode': MODE, 'google317_bundle_sha256': object_sha(google_binding),
            'raw': {'path': str(run/'free-large449/raw'/(row['id']+'.private.json')), 'sha256': digest(run/'free-large449/raw'/(row['id']+'.private.json'))},
            'primary_raw': {'path': str(run/'asr-raw'/(row['id']+'.private.json')), 'sha256': digest(run/'asr-raw'/(row['id']+'.private.json'))},
            'google_observation': {'path': str(run/'sourcefree-google-qc-remaining/observations'/(row['id']+'.private.json')),
                'sha256': digest(run/'sourcefree-google-qc-remaining/observations'/(row['id']+'.private.json'))},
            'exact_declaration': declaration, 'creative_decisions': creative_decision_templates(declaration), 'review_note': ''}}


def approved_case(row, evidence, case, args, run, profiles, qa, alignment, take, bound, raw_google, google_binding, decode_fn=None):
    require(set(case) == {'version', 'status', 'reviewed_by', 'actual_whole_source_and_counterevidence_reviewed',
        'human_listening_or_acting_approval', 'binding', 'retained_initial_take', 'retained_initial_timing_flags',
        'mode', 'timing', 'canonical_pronunciation_or_IPA', 'name_evidence_bundle', 'word'}
        and case.get('version') == VERSION and case.get('status') == 'approved_part2_name_case'
        and case.get('reviewed_by') == 'root' and case.get('actual_whole_source_and_counterevidence_reviewed') is True
        and case.get('human_listening_or_acting_approval') is False and case.get('canonical_pronunciation_or_IPA') is None
        and case.get('mode') == MODE and case.get('timing') is None, 'Explicit current per-case creative Root decision required; canonical/human claims are forbidden.')
    exact_value(case.get('binding'), prior.case_binding(args, run, row), 'Exact Source/audio/producer Root case binding differs.')
    exact_value(case.get('retained_initial_take'), take, 'Original whole primary take must stay unchanged.')
    exact_value(case.get('retained_initial_timing_flags'), [], 'Every original time flag stays held.')
    exact_value(case.get('name_evidence_bundle'), bundle_binding(run), 'Root case must retain the whole exact named evidence.')
    temporal, signal, path = baseline.original_clip(row, run, profiles, qa, alignment, take, args, bound, decode_fn)
    word = case.get('word')
    require(isinstance(word, dict) and set(word) == {'mode', 'google317_bundle_sha256', 'raw', 'primary_raw', 'google_observation',
        'exact_declaration', 'creative_decisions', 'review_note'} and word.get('mode') == MODE
        and word.get('google317_bundle_sha256') == object_sha(google_binding)
        and isinstance(word.get('review_note'), str) and word['review_note'].strip(), 'Typed actual whole317/private word evidence and per-case Root note required.')
    expected_paths = {'raw': run/'free-large449/raw'/(row['id']+'.private.json'), 'primary_raw': run/'asr-raw'/(row['id']+'.private.json'),
        'google_observation': run/'sourcefree-google-qc-remaining/observations'/(row['id']+'.private.json')}
    loaded = {}
    for key, expected in expected_paths.items():
        ref = word[key]; require(ref.get('path') == str(expected) and bound.get(str(expected)) == ref.get('sha256'),
            'This exact existing whole baseline must already pin the three real model files.')
        loaded[key] = prior.bound_ref(run, ref, bound)
    raw, primary, observation = loaded['raw'], loaded['primary_raw'], loaded['google_observation']
    provenance = evidence['candidate']['provider_raw']; genuine = raw_google.get(provenance['external_key'])
    require(genuine == observation.get('actual_provider_batch_row') and object_sha(genuine) == provenance['row_object_sha256']
        and object_sha(genuine.get('response')) == provenance['response_object_sha256']
        and observation.get('whole_raw_batch_sha256') == provenance['sha256']
        and observation.get('WAV_sha256') == digest(run/'raw'/(row['id']+'.wav')),
        'Actual selected IPA/transcript must come from the unchanged full317 original provider bytes.')
    require(raw['actual_audio_input'] == prior.actual_anonymous_waveform(path), 'Original whole FullLarge waveform differs from the current recording.')
    declaration = exact_declaration(row, take, evidence, observation, primary, raw, signal['seconds'])
    exact_value(word.get('exact_declaration'), declaration, 'Root may not change any whole text, observed IPA, typed name span or historical counterevidence.')
    decisions = word.get('creative_decisions'); templates = creative_decision_templates(declaration)
    require(isinstance(decisions, list) and len(decisions) == len(templates), 'Every exact Source-name occurrence requires its own creative Root decision.')
    for decision, expected in zip(decisions, templates):
        require(isinstance(decision, dict) and set(decision) == set(expected)
            and isinstance(decision.get('review_note'), str) and decision['review_note'].strip(), 'A named occurrence lacks its individual creative Root note.')
        compared = copy.deepcopy(decision); compared['review_note'] = ''
        exact_value(compared, expected, 'Creative decision changed the intended Source spelling, actual observed IPA, current audio or historical proposal status.')
    require(digest(path) == temporal['audio_sha256'], 'Current audio changed during exact name qualification.')
    return {'id': row['id'], 'kind': row['kind'], 'speaker': row['speaker'], 'text': row['text'], 'display_text': row['display_text'],
        'voice': profiles['speakers'][row['speaker']]['google_voice'], 'audio': 'audio/teil-2/'+row['id']+'.mp3',
        'sha256': temporal['audio_sha256'], 'seconds': signal['seconds'], 'word_cues': copy.deepcopy(temporal['word_cues']),
        'runtime_keys': copy.deepcopy(row['runtime_keys'])}, path


def build(args, initial, supplemental, external_selection, sourcefree_selection, orthography_selection, selection):
    require(digest(Path(baseline.__file__)) == BASELINE_SHA
        and digest(batch.ROOT/'scripts/part2_voice_orthography_publish_test.py') == BASELINE_TEST_SHA,
        'Frozen complete orthography baseline and tests must remain unchanged.')
    public, paths, preserved, bound, previous = baseline.build(args, initial, supplemental, external_selection, sourcefree_selection, orthography_selection)
    require(len(public['clips']) == 1056 and public['coverage'].get('sourcefree89_qualified_sources') == 15
        and public['coverage'].get('orthography_qualified_sources') == 28,
        'The complete1013 plus15 physically covered timings plus28 orthography recordings must be preserved.')
    target_root = Path(initial['target_root']); target_script = target_root/'scripts'/Path(__file__).name
    require(target_script.is_file() and digest(target_script) == digest(__file__), 'Release name adapter must match independently reviewed production bytes.')
    for path in [target_script, Path(__file__).resolve(), batch.ROOT/'scripts/part2_voice_name_case_publish_test.py', Path(args.name_case_selection)]: external.pin_file(path, bound)
    require(selection.get('version') == VERSION and selection.get('status') == 'approved_part2_name_case_selection'
        and selection.get('reviewed_by') == 'root' and selection.get('human_listening_or_acting_approval') is False
        and selection.get('canonical_pronunciation_or_IPA') is None
        and selection.get('baseline_adapter_sha256') == BASELINE_SHA and selection.get('adapter_sha256') == digest(__file__)
        and selection.get('adapter_test_sha256') == digest(batch.ROOT/'scripts/part2_voice_name_case_publish_test.py')
        and selection.get('target_root') == previous['target_root'] and selection.get('preserved_banks_sha256') == previous['preserved_banks_sha256'],
        'Separate current Root name selection must retain the whole verified prior union.')
    for field, path in [('initial_selection_sha256', args.selection), ('supplemental_selection_sha256', args.supplemental_selection),
        ('external_selection_sha256', args.external_selection), ('sourcefree_timing_selection_sha256', args.sourcefree_timing_selection),
        ('orthography_selection_sha256', args.orthography_selection)]:
        require(selection.get(field) == digest(path), 'A whole earlier Root selection was changed or dropped.')
    for field in ['manifest_sha256', 'profiles_sha256', 'prepared_sha256', 'qa_sha256', 'alignment_sha256', 'qa_producer_sha256', 'alignment_producer_sha256']:
        require(selection.get(field) == previous.get(field), 'Name union changes the original full Source/cast/report provenance.')
    run = Path(args.run_dir).expanduser().resolve(); manifest, profiles = batch.read(run/'lines.private.json'), batch.read(run/'profiles.private.json')
    qa, alignment = batch.read(args.qa_report), batch.read(args.alignment_report)
    takes, checked = base.report_coverage(qa, alignment, manifest, run); rows = {row['id']: row for row in manifest['lines']}
    baseline_ids = {clip['id'] for clip in public['clips']}; chosen = base.ids(selection.get('selected_ids'), 'name-case Root union IDs')
    require(baseline_ids <= chosen <= checked, 'Every prior approved recording is mandatory; unknown Sources cannot be added.')
    additional = chosen-baseline_ids
    require(additional and additional <= set(CANDIDATE_IDS), 'Only the exact28 f841 name cases can be added; every outside case remains held.')
    evidence = name_bundle(run, rows, profiles, bound, selection.get('name_evidence_bundle'))
    raw_google = already_verified_producers(run, selection, external_selection, orthography_selection, bound)
    refs = selection.get('case_approvals'); require(isinstance(refs, list) and len(refs) == len(additional), 'Exact per-ID creative Root case approvals required.')
    cases = {}
    for ref in refs:
        case = prior.bound_ref(run, ref, bound); ident = case.get('binding', {}).get('id')
        require(ident in additional and ident not in cases, 'Unknown/duplicate/nonselected Root name approval.'); cases[ident] = case
    require(set(cases) == additional, 'Every added Source requires its exact creative Root review.')
    for path in base.response_records(run, additional): external.pin_file(path, bound)
    clips = {clip['id']: copy.deepcopy(clip) for clip in public['clips']}
    for ident, case in cases.items():
        clips[ident], paths[ident] = approved_case(rows[ident], evidence[ident], case, args, run, profiles, qa, alignment,
            takes[ident], bound, raw_google, selection['google317_bundle'])
    public = copy.deepcopy(public); public['clips'] = [clips[row['id']] for row in manifest['lines'] if row['id'] in clips]
    coverage = public['coverage']; coverage.update(version=VERSION,
        missing_sources=[entry for entry in coverage['missing_sources'] if entry['id'] not in additional], published_sources=len(clips),
        complete_orthography_baseline_sources=len(baseline_ids), name_case_creative_Root_decided_sources=len(additional),
        name_case_enumerated_specific_candidates=28, name_case_reviewed_original_scope=95,
        name_case_original_timeheld_sources_retained=26, name_case_missing_IPA_sources_retained=4,
        name_case_noncanonical_casting_proposals_retained=True, name_case_original_source_cues_unchanged=True,
        all_original_flags_and_false_verdicts_retained=True, human_listening_or_acting_approval=False,
        canonical_pronunciation_or_IPA=None, name_case_selection_sha256=digest(args.name_case_selection))
    coverage['status'] = 'complete' if not coverage['missing_sources'] else 'partial'
    require(len(clips)+len(coverage['missing_sources']) == len(rows), 'Truthful full Source coverage differs.')
    return public, paths, preserved, bound, selection


def main():
    os.umask(0o077); parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['dryrun', 'apply']); parser.add_argument('--run-dir', required=True)
    for name in ['selection', 'supplemental-selection', 'external-selection', 'sourcefree-timing-selection', 'orthography-selection',
        'name-case-selection', 'qa-report', 'alignment-report', 'qa-producer', 'alignment-producer', 'coverage-report']:
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--adapter-sha256', required=True); parser.add_argument('--target-root', type=Path); args = parser.parse_args()
    try:
        require(digest(__file__) == args.adapter_sha256, 'Root must supply the independently frozen exact name adapter SHA.')
        require(batch.PRIVATE.resolve() in args.coverage_report.resolve().parents and args.coverage_report.resolve() == args.coverage_report,
            'Immutable exact private name coverage path required.')
        with ExitStack() as locks:
            lock = locks.enter_context((batch.PRIVATE/'publish.lock').open('a+')); fcntl.flock(lock, fcntl.LOCK_EX)
            inputs = [batch.read(p) for p in [args.selection, args.supplemental_selection, args.external_selection,
                args.sourcefree_timing_selection, args.orthography_selection, args.name_case_selection]]
            target_root = args.target_root.expanduser().resolve() if args.target_root else batch.ROOT.resolve()
            require(inputs[0].get('target_root') == str(target_root), 'Root name selection must name the exact target lock worktree.')
            locks.enter_context(base.target_publish_lock(target_root))
            public, paths, preserved, bound, selection = build(args, *inputs)
            target = target_root/'game/public/audio/teil-2'; base.existing(target, selection, public); base.stable(bound, preserved)
            report = {'state': 'PUBLISHED' if args.command == 'apply' else 'VALIDATED', **public['coverage'], 'version': VERSION,
                'public_manifest_sha256': batch.sha((json.dumps(public, ensure_ascii=False, indent=2)+'\n').encode()),
                'adapter_sha256': digest(__file__), 'baseline_adapter_sha256': BASELINE_SHA, 'preserved_bank_sha256': preserved,
                'checked_at': int(time.time())}
            require(not args.coverage_report.exists(), 'Immutable name coverage report already exists.')
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
        print('Specific Source-name publication refused; original evidence and banks remain protected.', file=sys.stderr)
        return 1


if __name__ == '__main__': raise SystemExit(main())
