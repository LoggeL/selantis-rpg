#!/usr/bin/env python3
"""Offline qualification of one historical full bank against one rewritten source.

The protected publisher's complete validator is copied below. Its only change is
the measured receipt-bound unspoken punctuation predicate. Historical directions
are read from their fixed production workspace; current sources are scanned by
the incremental publisher. Filtering never changes the full 1557 QA gate.
"""
from __future__ import annotations
import json
import math
from contextvars import ContextVar
from pathlib import Path
import subprocess
import sys
import unicodedata
import story_voice_publish as strict
import story_voice_rewrite_timing_publish as rewrite
import story_voice_word_cues as word_driver
from story_voice_publish import (read, digest, contained, require, sha, MODEL, ID,
    common, VARIANT_TARGET, NONARCHIVED_REVIEWS, QA_VERSION, QA_MODEL,
    ALIGNMENT_ENGINE, acoustic, validate_pff_derived, validate_vocal_variant)

VERSION = 'one-frozen-original-1557-receipt-bound-publication-v1'
ORIGINAL_ROOT = Path('/Users/logge/.codex/worktrees/voice-comparison/SelantisRPG')
ORIGINAL_RUN = ORIGINAL_ROOT/'output/audio/story-voice/2026-10-05-all-chapters'
FROZEN_SHA = '18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b'
CURRENT_SHA = 'cd15cc9189190fe5c5363047774ee4fe7abe5f82bc86d85baa26ecf6776fe899'
SOURCE_FIELDS = ('id','kind','speaker','text','display_text','direction_en','performance_variant')
POLICY_FIELDS = {'method','frozen_manifest_sha256','source_contract_sha256','source_text_sha256',
                 'audio_sha256','receipt_sha256','original_receipt_sha256','cues_sha256',
                 'profiles_sha256','prepared_sha256','alignment_engine','actual_alignment_model'}
PROTECTED = dict(rewrite.PROTECTED)
APPROVED_CLOSURE = 'approved_original_1557_current_source_closure'
QUALIFICATION_FIELDS = {'frozen_manifest_sha256','qa_report','qa_sha256','alignment_report',
                        'alignment_sha256','source_closure','source_closure_sha256'}
_QUALIFIED_TOKEN = object()
_VALIDATION_CACHE = ContextVar('original_bank_validation_cache',default=None)
SOURCE38 = 'story-38dfebeaa7673b7426ba093d'
SOURCE38_PROOF = 'publisher-source38-retained-pause-root74.private.json'
SOURCE38_PROOF_SHA = 'bfee5f92a32295f407d11f43a24c6e4489b218c5b57e990a423de0d4fedf9c64'
SOURCE38_QUALIFICATION_ARCHIVE = 'publisher-source38-retained-pause-root74-qualification-archive.private.json'


class _QualifiedOriginalBank:
    def __init__(self, clips, files, token):
        require(token is _QUALIFIED_TOKEN,'Complete original bank validation required')
        self.clips={clip['id']:clip for clip in clips};self.files=files;self.token=token
        self.provenance_cache={}


def qualification_descriptor(run,qa,alignment,closure,root):
    require(Path(run).resolve()==ORIGINAL_RUN,'Qualification requires fixed original run')
    return {'frozen_manifest_sha256':FROZEN_SHA,
            'qa_report':str(Path(qa).resolve().relative_to(ORIGINAL_RUN)),'qa_sha256':digest(qa),
            'alignment_report':str(Path(alignment).resolve().relative_to(ORIGINAL_RUN)),
            'alignment_sha256':digest(alignment),
            'source_closure':str(Path(closure).resolve().relative_to(Path(root).resolve())),
            'source_closure_sha256':digest(closure)}


def validate_retained_bank(manifest,root,profiles,current_rows):
    marker=manifest.get('original_bank_qualification')
    require(isinstance(marker,dict) and set(marker)==QUALIFICATION_FIELDS
            and marker.get('frozen_manifest_sha256')==FROZEN_SHA,
            'Retained original clips require the complete original bank qualification and Root closure')
    qa=contained(ORIGINAL_RUN,marker['qa_report']);alignment=contained(ORIGINAL_RUN,marker['alignment_report'])
    closure=contained(Path(root),marker['source_closure']);inventory=Path(root)/'docs/voice-production/story-lines.json'
    require(marker==qualification_descriptor(ORIGINAL_RUN,qa,alignment,closure,root),
            'Retained original full QA/Alignment/Rootclosure bindings changed')
    current=read(inventory)
    require({row['id']:row for row in current['lines']}==current_rows,
            'Retained original complete current Source inventory differs')
    validate_closure(closure,ORIGINAL_RUN,current,inventory,profiles,root)
    # A previously public marker is not a word or timing waiver. Repeat every
    # actual 1557 report/receipt guard before permitting any original retention.
    _,clips,paths=validate_run(ORIGINAL_RUN,qa,alignment,1557)
    files=evidence_files(ORIGINAL_RUN)+[qa,alignment,closure,inventory,
        ORIGINAL_RUN/'collection.private.json',ORIGINAL_RUN/'source-snapshot.private.json',
        ORIGINAL_RUN/'requests.jsonl',ORIGINAL_RUN/'full-inventory.private.json',*paths.values()]
    files.extend(contained(ORIGINAL_RUN,'raw/'+ident+'.receipt.json') for ident in paths)
    return _QualifiedOriginalBank(clips,list(dict.fromkeys(files)),_QUALIFIED_TOKEN)


def _pff_evidence(run):
    """Run the protected original guard in its actual source workspace.

    Pff's unchanged common.prepared guard reads six historical directions via
    its import location. A separate process preserves that contract without
    changing global ROOT values or replacing any protected hook.
    """
    require(Path(run).resolve()==ORIGINAL_RUN, 'Derived guard requires exact historical run')
    names=('story_voice_pff_edit.py','story_voice_common.py','prolog_voice_batch.py',
           'story_voice_qa.py','story_voice_retake_batch.py','story_voice_vocal_qc.py')
    for name in names:
        require(digest(ORIGINAL_ROOT/'scripts'/name)==digest(Path(__file__).with_name(name)),
                'Historical/current protected derived guard bytes differ')
    code="""import json,pathlib,story_voice_pff_edit as p
r=pathlib.Path('/Users/logge/.codex/worktrees/voice-comparison/SelantisRPG/output/audio/story-voice/2026-10-05-all-chapters')
manifest=json.loads((r/'lines.private.json').read_text())
line=next(row for row in manifest['lines'] if row['id']==p.ID)
receipt=json.loads((r/'raw'/(p.ID+'.receipt.json')).read_text())
print(json.dumps(p.validate_imported(r,line,receipt),sort_keys=True))
"""
    result=subprocess.run([sys.executable,'-c',code],cwd=ORIGINAL_ROOT/'scripts',capture_output=True,text=True,timeout=60)
    require(result.returncode==0, 'Original derived Pff actual full guard rejected')
    proof=json.loads(result.stdout)
    require(proof.get('id')=='story-95c49f2ee284e215ca7615fc'
            and proof.get('provenance_files_sha256'), 'Original derived Pff evidence incomplete')
    return proof


def validate_pff_derived(run,line,receipt):
    require(line['id']==receipt.get('id')=='story-95c49f2ee284e215ca7615fc', 'Unsupported derived source')
    return _pff_evidence(run)


