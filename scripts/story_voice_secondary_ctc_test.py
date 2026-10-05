#!/usr/bin/env python3
"""Offline secondary-driver fixtures. No downloads, model loads or GPU work."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import story_voice_secondary_ctc as secondary

class SecondaryCTC(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.directory=self.root/'model';self.directory.mkdir()
        self.vocab={'<pad>':0,'<s>':1,'</s>':2,'<unk>':3,'|':4,'h':5,'e':6,'ß':7}
        for name,data in [('config.json',{'pad_token_id':1}),('preprocessor_config.json',{'do_normalize':True,'sampling_rate':16000}),('vocab.json',self.vocab),('tokenizer_config.json',{})]:
            (self.directory/name).write_text(json.dumps(data))
        (self.directory/'pytorch_model.bin').write_bytes(b'offline fake weights')
        self.run=self.root/'run';(self.run/'clips').mkdir(parents=True)
        self.ident='story-'+'a'*24;self.line={'id':self.ident,'text':'He'}
        self.manifest=self.run/'lines.private.json';self.manifest.write_text(json.dumps({'lines':[self.line]}))
        self.clip=self.run/'clips'/(self.ident+'.mp3');self.clip.write_bytes(b'offline fake mp3')
        self.report=self.run/'qa.private.json'
        self.qa={'manifest_sha256':secondary.qa.digest(self.manifest),'clip_sha256':{self.ident:secondary.qa.digest(self.clip)},
                 'checked_ids':[self.ident],'takes':[{'id':self.ident,'text_sha256':secondary.qa.text_hash('He'),'transcript':'He','reasons':[]}],'failures':[]}
        self.report.write_text(json.dumps(self.qa));self.target=self.run/'ctc-secondary'
    def tearDown(self):self.temp.cleanup()
    def test_distinct_provenance_original_bytes_unchanged(self):
        original=Path(secondary.parent.__file__);before=secondary.qa.digest(original)
        old_engine,old_model=secondary.parent.ENGINE,secondary.parent.MODEL_ID
        identity=secondary.model_identity(self.directory,secondary.REVISION)
        self.assertEqual(identity['model_id'],secondary.MODEL_ID)
        self.assertNotEqual(identity['model_id'],old_model);self.assertNotEqual(secondary.ENGINE,old_engine)
        self.assertEqual(identity['parent_ctc_script_sha256'],before)
        self.assertEqual(identity['driver_script_sha256'],secondary.qa.digest(Path(secondary.__file__)))
        self.assertEqual(secondary.qa.digest(original),before)
        self.assertEqual((secondary.parent.ENGINE,secondary.parent.MODEL_ID),(old_engine,old_model))
    def test_exact_revision_and_changed_weights(self):
        with self.assertRaises(ValueError):secondary.model_identity(self.directory,'0'*40)
        first=secondary.model_identity(self.directory,secondary.REVISION)
        (self.directory/'pytorch_model.bin').write_bytes(b'different fake weights')
        self.assertNotEqual(first['fingerprint'],secondary.model_identity(self.directory,secondary.REVISION)['fingerprint'])
    def test_blank_zero_from_tokenizer_not_config_one(self):
        result=secondary.validate_runtime(self.vocab,self.vocab,0,1,len(self.vocab),True,16000)
        self.assertEqual(result['blank_token_id'],0);self.assertTrue(result['config_blank_disagreement'])
    def test_width_vocab_processor_reject(self):
        for arguments in [(self.vocab,self.vocab,1,1,len(self.vocab),True,16000),
                          (self.vocab,self.vocab,0,1,len(self.vocab)+1,True,16000),
                          (self.vocab,dict(self.vocab,extra=8),0,1,len(self.vocab),True,16000),
                          (self.vocab,self.vocab,0,1,len(self.vocab),False,16000)]:
            with self.assertRaises(ValueError):secondary.validate_runtime(*arguments)
    def test_lossless_case_projection_and_original_words(self):
        mapping=secondary.project_authored('He ß!',self.vocab)
        self.assertEqual(mapping['display_words'],['He','ß!']);self.assertEqual(mapping['characters'],['h','e','|','ß'])
        self.assertEqual(mapping['case_projection'],[{'word_index':0,'character_index':0,'source':'H','projected':'h','operation':'Unicode_single_character_lowercase'}])
    def test_no_semantic_or_multichar_mapping(self):
        for text in ['İ','42','Kyra','ẞ']:
            if text=='ẞ':continue # Unicode lowercase to ß is lossless one character and allowed.
            with self.assertRaises(ValueError):secondary.project_authored(text,self.vocab)
        self.assertEqual(secondary.project_authored('ẞ',self.vocab)['characters'],['ß'])
    def test_no_model_initialization_on_dirty_or_stale_qa(self):
        for change in [lambda q:q['takes'][0].update(reasons=['possible_clipping']),
                       lambda q:q['clip_sha256'].update({self.ident:'wrong'}),
                       lambda q:q.update(manifest_sha256='wrong')]:
            q=json.loads(json.dumps(self.qa));change(q);self.report.write_text(json.dumps(q))
            with patch.object(secondary,'LocalSecondaryCTC') as model:
                with self.assertRaises(ValueError):secondary.proposals(self.run,self.report,self.directory,self.target,{self.ident})
                model.assert_not_called()
    def test_selected_ids_required(self):
        for selected in [set(),{'story-'+'b'*24}]:
            with self.assertRaises(ValueError):secondary.proposals(self.run,self.report,self.directory,self.target,selected)
    def test_offline_diagnostic_receipt_distinct_no_approval(self):
        class Emission:shape=(20,8)
        class FakeModel:
            device='cpu';blank=0;config={};runtime={'blank_token_id':0}
            def __init__(inner,*args):inner.vocab=self.vocab
            def emissions(inner,audio):return Emission()
        aligned={'words':[{'word':'He','start':0,'end':.2,'confidence':.9}],'qualification_flags':[]}
        with patch.object(secondary.parent.acoustic,'decode',return_value=[0]*16000),\
             patch.object(secondary.parent,'greedy_decode',return_value={'transcript':'he','unknown_tokens':[]}),\
             patch.object(secondary.parent,'align_emissions',return_value=aligned),\
             patch.object(secondary,'waveform_support'):
            secondary.proposals(self.run,self.report,self.directory,self.target,{self.ident},model_factory=FakeModel)
        receipt=json.loads((self.target/(self.ident+'.secondary-ctc.private.json')).read_text())
        self.assertEqual(receipt['binding']['engine'],secondary.ENGINE);self.assertIsNone(receipt['approval'])
        self.assertTrue(receipt['binding']['diagnostic_only']);self.assertEqual(receipt['status'],'diagnostic_root_review_required')
        self.assertFalse((self.run/'ctc-align').exists())

if __name__=='__main__':unittest.main()
