#!/usr/bin/env python3
"""Offline full-word finalization against actual specialist receipt validators."""
import copy
import json
from pathlib import Path
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import story_voice_qa_finalize as f
import story_voice_specialist_asr_test as fixtures
import story_voice_complementary_names_test as complementary_fixtures
import story_voice_orthographic_segments_test as orthographic_fixtures

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

    def pro_variant_fixture(self,observed='Ich hab Kira gesehen.',source='Ich habe Kyra gesehen.'):
        row=self.fixture.rows[0];row['text']=source
        f.core.save(self.run/'lines.private.json',{'lines':self.fixture.rows})
        requests=[{'key':r['id'],'request':f.common.request_for(r,self.fixture.profiles['speakers'])} for r in self.fixture.rows]
        (self.run/'requests.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in requests))
        self.base['manifest_sha256']=f.qa.digest(self.run/'lines.private.json');self.base['takes'][0]['text_sha256']=f.qa.text_hash(row['text']);f.core.save(self.path,self.base)
        path=self.pro_comparison(first_text=observed);record=f.core.read_json(path)['records'][0]
        return path,record

    def kitzeln_fixture(self):
        source='Und deins ist Rumsitzen? Pass auf, sonst kitzle ich dich gleich noch mal.';old=self.ids[0];ident='story-566e96b3e7093edace832a22'
        for folder,suffix in [('clips','.mp3'),('raw','.wav'),('raw','.receipt.json')]:
            path=self.run/folder/(old+suffix)
            if path.exists():path.rename(self.run/folder/(ident+suffix))
        self.ids[0]=ident;self.fixture.rows[0]['id']=ident
        self.base['clip_sha256'][ident]=self.base['clip_sha256'].pop(old);self.base['takes'][0]['id']=ident
        for row in self.base['failures']:
            if row['id']==old:row['id']=ident
        path,record=self.pro_variant_fixture(source.replace('kitzle','kitzel'),source)
        return self.fixture.rows[0],self.base['clip_sha256'][ident],record
    def test_single_source_first_person_kitzeln_root_bound_full_13_pro_words(self):
        line,sha,record=self.kitzeln_fixture();proposal=f.pro_variant_template(self.run,line,sha,record)
        self.assertEqual(len(proposal['expected_tokens']),13);self.assertEqual(proposal['variants'],[{'word_index':7,'expected':'kitzle','observed':'kitzel','kind':'colloquial_first_person_kitzeln'}])
        self.assertIsNone(f.pro_word_proof(self.run,line,sha,record))
        with self.assertRaises(f.core.SafeError):f.pro_word_proof(self.run,line,sha,record,proposal)
        approval=copy.deepcopy(proposal);approval.update(status='approved_pro_word_variants',reviewed_by='root offline',reason='Reviewed this single literal first-person variant.')
        self.assertTrue(f.pro_word_proof(self.run,line,sha,record,approval))
        bad=copy.deepcopy(approval);bad['raw_response_sha256']='stale'
        with self.assertRaises(f.core.SafeError):f.pro_word_proof(self.run,line,sha,record,bad)
    def test_kitzeln_other_id_source_index_pair_extra_missing_reordering_refused(self):
        line,sha,record=self.kitzeln_fixture()
        with self.assertRaises(f.core.SafeError):f.pro_variant_template(self.run,{**line,'id':self.ids[1]},sha,record)
        with self.assertRaises(f.core.SafeError):f.pro_variant_template(self.run,{**line,'text':line['text'].replace('deins','dein')},sha,record)
        # Keep real raw model/schema parsing; isolate only provenance here to
        # exercise the exact token rule for every forbidden body/pair variant.
        tokens=f.qa.words(line['text']);good=tokens[:7]+['kitzel']+tokens[8:]
        bad_words=[good+['extra'],good[:-1],good[:11]+['nochmal'],good[:7]+['kitzele']+good[8:],good[:6]+['kitzel','sonst']+good[8:],good[:8]+['du']+good[9:]]
        for words in bad_words:
            bad=copy.deepcopy(record);bad['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':' '.join(words)})
            with patch.object(f.pro,'cached_record',return_value=True):
                with self.assertRaises(f.core.SafeError):f.pro_variant_template(self.run,line,sha,bad)

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

