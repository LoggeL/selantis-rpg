#!/usr/bin/env python3
"""Qualify frozen story MP3s locally, without credentials or remote ASR calls.

Decode workers overlap bounded ffmpeg work; one MLX model runs serially to avoid
multiple GPU copies. Incremental ASR caching binds clip, text and method hashes.
This qualifies signal and authored words, not acting or stable voice identity.
"""
from __future__ import annotations
import argparse
from array import array
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import unicodedata
from story_voice_transcribe import MODEL as INDEPENDENT_MODEL, PROMPT as INDEPENDENT_PROMPT, cached_record

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / 'output/audio/story-voice'
MODEL = 'mlx-community/whisper-large-v3-turbo'
VERSION = 'story-local-qa-v1'
RATE = 24000
ID = re.compile(r'story-[0-9a-f]{24}\Z')


def text_hash(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def digest(path):
    with path.open('rb') as stream:
        value = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024*1024), b''):
            value.update(chunk)
    return value.hexdigest()


def words(text):
    # Punctuation and Unicode spelling normalization only. Never silently repair
    # contractions, names, inflection, number words or interjections.
    return re.findall(r'\w+', unicodedata.normalize('NFC', text).casefold())


def distance(expected, actual):
    row = list(range(len(actual) + 1))
    for i, aa in enumerate(expected, 1):
        previous, row = row, [i]
        for j, bb in enumerate(actual, 1):
            row.append(min(row[-1] + 1, previous[j] + 1, previous[j - 1] + (aa != bb)))
    return row[-1]


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    with temporary.open('w') as stream:
        os.chmod(temporary, 0o600)
        json.dump(data, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')
    temporary.replace(path)


def analyze_samples(samples):
    if not samples or any(not math.isfinite(x) for x in samples):
        raise ValueError('empty_or_nonfinite_audio')
    count = len(samples)
    peak = max(abs(x) for x in samples)
    rms = math.sqrt(math.fsum(x*x for x in samples)/count)
    frame = 480
    frame_rms = [math.sqrt(math.fsum(x*x for x in samples[i:i+frame])/len(samples[i:i+frame]))
                 for i in range(0, count, frame)]
    active = [i for i, value in enumerate(frame_rms) if value >= max(1e-4, rms*.025)]
    trailing = (count - min(count, (active[-1]+1)*frame))/RATE if active else count/RATE
    leading = active[0]*frame/RATE if active else count/RATE
    clipped = sum(abs(x) >= .999 for x in samples)/count
    # Encoded peaks can exceed 0dBFS without hard clipping; repeated saturated
    # samples, severe overshoot or a nonzero terminal frame require review.
    return {'seconds': count/RATE, 'decoded_samples': count, 'peak': peak,
            'rms': rms, 'clipped_fraction': clipped,
            'leading_silence_seconds': leading, 'trailing_silence_seconds': trailing,
            'last_frame_rms': frame_rms[-1], 'silent': peak < .001 or rms < .0001}


def decode(path):
    result = subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(path),'-f','f32le',
                             '-ar',str(RATE),'-ac','1','pipe:1'], capture_output=True, timeout=120)
    if result.returncode or not result.stdout or len(result.stdout)%4:
        raise ValueError('decode_failed')
    samples = array('f'); samples.frombytes(result.stdout)
    if sys.byteorder != 'little': samples.byteswap()
    return analyze_samples(samples)


def signal_failures(metrics, word_count):
    reasons = []
    minimum, maximum = max(.2, word_count/10), max(12, word_count/.8+8)
    if metrics['silent']: reasons.append('silent_audio')
    if not minimum <= metrics['seconds'] <= maximum: reasons.append('duration_outside_broad_bounds')
    if metrics['clipped_fraction'] > .001 or metrics['peak'] > 1.2: reasons.append('possible_clipping')
    if metrics['trailing_silence_seconds'] > 3: reasons.append('excessive_end_silence')
    if metrics['leading_silence_seconds'] > 3: reasons.append('excessive_start_silence')
    if metrics['trailing_silence_seconds'] < .02 and metrics['last_frame_rms'] > max(.002, metrics['rms']*.2):
        reasons.append('possible_abrupt_audio_end')
    return reasons


