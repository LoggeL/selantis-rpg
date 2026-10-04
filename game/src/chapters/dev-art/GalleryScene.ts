import Phaser from 'phaser';
import { G } from '../../core/G';
import { canvasRect } from '../../core/viewport';
import type { CharAnim, CharAnimExtra, TerrainId } from '../../art/api';
import type { Dir } from '../../core/types';
import { INTERIOR, LANDSCAPE, parseMap } from './maps';

export type GalleryPage = 'landscape' | 'night' | 'interior' | 'characters' | 'anims' | 'props' | 'portraits' | 'icons';
export const PAGES: { id: GalleryPage; label: string }[] = [
  { id: 'landscape', label: 'Landschaft' },
  { id: 'night', label: 'Nacht' },
  { id: 'interior', label: 'Innenraum' },
  { id: 'characters', label: 'Figuren' },
  { id: 'anims', label: 'Animationen' },
  { id: 'props', label: 'Requisiten' },
  { id: 'portraits', label: 'Porträts' },
  { id: 'icons', label: 'Symbole & Effekte' },
];

interface Label { el: HTMLElement; x: number; y: number }

/** Dev gallery of all procedural art. Camera: arrows/WASD pan, +/- zoom, 1-8 switch pages, drag to pan. */
export class GalleryScene extends Phaser.Scene {
  static KEY = 'ArtGallery';
  private page: GalleryPage = 'landscape';
  private root!: Phaser.GameObjects.Container;
  private overlay!: HTMLElement;
  private labelLayer!: HTMLElement;
  private labels: Label[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private bounds = new Phaser.Geom.Rectangle(0, 0, 480, 270);
  /** World positions of gallery items by id (for focusing in tests). */
  readonly spots = new Map<string, { x: number; y: number }>();

  focus(id: string, zoom = 2): void {
    const s = this.spots.get(id);
    if (s) this.cameras.main.setZoom(zoom).centerOn(s.x, s.y);
  }

  constructor() { super(GalleryScene.KEY); }

  init(data: { page?: GalleryPage }): void {
    this.page = data.page ?? 'landscape';
  }

  create(): void {
    this.buildOverlay();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,PLUS,MINUS,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    const nums = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
    nums.forEach((k, i) => this.keys[k].on('down', () => this.show(PAGES[i].id)));
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key === '+') this.zoomBy(2);
      if (e.key === '-') this.zoomBy(0.5);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const cam = this.cameras.main;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.cameras.main.scrollY += dy * 0.5 / this.cameras.main.zoom;
    });
    this.events.once('shutdown', () => this.overlay.remove());
    this.show(this.page);
  }

  private zoomBy(f: number): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * f, 0.25, 4));
  }

  private buildOverlay(): void {
    const o = document.createElement('div');
    o.className = 'art-gallery-overlay';
    o.innerHTML = `<style>
      .art-gallery-overlay{position:fixed;inset:0;pointer-events:none;z-index:50;font-family:'Alegreya Sans SC',Alegreya,Georgia,sans-serif;color:#efe3c8}
      .art-gallery-overlay .tabs{position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px;pointer-events:auto;background:#141a26e8;border:1px solid #d8b25a88;border-radius:8px;padding:4px;box-shadow:0 6px 18px #0008}
      .art-gallery-overlay .tabs button{all:unset;cursor:pointer;padding:4px 10px;border-radius:5px;font-size:14px;letter-spacing:.06em;color:#cdbf9f}
      .art-gallery-overlay .tabs button.on{background:#d8b25a;color:#141a26}
      .art-gallery-overlay .title{position:absolute;left:14px;bottom:10px;font-family:Cinzel,serif;font-size:15px;letter-spacing:.12em;color:#e9c977;text-shadow:0 2px 3px #000}
      .art-gallery-overlay .lbl{position:absolute;transform:translate(-50%,0);font-size:11px;letter-spacing:.04em;white-space:nowrap;color:#efe3c8;text-shadow:0 1px 2px #000,0 0 3px #000}
      .art-gallery-overlay .dom{position:absolute;inset:48px 0 0 0;overflow:auto;pointer-events:auto;display:none}
    </style><div class="tabs"></div><div class="labels"></div><div class="dom"></div><div class="title">Selantis · Kunstgalerie</div>`;
    document.body.appendChild(o);
    this.overlay = o;
    this.labelLayer = o.querySelector('.labels') as HTMLElement;
    const tabs = o.querySelector('.tabs') as HTMLElement;
    PAGES.forEach((p, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1} ${p.label}`;
      b.dataset.page = p.id;
      b.onclick = () => this.show(p.id);
      tabs.appendChild(b);
    });
  }

  domPanel(): HTMLElement { return this.overlay.querySelector('.dom') as HTMLElement; }

  label(text: string, x: number, y: number): void {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = text;
    this.labelLayer.appendChild(el);
    this.labels.push({ el, x, y });
  }

  show(page: GalleryPage): void {
    this.page = page;
    this.overlay.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.page === page));
    this.root?.destroy();
    this.labels.forEach(l => l.el.remove());
    this.labels = [];
    this.spots.clear();
    this.tweens.killAll();
    this.time.removeAllEvents();
    const dom = this.domPanel();
    dom.innerHTML = '';
    dom.style.display = 'none';
    this.root = this.add.container(0, 0);
    const cam = this.cameras.main;
    cam.setZoom(1).setScroll(0, 0).setBackgroundColor('#0b0e15');
    const builders: Record<GalleryPage, () => void> = {
      landscape: () => this.buildLandscape(false),
      night: () => this.buildLandscape(true),
      interior: () => this.buildInterior(),
      characters: () => this.buildCharacters(),
      anims: () => this.buildAnims(),
      props: () => this.buildProps(),
      portraits: () => this.buildPortraits(),
      icons: () => this.buildIcons(),
    };
    builders[page]();
  }

  // ------------------------------------------------------------------ pages

  private buildLandscape(night: boolean): void {
    const terrain = parseMap(LANDSCAPE);
    const ground = G.art.buildGround(this, { cols: terrain[0].length, rows: terrain.length, terrain, seed: 7, palette: night ? 'night' : 'summer' });
    this.root.add(ground);
    console.info('[art] ground ms', Math.round(ground.getData('groundMs')));
    const W = terrain[0].length * 16, H = terrain.length * 16;
    this.bounds.setTo(0, 0, W, H);
    const tint = night ? 0x5a66a0 : 0xffffff;
    const lights: { x: number; y: number; r: number; c: number }[] = [];
    const place = (id: string, tx: number, ty: number, v = 0) => {
      const info = G.art.prop(this, night && id === 'house-farm' ? 'house-farm-night' : id, v);
      const x = Math.round(tx * 16), y = Math.round(ty * 16);
      const spr = this.add.sprite(x, y, info.key).setOrigin(info.originX / info.width, info.originY / info.height).setDepth(y);
      if (info.anim) spr.play({ key: info.anim, startFrame: Math.floor((tx * 7 + ty * 3) % 4) });
      if (night && !info.light) spr.setTint(tint);
      if (info.sway) this.tweens.add({ targets: spr, angle: { from: -0.6, to: 0.6 }, yoyo: true, repeat: -1, duration: 1800 + ((tx * 131) % 900), ease: 'Sine.inOut' });
      if (night) {
        if (info.light) lights.push({ x, y: y + (info.light.offsetY ?? 0), r: info.light.radius, c: info.light.color });
        for (const l of info.lights ?? []) lights.push({ x: x + l.x, y: y + l.y, r: l.radius, c: l.color });
      }
      this.root.add(spr);
      return spr;
    };
    // forest edge (north-west)
    const forest: [string, number, number, number?][] = [
      ['tree-pine', 1.5, 2.5], ['tree-pine', 4.2, 1.6, 1], ['tree-oak', 7, 3.2], ['tree-pine', 2.6, 5.4, 1], ['tree-oak', 9.6, 1.8, 2],
      ['tree-pine', 0.8, 8.2], ['tree-oak', 5.4, 6.8, 1], ['tree-pine', 3.4, 10.5], ['tree-oak', 12.5, 0.9, 1], ['tree-dead', 8.6, 7.2],
      ['tree-pine', 6.6, 9.6, 1], ['tree-oak', 1.6, 12.8, 2],
    ];
    for (const [id, x, y, v] of forest) place(id, x, y, v ?? 0);
    place('bush-hide', 10.5, 5.5); place('bush', 11.5, 9.2, 1); place('bush-berry', 13.6, 6.4); place('stump', 9.2, 10.8);
    place('log', 6.2, 12.6); place('tall-grass', 12.2, 11.4); place('tall-grass', 13.4, 12.2, 1); place('tall-grass', 7.8, 13.6);
    place('rock', 4.6, 14.2, 2); place('rock-big', 15.5, 3.5, 1);
    // reading tree in the meadow
    place('tree-big', 21, 10.2);
    place('flowers-blue', 24.5, 6.6); place('flowers-blue', 26.4, 8.4, 1); place('flowers-mixed', 18.5, 7.2, 1); place('flowers-blue', 29.5, 4.5);
    place('flowers-mixed', 27.8, 11.6, 2); place('bird-nest', 19.2, 10.8, 1); place('rock', 23.4, 12.2);
    place('signpost', 14.6, 13.2);
    // pond
    for (const [x, y, v] of [[4.2, 20.6, 0], [9.6, 20.2, 1], [14.6, 22.8, 0], [3.4, 25.6, 1], [16.8, 26.2, 0]] as const) place('reeds', x, y, v);
    for (const [x, y, v] of [[8, 23.4, 1], [10.5, 25.2, 0], [12.4, 22.6, 2], [6.5, 26.1, 0]] as const) place('lilypad', x, y, v);
    place('rock-big', 1.6, 23.5); place('bush', 18.2, 21.4, 2);
    // farm
    place('house-farm', 37.5, 15.6);
    place('barn', 44.4, 16.2);
    place('well', 33.2, 17.4);
    place('barrel', 40.6, 15.8); place('barrel', 41.4, 16.1, 1); place('crate', 40.9, 16.9); place('sack', 31.6, 15.2);
    place('bench', 34.8, 15.4);
    place('cart', 47, 18.6);
    place('haystack', 38.6, 21.4); place('haystack', 46.6, 23.6);
    place('pigpen', 44, 28.4);
    place('tree-apple', 29.6, 21.6); place('tree-apple', 27.2, 24.2, 1); place('tree-oak', 47.3, 8.6, 1);
    for (let x = 31.5; x < 37.5; x += 1) place('fence-h', x, 21.6, Math.floor(x) % 2);
    place('fence-post', 37.6, 21.6);
    place('bucket', 34.4, 18.4); place('stones-pile', 32.4, 19.4); place('twigs', 30.2, 17.8);
    // characters
    const walker = (id: string, path: [number, number][], speed = 26, anim: 'walk' | 'run' = 'walk') => {
      const key = G.art.character(this, id);
      const pts = path.map(([x, y]) => ({ x: x * 16, y: y * 16 }));
      const spr = this.add.sprite(pts[0].x, pts[0].y, key).setOrigin(0.5, 1);
      if (night) spr.setTint(0x8a96c8);
      this.root.add(spr);
      let i = 0;
      const next = () => {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        i = (i + 1) % pts.length;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        spr.play(G.art.animKey(key, anim, dir), true);
        this.tweens.add({ targets: spr, x: b.x, y: b.y, duration: (Math.hypot(dx, dy) / speed) * 1000, onUpdate: () => spr.setDepth(spr.y), onComplete: () => {
          // pause and idle at corners
          spr.play(G.art.animKey(key, 'idle', dir), true);
          this.time.delayedCall(500 + ((i * 397) % 900), next);
        } });
      };
      next();
      return spr;
    };
    const idler = (id: string, x: number, y: number, anim: CharAnim | CharAnimExtra, dir: Dir) => {
      const key = G.art.character(this, id);
      const spr = this.add.sprite(x * 16, y * 16, key).setOrigin(0.5, 1).setDepth(y * 16);
      spr.play(G.art.animKey(key, anim, dir));
      if (night) spr.setTint(0x8a96c8);
      this.root.add(spr);
      return spr;
    };
    walker('lia', [[2, 21], [5, 17], [9, 13], [13, 13.6], [18, 14.4], [26, 14.4], [31, 14.4], [26, 14.4], [18, 14.4], [9, 13.4]]);
    walker('kyra', [[33, 16.4], [36.5, 16.6], [33, 19], [30, 18]], 22);
    idler('mother', 37.6, 17.3, 'talk', 'down');
    idler('father', 42, 17.8, 'idle', 'left');
    idler('lia-barefoot', 21.8, 11.3, 'sit-read', 'down');
    walker('dog', [[24, 16], [33, 18], [28, 20], [22, 18]], 60, 'run');
    walker('chicken', [[35, 19.5], [37, 20.2], [36, 19]], 10);
    walker('chicken', [[39, 19.8], [41, 20.4]], 9);
    walker('pig', [[42.4, 26.6], [45.6, 27.2], [44, 26]], 8);
    idler('horse', 46.4, 20.6, 'idle', 'left');
    walker('hare', [[22, 24], [25, 23.5], [24, 26]], 30, 'run');
    walker('crow', [[16, 17], [17.5, 17.4]], 8);
    idler('deer', 12.6, 15.8, 'idle', 'right');
    if (night) {
      const shade = this.add.rectangle(0, 0, W, H, 0x0a1030, 0.42).setOrigin(0).setDepth(9000);
      this.root.add(shade);
      place('campfire', 26.2, 18.6);
      idler('valentus-cloak', 25, 18.4, 'sit', 'right');
      for (const l of lights) {
        const g = this.add.image(l.x, l.y, 'fx-light-warm').setDepth(9001).setBlendMode(Phaser.BlendModes.ADD).setScale(l.r / 48).setAlpha(0.8);
        this.tweens.add({ targets: g, alpha: { from: 0.7, to: 0.95 }, yoyo: true, repeat: -1, duration: 160 + Math.random() * 120 });
        this.root.add(g);
      }
      // campfire glow + fireflies
      const fire = this.add.image(26.2 * 16, 18.2 * 16, 'fx-light-warm').setDepth(9001).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setAlpha(0.6);
      this.tweens.add({ targets: fire, alpha: { from: 0.5, to: 0.65 }, scale: { from: 1.05, to: 1.15 }, yoyo: true, repeat: -1, duration: 140 });
      this.root.add(fire);
      for (let k = 0; k < 28; k++) {
        const fx = 40 + ((k * 173) % (W - 80)), fy = 60 + ((k * 97) % (H - 100));
        const ff = this.add.image(fx, fy, k % 7 === 0 ? 'fx-urmacht' : 'fx-firefly').setDepth(9002).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: ff, x: fx + 14 * Math.sin(k), y: fy - 10, alpha: { from: 0.2, to: 1 }, yoyo: true, repeat: -1, duration: 1400 + k * 60, ease: 'Sine.inOut' });
        this.root.add(ff);
      }
      // moon light from the top-left
      const moon = this.add.image(60, 40, 'fx-light-cool').setDepth(9001).setBlendMode(Phaser.BlendModes.ADD).setScale(5).setAlpha(0.35);
      this.root.add(moon);
    }
    this.cameras.main.centerOn(night ? 420 : 300, night ? 270 : 180);
  }

  private buildInterior(): void {
    const terrain = parseMap(INTERIOR);
    const ground = G.art.buildGround(this, { cols: terrain[0].length, rows: terrain.length, terrain, seed: 3 });
    this.root.add(ground);
  }

  private buildCharacters(): void {
    const ids = G.art.characterIds();
    const perRow = 10;
    const cellW = 46, cellH = 50;
    const rows = Math.ceil(ids.length / perRow);
    const W = perRow * cellW + 20, H = rows * cellH + 30;
    const cols = Math.ceil(W / 16), trows = Math.ceil(H / 16);
    const terrain = Array.from({ length: trows }, (_, r) => Array.from({ length: cols }, (_, c) => ((r + c) % 7 === 0 ? 'meadow' : 'grass') as TerrainId));
    this.root.add(G.art.buildGround(this, { cols, rows: trows, terrain, seed: 9 }));
    const dirs: Dir[] = ['down', 'right', 'up', 'left'];
    const cycle: (CharAnim | CharAnimExtra)[] = ['walk', 'idle', 'run', 'attack', 'cast', 'sneak', 'talk'];
    ids.forEach((id, i) => {
      const x = 16 + (i % perRow) * cellW + cellW / 2, y = 22 + Math.floor(i / perRow) * cellH + 28;
      const key = G.art.character(this, id);
      const spr = this.add.sprite(x, y, key).setOrigin(0.5, 1);
      this.root.add(spr);
      this.label(id, x, y + 2);
      this.spots.set(id, { x, y: y - 12 });
      let step = i % 4;
      const play = () => {
        const dir = dirs[step % 4];
        const anim = cycle[Math.floor(step / 4) % cycle.length];
        spr.play(G.art.animKey(key, anim, dir));
        step++;
      };
      play();
      this.time.addEvent({ delay: 1600, loop: true, callback: play });
    });
    this.bounds.setTo(0, 0, W, H);
  }

  private animChar = 'lia';

  private buildAnims(): void {
    const want = new URLSearchParams(location.search).get('char');
    if (want) this.animChar = want;
    const id = this.animChar;
    const key = G.art.character(this, id);
    const { w, h } = G.art.characterSize(key);
    const anims: (CharAnim | CharAnimExtra)[] = ['idle', 'walk', 'run', 'sneak', 'interact', 'kneel', 'sit', 'lie', 'cast', 'attack', 'shoot', 'hit', 'fall', 'carry', 'read', 'sit-read', 'crouch', 'sleep', 'struggle', 'wave', 'point', 'talk', 'cheer'];
    const dirs: Dir[] = ['down', 'right', 'up', 'left'];
    const blockW = 4 * (w + 2) + 6, blockH = h + 14;
    const perRow = 4;
    this.root.add(this.add.rectangle(0, 0, perRow * blockW + 16, Math.ceil(anims.length / perRow) * blockH + 40, 0x2b3a2a).setOrigin(0));
    anims.forEach((anim, i) => {
      const bx = 8 + (i % perRow) * blockW, by = 22 + Math.floor(i / perRow) * blockH;
      this.root.add(this.add.rectangle(bx - 2, by - 2, blockW - 4, h + 4, 0x3d5a34).setOrigin(0));
      dirs.forEach((dir, d) => {
        const spr = this.add.sprite(bx + d * (w + 2) + w / 2, by + h, key).setOrigin(0.5, 1);
        const k = G.art.animKey(key, anim, dir);
        spr.play(k);
        // non-looping anims restart so they can be judged
        spr.on('animationcomplete', () => this.time.delayedCall(500, () => spr.active && spr.play(k)));
        this.root.add(spr);
      });
      this.label(anim, bx + blockW / 2 - 4, by + h + 1);
    });
    this.label(`Figur: ${id}  (←/→ wechseln)`, 240, 4);
    const ids = G.art.characterIds();
    this.input.keyboard!.off('keydown-COMMA').off('keydown-PERIOD');
    const sw = (dlt: number) => { const i = ids.indexOf(this.animChar); this.animChar = ids[(i + dlt + ids.length) % ids.length]; this.show('anims'); };
    this.input.keyboard!.once('keydown-COMMA', () => sw(-1));
    this.input.keyboard!.once('keydown-PERIOD', () => sw(1));
    if (new URLSearchParams(location.search).get('sheet')) {
      const img = this.add.image(perRow * blockW + 30, 0, key, '__BASE').setOrigin(0);
      this.root.add(img);
    }
  }
  private buildProps(): void {
    const ids = G.art.propIds();
    const maxW = 920;
    let x = 12, y = 14, rowH = 0;
    const placed: { id: string; v: number; x: number; y: number }[] = [];
    const variantsOf = (id: string) => { let n = 1; while (n < 4 && G.art.prop(this, id, n).key !== G.art.prop(this, id, 0).key) n++; return n; };
    for (const id of ids) {
      const nv = variantsOf(id);
      const infos = Array.from({ length: nv }, (_, v) => G.art.prop(this, id, v));
      const w = Math.max(44, infos.reduce((s, i) => s + i.width + 4, 0));
      const h = Math.max(...infos.map(i => i.height)) + 14;
      if (x + w > maxW) { x = 12; y += rowH; rowH = 0; }
      let cx = x + (w - infos.reduce((s, i) => s + i.width + 4, 0)) / 2;
      infos.forEach((info, v) => { placed.push({ id, v, x: Math.round(cx + info.originX), y: y + Math.max(...infos.map(i => i.height)) - (info.height - info.originY) }); cx += info.width + 4; });
      this.label(id, x + w / 2, y + h - 12);
      this.spots.set(id, { x: x + w / 2, y: y + h / 2 });
      x += w + 6;
      rowH = Math.max(rowH, h + 6);
    }
    const H = y + rowH + 16;
    const cols = Math.ceil(maxW / 16) + 1, rows = Math.ceil(H / 16) + 1;
    const terrain = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => 'grass' as TerrainId));
    this.root.add(G.art.buildGround(this, { cols, rows, terrain, seed: 5 }));
    for (const pl of placed) {
      const info = G.art.prop(this, pl.id, pl.v);
      const spr = this.add.sprite(pl.x, pl.y, info.key).setOrigin(info.originX / info.width, info.originY / info.height);
      if (info.anim) spr.play(info.anim);
      this.root.add(spr);
    }
    this.bounds.setTo(0, 0, maxW, H);
  }
  private buildPortraits(): void {
    const dom = this.domPanel();
    dom.style.display = 'block';
    dom.style.background = 'radial-gradient(ellipse at 30% 0%, #1d2638 0%, #0b0e15 70%)';
    const moods = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'determined', 'hurt', 'thinking', 'scared'];
    const moodDe: Record<string, string> = { neutral: 'neutral', happy: 'fröhlich', sad: 'traurig', angry: 'wütend', surprised: 'überrascht', determined: 'entschlossen', hurt: 'verletzt', thinking: 'nachdenklich', scared: 'ängstlich' };
    const scale = Number(new URLSearchParams(location.search).get('pscale') ?? 2);
    const only = new URLSearchParams(location.search).get('only');
    const ids = [...G.art.portraitIds(), 'shadow-sword'].filter(id => !only || only.split(',').includes(id));
    let html = `<style>
      .pg{padding:12px 20px 40px;color:#efe3c8;font-family:'Alegreya Sans SC',sans-serif}
      .pg h2{font-family:Cinzel,serif;color:#e9c977;letter-spacing:.1em;margin:4px 0 12px;font-size:18px}
      .pg .row{display:flex;align-items:center;gap:6px;margin:0 0 6px}
      .pg .name{width:110px;font-size:13px;letter-spacing:.05em;color:#d8b25a;text-align:right;padding-right:6px}
      .pg img{image-rendering:pixelated;width:${64 * scale}px;height:${64 * scale}px;border:1px solid #d8b25a55;border-radius:4px;box-shadow:0 3px 8px #0008}
      .pg .head{display:flex;gap:6px;margin-left:116px;margin-bottom:4px}
      .pg .head span{width:${64 * scale}px;text-align:center;font-size:11px;color:#a99a78}
    </style><div class="pg"><h2>Porträts · alle Stimmungen</h2><div class="head">${moods.map(m => `<span>${moodDe[m]}</span>`).join('')}</div>`;
    for (const id of ids) {
      html += `<div class="row"><div class="name">${id}</div>${moods.map(m => `<img alt="${id} ${m}" src="${G.art.portrait(id, m)}">`).join('')}</div>`;
    }
    html += '</div>';
    dom.innerHTML = html;
  }
  private buildIcons(): void {
    const icons = G.art.iconIds();
    this.cameras.main.setBackgroundColor('#141a26');
    const box = (x: number, y: number, w: number, h: number) => this.root.add(this.add.rectangle(x, y, w, h, 0x1c2436).setOrigin(0).setStrokeStyle(1, 0xd8b25a, 0.4));
    box(6, 14, 468, 128);
    icons.forEach((id, i) => {
      const x = 22 + (i % 13) * 35, y = 32 + Math.floor(i / 13) * 38;
      this.root.add(this.add.rectangle(x, y, 22, 22, 0x2a344a).setStrokeStyle(1, 0xd8b25a, 0.5));
      this.root.add(this.add.image(x, y, G.art.icon(this, id)));
      this.label(id, x, y + 12);
      this.spots.set(id, { x, y });
    });
    box(6, 150, 468, 112);
    const fx = G.art.fxKeys();
    fx.forEach((key, i) => {
      const x = 30 + (i % 8) * 56, y = 176 + Math.floor(i / 8) * 34;
      const big = key === 'fx-glow' || key.startsWith('fx-light') || key === 'fx-ring' || key === 'fx-smoke';
      const img = this.add.image(x, y, key).setScale(big ? 0.4 : 2);
      if (key === 'fx-glow' || key.startsWith('fx-light') || key === 'fx-urmacht' || key === 'fx-firefly' || key === 'fx-violet') img.setBlendMode(Phaser.BlendModes.ADD);
      this.root.add(img);
      this.label(key.replace('fx-', ''), x, y + 12);
      this.tweens.add({ targets: img, alpha: { from: 1, to: 0.6 }, yoyo: true, repeat: -1, duration: 700 + i * 37 });
    });
  }

  update(_t: number, dt: number): void {
    const cam = this.cameras.main;
    const sp = (0.25 * dt) / cam.zoom;
    const k = this.keys;
    if (k.LEFT.isDown || k.A.isDown) cam.scrollX -= sp;
    if (k.RIGHT.isDown || k.D.isDown) cam.scrollX += sp;
    if (k.UP.isDown || k.W.isDown) cam.scrollY -= sp;
    if (k.DOWN.isDown || k.S.isDown) cam.scrollY += sp;
    // DOM labels follow world positions
    const r = canvasRect();
    if (!r) return;
    const scale = r.width / 480;
    const view = cam.worldView;
    for (const l of this.labels) {
      const sx = (l.x - view.x) * cam.zoom, sy = (l.y - view.y) * cam.zoom;
      const vis = sx > -40 && sy > -20 && sx < 520 && sy < 290;
      l.el.style.display = vis ? '' : 'none';
      if (vis) { l.el.style.left = `${r.left + sx * scale}px`; l.el.style.top = `${r.top + sy * scale}px`; }
    }
  }
}
