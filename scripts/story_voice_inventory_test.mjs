#!/usr/bin/env node
/** Real-scanner regression: private candidate only, never replace the reviewed/public freeze. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(import.meta.url)('../game/node_modules/typescript');
// Exercise the actual evaluator without changing any gameplay Source or executing its module CLI.
const scannerSource = fs.readFileSync(path.join(root, 'scripts/story_voice_inventory.mjs'), 'utf8');
const evaluatorSource = scannerSource.slice(scannerSource.indexOf('function evalNode('), scannerSource.indexOf('\nfunction strings('));
const evaluate = new Function('ts', 'decl', 'evaluatingSpeech', 'issue', `${evaluatorSource}; return evalNode;`)(ts, () => undefined, false, () => assert.fail('Literal fixture must not require a speech binding'));
const conditional = (expression, binding) => {
  const sf = ts.createSourceFile('conditional-fixture.ts', expression, ts.ScriptTarget.ES2022, true);
  const node = sf.statements[0].expression;
  const env = new Map();
  if (binding !== undefined) env.set(node.condition.left, binding);
  return evaluate(node, env);
};
assert.deepEqual(conditional("id === 'orwen' ? 'warning' : 'hex'", ['orwen']), ['warning']);
assert.deepEqual(conditional("id === 'orwen' ? 'warning' : 'hex'", ['algard']), ['hex']);
assert.deepEqual(conditional("id !== 'orwen' ? 'hex' : 'warning'", ['orwen']), ['warning']);
assert.deepEqual(conditional("id !== 'orwen' ? 'hex' : 'warning'", ['algard']), ['hex']);
assert.deepEqual(conditional("id === 'orwen' ? 'warning' : 'hex'", ['orwen', 'algard']), ['warning', 'hex']);
assert.deepEqual(conditional("id === 'orwen' ? 'warning' : 'hex'"), ['warning', 'hex']);
assert.deepEqual(conditional("counter === 1 ? 'first' : 'later'"), ['first', 'later']);
assert.deepEqual(conditional("state.counter === 1 ? 'first' : 'later'"), ['first', 'later']);
assert.deepEqual(conditional("1 === '1' ? 'equal' : 'different'"), ['different']);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'selantis-inventory-regression-'));
try {
  const candidatePath = path.join(temporary, 'candidate.json');
  execFileSync(process.execPath, [path.join(root, 'scripts/story_voice_inventory.mjs'), '--propose', '--output', candidatePath], { cwd: root, encoding: 'utf8' });
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  const frozenPath = path.join(root, 'docs/voice-production/story-lines.json');
  const frozen = JSON.parse(fs.readFileSync(frozenPath, 'utf8'));
  assert.equal(candidate.lines.length, 1580);
  assert.equal(candidate.runtime_lookup.length, 1774);
  assert.equal(candidate.unresolved.length, 0);
  const old = new Map(frozen.lines.map(line => [line.id, line]));
  for (const line of candidate.lines) {
    const original = old.get(line.id);
    assert.ok(original, `Unchanged recording asset ID: ${line.id}`);
    for (const field of ['speaker', 'kind', 'text', 'direction_en']) assert.deepEqual(line[field], original[field], `${line.id}/${field}`);
  }
  const lookupKey = key => JSON.stringify([key.kind, key.speaker, key.text, key.scene, key.asset_id]);
  const frozenRoutes = new Map(frozen.runtime_lookup.map(key => [lookupKey(key), key]));
  let corrected = 0;
  const changed = [];
  for (const key of candidate.runtime_lookup) {
    const prior = frozenRoutes.get(lookupKey(key));
    assert.ok(prior, `Runtime words/speaker/scene unchanged: ${lookupKey(key)}`);
    assert.equal(key.asset_id, prior.asset_id);
    assert.equal(key.performance_variant, prior.performance_variant);
    if (key.mood !== prior.mood) { corrected++; changed.push(key); assert.equal(prior.mood, 'neutral'); }
  }
  assert.ok(corrected === 85 || corrected === 0, 'Either the original freeze needs all 85 corrections, or the release freeze is already corrected');
  assert.equal(new Set(changed.map(key => key.asset_id)).size, corrected ? 83 : 0, 'Exactly 83 recording assets retain IDs when correcting the original freeze');
  const expectMood = (text, mood) => {
    const routes = candidate.runtime_lookup.filter(key => key.kind === 'say' && key.speaker === 'lia' && key.text === text);
    assert.ok(routes.length, `Real scanner found actual wrapper call: ${text}`);
    for (const route of routes) assert.equal(route.mood, mood, `${text}/${route.scene}`);
  };
  expectMood('AAAAAH!', 'scared');
  expectMood('Waren gestern Dunkelschatten hier? Mit einem Mädchen, so groß wie ich?', 'neutral');
  expectMood('Soll ich weiterlesen, oder glaubt ihr mir jetzt?', 'happy');
  expectMood('Ich bin nicht klein. Ich bin nur noch nicht fertig.', 'angry');
  assert.ok(!candidate.lines.some(line => line.text === 'Ich bin nicht klein. Ich kann auch zuhören.'), 'Removed dialogue does not return through an old test fixture');
  const retreatPairs = candidate.lines.filter(line => line.kind === 'bark' && ['Weg hier! Alle weg!', 'Hexerei!'].includes(line.text) && line.sources.some(source => source.file.endsWith('/rettung.ts'))).map(line => [line.speaker, line.text]).sort();
  assert.deepEqual(retreatPairs, [['algard', 'Hexerei!'], ['maedchen', 'Hexerei!'], ['orwen', 'Weg hier! Alle weg!'], ['schuetze', 'Hexerei!']], 'Actual loop keeps each speaker correlated with its selected conditional branch');
  for (const text of ['Angetäuscht! Warte bis zuletzt.', 'Zu früh. Wieder.', 'AU! Mein Kopf!', 'Schon wieder …!']) {
    assert.ok(candidate.lines.some(line => line.text === text), `Mutable counters retain both real speech branches: ${text}`);
  }
  assert.deepEqual(candidate.source_hashes, frozen.source_hashes, 'Scanner correction preserves all paid gameplay Source and directions hashes');
  const neutral = candidate.runtime_lookup.find(key => key.kind === 'say' && key.speaker === 'lia' && key.mood === 'neutral');
  assert.ok(neutral, 'Calls without a mood still produce neutral runtime selectors');
  console.log(JSON.stringify({ lines: candidate.lines.length, runtime_keys: candidate.runtime_lookup.length, unresolved: candidate.unresolved.length, corrected_mood_keys: corrected, asset_ids_texts_directions_preserved: true }, null, 2));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
