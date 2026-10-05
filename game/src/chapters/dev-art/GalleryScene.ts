import Phaser from 'phaser';
import { G } from '../../core/G';
import { GAME_H, GAME_W, canvasRect } from '../../core/viewport';
import type { CharAnim, CharAnimExtra } from '../../art/api';
import type { ArtExtras } from '../../art';
import type { Dir } from '../../core/types';

export type GalleryPage = 'walk' | 'poses' | 'portraits' | 'props' | 'backgrounds' | 'fx';
export const PAGES: { id: GalleryPage; label: string }[] = [
  { id: 'walk', label: 'Figuren' },
  { id: 'poses', label: 'Posen' },
  { id: 'portraits', label: 'Porträts' },
  { id: 'props', label: 'Requisiten & Symbole' },
  { id: 'backgrounds', label: 'Hintergründe & Tafeln' },
  { id: 'fx', label: 'Effekte' },
];

interface Label { el: HTMLElement; x: number; y: number }
const art = () => G.art as typeof G.art & ArtExtras;
const DIRS: Dir[] = ['down', 'left', 'right', 'up'];

/**
 * Dev gallery of the painted (Codex-generated) assets from public/assets/manifest.json.
 * ?scene=art-gallery&page=walk|poses|portraits|props|backgrounds|fx. Keys: 1-6 pages, +/- zoom, arrows/drag pan.
 */