# Exact historical receipt/Root-approval/archive pins. These are evidence hashes,
# not an engine-prefix permission. Changing an adopted receipt requires review.
HISTORICAL_PRIVATE_PINS = json.loads(r'''
{
  "story-0138d9d0cb820b7d58c01af0": {
    "approval_sha256": "4ea7f53d6d0fbf6cbc3be8a552d1c2445599f7f262a9a5c0c2d12499e567b19a",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-0138d9d0cb820b7d58c01af0.ctc.private.json": "e7feacfb069985881914d14c57606520ff19d3102ad2f9c03de2a549bedfce2b",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-0138d9d0cb820b7d58c01af0.before.private.json": "8dad871d81a13826355afb7545f8e74b1d1cca1ea6bd920ec96ea1d26bc7bc64"
    },
    "original_receipt": "timing-primary-root-pass27/story-0138d9d0cb820b7d58c01af0.before.private.json",
    "receipt_sha256": "b2d055a61984f1a1c073596fc9d7ad513cb89ec0276e0010886600208de02f8b"
  },
  "story-07ec2f63c4b40ae2ad9b5041": {
    "approval_sha256": "1ac153d353bf165be3051ce5c65c6617472930e44740dfbfcf59251cb559f302",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-source07-native-late-clause-caption-pass54-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-07ec2f63c4b40ae2ad9b5041.json": "43b07295a6d0b47b3632e63e5bf71fa66443336829492861fd67ea6e90d6b1f6",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/source07-nachsatz54/apply-contract.private.json": "57cb66dc6051f98c485ce605b1634ebd0fd400c21e7c38024b4651fdba236c0a",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/source07-nachsatz54/guard.private.py": "182ddfe514085d5e350a0586b17c8b9b1399a9fd68e05a3d19abbf154d2555ff",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/source07-nachsatz54/proposals.private.json": "25eb1495c5f768b61437f1002927031a5b3612b4446c841e097839399d3cafbf",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/source07-nachsatz54/root-reviewed.private.json": "467555303c2d37c5a0133f1b668d238c3224d3ec8c88d9164e07d68b454bac41"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-07ec2f63c4b40ae2ad9b5041.json",
    "receipt_sha256": "43b07295a6d0b47b3632e63e5bf71fa66443336829492861fd67ea6e90d6b1f6"
  },
  "story-0cd7e70d17f81739d4591ed5": {
    "approval_sha256": "f91ce9c9683bd30f88550c08198878f309994dee9c58a524635cda2bf4b06be5",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1/private-root-four-residual-source-caption-estimates-pass53-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-0cd7e70d17f81739d4591ed5.full-large-dtw.private.json": "9e2125eeede6392fcdd94e19927afe2551c9b6b20ac46b529c1d5bfe067c99a5",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-0cd7e70d17f81739d4591ed5.json": "e1a86afba43b2f4c01c59d32a19f527e325d9dd54692e2530071398a045294f0",
      "timing-residual-source4-pass53/apply-contract.private.json": "c399e3e3dee12dc28d6ae413f72965a2da529b48ad4a2a00050aa124a463ade2",
      "timing-residual-source4-pass53/guard.private.py": "31423ebca7d06cb69ff964a923c3a90a236003edce30f213ccb32d444c1eedc5",
      "timing-residual-source4-pass53/proposals.private.json": "ac8e9cb01a513525ad6a784696f088523d424634bbcc302d00f750ea5e137b47",
      "timing-residual-source4-pass53/root-reviewed.private.json": "ca00ef5b4e9dbd4a81b3a119bbb0694c1aba0417c9c3cf4d2d895a5cecd7f402"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-0cd7e70d17f81739d4591ed5.json",
    "receipt_sha256": "e1a86afba43b2f4c01c59d32a19f527e325d9dd54692e2530071398a045294f0"
  },
  "story-12cb3fab60d344ba22c1b150": {
    "approval_sha256": "0257348657b75790a81101b0cdf56343334183bbd6c21caa4c83abaee530bfa5",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-four-unchanged-caption-scheduling-estimates-pass53-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-12cb3fab60d344ba22c1b150.json": "e9088e28193f6b296f00ec099be113e7d57a6d989c33c8983cb3ca24ab6f17d7",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/apply-contract.private.json": "d28f84f5d29273bbebb79f8755208ab44613ae39e99b66af5e74970fc012d543",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/guard.private.py": "baaf239962a9620895f41b25af20c34bde57a080e690d5e4000d1c1be9015767",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/proposals.private.json": "8c63f738c856dce917b99a8e3498830d7b1ac3e8b4c607c077c181965301a99c",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/root-reviewed.private.json": "a361cd9e440c2ee337e3b5617b10aa6df45b89f11ddaf43702043f2b936af5f3"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-12cb3fab60d344ba22c1b150.json",
    "receipt_sha256": "e9088e28193f6b296f00ec099be113e7d57a6d989c33c8983cb3ca24ab6f17d7"
  },
  "story-1a710909d0c3a2ef14c11ef2": {
    "approval_sha256": "19425e7276a15cc7bee5a803f85f23d973f9c1200647697b47cbf3ed791fad72",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/guarded-apply.private.py": "56446151e55331c499be2f7c6594ce66cd5580deef1723a486fc2b4f124184bb",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-1a710909d0c3a2ef14c11ef2.full-large-dtw.private.json": "ee729be24771e92b7ca1d072772d874a761fab1009189b322a84b97cfa18e273",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-1a710909d0c3a2ef14c11ef2.json": "200da87e3d7ca342754473dee8fdd6e6ee04f38ba478c31acb2290faaec548ab"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-1a710909d0c3a2ef14c11ef2.json",
    "receipt_sha256": "200da87e3d7ca342754473dee8fdd6e6ee04f38ba478c31acb2290faaec548ab"
  },
  "story-1b189429f124a1e1dd343c6c": {
    "approval_sha256": "8e6b28c22262bebaad2f1a5bcdd88427e7eccfb419a2ce74fc1210260cd17987",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-two-scoped-secondary-timing-pass46-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-1b189429f124a1e1dd343c6c.json": "73f20a4818257202476db874e0abc75af0f63fa498c4c6f5717758f95310dfc7",
      "timing-numeral-hyphen-pass44/root-review-proposals/proposals.private.json": "b5da73aff181510f077935d7b4383e6222668a59cdf5e6f9539606ca453db675",
      "timing-numeral-hyphen-pass44/story-1b189429f124a1e1dd343c6c.projection.ctc.private.json": "86a64d39383d9854f9651b2dce9eaf04f5776a1fa61bc354b73b2528c85988ab",
      "timing-numeral-hyphen-pass46-root-apply/apply_after_root_review.private.py": "fc51db42821aba6d326629514631be4a853de6dec7d2b7f374fdcdaf1ef2cca5",
      "timing-numeral-hyphen-pass46-root-apply/proposals.private.json": "b5da73aff181510f077935d7b4383e6222668a59cdf5e6f9539606ca453db675"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-1b189429f124a1e1dd343c6c.json",
    "receipt_sha256": "73f20a4818257202476db874e0abc75af0f63fa498c4c6f5717758f95310dfc7"
  },
  "story-1bbdfcb4271f5c8ede9c6429": {
    "approval_sha256": "0165fa46c931d28915df1dedd8f7c4e996d210b892f56181eebdbf4d0c5fe644",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-1bbdfcb4271f5c8ede9c6429.ctc.private.json": "a3960702b80be14b4ee5809fa90e5cf7f8901f99fbf14f11ff32f5f713448f24",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing11-pass34.private.json": "c05d049a8999204405caf590337a5897c84c5adab2b372925be76b25fb47cabd",
      "timing-root-scoped-pass35/story-1bbdfcb4271f5c8ede9c6429.before.private.json": "25f9dc9b5ca75b76790b1b446d2b6ecd95745791c3c561794f067ded69f43a46"
    },
    "original_receipt": "timing-root-scoped-pass35/story-1bbdfcb4271f5c8ede9c6429.before.private.json",
    "receipt_sha256": "f791892e8e799a0b4cbb6c12edbd8fae2f74ab2c086378188e23b187d739aae9"
  },
  "story-22a8c2ddf95d2317916f4400": {
    "approval_sha256": "493b4a9e79041d710fedfc544ea6b40e49f4614d6153cec11b2fec2a19df9ccb",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-pass12/story-22a8c2ddf95d2317916f4400.ctc.private.json": "29b1d335a6e4f102eff8172244653dfedf0ed1a1714e929f0c6bb21f7c73745b",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing11-pass34.private.json": "c05d049a8999204405caf590337a5897c84c5adab2b372925be76b25fb47cabd",
      "timing-root-scoped-pass35/story-22a8c2ddf95d2317916f4400.before.private.json": "97b7db207cce504f657f2b22ccae59eda99a3853ba88a833a38c7dabbadac8df"
    },
    "original_receipt": "timing-root-scoped-pass35/story-22a8c2ddf95d2317916f4400.before.private.json",
    "receipt_sha256": "bdfcca6af792aa080ad7f59e51ac8ee9c8928fbfc3269507ab6cb5bca5574ade"
  },
  "story-23c9c7c2c335411250f9b547": {
    "approval_sha256": "73dcbaf38d21dd4cff6e6a5f297aea0e03a3ca9f9c20b2560a1ba12d9783e753",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-23c9c7c2c335411250f9b547.ctc.private.json": "7799245cd381a655499f5a3d5f41a1d36f61905751e039d91a97275976dd55f1",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-23c9c7c2c335411250f9b547.before.private.json": "a73259c03face3fd97c444f4d11ca09c37984d3e73f9db20f1be20aac4f9fc38"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-23c9c7c2c335411250f9b547.before.private.json",
    "receipt_sha256": "1fd5ff3f9048f7336ed77d46c0ff4aeb7ec83429e6ca82c554cdec2b35d79959"
  },
  "story-24b501a405bfd38e30a761b6": {
    "approval_sha256": "42670b4aec452f6faaf47e1236e00009906ab291abd147adc0db4bdcd8a6f068",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-24b501a405bfd38e30a761b6.ctc.private.json": "6cd62a001ccfaa0aabf830693c884320060bcbc6dde2537cf00abcf3dbfa6a4a",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-24b501a405bfd38e30a761b6.before.private.json": "7a1b7d9ccfa131ffac5a19ef5632a84718cfde05549c0ec4ffafad4fea6bf87e"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-24b501a405bfd38e30a761b6.before.private.json",
    "receipt_sha256": "26568fba2486c334710eb27aa9eb7f7f03bd01e7ef2a278d9bdeb15f89ab4443"
  },
  "story-2f081ee0320d32f278e642b6": {
    "approval_sha256": "994558a0d99d0a3846913acae108378e4e2c8b726abbe6359eca0681d506f777",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-source2f-native-caption-transaction-pass54-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-2f081ee0320d32f278e642b6.json": "52e9e00e93ffb9e4db8faa9d271356e3e734d39d285f8ed6a93a81418c1698a6",
      "timing-source2f-final53/root-transaction54/apply-contract.private.json": "ead749085a635c8725ec037c1871cccde97f60367b7de8dd5daf2b7750935780",
      "timing-source2f-final53/root-transaction54/guard.private.py": "c8bf0468da3c92faaad65c74b72eda7728cae5d5340315b48a738142e94473fc",
      "timing-source2f-final53/root-transaction54/proposals.private.json": "3debd472ffd135ac517b9b9febdb4e062ad8d8538063f188537e87e2b4cd3852",
      "timing-source2f-final53/root-transaction54/root-reviewed.private.json": "fbeab73573bca71d7a7a890c05b96b8a68d1fc666d2bb638f978ff2dd6cf220a"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-2f081ee0320d32f278e642b6.json",
    "receipt_sha256": "52e9e00e93ffb9e4db8faa9d271356e3e734d39d285f8ed6a93a81418c1698a6"
  },
  "story-3681422843333d22575f746c": {
    "approval_sha256": "8b3c620fc1bd9bab5795bc0f19b58eff33a1f41ea66283cc8d0206127d4dd9d3",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-source368-broad-prefix-caption-pass51-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-3681422843333d22575f746c.json": "9a33e3596242272623069a356e60743f4b6044bca5bfc2fa08d0d3a4e7dc5350",
      "timing-remaining-wordclean49-offline/source368-prefix51/apply-contract.private.json": "35cbf200339e3ae72d192a23953b623d56962c32645d601fa30600eb3cfac7b4",
      "timing-remaining-wordclean49-offline/source368-prefix51/guard.private.py": "9dcdfbf8f53313405993d5c56245c38693af26e8148e7d25b703925a9c091fb7",
      "timing-remaining-wordclean49-offline/source368-prefix51/proposals.private.json": "d94c573c1843108ce204cca201257a8be5d3374ed9d3809ff5254e1d3e8cc30e",
      "timing-remaining-wordclean49-offline/source368-prefix51/root-reviewed.private.json": "bd440959bbddf23eb8fdfca5b5310d71a84fe18d36797e8d99934cb1516fb466"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-3681422843333d22575f746c.json",
    "receipt_sha256": "9a33e3596242272623069a356e60743f4b6044bca5bfc2fa08d0d3a4e7dc5350"
  },
  "story-36d28c8dd3cae91142321344": {
    "approval_sha256": "38daca596a59c490796d18e017beb8b852c6b36f1960f25a0a287ccbb99abd50",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-current36-four-native-PCM-caption-estimates-pass56-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-36d28c8dd3cae91142321344.json": "12ac337f147ec6848cdec24f2146537d7e80efa6d60a38deb20f5d84321eea61",
      "timing-new-imports56-offline/source36-after-combined/root-four-caption/apply-contract.private.json": "c421ff8048f52b143aed0b15c1beb781406553cde03f6676408eefeccbf19e18",
      "timing-new-imports56-offline/source36-after-combined/root-four-caption/apply.private.py": "499ee08325a41b170d91ad1e67e4dd7303d970f29295ea287bd1f9fe350471d7",
      "timing-new-imports56-offline/source36-after-combined/root-four-caption/proposals.private.json": "b4f02ed5e56ae517356a3d9fb84404cf63ae12df25413ee39ebbaaee100dc5ec",
      "timing-new-imports56-offline/source36-after-combined/root-four-caption/root-reviewed.private.json": "bb8dc589d60063147c5622fcbea8ad900d1f9c9c72b4159e667aa8e4d4879561"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-36d28c8dd3cae91142321344.json",
    "receipt_sha256": "12ac337f147ec6848cdec24f2146537d7e80efa6d60a38deb20f5d84321eea61"
  },
  "story-377f420421f1a13e6fe5c4b6": {
    "approval_sha256": "c26ebe31c9f643edd78d929d757f3638d52d3fad0091849742b0f0b88ee38ca6",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/guarded-apply.private.py": "56446151e55331c499be2f7c6594ce66cd5580deef1723a486fc2b4f124184bb",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-377f420421f1a13e6fe5c4b6.full-large-dtw.private.json": "718d597742bb9f2d2590f82346cedf0a0417c22e1da82efdce5b462bcc8dd01d",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-377f420421f1a13e6fe5c4b6.json": "6c2c3015f13c8736bea74b98e5da643079a80e180eb958fc0406b672fc510ef1"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-377f420421f1a13e6fe5c4b6.json",
    "receipt_sha256": "6c2c3015f13c8736bea74b98e5da643079a80e180eb958fc0406b672fc510ef1"
  },
  "story-38dfebeaa7673b7426ba093d": {
    "approval_sha256": "91d68871260503bad57e80d69e45c737c36233b3d752e85ddc937ddfab60541c",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-38dfebeaa7673b7426ba093d.ctc.private.json": "03d8fff4a388634e2c7d1652ff6c9c233fc593d4c6a33149fba125d8f79f9d75",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-current111-pass35.private.json": "907ccf2206daa1fe422086c3d3fafbefff000faa9ebc00390f974577ae1a4c0a",
      "timing-root-scoped-pass35/story-38dfebeaa7673b7426ba093d.before.private.json": "dee78be275aa9c85affbb2f43f1c7e132d8a4362a392ecfc44b6a6ee5455f0fc"
    },
    "original_receipt": "timing-root-scoped-pass35/story-38dfebeaa7673b7426ba093d.before.private.json",
    "receipt_sha256": "e231adf573b2606da7f77c48639723b37fd79afb7d863e1d490b041097840582"
  },
  "story-3b9c81f38f4ef3d335ea4cbf": {
    "approval_sha256": "4060dfd66ebc45f73d04abccbb6d82496edbcc748608d995ca4517f5dc1f448b",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/guarded-apply.private.py": "56446151e55331c499be2f7c6594ce66cd5580deef1723a486fc2b4f124184bb",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-3b9c81f38f4ef3d335ea4cbf.full-large-dtw.private.json": "a767930bfee31574bae06c32fde7045151939e236838d5bc72cab04a277091f6",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-3b9c81f38f4ef3d335ea4cbf.json": "4a9f3e568e92d9d687dadbf7b48822c4e13f55863d189e723baa8798518ae2fc"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-3b9c81f38f4ef3d335ea4cbf.json",
    "receipt_sha256": "4a9f3e568e92d9d687dadbf7b48822c4e13f55863d189e723baa8798518ae2fc"
  },
  "story-3f4b796cb8c7bf59bffcca22": {
    "approval_sha256": "e39378efa02ed5446b7cb9b0a5f32711a6ddb5069685e2b2ba1c346b7b799112",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-full-bank/story-3f4b796cb8c7bf59bffcca22.ctc.private.json": "9e78b65fd1afd1648b3d50f9665cdcc9205866281bd81dd56c9c1773ebd20e7d",
      "qa-pass26.private.json": "d4daa55dbcbcb21f5ddf0fae44a312d8fa8ce32996ffe469703de2713e69f315",
      "timing-primary-scoped-root-pass26/story-3f4b796cb8c7bf59bffcca22.before.private.json": "c7756feaa4d9fc7962816888860c1cc93eb1780fa3fb56e99dad01446a193874",
      "timing-review-pass26-primary-scoped-evidence.private.json": "89a8b33082442b316678929c6349b27e76190bee1435b5dd6b10f7d2dc233e58"
    },
    "original_receipt": "timing-primary-scoped-root-pass26/story-3f4b796cb8c7bf59bffcca22.before.private.json",
    "receipt_sha256": "9f9d9521c3cd812da575d012a151d30633f5945602014a4a31e33bd67d9f3dc3"
  },
  "story-3feecb5b576f051d1862f4d8": {
    "approval_sha256": "7711bcb5df866e89de936a684302567da4f338a0b990879875f6e53b65b07ac6",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-3feecb5b576f051d1862f4d8.ctc.private.json": "94898d02a10cf3b5c09eaf2009b719b1183d6a25ca4460ea47a2631d13f7aeab",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-3feecb5b576f051d1862f4d8.before.private.json": "0489407e9ab3872e6bebd8cc2d92f059ec4d37a2330638918714395dd66f3913"
    },
    "original_receipt": "timing-primary-root-pass27/story-3feecb5b576f051d1862f4d8.before.private.json",
    "receipt_sha256": "8e43215503b99ee79c93b46ac642e4370ea4279c208703f46e8eb37a30ceed1e"
  },
  "story-403558f89ba839310c16a825": {
    "approval_sha256": "76e58ce3ee459c73eef48c81b912e071acb3781c7cc0a9f6e9a8b6ad91dbabe9",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-four-unchanged-caption-scheduling-estimates-pass53-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-403558f89ba839310c16a825.json": "fbc5b7c2bd9b8c165ec4ec5863a1722182e7ebb1f8bb9dd355042ccaa237308b",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/apply-contract.private.json": "d28f84f5d29273bbebb79f8755208ab44613ae39e99b66af5e74970fc012d543",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/guard.private.py": "baaf239962a9620895f41b25af20c34bde57a080e690d5e4000d1c1be9015767",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/proposals.private.json": "8c63f738c856dce917b99a8e3498830d7b1ac3e8b4c607c077c181965301a99c",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/root-reviewed.private.json": "a361cd9e440c2ee337e3b5617b10aa6df45b89f11ddaf43702043f2b936af5f3"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-403558f89ba839310c16a825.json",
    "receipt_sha256": "fbc5b7c2bd9b8c165ec4ec5863a1722182e7ebb1f8bb9dd355042ccaa237308b"
  },
  "story-415e9b40f911488bfd48307a": {
    "approval_sha256": "eba1043648f68ec1813d522a1de066e838039067add78661a7428dcec1bd6727",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/guarded-apply.private.py": "56446151e55331c499be2f7c6594ce66cd5580deef1723a486fc2b4f124184bb",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-415e9b40f911488bfd48307a.full-large-dtw.private.json": "fb3b740e436a91063d39abed43eacf8ff3ae5ba88a500ff877c5c428c43a2471",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-415e9b40f911488bfd48307a.json": "4c73d14dbc1b7f8281f68beb11e34492d5d24e9f9911c376ffd3bfe0f62f44a4"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-415e9b40f911488bfd48307a.json",
    "receipt_sha256": "4c73d14dbc1b7f8281f68beb11e34492d5d24e9f9911c376ffd3bfe0f62f44a4"
  },
  "story-427522302870b8259b642aec": {
    "approval_sha256": "0cfee776632e8ab56826d0421d3215fe4083e11e56c4e5763dcbb375320126b6",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-427522302870b8259b642aec.ctc.private.json": "f7f622b126a1c2d64a4ca258de586e852dd1db73236de0cfa6d4db5e904227e4",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-427522302870b8259b642aec.before.private.json": "1ecb81b01f527da786af099a1e0b22d6cdf2b7a6e0371462920122009ff74f4c"
    },
    "original_receipt": "timing-primary-root-pass27/story-427522302870b8259b642aec.before.private.json",
    "receipt_sha256": "5213a85d408d683aac7cb34e8f2fbad110a852db7f5260dedf8958e9b61005c2"
  },
  "story-43684c454bac0db005986772": {
    "approval_sha256": "2de784b2f3502c5f1ce1589ac5720376848baf34941d3c534a4892d8523774c3",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-current-imported2-individual-caption-estimates-pass67-v1",
    "evidence_sha256": {
      "timing-imported2-pass67-offline/root-caption2/apply-contract.private.json": "e65d3a2fcef529dd4703dd75e5155a91cb1926f6824d648e061687ade8ed321b",
      "timing-imported2-pass67-offline/root-caption2/apply.private.py": "6f4789f5ea32d6ce441a69f3789e9748a26f94cf53a97a9e6ec57ae703b49f1f",
      "timing-imported2-pass67-offline/root-caption2/proposals.private.json": "8312e561be35e18d7f4d6915e602b65b039ad7144ed9c0819225c412bf7f85fc",
      "timing-imported2-pass67-offline/root-caption2/root-reviewed.private.json": "49558d64b7c859c6780f83fcd55e0c6e37a93639f5f68f2701968aa8c3e4c115",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-43684c454bac0db005986772.json": "3498e432fa1381265dbea6bc8bd6ee322857afbcd6c338dd448db5a6bdda36d4"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-43684c454bac0db005986772.json",
    "receipt_sha256": "3498e432fa1381265dbea6bc8bd6ee322857afbcd6c338dd448db5a6bdda36d4"
  },
  "story-4466cdd63e78fdf42b7d6193": {
    "approval_sha256": "2a5b832435be979053d80c9aaee9552bf069ee85e15b04edd74fcad840c27615",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1/private-root-four-residual-source-caption-estimates-pass53-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-4466cdd63e78fdf42b7d6193.full-large-dtw.private.json": "30d196de12b61b1e548a3fde2f774251d96e656b6084e3cc1dab84d583a526a9",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-4466cdd63e78fdf42b7d6193.json": "de8efb48e64c5aad7bf65cee7cb39f3d8ac1c57080e7c1f6a3b3d84e42e9fb1d",
      "timing-residual-source4-pass53/apply-contract.private.json": "c399e3e3dee12dc28d6ae413f72965a2da529b48ad4a2a00050aa124a463ade2",
      "timing-residual-source4-pass53/guard.private.py": "31423ebca7d06cb69ff964a923c3a90a236003edce30f213ccb32d444c1eedc5",
      "timing-residual-source4-pass53/proposals.private.json": "ac8e9cb01a513525ad6a784696f088523d424634bbcc302d00f750ea5e137b47",
      "timing-residual-source4-pass53/root-reviewed.private.json": "ca00ef5b4e9dbd4a81b3a119bbb0694c1aba0417c9c3cf4d2d895a5cecd7f402"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-4466cdd63e78fdf42b7d6193.json",
    "receipt_sha256": "de8efb48e64c5aad7bf65cee7cb39f3d8ac1c57080e7c1f6a3b3d84e42e9fb1d"
  },
  "story-479f46a374c7c0d4d37b63b3": {
    "approval_sha256": "14f76cb320e475d29b165bccc02c3298712660fbdee148a335df9a956136d6a2",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-479f46a374c7c0d4d37b63b3.ctc.private.json": "7a820c6eda4c37f9f71646042733c411b57241451e4a6574acad55c1a5b29725",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-479f46a374c7c0d4d37b63b3.before.private.json": "479783b7693192f13dcf2646191925e0670c837bf8f012f0ebc7a4a85842de9c"
    },
    "original_receipt": "timing-primary-root-pass27/story-479f46a374c7c0d4d37b63b3.before.private.json",
    "receipt_sha256": "a2287b8c88fef4fb70955d95f4c97cf72e89c0d0d0cbfd88c7552ecad91a7592"
  },
  "story-4bcb91e9d658f38ac70e2682": {
    "approval_sha256": "d733360c0a97eec26a627affd9657991ce754daf660e0b73a63c62e07ae1d7fb",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-full-bank/story-4bcb91e9d658f38ac70e2682.ctc.private.json": "2c7752cca6b496331795028db01ce0f0837f99c9b5c2cc4ee9412bcd1817441e",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-4bcb91e9d658f38ac70e2682.before.private.json": "93b1c1cf2ce2910bb985078fb59fbc371d9ba79dec0257e1e15af4343eb42912"
    },
    "original_receipt": "timing-primary-root-pass27/story-4bcb91e9d658f38ac70e2682.before.private.json",
    "receipt_sha256": "2ed174b1f2bf965bec1fc155812edcc5bc87ca6db61695161e8bdae1e4314604"
  },
  "story-4be21913b62b6157541e0021": {
    "approval_sha256": "f6b1025a22ad1844090bbffa131a4551eea38f11356e5be20bee6783b52be713",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/guarded-apply.private.py": "56446151e55331c499be2f7c6594ce66cd5580deef1723a486fc2b4f124184bb",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-4be21913b62b6157541e0021.full-large-dtw.private.json": "bb88ab31430960daad9e3bd8829d5af4028b0dac72b7927a17aa716695c6ffdf",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-4be21913b62b6157541e0021.json": "8bb31cfa61b9c8c8440dfe46e2635b2a8e81beada2cd0f2fdff0a9f71c32ae5a"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-4be21913b62b6157541e0021.json",
    "receipt_sha256": "8bb31cfa61b9c8c8440dfe46e2635b2a8e81beada2cd0f2fdff0a9f71c32ae5a"
  },
  "story-4e86a1dcd4d2f03823333d62": {
    "approval_sha256": "e695376ad17dda269ceac3d25b0aa095bd0e60642f0f2764052c43766be83ff1",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/guarded-apply.private.py": "56446151e55331c499be2f7c6594ce66cd5580deef1723a486fc2b4f124184bb",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-4e86a1dcd4d2f03823333d62.full-large-dtw.private.json": "e18e11cdc68036cd5bbd684be30785ee5f53d138c751b930c7439cd05619f1d4",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-4e86a1dcd4d2f03823333d62.json": "1d2729d0e05a15ee5199cf91b8116dcb3d3108f28b547158d94be6eb4e77a541"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-4e86a1dcd4d2f03823333d62.json",
    "receipt_sha256": "1d2729d0e05a15ee5199cf91b8116dcb3d3108f28b547158d94be6eb4e77a541"
  },
  "story-503a4fe255f430aae0d64895": {
    "approval_sha256": "ddc8d548c7b7443e684c3cc092ca1aa97e784c324d579c20cc8200739d7525e8",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-root-final-pass39",
    "evidence_sha256": {
      "clips/story-503a4fe255f430aae0d64895.mp3": "0f2cccee10b8a5ddc6701719a5ed2bd537c036509fa04485f3148332c777215f",
      "free-large-v3-current-pass38/story-503a4fe255f430aae0d64895.actual-free.private.json": "3e232296a330dfd275c91d3f1cfcfa94d2a7fe7d664e45fe97c33ebae418b35a",
      "large-v3-timing-review-pass38.private.json": "7bedc39d4b09d3b90e2489c7025b1b1691effb769aed0ef06350d3a4cb397d16",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "qa-pass37-additive-v2.private.json": "3e7d518e2073a7274937f98e520aae7ff2b8b2713fae38b42daca57085769862",
      "raw/story-503a4fe255f430aae0d64895.receipt.json": "03d8825a751a1d02555321a3035173c3e913c4704dbeb856f48ea261f282e7c1",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-503a4fe255f430aae0d64895.json": "9276f0d588d2b670f1cccf5e7e157f64abf26a04a183a7a1663912d294c1663a",
      "timing-root-final-pass39/proposals.private.json": "b54e568e1e7a62f78e813831efcdc57d909749863f562ad39761657699ebec54"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-503a4fe255f430aae0d64895.json",
    "receipt_sha256": "9276f0d588d2b670f1cccf5e7e157f64abf26a04a183a7a1663912d294c1663a"
  },
  "story-592db3f5bc045cdf841c082e": {
    "approval_sha256": "c6c6fdbca913573b027747d76ae3c2361973178d693d2b942a1c2e840febb806",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-root-final-pass39",
    "evidence_sha256": {
      "clips/story-592db3f5bc045cdf841c082e.mp3": "3ca56017abb97b5dee71af3b3aa858a9236ec4f4d45e919d9a9fdfeb1e168971",
      "free-large-v3-current-pass38/story-592db3f5bc045cdf841c082e.actual-free.private.json": "74379db5635d3d747501466f7f786fd2459fa4423b924ed141f749756d5da605",
      "large-v3-timing-review-pass38.private.json": "7bedc39d4b09d3b90e2489c7025b1b1691effb769aed0ef06350d3a4cb397d16",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "qa-pass37-additive-v2.private.json": "3e7d518e2073a7274937f98e520aae7ff2b8b2713fae38b42daca57085769862",
      "raw/story-592db3f5bc045cdf841c082e.receipt.json": "978a3c5bcfd1f697755a817a32712a0b8b0c44152f88e4609392dbd9ab2db7c6",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-592db3f5bc045cdf841c082e.json": "6ff58129bbda7edf7a608f0a4d97b11e0bbbf8dc60a36b45ea867e371f925ada",
      "timing-root-final-pass39/proposals.private.json": "b54e568e1e7a62f78e813831efcdc57d909749863f562ad39761657699ebec54"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-592db3f5bc045cdf841c082e.json",
    "receipt_sha256": "6ff58129bbda7edf7a608f0a4d97b11e0bbbf8dc60a36b45ea867e371f925ada"
  },
  "story-5ae8b2ac41160d82267e217d": {
    "approval_sha256": "6ab6b588a412b199b24b94148359789515ce13ab1060f00d343510acc41f9794",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-5ae8b2ac41160d82267e217d.ctc.private.json": "730baa8a2b446992feff7ac5c2094a438c135a331dd6bede4b88f7b350f48490",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-5ae8b2ac41160d82267e217d.before.private.json": "758d12d37f860823017e6d8f97107d595701aed2f05d9312fabc2c999038669b"
    },
    "original_receipt": "timing-primary-root-pass27/story-5ae8b2ac41160d82267e217d.before.private.json",
    "receipt_sha256": "3b7cfb2da6d4987ac2f2e55087c9be2753435b11207f06e6745a0ce43eeda2b0"
  },
  "story-5d344ec2246a034dc657814d": {
    "approval_sha256": "13ca7d9fa11ab7282529a9d0ee964a886da2837332109647fa8b4c83bba90849",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-combined5d846-caption-timing-pass56-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-5d344ec2246a034dc657814d.json": "274644577fc687acbf826c85535a8e1f22b76683c19264a593da484684d99c0b",
      "timing-new-imports56-offline/combined-root-apply/apply-contract.private.json": "fac235be91cb32538fa730e04f13963cdc1db56518ec04dae219edb3ccd80b08",
      "timing-new-imports56-offline/combined-root-apply/apply.private.py": "fbe3cc0fb4fe8bd4613267b5f621f9d51831012b044bf79205d2c1fa8b7224c8",
      "timing-new-imports56-offline/combined-root-apply/proposals.private.json": "0fb0ede6946b32fd99731a8bd86be9a5092b688a8f020b51463a54bed59c6a44",
      "timing-new-imports56-offline/combined-root-apply/root-execution-reviewed.private.json": "ef3ab05b25ffdd1afe105dbe5988c01d6c1419fbb4f3c008e0c0a8110d0d21cc"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-5d344ec2246a034dc657814d.json",
    "receipt_sha256": "274644577fc687acbf826c85535a8e1f22b76683c19264a593da484684d99c0b"
  },
  "story-5e005372d4e466a90c5f5d03": {
    "approval_sha256": "75a51f6631933b8bed0a295158ad77e009b1abc242d0f1b98b452885ed1f0076",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-current-5e-unchanged-caption-estimate-pass53-v1",
    "evidence_sha256": {
      "timing-current-5e51-offline/unchanged-caption-root53/apply-contract.private.json": "e1bef9d98f254fafb66a5854098666705e5026a7c3843ace45365efad9ed95ab",
      "timing-current-5e51-offline/unchanged-caption-root53/guard.private.py": "bae7fbcacb7e1f74a84cb42946091ec56ba2d4d4f39dd521679208f5e0b197e6",
      "timing-current-5e51-offline/unchanged-caption-root53/proposals.private.json": "a12fc56433711389cbdc501247c9da2a479dccd4f18cdbcb5627e20e519178a5",
      "timing-current-5e51-offline/unchanged-caption-root53/root-reviewed.private.json": "d5d5d42f317bfe6812b11085d9346948e83879f997bed46752365df7d02972da",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-5e005372d4e466a90c5f5d03.json": "7bcd7b763315d8eea4745aa3571112cef9683bafc9f392a96756c192bfa6ae41"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-5e005372d4e466a90c5f5d03.json",
    "receipt_sha256": "7bcd7b763315d8eea4745aa3571112cef9683bafc9f392a96756c192bfa6ae41"
  },
  "story-625496d155f52051d7a52069": {
    "approval_sha256": "ffca0005f274b31aa37c94f147a39e60676d4eba2de2fe650a8650fe29c942f9",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/actual-full1557-checks/20261006T140242.324012Z/staged-bank/word-cues/story-625496d155f52051d7a52069.json": "90bc9da572774296759f6794c6f69316087ed03be0d26d69b800642658e7f867",
      "timing-native625-pass42/proposed-receipt-scope0-7.private.json": "68ab1d36775601ec87450bd5c06f9ec6a662aeca3ddc9a50d55271f1a4d1df56",
      "timing-native625-pass42/story-625496d155f52051d7a52069.before-dtw41.private.json": "8e9362085a170be4f3817dc815c22d353118dc835b6f39f8ad9b887b5e4e9807"
    },
    "original_receipt": "timing-imported3-pass60-offline/actual-full1557-checks/20261006T140242.324012Z/staged-bank/word-cues/story-625496d155f52051d7a52069.json",
    "receipt_sha256": "90bc9da572774296759f6794c6f69316087ed03be0d26d69b800642658e7f867"
  },
  "story-652d93278e3e8edea2adf720": {
    "approval_sha256": "f62a1be6b0982b6408b58cc070257ad879e210512647686cb4f42234a0d381c0",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-652d93278e3e8edea2adf720.ctc.private.json": "7d5f69ae97a613475d0541eb58b0ab8671fd94c64d3a0c1ef830ba3c7cf5a30f",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-652d93278e3e8edea2adf720.before.private.json": "0d8ccbca0ece79309e2ec377929ef89ae606aa21495cf8df9fb29d86ebca8c73"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-652d93278e3e8edea2adf720.before.private.json",
    "receipt_sha256": "1be66d86c99b5300b4505810212d142d80dfc4d98f4682f21201d65fad03ac77"
  },
  "story-65a222e667506c9d9707381e": {
    "approval_sha256": "5c0a7dd897f2d3c9fd5dd3b1b7f0af677939703dcfd1c8c01fb2fd5278a6de26",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-65a222e667506c9d9707381e.ctc.private.json": "54444114059b02277e796a5cc69cddfb00639efd76adc885348f8b84af5f0990",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-65a222e667506c9d9707381e.before.private.json": "b715185d400c562a1e630ac926c6951430c760daf33e38d4d6c799250d1e6e3b"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-65a222e667506c9d9707381e.before.private.json",
    "receipt_sha256": "f260395fd3b9a6407341606e2a1fae5a3d9d4bdd6988754c9a75072760b9fc66"
  },
  "story-65f45809c139c52ac0c6ebfa": {
    "approval_sha256": "7c991c28ecb57db487e30fbf1a524bfa178e03c710097810a0b4df301167a696",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-65f45809c139c52ac0c6ebfa.ctc.private.json": "55136c7e275094250beddd45bffe78ab6b05462552f5eb6089f25b53ef7bb375",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-65f45809c139c52ac0c6ebfa.before.private.json": "1b5712aaf304044417e9e8cab2807df7ad6609dddffe76bcf21aad1acdfe3421"
    },
    "original_receipt": "timing-primary-root-pass27/story-65f45809c139c52ac0c6ebfa.before.private.json",
    "receipt_sha256": "b855e643ba393daaae0431bfeec940f6cb09955c764893a2a6c28b983c31008b"
  },
  "story-6cfc59c45bb3e28b2bb21c00": {
    "approval_sha256": "ab04ef71833b47f1ce73d9e48069cd6e04e91c19231229525399f556abf195bf",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-private-wave-root-pass45",
    "evidence_sha256": {
      "clips/story-6cfc59c45bb3e28b2bb21c00.mp3": "0ab62dbb5d08eaa85a293cbdbb7f09f967d3cea002b00f6d54fc0939538783a4",
      "free-large-v3-current-pass38/story-6cfc59c45bb3e28b2bb21c00.actual-free.private.json": "cf282145d5b0458374255200135cd6dd010f8f86371a7c03b8b26fb50e67f492",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "profiles.private.json": "a4f48d340993d8ccab631fb1f7ad31ce0829c22aee0e1009adf891b79028367f",
      "qa-pass41-additive.private.json": "30cb6dde823401b8a69eb8a480b142f657c4486aa0c9cd43802686ce0934b742",
      "qa-pass43.private.json": "924d249fa204b598fbbe15dd14cf5063c074582ccbb9df1603b9709822912d5b",
      "timing-backlog-pass45/guarded-proposals.private.json": "70660738c33764c71c017c7594cb25cd10a41f2b8e4e03c7c93b19c4ab7d0300",
      "timing-backlog-pass45/literal-wave-review.private.json": "f918bc72fab2f78db5d595ca4bbde3c5e535a44999718bf74673926cfbc95ebb",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-6cfc59c45bb3e28b2bb21c00.json": "a76b30c0523cc670560b39d799150addd641b982ac6025397a0d0c24928e5f5e"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-6cfc59c45bb3e28b2bb21c00.json",
    "receipt_sha256": "a76b30c0523cc670560b39d799150addd641b982ac6025397a0d0c24928e5f5e"
  },
  "story-6f5a7942c1ef9416e1fd2950": {
    "approval_sha256": "9463d4c6bbc9afca1a8591bc8236bd33cee5a4d9ad15418b7cbd0d028c6ea7bc",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-pass12/story-6f5a7942c1ef9416e1fd2950.ctc.private.json": "36921bce7ae8f754120bfbcc2c917e36360e774d401864540dabaee1daa12461",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing3-additive-pass35.private.json": "ca31576575e4f2e998960fe018760a085abd527aef226e81c38660328c8b5423",
      "timing-root-additive3-pass35/story-6f5a7942c1ef9416e1fd2950.before.private.json": "cc8932609d27e849ecdf05c38ec331859df1cee5f083923b30733f0a5824a2ae"
    },
    "original_receipt": "timing-root-additive3-pass35/story-6f5a7942c1ef9416e1fd2950.before.private.json",
    "receipt_sha256": "c74c7e105389d81bac6a67f261dabeacd4f1d294343ab8c13487e59866c3cce1"
  },
  "story-79173186887424bd9299f45a": {
    "approval_sha256": "6ea3ad72a7c78487bcb39ac9c9b8042b993c878dba987404727387cf338afe41",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-79173186887424bd9299f45a.ctc.private.json": "286626ffbf3734315d8fed3798c7edc7a6d066c8f1fcb54b00c95a7a1e0f7c5f",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-79173186887424bd9299f45a.before.private.json": "a40d4362cb22db719effefd2bdb082f31d13bd9e76a486273b95f67095e91b2b"
    },
    "original_receipt": "timing-primary-root-pass27/story-79173186887424bd9299f45a.before.private.json",
    "receipt_sha256": "a78c9a08c79991f89282d4538f6f61ea57291265aa82841b328f592730a6c1ff"
  },
  "story-7a3bf5e3da115e2c57542708": {
    "approval_sha256": "1b06cc9390d76a3e1f59be8cb4cdbce2927585027766c46fc15f5bcf16d15a9a",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-five-native-waveform-timing-pass50-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-7a3bf5e3da115e2c57542708.json": "5d506ecacb22c43b5e872f3004899d97df534014d1f9062280a221d5de6bf09a",
      "timing-remaining-wordclean49-offline/root-apply50/apply-contract.private.json": "f646ddc1ff20098b460d2a0ded3c7b4285f7e51d73aad32f8d51a18593614e3d",
      "timing-remaining-wordclean49-offline/root-apply50/apply.private.py": "e27c2a16fa9d0a5156879594a6a0599f53bdeeefdf4417fb8dbdf6e05b8c688e",
      "timing-remaining-wordclean49-offline/root-apply50/proposals.private.json": "22254385300dddf4c96d41c04a0a65fe381c8e39c21a5fc7fcf01b6989039866",
      "timing-remaining-wordclean49-offline/root-apply50/root-reviewed.private.json": "80ebab7950c142ef316e4047faa3853017cb1652047bdf13889ff6906a254752"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-7a3bf5e3da115e2c57542708.json",
    "receipt_sha256": "5d506ecacb22c43b5e872f3004899d97df534014d1f9062280a221d5de6bf09a"
  },
  "story-822735c386a587f79e3409aa": {
    "approval_sha256": "bdaf96deede8d9285cf43a26725d5c0ba6eba85db06e7d11032188f977a0c70f",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-822735c386a587f79e3409aa.ctc.private.json": "070f52d4af922091de1c04435b9947f75f8fda61c1c8aa34e5d84731209c0fc5",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing11-pass34.private.json": "c05d049a8999204405caf590337a5897c84c5adab2b372925be76b25fb47cabd",
      "timing-root-scoped-pass35/story-822735c386a587f79e3409aa.before.private.json": "aa46cde3195b56bb56197bc6d3c2be285d60d645ba4630dc0525cf0177012525"
    },
    "original_receipt": "timing-root-scoped-pass35/story-822735c386a587f79e3409aa.before.private.json",
    "receipt_sha256": "0ad7b3a5f1fe6c9bbb7d5c341fa8f7f6fb91ab5367473a5e07a21926c921483d"
  },
  "story-8398c416e1693b2681d2062a": {
    "approval_sha256": "e095c6a8a1c0848b991adbf68f3eb65fd261f9b6334add0cda1b37f0261f329e",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-five-native-waveform-timing-pass50-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-8398c416e1693b2681d2062a.json": "fd2d0e8b7ad641900c5a207c5e620cf4aa797a94964662b85f90d25b31f56c91",
      "timing-remaining-wordclean49-offline/root-apply50/apply-contract.private.json": "f646ddc1ff20098b460d2a0ded3c7b4285f7e51d73aad32f8d51a18593614e3d",
      "timing-remaining-wordclean49-offline/root-apply50/apply.private.py": "e27c2a16fa9d0a5156879594a6a0599f53bdeeefdf4417fb8dbdf6e05b8c688e",
      "timing-remaining-wordclean49-offline/root-apply50/proposals.private.json": "22254385300dddf4c96d41c04a0a65fe381c8e39c21a5fc7fcf01b6989039866",
      "timing-remaining-wordclean49-offline/root-apply50/root-reviewed.private.json": "80ebab7950c142ef316e4047faa3853017cb1652047bdf13889ff6906a254752"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-8398c416e1693b2681d2062a.json",
    "receipt_sha256": "fd2d0e8b7ad641900c5a207c5e620cf4aa797a94964662b85f90d25b31f56c91"
  },
  "story-84672554dbb29bf556f6c250": {
    "approval_sha256": "3e26a29af5d42ff9df9646548742f83fc844a17c3dc81d27057741bbe1570d72",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-combined5d846-caption-timing-pass56-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-84672554dbb29bf556f6c250.json": "fd4864ebe29fa6bcdefdb00930bb7248f7c673a137e47414c16b5a3f127cfc7c",
      "timing-new-imports56-offline/combined-root-apply/apply-contract.private.json": "fac235be91cb32538fa730e04f13963cdc1db56518ec04dae219edb3ccd80b08",
      "timing-new-imports56-offline/combined-root-apply/apply.private.py": "fbe3cc0fb4fe8bd4613267b5f621f9d51831012b044bf79205d2c1fa8b7224c8",
      "timing-new-imports56-offline/combined-root-apply/proposals.private.json": "0fb0ede6946b32fd99731a8bd86be9a5092b688a8f020b51463a54bed59c6a44",
      "timing-new-imports56-offline/combined-root-apply/root-execution-reviewed.private.json": "ef3ab05b25ffdd1afe105dbe5988c01d6c1419fbb4f3c008e0c0a8110d0d21cc"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-84672554dbb29bf556f6c250.json",
    "receipt_sha256": "fd4864ebe29fa6bcdefdb00930bb7248f7c673a137e47414c16b5a3f127cfc7c"
  },
  "story-85f4a705e235eba61449be36": {
    "approval_sha256": "0f482551de707a7f25d573d30a439232ad47648e341a90d0f149b087cec05c10",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-root-final-pass39",
    "evidence_sha256": {
      "clips/story-85f4a705e235eba61449be36.mp3": "ed62a1652b7c46ad9ba93ff595292a296435f71c17a3c9089da769e715714a38",
      "free-large-v3-current-pass38/story-85f4a705e235eba61449be36.actual-free.private.json": "be598d1558338c43ef6cc58fb739d1f8dadc2ff8d1716c05ebe576419c5898e1",
      "large-v3-timing-review-pass38.private.json": "7bedc39d4b09d3b90e2489c7025b1b1691effb769aed0ef06350d3a4cb397d16",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "qa-pass37-additive-v2.private.json": "3e7d518e2073a7274937f98e520aae7ff2b8b2713fae38b42daca57085769862",
      "raw/story-85f4a705e235eba61449be36.receipt.json": "07375afdde57c37000ddfcdfc9b19691b165f185b0a717e4a7f2e97c67a210e9",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-85f4a705e235eba61449be36.json": "19ae33ded8a9d33284fff6f29a38ddbe5bdba2d216c7d50ad991e953d44dce3a",
      "timing-root-final-pass39/proposals.private.json": "b54e568e1e7a62f78e813831efcdc57d909749863f562ad39761657699ebec54"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-85f4a705e235eba61449be36.json",
    "receipt_sha256": "19ae33ded8a9d33284fff6f29a38ddbe5bdba2d216c7d50ad991e953d44dce3a"
  },
  "story-86023dddb8945fc9da8d9130": {
    "approval_sha256": "d3ada43c0c17e9d43167f6d8ebf88fc03f6f79fbd85b1044323d9296d1361adc",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-86023dddb8945fc9da8d9130.ctc.private.json": "4ee0031b220fdbfac9441b7dc3e1561e10e561d5e65c04d16408c00c9cf18267",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-86023dddb8945fc9da8d9130.before.private.json": "7cab56f91fdf9e060d78049754483616b49e56422a53cfef6303b7f68d1d28de"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-86023dddb8945fc9da8d9130.before.private.json",
    "receipt_sha256": "429af254f200c8d3962ad87bd865339efaff93859342c5399db49777717f99da"
  },
  "story-861b5aa5e68eabee2d31db07": {
    "approval_sha256": "9a9f6d14b09e9b0ade2c09cb26cd486c21086a5ac39053a05663324c0b59eb20",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-root-final-pass39",
    "evidence_sha256": {
      "clips/story-861b5aa5e68eabee2d31db07.mp3": "8d8479f54a04bb827ef77c061d2d864a805c44517ddc879a17c72425d0fc8f9e",
      "ctc-projection-current-pass38/projection-evaluation.private.json": "afbad87786a48965b5bdfcd1b15da28e4fa836861d384af23a9fd6cfb5280e3e",
      "ctc-projection-current-pass38/story-861b5aa5e68eabee2d31db07.actual-logits.private.npy": "ffa08c17fc151b068a08da06fdfa90f1dedeaf384b4707b579d39377ba3e6614",
      "ctc-projection-current-pass38/story-861b5aa5e68eabee2d31db07.actual-logprobs.private.npy": "714b76697f8593d88e255c7f5e9da67017cf2d2bd7da30e3809f11c0734599e9",
      "ctc-projection-current-pass38/story-861b5aa5e68eabee2d31db07.hf-normalized-feature.private.npy": "eb404131d197d94ab8225a445581777609bf1befd4a9684a285baab596d99376",
      "ctc-projection-current-pass38/story-861b5aa5e68eabee2d31db07.projection.ctc.private.json": "c9bfbff9db0594e039029c0bbd366abf387f72e49a3f17bcdeda3187a870e56f",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "qa-pass37-additive-v2.private.json": "3e7d518e2073a7274937f98e520aae7ff2b8b2713fae38b42daca57085769862",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-861b5aa5e68eabee2d31db07.json": "6c5d4d1274d91ebe9a839d302ae378c7e22ff4a50f41f757c379dfab43209c6b",
      "timing-root-final-pass39/proposals.private.json": "b54e568e1e7a62f78e813831efcdc57d909749863f562ad39761657699ebec54"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-861b5aa5e68eabee2d31db07.json",
    "receipt_sha256": "6c5d4d1274d91ebe9a839d302ae378c7e22ff4a50f41f757c379dfab43209c6b"
  },
  "story-87fc79c20da2796dd07cd75e": {
    "approval_sha256": "d905da22d48602d748e74ee401358cbf6a6a688e3e4cbbddcdbe6eccc1d64d46",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "expressive-events-root-current4-pass32.private.json": "8cda647f031bb1772f5f09270efd303371688922e60c76e2d8a6224d1cffb905",
      "timing-current-pass33/root-adoption/story-87fc79c20da2796dd07cd75e.before.private.json": "9d2ede370d9a20fcc50ef76165e060b163cc21f2741285f265016efeca5db5dc",
      "timing-current-pass33/story-87fc79c20da2796dd07cd75e.proposal.private.json": "70df67fed4745a4acbe9eb78c1efd3a668f4ecba2f75776c38e5cd2220509316"
    },
    "original_receipt": "timing-current-pass33/root-adoption/story-87fc79c20da2796dd07cd75e.before.private.json",
    "receipt_sha256": "e1f6c421bf3d1f8a1e377008d2b9edd25cd0daa6e9346bbf043237ad8a2cea24"
  },
  "story-948c38fa2ff8072e1c27d252": {
    "approval_sha256": "f3ef5b99f3923af2ffd5ab5789d21cc64e655db2c077cfc4fec5bb4f9361388b",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "timing-current-pass29/948c-scoped-proposal.private.json": "a1ede111ab8e204ee0e3aef836598d174909db15b36e01c9c6367a9124a193dc",
      "timing-current-pass29/root-948c/before.private.json": "ea381a7326d4d1db07ef8ec276417cc29befe492d9f04a51548e99c1f5769fec",
      "timing-current-pass29/root-948c/prior-alignment.private.json": "5095865400b6c3c2191dd3038362184224f1fb18e32b41c2fa93ec4abce8d20f",
      "timing-imported3-pass60-offline/actual-full1557-checks/20261006T140242.324012Z/staged-bank/word-cues/story-948c38fa2ff8072e1c27d252.json": "380212d4dfb7890525bffb44962c49a4ff2dc833cbb0e821d7040d6c1d2bf533"
    },
    "original_receipt": "timing-imported3-pass60-offline/actual-full1557-checks/20261006T140242.324012Z/staged-bank/word-cues/story-948c38fa2ff8072e1c27d252.json",
    "receipt_sha256": "380212d4dfb7890525bffb44962c49a4ff2dc833cbb0e821d7040d6c1d2bf533"
  },
  "story-94a030f6048a2a10ff98e67c": {
    "approval_sha256": "05887bd308ef492a1d26d2697d671a373ad54c54db4b14c0fa9c684a8dcba2c7",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-private-wave-root-pass45",
    "evidence_sha256": {
      "clips/story-94a030f6048a2a10ff98e67c.mp3": "6b1f873dc9d748261b9f53d76da12c8a876ad21bd545430580dc08c8edf9ea3a",
      "free-large-v3-current-pass38/story-94a030f6048a2a10ff98e67c.actual-free.private.json": "687ce4385e9069cc2c0f4416c15add24b299f09b3e26be43487842af7f1638a9",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "profiles.private.json": "a4f48d340993d8ccab631fb1f7ad31ce0829c22aee0e1009adf891b79028367f",
      "qa-pass41-additive.private.json": "30cb6dde823401b8a69eb8a480b142f657c4486aa0c9cd43802686ce0934b742",
      "qa-pass43.private.json": "924d249fa204b598fbbe15dd14cf5063c074582ccbb9df1603b9709822912d5b",
      "timing-backlog-pass45/guarded-proposals.private.json": "70660738c33764c71c017c7594cb25cd10a41f2b8e4e03c7c93b19c4ab7d0300",
      "timing-backlog-pass45/literal-wave-review.private.json": "f918bc72fab2f78db5d595ca4bbde3c5e535a44999718bf74673926cfbc95ebb",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-94a030f6048a2a10ff98e67c.json": "be589e04805c5e1317f41fd8c44dcd4bb018f2a49b7f37747e2b1ac60da22b4b"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-94a030f6048a2a10ff98e67c.json",
    "receipt_sha256": "be589e04805c5e1317f41fd8c44dcd4bb018f2a49b7f37747e2b1ac60da22b4b"
  },
  "story-955e822924dd230b628a5ede": {
    "approval_sha256": "85c4eb0cd2e4e604be970d18915526b1902dc005cd320fd9b5f6aceeeebbbd39",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-955e822924dd230b628a5ede.ctc.private.json": "331acad38c859a055f4da3c2b7a5c13c66eb47e3b857c5c54c22095956a3de33",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-955e822924dd230b628a5ede.before.private.json": "15735581b4d43489c00253c2028ee051dbf6f23aafa7d945bc9393aa95c8c15e"
    },
    "original_receipt": "timing-primary-root-pass27/story-955e822924dd230b628a5ede.before.private.json",
    "receipt_sha256": "205094b32c445df0971b44c71d4e211fb316b30ff27b4bd21322daa644b9377a"
  },
  "story-95c49f2ee284e215ca7615fc": {
    "approval_sha256": "547570dcf0330f25692be370e4fea3cb16102d2af322338c8268355973c391ef",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "expressive-events-root-current4-pass32.private.json": "8cda647f031bb1772f5f09270efd303371688922e60c76e2d8a6224d1cffb905",
      "timing-current-pass33/root-adoption/story-95c49f2ee284e215ca7615fc.before.private.json": "5c152e7b91e13d0a16534141c53c0133cf062100f8b0c659c49473947021e4f6",
      "timing-current-pass33/story-95c49f2ee284e215ca7615fc.proposal.private.json": "06447527d70e443f278c45e024a49aab213df1186c5d48ee3ce9d37bdca5e609"
    },
    "original_receipt": "timing-current-pass33/root-adoption/story-95c49f2ee284e215ca7615fc.before.private.json",
    "receipt_sha256": "78681417a63194cb9fe9a9569daa443be6d18e5545f2b185952b35e56b03f77c"
  },
  "story-96bf3614b339ca923be41f97": {
    "approval_sha256": "2b0d3cb49030c4dcb75bd9d1d53f70667451ec890372e06a9e997aae09c5ce5c",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-current-imported2-individual-caption-estimates-pass67-v1",
    "evidence_sha256": {
      "timing-imported2-pass67-offline/root-caption2/apply-contract.private.json": "e65d3a2fcef529dd4703dd75e5155a91cb1926f6824d648e061687ade8ed321b",
      "timing-imported2-pass67-offline/root-caption2/apply.private.py": "6f4789f5ea32d6ce441a69f3789e9748a26f94cf53a97a9e6ec57ae703b49f1f",
      "timing-imported2-pass67-offline/root-caption2/proposals.private.json": "8312e561be35e18d7f4d6915e602b65b039ad7144ed9c0819225c412bf7f85fc",
      "timing-imported2-pass67-offline/root-caption2/root-reviewed.private.json": "49558d64b7c859c6780f83fcd55e0c6e37a93639f5f68f2701968aa8c3e4c115",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-96bf3614b339ca923be41f97.json": "18ac4f4046cd0225171fa7d45fde3ee9ed6581b1c5c949b1f339395b657b5ffb"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-96bf3614b339ca923be41f97.json",
    "receipt_sha256": "18ac4f4046cd0225171fa7d45fde3ee9ed6581b1c5c949b1f339395b657b5ffb"
  },
  "story-977213c741fea6f5e85d40ad": {
    "approval_sha256": "55c2b5cb002c055af9eebb740c181ce47acbdec78c2622df23d466382dc71732",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-private-wave-root-pass45",
    "evidence_sha256": {
      "clips/story-977213c741fea6f5e85d40ad.mp3": "3e26bb728b753283b99d8dc9422e46a3ec5602c64a14eee57463b8764ad467bb",
      "free-large-v3-current-pass38/story-977213c741fea6f5e85d40ad.actual-free.private.json": "a250371a2da1bd9313cae7f8ceff5ef2fc01252c59f70cecba13f478faea19e1",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "profiles.private.json": "a4f48d340993d8ccab631fb1f7ad31ce0829c22aee0e1009adf891b79028367f",
      "qa-pass41-additive.private.json": "30cb6dde823401b8a69eb8a480b142f657c4486aa0c9cd43802686ce0934b742",
      "qa-pass43.private.json": "924d249fa204b598fbbe15dd14cf5063c074582ccbb9df1603b9709822912d5b",
      "timing-backlog-pass45/guarded-proposals.private.json": "70660738c33764c71c017c7594cb25cd10a41f2b8e4e03c7c93b19c4ab7d0300",
      "timing-backlog-pass45/literal-wave-review.private.json": "f918bc72fab2f78db5d595ca4bbde3c5e535a44999718bf74673926cfbc95ebb",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-977213c741fea6f5e85d40ad.json": "9acac858cdf73be15e25094794958b6543f7657364bb01984684a47287bbc449"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-977213c741fea6f5e85d40ad.json",
    "receipt_sha256": "9acac858cdf73be15e25094794958b6543f7657364bb01984684a47287bbc449"
  },
  "story-9c42dc4479f625a1833d54e7": {
    "approval_sha256": "f70fda80085151e73d59a6abab1a8ca708afded57ec30d6ecb11b1266b1ad413",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-five-native-waveform-timing-pass50-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-9c42dc4479f625a1833d54e7.json": "cbce279e9e14ae64d004f16240f783dc1b33097a0660738e311150a9f7d477cd",
      "timing-remaining-wordclean49-offline/root-apply50/apply-contract.private.json": "f646ddc1ff20098b460d2a0ded3c7b4285f7e51d73aad32f8d51a18593614e3d",
      "timing-remaining-wordclean49-offline/root-apply50/apply.private.py": "e27c2a16fa9d0a5156879594a6a0599f53bdeeefdf4417fb8dbdf6e05b8c688e",
      "timing-remaining-wordclean49-offline/root-apply50/proposals.private.json": "22254385300dddf4c96d41c04a0a65fe381c8e39c21a5fc7fcf01b6989039866",
      "timing-remaining-wordclean49-offline/root-apply50/root-reviewed.private.json": "80ebab7950c142ef316e4047faa3853017cb1652047bdf13889ff6906a254752"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-9c42dc4479f625a1833d54e7.json",
    "receipt_sha256": "cbce279e9e14ae64d004f16240f783dc1b33097a0660738e311150a9f7d477cd"
  },
  "story-9dfed9a0c747e080887ad99c": {
    "approval_sha256": "197b2cc17a2f77c4f3af7e5ff5ac60727e91ce2cff70bbeb5d2f3324ef95f4a8",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-9dfed9a0c747e080887ad99c.ctc.private.json": "8fdaf647477e982d36cfd8fb1cafbee201755861988f70ee53f61c298bb75217",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-9dfed9a0c747e080887ad99c.before.private.json": "968482f4441a75d6a862bb3e34f67a1bf50be8750d99dd0c85792587d06b9699"
    },
    "original_receipt": "timing-primary-root-pass27/story-9dfed9a0c747e080887ad99c.before.private.json",
    "receipt_sha256": "9a2df0e99dadf352dca5e5097ba1be0b875c1290d358a1ebc2674f8e905afbf9"
  },
  "story-a089e24a1bf43cd61faf48ea": {
    "approval_sha256": "6391f891144bdd8304bf50916e8605366b56ad0e09fceadbb5301bd9906b2845",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-four-unchanged-caption-scheduling-estimates-pass53-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-a089e24a1bf43cd61faf48ea.json": "6563b89c7888fe078ae1a40e0136194c220e219a28a6d00880b28399b5b65d9c",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/apply-contract.private.json": "d28f84f5d29273bbebb79f8755208ab44613ae39e99b66af5e74970fc012d543",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/guard.private.py": "baaf239962a9620895f41b25af20c34bde57a080e690d5e4000d1c1be9015767",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/proposals.private.json": "8c63f738c856dce917b99a8e3498830d7b1ac3e8b4c607c077c181965301a99c",
      "timing-remaining-wordclean49-offline/unchanged-caption4-pass53/root-reviewed.private.json": "a361cd9e440c2ee337e3b5617b10aa6df45b89f11ddaf43702043f2b936af5f3"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-a089e24a1bf43cd61faf48ea.json",
    "receipt_sha256": "6563b89c7888fe078ae1a40e0136194c220e219a28a6d00880b28399b5b65d9c"
  },
  "story-a11b7d5e3a12bdbffd98eae3": {
    "approval_sha256": "c7ce8ccc89e629b31f3e01a39a957396a1dcae0e132e07f2537f4540fce6b0e2",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-a11b7d5e3a12bdbffd98eae3.ctc.private.json": "593c76455c524c2a7cefd85b6f46d2d9b4725f982cfbafdc7532ba720d710bd2",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-current111-pass35.private.json": "907ccf2206daa1fe422086c3d3fafbefff000faa9ebc00390f974577ae1a4c0a",
      "timing-root-scoped-pass35/story-a11b7d5e3a12bdbffd98eae3.before.private.json": "50970a1fc6d7d2998cab74b19ec04413b0d0fd152f01d1447a896ab5eaf7d390"
    },
    "original_receipt": "timing-root-scoped-pass35/story-a11b7d5e3a12bdbffd98eae3.before.private.json",
    "receipt_sha256": "c2a2627f4d462dd61220f3a76d055a20b20b7dd870dc29ae63a16b0a7bbe8615"
  },
  "story-a2671f9741cc8a3f38333e5e": {
    "approval_sha256": "1ba78537ac3755706cd4609b5d21d09c480525dcfc7e6c14041657e705af9c46",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-current3-individual-caption-estimates-pass60-current59b-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/apply-contract.private.json": "fc5b647b0f8ff78934cefe2df5bf8d3dd424eb58cb61b50c1afb9c00dd392f84",
      "timing-imported3-pass60-offline/root-caption3-current59b/apply.private.py": "b6576c855587c3d22903bafb8a6b4286bd68ab35915df7f97210464c2e7bee0e",
      "timing-imported3-pass60-offline/root-caption3-current59b/proposals.private.json": "564ec735a1b11f5b434b6e8473db9a633d88d3918e36d5649670263a2fea31a7",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-a2671f9741cc8a3f38333e5e.json": "dd75ea8613a44a08d19af0270b13db8c4d6c8fbad39508bb1331ae9a3d80736c",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-reviewed-corrected.private.json": "7fa11a77976129041162547a8688b8ddfd88b10dd7b033ac51b701d1d16e601d"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-a2671f9741cc8a3f38333e5e.json",
    "receipt_sha256": "dd75ea8613a44a08d19af0270b13db8c4d6c8fbad39508bb1331ae9a3d80736c"
  },
  "story-a681e6abd96e79331d717fc1": {
    "approval_sha256": "3a2253ad5e52933ee630f8bb9fd701aec32f1caf71a7a01959dfa96b879c1759",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-five-native-waveform-timing-pass50-v1",
    "evidence_sha256": {
      "root-a681-pass45/root-approved-envelope.private.json": "910a5d28281286aaf3722e401e56ee5a03d69972c1cc20246fcf1043d60d2fce",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-a681e6abd96e79331d717fc1.json": "a7f3d325d7c3175fe2bf9766e589e50c053977c9bafe68fc154540d26fa0b279",
      "timing-remaining-wordclean49-offline/root-apply50/apply-contract.private.json": "f646ddc1ff20098b460d2a0ded3c7b4285f7e51d73aad32f8d51a18593614e3d",
      "timing-remaining-wordclean49-offline/root-apply50/apply.private.py": "e27c2a16fa9d0a5156879594a6a0599f53bdeeefdf4417fb8dbdf6e05b8c688e",
      "timing-remaining-wordclean49-offline/root-apply50/proposals.private.json": "22254385300dddf4c96d41c04a0a65fe381c8e39c21a5fc7fcf01b6989039866",
      "timing-remaining-wordclean49-offline/root-apply50/root-reviewed.private.json": "80ebab7950c142ef316e4047faa3853017cb1652047bdf13889ff6906a254752"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-a681e6abd96e79331d717fc1.json",
    "receipt_sha256": "a7f3d325d7c3175fe2bf9766e589e50c053977c9bafe68fc154540d26fa0b279"
  },
  "story-aba983bac044560e593aa644": {
    "approval_sha256": "7250c94adb48d0e596de69b76aa18eee4f864ff086a1324a77c0b47fb1e5714d",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-private-wave-root-pass45",
    "evidence_sha256": {
      "clips/story-aba983bac044560e593aa644.mp3": "cb3fe643b3a2f5959b8256a4921f4ff4ede2b5b7e8006c31df3a1e1f6ea1b192",
      "free-large-v3-current-pass38/story-aba983bac044560e593aa644.actual-free.private.json": "82f9ae209f59dcd41ca3a039928f7a88d9dc09080dfae1892e24ea8f72ccc6ac",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "profiles.private.json": "a4f48d340993d8ccab631fb1f7ad31ce0829c22aee0e1009adf891b79028367f",
      "qa-pass41-additive.private.json": "30cb6dde823401b8a69eb8a480b142f657c4486aa0c9cd43802686ce0934b742",
      "qa-pass43.private.json": "924d249fa204b598fbbe15dd14cf5063c074582ccbb9df1603b9709822912d5b",
      "timing-backlog-pass45/guarded-proposals.private.json": "70660738c33764c71c017c7594cb25cd10a41f2b8e4e03c7c93b19c4ab7d0300",
      "timing-backlog-pass45/literal-wave-review.private.json": "f918bc72fab2f78db5d595ca4bbde3c5e535a44999718bf74673926cfbc95ebb",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-aba983bac044560e593aa644.json": "ba24ed61a5eee642d3d7e5726ed4cf4447039b0eff735b6376f863bf732a2c18"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-aba983bac044560e593aa644.json",
    "receipt_sha256": "ba24ed61a5eee642d3d7e5726ed4cf4447039b0eff735b6376f863bf732a2c18"
  },
  "story-b5b553d1479cbc28308d0178": {
    "approval_sha256": "2641ca0e1c0e1d00d0a8808e1e30ec218bd0a2cb5e33eaeeb7b62ff3b633da5e",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-b5b553d1479cbc28308d0178.ctc.private.json": "1000ac4e67b75065ae673a6f84628d1e9cabad5939cc28e6548aee957f75d7da",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-current111-pass35.private.json": "907ccf2206daa1fe422086c3d3fafbefff000faa9ebc00390f974577ae1a4c0a",
      "timing-root-scoped-pass35/story-b5b553d1479cbc28308d0178.before.private.json": "b9c24595b3702b9f67e1a7201535c37f396bb7233b33d74000b90f8b6cd18087"
    },
    "original_receipt": "timing-root-scoped-pass35/story-b5b553d1479cbc28308d0178.before.private.json",
    "receipt_sha256": "6e9a24bcaf247fb8a50f3230f49ed3f2359c51b18c4b7f2d85b5ab9b1c7b0fe4"
  },
  "story-bbaf3de49f296013fde280bb": {
    "approval_sha256": "6d3adbca1cc2e5cd210655f1d572630d4aa12bdb304516cb251bba2e0ce78639",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-bbaf3de49f296013fde280bb.ctc.private.json": "a36967fad780c2bda861e725501b2203eeb70deecc3f2ecdfd0c4dcf497ae30e",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing11-pass34.private.json": "c05d049a8999204405caf590337a5897c84c5adab2b372925be76b25fb47cabd",
      "timing-root-scoped-pass35/story-bbaf3de49f296013fde280bb.before.private.json": "3f7cf9e0a20820cff13a2401cfeafaf21fe551207a1ce32a81c5a84cae454dab"
    },
    "original_receipt": "timing-root-scoped-pass35/story-bbaf3de49f296013fde280bb.before.private.json",
    "receipt_sha256": "34d04ea66b38af3777101136850c7050676871abf7ff5b5fa1a15e3082fedfe0"
  },
  "story-c1af723cbe2fd1de31f3dab8": {
    "approval_sha256": "78f677a426e76476d987e5f742a25c7b90230de0c630b99be7b1eb22a918fe5a",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-c1af723cbe2fd1de31f3dab8.ctc.private.json": "f606801936ed3ef627fe581b670618a7e43d317d996d1de227ac972577174a7a",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-c1af723cbe2fd1de31f3dab8.before.private.json": "04e8979e358f9882856938e6d493bd04d93f9d3047ca471c5b3d0260d085f760"
    },
    "original_receipt": "timing-primary-root-pass27/story-c1af723cbe2fd1de31f3dab8.before.private.json",
    "receipt_sha256": "80e3960233e7291b5de4f9ee44aaa99a53c1b13ae635b92ee29002eb7bc69500"
  },
  "story-c4f1dd6c701ed24dc1276152": {
    "approval_sha256": "c7e2acaf42f000bee5c360534461d4b1d5e1dd64f7c028dcefa0cafa1175aa0b",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-c4f1dd6c701ed24dc1276152.ctc.private.json": "03441ce3d529d6160ddea4395367ab341e922ee999bdb034bbf54c166041ff58",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-c4f1dd6c701ed24dc1276152.before.private.json": "92c72cb0dfd1db5a8c78ba6c42665b0524053c9559f61ccf210c56ae625f1413"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-c4f1dd6c701ed24dc1276152.before.private.json",
    "receipt_sha256": "9338d60b9196ab32ee28b18d11e5a6b56a932f215fac604d3c8b5bb64ee70d83"
  },
  "story-c83b8874d9d1aa88ac244abd": {
    "approval_sha256": "8a1e99e829352ab2c36c310eed39d456f752621afb49ca1fc0fce10036d3021c",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-five-native-waveform-timing-pass50-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-c83b8874d9d1aa88ac244abd.json": "5f6e2cb76c7aeb3f34762d95e76b8e0f354055c7dab785f63ba0af21890bb8fa",
      "timing-remaining-wordclean49-offline/root-apply50/apply-contract.private.json": "f646ddc1ff20098b460d2a0ded3c7b4285f7e51d73aad32f8d51a18593614e3d",
      "timing-remaining-wordclean49-offline/root-apply50/apply.private.py": "e27c2a16fa9d0a5156879594a6a0599f53bdeeefdf4417fb8dbdf6e05b8c688e",
      "timing-remaining-wordclean49-offline/root-apply50/proposals.private.json": "22254385300dddf4c96d41c04a0a65fe381c8e39c21a5fc7fcf01b6989039866",
      "timing-remaining-wordclean49-offline/root-apply50/root-reviewed.private.json": "80ebab7950c142ef316e4047faa3853017cb1652047bdf13889ff6906a254752"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-c83b8874d9d1aa88ac244abd.json",
    "receipt_sha256": "5f6e2cb76c7aeb3f34762d95e76b8e0f354055c7dab785f63ba0af21890bb8fa"
  },
  "story-c95acf547e57bf0c496d6cac": {
    "approval_sha256": "b08678c92bd24c12dfd5e06efb84f7e247840869a44fabfdcb8b3dd4f86f846f",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-c95-explicit-first-sentence-pass42",
    "evidence_sha256": {
      "clips/story-c95acf547e57bf0c496d6cac.mp3": "ea5c2054291cb60917c9b8a1d53c6939ce4b6efd1f1c0d6312f5c164081d1859",
      "ctc-current-pass34/story-c95acf547e57bf0c496d6cac.ctc.private.json": "2b9e0a92e2286dde30f85b54c6519684d28f36a67c0684e77b97fca47a42d70c",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "profiles.private.json": "a4f48d340993d8ccab631fb1f7ad31ce0829c22aee0e1009adf891b79028367f",
      "qa-pass37-additive-v2.private.json": "3e7d518e2073a7274937f98e520aae7ff2b8b2713fae38b42daca57085769862",
      "timing-c95-explicit-first-sentence-pass42/evaluation.private.json": "8b611e24a90804a7dec34ec10cb8d7fef9737876808a2584b4e09bef8b844383",
      "timing-c95-explicit-first-sentence-pass42/proposals.private.json": "98ca6ac935b085f39d9152b93d8d167f11ebeb1dfda15fdb55da4867a53849ed",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-c95acf547e57bf0c496d6cac.json": "a556fd3712062a859206636fe5498adcc6077aaa44e36ee2d5b9cc99ae647bab"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-c95acf547e57bf0c496d6cac.json",
    "receipt_sha256": "a556fd3712062a859206636fe5498adcc6077aaa44e36ee2d5b9cc99ae647bab"
  },
  "story-ca4a51dfcb8f4d4983c833ca": {
    "approval_sha256": "03bc3f657ae95af10cede0467886982bfaa0a77c65bbaa00129e45b6d804ab6f",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-root-final-pass39",
    "evidence_sha256": {
      "clips/story-ca4a51dfcb8f4d4983c833ca.mp3": "2e48980e9b059f1968dba9491e93e7c68c672a6e451c064ecb6d3ce25d913663",
      "free-large-v3-current-pass38/story-ca4a51dfcb8f4d4983c833ca.actual-free.private.json": "6ddd1e8b3ce24fa626d3f75ac03f564f14ea927880c549d4094616bba95ebc00",
      "large-v3-timing-review-pass38.private.json": "7bedc39d4b09d3b90e2489c7025b1b1691effb769aed0ef06350d3a4cb397d16",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "qa-pass37-additive-v2.private.json": "3e7d518e2073a7274937f98e520aae7ff2b8b2713fae38b42daca57085769862",
      "raw/story-ca4a51dfcb8f4d4983c833ca.receipt.json": "4a4839238cd8739eeff27688839c75359b82fc5a2a856d29d7d18b412c5cdc9e",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-ca4a51dfcb8f4d4983c833ca.json": "2ec1c66413079000a4c391d64283269a5f0ec8f684976ee4f03c046ff1ec5b9c",
      "timing-root-final-pass39/proposals.private.json": "b54e568e1e7a62f78e813831efcdc57d909749863f562ad39761657699ebec54"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-ca4a51dfcb8f4d4983c833ca.json",
    "receipt_sha256": "2ec1c66413079000a4c391d64283269a5f0ec8f684976ee4f03c046ff1ec5b9c"
  },
  "story-cd441f4cc2e84ff80bce0308": {
    "approval_sha256": "d42572d61aae68a50cdbf4d927e8e282fe7fb6e540e7810926b551e4239a1880",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1/private-root-four-residual-source-caption-estimates-pass53-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-cd441f4cc2e84ff80bce0308.full-large-dtw.private.json": "54b3c1491fcfa537965e5faeca0293fb905085336918c33c4c5eb011d4f0fc36",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-cd441f4cc2e84ff80bce0308.json": "ef10af00fd442905b22c00a435374c686cec12c76649c4b2e288f351984cdb1d",
      "timing-residual-source4-pass53/apply-contract.private.json": "c399e3e3dee12dc28d6ae413f72965a2da529b48ad4a2a00050aa124a463ade2",
      "timing-residual-source4-pass53/guard.private.py": "31423ebca7d06cb69ff964a923c3a90a236003edce30f213ccb32d444c1eedc5",
      "timing-residual-source4-pass53/proposals.private.json": "ac8e9cb01a513525ad6a784696f088523d424634bbcc302d00f750ea5e137b47",
      "timing-residual-source4-pass53/root-reviewed.private.json": "ca00ef5b4e9dbd4a81b3a119bbb0694c1aba0417c9c3cf4d2d895a5cecd7f402"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-cd441f4cc2e84ff80bce0308.json",
    "receipt_sha256": "ef10af00fd442905b22c00a435374c686cec12c76649c4b2e288f351984cdb1d"
  },
  "story-cda8ae87aec2f1c8ee0a889f": {
    "approval_sha256": "50979885807a1f93fae3bd9d6c9c61fbd951fae83543629699ca4a44dd199f1c",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-pass12/story-cda8ae87aec2f1c8ee0a889f.ctc.private.json": "9831f2bc1bd1009276dee45f71852d9d2770168643a308827a9e009700a395fb",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing3-additive-pass35.private.json": "ca31576575e4f2e998960fe018760a085abd527aef226e81c38660328c8b5423",
      "timing-root-additive3-pass35/story-cda8ae87aec2f1c8ee0a889f.before.private.json": "2228d493e20d9c8d98c7023f394d2790159f28843ada562c47790ebefe5e1420"
    },
    "original_receipt": "timing-root-additive3-pass35/story-cda8ae87aec2f1c8ee0a889f.before.private.json",
    "receipt_sha256": "d777dd6c788cfd5cce2b66f1ae6badbe8440f42b0ec98ccf7686f890541e5eb7"
  },
  "story-d179bf4fdfb8f8e3a46c115c": {
    "approval_sha256": "d1946b71518d096c18fc3960d891a240e98613f3aee73694bee20bc35342d996",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-d179bf4fdfb8f8e3a46c115c.ctc.private.json": "f70bdb9a0d2980c12a9b4759aa33f9e0208ab6a6fd4b5a598c29295f98e5d660",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing11-pass34.private.json": "c05d049a8999204405caf590337a5897c84c5adab2b372925be76b25fb47cabd",
      "timing-root-scoped-pass35/story-d179bf4fdfb8f8e3a46c115c.before.private.json": "0efacbe59ef86270c6afff97dd4bb851153c6e30b55bfa753a25d2389ea9d439"
    },
    "original_receipt": "timing-root-scoped-pass35/story-d179bf4fdfb8f8e3a46c115c.before.private.json",
    "receipt_sha256": "082457b86fbef603ebccfa67b53e976f4b1da8e7fa4266c9e9b1ece7d1086652"
  },
  "story-d2ec20c6d77b8865cc81ff39": {
    "approval_sha256": "f512af16dcfc9cf58cb9e26f6435096dcad8666fd425aecf16c1eb6d42815371",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "hihi-root-actual-QC-pass36.private.json": "bb1bd0a643babb120e20418b8c3bc8f0829e0599178caab5bceeac9c8299a64c",
      "qa-pass37.private.json": "f4782bb371161536a0e2f44f90df2c7a01d1c02bea8b4155c6d9ab2252242978",
      "timing-hihi-prefix-current-pass37.private.json": "1039d7e6391cb52b3bdb2c0407b85d6e842f12a8114c27c29376095a115921e3",
      "timing-imported3-pass60-offline/actual-full1557-checks/20261006T140242.324012Z/staged-bank/word-cues/story-d2ec20c6d77b8865cc81ff39.json": "87d1d711a5f731dc035c460402b57e2ef3dc53198d1afdb0860b8df23ea9994c",
      "timing-root-hihi-prefix-pass37/before.private.json": "62a8941260399235fa17a92ed9190c80d63c0df5f10570a00c558ce38c8fa368"
    },
    "original_receipt": "timing-imported3-pass60-offline/actual-full1557-checks/20261006T140242.324012Z/staged-bank/word-cues/story-d2ec20c6d77b8865cc81ff39.json",
    "receipt_sha256": "87d1d711a5f731dc035c460402b57e2ef3dc53198d1afdb0860b8df23ea9994c"
  },
  "story-d60e349ff32f597a6f71b9e5": {
    "approval_sha256": "011b7681a1e1f1ee8f613b111f24abf07f2720dd5248c7db9107dedc6ba3cfcc",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-full-large-scoped-timing-pass49-v1/private-root-four-residual-source-caption-estimates-pass53-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-d60e349ff32f597a6f71b9e5.full-large-dtw.private.json": "5538c70b16085adbc7de141024fea8250f247986f37d1b3f42f79b6293476823",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-d60e349ff32f597a6f71b9e5.json": "15ecf6ffce02ecece89169f765dd6c696ac9788bb4f38bd49ab4b5434bfd4feb",
      "timing-residual-source4-pass53/apply-contract.private.json": "c399e3e3dee12dc28d6ae413f72965a2da529b48ad4a2a00050aa124a463ade2",
      "timing-residual-source4-pass53/guard.private.py": "31423ebca7d06cb69ff964a923c3a90a236003edce30f213ccb32d444c1eedc5",
      "timing-residual-source4-pass53/proposals.private.json": "ac8e9cb01a513525ad6a784696f088523d424634bbcc302d00f750ea5e137b47",
      "timing-residual-source4-pass53/root-reviewed.private.json": "ca00ef5b4e9dbd4a81b3a119bbb0694c1aba0417c9c3cf4d2d895a5cecd7f402"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-d60e349ff32f597a6f71b9e5.json",
    "receipt_sha256": "15ecf6ffce02ecece89169f765dd6c696ac9788bb4f38bd49ab4b5434bfd4feb"
  },
  "story-d64c01cbba5cf5689fc9c939": {
    "approval_sha256": "7c768ad9b5fe7fc7ff63963b596d7495acf597c32f0d9c89ea2014e06745f739",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-individual-Puh-broad-caption-pass54-v1",
    "evidence_sha256": {
      "timing-d64-caption-pass53/guarded-root54/apply-contract.private.json": "e10fd077d1228c158cd103e57797dba12c90dc88124201fe84f671dea94a9581",
      "timing-d64-caption-pass53/guarded-root54/guard.private.py": "10e348989815666bf482494666ef69b99ad41c73cb2b998a5c04821e7e71aaae",
      "timing-d64-caption-pass53/guarded-root54/proposals.private.json": "2676b876742aa18ec4a8adb87fa863e87b8f3ecea4474bcbe286cfc4177ba4fe",
      "timing-d64-caption-pass53/guarded-root54/root-reviewed.private.json": "9c0d3282e42dad386e081c86c3beb8c11007178018998e7c59eae62649e1f889",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-d64c01cbba5cf5689fc9c939.json": "657a72053f32dfeadeedb307f910b9be758c96e07794732b5e506937d866d1f5"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-d64c01cbba5cf5689fc9c939.json",
    "receipt_sha256": "657a72053f32dfeadeedb307f910b9be758c96e07794732b5e506937d866d1f5"
  },
  "story-d93585d2bea7a9d6c23b34fb": {
    "approval_sha256": "1ec417091c46b0aeaa597562a3cb81ebee736b9d0f8c857ae88ce6f00a12818d",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-d93585d2bea7a9d6c23b34fb.ctc.private.json": "f6a8348bb2aa3a078f90c494c8da47dc1e2d18f5dc6bc489e5ff4d672ae741bd",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-current111-pass35.private.json": "907ccf2206daa1fe422086c3d3fafbefff000faa9ebc00390f974577ae1a4c0a",
      "timing-root-scoped-pass35/story-d93585d2bea7a9d6c23b34fb.before.private.json": "973671234d7651c04f57b5aeabac247f7656d40d512a39328ba30bd3192281aa"
    },
    "original_receipt": "timing-root-scoped-pass35/story-d93585d2bea7a9d6c23b34fb.before.private.json",
    "receipt_sha256": "a19bc4250e455dcd797e122f9f13772fdf611603e70bbccf371de450067844f4"
  },
  "story-dc25ea3dcc3d14346163d30b": {
    "approval_sha256": "8f77d3fff73bc1fcee605409c09a2b910d85ca4a6e65c21b76b20b07c8b4ff3e",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-dc25ea3dcc3d14346163d30b.ctc.private.json": "45100b7a3d8255c63a3396a88dc084b9d768b576d4de0eec2998ad2202eab85c",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-dc25ea3dcc3d14346163d30b.before.private.json": "92fff9b8d6fc873e194a6ddab35b58cc7a125e7c47ea1f3a2f7643c9451634e6"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-dc25ea3dcc3d14346163d30b.before.private.json",
    "receipt_sha256": "1b9f26c5928e95b6a69e247b6976d5fc0ac1466a8a5a07ab2026b1c6955777ae"
  },
  "story-dc8e1fd1d66a49f2e893805f": {
    "approval_sha256": "137aaa514d1ed5e0a2ed4a5225d620a9940d3d274b12e79adf13232d2de51789",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-dc8e1fd1d66a49f2e893805f.ctc.private.json": "1838a6588af17fb1e41b3c17f8abe7c3da37d6ca5239fd7c1991c39bc5fc83b3",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-current111-pass35.private.json": "907ccf2206daa1fe422086c3d3fafbefff000faa9ebc00390f974577ae1a4c0a",
      "timing-root-scoped-pass35/story-dc8e1fd1d66a49f2e893805f.before.private.json": "ad44e4a4c4c1a87bbb7eb53baee51b1d3d5721748033aace7a65ae15544e92f0"
    },
    "original_receipt": "timing-root-scoped-pass35/story-dc8e1fd1d66a49f2e893805f.before.private.json",
    "receipt_sha256": "19344fa0cc9fc47c20a394fba5f5beb21e0cfac00a16760b5fdfebb46f434d57"
  },
  "story-e1beedf74f27233cc5648144": {
    "approval_sha256": "e354e0482f75438013997f87ebf1b140cf93318727d7d36196ea8f59fffb115a",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-pass12/story-e1beedf74f27233cc5648144.ctc.private.json": "456e241240663a66c54ee22210a73addbd9462dad2417b7808ee9106acd066fc",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing11-pass34.private.json": "c05d049a8999204405caf590337a5897c84c5adab2b372925be76b25fb47cabd",
      "timing-root-scoped-pass35/story-e1beedf74f27233cc5648144.before.private.json": "f58a65b12bf2cf5c5b61a881792b57c0179f915ebda0103c35b63b67ef6b5eb9"
    },
    "original_receipt": "timing-root-scoped-pass35/story-e1beedf74f27233cc5648144.before.private.json",
    "receipt_sha256": "ecd1c2645e0d12085b01271f9895e57cd2d3a0b4a7f930a2f2c9b4fe8bc5e85a"
  },
  "story-e28187901f151c245f5a71ea": {
    "approval_sha256": "af3e7d74931c44c8b4112baa8e39f47499507620ac0a493d93168d2111f9e2ca",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-full-bank/story-e28187901f151c245f5a71ea.ctc.private.json": "4607f33ae9681aaa53701da868b1b44f4ff7495795677f29aad2b1014929f65d",
      "qa-pass26.private.json": "d4daa55dbcbcb21f5ddf0fae44a312d8fa8ce32996ffe469703de2713e69f315",
      "timing-primary-scoped-root-pass26/story-e28187901f151c245f5a71ea.before.private.json": "0c1db88c4384a9fab44ab74ce1090a7b680b5285709a432dcca69b1f9dd75305",
      "timing-review-pass26-primary-scoped-evidence.private.json": "89a8b33082442b316678929c6349b27e76190bee1435b5dd6b10f7d2dc233e58"
    },
    "original_receipt": "timing-primary-scoped-root-pass26/story-e28187901f151c245f5a71ea.before.private.json",
    "receipt_sha256": "ffba101601442b952a2bd9a4ec06d8262222ddd6371ac4dd60cb4152cb2f64b9"
  },
  "story-e3963473708b54c2ce765596": {
    "approval_sha256": "37a05e51054fc950e49f1080c4b82aba1608ad85ee686578076c23ebcbcc1441",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-missing-pass26/primary/story-e3963473708b54c2ce765596.ctc.private.json": "2ac07da85e8caa51db6730c6d2c3e1d27a4c89f1bed8169b9835688b73e38fc0",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing11-pass34.private.json": "c05d049a8999204405caf590337a5897c84c5adab2b372925be76b25fb47cabd",
      "timing-root-scoped-pass35/story-e3963473708b54c2ce765596.before.private.json": "acaa4ed0823e761505336ab74c0ad65677bbc0f02353ad2b54f7e22f6a04385c"
    },
    "original_receipt": "timing-root-scoped-pass35/story-e3963473708b54c2ce765596.before.private.json",
    "receipt_sha256": "d32d07b1ee5e15a270cb891e42e78759a2883b6386e63a3912b67dc5c41737ab"
  },
  "story-e8279fc19ea0421d15120f1f": {
    "approval_sha256": "78c23186f7c9f2c7a3d4f605bf368d84c7e1c8cda13f52d457dc1e3fb7848fe8",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-current3-individual-caption-estimates-pass60-current59b-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/apply-contract.private.json": "fc5b647b0f8ff78934cefe2df5bf8d3dd424eb58cb61b50c1afb9c00dd392f84",
      "timing-imported3-pass60-offline/root-caption3-current59b/apply.private.py": "b6576c855587c3d22903bafb8a6b4286bd68ab35915df7f97210464c2e7bee0e",
      "timing-imported3-pass60-offline/root-caption3-current59b/proposals.private.json": "564ec735a1b11f5b434b6e8473db9a633d88d3918e36d5649670263a2fea31a7",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-e8279fc19ea0421d15120f1f.json": "ac57ced8ae90ce37ffbfba0937274ff1fea1a56926ec25e229b1aa67b3b4bba9",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-reviewed-corrected.private.json": "7fa11a77976129041162547a8688b8ddfd88b10dd7b033ac51b701d1d16e601d"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-e8279fc19ea0421d15120f1f.json",
    "receipt_sha256": "ac57ced8ae90ce37ffbfba0937274ff1fea1a56926ec25e229b1aa67b3b4bba9"
  },
  "story-e836fbc7409f7f2e20851684": {
    "approval_sha256": "ab5cb19b7f699a71d50b12b089cfd67c0449181f4a0d58ccf48ced1b44f2a4a9",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-e836fbc7409f7f2e20851684.ctc.private.json": "fc0fbc6398ffb3c9de8231f3b55ec2be7b45648141c8f187754acc5f294a5272",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-e836fbc7409f7f2e20851684.before.private.json": "914443fa9cb50fb9134d9313c3f847dde8b012a54478ca2149a6b985ef6a977d"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-e836fbc7409f7f2e20851684.before.private.json",
    "receipt_sha256": "17aa395f46e07122cdffd43deb78834339b7d908c56dffcc6c3d946c359cd71d"
  },
  "story-e8a2731b4774a459edcede35": {
    "approval_sha256": "c66b25f92275dbb4be151f086706bca362db716a55b71cdadb8b3a490611fc28",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-pass12/story-e8a2731b4774a459edcede35.ctc.private.json": "0b2084e896d4226fe8f5ccf8468589773cba37e5282ae48f6f181f8a2fb8febf",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing3-additive-pass35.private.json": "ca31576575e4f2e998960fe018760a085abd527aef226e81c38660328c8b5423",
      "timing-root-additive3-pass35/story-e8a2731b4774a459edcede35.before.private.json": "52026a9d685d633f22af6460e5afb128b2ecefdda4facb928599303c4a065fa0"
    },
    "original_receipt": "timing-root-additive3-pass35/story-e8a2731b4774a459edcede35.before.private.json",
    "receipt_sha256": "fc14802a611e3ab708deb820e407953f651166c0909629e54231482758c88f32"
  },
  "story-ea1be5e83c00ede11c4a28db": {
    "approval_sha256": "0d0d0d657a5bd61ea7b4252f7b0504ce94f228dbfe2587129171d1991a739f61",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-ea1be5e83c00ede11c4a28db.ctc.private.json": "35f9d67e9b768e0f3870e9957cc4c2a1e5a1b4389cafe3a0d1fed67bf2d9fc71",
      "qa-pass35-additive.private.json": "bc4a26e4e1598ce62ba51f80c35c8d88e317b07a742ad5682573f30a8aab9fc0",
      "qa-pass36.private.json": "a6f4ba70bb93cbc297965c19735ae6ea573e6aa42c819592a8099d90a78a8f79",
      "timing-adjacent-current-pass37.private.json": "4baab7b3908720d2f847d6b6605e2f2f98636eceecab5ce27b41fb5d9afe3a6b",
      "timing-root-adjacent9-pass37/story-ea1be5e83c00ede11c4a28db.before.private.json": "948fa534a184920af6b343e98d0c62327e2af3adc9328a99456c49b36c63d1e6"
    },
    "original_receipt": "timing-root-adjacent9-pass37/story-ea1be5e83c00ede11c4a28db.before.private.json",
    "receipt_sha256": "9046ef38977d6704e7853424e93d1f0b4eac24fea281808eeac23af1b404ee00"
  },
  "story-f1cd46d6fac34050964ff1d7": {
    "approval_sha256": "c65c0e5f6cf55ea8751cc7dc0d83ee7ba7b4a8a0108e67e42324292b84800602",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-current-pass34/story-f1cd46d6fac34050964ff1d7.ctc.private.json": "03bdc471836628b438a4771da7a1c235b5ea544f48bd40ad6276f2b51c116857",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-current111-pass35.private.json": "907ccf2206daa1fe422086c3d3fafbefff000faa9ebc00390f974577ae1a4c0a",
      "timing-root-scoped-pass35/story-f1cd46d6fac34050964ff1d7.before.private.json": "f0d97acec38e410cff5d1ebb89cb8e963d77f06280944adb8487585d5814395e"
    },
    "original_receipt": "timing-root-scoped-pass35/story-f1cd46d6fac34050964ff1d7.before.private.json",
    "receipt_sha256": "3a29f73f3086b3ad25cc5b73a114ed892d737ff1974b625578aeb18df991a54c"
  },
  "story-f3a9c583fc57ecaaa305726e": {
    "approval_sha256": "76a29dafcb2017292c22fe3e81b494f2bab8105e202f626b1d8a2c02ac684b89",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-two-scoped-secondary-timing-pass46-v1/private-root-full-large-scoped-timing-pass49-v1",
    "evidence_sha256": {
      "timing-full-large-dtw-pass45/guarded-apply49/apply-contract.private.json": "a1af332b7b214c8457df65b1ef2579a6b49cc5c8afde0de89ec338bb4c0632d1",
      "timing-full-large-dtw-pass45/guarded-apply49/guarded-apply.private.py": "56446151e55331c499be2f7c6594ce66cd5580deef1723a486fc2b4f124184bb",
      "timing-full-large-dtw-pass45/guarded-apply49/proposals.private.json": "68497c956d50a08b8c76c8f10db0f5c8389ed1b900121eccbcc24e736ffcd72d",
      "timing-full-large-dtw-pass45/guarded-apply49/root-reviewed.private.json": "969ea4e6b8037b34a3c658189f5c81727dad51fd9a3654942825d7e6a3f7d160",
      "timing-full-large-dtw-pass45/receipts/story-f3a9c583fc57ecaaa305726e.full-large-dtw.private.json": "2644419f26cdaae3b0dc57546208be45bb8b7cf0c0eddcee436016ca47c55077",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-f3a9c583fc57ecaaa305726e.json": "434f960d4a62471ac4e213be89b59dfefc6580cd1dd2acf20d5aa7778d211239",
      "timing-numeral-hyphen-pass44/root-review-proposals/proposals.private.json": "b5da73aff181510f077935d7b4383e6222668a59cdf5e6f9539606ca453db675",
      "timing-numeral-hyphen-pass44/story-f3a9c583fc57ecaaa305726e.projection.ctc.private.json": "c5cfa4280ae27f5c1002c5ca5a87d2b7967cbc75df8e37ebd2e53a00909e99d1",
      "timing-numeral-hyphen-pass46-root-apply/proposals.private.json": "b5da73aff181510f077935d7b4383e6222668a59cdf5e6f9539606ca453db675"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-f3a9c583fc57ecaaa305726e.json",
    "receipt_sha256": "434f960d4a62471ac4e213be89b59dfefc6580cd1dd2acf20d5aa7778d211239"
  },
  "story-f5f44c94534bc777e915aa44": {
    "approval_sha256": "6ddfe2842209250d823bd183b00a887bf09bbc284a83ae1ba12381c98d7b7ba6",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/private-root-current3-individual-caption-estimates-pass60-current59b-v1",
    "evidence_sha256": {
      "timing-imported3-pass60-offline/root-caption3-current59b/apply-contract.private.json": "fc5b647b0f8ff78934cefe2df5bf8d3dd424eb58cb61b50c1afb9c00dd392f84",
      "timing-imported3-pass60-offline/root-caption3-current59b/apply.private.py": "b6576c855587c3d22903bafb8a6b4286bd68ab35915df7f97210464c2e7bee0e",
      "timing-imported3-pass60-offline/root-caption3-current59b/proposals.private.json": "564ec735a1b11f5b434b6e8473db9a633d88d3918e36d5649670263a2fea31a7",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-f5f44c94534bc777e915aa44.json": "445a7637327420cf73e6bd8d0a64a47134dceeb65a5a4b27597aca2490675033",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-reviewed-corrected.private.json": "7fa11a77976129041162547a8688b8ddfd88b10dd7b033ac51b701d1d16e601d"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-f5f44c94534bc777e915aa44.json",
    "receipt_sha256": "445a7637327420cf73e6bd8d0a64a47134dceeb65a5a4b27597aca2490675033"
  },
  "story-f7a4bf001b972e5224666876": {
    "approval_sha256": "624c2890f391a433f7a64d9f0fbcb7155465741d3bf2e0f3465276b51789196e",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1/timing-root-final-pass39",
    "evidence_sha256": {
      "clips/story-f7a4bf001b972e5224666876.mp3": "4c8d903a029db88e82114be26888393066bdbb09beff479ed3bda07742e32def",
      "free-large-v3-current-pass38/story-f7a4bf001b972e5224666876.actual-free.private.json": "d17e5ac87fa158a9e3739a383e5a87b5afcfdbe69609b02ce16b5602fb1c3c80",
      "large-v3-timing-review-pass38.private.json": "7bedc39d4b09d3b90e2489c7025b1b1691effb769aed0ef06350d3a4cb397d16",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "lines.private.json": "18563668a9c3942faf72a68184199db72b653b6976eb0d9350a77aa1198f1a7b",
      "qa-pass37-additive-v2.private.json": "3e7d518e2073a7274937f98e520aae7ff2b8b2713fae38b42daca57085769862",
      "raw/story-f7a4bf001b972e5224666876.receipt.json": "0b16f0eecf3acf3fd3f21f903397eadb9aa10eaa168099ace70cf45a49ed988c",
      "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-f7a4bf001b972e5224666876.json": "ca603734ac33761d66fce453e0ba09240f9deb5b89d61ac2d8dd26264afa1005",
      "timing-root-final-pass39/proposals.private.json": "b54e568e1e7a62f78e813831efcdc57d909749863f562ad39761657699ebec54"
    },
    "original_receipt": "timing-imported3-pass60-offline/root-caption3-current59b/root-apply-backups/20261006T144944.836296Z/staged-bank/word-cues/story-f7a4bf001b972e5224666876.json",
    "receipt_sha256": "ca603734ac33761d66fce453e0ba09240f9deb5b89d61ac2d8dd26264afa1005"
  },
  "story-fc5bdb5b60375f969e4242af": {
    "approval_sha256": "36140336e81ffc4545f1b6d3c10c422d024f8107ee2d90adb8e1cdb2d956107a",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-full-bank/story-fc5bdb5b60375f969e4242af.ctc.private.json": "89b96475d46bd3df4041181675a259742bea9d12adbce17991a549cbac81cbd3",
      "lexical-vetoes-pass27.private.json": "cece2acaaf224e9d3a378b986762e5c9e78df468543016f792119b04a955cf07",
      "qa-pass33-additive.private.json": "5da235f2a888ae64e776bb3558a58d702f0d949686b29cf732b4c88f61b6d168",
      "timing-existing11-pass34.private.json": "c05d049a8999204405caf590337a5897c84c5adab2b372925be76b25fb47cabd",
      "timing-root-scoped-pass35/story-fc5bdb5b60375f969e4242af.before.private.json": "498fc8f130efe37e6e58a69df16a356e052071704e1835fca0673fae199cfbd6"
    },
    "original_receipt": "timing-root-scoped-pass35/story-fc5bdb5b60375f969e4242af.before.private.json",
    "receipt_sha256": "194ae22725080908438761a3acfef1603ec252c930a83459d7fd0e93a3f581aa"
  },
  "story-fc9a72ad03df00b06a70302c": {
    "approval_sha256": "4791b9f99dda6a940cf40f61aca084f9513b15d5077cee28dbaf4584f91e6640",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-full-bank/story-fc9a72ad03df00b06a70302c.ctc.private.json": "20e8daebedf3a371acb0f13946a3288ba5a58f91409a7efd8733294922ac9977",
      "qa-pass26.private.json": "d4daa55dbcbcb21f5ddf0fae44a312d8fa8ce32996ffe469703de2713e69f315",
      "timing-primary-scoped-root-pass26/story-fc9a72ad03df00b06a70302c.before.private.json": "5991da88494e58232acf415c8cc0a04c5a9c13afbe108fb134c2dd6a89b3ce13",
      "timing-review-pass26-primary-scoped-evidence.private.json": "89a8b33082442b316678929c6349b27e76190bee1435b5dd6b10f7d2dc233e58"
    },
    "original_receipt": "timing-primary-scoped-root-pass26/story-fc9a72ad03df00b06a70302c.before.private.json",
    "receipt_sha256": "0f381b81f18db5a5bc5afd458d552c38d57d06abb359b65f6fac78a3b3d64383"
  },
  "story-fd8e7bb9ae9dac2020b8edd3": {
    "approval_sha256": "156b8685730cbac9b95b6058e29f14528afafe656967d5ba48c6477d39b5bb4b",
    "engine": "mlx-whisper-authored-dtw-v1/story-waveform-v1",
    "evidence_sha256": {
      "ctc-align/story-fd8e7bb9ae9dac2020b8edd3.ctc.private.json": "3be41f4d025ceefc63154df45bbe4ef2d39bee4409ddc8a08eb28b3de1a2761b",
      "qa-pass27.private.json": "f25378e38c7520158206ed57be5759ddddc020da5c12038659807434cff7fea8",
      "timing-primary-flagged-only-pass27.private.json": "2891a76b771b26b5a3897436360a26194edecdbd74808987f8f1480766fd4b03",
      "timing-primary-root-pass27/prior-alignment.private.json": "5be534a4fd5e697b8be12ac03f73453763dc64a99314d733243d8ca7cbcc8a33",
      "timing-primary-root-pass27/story-fd8e7bb9ae9dac2020b8edd3.before.private.json": "10227c048fc12d28bf5d9158ad483b39970c7d4792f7445ab9423b485e05059d"
    },
    "original_receipt": "timing-primary-root-pass27/story-fd8e7bb9ae9dac2020b8edd3.before.private.json",
    "receipt_sha256": "642f6711b37400362f11b9e61916f008d31e3a496811ef03adf949dfb3cb1197"
  }
}
''')


