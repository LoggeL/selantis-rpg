#!/usr/bin/env python3
"""Offline evidence fixtures. No acoustic models, inference or credentials."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import story_voice_ctc_lexical_variants as variants
import story_voice_qa as qa


class CTCLexicalVariants(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.run = self.root/'output/audio/story-voice/test'
        (self.run/'clips').mkdir(parents=True)
        (self.root/'scripts').mkdir()
        (self.root/'scripts/story_voice_ctc_align.py').write_text('offline synthetic CTC driver')
        self.private = patch.object(qa, 'PRIVATE', self.root/'output/audio/story-voice')
        self.repo = patch.object(qa, 'ROOT', self.root)
        self.private.start(); self.repo.start()
        self.ident = 'story-'+'a'*24
        self.clip = self.run/'clips'/(self.ident+'.mp3')
        self.clip.write_bytes(b'offline synthetic audio receipt')
        self.audio_hash = qa.digest(self.clip)
        self.line = {'id': self.ident, 'text': 'Seit Dunkelhain traut sich keiner allein raus.'}

    def tearDown(self):
        self.repo.stop(); self.private.stop(); self.temp.cleanup()

    def fixture(self, source=None, transcript='seit dunkelhein traut sich keiner alleinraus'):
        if source is not None:
            self.line['text'] = source
        manifest = self.run/'lines.private.json'
        qa.save(manifest, {'lines': [self.line]})
        self.manifest_hash = qa.digest(manifest)
        self.model_dir = self.run/'synthetic-model'
        self.model_dir.mkdir(exist_ok=True)
        alphabet = sorted(set(transcript.replace(' ', '|')))
        vocab = {'<pad>': 0, **{label: i+1 for i, label in enumerate(alphabet)}}
        qa.save(self.model_dir/'vocab.json', vocab)
        qa.save(self.model_dir/'config.json', {'pad_token_id': 0})
        qa.save(self.model_dir/'preprocessor_config.json', {})
        (self.model_dir/'pytorch_model.bin').write_bytes(b'synthetic weight binding, not a usable model')
        hashes = {name: qa.digest(self.model_dir/name) for name in
                  ('config.json', 'vocab.json', 'preprocessor_config.json', 'pytorch_model.bin')}
        model = {'model_id': qa.CTC_MODEL_ID, 'revision': qa.CTC_REVISION,
                 'local_directory': str(self.model_dir), 'file_sha256': hashes,
                 'fingerprint': qa.text_hash(json.dumps(hashes, sort_keys=True))}
        collapsed = [vocab[char] for char in transcript.replace(' ', '|')]
        ids = [0]
        for token in collapsed:
            ids.extend([token, token, 0])
        probabilities = [.9]*len(ids)
        receipt = {'id': self.ident, 'text': self.line['text'],
                   'binding': {'audio_sha256': self.audio_hash,
                               'text_sha256': qa.text_hash(self.line['text']),
                               'source_manifest_sha256': self.manifest_hash,
                               'engine': qa.CTC_ENGINE, 'model': model,
                               'script_sha256': qa.digest(self.root/'scripts/story_voice_ctc_align.py')},
                   'greedy_decode': {'method': qa.CTC_METHOD, 'authored_initial_prompt': None,
                                     'unknown_tokens': [], 'argmax_token_ids': ids,
                                     'argmax_token_probabilities': probabilities,
                                     'argmax_token_ids_sha256': qa.text_hash(json.dumps(ids, separators=(',', ':'))),
                                     'frame_evidence_sha256': qa.text_hash(json.dumps(
                                         {'argmax_token_ids': ids, 'argmax_token_probabilities': probabilities},
                                         sort_keys=True, separators=(',', ':'))),
                                     'blank_token_id': 0, 'collapsed_token_ids': collapsed,
                                     'token_id_to_label': {str(index): label for label, index in vocab.items()},
                                     'transcript': transcript},
                   'alignment': {'words': ['authored forced alignment is not read']}}
        self.receipt_path = self.run/(self.ident+'.ctc.private.json')
        qa.save(self.receipt_path, receipt)
        self.report_path = self.run/'input-ctc.private.json'
        qa.save(self.report_path, {'model': model, 'engine': qa.CTC_ENGINE, 'receipt_directory': str(self.run),
                                  'results': [{'id': self.ident, 'approval': None,
                                               'receipt_file': self.receipt_path.name,
                                               'receipt_sha256': qa.digest(self.receipt_path)}]})
        return variants.load_records(self.report_path, self.run/'variants')

    def approval(self, records):
        proposal = variants.proposal(self.line, self.audio_hash, self.manifest_hash, records[self.ident])
        self.assertEqual(proposal['status'], 'root_review_required')
        approval = copy.deepcopy(proposal['approval_template'])
        approval.update(status=variants.STATUS, reviewed_by='root offline fixture',
                        reason='Explicitly reviewed the source and observed name positions and exact remaining concatenated words.')
        return approval

    def review(self, records, approval):
        return variants.review(self.line, self.audio_hash, self.manifest_hash, records, {self.ident: approval})

    def test_named_spelling_plus_segmentation_retains_raw(self):
        records = self.fixture()
        before = self.receipt_path.read_bytes()
        approval = self.approval(records)
        proof = self.review(records, approval)
        self.assertIsNotNone(proof)
        self.assertEqual(proof['transcript'], 'seit dunkelhein traut sich keiner alleinraus')
        self.assertEqual(proof['named_spelling_variants'], [
            {'expected_index': 1, 'observed_index': 1, 'expected': 'dunkelhain', 'observed': 'dunkelhein'}])
        self.assertTrue(proof['accept_word_segmentation'])
        self.assertIsNone(proof['listening_verdict'])
        self.assertEqual(self.receipt_path.read_bytes(), before)
        self.assertIsNone(json.loads(self.report_path.read_text())['results'][0]['approval'])

    def test_pure_segmentation(self):
        records = self.fixture('Du bist immer noch allein.', 'du bist immernoch allein')
        approval = self.approval(records)
        self.assertEqual(approval['named_spelling_variants'], [])
        self.assertIsNotNone(self.review(records, approval))

    def test_only_complete_position_bound_names(self):
        records = self.fixture('Kyra und Crios warten.', 'kira und krios warten')
        approval = self.approval(records)
        self.assertEqual(len(approval['named_spelling_variants']), 2)
        self.assertIsNotNone(self.review(records, approval))
        approval['named_spelling_variants'][0]['expected_index'] = 2
        self.assertIsNone(self.review(records, approval))

    def test_each_repeated_name_occurrence_requires_exact_pair(self):
        records = self.fixture('Kyra ruft Kyra.', 'kira ruft kira')
        approval = self.approval(records)
        self.assertEqual([pair['expected_index'] for pair in approval['named_spelling_variants']], [0, 2])
        approval['named_spelling_variants'].pop()
        self.assertIsNone(self.review(records, approval))

    def test_omissions_extras_changed_words_and_contractions_fail(self):
        for source, transcript in [
                ('Lia wartet.', 'lea wartet'), ('Dunkelhain wartet.', 'dunkelheit wartet'),
                ('Seit Dunkelhain traut sich keiner allein raus.', 'seit dunkelhein traut keiner alleinraus'),
                ('Kyra wartet.', 'kira wartet bitte'), ('Ich habe es.', 'ich hab es'),
                ('Ich nehme es.', 'ich nehms'), ('Foltan wartet.', 'foltern wartet'),
                ('Vamir wartet.', 'vamer wartet'), ('Kyra wartet.', 'kira warten')]:
            with self.subTest(source=source, transcript=transcript):
                records = self.fixture(source, transcript)
                self.assertEqual(variants.proposal(self.line, self.audio_hash, self.manifest_hash,
                                                   records[self.ident])['status'], 'rejected')

    def test_changed_name_inside_joined_word_is_refused(self):
        records = self.fixture('Kyra wartet.', 'kirawartet')
        self.assertIsNone(variants.lexical_comparison(self.line['text'], records[self.ident]['receipt']['greedy_decode']['transcript']))

    def test_lowercase_common_word_is_not_proposed_as_name(self):
        self.assertIsNone(variants.lexical_comparison('ich war da', 'ych war da'))

    def test_exact_words_use_existing_exact_CTC_path(self):
        records = self.fixture('Kyra wartet.', 'kyra wartet')
        self.assertEqual(variants.proposal(self.line, self.audio_hash, self.manifest_hash,
                                           records[self.ident])['status'], 'rejected')

    def test_all_root_bindings_status_and_reviewer_required(self):
        records = self.fixture()
        approval = self.approval(records)
        for field in ['id', 'channel', 'clip_sha256', 'text_sha256', 'source_manifest_sha256',
                      'receipt_sha256', 'transcript_sha256', 'frame_evidence_sha256',
                      'ctc_script_sha256', 'qa_script_sha256', 'variant_script_sha256', 'model_fingerprint']:
            bad = copy.deepcopy(approval); bad[field] = 'wrong'
            self.assertIsNone(self.review(records, bad), field)
        for field, value in [('status', 'proposal_not_approved'), ('reviewed_by', 'automatic agent'),
                             ('reason', ''), ('listening_verdict', 'sounds good'), ('accept_word_segmentation', 1)]:
            bad = copy.deepcopy(approval); bad[field] = value
            self.assertIsNone(self.review(records, bad), field)
        bad = copy.deepcopy(approval); bad['named_spelling_variants'][0]['observed_index'] = 1.0
        self.assertIsNone(self.review(records, bad))
        self.assertIsNone(variants.review(self.line, self.audio_hash, self.manifest_hash, records, {}))

    def test_current_audio_manifest_and_authored_text_required(self):
        records = self.fixture(); approval = self.approval(records)
        self.assertIsNone(variants.review(self.line, '0'*64, self.manifest_hash, records, {self.ident: approval}))
        self.assertIsNone(variants.review(self.line, self.audio_hash, '0'*64, records, {self.ident: approval}))
        changed = dict(self.line, text='Seit Dunkelhain traut keiner allein raus.')
        self.assertIsNone(variants.review(changed, self.audio_hash, self.manifest_hash, records, {self.ident: approval}))

    def test_raw_receipt_mutation_is_rejected(self):
        records = self.fixture(); approval = self.approval(records)
        receipt = json.loads(self.receipt_path.read_text())
        receipt['greedy_decode']['transcript'] = 'invented'
        qa.save(self.receipt_path, receipt)
        self.assertIsNone(self.review(records, approval))
        with self.assertRaisesRegex(ValueError, 'changed_ctc_receipt'):
            variants.load_records(self.report_path, self.run/'variants')

    def test_guard_rejections_without_relying_on_receipt_mismatch(self):
        changes = [lambda r: r['binding'].update(engine='forced'),
                   lambda r: r['binding']['model'].update(revision='0'*40),
                   lambda r: r['binding']['model'].update(fingerprint='0'*64),
                   lambda r: r['binding'].update(script_sha256='0'*64),
                   lambda r: r['greedy_decode'].update(method='forced_authored_alignment'),
                   lambda r: r['greedy_decode'].update(authored_initial_prompt='Seit Dunkelhain'),
                   lambda r: r['greedy_decode'].update(unknown_tokens=['?']),
                   lambda r: r['greedy_decode'].update(argmax_token_ids=[0, 1]),
                   lambda r: r['greedy_decode'].update(argmax_token_probabilities=[True]),
                   lambda r: r['greedy_decode'].update(blank_token_id=True),
                   lambda r: r['greedy_decode'].update(frame_evidence_sha256='0'*64),
                   lambda r: r['greedy_decode'].update(token_id_to_label={'1': 'x'}),
                   lambda r: r['greedy_decode'].update(collapsed_token_ids=[]),
                   lambda r: r['greedy_decode'].update(transcript='authored forged transcript')]
        for change in changes:
            records = self.fixture()
            envelope = records[self.ident]
            change(envelope['receipt'])
            qa.save(self.receipt_path, envelope['receipt'])
            envelope['receipt_sha256'] = qa.digest(self.receipt_path)
            self.assertIsNone(variants.validated_greedy(self.line, self.audio_hash, self.manifest_hash, envelope))

    def test_actual_model_files_and_driver_hash_checked(self):
        records = self.fixture(); approval = self.approval(records)
        (self.root/'scripts/story_voice_ctc_align.py').write_text('changed driver')
        self.assertIsNone(self.review(records, approval))
        records = self.fixture()
        approval = self.approval(records)
        (self.model_dir/'pytorch_model.bin').write_bytes(b'changed actual weights')
        self.assertIsNone(self.review(records, approval))
        with self.assertRaisesRegex(ValueError, 'ctc_model_file_changed'):
            variants.load_records(self.report_path, self.run/'variants')

    def test_forced_alignment_changes_cannot_create_evidence(self):
        records = self.fixture()
        envelope = records[self.ident]
        envelope['receipt'].pop('alignment')
        qa.save(self.receipt_path, envelope['receipt']); envelope['receipt_sha256'] = qa.digest(self.receipt_path)
        approval = self.approval(records)
        self.assertIsNotNone(self.review(records, approval))

    def test_explicit_ineligible_row_has_no_receipt_to_load(self):
        self.fixture()
        report = json.loads(self.report_path.read_text())
        other = 'story-'+'b'*24
        report['results'].append({'id': other, 'status': 'ineligible_QA', 'approval': None})
        qa.save(self.report_path, report)
        self.assertEqual(set(variants.load_records(self.report_path, self.run/'variants')), {self.ident})
        report['results'].append({'id': other, 'status': 'ineligible_QA', 'approval': None})
        qa.save(self.report_path, report)
        with self.assertRaisesRegex(ValueError, 'invalid_ctc_result_ids'):
            variants.load_records(self.report_path, self.run/'variants')


if __name__ == '__main__':
    unittest.main()