class ComplementaryFinalizerGates(unittest.TestCase):
    def setUp(self):
        self.fixture=complementary_fixtures.ComplementaryNames();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups)
        self.run=self.fixture.run
        (self.run/'requests.jsonl').write_text('')
        for ident in self.fixture.ids:
            path=self.run/'raw'/(ident+'.receipt.json');receipt=f.core.read_json(path);receipt['model']=f.core.MODEL;f.core.save(path,receipt)
        self.base=f.core.read_json(self.fixture.qa_path);self.base['checked_ids']=self.fixture.ids
        self.base_path=self.run/'base-complete.json';f.core.save(self.base_path,self.base)
        self.flash=self.run/'flash-comparison.json';f.core.save(self.flash,{'records':list(self.fixture.flash_records.values())})
        self.pro_path=self.fixture.pro_folder/'comparison.private.json'
        self.ctc=self.run/'ctc-report.json';f.core.save(self.ctc,{'synthetic_loader_fixture':True})
        self.approvals=self.run/'approved-complementary.json';f.core.save(self.approvals,{'proposals':{i:self.fixture.approved(i) for i in self.fixture.ids}})
    def finish(self,**changes):
        args={'pro_path':self.pro_path,'veto_path':self.fixture.veto_path,'complementary_approvals_path':self.approvals,'complementary_ctc_path':self.ctc,'flash_path':self.flash,'complementary_qa_path':self.fixture.qa_path}
        args.update(changes)
        with patch.object(f.lexical,'load_records',return_value=self.fixture.envelopes):
            return f.finalize(self.run,self.base_path,self.run/'final-complementary.json',expected_count=2,**args)
    def test_two_actual_complementary_full_word_proofs_adopted(self):
        result=self.finish();self.assertEqual(result['status'],'passed')
        for take in result['takes']:
            proof=take['extra_word_proof'][0];self.assertEqual(proof['method'],f.complementary.VERSION);self.assertIsNone(proof['timing_approval']);self.assertTrue(proof['free_CTC_evidence'])
    def test_missing_arguments_and_unapproved_templates_refused(self):
        with self.assertRaises(f.core.SafeError):self.finish(flash_path=None)
        f.core.save(self.approvals,{'proposals':{i:self.fixture.template(i) for i in self.fixture.ids}})
        with self.assertRaises(f.core.SafeError):self.finish()
    def test_current_root_veto_and_stale_complementary_QA_cannot_suppress(self):
        report=f.core.read_json(self.fixture.qa_path);report['clip_sha256'][self.fixture.ids[0]]='b'*64;f.core.save(self.fixture.qa_path,report)
        with self.assertRaises(f.core.SafeError):self.finish()
    def test_signal_failure_not_hidden_by_complementary_word_proof(self):
        self.base['takes'][0]['signal']['peak']=1.3;self.base['takes'][0]['reasons'].append('possible_clipping');self.base['failures'].append({'id':self.fixture.ids[0],'reason':'possible_clipping'});f.core.save(self.base_path,self.base)
        result=self.finish();self.assertEqual(result['status'],'review_required');self.assertIn('possible_clipping',result['takes'][0]['reasons'])

    def test_active_hashbound_root_veto_refuses_complementary_approval(self):
        ident=self.fixture.ids[0];line=self.fixture.rows[ident];sha=f.qa.digest(self.run/'clips'/(ident+'.mp3'))
        evidence=self.run/'root-veto-evidence.json';f.core.save(evidence,{'id':ident,'clip_sha256':sha,'source_text_sha256':f.qa.text_hash(line['text'])})
        f.core.save(self.fixture.veto_path,{'records':[{'id':ident,'status':'root_retake_required','reviewed_by':'root offline','reason':'Actual duplicated words.','clip_sha256':sha,'text_sha256':f.qa.text_hash(line['text']),'evidence':[{'file':evidence.name,'sha256':f.qa.digest(evidence)}]}]})
        with self.assertRaises(f.core.SafeError):self.finish()
        self.assertFalse((self.run/'final-complementary.json').exists())

