#!/usr/bin/env python3
"""Private independent Gemini audio transcription; never supplies expected text.

Explicit scoped IDs only, current WAV hash caching, no automatic remote retry.
"""
import argparse
import base64
import json
import os
import time
import prolog_voice_batch as batch

MODEL = 'gemini-3.8-flash'
PROMPT = 'Transcribe the spoken German words in this audio exactly. Preserve repetitions, colloquial contractions and grammatical errors. Do not correct, paraphrase, complete or translate. No expected transcript is supplied. Return JSON with a single transcript string.'


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', required=True)
    parser.add_argument('--only-ids', required=True)
    parser.add_argument('--key-stdin', action='store_true')
    parser.add_argument('--keychain-service')
    parser.add_argument('--keychain-account')
    args = parser.parse_args()
    try:
        run = batch.directory(args.run_dir)
        batch.prepared(run)
        available = {x['id'] for x in batch.read_json(run/'lines.private.json')['lines']}
        selected = list(dict.fromkeys(args.only_ids.split(',')))
        if not selected or not set(selected).issubset(available):
            raise batch.SafeError('Unknown or empty recording IDs.')
        for ident in selected:
            if not (run/'raw'/(ident+'.wav')).is_file():
                raise batch.SafeError('Missing selected WAV.')
        folder = run/'independent-google-asr'
        folder.mkdir(exist_ok=True)
        key = batch.credential(args)
        records = []
        for ident in selected:
            audio = (run/'raw'/(ident+'.wav')).read_bytes()
            sha = batch.digest(audio)
            target = folder/(ident+'.'+sha[:8]+'.json')
            record = batch.read_json(target) if target.exists() else None
            if record and (record.get('source_sha256') != sha or record.get('prompt') != PROMPT or record.get('model') != MODEL):
                raise batch.SafeError('Cached transcription belongs to another source or method.')
            if not record:
                request = {'contents': [{'role': 'user', 'parts': [{'text': PROMPT},
                    {'inlineData': {'mimeType': 'audio/wav', 'data': base64.b64encode(audio).decode()}}]}],
                    'generationConfig': {'temperature': 0, 'responseMimeType': 'application/json',
                        'responseSchema': {'type': 'OBJECT', 'properties': {'transcript': {'type': 'STRING'}}, 'required': ['transcript']}}}
                response = batch.api('POST', batch.BASE+'/v1beta/models/'+MODEL+':generateContent', key, request)
                text = ''.join(part.get('text', '') for part in response['candidates'][0]['content']['parts'])
                transcript = json.loads(text)['transcript']
                record = {'id': ident, 'source_sha256': sha, 'model': MODEL, 'prompt': PROMPT,
                          'transcript': transcript, 'response': response, 'listening_verdict': None}
                batch.save(target, record)
                time.sleep(1)
            records.append(record)
            print(json.dumps({'id': ident, 'status': 'transcribed', 'source_sha256': sha}), flush=True)
        key = ''
        batch.save(folder/'comparison.private.json', {'records': records,
            'note': 'Expected dialogue was not supplied. Independent ASR does not constitute human listening.'})
        return 0
    except (batch.SafeError, OSError, ValueError, KeyError, TypeError):
        print('Independent transcription failed; private results retained, no automatic retry.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