def supports_run(run, count):
    return (count == 1557 and Path(run).resolve() == ORIGINAL_RUN
            and digest(ORIGINAL_RUN/'lines.private.json') == FROZEN_SHA)


def is_original_recording(clip,root=None):
    """Historical identity, independent of a removable public policy marker."""
    manifest=ORIGINAL_RUN/'lines.private.json'
    if not manifest.is_file():
        current=Path(root)/'docs/voice-production/story-lines.json' if root is not None else None
        require(current is None or not current.is_file() or digest(current)!=CURRENT_SHA,
                'Exact current1576 historical recording lookup unavailable')
        return False
    require(digest(manifest)==FROZEN_SHA,'Historical original recording identities changed')
    return clip.get('id') in {row['id'] for row in read(manifest)['lines']}


def _protected():
    require(all(digest(Path(__file__).with_name(name)) == expected for name,expected in PROTECTED.items()),
            'Protected original publisher/QA/cue drivers changed')


def source_contract(row):
    return sha(strict.canonical({k:row.get(k) for k in (*SOURCE_FIELDS,'mood','runtime_keys')}).encode())


def _identity_without_mood(old, new, old_profiles, profiles):
    require(all(old.get(key) == new.get(key) for key in SOURCE_FIELDS),
            'Historical/current recording identity or direction differs')
    old_voice = old_profiles.get('speakers',{}).get(old['speaker'],{}).get('google_voice')
    voice = profiles.get('speakers',{}).get(new['speaker'],{}).get('google_voice')
    require(old_voice == voice and isinstance(voice,str) and voice, 'Historical/current fixed voice differs')
    before,after = old.get('runtime_keys'),new.get('runtime_keys')
    require(isinstance(before,list) and isinstance(after,list) and before and len(before)==len(after),
            'Historical/current runtime route cardinality differs')
    require(all({k:v for k,v in a.items() if k!='mood'} == {k:v for k,v in b.items() if k!='mood'}
                for a,b in zip(before,after)), 'Historical/current route body differs')
    return voice


