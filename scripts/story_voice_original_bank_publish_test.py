"""Offline original/current publication boundaries; no genuine approvals written."""
import ast
import copy
import inspect
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import story_voice_original_bank_publish as original
import story_voice_publish_test as fixtures
import story_voice_incremental_publish as incremental


class GuardTests(unittest.TestCase):
    def test_complete_original_validator_ast_preserved_except_single_interval_predicate(self):
        before=ast.parse(inspect.getsource(original.strict.validate_run)).body[0]
        after=ast.parse(inspect.getsource(original._original_guards)).body[0]
        after.name=before.name
        class Interval(ast.NodeTransformer):
            replaced=0
            def visit_Call(self,node):
                if isinstance(node.func,ast.Name) and node.func.id=='require' and len(node.args)==2 \
                        and isinstance(node.args[1],ast.Constant) and node.args[1].value=='Invalid aligned timing':
                    self.replaced+=1
                    node.args[0]=ast.parse('_valid_interval(run, line, entry, word, previous, seconds)',mode='eval').body
                return self.generic_visit(node)
        transform=Interval();before=transform.visit(before)
        self.assertEqual(transform.replaced,1)
        self.assertEqual(ast.dump(before,include_attributes=False),ast.dump(after,include_attributes=False))

    def test_different_run_name_path_and_count_never_enable_original_policy(self):
        self.assertFalse(original.supports_run(Path('/tmp/2026-10-05-all-chapters'),1557))
        self.assertFalse(original.supports_run(original.ORIGINAL_RUN,1556))
        self.assertFalse(original.supports_run(original.ORIGINAL_RUN,490))

    def test_only_unspoken_punctuation_at_previous_actual_end_is_zero(self):
        line={'text':'Wort … weiter'};words=[{'word':'Wort','start':.1,'end':.5},
            {'word':'…','start':.5,'end':.5},{'word':'weiter','start':.6,'end':1.}]
        entry={'words':words}
        with patch.object(original,'_bound_receipt',return_value={'words':[{'spoken':True},{'spoken':False},{'spoken':True}]}):
            self.assertTrue(original._valid_interval(Path('/tmp'),line,entry,words[1],.5,1.))
            for text in ('Ha','Ich','5','€',''):
                words[1]['word']=text
                self.assertFalse(original._valid_interval(Path('/tmp'),line,entry,words[1],.5,1.))
            words[1]['word']='…';words[1]['start']=words[1]['end']=.7
            self.assertFalse(original._valid_interval(Path('/tmp'),line,entry,words[1],.5,1.))
        words[1]['start']=words[1]['end']=.5
        with patch.object(original,'_bound_receipt',return_value={'words':[{}, {'spoken':True},{}]}):
            self.assertFalse(original._valid_interval(Path('/tmp'),line,entry,words[1],.5,1.))

    def test_nonfinite_bool_overlap_and_outside_duration_are_rejected(self):
        for start,end in ((True,.5),(.1,False),(float('nan'),.5),(.1,float('inf')),(.1,.6),(.5,1.1)):
            self.assertFalse(original._valid_interval(Path('/tmp'),{}, {}, {'word':'Wort','start':start,'end':end},.5,1.))

    def test_no_generic_external_model_or_original_run_import(self):
        with self.assertRaisesRegex(original.strict.Invalid,'exact historical run'):
            original._pff_evidence(Path('/tmp/2026-10-05-all-chapters'))

    def test_full_qa_guard_still_rejects_flags_duplicate_coverage_stale_hashes_and_spoken_zero(self):
        fixture=fixtures.PublisherTests();fixture.setUp();self.addCleanup(fixture.tearDown)
        path=fixture.run/'qa.json';clean=original.read(path)
        for mutation in (dict(clean,status='review_required'),dict(clean,failures=[{'id':fixture.ident,'reason':'word'}]),
                         dict(clean,checked_ids=[fixture.ident,fixture.ident]),dict(clean,clip_sha256={fixture.ident:'stale'})):
            fixtures.save(path,mutation)
            with self.subTest(mutation=mutation),self.assertRaises(original.strict.Invalid):
                original._original_guards(fixture.run,path,fixture.run/'align.json',1,fixture.root)
        fixtures.save(path,clean)
        alignment=original.read(fixture.run/'align.json');alignment['alignment_by_id'][fixture.ident]['words'][0]['end']=0.
        fixtures.save(fixture.run/'align.json',alignment)
        with self.assertRaisesRegex(original.strict.Invalid,'aligned timing'):
            original._original_guards(fixture.run,path,fixture.run/'align.json',1,fixture.root)

    def test_no_arbitrary_root_marker_or_unknown_engine(self):
        with self.assertRaisesRegex(original.strict.Invalid,'Unknown or changed'):
            original._historical_evidence(Path('/tmp'),{'id':'story-'+'f'*24,'engine_version':original.ALIGNMENT_ENGINE+'/private-root-made-up'}, {},{})

    def test_original_retained_policy_does_not_accept_rewrite_or_bare_marker(self):
        for marker in ({'method':original.VERSION},{'method':'one-frozen-rewrite-490-receipt-bound-punctuation-v2'},None):
            with self.subTest(marker=marker),self.assertRaisesRegex(original.strict.Invalid,'Malformed'):
                original.validate_retained_clip({'timing_policy':marker}, {},Path('/tmp'))

    def test_fixed_voice_role_source_direction_and_route_bodies_remain_strict(self):
        row={'id':'id','kind':'say','speaker':'lia','text':'Hallo','display_text':'Hallo',
             'direction_en':'quiet','performance_variant':'same','mood':'neutral',
             'runtime_keys':[{'speaker':'lia','kind':'say','text':'Hallo','scene':'strasse','mood':'neutral'}]}
        profiles={'speakers':{'lia':{'google_voice':'Zephyr'}}}
        current=copy.deepcopy(row);current['mood']='surprised';current['runtime_keys'][0]['mood']='surprised'
        self.assertEqual(original._identity_without_mood(row,current,profiles,profiles),'Zephyr')
        for key,value in (('speaker','azar'),('text','Guten Tag'),('direction_en','new emotion'),('performance_variant','new')):
            incoming=copy.deepcopy(current);incoming[key]=value
            with self.subTest(key=key),self.assertRaisesRegex(original.strict.Invalid,'identity'):
                original._identity_without_mood(row,incoming,profiles,profiles)
        incoming=copy.deepcopy(current);incoming['runtime_keys'][0]['scene']='other'
        with self.assertRaisesRegex(original.strict.Invalid,'route body'):
            original._identity_without_mood(row,incoming,profiles,profiles)
        with self.assertRaisesRegex(original.strict.Invalid,'voice'):
            original._identity_without_mood(row,current,profiles,{'speakers':{'lia':{'google_voice':'Puck'}}})


