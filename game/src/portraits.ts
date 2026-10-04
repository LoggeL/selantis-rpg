import type Phaser from 'phaser';

/** Source-art face crops; the shared loader keeps them separate from map textures. */
export const DIALOGUE_PORTRAITS = {
  kyra: 'kyra', foltan: 'foltan', azar: 'azar', father: 'father', mother: 'mother', 'grey-haired': 'grey-haired-message06',
} as const;

/** Generated profiles are separate from the compact gameplay/stat portraits. */
export const EXPRESSION_PORTRAITS = {
  lia: 'dialogue-lia', valentus: 'dialogue-valentus', kyra: 'dialogue-kyra',
  foltan: 'dialogue-foltan', azar: 'dialogue-azar',
  grief: 'dialogue-lia-grief', determined: 'dialogue-lia-determined',
  scarred: 'dialogue-scarred', hooded: 'dialogue-hooded', 'refuge-man': 'dialogue-refuge-man',
} as const;

export type DialogueEmotion = 'neutral' | 'concerned' | 'determined' | 'grief' | 'defiant' | 'calm' | 'composed';
export type PortraitSpec = {
  texture: string;
  frame?: string | number;
  src?: string;
  frameIndex?: number;
  frameCount?: number;
};

export function loadDialoguePortraits(scene: Phaser.Scene) {
  for (const file of [...Object.values(DIALOGUE_PORTRAITS), ...Object.values(EXPRESSION_PORTRAITS)]) scene.load.image(`portrait-${file}`, `assets/portraits/${file}.png`);
}

export const SPEAKER_PORTRAITS: Readonly<Record<string, string>> = Object.freeze({
  lia: 'lia', 'lia (gedanke)': 'lia', valentus: 'valentus', kyra: 'kyra', foltan: 'foltan', azar: 'azar',
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
    if (scene.textures.exists(texture)) return { texture, src: `assets/portraits/${file}.png`, frameIndex: 0, frameCount: 1 };
  }
  return scene.textures.exists('portrait-unknown') ? { texture: 'portrait-unknown' } : undefined;
}
