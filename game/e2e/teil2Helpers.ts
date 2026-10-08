import { expect, test, type Page } from '@playwright/test';
import { playSceneAction, playScenePick } from './sceneActions';

/** Right answers the driver tries first in scene picks (a playthrough should mostly decide well). */
const PICK_PREFER = ['eiche', 'handschrift', 'name', 'leseratte'];

/**
 * Helpers for the Teil II browser tests (teil-2.pw.ts). Everything that plays the game does it with real inputs:
 * keyboard (E/Enter/digits/arrows/WASD/Q/C), mouse clicks on the canvas computed from the world camera, touch via
 * CDP. Gameplay state is only READ through window.G / window.__world / window.__tactics. The two exceptions are
 * documented where they happen: AI planning for battle turns (as in travel-encounters.pw.ts) and a teleport as the
 * very last resort when a walk makes no progress for a long time (every use is recorded in `driveLog.teleports`).
 */

export const QUIET = { textSpeed: 0, reducedMotion: true, music: 0, voice: 0, sfx: 0 };
export const LOUD = { textSpeed: 0, reducedMotion: false, music: 0.6, voice: 0.6, sfx: 0.6 };
const SAVE_KEY = 'selantis.save.v1';

/** Software GL in headless Chromium logs driver chatter as warnings/errors; that is not ours. */
const NOISE = /GPU stall|GL Driver Message|Automatic fallback to software WebGL|WebGL.*(performance|software)/i;

/** output/qa/teil-2/screens/ in the repository (gitignored); e2e/ is two levels below the repository root. */
export const qaScreens = (): string => `${test.info().project.testDir}/../../output/qa/teil-2/screens`;

/** Collects console errors, page errors and failed (>= 400) requests of the page. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  page.on('requestfailed', r => {
    const f = r.failure()?.errorText ?? '';
    if (!/ERR_ABORTED/.test(f)) errors.push(`requestfailed ${f} ${r.url()}`);
  });
  return errors;
}

/** Settings for every page load of this test (also after reloads). */
export async function useSettings(page: Page, settings: Record<string, unknown> = QUIET): Promise<void> {
  await page.addInitScript(s => { localStorage.setItem('selantis.settings.v1', JSON.stringify(s)); }, settings);
}

/** Writes a save into localStorage of the running origin (the title must be loaded). */
export async function writeSave(page: Page, save: Record<string, unknown>): Promise<void> {
  await page.evaluate(([k, s]) => localStorage.setItem(k as string, JSON.stringify(s)), [SAVE_KEY, save] as const);
}

export async function readSave(page: Page): Promise<any> {
  return page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? 'null'), SAVE_KEY);
}

/**
 * Builds the documented default state of a Teil-II scene with the game's own fixture (shared.ts prepareE2) on the title
 * screen, lets `mutate` adjust it, and stores it as a regular campaign save at that scene. Nothing is started.
 */
export async function fixtureSave(page: Page, scene: string, mutate?: string, params?: Record<string, unknown>): Promise<void> {
  await page.evaluate(async ({ scene, mutate, params, key }) => {
    const url = '/src/chapters/teil-2/shared.ts';
    const { prepareE2 } = await import(/* @vite-ignore */ url);
    const G = (window as any).G;
    const keep = JSON.stringify(G.state.data);
    G.state.reset();
    prepareE2(scene);
    const data = JSON.parse(JSON.stringify(G.state.data));
    G.state.data = JSON.parse(keep);
    if (mutate) new Function('data', mutate)(data);
    Object.assign(data, { chapter: 'teil-2', scene, params, savedAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(data));
  }, { scene, mutate, params, key: SAVE_KEY });
}

export async function gotoTitle(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Neues Spiel/ })).toBeVisible({ timeout: 30000 });
}

/** Title → „Fortsetzen“ (mouse click), waits until the saved scene runs. */
export async function continueGame(page: Page, scene?: string): Promise<void> {
  await page.getByRole('button', { name: /Fortsetzen/ }).click();
  await page.waitForFunction(s => {
    const G = (window as any).G;
    return G?.currentScene && (!s || G.currentScene === s) && ((window as any).__world?.player || (window as any).__tactics?.ready || G.ui.busy());
  }, scene, { timeout: 30000 });
}

export async function reloadAndContinue(page: Page, scene?: string): Promise<void> {
  await page.reload();
  await expect(page.getByRole('button', { name: /Fortsetzen/ })).toBeVisible({ timeout: 30000 });
  await continueGame(page, scene);
}

// ---------------------------------------------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------------------------------------------

export const shots: string[] = [];

/** Screenshot into the test output and a copy into output/qa/teil-2/screens/. */
export async function shot(page: Page, name: string): Promise<string> {
  const file = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path: file });
  const copy = `${qaScreens()}/${name}.png`;
  await page.screenshot({ path: copy }); // a second capture right after it, for the QA folder (no node:fs in the e2e types)
  shots.push(copy);
  return copy;
}

// ---------------------------------------------------------------------------------------------------------------
// Game snapshot
// ---------------------------------------------------------------------------------------------------------------