export class GalleryScene extends Phaser.Scene {
  static KEY = 'ArtGallery';
  private page: GalleryPage = 'walk';
  private root!: Phaser.GameObjects.Container;
  private overlay!: HTMLElement;
  private labelLayer!: HTMLElement;
  private labels: Label[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private token = 0;
  /** World positions of gallery items by id (for focusing in tests). */
  readonly spots = new Map<string, { x: number; y: number }>();
  /** Resolves when the current page finished loading its assets (for e2e screenshots). */
  ready: Promise<void> = Promise.resolve();

  constructor() { super(GalleryScene.KEY); }

  init(data: { page?: GalleryPage }): void {
    this.page = PAGES.some(p => p.id === data.page) ? data.page! : 'walk';
  }

  focus(id: string, zoom = 2): void {
    const s = this.spots.get(id);
    if (s) this.cameras.main.setZoom(zoom).centerOn(s.x, s.y);
  }

  create(): void {
    this.buildOverlay();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,FOUR,FIVE,SIX') as Record<string, Phaser.Input.Keyboard.Key>;
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((k, i) => this.keys[k].on('down', () => this.show(PAGES[i].id)));
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
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * f, 0.25, 6));
  }

  private buildOverlay(): void {
    const o = document.createElement('div');
    o.className = 'art-gallery-overlay';
    o.innerHTML = `<style>
      .art-gallery-overlay{position:fixed;inset:0;pointer-events:none;z-index:50;font-family:'Alegreya Sans SC',Alegreya,Georgia,sans-serif;color:#efe3c8}
      .art-gallery-overlay .tabs{position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:4px;pointer-events:auto;background:#141a26e8;border:1px solid #d8b25a88;border-radius:8px;padding:4px;box-shadow:0 6px 18px #0008}
      .art-gallery-overlay .tabs button{all:unset;cursor:pointer;padding:4px 10px;border-radius:5px;font-size:14px;letter-spacing:.06em;color:#cdbf9f;white-space:nowrap}
      .art-gallery-overlay .tabs button.on{background:#d8b25a;color:#141a26}
      .art-gallery-overlay .title{position:absolute;left:14px;bottom:10px;font-family:Cinzel,serif;font-size:15px;letter-spacing:.12em;color:#e9c977;text-shadow:0 2px 3px #000}
      .art-gallery-overlay .lbl{position:absolute;transform:translate(-50%,0);font-size:12px;letter-spacing:.04em;white-space:nowrap;color:#efe3c8;text-shadow:0 1px 2px #000,0 0 3px #000}
      .art-gallery-overlay .dom{position:absolute;inset:52px 0 0 0;overflow:auto;pointer-events:auto;display:none;padding:8px 18px 40px;background:#0b0e15}
      .art-gallery-overlay h3{font-family:Cinzel,serif;font-weight:600;color:#e9c977;letter-spacing:.1em;margin:18px 0 8px;font-size:16px}
      .art-gallery-overlay .row{display:flex;flex-wrap:wrap;gap:10px}
      .art-gallery-overlay figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px;background:#141a26;border:1px solid #d8b25a44;border-radius:8px;padding:6px}
      .art-gallery-overlay figure img{display:block;image-rendering:pixelated;border-radius:4px}
      .art-gallery-overlay figcaption{font-size:12px;color:#cdbf9f}
      .art-gallery-overlay .empty{color:#8a8070;font-style:italic}
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

  private dom(): HTMLElement { return this.overlay.querySelector('.dom') as HTMLElement; }

  private label(text: string, x: number, y: number): void {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = text;
    this.labelLayer.appendChild(el);
    this.labels.push({ el, x, y });
  }

  show(page: GalleryPage): void {
    this.page = page;
    const token = ++this.token;
    this.overlay.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.page === page));
    this.root?.destroy();
    this.labels.forEach(l => l.el.remove());
    this.labels = [];
    this.spots.clear();
    this.tweens.killAll();
    this.time.removeAllEvents();
    const dom = this.dom();
    dom.innerHTML = '';
    dom.style.display = 'none';
    this.root = this.add.container(0, 0);
    this.cameras.main.setZoom(1).setScroll(0, 0).setBackgroundColor('#0b0e15');
    const builders: Record<GalleryPage, () => Promise<void>> = {
      walk: () => this.buildWalk(token),
      poses: () => this.buildPoses(token),
      portraits: async () => this.buildPortraits(),
      props: () => this.buildProps(token),
      backgrounds: () => this.buildBackgrounds(token),
      fx: async () => this.buildFx(),
    };
    this.ready = builders[page]().catch(err => console.error('[gallery]', err));
  }

  // ------------------------------------------------------------------ pages

  /** Characters standing and walking in all four directions over a painted background, at true game scale. */
  private async buildWalk(token: number): Promise<void> {
    const ids = art().assetIds('character');
    const bgs = art().assetIds('background');
    const bgId = ['art-gallery-meadow', 'dev-meadow'].find(b => bgs.includes(b)) ?? bgs[0];
    await G.art.preload(this, { characters: ids, backgrounds: bgId ? [bgId] : [] });
    if (token !== this.token) return;
    if (!ids.length) { this.label('Noch keine Figuren im Manifest', GAME_W / 2, 160); return; }
    const perRow = 5, colW = GAME_W / perRow, bandH = 150, top = 30;
    const rows = Math.ceil(ids.length / perRow);
    if (bgId) {
      const bg = G.art.background(this, bgId);
      const k = bg.width > GAME_W ? GAME_W / bg.width : 1;
      for (let y = 0; y < top + rows * bandH + 40; y += bg.height * k) {
        this.root.add(this.add.image(0, y, bg.key).setOrigin(0, 0).setScale(k).setDepth(-10));
      }
    }
    ids.forEach((id, i) => {
      const key = G.art.character(this, id);
      const a = G.art.characterAnchor(key);
      const cx = Math.round(colW * (i % perRow) + colW / 2);
      const y0 = top + Math.floor(i / perRow) * bandH;
      this.root.add(this.add.rectangle(cx, y0 + 12, colW - 8, 16, 0x0b0e15, 0.55));
      this.label(id, cx, y0 + 4);
      this.spots.set(id, { x: cx, y: y0 + 60 });
      DIRS.forEach((d, j) => {
        const x = cx - 39 + j * 26;
        const idle = this.add.sprite(x, y0 + 78, key).setOrigin(a.x, a.y).setDepth(y0 + 78);
        idle.play(G.art.animKey(key, 'idle', d));
        const walk = this.add.sprite(x, y0 + 138, key).setOrigin(a.x, a.y).setDepth(y0 + 138);
        walk.play(G.art.animKey(key, 'walk', d));
        this.root.add([idle, walk]);
      });
    });
    this.label('oben: Stand · unten: Gehen (Süd, West, Ost, Nord) · Mausrad/Pfeile: blättern', GAME_W / 2, GAME_H - 18);
  }

  /** Every painted pose of every character (true scale; left-facing columns are mirrored by the art layer). */
  private async buildPoses(token: number): Promise<void> {
    const ids = art().assetIds('character');
    await G.art.preload(this, { characters: ids });
    if (token !== this.token) return;
    const m = art().manifest();
    const rowH = 78;
    ids.forEach((id, i) => {
      const key = G.art.character(this, id);
      const an = G.art.characterAnchor(key);
      const y = 40 + rowH * i + 56;
      this.label(id, 40, y - 36);
      const poses = ['idle', ...art().poseIds(id).filter(p => p !== 'idle')];
      let x = 96;
      poses.forEach((pose, j) => {
        const w = pose === 'idle' ? 64 : m.characters[id].poses[pose]?.w ?? 64;
        x += w / 2;
        const s = this.add.sprite(x, y, key).setOrigin(an.x, an.y);
        s.play(G.art.animKey(key, pose as CharAnim | CharAnimExtra, j % 2 ? 'left' : 'right'));
        this.root.add(s);
        this.label(pose, x, y + 2);
        this.spots.set(`${id}:${pose}`, { x, y: y - 20 });
        x += w / 2 + 6;
      });
    });
    this.cameras.main.setZoom(1).setScroll(0, 0);
    if (ids.length * rowH + 60 > GAME_H) this.label('↓ Mausrad', GAME_W - 40, GAME_H - 20);
  }

  private buildPortraits(): void {
    const dom = this.dom();
    dom.style.display = 'block';
    const ids = art().assetIds('portrait');
    if (!ids.length) { dom.innerHTML = '<p class="empty">Noch keine Porträts im Manifest.</p>'; return; }
    const order = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'determined', 'hurt', 'pained', 'thinking', 'scared'];
    for (const id of ids) {
      const h = document.createElement('h3');
      h.textContent = id;
      dom.appendChild(h);
      const row = document.createElement('div');
      row.className = 'row';
      const moods = art().moodIds(id).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
      for (const mood of moods) {
        const f = document.createElement('figure');
        f.innerHTML = `<img width="160" height="160" alt="${id} ${mood}" src="${G.art.portrait(id, mood)}"><figcaption>${mood}</figcaption>`;
        row.appendChild(f);
      }
      dom.appendChild(row);
    }
  }

  private async buildProps(token: number): Promise<void> {
    // own props first (iso-* belong to the tactics view and come last)
    const ids = art().assetIds('prop').sort((a, b) => Number(a.startsWith('iso-')) - Number(b.startsWith('iso-')) || a.localeCompare(b));
    await G.art.preload(this, { props: ids });
    if (token !== this.token) return;
    // item icons on top
    const list = art().assetIds('icon');
    this.label(list.length ? 'Gegenstände (32×32, Atlas ui/items.png)' : 'Gegenstände: noch kein Atlas', GAME_W / 2, 30);
    list.forEach((id, i) => {
      const ix = 26 + (i % 12) * 53, iy = 70 + Math.floor(i / 12) * 54;
      this.root.add(this.add.rectangle(ix, iy, 38, 38, 0x1e2636).setStrokeStyle(1, 0xd8b25a, 0.4));
      this.root.add(this.add.image(ix, iy, G.art.icon(this, id)));
      this.label(id, ix, iy + 20);
      this.spots.set(`icon:${id}`, { x: ix, y: iy });
    });
    let x = 16, y = 70 + Math.ceil(list.length / 12) * 54 + 20, rowH = 0;
    this.label('Requisiten (Anker türkis, Kollisionsfläche rot)', GAME_W / 2, y - 14);
    for (const id of ids) {
      const info = G.art.prop(this, id);
      if (x + info.width > GAME_W - 10) { x = 16; y += rowH + 26; rowH = 0; }
      const px = x + info.originX, py = y + info.originY;
      const s = this.add.sprite(px, py, info.key).setOrigin(info.originX / info.width, info.originY / info.height);
      if (info.anim) s.play(info.anim);
      this.root.add(s);
      if (info.footprint) {
        const f = info.footprint;
        this.root.add(this.add.rectangle(px + f.x, py + f.y, f.w, f.h).setOrigin(0, 0).setStrokeStyle(1, 0xd4573b, 0.7));
      }
      this.root.add(this.add.circle(px, py, 1.5, 0x49e0c8));
      this.label(id, px, py + 3);
      this.spots.set(id, { x: px, y: py - info.height / 2 });
      x += Math.max(info.width, 44) + 18;
      rowH = Math.max(rowH, info.height);
    }
    if (!ids.length) this.label('Noch keine Requisiten im Manifest', GAME_W / 2, y + 20);
  }

  private async buildBackgrounds(token: number): Promise<void> {
    const dom = this.dom();
    dom.style.display = 'block';
    const bgs = art().assetIds('background');
    const plates = art().assetIds('plate');
    const m = art().manifest();
    const section = (title: string, items: string[], src: (id: string) => string, size: (id: string) => string) => {
      const h = document.createElement('h3');
      h.textContent = title;
      dom.appendChild(h);
      const row = document.createElement('div');
      row.className = 'row';
      if (!items.length) row.innerHTML = '<p class="empty">– noch keine –</p>';
      for (const id of items) {
        const f = document.createElement('figure');
        f.innerHTML = `<img width="384" height="216" style="object-fit:contain;background:#000" alt="${id}" src="${src(id)}"><figcaption>${id} · ${size(id)}</figcaption>`;
        row.appendChild(f);
      }
      dom.appendChild(row);
    };
    section('Kartenhintergründe', bgs, id => m.backgrounds[id].file, id => `${m.backgrounds[id].w}×${m.backgrounds[id].h}`);
    section('Tafeln', plates, id => G.art.plateUrl(id), id => `${m.plates[id].w}×${m.plates[id].h}`);
    const other = Object.keys(m.images);
    section('Weitere Bilder', other, id => m.images[id].file, id => `${m.images[id].w}×${m.images[id].h}`);
    void token;
  }

  private buildFx(): void {
    const fx = G.art.fxKeys();
    this.root.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x10141e).setOrigin(0, 0));
    fx.forEach((key, i) => {
      const x = 50 + (i % 8) * 76, y = 70 + Math.floor(i / 8) * 70;
      const big = key === 'fx-glow' || key.startsWith('fx-light') || key === 'fx-ring' || key === 'fx-smoke';
      const img = this.add.image(x, y, key).setScale(big ? 0.5 : 3);
      if (key === 'fx-glow' || key.startsWith('fx-light') || key === 'fx-urmacht' || key === 'fx-firefly') img.setBlendMode(Phaser.BlendModes.ADD);
      this.root.add(img);
      this.label(key.replace('fx-', ''), x, y + 20);
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
    const r = canvasRect();
    if (!r) return;
    const scale = r.width / GAME_W;
    const view = cam.worldView;
    for (const l of this.labels) {
      const sx = (l.x - view.x) * cam.zoom, sy = (l.y - view.y) * cam.zoom;
      const vis = sx > -40 && sy > -20 && sx < GAME_W + 40 && sy < GAME_H + 10;
      l.el.style.display = vis ? '' : 'none';
      if (vis) { l.el.style.left = `${r.left + sx * scale}px`; l.el.style.top = `${r.top + sy * scale}px`; }
    }
  }
}
