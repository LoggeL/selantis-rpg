#!/usr/bin/env python3
"""Offline fixtures: no models, accounts or remote APIs."""
import json
import copy
import story_voice_vocal_qc as vocal
import story_voice_transcribe as independent
import math
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest
import wave
import story_voice_qa as qa

class StoryQA(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.run=Path(self.temp.name)
        (self.run/'clips').mkdir();self.ident='story-'+'a'*24
        self.line={'id':self.ident,'text':'He, komm her!'}
        (self.run/'lines.private.json').write_text(json.dumps({'lines':[self.line]}))
        self.clip=self.run/'clips'/(self.ident+'.mp3');self.clip.write_bytes(b'fixture')
        self.metrics=qa.analyze_samples([math.sin(i*.12)*.3 for i in range(24000)]+[0]*2400)
    def tearDown(self):self.temp.cleanup()
    def runqa(self,text=None,**kwargs):
        return qa.qualify(self.run,asr=lambda p:text or self.line['text'],decode_fn=lambda p:self.metrics,**kwargs)
    def record(self,transcript='Hey, komm her!'):
        return {'clip_sha256':qa.digest(self.clip),'text_sha256':qa.text_hash(self.line['text']),
                'transcript_sha256':qa.text_hash(transcript),'status':'accepted_word_variants',
                'reviewed_by':'offline fixture reviewer','reason':'Explicit call interjection variant',
                'accepted_word_variants':[{'expected':'He','observed':'Hey'}]}
    def independent_record(self):
        sha=qa.digest(self.clip)
        return {'id':self.ident,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,
                'source_text_sha256':qa.text_hash(self.line['text']),'input_mime_type':'audio/mpeg',
                'model':independent.MODEL,'prompt':independent.PROMPT,'transcript':self.line['text'],
                'response':{'modelVersion':independent.MODEL,'candidates':[{'finishReason':'STOP',
                    'content':{'parts':[{'text':json.dumps({'transcript':self.line['text']})}]}}]}}
    def test_independent_exact_complete_match(self):
        r=self.runqa('Hey, komm her!',independent_records={self.ident:self.independent_record()})
        self.assertEqual(r['status'],'passed')
        self.assertEqual(r['takes'][0]['adjudication']['resolution'],'independent_audio_full_text_match')
    def test_independent_clears_only_local_asr_failure(self):
        def uncertain(path):raise ValueError('uncertain_asr_segments')
        r=qa.qualify(self.run,asr=uncertain,decode_fn=lambda p:self.metrics,
                     independent_records={self.ident:self.independent_record()})
        self.assertEqual(r['status'],'passed')
        self.assertEqual(r['takes'][0]['local_asr_failure'],'asr_check_failed_ValueError')
        self.assertEqual(r['takes'][0]['local_asr_failure_detail'],'uncertain_asr_segments')
    def test_independent_nonmatch_does_not_clear_asr_failure(self):
        def uncertain(path):raise ValueError('uncertain_asr_segments')
        record=self.independent_record();record['transcript']='He, her!'
        record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':record['transcript']})
        r=qa.qualify(self.run,asr=uncertain,decode_fn=lambda p:self.metrics,independent_records={self.ident:record})
        self.assertEqual(r['status'],'review_required')
        self.assertIn('asr_check_failed_ValueError',r['takes'][0]['reasons'])
    def test_independent_does_not_waive_signal_failure(self):
        def uncertain(path):raise ValueError('uncertain_asr_segments')
        r=qa.qualify(self.run,asr=uncertain,decode_fn=lambda p:qa.analyze_samples([0]*24000),
                     independent_records={self.ident:self.independent_record()})
        self.assertEqual(r['status'],'review_required')
        self.assertIn('silent_audio',r['takes'][0]['reasons'])
        self.assertIn('adjudication',r['takes'][0])
    def test_independent_does_not_waive_audio_mutation(self):
        record=self.independent_record()
        def mutate(path):
            path.write_bytes(b'changed');raise ValueError('uncertain_asr_segments')
        r=qa.qualify(self.run,asr=mutate,decode_fn=lambda p:self.metrics,independent_records={self.ident:record})
        self.assertEqual(r['status'],'review_required')
        self.assertNotIn('adjudication',r['takes'][0])
    def name_approval_fixture(self):
        self.line['text']='Kyra, gefesselt.'
        (self.run/'lines.private.json').write_text(json.dumps({'lines':[self.line]}))
        record=self.independent_record();record['transcript']='Kira, gefesselt.'
        record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':record['transcript']})
        approval={'channel':'independent','clip_sha256':qa.digest(self.clip),
                  'text_sha256':qa.text_hash(self.line['text']),
                  'transcript_sha256':qa.text_hash(record['transcript']),
                  'independent_record_sha256':qa.text_hash(json.dumps(record,sort_keys=True,ensure_ascii=False)),
                  'status':'accepted_word_variants','reviewed_by':'fixture reviewer',
                  'reason':'Profile proposes KI-ra, Y as i; clip-specific reviewed spelling.',
                  'accepted_word_variants':[{'expected':'Kyra','observed':'Kira'}]}
        return record,approval
    def test_secondary_scoped_name_clears_primary_unrelated_bad_word(self):
        record,approval=self.name_approval_fixture()
        r=self.runqa('Kyra, gewesselt.',independent_records={self.ident:record},adjudications={self.ident:approval})
        self.assertEqual(r['status'],'passed')
        a=r['takes'][0]['adjudication']
        self.assertEqual(a['resolution'],'independent_explicit_hash_bound_word_variants')
        self.assertEqual(a['primary_transcript'],'Kyra, gewesselt.')
        self.assertEqual(a['transcript'],'Kira, gefesselt.')
        self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),'Kira, gefesselt.',{self.ident:approval}))
    def test_secondary_approval_hash_pair_and_channel_mismatch(self):
        record,approval=self.name_approval_fixture()
        for field in ['clip_sha256','text_sha256','transcript_sha256','independent_record_sha256','channel']:
            bad=dict(approval);bad[field]='wrong'
            self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'wrong',{self.ident:record},{self.ident:bad}))
        bad=dict(approval);bad['accepted_word_variants']=[{'expected':'Kyra','observed':'Lea'}]
        self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'wrong',{self.ident:record},{self.ident:bad}))
    def test_secondary_spelling_channel_refuses_inflection_and_vowel_changes(self):
        for source,observed in [('Lia','Lea'),('habe','hab'),('hatten','hat')]:
            self.line['text']=source;record=self.independent_record();record['transcript']=observed
            record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':observed})
            approval={'channel':'independent','clip_sha256':qa.digest(self.clip),
                      'text_sha256':qa.text_hash(source),'transcript_sha256':qa.text_hash(observed),
                      'independent_record_sha256':qa.text_hash(json.dumps(record,sort_keys=True,ensure_ascii=False)),
                      'status':'accepted_word_variants','reviewed_by':'fixture','reason':'fixture',
                      'accepted_word_variants':[{'expected':source,'observed':observed}]}
            self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'wrong',{self.ident:record},{self.ident:approval}))
    def test_independent_negative_bindings(self):
        for field in ['clip_sha256','source_audio_sha256','upload_sha256','source_text_sha256','prompt','model','input_mime_type','transcript']:
            record=self.independent_record();record[field]='wrong'
            self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'wrong',{self.ident:record}),field)
        for change in [lambda r:r['response'].update(modelVersion='wrong'),
                       lambda r:r['response']['candidates'][0].update(finishReason='MAX_TOKENS'),
                       lambda r:r['response'].update(candidates=[])]:
            record=self.independent_record();change(record)
            self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'wrong',{self.ident:record}))
    def test_independent_omission_and_extra_fail(self):
        for transcript in ['He, her!', 'He, komm her, bitte!']:
            record=self.independent_record();record['transcript']=transcript
            record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':transcript})
            self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'wrong',{self.ident:record}))
    def test_independent_request_has_no_authored_text(self):
        request=independent.request_for(b'fake audio fixture')
        parts=request['contents'][0]['parts']
        self.assertEqual(parts[0],{'text':independent.PROMPT})
        self.assertEqual(parts[1]['inlineData']['mimeType'],'audio/mpeg')
        self.assertNotIn(self.line['text'],json.dumps(request))
    def ctc_fixture(self):
        self.line['text']='He'
        (self.run/'lines.private.json').write_text(json.dumps({'lines':[self.line]}))
        vocab={'<pad>':0,'h':1,'e':2,'|':3};ids=[0,1,1,0,2,0];probs=[.9]*len(ids)
        hashes={n:'a'*64 for n in ['config.json','vocab.json','preprocessor_config.json','pytorch_model.bin']}
        model={'model_id':qa.CTC_MODEL_ID,'revision':qa.CTC_REVISION,'file_sha256':hashes,
               'fingerprint':qa.text_hash(json.dumps(hashes,sort_keys=True))}
        greedy={'method':qa.CTC_METHOD,'authored_initial_prompt':None,'unknown_tokens':[],
                'argmax_token_ids':ids,'argmax_token_probabilities':probs,
                'argmax_token_ids_sha256':qa.text_hash(json.dumps(ids,separators=(',',':'))),
                'frame_evidence_sha256':qa.text_hash(json.dumps({'argmax_token_ids':ids,'argmax_token_probabilities':probs},sort_keys=True,separators=(',',':'))),
                'blank_token_id':0,'collapsed_token_ids':[1,2],'transcript':'he',
                'token_id_to_label':{str(i):label for label,i in vocab.items()}}
        return {'receipt':{'id':self.ident,'binding':{'audio_sha256':qa.digest(self.clip),
                    'text_sha256':qa.text_hash(self.line['text']),
                    'source_manifest_sha256':qa.digest(self.run/'lines.private.json'),
                    'engine':qa.CTC_ENGINE,'model':model,'script_sha256':'c'*64},'greedy_decode':greedy,
                    'alignment':{'words':[{'word':'He'}]}},
                'receipt_sha256':'b'*64,'approval':{'status':'approved_greedy_exact','receipt_sha256':'b'*64,
                    'reviewed_by':'root fixture reviewer','reason':'Inspected independent raw greedy words'},
                'vocab':vocab,'vocab_sha256':hashes['vocab.json'],'actual_script_sha256':'c'*64}
    def test_ctc_greedy_exact_with_root_approval(self):
        record=self.ctc_fixture()
        r=self.runqa('Ach',ctc_records={self.ident:record})
        self.assertEqual(r['status'],'passed')
        self.assertEqual(r['takes'][0]['adjudication']['resolution'],'root_approved_unprompted_CTC_greedy_exact_words')
    def test_ctc_never_uses_forced_alignment(self):
        record=self.ctc_fixture();g=record['receipt']['greedy_decode'];g['transcript']='Ach'
        self.assertIsNone(qa.ctc_review(self.line,qa.digest(self.clip),qa.digest(self.run/'lines.private.json'),{self.ident:record}))
        record=self.ctc_fixture();record['receipt']['greedy_decode']['method']='forced_authored_alignment'
        self.assertIsNone(qa.ctc_review(self.line,qa.digest(self.clip),qa.digest(self.run/'lines.private.json'),{self.ident:record}))
    def test_ctc_binding_and_raw_frame_guards(self):
        fixture=self.ctc_fixture()
        changes=[lambda r:r['approval'].update(status='proposal'),
                 lambda r:r['approval'].update(receipt_sha256='wrong'),
                 lambda r:r['receipt']['binding'].update(audio_sha256='wrong'),
                 lambda r:r['receipt']['binding'].update(text_sha256='wrong'),
                 lambda r:r['receipt']['binding'].update(source_manifest_sha256='wrong'),
                 lambda r:r['receipt']['binding'].update(script_sha256='wrong'),
                 lambda r:r['receipt']['binding']['model'].update(revision='0'*40),
                 lambda r:r['receipt']['binding']['model'].update(fingerprint='wrong'),
                 lambda r:r['receipt']['greedy_decode'].update(authored_initial_prompt='He'),
                 lambda r:r['receipt']['greedy_decode'].update(argmax_token_ids=[1,2]),
                 lambda r:r['receipt']['greedy_decode'].update(frame_evidence_sha256='wrong'),
                 lambda r:r['receipt']['greedy_decode'].update(token_id_to_label={'1':'a'}),
                 lambda r:r.update(vocab_sha256='wrong')]
        for change in changes:
            record=json.loads(json.dumps(fixture));change(record)
            self.assertIsNone(qa.ctc_review(self.line,qa.digest(self.clip),qa.digest(self.run/'lines.private.json'),{self.ident:record}))
    def test_ctc_does_not_waive_signal(self):
        record=self.ctc_fixture()
        def uncertain(path):raise ValueError('uncertain_asr_segments')
        r=qa.qualify(self.run,asr=uncertain,decode_fn=lambda p:qa.analyze_samples([0]*24000),ctc_records={self.ident:record})
        self.assertEqual(r['status'],'review_required');self.assertIn('silent_audio',r['takes'][0]['reasons'])
    def segmentation_fixture(self,source,actual):
        self.line['text']=source
        (self.run/'lines.private.json').write_text(json.dumps({'lines':[self.line]}))
        return {'channel':'primary','clip_sha256':qa.digest(self.clip),
                'text_sha256':qa.text_hash(source),'transcript_sha256':qa.text_hash(actual),
                'status':'accepted_orthographic_segmentation','reviewed_by':'fixture reviewer',
                'reason':'Identical full letters, explicitly reviewed word segmentation.',
                'expected_tokens':qa.words(source),'observed_tokens':qa.words(actual)}
    def test_explicit_orthographic_segmentation(self):
        for source,actual in [('zu Hause','zuhause'),('wund gescheuert','wundgescheuert'),('so was','sowas')]:
            record=self.segmentation_fixture(source,actual)
            r=self.runqa(actual,adjudications={self.ident:record})
            self.assertEqual(r['status'],'passed')
            self.assertEqual(r['takes'][0]['adjudication']['resolution'],'explicit_hash_bound_orthographic_segmentation')
            (self.run/'qa-asr-cache.private.json').unlink()
    def test_segmentation_hash_token_and_channel_guards(self):
        record=self.segmentation_fixture('zu Hause','zuhause')
        for field in ['clip_sha256','text_sha256','transcript_sha256','channel','reviewed_by','reason']:
            bad=dict(record);bad[field]='wrong' if field not in {'reviewed_by','reason'} else ''
            self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),'zuhause',{self.ident:bad}))
        for field,value in [('expected_tokens',['zu']),('observed_tokens',['haus']),('expected_tokens','zu Hause')]:
            bad=dict(record);bad[field]=value
            self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),'zuhause',{self.ident:bad}))
    def test_segmentation_rejects_letters_missing_repeated_or_names(self):
        for source,actual in [('Ich habe','Ich hab'),('Lia','Lea'),('Kyra','Kira'),
                              ('zu Hause','zu Haus'),('zu Hause','zuhause zuhause'),
                              ('zu Hause','zu Hause'),('zu Hause','')]:
            record=self.segmentation_fixture(source,actual)
            self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),actual,{self.ident:record}))
    def test_unapproved_segmentation_stays_failed(self):
        self.segmentation_fixture('zu Hause','zuhause')
        self.assertEqual(self.runqa('zuhause')['status'],'review_required')
    def vocal_fixture(self,source='Hihi! Kyra, hör auf!',actual='Kyra, hör auf!',category='laughter'):
        self.line['text']=source;(self.run/'lines.private.json').write_text(json.dumps({'lines':[self.line]}))
        event={'category':category,'description':'Observed brief voiced event.','vocal_sound':'','confidence':.9}
        response={'modelVersion':vocal.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':actual,'events':[event]})}]}}]}
        sha=qa.digest(self.clip)
        record={'id':self.ident,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,
            'source_text_sha256':qa.text_hash(source),'input_mime_type':'audio/mpeg','model':vocal.MODEL,
            'prompt':vocal.PROMPT,'transcript':actual,'response':response,**vocal.cache_metadata()}
        approval={'channel':'vocal-qc','status':'approved_vocal_events','reviewed_by':'root fixture reviewer',
            'reason':'One authored gesture is explicitly mapped to one observed event; all other words retained.',
            'clip_sha256':sha,'text_sha256':qa.text_hash(source),'vocal_record_sha256':qa.canonical_record_hash(record),
            'raw_response_sha256':qa.canonical_record_hash(response),'transcript_sha256':qa.text_hash(actual),
            'expected_tokens':qa.words(source),'observed_tokens':qa.words(actual),**vocal.cache_metadata(),
            'source_events':[{'source_token_index':0,'source_token':qa.words(source)[0],'category':category,
                'event_indices':[0],'descriptions':[event['description']],'observed_token_indices':[],
                'reason':'Root individually mapped the source token to this event.'}]}
        return record,approval

    def check_vocal(self,record,approval,**kwargs):
        return qa.vocal_review(self.line,qa.digest(self.clip),'', {self.ident:record},{self.ident:approval},**kwargs)

    def test_vocal_exact_full_other_words_and_root_mapping(self):
        record,approval=self.vocal_fixture()
        self.assertIsNotNone(self.check_vocal(record,approval))
        result=self.runqa('Kyra, hör auf!',vocal_records={self.ident:record},vocal_adjudications={self.ident:approval})
        self.assertEqual(result['status'],'passed');self.assertFalse(result['takes'][0]['adjudication']['model_timestamps_used'])

    def test_vocal_all_raw_audio_source_schema_prompt_root_hash_guards(self):
        record,approval=self.vocal_fixture()
        for field in ['clip_sha256','text_sha256','vocal_record_sha256','raw_response_sha256','transcript_sha256','schema_sha256','prompt_sha256','qc_contract_version','status','channel','reviewed_by','reason']:
            changed=copy.deepcopy(approval);changed[field]=''
            self.assertIsNone(self.check_vocal(record,changed),field)
        for field in ['clip_sha256','upload_sha256','source_audio_sha256','source_text_sha256','schema_sha256','prompt_sha256','model','prompt']:
            changed=copy.deepcopy(record);changed[field]='wrong'
            self.assertIsNone(self.check_vocal(changed,approval),field)
        changed=copy.deepcopy(record);changed['response']['candidates'][0]['finishReason']='MAX_TOKENS'
        self.assertIsNone(self.check_vocal(changed,approval))

    def test_vocal_confidence_class_description_source_and_event_positions(self):
        record,approval=self.vocal_fixture()
        for field,value in [('source_token_index',1),('source_token','haha'),('category','scream'),('event_indices',[1]),('descriptions',['guessed']),('observed_token_indices',[0]),('reason','')]:
            changed=copy.deepcopy(approval);changed['source_events'][0][field]=value
            self.assertIsNone(self.check_vocal(record,changed),(field,value))
        for value in [.79,float('nan'),True]:
            changed=copy.deepcopy(record);body={'transcript':changed['transcript'],'events':[{'category':'laughter','description':'Observed brief voiced event.','vocal_sound':'','confidence':value}]}
            changed['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps(body)
            app=copy.deepcopy(approval);app['vocal_record_sha256']=qa.canonical_record_hash(changed);app['raw_response_sha256']=qa.canonical_record_hash(changed['response'])
            self.assertIsNone(self.check_vocal(changed,app))

    def test_vocal_lexical_missing_extra_changed_actor_not_excused(self):
        for actual in ['Kyra, auf!','Kyra, hör auf jetzt!','Lia, hör auf!']:
            record,approval=self.vocal_fixture(actual=actual)
            self.assertIsNone(self.check_vocal(record,approval))
        for source in ['Au! Kyra, hör auf!','He! Kyra, hör auf!','Ach! Kyra, hör auf!','Uff! Kyra, hör auf!']:
            record,approval=self.vocal_fixture(source=source,category='groan')
            self.assertIsNone(self.check_vocal(record,approval))

    def test_vocal_one_word_scream_no_oh_hae_or_duplicate_cry(self):
        record,approval=self.vocal_fixture(source='AAAAAAH!',actual='Ah!',category='scream')
        approval['source_events'][0]['observed_token_indices']=[0]
        self.assertIsNotNone(self.check_vocal(record,approval))
        for actual in ['Oh!','Hä!','Ah! Oh!','Ah! Ah!']:
            record,approval=self.vocal_fixture(source='AAAAAAH!',actual=actual,category='scream')
            approval['source_events'][0]['observed_token_indices']=list(range(len(qa.words(actual))))
            self.assertIsNone(self.check_vocal(record,approval))

    def test_vocal_order_count_and_complete_event_coverage(self):
        record,approval=self.vocal_fixture()
        event=json.loads(record['response']['candidates'][0]['content']['parts'][0]['text'])['events'][0]
        record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':record['transcript'],'events':[event,event]})
        approval.update(vocal_record_sha256=qa.canonical_record_hash(record),raw_response_sha256=qa.canonical_record_hash(record['response']))
        self.assertIsNone(self.check_vocal(record,approval)) # extra event left unbound
        mapping=approval['source_events'][0];mapping.update(event_indices=[0,1],descriptions=[event['description']]*2)
        self.assertIsNone(self.check_vocal(record,approval)) # count justification missing
        mapping['count_reason']='One written Hihi is two specifically reviewed laugh pulses.'
        self.assertIsNotNone(self.check_vocal(record,approval))
        mapping['event_indices']=[1,0];self.assertIsNone(self.check_vocal(record,approval))

    def test_vocal_uncertain_primary_clean_signal_only_unchanged_audio(self):
        record,approval=self.vocal_fixture()
        def uncertain(path):raise ValueError('uncertain_asr_segments')
        result=qa.qualify(self.run,asr=uncertain,decode_fn=lambda p:self.metrics,vocal_records={self.ident:record},vocal_adjudications={self.ident:approval})
        self.assertEqual(result['status'],'passed')
        result=qa.qualify(self.run,asr=uncertain,decode_fn=lambda p:qa.analyze_samples([0]*24000),vocal_records={self.ident:record},vocal_adjudications={self.ident:approval})
        self.assertEqual(result['status'],'review_required');self.assertNotIn('adjudication',result['takes'][0])
        def mutated(path):path.write_bytes(b'new');raise ValueError('uncertain_asr_segments')
        result=qa.qualify(self.run,asr=mutated,decode_fn=lambda p:self.metrics,vocal_records={self.ident:record},vocal_adjudications={self.ident:approval})
        self.assertEqual(result['status'],'review_required')

    def test_vocal_never_waives_nonrecognition_primary_failure(self):
        record,approval=self.vocal_fixture()
        def broken(path):raise RuntimeError('cache or unrelated execution failure')
        result=qa.qualify(self.run,asr=broken,decode_fn=lambda p:self.metrics,vocal_records={self.ident:record},vocal_adjudications={self.ident:approval})
        self.assertEqual(result['status'],'review_required');self.assertNotIn('adjudication',result['takes'][0])

    def test_vocal_invalid_scoped_approval_cannot_bypass_via_primary_exact(self):
        record,approval=self.vocal_fixture();approval['raw_response_sha256']='wrong'
        result=self.runqa(self.line['text'],vocal_records={self.ident:record},vocal_adjudications={self.ident:approval})
        self.assertEqual(result['status'],'review_required');self.assertIn('vocal_adjudication_requires_review',result['takes'][0]['reasons'])

    def test_vocal_separately_hash_bound_named_word_variant(self):
        record,approval=self.vocal_fixture(actual='Kira, hör auf!')
        lexical={'channel':'vocal-qc','status':'accepted_word_variants','reviewed_by':'root fixture reviewer','reason':'Individually reviewed KI-ra spelling.',
            'clip_sha256':qa.digest(self.clip),'text_sha256':qa.text_hash(self.line['text']),
            'transcript_sha256':qa.text_hash(record['transcript']),'vocal_record_sha256':qa.canonical_record_hash(record),
            'accepted_word_variants':[{'expected':'kyra','observed':'kira'}]}
        self.assertIsNotNone(self.check_vocal(record,approval,word_approvals={self.ident:lexical}))
        lexical['clip_sha256']='stale';self.assertIsNone(self.check_vocal(record,approval,word_approvals={self.ident:lexical}))
        record,approval=self.vocal_fixture(actual='Lia, hör auf!');lexical.update(clip_sha256=qa.digest(self.clip),transcript_sha256=qa.text_hash(record['transcript']),vocal_record_sha256=qa.canonical_record_hash(record),accepted_word_variants=[{'expected':'kyra','observed':'lia'}])
        self.assertIsNone(self.check_vocal(record,approval,word_approvals={self.ident:lexical}))

    def natural_independent_fixture(self,source,actual):
        self.line['text']=source;(self.run/'lines.private.json').write_text(json.dumps({'lines':[self.line]}))
        record=self.independent_record();record['transcript']=actual
        record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':actual})
        variants=[{'expected':aa,'observed':bb} for aa,bb in zip(qa.words(source),qa.words(actual)) if aa!=bb]
        approval={'channel':'independent','status':'accepted_natural_word_variants','reviewed_by':'root fixture reviewer','reason':'Explicit grammatical optional schwa, all remaining words exact.',
            'clip_sha256':qa.digest(self.clip),'text_sha256':qa.text_hash(source),'transcript_sha256':qa.text_hash(actual),
            'independent_record_sha256':qa.canonical_record_hash(record),'accepted_word_variants':variants}
        return record,approval

    def test_independent_explicit_natural_schwa_and_imperative(self):
        for source,actual in [('Ich hab es gesagt.','Ich habe es gesagt.'),('Ich lese hier.','Ich les hier.'),('Stimm die Laute.','Stimme die Laute.')]:
            record,approval=self.natural_independent_fixture(source,actual)
            self.assertIsNotNone(qa.independent_review(self.line,qa.digest(self.clip),'Äh, falsch.',{self.ident:record},{self.ident:approval}))
            self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'',{self.ident:record},{}))
            approval['independent_record_sha256']='stale';self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'',{self.ident:record},{self.ident:approval}))

    def test_independent_natural_rejects_names_actor_tense_or_multitoken(self):
        for source,actual in [('Lia kommt.','Lea kommt.'),('Kyra kommt.','Kira kommt.'),('Ich gehe.','Du gehst.'),('Ich ging.','Ich gehe.'),('Ich hab es.','Ich habs.'),('Er habe es.','Er hab es.'),('Ich hab es.','Ich habe es Äh.')]:
            record,approval=self.natural_independent_fixture(source,actual)
            self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'',{self.ident:record},{self.ident:approval}),(source,actual))

    def full_qc_fixture(self,source='Pah.',actual='Pah.'):
        record,approval=self.vocal_fixture(source=source,actual=actual,category='other')
        record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps({'transcript':actual,'events':[]})
        approval.update(channel='vocal-qc-fulltext',status='approved_qc_fulltext',vocal_record_sha256=qa.canonical_record_hash(record),raw_response_sha256=qa.canonical_record_hash(record['response']))
        approval.pop('source_events')
        return record,approval

    def test_qc_fulltext_explicit_root_zero_events_not_automatic(self):
        record,approval=self.full_qc_fixture()
        self.assertIsNotNone(self.check_vocal(record,approval))
        self.assertIsNone(self.check_vocal(record,{}))
        result=self.runqa('PAM!',vocal_records={self.ident:record},vocal_adjudications={self.ident:approval})
        self.assertEqual(result['status'],'passed');self.assertEqual(result['takes'][0]['adjudication']['resolution'],'root_hash_bound_actual_qc_fulltext_zero_events')

    def test_qc_fulltext_wrong_words_extra_events_and_hashes_fail(self):
        for actual in ['Puh.','Pah Pah.','']:
            record,approval=self.full_qc_fixture(actual=actual);self.assertIsNone(self.check_vocal(record,approval))
        record,approval=self.vocal_fixture(source='Pah.',actual='Pah.',category='other')
        approval.update(channel='vocal-qc-fulltext',status='approved_qc_fulltext')
        self.assertIsNone(self.check_vocal(record,approval))
        record,approval=self.full_qc_fixture()
        for field in ['clip_sha256','text_sha256','schema_sha256','prompt_sha256','qc_contract_version','vocal_record_sha256','raw_response_sha256','transcript_sha256','expected_tokens','observed_tokens','reviewed_by','reason']:
            bad=copy.deepcopy(approval);bad[field]='';self.assertIsNone(self.check_vocal(record,bad),field)

    def contextual_fixture(self,token='Uff',sound='uff',category='groan'):
        record,approval=self.vocal_fixture(source=token+'. Ich bleib liegen.',actual='Ich bleib liegen.',category=category)
        body=json.loads(record['response']['candidates'][0]['content']['parts'][0]['text']);body['events'][0]['vocal_sound']=sound
        record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps(body)
        approval.update(vocal_record_sha256=qa.canonical_record_hash(record),raw_response_sha256=qa.canonical_record_hash(record['response']))
        approval['source_events'][0].update(vocal_sound=sound,source_context_reason='Root checked this written effort in the current source sentence.')
        return record,approval

    def test_contextual_exact_sound_class_root_context_per_position(self):
        for token,sound,category in [('Uff','uff','groan'),('Pah','pah','other'),('Ha','ha','laughter'),('Hm','hm','other'),('Hm','m','groan'),('Hm','mh','muffled_vocalization')]:
            record,approval=self.contextual_fixture(token,sound,category)
            self.assertIsNotNone(self.check_vocal(record,approval),(token,sound,category))
            changed=copy.deepcopy(approval);changed['source_events'][0]['source_context_reason']='';self.assertIsNone(self.check_vocal(record,changed))
            changed=copy.deepcopy(approval);changed['source_events'][0]['vocal_sound']='invented';self.assertIsNone(self.check_vocal(record,changed))

    def test_contextual_no_interchange_vowels_lexical_interjections_or_extra_words(self):
        for token,sound,category in [('Pah','pff','other'),('Pah','puh','other'),('Ha','haha','laughter'),('Ha','ah','laughter'),('Uff','ngh ff','groan'),('Hm','huh','other'),('Au','au','groan'),('He','he','other'),('Ach','ach','groan')]:
            record,approval=self.contextual_fixture(token,sound,category)
            self.assertIsNone(self.check_vocal(record,approval),(token,sound))
        record,approval=self.contextual_fixture();record['transcript']='Ich bleib liegen jetzt.'
        body=json.loads(record['response']['candidates'][0]['content']['parts'][0]['text']);body['transcript']=record['transcript']
        record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps(body)
        approval.update(vocal_record_sha256=qa.canonical_record_hash(record),raw_response_sha256=qa.canonical_record_hash(record['response']),transcript_sha256=qa.text_hash(record['transcript']),observed_tokens=qa.words(record['transcript']))
        self.assertIsNone(self.check_vocal(record,approval))

    def test_contextual_does_not_merge_multiple_events_or_remove_other_source_position(self):
        record,approval=self.contextual_fixture('Ha','ha','laughter')
        body=json.loads(record['response']['candidates'][0]['content']['parts'][0]['text']);body['events'].append(copy.deepcopy(body['events'][0]))
        record['response']['candidates'][0]['content']['parts'][0]['text']=json.dumps(body)
        approval.update(vocal_record_sha256=qa.canonical_record_hash(record),raw_response_sha256=qa.canonical_record_hash(record['response']))
        approval['source_events'][0].update(event_indices=[0,1],descriptions=[body['events'][0]['description']]*2,count_reason='Trying to merge extra source event')
        self.assertIsNone(self.check_vocal(record,approval))
        record,approval=self.contextual_fixture('Pah','pah','other');approval['source_events'][0]['source_token_index']=1
        self.assertIsNone(self.check_vocal(record,approval))

    def veto_fixture(self):
        directory=self.run/'evidence';directory.mkdir(exist_ok=True);path=directory/'decoder.private.json';path.write_text(json.dumps({'id':self.ident,'binding':{'audio_sha256':qa.digest(self.clip),'text_sha256':qa.text_hash(self.line['text'])},'actual_words':'A separately reviewed repeated phrase.'}))
        return {'id':self.ident,'status':'root_retake_required','reviewed_by':'root fixture reviewer','reason':'Root inspected explicit repeated words in current independent evidence; no human hearing claimed.',
            'clip_sha256':qa.digest(self.clip),'text_sha256':qa.text_hash(self.line['text']),'evidence':[{'file':'evidence/decoder.private.json','sha256':qa.digest(path)}]}

    def test_root_lexical_veto_overrides_primary_exact_and_qc_approval(self):
        record,approval=self.full_qc_fixture();veto=self.veto_fixture()
        result=self.runqa(self.line['text'],vocal_records={self.ident:record},vocal_adjudications={self.ident:approval},lexical_veto_records={self.ident:veto})
        self.assertEqual(result['status'],'review_required');self.assertIn('independent_audio_word_defect',result['takes'][0]['reasons']);self.assertTrue(result['takes'][0]['lexical_veto_diagnosis']['applicable'])
        self.assertIn('adjudication',result['takes'][0]) # retained as evidence, veto still overrides status

    def test_lexical_veto_stale_audio_source_transparent_no_old_veto(self):
        veto=self.veto_fixture()
        for field in ['clip_sha256','text_sha256']:
            bad=copy.deepcopy(veto);bad[field]='0'*64
            result=self.runqa(lexical_veto_records={self.ident:bad})
            self.assertEqual(result['status'],'passed');self.assertEqual(result['takes'][0]['lexical_veto_diagnosis']['reason'],'stale_lexical_veto_source_or_audio')

    def test_lexical_veto_evidence_hash_path_root_identity_fail_closed(self):
        veto=self.veto_fixture()
        changes=[('reviewed_by','worker'),('status','proposal_root_review_required'),('reason',''),('clip_sha256','not-hash')]
        for field,value in changes:
            bad=copy.deepcopy(veto);bad[field]=value
            result=self.runqa(lexical_veto_records={self.ident:bad});self.assertEqual(result['status'],'review_required')
        for filename in ['../outside.json','/tmp/outside.json']:
            bad=copy.deepcopy(veto);bad['evidence'][0]['file']=filename
            self.assertTrue(qa.lexical_veto_review(self.run,self.line,qa.digest(self.clip),{self.ident:bad})['binding_requires_review'])
        (self.run/'evidence/decoder.private.json').write_text('changed evidence')
        result=self.runqa(lexical_veto_records={self.ident:veto});self.assertEqual(result['status'],'review_required');self.assertIn('lexical_veto_binding_requires_review',result['takes'][0]['reasons'])

    def test_lexical_veto_wrong_current_evidence_id_or_audio_despite_correct_file_hash(self):
        veto=self.veto_fixture();path=self.run/'evidence/decoder.private.json'
        for mutate in [lambda b:b.update(id='story-'+'b'*24),lambda b:b['binding'].update(audio_sha256='0'*64),lambda b:b['binding'].update(text_sha256='0'*64)]:
            body={'id':self.ident,'binding':{'audio_sha256':qa.digest(self.clip),'text_sha256':qa.text_hash(self.line['text'])}}
            mutate(body);path.write_text(json.dumps(body));veto['evidence'][0]['sha256']=qa.digest(path)
            result=self.runqa(lexical_veto_records={self.ident:veto});self.assertEqual(result['status'],'review_required');self.assertIn('lexical_veto_binding_requires_review',result['takes'][0]['reasons'])

    def test_lexical_veto_loader_rejects_duplicate_proposal_or_unknown_ids(self):
        veto=self.veto_fixture();path=self.run/'veto.private.json'
        for records in [[veto,veto],[{**veto,'status':'proposal_root_review_required'}],[{**veto,'id':'bad'}]]:
            path.write_text(json.dumps({'records':records}))
            with self.assertRaises(ValueError):qa.load_lexical_veto_records(path)
        path.write_text(json.dumps({'records':[veto]}));self.assertEqual(qa.load_lexical_veto_records(path)[self.ident],veto)
        unknown=copy.deepcopy(veto);unknown['id']='story-'+'b'*24
        result=self.runqa(lexical_veto_records={unknown['id']:unknown});self.assertEqual(result['status'],'review_required');self.assertEqual(result['failures'][0]['reason'],'unknown_lexical_veto_ids')

    def test_named_spelling_helper_only_exact_dunkelhain_pair_and_existing_shapes(self):
        for aa,bb in [('Dunkelhain','Dunkelhein'),('Dunkelhein','Dunkelhain'),('Kyra','Kira'),('Crios','Krios')]:
            self.assertTrue(qa.named_spelling_equivalent(aa,bb))
        for aa,bb in [('Fol tan','Foltan'),('Foltan','Foltern'),('Lia','Lea'),('Ebaril','Eberil'),('Dunkelhain','Dunkelheim'),('Dunkelhain','Dunkelheit'),('Dunkelhains','Dunkelheins'),('sage','sagte'),('Rain','Rein')]:
            self.assertFalse(qa.named_spelling_equivalent(aa,bb),(aa,bb))

    def test_primary_named_scope_dunkelhain_requires_complete_current_approval(self):
        self.line['text']='Seit Dunkelhain sind wir hier.';(self.run/'lines.private.json').write_text(json.dumps({'lines':[self.line]}))
        actual='Seit Dunkelhein sind wir hier.'
        approval={'channel':'primary','status':'accepted_word_variants','variant_scope':'named_spelling','reviewed_by':'root named fixture reviewer',
            'reason':'Explicit place ai/ei same German diphthong.', 'clip_sha256':qa.digest(self.clip),'text_sha256':qa.text_hash(self.line['text']),
            'transcript_sha256':qa.text_hash(actual),'accepted_word_variants':[{'expected':'Dunkelhain','observed':'Dunkelhein'}]}
        self.assertIsNotNone(qa.adjudicate(self.line,qa.digest(self.clip),actual,{self.ident:approval}))
        self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),actual,{}))
        for field in ['clip_sha256','text_sha256','transcript_sha256']:
            changed=copy.deepcopy(approval);changed[field]='stale';self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),actual,{self.ident:changed}))
        for source,observed in [('Foltan','Foltern'),('Lia','Lea'),('Ebaril','Eberil'),('sage','sagte')]:
            self.line['text']=source;bad=copy.deepcopy(approval);bad.update(text_sha256=qa.text_hash(source),transcript_sha256=qa.text_hash(observed),accepted_word_variants=[{'expected':source,'observed':observed}])
            self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),observed,{self.ident:bad}))
        self.line['text']='Dunkelhain';bad=copy.deepcopy(approval);bad.pop('variant_scope');bad.update(text_sha256=qa.text_hash('Dunkelhain'),transcript_sha256=qa.text_hash('Dunkelheit'),accepted_word_variants=[{'expected':'Dunkelhain','observed':'Dunkelheit'}])
        self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),'Dunkelheit',{self.ident:bad}))

    def test_independent_dunkelhain_exact_rest_and_raw_hash_binding(self):
        record,approval=self.natural_independent_fixture('Seit Dunkelhain sind wir hier.','Seit Dunkelhein sind wir hier.')
        approval['status']='accepted_word_variants'
        result=qa.independent_review(self.line,qa.digest(self.clip),'wrong primary',{self.ident:record},{self.ident:approval})
        self.assertIsNotNone(result)
        self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'wrong primary',{self.ident:record},{}))
        changed=copy.deepcopy(approval);changed['independent_record_sha256']='stale';self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'',{self.ident:record},{self.ident:changed}))
        for source,actual in [('Seit Dunkelhain sind wir hier.','Seit Dunkelhein sind sie hier.'),('Foltan kommt.','Foltern kommt.'),('Lia kommt.','Lea kommt.'),('Ebaril steht.','Eberil steht.'),('Ich sage es.','Ich sagte es.')]:
            record,approval=self.natural_independent_fixture(source,actual);approval['status']='accepted_word_variants'
            self.assertIsNone(qa.independent_review(self.line,qa.digest(self.clip),'',{self.ident:record},{self.ident:approval}),(source,actual))

    def test_vocal_named_dunkelhain_pair_requires_separate_bound_word_record(self):
        record,approval=self.vocal_fixture(source='Hihi! Seit Dunkelhain sind wir hier.',actual='Seit Dunkelhein sind wir hier.')
        lexical={'channel':'vocal-qc','status':'accepted_word_variants','variant_scope':'named_spelling','reviewed_by':'root fixture reviewer',
            'reason':'Exact source place name diphthong, other words unchanged.','clip_sha256':qa.digest(self.clip),'text_sha256':qa.text_hash(self.line['text']),
            'transcript_sha256':qa.text_hash(record['transcript']),'vocal_record_sha256':qa.canonical_record_hash(record),
            'accepted_word_variants':[{'expected':'Dunkelhain','observed':'Dunkelhein'}]}
        self.assertIsNotNone(self.check_vocal(record,approval,word_approvals={self.ident:lexical}))
        self.assertIsNone(self.check_vocal(record,approval))
        for field in ['clip_sha256','text_sha256','transcript_sha256','vocal_record_sha256']:
            changed=copy.deepcopy(lexical);changed[field]='stale';self.assertIsNone(self.check_vocal(record,approval,word_approvals={self.ident:changed}))

    def test_exact_contract(self):
        r=self.runqa();self.assertEqual(r['status'],'passed');self.assertEqual(r['checked_ids'],[self.ident]);self.assertEqual(r['failures'],[])
        self.assertEqual(r['clip_sha256'][self.ident],qa.digest(self.clip))
    def test_omission_fails(self):self.assertEqual(self.runqa('He, her!')['status'],'review_required')
    def test_explicit_word_variant(self):
        r=self.runqa('Hey, komm her!',adjudications={self.ident:self.record()});self.assertEqual(r['status'],'passed')
    def test_bound_adjudication(self):
        for key in ['clip_sha256','text_sha256','transcript_sha256','status','reviewed_by','reason']:
            record=self.record();record[key]=''
            self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),'Hey, komm her!',{self.ident:record}))
    def test_no_missing_or_blanket_variants(self):
        record=self.record();record['transcript_sha256']=qa.text_hash('He, her!')
        self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),'He, her!',{self.ident:record}))
        record=self.record();record['accepted_word_variants'].append({'expected':'komm','observed':'komme'})
        self.assertIsNone(qa.adjudicate(self.line,qa.digest(self.clip),'Hey, komm her!',{self.ident:record}))
    def test_cache_reuse_and_replacement(self):
        self.runqa()
        def forbidden(p):raise AssertionError('cached ASR should be reused')
        self.assertEqual(qa.qualify(self.run,asr=forbidden,decode_fn=lambda p:self.metrics)['status'],'passed')
        self.clip.write_bytes(b'new fixture')
        self.assertEqual(qa.qualify(self.run,asr=forbidden,decode_fn=lambda p:self.metrics)['status'],'review_required')
    def test_silence_clipping_end_checks(self):
        silence=qa.analyze_samples([0]*24000);self.assertIn('silent_audio',qa.signal_failures(silence,3))
        clipped=qa.analyze_samples([1.0]*24000);self.assertIn('possible_clipping',qa.signal_failures(clipped,3))
        self.assertIn('possible_abrupt_audio_end',qa.signal_failures(clipped,3))
        tail=qa.analyze_samples([.1]*24000+[0]*96000);self.assertIn('excessive_end_silence',qa.signal_failures(tail,3))
    def test_nonfinite(self):
        for value in [float('nan'),float('inf')]:
            with self.assertRaises(ValueError):qa.analyze_samples([value])
    def test_missing_extra_and_duplicate(self):
        self.clip.unlink();self.assertEqual(self.runqa()['status'],'review_required')
        self.clip.write_bytes(b'fixture');(self.run/'clips/extra.mp3').write_bytes(b'x')
        self.assertEqual(self.runqa()['status'],'review_required')
        (self.run/'lines.private.json').write_text(json.dumps({'lines':[self.line,self.line]}))
        with self.assertRaises(ValueError):self.runqa()
    def test_manifest_mutation_fails(self):
        def mutate(p):
            (self.run/'lines.private.json').write_text(json.dumps({'lines':[dict(self.line,text='Andere Worte')]}))
            return self.line['text']
        r=qa.qualify(self.run,asr=mutate,decode_fn=lambda p:self.metrics)
        self.assertEqual(r['status'],'review_required')
        self.assertIn('manifest_changed_during_qa',[f['reason'] for f in r['failures']])
    def test_decode_exception_fail_closed(self):
        def bad(p):raise ValueError('decode_failed')
        r=qa.qualify(self.run,asr=lambda p:self.line['text'],decode_fn=bad)
        self.assertEqual(r['status'],'review_required');self.assertEqual(r['clip_sha256'],{})
    @unittest.skipUnless(shutil.which('ffmpeg'),'ffmpeg unavailable')
    def test_real_mp3_decode(self):
        wav=self.run/'fixture.wav'
        with wave.open(str(wav),'wb') as out:
            out.setnchannels(1);out.setsampwidth(2);out.setframerate(24000)
            out.writeframes(b''.join(struct.pack('<h',round(math.sin(i*.12)*9000)) for i in range(24000))+b'\0\0'*4800)
        subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(wav),str(self.clip)],check=True,capture_output=True)
        metrics=qa.decode(self.clip)
        self.assertAlmostEqual(metrics['seconds'],1.2,places=2)
        self.assertEqual(qa.signal_failures(metrics,3),[])
    def test_text_normalization_preserves_words(self):
        self.assertEqual(qa.words('Wo … bin ich?'),qa.words('Wo bin ich.'))
        self.assertNotEqual(qa.words('hab'),qa.words('habe'))
        self.assertNotEqual(qa.words('4'),qa.words('vier'))

if __name__=='__main__':unittest.main()
