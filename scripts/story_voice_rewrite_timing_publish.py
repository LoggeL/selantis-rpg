#!/usr/bin/env python3
"""One frozen rewrite supplement: preserve genuine unspoken punctuation cues.

The original publisher stays byte-identical. _original_guards is its complete
validator body, with one interval predicate replaced. Tests compare the ASTs.
No report projection, global monkeypatch, source rewrite or synthetic interval.
"""
from __future__ import annotations
import json
import math
from pathlib import Path
import unicodedata
import story_voice_publish as strict
import story_voice_word_cues as word_driver
from story_voice_publish import (read, digest, contained, require, sha, MODEL, ID,
    common, VARIANT_TARGET, NONARCHIVED_REVIEWS, QA_VERSION, QA_MODEL,
    ALIGNMENT_ENGINE, acoustic, validate_pff_derived, validate_vocal_variant)

VERSION = 'one-frozen-rewrite-490-receipt-bound-punctuation-v1'
RUN_NAME = '2026-10-07-rewrite-490'
FROZEN_MANIFEST_SHA256 = 'bb243f9af44a00e2fb63779620c1fe92ec6bf1f9896b7629f88195d8a16db343'
PROTECTED = {
    'story_voice_publish.py': '9200edc56a0751d559f907cc2366d57583163128a1ebced54ae0dfb3f25a8e2a',
    'story_voice_qa.py': '931a4287cb4a92ce64c131bacc8fb692dce486cbf09ac4237243eaa7d62d09b6',
    'story_voice_word_cues.py': 'a93d6ddd89b2e58f03b2459918ccbe5e05936f0578cee56e4ee4b05c54395724',
    'prolog_voice_word_cues.py': '48bb39d11e324589e29543149de57acfd736babd36af2144fb8f7c4887e1c6e0',
    'story_voice_common.py': 'ade76e00d016a526108ea4d1e189affc11becd32c765dfa4fad7c24f2fe6d67e',
    'story_voice_ctc_review.py': '23e67a5955c553bdbe2ecb1252770a42b501baa4f65fcd13a183ea4b5454ac8f',
    'story_voice_secondary_ctc_review.py': '4f630c04addcbad6fd7d899177a151bf0387695bb91cc91ecd75863406290745',
}
SOURCE_FIELDS = ('id', 'kind', 'speaker', 'text', 'display_text', 'direction_en',
                 'performance_variant', 'mood', 'runtime_keys')
POLICY_FIELDS = {'method', 'frozen_manifest_sha256', 'source_contract_sha256',
                 'source_text_sha256', 'audio_sha256', 'receipt_sha256',
                 'original_receipt_sha256', 'cues_sha256', 'profiles_sha256', 'prepared_sha256'}


def source_contract(line):
    return sha(strict.canonical({key: line.get(key) for key in SOURCE_FIELDS}).encode())


def _protected_originals():
    require(all(digest(Path(__file__).with_name(name)) == expected for name,expected in PROTECTED.items()),
            'Protected original publisher/QA/cue drivers changed')


def supports_run(run, expected_count):
    return (expected_count == 490 and Path(run).name == RUN_NAME
            and digest(Path(run)/'lines.private.json') == FROZEN_MANIFEST_SHA256)


def pure_punctuation(token):
    return bool(token) and all(unicodedata.category(char).startswith('P') for char in token)


