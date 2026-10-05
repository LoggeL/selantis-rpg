#!/usr/bin/env python3
"""OFFLINE DIAGNOSTICS ONLY: VoxPopuli third timing proposals, never approvals/export.

No downloads, network requests or installs. Explicit selected IDs must already
have current clean word/signal QA. Forced authored alignment does not prove words.
The original SHA-bound CTC driver is imported unchanged, with no global overrides.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import re
import unicodedata
import story_voice_ctc_align as parent
import story_voice_common as common
import story_voice_qa as qa

MODEL_ID='facebook/wav2vec2-base-10k-voxpopuli-ft-de'
REVISION='1cbaf198475e1af97cc479ca081ce4ddd2d6b5cf'
ENGINE='story-voxpopuli-hf-secondary-timing-v1'
NOTE='Diagnostics only. No approval/export. Forced authored timing does not prove spoken-word fidelity. Separate clean QA is required.'


def model_identity(directory,revision):
    if revision!=REVISION:raise ValueError('Secondary checkpoint requires the exact reviewed revision')
    identity=parent.model_identity(directory,revision)
    identity=dict(identity,model_id=MODEL_ID)
    identity['driver_script_sha256']=qa.digest(Path(__file__))
    identity['parent_ctc_script_sha256']=qa.digest(Path(parent.__file__))
    return identity


def project_authored(text,vocab):
    """Only lossless single-character Unicode lower-case projections to vocab."""
    displayed=unicodedata.normalize('NFC',text).split()
    chars=[];owners=[];projections=[]
    for index,word in enumerate(displayed):
        kept=[]
        for position,char in enumerate(word):
            if not char.isalnum() and not (char in "'-’‘" and position and position+1<len(word) and word[position-1].isalnum() and word[position+1].isalnum()):continue
            target=char
            if char not in vocab:
                lower=char.lower()
                if len(lower)!=1 or lower not in vocab:raise ValueError('Unknown authored alphabet; no semantic name/number mapping')
                target=lower
            if target!=char:projections.append({'word_index':index,'character_index':position,'source':char,'projected':target,'operation':'Unicode_single_character_lowercase'})
            kept.append(target)
        if not kept:continue
        if chars:chars.append('|');owners.append(None)
        chars.extend(kept);owners.extend([index]*len(kept))
    if not chars or '|' not in vocab:raise ValueError('Missing alignable text or delimiter')
    return {'display_words':displayed,'characters':chars,'word_owners':owners,
            'token_ids':[vocab[c] for c in chars],'case_projection':projections}


def validate_runtime(vocab,tokenizer_vocab,tokenizer_blank,config_blank,width,normalize,sampling_rate):
    if vocab!=tokenizer_vocab:raise ValueError('Runtime tokenizer differs from original bound vocabulary')
    if (type(tokenizer_blank) is not int or vocab.get('<pad>')!=tokenizer_blank
        or sorted(vocab.values())!=list(range(len(vocab))) or width!=len(vocab)):
        raise ValueError('Blank/vocabulary/output width mismatch')
    if not normalize or sampling_rate!=16000:raise ValueError('HF processor must preserve reviewed 16kHz normalized semantics')
    return {'blank_token_id':tokenizer_blank,'blank_source':'actual_processor.tokenizer.pad_token_id',
            'model_config_pad_token_id':config_blank,'config_blank_disagreement':config_blank!=tokenizer_blank,
            'do_normalize':True,'sampling_rate':16000,'original_vocab_size':len(vocab),'output_width':width}


class LocalSecondaryCTC(parent.LocalGermanCTC):
    def __init__(self,directory,device):
        import torch
        from transformers import Wav2Vec2Processor,Wav2Vec2ForCTC
        self.torch=torch
        self.processor=Wav2Vec2Processor.from_pretrained(str(directory),local_files_only=True)
        safetensors=bool(list(directory.glob('*.safetensors')))
        if not safetensors and tuple(int(n) for n in torch.__version__.split('+')[0].split('.')[:2])<(2,6):
            raise ValueError('Local .bin requires torch>=2.6 weights_only loading')
        self.model=Wav2Vec2ForCTC.from_pretrained(str(directory),local_files_only=True,
                        use_safetensors=safetensors,weights_only=True).eval()
        original=json.loads((directory/'vocab.json').read_text())
        self.vocab=self.processor.tokenizer.get_vocab()
        self.blank=self.processor.tokenizer.pad_token_id  # reviewed HF config incorrectly says 1; tokenizer/vocab say 0.
        extractor=self.processor.feature_extractor
        self.runtime=validate_runtime(original,self.vocab,self.blank,self.model.config.pad_token_id,
                                      self.model.lm_head.out_features,extractor.do_normalize,extractor.sampling_rate)
        self.config=self.model.config.to_dict()
        self.device='mps' if device=='auto' and torch.backends.mps.is_available() else 'cpu' if device=='auto' else device
        if self.device=='mps' and not torch.backends.mps.is_available():raise ValueError('MPS unavailable')
        self.model.to(self.device)

    def emissions(self,audio):
        output=super().emissions(audio)  # unchanged reviewed MPS->CPU fallback; no worker processes.
        if output.shape[1]!=self.runtime['output_width']:raise ValueError('Actual emitted output width changed')
        return output


def waveform_support(audio,alignment):
    import numpy as np
    frames=audio[:len(audio)//160*160].reshape(-1,160)
    if not len(frames):raise ValueError('No waveform frames')
    rms=np.sqrt(np.mean(frames.astype(np.float64)**2,axis=1))
    threshold=max(.001,min(.003,float(np.percentile(rms,5))*3))
    for i,word in enumerate(alignment['words']):
        if word['confidence'] is None:continue
        activity=rms[int(word['start']*100):int(math.ceil(word['end']*100))]>=threshold
        word['waveform_active_fraction']=float(np.mean(activity)) if len(activity) else 0.0
        if word['waveform_active_fraction']<.1:
            alignment['qualification_flags'].append({'word_index':i,'word':word['word'],'reason':'CTC_word_without_waveform_support'})


def proposals(run,qa_path,directory,target,selected,device='cpu',model_factory=LocalSecondaryCTC):
    if not selected:raise ValueError('Explicit nonempty IDs are required')
    identity=model_identity(directory,REVISION)
    manifest_path=run/'lines.private.json';manifest_hash=qa.digest(manifest_path);qa_hash=qa.digest(qa_path)
    manifest=json.loads(manifest_path.read_text());report=json.loads(qa_path.read_text())
    lines={line['id']:line for line in manifest['lines']}
    if not selected<=set(lines) or any(not common.ID.fullmatch(i) for i in selected):raise ValueError('Unknown selected story IDs')
    # Preflight all selected inputs before any model initialization/inference.
    hashes={}
    for ident in selected:
        clip=run/'clips'/(ident+'.mp3');hashes[ident]=qa.digest(clip)
        if not parent.clean_qa(lines[ident],hashes[ident],manifest_hash,report):raise ValueError('Every selected clip requires current clean QA')
    vocab=json.loads((directory/'vocab.json').read_text());target.mkdir(parents=True,exist_ok=True)
    results=[];model=None
    for ident in sorted(selected):
        line=lines[ident];clip=run/'clips'/(ident+'.mp3')
        binding={'engine':ENGINE,'model':identity,'audio_sha256':hashes[ident],
                 'text_sha256':qa.text_hash(line['text']),'source_manifest_sha256':manifest_hash,
                 'qa_report_sha256':qa_hash,'script_sha256':identity['driver_script_sha256'],
                 'parent_ctc_script_sha256':identity['parent_ctc_script_sha256'],'diagnostic_only':True}
        path=target/(ident+'.secondary-ctc.private.json')
        old=json.loads(path.read_text()) if path.exists() else None
        if old and old.get('binding')==binding:receipt=old
        else:
            try:mapping=project_authored(line['text'],vocab)
            except ValueError:
                results.append({'id':ident,'status':'unknown_authored_alphabet','approval':None});continue
            if model is None:model=model_factory(directory,device)
            if model.vocab!=vocab:raise ValueError('Runtime vocab changed')
            audio=parent.acoustic.decode(clip);emission=model.emissions(audio)
            if emission.shape[1]!=len(vocab):raise ValueError('Actual CTC emission width differs from original vocabulary')
            greedy=parent.greedy_decode(emission,vocab,model.blank)
            aligned=parent.align_emissions(emission,mapping,model.blank,len(audio),model.config)
            waveform_support(audio,aligned)
            receipt={'id':ident,'binding':binding,'text':line['text'],'status':'diagnostic_root_review_required',
                     'approval':None,'device':model.device,'runtime_semantics':model.runtime,
                     'case_projection':mapping['case_projection'],'alignment':aligned,
                     'greedy_decode':greedy,'greedy_complete_lexical_match':not greedy['unknown_tokens'] and qa.words(greedy['transcript'])==qa.words(line['text']),
                     'normalized_characters':''.join(mapping['characters']),'word_owners':mapping['word_owners'],'note':NOTE}
            qa.save(path,receipt)
        if qa.digest(clip)!=hashes[ident]:raise ValueError('Audio changed during secondary timing')
        results.append({'id':ident,'status':receipt['status'],'approval':None,'receipt_file':path.name,
                        'receipt_sha256':qa.digest(path),'qualification_flags':receipt['alignment']['qualification_flags'],
                        'greedy_transcript':receipt['greedy_decode']['transcript'],
                        'greedy_complete_lexical_match':receipt['greedy_complete_lexical_match']})
        print(ident,'diagnostic_only',flush=True)
    if qa.digest(manifest_path)!=manifest_hash or qa.digest(qa_path)!=qa_hash:raise ValueError('Manifest or QA changed')
    if model_identity(directory,REVISION)!=identity:raise ValueError('Model or driver provenance changed')
    qa.save(target/'secondary-ctc-proposals.private.json',{'engine':ENGINE,'model':identity,'diagnostic_only':True,
                'requires_root_review':True,'approval':None,'receipt_directory':str(target.resolve()),'results':results,'note':NOTE})


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir',type=Path,required=True);parser.add_argument('--qa-report',type=Path,required=True)
    parser.add_argument('--model-dir',type=Path,required=True);parser.add_argument('--model-revision',choices=[REVISION],default=REVISION)
    parser.add_argument('--only-ids',required=True);parser.add_argument('--private-dir',type=Path)
    parser.add_argument('--device',choices=['cpu','auto','mps'],default='cpu')
    args=parser.parse_args();run=args.run_dir.resolve();target=args.private_dir.resolve() if args.private_dir else run/'ctc-secondary'
    if not run.is_relative_to(common.PRIVATE.resolve()) or not target.is_relative_to(run) or any(target.is_relative_to(run/name) for name in ['ctc-align','clips','raw','word-cues']):
        parser.error('Run must be private and secondary output must be separate inside it')
    try:
        proposals(run,args.qa_report.resolve(),args.model_dir.resolve(),target,set(args.only_ids.split(',')),args.device)
        return 0
    except Exception as error:
        print('Secondary timing diagnostic failed: '+type(error).__name__);return 1


if __name__=='__main__':raise SystemExit(main())
