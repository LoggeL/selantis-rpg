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

    def test_vocal_events_four_cry_forms_preserve_words_flags_and_source(self):
        frozen=(self.run/'requests.jsonl').read_bytes()
        for cry,tag in [('AAH!','<scream>'),('AAAAH!','<shriek>'),('Aaah…','<shout>'),('„AAAAAH!“','<scream>')]:
            record=copy.deepcopy(self.records[0]);record['request']['contents'][0]['parts'][0]['text']='Nein!  '+cry+' Lauf, Lia!'
            record['request']['contents'][0]['parts'][0]['speechMetadata']['speaker']='lia'
            old=copy.deepcopy(record);selected={record['key']}
            value={'delivery_style':'Sudden sharp cry.','vocal_events':[{'word_index':1,'source_word':cry,'tag':tag}]}
            changed=generate.apply_delivery_overrides([record,self.records[2]],selected,{record['key']:value})
            actual=changed[0]['request']['contents'][0]['parts'][0]
            self.assertTrue(actual['text'].startswith('Nein!  '));self.assertTrue(actual['text'].endswith(' Lauf, Lia!'))
            self.assertIn(tag,actual['text']);self.assertEqual(actual['speechMetadata']['speaker'],'lia')
            self.assertEqual(changed[0]['request']['generationConfig'],old['request']['generationConfig'])
            self.assertEqual(record,old);self.assertIs(changed[1],self.records[2])
            self.assertEqual(changed[0]['delivery_override']['source_text_sha256'],core.digest(old['request']['contents'][0]['parts'][0]['text'].encode()))
            self.assertEqual(changed[0]['delivery_override']['parts'][0]['text'],actual['text'])
        self.assertEqual(frozen,(self.run/'requests.jsonl').read_bytes())

    def test_vocal_events_invalid_scope_words_tags_and_duplicate_indices(self):
        record=copy.deepcopy(self.records[0]);record['request']['contents'][0]['parts'][0]['text']='AAAH! Lia Ha Au'
        event={'word_index':0,'source_word':'AAAH!','tag':'<scream>'}
        bad_events=[[{**event,'word_index':True}],[{**event,'word_index':-1}],[{**event,'word_index':99}],
                    [{**event,'source_word':'AAAAH!'}],[{**event,'tag':' <shriek>'}],[{**event,'tag':'<groan>'}],
                    [event,event],[{**event,'word_index':1,'source_word':'Lia'}],[{**event,'word_index':2,'source_word':'Ha'}],
                    [{**event,'word_index':3,'source_word':'Au'}],[],[{**event,'extra':True}]]
        for events in bad_events:
            value={'delivery_style':'Sharp cry.','vocal_events':events}
            with self.assertRaises(core.SafeError):generate.apply_delivery_overrides([record],{record['key']},{record['key']:value})
        value={'delivery_style':'Sharp cry.','vocal_events':[event],'retake_text':'AAAH! Lia Ha Au'}
        self.path.write_text(json.dumps({record['key']:value}))
        with self.assertRaises(core.SafeError):generate.load_delivery_overrides(self.path,{record['key']})

    def test_vocal_events_stale_token_rejected_before_credentials_or_archive(self):
        self.plan[self.ids[0]]={'delivery_style':'Sharp cry.','vocal_events':[{'word_index':0,'source_word':'AAAH!','tag':'<scream>'}]}
        self.path.write_text(json.dumps(self.plan))
        argv=['story_voice_generate.py','--run-dir',str(self.run),'--only-ids',','.join(self.ids[:2]),'--retake','--delivery-overrides',str(self.path)]
        with patch.object(sys,'argv',argv),patch.object(generate.common,'configure'),patch.object(generate.common,'prepared'),patch.object(core,'credential',side_effect=AssertionError('No key read')),contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(generate.main(),1)
        self.assertFalse((self.run/'rejected').exists())

    def test_explicit_pfff_native_event_preserves_all_other_text_and_voice(self):
        record=copy.deepcopy(self.records[0]);record['request']['contents'][0]['parts'][0]['text']='Gleich, gleich … klack … Pfff.';original=copy.deepcopy(record)
        value={'delivery_style':'One dismissive lip burst.','vocal_events':[{'word_index':5,'source_word':'Pfff.','tag':'<pff>'}]}
        actual=generate.apply_delivery_overrides([record,self.records[2]],{record['key']},{record['key']:value})
        self.assertEqual(actual[0]['request']['contents'][0]['parts'][0]['text'],'Gleich, gleich … klack … <pff>.')
        self.assertEqual(actual[0]['request']['generationConfig'],original['request']['generationConfig']);self.assertEqual(record,original);self.assertIs(actual[1],self.records[2])
        self.assertEqual(actual[0]['delivery_override']['source_text_sha256'],core.digest(original['request']['contents'][0]['parts'][0]['text'].encode()))
        for word in ['Pff!','Pfff.','Ppfff…']:
            generate.validate_vocal_events([{'word_index':0,'source_word':word,'tag':'<pff>'}])

    def test_pff_wrong_token_index_and_cross_event_tags_rejected(self):
        record=copy.deepcopy(self.records[0]);record['request']['contents'][0]['parts'][0]['text']='Gleich, gleich … klack … Pfff.'
        event={'word_index':5,'source_word':'Pfff.','tag':'<pff>'}
        for changed in [{**event,'word_index':3},{**event,'source_word':'Pff.'},{**event,'tag':'<phew>'},{**event,'tag':' <pff>'},{**event,'tag':'<scream>'}]:
            with self.assertRaises(core.SafeError):generate.vocal_event_record(record,{'delivery_style':'Brief burst.','vocal_events':[changed]})
        for word,tag in [('Pof.','<pff>'),('Puh!','<pff>'),('Pfeffer','<pff>'),('Pf2','<pff>'),('AAAH!','<pff>'),('Pfff.','<shriek>')]:
            with self.assertRaises(core.SafeError):generate.validate_vocal_events([{'word_index':0,'source_word':word,'tag':tag}])

    def test_five_native_families_preserve_exact_body_punctuation_style_and_voice(self):
        cases=[('Hmpf.','<grunt>'),('Ugh!','<groan>'),('„Mmmpf!“','<grunt>'),('Mmh…','<moan>'),('Hohoho!','<laugh>')]
        for word,tag in cases:
            record=copy.deepcopy(self.records[0]);record['request']['contents'][0]['parts'][0]['text']='Dann  '+word+' Dann, bleib hier.';old=copy.deepcopy(record)
            value={'delivery_style':'German, original feeling.','vocal_events':[{'word_index':1,'source_word':word,'tag':tag}]}
            actual=generate.apply_delivery_overrides([record],{record['key']},{record['key']:value})[0]
            part=actual['request']['contents'][0]['parts'][0];self.assertTrue(part['text'].startswith('Dann  '));self.assertTrue(part['text'].endswith(' Dann, bleib hier.'));self.assertIn(tag,part['text']);self.assertEqual(part['speechMetadata']['style'],value['delivery_style'])
            self.assertEqual(record,old);self.assertEqual(actual['request']['generationConfig'],old['request']['generationConfig']);self.assertEqual(actual['delivery_override']['vocal_events'],value['vocal_events'])
            self.assertEqual(part['text'].count(tag),1)
        self.assertEqual(generate.vocal_event_record({**self.records[0],'request':{'contents':[{'parts':[{'text':'„Mmmpf!“'}]}]}},{'delivery_style':'Brief.','vocal_events':[{'word_index':0,'source_word':'„Mmmpf!“','tag':'<grunt>'}]})['request']['contents'][0]['parts'][0]['text'],'„<grunt>!“')

    def test_native_families_no_lexical_rewrite_wrong_tags_token_index_or_conflict(self):
        for word in ['He!','Ach.','Hm','Oh','Ha!','Ho','Lia','Foltan','Hmpfer','Ugh2','Mmmpfa','Mmhmm','Hahaha']:
            with self.assertRaises(core.SafeError):generate.validate_vocal_events([{'word_index':0,'source_word':word,'tag':'<grunt>'}])
        for word,allowed in [('Hmpf','<grunt>'),('Ugh','<groan>'),('Mmmpf','<grunt>'),('Mmh','<moan>'),('Hohoho','<laugh>')]:
            for wrong in {'<grunt>','<groan>','<moan>','<laugh>','<pff>','<scream>'}-{allowed}:
                with self.assertRaises(core.SafeError):generate.validate_vocal_events([{'word_index':0,'source_word':word,'tag':wrong}])
            record=copy.deepcopy(self.records[0]);record['request']['contents'][0]['parts'][0]['text']=word+' Dann dann.'
            event={'word_index':0,'source_word':word,'tag':allowed}
            for bad in [{**event,'word_index':1},{**event,'source_word':word+'!'},{**event,'word_index':True}]:
                with self.assertRaises(core.SafeError):generate.vocal_event_record(record,{'delivery_style':'German.','vocal_events':[bad]})
            with self.assertRaises(core.SafeError):generate.vocal_event_record(record,{'delivery_style':'German.','vocal_events':[event],'retake_text':record['request']['contents'][0]['parts'][0]['text']})


