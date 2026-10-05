#!/usr/bin/env python3
"""Offline per-ID delivery plan guards; no credentials, audio/model or API work."""
import contextlib
import copy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import story_voice_generate as generate
from story_voice_generate import core

class DeliveryOverridePlanGates(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.run=Path(self.temp.name).resolve();self.ids=['story-'+str(i)*24 for i in [1,2,3]]
        self.rows=[{'id':i,'speaker':'lia','kind':'say','text':text,'display_text':text} for i,text in zip(self.ids,['in seine Hand','Wer ist da?','Unverändert.'])]
        self.records=[{'key':r['id'],'request':{'contents':[{'parts':[{'text':r['text'],'speechMetadata':{'style':'Original emotion.'}}]}],'generationConfig':{'speechConfig':{'voiceConfig':{'voice':'Kore'}}}}} for r in self.rows]
        self.selected=set(self.ids[:2]);self.plan={self.ids[0]:{'delivery_style':'Warm and resolute.','retake_text':'IN SEINE <short pause> HAND.'},self.ids[1]:{'delivery_style':'Fearful, questioning.'}}
        self.path=self.run/'private-plan.json';self.path.write_text(json.dumps(self.plan))
        (self.run/'requests.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in self.records))
        core.save(self.run/'profiles.private.json',{'speakers':{}});core.save(self.run/'lines.private.json',{'lines':self.rows})
        (self.run/'raw').mkdir();(self.run/'clips').mkdir()
        for ident in self.selected:
            (self.run/'raw'/(ident+'.wav')).write_bytes(b'KEEP ORIGINAL WAV')
            (self.run/'clips'/(ident+'.mp3')).write_bytes(b'KEEP ORIGINAL MP3')
            core.save(self.run/'raw'/(ident+'.receipt.json'),{'status':'complete'})

    def test_selected_individual_styles_original_voice_and_frozen_jsonl_unchanged(self):
        old=copy.deepcopy(self.records);before=(self.run/'requests.jsonl').read_bytes()
        plan=generate.load_delivery_overrides(self.path,self.selected)
        changed=generate.apply_delivery_overrides(self.records,self.selected,plan)
        self.assertEqual(self.records,old);self.assertIs(changed[2],self.records[2])
        self.assertEqual(changed[0]['request']['contents'][0]['parts'][0]['speechMetadata']['style'],'Warm and resolute.')
        self.assertEqual(changed[1]['request']['contents'][0]['parts'][0]['speechMetadata']['style'],'Fearful, questioning.')
        self.assertEqual(changed[0]['request']['generationConfig'],old[0]['request']['generationConfig'])
        self.assertEqual(changed[0]['delivery_override']['parts'][0]['text'],'IN SEINE <short pause> HAND.')
        self.assertEqual((self.run/'requests.jsonl').read_bytes(),before)

    def test_missing_extra_or_duplicate_plan_ids_rejected(self):
        for plan in [{self.ids[0]:self.plan[self.ids[0]]},{**self.plan,self.ids[2]:{'delivery_style':'Extra.'}}]:
            self.path.write_text(json.dumps(plan))
            with self.assertRaises(core.SafeError):generate.load_delivery_overrides(self.path,self.selected)
        self.path.write_text('{'+json.dumps(self.ids[0])+':{"delivery_style":"A"},'+json.dumps(self.ids[0])+':{"delivery_style":"B"},'+json.dumps(self.ids[1])+':{"delivery_style":"C"}}')
        with self.assertRaises(core.SafeError):generate.load_delivery_overrides(self.path,self.selected)

    def test_illegal_words_tags_long_style_and_unexpected_fields(self):
        for entry in [{'delivery_style':'Calm.','retake_text':'in seiner Hand'}, {'delivery_style':'Calm.','retake_text':'in seine <laugh> Hand'}, {'delivery_style':'x'*301}, {'delivery_style':'',}, {'delivery_style':'Calm.','unknown':'forbidden'}, {'delivery_style':None}]:
            plan={**self.plan,self.ids[0]:entry};self.path.write_text(json.dumps(plan))
            with self.assertRaises(core.SafeError):
                overrides=generate.load_delivery_overrides(self.path,self.selected)
                generate.apply_delivery_overrides(self.records,self.selected,overrides)

    def test_cli_conflicts_fail_before_credentials(self):
        cases=[[],['--retake','--export-only'],['--retake','--delivery-style','Calm.'],['--retake','--retake-text','in seine Hand']]
        for flags in cases:
            argv=['script','--run-dir',str(self.run),'--only-ids',','.join(self.selected),'--delivery-overrides',str(self.path),*flags]
            with patch.object(sys,'argv',argv),patch.object(core,'credential',side_effect=AssertionError('No key access')) as keys,contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):generate.main()
                self.assertEqual(keys.call_count,0)

    def test_invalid_plan_never_reads_key_archives_or_changes_audio(self):
        before={p:p.read_bytes() for d in ['raw','clips'] for p in (self.run/d).iterdir()}
        plan=copy.deepcopy(self.plan);plan[self.ids[0]]['retake_text']='in seiner Hand';self.path.write_text(json.dumps(plan))
        argv=['script','--run-dir',str(self.run),'--only-ids',','.join(self.selected),'--retake','--delivery-overrides',str(self.path)]
        with patch.object(sys,'argv',argv),patch.object(core,'directory',return_value=self.run),patch.object(generate.common,'prepared'),patch.object(core,'credential',side_effect=AssertionError('No key access')) as keys,patch.object(generate.standard,'make_clip',side_effect=AssertionError('No audio/API work')),contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(generate.main(),1);self.assertEqual(keys.call_count,0)
        self.assertFalse((self.run/'rejected').exists())
        self.assertEqual(before,{p:p.read_bytes() for d in ['raw','clips'] for p in (self.run/d).iterdir()})

if __name__=='__main__':unittest.main()
