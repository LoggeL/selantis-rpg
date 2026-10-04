import type Phaser from 'phaser';

// Animationen: Schlüssel -> [Sheet, Frames, fps, loop]
const ANIMS: Record<string, [string, number[], number, boolean]> = {};
const dirs = ['s', 'w', 'e', 'n'] as const;
dirs.forEach((d, r) => {
  ANIMS[`v-idle-${d}`] = ['valentus-walk', [r * 4], 1, false];
  ANIMS[`v-walk-${d}`] = ['valentus-walk', [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3], 8, true];
  ANIMS[`v-beam-${d}`] = ['valentus-cast', [r * 4, r * 4 + 1], 10, false];
  ANIMS[`v-wave-${d}`] = ['valentus-cast', [r * 4, r * 4 + 2], 10, false];
  ANIMS[`v-guard-${d}`] = ['valentus-cast', [r * 4 + 3], 1, false];
  ANIMS[`vc-run-${d}`] = ['valentus-cloak-run', [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3], 7, true];
  for (const profile of ['lia', 'lia-farm', 'lia-travel', 'lia-cloak']) {
    ANIMS[`${profile}-walk-${d}`] = [`${profile}-walk`, [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3], 7, true];
    ANIMS[`${profile}-idle-${d}`] = [`${profile}-walk`, [r * 4 + 1], 1, false];
  }
  for (const companion of ['foltan', 'azar']) {
    ANIMS[`${companion}-walk-${d}`] = [`${companion}-walk`, [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3], 7, true];
    ANIMS[`${companion}-idle-${d}`] = [`${companion}-walk`, [r * 4 + 1], 1, false];
  }
  // Flick's native 6-column sheet preserves all six footfall phases per direction.
  ANIMS[`flick-walk-${d}`] = ['flick-walk', Array.from({ length: 6 }, (_unused, frame) => r * 6 + frame), 8, true];
  ANIMS[`flick-idle-${d}`] = ['flick-walk', [r * 6 + 1], 1, false];
  // Each authored direction has opposite foot contacts and passing phases.
  const low = [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3];
  ANIMS[`lia-crouch-walk-${d}`] = ['lia-crouch-walk', low, 5, true];
  ANIMS[`lia-crouch-idle-${d}`] = ['lia-crouch-walk', [low[0]], 1, true];
});
Object.assign(ANIMS, {
  // These NPCs have one authored standing frame and no directional walking sheet.
  'craupor-idle': ['craupor-idle', [0], 1, false],
  'elnon-idle': ['elnon-idle', [0], 1, false],
  'warrior-idle': ['warrior', [0], 1, false],
  'warrior-ready': ['warrior', [1], 1, false],
  'warrior-strike': ['warrior', [2, 3], 8, false],
  'warrior-charge': ['warrior', [4, 5, 6, 7], 9, true],
  'warrior-hit': ['warrior', [12, 13], 8, false],
  'warrior-fall': ['warrior', [13, 14, 15], 7, false],
  'axe-idle': ['axe', [0], 1, false],
  'axe-telegraph': ['axe', [1], 1, false],
  'axe-chop': ['axe', [2, 3], 8, false],
  'axe-walk': ['axe', [4, 5, 6, 7], 8, true],
  'axe-fly': ['axe', [8, 9], 8, false],
  'axe-land': ['axe', [10, 11], 6, false],
  'crossbow-idle': ['crossbow', [0], 1, false],
  'crossbow-aim': ['crossbow', [1, 2], 4, false],
  'crossbow-shoot': ['crossbow', [3], 1, false],
  'crossbow-walk': ['crossbow', [4, 5, 6, 7], 8, true],
  'crossbow-fall': ['crossbow', [8, 9, 10], 7, false],
  'boy-prone': ['boy', [0, 1], 6, true],
  'boy-rise': ['boy', [2, 3], 4, false],
  'boy-run-n': ['boy', [4, 5, 6, 7], 10, true],
  'boy-run-e': ['boy', [8, 9, 10, 11], 10, true],
  'boy-lookback': ['boy', [12, 13], 3, false],
  'boy-idle': ['boy', [14, 15], 2, true],
  'falke-charge': ['falke', [0, 1, 2, 3], 11, true],
  'falke-thrust': ['falke', [4, 5, 6, 7], 12, false],
  'falke-idle': ['falke', [8, 9], 2, true],
  'vc-stumble': ['valentus-cloak-events', [0, 1, 2, 3], 8, false],
  'vc-jump': ['valentus-cloak-events', [4, 5, 6, 7], 6, false],
  'vc-climb': ['valentus-cloak-events', [8], 1, false],
  'vc-brace': ['valentus-cloak-events', [9], 1, false],
  'vc-slip': ['valentus-cloak-events', [10, 11], 5, false],
  'vr-lie': ['valentus-refuge', [0], 1, false],
  'vr-rise': ['valentus-refuge', [1, 2, 3], 2, false],
  'vr-stagger': ['valentus-refuge', [4, 5, 6, 7], 5, false],
  'vr-brace': ['valentus-refuge', [8, 9], 3, false],
  'vr-hand': ['valentus-refuge', [10, 11], 3, false],
  'woman-idle': ['woman', [0, 1], 2, true],
  'woman-lean': ['woman', [2, 3], 3, false],
  'woman-bowl': ['woman', [4, 5], 2, true],
  'woman-leave': ['woman', [6, 7], 4, true],
  'lia-read': ['lia-read', [0], 1, false],
  'lia-shade': ['lia-read', [1], 1, false],
  'lia-close': ['lia-read', [2], 1, false],
  'lia-stand': ['lia-read', [3], 1, false],
  'lia-shoes': ['lia-read', [4, 5], 2, false],
  'lia-idle-book': ['lia-read', [6, 7], 2, true],
  'lia-hide-s': ['lia-hide', [0, 1, 2, 3], 8, false],
  'lia-hidden-s': ['lia-hide', [3], 1, true],
  'lia-hide-e': ['lia-hide', [4, 5, 6, 7], 8, false],
  'lia-hidden-e': ['lia-hide', [7], 1, true],
  'lia-grieve': ['lia-story-poses', [0], 1, false],
  'lia-pack': ['lia-story-poses', [1], 1, false],
  'lia-camp-sit-down': ['lia-camp-sit', [0, 1], 5, false],
  'lia-camp-sit': ['lia-camp-sit', [1, 2], 1, true],
  'lia-camp-stand-up': ['lia-camp-sit', [3], 1, false],
  'lia-sleep': ['lia-story-poses', [2], 1, false],
  'lia-wake': ['lia-story-poses', [3], 1, false],
  'lia-travel': ['lia-story-poses', [6], 1, false],
  'road-wagon-walk': ['road-travelers-walk', [0, 1, 2, 3], 7, true],
  'road-troupe-walk': ['road-travelers-walk', [4, 5, 6, 7], 7, true],
  'raid-horse-walk': ['raid-horse', [0, 1, 2, 3], 10, true],
  // Tiere der offenen Welt
  'butterfly-a': ['crt-butterfly', [0, 1, 2, 3], 10, true],
  'butterfly-b': ['crt-butterfly', [4, 5, 6, 7], 10, true],
  'bird-peck': ['crt-bird', [0, 1], 3, true],
  'bird-hop': ['crt-bird', [2, 3], 8, true],
  'bird-fly': ['crt-bird', [4, 5, 6, 7], 12, true],
  'hare-sit': ['crt-hare', [0, 1], 2, true],
  'hare-alert': ['crt-hare', [2], 1, false],
  'hare-run': ['crt-hare', [4, 5, 6, 7], 14, true],
  'chicken-walk': ['crt-chicken', [0, 1, 2, 3], 8, true],
  'chicken-peck': ['crt-chicken', [4, 5, 6], 4, true],
  'chicken-flap': ['crt-chicken', [7, 4], 10, true],
  'pig-idle': ['crt-pig', [0, 1], 1.5, true],
  'pig-eat': ['crt-pig', [4, 5], 4, true],
  'pig-happy': ['crt-pig', [6, 0], 2, true],
});


/** Register animations only after their chapter textures are available. */
export function createAvailableAnimations(scene: Phaser.Scene) {
  for (const [key, [sheet, frames, fps, loop]] of Object.entries(ANIMS)) {
    if (!scene.textures.exists(sheet) || scene.anims.exists(key)) continue;
    const texture = scene.textures.get(sheet);
    if (frames.some(frame => !texture.has(String(frame)))) throw new Error(`Missing frame for animation ${key}`);
    scene.anims.create({ key, frames: frames.map(frame => ({ key: sheet, frame })), frameRate: fps, repeat: loop ? -1 : 0 });
  }
}
