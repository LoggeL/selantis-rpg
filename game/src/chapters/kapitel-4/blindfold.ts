// The blindfold walk (augenbinde, part 2): a dark screen, only sounds. Voices are placed in stereo by where the
// speaker stands relative to Lia, and every sound draws faint rings in the darkness at its direction, so the walk
// also works without headphones. Lia moves freely on the forest path map underneath; bumping into the undergrowth,
// stepping into the brook or forgetting to duck under the fallen trunk all answer with sound and a jolt.
//
// What Lia "sees" is painted (assets/minigames/k4-blind-*, Codex, prompts in docs/rebuild/art/minigames.json, built
// by output/k4-build.py): the inside of the linen blindfold with forest light seeping through, and her own hands
// groping forward. It lives in the UI backdrop layer (above the world canvas, below HUD, bubbles, touch controls and
// dialogue). The code only adds the sound rings, the light, the pain flash and the bobbing of the hands.
import Phaser from 'phaser';
import { G } from '../../core/G';
import { assetUrl, manifest } from '../../art/manifest';
import { ctx } from '../../ui/context';
import type { UiApiExt } from '../../ui';
import type { WorldCtx } from '../../world';
import { internals, moveIntent, sfx } from './shared';

const W = 640, H = 360;

export const RING = {
  azar: 0xe0b45a,
  foltan: 0x7f9fd4,
  stranger: 0xd6d0c0,
  water: 0x9cc0e6,
  leaves: 0x8db36a,
  pain: 0xd4573b,
} as const;

interface Ring { x: number; y: number; r: number; max: number; color: number; life: number; age: number; width: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; age: number }

export interface VoiceOpts { pitch: number; wave?: OscillatorType; color: number; name: string; ms?: number }

const STYLE_ID = 'k4-blind-style';
const CSS = `
.k4-blind{position:absolute;inset:0;overflow:hidden;pointer-events:none;background:#050404;transition:opacity var(--k4b-ms,0ms) ease}
.k4-blind-cloth{position:absolute;inset:-4%;background:#0c0805 center 30%/cover no-repeat;opacity:.5;filter:saturate(.9) blur(7px);
  animation:k4b-drift 14s ease-in-out infinite alternate}
@keyframes k4b-drift{from{transform:translate(-1%,-.6%) scale(1.02)}to{transform:translate(1%,.6%) scale(1.04)}}
.k4-blind-seep{position:absolute;inset:0;mix-blend-mode:screen;background:radial-gradient(60% 45% at 28% 6%,rgba(255,196,110,.22),rgba(255,170,80,.05) 55%,transparent 75%);
  animation:k4b-seep 5.5s ease-in-out infinite alternate}
@keyframes k4b-seep{from{opacity:.55}to{opacity:1}}
.k4-blind-vig{position:absolute;inset:0;background:radial-gradient(85% 75% at 50% 42%,transparent 35%,rgba(0,0,0,.72) 100%)}
.k4-blind-fx{position:absolute;inset:0;width:100%;height:100%;z-index:2}
.k4-blind-hands{position:absolute;left:50%;bottom:-10%;width:min(74vw,132vh);transform:translateX(-50%);transform-origin:50% 100%;
  filter:brightness(.5) sepia(.2) drop-shadow(0 -.4em 1.4em rgba(0,0,0,.6));opacity:.95;transition:transform .5s cubic-bezier(.3,.7,.3,1)}
.k4-blind-hands img{display:block;width:100%;height:auto;-webkit-user-drag:none}
.k4-blind-hands::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(5,4,4,.75) 100%)}
.k4-blind.is-walking .k4-blind-hands{animation:k4b-bob .62s ease-in-out infinite alternate}
@keyframes k4b-bob{from{translate:-.6% 0;rotate:-.6deg}to{translate:.6% -2.4%;rotate:.6deg}}
.k4-blind.is-hurt .k4-blind-hands{transform:translateX(-50%) translateY(4%) scale(.97)}
.k4-blind-pain{position:absolute;inset:0;opacity:0;background:radial-gradient(70% 70% at 50% 45%,rgba(120,20,10,.1),rgba(110,14,6,.65) 100%)}
.k4-blind.fx-pain .k4-blind-pain{animation:k4b-pain .55s ease-out}
.k4-blind.fx-pain .k4-blind-cloth{animation:k4b-shake .3s linear,k4b-drift 14s ease-in-out infinite alternate}
@keyframes k4b-pain{0%{opacity:1}100%{opacity:0}}
@keyframes k4b-shake{0%,100%{translate:0 0}25%{translate:-.6em .3em}50%{translate:.5em -.2em}75%{translate:-.3em .1em}}
.k4-blind-hint{position:absolute;z-index:3;left:50%;bottom:max(1.1em,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:1.4em;align-items:center;
  padding:.4em 1.2em;border-radius:2em;background:rgba(10,8,6,.55);border:1px solid rgba(216,178,90,.28);color:var(--parch-dim,#c9b993);
  font-family:var(--f-label);font-size:.92em;letter-spacing:.06em;white-space:nowrap;opacity:.9}
.k4-blind-hint span{display:inline-flex;align-items:center;gap:.4em}
.k4-blind-hint .ch-key{font-size:.85em}
.is-touch .k4-blind-hint{flex-direction:column;gap:.2em;border-radius:.8em;padding:.35em 1em}
.is-portrait.is-touch .k4-blind-hint{top:auto;bottom:24%}
.is-touch:not(.is-portrait) .k4-blind-hint{left:max(1em,env(safe-area-inset-left));bottom:max(.9em,env(safe-area-inset-bottom));transform:none;align-items:flex-start}
.is-portrait .k4-blind-cloth{background-position:22% 0}
.is-portrait .k4-blind-hands{width:150vw;bottom:-2%}
.is-portrait .k4-blind-hint{flex-direction:column;gap:.3em;border-radius:.8em}
.k4-blind.is-reduced .k4-blind-cloth,.k4-blind.is-reduced .k4-blind-seep{animation:none}
.k4-blind.is-reduced.is-walking .k4-blind-hands{animation:none}
.k4-blind.is-reduced.fx-pain .k4-blind-cloth{animation:none}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = CSS;
  document.head.appendChild(st);
}

const art = (key: string, ext = 'png') => assetUrl(manifest().images?.[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${ext}`);
const reducedMotion = () => ctx.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const rgb = (c: number) => `${(c >> 16) & 255},${(c >> 8) & 255},${c & 255}`;

