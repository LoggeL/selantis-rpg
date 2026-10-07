#!/usr/bin/env python3
"""Publish an explicitly reviewed, fully qualified partial current Story bank.

No generation or original-bank clearance. Each selected run uses the unchanged
strict publisher validator. Missing current Sources stay missing in coverage.
"""
from __future__ import annotations
import argparse
import copy
import fcntl
from contextlib import contextmanager
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import story_voice_publish as strict

VERSION = 'current-source-qualified-incremental-story-v1'
APPROVED = 'approved_incremental_story_selection'
PUBLIC_CLIP_FIELDS = ('id', 'kind', 'speaker', 'text', 'display_text', 'audio', 'sha256',
                      'seconds', 'voice', 'word_cues', 'runtime_keys')
WITHDRAWN_PAIRS = {
    'story-3f12e4f8eeea79a306adb510': 'schuetze',
    'story-5a8a63b92feae6147480ad67': 'maedchen',
    'story-6e04cb96d55ccfb76c786b86': 'algard',
}
WITHDRAWAL_SOURCE = 'game/src/chapters/kapitel-5/rettung.ts'
WITHDRAWAL_TEXT = 'Weg hier! Alle weg!'
BRANCH_AST = r"""
const fs = require('node:fs'), crypto = require('node:crypto');
const ts = require(process.argv[1] + '/game/node_modules/typescript');
const text = fs.readFileSync(process.argv[2], 'utf8');
const sf = ts.createSourceFile(process.argv[2], text, ts.ScriptTarget.Latest, true);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const result = [];
function visit(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'bark' && node.arguments.length === 3
      && ts.isIdentifier(node.arguments[0]) && ts.isConditionalExpression(node.arguments[1])) {
    const conditional = node.arguments[1], condition = conditional.condition;
    let loop = node.parent;
    while (loop && !ts.isForOfStatement(loop) && !ts.isFunctionLike(loop)) loop = loop.parent;
    if (loop && ts.isForOfStatement(loop) && ts.isVariableDeclarationList(loop.initializer)
        && loop.initializer.declarations.length === 1 && ts.isArrayLiteralExpression(loop.expression)
        && loop.expression.elements.every(ts.isStringLiteralLike) && ts.isBinaryExpression(condition)
        && condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        && ts.isIdentifier(condition.left) && ts.isStringLiteralLike(condition.right)
        && ts.isStringLiteralLike(conditional.whenTrue) && ts.isStringLiteralLike(conditional.whenFalse)) {
      result.push({binding: loop.initializer.declarations[0].name.getText(sf),
        actors: loop.expression.elements.map(n => n.text), speaker_binding: node.arguments[0].text,
        condition_binding: condition.left.text, equal_to: condition.right.text,
        when_true: conditional.whenTrue.text, when_false: conditional.whenFalse.text,
        expression: conditional.getText(sf), expression_sha256: sha(conditional.getText(sf)),
        start: conditional.getStart(sf), end: conditional.getEnd(),
        call_expression: node.getText(sf), call_sha256: sha(node.getText(sf)),
        loop_expression: loop.getText(sf), loop_sha256: sha(loop.getText(sf))});
    }
  }
  ts.forEachChild(node, visit);
}
visit(sf); process.stdout.write(JSON.stringify(result));
"""
require = strict.require
Invalid = strict.Invalid
read = strict.read
digest = strict.digest


def unique_json(path):
    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, 'Duplicate JSON key in incremental inputs')
            result[key] = value
        return result
    return json.loads(Path(path).read_text(), object_pairs_hook=pairs)


def ids(values, label):
    require(isinstance(values, list) and all(isinstance(i, str) and strict.ID.fullmatch(i) for i in values)
            and len(values) == len(set(values)), 'Invalid/duplicate ' + label)
    return set(values)


