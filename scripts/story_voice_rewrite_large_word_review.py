#!/usr/bin/env python3
"""Offline Root review of three genuine, unprompted rewrite490 Large-v3 reads.

This does not run a model or change audio, Source, caches or word cues. The full
490-take Primary report remains evidence, including its original transcripts and
errors. Only an explicitly selected literal secondary read can qualify one
lexical-mismatch reason. No hearing, acting or timing verdict is supplied.
"""
from __future__ import annotations
import argparse
import copy
from concurrent.futures import ThreadPoolExecutor
import datetime
import json
import math
import os
from pathlib import Path
import struct
import sys
import tempfile
import re
import story_voice_common as common
import story_voice_qa as qa
from story_voice_publish import contained, read, require, sha

VERSION = 'rewrite490-actual-free-large49-literal-word-review-v1'
ACTUAL_METHOD = 'actual-free-whisper-large-v3-private-diagnostic-v1'
RUN_NAME = '2026-10-07-rewrite-490'
MANIFEST_SHA = 'bb243f9af44a00e2fb63779620c1fe92ec6bf1f9896b7629f88195d8a16db343'
MODEL = 'mlx-community/whisper-large-v3'
MODEL_DIR = '/Users/logge/Documents/Projects/SelantisRPG/.venv-transcribe/models/whisper-large-v3'
NAMESPACE = 'remaining49-offline'
RUNNER_SHA = '6f6b5eb40f7c514f598de34fac527d4e05252e6f95632ad54867c923f17550e9'
PREFLIGHT_SHA = '836787c72abe3de80dd8df77e29208450a2578edbf9eec14eb6dfb3dfc21360e'
COMPLETED_SHA = '4da891f20029510aac4ef3ef2c0b40e98fda1b0f927d69a7258627cc85c2582b'
ROOT_LOG_SHA = '831f412db6a5087f9b66e68aa03bcd4ac73f7a0110a17451d4bf5bb702e79121'
QA_SCRIPT_SHA = '931a4287cb4a92ce64c131bacc8fb692dce486cbf09ac4237243eaa7d62d09b6'
INPUT_QA_FILENAME = 'qa-after-word31.private.json'
INPUT_QA_SHA = '601cef9451f45de40c653816250c9caf4ebfa145605cfc98fe63abb22eab5ee8'
PRIOR_SELECTION_PATH = 'root-free-large3-adoption/root-selection.private.json'
PRIOR_SELECTION_SHA = '816d8df74b9f1b9cb05898833d9f3e3d5a129fd7512e77ed38fab1c88d3a4239'
PRIOR_OUTPUT_PATH = 'qa-after-free-large3.private.json'
PRIOR_OUTPUT_SHA = 'dae95830aea4817a248230d948d4c18db79ea54a4b0f0cb082147d21d42b5981'
PRIOR_CACHE_SHA = '676e505150a162359ec4a47707b6194968cade93f8655764d04cf24d25c4c3ad'
# These bytes were inspected only after Root completed the real permanent13
# import and the protected whole490 producer. No self-hashed new input is trusted.
FOLLOWUP_BINDINGS = {
    'input_qa_relative_path':'qa-after-directed13-word40-primary.private.json',
    'input_qa_sha256':'3da2927e6c516a811c9645741419d831e734ef2e80ab932773fff0e8b5b20144',
    'current_primary_cache_sha256':'a9f595c1c1d423826e7d4631cb5d02ef24febb1b75ae77a7ae5f22ac3eb7e4e0',
    'historical_primary_cache_relative_path':'root-directed39-subset13/parent-cache-before.private.json',
    'producer_log_relative_path':'root-directed39-subset13/actual-whole490-producer.private.log',
    'producer_log_sha256':'a715ffec5303dff48f92eb4ff5ce94b6e4f1258930d4cfd563fb4329eb154d59',
    'producer_relative_path':'root-directed39-subset13/produce-whole490.private.py',
    'producer_intent_relative_path':'root-directed39-subset13/whole490-producer-intent.private.json',
    'producer_completion_relative_path':'root-directed39-subset13/whole490-producer-completion.private.json',
    'child_relative_path':'retake-batches/rewrite-directed39-pass2',
    'import_journal_sha256':'35016e564eea0e5cca1af391d173e1dec2af684ad7172867003b2545c6e44779',
    'imported_ids':['story-065cfa917af920fab5558e45','story-0ae4f2166b94382e0d2e265f',
        'story-158ea49eb33b86bc63c8e1e4','story-163526c119cbb08b0a9c1540',
        'story-5b915a168544eff9b48d72fd','story-6a61a3ce7e1119403a392f3b',
        'story-80faa6bd506d43f64ac6d611','story-859f2f0544ff6c7bbfefe46d',
        'story-8ef5b6a55d80fc84dee46224','story-b7a436a19480b506808dfee3',
        'story-ba07fe16416bc2255cecf8b3','story-fd2fa31f17120c356e706a15',
        'story-fdd9e21b1d3da85658142dc5'],
    'child_primary_cache_sha256':'4361ef8d773ad59c3cf7f3255383befc7812ddcb16766b1e7f13536f3227ad49',
    'root_import_approval_relative_path':'root-directed39-subset13/root-review.private.json',
    'root_import_approval_sha256':'9027444fff9b89dd29de202cb17feef3565d66e6748a6ec65dea520079b363d5',
    'immutable_file_sha256':{
        'root-word9-individual/root-word40-combined-approved.private.json':'0fd083dfbfbb09d25b601b56b7bd2f339a96710e012690b80c498cb1e5d4fb29',
        'root-directed39-subset13/root-vocal13-combined-approved.private.json':'491b39ae9e8a8c12150aaa8636a87be6862bb7c14427fafec05a10dca90b68a1',
        'root-directed39-subset13/vocal-actual-combined-report.private.json':'1da5e26bffed25d2c738cd704e0b9523fa78fb6923dd8af00a4b81de432f4a99',
        'independent-google-asr/comparison.private.json':'184832dc2e98ef4c24af7604452d210030342dac0370cf1b64ebc994fef5b464',
        'retake-batches/rewrite-directed39-pass2/import.private.json':'35016e564eea0e5cca1af391d173e1dec2af684ad7172867003b2545c6e44779',
        'retake-batches/rewrite-directed39-pass2/parent-snapshot.private.json':'8a809c723ece6caf835ff97fb8ece4d0ec66c206bf65a057ff9d240da389cfdb',
        'root-directed39-subset13/root-review.private.json':'9027444fff9b89dd29de202cb17feef3565d66e6748a6ec65dea520079b363d5',
        'root-directed39-subset13/selected13-qualification.private.json':'104f754eb8c6a53c02d613a73cf9c93d7b603f957a382cd6a14f3195d713110f',
        'root-directed39-subset13/parent-cache-before.private.json':PRIOR_CACHE_SHA,
        'root-directed39-subset13/cache-transfer13.private.json':'e1e519b418466a8d4137e7c70bcbecfc91cd8563b4bbeb50bb88d70afeb3d35e',
        'qa-asr-cache.private.json':'a9f595c1c1d423826e7d4631cb5d02ef24febb1b75ae77a7ae5f22ac3eb7e4e0',
        'lines.private.json':MANIFEST_SHA,
        'root-directed39-subset13/produce-whole490.private.py':'bc9463d751a5fe297fb5353dfa10040e5e1a7920487a95b35fcab8eba23c71d5',
        'root-directed39-subset13/whole490-producer-intent.private.json':'64f202c64b9a123e3b2a98eb72a06516c14da57cede222e106a2138bf8b8b486',
        'root-directed39-subset13/whole490-producer-completion.private.json':'066f7b2728eae47cd4ae1879590f09085731148bda57a068990604d2edb114a4',
        'root-directed39-subset13/actual-whole490-producer.private.log':'a715ffec5303dff48f92eb4ff5ce94b6e4f1258930d4cfd563fb4329eb154d59',
        'root-word9-individual/review.private.py':'bb8819001c1d5043a9c7ecd378e5cfc4435c786edfbdb0f7837465d000f5175d',
        'root-word9-individual/root-nine-approved.private.json':'a5286f471fac9566ff01fee893d87225ae73f2bb64f49460dbb7a08a7e9f7e41',
        'root-word9-individual/root-full-read-review9.private.json':'f4ac66cd5c30f5c0ec8441c6c606ae1c6e1b4fe408de5f8248e33ed4dc65e403',
        'root-individual-word31-approved.private.json':'4add81fb06f975f4d9381832bb04fc02adc6dd071f06de18638c2fcfd8e853c5'}}
