import { assetUrl } from "../../platform/assets/url";
import type Phaser from 'phaser';

import portraitProfiles from "../../content/assets/portraits.json";

/** Names and loader registrations share the same authored profiles. */
export const DIALOGUE_PORTRAITS = portraitProfiles.dialogue;
export const EXPRESSION_PORTRAITS = portraitProfiles.expressions;

export type DialogueEmotion = 'neutral' | 'concerned' | 'determined' | 'grief' | 'defiant' | 'calm' | 'composed';
export type PortraitSpec = {
  texture: string;
  frame?: string | number;
  src?: string;
  frameIndex?: number;
  frameCount?: number;
};

export function loadDialoguePortraits(scene: Phaser.Scene) {
  for (const file of [...Object.values(DIALOGUE_PORTRAITS), ...Object.values(EXPRESSION_PORTRAITS)]) scene.load.image(`portrait-${file}`, assetUrl(`assets/portraits/${file}.png`));
}

export const SPEAKER_PORTRAITS: Readonly<Record<string, string>> = Object.freeze({
  lia: 'lia', 'lia (gedanke)': 'lia', valentus: 'valentus', kyra: 'kyra', foltan: 'foltan', azar: 'azar',
  flick: 'flick', craupor: 'craupor', elnon: 'elnon', vardis: 'vardis',
  'der schmale': 'foltan', 'der dicke': 'azar', vater: 'father', mutter: 'mother',
  grauhaariger: 'grey-haired', 'der grauhaarige': 'grey-haired', frau: 'woman', junge: 'boy',
  narbiger: 'scarred', kapuzenmann: 'hooded', mann: 'refuge-man',
});

/** Only known speakers are parsed, so observations such as "Westen: Trapas" stay intact. */
export function parseDialogue(text: string): { name?: string; text: string } {
  const match = /^\s*([^:\n]{1,32}):\s*([\s\S]*)$/.exec(text);
  if (!match || !(match[1].trim().toLocaleLowerCase('de') in SPEAKER_PORTRAITS)) return { text };
  return { name: match[1].trim(), text: match[2] };
}

export function resolvePortrait(scene: Phaser.Scene, name: string, emotion?: DialogueEmotion): PortraitSpec | undefined {
  const id = SPEAKER_PORTRAITS[name.trim().toLocaleLowerCase('de')];
  const sceneKey = scene.sys?.settings.key;
  const liaEmotion = emotion ?? (sceneKey === 'raid' || sceneKey === 'aftermath' ? 'grief' : sceneKey === 'journey' ? 'determined' : 'concerned');
  const files: string[] = [];
  if (id === 'lia' && (liaEmotion === 'grief' || liaEmotion === 'determined')) files.push(EXPRESSION_PORTRAITS[liaEmotion]);
  if (id && id in EXPRESSION_PORTRAITS) files.push(EXPRESSION_PORTRAITS[id as keyof typeof EXPRESSION_PORTRAITS]);
  if (id && id !== 'unknown') files.push(id in DIALOGUE_PORTRAITS ? DIALOGUE_PORTRAITS[id as keyof typeof DIALOGUE_PORTRAITS] : id);
  for (const file of files) {
    const texture = `portrait-${file}`;
    if (scene.textures.exists(texture)) return { texture, src: assetUrl(`assets/portraits/${file}.png`), frameIndex: 0, frameCount: 1 };
  }
  return scene.textures.exists('portrait-unknown') ? { texture: 'portrait-unknown' } : undefined;
}
