import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkArchitecture, formatDiagnostic } from './check_architecture.mjs';

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'selantis-architecture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), source);
  }
  return root;
}

test('allows module dependencies, content module types, and registry ports', t => {
  const root = fixture(t, {
    'modules/campaign/state.ts': 'export interface State { flags: Record<string, boolean> }; export const initial = { flags: {} };',
    'modules/camp/rules.ts': "import type { State } from '../campaign/state'; export const ready = (state: State) => !!state.flags.ready;",
    'content/chapter.ts': "import { type State } from '../modules/campaign/state'; export const checkpoint: State = { flags: { ready: true } };",
    'platform/registry.ts': "import { initial } from '../modules/campaign/state'; export const load = (registry: { get(key: string): unknown }) => registry.get('world') ?? initial;",
  });
  assert.deepEqual(checkArchitecture(root), []);
});

test('rejects outward imports, runtime content imports, and DOM/I/O access', t => {
  const root = fixture(t, {
    'content/chapter.ts': "import { initial } from '../modules/state'; export const chapter = initial;",
    'modules/state.ts': 'export const initial = {};',
    'modules/bad.ts': "import type { Scene } from 'phaser';\nimport '../content/chapter';\nexport const read = () => window.localStorage.getItem('save');\nfetch('/save');",
  });
  const diagnostics = checkArchitecture(root);
  assert.deepEqual(diagnostics.map(d => d.rule), ['content-types', 'external-import', 'module-boundary', 'pure-code', 'pure-code']);
  assert.match(formatDiagnostic(diagnostics[1]), /^modules\/bad.ts:1:1 \[external-import\]/);
  assert.deepEqual(checkArchitecture(root), diagnostics);
});

test('checks re-exports, import types, and dynamic imports without parsing comments', t => {
  const root = fixture(t, {
    'content/chapter.ts': 'export interface Chapter {}',
    'modules/bad.ts': "// import '../content/chapter';\nconst text = \"window.fetch()\";\nexport type { Chapter } from '../content/chapter';\ntype Hidden = import('../content/chapter').Chapter;\nconst load = () => import('../content/chapter');\nconst variable = (path: string) => import(path);",
  });
  assert.deepEqual(checkArchitecture(root).map(d => d.rule), ['module-boundary', 'module-boundary', 'module-boundary', 'pure-load', 'dynamic-import', 'pure-load']);
});

test('keeps platform generic and detects missing paths and globalThis access', t => {
  const root = fixture(t, {
    'content/encounters/tutorial.ts': 'export const tutorial = {};',
    'platform/bad.ts': "import '../content/encounters/tutorial';",
    'modules/bad.ts': "import './missing';\nexport const schedule = globalThis.setTimeout;\nexport const read = globalThis['document'];",
  });
  assert.deepEqual(checkArchitecture(root).map(d => d.rule), ['unresolved-import', 'pure-code', 'pure-code', 'platform-boundary']);
});