/** Darkness, rings and positional voices for one world visit. */
export class Blindfold {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D | null;
  private rings: Ring[] = [];
  private sparks: Spark[] = [];
  private level = 1;
  private readonly token: number;
  private readonly reduced: boolean;
  private lastPos = { x: 0, y: 0 };
  private stuckT = 0;
  private bumpCooldown = 0;
  private walkT = 0;
  private alive = true;
  /** Called when Lia pushes against an obstacle for a moment (once per cooldown). */
  onBump: (() => void) | null = null;

  constructor(private w: WorldCtx) {
    ensureStyle();
    const scene = w.scene;
    this.token = (G.ui as UiApiExt).token();
    this.reduced = reducedMotion();
    const touch = ctx.root?.classList.contains('is-touch') ?? false;
    const sneak = w.controlHint('sneak');
    this.root = document.createElement('div');
    this.root.className = `k4-blind${this.reduced ? ' is-reduced' : ''}`;
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `
      <div class="k4-blind-cloth" style="background-image:url('${art('k4-blind-cloth', 'jpg')}')"></div>
      <div class="k4-blind-seep"></div>
      <canvas class="k4-blind-fx"></canvas>
      <div class="k4-blind-hands"><img alt="" draggable="false" src="${art('k4-blind-hands')}"></div>
      <div class="k4-blind-vig"></div>
      <div class="k4-blind-pain"></div>
      <div class="k4-blind-hint">${touch
        ? '<span>Stick oder Tippen: gehen</span><span>Schleichen-Knopf halten: ducken</span>'
        : '<span><span class="ch-key">W</span><span class="ch-key">A</span><span class="ch-key">S</span><span class="ch-key">D</span> oder Klick: gehen</span>' +
          `<span>${/^[A-Z]$/.test(sneak) ? `<span class="ch-key">${sneak}</span>` : sneak} halten: ducken</span>`}</div>`;
    (ctx.layers.backdrop ?? document.body).appendChild(this.root);
    this.canvas = this.root.querySelector('.k4-blind-fx') as HTMLCanvasElement;
    this.g = this.canvas.getContext('2d');
    scene.events.on('update', this.update, this);
    scene.events.once('shutdown', () => this.destroy());
    const p = internals(w).player;
    if (p) this.lastPos = { x: p.x, y: p.y };
  }