class OrthographicFinalizerGates(unittest.TestCase):
    def setUp(self):
        self.fixture=orthographic_fixtures.OrthographicGates();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups);self.run=self.fixture.run
        (self.run/'raw').mkdir();(self.run/'requests.jsonl').write_text('')
        for ident in self.fixture.rows:
            f.qa.save(self.run/'raw'/(ident+'.receipt.json'),{'status':'complete','model':f.core.MODEL,'mp3_sha256':f.qa.digest(self.run/'clips'/(ident+'.mp3'))})
        self.flash=self.run/'flash.json';f.qa.save(self.flash,{'records':[channels['Flash'] for channels in self.fixture.records.values() if 'Flash' in channels]})
        self.pro=self.run/'pro.json';f.qa.save(self.pro,{'records':[channels['Pro'] for channels in self.fixture.records.values() if 'Pro' in channels]})
        self.approvals=self.run/'approved-segments.json';f.qa.save(self.approvals,{'proposals':{i:self.fixture.approved(i) for i in self.fixture.rows}})
    def finish(self,**changes):
        args={'pro_path':self.pro,'flash_path':self.flash,'orthographic_qa_path':self.fixture.qa_path,'orthographic_approvals_path':self.approvals};args.update(changes)
        return f.finalize(self.run,self.fixture.qa_path,self.run/'final-segments.json',expected_count=3,**args)
    def test_actual_three_proofs_additive_original_transcript_preserved(self):
        base=f.core.read_json(self.fixture.qa_path);result=self.finish();self.assertEqual(result['status'],'passed')
        self.assertEqual([t['transcript'] for t in result['takes']],[t['transcript'] for t in base['takes']])
        self.assertEqual(len(result['finalizer']['removed_reasons']),3)
    def test_missing_arguments_and_current_root_veto_block(self):
        with self.assertRaises(f.core.SafeError):self.finish(flash_path=None)
        ident=next(iter(self.fixture.rows));line=self.fixture.rows[ident];sha=f.qa.digest(self.run/'clips'/(ident+'.mp3'));evidence=self.run/'veto-evidence.json'
        f.qa.save(evidence,{'id':ident,'clip_sha256':sha,'source_text_sha256':f.qa.text_hash(line['text'])});veto=self.run/'veto.json'
        f.qa.save(veto,{'records':[{'id':ident,'status':'root_retake_required','reviewed_by':'root offline','reason':'Actual repeated words.','clip_sha256':sha,'text_sha256':f.qa.text_hash(line['text']),'evidence':[{'file':evidence.name,'sha256':f.qa.digest(evidence)}]}]})
        result=self.finish(veto_path=veto);self.assertEqual(result['status'],'review_required');self.assertIn('independent_audio_word_defect',next(t for t in result['takes'] if t['id']==ident)['reasons'])