def closure_proposal(run, current, inventory_path, profiles):
    """Deterministic evidence, deliberately unapproved until individual Root review."""
    require(supports_run(run,1557), 'Only the fixed historical full bank may be closed')
    require(digest(inventory_path)==CURRENT_SHA and len(current.get('lines',[]))==1576,
            'Only the measured complete rewritten inventory may be rebound')
    profiles_path=strict.source_root(Path(inventory_path))/'docs/voice-production/story-speakers.json'
    require(read(profiles_path)==profiles,'Current complete fixed-cast profile differs')
    frozen=read(ORIGINAL_RUN/'lines.private.json'); old={r['id']:r for r in frozen['lines']}
    new={r['id']:r for r in current['lines']}; shared=set(old)&set(new); absent=set(old)-set(new)
    require(len(old)==1557 and len(new)==1576 and len(shared)==1089 and len(absent)==468,
            'Historical/current source closure census differs')
    old_profiles=read(ORIGINAL_RUN/'profiles.private.json'); snapshot=read(ORIGINAL_RUN/'source-snapshot.private.json')
    require(frozen.get('aliases')==current.get('aliases') and frozen.get('scoped_aliases')==current.get('scoped_aliases')
            and frozen.get('runtime_speaker_overrides')==current.get('runtime_speaker_overrides'),
            'Historical/current alias or speaker mapping differs')
    require(current.get('scene_players')=={**frozen.get('scene_players',{}),'weiterreise':'lia'},
            'Only the measured added weiterreise player mapping is allowed')
    removed=[]; mood=[]; changed_routes=0
    for ident in sorted(absent):
        row=old[ident]
        require(row.get('sources'), 'Historical removed recording lacks archived Source spans')
        bindings={source['file']:snapshot[source['file']]['sha256'] for source in row['sources']}
        removed.append({'id':ident,'frozen_source_row_sha256':sha(strict.canonical(row).encode()),
                        'archived_source_files_sha256':bindings,'reason':None})
    for ident in sorted(shared):
        row,incoming=old[ident],new[ident]; voice=_identity_without_mood(row,incoming,old_profiles,profiles)
        if row.get('mood')==incoming.get('mood') and row['runtime_keys']==incoming['runtime_keys']: continue
        require(row.get('kind')=='say' and row.get('speaker')=='lia' and row.get('mood')=='neutral',
                'Only individually measured neutral Lia say wrappers may change mood')
        for a,b in zip(row['runtime_keys'],incoming['runtime_keys']):
            if a.get('mood')!=b.get('mood'):
                require(a.get('mood')=='neutral' and isinstance(b.get('mood'),str) and b['mood'],
                        'Historical mood correction differs from measured neutral wrapper')
                changed_routes+=1
        mood.append({'id':ident,'frozen_source_row_sha256':sha(strict.canonical(row).encode()),
                     'current_source_row_sha256':sha(strict.canonical(incoming).encode()),
                     'audio_sha256':digest(contained(ORIGINAL_RUN,'clips/'+ident+'.mp3')),
                     'voice':voice,'runtime_keys_before':row['runtime_keys'],
                     'runtime_keys_after':incoming['runtime_keys'],'reason':None})
    require(len(mood)==37 and changed_routes==39, 'Exact measured 37 wrappers/39 mood routes required')
    return {'status':'root_review_required','reviewed_by':None,'reason':None,
            'frozen_manifest_sha256':FROZEN_SHA,'current_inventory_sha256':CURRENT_SHA,
            'profiles_sha256':digest(profiles_path),
            'source_files_sha256':current['source_hashes'],'shared_ids':sorted(shared),
            'absent_original_ids':removed,'mood_rebindings':mood}


