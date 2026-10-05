#!/usr/bin/env python3
"""Offline fixtures: no models, accounts or remote APIs."""
import json
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