class ExpressiveFinalizerGates(unittest.TestCase):
    def setUp(self):
        import story_voice_expressive_events_test as expressive_fixtures
        self.fixture=expressive_fixtures.Gates();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups);self.run=self.fixture.run
        (self.run/'requests.jsonl').write_text('')
        report=f.core.read_json(self.fixture.qa);report['checked_ids']=list(self.fixture.rows)
        report['failures']=[{'id':t['id'],'reason':reason} for t in report['takes'] for reason in t['reasons']]
        for t in report['takes']:t['transcript']='Original uncertain source gesture.'
        f.qa.save(self.fixture.qa,report)
        self.comparison=self.run/'vocal-comparison.json';f.qa.save(self.comparison,{'records':list(self.fixture.records.values())})
        self.approvals=self.run/'expressive-approved.json';self.adopt()
    def adopt(self):f.qa.save(self.approvals,{'approvals':{i:self.fixture.approved(i) for i in self.fixture.rows}})
    def finish(self,**kwargs):
        args={'expressive_approvals_path':self.approvals,'expressive_qa_path':self.fixture.qa,'vocal_path':self.comparison};args.update(kwargs)
        return f.finalize(self.run,self.fixture.qa,self.run/'final-expressive.json',expected_count=3,**args)
    def test_direct_pff_envelope_not_fake_batch_cache_and_wrong_scope_refused(self):
        ident=f.expressive.pff.ID;envelope={'binding':{'id':ident},'response':{'actual':'raw'}}
        self.assertEqual(f.expressive_record_mapping(envelope,{ident:{}},{ident}),{ident:envelope})
        for bad,scope in [({'binding':{'id':self.fixture.rows.keys().__iter__().__next__()},'response':{}},{ident:{}}),(envelope,{ident:{},next(iter(self.fixture.rows)): {}}),({'binding':{'id':ident}},{ident:{}})]:
            with self.assertRaises(f.core.SafeError):f.expressive_record_mapping(bad,scope,{ident})
    def test_three_plus_one_loader_requires_separate_original_direct_qc(self):
        ident=f.expressive.pff.ID;classic=list(self.fixture.records.values());payload={'records':classic+[{'id':ident,'transcript':'stale standard cache'}]};direct={'binding':{'id':ident},'response':{'original':'raw'}}
        approvals={i:{} for i in self.fixture.rows};approvals[ident]={};ids=set(approvals)
        records=f.expressive_record_mapping(payload,approvals,ids,direct);self.assertEqual(set(records),ids);self.assertIs(records[ident],direct)
        with self.assertRaises(f.core.SafeError):f.expressive_record_mapping(payload,approvals,ids)
        with self.assertRaises(f.core.SafeError):f.expressive_record_mapping(payload,approvals,ids,{'id':ident,'response':{}})
        self.assertEqual(set(f.expressive_record_mapping(payload,{i:{} for i in self.fixture.rows},ids)),set(self.fixture.rows))
    def test_exact_three_root_proofs_only_remove_lexical_reason(self):
        old=self.fixture.qa.read_bytes();result=self.finish();self.assertEqual(result['status'],'passed');self.assertEqual(self.fixture.qa.read_bytes(),old)
        self.assertTrue(all(t['transcript']=='Original uncertain source gesture.' for t in result['takes']))
        self.assertTrue(all(p['acting_approval'] is None for t in result['takes'] for p in t['extra_word_proof']))
    def test_fatal_and_unknown_asr_error_retained(self):
        report=f.core.read_json(self.fixture.qa);ident=report['takes'][0]['id']
        for reason in ['asr_check_failed_ValueError','fatal_model_failure']:
            report['takes'][0]['reasons'].append(reason);report['failures'].append({'id':ident,'reason':reason})
        f.qa.save(self.fixture.qa,report);self.adopt();result=self.finish()
        self.assertEqual(result['status'],'review_required');self.assertEqual(set(result['takes'][0]['reasons']),{'asr_check_failed_ValueError','fatal_model_failure'})
    def test_unapproved_partial_arguments_and_veto_preserved(self):
        with self.assertRaises(f.core.SafeError):self.finish(vocal_path=None)
        ident=next(iter(self.fixture.rows));line=self.fixture.rows[ident];sha=f.qa.digest(self.run/'clips'/(ident+'.mp3'))
        evidence=self.run/'veto-evidence.json';f.qa.save(evidence,{'id':ident,'clip_sha256':sha,'source_text_sha256':f.qa.text_hash(line['text'])});veto=self.run/'veto.json'
        f.qa.save(veto,{'records':[{'id':ident,'status':'root_retake_required','reviewed_by':'root offline','reason':'Other actual word defect.','clip_sha256':sha,'text_sha256':f.qa.text_hash(line['text']),'evidence':[{'file':evidence.name,'sha256':f.qa.digest(evidence)}]}]})
        result=self.finish(veto_path=veto);self.assertEqual(result['status'],'review_required');self.assertIn('independent_audio_word_defect',result['takes'][0]['reasons'])