def adjudicate(line, clip_hash, transcript, records):
    """Only explicit source/audio/transcript-bound word substitutions may clear ASR.

    No missing/extra words are admitted by this mechanism. A listener must
    separately repair/re-record omissions. Every substitution requires its own
    expected/observed pair, rather than a global dictionary or blanket approval.
    """
    expected, actual = words(line['text']), words(transcript)
    record = records.get(line['id'], {})
    if (record.get('clip_sha256') != clip_hash or record.get('text_sha256') != text_hash(line['text'])
        or record.get('transcript_sha256') != text_hash(transcript)
        or record.get('status') != 'accepted_word_variants'
        or not isinstance(record.get('reviewed_by'), str) or not record['reviewed_by'].strip()
        or not isinstance(record.get('reason'), str) or not record['reason'].strip()
        or len(expected) != len(actual)):
        return None
    variants = record.get('accepted_word_variants')
    if not isinstance(variants, list) or not variants: return None
    pairs = set()
    for value in variants:
        if not isinstance(value,dict) or set(value) != {'expected','observed'}: return None
        aa, bb = words(value['expected']), words(value['observed'])
        if len(aa)!=1 or len(bb)!=1 or aa==bb: return None
        pairs.add((aa[0],bb[0]))
    required = {(aa,bb) for aa,bb in zip(expected,actual) if aa!=bb}
    if required != pairs: return None
    return {'resolution':'explicit_hash_bound_word_variants', 'record':record}


def independent_review(line, clip_hash, transcript, records):
    """Clear local ASR mismatch only with full unprompted independent words."""
    record = records.get(line['id'])
    if not cached_record(record, clip_hash, text_hash(line['text'])):
        return None
    if words(record['transcript']) != words(line['text']):
        return None
    return {'resolution':'independent_audio_full_text_match',
            'clip_sha256':clip_hash,'source_audio_sha256':record['source_audio_sha256'],
            'source_text_sha256':record['source_text_sha256'],
            'transcript':record['transcript'],'model':INDEPENDENT_MODEL,
            'record_sha256':text_hash(json.dumps(record,sort_keys=True,ensure_ascii=False)),
            'listening_verdict':None}


class LocalASR:
    def __init__(self, model_path=None):
        self.model_path = model_path
        self.loaded = False

    def __call__(self, path):
        if not self.loaded:
            import mlx.core as mx
            mx.set_memory_limit(12*1024**3); mx.set_cache_limit(2*1024**3)
            if self.model_path is None:
                # local_files_only never contacts a paid API or downloads a model.
                from huggingface_hub import snapshot_download
                self.model_path = snapshot_download(MODEL, local_files_only=True)
            elif not Path(self.model_path).is_dir() or not (Path(self.model_path)/'config.json').is_file():
                raise ValueError('missing_local_model')
            import mlx_whisper
            self.transcribe = mlx_whisper.transcribe
            self.loaded = True
        response = self.transcribe(str(path), path_or_hf_repo=self.model_path, language='de',
                                   condition_on_previous_text=False, temperature=0.0)
        # No authored text/initial prompt is provided: prevent transcript leakage.
        segments = response.get('segments', [])
        if not segments or any(s.get('no_speech_prob',1)>.6 or s.get('avg_logprob',-10)<-1
                               or s.get('compression_ratio',10)>2.4 for s in segments):
            raise ValueError('uncertain_asr_segments')
        transcript = response.get('text')
        if not isinstance(transcript,str): raise ValueError('invalid_asr_text')
        return transcript.strip()