  get covered(): boolean { return this.level > 0.5; }

  /** Fades the blindfold (1 = dark, 0 = sight). */
  set(level: number, ms = 0): Promise<void> {
    this.level = level;
    this.root.style.setProperty('--k4b-ms', `${ms}ms`);
    this.root.style.opacity = String(level);
    if (!ms) return Promise.resolve();
    return new Promise(resolve => this.w.scene.time.delayedCall(ms, () => resolve()));
  }

  /** Screen position of a world point, clamped into the visible frame (direction indicator). */
  screenOf(x: number, y: number): { x: number; y: number } {
    const s = internals(this.w).toScreen(x, y);
    return { x: Phaser.Math.Clamp(s.x, 46, W - 46), y: Phaser.Math.Clamp(s.y, 44, H - 70) };
  }

  /** Stereo position -1..1 and loudness 0..1 of a world point relative to Lia. */
  ear(x: number, y: number): { pan: number; vol: number; dist: number } {
    const p = internals(this.w).player ?? { x, y };
    const dx = x - p.x, dy = y - p.y;
    const dist = Math.hypot(dx, dy);
    return { pan: Phaser.Math.Clamp(dx / 110, -1, 1), vol: Phaser.Math.Clamp(1.25 - dist / 320, 0.25, 1.1), dist };
  }

  /** Expanding rings at a screen point (game coordinates, 640×360). */
  ripple(sx: number, sy: number, color: number, strength = 1): void {
    if (!this.alive) return;
    for (let i = 0; i < 3; i++) {
      this.rings.push({ x: sx, y: sy, r: 4 + i * 5, max: 26 + 22 * strength + i * 8, color, life: 1.1 + i * 0.25, age: -i * 0.16, width: 2 });
    }
  }

  /** Rings at a world point (clamped to the frame). */
  rippleAt(x: number, y: number, color: number, strength = 1): void {
    const s = this.screenOf(x, y);
    this.ripple(s.x, s.y, color, strength);
  }

  /**
   * A voice in the dark: a speech bubble at the speaker's direction, typewriter blips panned by position, rings.
   * Resolves after the line had time to be read (the player can keep walking meanwhile).
   */
  async voice(actorId: string | null, text: string, o: VoiceOpts): Promise<void> {
    if (!this.alive) return;
    const ui = G.ui as UiApiExt;
    const where = (): { x: number; y: number } => {
      if (!actorId) return { x: W / 2, y: 70 };
      const a = this.w.actor(actorId);
      if (!a.exists) return { x: W / 2, y: 70 };
      return this.screenOf(a.x, a.y - 34);
    };
    const ms = o.ms ?? Math.max(1700, 900 + text.length * 48);
    const spoken = ui.bubble(`*${o.name}:* ${text}`, where, ms, { speaker: actorId ?? 'k4-wache', voiceText: text, foreground: true });
    const pos = where();
    this.ripple(pos.x, pos.y + 18, o.color, 1);
    const letters = Math.min(40, Math.ceil(text.replace(/[^\p{L}]/gu, '').length / 2));
    const started = this.token;
    if (!spoken.voiced) void (async () => {
      for (let i = 0; i < letters; i++) {
        if (!ui.alive(started) || !this.alive) return;
        const a = actorId ? this.w.actor(actorId) : null;
        const e = a && a.exists ? this.ear(a.x, a.y) : { pan: 0, vol: 0.8 };
        try { G.audio.blip(o.pitch * (0.94 + Math.random() * 0.12), o.wave ?? 'triangle', { pan: e.pan, volume: e.vol }); } catch { /* audio optional */ }
        if (i % 6 === 5) { const p = where(); this.ripple(p.x, p.y + 18, o.color, 0.6); }
        await ui.wait(62);
      }
    })();
    if (spoken.voiceDone) await spoken.voiceDone;
    await ui.wait(spoken.voiced ? 600 : ms);
  }

  /** A panned one-shot sound with rings at a world point. */
  soundAt(name: Parameters<typeof G.audio.sfx>[0], x: number, y: number, color: number, volume = 1): void {
    const e = this.ear(x, y);
    sfx(name, { pan: e.pan, volume: volume * e.vol, distance: Phaser.Math.Clamp(e.dist / 500, 0, 0.8) });
    this.rippleAt(x, y, color, 1.2);
  }