def validate_closure(path, run, current, inventory_path, profiles, root):
    path=Path(path).resolve()
    require(path.is_relative_to(Path(root).resolve()/'output/audio/story-voice') and not path.is_symlink(),
            'Original source closure must remain inside the current private workspace')
    actual=read(path); expected=closure_proposal(run,current,inventory_path,profiles)
    require(isinstance(actual,dict) and set(actual)==set(expected)
            and actual.get('status')==APPROVED_CLOSURE
            and isinstance(actual.get('reviewed_by'),str) and actual['reviewed_by'].casefold().startswith('root ')
            and isinstance(actual.get('reason'),str) and len(actual['reason'].strip())>=20,
            'Explicit full Original1557 Root source closure required')
    for field in ('absent_original_ids','mood_rebindings'):
        rows=actual.get(field); wanted=expected[field]
        require(isinstance(rows,list) and len(rows)==len(wanted)
                and all(isinstance(row,dict) and set(row)==set(target)
                        and isinstance(row.get('reason'),str) and len(row['reason'].strip())>=20
                        and {k:v for k,v in row.items() if k!='reason'}=={k:v for k,v in target.items() if k!='reason'}
                        for row,target in zip(rows,wanted)),
                'Individual original absence/mood Source proof differs: '+field)
    ignored={'status','reviewed_by','reason','absent_original_ids','mood_rebindings'}
    require(all(actual[key]==value for key,value in expected.items() if key not in ignored),
            'Full original Source closure hashes/census differ')
    return actual


