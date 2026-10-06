#!/usr/bin/env python3
"""Offline current-cache recovery regression; no real API or model inference."""
import copy
import unittest
from unittest.mock import patch
import story_voice_specialist_recover as recover
import story_voice_specialist_asr_test as fixtures

class RecoveryGates(unittest.TestCase):
    def setUp(self):
        self.fixture=fixtures.SpecialistTests();self.fixture.setUp();self.addCleanup(self.fixture.tearDown)
        self.fixture.prepare();self.fixture.execute()
        self.source=self.fixture.source;self.run=self.fixture.run;self.ident=self.fixture.ids[0]
        self.intent_path=self.run/(self.ident+'.intent.private.json');self.complete=recover.core.read_json(self.intent_path)
        unfinished=copy.deepcopy(self.complete);unfinished['state']='RECORDED_BEFORE_HTTP';unfinished.pop('raw_response_sha256');recover.core.save(self.intent_path,unfinished)
        noapi=patch.object(recover.core,'api',side_effect=AssertionError('Recovery must never use network'));noapi.start();self.addCleanup(noapi.stop)
    def test_crash_after_cache_save_offline_completion_and_exact_proof(self):
        before={p:p.read_bytes() for p in self.source.rglob('*') if p.is_file() and p.name!='operation.lock'}
        report=recover.recover(self.source,self.run,[self.ident]);self.assertEqual(report['completed'],1)
        self.assertEqual(before,{p:p.read_bytes() for p in self.source.rglob('*') if p.is_file() and p.name!='operation.lock'})
        with self.assertRaises(recover.core.SafeError):recover.specialist.exact_text_match_proof(self.source,self.fixture.record())
        report=recover.recover(self.source,self.run,[self.ident],True);self.assertEqual(report['network_requests'],0)
        self.assertEqual(recover.core.read_json(self.intent_path),self.complete)
        self.assertIsNotNone(recover.specialist.exact_text_match_proof(self.source,self.fixture.record()))
        self.assertEqual({p:data for p,data in before.items() if p!=self.intent_path},{p:p.read_bytes() for p in before if p!=self.intent_path})
    def test_completed_intent_preserved_byte_for_byte_idempotently(self):
        recover.core.save(self.intent_path,self.complete);before=self.intent_path.read_bytes()
        result=recover.recover(self.source,self.run,[self.ident],True)
        self.assertEqual(result['already_complete'],1);self.assertEqual(result['completed'],0);self.assertEqual(self.intent_path.read_bytes(),before)
    def test_stale_audio_unknown_intent_and_mismatched_response_refused(self):
        audio=self.source/'clips'/(self.ident+'.mp3');original=audio.read_bytes();audio.write_bytes(b'stale')
        with self.assertRaises(recover.core.SafeError):recover.recover(self.source,self.run,[self.ident],True)
        audio.write_bytes(original);intent=recover.core.read_json(self.intent_path);intent['state']='UNKNOWN';recover.core.save(self.intent_path,intent)
        with self.assertRaises(recover.core.SafeError):recover.recover(self.source,self.run,[self.ident],True)
        intent['state']='RECORDED_BEFORE_HTTP';intent['request_sha256']='b'*64;recover.core.save(self.intent_path,intent)
        with self.assertRaises(recover.core.SafeError):recover.recover(self.source,self.run,[self.ident],True)
    def test_duplicate_unknown_missing_cache_or_partial_completion_refused(self):
        for ids in [[self.ident,self.ident],['story-'+'f'*24]]:
            with self.assertRaises(recover.core.SafeError):recover.recover(self.source,self.run,ids,True)
        intent=recover.core.read_json(self.intent_path);intent['raw_response_sha256']='b'*64;recover.core.save(self.intent_path,intent)
        with self.assertRaises(recover.core.SafeError):recover.recover(self.source,self.run,[self.ident],True)
        _,binding=recover.specialist.current_binding(self.source,self.ident,recover.specialist.source_state(self.source))
        recover.specialist.cache_path(self.fixture.folder,self.ident,binding).unlink()
        with self.assertRaises(recover.core.SafeError):recover.recover(self.source,self.run,[self.ident],True)
    def test_raw_response_and_frozen_scope_changes_rejected_without_intent_write(self):
        intent_before=self.intent_path.read_bytes()
        for path in [self.run/(self.ident+'.response.private.json'),self.run/'scope.private.json',self.source/'profiles.private.json']:
            before=path.read_bytes();path.write_bytes(before+b' ')
            with self.assertRaises(recover.core.SafeError):recover.recover(self.source,self.run,[self.ident],True)
            self.assertEqual(self.intent_path.read_bytes(),intent_before);path.write_bytes(before)

if __name__=='__main__':unittest.main()
