"""Synthetic offline publication boundaries, no genuine approvals or inference."""
import copy
import json
from pathlib import Path
import shutil
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_incremental_publish as inc
import story_voice_publish_test as fixtures
save = fixtures.save


class IncrementalTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.PublisherTests(); self.fixture.setUp(); self.addCleanup(self.fixture.tearDown)
        self.root = self.fixture.root
        self.run = self.root/'output/audio/story-voice/supplement'
        self.run.parent.mkdir(parents=True); shutil.move(str(self.fixture.run), self.run)
        self.ident = self.fixture.ident; self.missing = 'story-'+'b'*24
        self.inventory = self.fixture.inventory
        self.current = inc.read(self.run/'lines.private.json')
        row = copy.deepcopy(self.current['lines'][0]); row.update(id=self.missing, text='Fehlende Aufnahme', display_text='Fehlende Aufnahme')
        row['runtime_keys'][0]['text'] = row['text']
        self.current['lines'].append(row)
        self.current['runtime_lookup'].extend({**key, 'asset_id': self.missing} for key in row['runtime_keys'])
        save(self.inventory, self.current)
        self.profiles = self.root/'docs/voice-production/story-speakers.json'
        save(self.profiles, inc.read(self.run/'profiles.private.json'))
        self.supplements = self.run.parent/'supplements.json'
        self.selection = self.run.parent/'selection.json'
        self.args = SimpleNamespace(current_inventory=self.inventory, profiles=self.profiles,
            supplements=self.supplements, root_selection=self.selection, public_dir=self.root/'game/public/audio/story')
        self.records = [{'run_dir': str(self.run), 'qa_report': str(self.run/'qa.json'),
            'alignment_report': str(self.run/'align.json'), 'manifest_sha256': '', 'qa_sha256': '', 'alignment_sha256': '',
            'removed_current_ids': []}]
        self.withdrawn = {}
        self.requested = [self.ident]; self.retired = []; self.existing_hash = None
        self.refresh()
        self.actual_scanner = inc.scanner_inventory
        p = patch.object(inc, 'scanner_inventory', side_effect=lambda path, root:
                         {'scanner_sha256': 'synthetic scanner', 'inventory_sha256': inc.digest(path)})
        p.start(); self.addCleanup(p.stop)

    def refresh(self):
        for rec in self.records:
            for key, path in [('manifest_sha256', Path(rec['run_dir'])/'lines.private.json'),
                    ('qa_sha256', Path(rec['qa_report'])), ('alignment_sha256', Path(rec['alignment_report']))]:
                rec[key] = inc.digest(path)
        save(self.supplements, {'runs': self.records})
        save(self.selection, {'status': inc.APPROVED, 'reviewed_by': 'root synthetic fixture',
            'reason': 'Explicit synthetic selected current Sources and private run proofs reviewed.',
            'current_inventory_sha256': inc.digest(self.inventory), 'profiles_sha256': inc.digest(self.profiles),
            'supplements_sha256': inc.digest(self.supplements), 'requested_ids': self.requested,
            'retired_ids': self.retired, 'existing_manifest_sha256': self.existing_hash, 'withdrawn_ids': self.withdrawn})

    def build(self): return inc.build(self.args)

    def add_conditional_withdrawal(self):
        """Synthetic full two-take run with actual TypeScript branch parsing."""
        self.removed = next(iter(inc.WITHDRAWN_PAIRS))
        expression = "id === 'orwen' ? 'Weg hier! Alle weg!' : 'Hexerei!'"
        text = "for (const id of ['orwen', 'algard', 'maedchen', 'schuetze']) { ctx.bark(id, " + expression + ", 1200); }"
        source_path = self.root/inc.WITHDRAWAL_SOURCE; source_path.parent.mkdir(parents=True); source_path.write_text(text)
        source = {'file': inc.WITHDRAWAL_SOURCE, 'start': text.index(expression), 'end': text.index(expression)+len(expression),
                  'expression': expression, 'expression_sha256': inc.strict.sha(expression.encode())}
        dependency = self.root/'game/node_modules/typescript'; dependency.parent.mkdir(parents=True)
        dependency.symlink_to(Path(inc.__file__).resolve().parent.parent/'game/node_modules/typescript', target_is_directory=True)
        self.removed_row = {'id': self.removed, 'kind': 'bark', 'speaker': 'schuetze', 'text': inc.WITHDRAWAL_TEXT,
            'display_text': inc.WITHDRAWAL_TEXT, 'direction_en': 'same', 'performance_variant': 'same', 'mood': 'neutral',
            'sources': [source], 'runtime_keys': [{'kind':'bark','speaker':'schuetze','text':inc.WITHDRAWAL_TEXT,
                'scene':'rettung','mood':'neutral','performance_variant':'same'}]}
        frozen = inc.read(self.run/'lines.private.json'); frozen['lines'].append(self.removed_row)
        frozen['source_hashes'][inc.WITHDRAWAL_SOURCE] = inc.digest(source_path)
        frozen['runtime_lookup'].extend({**key, 'asset_id': self.removed} for key in self.removed_row['runtime_keys'])
        save(self.run/'lines.private.json', frozen); save(self.run/'full-inventory.private.json', frozen)
        snapshot = inc.read(self.run/'source-snapshot.private.json')
        snapshot[inc.WITHDRAWAL_SOURCE] = {'sha256': inc.digest(source_path), 'text': text}
        save(self.run/'source-snapshot.private.json', snapshot)
        profiles = inc.read(self.profiles); profiles['speakers']['schuetze'] = {'google_voice': 'Puck'}
        save(self.profiles, profiles); save(self.run/'profiles.private.json', profiles)
        payload = ''.join(json.dumps({'key': row['id'], 'request': inc.strict.common.request_for(row, profiles['speakers'])})+'\n'
                          for row in frozen['lines'])
        (self.run/'requests.jsonl').write_text(payload)
        prepared = inc.read(self.run/'prepared.json'); prepared.update(request_count=2, input_bytes=len(payload.encode()))
        for filename, key in [('requests.jsonl','input_sha256'),('profiles.private.json','profiles_sha256'),
                ('lines.private.json','manifest_sha256'),('full-inventory.private.json','full_inventory_sha256'),
                ('source-snapshot.private.json','source_snapshot_sha256')]: prepared[key] = inc.digest(self.run/filename)
        save(self.run/'prepared.json', prepared); save(self.run/'collection.private.json', {'collected':2,'expected':2,'failures':[]})
        audio = self.run/'clips'/(self.removed+'.mp3'); audio.write_bytes(b'synthetic charged unreachable pair')
        qa = inc.read(self.run/'qa.json'); qa['manifest_sha256'] = prepared['manifest_sha256']
        qa['checked_ids'].append(self.removed); qa['clip_sha256'][self.removed] = inc.digest(audio)
        text_sha = inc.strict.sha(inc.WITHDRAWAL_TEXT.encode())
        qa['takes'].append({'id':self.removed,'text_sha256':text_sha,'signal':{'seconds':1.},'reasons':[]})
        save(self.run/'qa.json', qa)
        alignment = inc.read(self.run/'align.json'); alignment['source_manifest_sha256'] = prepared['manifest_sha256']
        cues = [{'start':i/4,'end':(i+1)/4} for i in range(4)]
        words = inc.strict.acoustic.normalized_text(inc.WITHDRAWAL_TEXT).split()
        alignment['clip_sha256'][self.removed] = inc.digest(audio); alignment['authored_text_sha256'][self.removed] = text_sha
        alignment['alignment_by_id'][self.removed] = {'words':[{'word':word,**cue} for word,cue in zip(words,cues)],
            'word_count':4,'text_sha256':text_sha,'cues_sha256':inc.strict.acoustic.cue_sha(cues)}
        save(self.run/'align.json', alignment)
        self.current['source_hashes'][inc.WITHDRAWAL_SOURCE] = inc.digest(source_path)
        for index, (speaker, spoken) in enumerate([('orwen',inc.WITHDRAWAL_TEXT),('algard','Hexerei!'),('maedchen','Hexerei!'),('schuetze','Hexerei!')]):
            row = copy.deepcopy(self.removed_row); row.update(id='story-'+str(index+1)*24,speaker=speaker,text=spoken,display_text=spoken)
            row['runtime_keys'][0].update(speaker=speaker,text=spoken); self.current['lines'].append(row)
        self.current['runtime_lookup'] = [{**key,'asset_id':row['id']} for row in self.current['lines'] for key in row['runtime_keys']]
        save(self.inventory, self.current)
        proof = inc.withdrawal_record(self.run, self.removed_row, self.current, self.inventory, self.root.resolve())
        self.withdrawn = {self.removed: {**proof,'reason':'Actual literal branch makes this charged actor/text pair unreachable.'}}
        self.records[0]['removed_current_ids'] = [self.removed]; self.refresh()

    def test_strict_selected_run_and_missing_coverage_never_bless_original_bank(self):
        with patch.object(inc.strict, 'validate_run', wraps=inc.strict.validate_run) as check:
            manifest, paths, coverage = self.build()
        self.assertEqual(check.call_args.args[3], 1)
        self.assertEqual(set(paths), {self.ident}); self.assertEqual(len(manifest['clips']), 1)
        self.assertEqual(coverage['missing_ids'], [self.missing])
        self.assertEqual(coverage['status'], 'qualified_partial_story_bank')
        self.assertFalse(coverage['full_original_bank_approved'])
        self.assertNotIn('passed', coverage.values())
        self.assertEqual(manifest['current_source_coverage']['missing_ids'], [self.missing])
        self.assertEqual(manifest['current_source_coverage']['current_inventory_sha256'], inc.digest(self.inventory))
        self.assertEqual(manifest['clips'][0]['source_text_sha256'], inc.strict.sha(b'Hallo Welt'))
        self.assertFalse(self.args.public_dir.exists())

    def test_every_requested_id_needs_qualified_supplement(self):
        self.requested.append(self.missing); self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'fully covered'): self.build()

    def test_unqualified_stale_and_duplicate_QA_cannot_be_cleared(self):
        path = self.run/'qa.json'; original = inc.read(path)
        mutations = [dict(original, status='review_required'), dict(original, failures=[{'id': self.ident, 'reason': 'word_defect'}]),
            dict(original, checked_ids=[self.ident, self.ident]), dict(original, takes=original['takes']*2),
            dict(original, clip_sha256={self.ident: 'stale'}), dict(original, manifest_sha256='stale')]
        for body in mutations:
            save(path, body); self.refresh()
            with self.subTest(body=body), self.assertRaises(inc.Invalid): self.build()
        save(path, original)

    def test_alignment_unqualified_missing_words_stale_and_bad_intervals_fail(self):
        path = self.run/'align.json'; original = inc.read(path)
        mutations = [dict(original, status='needs_review'), dict(original, requires_qualification=[self.ident]),
            dict(original, failures=[{'id': self.ident}]), dict(original, alignment_by_id={}),
            dict(original, authored_text_sha256={self.ident: 'stale'})]
        changed = copy.deepcopy(original); changed['alignment_by_id'][self.ident]['words'][1]['start'] = .2; mutations.append(changed)
        for body in mutations:
            save(path, body); self.refresh()
            with self.subTest(body=body), self.assertRaises(inc.Invalid): self.build()

    def test_unknown_duplicate_and_unrequested_supplement_scopes_fail(self):
        self.records *= 2; self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'duplicate'): self.build()
        self.records = self.records[:1]; self.requested = [self.missing]; self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'unrequested'): self.build()
        self.requested = ['story-'+'e'*24]; self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'scope'): self.build()

    def test_current_cast_text_direction_and_routes_must_match(self):
        original = copy.deepcopy(self.current)
        for field, value in [('speaker', 'azar'), ('text', 'Other words'), ('direction_en', 'Other acting'), ('performance_variant', 'new')]:
            current = copy.deepcopy(original); current['lines'][0][field] = value; save(self.inventory, current); self.refresh()
            with self.subTest(field=field), self.assertRaises(inc.Invalid): self.build()
        current = copy.deepcopy(original); current['lines'][0]['runtime_keys'][0]['mood'] = 'angry'
        current['runtime_lookup'][0]['mood'] = 'angry'; save(self.inventory, current); self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'routes'): self.build()

    def test_current_preset_source_hash_and_approved_input_tampering_fail(self):
        profiles = inc.read(self.profiles); profiles['speakers']['lia']['google_voice'] = 'Puck'
        save(self.profiles, profiles); self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'voice'): self.build()
        save(self.profiles, inc.read(self.run/'profiles.private.json')); self.refresh()
        (self.root/'game/src/chapter.ts').write_text('different Source')
        with self.assertRaisesRegex(inc.Invalid, 'source hash'): self.build()

    def test_root_and_duplicate_json_and_outside_reports_fail(self):
        original = inc.read(self.selection)
        for field, value in [('status', 'draft'), ('reviewed_by', 'agent'), ('reason', 'ok'), ('supplements_sha256', 'wrong')]:
            save(self.selection, dict(original, **{field: value}))
            with self.subTest(field=field), self.assertRaises(inc.Invalid): self.build()
        self.selection.write_text('{"status":"draft","status":"'+inc.APPROVED+'"}')
        with self.assertRaisesRegex(inc.Invalid, 'Duplicate'): self.build()
        self.refresh(); outside = self.root/'qa.json'; shutil.copy(self.run/'qa.json', outside)
        self.records[0]['qa_report'] = str(outside); self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'private'): self.build()

    def existing(self, retired=False):
        manifest, paths, _ = self.build(); clip = copy.deepcopy(manifest['clips'][0])
        clip['id'] = 'story-'+'c'*24 if retired else self.missing
        clip['audio'] = 'audio/story/'+clip['id']+'.mp3'
        if not retired:
            row = next(r for r in self.current['lines'] if r['id'] == self.missing)
            for field in ['text', 'display_text', 'runtime_keys']: clip[field] = copy.deepcopy(row[field])
        self.args.public_dir.mkdir(parents=True)
        shutil.copy(paths[self.ident], self.args.public_dir/(clip['id']+'.mp3'))
        save(self.args.public_dir/'manifest.json', {'model': inc.strict.MODEL, 'clips': [clip]})
        self.existing_hash = inc.digest(self.args.public_dir/'manifest.json'); self.refresh()
        return clip

    def test_existing_current_assets_are_verified_and_retained(self):
        clip = self.existing(); manifest, paths, coverage = self.build()
        self.assertEqual(set(paths), {self.ident, self.missing}); self.assertEqual(coverage['missing_ids'], [])
        self.assertFalse(coverage['full_original_bank_approved']); self.assertEqual(len(manifest['clips']), 2)
        (self.args.public_dir/(clip['id']+'.mp3')).write_bytes(b'corrupt')
        with self.assertRaisesRegex(inc.Invalid, 'hash differs'): self.build()

    def test_existing_extra_private_metadata_is_not_exported(self):
        self.existing(); path = self.args.public_dir/'manifest.json'
        body = inc.read(path); body['clips'][0]['private_request'] = {'secret': 'synthetic secret'}
        save(path, body); self.existing_hash = inc.digest(path); self.refresh()
        manifest, _, _ = self.build()
        self.assertNotIn('private_request', manifest['clips'][0])
        self.assertNotIn('synthetic secret', json.dumps(manifest))

    def test_retired_assets_require_exact_review_and_are_removed_atomically(self):
        old = self.existing(retired=True)
        with self.assertRaisesRegex(inc.Invalid, 'Retired'): self.build()
        self.retired = [old['id']]; self.refresh(); manifest, paths, coverage = self.build()
        self.assertEqual([r['id'] for r in coverage['retired']], self.retired)
        inc.publish(self.args.public_dir, manifest, paths)
        self.assertEqual({p.name for p in self.args.public_dir.iterdir()}, {'manifest.json', self.ident+'.mp3'})
        self.assertFalse(list(self.args.public_dir.parent.glob('.story-incremental-*')))

    def test_existing_wrong_preset_routes_cues_or_unknown_files_fail(self):
        clip = self.existing(); path = self.args.public_dir/'manifest.json'; original = inc.read(path)
        for field, value in [('voice', 'Puck'), ('runtime_keys', []), ('word_cues', [{'start': 0, 'end': 0}] )]:
            body = copy.deepcopy(original); body['clips'][0][field] = value; save(path, body)
            self.existing_hash = inc.digest(path); self.refresh()
            with self.subTest(field=field), self.assertRaises(inc.Invalid): self.build()
        save(path, original); self.existing_hash = inc.digest(path); self.refresh()
        (self.args.public_dir/'unrelated.txt').write_text('unrelated')
        with self.assertRaisesRegex(inc.Invalid, 'Unknown'): self.build()

    def test_real_scanner_output_comparison_cannot_be_skipped_for_source_drift(self):
        script = self.root/'scripts/story_voice_inventory.mjs'; script.parent.mkdir()
        # Synthetic scanner protocol only. The real production scanner is unchanged.
        script.write_text("import fs from 'node:fs'; const data="+json.dumps(self.current)+
                          "; fs.writeFileSync(process.argv[process.argv.indexOf('--output')+1],JSON.stringify(data));")
        self.assertEqual(self.actual_scanner(self.inventory, self.root)['inventory_sha256'], inc.digest(self.inventory))
        changed = copy.deepcopy(self.current); changed['lines'][0]['text'] = 'Altered inventory'
        save(self.inventory, changed)
        with self.assertRaisesRegex(inc.Invalid, 'actual scanner'): self.actual_scanner(self.inventory, self.root)

    def test_symlink_destination_and_late_appearing_bank_are_rejected(self):
        outside = self.root/'outside'; outside.mkdir(); self.args.public_dir.parent.mkdir(parents=True)
        self.args.public_dir.symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(inc.Invalid, 'destination'): self.build()
        self.args.public_dir.unlink(); manifest, paths, coverage = self.build()
        self.args.public_dir.mkdir()
        with self.assertRaisesRegex(inc.Invalid, 'Unexpected'): inc.recheck(self.root, paths, manifest, coverage)

    def test_overall_alias_selector_collisions_fail(self):
        one = {'id': self.ident, 'runtime_keys': [{'kind':'say','speaker':'lia','text':'Hallo','scene':'wald','mood':'neutral'}]}
        two = copy.deepcopy(one); two['id'] = self.missing; two['runtime_keys'][0]['speaker'] = 'lia-cloak'
        with self.assertRaisesRegex(inc.Invalid, 'Conflicting'): inc.selectors([one, two], {'lia-cloak':'lia'})

    def test_atomic_failure_restores_original_bank(self):
        old = self.existing(retired=True); self.retired = [old['id']]; self.refresh()
        manifest, paths, _ = self.build(); before = (self.args.public_dir/'manifest.json').read_bytes()
        original_rename = Path.rename
        def rename(source, destination):
            if str(source).endswith('/audio/story') and Path(destination).resolve() == self.args.public_dir.resolve():
                raise OSError('synthetic final rename failure')
            return original_rename(source, destination)
        with patch.object(Path, 'rename', rename), self.assertRaises(OSError): inc.publish(self.args.public_dir, manifest, paths)
        self.assertEqual((self.args.public_dir/'manifest.json').read_bytes(), before)
        self.assertTrue((self.args.public_dir/(old['id']+'.mp3')).is_file())
        self.assertFalse(list(self.args.public_dir.parent.glob('.story-incremental-*')))

    def test_failed_rollback_preserves_previous_bank_for_recovery(self):
        old = self.existing(retired=True); self.retired = [old['id']]; self.refresh()
        manifest, paths, _ = self.build(); original_rename = Path.rename
        def rename(source, destination):
            if Path(destination).resolve() == self.args.public_dir.resolve():
                raise OSError('synthetic install and restore failure')
            return original_rename(source, destination)
        with patch.object(Path, 'rename', rename), self.assertRaises(OSError): inc.publish(self.args.public_dir, manifest, paths)
        backups = list(self.args.public_dir.parent.glob('.story-incremental-*/previous-story'))
        self.assertEqual(len(backups), 1)
        self.assertTrue((backups[0]/(old['id']+'.mp3')).is_file())

    def test_postcopy_source_recheck_prevents_bank_swap(self):
        manifest, paths, coverage = self.build()
        def changed():
            (self.root/'game/src/chapter.ts').write_text('changed while copying')
            inc.recheck(self.root, paths, manifest, coverage)
        with self.assertRaisesRegex(inc.Invalid, 'Source changed'):
            inc.publish(self.args.public_dir, manifest, paths, before_swap=changed)
        self.assertFalse(self.args.public_dir.exists())

    def test_postcopy_frozen_evidence_and_existing_directory_tamper_fail(self):
        for filename in ['requests.jsonl', 'source-snapshot.private.json', 'collection.private.json']:
            original = (self.run/filename).read_bytes(); manifest, paths, coverage = self.build()
            (self.run/filename).write_bytes(b'changed after validation')
            with self.subTest(filename=filename), self.assertRaisesRegex(inc.Invalid, 'evidence changed'):
                inc.recheck(self.root, paths, manifest, coverage)
            (self.run/filename).write_bytes(original)
        self.existing(); manifest, paths, coverage = self.build()
        (self.args.public_dir/'unrelated.txt').write_text('late unrelated file')
        with self.assertRaisesRegex(inc.Invalid, 'directory changed'): inc.recheck(self.root, paths, manifest, coverage)

    def test_prolog_bytes_are_preserved_and_external_tamper_is_detected(self):
        path = self.root/'game/public/audio/prolog/prolog-fixture.mp3'
        path.parent.mkdir(parents=True); path.write_bytes(b'unchanged synthetic prolog')
        manifest, paths, coverage = self.build()
        inc.publish(self.args.public_dir, manifest, paths,
                    before_swap=lambda: inc.recheck(self.root, paths, manifest, coverage))
        self.assertEqual(path.read_bytes(), b'unchanged synthetic prolog')
        inc.recheck_prolog(self.root, coverage)
        path.write_bytes(b'changed elsewhere')
        with self.assertRaisesRegex(inc.Invalid, 'Prolog changed'): inc.recheck_prolog(self.root, coverage)

    def test_outside_root_selection_input_fails(self):
        outside = self.root/'outside-selection.json'; shutil.copy(self.selection, outside)
        self.args.root_selection = outside
        with self.assertRaisesRegex(inc.Invalid, 'remain private'): self.build()

    def test_alternative_profile_cannot_replace_actual_current_cast(self):
        alternative = self.run/'alternate-profiles.json'; shutil.copy(self.profiles, alternative)
        self.args.profiles = alternative
        with self.assertRaisesRegex(inc.Invalid, 'fixed cast profile'): self.build()

    def test_withdrawal_validates_every_charged_take_before_filtering(self):
        self.add_conditional_withdrawal()
        with patch.object(inc.strict, 'validate_run', wraps=inc.strict.validate_run) as validate:
            manifest, paths, coverage = self.build()
        self.assertEqual(validate.call_args.args[3], 2)
        self.assertEqual(set(paths), {self.ident}); self.assertEqual([c['id'] for c in manifest['clips']], [self.ident])
        self.assertEqual(coverage['fully_qualified_frozen_ids'], sorted([self.ident,self.removed]))
        self.assertIn(self.removed, coverage['withdrawn_ids'])
        (self.run/'clips'/(self.removed+'.mp3')).write_bytes(b'changed withdrawn audio')
        with self.assertRaisesRegex(inc.Invalid, 'evidence changed'): inc.recheck(self.root, paths, manifest, coverage)

    def test_withdrawn_unqualified_QA_or_alignment_still_blocks_publication(self):
        self.add_conditional_withdrawal(); qa_path = self.run/'qa.json'; original = inc.read(qa_path)
        qa = copy.deepcopy(original); qa['takes'][-1]['reasons'] = ['word_defect']; save(qa_path, qa); self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'qualification'): self.build()
        save(qa_path, original); align_path = self.run/'align.json'; alignment = inc.read(align_path)
        alignment['alignment_by_id'][self.removed]['words'][0]['end'] = 0; save(align_path, alignment); self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'timing'): self.build()

    def test_withdrawal_unknown_current_overlapping_undeclared_and_forged_proof_fail(self):
        self.add_conditional_withdrawal(); good = copy.deepcopy(self.withdrawn)
        for value in [{self.ident: next(iter(good.values()))}, {self.missing: next(iter(good.values()))}, {}]:
            self.withdrawn = value; self.refresh()
            with self.subTest(value=value), self.assertRaises(inc.Invalid): self.build()
        self.withdrawn = copy.deepcopy(good); self.withdrawn[self.removed]['source_branch']['when_true'] = 'Invented words'; self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'proof differs'): self.build()
        self.withdrawn = good; self.records[0]['removed_current_ids'] = []; self.refresh()
        with self.assertRaisesRegex(inc.Invalid, 'unrequested'): self.build()

    def test_withdrawal_actual_Source_semantics_and_all_reachable_pairs_required(self):
        self.add_conditional_withdrawal(); current = copy.deepcopy(self.current)
        current['lines'].append(copy.deepcopy(self.removed_row))
        with self.assertRaisesRegex(inc.Invalid, 'still-current'):
            inc.withdrawal_record(self.run,self.removed_row,current,self.inventory,self.root.resolve())
        current = copy.deepcopy(self.current); current['lines'].pop()
        with self.assertRaisesRegex(inc.Invalid, 'reachable Source pairs'):
            inc.withdrawal_record(self.run,self.removed_row,current,self.inventory,self.root.resolve())
        path = self.root/inc.WITHDRAWAL_SOURCE; path.write_text(path.read_text().replace("=== 'orwen'", "=== 'algard'"))
        with self.assertRaisesRegex(inc.Invalid, 'Source changed'):
            inc.withdrawal_record(self.run,self.removed_row,self.current,self.inventory,self.root.resolve())

    def test_replaced_audio_tamper_during_strict_copy_does_not_publish(self):
        manifest, paths, _ = self.build(); paths[self.ident].write_bytes(b'changed after validation')
        with self.assertRaisesRegex(inc.Invalid, 'Audio changed'): inc.publish(self.args.public_dir, manifest, paths)
        self.assertFalse(self.args.public_dir.exists())


if __name__ == '__main__': unittest.main()
