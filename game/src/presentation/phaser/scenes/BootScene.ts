import { assetUrl } from "../../../platform/assets/url";
import Phaser from 'phaser';
import { bindSceneInput } from '../../../platform/input/router';
import { unlockAudio } from "../../../app/audio";
import { preloadPack } from "../../../platform/assets/sceneAssets";
import { validateAssetManifest } from "../../../platform/assets/schema.mjs";
import { startInitialScene } from "../../../app/bootstrap";
import type { AssetManifest } from "../../../content/assets/types";

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    this.load.json('manifest', assetUrl('assets/runtime-manifest.json'));
    this.load.once('filecomplete-json-manifest', () => {
      validateAssetManifest(this.cache.json.get('manifest'));
      preloadPack(this, 'title');
    });
  }

  async create() {
    try { await document.fonts.load('11px "Pixelify Sans"'); } catch { /* Fallback-Schrift */ }
    // Kleine generierte Texturen
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('px', 2, 2).clear();
    g.fillStyle(0x000000, 0.35).fillEllipse(12, 4, 24, 8).generateTexture('shadow', 24, 8).clear();
    // Anonymous speakers keep their name, with an intentional silhouette until identified.
    g.fillStyle(0x152019).fillRect(0, 0, 192, 192);
    g.fillStyle(0x6b756d).fillCircle(96, 67, 38).fillEllipse(96, 166, 148, 112);
    g.generateTexture('portrait-unknown', 192, 192).clear();
    g.destroy();
    const vig = this.textures.createCanvas('vignette', 640, 360)!;
    const c = vig.getContext();
    const grad = c.createRadialGradient(320, 180, 120, 320, 180, 380);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 640, 360);
    vig.refresh();

    const icons = (this.cache.json.get('manifest') as AssetManifest).iconNames;
    this.registry.set('icon', (name: string) => icons.indexOf(name));

    startInitialScene(this);
  }
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    this.cameras.main.setBackgroundColor('#07080a');
    this.data.set('mobile:name', 'Die Chroniken von Selantis');
    this.data.set('mobile:hudVisible', false);
    if (this.textures.exists('bg-title-splash')) {
      this.add.image(320, 180, 'bg-title-splash').setDisplaySize(640, 360);
    }
    this.add.rectangle(183, 179, 342, 234, 0x07100a, 0.88);
    const t = this.add.text(30, 104, 'Die Chroniken\nvon Selantis', {
      fontFamily: 'Pixelify Sans', fontSize: '30px', color: '#f4ecd8', lineSpacing: 4,
    }).setAlpha(0);
    const s = this.add.text(30, 212, 'Prolog beginnen\nKlicken oder Taste drücken', {
      fontFamily: 'Pixelify Sans', fontSize: '14px', color: '#d5c9b0', lineSpacing: 5,
    }).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 1400 });
    this.tweens.add({ targets: s, alpha: { from: 0.2, to: 0.9 }, duration: 1100, yoyo: true, repeat: -1, delay: 1000 });
    let leaving = false;
    const go = () => {
      if (leaving) return;
      leaving = true;
      unlockAudio();
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('storyprologue'));
    };
    bindSceneInput(this, {
      confirm: intent => { if (intent.phase !== 'end') go(); },
      interact: intent => { if (intent.phase !== 'end') go(); },
      continue: intent => { if (intent.phase !== 'end') go(); },
    });
    this.input.once('pointerdown', go);
    this.input.keyboard!.once('keydown', go);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', go);
      this.input.keyboard?.off('keydown', go);
    });
  }
}