RETAKE_SCRIPT_SHA = 'b2c4de4ce4a1ed8fc7b71818bfc6b40140e5affc520c8c6387e832445605fa72'
FOLLOWUP_VERSION = 'rewrite490-unchanged-real-large3-after-completed-disjoint13-v1'
FOLLOWUP_FIELDS = {'input_qa_relative_path','input_qa_sha256','current_primary_cache_sha256',
    'historical_primary_cache_relative_path','producer_log_relative_path','producer_log_sha256',
    'producer_relative_path','producer_intent_relative_path','producer_completion_relative_path',
    'child_relative_path','import_journal_sha256','imported_ids','child_primary_cache_sha256',
    'root_import_approval_relative_path','root_import_approval_sha256','immutable_file_sha256'}
CONFIG_SHA = '34982ce6ae286095000f82ae9583b3431639e8b092bf60c961f203745e6500e3'
WEIGHTS_SHA = '8c41a4ff9596c44de223d104845c98bc222995f34717f3f4214898d53e95a1c0'
DIMS = {'n_mels':128, 'n_audio_ctx':1500, 'n_audio_state':1280, 'n_audio_head':20,
        'n_audio_layer':32, 'n_vocab':51866, 'n_text_ctx':448, 'n_text_state':1280,
        'n_text_head':20, 'n_text_layer':32}
OPTIONS = {'language':'de', 'task':'transcribe', 'word_timestamps':True,
           'initial_prompt':None, 'condition_on_previous_text':False,
           'temperature':0.0, 'verbose':None, 'prefix':None, 'fp16':True}
SUPPORTED = {'story-425e3f45ea004557e50c6c0b', 'story-a0cb35220b5803315f99b934',
             'story-b5690632831b925c2629b125'}
LEXICAL_REASON = 'asr_lexical_mismatch_requires_review'
DIAGNOSTIC_FIELDS = {'id','status','binding','started_at_utc','finished_at_utc',
    'actual_raw_response','actual_raw_response_sha256','actual_model_dimensions_after_load',
    'actual_ModelHolder_path','actual_encoder_conv1_weight_dtype',
    'actual_decoder_token_embedding_weight_dtype','verbatim_transcript',
    'whole_source_literal_word_match','actual_reader_uncertainty_flag',
    'no_transcript_repairs','no_timestamp_repairs','Root_approval',
    'acting_or_human_hearing_verdict','paid_calls','QA_or_import_or_public_mutation'}
SELECTION_FIELDS = {'status','reviewed_by','reason','source_manifest_sha256',
    'input_qa_sha256','input_primary_cache_sha256','actual_completed_report_sha256',
    'preflight_sha256','runner_sha256','root_log_sha256','selected_ids','records',
    'listening_verdict','acting_verdict'}
RECORD_FIELDS = {'source_text_sha256','clip_sha256','raw_response_sha256',
                 'diagnostic_sha256','input_take_sha256','reason'}
CHAIN_FIELDS = {'prior_root_selection_sha256','prior_large3_output_sha256',
                'completed_import_journal_sha256','producer_qa_log_sha256'}


def digest(path):
    return qa.digest(Path(path))


def canonical_sha(value):
    # Same canonical method as the genuine runner's Primary-cache bindings.
    return sha(json.dumps(value, sort_keys=True, ensure_ascii=False,
                          allow_nan=False).encode())


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def bound_file(path, expected, files):
    path = Path(path).resolve()
    require(path.is_file() and digest(path) == expected,
            'Changed or missing actual evidence: '+str(path))
    files[str(path)] = expected
    return path


def fixed_source(run):
    run = Path(run).resolve()
    require(run.name == RUN_NAME and digest(run/'lines.private.json') == MANIFEST_SHA,
            'Requires the exact frozen rewrite490 Source')
    frozen = read(run/'lines.private.json')
    info = common.prepared(run)
    lines = frozen.get('lines', [])
    require(info.get('bank') == 'story' and info.get('request_count') == len(lines) == 490
            and len({line.get('id') for line in lines}) == 490
            and all(qa.ID.fullmatch(line.get('id','')) and qa.words(line.get('text','')) for line in lines),
            'Incomplete or duplicate actual frozen490 Source')
    return run, {line['id']:line for line in lines}


def current_qa_input(run, qa_path):
    """Accept only the independently inspected real whole490 QA31 snapshot.

    The genuine Large49 execution binds an older QA snapshot separately. A
    self-hashed arbitrary report is not evidence that its other489/487 decisions
    came from the protected Primary producer. A later snapshot needs a separate
    provenance review, rather than an automatic widening of this one scope.
    """
    run = Path(run).resolve(); qa_path = Path(qa_path).resolve()
    require(qa_path == run/INPUT_QA_FILENAME and qa_path.is_file()
            and digest(qa_path) == INPUT_QA_SHA,
            'Requires the exact genuine complete QA31 file and inspected SHA')
    return qa_path