def qualify(run, report_path=None, adjudications=None, workers=4, asr=None, decode_fn=decode, model_id=MODEL, independent_records=None):
    manifest_path = run/'lines.private.json'
    manifest = json.loads(manifest_path.read_text())
    lines = manifest.get('lines')
    if not isinstance(lines,list) or not lines: raise ValueError('missing_manifest_lines')
    ids = [r.get('id') for r in lines]
    if any(not isinstance(i,str) or not ID.fullmatch(i) for i in ids) or len(set(ids))!=len(ids):
        raise ValueError('invalid_or_duplicate_ids')
    if any(not isinstance(r.get('text'),str) or not words(r['text']) for r in lines):
        raise ValueError('invalid_source_text')
    report_path = report_path or run/'qa.private.json'
    records = adjudications or {}
    cache_path = run/'qa-asr-cache.private.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    report = {'status':'review_required','checked_ids':[],'clip_sha256':{},'failures':[],
              'version':VERSION,'model':model_id,'manifest_sha256':digest(manifest_path),
              'started_at':int(time.time()),'takes':[],
              'note':'Signal and authored-word qualification only; acting and voice identity need listening review.'}
    extra = sorted(p.name for p in (run/'clips').glob('*.mp3') if p.stem not in set(ids))
    if extra: report['failures'].append({'id':None,'reason':'unexpected_clip_files','files':extra})
    def inspect(line):
        path=run/'clips'/(line['id']+'.mp3')
        try:
            before=digest(path); metrics=decode_fn(path)
            if digest(path)!=before: raise ValueError('audio_changed_during_decode')
            return path,before,metrics,None
        except Exception as error:
            allowed={'decode_failed','empty_or_nonfinite_audio','audio_changed_during_decode'}
            reason=str(error) if isinstance(error,ValueError) and str(error) in allowed else 'signal_check_failed_'+type(error).__name__
            return path,None,None,reason
    asr = asr or LocalASR()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        # Executor.map limits concurrency to workers; MLX stays serial here.
        for line,(path,clip_hash,metrics,error) in zip(lines,pool.map(inspect,lines)):
            ident=line['id']; take={'id':ident,'text_sha256':text_hash(line['text']),'signal':metrics}
            reasons=[]
            if error: reasons.append(error)
            else:
                report['checked_ids'].append(ident); report['clip_sha256'][ident]=clip_hash
                reasons.extend(signal_failures(metrics,len(words(line['text']))))
                key=text_hash(VERSION+'\0'+model_id+'\0'+clip_hash+'\0'+line['text'])
                try:
                    cached=cache.get(key)
                    if isinstance(cached,dict) and cached.get('clip_sha256')==clip_hash and cached.get('text_sha256')==text_hash(line['text']) and isinstance(cached.get('transcript'),str):
                        transcript=cached['transcript']; take['asr_reused']=True
                    else:
                        transcript=asr(path); take['asr_reused']=False
                        if not isinstance(transcript,str): raise ValueError('invalid_asr_text')
                        if digest(path)!=clip_hash: raise ValueError('audio_changed_during_asr')
                        cache[key]={'clip_sha256':clip_hash,'text_sha256':text_hash(line['text']),'transcript':transcript}
                        save(cache_path,cache)
                    errors=distance(words(line['text']),words(transcript))
                    take.update(transcript=transcript,word_error_rate=errors/len(words(line['text'])))
                    if errors:
                        accepted=independent_review(line,clip_hash,transcript,independent_records or {})
                        if not accepted: accepted=adjudicate(line,clip_hash,transcript,records)
                        if accepted: take['adjudication']=accepted
                        else: reasons.append('asr_lexical_mismatch_requires_review')
                except Exception as error:
                    reasons.append('asr_check_failed_'+type(error).__name__)
            take['reasons']=reasons;report['takes'].append(take)
            report['failures'].extend({'id':ident,'reason':r} for r in reasons)
            save(report_path,report)
            print(f'{len(report["takes"])}/{len(lines)} {ident}: '+('review_required' if reasons else 'checked'),flush=True)
    # Reject an audio replacement between its check and final report completion.
    for ident,h in report['clip_sha256'].items():
        try: stable=digest(run/'clips'/(ident+'.mp3'))==h
        except OSError: stable=False
        if not stable: report['failures'].append({'id':ident,'reason':'audio_changed_before_finalization'})
    if digest(manifest_path) != report['manifest_sha256']:
        report['failures'].append({'id':None,'reason':'manifest_changed_during_qa'})
    if set(report['checked_ids'])==set(ids) and not report['failures']:report['status']='passed'
    report['finished_at']=int(time.time());save(report_path,report)
    return report


def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',type=Path,required=True)
    parser.add_argument('--report',type=Path)
    parser.add_argument('--adjudications',type=Path,help='Private JSON mapping IDs to explicit hash-bound accepted_word_variants records')
    parser.add_argument('--independent-report',type=Path,help='Private independent story MP3 transcription report; exact full words only')
    parser.add_argument('--model-dir',type=Path,help='Already cached local MLX model; never downloaded')
    parser.add_argument('--decode-workers',type=int,default=4)
    args=parser.parse_args()
    run=args.run_dir.expanduser().resolve()
    if run==PRIVATE.resolve() or not run.is_relative_to(PRIVATE.resolve()):parser.error('run must be below output/audio/story-voice/')
    if not 1<=args.decode_workers<=8:parser.error('decode workers must be 1..8')
    report=args.report.expanduser().resolve() if args.report else run/'qa.private.json'
    if not report.is_relative_to(run):parser.error('report must be inside the private run')
    try:
        records=json.loads(args.adjudications.read_text()) if args.adjudications else {}
        if not isinstance(records,dict):raise ValueError('invalid_adjudications')
        independent = json.loads(args.independent_report.read_text()) if args.independent_report else {}
        values = independent.get('records', [])
        if not isinstance(values,list) or any(not isinstance(v,dict) or not isinstance(v.get('id'),str) for v in values):
            raise ValueError('invalid_independent_records')
        independent_records = {v['id']:v for v in values}
        if len(independent_records) != len(values): raise ValueError('duplicate_independent_ids')
        result=qualify(run,report,records,args.decode_workers,LocalASR(str(args.model_dir.resolve()) if args.model_dir else None),model_id=MODEL+(':'+str(args.model_dir.resolve()) if args.model_dir else ''), independent_records=independent_records)
        print(json.dumps({'status':result['status'],'checked':len(result['checked_ids']),'failures':len(result['failures'])}))
        return 0 if result['status']=='passed' else 1
    except Exception as error:
        # Third-party exception text can contain sensitive data; never print it.
        save(report,{'status':'review_required','checked_ids':[],'clip_sha256':{},'failures':[{'id':None,'reason':'qa_failed_'+type(error).__name__}]})
        print('Story QA failed: '+type(error).__name__,file=sys.stderr);return 2


if __name__=='__main__':raise SystemExit(main())