def receipt_files(run):
    return [contained(run, 'word-cues/'+line['id']+'.json')
            for line in read(Path(run)/'lines.private.json')['lines']]


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
    require(qa_hash == approval.get('qa_report_sha256') == adoption['binding'].get('qa_report_sha256'),
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
        proposal = review_driver.review(line,expected['audio_sha256'],expected['source_manifest_sha256'],
                                        prior_qa,ctc,read(archive),digest(Path(ctc_driver.__file__)))
    require(proposal.get('status') == 'supported'
            and proposal.get('proposed_cues') == receipt['word_cues']
            and not adoption.get('variant_exceptions') and not approval.get('variant_exceptions'),
            'Original technical CTC review rejected: '+str(proposal.get('reason','unsupported variant scope')))
    model = adoption['binding']['model']
    model_files = [Path(model['local_directory'])/name for name in model['file_sha256']]
    driver_files = [Path(ctc_driver.__file__), Path(review_driver.__file__)]
    if secondary: driver_files.append(Path(ctc_driver.parent.__file__))
    return [approvals_path, actual, archive, qa_path, *driver_files, *model_files]


def evidence_files(run):
    files = receipt_files(run); cache = {}
    for path in list(files):
        receipt = read(path)
        if receipt.get('engine_version') != ALIGNMENT_ENGINE:
            expected = {key:receipt.get(key) for key in
                        ('audio_sha256', 'text_sha256', 'source_manifest_sha256')}
            files.extend(_ctc_evidence(Path(run), receipt, expected, cache))
    approvals = Path(run)/'word-cues/qualifications.private.json'
    if approvals.exists(): files.append(contained(run, str(approvals.relative_to(run))))
    return list(dict.fromkeys(files))


def _bound_receipt(run, line, entry, seconds, provenance_cache=None):
    receipt = read(contained(run, 'word-cues/'+line['id']+'.json'))
    expected = {'audio_sha256': digest(contained(run, 'clips/'+line['id']+'.mp3')),
                'text_sha256': sha(line['text'].encode()),
                'source_manifest_sha256': digest(Path(run)/'lines.private.json'),
                'engine_version': ALIGNMENT_ENGINE}
    require(receipt.get('id') == line['id'] and receipt.get('text') == acoustic.normalized_text(line['text'])
            and all(receipt.get(key) == value for key,value in expected.items() if key != 'engine_version'),
            'Rewrite actual cue receipt source/audio binding differs')
    if receipt.get('engine_version') != ALIGNMENT_ENGINE:
        _ctc_evidence(Path(run), receipt, expected, provenance_cache)
    duration = receipt.get('decoded_seconds')
    require(type(duration) in (int,float) and math.isfinite(duration) and duration > 0
            and abs(duration-seconds) <= .05, 'Rewrite receipt decoded duration differs')
    tokens = acoustic.normalized_text(line['text']).split()
    details = receipt.get('words'); cues = receipt.get('word_cues'); reported = entry.get('words')
    require(isinstance(details,list) and isinstance(cues,list) and isinstance(reported,list)
            and len(tokens) == len(details) == len(cues) == len(reported)
            and [detail.get('word') for detail in details] == tokens,
            'Rewrite receipt full authored word body differs')
    for token, detail, cue, word in zip(tokens, details, cues, reported):
        require(type(detail.get('spoken')) is bool and detail['spoken'] == any(char.isalnum() for char in token),
                'Rewrite receipt spoken classification differs from actual Source token')
        require(cue == {'start':word.get('start'),'end':word.get('end')}
                and (receipt.get('engine_version') != ALIGNMENT_ENGINE
                     or (detail.get('start') == word.get('start') and detail.get('end') == word.get('end'))),
                'Rewrite report differs from actual receipt intervals')
    require(receipt.get('cues_sha256') == entry.get('cues_sha256') == acoustic.cue_sha(cues),
            'Rewrite actual receipt cue hash differs')
    return receipt


def _policy(run, line, clip, provenance_cache=None):
    path = contained(run, 'word-cues/'+line['id']+'.json'); receipt = read(path)
    original = path
    if receipt.get('engine_version') != ALIGNMENT_ENGINE:
        expected = {key:receipt.get(key) for key in ('audio_sha256','text_sha256','source_manifest_sha256')}
        original = _ctc_evidence(Path(run),receipt,expected,provenance_cache)[2]
    return {'method': VERSION, 'frozen_manifest_sha256': FROZEN_MANIFEST_SHA256,
            'source_contract_sha256': source_contract(line), 'source_text_sha256': sha(line['text'].encode()),
            'audio_sha256': clip['sha256'], 'receipt_sha256': digest(path),
            'original_receipt_sha256': digest(original), 'cues_sha256': acoustic.cue_sha(clip['word_cues']),
            'profiles_sha256': digest(contained(run,'profiles.private.json')),
            'prepared_sha256': digest(contained(run,'prepared.json'))}


def validate_retained_clip(clip, current, root):
    """Root-bound existing bank plus original fixed private receipt, never a marker waiver."""
    marker = clip.get('timing_policy')
    require(isinstance(marker, dict) and set(marker) == POLICY_FIELDS and marker.get('method') == VERSION,
            'Unknown or malformed retained rewrite timing policy')
    require(root is not None, 'Retained rewrite policy requires the original private workspace')
    _protected_originals()
    run = contained(Path(root), 'output/audio/story-voice/'+RUN_NAME+'/lines.private.json').parent
    require(supports_run(run,490), 'Retained rewrite frozen manifest differs')
    rows = read(run/'lines.private.json')['lines']
    line = next((row for row in rows if row['id'] == clip.get('id')), None)
    require(line is not None and isinstance(current,dict) and len(rows) == 490
            and source_contract(line) == source_contract(current),
            'Retained rewrite Source/cast/direction/routes differ')
    require(all(clip.get(key) == current.get(key) for key in
                ('id','kind','speaker','text','display_text','runtime_keys')),
            'Retained rewrite clip/current Source differs')
    cache = {}
    require(marker == _policy(run,line,clip,cache), 'Retained rewrite policy receipt/source/audio/cue binding differs')
    prepared = read(run/'prepared.json'); profiles = read(run/'profiles.private.json')
    require(prepared.get('profiles_sha256') == marker['profiles_sha256']
            and prepared.get('manifest_sha256') == marker['frozen_manifest_sha256']
            and prepared.get('bank') == 'story' and profiles.get('model') == strict.MODEL
            and clip.get('voice') == profiles.get('speakers',{}).get(line['speaker'],{}).get('google_voice'),
            'Retained rewrite original fixed cast/preset differs')
    require(clip.get('sha256') == digest(contained(run,'clips/'+line['id']+'.mp3')),
            'Retained rewrite original audio differs')
    entry = {'words':[{'word':token, **cue} for token,cue in
                     zip(acoustic.normalized_text(line['text']).split(), clip['word_cues'])],
             'cues_sha256': acoustic.cue_sha(clip['word_cues'])}
    _bound_receipt(run,line,entry,clip['seconds'],cache)
    previous = 0.
    for word in entry['words']:
        require(_valid_interval(run,line,entry,word,previous,clip['seconds']),
                'Retained rewrite spoken/punctuation interval invalid')
        previous = word['end']
    files = [run/'lines.private.json', run/'prepared.json', run/'profiles.private.json',
             contained(run,'clips/'+line['id']+'.mp3'),
             contained(run,'word-cues/'+line['id']+'.json')]
    receipt = read(files[-1])
    if receipt['engine_version'] != ALIGNMENT_ENGINE:
        expected = {key:receipt.get(key) for key in ('audio_sha256','text_sha256','source_manifest_sha256')}
        files.extend(_ctc_evidence(run,receipt,expected,cache))
    _protected_originals()
    return files


def _valid_interval(run, line, entry, word, previous, seconds):
    start,end = word.get('start'),word.get('end')
    finite = all(isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)
                 for value in (start,end))
    if not finite or not 0 <= previous <= start <= end <= seconds + .001:
        return False
    if start < end:
        return True
    if not pure_punctuation(word['word']) or not start == end == previous:
        return False
    receipt = _bound_receipt(run,line,entry,seconds)
    index = next(index for index,item in enumerate(entry['words']) if item is word)
    return receipt['words'][index]['spoken'] is False


