#!/usr/bin/env node
/** Real-scanner regression: private candidate only, never replace the reviewed/public freeze. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'selantis-inventory-regression-'));
try {
  const candidatePath = path.join(temporary, 'candidate.json');
  execFileSync(process.execPath, [path.join(root, 'scripts/story_voice_inventory.mjs'), '--propose', '--output', candidatePath], { cwd: root, encoding: 'utf8' });
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  const frozenPath = path.join(root, 'docs/voice-production/story-lines.json');
  const frozen = JSON.parse(fs.readFileSync(frozenPath, 'utf8'));
  assert.equal(candidate.lines.length, 1557);
  assert.equal(candidate.runtime_lookup.length, 1751);
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
  expectMood('Ich bin nicht klein. Ich kann auch zuhören.', 'angry');
  const neutral = candidate.runtime_lookup.find(key => key.kind === 'say' && key.speaker === 'lia' && key.mood === 'neutral');
  assert.ok(neutral, 'Calls without a mood still produce neutral runtime selectors');
  console.log(JSON.stringify({ lines: candidate.lines.length, runtime_keys: candidate.runtime_lookup.length, unresolved: candidate.unresolved.length, corrected_mood_keys: corrected, asset_ids_texts_directions_preserved: true }, null, 2));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