class ScopedRootFinalizerGates(unittest.TestCase):
    """Adapter guards; expensive raw reconstruction is tested by each helper.

    Synthetic files never touch the production bank. Meta review's real full
    root-template comparison remains active; native validate is isolated here.
    """
    def setUp(self):
        self.fixture=fixtures.SpecialistTests();self.fixture.setUp();self.addCleanup(self.fixture.tearDown)
        self.run=self.fixture.source;old=self.fixture.ids
        self.rows=[dict(self.fixture.rows[0],id=f.meta_name.ID,text=f.meta_name.TEXT,speaker='lia'),
            dict(self.fixture.rows[1],id=f.native625.ID,text=f.native625.SOURCE,speaker='azar')]
        self.ids=[r['id'] for r in self.rows]
        for prior,row in zip(old,self.rows):
            for folder,ext in [('clips','.mp3'),('raw','.wav'),('raw','.receipt.json')]:
                (self.run/folder/(prior+ext)).rename(self.run/folder/(row['id']+ext))
            p=self.run/'raw'/(row['id']+'.receipt.json');d=f.core.read_json(p);d.update(id=row['id'],model=f.core.MODEL);f.core.save(p,d)
        f.core.save(self.run/'lines.private.json',{'model':f.core.MODEL,'lines':self.rows})
        self.signal={'silent':False,'seconds':2.,'clipped_fraction':0.,'peak':.4,'trailing_silence_seconds':.1,'leading_silence_seconds':.1,'last_frame_rms':0.,'rms':.1}
        self.base={'version':f.qa.VERSION,'model':f.qa.MODEL,'manifest_sha256':f.qa.digest(self.run/'lines.private.json'),
            'checked_ids':self.ids,'clip_sha256':{i:f.qa.digest(self.run/'clips'/(i+'.mp3')) for i in self.ids},
            'takes':[{'id':r['id'],'text_sha256':f.qa.text_hash(r['text']),'signal':copy.deepcopy(self.signal),
                'transcript':'Original independent ASR text remains literal.','reasons':['asr_lexical_mismatch_requires_review']} for r in self.rows],
            'failures':[{'id':i,'reason':'asr_lexical_mismatch_requires_review'} for i in self.ids]}
        self.base_path=self.run/'base-scoped.json';f.core.save(self.base_path,self.base)
        self.raw=self.run/'actual-scoped-raw.json';f.core.save(self.raw,{'synthetic_independent_raw':True})
        self.journal=self.run/'actual-import.json';f.core.save(self.journal,{'synthetic_scoped_import':True})
        self.template={'id':f.meta_name.ID,'status':'root_review_required','reviewed_by':'','reason':'',
            'source_row':self.rows[0],'clip_sha256':self.base['clip_sha256'][f.meta_name.ID],
            'source_text_sha256':f.qa.text_hash(f.meta_name.TEXT),'helper_script_sha256':f.qa.digest(Path(f.meta_name.__file__)),
            'protected_script_sha256':{str(Path(f.qa.__file__).resolve()):f.qa.digest(Path(f.qa.__file__))},
            'provenance_files_sha256':{str(self.raw):f.qa.digest(self.raw)}}
        self.meta_envelope=self.run/'meta-root.json'
        self.meta_bindings={key:str(self.base_path if key=='qa_report_path' else self.raw) for key in f.meta_name.KEYS}
        self.meta_approval=dict(copy.deepcopy(self.template),status=f.meta_name.APPROVED,reviewed_by='root synthetic test',reason='Explicit complete synthetic test evidence.')
        f.core.save(self.meta_envelope,{'bindings':self.meta_bindings,'approval':self.meta_approval})
        self.native_document=self.run/'native-document.json'
        evidence={'id':f.native625.ID,'source':f.native625.SOURCE,'audio_sha256':self.base['clip_sha256'][f.native625.ID],
            'source_text_sha256':f.qa.text_hash(f.native625.SOURCE),'files':{'actual_raw':{'path':str(self.raw),'sha256':f.qa.digest(self.raw)}}}
        self.native_approval={'id':f.native625.ID,'status':'approved_native625_evidence','reviewed_by':'root synthetic test',
            'reason':'Explicit actual complete child evidence review.'}
        f.core.save(self.native_document,{'evidence':evidence,'evidence_sha256':'synthetic-native-evidence','root_approval':self.native_approval})
        self.native_envelope=self.run/'native-root.json';f.core.save(self.native_envelope,{'bindings':{'native625_document_path':str(self.native_document)},'approval':self.native_approval})
        self.meta_patch=patch.object(f.meta_name,'proof_template',side_effect=lambda *args:copy.deepcopy(self.template));self.meta_patch.start();self.addCleanup(self.meta_patch.stop)
        self.native_patch=patch.object(f.native625,'validate',side_effect=self.native_result);self.native_mock=self.native_patch.start();self.addCleanup(self.native_patch.stop)
    def native_result(self,run,document):
        return {'id':f.native625.ID,'audio_sha256':self.base['clip_sha256'][f.native625.ID],
            'evidence_sha256':document['evidence_sha256'],'import_journal_path':str(self.journal),'import_journal_sha256':f.qa.digest(self.journal)}
    def finish(self,**kwargs):
        options={'meta_name_root_evidence_path':self.meta_envelope,'native625_root_evidence_path':self.native_envelope};options.update(kwargs)
        return f.finalize(self.run,self.base_path,self.run/'final-scoped.json',expected_count=2,**options)
    def mutate(self,path,fn):
        d=f.core.read_json(path);fn(d);f.core.save(path,d)
    def test_two_optional_single_case_proofs_preserve_original_evidence(self):
        old=self.base_path.read_bytes();result=self.finish();self.assertEqual(result['status'],'passed');self.assertEqual(self.base_path.read_bytes(),old)
        for take in result['takes']:
            self.assertEqual(take['transcript'],'Original independent ASR text remains literal.')
            self.assertEqual(take['original_decoder_reasons'],['asr_lexical_mismatch_requires_review'])
            self.assertFalse(take['reasons']);self.assertIsNone(take['extra_word_proof'][0]['listening_verdict'])
        self.assertEqual(set(result['finalizer']['removed_reasons']),set(self.ids))
    def test_each_optional_proof_is_independently_scoped(self):
        for key,ident in [('native625_root_evidence_path',f.meta_name.ID),('meta_name_root_evidence_path',f.native625.ID)]:
            result=self.finish(**{key:None});self.assertEqual(result['status'],'review_required')
            self.assertEqual(set(result['finalizer']['removed_reasons']),{ident})
            (self.run/'final-scoped.json').unlink()
    def test_missing_root_and_wrong_case_id_rejected(self):
        for path in [self.meta_envelope,self.native_envelope]:
            original=path.read_bytes()
            for change in [lambda d:d.update(approval=None),lambda d:d['approval'].update(id='story-other'),lambda d:d['approval'].update(reviewed_by='agent')]:
                self.mutate(path,change)
                with self.assertRaises(f.core.SafeError):self.finish()
                self.assertFalse((self.run/'final-scoped.json').exists());path.write_bytes(original)
    def test_complete_source_and_body_not_substituted(self):
        for index in [0,1]:
            source=(self.run/'lines.private.json').read_bytes();base=self.base_path.read_bytes()
            d=f.core.read_json(self.run/'lines.private.json');d['lines'][index]['text']+=' Extra word.';f.core.save(self.run/'lines.private.json',d)
            self.base['manifest_sha256']=f.qa.digest(self.run/'lines.private.json');self.base['takes'][index]['text_sha256']=f.qa.text_hash(d['lines'][index]['text']);f.core.save(self.base_path,self.base)
            with self.assertRaises(f.core.SafeError):self.finish()
            (self.run/'lines.private.json').write_bytes(source);self.base_path.write_bytes(base);self.base=f.core.read_json(self.base_path)
        self.mutate(self.native_document,lambda d:d['evidence'].update(source='Ugh. Dann laufe ich eben bis ich umfalle.'))
        with self.assertRaises(f.core.SafeError):self.finish()
    def test_private_bindings_and_symlink_escapes_rejected(self):
        outside=self.run.parent/(self.run.name+'-outside.json');outside.write_text('{}');self.addCleanup(outside.unlink)
        link=self.run/'outside-link.json';link.symlink_to(outside)
        for path,key in [(self.meta_envelope,'pro_record_path'),(self.native_envelope,'native625_document_path')]:
            original=path.read_bytes()
            for value in [str(outside),str(link)]:
                self.mutate(path,lambda d:d['bindings'].update({key:value}))
                with self.assertRaises(f.core.SafeError):self.finish()
                path.write_bytes(original)
        self.mutate(self.native_document,lambda d:d['evidence']['files']['actual_raw'].update(path=str(outside),sha256=f.qa.digest(outside)))
        with self.assertRaises(f.core.SafeError):self.finish()
    def test_wrong_base_qa_path_rejected_even_with_identical_bytes(self):
        alternate=self.run/'other-base.json';alternate.write_bytes(self.base_path.read_bytes())
        self.mutate(self.meta_envelope,lambda d:d['bindings'].update(qa_report_path=str(alternate)))
        with self.assertRaises(f.core.SafeError):self.finish()
    def test_stale_source_audio_and_raw_proof_rejected(self):
        audio=self.run/'clips'/(f.meta_name.ID+'.mp3');old=audio.read_bytes();audio.write_bytes(b'stale')
        with self.assertRaises(f.core.SafeError):self.finish()
        audio.write_bytes(old);self.template['clip_sha256']='changed'
        with self.assertRaises(f.core.SafeError):self.finish()
        self.template['clip_sha256']=self.base['clip_sha256'][f.meta_name.ID];self.raw.write_text('changed raw response')
        with self.assertRaises(f.core.SafeError):self.finish()
    def test_all_signal_asr_and_global_failures_survive(self):
        for take in self.base['takes']:
            take['signal']['peak']=1.3
            for reason in ['possible_clipping','asr_check_failed_ValueError','asr_check_failed_RuntimeError','fatal_model_failure']:
                take['reasons'].append(reason);self.base['failures'].append({'id':take['id'],'reason':reason})
        self.base['failures'].append({'id':None,'reason':'unexpected_clip_files'});f.core.save(self.base_path,self.base)
        result=self.finish();self.assertEqual(result['status'],'review_required')
        self.assertTrue(all(set(t['reasons'])=={'possible_clipping','asr_check_failed_ValueError','asr_check_failed_RuntimeError','fatal_model_failure'} for t in result['takes']))
        self.assertIn({'id':None,'reason':'unexpected_clip_files'},result['failures'])
    def test_actual_hashbound_root_veto_survives_new_word_proof(self):
        evidence=self.run/'veto-evidence.json';ident=self.ids[0];f.core.save(evidence,{'id':ident,'clip_sha256':self.base['clip_sha256'][ident],'source_text_sha256':f.qa.text_hash(self.rows[0]['text'])})
        veto=self.run/'veto.json';f.core.save(veto,{'records':[{'id':ident,'status':'root_retake_required','reviewed_by':'root actual review',
            'reason':'Actual unaccounted independent word defect.','clip_sha256':self.base['clip_sha256'][ident],'text_sha256':f.qa.text_hash(self.rows[0]['text']),
            'evidence':[{'file':evidence.name,'sha256':f.qa.digest(evidence)}]}]})
        result=self.finish(veto_path=veto);self.assertEqual(result['status'],'review_required')
        self.assertIn('independent_audio_word_defect',result['takes'][0]['reasons'])
    def test_proof_change_during_qualification_refuses_write(self):
        real=f.meta_name.review;calls=0
        def changed(*args):
            nonlocal calls
            value=real(*args);calls+=1
            if calls==2:value['proof']['source_row']=dict(value['proof']['source_row'],mood='changed')
            return value
        with patch.object(f.meta_name,'review',side_effect=changed):
            with self.assertRaises(f.core.SafeError):self.finish()
        self.assertFalse((self.run/'final-scoped.json').exists())
    def test_helper_and_protected_hash_change_refuses_write(self):
        real_digest=f.qa.digest
        for target in [Path(f.meta_name.__file__).resolve(),Path(f.qa.__file__).resolve()]:
            changed=False;calls=0
            def current_hash(path):return 'changed-helper-bytes' if changed and Path(path).resolve()==target else real_digest(path)
            def changed_during_recheck(run,doc):
                nonlocal changed,calls
                value=self.native_result(run,doc);calls+=1
                if calls==2:changed=True
                return value
            with patch.object(f.qa,'digest',side_effect=current_hash),patch.object(f.native625,'validate',side_effect=changed_during_recheck):
                with self.assertRaises(f.core.SafeError):self.finish()
            self.assertEqual(calls,2);self.assertFalse((self.run/'final-scoped.json').exists())
    def test_envelope_change_after_last_helper_review_refuses_write(self):
        calls=0
        def changed(run,doc):
            nonlocal calls
            value=self.native_result(run,doc);calls+=1
            if calls==2:self.native_envelope.write_text(self.native_envelope.read_text()+' ')
            return value
        with patch.object(f.native625,'validate',side_effect=changed):
            with self.assertRaises(f.core.SafeError):self.finish()
        self.assertEqual(calls,2);self.assertFalse((self.run/'final-scoped.json').exists())

if __name__=='__main__':unittest.main()