class PronunciationBreakExperiments(unittest.TestCase):
    def setUp(self):
        self.ident='story-'+'a'*24
        self.source='„Foltan!“  Orwen, hilft Foltan?'
        self.record={'key':self.ident,'request':{'model':'gemini-3.8-flash-tts','contents':[{'parts':[{'text':self.source,'speechMetadata':{'style':'Original style','speaker':'azar'}}]}],'generationConfig':{'speechConfig':{'voiceConfig':{'voice':'Zubenelgenubi'},'languageCode':'de-DE'}}}}
        self.value={'delivery_style':'German, natural delivery.','pronunciation_breaks':[{'word_index':0,'source_word':'„Foltan!“','split_after_letters':3},{'word_index':1,'source_word':'Orwen,','split_after_letters':2}]}
    def test_exact_tags_full_body_unicode_whitespace_and_payload_preservation(self):
        original=copy.deepcopy(self.record)
        out=generate.pronunciation_break_record(self.record,self.value)
        part=out['request']['contents'][0]['parts'][0]
        self.assertEqual(part['text'],'„Fol<short pause>tan!“  Or<short pause>wen, hilft Foltan?')
        self.assertEqual(part['text'].replace('<short pause>',''),self.source)
        self.assertEqual(part['speechMetadata'],{'style':self.value['delivery_style'],'speaker':'azar'})
        self.assertEqual(out['request']['model'],original['request']['model'])
        self.assertEqual(out['request']['generationConfig'],original['request']['generationConfig'])
        self.assertEqual(out['delivery_override']['source_text_sha256'],core.digest(self.source.encode()))
        self.assertEqual(out['delivery_override']['parts'][0]['text'],part['text'])
        self.assertEqual(out['delivery_override']['pronunciation_breaks'],self.value['pronunciation_breaks'])
        self.assertEqual(self.record,original)
    def test_wrong_names_letters_index_tag_schema_and_split_fail_closed(self):
        event=self.value['pronunciation_breaks'][0]
        changes=[{'word_index':True},{'word_index':-1},{'word_index':100},{'word_index':1},{'source_word':'Foltan!'},
                 {'source_word':'Lia'},{'source_word':'Fol-tan'},{'source_word':'Foltans'},{'source_word':'Fol2tan'},
                 {'split_after_letters':True},{'split_after_letters':0},{'split_after_letters':6},{'split_after_letters':7},
                 {'split_after_letters':2.5},{'tag':'<pause>'},{'source_word':'Ｆoltan'}]
        for change in changes:
            with self.subTest(change=change),self.assertRaises(core.SafeError):
                generate.pronunciation_break_record(self.record,{'delivery_style':'German.','pronunciation_breaks':[{**event,**change}]})
        for events in [[],[event,event],None]:
            with self.assertRaises(core.SafeError):generate.pronunciation_break_record(self.record,{'delivery_style':'German.','pronunciation_breaks':events})
    def test_conflicts_rejected_via_loader_and_direct_application(self):
        for field,value in [('retake_text',self.source),('vocal_events',[]),('other',True)]:
            plan={**self.value,field:value}
            with self.assertRaises(core.SafeError):generate.apply_delivery_overrides([self.record],{self.ident},{self.ident:plan})
            with tempfile.TemporaryDirectory() as folder:
                path=Path(folder)/'plan.json';path.write_text(json.dumps({self.ident:plan}))
                with self.assertRaises(core.SafeError):generate.load_delivery_overrides(path,{self.ident})
    def test_existing_types_are_byte_identical_and_unselected_identity_retained(self):
        original=json.dumps(self.record,sort_keys=True)
        style={'delivery_style':'German.'}
        expected=generate.standard.delivery_record(self.record,{self.ident},style['delivery_style'])
        actual=generate.apply_delivery_overrides([self.record],{self.ident},{self.ident:style})[0]
        self.assertEqual(json.dumps(actual,sort_keys=True),json.dumps(expected,sort_keys=True))
        other={'key':'story-'+'b'*24,'request':self.record['request']}
        changed=generate.apply_delivery_overrides([self.record,other],{self.ident},{self.ident:self.value})
        self.assertIs(changed[1],other);self.assertEqual(json.dumps(self.record,sort_keys=True),original)
    def test_multiple_text_parts_and_preexisting_tag_refused(self):
        record=copy.deepcopy(self.record);record['request']['contents'][0]['parts'].append({'text':'Body'})
        with self.assertRaises(core.SafeError):generate.pronunciation_break_record(record,self.value)
        record=copy.deepcopy(self.record);record['request']['contents'][0]['parts'][0]['text']+='<short pause>'
        with self.assertRaises(core.SafeError):generate.pronunciation_break_record(record,self.value)
    def test_loader_valid_exact_plan_and_frozen_repeated_name_positions(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'plan.json';p.write_text(json.dumps({self.ident:self.value}))
            self.assertEqual(generate.load_delivery_overrides(p,{self.ident}),{self.ident:self.value})
        value={'delivery_style':'German.','pronunciation_breaks':[{'word_index':3,'source_word':'Foltan?','split_after_letters':3}]}
        out=generate.pronunciation_break_record(self.record,value)
        self.assertEqual(out['request']['contents'][0]['parts'][0]['text'],'„Foltan!“  Orwen, hilft Fol<short pause>tan?')

if __name__=='__main__':unittest.main()