def validate_run(run, qa_path, alignment_path, expected_count, review_source_root=None,
                 vocal_variant_plan=None, vocal_variant_target_qc=None, vocal_variant_target_adjudications=None):
    run = Path(run).resolve()
    require(supports_run(run,expected_count), 'Punctuation policy is only for the exact frozen rewrite490 supplement')
    require(review_source_root is not None and run.is_relative_to(Path(review_source_root).resolve()/'output/audio/story-voice'),
            'Rewrite supplement must remain inside its current private workspace')
    _protected_originals()
    evidence = evidence_files(run)
    before = {path: digest(path) for path in evidence}
    frozen,clips,paths = _original_guards(run,qa_path,alignment_path,expected_count,review_source_root,
                                         vocal_variant_plan,vocal_variant_target_qc,vocal_variant_target_adjudications)
    alignment = read(alignment_path)
    cache = {}
    for line in frozen['lines']:
        clip = next(clip for clip in clips if clip['id'] == line['id'])
        _bound_receipt(run,line,alignment['alignment_by_id'][line['id']],clip['seconds'],cache)
        clip['timing_policy'] = _policy(run,line,clip,cache)
    require(all(digest(path) == expected for path,expected in before.items()), 'Rewrite actual cue evidence changed during validation')
    require(all(digest(Path(__file__).with_name(name)) == expected for name,expected in PROTECTED.items()),
            'Protected original drivers changed during rewrite validation')
    return frozen,clips,paths


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
