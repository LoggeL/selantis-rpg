import Phaser from 'phaser';
import { unlockAudio } from '../audio';

type Manifest = {
  sprites: Record<string, { file: string; frameW: number; frameH: number }>;
  images: Record<string, string>;
  icons: { file: string; size: number; names: string[] };
  items?: { file: string; size: number };
};

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
  ANIMS[`lia-walk-${d}`] = ['lia-walk', [r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3], 7, true];
  ANIMS[`lia-idle-${d}`] = ['lia-walk', [r * 4], 1, false];
});
Object.assign(ANIMS, {
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
  'lia-sleep': ['lia-story-poses', [2], 1, false],
  'lia-wake': ['lia-story-poses', [3], 1, false],
  'lia-bound-kneel': ['lia-story-poses', [4], 1, false],
  'lia-bound-sit': ['lia-story-poses', [4], 1, false],
  'lia-bound-stand': ['lia-story-poses', [5], 1, false],
  'lia-travel': ['lia-story-poses', [6], 1, false],
  'lia-footcare': ['lia-story-poses', [7], 1, false],
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

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    this.load.json('manifest', 'assets/manifest.json');
    this.load.once('filecomplete-json-manifest', () => {
      const m = this.cache.json.get('manifest') as Manifest;
      for (const [id, s] of Object.entries(m.sprites)) this.load.spritesheet(id, s.file, { frameWidth: s.frameW, frameHeight: s.frameH });
      for (const [id, file] of Object.entries(m.images)) this.load.image(id, file);
      this.load.spritesheet('icons', m.icons.file, { frameWidth: m.icons.size, frameHeight: m.icons.size });
      if (m.items) this.load.spritesheet('items', m.items.file, { frameWidth: m.items.size, frameHeight: m.items.size });
    });
  }

  async create() {
    try { await document.fonts.load('11px "Pixelify Sans"'); } catch { /* Fallback-Schrift */ }
    for (const [k, [sheet, frames, fps, loop]] of Object.entries(ANIMS)) {
      if (!this.textures.exists(sheet)) continue;
      this.anims.create({ key: k, frames: frames.map((f) => ({ key: sheet, frame: f })), frameRate: fps, repeat: loop ? -1 : 0 });
    }
    // Kleine generierte Texturen
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('px', 2, 2).clear();
    g.fillStyle(0x000000, 0.35).fillEllipse(12, 4, 24, 8).generateTexture('shadow', 24, 8).clear();
    g.destroy();
    const vig = this.textures.createCanvas('vignette', 640, 360)!;
    const c = vig.getContext();
    const grad = c.createRadialGradient(320, 180, 120, 320, 180, 380);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 640, 360);
    vig.refresh();

    const icons = (this.cache.json.get('manifest') as Manifest).icons.names;
    this.registry.set('icon', (name: string) => icons.indexOf(name));

    const scene = new URLSearchParams(location.search).get('scene');
    if (scene) {
      const unlock = () => unlockAudio();
      this.input.once('pointerdown', unlock);
      this.input.keyboard!.once('keydown', unlock);
      this.scene.start(scene);
    } else {
      this.scene.start('title');
    }
  }
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    this.cameras.main.setBackgroundColor('#07080a');
    const t = this.add.text(320, 160, 'SELANTIS', { fontFamily: 'Pixelify Sans', fontSize: '32px', color: '#d8d2c0' }).setOrigin(0.5).setAlpha(0);
    const s = this.add.text(320, 205, 'Klicken oder Taste drücken', { fontFamily: 'Pixelify Sans', fontSize: '10px', color: '#8a8478' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 1400 });
    this.tweens.add({ targets: s, alpha: { from: 0.2, to: 0.9 }, duration: 1100, yoyo: true, repeat: -1, delay: 1000 });
    const go = () => {
      unlockAudio();
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('battle'));
    };
    this.input.once('pointerdown', go);
    this.input.keyboard!.once('keydown', go);
  }
}