def scanner_inventory(inventory_path, root):
    """The actual unchanged scanner proves complete current AST/cast/routes."""
    script = root/'scripts/story_voice_inventory.mjs'
    require(script.is_file(), 'Current source scanner unavailable')
    with tempfile.TemporaryDirectory(prefix='story-incremental-inventory-') as directory:
        output = Path(directory)/'inventory.json'
        result = subprocess.run(['node', str(script), '--propose', '--output', str(output)],
                                cwd=root, capture_output=True, text=True)
        require(result.returncode == 0 and output.is_file(), 'Current source scanner failed')
        actual = read(output)
    require(strict.canonical(actual) == strict.canonical(read(inventory_path)),
            'Current inventory differs from actual scanner AST/cast/routes')
    require(not actual.get('unresolved'), 'Current scanner inventory has unresolved Sources')
    return {'scanner_sha256': digest(script), 'inventory_sha256': digest(inventory_path)}


def current_rows(current):
    rows = current.get('lines')
    require(isinstance(rows, list) and rows, 'Current Source inventory is empty')
    keys = ids([r.get('id') for r in rows], 'current Source IDs')
    mapping = {r['id']: r for r in rows}
    expected = [{**key, 'asset_id': row['id']} for row in rows for key in row.get('runtime_keys', [])]
    require(all(row.get('runtime_keys') for row in rows)
            and sorted(map(strict.canonical, expected)) == sorted(map(strict.canonical, current.get('runtime_lookup', []))),
            'Current full inventory routes are incomplete or differ')
    return mapping, keys


def exact_source(frozen, current, profiles):
    for key in ['kind', 'speaker', 'text', 'display_text', 'direction_en', 'performance_variant', 'mood']:
        require(frozen.get(key) == current.get(key), 'Current selected Source/cast/direction differs: ' + key)
    require(frozen.get('runtime_keys') == current.get('runtime_keys'), 'Selected current runtime routes differ')
    voice = profiles.get('speakers', {}).get(current['speaker'], {}).get('google_voice')
    require(isinstance(voice, str) and voice, 'Current fixed speaker preset missing')
    return voice


def cue_check(clip):
    seconds = clip.get('seconds'); cues = clip.get('word_cues')
    require(type(seconds) in (int, float) and math.isfinite(seconds) and seconds > 0
            and isinstance(cues, list) and len(cues) == len(strict.acoustic.normalized_text(clip['text']).split()) and cues,
            'Existing clip duration or full cue coverage invalid')
    previous = 0
    for cue in cues:
        start, end = cue.get('start'), cue.get('end')
        require(type(start) in (int, float) and type(end) in (int, float)
                and math.isfinite(start) and math.isfinite(end) and previous <= start < end <= seconds + .001,
                'Existing clip cues are invalid or collapsed')
        previous = end


def existing_assets(target, expected_manifest_hash, current, profiles, replacement_ids, approved_retired):
    if not target.exists():
        require(expected_manifest_hash is None and not approved_retired, 'Expected existing bank or retirements unavailable')
        return [], {}, []
    require(target.is_dir() and not target.is_symlink(), 'Unsafe Story destination')
    manifest_path = target/'manifest.json'
    require(manifest_path.is_file() and not manifest_path.is_symlink()
            and digest(manifest_path) == expected_manifest_hash, 'Existing Story manifest differs from Root selection')
    old = unique_json(manifest_path)
    require(old.get('model') == strict.MODEL and isinstance(old.get('clips'), list), 'Existing Story manifest invalid')
    original_ids = ids([c.get('id') for c in old['clips']], 'existing clip IDs')
    expected_files = {'manifest.json', *(i+'.mp3' for i in original_ids)}
    require({p.name for p in target.iterdir()} == expected_files
            and all(p.is_file() and not p.is_symlink() for p in target.iterdir()), 'Unknown/unsafe existing Story files')
    kept, paths, retired = [], {}, []
    for clip in old['clips']:
        ident = clip['id']; path = target/(ident+'.mp3')
        require(clip.get('audio') == 'audio/story/'+ident+'.mp3' and digest(path) == clip.get('sha256'),
                'Existing Story audio/path/hash differs')
        if ident not in current:
            retired.append({'id': ident, 'reason': 'absent_from_current_scanner_inventory', 'audio_sha256': clip['sha256']})
            continue
        row = current[ident]
        require(all(clip.get(k) == row.get(k) for k in ['kind', 'speaker', 'text', 'display_text'])
                and clip.get('runtime_keys') == row['runtime_keys']
                and clip.get('voice') == profiles['speakers'][row['speaker']]['google_voice'],
                'Existing current clip text/cast/preset/routes differ')
        cue_check(clip)
        if ident not in replacement_ids:
            kept.append({field: copy.deepcopy(clip[field]) for field in PUBLIC_CLIP_FIELDS}); paths[ident] = path
    require({r['id'] for r in retired} == approved_retired, 'Retired Source IDs differ from explicit Root selection')
    return kept, paths, retired