def followup_input(run, qa_path):
    """Default-deny pending a genuinely completed, separately pinned next run."""
    require(isinstance(FOLLOWUP_BINDINGS,dict),
            'Follow-up disabled: no actual completed import and full490 producer evidence pinned')
    require(set(FOLLOWUP_BINDINGS) == FOLLOWUP_FIELDS,
            'Incomplete actual follow-up evidence pin set')
    run = Path(run).resolve(); path = Path(qa_path).resolve()
    require(path == run/FOLLOWUP_BINDINGS['input_qa_relative_path']
            and digest(path) == FOLLOWUP_BINDINGS['input_qa_sha256'],
            'Follow-up requires its exact genuine complete producer report')
    return path


def validate_import_transition(snapshot, journal, before, current, selected_ids):
    """Pure transition guard; completed frozen receipts must be checked separately."""
    selected = set(selected_ids); scope = snapshot.get('selected_ids', [])
    require(len(before) == len(current) == 490 and set(before) == set(current)
            and len(scope) == len(set(scope)) == 39
            and len(selected_ids) == len(selected) == 13 and selected <= set(scope)
            and not selected & SUPPORTED
            and snapshot.get('bank_mp3_sha256') == before,
            'Disjoint follow-up requires the exact whole490 pre-import bank and thirteen of frozen39')
    require(journal.get('state') == 'IMPORTED'
            and journal.get('selected_ids') == selected_ids
            and journal.get('original_scope_selected_ids') == scope
            and set(journal.get('new_mp3_sha256',{})) == selected,
            'A completed exact permanent subset13 import is required')
    changed = {ident for ident in before if before[ident] != current[ident]}
    require(changed == selected
            and all(current[ident] == journal['new_mp3_sha256'][ident] for ident in selected),
            'Every changed byte must be exactly the completed subset13; all477 others stay unchanged')
    return selected


def validate_cache_transition(before, current, report, lines, selected_ids, child_cache):
    """Genuine donor records may be appended; no existing reader is rewritten."""
    require(all(current.get(key) == record for key,record in before.items()),
            'Historical Primary cache records changed or disappeared')
    model = report['model']; keys = {}
    for ident in selected_ids:
        line = lines[ident]; clip = report['clip_sha256'][ident]
        key = qa.text_hash(qa.VERSION+'\0'+model+'\0'+clip+'\0'+line['text'])
        keys[ident] = key
    require(set(current)-set(before) == set(keys.values()),
            'Only the thirteen genuine new Source/audio/model-bound reader entries may be appended')
    for ident,key in keys.items():
        record = current[key]
        require(isinstance(record,dict) and record == child_cache.get(key)
                and record.get('clip_sha256') == report['clip_sha256'][ident]
                and record.get('text_sha256') == qa.text_hash(lines[ident]['text'])
                and isinstance(record.get('transcript'),str),
                'New Primary entry is not the unchanged genuine Child39 reader record: '+ident)
    return keys


def validate_producer_log(log, report):
    progress = [re.fullmatch(r'(\d+)/490 (story-[0-9a-f]{24}): (checked|review_required)',line)
                for line in log.splitlines()]
    progress = [match for match in progress if match]
    takes = report['takes']
    require(len(progress) == 490 and [int(match.group(1)) for match in progress] == list(range(1,491))
            and [match.group(2) for match in progress] == [take['id'] for take in takes]
            and all(match.group(3) == ('review_required' if take['reasons'] else 'checked')
                    for match,take in zip(progress,takes)),
            'Actual protected producer log does not cover the entire current490 body')
    final = json.loads(log.splitlines()[-1])
    require(final == {'checked':490,'clear':sum(not take['reasons'] for take in takes),
                     'open':sum(bool(take['reasons']) for take in takes),
                     'all_actual_cache_reused':True,
                     'secondary_Large3_not_yet_applied_to_this_new_report':True},
            'Actual protected producer completion log differs from its full report')


def validate_producer_metadata(run, qa_path, report, intent, completion, cfg, files):
    require(intent.get('status') == 'root_actual_protected_whole490_producer_started'
            and completion.get('status') == 'root_actual_protected_whole490_producer_completed'
            and intent.get('inputs') == completion.get('inputs')
            and intent.get('actual_audio_before') == completion.get('actual_audio_before') == report['clip_sha256']
            and intent.get('model_id') == completion.get('model_id') == report['model']
            and intent.get('adjudication_projection') is False and intent.get('model_calls_allowed') == 0
            and completion.get('output') == str(qa_path) and completion.get('output_sha256') == cfg['input_qa_sha256']
            and completion.get('checked') == 490 and completion.get('clear') == 425 and completion.get('open') == 65
            and completion.get('signal_failures') == 0 and completion.get('all_primary_cache_reused') is True
            and completion.get('new_model_calls') == 0
            and completion.get('no_primary_transcript_or_cache_modified') is True
            and completion.get('no_secondary_projection_or_removed_reasons') is True
            and completion.get('human_listening_or_acting_verdict') is None
            and type(intent.get('started_at')) is int and type(completion.get('finished_at')) is int
            and intent['started_at'] <= report['started_at'] <= report['finished_at'] <= completion['finished_at']
            and all(take.get('asr_reused') is True for take in report['takes']),
            'Actual protected whole490 producer intent/completion/body differs')
    producer = contained(run,cfg['producer_relative_path'])
    require(completion.get('producer_script_sha256') == cfg['immutable_file_sha256'][cfg['producer_relative_path']]
            == digest(producer), 'Actual completed producer script differs')
    for path, expected in intent['inputs'].items():
        path = Path(path).resolve()
        if path == Path(qa.__file__).resolve(): require(expected == QA_SCRIPT_SHA, 'Wrong protected producer driver')
        else:
            require(path.is_relative_to(run)
                    and cfg['immutable_file_sha256'].get(str(path.relative_to(run))) == expected,
                    'Producer input is not a pinned actual whole490 execution dependency')
        bound_file(path,expected,files)


