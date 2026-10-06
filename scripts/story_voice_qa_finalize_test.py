#!/usr/bin/env python3
"""Offline full-word finalization against actual specialist receipt validators."""
import copy
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import story_voice_qa_finalize as f
import story_voice_specialist_asr_test as fixtures

class FinalizeGates(unittest.TestCase):
    def setUp(self):
        self.fixture=fixtures.SpecialistTests();self.fixture.setUp();self.addCleanup(self.fixture.tearDown)
        self.run=self.fixture.source;self.ids=self.fixture.ids
        for ident in self.ids:
            path=self.run/'raw'/(ident+'.receipt.json');receipt=f.core.read_json(path);receipt['model']=f.core.MODEL;f.core.save(path,receipt)
        self.fixture.prepare();self.fixture.execute();record=self.fixture.record()
        self.comparison=self.run/'specialist.json';f.core.save(self.comparison,{'records':[record]})
        self.signal={'silent':False,'seconds':2.,'clipped_fraction':0.,'peak':.4,'trailing_silence_seconds':.1,'leading_silence_seconds':.1,'last_frame_rms':0.,'rms':.1}
        self.base={'version':f.qa.VERSION,'model':f.qa.MODEL,'manifest_sha256':f.qa.digest(self.run/'lines.private.json'),'checked_ids':self.ids,'clip_sha256':{i:f.qa.digest(self.run/'clips'/(i+'.mp3')) for i in self.ids},'takes':[],'failures':[],'status':'review_required'}
        for row in self.fixture.rows:
            reasons=['asr_lexical_mismatch_requires_review'] if row['id']==self.ids[0] else []
            self.base['takes'].append({'id':row['id'],'text_sha256':f.qa.text_hash(row['text']),'signal':copy.deepcopy(self.signal),'transcript':'Unveränderter falscher Decodertext.','reasons':reasons})
            self.base['failures'].extend({'id':row['id'],'reason':r} for r in reasons)
        self.path=self.run/'base.json';f.core.save(self.path,self.base)
    def finish(self,**kwargs):
        return f.finalize(self.run,self.path,self.run/'final.json',expected_count=2,**kwargs)
    def test_actual_exact_proof_passes_preserving_original_decoders(self):
        original=self.path.read_bytes();result=self.finish(specialist_path=self.comparison)
        self.assertEqual(result['status'],'passed');self.assertEqual(self.path.read_bytes(),original)
        self.assertEqual(result['takes'][0]['transcript'],self.base['takes'][0]['transcript']);self.assertTrue(result['takes'][0]['extra_word_proof']);self.assertEqual(result['takes'][0]['original_decoder_reasons'],['asr_lexical_mismatch_requires_review'])
    def test_no_extra_proof_remains_blocked(self):self.assertEqual(self.finish()['status'],'review_required')
    def test_stale_audio_manifest_and_partial_coverage_rejected(self):
        for kind in ['audio','manifest','coverage']:
            original=(self.run/'clips'/(self.ids[0]+'.mp3')).read_bytes();manifest=(self.run/'lines.private.json').read_bytes();base=copy.deepcopy(self.base)
            if kind=='audio':(self.run/'clips'/(self.ids[0]+'.mp3')).write_bytes(b'changed')
            elif kind=='manifest':(self.run/'lines.private.json').write_bytes(manifest+b' ')
            else:base['checked_ids']=self.ids[:1];f.core.save(self.path,base)
            with self.assertRaises(f.core.SafeError):self.finish(specialist_path=self.comparison)
            (self.run/'clips'/(self.ids[0]+'.mp3')).write_bytes(original);(self.run/'lines.private.json').write_bytes(manifest);f.core.save(self.path,self.base)
    def test_malformed_specialist_and_translated_transcript_never_suppress(self):
        report=f.core.read_json(self.comparison);report['records'][0]['transcript']='Translated words.';f.core.save(self.comparison,report)
        with self.assertRaises(f.core.SafeError):self.finish(specialist_path=self.comparison)
    def test_signal_failure_and_global_failure_persist_with_full_word_proof(self):
        self.base['takes'][0]['signal']['peak']=1.3;self.base['takes'][0]['reasons'].append('possible_clipping');self.base['failures'].extend([{'id':self.ids[0],'reason':'possible_clipping'},{'id':None,'reason':'unexpected_clip_files'}]);f.core.save(self.path,self.base)
        result=self.finish(specialist_path=self.comparison);self.assertEqual(result['status'],'review_required');self.assertEqual(result['takes'][0]['reasons'],['possible_clipping']);self.assertEqual(len(result['failures']),2)
    def test_hashbound_root_veto_beats_actual_exact_match(self):
        ident=self.ids[0];row=self.fixture.rows[0];evidence=self.run/'veto-evidence.json';f.core.save(evidence,{'id':ident,'clip_sha256':self.base['clip_sha256'][ident],'source_text_sha256':f.qa.text_hash(row['text'])})
        path=self.run/'veto.json';f.core.save(path,{'records':[{'id':ident,'status':'root_retake_required','reviewed_by':'root fixture','reason':'Observed repeated words.','clip_sha256':self.base['clip_sha256'][ident],'text_sha256':f.qa.text_hash(row['text']),'evidence':[{'file':evidence.name,'sha256':f.qa.digest(evidence)}]}]})
        result=self.finish(specialist_path=self.comparison,veto_path=path);self.assertEqual(result['status'],'review_required');self.assertIn('independent_audio_word_defect',result['takes'][0]['reasons'])
    def test_ctc_without_root_approval_refused(self):
        with self.assertRaises(f.core.SafeError):self.finish(ctc_path=self.path)
    def test_actual_original_batch_missing_model_supported_without_inventing_raw_model(self):
        ident=self.ids[1];path=self.run/'raw'/(ident+'.receipt.json');receipt=f.core.read_json(path);receipt.pop('model');f.core.save(path,receipt)
        f.core.save(self.run/'job.json',{'model':f.core.MODEL,'request_count':2})
        f.core.save(self.run/'status.private.json',{'metadata':{'model':'models/'+f.core.MODEL}})
        result=self.finish(specialist_path=self.comparison)
        provenance=result['finalizer']['current_tts_receipts'][ident]
        self.assertIsNone(provenance['model']);self.assertEqual(provenance['effective_model'],f.core.MODEL);self.assertEqual(path.read_text(),json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')

    def test_missing_model_modified_unknown_backend_wrong_model_or_wav_refused(self):
        ident=self.ids[1];path=self.run/'raw'/(ident+'.receipt.json');original=f.core.read_json(path)
        f.core.save(self.run/'job.json',{'model':f.core.MODEL,'request_count':2});f.core.save(self.run/'status.private.json',{'metadata':{'model':'models/'+f.core.MODEL}})
        for changes in [{'model':None,'backend':'standard'},{'model':None,'delivery_override':{}},{'model':None,'request_sha256':'b'*64},{'model':None,'wav_sha256':'b'*64},{'model':'wrong-model'}]:
            receipt=copy.deepcopy(original);receipt.update(changes)
            if changes.get('model','present') is None:receipt.pop('model')
            f.core.save(path,receipt)
            with self.assertRaises(f.core.SafeError):self.finish()
        receipt=copy.deepcopy(original);receipt.pop('model');f.core.save(path,receipt);f.core.save(self.run/'status.private.json',{'metadata':{'model':'wrong-model'}})
        with self.assertRaises(f.core.SafeError):self.finish()

    def pro_comparison(self,translation=False,first_text=None):
        pro=f.pro;rows={r['id']:r for r in self.fixture.rows}
        args=SimpleNamespace(only_ids=','.join(self.ids),max_calls=2)
        with patch.object(pro.transport,'source_rows',return_value=rows),pro.backend():
            folder,run=pro.transport.locations(self.run,'finalizer-fixture')
            pro.prepare(args,self.run,folder,run,rows)
            info=pro.transport.prepared(run,self.run,rows);pro.transport.reserve(self.run,run)
            pro.core.save(run/'submit-intent.private.json',{'model':pro.MODEL,'request_count':2,'input_sha256':info['input_sha256'],'state':'CONFIRMED'})
            pro.core.save(run/'job.json',{'model':pro.MODEL,'request_count':2,'job_name':'batches/offline'})
            responses=[]
            for row in self.fixture.rows:
                text=first_text if first_text is not None and row['id']==self.ids[0] else 'This is translated.' if translation else row['text']
                responses.append({'key':row['id'],'response':{'modelVersion':pro.MODEL,'candidates':[{'finishReason':'STOP','content':{'role':'model','parts':[{'text':json.dumps({'transcript':text})}]}}]}})
            with patch.object(pro.core,'credential',return_value='offline'),patch.object(pro.core,'fetch_status',return_value=({'response':{'inlinedResponses':responses}},'JOB_STATE_SUCCEEDED')):
                self.assertEqual(pro.collect(args,self.run,folder,run,rows),0)
        return folder/'comparison.private.json'

    def test_actual_pro_raw_schema_exact_match_and_globals_restored(self):
        model=f.pro.transport.MODEL;namespace=f.pro.transport.FOLDER_NAME
        path=self.pro_comparison();result=self.finish(pro_path=path)
        self.assertEqual(result['status'],'passed');proof=result['takes'][0]['extra_word_proof'][0]
        self.assertEqual(proof['model'],'gemini-3.1-pro-preview');self.assertTrue(proof['provenance_files_sha256'])
        self.assertEqual(f.pro.transport.MODEL,model);self.assertEqual(f.pro.transport.FOLDER_NAME,namespace)

    def test_actual_translated_pro_cannot_remove_source_mismatch(self):
        result=self.finish(pro_path=self.pro_comparison(translation=True))
        self.assertEqual(result['status'],'review_required');self.assertNotIn('extra_word_proof',result['takes'][0])

    def test_actual_pro_wrong_model_stale_record_and_wrong_source_fail_closed(self):
        path=self.pro_comparison();original=f.core.read_json(path)
        for kind in ['model','audio','source']:
            report=copy.deepcopy(original)
            if kind=='model':report['records'][0]['response']['modelVersion']='wrong-model'
            elif kind=='audio':report['records'][0]['clip_sha256']='a'*64
            else:report['records'][0]['source_run']=str(self.run.parent)
            f.core.save(path,report)
            with self.assertRaises(f.core.SafeError):self.finish(pro_path=path)
            self.assertFalse((self.run/'final.json').exists())

    def pro_variant_fixture(self,observed='Ich hab Kira gesehen.'):
        row=self.fixture.rows[0];row['text']='Ich habe Kyra gesehen.'
        f.core.save(self.run/'lines.private.json',{'lines':self.fixture.rows})
        requests=[{'key':r['id'],'request':f.common.request_for(r,self.fixture.profiles['speakers'])} for r in self.fixture.rows]
        (self.run/'requests.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in requests))
        self.base['manifest_sha256']=f.qa.digest(self.run/'lines.private.json');self.base['takes'][0]['text_sha256']=f.qa.text_hash(row['text']);f.core.save(self.path,self.base)
        path=self.pro_comparison(first_text=observed);record=f.core.read_json(path)['records'][0]
        return path,record

    def test_explicit_combined_safe_pro_variants_full_accounting(self):
        path,record=self.pro_variant_fixture();approval=f.pro_variant_template(self.run,self.fixture.rows[0],self.base['clip_sha256'][self.ids[0]],record)
        self.assertEqual([v['kind'] for v in approval['variants']],['natural_schwa','named_spelling'])
        approval.update(status='approved_pro_word_variants',reviewed_by='root offline review',reason='Reviewed both exact positions.')
        approvals=self.run/'pro-approval.json';f.core.save(approvals,{'approvals':{self.ids[0]:approval}})
        result=self.finish(pro_path=path,pro_approvals_path=approvals);self.assertEqual(result['status'],'passed')
        self.assertEqual(result['takes'][0]['extra_word_proof'][0]['approval'],approval)

    def test_pro_variants_missing_extra_duplicate_stale_and_unapproved_refused(self):
        path,record=self.pro_variant_fixture();template=f.pro_variant_template(self.run,self.fixture.rows[0],self.base['clip_sha256'][self.ids[0]],record)
        self.assertIsNone(f.pro_word_proof(self.run,self.fixture.rows[0],self.base['clip_sha256'][self.ids[0]],record))
        approved=copy.deepcopy(template);approved.update(status='approved_pro_word_variants',reviewed_by='root offline',reason='Two reviewed safe changes.')
        cases=[template,{**approved,'variants':approved['variants'][:1]}, {**approved,'variants':approved['variants']+approved['variants'][:1]}, {**approved,'record_sha256':'a'*64}, {**approved,'reason':''}, {**approved,'unexpected':True}]
        for approval in cases:
            with self.assertRaises(f.core.SafeError):f.pro_word_proof(self.run,self.fixture.rows[0],self.base['clip_sha256'][self.ids[0]],record,approval)
        duplicate=self.run/'duplicate-pro.json';duplicate.write_text('{"approvals":{'+json.dumps(self.ids[0])+':'+json.dumps(approved)+','+json.dumps(self.ids[0])+':'+json.dumps(approved)+'}}')
        with self.assertRaises(f.core.SafeError):f.load_pro_approvals(duplicate)

    def test_unsafe_vowel_name_aliases_and_fv_are_never_approved(self):
        # Schema validation is real in the fixture. Unsafe lexical differences
        # still cannot obtain a proposal despite valid raw Pro provenance.
        path,record=self.pro_variant_fixture(observed='Ich hab Lea gesehen.')
        with self.assertRaises(f.core.SafeError):f.pro_variant_template(self.run,self.fixture.rows[0],self.base['clip_sha256'][self.ids[0]],record)
        self.assertFalse(f.qa.named_spelling_equivalent('Lia','Lea'))
        self.assertFalse(f.qa.named_spelling_equivalent('Foltan','Voltan'))
        self.assertFalse(f.qa.named_spelling_equivalent('Hand','Hund'))

    def test_current_root_veto_blocks_approved_pro_variant_words(self):
        path,record=self.pro_variant_fixture();ident=self.ids[0];line=self.fixture.rows[0];sha=self.base['clip_sha256'][ident]
        approval=f.pro_variant_template(self.run,line,sha,record);approval.update(status='approved_pro_word_variants',reviewed_by='root offline',reason='Both individual variants reviewed.')
        approvals=self.run/'variants-approved.json';f.core.save(approvals,{ident:approval})
        evidence=self.run/'active-veto-evidence.json';f.core.save(evidence,{'id':ident,'clip_sha256':sha,'source_text_sha256':f.qa.text_hash(line['text'])})
        veto=self.run/'active-veto.json';f.core.save(veto,{'records':[{'id':ident,'status':'root_retake_required','reviewed_by':'root offline','reason':'Repeated audible sequence remains defective.','clip_sha256':sha,'text_sha256':f.qa.text_hash(line['text']),'evidence':[{'file':evidence.name,'sha256':f.qa.digest(evidence)}]}]})
        result=self.finish(pro_path=path,pro_approvals_path=approvals,veto_path=veto)
        self.assertEqual(result['status'],'review_required');self.assertIn('independent_audio_word_defect',result['takes'][0]['reasons'])

if __name__=='__main__':unittest.main()
