import Phaser from 'phaser';
import { sfx, startAmbient } from '../audio';
import { FONT, Hud } from '../ui';
import { ambientPrefs, getSettings, motionDuration, subscribeSettings } from '../settings';

type Pt = { x: number; y: number };
type Phase = 'intro' | 'reading' | 'closing' | 'free' | 'title';
type Dir = 's' | 'w' | 'e' | 'n';
type Detail = 'leaf' | 'flowers' | 'breeze' | 'home';
type Bookmark = 'leaf' | 'flowers';

// Sommerabend, Roman S. 10–12. Bühne 640 x 360, Kamera steht.
const SUN: Pt = { x: 630, y: 18 };
const SIT: Pt = { x: 290, y: 182 };
/** Der Lesebogen ist größer gezeichnet als der Gehbogen (Stehhöhe 54 statt 40 px): lokal auf 3/4 verkleinert. */
const READ_ANIMS: Record<string, [number[], number, boolean]> = {
  read: [[0], 1, false], shade: [[1], 1, false], close: [[2], 1, false],
  stand: [[3], 1, false], shoes: [[4, 5], 2, false], 'idle-book': [[6, 7], 2, true],
};
const SPEED = 72;
const TRUNK = { x: 262, y: 176, rx: 22, ry: 7 };