def validate_model(model):
    """Verify cached full F16 weights without importing or loading any model."""
    directory = Path(MODEL_DIR); weights = directory/'model.safetensors'
    alias = directory/'weights.safetensors'; config = directory/'config.json'
    require(model.get('model_id') == MODEL and model.get('actual_local_directory') == MODEL_DIR
            and model.get('actual_weight_file') == str(weights)
            and model.get('actual_dimensions') == DIMS
            and model.get('config_sha256') == CONFIG_SHA and model.get('weights_sha256') == WEIGHTS_SHA
            and model.get('download_or_model_or_alias_mutation') is False,
            'Actual full32/32 Large-v3 model identity differs')
    require(digest(config) == CONFIG_SHA and digest(weights) == WEIGHTS_SHA
            and read(config) == {**DIMS, 'model_type':'whisper'}
            and alias.is_symlink() and alias.readlink() == Path('model.safetensors')
            and alias.resolve() == weights.resolve()
            and model.get('existing_loader_alias') == str(alias)
            and model.get('alias_link_text') == 'model.safetensors'
            and model.get('alias_resolved_target') == str(weights.resolve())
            and model.get('weights_bytes') == weights.stat().st_size == 3083275629,
            'Cached actual model files or existing loader alias differ')
    with weights.open('rb') as stream:
        size = struct.unpack('<Q', stream.read(8))[0]
        require(0 < size < 8*1024*1024, 'Invalid real weight header')
        header_bytes = stream.read(size); header = json.loads(header_bytes)
    expected = {'encoder.conv1.weight':[1280,3,128],
                'decoder.token_embedding.weight':[51866,1280],
                'encoder.blocks.31.attn.query.weight':[1280,1280],
                'decoder.blocks.31.attn.query.weight':[1280,1280],
                'decoder.positional_embedding':[448,1280]}
    require(sha(header_bytes) == model.get('safetensors_header_sha256')
            and len(header) == model.get('actual_tensor_count') == 1260
            and model.get('actual_shape_proof') == expected,
            'Actual full model header evidence differs')
    for name, shape in expected.items():
        require(header.get(name,{}).get('shape') == shape
                and header.get(name,{}).get('dtype') == 'F16', 'Actual F16 tensor shape differs')
    for prefix in ['encoder','decoder']:
        require({int(key.split('.')[2]) for key in header if key.startswith(prefix+'.blocks.')} == set(range(32)),
                'Actual full model layer count differs')
    return {str(config):CONFIG_SHA, str(weights):WEIGHTS_SHA}


def validate_diagnostic(line, record, raw, summary, preflight, raw_hash):
    """Derive literalness and uncertainty from the unchanged whole raw response."""
    ident = line['id']; binding = record.get('binding', {})
    require(set(record) == DIAGNOSTIC_FIELDS and record.get('id') == ident
            and record.get('status') == 'actual_private_free_Large_diagnostic_not_approved'
            and record.get('started_at_utc') and record.get('finished_at_utc')
            and record.get('Root_approval') is False
            and record.get('acting_or_human_hearing_verdict') is None
            and record.get('paid_calls') == 0 and record.get('QA_or_import_or_public_mutation') is False
            and record.get('no_transcript_repairs') is True and record.get('no_timestamp_repairs') is True,
            'Actual diagnostic fields or honest verdict differ')
    expected_binding = {'method':ACTUAL_METHOD, 'id':ident,
        'audio_mp3_sha256':preflight['inputs']['current_audio_mp3_sha256'][ident],
        'model':preflight['model'], 'runtime':preflight['runtime'],
        'inputs_preflight_sha256':PREFLIGHT_SHA, 'runner_sha256':RUNNER_SHA,
        'decoder_options':OPTIONS, 'authored_Source_supplied_to_decoder':False}
    require(binding == expected_binding and record.get('actual_model_dimensions_after_load') == DIMS
            and record.get('actual_ModelHolder_path') == MODEL_DIR
            and record.get('actual_encoder_conv1_weight_dtype') == 'mlx.core.float16'
            and record.get('actual_decoder_token_embedding_weight_dtype') == 'mlx.core.float16',
            'Actual loaded model, unprompted decoder or runtime binding differs')
    transcript = raw.get('text'); segments = raw.get('segments')
    require(isinstance(transcript,str) and isinstance(segments,list) and raw.get('language') == 'de',
            'Missing real whole German raw response')
    uncertain = not segments
    for segment in segments:
        require(isinstance(segment,dict), 'Invalid actual raw segment')
        values = [segment.get('no_speech_prob'), segment.get('avg_logprob'), segment.get('compression_ratio')]
        require(all(type(value) in (int,float) and math.isfinite(value) for value in values),
                'Invalid actual raw confidence values')
        uncertain |= values[0] > .6 or values[1] < -1 or values[2] > 2.4
    literal = qa.words(line['text']) == qa.words(transcript)
    require(record.get('actual_raw_response_sha256') == raw_hash
            and record.get('verbatim_transcript') == transcript
            and record.get('whole_source_literal_word_match') is literal
            and record.get('actual_reader_uncertainty_flag') is bool(uncertain)
            and summary == {'id':ident, 'verbatim_transcript':transcript,
                'raw_response_sha256':raw_hash, 'actual_reader_uncertainty_flag':bool(uncertain),
                'whole_source_literal_word_match':literal},
            'Whole raw response, actual flags or completed49 summary differ')
    return literal and not uncertain


