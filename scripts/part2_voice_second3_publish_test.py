"""Offline second3 publication guards using isolated synthetic fixtures only.

The inherited body31 fixture design is adapted only in this new file.
No fixture denotes actual voice, word, timing, listening, or actor approval.
No provider, model, credential, production bank, or original evidence is used.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import part2_voice_second3_publish as m


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    return path


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value if isinstance(value, bytes) else value.encode())
    return path


class TemporaryEvidence(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()

    def start(self, *patches):
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def ref(self, path):
        return {'path': str(path), 'sha256': m.digest(path)}

    def historical_fixture(self, run, command, ids, model, helpers, version, root_review, runtime_ref):
        """Build one self-contained synthetic operation, without copying real QA.

        The input proof and completed proof preserve original maps. Rehashing a
        malicious outer review must not make an omitted inner file acceptable.
        """
        info = {'selected_ids': list(ids), 'request_count': len(ids), 'input_sha256': 'a' * 64}
        write(run / 'requests.jsonl', 'Synthetic request bytes, no provider call\n')
        info['input_sha256'] = m.digest(run / 'requests.jsonl')
        save(run / 'prepared.json', info)
        save(run / 'lines.private.json', {'lines': [{'id': ident, 'text': 'Synthetic words '+ident} for ident in ids], 'synthetic_fixture_only': True})
        write(run / 'responses.private.jsonl', 'Synthetic response bytes, no provider call\n')
        for ident in ids:
            write(run / 'clips' / (ident + '.mp3'), b'Synthetic audio ' + ident.encode())
        before = {str(path.relative_to(run)): m.digest(path) for path in run.rglob('*') if path.is_file()}
        input_proof = {'version': version, 'command': command, 'state': 'ONCE_INPUT_BYTES_BEFORE_MODEL',
            'root_second3_review_sha256': root_review, 'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False,
            'complete_pre_existing_child_sha256': before, 'helpers_sha256': helpers, 'original_prior_evidence_sha256': {}, 'original_source_parent_count': 1401, 'retained_prior_failed_audio_count': 8}
        input_path = save(run / ('second3-' + command + '-inputs.private.json'), input_proof)
        producer_inputs = {**before, input_path.name: m.digest(input_path)}
        report_path = run / ('qa.private.json' if command == 'qa' else 'word-cues/alignment.private.json')
        report = {'status': 'passed', 'failures': [], 'model': 'synthetic-sourcefree-model', 'takes': [{'id': ident, 'transcript': 'Synthetic words '+ident} for ident in ids], 'synthetic_fixture_only': True}
        save(report_path, report)
        outputs = {str(report_path.relative_to(run)): m.digest(report_path)}
        if command == 'qa':
            cache = {m.body.q.qa.text_hash(m.body.q.qa.VERSION+'\0'+report['model']+'\0'+m.digest(run/'clips'/(ident+'.mp3'))+'\0'+'Synthetic words '+ident): {'clip_sha256':m.digest(run/'clips'/(ident+'.mp3')),'text_sha256':m.body.q.qa.text_hash('Synthetic words '+ident),'transcript':'Synthetic words '+ident} for ident in ids}
            path = save(run / 'qa-asr-cache.private.json', cache)
            outputs[path.name] = m.digest(path)
        for ident in ids:
            for folder in (['asr-raw', 'local-asr-intents'] if command == 'qa' else ['alignment-raw', 'local-alignment-intents']):
                path = save(run / folder / (ident + '.private.json'), {'synthetic_fixture_only': True, 'id': ident})
                outputs[str(path.relative_to(run))] = m.digest(path)
            if command == 'align':
                path = save(run / 'word-cues' / (ident + '.json'), {'synthetic_fixture_only': True, 'id': ident})
                outputs[str(path.relative_to(run))] = m.digest(path)
        intent = {'version': version, 'command': command, 'state': 'ONE_ROOT_ACTUAL_RUN_STARTED',
            'selected_ids': list(ids), 'input_sha256': info['input_sha256'], 'prepared_sha256': m.digest(run / 'prepared.json'),
            'source_manifest_sha256': m.digest(run / 'lines.private.json'), 'helpers_sha256': helpers,
            'pre_existing_child_sha256': producer_inputs, 'model': model,
            'human_listening_or_acting_or_voice_identity_approved': False}
        intent_path = save(run / ('qualification-' + command + '.intent.private.json'), intent)
        producer = {**intent, 'state': 'ACTUAL_RUN_COMPLETED_WITH_CURRENT_REPORT', 'report_path': str(report_path),
            'report_sha256': m.digest(report_path), 'report_status': report['status'],
            'created_outputs_sha256': outputs, 'actual_model_call_ids': list(ids),
            'actual_source_free_ids' if command == 'qa' else 'actual_timing_ids': list(ids),
            'original_prior_evidence_sha256': {}, 'original_source_parent_count': 1401, 'retained_prior_failed_audio_count': 8, 'prior_bad8_QC3_counterevidence_retained': True, 'source_case_count': 3, 'unique_prepared_request_count': 3,
            'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False, 'operation_decoder': model['decoders'][command],
            'operation_source_kind': 'sourcefree_words' if command == 'qa' else 'authored_timing_only',
            'actual_imported_runtime': {name: {'path': path, 'sha256': model['runtime_files_sha256'][path]}
                for name, path in zip(m.body.IMPORTS, model['runtime_files_sha256'])}}
        for ident in ids:
            if command == 'qa':
                binding = {'input_kind': 'actual_decoded_waveform_array_only', 'sample_rate': 16000, 'sample_count': 3,
                    'dtype': 'float32', 'waveform_sha256': 'b' * 64, 'decoder': model['decoders']['qa']}
                for folder in ['asr-raw', 'local-asr-intents']:
                    path = run / folder / (ident + '.private.json')
                    save(path, {'id': ident, 'actual_audio_input': binding, 'actual_imported_runtime': producer['actual_imported_runtime'],
                        'actual_response': {'text': 'Synthetic words '+ident}, 'synthetic_fixture_only': True})
                    outputs[str(path.relative_to(run))] = m.digest(path)
        producer_path = save(run / ('qualification-' + command + '.producer.private.json'), producer)
        completed = {'version': version, 'command': command, 'state': 'IMMUTABLE_ACTUAL_COMPLETED_PRODUCER_PROOF',
            'producer_sha256': m.digest(producer_path), 'input_proof_sha256': m.digest(input_path),
            'report_sha256': m.digest(report_path), 'operation_intent_sha256': m.digest(intent_path),
            'complete_original_inputs_sha256': producer_inputs, 'complete_original_outputs_sha256': outputs,
            'actual_model_call_ids': list(ids), 'original_prior_evidence_sha256': {}, 'original_source_parent_count': 1401, 'retained_prior_failed_audio_count': 8, 'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False, 'word_time_or_human_adoption': False}
        completed_path = save(run / ('second3-' + command + '-completed.private.json'), completed)
        union = {str(run / name): sha for mapping in [producer_inputs, outputs] for name, sha in mapping.items()}
        for path in [producer_path, intent_path, completed_path]:
            union[str(path)] = m.digest(path)
        review = {'state': 'ACTUAL_COMPLETED_ORIGINAL_INPUT_OUTPUT_RAW_WAVE_RUNTIME_SOURCE_CPU_REVIEW_PASS',
            'command': command, 'group': 1, 'run': str(run), 'actual_selected_count': len(ids),
            'actual_model_call_count': len(ids), 'original_input_count': len(producer_inputs), 'original_output_count': len(outputs),
            'original_input_map_sha256': m.object_sha(producer_inputs), 'original_output_map_sha256': m.object_sha(outputs),
            'complete_current_historical_files_sha256': union, 'report_status': report['status'], 'retained_failures': [],
            'details': [], 'original_prior_evidence_sha256': {}, 'original_source_parent_count': 1401, 'retained_prior_failed_audio_count': 8, 'model_runtime_reference_sha256': runtime_ref, 'producer_sha256': m.digest(producer_path),
            'actual_second3_method_review_sha256': m.METHOD_REVIEW_SHA,
            'immutable_completed_proof_sha256': m.digest(completed_path),
            'current_source_cast_provider_and_7044_188_1490_rechecked': True, 'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False,
            'model_or_api_calls_by_reviewer': 0, 'audio_reports_cues_or_historical_files_modified': False,
            'human_listening_or_acting_approval': False, 'synthetic_fixture_only': True}
        review_path = save(run / ('independent-' + command + '-review.private.json'), review)
        return {'info': info, 'inputs_path': input_path, 'intent_path': intent_path, 'producer_path': producer_path,
            'completed_path': completed_path, 'report_path': report_path, 'review_path': review_path,
            'review': self.ref(review_path), 'producer': producer, 'report': report}


class Historical(TemporaryEvidence):
    def setUp(self):
        super().setUp()
        self.run = self.root / 'retake-driver/second3-group-01'
        self.ids = ['part2-' + str(index).zfill(24) for index in range(1, 4)]
        model_root = self.root / 'synthetic-never-loaded-model'
        config = write(model_root / 'config.json', 'Synthetic, never loaded')
        weight = write(model_root / 'weights.npz', b'Synthetic, never loaded')
        runtime = {str(write(self.root / 'runtime' / (str(index) + '.py'), 'Synthetic runtime ' + name)): None
            for index, name in enumerate(m.body.IMPORTS)}
        runtime = {name: m.digest(name) for name in runtime}
        self.model = {'local_directory': str(model_root), 'config_sha256': m.digest(config), 'weights': {'weights.npz': m.digest(weight)},
            'runtime_files_sha256': runtime, 'decoders': {command: {**value, 'selected_path': '/synthetic/ffmpeg',
                'resolved_path': '/synthetic/ffmpeg', 'sha256': 'd' * 64} for command, value in m.body.DECODER_FORMATS.items()}}
        self.helpers = {'synthetic_fixture_helper': 'c' * 64}
        self.fixture = self.historical_fixture(self.run, 'qa', self.ids, self.model, self.helpers,
            m.body.VERSION, m.body.REVIEW_SHA, m.RUNTIME_REVIEW_SHA)
        self.wave_binding = {'input_kind': 'actual_decoded_waveform_array_only', 'sample_rate': 16000, 'sample_count': 3,
            'dtype': 'float32', 'waveform_sha256': 'b' * 64, 'decoder': self.model['decoders']['qa']}
        self.start(patch.object(m.body, 'RUN', self.root), patch.object(m.body, 'group', return_value=self.fixture['info']),
            patch.object(m.body, 'helpers', return_value=self.helpers), patch.object(m.body, 'prior_evidence', return_value={}),
            patch.object(m.body.q, 'verify_word_report', return_value=self.ids),
            patch.object(m.body.q, 'verify_timing_report', return_value=self.ids),
            patch.object(m, 'waveform', return_value=self.wave_binding))
        self.assertEqual(self.check()[0]['actual_model_call_ids'], self.ids)

    def check(self, historical_tests=None):
        return m.historical(self.run, self.command, self.fixture['review'], {}, self.model, historical_tests)

    @property
    def command(self):
        return m.read(self.fixture['producer_path'])['command']

    def refresh_outer(self, update_output_hashes=False):
        """Synthetic coherent outer hashes; never rewrite actual history."""
        f = self.fixture
        producer = m.read(f['producer_path'])
        if update_output_hashes:
            producer['created_outputs_sha256'] = {name: m.digest(self.run / name) for name in producer['created_outputs_sha256']}
            save(f['producer_path'], producer)
        completed = m.read(f['completed_path'])
        completed['producer_sha256'] = m.digest(f['producer_path'])
        completed['operation_intent_sha256'] = m.digest(f['intent_path'])
        if update_output_hashes:
            completed['complete_original_outputs_sha256'] = producer['created_outputs_sha256']
        save(f['completed_path'], completed)
        review = m.read(f['review_path'])
        before, outputs = producer['pre_existing_child_sha256'], producer['created_outputs_sha256']
        review.update(producer_sha256=m.digest(f['producer_path']), immutable_completed_proof_sha256=m.digest(f['completed_path']),
            original_input_count=len(before), original_output_count=len(outputs), original_input_map_sha256=m.object_sha(before),
            original_output_map_sha256=m.object_sha(outputs))
        union = {str(self.run / name): sha for mapping in [before, outputs] for name, sha in mapping.items()}
        for path in [f['producer_path'], f['completed_path'], f['intent_path']]:
            union[str(path)] = m.digest(path)
        review['complete_current_historical_files_sha256'] = union
        save(f['review_path'], review)
        f['review'] = self.ref(f['review_path'])

    def edit_producer(self, field, value):
        producer = m.read(self.fixture['producer_path']); producer[field] = value
        save(self.fixture['producer_path'], producer); self.refresh_outer()

    def test_complete_original_input_output_and_raw_review_is_required(self):
        bound = {}; producer, report = m.historical(self.run, 'qa', self.fixture['review'], bound, self.model)
        self.assertEqual(producer['created_outputs_sha256'].keys(), {
            'qa.private.json', 'qa-asr-cache.private.json', *(folder + '/' + ident + '.private.json'
                for folder in ['asr-raw', 'local-asr-intents'] for ident in self.ids)})
        self.assertEqual(report, self.fixture['report'])
        self.assertIn(str(self.fixture['inputs_path']), bound)
        self.assertIn(str(self.run / 'responses.private.jsonl'), bound)

    def test_failed_unknown_or_runtime_failed_completed_producer_is_refused(self):
        for field, value in [('state', 'FAILED_WITH_REAL_PRIVATE_EVIDENCE_NO_APPROVAL'),
                ('state', 'UNKNOWN'), ('runtime_guard_failed', True)]:
            original = m.read(self.fixture['producer_path'])
            self.edit_producer(field, value)
            with self.subTest(field=field, value=value), self.assertRaises(m.r.SafeError): self.check()
            save(self.fixture['producer_path'], original); self.refresh_outer()

    def test_producer_input_omission_survives_outer_rehash_but_is_refused(self):
        producer = m.read(self.fixture['producer_path']); producer['pre_existing_child_sha256'].pop('responses.private.jsonl')
        save(self.fixture['producer_path'], producer)
        intent = m.read(self.fixture['intent_path']); intent['pre_existing_child_sha256'] = producer['pre_existing_child_sha256']
        save(self.fixture['intent_path'], intent); self.refresh_outer()
        with self.assertRaisesRegex(m.r.SafeError, 'input omissions'): self.check()

    def test_same_count_replacement_cannot_replace_original_input_map(self):
        producer = m.read(self.fixture['producer_path']); producer['pre_existing_child_sha256'].pop('responses.private.jsonl')
        projection = write(self.run / 'current-projection.private.json', 'A new current projection')
        producer['pre_existing_child_sha256'][projection.name] = m.digest(projection)
        save(self.fixture['producer_path'], producer)
        intent = m.read(self.fixture['intent_path']); intent['pre_existing_child_sha256'] = producer['pre_existing_child_sha256']
        save(self.fixture['intent_path'], intent); self.refresh_outer()
        with self.assertRaisesRegex(m.r.SafeError, 'input omissions'): self.check()

    def test_missing_raw_report_only_or_extra_output_is_refused_after_outer_rehash(self):
        original = m.read(self.fixture['producer_path'])
        for change in ['raw_omitted', 'report_only', 'extra']:
            producer = copy.deepcopy(original)
            if change == 'raw_omitted': producer['created_outputs_sha256'].pop('asr-raw/' + self.ids[0] + '.private.json')
            if change == 'report_only': producer['created_outputs_sha256'] = {'qa.private.json': m.digest(self.fixture['report_path'])}
            if change == 'extra': producer['created_outputs_sha256']['prepared.json'] = m.digest(self.run / 'prepared.json')
            save(self.fixture['producer_path'], producer); self.refresh_outer()
            with self.subTest(change=change), self.assertRaisesRegex(m.r.SafeError, 'output is mandatory'): self.check()
        save(self.fixture['producer_path'], original); self.refresh_outer()

    def test_completed_proof_cannot_omit_input_output_or_be_relabelled(self):
        original = m.read(self.fixture['completed_path'])
        for field, value in [('complete_original_inputs_sha256', {}), ('complete_original_outputs_sha256', {}),
                ('word_time_or_human_adoption', True), ('source32_reuse_approved', True)]:
            changed = copy.deepcopy(original); changed[field] = value; save(self.fixture['completed_path'], changed)
            review = m.read(self.fixture['review_path']); review['immutable_completed_proof_sha256'] = m.digest(self.fixture['completed_path'])
            review['complete_current_historical_files_sha256'][str(self.fixture['completed_path'])] = m.digest(self.fixture['completed_path'])
            save(self.fixture['review_path'], review); self.fixture['review'] = self.ref(self.fixture['review_path'])
            with self.subTest(field=field), self.assertRaises(m.r.SafeError): self.check()
        save(self.fixture['completed_path'], original); self.refresh_outer()

    def test_independent_review_must_contain_exact_full_historical_union(self):
        original = m.read(self.fixture['review_path'])
        for change in ['raw_omitted', 'completed_omitted', 'extra']:
            review = copy.deepcopy(original); mapping = review['complete_current_historical_files_sha256']
            if change == 'raw_omitted': mapping.pop(str(self.run / 'asr-raw' / (self.ids[0] + '.private.json')))
            if change == 'completed_omitted': mapping.pop(str(self.fixture['completed_path']))
            if change == 'extra': mapping[str(self.run / 'fresh-projection.private.json')] = 'e' * 64
            save(self.fixture['review_path'], review); self.fixture['review'] = self.ref(self.fixture['review_path'])
            with self.subTest(change=change), self.assertRaisesRegex(m.r.SafeError, 'whole exact historical union'): self.check()
        save(self.fixture['review_path'], original); self.fixture['review'] = self.ref(self.fixture['review_path'])

    def test_provider_original_audio_source_and_raw_bytes_cannot_change(self):
        for path in [self.run / 'responses.private.jsonl', self.run / 'clips' / (self.ids[0] + '.mp3'),
                self.run / 'lines.private.json', self.run / 'asr-raw' / (self.ids[0] + '.private.json')]:
            original = path.read_bytes(); path.write_bytes(b'Changed synthetic evidence')
            with self.subTest(path=path), self.assertRaises(m.r.SafeError): self.check()
            path.write_bytes(original)

    def test_model_config_weights_aliases_and_runtime_contract_cannot_be_relabelled(self):
        original = m.read(self.fixture['producer_path'])
        for field, value in [('config_sha256', 'f' * 64), ('weights', {}), ('loader_aliases', {'foreign': {}}),
                ('runtime_files_sha256', {}), ('decoders', {})]:
            producer = copy.deepcopy(original); producer['model'][field] = value; save(self.fixture['producer_path'], producer)
            intent = m.read(self.fixture['intent_path']); intent['model'] = producer['model']; save(self.fixture['intent_path'], intent)
            self.refresh_outer()
            with self.subTest(field=field), self.assertRaisesRegex(m.r.SafeError, 'complete installed model'): self.check()
        save(self.fixture['producer_path'], original)

    def test_all17_actual_import_receipts_are_mandatory(self):
        imports = m.read(self.fixture['producer_path'])['actual_imported_runtime']; imports.pop(next(iter(imports)))
        self.edit_producer('actual_imported_runtime', imports)
        with self.assertRaisesRegex(m.r.SafeError, 'All17'): self.check()

    def test_runtime_import_origin_outside_pinned_runtime_is_refused(self):
        imports = m.read(self.fixture['producer_path'])['actual_imported_runtime']
        foreign = write(self.root / 'foreign-unpinned-runtime.py', 'Current foreign runtime')
        imports[next(iter(imports))] = self.ref(foreign)
        self.edit_producer('actual_imported_runtime', imports)
        with self.assertRaises(m.r.SafeError): self.check()

    def test_runtime_import_recorded_sha_must_match_original_installed_bytes(self):
        imports = m.read(self.fixture['producer_path'])['actual_imported_runtime']; imports[next(iter(imports))]['sha256'] = 'f' * 64
        self.edit_producer('actual_imported_runtime', imports)
        with self.assertRaises(m.r.SafeError): self.check()

    def test_recognizer_raw_and_intent_bind_to_exact_s16le_waveform(self):
        for folder in ['asr-raw', 'local-asr-intents']:
            path = self.run / folder / (self.ids[0] + '.private.json'); original = m.read(path)
            for field, value in [('waveform_sha256', 'e' * 64), ('sample_count', 7), ('dtype', 'float64'),
                    ('input_kind', 'authored_Source_text')]:
                changed = copy.deepcopy(original); changed['actual_audio_input'][field] = value; save(path, changed)
                self.refresh_outer(update_output_hashes=True)
                with self.subTest(folder=folder, field=field), self.assertRaisesRegex(m.r.SafeError, 'waveform'): self.check()
            save(path, original); self.refresh_outer(update_output_hashes=True)

    def test_wrong_decoder_sourcekind_or_source32_adoption_has_no_approval_route(self):
        original = m.read(self.fixture['producer_path'])
        for field, value in [('operation_decoder', self.model['decoders']['align']),
                ('operation_source_kind', 'authored_timing_only'), ('source32_reuse_approved', True),
                ('human_listening_or_acting_or_voice_identity_approved', True)]:
            self.edit_producer(field, value)
            with self.subTest(field=field), self.assertRaises(m.r.SafeError): self.check()
            save(self.fixture['producer_path'], original); self.refresh_outer()

    def test_independent_review_never_projects_report_failures_or_listening_approval(self):
        original = m.read(self.fixture['review_path'])
        for field, value in [('retained_failures', [{'id': self.ids[0], 'invented': True}]),
                ('model_or_api_calls_by_reviewer', 1), ('human_listening_or_acting_approval', True),
                ('audio_reports_cues_or_historical_files_modified', True), ('source32_reuse_approved', True)]:
            review = copy.deepcopy(original); review[field] = value; save(self.fixture['review_path'], review)
            self.fixture['review'] = self.ref(self.fixture['review_path'])
            with self.subTest(field=field), self.assertRaises(m.r.SafeError): self.check()
        save(self.fixture['review_path'], original); self.fixture['review'] = self.ref(self.fixture['review_path'])

    def test_alignment_requires_whole_group_all_raw_intents_and_new_cues(self):
        self.fixture = self.historical_fixture(self.run, 'align', self.ids, self.model, self.helpers,
            m.body.VERSION, m.body.REVIEW_SHA, m.RUNTIME_REVIEW_SHA)
        self.assertEqual(self.check()[0]['actual_timing_ids'], self.ids)
        original = m.read(self.fixture['producer_path'])
        for change in ['subset_calls', 'missing_raw', 'missing_cue', 'wrong_timing_census']:
            producer = copy.deepcopy(original)
            if change == 'subset_calls': producer['actual_model_call_ids'] = self.ids[:-1]
            if change == 'missing_raw': producer['created_outputs_sha256'].pop('alignment-raw/' + self.ids[0] + '.private.json')
            if change == 'missing_cue': producer['created_outputs_sha256'].pop('word-cues/' + self.ids[0] + '.json')
            if change == 'wrong_timing_census': producer['actual_timing_ids'] = self.ids[:-1]
            save(self.fixture['producer_path'], producer); self.refresh_outer()
            with self.subTest(change=change), self.assertRaises(m.r.SafeError): self.check()
        save(self.fixture['producer_path'], original); self.refresh_outer()

    def archive_fixture(self):
        archive = write(self.root / 'historical-qualifier-tests.private.py', 'Original synthetic historical tests, never executed')
        archive_sha = m.digest(archive)
        old_helpers = {**self.helpers, 'second3_tests': archive_sha}
        current_helpers = {**self.helpers, 'second3_tests': archive_sha}
        self.run = self.root / 'retake-driver/archived-second3-group-01'
        self.fixture = self.historical_fixture(self.run, 'qa', self.ids, self.model, old_helpers,
            m.body.VERSION, m.body.REVIEW_SHA, m.RUNTIME_REVIEW_SHA)
        return archive, archive_sha, current_helpers

    def test_private_historical_test_archive_pins_original_helper_without_history_edits(self):
        archive, archive_sha, current_helpers = self.archive_fixture()
        before = m.base.file_map(self.run); current_before = copy.deepcopy(current_helpers)
        with patch.object(m, 'BODY_TEST_SHA', archive_sha), patch.object(m.body, 'helpers', side_effect=lambda: copy.deepcopy(current_helpers)):
            producer, _ = self.check(archive)
            self.assertEqual(producer['helpers_sha256']['second3_tests'], archive_sha)
            self.assertEqual(m.body.helpers()['second3_tests'], archive_sha)
        self.assertEqual(current_helpers, current_before); self.assertEqual(m.base.file_map(self.run), before)

    def test_missing_historical_archive_is_refused_without_rewriting_production_helpers(self):
        archive, archive_sha, current_helpers = self.archive_fixture()
        with patch.object(m, 'BODY_TEST_SHA', archive_sha), patch.object(m.body, 'helpers', side_effect=lambda: copy.deepcopy(current_helpers)):
            self.check(archive)
            archive.unlink()
            with self.assertRaises(m.r.SafeError): self.check(archive)

    def test_current_portable_test_hash_cannot_override_original_production_helpers(self):
        archive, archive_sha, current_helpers = self.archive_fixture()
        current_helpers['second3_tests'] = 'e' * 64
        with patch.object(m, 'BODY_TEST_SHA', archive_sha), patch.object(m.body, 'helpers', side_effect=lambda: copy.deepcopy(current_helpers)), \
                self.assertRaisesRegex(m.r.SafeError, 'immutable production helper'):
            self.check(archive)

    def test_changed_foreign_or_symlink_historical_tests_cannot_bind_old_producers(self):
        archive, archive_sha, current_helpers = self.archive_fixture()
        original = archive.read_bytes()
        outside = write(self.root.parent / (self.root.name + '-historical-outside.private.py'), original)
        self.addCleanup(outside.unlink)
        link = self.root / 'historical-test-link.private.py'; link.symlink_to(archive)
        with patch.object(m, 'BODY_TEST_SHA', archive_sha), patch.object(m.body, 'helpers', side_effect=lambda: copy.deepcopy(current_helpers)):
            self.check(archive)
            for path in [outside, link]:
                with self.subTest(path=path), self.assertRaises(m.r.SafeError): self.check(path)
            write(archive, 'Current replacement test bytes')
            with self.assertRaises(m.r.SafeError): self.check(archive)

    def test_historical_test_reader_cannot_waive_another_legacy_helper_hash(self):
        archive, archive_sha, current_helpers = self.archive_fixture()
        current_helpers['synthetic_fixture_helper'] = 'f' * 64
        with patch.object(m, 'BODY_TEST_SHA', archive_sha), patch.object(m.body, 'helpers', side_effect=lambda: copy.deepcopy(current_helpers)), \
                self.assertRaisesRegex(m.r.SafeError, 'completion linkage'):
            self.check(archive)

    def test_all_three_reuse_flags_must_be_explicitly_false_in_original_operation_evidence(self):
        for location in ['inputs_path', 'producer_path', 'completed_path', 'review_path']:
            path = self.fixture[location]; original = m.read(path)
            for flag in ['source32_reuse_approved', 'logge_reuse_approved', 'shared_take_reuse_approved']:
                for change in ['true', 'missing']:
                    changed = copy.deepcopy(original)
                    if change == 'true': changed[flag] = True
                    else: changed.pop(flag)
                    save(path, changed)
                    if location == 'review_path': self.fixture['review'] = self.ref(path)
                    else: self.refresh_outer()
                    with self.subTest(location=location, flag=flag, change=change), self.assertRaises(m.r.SafeError): self.check()
                    save(path, original)
                    if location == 'review_path': self.fixture['review'] = self.ref(path)
                    else: self.refresh_outer()

    def test_actual_second3_method_review_binding_cannot_be_missing_or_changed(self):
        original = m.read(self.fixture['review_path'])
        for change in ['missing', 'different']:
            review = copy.deepcopy(original)
            if change == 'missing': review.pop('actual_second3_method_review_sha256')
            else: review['actual_second3_method_review_sha256'] = 'f' * 64
            save(self.fixture['review_path'], review); self.fixture['review'] = self.ref(self.fixture['review_path'])
            with self.subTest(change=change), self.assertRaises(m.r.SafeError): self.check()

    def test_real_source_parent_cannot_be_relabelled_as_bad8_or25(self):
        original = m.read(self.fixture['producer_path'])
        for count in [8, 25, 3]:
            self.edit_producer('original_source_parent_count', count)
            with self.assertRaises(m.r.SafeError): self.check()
            save(self.fixture['producer_path'], original); self.refresh_outer()

    def test_prior_counterevidence_map_omission_refused_after_outer_rehash(self):
        self.edit_producer('original_prior_evidence_sha256', {'/synthetic-foreign': 'f'*64})
        with self.assertRaises(m.r.SafeError): self.check()

    def test_genuine_model_scope_cannot_be_fake8_or25(self):
        for field in ['source_case_count', 'unique_prepared_request_count']:
            original = m.read(self.fixture['producer_path']); self.edit_producer(field, 25)
            with self.assertRaises(m.r.SafeError): self.check()
            save(self.fixture['producer_path'], original); self.refresh_outer()

    def test_self_consistent_cache_hash_cannot_replace_actual_whole_response(self):
        cache = m.read(self.run/'qa-asr-cache.private.json'); cache[next(iter(cache))]['transcript'] = 'An unrelated current transcript'
        save(self.run/'qa-asr-cache.private.json',cache); self.refresh_outer(update_output_hashes=True)
        with self.assertRaisesRegex(m.r.SafeError, 'Whole original cache'): self.check()


class Anchor(TemporaryEvidence):
    def setUp(self):
        super().setUp()
        self.historical_tests = write(self.root / 'historical-qualifier-tests.private.py', 'Archived synthetic qualifier tests, never executed')
        self.historical_test_sha = m.digest(self.historical_tests)
        self.start(patch.object(m, 'BODY_TEST_SHA', self.historical_test_sha))
        self.specs = {}
        offset = 0
        for number, count in enumerate([3], 1):
            run = self.root / 'retake-driver' / ('second3-group-' + str(number).zfill(2))
            ids = ['part2-' + str(index).zfill(24) for index in range(offset + 1, offset + count + 1)]
            offset += count
            self.specs[str(run)] = {'selected_ids': ids, 'request_count': count}
        self.anchor = {'state': 'INDEPENDENT_ACTUAL_WHOLE_SECOND3_COMPLETED_EVIDENCE_UNAPPROVED',
            'qualifier_sha256': m.BODY_SHA, 'qualifier_tests_sha256': m.BODY_TEST_SHA,
            'actual_provider_review_sha256': m.PROVIDER_CENSUS_SHA, 'root_review_sha256': m.body.REVIEW_SHA,
            'source32_reuse_approved': False, 'logge_reuse_approved': False, 'shared_take_reuse_approved': False, 'human_listening_or_acting_approval': False, 'model_or_api_calls': 0,
            'operation_reviews': [{'run': run, 'command': command, 'review': self.ref(save(Path(run) / (command + '-review.private.json'),
                {'synthetic_fixture_only': True}))} for run in self.specs for command in ['qa', 'align']],
            'historical_qualifier_tests': self.ref(self.historical_tests), 'actual_request_count':3, 'source_case_count':3, 'original_source_parent_count':1401, 'retained_prior_failed_audio_count':8, 'strict_count':2, 'held_count':1, 'all_actual_selected_ids':ids, 'strict_word_signal_time_candidates_UNAPPROVED':ids[:2], 'held_ids':ids[2:],
            'synthetic_fixture_only': True}
        self.path = save(self.root / 'completed-evidence.private.json', self.anchor)
        self.args = argparse.Namespace(completed_evidence=self.path, completed_evidence_sha256=m.digest(self.path))
        self.start(patch.object(m.body, 'RUN', self.root), patch.object(m.body, 'specifications', return_value=self.specs), patch.object(m.body,'IDS',ids), patch.object(m,'ANCHOR_SHA',m.digest(self.path)))
        self.assertEqual(len(m.read_anchor(self.args, {})['operation_reviews']), 2)

    def set_anchor(self, value):
        save(self.path, value); self.args.completed_evidence_sha256 = m.digest(self.path)

    def test_exact_genuine_three_takes_and_two_completed_operations(self):
        value = m.read_anchor(self.args, {})
        self.assertEqual([entry['request_count'] for entry in self.specs.values()], [3])
        self.assertEqual(len({ident for entry in self.specs.values() for ident in entry['selected_ids']}), 3)
        self.assertEqual({(row['run'], row['command']) for row in value['operation_reviews']},
            {(run, command) for run in self.specs for command in ['qa', 'align']})

    def test_missing_repeated_foreign_or_extra_operation_cannot_be_anchored(self):
        for change in ['missing', 'repeated', 'foreign', 'extra', 'extra_key']:
            value = copy.deepcopy(self.anchor); rows = value['operation_reviews']
            if change == 'missing': rows.pop()
            if change == 'repeated': rows[-1] = copy.deepcopy(rows[0])
            if change == 'foreign': rows[-1]['run'] = str(self.root / 'retake-driver/second3-group-05')
            if change == 'extra': rows.append(copy.deepcopy(rows[0]))
            if change == 'extra_key': rows[-1]['allow_source32'] = True
            self.set_anchor(value)
            with self.subTest(change=change), self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})

    def test_wrong_qualifier_tests_provider_rootreview_or_unknown_state_is_refused(self):
        for field, value in [('qualifier_sha256', 'f' * 64), ('qualifier_tests_sha256', 'f' * 64),
                ('actual_provider_review_sha256', 'f' * 64), ('root_review_sha256', 'f' * 64), ('state', 'pending')]:
            changed = copy.deepcopy(self.anchor); changed[field] = value; self.set_anchor(changed)
            with self.subTest(field=field), self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})

    def test_anchor_never_claims_source32_or_listening_approval_or_modelcalls(self):
        for field, value in [('source32_reuse_approved', True), ('logge_reuse_approved', True), ('shared_take_reuse_approved', True),
                ('human_listening_or_acting_approval', True), ('model_or_api_calls', 1)]:
            changed = copy.deepcopy(self.anchor); changed[field] = value; self.set_anchor(changed)
            with self.subTest(field=field), self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})

    def test_anchor_requires_all_three_explicit_false_reuse_flags(self):
        for flag in ['source32_reuse_approved', 'logge_reuse_approved', 'shared_take_reuse_approved']:
            changed = copy.deepcopy(self.anchor); changed.pop(flag); self.set_anchor(changed)
            with self.subTest(flag=flag), self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})

    def test_anchor_is_exact_private_regular_bytes_and_cannot_be_rehashed_by_source(self):
        self.args.completed_evidence_sha256 = 'f' * 64
        with self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})
        outside = save(self.root.parent / (self.root.name + '-outside.private.json'), self.anchor)
        self.addCleanup(outside.unlink)
        self.args.completed_evidence = outside; self.args.completed_evidence_sha256 = m.digest(outside)
        with self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})
        link = self.root / 'anchor-link.private.json'; link.symlink_to(self.path)
        self.args.completed_evidence = link; self.args.completed_evidence_sha256 = m.digest(link)
        with self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})

    def test_anchor_requires_exact_private_historical_test_archive(self):
        bound = {}; value = m.read_anchor(self.args, bound)
        self.assertEqual(value['historical_qualifier_tests'], self.ref(self.historical_tests))
        self.assertEqual(bound[str(self.historical_tests)], self.historical_test_sha)
        for change in ['missing_ref', 'missing_sha', 'wrong_sha', 'extra_ref_key', 'missing_file']:
            changed = copy.deepcopy(self.anchor)
            if change == 'missing_ref': changed.pop('historical_qualifier_tests')
            if change == 'missing_sha': changed['historical_qualifier_tests'].pop('sha256')
            if change == 'wrong_sha': changed['historical_qualifier_tests']['sha256'] = 'f' * 64
            if change == 'extra_ref_key': changed['historical_qualifier_tests']['approve_current'] = True
            if change == 'missing_file': changed['historical_qualifier_tests']['path'] = str(self.root / 'missing-historical-tests.private.py')
            self.set_anchor(changed)
            with self.subTest(change=change), self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})

    def test_anchor_refuses_foreign_symlink_and_changed_historical_tests_even_after_outer_rehash(self):
        outside = write(self.root.parent / (self.root.name + '-archive-outside.private.py'), self.historical_tests.read_bytes())
        self.addCleanup(outside.unlink)
        link = self.root / 'historical-test-link.private.py'; link.symlink_to(self.historical_tests)
        for path in [outside, link]:
            changed = copy.deepcopy(self.anchor); changed['historical_qualifier_tests'] = self.ref(path); self.set_anchor(changed)
            with self.subTest(path=path), self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})
        write(self.historical_tests, 'Replacement current qualifier tests')
        changed = copy.deepcopy(self.anchor); changed['historical_qualifier_tests'] = self.ref(self.historical_tests); self.set_anchor(changed)
        with self.assertRaises(m.r.SafeError): m.read_anchor(self.args, {})


class Decoder(TemporaryEvidence):
    @unittest.skipIf(importlib.util.find_spec('numpy') is None, 'Use the existing transcribe Python for NumPy-only decoder tests')
    def test_real_signed16_float32_conversion_hash_and_original_ffmpeg_contract(self):
        path = write(self.root / 'synthetic.mp3', b'Pure fixture bytes, mocked decoder')
        decoder = {**m.body.DECODER_FORMATS['qa'], 'selected_path': '/existing/ffmpeg', 'resolved_path': '/existing/ffmpeg', 'sha256': 'f' * 64}
        pcm = struct.pack('<hhh', -32768, 0, 32767)
        with patch.object(m.subprocess, 'run', return_value=SimpleNamespace(stdout=pcm)) as transport:
            result = m.waveform(path, decoder)
        expected = struct.pack('<fff', -1.0, 0.0, 32767.0 / 32768.0)
        self.assertEqual(result['waveform_sha256'], hashlib.sha256(expected).hexdigest())
        self.assertEqual(result['sample_count'], 3); self.assertEqual(result['dtype'], 'float32')
        transport.assert_called_once_with(['/existing/ffmpeg', '-nostdin', '-i', str(path), '-threads', '0', '-f', 's16le',
            '-ac', '1', '-acodec', 'pcm_s16le', '-ar', '16000', '-'], capture_output=True, check=True)

    @unittest.skipIf(importlib.util.find_spec('numpy') is None, 'Use the existing transcribe Python for NumPy-only decoder tests')
    def test_f32_contract_empty_pcm_and_decoder_failures_are_not_waveform_proof(self):
        path = write(self.root / 'synthetic.mp3', b'Pure fixture bytes, mocked decoder')
        with patch.object(m.subprocess, 'run') as transport, self.assertRaises(m.r.SafeError):
            m.waveform(path, {**m.body.DECODER_FORMATS['align'], 'selected_path': '/existing/ffmpeg'})
        transport.assert_not_called()
        with patch.object(m.subprocess, 'run', return_value=SimpleNamespace(stdout=b'')), self.assertRaises(m.r.SafeError):
            m.waveform(path, {**m.body.DECODER_FORMATS['qa'], 'selected_path': '/existing/ffmpeg'})
        with patch.object(m.subprocess, 'run', side_effect=m.subprocess.CalledProcessError(1, 'synthetic')), self.assertRaises(m.subprocess.CalledProcessError):
            m.waveform(path, {**m.body.DECODER_FORMATS['qa'], 'selected_path': '/existing/ffmpeg'})


class Composition(TemporaryEvidence):
    def setUp(self):
        super().setUp()
        self.private = self.root / 'private'; self.private.mkdir()
        self.release = self.root / 'release'; self.release.mkdir()
        self.target = self.release / 'game/public/audio/teil-2'; self.target.mkdir(parents=True)
        self.ids = ['part2-' + str(index).zfill(24) for index in range(1, 27)]
        self.rows = {ident: {'id': ident, 'kind': 'say', 'speaker': 'lia', 'text': 'Synthetic line ' + str(index) + '.',
            'display_text': 'Synthetic line ' + str(index) + '.', 'runtime_keys': ['synthetic_' + str(index)]}
            for index, ident in enumerate(self.ids)}
        self.parent = {'lines': list(self.rows.values())}
        self.old = {'model': 'synthetic-model', 'aliases': {'lia': 'lia'}, 'scene_players': {'synthetic_scene': 'lia'},
            'clips': [], 'coverage': {'expected_sources': 26, 'published_sources': 3, 'retained_old_failure_count': 37,
                'human_listening_or_acting_approval': False, 'missing_sources': [{'id': ident, 'reasons': ['Original synthetic held reason']}
                    for ident in self.ids[3:]], 'status': 'partial'}}
        for ident in self.ids[:3]:
            path = write(self.target / (ident + '.mp3'), b'Original approved fixture ' + ident.encode())
            self.old['clips'].append(self.clip(ident, path, [{'start': .05, 'end': .45}]))
        save(self.target / 'manifest.json', self.old)
        self.preserved = {}
        for name in ['prolog', 'story']:
            path = self.target.parent / name; write(path / 'manifest.json', 'Synthetic preserved ' + name)
            write(path / 'old.mp3', b'Preserved ' + name.encode()); self.preserved[str(path)] = m.base.file_map(path)
        self.evidence = write(self.private / 'original-provider.private.json', 'Protected synthetic provider evidence')
        self.candidates = {}
        for ident in [self.ids[0], self.ids[3], self.ids[4]]:
            path = write(self.private / 'clips' / (ident + '.mp3'), b'New actual fixture ' + ident.encode())
            self.candidates[ident] = self.clip(ident, path, [{'start': .1, 'end': .4}]), path
        self.held = {ident: {'status': 'held_no_waiver_route', 'original_word_reasons': ['Original lexical mismatch'],
            'original_timing_failures': []} for ident in self.ids[5:25]}
        self.binding = {'version': m.VERSION, 'target_root': str(self.release),
            'baseline_manifest_sha256': m.digest(self.target / 'manifest.json'), 'baseline_files_sha256': m.base.file_map(self.target),
            'synthetic_fixture_only': True}
        self.args = argparse.Namespace(target_root=self.release, output_dir=self.private / 'proposal',
            selection=self.private / 'selection.approved.private.json', coverage_report=self.private / 'coverage.private.json')
        self.start(patch.object(m.body, 'RUN', self.private), patch.object(m, 'context', side_effect=self.context))

    def clip(self, ident, path, word_cues):
        return {**copy.deepcopy(self.rows[ident]), 'voice': 'Synthetic voice', 'audio': 'audio/teil-2/' + ident + '.mp3',
            'sha256': m.digest(path), 'seconds': .5, 'word_cues': word_cues}

    def context(self, *_args):
        bound = {str(self.evidence): m.digest(self.evidence)}
        bound.update({str(self.target / (clip['id'] + '.mp3')): clip['sha256'] for clip in self.old['clips']})
        return copy.deepcopy({ident: self.rows[ident] for ident in self.ids[:25]}), copy.deepcopy(self.candidates), copy.deepcopy(self.held), \
            copy.deepcopy(self.old), copy.deepcopy(self.preserved), bound, copy.deepcopy(self.binding), copy.deepcopy(self.parent)

    def approve(self, chosen=None):
        chosen = [self.ids[0], self.ids[3]] if chosen is None else chosen
        m.propose(self.args)
        selection = m.read(self.args.output_dir / 'selection.UNAPPROVED.private.json')
        selection.update(status='approved_part2_second3_selection', reviewed_by='root',
            actual_whole_word_signal_and_newaudio_timing_reviewed=True, selected_retake_ids=chosen)
        for ident in chosen:
            case = m.read(self.args.output_dir / (ident + '.UNAPPROVED.private.json'))
            case.update(status='approved_part2_second3_case', reviewed_by='root',
                actual_whole_word_signal_and_newaudio_timing_reviewed=True,
                review_note='Synthetic fixture only. This is no actual audio or human approval.')
            path = save(self.private / (ident + '.approved.private.json'), case)
            selection['case_approvals'].append(self.ref(path))
        save(self.args.selection, selection)
        return selection

    def test_propose_is_unapproved_and_changes_no_public_or_original_evidence(self):
        before = m.base.file_map(self.target); evidence = self.evidence.read_bytes()
        candidates, held = m.propose(self.args)
        self.assertEqual(set(candidates), set(self.candidates)); self.assertEqual(held, self.held)
        selection = m.read(self.args.output_dir / 'selection.UNAPPROVED.private.json')
        self.assertIsNone(selection['reviewed_by']); self.assertEqual(selection['selected_retake_ids'], [])
        self.assertFalse(selection['actual_whole_word_signal_and_newaudio_timing_reviewed'])
        proposal = m.read(self.args.output_dir / 'proposal.private.json')
        self.assertFalse(proposal['source32_reuse_approved']); self.assertFalse(proposal['word_time_or_human_approved'])
        self.assertFalse(proposal['logge_reuse_approved']); self.assertFalse(proposal['shared_take_reuse_approved'])
        self.assertEqual(m.base.file_map(self.target), before); self.assertEqual(self.evidence.read_bytes(), evidence)
        self.assertFalse((self.args.output_dir / (self.ids[-1] + '.UNAPPROVED.private.json')).exists())
        with self.assertRaises(m.r.SafeError): m.propose(self.args)

    def test_selective_composition_preserves_unselected_cues_cast_routes_and_failures(self):
        selection = self.approve(); public, paths, preserved, bound, transition = m.build(self.args, selection)
        clips = {clip['id']: clip for clip in public['clips']}
        self.assertEqual(clips[self.ids[1]], self.old['clips'][1]); self.assertEqual(clips[self.ids[2]], self.old['clips'][2])
        self.assertEqual(clips[self.ids[0]]['word_cues'], [{'start': .1, 'end': .4}])
        self.assertEqual(paths[self.ids[0]], self.candidates[self.ids[0]][1])
        self.assertNotIn(str(self.target / (self.ids[0] + '.mp3')), bound)
        self.assertIn(str(self.target / (self.ids[1] + '.mp3')), bound)
        self.assertEqual(public['aliases'], self.old['aliases']); self.assertEqual(public['scene_players'], self.old['scene_players'])
        self.assertEqual(public['coverage']['retained_old_failure_count'], 37)
        self.assertEqual(public['coverage']['second3_complete_baseline_sources'], 3)
        self.assertEqual(public['coverage']['second3_added_sources'], 1); self.assertEqual(public['coverage']['second3_replaced_sources'], 1)
        self.assertFalse(public['coverage']['source32_reuse_approved'])
        self.assertFalse(public['coverage']['logge_reuse_approved']); self.assertFalse(public['coverage']['shared_take_reuse_approved'])
        self.assertEqual(public['coverage']['second3_actual_whole_completed_sources'], 3)
        self.assertIn(self.ids[-1], {item['id'] for item in public['coverage']['missing_sources']})
        self.assertEqual(preserved, self.preserved); m.base.existing(self.target, transition, public); m.base.stable(bound, preserved)

    def test_unapproved_global_claim_or_nonroot_selection_is_refused(self):
        m.propose(self.args); selection = m.read(self.args.output_dir / 'selection.UNAPPROVED.private.json')
        with self.assertRaises(m.r.SafeError): m.build(self.args, selection)
        selection = self.approve_without_propose(selection)
        for field, value in [('reviewed_by', 'model'), ('human_listening_or_acting_approval', True),
                ('actual_whole_word_signal_and_newaudio_timing_reviewed', False), ('all25_approved', True)]:
            changed = copy.deepcopy(selection); changed[field] = value
            with self.subTest(field=field), self.assertRaises(m.r.SafeError): m.build(self.args, changed)

    def approve_without_propose(self, selection):
        selection.update(status='approved_part2_second3_selection', reviewed_by='root',
            actual_whole_word_signal_and_newaudio_timing_reviewed=True, selected_retake_ids=[self.ids[3]])
        case = m.read(self.args.output_dir / (self.ids[3] + '.UNAPPROVED.private.json'))
        case.update(status='approved_part2_second3_case', reviewed_by='root', actual_whole_word_signal_and_newaudio_timing_reviewed=True,
            review_note='Synthetic test only; no actual quality approval.')
        path = save(self.private / 'individual-approved.private.json', case)
        selection['case_approvals'] = [self.ref(path)]; save(self.args.selection, selection)
        return selection

    def test_held_source32_unknown_duplicate_and_missing_case_are_refused(self):
        selection = self.approve()
        for change in ['held', 'source32', 'unknown', 'duplicate', 'missing']:
            changed = copy.deepcopy(selection)
            if change == 'held': changed['selected_retake_ids'] = [self.ids[5]]
            if change == 'source32': changed['selected_retake_ids'] = [self.ids[-1]]
            if change == 'unknown': changed['selected_retake_ids'] = ['part2-' + 'f' * 24]
            if change == 'duplicate': changed['case_approvals'][-1] = changed['case_approvals'][0]
            if change == 'missing': changed['case_approvals'].pop()
            with self.subTest(change=change), self.assertRaises(m.r.SafeError): m.build(self.args, changed)

    def test_individual_cases_cannot_rewrite_source_cast_prior_clip_audio_or_cues(self):
        selection = self.approve(); path = Path(selection['case_approvals'][0]['path']); original = m.read(path)
        for change in ['source', 'cast', 'cue', 'runtime', 'prior', 'human', 'root', 'note']:
            case = copy.deepcopy(original)
            if change == 'source': case['actual_new_clip']['text'] = 'Different Source'
            if change == 'cast': case['actual_new_clip']['voice'] = 'Different voice'
            if change == 'cue': case['actual_new_clip']['word_cues'][0]['start'] = 0
            if change == 'runtime': case['actual_new_clip']['runtime_keys'] = ['different_runtime']
            if change == 'prior': case['prior_public_clip']['sha256'] = 'f' * 64
            if change == 'human': case['human_listening_or_acting_approval'] = True
            if change == 'root': case['reviewed_by'] = 'model'
            if change == 'note': case['review_note'] = ''
            save(path, case); changed = copy.deepcopy(selection); changed['case_approvals'][0] = self.ref(path)
            with self.subTest(change=change), self.assertRaises(m.r.SafeError): m.build(self.args, changed)
        save(path, original)

    def test_changed_baseline_binding_snapshot_or_audio_does_not_get_reapproved(self):
        selection = self.approve(); changed = copy.deepcopy(selection); changed['binding']['baseline_manifest_sha256'] = 'f' * 64
        with self.assertRaises(m.r.SafeError): m.build(self.args, changed)
        snapshot = Path(selection['baseline_snapshot']['path']); original = snapshot.read_bytes(); write(snapshot, '{}')
        with self.assertRaises(m.r.SafeError): m.build(self.args, selection)
        snapshot.write_bytes(original)
        path = self.target / (self.ids[1] + '.mp3'); write(path, 'Concurrent unrelated audio edit')
        with self.assertRaises(m.r.SafeError): m.build(self.args, selection)
        self.assertEqual(path.read_text(), 'Concurrent unrelated audio edit')

    def test_real_temp_transaction_preserves_original_evidence_and_other_banks(self):
        selection = self.approve(); before = m.base.file_map(self.private); untouched = (self.target / (self.ids[1] + '.mp3')).read_bytes()
        public, paths, preserved, bound, transition = m.build(self.args, selection)
        m.base.apply(self.target, transition, public, paths, preserved, bound)
        self.assertEqual(m.read(self.target / 'manifest.json'), public)
        self.assertEqual((self.target / (self.ids[1] + '.mp3')).read_bytes(), untouched)
        self.assertEqual(m.base.file_map(self.private), before)
        self.assertEqual({name: m.base.file_map(Path(name)) for name in preserved}, preserved)
        self.assertEqual(set(m.base.file_map(self.target)), {'manifest.json', *(ident + '.mp3' for ident in [*self.ids[:3], self.ids[3]])})

    def test_finalize_failure_restores_original_bank_without_touching_raw_evidence(self):
        selection = self.approve(); before = m.base.file_map(self.target); evidence = m.base.file_map(self.private)
        public, paths, preserved, bound, transition = m.build(self.args, selection)
        def fail(): raise RuntimeError('Synthetic transaction finalization failure')
        with self.assertRaises(RuntimeError): m.base.apply(self.target, transition, public, paths, preserved, bound, finalize=fail)
        self.assertEqual(m.base.file_map(self.target), before); self.assertEqual(m.base.file_map(self.private), evidence)

    def test_unknown_public_file_and_concurrent_staged_input_remain_protected(self):
        selection = self.approve(); public, paths, preserved, bound, transition = m.build(self.args, selection)
        foreign = write(self.target / 'foreign.txt', 'Foreign file to preserve')
        with self.assertRaises(m.r.SafeError): m.base.apply(self.target, transition, public, paths, preserved, bound)
        self.assertEqual(foreign.read_text(), 'Foreign file to preserve')
        foreign.unlink(); write(paths[self.ids[3]], 'Changed candidate after individual review')
        before = m.base.file_map(self.target)
        with self.assertRaises(m.r.SafeError): m.base.apply(self.target, transition, public, paths, preserved, bound)
        self.assertEqual(m.base.file_map(self.target), before)

    def test_cli_exposes_no_credentials_models_or_generic_waivers(self):
        fields = {action.dest for action in m.parser()._actions}
        self.assertTrue({'completed_evidence', 'completed_evidence_sha256', 'adapter_sha256'} <= fields)
        for field in ['api_key', 'key_stdin', 'model_dir', 'adjudications', 'only_ids', 'allow_name_exception', 'source32', 'logge_reuse', 'shared_take', 'future25']:
            self.assertNotIn(field, fields)



class ArchivedActual25Metadata(TemporaryEvidence):
    def setUp(self):
        super().setUp()
        self.target = self.root/'release'; self.args = argparse.Namespace(target_root=self.target)
        self.snapshot = save(self.root/'original1102.private.json',{'clips':[],'coverage':{},'synthetic_fixture_only':True})
        self.selection = {'baseline_snapshot':self.ref(self.snapshot),'binding':{
            'baseline_manifest_sha256':m.digest(self.snapshot),'baseline_files_sha256':{'manifest.json':m.digest(self.snapshot)}}}
        self.binding = {'baseline_manifest_sha256':'actual-current1107-byte-identity',
            'baseline_files_sha256':{'manifest.json':'current1107-complete-map'},
            'helpers_sha256':{'actual25_tests':'unmodified-original84a'},
            'actual_model_sha256':'unmodified-original-Turbo-model',
            'qualifier_sha256':'unmodified-7f60', 'actual_source_case_count':25}
        self.original_context = Mock(return_value=({}, {}, {}, {}, {}, {}, copy.deepcopy(self.binding), {}))
        self.start(patch.object(m.body,'RUN',self.root),patch.object(m.prior,'context',self.original_context))

    def test_true_archive_scopes_only_exact_original_baseline_metadata(self):
        old_replay,old_context=m.prior.replay_baseline,m.prior.context
        with m.archived_prior_reader(self.args,self.selection):
            got=m.prior.context(self.args)[6]
            expected=copy.deepcopy(self.binding)
            expected['baseline_manifest_sha256']=self.selection['binding']['baseline_manifest_sha256']
            expected['baseline_files_sha256']=self.selection['binding']['baseline_files_sha256']
            self.assertEqual(got,expected)
            self.assertEqual(got['helpers_sha256'],self.binding['helpers_sha256'])
            self.assertEqual(got['actual_source_case_count'],25)
            self.assertIsNot(m.prior.replay_baseline,old_replay)
        self.assertIs(m.prior.replay_baseline,old_replay);self.assertIs(m.prior.context,old_context)

    def test_frozen_ancestor_functions_restore_on_any_nested_failure(self):
        old_replay,old_context=m.prior.replay_baseline,m.prior.context
        with self.assertRaises(RuntimeError):
            with m.archived_prior_reader(self.args,self.selection):
                raise RuntimeError('Synthetic nested reader failure')
        self.assertIs(m.prior.replay_baseline,old_replay);self.assertIs(m.prior.context,old_context)

    def test_archive_byte_identity_cannot_be_a_fresh_label(self):
        self.selection['binding']['baseline_manifest_sha256']='f'*64
        with self.assertRaises(m.r.SafeError):
            with m.archived_prior_reader(self.args,self.selection): pass


class OriginalWeightAlias(TemporaryEvidence):
    def setUp(self):
        super().setUp()
        self.target = write(self.root/'model.safetensors', b'Synthetic unexecuted model bytes')
        self.alias = self.root/'weights.safetensors'; self.alias.symlink_to(self.target)
        self.sha = m.digest(self.target)
        self.model = {'weights': {'weights.safetensors': self.sha}, 'loader_aliases': {'weights.safetensors': {
            'lexical_path': str(self.alias), 'resolved_path': str(self.target), 'is_symlink': True, 'sha256': self.sha}}}
        self.start(patch.object(m.body, 'loader_guard'))

    def test_actual_declared_alias_pins_same_regular_weight_bytes_without_masking_original_map(self):
        values = {str(self.alias): self.sha}; before = copy.deepcopy(values); bound = {}
        m.pin_prior_files(values, bound, self.model)
        self.assertEqual(values, before)
        self.assertEqual(bound, {str(self.target): self.sha})
        m.body.loader_guard.assert_called_once_with(self.model)

    def test_other_source_or_audio_symlinks_are_not_weight_aliases(self):
        other = self.root/'source.private.json'; other.symlink_to(self.target)
        with self.assertRaises(m.r.SafeError): m.pin_prior_files({str(other): self.sha}, {}, self.model)

    def test_same_byte_alias_retarget_is_not_the_original_loader_identity(self):
        replacement = write(self.root/'other-model.safetensors', self.target.read_bytes())
        self.alias.unlink(); self.alias.symlink_to(replacement)
        with self.assertRaises(m.r.SafeError): m.pin_prior_files({str(self.alias): self.sha}, {}, self.model)

    def test_weight_sha_and_alias_binding_must_be_equal_to_original_model_metadata(self):
        with self.assertRaises(m.r.SafeError): m.pin_prior_files({str(self.alias): 'f'*64}, {}, self.model)


if __name__ == '__main__': unittest.main()