def selectors(clips, aliases):
    routes = {}; result = []
    for clip in clips:
        for route in clip['runtime_keys']:
            # Current scanner supplies plain text; runtime preserves punctuation.
            key = (route['kind'], aliases.get(route['speaker'], route['speaker']),
                   ' '.join(route['text'].split()), route.get('scene') or '*', route.get('mood') or 'neutral')
            require(key not in routes or routes[key] == clip['id'], 'Conflicting overall runtime selector')
            routes[key] = clip['id']; result.append({**route, 'asset_id': clip['id']})
    unique = {strict.canonical(route): route for route in result}
    return list(unique.values())


def withdrawal_record(run, row, current, inventory_path, root):
    """Only the three measured unreachable pairs; no word/QA waiver."""
    ident = row['id']
    require(ident in WITHDRAWN_PAIRS and ident not in {r['id'] for r in current['lines']},
            'Unknown or still-current withdrawal Source')
    require(row.get('kind') == 'bark' and row.get('speaker') == WITHDRAWN_PAIRS[ident]
            and row.get('text') == row.get('display_text') == WITHDRAWAL_TEXT,
            'Withdrawal Source/cast/text differs from measured conditional case')
    sources = row.get('sources')
    require(isinstance(sources, list) and len(sources) == 1 and sources[0].get('file') == WITHDRAWAL_SOURCE,
            'Withdrawal requires the exact single authored Source branch')
    source = sources[0]; path = strict.contained(root, WITHDRAWAL_SOURCE)
    snapshot = read(run/'source-snapshot.private.json').get(WITHDRAWAL_SOURCE, {})
    source_sha = digest(path)
    require(snapshot.get('sha256') == strict.sha(snapshot.get('text', '').encode()) == source_sha
            == current['source_hashes'].get(WITHDRAWAL_SOURCE), 'Withdrawal original/current authored Source changed')
    result = subprocess.run(['node', '-e', BRANCH_AST, str(root), str(path)],
                            cwd=root, capture_output=True, text=True)
    require(result.returncode == 0, 'Actual conditional withdrawal AST unavailable')
    branches = [record for record in json.loads(result.stdout)
                if record['start'] == source.get('start') and record['end'] == source.get('end')
                and record['expression'] == source.get('expression')
                and record['expression_sha256'] == source.get('expression_sha256')]
    require(len(branches) == 1, 'Withdrawal branch Source span/hash differs from actual AST')
    branch = branches[0]
    require(branch['binding'] == branch['speaker_binding'] == branch['condition_binding'] == 'id'
            and branch['actors'] == ['orwen', 'algard', 'maedchen', 'schuetze']
            and branch['equal_to'] == 'orwen' and branch['when_true'] == WITHDRAWAL_TEXT
            and branch['when_false'] == 'Hexerei!', 'Withdrawal actual conditional semantics differ')
    pairs = {(r['speaker'], r['text']) for r in current['lines'] if r['kind'] == 'bark'
             and any(s.get('file') == WITHDRAWAL_SOURCE and s.get('expression_sha256') == source['expression_sha256']
                     for s in r.get('sources', []))}
    require(pairs == {('orwen', WITHDRAWAL_TEXT), ('algard', 'Hexerei!'),
                      ('maedchen', 'Hexerei!'), ('schuetze', 'Hexerei!')},
            'Current scanner did not preserve exact correlated reachable Source pairs')
    return {'run_dir': str(run.resolve()), 'frozen_manifest_sha256': digest(run/'lines.private.json'),
            'current_inventory_sha256': digest(inventory_path), 'source_row_sha256': strict.sha(strict.canonical(row).encode()),
            'source_file': WITHDRAWAL_SOURCE, 'source_file_sha256': source_sha, 'source_branch': branch}