def execution_proof(run, lines, cache):
    files = {}; directory = run/NAMESPACE; results = directory/'actual-Large49'
    fixed = {'large-free-runner.private.py':RUNNER_SHA, 'Large49-preflight.private.json':PREFLIGHT_SHA,
             'actual-large49-root.private.log':ROOT_LOG_SHA,
             'actual-Large49/completed-diagnostics.private.json':COMPLETED_SHA}
    for name, expected in fixed.items(): bound_file(contained(run,NAMESPACE+'/'+name),expected,files)
    require(digest(qa.__file__) == QA_SCRIPT_SHA, 'Protected Primary QA driver differs')
    files[str(Path(qa.__file__).resolve())] = QA_SCRIPT_SHA
    preflight = read(directory/'Large49-preflight.private.json')
    completed = read(results/'completed-diagnostics.private.json')
    inputs = preflight.get('inputs', {}); ids = inputs.get('selected_ids', [])
    require(preflight.get('method') == completed.get('method') == ACTUAL_METHOD
            and preflight.get('status') == 'actual_inputs_model_runtime_preflight_no_inference'
            and preflight.get('no_inference') is True and preflight.get('paid_calls') == 0
            and preflight.get('QA_or_acting_approval') is None
            and preflight.get('source_or_audio_or_runtime_or_alias_writes') is False
            and preflight.get('decoder_options') == OPTIONS
            and preflight.get('runner',{}).get('sha256') == RUNNER_SHA
            and inputs.get('scope_count') == len(ids) == len(set(ids)) == 49
            and set(ids) <= set(lines) and set(inputs.get('current_audio_mp3_sha256', {})) == set(ids)
            and completed.get('scope_count') == 49
            and completed.get('status') == 'completed_actual_free_model_diagnostics_root_review_required'
            and completed.get('preflight',{}).get('sha256') == PREFLIGHT_SHA
            and completed.get('Root_approval') is False and completed.get('no_QA_adoption') is True
            and completed.get('no_import') is True and completed.get('no_public_write') is True
            and completed.get('paid_calls') == 0 and completed.get('finished_at_utc') is not None,
            'Genuine completed once-only49 execution proof differs')
    model_files = validate_model(preflight['model']); files.update(model_files)
    runtime = preflight['runtime']; runtime_files = runtime.get('runtime_files_sha256', {})
    require(len(runtime_files) == 1490 and canonical_sha(runtime_files) == runtime.get('runtime_fingerprint')
            and runtime.get('model_modules_imported_or_loaded') is False,
            'Pinned actual1490-file execution runtime differs')
    for path, expected in runtime_files.items(): bound_file(path,expected,files)
    for path_key, hash_key in [('python_executable','python_sha256'), ('ffmpeg_executable','ffmpeg_sha256')]:
        bound_file(runtime[path_key],runtime[hash_key],files)
    scope = None; audit = None
    for key in ['scope','source_audit','original_actual_QA_input','frozen_source_manifest','current_source_inventory']:
        binding = inputs[key]; path = Path(binding['path']).resolve()
        require(path.is_relative_to(run) or key == 'current_source_inventory', 'Actual input escaped private bank')
        bound_file(path,binding['sha256'],files)
        if key == 'scope': scope = read(path)
        if key == 'source_audit': audit = read(path)
    require(inputs['frozen_source_manifest']['sha256'] == MANIFEST_SHA
            and scope.get('selected_ids') == audit.get('selected_ids') == ids
            and len(scope.get('records',[])) == len(audit.get('records',[])) == 49,
            'Actual whole49 authored scope differs')
    for path, expected in inputs['current_source_files_sha256'].items(): bound_file(path,expected,files)
    summaries = completed.get('records', [])
    require([row.get('id') for row in summaries] == ids, 'Incomplete or duplicate completed49 raw coverage')
    scope_rows = {row['id']:row for row in scope['records']}
    audit_rows = {row['id']:row for row in audit['records']}
    eligible = {}; actual = {}
    for ident, summary in zip(ids,summaries):
        line = lines[ident]; item = scope_rows[ident]; historical = audit_rows[ident]
        audio_hash = inputs['current_audio_mp3_sha256'][ident]
        bound_file(run/'clips'/(ident+'.mp3'),audio_hash,files)
        require(item.get('source_text') == historical.get('source_text') == line['text']
                and item.get('source_text_sha256') == qa.text_hash(line['text'])
                and item.get('mp3_sha256') == audio_hash
                and canonical_sha(cache.get(historical['actual_primary']['cache_key'])) == historical['actual_primary']['cache_record_sha256'],
                'Actual Source, original Primary counterread or current49 audio differs')
        secondary = historical['actual_independent']['actual_cache_file']
        bound_file(secondary['path'],secondary['sha256'],files)
        raw_path = contained(run,NAMESPACE+'/actual-Large49/'+ident+'.actual-raw-whisper.json')
        record_path = contained(run,NAMESPACE+'/actual-Large49/'+ident+'.actual-diagnostic.private.json')
        raw_hash = summary['raw_response_sha256']; bound_file(raw_path,raw_hash,files)
        record_hash = digest(record_path); files[str(record_path)] = record_hash
        record = read(record_path); raw = read(raw_path)
        require(Path(record.get('actual_raw_response','')).resolve() == raw_path, 'Actual raw response path differs')
        literal = validate_diagnostic(line,record,raw,summary,preflight,raw_hash)
        evidence = {'source_text_sha256':qa.text_hash(line['text']), 'clip_sha256':audio_hash,
                    'raw_response_sha256':raw_hash, 'diagnostic_sha256':record_hash}
        actual[ident] = {'diagnostic':record, 'evidence':evidence}
        if literal: eligible[ident] = evidence
    require(set(eligible) == SUPPORTED, 'Only the three real literal49 results are supported')
    require((directory/'actual-large49-root.private.log').read_text().rstrip().endswith(
        '{"actual_completed": 49, "literal_matches": 3, "uncertain": 0, "paid_calls": 0, "QA_adopted": 0}'),
        'Actual Root completion log differs')
    return eligible, actual, files


def prior_adoption(run, lines, historical_cache_path):
    """Reproduce the exact already-approved full490 result from real old inputs."""
    files = {}; run = Path(run).resolve()
    original_path = current_qa_input(run,run/INPUT_QA_FILENAME)
    historical_cache_path = Path(historical_cache_path).resolve()
    require(historical_cache_path.is_relative_to(run), 'Historical Primary cache must stay private')
    bound_file(historical_cache_path,PRIOR_CACHE_SHA,files)
    selection_path = contained(run,PRIOR_SELECTION_PATH); output_path = contained(run,PRIOR_OUTPUT_PATH)
    bound_file(selection_path,PRIOR_SELECTION_SHA,files);bound_file(output_path,PRIOR_OUTPUT_SHA,files)
    files[str(original_path)] = INPUT_QA_SHA
    original = read(original_path); cache = read(historical_cache_path)
    original_takes = validate_full_qa(original,lines,cache)
    eligible, actual, actual_files = execution_proof(run,lines,cache);files.update(actual_files)
    for ident in eligible:
        eligible[ident]['input_take_sha256'] = canonical_sha(original_takes[ident])
    proof = {'input_qa_path':str(original_path),'input_qa_sha256':INPUT_QA_SHA,
        'input_primary_cache_sha256':PRIOR_CACHE_SHA,'source_manifest_sha256':MANIFEST_SHA,
        'actual_completed_report_sha256':COMPLETED_SHA,'preflight_sha256':PREFLIGHT_SHA,
        'runner_sha256':RUNNER_SHA,'root_log_sha256':ROOT_LOG_SHA,'eligible_records':eligible}
    selection = read(selection_path); previous = read(output_path)
    require(set(validate_selection(selection,proof)) == SUPPORTED,
            'Prior actual Root approval must cover exactly the genuine three literal reads')
    expected = result_report(original,proof,actual,selection,PRIOR_SELECTION_SHA)
    # This nonsemantic completion timestamp was generated at the historical
    # application, and is accepted only from the byte-pinned original output.
    expected['secondary_stage']['finished_at_utc'] = previous.get('secondary_stage',{}).get('finished_at_utc')
    require(expected == previous, 'Historical Large3 report was projected or differs from actual approved inputs')
    return original, previous, cache, proof, actual, files