export interface Snap {
  scene: string;
  title: boolean;
  busy: boolean;
  world: boolean;
  worldActive: boolean;
  locked: boolean;
  map: string | null;
  objective: { text: string; target: unknown } | null;
  tactics: boolean;
  hold: boolean;
  action: boolean;
  pick: boolean;
  choices: { text: string; tag: string | null; disabled: boolean }[];
  sammlung: boolean;
  zielen: string | null;
  moment: string | null;
  credits: boolean;
  stealthMap: boolean;
  /** Visible dialogue line (speaker: text) and plate caption. */
  line: string | null;
  plate: string | null;
  sig: string;
}

export async function snap(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const G = (window as any).G, w = (window as any).__world, t = (window as any).__tactics;
    const vis = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].some(e => e.isConnected && e.getClientRects().length > 0);
    const choices = [...document.querySelectorAll<HTMLElement>('.choices:not(.is-out) .choice')].filter(e => e.getClientRects().length).map(e => ({
      text: e.querySelector('.choice-text')?.textContent ?? '', tag: e.querySelector('.choice-tag')?.textContent ?? null, disabled: e.classList.contains('is-disabled'),
    }));
    const worldActive = Boolean(w?.player && w.sys.isActive());
    const d = G.state.data;
    const moment = document.querySelector<HTMLElement>('.e2-moment');
    return {
      scene: G.currentScene,
      title: vis('.title-item'),
      busy: G.ui.busy(),
      world: Boolean(w?.player),
      worldActive,
      locked: worldActive ? w.playerLocked : true,
      map: w?.map?.id ?? null,
      objective: worldActive && w.objective ? { text: w.objective.text, target: w.objective.target } : null,
      tactics: Boolean(t?.ready && t.sys.isActive()),
      hold: vis('.hold'),
      action: Boolean(document.querySelector('.scene-action:not(.is-complete)')),
      pick: Boolean(document.querySelector('.scene-pick:not(.is-out)')),
      choices,
      sammlung: Boolean(document.querySelector('.e2s-root:not(.is-out)')),
      zielen: document.querySelector('.e2-zielen-call')?.textContent ?? null,
      moment: moment?.isConnected ? (moment.dataset.state ?? 'wait') : null,
      credits: Boolean(document.querySelector('.k5-credits')),
      stealthMap: worldActive && Boolean((w.guards?.length ?? 0) > 0 || w.map?.hidingSpots?.length),
      line: (() => {
        const box = document.querySelector<HTMLElement>('.dlg');
        const txt = box && box.getClientRects().length ? box.querySelector('.dlg-text')?.textContent : document.querySelector('.thought')?.textContent;
        return txt ? `${box?.querySelector('.dlg-name')?.textContent ?? ''}: ${txt}` : null;
      })(),
      plate: document.querySelector('.plate .plate-caption-text')?.textContent ?? null,
      sig: [G.currentScene, w?.map?.id, w?.objective?.text, Object.keys(d.flags).length, JSON.stringify(d.flags).length, d.clues.length,
        d.lore.length, d.memories.length, JSON.stringify(d.inventory), w?.player ? `${Math.round(w.player.x / 6)},${Math.round(w.player.y / 6)}` : ''].join('|'),
    } as Snap;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------------------------------------------

export type Chooser = (choices: Snap['choices'], s: Snap) => number | undefined;

/** Default: the first enabled option that carries a knowledge tag (route table, Xenovia quiz), else the first enabled. */
export const defaultChooser: Chooser = choices => {
  const tagged = choices.findIndex(c => !c.disabled && c.tag);
  if (tagged >= 0) return tagged;
  const first = choices.findIndex(c => !c.disabled);
  return first >= 0 ? first : 0;
};

async function answer(page: Page, s: Snap, chooser: Chooser): Promise<void> {
  await page.waitForTimeout(750); // the list arms only after its rows are visible
  const again = await snap(page);
  if (!again.choices.length) return;
  const i = chooser(again.choices, again) ?? defaultChooser(again.choices, again)!;
  await page.keyboard.press(String(i + 1));
  await page.waitForTimeout(250);
}

// ---------------------------------------------------------------------------------------------------------------
// Canvas clicks and walking
// ---------------------------------------------------------------------------------------------------------------

export const driveLog = { teleports: [] as string[], workarounds: [] as string[], mouseIssues: [] as string[], battles: [] as string[], defeats: 0, lookPresses: 0, clicks: 0 };

