import { assetUrl } from './assetUrl';
import type Phaser from 'phaser';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { loadDialoguePortraits, parseDialogue, resolvePortrait, SPEAKER_PORTRAITS } from './portraits';
import manifest from '../public/assets/manifest.json';

const UI_LABELS = new Set(['Blau', 'R', 'Bolzenlinie', 'Blickrichtung', 'Danach', 'E', 'E halten', 'E halten / Baum gedrückt halten', 'Am Abend', 'E / Klick', 'E / Maus halten', 'WASD / Klick', 'WASD / Pfeiltasten', 'WASD / Pfeile', 'Leertaste halten', 'E oder Wunde anklicken', 'Gedrückt halten']);
const OBSERVATIONS = new Set(['Westen', 'Vaters doppelter Boden']);
const sourceFiles = import.meta.glob<string>(['./scenes/*.ts', './story/**/*.ts', './world/**/*.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true });
const portraitFiles = new Set(Object.keys(import.meta.glob('../public/assets/portraits/*.png', { query: '?url', import: 'default', eager: true })).map(path => path.replace('../public/', '')));

/** Scan literals, content arrays and explicitly supplied speaker arguments. */
function speakerLabels(code: string): Set<string> {
  const file = ts.createSourceFile('dialogue.ts', code, ts.ScriptTarget.Latest, true);
  const labels = new Set<string>();
  const literal = (node?: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral => !!node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
  const add = (name: string) => { if (!UI_LABELS.has(name) && !OBSERVATIONS.has(name)) labels.add(name); };
  function visit(node: ts.Node) {
    if (literal(node)) {
      const label = /^\s*([\p{Lu}][\p{L} ()/-]{0,31}):\s*/u.exec(node.text);
      if (label) add(label[1].trim());
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === 'setText' && literal(node.arguments[1])) add(node.arguments[1].text);
      if (method === 'say' && literal(node.arguments[0]) && literal(node.arguments[1])) add(node.arguments[0].text);
    }
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === 'speaker' && literal(node.initializer)) add(node.initializer.text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return labels;
}

const actualSpeakers = new Set(['Valentus', 'Junge']); // On-screen voiced identities in the prologue.
for (const source of Object.values(sourceFiles)) for (const label of speakerLabels(source)) actualSpeakers.add(label);

function registeredAssets() {
  const assets = new Map(Object.entries(manifest.images).map(([key, path]) => [key, assetUrl(path)]));
  loadDialoguePortraits({ load: { image: (key: string, path: string) => assets.set(key, path) } } as unknown as Phaser.Scene);
  return assets;
}

describe('speaking cast portrait coverage', () => {
  it('discovers structured lines and arrays, and rejects new unregistered speakers', () => {
    const labels = speakerLabels(`const lines = ['Testreiter: Halt!']; this.setText(lines[index]); this.say('Gast', 'Guten Abend', 3000); this.dialogue.setText('Weiter.', 'Besucherin'); this.say('Westen: Trapas.');`);
    expect([...labels].sort()).toEqual(['Besucherin', 'Gast', 'Testreiter']);
    expect([...labels].filter(label => !(label.toLocaleLowerCase('de') in SPEAKER_PORTRAITS))).toEqual(['Testreiter', 'Gast', 'Besucherin']);
  });

  it('registers every labeled source dialogue, including the refuge speaker argument', () => {
    expect(actualSpeakers.has('Mann')).toBe(true);
    expect(actualSpeakers.has('Narbiger')).toBe(true);
    const missing = [...actualSpeakers].filter(label => !(label.toLocaleLowerCase('de') in SPEAKER_PORTRAITS));
    expect(missing, 'A new speaking character needs its own portrait registry entry.').toEqual([]);
    for (const name of actualSpeakers) expect(parseDialogue(`${name}: Eine Zeile.`).name).toBe(name);
  });

  it('loads all actual speaking portraits from existing files, without anonymous substitutions', () => {
    const assets = registeredAssets();
    const missingFiles = [...assets.entries()].filter(([key, path]) => key.startsWith('portrait-') && !portraitFiles.has(path.split(/[?#]/)[0]));
    expect(missingFiles, 'Boot must load the authored portrait files before dialogue begins.').toEqual([]);
    const scene = { sys: { settings: { key: 'raid' } }, textures: { exists: (key: string) => assets.has(key) && portraitFiles.has(assets.get(key)!.split(/[?#]/)[0]) } } as unknown as Phaser.Scene;
    for (const name of actualSpeakers) {
      const portrait = resolvePortrait(scene, name);
      expect(portrait, `${name} needs a loaded portrait`).toBeDefined();
      expect(portrait?.texture, `${name} must show their own face`).not.toBe('portrait-unknown');
      expect(portrait?.src, `${name} needs the native mobile image too`).toBeTruthy();
      expect(assets.get(portrait!.texture)).toBe(portrait!.src);
    }
  });

  it('uses distinct authored faces for the three formerly anonymous speaking characters', () => {
    const assets = registeredAssets();
    const scene = { textures: { exists: (key: string) => assets.has(key) } } as unknown as Phaser.Scene;
    expect(resolvePortrait(scene, 'Narbiger')?.src).toBe(assetUrl('assets/portraits/dialogue-scarred.png'));
    expect(resolvePortrait(scene, 'Kapuzenmann')?.src).toBe(assetUrl('assets/portraits/dialogue-hooded.png'));
    expect(resolvePortrait(scene, 'Mann')?.src).toBe(assetUrl('assets/portraits/dialogue-refuge-man.png'));
    expect(assets.get('portrait-woman')).toBe(assetUrl('assets/portraits/woman.png'));
    expect(assets.get('portrait-boy')).toBe(assetUrl('assets/portraits/boy.png'));
    expect(assets.get('portrait-valentus')).toBe(assetUrl('assets/portraits/valentus.png'));
  });
});