def validate_full_qa(report, lines, cache):
    ids = set(lines); checked = report.get('checked_ids', []); takes = report.get('takes', [])
    require(report.get('version') == qa.VERSION and isinstance(report.get('model'),str)
            and (report['model'] == qa.MODEL or report['model'].startswith(qa.MODEL+':'))
            and report.get('manifest_sha256') == MANIFEST_SHA and type(report.get('finished_at')) is int
            and report.get('status') in ['passed','review_required']
            and len(checked) == len(set(checked)) == len(takes) == 490
            and set(checked) == set(report.get('clip_sha256', {})) == ids
            and len({take.get('id') for take in takes}) == 490 and {take.get('id') for take in takes} == ids,
            'Requires the genuine completed whole490 current Primary QA')
    require('secondary_stage' not in report, 'This exact Large-word stage cannot be applied twice')
    failures = report.get('failures'); require(isinstance(failures,list), 'Missing whole Primary failures')
    expected_failures = []
    for take in takes:
        ident = take['id']; line = lines[ident]; clip = report['clip_sha256'][ident]
        key = qa.text_hash(qa.VERSION+'\0'+report['model']+'\0'+clip+'\0'+line['text'])
        cached = cache.get(key)
        require(take.get('text_sha256') == qa.text_hash(line['text'])
                and isinstance(cached,dict) and cached.get('clip_sha256') == clip
                and cached.get('text_sha256') == take['text_sha256']
                and isinstance(cached.get('transcript'),str) and take.get('transcript') == cached['transcript']
                and take.get('word_error_rate') == qa.distance(qa.words(line['text']),qa.words(cached['transcript']))/len(qa.words(line['text']))
                and isinstance(take.get('reasons'),list) and all(isinstance(reason,str) for reason in take['reasons']),
                'Primary whole transcript/cache/error/Source evidence differs: '+ident)
        adjudication = take.get('adjudication')
        require(not take['word_error_rate'] or take['reasons']
                or (isinstance(adjudication,dict) and isinstance(adjudication.get('resolution'),str)
                    and adjudication['resolution'].strip()),
                'A mismatched Primary read cannot be silently marked clear: '+ident)
        expected_failures.extend({'id':ident,'reason':reason} for reason in take['reasons'])
    require(failures == expected_failures and (report['status'] == 'passed') == (not failures),
            'Whole Primary failure body/status differs; fatal/global failures cannot be projected')
    return {take['id']:take for take in takes}


def physical_readback(run, lines, report, takes):
    """Measure every current MP3, never rerun ASR or infer timings."""
    def signal_check(ident):
        path = run/'clips'/(ident+'.mp3'); expected = report['clip_sha256'][ident]
        require(digest(path) == expected, 'Stale current whole490 audio: '+ident)
        metrics = qa.decode(path)
        require(digest(path) == expected and metrics == takes[ident]['signal'],
                'Current physical signal read-back differs: '+ident)
        measured_failures = qa.signal_failures(metrics,len(qa.words(lines[ident]['text'])))
        require(all(reason in takes[ident]['reasons'] for reason in measured_failures),
                'Actual signal failure was removed from Primary: '+ident)
        return str(path), expected, measured_failures
    with ThreadPoolExecutor(max_workers=4) as pool:
        physical = list(pool.map(signal_check,list(lines)))
    return {path:expected for path,expected,_ in physical}, {Path(path).stem:reasons for path,_,reasons in physical}


def review(run, qa_path):
    run, lines = fixed_source(run); qa_path = current_qa_input(run,qa_path)
    cache_path = run/'qa-asr-cache.private.json'
    input_qa_hash = digest(qa_path); cache_hash = digest(cache_path)
    report = read(qa_path); cache = read(cache_path)
    takes = validate_full_qa(report,lines,cache)
    eligible, actual, files = execution_proof(run,lines,cache)
    files.update({str(qa_path):input_qa_hash, str(cache_path):cache_hash,
                  str(run/'lines.private.json'):MANIFEST_SHA})
    physical_files, signal_failures = physical_readback(run,lines,report,takes)
    files.update(physical_files)
    for ident in eligible:
        eligible[ident]['input_take_sha256'] = canonical_sha(takes[ident])
        # A secondary lexical read never waives a signal, vocal, veto or cache error.
        require(takes[ident]['reasons'] == [LEXICAL_REASON]
                and not signal_failures[ident] and takes[ident].get('adjudication') is None,
                'Selected actual literal read has another rejection or existing adjudication: '+ident)
    for path, expected in files.items():
        require(digest(path) == expected, 'Evidence changed during complete physical review: '+path)
    proof = {'version':VERSION,'status':'actual_complete_offline_review_root_selection_required',
             'run_dir':str(run), 'input_qa_path':str(qa_path), 'input_qa_sha256':input_qa_hash,
             'input_primary_cache_sha256':cache_hash, 'source_manifest_sha256':MANIFEST_SHA,
             'actual_completed_report_sha256':COMPLETED_SHA, 'preflight_sha256':PREFLIGHT_SHA,
             'runner_sha256':RUNNER_SHA, 'root_log_sha256':ROOT_LOG_SHA,
             'genuine_current_qa_take_count':490, 'physical_signal_readback_count':490,
             'actual_large_raw_response_count':49, 'supported_literal_ids':sorted(eligible),
             'eligible_records':eligible, 'unchanged_input_file_sha256':files,
             'inference_performed_by_this_helper':False, 'paid_calls':0,
             'listening_verdict':None, 'acting_verdict':None, 'timing_verdict':None}
    return proof, report, actual