def _archive_basis(receipt):
    ignored={'engine_version','word_cues','cues_sha256','original_DTW_word_cues'}
    return {key:value for key,value in receipt.items() if key not in ignored and not key.startswith('root_')}


def _historical_evidence(run, receipt, expected, cache):
    pin=HISTORICAL_PRIVATE_PINS.get(receipt['id'])
    require(pin is not None and receipt.get('engine_version')==pin['engine']
            and digest(contained(run,'word-cues/'+receipt['id']+'.json'))==pin['receipt_sha256'],
            'Unknown or changed historical Root caption/timing adoption')
    approval_path=contained(run,'word-cues/qualifications.private.json')
    approval=read(approval_path).get('approvals',{}).get(receipt['id'],{})
    require(sha(strict.canonical(approval).encode())==pin['approval_sha256']
            and word_driver.adjudicated(receipt,approval), 'Historical Root qualification differs')
    files=[approval_path]
    for name,wanted in pin['evidence_sha256'].items():
        path=contained(run,name); key=str(path)
        if key not in cache:cache[key]=digest(path)
        require(cache[key]==wanted, 'Historical timing evidence changed: '+name)
        files.append(path)
    original=contained(run,pin['original_receipt']); old=read(original)
    require(_archive_basis(old)==_archive_basis(receipt), 'Historical original raw receipt/details/flags changed')
    require(old.get('id')==receipt['id'] and all(old.get(key)==value for key,value in expected.items()
            if key!='engine_version'), 'Historical original Source/audio binding differs')
    # These paths originate in the byte-pinned historical receipt. No user-
    # supplied external path is accepted. Actual local model bytes remain bound.
    def models(value):
        if isinstance(value,dict):
            table=value.get('actual_file_sha256')
            if isinstance(table,dict):
                for name,wanted in table.items():
                    path=Path(name)
                    require(path.is_relative_to(Path('/Users/logge/Documents/Projects/SelantisRPG/.venv-transcribe/models/whisper-large-v3')),
                            'Historical full-large model path escaped its fixed actual model')
                    key=str(path)
                    if key not in cache:cache[key]=digest(path)
                    require(cache[key]==wanted, 'Historical actual full-large model bytes changed')
                    files.append(path)
            for child in value.values():models(child)
        elif isinstance(value,list):
            for child in value:models(child)
    models(receipt)
    return files,original