def build(args):
    inventory_path = args.current_inventory.resolve(); root = strict.source_root(inventory_path)
    profiles_path = args.profiles.resolve(); target = args.public_dir.resolve()
    require(target == root/'game/public/audio/story' and not args.public_dir.is_symlink(), 'Explicit current-workspace Story destination required')
    require(profiles_path == root/'docs/voice-production/story-speakers.json',
            'Actual current-workspace fixed cast profile required')
    require(all(path.resolve().is_relative_to(root/'output/audio/story-voice')
                for path in [args.root_selection, args.supplements]), 'Selection inputs must remain private in current workspace')
    current = read(inventory_path); strict.validate_sources(current, root)
    scanner = scanner_inventory(inventory_path, root)
    rows, current_ids = current_rows(current); profiles = read(profiles_path)
    require(profiles.get('model') == strict.MODEL, 'Current speaker model differs')
    selection = unique_json(args.root_selection)
    required = {'status', 'reviewed_by', 'reason', 'current_inventory_sha256', 'profiles_sha256',
                'supplements_sha256', 'requested_ids', 'retired_ids', 'existing_manifest_sha256', 'withdrawn_ids'}
    require(isinstance(selection, dict) and set(selection) == required and selection['status'] == APPROVED
            and isinstance(selection['reviewed_by'], str) and selection['reviewed_by'].casefold().startswith('root ')
            and isinstance(selection['reason'], str) and len(selection['reason'].strip()) >= 20,
            'Explicit complete Root incremental selection required')
    require(selection['current_inventory_sha256'] == digest(inventory_path)
            and selection['profiles_sha256'] == digest(profiles_path)
            and selection['supplements_sha256'] == digest(args.supplements), 'Root source/profile/run selection hashes differ')
    requested = ids(selection['requested_ids'], 'requested Source IDs'); retired = ids(selection['retired_ids'], 'retired Source IDs')
    require(requested and requested <= current_ids and not retired & current_ids, 'Requested/retired Source scope differs')
    withdrawn = selection['withdrawn_ids']
    require(isinstance(withdrawn, dict) and set(withdrawn) <= set(WITHDRAWN_PAIRS)
            and not set(withdrawn) & (current_ids | requested | retired), 'Unknown/still-current/overlapping withdrawn Source')
    document = unique_json(args.supplements)
    require(isinstance(document, dict) and set(document) == {'runs'} and isinstance(document['runs'], list)
            and document['runs'], 'Explicit qualified supplement runs required')
    clips, paths, covered, seen, removed_all, input_hashes = [], {}, set(), set(), set(), {}
    for record in document['runs']:
        require(isinstance(record, dict) and set(record) == {'run_dir', 'qa_report', 'alignment_report',
                'manifest_sha256', 'qa_sha256', 'alignment_sha256', 'removed_current_ids'}, 'Incomplete supplement report bindings')
        run, qa, alignment = (Path(record[k]).resolve() for k in ['run_dir', 'qa_report', 'alignment_report'])
        require(run.is_relative_to(root/'output/audio/story-voice') and run != root/'output/audio/story-voice'
                and qa.is_relative_to(run) and alignment.is_relative_to(run), 'Supplement artifacts must stay in private current workspace')
        require(digest(run/'lines.private.json') == record['manifest_sha256'] and digest(qa) == record['qa_sha256']
                and digest(alignment) == record['alignment_sha256'], 'Supplement bound report changed')
        expected = read(run/'lines.private.json').get('lines', []); run_ids = ids([r.get('id') for r in expected], 'supplement IDs')
        removed = ids(record['removed_current_ids'], 'removed current IDs')
        require(removed <= run_ids and removed <= set(withdrawn) and not removed & current_ids,
                'Unknown or still-current per-run withdrawal')
        selected = run_ids - removed
        require(run_ids and selected and selected <= requested and not seen & run_ids,
                'Unknown/duplicate/unrequested supplement Source')
        # Validate every charged recording, including withdrawn rows, before filtering.
        frozen, extra, extra_paths = strict.validate_run(run, qa, alignment, len(run_ids), root)
        run_profiles = read(run/'profiles.private.json')
        for row in frozen['lines']:
            if row['id'] in removed:
                approval = withdrawn[row['id']]
                require(isinstance(approval, dict) and isinstance(approval.get('reason'), str)
                        and len(approval['reason'].strip()) >= 20, 'Explicit withdrawal reason required')
                expected_proof = withdrawal_record(run, row, current, inventory_path, root)
                require({key: value for key, value in approval.items() if key != 'reason'} == expected_proof,
                        'Root withdrawn Source proof differs from actual frozen/current branch')
                continue
            voice = exact_source(row, rows[row['id']], profiles)
            require(run_profiles['speakers'][row['speaker']]['google_voice'] == voice, 'Supplement fixed voice differs from current cast')
        for clip in extra:
            require(clip['voice'] == profiles['speakers'][clip['speaker']]['google_voice'], 'Qualified clip preset differs')
        clips.extend(clip for clip in extra if clip['id'] in selected)
        paths.update({ident: path for ident, path in extra_paths.items() if ident in selected})
        covered.update(selected); seen.update(run_ids); removed_all.update(removed)
        provenance = [run/name for name in ['lines.private.json', 'prepared.json', 'profiles.private.json',
                      'requests.jsonl', 'full-inventory.private.json', 'source-snapshot.private.json', 'collection.private.json']]
        provenance.extend(path for row in frozen['lines']
                          if (path := run/'raw'/(row['id']+'.receipt.json')).is_file())
        for file in [*provenance, qa, alignment, *extra_paths.values()]:
            input_hashes[str(file)] = digest(file)
    require(covered == requested, 'Every explicitly requested changed/new Source must be fully covered')
    require(removed_all == set(withdrawn), 'Undeclared or unused Root withdrawal mappings')
    kept, old_paths, retired_rows = existing_assets(target, selection['existing_manifest_sha256'], rows,
                                                   profiles, requested, retired)
    clips = kept + clips; paths = {**old_paths, **paths}
    require(len(clips) == len(paths) == len({c['id'] for c in clips}), 'Duplicate combined clip coverage')
    manifest = {'model': strict.MODEL, 'aliases': copy.deepcopy(current.get('aliases', {})),
                'scene_players': copy.deepcopy(current.get('scene_players', {})), 'clips': clips}
    manifest['runtime_lookup'] = selectors(clips, manifest['aliases'])
    included = set(paths); missing = sorted(current_ids - included)
    status = 'qualified_partial_story_bank' if missing else 'qualified_current_source_coverage'
    for clip in clips:
        row = rows[clip['id']]
        clip['source_text_sha256'] = strict.sha(row['text'].encode())
        clip['current_source_row_sha256'] = strict.sha(strict.canonical(row).encode())
    manifest['current_source_coverage'] = {'method': VERSION, 'status': status,
        'full_original_bank_approved': False, 'current_inventory_sha256': digest(inventory_path),
        'current_source_count': len(current_ids), 'included_ids': sorted(included), 'missing_ids': missing,
        'source_files_sha256': copy.deepcopy(current['source_hashes'])}
    for file in [inventory_path, profiles_path, args.root_selection.resolve(), args.supplements.resolve()]:
        input_hashes[str(file)] = digest(file)
    if target.exists():
        input_hashes[str(target/'manifest.json')] = digest(target/'manifest.json')
        for file in target.glob('*.mp3'): input_hashes[str(file)] = digest(file)
    prolog = root/'game/public/audio/prolog'
    prolog_hashes = {str(file): digest(file) for file in prolog.iterdir()} if prolog.exists() else {}
    drivers = ['story_voice_incremental_publish.py', 'story_voice_publish.py', 'story_voice_common.py',
               'story_voice_qa.py', 'story_voice_word_cues.py', 'prolog_voice_word_cues.py',
               'prolog_voice_generate.py', 'prolog_voice_batch.py', 'story_voice_inventory.mjs']
    driver_hashes = {str(Path(__file__).with_name(name)): digest(Path(__file__).with_name(name)) for name in drivers}
    coverage = {'method': VERSION, 'status': status,
                'full_original_bank_approved': False, 'current_inventory_sha256': digest(inventory_path),
                'current_source_count': len(current_ids), 'requested_ids': sorted(requested),
                'withdrawn_ids': copy.deepcopy(withdrawn), 'fully_qualified_frozen_ids': sorted(seen),
                'included_ids': sorted(included), 'missing_ids': missing, 'retired': retired_rows,
                'source_hashes': current['source_hashes'], 'scanner': scanner, 'protected_driver_sha256': driver_hashes,
                'prolog_files_sha256': prolog_hashes,
                'input_files_sha256': input_hashes, 'Root_selection_sha256': digest(args.root_selection),
                'supplements_sha256': digest(args.supplements), 'profiles_sha256': digest(profiles_path)}
    return manifest, paths, coverage