def followup_review(run, qa_path):
    """Default-denied until actual next evidence is pinned, then full read-back."""
    qa_path = followup_input(run,qa_path); run, lines = fixed_source(run)
    cfg = FOLLOWUP_BINDINGS; files = {}
    for relative, expected in cfg['immutable_file_sha256'].items():
        bound_file(contained(run,relative),expected,files)
    bound_file(qa_path,cfg['input_qa_sha256'],files)
    cache_path = run/'qa-asr-cache.private.json'
    bound_file(cache_path,cfg['current_primary_cache_sha256'],files)
    historical_cache = contained(run,cfg['historical_primary_cache_relative_path'])
    original, previous, old_cache, prior_proof, actual, prior_files = prior_adoption(run,lines,historical_cache)
    files.update(prior_files)
    report = read(qa_path); cache = read(cache_path)
    takes = validate_full_qa(report,lines,cache)
    producer_log = contained(run,cfg['producer_log_relative_path'])
    bound_file(producer_log,cfg['producer_log_sha256'],files)
    require(digest(qa.__file__) == QA_SCRIPT_SHA, 'Protected producer changed')
    validate_producer_log(producer_log.read_text(),report)
    validate_producer_metadata(run,qa_path,report,read(contained(run,cfg['producer_intent_relative_path'])),
                               read(contained(run,cfg['producer_completion_relative_path'])),cfg,files)
    child_relative = cfg['child_relative_path']
    require(child_relative == 'retake-batches/rewrite-directed39-pass2', 'Only actual frozen directed39 child may explain this next scope')
    child = contained(run,child_relative+'/prepared.json').parent
    journal_path = contained(run,child_relative+'/import.private.json')
    bound_file(journal_path,cfg['import_journal_sha256'],files)
    import_review = contained(run,cfg['root_import_approval_relative_path'])
    bound_file(import_review,cfg['root_import_approval_sha256'],files)
    import story_voice_retake_batch as retake
    bound_file(retake.__file__,RETAKE_SCRIPT_SHA,files)
    info = retake.prepared(child,run,verify_bank=False)
    snapshot_path = child/'parent-snapshot.private.json';snapshot = read(snapshot_path)
    journal = read(journal_path); selected_ids = cfg['imported_ids']
    require(journal.get('parent_snapshot_sha256') == digest(snapshot_path)
            and info['request_count'] == 39,
            'Completed import does not bind genuine frozen Child39 Source/requests')
    selected = validate_import_transition(snapshot,journal,original['clip_sha256'],report['clip_sha256'],selected_ids)
    approved_import = read(import_review)
    require(approved_import.get('status') == 'root_individually_approved_permanent_child39_subset13_for_parent_import'
            and approved_import.get('selected_ids') == selected_ids
            and approved_import.get('parent_source_sha256') == MANIFEST_SHA
            and approved_import.get('parent_audio_before_sha256') == original['clip_sha256']
            and approved_import.get('no_full_bank_approval') is True,
            'Actual individual permanent-subset Root import approval differs')
    require(not selected & set(prior_proof['eligible_records'])
            and not selected & set(read(run/NAMESPACE/'Large49-preflight.private.json')['inputs']['selected_ids']),
            'Imported child may not overlap any of the actual Large49 evidence audios')
    archive = Path(journal.get('archive','')).resolve()
    require(archive.is_relative_to((run/'rejected').resolve()) and archive.is_dir(), 'Missing or escaping genuine pre-import archive')
    collection = read(child/'collection.private.json')
    require(collection.get('collected') == collection.get('expected') == 39 and not collection.get('failures'),
            'Original Child39 collection must be complete')
    for ident in selected_ids:
        receipt = read(child/'raw'/(ident+'.receipt.json'))
        require(receipt.get('status') == 'complete' and receipt.get('model') == retake.MODEL
                and receipt.get('request_sha256') == snapshot['modified_request_sha256'][ident],
                'Imported clip lacks actual frozen TTS request provenance')
        for bank in [child,run]:
            path = bank/'raw'/(ident+'.receipt.json')
            require(read(path) == receipt, 'Parent receipt differs from actual collected Child39 receipt')
            files[str(path)] = digest(path)
            for folder,suffix,field in [('raw','.wav','wav_sha256'),('clips','.mp3','mp3_sha256')]:
                bound_file(bank/folder/(ident+suffix),receipt[field],files)
        old_receipt_path = contained(archive,ident+'.receipt.json'); old_receipt = read(old_receipt_path)
        require(old_receipt.get('status') == 'complete' and old_receipt.get('mp3_sha256') == original['clip_sha256'][ident],
                'Archived original receipt does not bind historical whole490 bank')
        files[str(old_receipt_path)] = digest(old_receipt_path)
        bound_file(contained(archive,ident+'.mp3'),original['clip_sha256'][ident],files)
        bound_file(contained(archive,ident+'.wav'),old_receipt['wav_sha256'],files)
    child_cache_path = child/'qa-asr-cache.private.json'
    bound_file(child_cache_path,cfg['child_primary_cache_sha256'],files)
    validate_cache_transition(old_cache,cache,report,lines,selected_ids,read(child_cache_path))
    physical_files, signal_failures = physical_readback(run,lines,report,takes);files.update(physical_files)
    original_takes = {take['id']:take for take in original['takes']}
    for ident in SUPPORTED:
        require(takes[ident] == original_takes[ident] and not signal_failures[ident],
                'Unchanged Large3 Source/audio/Primary counterevidence has changed or gained a rejection')
    for path, expected in files.items(): require(digest(path) == expected, 'Chain evidence changed during complete review')
    proof = {**prior_proof,'version':FOLLOWUP_VERSION,
        'status':'actual_completed_disjoint13_and_current_full490_root_selection_required',
        'run_dir':str(run),'input_qa_path':str(qa_path),'input_qa_sha256':cfg['input_qa_sha256'],
        'input_primary_cache_sha256':cfg['current_primary_cache_sha256'],
        'prior_root_selection_sha256':PRIOR_SELECTION_SHA,'prior_large3_output_sha256':PRIOR_OUTPUT_SHA,
        'completed_import_journal_sha256':cfg['import_journal_sha256'],
        'producer_qa_log_sha256':cfg['producer_log_sha256'],'imported_disjoint_ids':selected_ids,
        'prior_original_word_failures':len(original['failures']),'prior_large3_word_failures':len(previous['failures']),
        'genuine_current_qa_take_count':490,'physical_signal_readback_count':490,
        'actual_large_raw_response_count':49,'supported_literal_ids':sorted(SUPPORTED),
        'unchanged_input_file_sha256':files,'inference_performed_by_this_helper':False,
        'paid_calls':0,'listening_verdict':None,'acting_verdict':None,'timing_verdict':None}
    return proof, report, actual


def validate_selection(selection, proof):
    require(set(selection) == SELECTION_FIELDS
            and selection.get('status') == 'root_approved_exact_literal_large_word_review'
            and isinstance(selection.get('reviewed_by'),str) and selection['reviewed_by'].casefold().startswith('root')
            and isinstance(selection.get('reason'),str) and len(selection['reason'].strip()) >= 20
            and selection.get('listening_verdict') is None and selection.get('acting_verdict') is None,
            'Explicit Root technical selection and meaningful note required')
    for key in ['source_manifest_sha256','input_qa_sha256','input_primary_cache_sha256',
                'actual_completed_report_sha256','preflight_sha256','runner_sha256','root_log_sha256']:
        require(selection.get(key) == proof[key], 'Root selection bound input differs: '+key)
    selected = selection.get('selected_ids')
    require(isinstance(selected,list) and 0 < len(selected) == len(set(selected))
            and set(selected) <= SUPPORTED and set(selection.get('records', {})) == set(selected),
            'Only explicitly selected real literal Large IDs are supported')
    for ident in selected:
        record = selection['records'][ident]
        require(set(record) == RECORD_FIELDS and isinstance(record.get('reason'),str)
                and len(record['reason'].strip()) >= 20
                and {key:value for key,value in record.items() if key != 'reason'} == proof['eligible_records'][ident],
                'Root per-take whole raw/diagnostic/Primary/audio binding differs: '+ident)
    return selected