  /** A jolt of pain in the dark (bump, bonk): red flash, the hands flinch, a few stars. */
  pain(): void {
    const p = internals(this.w).player;
    if (p) {
      const s = this.screenOf(p.x, p.y - 20);
      this.ripple(s.x, s.y, RING.pain, 1.6);
      const n = this.reduced ? 0 : 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const v = 40 + Math.random() * 50;
        this.sparks.push({ x: W / 2, y: H * 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, life: 0.7 + Math.random() * 0.4, age: 0 });
      }
    }
    this.w.camera.shake(220, 0.006);
    this.root.classList.remove('fx-pain');
    void this.root.offsetWidth;
    this.root.classList.add('fx-pain', 'is-hurt');
    this.w.scene.time.delayedCall(420, () => { if (this.alive) this.root.classList.remove('is-hurt'); });
  }

  /** Game coordinates (640×360) → CSS pixels of the backdrop layer (the canvas rect, like the speech bubbles). */
  private toPx(x: number, y: number, rect: DOMRect): { x: number; y: number; s: number } {
    const st = ctx.stage;
    return { x: st.x - rect.left + (x / W) * st.w, y: st.y - rect.top + (y / H) * st.h, s: st.w / W };
  }

  private draw(dt: number): void {
    const g = this.g;
    if (!g) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(rect.width * dpr)), ch = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, rect.width, rect.height);
    g.globalCompositeOperation = 'lighter';
    this.rings = this.rings.filter(r => r.age < r.life);
    for (const r of this.rings) {
      r.age += dt;
      if (r.age < 0) continue;
      const k = r.age / r.life;
      const p = this.toPx(r.x, r.y, rect);
      const rad = (r.r + (r.max - r.r) * Phaser.Math.Easing.Cubic.Out(k)) * p.s;
      const alpha = Math.min(1, (1 - k) * 0.95);
      const c = rgb(r.color);
      // a soft glow where the sound comes from, strongest when the ring is born
      if (k < 0.5) {
        const gl = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 0.9);
        gl.addColorStop(0, `rgba(${c},${(0.38 * (1 - k * 2)).toFixed(3)})`);
        gl.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gl;
        g.beginPath(); g.ellipse(p.x, p.y, rad, rad * 0.62, 0, 0, Math.PI * 2); g.fill();
      }
      g.shadowColor = `rgba(${c},${alpha.toFixed(3)})`;
      g.shadowBlur = 16 * p.s;
      g.strokeStyle = `rgba(${c},${alpha.toFixed(3)})`;
      g.lineWidth = r.width * p.s * (1.3 - 0.6 * k);
      g.beginPath(); g.ellipse(p.x, p.y, rad, rad * 0.6, 0, 0, Math.PI * 2); g.stroke();
    }
    g.shadowBlur = 0;
    // stars after a bump
    this.sparks = this.sparks.filter(s => s.age < s.life);
    for (const s of this.sparks) {
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.96; s.vy *= 0.96;
      const p = this.toPx(s.x, s.y, rect);
      const a = 1 - s.age / s.life;
      const r = (3.2 + 1.8 * Math.sin(s.age * 18)) * p.s;
      g.fillStyle = `rgba(255,224,150,${a.toFixed(3)})`;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const ang = (i * Math.PI) / 4; const rr = i % 2 ? r * 0.35 : r * 1.6; g.lineTo(p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr); }
      g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }

  private update(_t: number, delta: number): void {
    if (!this.alive) return;
    const dt = Math.min(delta, 50) / 1000;
    this.draw(dt);
    // ---- bump detection: pushing while not moving ----
    const p = internals(this.w).player;
    if (!p) return;
    this.bumpCooldown -= dt;
    const moved = Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y);
    this.lastPos = { x: p.x, y: p.y };
    this.walkT = moved > 0.2 ? 0.25 : this.walkT - dt;
    this.root.classList.toggle('is-walking', this.walkT > 0);
    const intent = moveIntent(this.w);
    if ((intent.x !== 0 || intent.y !== 0) && moved < 0.25 * (delta / 16.7) && !G.ui.busy()) this.stuckT += dt;
    else this.stuckT = 0;
    if (this.stuckT > 0.28 && this.bumpCooldown <= 0) {
      this.stuckT = 0;
      this.bumpCooldown = 1.6;
      this.onBump?.();
    }
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.w.scene.events.off('update', this.update, this);
    this.root.remove();
  }
}