def publish(target, manifest, paths, before_swap=None):
    """Reuse strict copying, then atomically replace even an explicitly retired bank."""
    require(not target.is_symlink(), 'Unsafe symlink Story destination')
    target = target.resolve(); target.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.story-incremental-', dir=target.parent))
    backup = None
    try:
        staging = stage/'audio/story'
        strict.publish(staging, manifest, paths)
        if before_swap is not None: before_swap()
        if target.exists():
            backup = stage/'previous-story'; target.rename(backup)
        try:
            staging.rename(target)
        except BaseException:
            if backup: backup.rename(target)
            raise
        if backup: shutil.rmtree(backup)
    finally:
        # A failed rollback must retain the previous bank for recovery.
        if backup is None or not backup.exists(): shutil.rmtree(stage, ignore_errors=True)


@contextmanager
def publication_lock(root):
    folder = root/'output/audio/story-voice'; folder.mkdir(parents=True, exist_ok=True)
    with (folder/'publish.lock').open('a+') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def recheck(root, paths, manifest, coverage):
    root = root.resolve()
    target = root/'game/public/audio/story'
    require(not target.is_symlink() and target.resolve() == target, 'Story destination changed before swap')
    if str(target/'manifest.json') not in coverage['input_files_sha256']:
        require(not target.exists(), 'Unexpected Story bank appeared before swap')
    else:
        expected = {Path(name).name for name in coverage['input_files_sha256'] if Path(name).parent == target}
        require(target.is_dir() and {file.name for file in target.iterdir()} == expected
                and all(file.is_file() and not file.is_symlink() for file in target.iterdir()),
                'Existing Story directory changed before swap')
    for name, expected in coverage['source_hashes'].items():
        require(digest(strict.contained(root, name)) == expected, 'Current Source changed before atomic swap')
    for table in ['input_files_sha256', 'protected_driver_sha256']:
        require(all(digest(Path(name)) == expected for name, expected in coverage[table].items()),
                'Input/protected evidence changed before atomic swap')
    require(all(digest(paths[c['id']]) == c['sha256'] for c in manifest['clips']),
            'Current clip changed before atomic swap')
    recheck_prolog(root, coverage)