def result_report(input_report, proof, actual, selection, selection_sha):
    selected = validate_selection(selection,proof); result = copy.deepcopy(input_report)
    for take in result['takes']:
        ident = take['id']
        if ident not in selected: continue
        require(take['reasons'] == [LEXICAL_REASON], 'Cannot remove nonlexical or compound rejections')
        take['original_primary_reasons'] = list(take['reasons']); take['reasons'] = []
        diagnostic = actual[ident]['diagnostic']
        take['adjudication'] = {'resolution':VERSION,
            'evidence':proof['eligible_records'][ident],
            'secondary_model':MODEL, 'actual_model_dimensions':DIMS,
            'decoder_options':OPTIONS, 'authored_Source_supplied_to_decoder':False,
            'verbatim_secondary_transcript':diagnostic['verbatim_transcript'],
            'original_primary_transcript':take['transcript'],
            'original_primary_word_error_rate':take['word_error_rate'],
            'root_review':selection['records'][ident], 'reviewed_by':selection['reviewed_by'],
            'root_selection_sha256':selection_sha,
            'timing_verdict':None, 'listening_verdict':None, 'acting_verdict':None}
    result['failures'] = [failure for failure in result['failures']
                          if not (failure['id'] in selected and failure['reason'] == LEXICAL_REASON)]
    result['status'] = 'passed' if not result['failures'] else 'review_required'
    result['secondary_stage'] = {'version':VERSION,'actual_model':MODEL,
        'selected_ids':selected,'root_selection_sha256':selection_sha,
        'finished_at_utc':stamp(),'input_qa_path':proof['input_qa_path'],
        'input_qa_sha256':proof['input_qa_sha256'],
        'input_primary_cache_sha256':proof['input_primary_cache_sha256'],
        'actual_completed_report_sha256':COMPLETED_SHA, 'preflight_sha256':PREFLIGHT_SHA,
        'runner_sha256':RUNNER_SHA, 'root_log_sha256':ROOT_LOG_SHA,
        'unchanged_primary_model':input_report['model'], 'unchanged_primary_version':input_report['version'],
        'physical_current_signal_readback_count':490,'full_raw_secondary_count':49,
        'input_primary_transcripts_and_errors_retained':True,
        'audio_or_source_or_cache_or_word_cues_written':False,
        'helper_performed_inference':False, 'paid_calls':0,
        'listening_verdict':None,'acting_verdict':None,'timing_verdict':None}
    return result


def chain_result_report(input_report, proof, actual, selection, selection_sha):
    require(set(selection) == SELECTION_FIELDS | {'chain'}
            and selection.get('status') == 'root_approved_verified_unchanged_large3_after_disjoint13'
            and set(selection.get('selected_ids',[])) == SUPPORTED
            and set(selection.get('chain',{})) == CHAIN_FIELDS
            and selection['chain'] == {key:proof[key] for key in CHAIN_FIELDS},
            'Explicit Root continuation must bind the actual prior approval, import and producer chain')
    base = {key:value for key,value in selection.items() if key != 'chain'}
    base['status'] = 'root_approved_exact_literal_large_word_review'
    result = result_report(input_report,proof,actual,base,selection_sha)
    for take in result['takes']:
        if take['id'] not in SUPPORTED:continue
        take['adjudication']['preserved_actual_Large3_root_selection_sha256'] = PRIOR_SELECTION_SHA
        take['adjudication']['continuation_chain'] = selection['chain']
    result['secondary_stage']['continuation_version'] = FOLLOWUP_VERSION
    result['secondary_stage']['continuation_chain'] = selection['chain']
    result['secondary_stage']['completed_disjoint_import_ids'] = proof['imported_disjoint_ids']
    result['secondary_stage']['original_actual_large_approval_reproduced_from_all_real_inputs'] = True
    return result


def save_new_atomic(path, value, bindings):
    """One private new report; an existing report is never replaced."""
    path = Path(path); require(not path.exists() and not path.is_symlink(), 'Output already exists')
    require(path.parent.is_dir(), 'Output parent must already exist')
    temporary = None; installed = False
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.'+path.name+'.', delete=False) as stream:
            temporary = Path(stream.name); os.chmod(temporary,0o600)
            stream.write((json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n').encode())
            stream.flush(); os.fsync(stream.fileno())
        for name, expected in bindings.items():
            require(digest(name) == expected, 'Actual evidence changed before report installation')
        # Hard link gives an atomic O_EXCL installation without overwriting.
        os.link(temporary,path); installed = True
        for name, expected in bindings.items():
            require(digest(name) == expected, 'Actual evidence changed during report installation')
    except BaseException:
        if installed and path.exists() and temporary.exists() and os.path.samestat(path.stat(),temporary.stat()):
            # Never remove a concurrent writer's replacement of our new report.
            path.unlink()
        raise
    finally:
        if temporary is not None and temporary.exists(): temporary.unlink()


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['review','apply','review-chain','apply-chain'])
    parser.add_argument('--run-dir',type=Path,required=True)
    parser.add_argument('--qa-report',type=Path,required=True)
    parser.add_argument('--root-selection',type=Path)
    parser.add_argument('--output',type=Path)
    args = parser.parse_args()
    try:
        chain = args.command.endswith('-chain')
        proof, report, actual = (followup_review if chain else review)(args.run_dir,args.qa_report)
        if args.command in ['review','review-chain']:
            require(args.root_selection is None and args.output is None, 'Review is read-only; output is for Root apply')
            print(json.dumps({key:value for key,value in proof.items() if key != 'unchanged_input_file_sha256'},
                             ensure_ascii=False,indent=2))
        else:
            require(args.root_selection is not None and args.output is not None, 'Apply requires Root selection and new private output')
            run = Path(args.run_dir).resolve(); selection_path = args.root_selection.resolve()
            output = args.output.absolute()
            require(selection_path.is_relative_to(run) and selection_path.is_file()
                    and output.parent.resolve() == run and not output.is_symlink()
                    and output.name.startswith('qa-') and output.name.endswith('.private.json'),
                    'Selection/output must stay private; output must be a new root-bank QA file')
            selection_sha = digest(selection_path); selection = read(selection_path)
            value = (chain_result_report if chain else result_report)(report,proof,actual,selection,selection_sha)
            bindings = dict(proof['unchanged_input_file_sha256']); bindings[str(selection_path)] = selection_sha
            save_new_atomic(output,value,bindings)
            print(json.dumps({'output':str(output),'sha256':digest(output),
                              'checked_takes':len(value['takes']),'selected_ids':selection['selected_ids'],
                              'remaining_failures':len(value['failures']),'status':value['status'],
                              'primary_model':value['model'],'secondary_model':MODEL,'audio_changes':0}))
    except (ValueError,OSError,KeyError,TypeError) as error:
        print('REFUSED: '+str(error),file=sys.stderr); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
