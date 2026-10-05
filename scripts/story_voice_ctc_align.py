#!/usr/bin/env python3
"""Independent local German wav2vec2 CTC alignment proposals, never approvals.

Expanded-blank Viterbi uses acoustic emissions, correct repeated-character
transitions, and real model frame geometry. Authored display words are retained.
No automatic downloads, ASR replacement, public export, or Whisper inference.
Primary references are retained in every private report.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import re
import unicodedata
import prolog_voice_word_cues as acoustic
import story_voice_qa as qa
import story_voice_common as common

MODEL_ID = 'jonatasgrosman/wav2vec2-large-xlsr-53-german'
ENGINE = 'story-german-ctc-expanded-blank-v2'
REFERENCES = [
    'https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-german',
    'https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-german/blob/main/vocab.json',
    'https://docs.pytorch.org/audio/stable/tutorials/ctc_forced_alignment_api_tutorial.html',
]


def authored_tokens(text, vocab, delimiter='|'):
    """Unicode spelling/case only; never expand numbers or change name sounds."""
    displayed = acoustic.normalized_text(text).split()
    chars, owners = [], []
    for index, word in enumerate(displayed):
        normalized = unicodedata.normalize('NFC', word).casefold().replace('’', "'").replace('‘', "'")
        kept = []
        for position, char in enumerate(normalized):
            if char.isalnum():
                kept.append(char)
            elif char in "'-" and position and position+1 < len(normalized) and normalized[position-1].isalnum() and normalized[position+1].isalnum():
                kept.append(char)
        if not kept:
            continue  # Authored nonspoken visual punctuation uses previous end.
        unknown = [char for char in kept if char not in vocab]
        if unknown:
            raise ValueError('Unknown CTC alphabet in authored word '+repr(word)+': '+repr(unknown))
        if chars:
            chars.append(delimiter); owners.append(None)
        chars.extend(kept); owners.extend([index]*len(kept))
    if not chars or delimiter not in vocab:
        raise ValueError('No alignable authored text or absent word delimiter')
    return {'display_words': displayed, 'characters': chars, 'word_owners': owners,
            'token_ids': [vocab[char] for char in chars]}


def ctc_viterbi(log_probs, tokens, blank):
    """Full CTC trellis, then backtrack token-state frames (blanks excluded).

    Self loops represent a held label. Skip transitions cannot cross identical
    adjacent labels, so repeated letters require an intervening blank frame.
    """
    import numpy as np
    emission = np.asarray(log_probs, dtype=np.float64)
    if emission.ndim != 2 or not len(emission) or not np.isfinite(emission).all():
        raise ValueError('Nonfinite or invalid CTC emissions')
    if not tokens or blank in tokens or min(tokens) < 0 or max([blank, *tokens]) >= emission.shape[1]:
        raise ValueError('Invalid authored CTC labels')
    minimum_frames = len(tokens)+sum(a == b for a,b in zip(tokens, tokens[1:]))
    if len(emission) < minimum_frames:
        raise ValueError('Too few acoustic frames for repeated authored labels')
    labels = np.full(len(tokens)*2+1, blank, dtype=np.int64)
    labels[1::2] = tokens
    states = len(labels)
    previous = np.full(states, -np.inf)
    previous[0] = emission[0, blank]
    previous[1] = emission[0, tokens[0]]
    back = np.zeros((len(emission), states), dtype=np.uint8)
    skip_allowed = np.zeros(states, dtype=bool)
    skip_allowed[2:] = (labels[2:] != blank) & (labels[2:] != labels[:-2])
    for frame in range(1, len(emission)):
        candidates = np.full((3, states), -np.inf)
        candidates[0] = previous
        candidates[1, 1:] = previous[:-1]
        candidates[2, 2:] = np.where(skip_allowed[2:], previous[:-2], -np.inf)
        step = np.argmax(candidates, axis=0)
        previous = candidates[step, np.arange(states)] + emission[frame, labels]
        back[frame] = step
    state = states-1 if previous[-1] >= previous[-2] else states-2
    score = float(previous[state])
    if not math.isfinite(score):
        raise ValueError('Complete authored CTC path unreachable')
    character_frames = [[] for _ in tokens]
    for frame in range(len(emission)-1, -1, -1):
        if state % 2:
            character_frames[(state-1)//2].append(frame)
        if frame:
            state -= int(back[frame, state])
    if state not in (0, 1) or any(not frames for frames in character_frames):
        raise ValueError('CTC backtracking lost authored labels')
    return [list(reversed(frames)) for frames in character_frames], score


def frame_geometry(config):
    jump, receptive = 1, 1
    for kernel, stride in zip(config['conv_kernel'], config['conv_stride']):
        receptive += (kernel-1)*jump
        jump *= stride
    return jump, receptive


def align_emissions(log_probs, mapping, blank, samples, config):
    import numpy as np
    stride, receptive = frame_geometry(config)
    expected_frames = (samples-receptive)//stride+1
    if len(log_probs) != expected_frames:
        raise ValueError('Model emissions do not match exact feature frame geometry')
    frames, score = ctc_viterbi(log_probs, mapping['token_ids'], blank)
    seconds = samples/16000
    characters = []
    for index, (token, assigned) in enumerate(zip(mapping['token_ids'], frames)):
        probabilities = [float(log_probs[frame, token]) for frame in assigned]
        start = max(0.0, (assigned[0]*stride+(receptive-1)/2-stride/2)/16000)
        end = min(seconds, (assigned[-1]*stride+(receptive-1)/2+stride/2)/16000)
        characters.append({'character': mapping['characters'][index], 'word_index': mapping['word_owners'][index],
                           'start': round(start, 4), 'end': round(end, 4),
                           'frame_start': assigned[0], 'frame_end': assigned[-1]+1,
                           'confidence': math.exp(sum(probabilities)/len(probabilities)),
                           'minimum_frame_probability': math.exp(min(probabilities))})
    words, flags, previous = [], [], 0.0
    for index, word in enumerate(mapping['display_words']):
        selected = [char for char in characters if char['word_index'] == index]
        if selected:
            start, end = selected[0]['start'], selected[-1]['end']
            confidence = math.exp(sum(math.log(max(char['confidence'], 1e-300)) for char in selected)/len(selected))
            minimum = min(char['confidence'] for char in selected)
            if minimum < .05 or confidence < .2:
                flags.append({'word_index': index, 'word': word, 'reason': 'low_independent_CTC_character_confidence'})
            if end-start < .02:
                flags.append({'word_index': index, 'word': word, 'reason': 'collapsed_independent_CTC_word'})
        else:
            start = end = previous
            confidence = minimum = None
        if not previous <= start <= end <= seconds:
            raise ValueError('Authored CTC words overlap or leave decoded audio bounds')
        words.append({'word': word, 'start': start, 'end': end, 'confidence': confidence,
                      'minimum_character_confidence': minimum})
        previous = end
    return {'words': words, 'character_alignment': characters, 'qualification_flags': flags,
            'decoded_seconds': seconds, 'frame_stride_samples': stride, 'frame_receptive_samples': receptive,
            'ctc_path_log_probability': score, 'mean_path_log_probability': score/len(log_probs)}


def clean_qa(line, current_hash, manifest_hash, report):
    take = next((take for take in report.get('takes', []) if take.get('id') == line['id']), {})
    return (report.get('manifest_sha256') == manifest_hash
            and report.get('clip_sha256', {}).get(line['id']) == current_hash
            and line['id'] in report.get('checked_ids', [])
            and take.get('text_sha256') == qa.text_hash(line['text']) and take.get('reasons') == []
            and not any(item.get('id') == line['id'] for item in report.get('failures', []))
            and (qa.words(take.get('transcript', '')) == qa.words(line['text']) or bool(take.get('adjudication'))))


def diagnostic_qa(line, current_hash, manifest_hash, report):
    """Allow only current per-clip lexical QA mismatch, never signal failures."""
    take = next((take for take in report.get('takes', []) if take.get('id') == line['id']), {})
    allowed = {'asr_lexical_mismatch_requires_review'}
    reasons = take.get('reasons')
    return (report.get('manifest_sha256') == manifest_hash
            and report.get('clip_sha256', {}).get(line['id']) == current_hash
            and line['id'] in report.get('checked_ids', [])
            and take.get('text_sha256') == qa.text_hash(line['text'])
            and isinstance(reasons, list) and set(reasons) <= allowed
            and all(item.get('reason') in allowed for item in report.get('failures', []) if item.get('id') == line['id']))


def greedy_decode(log_probs, vocab, blank):
    """Unprompted CTC collapse of acoustic argmax, before authored alignment."""
    import numpy as np
    ids = np.argmax(log_probs, axis=-1).tolist()
    collapsed = []
    previous = None
    for token in ids:
        if token != previous and token != blank:
            collapsed.append(token)
        previous = token
    inverse = {index: char for char,index in vocab.items()}
    labels = [inverse.get(token, '<unknown_id>') for token in collapsed]
    unknown = [label for label in labels if len(label) != 1]
    probabilities = [float(math.exp(log_probs[frame, token])) for frame,token in enumerate(ids)]
    raw_evidence = {'argmax_token_ids': ids, 'argmax_token_probabilities': probabilities}
    return {'transcript': ''.join(labels).replace('|', ' ').strip(),
            **raw_evidence,
            'argmax_token_ids_sha256': qa.text_hash(json.dumps(ids, separators=(',', ':'))),
            'frame_evidence_sha256': qa.text_hash(json.dumps(raw_evidence, sort_keys=True, separators=(',', ':'))),
            'token_id_to_label': {str(index):char for char,index in vocab.items()},
            'blank_token_id': blank,
            'evidence_hash_format': 'UTF-8 JSON separators=(comma,colon); IDs array SHA and sorted-key IDs/probabilities object SHA',
            'collapsed_token_ids': collapsed, 'unknown_tokens': unknown,
            'method': 'unprompted_acoustic_argmax_CTC_blank_repeat_collapse',
            'authored_initial_prompt': None}


def model_identity(directory, revision):
    if not directory.is_absolute() or not directory.is_dir() or not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('Provide an absolute local model directory and full pinned40hex revision')
    required = ['config.json', 'vocab.json', 'preprocessor_config.json']
    files = {name: directory/name for name in required}
    weights = list(directory.glob('*.safetensors')) or list(directory.glob('pytorch_model*.bin'))
    for name in ['tokenizer_config.json','special_tokens_map.json']:
        if (directory/name).is_file():
            files[name] = directory/name
    if not weights or any(not path.is_file() for path in files.values()):
        raise ValueError('Local German CTC snapshot needs config, vocab, processor and pinned weights')
    files.update({path.name: path for path in weights})
    hashes = {name: qa.digest(path) for name, path in sorted(files.items())}
    return {'model_id': MODEL_ID, 'revision': revision, 'local_directory':str(directory.resolve()), 'file_sha256': hashes,
            'fingerprint': qa.text_hash(json.dumps(hashes, sort_keys=True))}


class LocalGermanCTC:
    def __init__(self, directory, device):
        import torch
        from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC, Wav2Vec2CTCTokenizer, Wav2Vec2FeatureExtractor
        self.torch = torch
        tokenizer = Wav2Vec2CTCTokenizer(str(directory/'vocab.json'), unk_token='<unk>',
                                        pad_token='<pad>', word_delimiter_token='|', do_lower_case=True)
        extractor = Wav2Vec2FeatureExtractor.from_pretrained(str(directory), local_files_only=True)
        self.processor = Wav2Vec2Processor(extractor, tokenizer)
        safetensors = bool(list(directory.glob('*.safetensors')))
        if not safetensors and tuple(int(n) for n in torch.__version__.split('+')[0].split('.')[:2]) < (2,6):
            raise ValueError('Pinned PyTorch .bin needs torch>=2.6 weights_only security gate')
        self.model = Wav2Vec2ForCTC.from_pretrained(str(directory), local_files_only=True,
                                                 use_safetensors=safetensors, weights_only=True).eval()
        self.device = 'mps' if device == 'auto' and torch.backends.mps.is_available() else 'cpu' if device == 'auto' else device
        if self.device == 'mps' and not torch.backends.mps.is_available():
            raise ValueError('Requested MPS is unavailable')
        self.model.to(self.device)
        self.vocab = self.processor.tokenizer.get_vocab()
        self.blank = self.model.config.pad_token_id
        self.config = self.model.config.to_dict()

    def emissions(self, audio):
        torch = self.torch
        inputs = self.processor(audio, sampling_rate=16000, return_tensors='pt')
        def infer():
            with torch.inference_mode():
                logits = self.model(**{key: value.to(self.device) for key,value in inputs.items()}).logits[0]
                return torch.log_softmax(logits.float(), dim=-1).cpu().numpy()
        try:
            return infer()
        except RuntimeError as error:
            if self.device != 'mps' or not any(word in str(error).lower() for word in ['mps', 'not implemented']):
                raise
            self.model.to('cpu'); self.device = 'cpu'; torch.mps.empty_cache()
            return infer()


def proposals(run, qa_path, model_dir, revision, target, selected=None, device='auto', diagnostic=False):
    import numpy as np
    identity = model_identity(model_dir, revision)
    manifest_path = run/'lines.private.json'
    manifest_hash, qa_hash = qa.digest(manifest_path), qa.digest(qa_path)
    manifest = json.loads(manifest_path.read_text()); report = json.loads(qa_path.read_text())
    if report.get('manifest_sha256') != manifest_hash:
        raise ValueError('QA is not bound to frozen source manifest')
    lines = manifest['lines']; known = {line['id'] for line in lines}
    if selected and not selected <= known:
        raise ValueError('Unknown selected story IDs')
    model = None; results = []
    for line in lines:
        ident = line['id']
        if selected and ident not in selected:
            continue
        if not common.ID.fullmatch(ident):
            raise ValueError('Invalid frozen story ID')
        path = run/'clips'/(ident+'.mp3')
        if not path.is_file():
            results.append({'id':ident,'status':'missing_current_audio','approval':None})
            continue
        audio_hash = qa.digest(path)
        if not (diagnostic_qa(line, audio_hash, manifest_hash, report) if diagnostic else clean_qa(line, audio_hash, manifest_hash, report)):
            results.append({'id': ident, 'status': 'ineligible_QA', 'approval': None})
            continue
        binding = {'engine': ENGINE, 'audio_sha256': audio_hash, 'text_sha256': qa.text_hash(line['text']),
                   'source_manifest_sha256': manifest_hash, 'qa_report_sha256': qa_hash,
                   'model': identity, 'diagnostic': diagnostic, 'script_sha256':qa.digest(Path(__file__))}
        receipt_path = target/(ident+'.ctc.private.json')
        receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else None
        if receipt is None or receipt.get('binding') != binding:
            vocab = json.loads((model_dir/'vocab.json').read_text())
            mapping = None; mapping_error = None
            try:
                mapping = authored_tokens(line['text'], vocab)
            except ValueError as error:
                mapping_error = str(error)
                if not diagnostic:
                    results.append({'id': ident, 'status': 'unknown_authored_alphabet', 'reason': str(error), 'approval': None})
                    continue
            if model is None:
                model = LocalGermanCTC(model_dir, device)
            if model.vocab != vocab:
                raise ValueError('Runtime tokenizer differs from bound vocab')
            audio = acoustic.decode(path)
            emission = model.emissions(audio)
            greedy = greedy_decode(emission, vocab, model.blank)
            aligned = align_emissions(emission, mapping, model.blank, len(audio), model.config) if mapping else None
            if aligned:
                frames = audio[:len(audio)//160*160].reshape(-1,160)
                rms = np.sqrt(np.mean(frames.astype(np.float64)**2,axis=1))
                threshold = max(.001,min(.003,float(np.percentile(rms,5))*3))
                for index, word in enumerate(aligned['words']):
                    if word['confidence'] is None:
                        continue
                    activity = rms[int(word['start']*100):int(math.ceil(word['end']*100))] >= threshold
                    word['waveform_active_fraction'] = float(np.mean(activity)) if len(activity) else 0.0
                    if word['waveform_active_fraction'] < .1:
                        aligned['qualification_flags'].append({'word_index':index,'word':word['word'],'reason':'CTC_word_without_waveform_support'})
            receipt = {'id': ident, 'binding': binding, 'text': line['text'], 'device': model.device,
                       'status': 'diagnostic_root_review_required' if diagnostic else 'root_review_required',
                       'approval': None, 'alignment': aligned, 'alignment_rejection': mapping_error,
                       'greedy_decode': greedy,
                       'greedy_complete_lexical_match': not greedy['unknown_tokens'] and qa.words(greedy['transcript']) == qa.words(line['text']),
                       'normalized_characters': ''.join(mapping['characters']) if mapping else None,
                       'word_owners': mapping['word_owners'] if mapping else None,
                       'references': REFERENCES, 'note': 'Independent German CTC acoustic timing proposal. Forced transcript is not ASR word-faithfulness proof. Greedy decode uses only acoustic emissions, no authored prompt. No automatic approval or export.'}
            qa.save(receipt_path, receipt)
        if qa.digest(path) != audio_hash:
            raise ValueError('Audio changed during independent CTC inference')
        comparison = {}
        dtw_path = run/'word-cues'/(ident+'.json')
        if dtw_path.exists() and receipt['alignment'] is not None:
            dtw = json.loads(dtw_path.read_text())
            if dtw.get('audio_sha256') == audio_hash and len(dtw['word_cues']) == len(receipt['alignment']['words']):
                deltas = [{'word_index':i,'word':word['word'],
                           'start_delta_seconds':round(word['start']-old['start'],4),
                           'end_delta_seconds':round(word['end']-old['end'],4)}
                          for i,(word,old) in enumerate(zip(receipt['alignment']['words'],dtw['word_cues']))]
                comparison = {'DTW_receipt_sha256':qa.digest(dtw_path),'word_deltas':deltas}
        results.append({'id':ident,'status':receipt['status'],'approval':None,
                        'receipt_file':receipt_path.name, 'receipt_sha256':qa.digest(receipt_path),'qualification_flags':receipt['alignment']['qualification_flags'] if receipt['alignment'] else [{'reason':receipt['alignment_rejection']}],
                        'greedy_complete_lexical_match':receipt['greedy_complete_lexical_match'],
                        'greedy_transcript':receipt['greedy_decode']['transcript'],
                        'comparison_to_Whisper_DTW':comparison})
        print(ident, 'greedy_exact', receipt['greedy_complete_lexical_match'], receipt['status'],flush=True)
    if qa.digest(manifest_path) != manifest_hash or qa.digest(qa_path) != qa_hash:
        raise ValueError('Source/QA changed during independent alignment')
    qa.save(target/'ctc-proposals.private.json', {'engine':ENGINE,'model':identity,'requires_root_review':True,'receipt_directory':str(target.resolve()),
            'approval':None,'results':results,'references':REFERENCES})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',type=Path,required=True)
    parser.add_argument('--qa-report',type=Path,required=True)
    parser.add_argument('--model-dir',type=Path,required=True)
    parser.add_argument('--model-revision',required=True)
    parser.add_argument('--diagnostic',action='store_true',help='Permit current lexical-only QA mismatch for unprompted greedy diagnosis; signal/stale failures still reject')
    parser.add_argument('--only-ids',help='Comma separated frozen story IDs')
    parser.add_argument('--private-dir',type=Path)
    parser.add_argument('--device',choices=['auto','mps','cpu'],default='auto')
    args = parser.parse_args()
    run = args.run_dir.resolve(); target=args.private_dir.resolve() if args.private_dir else run/'ctc-align'
    if not run.is_relative_to(common.PRIVATE.resolve()) or not target.is_relative_to(common.PRIVATE.resolve()):
        parser.error('Run and proposals must stay in private story bank')
    proposals(run,args.qa_report,args.model_dir,args.model_revision,target,
              set(args.only_ids.split(',')) if args.only_ids else None,args.device,args.diagnostic)


if __name__ == '__main__':
    main()