def _ctc_evidence(run, receipt, expected, provenance_cache=None):
    # Partial/vocal adoption has separate semantics and is never this policy.
    require(receipt.get('engine_version') in {
        ALIGNMENT_ENGINE+'/story-CTC-private-adoption-v1',
        ALIGNMENT_ENGINE+'/story-secondary-CTC-private-adoption-v1'},
        'Unsupported rewrite timing adoption')
    approvals_path = contained(run, 'word-cues/qualifications.private.json')
    approval = read(approvals_path).get('approvals', {}).get(receipt['id'], {})
    require(word_driver.qualified_CTC_cache(receipt, expected, approval, Path(run), provenance_cache),
            'Adopted rewrite cue receipt provenance is invalid')
    adoption = receipt['CTC_adoption']
    qa_hash = adoption.get('qa_report_sha256')
    require(qa_hash == approval.get('qa_report_sha256'),
            'Adopted CTC original QA binding differs')
    qa_path = next((contained(run, path.name) for path in Path(run).glob('*qa*.json')
                    if digest(contained(run,path.name)) == qa_hash), None)
    require(qa_path is not None, 'Original adopted CTC QA report unavailable')
    prior_qa = read(qa_path)
    prior_take = next((take for take in prior_qa.get('takes', []) if take.get('id') == receipt['id']), {})
    require(prior_qa.get('manifest_sha256') == expected['source_manifest_sha256']
            and prior_qa.get('clip_sha256', {}).get(receipt['id']) == expected['audio_sha256']
            and prior_take.get('text_sha256') == expected['text_sha256'],
            'Original adopted CTC QA source/audio differs')
    secondary = 'secondary-CTC' in receipt['engine_version']
    suffix = '.secondary-ctc.private.json' if secondary else '.ctc.private.json'
    candidates = [contained(run, str(path.relative_to(run)))
                  for path in Path(run).glob('ctc*/'+receipt['id']+suffix)]
    actual = next((path for path in candidates if digest(path) == adoption['ctc_receipt_sha256']), None)
    require(actual is not None, 'Original adopted CTC receipt unavailable')
    ctc = read(actual); ctc_seconds = ctc.get('alignment', {}).get('decoded_seconds')
    require(ctc.get('id') == receipt['id'] and isinstance(ctc.get('text'), str)
            and acoustic.normalized_text(ctc['text']) == receipt['text']
            and type(ctc_seconds) in (int,float) and math.isfinite(ctc_seconds)
            and ctc_seconds > 0 and abs(ctc_seconds-receipt['decoded_seconds']) <= .05,
            'Original adopted CTC identity/body/duration differs')
    changed = {'engine_version', 'word_cues', 'cues_sha256', 'CTC_adoption', 'original_DTW_word_cues'}
    archive = None
    for path in Path(run).glob('word-cues/adoption-archive/*/'+receipt['id']+'.json'):
        path = contained(run, str(path.relative_to(run))); original = read(path)
        if (original.get('engine_version') == ALIGNMENT_ENGINE
                and original.get('word_cues') == receipt.get('original_DTW_word_cues')
                and original.get('cues_sha256') == acoustic.cue_sha(original.get('word_cues', []))
                and {key:value for key,value in original.items() if key not in changed}
                == {key:value for key,value in receipt.items() if key not in changed}):
            archive = path; break
    require(archive is not None, 'Original DTW receipt/details archive differs or is missing')
    line = next((row for row in read(Path(run)/'lines.private.json')['lines'] if row['id'] == receipt['id']), None)
    require(line is not None and sha(line['text'].encode()) == expected['text_sha256'],
            'Original adopted CTC authored Source differs')
    # Cache validation establishes provenance, not technical acceptance. Repeat
    # the original complete review against its genuine prior QA and preserved
    # DTW receipt; do not trust bare variant_positions or fabricated approval.
    if secondary:
        import story_voice_secondary_ctc as ctc_driver
        import story_voice_secondary_ctc_review as review_driver
        proposal = review_driver.review(line,expected['audio_sha256'],expected['source_manifest_sha256'],
                                        prior_qa,ctc,read(archive),adoption['binding']['model'])
    else:
        import story_voice_ctc_align as ctc_driver
        import story_voice_ctc_review as review_driver
        positions={}; variant_files=[]
        if adoption.get('variant_exceptions'):
            require(receipt['id'] in {'story-1a3ec460d2df1eb3a99130d3','story-b8f6e9d22a0497790fd04ba8',
                                      'story-02771fd8c0d413b80b8a8ea9'}, 'Unknown historical named spelling scope')
            import story_voice_qa as qa_driver
            word_path=contained(run,'word-adjudications.private.json'); word_approval=read(word_path).get(receipt['id'],{})
            actual_record=None; record_path=None
            for candidate in Path(run).glob('independent-google-asr/'+receipt['id']+'*.json'):
                record=read(candidate)
                if qa_driver.independent_review(line,expected['audio_sha256'],'',{receipt['id']:record},
                                                 {receipt['id']:word_approval}):
                    actual_record,record_path=record,candidate;break
            require(actual_record is not None,'Historical individual named spelling full-audio proof missing')
            positions=review_driver.internal_variant_positions(line,expected['audio_sha256'],word_approval,actual_record)
            require(positions, 'Historical named spelling actual character scope missing')
            variant_files=[word_path,record_path]
        proposal = review_driver.review(line,expected['audio_sha256'],expected['source_manifest_sha256'],
                                        prior_qa,ctc,read(archive),digest(Path(ctc_driver.__file__)),positions)
    require(proposal.get('status') in {'supported','supported_variant_internal_only'}
            and proposal.get('proposed_cues') == receipt['word_cues']
            and proposal.get('variant_exceptions',[])==adoption.get('variant_exceptions',[])==approval.get('variant_exceptions',[]),
            'Original technical CTC review rejected: '+str(proposal.get('reason','unsupported variant scope')))
    # The historical TTS bank's CTC extraction and later clean word review
    # deliberately used different complete QA snapshots. Bind both real files.
    binding_hash = adoption['binding'].get('qa_report_sha256')
    extraction_qa = next((path for path in Path(run).glob('*qa*.json') if digest(path)==binding_hash),None)
    require(extraction_qa is not None, 'Original CTC extraction QA unavailable')
    extraction = read(extraction_qa)
    extraction_take = next((take for take in extraction.get('takes',[]) if take.get('id')==receipt['id']),{})
    require(extraction.get('manifest_sha256')==expected['source_manifest_sha256']
            and extraction.get('clip_sha256',{}).get(receipt['id'])==expected['audio_sha256']
            and extraction_take.get('text_sha256')==expected['text_sha256'],
            'Original CTC extraction QA Source/audio changed')
    model = adoption['binding']['model']
    model_files = [Path(model['local_directory'])/name for name in model['file_sha256']]
    driver_files = [Path(ctc_driver.__file__), Path(review_driver.__file__)]
    if secondary: driver_files.append(Path(ctc_driver.parent.__file__))
    return [approvals_path, actual, archive, qa_path, extraction_qa, *driver_files, *model_files,
            *(variant_files if not secondary else [])]


def _adoption_evidence(run,receipt,expected,cache):
    engine=receipt.get('engine_version')
    if engine in {ALIGNMENT_ENGINE+'/story-CTC-private-adoption-v1',
                  ALIGNMENT_ENGINE+'/story-secondary-CTC-private-adoption-v1'}:
        files=_ctc_evidence(run,receipt,expected,cache)
        return files,files[2]
    if engine in {ALIGNMENT_ENGINE+'/story-partial-dual-CTC-private-adoption-v1',
                  ALIGNMENT_ENGINE+'/single-root-qualified-scream-waveform-v1'}:
        approval_path=contained(run,'word-cues/qualifications.private.json')
        approval=read(approval_path).get('approvals',{}).get(receipt['id'],{})
        require(word_driver.qualified_CTC_cache(receipt,expected,approval,run,cache),
                'Historical partial CTC/vocal adoption does not repeat its original actual proof')
        adoption=receipt.get('Partial_CTC_adoption') or receipt.get('Vocal_event_adoption')
        files=[approval_path]
        if 'input_hashes' in adoption:
            files.extend(Path(name) for name in adoption['input_hashes'])
            original=Path(adoption['original_receipt_archive'])
        else:
            original=contained(run,adoption['archive_file'])
            files.extend([original,contained(run,adoption['prior_qualifications_file'])])
            files.extend(contained(run,item['file']) for item in adoption['proposal']['binding']['proof_files'].values())
        require(original.resolve().is_relative_to(run), 'Historical adopted original archive escaped fixed run')
        return files,original
    return _historical_evidence(run,receipt,expected,cache)


def _bound_receipt(run,line,entry,seconds,cache=None):
    cache=cache if cache is not None else _VALIDATION_CACHE.get()
    cache=cache if cache is not None else {}; path=contained(run,'word-cues/'+line['id']+'.json');receipt=read(path)
    expected={'audio_sha256':digest(contained(run,'clips/'+line['id']+'.mp3')),
              'text_sha256':sha(line['text'].encode()),'source_manifest_sha256':FROZEN_SHA,'engine_version':ALIGNMENT_ENGINE}
    require(receipt.get('id')==line['id'] and receipt.get('text')==acoustic.normalized_text(line['text'])
            and all(receipt.get(k)==v for k,v in expected.items() if k!='engine_version'),
            'Historical actual receipt Source/audio binding differs')
    if receipt.get('engine_version')!=ALIGNMENT_ENGINE or any(k.startswith('root_') for k in receipt):
        _adoption_evidence(run,receipt,expected,cache)
    duration=receipt.get('decoded_seconds')
    require(type(duration) in (int,float) and math.isfinite(duration) and duration>0 and abs(duration-seconds)<=.05,
            'Historical actual receipt duration differs')
    tokens=acoustic.normalized_text(line['text']).split(); details=receipt.get('words');cues=receipt.get('word_cues')
    require(isinstance(details,list) and isinstance(cues,list) and len(tokens)==len(details)==len(cues)==len(entry.get('words',[]))
            and [word.get('word') for word in details]==tokens, 'Historical actual receipt full word coverage differs')
    for token,detail,cue,word in zip(tokens,details,cues,entry['words']):
        require(type(detail.get('spoken')) is bool and detail['spoken']==any(char.isalnum() for char in token)
                and cue=={'start':word.get('start'),'end':word.get('end')}
                and (receipt.get('engine_version')!=ALIGNMENT_ENGINE or any(k.startswith('root_') for k in receipt) or
                     (detail.get('start')==word.get('start') and detail.get('end')==word.get('end'))),
                'Historical receipt spoken token classification or measured interval differs')
    require(receipt.get('cues_sha256')==entry.get('cues_sha256')==acoustic.cue_sha(cues),
            'Historical receipt actual cue hash differs')
    return receipt


