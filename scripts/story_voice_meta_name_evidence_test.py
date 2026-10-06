#!/usr/bin/env python3
"""CPU-only guard tests; no API, model load or audio mutation."""
import copy
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
import story_voice_meta_name_evidence as m

class Guards(unittest.TestCase):
 def setUp(self):self.line={'id':m.ID,'text':m.TEXT}
 def test_full_body(self):
  for name in ['Voltan','Volltan']:self.assertEqual(m.body(self.line,m.TEXT.replace('Foltan',name),name.lower())['word_index'],12)
 def test_wrong_source_and_id(self):
  for line in [dict(self.line,id='story-other'),dict(self.line,text=m.TEXT+'!')]:
   with self.assertRaises(m.core.SafeError):m.body(line,m.TEXT.replace('Foltan','Voltan'),'voltan')
 def test_omission_extra_or_other_body_change(self):
  for text in [m.TEXT.replace('Foltan','Voltan').replace('merke','merk'),m.TEXT.replace('Foltan','Voltan extra'),m.TEXT.replace('Foltan','Voltan').replace('Und ','')]:
   with self.assertRaises(m.core.SafeError):m.body(self.line,text,'voltan')
 def test_foltern_not_eligible(self):
  with self.assertRaises(m.core.SafeError):m.body(self.line,m.TEXT.replace('Foltan','Foltern'),'voltan')
 def frames(self):
  vocab={'<pad>':0,'f':1,'v':2,'ɔ':3,'l':4,'t':5,'ɑː':6,'n':7};ids=np.array([0,1,1,0,3,4,5,6,7]);log=np.full((1,len(ids),392),-20,dtype=np.float32)
  for i,t in enumerate(ids):log[0,i,t]=8
  shifted=log[0].astype(np.float64)-log[0].max(axis=-1,keepdims=True);p=np.exp(shifted);p/=p.sum(axis=-1,keepdims=True)
  inv={v:k for k,v in vocab.items()};events=[];prev=None
  for i,t in enumerate(ids):
   if t!=prev and t!=0:events.append({'frame_index':i,'class_id':int(t),'token':inv[t],'actual_argmax_softmax_probability':float(p[i,t])})
   prev=t
  obs={'emitted_raw_tokens':events,'raw_ipa':'f ɔ l t ɑː n','native_decode':'f ɔ l t ɑː n'}
  return log,p,ids,vocab,obs,{'start_index':0,'end_index_exclusive':6}
 def test_actual_full_native_frames(self):self.assertGreater(m.native_frames(*self.frames())['selected_f_uncalibrated_softmax'],.95)
 def test_wrong_matrix_argmax_softmax_or_decode(self):
  for index in [0,1,2,4]:
   args=list(self.frames())
   if index==0:args[0][0,1,2]=30
   elif index==1:args[1][1,1]=.1
   elif index==2:args[2][1]=2
   else:args[4]['native_decode']='f ɔ l t ə n'
   with self.assertRaises(m.core.SafeError):m.native_frames(*args)
 def test_low_f(self):
  args=list(self.frames());args[0][0,1,1]=0;args[0][0,1,2]=-.01;shift=args[0][0].astype(np.float64)-args[0][0].max(axis=-1,keepdims=True);args[1]=np.exp(shift);args[1]/=args[1].sum(axis=-1,keepdims=True);args[4]['emitted_raw_tokens'][0]['actual_argmax_softmax_probability']=float(args[1][1,1])
  with self.assertRaises(m.core.SafeError):m.native_frames(*args)
 def historical_fixture(self,root):
  old=root/'word-cues'/(m.ID+'.json');old.parent.mkdir();old.write_bytes(b'old timing')
  archive=root/'historical.json';archive.write_bytes(old.read_bytes())
  audio=root/'audio.mp3';audio.write_bytes(b'audio')
  receipt=root/'receipt.json';receipt.write_bytes(b'original receipt')
  record={'binding':{'input_sha256':{str(p):m.digest(p) for p in [old,audio,receipt]}}}
  def register(p):
   p=Path(p);p=(p if p.is_absolute() else root/p).resolve()
   m.require(p.is_relative_to(root) and p.is_file(),'Missing private evidence.')
   return p
  return old,archive,audio,receipt,record,register
 def test_legitimate_current_timing_change_keeps_exact_archive(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t).resolve();old,archive,audio,receipt,record,register=self.historical_fixture(root)
   old.write_bytes(b'legitimate new timing')
   evidence=m.validate_free_inputs(root,record,archive,register)
   self.assertEqual(evidence['original_reference_sha256'],m.digest(archive))
   self.assertNotEqual(m.digest(old),m.digest(archive))
 def test_missing_or_wrong_timing_archive_rejected(self):
  for mutation in ['missing','changed']:
   with tempfile.TemporaryDirectory() as t:
    root=Path(t).resolve();old,archive,audio,receipt,record,register=self.historical_fixture(root)
    if mutation=='missing':archive.unlink()
    else:archive.write_bytes(b'changed archive')
    with self.assertRaises(m.core.SafeError):m.validate_free_inputs(root,record,archive,register)
 def test_current_audio_receipt_and_source_bindings_still_block(self):
  for mutation in ['audio','receipt','source']:
   with tempfile.TemporaryDirectory() as t:
    root=Path(t).resolve();old,archive,audio,receipt,record,register=self.historical_fixture(root)
    target=audio if mutation=='audio' else receipt
    if mutation=='source':
     target=root/'source.json';target.write_bytes(b'authored source');record['binding']['input_sha256'][str(target)]=m.digest(target)
    target.write_bytes(b'changed actual input')
    with self.assertRaises(m.core.SafeError):m.validate_free_inputs(root,record,archive,register)
 def template(self):return {'status':'root_review_required','reviewed_by':'','reason':'','id':m.ID,'clip_sha256':'actual-mp3','source_text_sha256':'source','pro_evidence':{'transcript':'actual'},'native_Meta_evidence':{'frame':3}}
 def test_no_implicit_root(self):
  self.assertIsNone(m.review(None,self.line,{},None))
  with patch.object(m,'proof_template',return_value=self.template()):
   with self.assertRaises(m.core.SafeError):m.review(None,self.line,{},self.template())
 def test_exact_explicit_review(self):
  template=self.template();approval=dict(template,status=m.APPROVED,reviewed_by='root actual review',reason='individual evidence')
  with patch.object(m,'proof_template',return_value=template):self.assertEqual(m.review(None,self.line,{},approval)['id'],m.ID)
 def test_changed_template_audio_source_pro_frame_rejected(self):
  template=self.template()
  for field in ['clip_sha256','source_text_sha256','pro_evidence','native_Meta_evidence']:
   approval=dict(template,status=m.APPROVED,reviewed_by='root',reason='review');approval[field]='changed'
   with patch.object(m,'proof_template',return_value=template):
    with self.assertRaises(m.core.SafeError):m.review(None,self.line,{},approval)
if __name__=='__main__':unittest.main()