// Begehbar (Fußpunkte): Wiese um den Baum, Weizeninsel, Böschung, Hohlweg.
const WALK = [
  70, 212, 110, 184, 172, 170, 336, 170, 410, 184, 470, 198, 540, 188, 580, 152, 588, 118, 626, 118,
  620, 160, 604, 200, 594, 250, 586, 300, 590, 356, 386, 356, 354, 320, 318, 292, 292, 264, 220, 246,
  150, 238, 80, 228,
];
// Der Hohlweg selbst (zwei Fahrspuren zwischen den Böschungen).
const LANE = [
  588, 118, 626, 118, 620, 160, 604, 200, 594, 250, 586, 300, 590, 356, 476, 356, 504, 318, 528, 276,
  556, 232, 578, 190, 590, 150,
];
const MARK: Pt = { x: 552, y: 262 };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class LiaScene extends Phaser.Scene {
  private lia!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private hud?: Hud;
  private phase: Phase = 'intro';
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pos: Pt = { ...SIT };
  private mouseTarget?: Pt;
  private stuckMs = 0;
  private facing: Dir = 's';
  private walked = false;
  private stepTimer = 0;
  private walkPoly!: Phaser.Geom.Polygon;
  private lanePoly!: Phaser.Geom.Polygon;
  private halo!: Phaser.GameObjects.Image;
  private sun!: Phaser.GameObjects.Image;
  private core!: Phaser.GameObjects.Image;
  private ghosts: { img: Phaser.GameObjects.Image; a: number }[] = [];
  private rays!: Phaser.GameObjects.Graphics;
  private marker?: Phaser.GameObjects.Container;
  private canClose = false;
  private leaf!: Phaser.GameObjects.Image;
  private flowers!: Phaser.GameObjects.Container;
  private detailHint?: Phaser.GameObjects.Container;
  private bookmarkButtons: Partial<Record<Bookmark, Phaser.GameObjects.Container>> = {};
  private found = new Set<Bookmark>();
  private pendingDetail?: Detail;
  private hintKey = '';
  private lastObservation = -Infinity;
  private meadowBird?: Phaser.GameObjects.Sprite;
  private birdAway = false;
  private ambientTweens: Phaser.Tweens.Tween[] = [];
  private pollen: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private ambientCreatures: Phaser.GameObjects.Sprite[] = [];

  constructor() { super('lia'); }

  create() {
    this.phase = 'intro'; this.pos = { ...SIT }; this.facing = 's'; this.walked = false;
    this.stepTimer = 0; this.stuckMs = 0; this.canClose = false;
    this.ghosts = []; this.hud = undefined; this.marker = undefined;
    this.found.clear(); this.bookmarkButtons = {}; this.pendingDetail = undefined;
    this.hintKey = ''; this.lastObservation = -Infinity; this.birdAway = false;
    this.meadowBird = undefined;
    this.ambientTweens = []; this.pollen = []; this.ambientCreatures = [];
    this.walkPoly = new Phaser.Geom.Polygon(WALK);
    this.lanePoly = new Phaser.Geom.Polygon(LANE);
    this.makeTextures();

    this.add.image(0, 0, 'bg-lia').setOrigin(0).setDepth(-1000);
    this.cameras.main.setBackgroundColor('#ffffff');

    this.shadow = this.add.image(SIT.x, SIT.y - 1, 'shadow').setScale(1.15, 1);
    this.lia = this.add.sprite(SIT.x, SIT.y, 'lia-read-s', 0).setOrigin(0.5, 60 / 64).play('lia-s-read');
    this.syncLia();

    this.atmosphere();
    this.meadowDetails();
    startAmbient(this, 'exploration');
    this.light();
    this.intro();
    const unsubscribe = subscribeSettings(() => {
      const prefs = ambientPrefs();
      this.pollen.forEach((emitter) => emitter.setVisible(prefs.particles).setActive(prefs.particles));
      this.ambientTweens = this.ambientTweens.filter((tween) => !tween.isDestroyed() && !tween.isPendingRemove());
      this.ambientTweens.forEach((tween) => prefs.reducedMotion ? tween.pause() : tween.resume());
      this.ambientCreatures.forEach((sprite) => prefs.reducedMotion ? sprite.anims.pause() : sprite.anims.resume());
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as Record<string, Phaser.Input.Keyboard.Key>;
    const use = () => this.phase === 'free' ? this.interact(this.nearestDetail()) : this.closeBook();
    this.keys.E.on('down', use);
    // Maus: Klick schließt beim Lesen das Buch, in der freien Phase läuft Lia zum Cursor.
    const click = (ptr: Phaser.Input.Pointer) => {
      if (this.phase === 'free') {
        // Die kleinen Lesezeichenknöpfe verarbeiten ihren Klick selbst.
        if (ptr.worldY < 56 && ptr.worldX > 155 && ptr.worldX < 220) return;
        const detail = this.detailAt(ptr.worldX, ptr.worldY);
        if (detail && detail === this.nearestDetail()) this.interact(detail);
        else {
          this.pendingDetail = detail;
          this.mouseTarget = detail ? this.detailPoint(detail) : { x: ptr.worldX, y: ptr.worldY };
        }
      }
      else this.closeBook();
    };
    this.input.on('pointerdown', click);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.keys.E.off('down', use);
      this.input.off('pointerdown', click);
    });
  }

  // ---------- Texturen (einmalig, im Code gebaut) ----------
  private makeTextures() {
    // Sonnenleuchten: gestuft und geordnet gedithert, damit es zur Pixelgrafik passt.
    // In Zielgröße erzeugt (Maßstab 1), damit das Dithering pixelgenau bleibt.
    this.radial('lia-sun', 320, (d) => Math.pow(Math.max(0, 1 - d), 2.2), 8, (v) => mix(0xd6ad59, 0xfff6e0, v * v));
    this.radial('lia-core', 72, (d) => Math.pow(Math.max(0, 1 - d), 1.4), 5, (v) => mix(0xf2d27a, 0xffffff, v));
    const ring = (d: number) => (d >= 1 ? 0 : d > 0.8 ? 0.9 : 0.35 + 0.3 * d);
    this.radial('lia-ghost-s', 14, ring, 4, () => 0xe8c070);
    this.radial('lia-ghost-m', 26, ring, 4, () => 0xd6ad59);
    this.radial('lia-ghost-l', 44, ring, 4, () => 0xe8c070);
    // Weiter, weicher Hof um die Sonne (glatt, wie Streulicht in der Luft)
    if (!this.textures.exists('lia-halo')) {
      const t = this.textures.createCanvas('lia-halo', 760, 760)!;
      const c = t.getContext();
      const g = c.createRadialGradient(380, 380, 0, 380, 380, 380);
      g.addColorStop(0, 'rgba(255,236,190,0.75)');
      g.addColorStop(0.25, 'rgba(232,192,112,0.38)');
      g.addColorStop(0.6, 'rgba(214,173,89,0.12)');
      g.addColorStop(1, 'rgba(214,173,89,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 760, 760);
      t.refresh();
    }
    // Blitzweiß, das sich in die Sonne zusammenzieht: weicher Rand, harter Kern.
    if (!this.textures.exists('lia-flash')) {
      const t = this.textures.createCanvas('lia-flash', 128, 128)!;
      const c = t.getContext();
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,252,240,1)');
      g.addColorStop(0.8, 'rgba(255,236,190,0.55)');
      g.addColorStop(1, 'rgba(255,226,170,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      t.refresh();
    }
    this.shrinkReadSheet();
    this.pixelTexture('lia-leaf', ['..##...', '.#oo#..', '#ooo#..', '.#oo#..', '..#o#..', '...#...'], ['#513a20', '#c6ad60']);
    this.pixelTexture('lia-flower', ['..o..', '.ooo.', 'oo#oo', '.ooo.', '..o..', '..#..'], ['#756735', '#fff0c5']);
    this.pixelTexture('lia-detail', ['..o..', '.o.o.', 'o...o', '.o.o.', '..o..'], ['#463622', '#fff0c5']);
    // Kleiner Pfeil für den Wegmarker
    if (!this.textures.exists('lia-chev')) {
      const rows = ['.....#.....', '....#o#....', '...#ooo#...', '..#oo#oo#..', '.#oo#.#oo#.', '#oo#...#oo#', '.##.....##.'];
      const t = this.textures.createCanvas('lia-chev', 11, rows.length)!;
      const c = t.getContext();
      rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch === '.') return;
        c.fillStyle = ch === '#' ? '#3b2412' : '#fff1c8';
        c.fillRect(x, y, 1, 1);
      }));
      t.refresh();
    }
  }

  private pixelTexture(key: string, rows: string[], colors: [string, string]) {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, rows[0].length, rows.length)!;
    const ctx = texture.getContext();
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.') return;
      ctx.fillStyle = c === '#' ? colors[0] : colors[1];
      ctx.fillRect(x, y, 1, 1);
    }));
    texture.refresh();
  }

  /**
   * 'lia-read' (64er Zellen) → 'lia-read-s' (48er Zellen): Silhouette per Block-Maximum, Farbe per
   * nächstem Nachbarn, danach durchgehende 1-px-Kontur wie im Gehbogen. Fußpunkt bleibt bei 60/64.
   */
  private shrinkReadSheet() {
    if (!this.textures.exists('lia-read-s')) {
      const src = this.textures.get('lia-read').getSourceImage() as HTMLImageElement;
      const W = src.width, H = src.height, w = (W * 3) / 4, h = (H * 3) / 4;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const sctx = cv.getContext('2d')!;
      sctx.drawImage(src, 0, 0);
      const s = sctx.getImageData(0, 0, W, H).data;
      const op = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && s[(y * W + x) * 4 + 3] > 127;
      // Konturfarbe = häufigste Randfarbe der Vorlage
      const count = new Map<number, number>();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!op(x, y) || (op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1))) continue;
        const i = (y * W + x) * 4, c = (s[i] << 16) | (s[i + 1] << 8) | s[i + 2];
        count.set(c, (count.get(c) ?? 0) + 1);
      }
      const ink = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0x2a1a12;
      const t = this.textures.createCanvas('lia-read-s', w, h)!;
      const c = t.getContext();
      const img = c.createImageData(w, h), d = img.data;
      const on = new Uint8Array(w * h);
      for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
        const x0 = Math.floor((tx * 4) / 3), x1 = Math.ceil(((tx + 1) * 4) / 3), y0 = Math.floor((ty * 4) / 3), y1 = Math.ceil(((ty + 1) * 4) / 3);
        let sx = Math.floor(((tx + 0.5) * 4) / 3), sy = Math.floor(((ty + 0.5) * 4) / 3);
        if (!op(sx, sy)) {
          let found = false;
          for (let y = y0; y < y1 && !found; y++) for (let x = x0; x < x1 && !found; x++) if (op(x, y)) { sx = x; sy = y; found = true; }
          if (!found) continue;
        }
        const i = (sy * W + sx) * 4, o = (ty * w + tx) * 4;
        d[o] = s[i]; d[o + 1] = s[i + 1]; d[o + 2] = s[i + 2]; d[o + 3] = 255;
        on[ty * w + tx] = 1;
      }
      const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && on[y * w + x] === 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!on[y * w + x]) continue;
        const cx = Math.floor(x / 48), cy = Math.floor(y / 48);
        const inCell = (xx: number, yy: number) => Math.floor(xx / 48) === cx && Math.floor(yy / 48) === cy && at(xx, yy);
        if (inCell(x - 1, y) && inCell(x + 1, y) && inCell(x, y - 1) && inCell(x, y + 1)) continue;
        const o = (y * w + x) * 4;
        d[o] = (ink >> 16) & 255; d[o + 1] = (ink >> 8) & 255; d[o + 2] = ink & 255;
      }
      c.putImageData(img, 0, 0);
      t.refresh();
      for (let i = 0; i < (w / 48) * (h / 48); i++) t.add(i, 0, (i % (w / 48)) * 48, Math.floor(i / (w / 48)) * 48, 48, 48);
    }
    for (const [k, [frames, fps, loop]] of Object.entries(READ_ANIMS)) {
      if (!this.anims.exists(`lia-s-${k}`)) {
        this.anims.create({ key: `lia-s-${k}`, frames: frames.map((f) => ({ key: 'lia-read-s', frame: f })), frameRate: fps, repeat: loop ? -1 : 0 });
      }
    }
  }

  private radial(key: string, size: number, fn: (d: number) => number, levels: number, color: (v: number) => number) {
    if (this.textures.exists(key)) return;
    const t = this.textures.createCanvas(key, size, size)!;
    const c = t.getContext();
    const img = c.createImageData(size, size);
    const r = size / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
      const v = Phaser.Math.Clamp(fn(d), 0, 1);
      const q = Math.min(levels, Math.floor(v * levels + BAYER[(y % 4) * 4 + (x % 4)] / 16)) / levels;
      const col = color(q), i = (y * size + x) * 4;
      img.data[i] = (col >> 16) & 255; img.data[i + 1] = (col >> 8) & 255; img.data[i + 2] = col & 255;
      img.data[i + 3] = Math.round(q * 255);
    }
    c.putImageData(img, 0, 0);
    t.refresh();
  }

  // ---------- Licht ----------
  private light() {
    const ADD = Phaser.BlendModes.ADD;
    // Lichtstrahlen aus der tief stehenden Sonne, ganz zart
    this.rays = this.add.graphics().setBlendMode(ADD).setDepth(880).setAlpha(0);
    const rays: [number, number, number][] = [[134, 3, 0.08], [145, 2.5, 0.11], [154, 4.5, 0.07], [163, 2, 0.11], [172, 3.5, 0.07]];
    for (const [deg, spread, a] of rays) {
      const a0 = Phaser.Math.DegToRad(deg - spread / 2), a1 = Phaser.Math.DegToRad(deg + spread / 2);
      this.rays.fillStyle(0xe8c070, a).fillTriangle(SUN.x, SUN.y, SUN.x + Math.cos(a0) * 760, SUN.y + Math.sin(a0) * 760, SUN.x + Math.cos(a1) * 760, SUN.y + Math.sin(a1) * 760);
    }
    this.halo = this.add.image(SUN.x, SUN.y, 'lia-halo').setBlendMode(ADD).setDepth(899).setAlpha(0);
    this.sun = this.add.image(SUN.x, SUN.y, 'lia-sun').setBlendMode(ADD).setDepth(900).setAlpha(0);
    this.core = this.add.image(SUN.x, SUN.y, 'lia-core').setBlendMode(ADD).setDepth(901).setAlpha(0);
    // Linsenreflexe auf der Linie Sonne → Bildmitte
    const dx = 320 - SUN.x, dy = 180 - SUN.y;
    ([[0.3, 's', 0.3], [0.52, 'm', 0.16], [0.78, 's', 0.22], [1.08, 'l', 0.08]] as const).forEach(([t, k, a]) => {
      const img = this.add.image(Math.round(SUN.x + dx * t), Math.round(SUN.y + dy * t), `lia-ghost-${k}`).setBlendMode(ADD).setDepth(890).setAlpha(0);
      this.ghosts.push({ img, a });
    });
  }

  private intro() {
    const ADD = Phaser.BlendModes.ADD;
    const white = this.add.rectangle(0, 0, 640, 360, 0xffffff).setOrigin(0).setDepth(2000);
    const flash = this.add.image(SUN.x, SUN.y, 'lia-flash').setBlendMode(ADD).setDepth(1999).setScale(22);
    if (getSettings().reducedMotion) { white.setVisible(false); flash.setVisible(false); }
    this.time.delayedCall(30, () => this.cameras.main.setBackgroundColor('#07080a'));
    this.tweens.add({ targets: white, alpha: 0, delay: 150, duration: 600, ease: 'Sine.in', onComplete: () => white.destroy() });
    this.tweens.add({ targets: flash, scale: 1.4, duration: 1800, ease: 'Sine.in' });
    this.tweens.add({ targets: flash, alpha: 0, delay: 1300, duration: 700, ease: 'Sine.out', onComplete: () => flash.destroy() });
    this.tweens.add({ targets: this.sun, alpha: 1, delay: 900, duration: 1100 });
    this.tweens.add({ targets: this.halo, alpha: 1, delay: 700, duration: 1300 });
    this.tweens.add({ targets: this.core, alpha: 0.9, delay: 1100, duration: 900 });
    this.tweens.add({ targets: this.rays, alpha: 1, delay: 1400, duration: 1600 });
    this.ghosts.forEach((g, i) => this.tweens.add({ targets: g.img, alpha: g.a, delay: 1500 + i * 120, duration: 900 }));

    const later = this.add.text(320, 340, 'Viele Jahre später', {
      fontFamily: FONT, fontSize: '10px', color: '#fbf1d8', stroke: '#4a3018', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(1500).setAlpha(0);
    this.tweens.add({ targets: later, alpha: 0.9, delay: 1100, duration: 900, hold: 1700, yoyo: true, onComplete: () => later.destroy() });

    // Lia liest; nach etwa zwei Sekunden blendet sie die Sonne.
    this.time.delayedCall(3600, () => {
      this.lia.play('lia-s-shade');
      this.phase = 'reading';
      this.readLoop();
    });
    this.time.delayedCall(4600, () => this.showHud());
    this.time.delayedCall(5600, () => { if (this.phase === 'reading') { this.canClose = true; this.hud?.hint('E / Klick: das Buch zuklappen'); } });
  }

  /** Sie versucht weiterzulesen: abwechselnd blinzeln und lesen, bis der Spieler das Buch zuklappt. */
  private readLoop() {
    this.time.delayedCall(Phaser.Math.Between(2200, 3000), () => {
      if (this.phase !== 'reading') return;
      this.lia.play('lia-s-read');
      this.time.delayedCall(Phaser.Math.Between(1500, 2200), () => {
        if (this.phase !== 'reading') return;
        this.lia.play('lia-s-shade');
        this.readLoop();
      });
    });
  }

  private showHud() {
    const before = this.children.list.length;
    this.hud = new Hud(this, 'portrait-lia', 'LIA');
    this.hud.setHp(1, false);
    // Nur die Container einblenden; Hinweis- und Gedankenzeile steuert das HUD selbst.
    const fresh = this.children.list.slice(before);
    // Gedankenstimme warm statt kühlblau (das Blau gehört Valentus)
    for (const o of fresh) if (o instanceof Phaser.GameObjects.Text && o.style.fontStyle === 'italic') o.setColor('#f8ecd2');
    const added = fresh.filter((o) => o instanceof Phaser.GameObjects.Container) as Phaser.GameObjects.Container[];
    added.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: added, alpha: 1, duration: 900, ease: 'Sine.out' });
  }

  // ---------- Atmosphäre ----------
  private atmosphere() {
    const ADD = Phaser.BlendModes.ADD;
    // Pollen und Lichtstaub, treiben langsam vom Licht weg
    this.pollen.push(this.add.particles(0, 0, 'px', {
      x: { min: 20, max: 640 }, y: { min: 30, max: 330 }, lifespan: { min: 4000, max: 7000 },
      speedX: { min: -9, max: -2 }, speedY: { min: -5, max: 3 }, scale: { min: 0.5, max: 1 },
      alpha: { start: 0.75, end: 0 }, tint: [0xffe6a0, 0xfff4d8, 0xd6ad59], frequency: 140, blendMode: ADD,
    }).setDepth(800));
    // Flirren auf Gras und Ähren
    const glint = { lifespan: { min: 300, max: 700 }, scale: 0.5, alpha: { start: 0.9, end: 0 }, tint: [0xfff0b8, 0xf2d27a], blendMode: ADD };
    this.pollen.push(this.add.particles(0, 0, 'px', { ...glint, x: { min: 0, max: 380 }, y: { min: 232, max: 360 }, frequency: 90 }).setDepth(790));
    this.pollen.push(this.add.particles(0, 0, 'px', { ...glint, x: { min: 340, max: 600 }, y: { min: 80, max: 290 }, frequency: 110 }).setDepth(790));
    this.pollen.push(this.add.particles(0, 0, 'px', { ...glint, x: { min: 60, max: 440 }, y: { min: 160, max: 250 }, frequency: 260, alpha: { start: 0.5, end: 0 } }).setDepth(790));

    const bird = () => {
      sfx.bird();
      if (Math.random() < 0.35) this.time.delayedCall(420, () => sfx.bird());
      this.time.delayedCall(Phaser.Math.Between(2600, 6500), bird);
    };
    this.time.delayedCall(1800, bird);
  }

  /** Kleine optionale Handlungen auf der Wiese, ohne Questpflicht oder neue Geschichte. */
  private meadowDetails() {
    this.leaf = this.add.image(334, 208, 'lia-leaf').setDepth(208);
    this.ambientTweens.push(this.tweens.add({ targets: this.leaf, x: 356, y: 198, angle: 22, duration: 3100, yoyo: true, repeat: -1, ease: 'Sine.inOut', paused: getSettings().reducedMotion }));
    const blossoms = [[-7, 2], [0, -2], [8, 3]].map(([x, y]) => this.add.image(x, y, 'lia-flower'));
    this.flowers = this.add.container(409, 218, blossoms).setDepth(217);
    this.ambientTweens.push(this.tweens.add({ targets: blossoms, angle: { from: -6, to: 7 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.inOut', paused: getSettings().reducedMotion }));

    // Kurze Grashalme kippen mit dem Wind; keine große Overlayfläche vor der Figur.
    [[177, 222], [201, 230], [373, 223], [432, 238], [478, 257]].forEach(([x, y], i) => {
      const grass = this.add.graphics().setPosition(x, y).setDepth(y - 1);
      grass.lineStyle(1, i % 2 ? 0xc9ae6a : 0x84934d, 0.7);
      grass.lineBetween(-3, 0, -5, -5).lineBetween(0, 0, 1, -7).lineBetween(3, 0, 5, -4);
      this.ambientTweens.push(this.tweens.add({ targets: grass, angle: { from: -4, to: 5 }, duration: 1600 + i * 170, delay: i * 130, yoyo: true, repeat: -1, ease: 'Sine.inOut', paused: getSettings().reducedMotion }));
    });
    if (this.textures.exists('crt-butterfly')) {
      const butterfly = this.add.sprite(188, 207, 'crt-butterfly').play('butterfly-a').setDepth(237);
      this.ambientCreatures.push(butterfly);
      this.ambientTweens.push(this.tweens.add({ targets: butterfly, x: 210, y: 196, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.inOut', paused: getSettings().reducedMotion }));
    }
    if (this.textures.exists('crt-bird')) {
      this.meadowBird = this.add.sprite(382, 208, 'crt-bird').play('bird-peck').setDepth(208);
      this.ambientCreatures.push(this.meadowBird);
    }
    const frame = this.add.rectangle(0, 0, 13, 12, 0x3b301e, 0.85).setStrokeStyle(1, 0xd7c68e);
    const key = this.add.text(0, 0, 'E', { fontFamily: FONT, fontSize: '9px', color: '#fff1c8' }).setOrigin(0.5);
    this.detailHint = this.add.container(0, 0, [frame, key]).setDepth(820).setVisible(false);
  }

  private detailPoint(detail: Detail): Pt {
    if (detail === 'leaf') return { x: this.leaf.x, y: this.leaf.y };
    if (detail === 'flowers') return { x: this.flowers.x, y: this.flowers.y };
    if (detail === 'breeze') return { x: 193, y: 219 };
    return MARK;
  }

  private detailAt(x: number, y: number): Detail | undefined {
    const choices: Detail[] = ['home', 'leaf', 'flowers', 'breeze'];
    return choices.find((detail) => {
      if ((detail === 'leaf' || detail === 'flowers') && this.found.has(detail)) return false;
      const p = this.detailPoint(detail);
      return Math.hypot(p.x - x, p.y - y) < (detail === 'home' ? 23 : 15);
    });
  }

  private nearestDetail(): Detail | undefined {
    if (Phaser.Geom.Polygon.Contains(this.lanePoly, this.pos.x, this.pos.y)) return 'home';
    const choices: Detail[] = ['home', 'leaf', 'flowers', 'breeze'];
    return choices.filter((detail) => !((detail === 'leaf' || detail === 'flowers') && this.found.has(detail)))
      .map((detail) => ({ detail, distance: Phaser.Math.Distance.BetweenPoints(this.pos, this.detailPoint(detail)) }))
      .filter(({ distance }) => distance < 28)
      .sort((a, b) => a.distance - b.distance)[0]?.detail;
  }

  private interact(detail?: Detail) {
    if (this.phase !== 'free' || !detail) return;
    this.mouseTarget = undefined; this.pendingDetail = undefined;
    if (detail === 'home') { this.showTitle(); return; }
    if (this.time.now - this.lastObservation < 650) return;
    this.lastObservation = this.time.now;
    if (detail === 'breeze') {
      this.hud?.thought('Die Ähren rauschen leise.', 1800);
      sfx.bird();
      return;
    }
    if (this.found.has(detail)) return;
    this.found.add(detail);
    sfx.select();
    if (detail === 'leaf') {
      this.tweens.killTweensOf(this.leaf);
      this.tweens.add({ targets: this.leaf, x: this.pos.x, y: this.pos.y - 22, alpha: 0, duration: motionDuration(350), ease: 'Sine.out' });
      this.hud?.thought('Ein Blatt als Lesezeichen.', 1900);
    } else {
      this.tweens.add({ targets: this.flowers, alpha: 0.45, duration: 350 });
      this.hud?.thought('Eine Blüte zwischen den Seiten.', 1900);
    }
    this.addBookmarkButton(detail);
    this.setBookmark(detail);
  }

  private addBookmarkButton(kind: Bookmark) {
    const frame = this.add.rectangle(0, 0, 22, 22, 0x302a1c, 0.88).setStrokeStyle(1, 0x8a7a5a);
    const icon = this.add.image(0, 0, kind === 'leaf' ? 'lia-leaf' : 'lia-flower').setScale(1.5);
    const button = this.add.container(kind === 'leaf' ? 171 : 200, 23, [frame, icon]).setDepth(1010).setAlpha(0);
    button.setSize(22, 22).setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => { if (this.phase === 'free') { this.setBookmark(kind); sfx.select(); } });
    button.on('pointerover', () => { if (this.phase === 'free') this.hud?.thought(kind === 'leaf' ? 'Blatt-Lesezeichen' : 'Blüten-Lesezeichen', 1100); });
    this.bookmarkButtons[kind] = button;
    this.tweens.add({ targets: button, alpha: 1, duration: motionDuration(400) });
  }

  private setBookmark(kind: Bookmark) {
    this.registry.set('liaBookmark', kind);
    for (const [name, button] of Object.entries(this.bookmarkButtons)) {
      (button!.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(name === kind ? 2 : 1, name === kind ? 0xe5d29a : 0x8a7a5a);
    }
  }

  private updateDetails() {
    this.leaf.setDepth(this.leaf.y);
    if (this.meadowBird && !this.birdAway && Phaser.Math.Distance.BetweenPoints(this.pos, this.meadowBird) < 38) {
      this.birdAway = true;
      if (getSettings().reducedMotion) {
        this.time.delayedCall(2500, () => { this.birdAway = false; });
      } else {
        this.meadowBird.play('bird-fly');
        this.tweens.add({ targets: this.meadowBird, x: 460, y: 132, alpha: 0, duration: 1200, onComplete: () => {
          if (!this.meadowBird?.active) return;
          this.meadowBird.setPosition(382, 208).setAlpha(1).play('bird-peck');
          this.time.delayedCall(1800, () => { this.birdAway = false; });
        } });
      }
      sfx.bird();
    }
    const nearest = this.nearestDetail();
    this.detailHint?.setVisible(!!nearest).setPosition(this.pos.x + 18, this.pos.y - 36);
    const hint = nearest === 'home' ? 'E / Klick: nach Hause' : nearest === 'leaf' ? 'E: Blatt fangen'
      : nearest === 'flowers' ? 'E: Blüte ansehen' : nearest === 'breeze' ? 'E: kurz innehalten' : 'WASD / Klick';
    if (this.hintKey !== hint) { this.hintKey = hint; this.hud?.hint(hint, true); }
    if (this.pendingDetail && nearest === this.pendingDetail) this.interact(nearest);
  }

  // ---------- Buch zuklappen ----------
  private closeBook() {
    if (this.phase !== 'reading' || !this.canClose) return;
    this.phase = 'closing';
    this.hud?.hint('');
    this.lia.play('lia-s-close');
    this.hud?.thought('Nur diese Seite noch … ach, die Sonne.', 2600);
    this.time.delayedCall(1700, () => {
      this.lia.play('lia-s-stand');
      this.shadow.setScale(0.9, 1);
    });
    this.time.delayedCall(2500, () => {
      this.lia.play('lia-s-shoes');
      sfx.step();
      this.time.delayedCall(500, () => sfx.step());
      this.lia.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.lia.play('lia-s-idle-book');
        this.time.delayedCall(500, () => this.startFree());
      });
    });
  }

  private startFree() {
    this.phase = 'free';
    this.hud?.hint('WASD / Klick: die Wiese erkunden');
    const glow = this.add.ellipse(0, 3, 26, 8, 0xf2d27a, 0.45).setBlendMode(Phaser.BlendModes.ADD);
    const a = this.add.image(0, -5, 'lia-chev');
    const b = this.add.image(0, -13, 'lia-chev');
    this.marker = this.add.container(MARK.x, MARK.y, [glow, a, b]).setDepth(MARK.y).setAlpha(0);
    this.tweens.add({ targets: this.marker, alpha: 1, duration: 600 });
    this.ambientTweens.push(this.tweens.add({ targets: glow, scaleX: 1.4, scaleY: 1.4, alpha: 0.1, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', paused: getSettings().reducedMotion }));
    this.ambientTweens.push(this.tweens.add({ targets: a, alpha: { from: 1, to: 0.35 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut', paused: getSettings().reducedMotion }));
    this.ambientTweens.push(this.tweens.add({ targets: b, alpha: { from: 0.35, to: 1 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut', paused: getSettings().reducedMotion }));
    this.ambientTweens.push(this.tweens.add({ targets: [a, b], y: '-=2', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', paused: getSettings().reducedMotion }));
  }

  // ---------- Bewegung ----------
  private free(x: number, y: number) {
    if (!Phaser.Geom.Polygon.Contains(this.walkPoly, x, y)) return false;
    const ex = (x - TRUNK.x) / TRUNK.rx, ey = (y - TRUNK.y) / TRUNK.ry;
    return ex * ex + ey * ey > 1;
  }

  private syncLia() {
    const x = Math.round(this.pos.x), y = Math.round(this.pos.y);
    this.lia.setPosition(x, y).setDepth(y);
    this.shadow.setPosition(x, y - 1).setDepth(y - 1);
    if (this.marker) this.marker.setDepth(MARK.y);
  }

  update(_t: number, dt: number) {
    this.pulse();
    if (this.phase !== 'free') return;
    const k = this.keys;
    let ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (ix || iy) { this.mouseTarget = undefined; this.pendingDetail = undefined; }
    else if (this.mouseTarget) {
      const ptr = this.input.activePointer;
      if (ptr.isDown) this.mouseTarget = { x: ptr.worldX, y: ptr.worldY };
      const tx = this.mouseTarget.x - this.pos.x, ty = this.mouseTarget.y - this.pos.y, d = Math.hypot(tx, ty);
      if (d < 2) this.mouseTarget = undefined;
      else { ix = tx / d; iy = ty / d; }
    }
    if (ix || iy) {
      if (!this.walked) { this.walked = true; this.shadow.setScale(0.85, 1); }
      const len = Math.hypot(ix, iy), step = SPEED * Math.min(dt, 50) / 1000;
      let nx = this.pos.x + (ix / len) * step, ny = this.pos.y + (iy / len) * step;
      if (!this.free(nx, ny)) {
        if (ix && this.free(nx, this.pos.y)) ny = this.pos.y;
        else if (iy && this.free(this.pos.x, ny)) nx = this.pos.x;
        else { nx = this.pos.x; ny = this.pos.y; }
      }
      const moved = Math.hypot(nx - this.pos.x, ny - this.pos.y);
      if (this.mouseTarget) {
        this.stuckMs = moved < step * 0.3 ? this.stuckMs + dt : 0;
        if (this.stuckMs > 220) { this.mouseTarget = undefined; this.stuckMs = 0; }
      }
      this.pos = { x: nx, y: ny };
      this.facing = Math.abs(ix) >= Math.abs(iy) ? (ix > 0 ? 'e' : 'w') : iy > 0 ? 's' : 'n';
      const anim = `lia-walk-${this.facing}`;
      if (this.lia.anims.currentAnim?.key !== anim || !this.lia.anims.isPlaying) this.lia.play(anim);
      if (moved > 0.01) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) { this.stepTimer = 300; sfx.step(); }
      }
      this.syncLia();
    } else if (this.walked) {
      this.lia.play(`lia-idle-${this.facing}`, true);
      this.stepTimer = 0;
    }
    this.updateDetails();
  }

  /** Ganz leichtes Atmen des Gegenlichts. */
  private pulse() {
    const t = this.time.now / 1000;
    if (this.phase === 'intro') return;
    if (getSettings().reducedMotion) return;
    const p = Math.sin(t * 1.3) * 0.5 + Math.sin(t * 0.47) * 0.5;
    this.halo.setScale(1 + p * 0.025).setAlpha(0.9 + p * 0.1);
    this.sun.setAlpha(0.92 + p * 0.08);
    this.core.setAlpha(0.85 + p * 0.1);
    this.ghosts.forEach((g, i) => g.img.setAlpha(g.a * (0.85 + 0.15 * Math.sin(t * 1.1 + i))));
    this.rays.setAlpha(0.85 + 0.15 * Math.sin(t * 0.6));
  }

  // ---------- Titel ----------
  private showTitle() {
    this.phase = 'title';
    this.detailHint?.setVisible(false);
    if (this.found.size) this.tweens.add({ targets: Object.values(this.bookmarkButtons), alpha: 0, duration: 600 });
    this.lia.play(`lia-idle-${this.facing}`, true);
    this.hud?.hideAll(800);
    if (this.marker) this.tweens.add({ targets: this.marker, alpha: 0, duration: 600 });

    // Weicher, warmer Schattenstreifen hinter dem Titel (keine Vignette, keine harte Kante)
    if (!this.textures.exists('lia-dusk')) {
      const t = this.textures.createCanvas('lia-dusk', 4, 128)!;
      const c = t.getContext();
      const g = c.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(42,22,8,0)');
      g.addColorStop(0.5, 'rgba(42,22,8,0.42)');
      g.addColorStop(1, 'rgba(42,22,8,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 4, 128);
      t.refresh();
    }
    const shade = this.add.image(320, 156, 'lia-dusk').setDisplaySize(640, 140).setDepth(1090).setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, delay: 400, duration: 1800 });
    const title = this.add.text(320, 140, 'SELANTIS', {
      fontFamily: FONT, fontSize: '48px', color: '#f8e9c4', stroke: '#3b2412', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(1100).setAlpha(0);
    title.setShadow(0, 3, '#1c0f06', 0, true, false);
    const sub = this.add.text(320, 176, 'Kapitel 1', {
      fontFamily: FONT, fontSize: '12px', color: '#f3dfb4', stroke: '#3b2412', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1100).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: { from: 144, to: 140 }, delay: 600, duration: 2400, ease: 'Sine.out' });
    this.tweens.add({ targets: sub, alpha: 1, delay: 2200, duration: 1400 });
    // Nach dem Titel geht es nahtlos in die offene Welt – gleiche Wiese, gleiche Position.
    this.time.delayedCall(6200, () => {
      this.tweens.add({ targets: [title, sub, shade], alpha: 0, duration: 900 });
      this.cameras.main.fadeOut(1100, 255, 244, 214);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
        this.scene.start('world', { map: 'wiese', x: Math.round(this.pos.x), y: Math.round(this.pos.y), facing: this.facing }));
    });
  }
}

function mix(a: number, b: number, t: number) {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
