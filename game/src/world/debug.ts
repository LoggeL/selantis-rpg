import type Phaser from 'phaser';
import { G } from '../core/G';
import { GAME_W } from '../core/viewport';
import { areaPx, isAt, toPx, unitPx, mapUnits, type Vec } from './geom';
import { CELL } from './grid';
import { normBlocks, normOccluders, normWalk } from './navgrid';
import { polyBounds, polyCentroid, type Poly } from './poly';
import type { WorldScene } from './WorldScene';

/**
 * Map authoring overlay (F1 or `?debug` / `?worlddebug`): a crisp DOM canvas over the game that draws every polygon,
 * hotspot, exit, trigger, spawn, NPC, guard path, clue and light with labels, plus the cursor position in MAP
 * PIXELS. Shift+click collects points of a draft polygon; Shift+C copies it as code.
 */
export class DebugOverlay {
  on = false;
  private grid = false;
  private cv: HTMLCanvasElement | null = null;
  private info: HTMLDivElement | null = null;
  private draft: [number, number][] = [];
  private mouse: Vec = { x: 0, y: 0 };
  private readonly onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private scene: WorldScene) {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    this.on = Boolean(q && (q.has('debug') || q.has('worlddebug')));
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.onKey, true);
  }

  rebuild(): void { /* geometry is read from the MapDef every frame */ }

  private key(e: KeyboardEvent): void {
    if (e.code === 'F1') { e.preventDefault(); this.on = !this.on; if (!this.on) this.hide(); return; }
    if (!this.on || !e.shiftKey) return;
    if (e.code === 'KeyG') { this.grid = !this.grid; e.preventDefault(); }
    else if (e.code === 'KeyZ') { this.draft.pop(); e.preventDefault(); }
    else if (e.code === 'KeyX') { this.draft = []; e.preventDefault(); }
    else if (e.code === 'KeyC') { this.copy(); e.preventDefault(); }
  }

  private copy(): void {
    const text = `[${this.draft.map(([x, y]) => `[${x}, ${y}]`).join(', ')}]`;
    console.log(`[world debug] polygon (${this.draft.length} Punkte):`, text);
    try { void navigator.clipboard?.writeText(text); } catch { /* clipboard optional */ }
    try { G.ui.toast(`Polygon kopiert (${this.draft.length} Punkte)`, 'info'); } catch { /* ui optional */ }
  }

  /** Shift+click in debug mode adds a draft point instead of walking. */
  consumeClick(wx: number, wy: number, p: Phaser.Input.Pointer): boolean {
    if (!this.on) return false;
    const ev = p.event as MouseEvent | undefined;
    if (!ev?.shiftKey) return false;
    this.draft.push([Math.round(wx), Math.round(wy)]);
    return true;
  }

  private ensure(): void {
    if (this.cv) return;
    const cv = document.createElement('canvas');
    cv.id = 'world-debug';
    Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '50' });
    const info = document.createElement('div');
    Object.assign(info.style, {
      position: 'fixed', left: '8px', bottom: '8px', zIndex: '51', pointerEvents: 'none', maxWidth: '96vw',
      font: '12px/1.35 ui-monospace, Menlo, monospace', color: '#f4f0e0', background: 'rgba(10,12,18,0.78)',
      padding: '6px 9px', borderRadius: '4px', whiteSpace: 'pre-wrap',
    });
    document.body.append(cv, info);
    this.cv = cv; this.info = info;
  }

  private hide(): void {
    this.cv?.remove(); this.info?.remove();
    this.cv = null; this.info = null;
  }

  destroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKey, true);
    this.hide();
  }

  update(): void {
    if (!this.on) return;
    const s = this.scene;
    if (!s.map || !s.player || !s.cam) return;
    this.ensure();
    const cv = this.cv!, info = this.info!;
    const rect = s.game.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(rect.width * dpr) || cv.height !== Math.round(rect.height * dpr)) {
      cv.width = Math.round(rect.width * dpr); cv.height = Math.round(rect.height * dpr);
    }
    Object.assign(cv.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    const g = cv.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    const cam = s.cam, v = cam.worldView;
    const k = (rect.width / GAME_W) * cam.zoom * dpr;
    const X = (x: number) => (x - v.x) * k, Y = (y: number) => (y - v.y) * k;
    const ptr = s.input.activePointer;
    const wp = cam.getWorldPoint(ptr.x, ptr.y);
    this.mouse = { x: wp.x, y: wp.y };
    const def = s.map;

    if (this.grid) this.drawGrid(g, X, Y, k, v);

    const poly = (p: Poly, stroke: string, fill?: string, dash?: number[]) => {
      if (p.length < 2) return;
      g.beginPath();
      p.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      g.setLineDash(dash ?? []); g.strokeStyle = stroke; g.lineWidth = 1.5 * dpr; g.stroke(); g.setLineDash([]);
    };
    const rectP = (r: { x: number; y: number; w: number; h: number }): Poly => [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    const label = (x: number, y: number, text: string, color: string) => {
      g.font = `${Math.round(11 * dpr)}px ui-monospace, Menlo, monospace`;
      g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(text, X(x) + 3 * dpr, Y(y) - 3 * dpr);
      g.fillStyle = color; g.fillText(text, X(x) + 3 * dpr, Y(y) - 3 * dpr);
    };
    const dot = (x: number, y: number, color: string, r = 3) => { g.fillStyle = color; g.beginPath(); g.arc(X(x), Y(y), r * dpr, 0, Math.PI * 2); g.fill(); };
    const circle = (x: number, y: number, r: number, color: string, dash?: number[]) => {
      g.setLineDash(dash ?? []); g.strokeStyle = color; g.lineWidth = 1 * dpr; g.beginPath(); g.arc(X(x), Y(y), r * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    };

    // Walkable areas, holes, blocks
    for (const w of normWalk(def)) {
      poly(w.poly, 'rgba(90,240,120,0.95)', 'rgba(90,240,120,0.08)');
      for (const h of w.holes ?? []) poly(h, 'rgba(255,80,60,0.95)', 'rgba(255,80,60,0.12)');
    }
    normBlocks(def).forEach((b, i) => {
      poly(b.poly, b.move === false ? 'rgba(200,120,255,0.95)' : 'rgba(255,70,50,0.95)', 'rgba(255,70,50,0.14)', b.sight === false ? [4 * dpr, 3 * dpr] : undefined);
      const c = polyCentroid(b.poly);
      label(c.x, c.y, `${b.id ?? `block ${i}`}${b.sight === false ? ' (durchsichtig)' : ''}`, '#ff9a86');
    });
    for (const sfc of def.surfaces ?? []) {
      poly(sfc.poly, 'rgba(230,170,90,0.9)', undefined, [2 * dpr, 3 * dpr]);
      const b = polyBounds(sfc.poly);
      label(b.x + 2, b.y + 12, `${sfc.id ?? 'Fläche'}: ${sfc.kind}`, '#f0c890');
    }
    for (const o of normOccluders(def)) {
      poly(o.poly, 'rgba(190,120,255,0.95)', 'rgba(190,120,255,0.1)');
      const b = polyBounds(o.poly);
      g.strokeStyle = 'rgba(255,140,255,1)'; g.lineWidth = 2 * dpr; g.setLineDash([6 * dpr, 4 * dpr]);
      g.beginPath(); g.moveTo(X(b.x), Y(o.baseline)); g.lineTo(X(b.x + b.w), Y(o.baseline)); g.stroke(); g.setLineDash([]);
      label(b.x, o.baseline, `${o.id ?? 'Verdecker'} · Grundlinie ${o.baseline}`, '#ffb0ff');
    }
    for (const h of def.hidingSpots ?? []) {
      const p = h.poly ?? (h.area ? rectP(areaPx(h.area)) : null);
      if (!p) continue;
      poly(p, 'rgba(255,215,60,0.95)', 'rgba(255,215,60,0.12)');
      const b = polyBounds(p); label(b.x, b.y + 10, `${h.id ?? 'Versteck'} (${h.kind ?? 'bush'})`, '#ffe070');
    }
    for (const t of def.triggers ?? []) {
      const p = t.poly ?? (t.area ? rectP(areaPx(t.area)) : null);
      if (!p) continue;
      poly(p, 'rgba(80,150,255,0.95)', 'rgba(80,150,255,0.12)');
      const b = polyBounds(p); label(b.x, b.y + 10, `Trigger ${t.id}`, '#9cc4ff');
    }
    for (const e of def.exits ?? []) {
      const p = e.poly ?? (e.area ? rectP(areaPx(e.area)) : null);
      if (p) { poly(p, 'rgba(60,230,230,0.95)', 'rgba(60,230,230,0.14)'); const b = polyBounds(p); label(b.x, b.y + 10, `${e.id} → ${e.to}${e.spawn ? `:${e.spawn}` : ''}`, '#7ff'); }
      if (e.door) { const d = toPx(e.door.at); dot(d.x, d.y, '#7ff'); }
    }
    // Interactables (hotspot polygon or point + radius)
    const inter = [...(def.interactables ?? []), ...(def.props ?? []).filter(p => p.interact).map(p => ({ ...p.interact!, id: p.interact!.id ?? p.id ?? p.prop, at: p.at }))];
    for (const it of inter) {
      if (it.poly) poly(it.poly, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0.08)');
      const b = it.poly ? polyBounds(it.poly) : null;
      const at = it.at ? toPx(it.at) : b ? { x: b.x + b.w / 2, y: b.y + b.h } : null;
      if (!at) continue;
      dot(at.x, at.y, '#fff');
      if (!it.poly) circle(at.x, at.y, it.radius ?? 18, 'rgba(255,255,255,0.7)', [3 * dpr, 3 * dpr]);
      label(at.x, at.y, `${it.id}${it.verb ? ` „${it.verb}“` : ''}`, '#fff');
      const st = 'standAt' in it ? it.standAt : undefined;
      if (st && isAt(st)) { const sp = toPx(st); dot(sp.x, sp.y, '#c8f'); label(sp.x, sp.y + 10, 'standAt', '#c8f'); }
    }
    for (const c of def.clues ?? []) { const p = toPx(c.at); dot(p.x, p.y, '#49e0c8'); label(p.x, p.y, `Hinweis ${c.id}`, '#7ff0dc'); }
    for (const l of def.lights ?? []) {
      const p = toPx(l.at); circle(p.x, p.y, l.radius ?? 56, 'rgba(255,220,120,0.7)', [2 * dpr, 4 * dpr]); dot(p.x, p.y, '#ffd870', 2);
      label(p.x, p.y + 12, `Licht ${l.id ?? l.kind ?? ''}${l.flame ? ' + Flamme' : ''}`, '#ffe0a0');
    }
    for (const [name, sp] of Object.entries(def.spawns)) {
      const p = toPx(sp.at); dot(p.x, p.y, '#6f6', 4);
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[sp.dir ?? 'down'];
      g.strokeStyle = '#6f6'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(X(p.x), Y(p.y)); g.lineTo(X(p.x + d[0] * 10), Y(p.y + d[1] * 10)); g.stroke();
      label(p.x, p.y + 12, `Start ${name}`, '#8f8');
    }
    for (const n of def.npcs ?? []) {
      const a = s.actors.get(n.id); const p = a ? { x: a.x, y: a.y } : toPx(n.at);
      dot(p.x, p.y, '#f8f'); label(p.x, p.y, `NPC ${n.id}`, '#fbf');
      if (n.wander) circle(toPx(n.at).x, toPx(n.at).y, unitPx(n.wander), 'rgba(255,140,255,0.5)', [2 * dpr, 3 * dpr]);
    }
    for (const gd of def.guards ?? []) {
      const pts = gd.path.map(w => toPx(isAt(w) ? (w as Parameters<typeof toPx>[0]) : (w as { at: Parameters<typeof toPx>[0] }).at));
      g.strokeStyle = 'rgba(255,160,60,0.95)'; g.lineWidth = 1.5 * dpr; g.setLineDash([5 * dpr, 3 * dpr]);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); if (gd.mode !== 'pingpong' && pts.length > 2) g.closePath(); g.stroke(); g.setLineDash([]);
      pts.forEach((p, i) => { dot(p.x, p.y, '#fa4', 2.5); label(p.x, p.y, i ? `${i}` : `Wache ${gd.id}`, '#fc8'); });
    }
    for (const p of def.props ?? []) {
      const pr = p.id ? s.props.get(p.id) : undefined;
      if (pr) { poly(rectP(pr.bounds()), 'rgba(200,200,200,0.45)', undefined, [1 * dpr, 2 * dpr]); label(pr.x, pr.y, p.id!, '#ccc'); }
    }
    // Player foot point
    dot(s.player.x, s.player.y, '#ff0', 2.5);
    // Draft polygon
    if (this.draft.length) {
      g.strokeStyle = '#ff3fa0'; g.lineWidth = 2 * dpr; g.beginPath();
      this.draft.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      g.lineTo(X(this.mouse.x), Y(this.mouse.y)); g.stroke();
      this.draft.forEach(([x, y], i) => { dot(x, y, '#ff3fa0', 3); label(x, y, `${i}`, '#ff8fc8'); });
    }
    // Cursor crosshair
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1 * dpr;
    g.beginPath(); g.moveTo(X(this.mouse.x) - 8 * dpr, Y(this.mouse.y)); g.lineTo(X(this.mouse.x) + 8 * dpr, Y(this.mouse.y));
    g.moveTo(X(this.mouse.x), Y(this.mouse.y) - 8 * dpr); g.lineTo(X(this.mouse.x), Y(this.mouse.y) + 8 * dpr); g.stroke();

    const mx = Math.round(this.mouse.x), my = Math.round(this.mouse.y);
    const walk = s.grid && !s.grid.solidAt(mx, my) ? 'begehbar' : 'gesperrt';
    const sight = s.grid?.sightAt(mx, my) ? ', sichtdicht' : '';
    const surf = s.terrainAt(mx, my) ?? '–';
    info.textContent = `Karte ${def.id} (${mapUnits() === 'px' ? 'Pixel' : 'Kacheln'}, ${s.mapW}×${s.mapH}) · Maus ${mx}, ${my} (${walk}${sight}, ${surf}) · Lia ${Math.round(s.player.x)}, ${Math.round(s.player.y)}`
      + (this.draft.length ? ` · Entwurf: ${this.draft.length} Punkte` : '')
      + `\nF1 aus · Shift+G Raster · Shift+Klick Punkt · Shift+Z zurück · Shift+C kopieren · Shift+X verwerfen`;
  }

  private drawGrid(g: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, k: number, v: Phaser.Geom.Rectangle): void {
    const grid = this.scene.grid;
    if (!grid) return;
    const c0 = Math.max(0, Math.floor(v.x / CELL)), c1 = Math.min(grid.cols - 1, Math.ceil(v.right / CELL));
    const r0 = Math.max(0, Math.floor(v.y / CELL)), r1 = Math.min(grid.rows - 1, Math.ceil(v.bottom / CELL));
    const sz = CELL * k;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * grid.cols + c;
      if (grid.solid[i]) { g.fillStyle = grid.sight[i] ? 'rgba(255,40,40,0.3)' : 'rgba(255,90,40,0.18)'; g.fillRect(X(c * CELL), Y(r * CELL), sz, sz); }
      else if (grid.sight[i]) { g.fillStyle = 'rgba(160,64,255,0.3)'; g.fillRect(X(c * CELL), Y(r * CELL), sz, sz); }
    }
  }
}