def _valid_interval(run,line,entry,word,previous,seconds):
    start,end=word.get('start'),word.get('end')
    if not all(type(value) in (int,float) and math.isfinite(value) for value in (start,end)):
        return False
    if not 0<=previous<=start<=end<=seconds+.001:return False
    if start<end:return True
    token=word['word']
    if not token or not all(unicodedata.category(c).startswith('P') for c in token) or start!=end:
        return False
    if end!=previous:
        if line.get('id')!=SOURCE38 or token!='…' or start!=7.18 or previous!=6.6625:
            return False
        index=next(i for i,item in enumerate(entry['words']) if item is word)
        if index!=6 or entry['words'][7].get('start')!=7.7425:return False
        _source38_pause_evidence(Path(run),line,entry)
        return True
    receipt=_bound_receipt(run,line,entry,seconds)
    index=next(i for i,item in enumerate(entry['words']) if item is word)
    return receipt['words'][index]['spoken'] is False


def _source38_pause_evidence(run,line,entry=None):
    require(supports_run(run,1557) and line['id']==SOURCE38,'Only exact Source38 retained visual pause point')
    proof_path=contained(run,SOURCE38_PROOF)
    require(digest(proof_path)==SOURCE38_PROOF_SHA,'Source38 individual Root pause proof changed')
    proof=read(proof_path);receipt_path=contained(run,'word-cues/'+SOURCE38+'.json');receipt=read(receipt_path)
    require(proof.get('status')=='root_approved_exact_historical_unspoken_pause_point'
            and proof.get('id')==SOURCE38 and proof.get('word_index')==6 and proof.get('source_token')=='…'
            and proof.get('spoken') is False and proof.get('retained_original_cue')=={'start':7.18,'end':7.18}
            and proof.get('previous_measured_spoken_end')==6.6625 and proof.get('next_measured_spoken_start')==7.7425
            and proof.get('original_changed_spoken_indices')==[1,5,7]
            and all(proof.get(key) is False for key in ('audio_modified','cues_modified','spoken_timestamp_created'))
            and proof.get('listening_verdict') is None and proof.get('acting_verdict') is None,
            'Source38 exact Root visual-pause scope differs')
    require(digest(receipt_path)==proof['receipt_sha256']
            and all(receipt.get(key)==proof.get(key) for key in
                    ('source_manifest_sha256','text_sha256','audio_sha256','cues_sha256','engine_version'))
            and sha(line['text'].encode())==proof['text_sha256']
            and receipt['words'][6].get('spoken') is False and receipt['words'][6].get('word')=='…'
            and receipt['word_cues'][6]==proof['retained_original_cue']
            and receipt['word_cues'][5]['end']==6.6625 and receipt['word_cues'][7]['start']==7.7425,
            'Source38 retained original receipt/Source/current-neighbor binding differs')
    files=[proof_path]; qualification=contained(run,SOURCE38_QUALIFICATION_ARCHIVE)
    for name,wanted in proof['input_file_sha256'].items():
        if Path(name)==run/'word-cues/qualifications.private.json':path=qualification
        elif Path(name).is_relative_to(run):path=contained(run,str(Path(name).relative_to(run)))
        else:
            require(name==str(Path(__file__).resolve().parents[1]/'docs/voice-production/story-lines.json'),
                    'Source38 external proof path differs from its fixed current source')
            path=Path(name)
        require(digest(path)==wanted,'Source38 original individual review evidence changed')
        files.append(path)
    archive=read(contained(run,'timing-root-scoped-pass35/'+SOURCE38+'.before.private.json'))
    require(archive['word_cues'][6]==receipt['word_cues'][6]
            and _archive_basis(archive)==_archive_basis(receipt),
            'Source38 original nonspoken point or historical raw words/flags changed')
    frames=proof['actual_point_waveform_frames']
    require(frames['frame_size']==160 and frames['rate']==16000 and frames['rms_threshold']==.001
            and len(frames['rms_values'])==4 and all(0<=rms<.001 for rms in frames['rms_values'])
            and frames['active_fraction']==0.0,'Source38 actual four-frame silence proof differs')
    if entry is not None:
        require(entry['words'][6]=={'word':'…','start':7.18,'end':7.18},'Source38 actual published point changed')
    return files


def evidence_files(run):
    require(supports_run(run,1557), 'Original evidence requires exact historical full bank')
    files=[contained(run,'word-cues/qualifications.private.json')]
    cache=_VALIDATION_CACHE.get();cache=cache if cache is not None else {}
    for line in read(run/'lines.private.json')['lines']:
        path=contained(run,'word-cues/'+line['id']+'.json');files.append(path);receipt=read(path)
        if receipt.get('engine_version')!=ALIGNMENT_ENGINE or any(k.startswith('root_') for k in receipt):
            expected={key:receipt.get(key) for key in ('audio_sha256','text_sha256','source_manifest_sha256')}
            files.extend(_adoption_evidence(run,receipt,expected,cache)[0])
    for name in NONARCHIVED_REVIEWS:files.append(contained(ORIGINAL_ROOT,name))
    source38=next(line for line in read(run/'lines.private.json')['lines'] if line['id']==SOURCE38)
    files.extend(_source38_pause_evidence(run,source38))
    pff=read(contained(run,'raw/story-95c49f2ee284e215ca7615fc.receipt.json'))
    if pff.get('backend')=='derived_scoped_pff_parts':
        proof=_pff_evidence(run)
        files.extend(contained(run,name) for name in proof['provenance_files_sha256'])
        files.extend(ORIGINAL_ROOT/'scripts'/name for name in
                     ('story_voice_pff_edit.py','story_voice_common.py','prolog_voice_batch.py',
                      'story_voice_qa.py','story_voice_retake_batch.py','story_voice_vocal_qc.py'))
    return list(dict.fromkeys(files))


def _policy(run,line,clip,cache):
    path=contained(run,'word-cues/'+line['id']+'.json');receipt=read(path);original=path;engine=receipt['engine_version']
    if engine!=ALIGNMENT_ENGINE or any(k.startswith('root_') for k in receipt):
        expected={key:receipt[key] for key in ('audio_sha256','text_sha256','source_manifest_sha256')}
        _,original=_adoption_evidence(run,receipt,expected,cache)
    if engine==ALIGNMENT_ENGINE and not any(k.startswith('root_') for k in receipt):model=acoustic.MODEL
    elif 'CTC_adoption' in receipt:model=receipt['CTC_adoption']['binding']['model']['model_id']
    elif 'Partial_CTC_adoption' in receipt:model='dual independent German CTC; scoped caption timings'
    elif 'Vocal_event_adoption' in receipt:model='single measured waveform event; independent vocal QC'
    elif '/private-root-full-large' in engine:model='whisper-large-v3 with individual Root caption estimates'
    else:model='individual Root waveform/caption estimates; original raw model evidence retained'
    return {'method':VERSION,'frozen_manifest_sha256':FROZEN_SHA,'source_contract_sha256':source_contract(line),
            'source_text_sha256':sha(line['text'].encode()),'audio_sha256':clip['sha256'],
            'receipt_sha256':digest(path),'original_receipt_sha256':digest(original),
            'cues_sha256':acoustic.cue_sha(clip['word_cues']),'profiles_sha256':digest(run/'profiles.private.json'),
            'prepared_sha256':digest(run/'prepared.json'),'alignment_engine':engine,'actual_alignment_model':model}


def validate_run(run,qa_path,alignment_path,expected_count,review_source_root=None):
    run=Path(run).resolve(); require(supports_run(run,expected_count), 'Only exact original1557 run is supported')
    require(Path(qa_path).resolve().is_relative_to(run) and Path(alignment_path).resolve().is_relative_to(run),
            'Original complete reports must stay in the exact historical private run')
    _protected();cache={};token=_VALIDATION_CACHE.set(cache)
    try:
        # Derived and historical directions remain before the QA gate in the copied validator.
        frozen,clips,paths=_original_guards(run,qa_path,alignment_path,1557,ORIGINAL_ROOT)
        alignment=read(alignment_path);evidence=evidence_files(run);before={p:digest(p) for p in evidence}
        for line,clip in zip(frozen['lines'],clips):
            _bound_receipt(run,line,alignment['alignment_by_id'][line['id']],clip['seconds'],cache)
            clip['timing_policy']=_policy(run,line,clip,cache)
        require(all(digest(p)==expected for p,expected in before.items()), 'Original actual evidence changed during validation')
        _protected();return frozen,clips,paths
    finally:_VALIDATION_CACHE.reset(token)


def validate_retained_clip(clip,current,root,bank_evidence=None):
    marker=clip.get('timing_policy')
    require(isinstance(marker,dict) and set(marker)==POLICY_FIELDS and marker.get('method')==VERSION,
            'Malformed retained original timing policy')
    require(isinstance(bank_evidence,_QualifiedOriginalBank) and bank_evidence.token is _QUALIFIED_TOKEN,
            'Retained original clip lacks complete current1557 QA/Alignment and Root closure validation')
    qualified=bank_evidence.clips.get(clip.get('id'))
    require(qualified is not None and all(qualified.get(key)==clip.get(key) for key in
            ('id','kind','speaker','text','display_text','audio','sha256','seconds','voice','word_cues','timing_policy')),
            'Retained original clip differs from the fully qualified current original bank')
    require(supports_run(ORIGINAL_RUN,1557) and isinstance(current,dict), 'Retained original private Source unavailable')
    inventory=Path(root)/'docs/voice-production/story-lines.json'
    require(digest(inventory)==CURRENT_SHA, 'Retained original policy only supports its reviewed current1576 inventory')
    measured=next((r for r in read(inventory)['lines'] if r['id']==clip.get('id')),None)
    require(measured is not None and source_contract(measured)==source_contract(current),
            'Retained original current mood/routes differ from the exact measured source closure')
    line=next((r for r in read(ORIGINAL_RUN/'lines.private.json')['lines'] if r['id']==clip.get('id')),None)
    require(line is not None and all(line.get(k)==current.get(k) for k in SOURCE_FIELDS),
            'Retained original current Source identity differs')
    profiles=read(Path(root)/'docs/voice-production/story-speakers.json')
    _identity_without_mood(line,current,read(ORIGINAL_RUN/'profiles.private.json'),profiles)
    require(all(clip.get(k)==current.get(k) for k in ('id','kind','speaker','text','display_text','runtime_keys')),
            'Retained original current clip/routes differ')
    cache=bank_evidence.provenance_cache
    require(marker==_policy(ORIGINAL_RUN,line,clip,cache), 'Retained original policy binding differs')
    require(clip['sha256']==digest(contained(ORIGINAL_RUN,'clips/'+line['id']+'.mp3')), 'Retained original audio changed')
    entry={'words':[{'word':word,**cue} for word,cue in zip(acoustic.normalized_text(line['text']).split(),clip['word_cues'])],
           'cues_sha256':acoustic.cue_sha(clip['word_cues'])}
    token=_VALIDATION_CACHE.set(cache)
    try:
        _bound_receipt(ORIGINAL_RUN,line,entry,clip['seconds'],cache);previous=0.
        for word in entry['words']:
            require(_valid_interval(ORIGINAL_RUN,line,entry,word,previous,clip['seconds']), 'Retained original interval invalid')
            previous=word['end']
    finally:_VALIDATION_CACHE.reset(token)
    files=[ORIGINAL_RUN/'lines.private.json',ORIGINAL_RUN/'prepared.json',ORIGINAL_RUN/'profiles.private.json',
           contained(ORIGINAL_RUN,'word-cues/'+line['id']+'.json'),
           contained(ORIGINAL_RUN,'clips/'+line['id']+'.mp3')]
    receipt=read(files[-2])
    if receipt.get('engine_version')!=ALIGNMENT_ENGINE or any(k.startswith('root_') for k in receipt):
        expected={key:receipt[key] for key in ('audio_sha256','text_sha256','source_manifest_sha256')}
        files.extend(_adoption_evidence(ORIGINAL_RUN,receipt,expected,cache)[0])
    _protected();return list(dict.fromkeys([*bank_evidence.files,*files]))


def _original_guards(run, qa_path, alignment_path, expected_count, review_source_root=None, vocal_variant_plan=None, vocal_variant_target_qc=None, vocal_variant_target_adjudications=None):
    info = read(run / 'prepared.json')
    for file, key in [('requests.jsonl','input_sha256'), ('profiles.private.json','profiles_sha256'), ('lines.private.json','manifest_sha256'), ('full-inventory.private.json','full_inventory_sha256'), ('source-snapshot.private.json','source_snapshot_sha256')]:
        require(digest(contained(run, file)) == info.get(key), 'Prepared input changed: ' + file)
    frozen = read(run / 'lines.private.json'); profiles = read(run / 'profiles.private.json')
    require(info.get('bank') == 'story' and info.get('model') == frozen.get('model') == profiles.get('model') == MODEL, 'Wrong production bank/model')
    lines = frozen.get('lines', [])
    require(len(lines) == expected_count and info.get('request_count') == expected_count and not frozen.get('unresolved'), 'Incomplete frozen inventory')
    ids = [line.get('id') for line in lines]
    require(len(set(ids)) == len(ids) and all(isinstance(i,str) and ID.fullmatch(i) for i in ids), 'Invalid/duplicate recording ID')
    payload = (run / 'requests.jsonl').read_bytes()
    records = [json.loads(row) for row in payload.splitlines() if row.strip()]
    require(info.get('input_bytes') == len(payload) and records == [{'key':line['id'], 'request':common.request_for(line, profiles['speakers'])} for line in lines], 'Frozen requests/cast differ')
    derived=[]
    for line in lines:
        receipt_path=run/'raw'/(line['id']+'.receipt.json')
        if receipt_path.is_file():
            receipt=read(contained(run,'raw/'+line['id']+'.receipt.json'))
            if str(receipt.get('backend','')).startswith('derived'):
                require((receipt.get('backend')=='derived_single_nonlexical_event' and line['id']==VARIANT_TARGET) or (receipt.get('backend')=='derived_scoped_pff_parts' and line['id']=='story-95c49f2ee284e215ca7615fc'),'Unsupported derived recording')
                derived.append(receipt)
    require(len(derived)<=2,'More than the two fixed derived cases forbidden')
    for receipt in derived:
        if receipt.get('backend')=='derived_scoped_pff_parts':
            validate_pff_derived(run,next(row for row in lines if row['id']==receipt['id']),receipt)
        else:validate_vocal_variant(run,frozen,profiles,receipt,vocal_variant_plan,vocal_variant_target_qc,vocal_variant_target_adjudications)
    snapshot = read(run / 'source-snapshot.private.json')
    bound_sources=set(frozen.get('source_hashes', {})); archived=set(snapshot)
    missing=bound_sources-archived
    require(not(archived-bound_sources) and missing <= NONARCHIVED_REVIEWS, 'Incomplete or unknown archived sources')
    if missing:
        require(review_source_root is not None, 'Current source root required for nonarchived reviews')
        for name in missing:
            require(digest(contained(review_source_root,name)) == frozen['source_hashes'][name], 'Nonarchived frozen review changed: '+name)
    for name, entry in snapshot.items():
        require(entry.get('sha256') == frozen['source_hashes'][name] == sha(entry['text'].encode()), 'Archived source changed')
    collection = read(run / 'collection.private.json')
    require(not collection.get('failures') and collection.get('collected') == collection.get('expected') == expected_count, 'Collection incomplete')
    qa = read(qa_path); alignment = read(alignment_path); bound = digest(run / 'lines.private.json')
    require(qa.get('status') == alignment.get('status') == 'passed' and not qa.get('failures') and not alignment.get('failures') and not alignment.get('requires_qualification'), 'QA/alignment not final passing')
    require(qa.get('manifest_sha256') == alignment.get('source_manifest_sha256') == bound, 'Stale report manifest')
    checked=qa.get('checked_ids', [])
    require(len(checked)==len(set(checked))==len(ids) and set(checked)==set(ids), 'Incomplete or duplicate QA coverage')
    for field, expected in [('version',QA_VERSION),('model',QA_MODEL)]:
        if field in qa: require(qa[field]==expected or (field=='model' and isinstance(qa[field],str) and qa[field].startswith(expected+':')), 'Wrong QA producer/model')
    for field, expected in [('method',ALIGNMENT_ENGINE),('model',acoustic.MODEL)]:
        if field in alignment: require(alignment[field]==expected, 'Wrong alignment producer/model')
    require(all(set(mapping)==set(ids) for mapping in [qa.get('clip_sha256',{}),alignment.get('clip_sha256',{}),alignment.get('alignment_by_id',{}),alignment.get('authored_text_sha256',{})]), 'Incomplete or extra report hashes/entries')
    raw_takes=qa.get('takes', [])
    takes = {take['id']:take for take in raw_takes}
    require(len(raw_takes)==len(takes)==len(ids) and set(takes)==set(ids), 'Missing or duplicate QA signal receipts')
    paths = {}; clips = []
    for line in lines:
        ident = line['id']; path = contained(run, 'clips/' + ident + '.mp3'); audio_sha = digest(path)
        require(qa.get('clip_sha256', {}).get(ident) == alignment.get('clip_sha256', {}).get(ident) == audio_sha, 'Stale current MP3 qualification')
        text_sha = sha(line['text'].encode()); take = takes[ident]; entry = alignment['alignment_by_id'][ident]
        require(take.get('text_sha256') == entry.get('text_sha256') == alignment.get('authored_text_sha256', {}).get(ident) == text_sha and not take.get('reasons'), 'Stale text qualification')
        seconds = take.get('signal', {}).get('seconds')
        require(isinstance(seconds,(int,float)) and not isinstance(seconds,bool) and math.isfinite(seconds) and seconds > 0, 'Invalid decoded duration')
        words = entry.get('words', []); tokens = acoustic.normalized_text(line['text']).split()
        require([word.get('word') for word in words] == tokens, 'Alignment differs from full authored words')
        cues = []; previous = 0
        for word in words:
            start, end = word.get('start'), word.get('end')
            require(_valid_interval(run, line, entry, word, previous, seconds), 'Invalid aligned timing')
            cues.append({'start':start,'end':end}); previous = end
        require(entry.get('word_count') == len(tokens) and tokens and entry.get('cues_sha256') == acoustic.cue_sha(cues), 'Incomplete or changed word cues')
        voice = profiles['speakers'][line['speaker']]['google_voice']
        clips.append({'id':ident,'kind':line['kind'],'speaker':line['speaker'],'text':line['text'],'display_text':line['display_text'],'audio':'audio/story/' + ident + '.mp3','sha256':audio_sha,'seconds':seconds,'voice':voice,'word_cues':cues,'runtime_keys':line.get('runtime_keys', common.frozen_runtime_keys(frozen,line))})
        paths[ident] = path
    return frozen, clips, paths
