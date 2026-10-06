"""Offline synthetic word/native-frame guards, never production approvals."""
import copy
import unittest
from unittest.mock import patch
import numpy as np
import story_voice_meta_foltan_cases as m

class FoltanNativeCasesTests(unittest.TestCase):
 def line(self,ident=None):
  ident=ident or list(m.CASES)[1];return {'id':ident,'text':m.CASES[ident]['text'],'speaker':'azar'}
 def matrices(self,line=None):
  line=line or self.line();start=m.CASES[line['id']]['emission_start'];labels=['<pad>','f','ɔ','l','t','ɑː','n','v','ɜ','a']+['unused'+str(k) for k in range(382)];vocab={t:i for i,t in enumerate(labels)}
  phones=['a']*start+['f','ɔ','l','t','ɑː','n'];classes=[]
  for t in phones:classes.extend([0,vocab[t]])
  logits=np.full((1,len(classes),392),-12,dtype=np.float32)
  for j,k in enumerate(classes):logits[0,j,k]=8
  ids=logits[0].argmax(axis=1);shift=logits[0].astype(np.float64)-logits[0].max(axis=1,keepdims=True);p=np.exp(shift);p/=p.sum(axis=1,keepdims=True);events=[];prev=None
  for frame,k in enumerate(ids):
   k=int(k)
   if k!=prev and k!=0:events.append({'frame_index':frame,'class_id':k,'token':labels[k],'actual_argmax_softmax_probability':float(p[frame,k])})
   prev=k
  obs={'raw_ipa':' '.join(x['token'] for x in events),'native_decode':' '.join(x['token'] for x in events),'emitted_raw_tokens':events}
  return logits,p,ids,vocab,obs
 def test_actual_full_six_phones_and_original_alternatives_both_cases(self):
  for i in m.CASES:
   line=self.line(i);r=m.native_case_frames(line,*self.matrices(line));self.assertEqual(r['shape'],'f ɔ l t ɑː n');self.assertEqual(len(r['selected_events']),6);self.assertTrue(r['no_global_vowel_rule']);self.assertGreater(r['selected_f_uncalibrated_softmax'],.95)
 def test_changed_source_other_ID_speaker_and_wrong_body_words_rejected(self):
  line=self.line()
  for change in [{'text':line['text']+' Heute.'},{'id':'story-other'},{'speaker':'lia'}]:
   with self.assertRaises(m.core.SafeError):m.case({**line,**change})
  for i,c in m.CASES.items():
   line=self.line(i)
   for channel in ['pro','flash','large']:
    good=c['text'].replace('Foltan',c['observed'][channel]);m.body(line,good,channel)
    for bad in [good+' Extra.',good.replace('Er ist','Er war'),good.replace('rennt','geht'),good.replace('seine','ihre'),good.replace('Foltan','Voltan')]:
     if bad==good:continue
     with self.assertRaises(m.core.SafeError):m.body(line,bad,channel)
 def test_name_variant_is_fixed_percase_channel_no_global_alias(self):
  line=self.line();c=m.CASES[line['id']]
  for name in ['Foltan','Voltan','Volltan','Voltern','Foletan']:
   with self.assertRaises(m.core.SafeError):m.body(line,c['text'].replace('Foltan',name),'pro')
 def test_missing_extra_body_tokens_rejected(self):
  for i,c in m.CASES.items():
   line=self.line(i);text=c['text'].replace('Foltan',c['observed']['large'])
   for bad in [text+' Extra',text.replace('wird schon','wird'),text.replace('feine Herr','Herr')]:
    if bad==text:continue
    with self.assertRaises(m.core.SafeError):m.body(line,bad,'large')
 def test_changed_argmax_logits_probability_and_full_inventory_rejected(self):
  line=self.line();original=self.matrices()
  for kind in ['logits','probability','ids','inventory','emissions','raw']:
   z=copy.deepcopy(original)
   if kind=='logits':z[0][0,1,7]=20
   if kind=='probability':z[1][1,1]=.5
   if kind=='ids':z[2][1]=7
   if kind=='inventory':z[3].pop('unused0')
   if kind=='emissions':z[4]['emitted_raw_tokens'][0]['frame_index']=0
   if kind=='raw':z[4]['raw_ipa']='f ɔ l t ɜ n'
   with self.assertRaises(m.core.SafeError):m.native_case_frames(line,*z)
 def test_schwa_actual_name_phone_and_low_f_high_v_rejected(self):
  line=self.line();logits,p,ids,vocab,obs=self.matrices();z=copy.deepcopy(obs);z['emitted_raw_tokens'][4]['token']='ɜ'
  with self.assertRaises(m.core.SafeError):m.native_case_frames(line,logits,p,ids,vocab,z)
  # A matrix-consistent weak onset still cannot satisfy the .95/.02 comparator.
  logits[0,1,7]=7.9;shift=logits[0].astype(np.float64)-logits[0].max(axis=1,keepdims=True);p=np.exp(shift);p/=p.sum(axis=1,keepdims=True)
  obs['emitted_raw_tokens'][0]['actual_argmax_softmax_probability']=float(p[1,1])
  with self.assertRaises(m.core.SafeError):m.native_case_frames(line,logits,p,ids,vocab,obs)
 def test_no_approval_no_call_and_current_complete_template_required(self):
  line=self.line();template={'status':'root_review_required','reviewed_by':'','reason':'','id':line['id'],'clip_sha256':'a','source_text_sha256':'b','method':m.VERSION,'source_row':line}
  with patch.object(m,'proof_template',return_value=template) as build:
   self.assertIsNone(m.review(None,line,{},None));build.assert_not_called()
   approval={**template,'status':m.APPROVED,'reviewed_by':'root exact fixture review','reason':'Explicit complete synthetic case review only.'}
   self.assertEqual(m.review(None,line,{},approval)['proof'],approval)
   for change in [{'status':'root_review_required'},{'reviewed_by':'worker'},{'reason':'ok'},{'clip_sha256':'stale'},{'extra':True}]:
    with self.assertRaises(m.core.SafeError):m.review(None,line,{},dict(approval,**change))

if __name__=='__main__':unittest.main()