def recheck_prolog(root, coverage):
    prolog = root.resolve()/'game/public/audio/prolog'
    actual = {str(file): digest(file) for file in prolog.iterdir()} if prolog.exists() else {}
    require(actual == coverage['prolog_files_sha256'], 'Prolog changed during incremental publication')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['current-inventory', 'profiles', 'root-selection', 'supplements', 'public-dir', 'coverage-report']:
        parser.add_argument('--'+name, type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--dry-run', action='store_true'); mode.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        root = strict.source_root(args.current_inventory)
        require(args.coverage_report.resolve().is_relative_to(root/'output/audio/story-voice')
                and not args.coverage_report.exists() and not args.coverage_report.is_symlink(),
                'New private coverage report required')
        with publication_lock(root):
            manifest, paths, coverage = build(args)
            # Full second strict validation and hashes before any public mutation.
            repeated, repeated_paths, repeated_coverage = build(args)
            require(manifest == repeated and paths == repeated_paths and coverage == repeated_coverage,
                    'Source/audio/reports/selection changed before publication')
            if args.apply:
                publish(args.public_dir, manifest, paths, before_swap=lambda: recheck(root, paths, manifest, coverage))
                recheck_prolog(root, coverage)
        args.coverage_report.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(args.coverage_report, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w') as output:
            output.write(json.dumps(coverage, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps({'status': 'published_partial' if args.apply else 'validated_partial',
                          'included': len(paths), 'missing': len(coverage['missing_ids']),
                          'retired': len(coverage['retired']), 'coverage_report': str(args.coverage_report)}))
        return 0
    except (Invalid, OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, str(error)+'\n')


if __name__ == '__main__': raise SystemExit(main())
