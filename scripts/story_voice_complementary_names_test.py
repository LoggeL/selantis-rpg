#!/usr/bin/env python3
"""Offline raw Pro/Flash/CTC fixtures. No inference, accounts or network."""
import copy
from contextlib import redirect_stdout
import io
import json
import math
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import story_voice_complementary_names as names

qa, pro, lexical = names.qa, names.pro, names.lexical


class ComplementaryNames(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.run = self.root/'output/audio/story-voice/test'
        self.run.mkdir(parents=True)
        (self.root/'scripts').mkdir()
        (self.root/'scripts/story_voice_ctc_align.py').write_text('offline fixture frozen CTC driver')
        for attr, value in [('ROOT', self.root), ('PRIVATE', self.root/'output/audio/story-voice')]:
            p = patch.object(qa, attr, value); p.start(); self.addCleanup(p.stop)
        # The original producer freeze has its own gates. These fixtures exercise
        # actual independent raw request/response/cache/CTC validators afterwards.
        p = patch.object(names.common, 'prepared', return_value={}); p.start(); self.addCleanup(p.stop)
        p = patch.object(names.core, 'api', side_effect=AssertionError('No network allowed'))
        p.start(); self.addCleanup(p.stop)
        self.capture = redirect_stdout(io.StringIO()); self.capture.__enter__()
        self.addCleanup(self.capture.__exit__, None, None, None)
        self.ids = list(names.CASES)
        self.rows = {ident: {'id': ident, 'text': case['text'], 'speaker': 'foltan',
                            'kind': 'say', 'scene': 'fixture', 'mood': 'neutral', 'direction_en': 'Clear.'}
                     for ident, case in names.CASES.items()}
        for folder in ['clips', 'raw', 'independent-google-asr']:
            (self.run/folder).mkdir()
        for ident in self.ids:
            audio, wav = ('synthetic-MP3-'+ident).encode(), ('synthetic-WAV-'+ident).encode()
            (self.run/'clips'/(ident+'.mp3')).write_bytes(audio)
            (self.run/'raw'/(ident+'.wav')).write_bytes(wav)
            qa.save(self.run/'raw'/(ident+'.receipt.json'), {'id': ident, 'status': 'complete', 'backend': 'batch',
                    'mp3_sha256': qa.digest(self.run/'clips'/(ident+'.mp3')),
                    'wav_sha256': qa.digest(self.run/'raw'/(ident+'.wav'))})
        qa.save(self.run/'prepared.json', {'model': pro.transport.TTS_MODEL})
        qa.save(self.run/'lines.private.json', {'lines': list(self.rows.values())})
        self.manifest_sha = qa.digest(self.run/'lines.private.json')
        self.qa_path, self.veto_path = self.run/'qa.private.json', self.run/'veto.private.json'
        qa.save(self.veto_path, {'records': []})
        self.flash_records = {}
        for ident in self.ids:
            line, case = self.rows[ident], names.CASES[ident]
            observed = qa.words(line['text']); observed[case['word_index']] = case['flash_observed']
            transcript = ' '.join(observed)
            sha = qa.digest(self.run/'clips'/(ident+'.mp3'))
            record = {'id': ident, 'clip_sha256': sha, 'source_audio_sha256': sha, 'upload_sha256': sha,
                      'source_text_sha256': qa.text_hash(line['text']), 'input_mime_type': 'audio/mpeg',
                      'model': names.flash.MODEL, 'prompt': names.flash.PROMPT, 'transcript': transcript,
                      'response': {'modelVersion': names.flash.MODEL, 'candidates': [{'finishReason': 'STOP',
                          'content': {'role': 'model', 'parts': [{'text': json.dumps({'transcript': transcript})}]}}]},
                      'listening_verdict': None}
            path = self.run/'independent-google-asr'/(ident+'.'+sha[:16]+'.json')
            qa.save(path, record); self.flash_records[ident] = record
        args = SimpleNamespace(only_ids=','.join(self.ids), max_calls=2)
        with pro.backend():
            self.pro_folder, self.batch = pro.transport.locations(self.run, 'offline')
            pro.prepare(args, self.run, self.pro_folder, self.batch, self.rows)
            info = pro.transport.prepared(self.batch, self.run, self.rows)
            pro.transport.reserve(self.run, self.batch)
            qa.save(self.batch/'submit-intent.private.json', {'model': pro.MODEL, 'request_count': 2,
                    'input_sha256': info['input_sha256'], 'state': 'CONFIRMED'})
            qa.save(self.batch/'job.json', {'model': pro.MODEL, 'request_count': 2,
                    'job_name': 'batches/offline-complementary-fixture'})
            responses = []
            for ident in self.ids:
                tokens = qa.words(self.rows[ident]['text'])
                tokens[names.CASES[ident]['word_index']] = names.CASES[ident]['pro_observed']
                response = {'modelVersion': pro.MODEL, 'candidates': [{'finishReason': 'STOP',
                    'content': {'role': 'model', 'parts': [{'text': json.dumps({'transcript': ' '.join(tokens)})}]}}]}
                responses.append({'key': ident, 'response': response})
            with patch.object(names.core, 'credential', return_value='synthetic'), \
                    patch.object(names.core, 'fetch_status', return_value=({'response': {'inlinedResponses': responses}}, 'JOB_STATE_SUCCEEDED')):
                self.assertEqual(pro.collect(args, self.run, self.pro_folder, self.batch, self.rows), 0)
        self.pro_records = {record['id']: record for record in json.loads((self.pro_folder/'comparison.private.json').read_text())['records']}
        self.model_dir = self.run/'synthetic-model'; self.model_dir.mkdir()
        alphabet = sorted(set((' '.join(qa.words(' '.join(case['text'] for case in names.CASES.values())))
                               + ' voltans volltanz lea').replace(' ', '|')))
        self.vocab = {'<pad>': 0, **{letter: i+1 for i, letter in enumerate(alphabet)}}
        qa.save(self.model_dir/'config.json', {'conv_kernel': [400], 'conv_stride': [320], 'pad_token_id': 0})
        qa.save(self.model_dir/'vocab.json', self.vocab)
        qa.save(self.model_dir/'preprocessor_config.json', {})
        (self.model_dir/'pytorch_model.bin').write_bytes(b'synthetic unusable weights')
        hashes = {name: qa.digest(self.model_dir/name) for name in ['config.json', 'vocab.json', 'preprocessor_config.json', 'pytorch_model.bin']}
        self.model = {'model_id': qa.CTC_MODEL_ID, 'revision': qa.CTC_REVISION, 'local_directory': str(self.model_dir),
                      'file_sha256': hashes, 'fingerprint': qa.text_hash(json.dumps(hashes, sort_keys=True))}
        self.envelopes, self.signals = {}, {}
        for ident in self.ids:
            text = ' '.join(qa.words(self.rows[ident]['text']))
            if ident == self.ids[0]: text = 'a'+text[2:]
            self.ctc_fixture(ident, text)

    def ctc_fixture(self, ident, text, probability=.99):
        tokens = [self.vocab[char] for char in text.replace(' ', '|')]
        ids = [0]
        for token in tokens: ids.extend([token, 0])
        probabilities = [probability]*len(ids)
        greedy = {'method': qa.CTC_METHOD, 'authored_initial_prompt': None, 'unknown_tokens': [],
                  'argmax_token_ids': ids, 'argmax_token_probabilities': probabilities,
                  'argmax_token_ids_sha256': qa.text_hash(json.dumps(ids, separators=(',', ':'))),
                  'frame_evidence_sha256': qa.text_hash(json.dumps({'argmax_token_ids': ids,
                        'argmax_token_probabilities': probabilities}, sort_keys=True, separators=(',', ':'))),
                  'blank_token_id': 0, 'collapsed_token_ids': tokens, 'transcript': text,
                  'token_id_to_label': {str(value): key for key, value in self.vocab.items()}}
        receipt = {'id': ident, 'text': self.rows[ident]['text'], 'binding': {
            'audio_sha256': qa.digest(self.run/'clips'/(ident+'.mp3')),
            'text_sha256': qa.text_hash(self.rows[ident]['text']), 'source_manifest_sha256': self.manifest_sha,
            'model': self.model, 'engine': qa.CTC_ENGINE,
            'script_sha256': qa.digest(self.root/'scripts/story_voice_ctc_align.py')}, 'greedy_decode': greedy,
            'alignment': {'invented_authored_forced_words': 'never evidence'}}
        path = self.run/(ident+'.ctc.private.json'); qa.save(path, receipt)
        report = self.run/(ident+'.input.private.json')
        qa.save(report, {'model': self.model, 'engine': qa.CTC_ENGINE, 'receipt_directory': str(self.run),
                         'results': [{'id': ident, 'receipt_file': path.name, 'receipt_sha256': qa.digest(path), 'approval': None}]})
        self.envelopes[ident] = lexical.load_records(report, self.run/('loader-'+ident))[ident]
        seconds = (400+(len(ids)-1)*320)/16000
        self.signals[ident] = {'seconds': seconds, 'silent': False, 'clipped_fraction': 0., 'peak': .4,
                              'rms': .1, 'leading_silence_seconds': .1, 'trailing_silence_seconds': .1,
                              'last_frame_rms': 0.}
        qa.save(self.qa_path, {'version': qa.VERSION, 'model': qa.MODEL, 'manifest_sha256': self.manifest_sha,
            'clip_sha256': {i: qa.digest(self.run/'clips'/(i+'.mp3')) for i in self.ids},
            'failures': [{'id': i, 'reason': 'asr_lexical_mismatch_requires_review'} for i in self.signals],
            'takes': [{'id': i, 'text_sha256': qa.text_hash(self.rows[i]['text']),
                       'signal': copy.deepcopy(signal), 'reasons': ['asr_lexical_mismatch_requires_review']}
                      for i, signal in self.signals.items()]})

    def bindings(self, ident=None):
        ident = ident or self.ids[0]
        return {'flash_record': self.flash_records[ident], 'pro_record': self.pro_records[ident],
                'ctc_envelope': self.envelopes[ident], 'qa_report_path': self.qa_path,
                'root_veto_report_path': self.veto_path}

    def template(self, ident=None):
        ident = ident or self.ids[0]
        return names.proof_template(self.run, self.rows[ident], self.bindings(ident))

    def approved(self, ident=None):
        result = self.template(ident)
        result.update(status=names.APPROVED, reviewed_by='root offline fixture',
                      reason='Explicitly reviewed both actual ASR bodies and literal free CTC name frames.')
        return result

    def test_two_actual_validated_models_and_literal_name_complete_proof(self):
        for ident in self.ids:
            template = self.template(ident)
            self.assertEqual(template['status'], 'root_review_required')
            self.assertFalse(template['reviewed_by']); self.assertFalse(template['reason'])
            self.assertEqual(template['free_CTC_evidence']['name']['expected_name'], names.CASES[ident]['name'])
            proof = names.review(self.run, self.rows[ident], self.bindings(ident), self.approved(ident))
            self.assertEqual(proof['resolution'], 'root_approved_complementary_complete_full_word_evidence')
            self.assertEqual(proof['flash_evidence']['transcript'], self.flash_records[ident]['transcript'])
            self.assertEqual(proof['pro_evidence']['transcript'], self.pro_records[ident]['transcript'])
            self.assertIsNone(proof['timing_approval']); self.assertIsNone(proof['acting_approval'])
            self.assertIsNone(proof['listening_verdict']); self.assertFalse(proof['provider_timestamps_used'])

    def test_no_approval_and_unapproved_template_never_adopt(self):
        self.assertIsNone(names.review(self.run, self.rows[self.ids[0]], self.bindings()))
        with self.assertRaises(names.core.SafeError):
            names.review(self.run, self.rows[self.ids[0]], self.bindings(), self.template())

    def test_source_ID_and_full_text_scope_cannot_expand(self):
        for line in [dict(self.rows[self.ids[0]], id='story-'+'a'*24),
                     dict(self.rows[self.ids[0]], text='Andere Zeile mit Foltans Freunden.')]:
            with self.assertRaises(names.core.SafeError): names.proof_template(self.run, line, self.bindings())

    def test_only_l_plus_ia_name_segmentation_permitted(self):
        ident = self.ids[1]; original = self.envelopes[ident]['receipt']['greedy_decode']['transcript']
        self.ctc_fixture(ident, original.replace(' lia ', ' l ia '))
        self.assertEqual(self.template(ident)['free_CTC_evidence']['name']['explicit_name_segmentation'], ['l', 'ia'])
        for split in ['li a', 'l i a']:
            self.ctc_fixture(ident, original.replace(' lia ', ' '+split+' '))
            with self.assertRaises(names.core.SafeError): self.template(ident)
        ident = self.ids[0]; text = self.envelopes[ident]['receipt']['greedy_decode']['transcript']
        self.ctc_fixture(ident, text.replace('foltans', 'fol tans'))
        with self.assertRaises(names.core.SafeError): self.template(ident)

    def test_literal_name_and_source_exact_two_neighbors_required(self):
        ident = self.ids[0]; original = self.envelopes[ident]['receipt']['greedy_decode']['transcript']
        for text in [original.replace('foltans', 'voltans'), original.replace('junge dame', 'junge da me'),
                     original.replace('freunde essen', 'freunde sesen')]:
            self.ctc_fixture(ident, text)
            with self.assertRaises(names.core.SafeError): self.template(ident)

    def test_unique_name_and_no_hidden_free_CTC_restart(self):
        ident = self.ids[0]; original = self.envelopes[ident]['receipt']['greedy_decode']['transcript']
        for text in [original+' foltans', original+' die junge dame']:
            self.ctc_fixture(ident, text)
            with self.assertRaises(names.core.SafeError): self.template(ident)

    def test_every_emitted_name_character_frame_probability_threshold(self):
        ident = self.ids[0]; text = self.envelopes[ident]['receipt']['greedy_decode']['transcript']
        self.ctc_fixture(ident, text, .4999)
        with self.assertRaises(names.core.SafeError): self.template(ident)
        self.ctc_fixture(ident, text, .5)
        self.assertEqual(self.template(ident)['free_CTC_evidence']['name']['minimum_name_frame_probability'], .5)

    def test_actual_flash_raw_record_cache_and_pro_schema_cannot_be_fabricated(self):
        for key in ['model', 'transcript', 'source_text_sha256', 'upload_sha256', 'prompt']:
            bindings = self.bindings(); bindings['flash_record'] = copy.deepcopy(bindings['flash_record'])
            bindings['flash_record'][key] = 'forged'
            with self.assertRaises(names.core.SafeError): names.proof_template(self.run, self.rows[self.ids[0]], bindings)
        for key in ['model', 'transcript', 'request_sha256', 'batch_response_sha256', 'driver_sha256']:
            bindings = self.bindings(); bindings['pro_record'] = copy.deepcopy(bindings['pro_record'])
            bindings['pro_record'][key] = 'forged'
            with self.assertRaises(names.core.SafeError): names.proof_template(self.run, self.rows[self.ids[0]], bindings)

    def test_ASR_omissions_extras_reordering_nonname_changes_and_translations_refused(self):
        line = self.rows[self.ids[0]]
        for transcript in ['Ah die Dame Voltans Freunde essen bei mir umsonst Ehrensache',
                           'Ah die junge Dame Voltans Freunde essen bei mir umsonst Ehrensache bitte',
                           'Ah junge die Dame Voltans Freunde essen bei mir umsonst Ehrensache',
                           'Ah die junge Dame Voltans Freunde gehen bei mir umsonst Ehrensache',
                           'Ah the young lady Voltan friends eat here for free']:
            with self.assertRaises(names.core.SafeError):
                names.body_evidence(line, {'transcript': transcript}, names.CASES[line['id']]['flash_observed'])

    def test_both_actual_models_are_required(self):
        for key in ['flash_record', 'pro_record', 'ctc_envelope', 'qa_report_path', 'root_veto_report_path']:
            bindings = self.bindings(); bindings.pop(key)
            with self.assertRaises(names.core.SafeError): names.proof_template(self.run, self.rows[self.ids[0]], bindings)

    def test_physical_QA_and_independent_word_defects_block_proof(self):
        original = json.loads(self.qa_path.read_text())
        for kind in ['signal', 'independent_defect', 'stale_audio', 'stale_source']:
            report = copy.deepcopy(original)
            if kind == 'signal': report['takes'][0]['signal']['peak'] = 1.3
            if kind == 'independent_defect': report['takes'][0]['reasons'].append('independent_audio_word_defect')
            if kind == 'stale_audio': report['clip_sha256'][self.ids[0]] = '0'*64
            if kind == 'stale_source': report['manifest_sha256'] = '0'*64
            qa.save(self.qa_path, report)
            with self.assertRaises(names.core.SafeError): self.template()
        qa.save(self.qa_path, original)

    def test_current_root_veto_and_unavailable_veto_evidence_block(self):
        ident = self.ids[0]; sha = qa.digest(self.run/'clips'/(ident+'.mp3'))
        path = self.run/'veto-evidence.private.json'
        qa.save(path, {'id': ident, 'clip_sha256': sha, 'source_text_sha256': qa.text_hash(self.rows[ident]['text'])})
        qa.save(self.veto_path, {'records': [{'id': ident, 'status': 'root_retake_required', 'reviewed_by': 'root fixture',
                 'reason': 'Actual repeated opening.', 'clip_sha256': sha, 'text_sha256': qa.text_hash(self.rows[ident]['text']),
                 'evidence': [{'file': path.name, 'sha256': qa.digest(path)}]}]})
        with self.assertRaises(names.core.SafeError): self.template()
        path.write_text('{}')
        with self.assertRaises(names.core.SafeError): self.template()

    def test_QA_failure_ledger_cannot_hide_selected_defect(self):
        report = json.loads(self.qa_path.read_text())
        report['failures'].append({'id': self.ids[0], 'reason': 'independent_audio_word_defect'})
        qa.save(self.qa_path, report)
        with self.assertRaises(names.core.SafeError): self.template()

    def test_raw_CTC_frames_script_and_actual_model_mutation_fail_closed(self):
        for kind in ['raw', 'script', 'weights']:
            with self.subTest(kind=kind):
                path = Path(self.envelopes[self.ids[0]]['receipt_path']) if kind == 'raw' else \
                       self.root/'scripts/story_voice_ctc_align.py' if kind == 'script' else self.model_dir/'pytorch_model.bin'
                original = path.read_bytes(); path.write_bytes(original+b'changed')
                try:
                    with self.assertRaises(names.core.SafeError): self.template()
                finally: path.write_bytes(original)
                if kind == 'weights':
                    for ident in self.ids:
                        text = self.envelopes[ident]['receipt']['greedy_decode']['transcript']
                        self.ctc_fixture(ident, text)

    def test_forced_alignment_is_never_consulted_or_given_approval(self):
        ident = self.ids[0]; envelope = self.envelopes[ident]
        envelope['receipt'].pop('alignment')
        path = Path(envelope['receipt_path']); qa.save(path, envelope['receipt'])
        envelope['receipt_sha256'] = qa.digest(path)
        proof = self.template()
        self.assertIsNone(proof['timing_approval'])
        self.assertNotIn('alignment', proof['free_CTC_evidence'])

    def test_approval_every_binding_immutable_extra_fields_and_numeric_types_rejected(self):
        approved = self.approved()
        for key in ['clip_sha256', 'source_text_sha256', 'source_manifest_sha256', 'source_row_sha256', 'method']:
            bad = copy.deepcopy(approved); bad[key] = 'wrong'
            with self.assertRaises(names.core.SafeError): names.review(self.run, self.rows[self.ids[0]], self.bindings(), bad)
        cases = []
        bad = copy.deepcopy(approved); bad['free_CTC_evidence']['name']['source_word_index'] = 4.0; cases.append(bad)
        bad = copy.deepcopy(approved); bad['flash_evidence']['all_source_differences'] = []; cases.append(bad)
        bad = copy.deepcopy(approved); bad['unexpected'] = True; cases.append(bad)
        bad = copy.deepcopy(approved); bad['provider_timestamps_used'] = 0; cases.append(bad)
        for key, value in [('status', 'root_review_required'), ('reviewed_by', 'automatic'), ('reason', ''),
                           ('listening_verdict', 'heard good'), ('timing_approval', True)]:
            bad = copy.deepcopy(approved); bad[key] = value; cases.append(bad)
        for bad in cases:
            with self.assertRaises(names.core.SafeError): names.review(self.run, self.rows[self.ids[0]], self.bindings(), bad)

    def test_neighbor_file_changes_invalidate_existing_approval_without_rewriting_evidence(self):
        approved = self.approved()
        before = Path(self.envelopes[self.ids[0]]['receipt_path']).read_bytes()
        self.qa_path.write_bytes(self.qa_path.read_bytes()+b' ')
        with self.assertRaises(names.core.SafeError): names.review(self.run, self.rows[self.ids[0]], self.bindings(), approved)
        self.assertEqual(Path(self.envelopes[self.ids[0]]['receipt_path']).read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
