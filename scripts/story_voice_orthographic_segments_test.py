#!/usr/bin/env python3
"""Actual cached Flash/Pro fixtures, scoped full-character evidence, no API."""
import copy
import io
import json
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import story_voice_orthographic_segments as o

class OrthographicGates(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.run=Path(self.temp.name).resolve()
        self.rows={i:{'id':i,'text':c['text'],'speaker':'lia','kind':'say','scene':'fixture','direction_en':'Clear.'} for i,c in o.CASES.items()}
        for folder in ['clips','independent-google-asr']:(self.run/folder).mkdir()
        o.qa.save(self.run/'prepared.json',{'model':'gemini-3.8-flash-tts'});o.qa.save(self.run/'lines.private.json',{'lines':list(self.rows.values())})
        p=patch.object(o.common,'prepared',return_value={});p.start();self.addCleanup(p.stop)
        p=patch.object(o.core,'api',side_effect=AssertionError('No real API permitted'));p.start();self.addCleanup(p.stop)
        self.capture=redirect_stdout(io.StringIO());self.capture.__enter__();self.addCleanup(self.capture.__exit__,None,None,None)
        self.records={i:{} for i in self.rows};signal={'silent':False,'seconds':3.,'clipped_fraction':0.,'peak':.4,'trailing_silence_seconds':.1,'leading_silence_seconds':.1,'last_frame_rms':0.,'rms':.1};takes=[];hashes={}
        for ident,line in self.rows.items():
            (self.run/'clips'/(ident+'.mp3')).write_bytes(('synthetic-'+ident).encode());sha=o.qa.digest(self.run/'clips'/(ident+'.mp3'));hashes[ident]=sha
            c=o.CASES[ident];tokens=o.qa.words(line['text']);transcript=' '.join(tokens[:c['index']]+c['observed']+tokens[c['index']+len(c['source']):])
            response={'modelVersion':o.flash.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':transcript})}]}}]}
            record={'id':ident,'clip_sha256':sha,'source_audio_sha256':sha,'upload_sha256':sha,'source_text_sha256':o.qa.text_hash(line['text']),'input_mime_type':'audio/mpeg','model':o.flash.MODEL,'prompt':o.flash.PROMPT,'transcript':transcript,'response':response}
            if 'Flash' in c['channels']:
                self.records[ident]['Flash']=record;o.qa.save(self.run/'independent-google-asr'/(ident+'.'+sha[:16]+'.json'),record)
            takes.append({'id':ident,'text_sha256':o.qa.text_hash(line['text']),'signal':copy.deepcopy(signal),'reasons':['asr_lexical_mismatch_requires_review'],'transcript':'Original decoder mismatch.'})
        self.qa_path=self.run/'qa26.json';o.qa.save(self.qa_path,{'version':o.qa.VERSION,'model':o.qa.MODEL,'manifest_sha256':o.qa.digest(self.run/'lines.private.json'),'clip_sha256':hashes,'takes':takes,'checked_ids':list(self.rows),'failures':[{'id':i,'reason':'asr_lexical_mismatch_requires_review'} for i in self.rows]})
        selected=[i for i,c in o.CASES.items() if 'Pro' in c['channels']];args=SimpleNamespace(only_ids=','.join(selected),max_calls=2)
        with o.pro.backend():
            folder,run=o.pro.transport.locations(self.run,'orthographic');o.pro.prepare(args,self.run,folder,run,self.rows);info=o.pro.transport.prepared(run,self.run,self.rows);o.pro.transport.reserve(self.run,run)
            o.qa.save(run/'submit-intent.private.json',{'model':o.pro.MODEL,'request_count':2,'input_sha256':info['input_sha256'],'state':'CONFIRMED'});o.qa.save(run/'job.json',{'model':o.pro.MODEL,'request_count':2,'job_name':'batches/offline'})
            responses=[]
            for ident in selected:
                c=o.CASES[ident];tokens=o.qa.words(self.rows[ident]['text']);transcript=' '.join(tokens[:c['index']]+c['observed']+tokens[c['index']+len(c['source']):]);responses.append({'key':ident,'response':{'modelVersion':o.pro.MODEL,'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps({'transcript':transcript})}]}}]}})
            with patch.object(o.core,'credential',return_value='offline'),patch.object(o.core,'fetch_status',return_value=({'response':{'inlinedResponses':responses}},'JOB_STATE_SUCCEEDED')):self.assertEqual(o.pro.collect(args,self.run,folder,run,self.rows),0)
        for record in o.core.read_json(folder/'comparison.private.json')['records']:self.records[record['id']]['Pro']=record
    def approved(self,ident):
        a=o.template(self.run,self.rows[ident],self.qa_path,self.records[ident]);a.update(status=o.APPROVED,reviewed_by='root offline',reason='Exact scoped split/join reviewed.');return a
    def test_three_complete_actual_raw_proofs_require_root_and_no_timing(self):
        for ident in self.rows:
            self.assertIsNone(o.review(self.run,self.rows[ident],self.qa_path,self.records[ident]))
            proof=o.review(self.run,self.rows[ident],self.qa_path,self.records[ident],self.approved(ident));self.assertEqual(proof['method'],o.VERSION);self.assertIsNone(proof['timing_approval'])
            with self.assertRaises(o.core.SafeError):o.review(self.run,self.rows[ident],self.qa_path,self.records[ident],o.template(self.run,self.rows[ident],self.qa_path,self.records[ident]))
    def test_stale_audio_or_tampered_raw_cache_refused(self):
        ident=list(self.rows)[0];a=self.approved(ident);audio=self.run/'clips'/(ident+'.mp3');old=audio.read_bytes();audio.write_bytes(b'stale')
        with self.assertRaises(o.core.SafeError):o.review(self.run,self.rows[ident],self.qa_path,self.records[ident],a)
        audio.write_bytes(old);record=copy.deepcopy(self.records[ident]['Flash']);record['transcript']+=' extras'
        with self.assertRaises(o.core.SafeError):o.template(self.run,self.rows[ident],self.qa_path,{'Flash':record})
    def test_full_character_stream_and_only_scoped_pair_no_word_drops_or_aliases(self):
        for ident,line in self.rows.items():
            record=next(iter(self.records[ident].values()));transcript=record['transcript']
            for bad in [transcript+' Wort',transcript.replace('ich','du',1) if 'ich' in transcript else transcript.replace('pah','',1),transcript.replace('zuhause','zu hau se') if 'zuhause' in transcript else transcript.replace('glattgezogen','glat gezogen') if 'glattgezogen' in transcript else transcript.replace('dabei hatten','da bei hatten')]:
                with self.assertRaises(o.core.SafeError):o.segmentation(line,bad)
        wrong={**self.rows[list(self.rows)[0]],'id':'story-'+'f'*24}
        with self.assertRaises(o.core.SafeError):o.segmentation(wrong,'zuhause')
if __name__=='__main__':unittest.main()