@unittest.skipUnless(original.ORIGINAL_RUN.is_dir(), 'Historical private evidence unavailable')
class HistoricalReferenceTests(unittest.TestCase):
    def test_real_1576_source_closure_is_exact_1089_shared_468_absent_and_37_mood_only(self):
        root=Path(original.__file__).resolve().parents[1];inventory=root/'docs/voice-production/story-lines.json'
        proposal=original.closure_proposal(original.ORIGINAL_RUN,original.read(inventory),inventory,
                                            original.read(root/'docs/voice-production/story-speakers.json'))
        self.assertEqual(proposal['status'],'root_review_required')
        self.assertEqual(len(proposal['shared_ids']),1089)
        self.assertEqual(len(proposal['absent_original_ids']),468)
        self.assertEqual(len(proposal['mood_rebindings']),37)
        self.assertTrue(all(row['reason'] is None for field in ('absent_original_ids','mood_rebindings') for row in proposal[field]))
        self.assertEqual(sum(a['mood']!=b['mood'] for row in proposal['mood_rebindings']
                             for a,b in zip(row['runtime_keys_before'],row['runtime_keys_after'])),39)

    def test_actual_full_run_preserves_directions_and_derived_guard_then_blocks_incomplete_qa(self):
        qa=original.ORIGINAL_RUN/'qa-pass69b-additive.private.json';alignment=original.ORIGINAL_RUN/'word-cues/alignment.private.json'
        with self.assertRaisesRegex(original.strict.Invalid,'QA/alignment not final passing'):
            original.validate_run(original.ORIGINAL_RUN,qa,alignment,1557)

    def test_historical_scopes_are_exact_pins_including_base_engine_adoptions(self):
        self.assertEqual(len(original.HISTORICAL_PRIVATE_PINS),90)
        target=original.HISTORICAL_PRIVATE_PINS['story-38dfebeaa7673b7426ba093d']
        self.assertEqual(target['engine'],original.ALIGNMENT_ENGINE)
        self.assertIn('timing-root-scoped-pass35',target['original_receipt'])
        self.assertTrue(all(pin['original_receipt'] in pin['evidence_sha256'] for pin in original.HISTORICAL_PRIVATE_PINS.values()))

    def test_real_source38_retained_ellipsis_gap_cannot_be_a_global_zero_exception(self):
        ident='story-38dfebeaa7673b7426ba093d'
        receipt=original.read(original.ORIGINAL_RUN/'word-cues'/(ident+'.json'))
        line=next(row for row in original.read(original.ORIGINAL_RUN/'lines.private.json')['lines'] if row['id']==ident)
        words=[{'word':word,**cue} for word,cue in zip(original.acoustic.normalized_text(line['text']).split(),receipt['word_cues'])]
        self.assertEqual(words[6]['word'],'…')
        entry={'words':words,'cues_sha256':receipt['cues_sha256']}
        self.assertTrue(original._valid_interval(original.ORIGINAL_RUN,line,entry,words[6],words[5]['end'],receipt['decoded_seconds']))
        changed=copy.deepcopy(entry);changed['words'][6]['start']=changed['words'][6]['end']=7.19
        self.assertFalse(original._valid_interval(original.ORIGINAL_RUN,line,changed,changed['words'][6],words[5]['end'],receipt['decoded_seconds']))
        other=dict(line,id='story-'+'a'*24)
        self.assertFalse(original._valid_interval(original.ORIGINAL_RUN,other,entry,words[6],words[5]['end'],receipt['decoded_seconds']))

    def test_reconstructing_exact_actual_receipt_policy_cannot_retain_an_open_word_take(self):
        ident='story-45cf6c5149543786a3a5a23b';run=original.ORIGINAL_RUN
        row=next(r for r in original.read(run/'lines.private.json')['lines'] if r['id']==ident)
        receipt=original.read(run/'word-cues'/(ident+'.json'))
        clip={**{key:row[key] for key in ('id','kind','speaker','text','display_text','runtime_keys')},
              'audio':'audio/story/'+ident+'.mp3','sha256':original.digest(run/'clips'/(ident+'.mp3')),
              'seconds':receipt['decoded_seconds'],'voice':original.read(run/'profiles.private.json')['speakers'][row['speaker']]['google_voice'],
              'word_cues':receipt['word_cues']}
        clip['timing_policy']=original._policy(run,row,clip,{})
        root=Path(original.__file__).resolve().parents[1]
        current=next(r for r in original.read(root/'docs/voice-production/story-lines.json')['lines'] if r['id']==ident)
        with self.assertRaisesRegex(original.strict.Invalid,'complete current1557 QA/Alignment'):
            original.validate_retained_clip(clip,current,root)
        without=copy.deepcopy(clip);without.pop('timing_policy')
        with self.assertRaisesRegex(original.strict.Invalid,'requires its full qualification policy'):
            incremental.cue_check(without,current,root)
        with self.assertRaisesRegex(original.strict.Invalid,'complete original bank qualification'):
            original.validate_retained_bank({'clips':[clip]},root,
                original.read(root/'docs/voice-production/story-speakers.json'),{current['id']:current})

    def test_source38_exact_original_root_pause_evidence_has_a_separate_qualification_archive(self):
        line=next(r for r in original.read(original.ORIGINAL_RUN/'lines.private.json')['lines'] if r['id']==original.SOURCE38)
        files=original._source38_pause_evidence(original.ORIGINAL_RUN,line)
        self.assertIn(original.ORIGINAL_RUN/original.SOURCE38_QUALIFICATION_ARCHIVE,files)
        self.assertNotIn(original.ORIGINAL_RUN/'word-cues/qualifications.private.json',files)


if __name__=='__main__':unittest.main()
