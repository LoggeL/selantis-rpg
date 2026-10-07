"""Synthetic publication guard tests, never model/audio quality evidence."""
import copy
import fcntl
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import part2_voice_batch as b
import part2_voice_publish as p
import story_voice_word_cues as c


class Publication(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.run = self.root/'output/audio/part2-voice/unit'
        self.run.mkdir(parents=True)
        self.patches = patch.multiple(b, ROOT=self.root, PRIVATE=self.root/'output/audio/part2-voice',
                                      PUBLIC=self.root/'game/public/audio/teil-2')
        self.patches.start()
        self.ident = 'part2-'+'1'*24
        self.row = {'id': self.ident, 'kind': 'say', 'speaker': 'lia', 'text': 'Weiter.', 'display_text': 'Weiter.',
                    'scene': 'e2-taverne', 'direction_en': 'Klar.',
                    'runtime_keys': [{'kind': 'say', 'speaker': 'e2-lia', 'text': 'Weiter.', 'scene': 'e2-taverne'}]}
        self.profiles = {'speakers': {'lia': {'google_voice': 'Laomedeia'}}}
        self.manifest = {'lines': [self.row]}
        b.core.save(self.run/'lines.private.json', self.manifest)
        (self.run/'clips').mkdir(); (self.run/'raw').mkdir(); (self.run/'word-cues').mkdir()
        self.path = self.run/'clips'/(self.ident+'.mp3')
        self.path.write_bytes(b'NOT REAL AUDIO: CONTRACT UNIT FIXTURE')
        wav = self.run/'raw'/(self.ident+'.wav'); wav.write_bytes(b'NOT REAL WAV: CONTRACT UNIT FIXTURE')
        self.audio_hash = b.digest(self.path)
        self.text_hash = b.sha(b'Weiter.')
        self.signal = {'seconds': 1.0, 'decoded_samples': 24000, 'peak': .1, 'rms': .04, 'clipped_fraction': 0,
                       'leading_silence_seconds': .1, 'trailing_silence_seconds': .1, 'last_frame_rms': .001, 'silent': False}
        self.take = {'id': self.ident, 'text_sha256': self.text_hash, 'signal': self.signal,
                     'transcript': 'Weiter.', 'word_error_rate': 0, 'reasons': []}
        self.cues = [{'start': .1, 'end': .8}]
        self.temporal = {'id': self.ident, 'audio_sha256': self.audio_hash, 'text_sha256': self.text_hash,
                         'source_manifest_sha256': b.digest(self.run/'lines.private.json'), 'text': 'Weiter.',
                         'engine_version': c.ENGINE, 'all_qualification_flags': [], 'qualification_flags': [],
                         'decoded_seconds': 1.0, 'authored_word_count': 1, 'word_cues': self.cues,
                         'cues_sha256': c.acoustic.cue_sha(self.cues),
                         'words': [{'word': 'Weiter.', 'spoken': True, 'minimum_token_probability': .4}]}
        self.entry = {'word_count': 1, 'text_sha256': self.text_hash, 'cues_sha256': c.acoustic.cue_sha(self.cues),
                      'words': [{'word': 'Weiter.', **self.cues[0]}]}
        self.qa = {'version': p.qa_engine.VERSION, 'model': p.qa_engine.MODEL+':/unit-only',
                   'manifest_sha256': b.digest(self.run/'lines.private.json'), 'finished_at': 10,
                   'status': 'passed', 'checked_ids': [self.ident], 'clip_sha256': {self.ident: self.audio_hash},
                   'takes': [self.take], 'failures': []}
        self.alignment = {'method': c.ENGINE, 'model': c.acoustic.MODEL, 'source_manifest_sha256': b.digest(self.run/'lines.private.json'),
                          'status': 'passed', 'selected_ids': [self.ident], 'coverage': 'all_collected',
                          'clip_sha256': {self.ident: self.audio_hash}, 'authored_text_sha256': {self.ident: self.text_hash},
                          'alignment_by_id': {self.ident: self.entry}, 'failures': []}
        self.receipt = {'id': self.ident, 'status': 'complete', 'backend': 'batch', 'seconds': 1,
                        'mp3_sha256': self.audio_hash, 'wav_sha256': b.digest(wav),
                        'normalization': {'integrated_lufs': -18, 'true_peak_db': -1.5, 'lra': 11},
                        'loudness_input': {'input_i': '-18', 'input_tp': '-3', 'input_lra': '1', 'input_thresh': '-22', 'target_offset': '0'},
                        'request_sha256': b.sha(b.canonical(b.request_for(self.row, self.profiles['speakers'])).encode())}
        self.write_receipts()

    def tearDown(self):
        self.patches.stop(); self.temp.cleanup()

    def write_receipts(self):
        b.core.save(self.run/'raw'/(self.ident+'.receipt.json'), self.receipt)
        b.core.save(self.run/'word-cues'/(self.ident+'.json'), self.temporal)

    def clip(self, **kwargs):
        return p.current_clip(self.row, self.run, self.profiles, self.qa, self.alignment,
                              {self.ident: self.take}, decode_fn=lambda _: kwargs.get('signal', self.signal))

    def test_flag_free_whole_words_signal_and_receipts_form_exact_clip(self):
        clip, path = self.clip()
        self.assertEqual(path, self.path)
        self.assertEqual(clip['audio'], 'audio/teil-2/'+self.ident+'.mp3')
        self.assertEqual(clip['runtime_keys'], self.row['runtime_keys'])
        self.assertEqual(clip['word_cues'], self.cues)
        self.assertEqual(clip['voice'], 'Laomedeia')

    def test_current_audio_hash_mismatch_refused(self):
        self.path.write_bytes(b'foreign changed audio')
        with self.assertRaises(b.SafeError): self.clip()

    def test_source_word_or_asr_error_cannot_be_waived(self):
        for mutation in ['transcript', 'error_rate', 'reason', 'adjudication']:
            original = copy.deepcopy(self.take)
            if mutation == 'transcript': self.take['transcript'] = 'Weiter bitte.'
            if mutation == 'error_rate': self.take['word_error_rate'] = .2
            if mutation == 'reason': self.take['reasons'] = ['possible_abrupt_audio_end']
            if mutation == 'adjudication': self.take['adjudication'] = {'resolution': 'blanket-name-exception'}
            with self.subTest(mutation=mutation), self.assertRaises(b.SafeError): self.clip()
            self.take.clear(); self.take.update(original)

    def test_current_signal_must_be_redecoded_and_match(self):
        changed = {**self.signal, 'peak': .2}
        with self.assertRaises(b.SafeError): self.clip(signal=changed)

    def test_actual_timing_flags_stay_private_even_if_report_claims_passed(self):
        self.temporal['all_qualification_flags'] = [{'word_index': 0, 'reasons': ['low_authored_token_probability']}]
        self.write_receipts()
        with self.assertRaises(b.SafeError): self.clip()

    def test_recomputed_raw_probability_flags_cannot_be_dropped(self):
        self.temporal['words'][0]['minimum_token_probability'] = .001
        self.write_receipts()
        with self.assertRaises(b.SafeError): self.clip()

    def test_changed_or_collapsed_lexical_cues_refused(self):
        self.temporal['word_cues'][0]['end'] = .1
        self.temporal['cues_sha256'] = c.acoustic.cue_sha(self.temporal['word_cues'])
        self.write_receipts()
        with self.assertRaises(b.SafeError): self.clip()

    def test_stale_receipt_or_wrong_model_engine_refused(self):
        self.temporal['engine_version'] = c.ENGINE+'/invented-times'
        self.write_receipts()
        with self.assertRaises(b.SafeError): self.clip()

    def test_alignment_word_replacement_refused(self):
        self.entry['words'][0]['word'] = 'Fremd.'
        with self.assertRaises(b.SafeError): self.clip()

    def test_full_failed_reports_retained_and_partial_coverage_allowed(self):
        held = 'part2-'+'2'*24
        manifest = {'lines': [self.row, {**self.row, 'id': held}]}
        b.core.save(self.run/'lines.private.json', manifest)
        bound = b.digest(self.run/'lines.private.json')
        self.qa.update(manifest_sha256=bound, status='review_required')
        self.qa['takes'].append({'id': held, 'reasons': ['signal_check_failed_FileNotFoundError']})
        self.qa['failures'].append({'id': held, 'reason': 'signal_check_failed_FileNotFoundError'})
        self.alignment['source_manifest_sha256'] = bound
        before = copy.deepcopy((self.qa, self.alignment))
        takes, checked = p.report_coverage(self.qa, self.alignment, manifest, self.run)
        self.assertEqual(set(takes), {self.ident, held}); self.assertEqual(checked, {self.ident})
        self.assertEqual(before, (self.qa, self.alignment))

    def test_omitted_full_failure_body_or_fake_global_pass_refused(self):
        self.take['reasons'] = ['asr_lexical_mismatch_requires_review']
        self.qa['status'] = 'review_required'
        with self.assertRaises(b.SafeError): p.report_coverage(self.qa, self.alignment, self.manifest, self.run)
        self.qa['failures'] = [{'id': self.ident, 'reason': 'asr_lexical_mismatch_requires_review'}]
        self.qa['status'] = 'passed'
        with self.assertRaises(b.SafeError): p.report_coverage(self.qa, self.alignment, self.manifest, self.run)

    def test_unknown_global_failure_blocks_whole_export(self):
        self.qa['failures'] = [{'id': None, 'reason': 'changed_source'}]
        with self.assertRaises(b.SafeError): p.report_coverage(self.qa, self.alignment, self.manifest, self.run)

    def test_bank_transaction_preserves_story_and_prolog(self):
        clip, _ = self.clip()
        public = {'model': b.core.MODEL, 'aliases': {}, 'clips': [clip]}
        preserved = {}
        for bank in ['story', 'prolog']:
            folder = self.root/'game/public/audio'/bank
            folder.mkdir(parents=True); (folder/'keep.mp3').write_bytes(bank.encode())
            preserved[bank] = p.file_map(folder)
        bound = {str(self.path): b.digest(self.path)}
        p.apply(b.PUBLIC.resolve(), {'existing_manifest_sha256': None}, public,
                {self.ident: self.path}, preserved, bound)
        self.assertEqual(b.digest(b.PUBLIC/(self.ident+'.mp3')), clip['sha256'])
        p.stable(bound, preserved)

    def test_existing_partial_bank_cannot_drop_a_previously_published_take(self):
        clip, _ = self.clip()
        b.PUBLIC.mkdir(parents=True)
        b.core.save(b.PUBLIC/'manifest.json', {'model': b.core.MODEL, 'clips': [clip]})
        (b.PUBLIC/(self.ident+'.mp3')).write_bytes(self.path.read_bytes())
        selection = {'existing_manifest_sha256': b.digest(b.PUBLIC/'manifest.json')}
        with self.assertRaises(b.SafeError): p.existing(b.PUBLIC, selection, {'clips': []})

    def test_foreign_existing_bank_or_audio_changed_since_review_is_preserved(self):
        b.PUBLIC.mkdir(parents=True); (b.PUBLIC/'foreign.txt').write_bytes(b'keep')
        with self.assertRaises(b.SafeError): p.existing(b.PUBLIC, {'existing_manifest_sha256': None}, {'clips': []})
        self.assertEqual((b.PUBLIC/'foreign.txt').read_bytes(), b'keep')

    def test_transaction_failure_restores_old_bank_without_modifying_other_banks(self):
        clip, _ = self.clip()
        public = {'model': b.core.MODEL, 'clips': [clip]}
        b.PUBLIC.mkdir(parents=True); b.core.save(b.PUBLIC/'manifest.json', public)
        (b.PUBLIC/(self.ident+'.mp3')).write_bytes(self.path.read_bytes())
        old = p.file_map(b.PUBLIC)
        selection = {'existing_manifest_sha256': b.digest(b.PUBLIC/'manifest.json')}
        with patch.object(p.os, 'link', side_effect=OSError('unit-only insertion failure')), self.assertRaises(OSError):
            p.apply(b.PUBLIC.resolve(), selection, public, {self.ident: self.path}, {}, {str(self.path): b.digest(self.path)})
        self.assertEqual(p.file_map(b.PUBLIC), old)

    def test_coverage_finalization_failure_rolls_back_old_bank(self):
        clip, _ = self.clip()
        public = {'model': b.core.MODEL, 'clips': [clip]}
        b.PUBLIC.mkdir(parents=True); b.core.save(b.PUBLIC/'manifest.json', public)
        (b.PUBLIC/(self.ident+'.mp3')).write_bytes(self.path.read_bytes())
        old = p.file_map(b.PUBLIC)
        selection = {'existing_manifest_sha256': b.digest(b.PUBLIC/'manifest.json')}
        def refused(): raise OSError('unit-only coverage finalization failure')
        with self.assertRaises(OSError):
            p.apply(b.PUBLIC.resolve(), selection, public, {self.ident: self.path}, {},
                    {str(self.path): b.digest(self.path)}, finalize=refused)
        self.assertEqual(p.file_map(b.PUBLIC), old)

    def test_immutable_coverage_report_never_overwrites_foreign_bytes(self):
        path = self.run/'coverage.private.json'; path.write_bytes(b'keep foreign proof')
        with self.assertRaises(FileExistsError): p.exclusive_report(path, {'state': 'new'})
        self.assertEqual(path.read_bytes(), b'keep foreign proof')

    def test_dangling_public_symlink_refused(self):
        b.PUBLIC.parent.mkdir(parents=True)
        b.PUBLIC.symlink_to(self.root/'foreign-not-existing', target_is_directory=True)
        with self.assertRaises(b.SafeError): p.existing(b.PUBLIC, {'existing_manifest_sha256': None}, {'clips': []})
        self.assertTrue(b.PUBLIC.is_symlink())

    def test_coverage_partial_write_is_removed_only_if_owned(self):
        path = self.run/'coverage.private.json'
        def broken_dump(report, stream, **kwargs):
            stream.write('{partial')
            raise OSError('unit-only disk failure')
        with patch.object(p.json, 'dump', side_effect=broken_dump), self.assertRaises(OSError):
            p.exclusive_report(path, {'state': 'PUBLISHED'})
        self.assertFalse(path.exists())

    def test_target_replaced_during_finalization_keeps_foreign_target_and_old_backup(self):
        clip, _ = self.clip()
        public = {'model': b.core.MODEL, 'clips': [clip]}
        b.PUBLIC.mkdir(parents=True); b.core.save(b.PUBLIC/'manifest.json', public)
        (b.PUBLIC/(self.ident+'.mp3')).write_bytes(self.path.read_bytes())
        old = p.file_map(b.PUBLIC)
        selection = {'existing_manifest_sha256': b.digest(b.PUBLIC/'manifest.json')}
        def foreign_replacement():
            b.PUBLIC.rename(b.PUBLIC.parent/'foreign-retained-new-bank')
            b.PUBLIC.mkdir(); (b.PUBLIC/'foreign.txt').write_bytes(b'keep foreign target')
        with self.assertRaises(b.SafeError):
            p.apply(b.PUBLIC.resolve(), selection, public, {self.ident: self.path}, {},
                    {str(self.path): b.digest(self.path)}, finalize=foreign_replacement)
        self.assertEqual((b.PUBLIC/'foreign.txt').read_bytes(), b'keep foreign target')
        backups = list(b.PUBLIC.parent.glob('.teil-2-backup-*'))
        self.assertEqual(len(backups), 1); self.assertEqual(p.file_map(backups[0]), old)

    def test_keyboard_interrupt_rolls_back_current_transaction(self):
        clip, _ = self.clip()
        public = {'model': b.core.MODEL, 'clips': [clip]}
        b.PUBLIC.mkdir(parents=True); b.core.save(b.PUBLIC/'manifest.json', public)
        (b.PUBLIC/(self.ident+'.mp3')).write_bytes(self.path.read_bytes())
        old = p.file_map(b.PUBLIC)
        selection = {'existing_manifest_sha256': b.digest(b.PUBLIC/'manifest.json')}
        def interrupted(): raise KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            p.apply(b.PUBLIC.resolve(), selection, public, {self.ident: self.path}, {},
                    {str(self.path): b.digest(self.path)}, finalize=interrupted)
        self.assertEqual(p.file_map(b.PUBLIC), old)

    def metadata_fixture(self):
        target = self.root/'release-worktree'
        target.mkdir()
        manifest = {}
        for index, (name, field) in enumerate(p.SCANNER_METADATA.items()):
            source = self.root/name
            b.core.save(source, {'unit_test_metadata': index})
            release = target/name
            release.parent.mkdir(parents=True, exist_ok=True)
            release.write_bytes(source.read_bytes())
            manifest[field] = b.digest(source)
        return manifest, target

    def test_exact_private_scanner_metadata_hashes_bind_both_worktrees(self):
        manifest, target = self.metadata_fixture()
        bound = p.scanner_metadata(manifest, target)
        self.assertEqual(len(bound), 4)
        p.stable(bound, {})
        self.assertEqual(set(bound.values()), set(manifest.values()))

    def test_release_metadata_changed_or_missing_before_build_is_refused(self):
        manifest, target = self.metadata_fixture()
        release = target/next(iter(p.SCANNER_METADATA))
        release.write_bytes(b'{"foreign":true}')
        with self.assertRaises(b.SafeError): p.scanner_metadata(manifest, target)
        release.unlink()
        with self.assertRaises(b.SafeError): p.scanner_metadata(manifest, target)

    def test_metadata_mutated_during_commit_rolls_back_public_bank(self):
        manifest, target = self.metadata_fixture()
        metadata_bound = p.scanner_metadata(manifest, target)
        clip, _ = self.clip()
        public = {'model': b.core.MODEL, 'clips': [clip]}
        b.PUBLIC.mkdir(parents=True); b.core.save(b.PUBLIC/'manifest.json', public)
        (b.PUBLIC/(self.ident+'.mp3')).write_bytes(self.path.read_bytes())
        before = p.file_map(b.PUBLIC)
        selection = {'existing_manifest_sha256': b.digest(b.PUBLIC/'manifest.json')}
        bound = {**metadata_bound, str(self.path): b.digest(self.path)}
        metadata_path = target/next(iter(p.SCANNER_METADATA))
        def concurrent_metadata_change(): metadata_path.write_bytes(b'{"foreign":true}')
        with self.assertRaises(b.SafeError):
            p.apply(b.PUBLIC.resolve(), selection, public, {self.ident: self.path}, {}, bound,
                    finalize=concurrent_metadata_change)
        self.assertEqual(p.file_map(b.PUBLIC), before)
        self.assertEqual(metadata_path.read_bytes(), b'{"foreign":true}')

    def test_target_lock_serializes_callers_from_different_production_worktrees(self):
        target = self.root/'release-worktree'; target.mkdir()
        with p.target_publish_lock(target):
            with patch.object(b, 'ROOT', self.root/'another-production'), self.assertRaises(b.SafeError):
                with p.target_publish_lock(target): self.fail('Second publisher must not reach export.')
        with p.target_publish_lock(target): pass

    def test_same_root_target_lock_does_not_reacquire_production_lock(self):
        folder = self.root/'output/audio/part2-voice'
        with (folder/'publish.lock').open('a+') as production:
            fcntl.flock(production, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with p.target_publish_lock(self.root):
                self.assertTrue((folder/'target-publication.lock').is_file())
            fcntl.flock(production, fcntl.LOCK_UN)

    def test_target_lock_is_released_when_export_aborts(self):
        with self.assertRaises(RuntimeError):
            with p.target_publish_lock(self.root): raise RuntimeError('unit-only abort')
        with p.target_publish_lock(self.root): pass

    def test_release_ast_replay_runs_in_actual_target_and_keeps_production_provenance_separate(self):
        manifest, target = self.metadata_fixture()
        manifest.update(model=b.core.MODEL, lines=[], runtime_lookup=[], source_hashes={}, aliases={},
                        scene_players={}, unresolved=[], source_validation={'current_source_matches_snapshot': True})
        bound = p.scanner_metadata(manifest, target)
        calls = []
        def replay(command, **kwargs):
            calls.append((command, kwargs))
            b.core.save(Path(command[-1]), manifest)
            return type('Result', (), {'returncode': 0})()
        with patch.object(p.subprocess, 'run', side_effect=replay): p.release_inventory(manifest, target, bound)
        self.assertEqual(calls[0][0][:3], ['node', str(target/'scripts/part2_voice_inventory.mjs'), '--propose'])
        self.assertEqual(calls[0][1]['cwd'], target)
        self.assertNotIn('qa_producer', manifest)


if __name__ == '__main__': unittest.main()