/** Where to click for the current objective (page coordinates), computed from the world camera and grid. */
async function planWalk(page: Page, stealth: boolean, seekTrigger = false): Promise<{ kind: 'click' | 'look' | 'press' | 'none' | 'wait' | 'unsafe' | 'arrived' | 'keys'; x?: number; y?: number; why?: string; dist?: number }> {
  return page.evaluate(async ([stealth, seekTrigger]) => {
    const pf = await import(/* @vite-ignore */ String('/src/world/pathfind.ts'));
    const gridMod = await import(/* @vite-ignore */ String('/src/world/grid.ts'));
    const vision = await import(/* @vite-ignore */ String('/src/world/vision.ts'));
    const w = (window as any).__world;
    if (!w?.player || !w.objective) return { kind: 'none' as const, why: 'no objective' };
    const target = w.objective.target;
    if (target === null || target === undefined) return { kind: 'none' as const, why: 'objective without target' };
    const p = w.player;
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    // The logical canvas size follows the display since landscape/fullscreen fill (core/viewport.ts), not 640×360.
    const gw: number = (window as any).G.game.scale.width, gh: number = (window as any).G.game.scale.height;
    const toPage = (x: number, y: number) => { const s = w.toScreen(x, y); return { x: r.left + s.x * r.width / gw, y: r.top + s.y * r.height / gh, sx: s.x, sy: s.y }; };
    let avoidHits = false;
    const safe = (x: number, y: number) => {
      const s = toPage(x, y);
      if (avoidHits) { const h = hitAt(x, y); if (h && h !== it) return null; }
      if (s.sx < 4 || s.sx > gw - 4 || s.sy < 4 || s.sy > gh - 4) return null;
      const hitEl = document.elementFromPoint(s.x, s.y);
      if (hitEl !== canvas) return null;
      return s;
    };
    // Resolve the objective target.
    let it: any = null, point: { x: number; y: number } | null = null;
    if (typeof target === 'string') {
      it = w.interactives.find((i: any) => i.id === target && !i.removed) ?? null;
      if (!it) point = w.resolveTarget(target);
      const a = w.actors?.get?.(target);
      if (a && !it) point = { x: a.x, y: a.y };
    } else point = w.resolveTarget(target);
    // What a click at a world point would pick (same rule as WorldScene.onPointer: the hit with the largest y).
    const hitAt = (x: number, y: number) => {
      let hit: any = null;
      for (const i of w.interactives) {
        if (!i.enabled()) continue;
        const b = i.bounds();
        const inside = i.hit ? i.hit(x, y) : x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.h + 3;
        if (inside && (!hit || i.pos().y > hit.pos().y)) hit = i;
      }
      return hit;
    };
    // Interactive: click it when the click picks exactly it (the world walks there and interacts).
    if (it) {
      const pos = it.pos();
      const dist = w.distTo(it);
      if (!it.enabled()) {
        if (it.kind === 'clue' && w.look.enabled && w.onScreen(pos.x, pos.y, -10)) return { kind: 'look' as const, dist };
        point = { x: pos.x, y: pos.y + 10 };
      } else {
        const b = it.bounds();
        const cands = [pos, it.top?.(), { x: b.x + b.w / 2, y: b.y + b.h / 2 }, { x: b.x + b.w / 2, y: b.y + b.h * 0.75 },
          { x: b.x + b.w * 0.25, y: b.y + b.h * 0.6 }, { x: b.x + b.w * 0.75, y: b.y + b.h * 0.6 }, { x: b.x + b.w / 2, y: b.y + b.h * 0.25 }].filter(Boolean);
        const polyMod = await import(/* @vite-ignore */ String('/src/world/poly.ts'));
        const goal = it.hotPoly ? polyMod.closestOnPoly(p.x, p.y, it.hotPoly) : pos;
        const probed = ((window as any).__probed ??= {}) as Record<string, boolean>;
        const clickPoint = () => {
          for (const c of cands) {
            if (hitAt(c.x, c.y) !== it) continue;
            const sc = safe(c.x, c.y);
            if (sc) return sc;
          }
          return null;
        };
        if (dist <= it.radius) {
          // In reach of E. Facing decides the focus: turn towards it with a short key tap first.
          const c = clickPoint();
          // A click within radius − 2 interacts directly, whatever has the keyboard focus.
          if (c && dist <= it.radius - 2) return { kind: 'click' as const, x: c.x, y: c.y, why: `interactive ${it.id}`, dist };
          if (w.focus !== it) return { kind: 'keys' as const, x: goal.x - p.x, y: goal.y - p.y, why: `step towards ${it.id}`, dist };
          if (dist <= it.radius - 2) return c ? { kind: 'click' as const, x: c.x, y: c.y, why: `interactive ${it.id}`, dist } : { kind: 'press' as const, why: `in range of ${it.id}`, dist };
          // The world starts a click interaction only within radius − 2: try the mouse once, then E.
          if (c && !probed[it.id]) return { kind: 'click' as const, x: c.x, y: c.y, why: `probe ${it.id} (${dist.toFixed(1)} px, radius ${it.radius})`, dist };
          return { kind: 'press' as const, why: `in E reach of ${it.id}`, dist };
        }
        // Out of reach: click it when the world can walk there, else walk to a free spot within its reach.
        const path0 = pf.findPath(w.grid, { x: p.x, y: p.y }, goal, { hw: gridMod.FOOT_HW, hh: gridMod.FOOT_HH });
        const end0 = path0?.length ? path0[path0.length - 1] : null;
        const endD = end0 ? (it.dist ? it.dist(end0.x, end0.y) : Math.hypot(pos.x - end0.x, pos.y - end0.y)) : Infinity;
        if (endD <= it.radius - 2) {
          const c = clickPoint();
          if (c) return { kind: 'click' as const, x: c.x, y: c.y, why: `interactive ${it.id}`, dist };
        }
        const spots: { x: number; y: number; d: number; pd: number }[] = [];
        for (let r = 4; r <= it.radius + 40; r += 4) {
          for (let k = 0; k < 24; k++) {
            const ang = (k / 24) * Math.PI * 2;
            const q = { x: pos.x + Math.cos(ang) * r, y: pos.y + Math.sin(ang) * r };
            if (w.grid.solidAt(q.x, q.y)) continue;
            const d = it.dist ? it.dist(q.x, q.y) : Math.hypot(pos.x - q.x, pos.y - q.y);
            if (d > it.radius - 1) continue;
            spots.push({ ...q, d, pd: Math.hypot(q.x - p.x, q.y - p.y) });
          }
        }
        spots.sort((u, v) => (u.d <= it.radius - 4 ? 0 : 1) - (v.d <= it.radius - 4 ? 0 : 1) || u.pd - v.pd);
        let best: { x: number; y: number } | null = null;
        for (const q of spots.slice(0, 40)) {
          const pp = pf.findPath(w.grid, { x: p.x, y: p.y }, q, { hw: gridMod.FOOT_HW, hh: gridMod.FOOT_HH });
          const e = pp?.length ? pp[pp.length - 1] : null;
          if (e && Math.hypot(e.x - q.x, e.y - q.y) < 4) { best = q; break; }
        }
        point = best ? { x: best.x, y: best.y } : { x: pos.x, y: pos.y + 8 };
      }
    }
    if (!point) return { kind: 'none' as const, why: `unresolved target ${JSON.stringify(target)}` };
    // A point next to an armed trigger means: enter that trigger.
    let viaTrigger = '';
    for (const t of w.triggers ?? []) {
      if (!t.enabled || (t.def.when && !t.def.when()) || ((t.def.once ?? true) && t.done)) continue;
      const cx = t.rect.x + t.rect.w / 2, cy = t.rect.y + t.rect.h / 2;
      const d = Math.hypot(Math.max(t.rect.x - point.x, 0, point.x - (t.rect.x + t.rect.w)), Math.max(t.rect.y - point.y, 0, point.y - (t.rect.y + t.rect.h)));
      if (d < (seekTrigger && !it ? 260 : 36)) { if (d >= 36) viaTrigger = t.def.id; point = { x: cx, y: cy }; break; }
    }
    avoidHits = true;
    const dist = Math.hypot(point.x - p.x, point.y - p.y);
    const path = pf.findPath(w.grid, { x: p.x, y: p.y }, point, { hw: gridMod.FOOT_HW, hh: gridMod.FOOT_HH });
    const pts: { x: number; y: number }[] = path && path.length ? path : [point];
    // Guards with vision (stealth maps): only walk short legs that no active cone covers.
    const guards = (w.stealthOn ? (w.guards ?? []) : []).filter((g: any) => !g.actor.held && g.actor.sprite?.visible !== false);
    const seen = (q: { x: number; y: number }) => guards.some((g: any) => {
      const eye = g.eye;
      const range = g.range * 1.25 + 10;
      if (Math.hypot(q.x - eye.x, q.y - eye.y) > range) return false;
      if (Math.hypot(q.x - eye.x, q.y - eye.y) < 18) return true;
      if (!vision.inCone(eye, g.facing, g.half + 0.3, range, q)) return false;
      return vision.lineOfSight(w.grid, eye, q);
    });
    // Stealth: hop between hiding spots (the dark cells, the niche, the ferns); dash only along legs no cone covers now.
    if (stealth && guards.length) {
      const route = (to: { x: number; y: number }) => {
        const pp = pf.findPath(w.grid, { x: p.x, y: p.y }, to, { hw: gridMod.FOOT_HW, hh: gridMod.FOOT_HH });
        return pp && pp.length ? pp as { x: number; y: number }[] : null;
      };
      const legFree = (path: { x: number; y: number }[]) => {
        let a = { x: p.x, y: p.y };
        for (const q of path) {
          const leg = Math.hypot(q.x - a.x, q.y - a.y);
          for (let k = 1; k <= Math.ceil(leg / 5); k++) {
            const f = Math.min(1, (k * 5) / leg);
            if (seen({ x: a.x + (q.x - a.x) * f, y: a.y + (q.y - a.y) * f })) return false;
          }
          a = q;
        }
        return true;
      };
      const polyMod2 = await import(/* @vite-ignore */ String('/src/world/poly.ts'));
      const centre = (poly: number[][]) => ({ x: poly.reduce((n, v) => n + v[0], 0) / poly.length, y: poly.reduce((n, v) => n + v[1], 0) / poly.length });
      const spots = (w.map.hidingSpots ?? []).map((h: any) => ({ id: h.id, at: centre(h.poly), poly: h.poly }));
      const inSpot = spots.find((h: any) => polyMod2.pointInPoly(p.x, p.y, h.poly));
      const toGoal = Math.hypot(point.x - p.x, point.y - p.y);
      const goalPath = route(point);
      if (goalPath && legFree(goalPath)) {
        const end = goalPath[goalPath.length - 1];
        // Click the furthest on-screen point of the free path.
        for (let i = goalPath.length - 1; i >= 0; i--) { const sc = safe(goalPath[i].x, goalPath[i].y); if (sc) return { kind: 'click' as const, x: sc.x, y: sc.y, why: `dash to goal (${Math.round(end.x)},${Math.round(end.y)})`, dist: toGoal }; }
      }
      // Next stone: a hiding spot nearer to the goal than we are, reachable along a free leg.
      const stones = spots.filter((h: any) => h !== inSpot && Math.hypot(point.x - h.at.x, point.y - h.at.y) < toGoal - 10)
        .sort((a: any, b: any) => Math.hypot(a.at.x - p.x, a.at.y - p.y) - Math.hypot(b.at.x - p.x, b.at.y - p.y));
      for (const h of stones) {
        const r2 = route(h.at);
        if (!r2 || !legFree(r2)) continue;
        for (let i = r2.length - 1; i >= 0; i--) { const sc = safe(r2[i].x, r2[i].y); if (sc) return { kind: 'click' as const, x: sc.x, y: sc.y, why: `dash to ${h.id}`, dist: toGoal }; }
      }
      if (inSpot) return { kind: 'unsafe' as const, why: `hidden in ${inSpot.id}, waiting`, dist: toGoal };
      // Exposed: the nearest hiding spot with a free leg, else wait.
      for (const h of [...spots].sort((a: any, b: any) => Math.hypot(a.at.x - p.x, a.at.y - p.y) - Math.hypot(b.at.x - p.x, b.at.y - p.y))) {
        const r3 = route(h.at);
        if (!r3 || !legFree(r3)) continue;
        for (let i = r3.length - 1; i >= 0; i--) { const sc = safe(r3[i].x, r3[i].y); if (sc) return { kind: 'click' as const, x: sc.x, y: sc.y, why: `back into ${h.id}`, dist: toGoal }; }
      }
      return { kind: 'unsafe' as const, why: 'exposed, cones everywhere', dist: toGoal };
    }
    let pick: { x: number; y: number } | null = null;
    let travelled = 0, prev = { x: p.x, y: p.y };
    for (const q of pts) {
      const leg = Math.hypot(q.x - prev.x, q.y - prev.y);
      if (stealth && guards.length) {
        // Sample the leg; stop before a covered spot.
        let ok = true;
        for (let k = 1; k <= Math.ceil(leg / 6); k++) {
          const f = Math.min(1, (k * 6) / leg);
          if (seen({ x: prev.x + (q.x - prev.x) * f, y: prev.y + (q.y - prev.y) * f })) { ok = false; break; }
        }
        if (!ok) break;
        if (travelled + leg > 60) { const f = (60 - travelled) / leg; const m = { x: prev.x + (q.x - prev.x) * f, y: prev.y + (q.y - prev.y) * f }; if (safe(m.x, m.y)) pick = m; break; }
      }
      if (!safe(q.x, q.y)) break;
      pick = q; travelled += leg; prev = q;
    }
    if (!pick) {
      if (stealth && guards.length) return { kind: 'unsafe' as const, why: 'cone ahead', dist };
      // Nothing of the path on screen: click the on-screen point nearest to the first waypoint.
      const q = pts[0];
      for (let f = 1; f > 0.05; f -= 0.1) {
        const m = { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
        const s = safe(m.x, m.y);
        if (s) return { kind: 'click' as const, x: s.x, y: s.y, why: 'toward first waypoint', dist };
      }
      // Nothing clickable (HUD in the way, edge of the map): walk with the direction keys instead.
      return { kind: 'keys' as const, x: q.x - p.x, y: q.y - p.y, why: 'nothing clickable, keys', dist };
    }
    if (Math.hypot(pick.x - p.x, pick.y - p.y) < 3) return { kind: 'arrived' as const, why: `arrived (${Math.round(dist)} px from the target)`, dist };
    const s = safe(pick.x, pick.y)!;
    return { kind: 'click' as const, x: s.x, y: s.y, why: `walk ${Math.round(dist)}px${viaTrigger ? ` (marker idle: into trigger ${viaTrigger})` : ''}`, dist };
  }, [stealth, seekTrigger] as const);
}

/** Teleports the player next to the objective target. LAST RESORT, recorded in driveLog.teleports. */
async function teleportToObjective(page: Page, reason: string): Promise<void> {
  const where = await page.evaluate(() => {
    const w = (window as any).__world;
    const t = w.objective?.target;
    if (t == null) return null;
    const it = typeof t === 'string' ? w.interactives.find((i: any) => i.id === t && !i.removed) : null;
    const pos = it ? it.pos() : w.resolveTarget(t);
    if (!pos) return null;
    w.ctx.player.teleport([pos.x, pos.y + 14]);
    return `${w.map.id} → ${typeof t === 'string' ? t : JSON.stringify(t)} (${Math.round(pos.x)},${Math.round(pos.y)})`;
  });
  if (where) driveLog.teleports.push(`${reason}: ${where}`);
}

// ---------------------------------------------------------------------------------------------------------------
// Minigames
// ---------------------------------------------------------------------------------------------------------------

/** „Sammlung“: keep the light centred with arrow keys, let the breath go (E) when the ring is full. */
async function sammlungStep(page: Page): Promise<void> {
  const d = await page.evaluate(() => {
    const r = document.querySelector<HTMLElement>('.e2s-root');
    if (!r) return null;
    return { phase: r.dataset.phase, used: r.dataset.used, x: Number(r.dataset.x), y: Number(r.dataset.y), dist: Number(r.dataset.dist), done: r.dataset.done };
  });
  if (!d || d.done) { await page.waitForTimeout(120); return; }
  if (d.phase === 'full' && d.used === '0' && d.dist <= 0.24) { await page.keyboard.press('e'); await page.waitForTimeout(120); return; }
  if (d.dist > 0.06) {
    const keys: string[] = [];
    if (Math.abs(d.x) > 0.04) keys.push(d.x > 0 ? 'ArrowLeft' : 'ArrowRight');
    if (Math.abs(d.y) > 0.04) keys.push(d.y > 0 ? 'ArrowUp' : 'ArrowDown');
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(Math.max(30, Math.min(160, (d.dist / 0.95) * 700)));
    for (const k of keys) await page.keyboard.up(k);
  }
  await page.waitForTimeout(30);
}

const AIM_CALLS: [RegExp, string][] = [
  [/ganz hinten rechts/, 'ziel-stumpf-hinten'],
  [/linke Scheibe am Querbalken/, 'ziel-scheibe-links'],
  [/vordere Stumpf/, 'ziel-stumpf-vorn'],
  [/kleine Scheibe am linken Pfosten/, 'ziel-scheibe-pfosten'],
];
let aimAt = 'ziel-stumpf-mitte';
let aimPanel = false;

/** Aiming bar of e2-stabtraining: arrow keys to the called object, E fires. */
async function zielenStep(page: Page, call: string): Promise<void> {
  const target = AIM_CALLS.find(([re]) => re.test(call))?.[1];
  if (!target) throw new Error(`Unbekannter Ruf: ${call}`);
  // Find the key sequence with the game's own spatial rule (pure function, read only).
  const keys: string[] = await page.evaluate(async ({ from, to }) => {
    const { nextInDirection } = await import(/* @vite-ignore */ String('/src/chapters/teil-2/stabtraining-ziele.ts'));
    const dirs: [string, number, number][] = [['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1]];
    const prev = new Map<string, [string, string]>([[from, ['', '']]]);
    const queue = [from];
    while (queue.length) {
      const c = queue.shift()!;
      if (c === to) break;
      for (const [k, dx, dy] of dirs) {
        const n = nextInDirection(c, dx, dy);
        if (!prev.has(n)) { prev.set(n, [c, k]); queue.push(n); }
      }
    }
    if (!prev.has(to)) return [];
    const out: string[] = [];
    for (let c = to; c !== from; c = prev.get(c)![0]) out.unshift(prev.get(c)![1]);
    return out;
  }, { from: aimAt, to: target });
  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(160); }
  await page.waitForTimeout(250);
  await page.keyboard.press('e');
  aimAt = target;
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------------------------------------------
// Battles (as travel-encounters.pw.ts: controller + AI planning; Lia's raid moves through the battle UI)
// ---------------------------------------------------------------------------------------------------------------

async function battleStep(page: Page): Promise<void> {
  const st = await page.evaluate(() => {
    const t = (window as any).__tactics, G = (window as any).G;
    const out = document.querySelector<HTMLElement>('.tac-out.show');
    const hintBtn = document.querySelector<HTMLElement>('.tac-hint:not(.hidden) button');
    const b = t.ctrl.battle;
    return {
      id: t.ctrl.def?.id as string,
      outcome: out ? (out.classList.contains('win') ? 'win' : 'lose') : null,
      hint: Boolean(hintBtn),
      busy: G.ui.busy(),
      can: t.ctrl.inputEnabled() && t.animating === 0 && !t.cameras.main.panEffect.isRunning,
      active: b.activeUnit as string,
    };
  });
  if (st.outcome) {
    const sub = await page.locator('.tac-out.show .s').textContent().catch(() => '');
    if (!driveLog.battles.includes(`${st.id}:${st.outcome}`) || st.outcome === 'lose') driveLog.battles.push(`${st.id}:${st.outcome}${st.outcome === 'lose' ? ` (${sub})` : ''}`);
    if (st.outcome === 'lose') driveLog.defeats++;
    await page.waitForTimeout(400);
    const btn = page.locator('.tac-out.show .tac-btn').first();
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(800);
    return;
  }
  if (st.hint) { await page.locator('.tac-hint:not(.hidden) button').click(); await page.waitForTimeout(250); return; }
  if (st.busy) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); return; }
  if (!st.can) { await page.waitForTimeout(250); return; }
  if (st.id === 'e2-ueberfall' && st.active === 'lia' && await liaRaidTurnViaUi(page)) return;
  await page.evaluate(async () => {
    const aiUrl = '/src/tactics/rules/ai.ts';
    const { planTurn, executePlan } = await import(/* @vite-ignore */ aiUrl);
    const t = (window as any).__tactics, b = t.ctrl.battle, u = b.unit(b.activeUnit), id = t.ctrl.def?.id;
    // Raid: Lia flees to a free tile of the water gate, Kyra stays one step behind her (never on the gate tiles).
    if (id === 'e2-ueberfall' && u.id === 'lia') b.aiOverrides.set(u.id, { profile: 'flee', goal: [{ x: 1, y: 11 }, { x: 0, y: 11 }, { x: 0, y: 10 }].find((g: any) => !b.units.some((o: any) => !o.down && o.id !== 'lia' && o.x === g.x && o.y === g.y)) ?? { x: 1, y: 11 } });
    else if (id === 'e2-ueberfall' && u.id === 'kyra') b.aiOverrides.set(u.id, { profile: 'flee', goal: { x: 2, y: 9 } });
    else if (u.id === 'lia') b.aiOverrides.set(u.id, { profile: 'melee' });
    else if (u.team === 'player') b.aiOverrides.set(u.id, { profile: 'melee' });
    const plan = planTurn(b, u.id);
    void t.ctrl.perform(() => executePlan(b, plan)).then(() => t.ctrl.endTurn());
  });
  await page.waitForTimeout(400);
}

/** Lia's turn in the raid with the real battle UI: „Bewegen“, click the tile, „Zug beenden“, confirm facing. */
async function liaRaidTurnViaUi(page: Page): Promise<boolean> {
  const plan = await page.evaluate(async () => {
    const { planTurn } = await import(/* @vite-ignore */ String('/src/tactics/rules/ai.ts'));
    const t = (window as any).__tactics, b = t.ctrl.battle;
    // Planning only (read): where would fleeing to the water gate lead this turn?
    const before = b.aiOverrides.get('lia');
    b.aiOverrides.set('lia', { profile: 'flee', goal: [{ x: 1, y: 11 }, { x: 0, y: 11 }, { x: 0, y: 10 }].find((g: any) => !b.units.some((o: any) => !o.down && o.id !== 'lia' && o.x === g.x && o.y === g.y)) ?? { x: 1, y: 11 } });
    const p = planTurn(b, 'lia');
    if (before) b.aiOverrides.set('lia', before); else b.aiOverrides.delete('lia');
    const u = b.unit('lia');
    return { moveTo: p.moveTo, moved: u.moved, at: { x: u.x, y: u.y } };
  });
  try {
    if (plan.moveTo && !plan.moved) {
      const move = page.locator('.tac-menu [data-m="move"]');
      await move.click({ timeout: 3000 });
      const pt = await page.evaluate(p => (window as any).__tactics.debugPage(p), plan.moveTo);
      if (!pt) return false;
      await page.mouse.click(pt.x, pt.y);
      await page.waitForFunction(({ x, y }) => { const u = (window as any).__tactics.ctrl.battle.unit('lia'); return u.x === x && u.y === y; }, plan.moveTo, { timeout: 6000 });
      await page.waitForFunction(() => { const t = (window as any).__tactics; return t.animating === 0 && (t.ctrl.inputEnabled() || document.querySelector('.tac-out.show')); }, undefined, { timeout: 10000 });
      if (await page.locator('.tac-out.show').count()) return true;
    }
    await page.locator('.tac-endturn').click({ timeout: 3000 });
    const facing = page.locator('.tac-confirm-facing');
    await facing.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await facing.isVisible()) await facing.click();
    await page.waitForFunction(() => (window as any).__tactics.ctrl.battle.activeUnit !== 'lia' || document.querySelector('.tac-out.show'), undefined, { timeout: 8000 });
    driveLog.clicks++;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------------------------------------------------

export interface DriveOptions {
  until: (s: Snap) => boolean | Promise<boolean>;
  timeoutMs?: number;
  chooser?: Chooser;
  /** Called on every loop with the snapshot (screenshots at the right moments). */
  onSnap?: (s: Snap) => Promise<void>;
  label?: string;
  /** Stagnation (no state/position change while idle) before the last-resort teleport. */
  stuckMs?: number;
}

let cHeld = false;
async function sneak(page: Page, on: boolean): Promise<void> {
  if (on === cHeld) return;
  cHeld = on;
  if (on) await page.keyboard.down('c'); else await page.keyboard.up('c');
}

/** Plays the game with real inputs until `until` holds. */
export async function drive(page: Page, opts: DriveOptions): Promise<Snap> {
  aimAt = 'ziel-stumpf-mitte';
  const chooser = opts.chooser ?? defaultChooser;
  const deadline = Date.now() + (opts.timeoutMs ?? 360000);
  let lastSig = '', lastChange = Date.now(), unsafeSince = 0;
  let lastAction = '';
  let arrivedSince = 0;
  for (;;) {
    const s = await snap(page);
    if (await opts.until(s)) { await sneak(page, false); return s; }
    if (opts.onSnap) await opts.onSnap(s);
    if (Date.now() > deadline) {
      await sneak(page, false);
      await shot(page, `stuck-${(opts.label ?? s.scene).replace(/[^a-z0-9-]/gi, '_')}`).catch(() => {});
      throw new Error(`drive(${opts.label ?? ''}) timed out in ${s.scene} / ${s.map}; objective=${JSON.stringify(s.objective)} busy=${s.busy} locked=${s.locked} last=${lastAction}`);
    }
    // Progress = story state, not the player's position (walking back and forth is no progress).
    const progress = s.sig.split('|').slice(0, -1).join('|');
    if (progress !== lastSig) { lastSig = progress; lastChange = Date.now(); }
    await sneak(page, s.stealthMap && s.worldActive);
    if (s.tactics) { lastAction = 'battle'; await battleStep(page); continue; }
    if (s.moment) {
      lastAction = `moment ${s.moment}`;
      if (s.moment === 'window') { await page.keyboard.press('e'); await page.waitForTimeout(150); } else await page.waitForTimeout(25);
      continue;
    }
    if (s.sammlung) { lastAction = 'sammlung'; await sammlungStep(page); continue; }
    if (s.zielen) { lastAction = 'zielen'; aimPanel = true; await zielenStep(page, s.zielen); continue; }
    if (aimPanel && !s.zielen) aimPanel = false;
    if (s.hold) {
      lastAction = 'hold';
      await page.waitForTimeout(200);
      await page.keyboard.down('e');
      await page.waitForFunction(() => !document.querySelector('.hold'), undefined, { timeout: 9000 }).catch(() => {});
      await page.keyboard.up('e');
      continue;
    }
    if (s.action) { lastAction = 'scene-action'; await playSceneAction(page); continue; }
    if (s.pick) { lastAction = 'scene-pick'; await playScenePick(page, PICK_PREFER); continue; }
    if (s.choices.length) { lastAction = `choose ${s.choices.map(c => c.text.slice(0, 20)).join(' / ')}`; await answer(page, s, chooser); continue; }
    if (s.credits) { lastAction = 'credits'; await page.waitForTimeout(4300); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); continue; }
    if (s.busy) { lastAction = 'advance'; await page.keyboard.press('Enter'); await page.waitForTimeout(160); continue; }
    if (s.worldActive && !s.locked) {
      const seek = arrivedSince > 0 && Date.now() - arrivedSince > 6000 && Date.now() - lastChange > 6000;
      const plan = await planWalk(page, s.stealthMap, seek);
      if (plan.kind === 'arrived') { if (!arrivedSince) arrivedSince = Date.now(); } else if (!seek) arrivedSince = 0;
      if (seek && plan.kind === 'click' && plan.why?.includes('marker idle')) {
        const note = `${s.scene}/${s.map}: standing on the objective marker ${JSON.stringify(s.objective?.target)} („${s.objective?.text}“) did nothing for 6 s; walked into the nearest armed trigger instead`;
        if (!driveLog.workarounds.includes(note)) driveLog.workarounds.push(note);
      }
      lastAction = `walk ${plan.kind} ${plan.why ?? ''}`;
      if (plan.kind === 'click' && plan.why?.startsWith('probe')) {
        driveLog.clicks++;
        await page.mouse.click(plan.x!, plan.y!);
        await page.waitForTimeout(1200);
        const after = await snap(page);
        const id = plan.why.split(' ')[1];
        if (!(after.busy || after.locked)) {
          const note = `${s.map}: click on ${plan.why.slice(6)} did not start the interaction (E does)`;
          if (!driveLog.mouseIssues.includes(note)) driveLog.mouseIssues.push(note);
        }
        await page.evaluate(id => { ((window as any).__probed ??= {})[id] = true; }, id);
      } else if (plan.kind === 'click') { driveLog.clicks++; await page.mouse.click(plan.x!, plan.y!); await page.waitForTimeout(s.stealthMap ? 450 : 350); }
      else if (plan.kind === 'look') { driveLog.lookPresses++; await page.keyboard.down('q'); await page.waitForTimeout(900); await page.keyboard.up('q'); await page.waitForTimeout(150); }
      else if (plan.kind === 'arrived') await page.waitForTimeout(250);
      else if (plan.kind === 'keys') {
        const ax = Math.abs(plan.x!), ay = Math.abs(plan.y!), m = Math.max(ax, ay, 0.001);
        const keys = [...(ax >= 0.4 * m ? [plan.x! > 0 ? 'd' : 'a'] : []), ...(ay >= 0.4 * m ? [plan.y! > 0 ? 's' : 'w'] : [])];
        for (const k of keys) await page.keyboard.down(k);
        await page.waitForTimeout(plan.why?.startsWith('step') ? 90 : 350);
        for (const k of keys) await page.keyboard.up(k);
        await page.waitForTimeout(120);
      }
      else if (plan.kind === 'press') { await page.waitForTimeout(700); await page.keyboard.press('e'); await page.waitForTimeout(300); }
      else if (plan.kind === 'unsafe') {
        if (!unsafeSince) unsafeSince = Date.now();
        await page.waitForTimeout(250);
        if (Date.now() - unsafeSince > 45000) { unsafeSince = 0; driveLog.teleports.push(`(no teleport) cones blocked > 45 s at ${s.map}`); }
        continue;
      } else await page.waitForTimeout(200);
      unsafeSince = 0;
      const stuck = opts.stuckMs ?? 90000;
      if (Date.now() - lastChange > stuck && s.objective?.target != null) {
        await teleportToObjective(page, `${opts.label ?? s.scene}: no progress for ${Math.round(stuck / 1000)} s (${lastAction})`);
        lastChange = Date.now();
      }
      continue;
    }
    lastAction = 'wait';
    await page.waitForTimeout(150);
  }
}

export const sceneIs = (id: string) => (s: Snap) => s.scene === id;
export const sceneLeft = (id: string) => (s: Snap) => s.scene !== id;
