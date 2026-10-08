import { expect, test, type Locator, type Page } from '@playwright/test';
import { drive, driveLog, snap, type DriveOptions, type Snap } from './teil2Helpers';

/**
 * Helpers for the Teil III browser tests (teil-3.pw.ts, teil-3-uebergang.pw.ts). They build on teil2Helpers.ts: the
 * Teil-II driver plays everything it knows (dialogue, choices, gestures, walking to objectives) with real inputs, and
 * drive3() steps in for what is new or different in Teil III:
 *  - the light spirits of e3-eigener-stab (sneak with C held up to a drifting light, then walk it to the willow),
 *  - the aiming bar of Lia's own staff (arrow keys to the called seed pod, E fires),
 *  - Spurenblick places whose objective is a point next to a hidden clue (hold Q, then click the clue),
 *  - objectives without a marker (the order house hub, the inner world, the rifts, the guard posts on the hill),
 *  - stealth maps: a timed planner that predicts the guards' patrols (teil2Helpers' planner ignores the sneak range),
 *  - battles through the battle UI only (playBattleUi: menu clicks, cursor keys/Enter or taps, confirm, facing).
 * Game state is only READ (window.G / window.__world / window.__tactics; turn plans are computed from the battle
 * state, as in the port stage's scratch check). The last-resort teleport of teil2Helpers stays recorded in its driveLog.
 * Note for local runs: a load guard on this machine SIGKILLs headless browsers when the 5-minute load passes 40; run
 * these suites while no other browser tests run.
 */

export const E3_SCENES = [
  'e3-valentus', 'e3-eigener-stab', 'e3-paladine', 'e3-schutzreaktion', 'e3-macht-und-schutz', 'e3-falscher-glaube',
  'e3-kyras-fluchtweg', 'e3-waldgegner', 'e3-vertraute-schwester', 'e3-falle', 'e3-innere-zuflucht', 'e3-flicks-hilfe',
  'e3-hoffnung-und-weigerung', 'e3-ritual', 'e3-ritualangriff', 'e3-vamir', 'e3-ignatius-abschied', 'e3-hueterin',
  'e3-epilog',
] as const;
export type E3Scene = typeof E3_SCENES[number];

const SAVE_KEY = 'selantis.save.v1';
const PROGRESS_KEY = 'selantis.progress.v1';

/**
 * The chapter select only offers reached scenes (meta progress, ui/unlocks.ts). Marks every Teil-III scene as reached
 * before each page load (no cheat flag), keeping whatever else the store already holds.
 */
export async function reachAllE3(page: Page): Promise<void> {
  await page.addInitScript(({ key, scenes }) => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as { reached?: string[]; all?: boolean } | null;
      const reached = [...new Set([...(raw?.reached ?? []), ...scenes])];
      localStorage.setItem(key, JSON.stringify({ reached, all: Boolean(raw?.all) }));
    } catch { /* storage optional */ }
  }, { key: PROGRESS_KEY, scenes: [...E3_SCENES] });
}

/**
 * Title → „Kapitel“ → the chapter book (ui/chapters.ts): turns to the third book with the page corners, opens the
 * section that holds `id` by its head and returns that scene's row. `touch` taps instead of clicking.
 */
export async function e3ChapterRow(page: Page, id: E3Scene, touch = false): Promise<Locator> {
  const act = (l: Locator) => (touch ? l.tap() : l.click());
  await act(page.getByRole('button', { name: /^Kapitel/ }));
  const spread = page.locator('.title-panel-body > .chap-spread');
  await expect(spread).toHaveAttribute('data-state', 'idle');
  for (let n = 0; n < 8; n++) {
    const book = Number(await spread.getAttribute('data-book'));
    if (book === 3) break;
    await act(spread.locator(book < 3 ? ':scope > .is-right .chap-turn.is-next' : ':scope > .is-left .chap-turn.is-prev'));
    await expect(spread).toHaveAttribute('data-book', String(book < 3 ? book + 1 : book - 1));
    await expect(spread).toHaveAttribute('data-state', 'idle');
  }
  await expect(spread).toHaveAttribute('data-book', '3');
  const section: string = await page.evaluate(async id => {
    const reg = await import(/* @vite-ignore */ String('/src/core/registry.ts'));
    return reg.getChapters().find((c: any) => c.id === 'teil-3').sections.find((s: any) => s.scenes.includes(id)).title;
  }, id);
  const head = spread.locator('.chap-head', { hasText: section });
  await expect(head).toBeEnabled();
  if ((await head.getAttribute('aria-expanded')) !== 'true') await act(head);
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  const row = spread.locator(`.chap-scene[data-scene="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await expect(row).toBeVisible();
  return row;
}

/** output/qa/teil-3/screens/ in the repository (gitignored); e2e/ is two levels below the repository root. */
export const qaScreens3 = (): string => `${test.info().project.testDir}/../../output/qa/teil-3/screens`;

export const shots3: string[] = [];

/** Screenshot into the test output and a copy into output/qa/teil-3/screens/. */
export async function shot3(page: Page, name: string): Promise<string> {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
  const copy = `${qaScreens3()}/${name}.png`;
  await page.screenshot({ path: copy });
  shots3.push(copy);
  return copy;
}

/**
 * Builds the documented direct-entry state of a Teil-III scene with the game's own fixture (shared.ts prepareE3) on
 * the title screen, lets `mutate` adjust it and stores it as a regular campaign save at that scene. Nothing is started.
 */
export async function fixtureSave3(page: Page, scene: E3Scene, mutate?: string, params?: Record<string, unknown>): Promise<void> {
  await page.evaluate(async ({ scene, mutate, params, key }) => {
    const { prepareE3 } = await import(/* @vite-ignore */ String('/src/chapters/teil-3/shared.ts'));
    const G = (window as any).G;
    const keep = JSON.stringify(G.state.data);
    G.state.reset();
    prepareE3(scene);
    const data = JSON.parse(JSON.stringify(G.state.data));
    G.state.data = JSON.parse(keep);
    if (mutate) new Function('data', mutate)(data);
    Object.assign(data, { chapter: 'teil-3', scene, params, savedAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(data));
  }, { scene, mutate, params, key: SAVE_KEY });
}

// ---------------------------------------------------------------------------------------------------------------
// Teil-III situations the Teil-II driver does not know
// ---------------------------------------------------------------------------------------------------------------

/** Log of what drive3 did on its own (for the report next to teil2Helpers' driveLog). */
export const drive3Log = { aims: [] as string[], spiritClicks: 0, lookClues: [] as string[], explore: [] as string[] };

type Special =
  | { kind: 'aim'; label: string; hit: string[] }
  | { kind: 'spirits'; player: { x: number; y: number }; lights: { x: number; y: number }[]; rest: number[][]; zone: number[] }
  | { kind: 'look-clue'; id: string; revealed: boolean; onScreen: boolean; x: number; y: number }
  | { kind: 'explore'; objective: string; text: string }
  | { kind: 'stealth' };

async function special(page: Page): Promise<Special | null> {
  return page.evaluate(() => {
    const G = (window as any).G, w = (window as any).__world;
    if (document.querySelector('.e3-zielen-bar')) {
      return { kind: 'aim' as const, label: document.querySelector('.e3-zielen-ziel')?.textContent ?? '', hit: String(G.state.flag('e3-es-kapseln') ?? '').split(',').filter(Boolean) };
    }
    if (!w?.player || !w.sys?.isActive() || w.playerLocked || G.ui.busy()) return null;
    const obj = w.objective;
    if (obj?.id === 'e3-es-lichter') {
      const lights = [0, 1, 2].map(i => w.lighting?.lights?.get(`e3-geist-${i}`)).filter(Boolean).map((l: any) => ({ x: l.x, y: l.y - 20 }));
      return { kind: 'spirits' as const, player: { x: w.player.x, y: w.player.y }, lights, rest: [[742, 176], [838, 150], [930, 182]], zone: [846, 262] };
    }
    // Guards on the map: the timed stealth planner below brings Lia to the objective (the Teil-II one ignores that a
    // crouching Lia is only seen at 0.55 × the cone range and cannot wait for a guard walking away).
    if (w.stealthOn && (w.guards ?? []).some((g: any) => !g.actor.held && !g.actor.destroyed) && obj && obj.target != null) {
      const t = obj.target;
      const it = typeof t === 'string' ? w.interactives.find((i: any) => i.id === t && !i.removed) : null;
      const goal = it ? (it.stand?.() ?? it.pos()) : w.resolveTarget(t);
      const near = it ? w.distTo(it) <= it.radius - 2 : goal && Math.hypot(goal.x - w.player.x, goal.y - w.player.y) <= 12;
      if (goal && !near) return { kind: 'stealth' as const };
    }
    // An objective without a marker (exploration: the inner world, the order house, the hill at dusk).
    if (obj && (obj.target === null || obj.target === undefined || obj.id === 'e3-ri-posten')) return { kind: 'explore' as const, objective: obj.id as string, text: obj.text as string };
    // A point objective next to a clue that only the Spurenblick shows.
    const t = obj?.target;
    if (t != null && typeof t !== 'string' && w.look?.enabled) {
      const p = w.resolveTarget(t);
      const clues: any[] = (w as any).clues ?? [];
      const c = p && clues.find(c => !c.found && Math.hypot(c.x - p.x, c.y - p.y) < 40);
      if (c) return { kind: 'look-clue' as const, id: c.def.id, revealed: Boolean(c.revealed), onScreen: w.onScreen(c.x, c.y, -6), x: c.x, y: c.y };
    }
    return null;
  });
}

/** Page coordinates of a world point (null when off screen or covered by the HUD). */
async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number } | null> {
  return page.evaluate(([x, y]) => {
    const w = (window as any).__world;
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    // The logical canvas size follows the display (core/viewport.ts), not a fixed 640×360.
    const gw: number = (window as any).G.game.scale.width, gh: number = (window as any).G.game.scale.height;
    const s = w.toScreen(x, y);
    if (s.x < 6 || s.x > gw - 6 || s.y < 6 || s.y > gh - 6) return null;
    const p = { x: r.left + s.x * r.width / gw, y: r.top + s.y * r.height / gh };
    return document.elementFromPoint(p.x, p.y) === canvas ? p : null;
  }, [x, y] as const);
}

/** Clicks the world at (x, y), or at the furthest visible point on the straight line from the player towards it. */
async function clickToward(page: Page, x: number, y: number, from: { x: number; y: number }): Promise<void> {
  for (let f = 1; f > 0.05; f -= 0.1) {
    const p = await toPage(page, from.x + (x - from.x) * f, from.y + (y - from.y) * f);
    if (p) { await page.mouse.click(p.x, p.y); return; }
  }
  await page.waitForTimeout(200);
}

let aimAt = 'stamm';

/** The aiming bar: walk the golden marker with arrow keys to the next pod still hanging, then E. */
async function aimStep(page: Page, s: Extract<Special, { kind: 'aim' }>): Promise<void> {
  const plan = await page.evaluate(async ({ label, hit, from }) => {
    const mod = await import(/* @vite-ignore */ String('/src/chapters/teil-3/eigener-stab-ziele.ts'));
    const DESCRIBE: Record<string, string> = {
      'Eine trockene Kapsel, links an den Zweigen.': 'kapsel-links', 'Eine trockene Kapsel rechts neben dem Stamm.': 'kapsel-mitte',
      'Eine trockene Kapsel, ganz rechts über dem Bach.': 'kapsel-rechts', 'Der Bach.': 'bach', 'Der Stamm der Weide.': 'stamm',
    };
    // The bar names the aimed object; the three lights share one text, then the last known position counts.
    const at = DESCRIBE[label] ?? from;
    const to = mod.POD_IDS.find((id: string) => !hit.includes(id))!;
    const dirs: [string, number, number][] = [['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1]];
    const prev = new Map<string, [string, string]>([[at, ['', '']]]);
    const queue = [at];
    while (queue.length) {
      const c = queue.shift()!;
      if (c === to) break;
      for (const [k, dx, dy] of dirs) {
        const n = mod.nextInDirection(c, dx, dy);
        if (!prev.has(n)) { prev.set(n, [c, k]); queue.push(n); }
      }
    }
    const keys: string[] = [];
    if (prev.has(to)) for (let c = to; c !== at; c = prev.get(c)![0]) keys.unshift(prev.get(c)![1]);
    return { at, to, keys };
  }, { label: s.label, hit: s.hit, from: aimAt });
  for (const k of plan.keys) { await page.keyboard.press(k); await page.waitForTimeout(160); }
  await page.waitForTimeout(250);
  await page.keyboard.press('e');
  aimAt = plan.to;
  drive3Log.aims.push(`${plan.at} → ${plan.to} (${plan.keys.join(' ') || 'direkt'})`);
  await page.waitForTimeout(500);
}

/** Light spirits: careful approach (C held) to the nearest drifting light, then lead the followers to the willow. */
async function spiritStep(page: Page, s: Extract<Special, { kind: 'spirits' }>): Promise<void> {
  const p = s.player;
  const head = { x: p.x, y: p.y - 50 };
  const following = s.lights.filter(l => Math.hypot(l.x - head.x, l.y - head.y) < 40);
  const resting = (l: { x: number; y: number }) => s.rest.some(r => Math.hypot(l.x - r[0], l.y - r[1]) < 30);
  const drifting = s.lights.filter(l => !following.includes(l) && !resting(l));
  await page.keyboard.down('c');
  try {
    if (following.length) {
      await clickToward(page, s.zone[0], s.zone[1], p);
    } else if (drifting.length) {
      drifting.sort((a, b) => Math.hypot(a.x - p.x, a.y - 30 - p.y) - Math.hypot(b.x - p.x, b.y - 30 - p.y));
      const l = drifting[0];
      await clickToward(page, l.x, l.y + 30, p);
    }
    drive3Log.spiritClicks++;
    await page.waitForTimeout(700);
  } finally {
    await page.keyboard.up('c');
  }
}

/** A Spurenblick place: hold Q until the clue shows, then click it (the world walks there and looks). */
async function lookClueStep(page: Page, s: Extract<Special, { kind: 'look-clue' }>): Promise<void> {
  if (!s.revealed) {
    if (!s.onScreen) {
      const p = await page.evaluate(() => { const w = (window as any).__world; return { x: w.player.x, y: w.player.y }; });
      await clickToward(page, s.x, s.y + 10, p);
      await page.waitForTimeout(500);
      return;
    }
    driveLog.lookPresses++;
    await page.keyboard.down('q');
    await page.waitForTimeout(1000);
    await page.keyboard.up('q');
    await page.waitForTimeout(150);
    return;
  }
  const at = await toPage(page, s.x, s.y);
  if (!drive3Log.lookClues.includes(s.id)) drive3Log.lookClues.push(s.id);
  if (at) { driveLog.clicks++; await page.mouse.click(at.x, at.y); await page.waitForTimeout(900); return; }
  const p = await page.evaluate(() => { const w = (window as any).__world; return { x: w.player.x, y: w.player.y }; });
  await clickToward(page, s.x, s.y + 10, p);
  await page.waitForTimeout(500);
}

/**
 * Objectives without a marker: what a player does there, with real input.
 *  - e3-ri-posten: walk towards the next guard post not yet spotted with Q held (Spurenblick), then show it (E).
 *  - e3-hw-riss: walk to the open rift; the memory choice that closes it follows on its own.
 *  - a clue only the Spurenblick shows (e3-fh-spur): Q, then click it.
 *  - else the interactive the objective text points to (e3-ms-umsehen: the bed), or the nearest one that sparkles.
 */
const EXPLORE_PREFERRED: Record<string, string> = { 'e3-ms-umsehen': 'bett', 'e3-hw-gestalt': 'gestalt' };

async function exploreStep(page: Page, sp: Extract<Special, { kind: 'explore' }>): Promise<void> {
  const plan = await page.evaluate(async ({ objective, preferred }) => {
    const w = (window as any).__world;
    const p = { x: w.player.x, y: w.player.y };
    if (objective === 'e3-ri-posten') {
      const mod = await import(/* @vite-ignore */ String('/src/chapters/teil-3/ritual-huegel.ts'));
      const G = (window as any).G;
      const ready = w.interactives.find((i: any) => /^posten-/.test(i.id) && !i.removed && i.enabled());
      if (ready) { const pos = ready.pos(); return { kind: 'interact' as const, x: pos.x, y: pos.y, d: w.distTo(ready), range: ready.radius - 2, what: ready.id, focus: w.focus === ready }; }
      const open = (mod.POST_IDS as string[]).filter(id => !G.state.is(`e3-ri-erspaeht-${id}`));
      open.sort((a, b) => Math.hypot(mod.POSTS[a].at[0] - p.x, mod.POSTS[a].at[1] - p.y) - Math.hypot(mod.POSTS[b].at[0] - p.x, mod.POSTS[b].at[1] - p.y));
      const id = open[0];
      if (id) return { kind: 'spot' as const, x: mod.POSTS[id].at[0], y: mod.POSTS[id].at[1], d: Math.hypot(mod.POSTS[id].at[0] - p.x, mod.POSTS[id].at[1] - p.y), range: mod.SPOT_RANGE ?? 150, what: id };
    }
    if (objective === 'e3-hw-riss') {
      const mod = await import(/* @vite-ignore */ String('/src/chapters/teil-3/hoffnung-und-weigerung-texte.ts'));
      const text: string = w.objective.text;
      const m = /\((\d+) von/.exec(text);
      const closed = m ? Number(m[1]) : 0;
      const at = mod.RIFTS[Math.min(closed, mod.RIFTS.length - 1)];
      return { kind: 'stand' as const, x: at[0], y: at[1] + 6, d: Math.hypot(at[0] - p.x, at[1] - p.y), range: mod.RIFT_RADIUS - 8, what: `riss-${closed}` };
    }
    const clues: any[] = w.clues ?? [];
    if (w.look?.enabled) {
      const c = clues.filter(c => !c.found).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (c) return { kind: 'clue' as const, x: c.x, y: c.y, d: Math.hypot(c.x - p.x, c.y - p.y), range: 0, what: c.def.id, revealed: Boolean(c.revealed) };
    }
    const live = w.interactives.filter((i: any) => !i.removed && i.enabled());
    const it = live.find((i: any) => i.id === preferred)
      ?? live.filter((i: any) => i.sparkle || i.def?.sparkle).sort((a: any, b: any) => w.distTo(a) - w.distTo(b))[0]
      ?? live.sort((a: any, b: any) => w.distTo(a) - w.distTo(b))[0];
    if (!it) return { kind: 'none' as const, x: 0, y: 0, d: 0, range: 0, what: 'nothing enabled' };
    const pos = it.pos();
    return { kind: 'interact' as const, x: pos.x, y: pos.y, d: w.distTo(it), range: it.radius - 2, what: it.id, focus: w.focus === it };
  }, { objective: sp.objective, preferred: EXPLORE_PREFERRED[sp.objective] ?? '' });
  const note = `${sp.objective}: ${plan.kind} ${plan.what}`;
  if (!drive3Log.explore.includes(note)) drive3Log.explore.push(note);
  const me = await page.evaluate(() => { const w = (window as any).__world; return { x: w.player.x, y: w.player.y }; });
  if (plan.kind === 'none') { await page.waitForTimeout(300); return; }
  if (plan.kind === 'spot') {
    // Spurenblick held while walking up to the post.
    await page.keyboard.down('q');
    try {
      if (plan.d > plan.range - 30) await clickToward(page, plan.x, plan.y, me);
      await page.waitForTimeout(900);
    } finally { await page.keyboard.up('q'); }
    driveLog.lookPresses++;
    await page.waitForTimeout(200);
    return;
  }
  if (plan.kind === 'stand') {
    if (plan.d > plan.range) { await clickToward(page, plan.x, plan.y, me); await page.waitForTimeout(700); return; }
    await page.waitForTimeout(600); // stand still
    return;
  }
  if (plan.kind === 'clue') {
    await lookClueStep(page, { kind: 'look-clue', id: plan.what, revealed: Boolean((plan as any).revealed), onScreen: Boolean(await toPage(page, plan.x, plan.y)), x: plan.x, y: plan.y });
    return;
  }
  // An interactive: a click on it walks there and uses it; in reach, E.
  if (plan.d <= plan.range + 2 && (plan as any).focus) { await page.keyboard.press('e'); await page.waitForTimeout(600); return; }
  const at = await toPage(page, plan.x, plan.y - 6);
  if (at) { driveLog.clicks++; await page.mouse.click(at.x, at.y); await page.waitForTimeout(900); return; }
  await clickToward(page, plan.x, plan.y, me);
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------------------------------------------
// Timed stealth: predict every guard's patrol and only walk legs no cone will cover while Lia is on them
// ---------------------------------------------------------------------------------------------------------------

let c3Held = false;
async function hold3C(page: Page, on: boolean): Promise<void> {
  if (on === c3Held) return;
  c3Held = on;
  if (on) await page.keyboard.down('c'); else await page.keyboard.up('c');
}

/**
 * Plans one stealth move (read only): the guards' patrols are simulated from their current state (waypoints, wait
 * timers, pingpong direction) for the next seconds; a leg is safe when Lia, crouching (C held, sneak speed, 0.55 × cone
 * range), is never inside a predicted cone (with margins for the look-around sweep) before she arrives — at the goal or
 * in a hiding spot nearer to it. Returns the page point to click, or a reason to wait.
 */
async function planStealth(page: Page): Promise<{ kind: 'click' | 'wait'; x?: number; y?: number; why: string }> {
  return page.evaluate(async () => {
    const pf = await import(/* @vite-ignore */ String('/src/world/pathfind.ts'));
    const gridMod = await import(/* @vite-ignore */ String('/src/world/grid.ts'));
    const vision = await import(/* @vite-ignore */ String('/src/world/vision.ts'));
    const polyMod = await import(/* @vite-ignore */ String('/src/world/poly.ts'));
    const geom = await import(/* @vite-ignore */ String('/src/world/geom.ts'));
    const w = (window as any).__world;
    const foot = { hw: gridMod.FOOT_HW, hh: gridMod.FOOT_HH };
    const p = { x: w.player.x, y: w.player.y };
    const K: number = w.player.host?.worldK ?? 1.75;
    const t = w.objective.target;
    const it = typeof t === 'string' ? w.interactives.find((i: any) => i.id === t && !i.removed) : null;
    const goal = it ? (it.stand?.() ?? it.pos()) : w.resolveTarget(t);
    const DT = 0.2, STEPS = 150;
    const guards = (w.guards ?? []).filter((g: any) => !g.actor.held && !g.actor.destroyed);
    // ---- guard prediction ----
    type GS = { x: number; y: number; f: number; wide: number; any: boolean };
    const sims: GS[][] = guards.map((g: any) => {
      const out: GS[] = [];
      const wps = g.waypoints as { x: number; y: number; wait: number; face?: string }[];
      let idx: number = g.idx, dir: number = g.stepDir ?? 1, state: string = g.state, waitT: number = g.waitT ?? 0;
      let x: number = g.actor.x, y: number = g.actor.y, f: number = g.facing;
      let path: { x: number; y: number }[] | null = g.actor.path ? g.actor.path.map((q: any) => ({ x: q.x, y: q.y })) : null;
      const spd: number = g.actor.walkSpeed;
      const unpredictable = !['walk', 'wait', 'return'].includes(state);
      for (let k = 0; k < STEPS; k++) {
        if (unpredictable) { out.push({ x, y, f, wide: Math.PI, any: true }); continue; }
        if (state === 'wait') {
          const wp = wps[idx];
          const base = wp?.face ? geom.dirAngle(wp.face) : f;
          out.push({ x, y, f: base, wide: 0.45 + (wp?.face && Math.abs(vision.angleDiff ? vision.angleDiff(base, f) : 0) > 0.2 ? 0.6 : 0), any: false });
          waitT -= DT;
          if (waitT <= 0 && wps.length > 1) {
            if (g.def.mode === 'pingpong') { if (idx + dir >= wps.length || idx + dir < 0) dir *= -1; idx += dir; } else idx = (idx + 1) % wps.length;
            const pp = pf.findPath(w.grid, { x, y }, wps[idx], foot);
            path = pp && pp.length ? pp : [{ x: wps[idx].x, y: wps[idx].y }];
            state = 'walk';
          }
          continue;
        }
        // walking along the path
        let left = spd * DT;
        while (path && path.length && left > 0) {
          const q = path[0];
          const d = Math.hypot(q.x - x, q.y - y);
          if (d > 0.01) f = Math.atan2(q.y - y, q.x - x);
          if (d <= left) { x = q.x; y = q.y; left -= d; path.shift(); } else { x += (q.x - x) / d * left; y += (q.y - y) / d * left; left = 0; }
        }
        out.push({ x, y, f, wide: 0.5, any: false });
        if (!path || !path.length) { state = 'wait'; waitT = (wps[idx]?.wait ?? 600) / 1000; }
      }
      return out;
    });
    const spots = (w.map.hidingSpots ?? []) as { id: string; poly: number[][] }[];
    const inSpot = (q: { x: number; y: number }) => spots.find(h => polyMod.pointInPoly(q.x, q.y, h.poly as any));
    const seenAt = (q: { x: number; y: number }, k: number): boolean => {
      if (inSpot(q)) return false; // crouching in a shadow: hidden
      return guards.some((g: any, gi: number) => {
        const st = sims[gi][Math.min(k, STEPS - 1)];
        const eye = { x: st.x, y: st.y - 3 * K };
        const R = g.range * 0.55 * 1.3 + 10;
        const d = Math.hypot(q.x - eye.x, q.y - eye.y);
        if (d > R) return false;
        if (d < 22) return true;
        if (!st.any && !vision.inCone(eye, st.f, g.half + st.wide, R, q)) return false;
        return vision.lineOfSight(w.grid, eye, q) || vision.lineOfSight(w.grid, eye, { x: q.x, y: q.y - 8 * K });
      });
    };
    const speed = 34 * K;
    const pathLen = (pts: { x: number; y: number }[], from = p) => { let L = 0, a = from; for (const q of pts) { L += Math.hypot(q.x - a.x, q.y - a.y); a = q; } return L; };
    /** Lia walks `pts` from now; safe when no sample is seen, and (unless the end is hidden or `noDwell`) 2 s there too. */
    const legSafe = (pts: { x: number; y: number }[], noDwell: boolean): boolean => {
      let a = p, k = 0, carry = 0;
      for (const q of pts) {
        const leg = Math.hypot(q.x - a.x, q.y - a.y);
        let s = carry;
        while (s <= leg) {
          const f = leg > 0 ? s / leg : 1;
          const pos = { x: a.x + (q.x - a.x) * f, y: a.y + (q.y - a.y) * f };
          if (k >= STEPS - 1) return false;
          if (seenAt(pos, k)) return false;
          s += speed * DT; k++;
        }
        carry = s - leg; a = q;
      }
      if (noDwell || inSpot(a)) return true;
      for (let j = 0; j < 10; j++) if (seenAt(a, k + j)) return false;
      return true;
    };
    const route = (to: { x: number; y: number }) => { const pp = pf.findPath(w.grid, p, to, foot); return pp && pp.length ? pp as { x: number; y: number }[] : null; };
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    const gw: number = (window as any).G.game.scale.width, gh: number = (window as any).G.game.scale.height;
    const clickOn = (pts: { x: number; y: number }[], why: string) => {
      for (let i = pts.length - 1; i >= 0; i--) {
        // Click the furthest visible point of the safe path (also points between the waypoints).
        const a = i > 0 ? pts[i - 1] : p, b = pts[i];
        for (let f = 1; f >= 0; f -= 0.2) {
          const q = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
          const sc = w.toScreen(q.x, q.y);
          if (sc.x < 8 || sc.x > gw - 8 || sc.y < 8 || sc.y > gh - 8) continue;
          const pg = { x: r.left + sc.x * r.width / gw, y: r.top + sc.y * r.height / gh };
          if (document.elementFromPoint(pg.x, pg.y) !== canvas) continue;
          if (Math.hypot(q.x - p.x, q.y - p.y) < 3) continue;
          return { kind: 'click' as const, x: pg.x, y: pg.y, why };
        }
      }
      return null;
    };
    const toGoal = route(goal);
    const remaining = toGoal ? pathLen(toGoal) : Math.hypot(goal.x - p.x, goal.y - p.y);
    if (toGoal && legSafe(toGoal, Boolean(it))) { const c = clickOn(toGoal, `safe to goal (${Math.round(remaining)} px)`); if (c) return c; }
    const centre = (poly: number[][]) => ({ x: poly.reduce((n, v) => n + v[0], 0) / poly.length, y: poly.reduce((n, v) => n + v[1], 0) / poly.length });
    const here = inSpot(p);
    const cands = spots.filter(h => h !== here).map(h => {
      const c = centre(h.poly);
      const pp = pf.findPath(w.grid, c, goal, foot);
      return { h, c, rest: pp && pp.length ? pathLen(pp, c) : Infinity };
    }).filter(x => x.rest < remaining - 15).sort((a, b) => a.rest - b.rest);
    for (const cand of cands) {
      const pp = route(cand.c);
      if (!pp || !legSafe(pp, false)) continue;
      const c = clickOn(pp, `safe to ${cand.h.id} (rest ${Math.round(cand.rest)} px)`);
      if (c) return c;
    }
    if (here) return { kind: 'wait' as const, why: `hidden in ${here.id}, waiting for a window` };
    // Exposed with no safe forward leg: the nearest hiding spot whose way is safe, else wait.
    for (const h of [...spots].sort((a, b) => Math.hypot(centre(a.poly).x - p.x, centre(a.poly).y - p.y) - Math.hypot(centre(b.poly).x - p.x, centre(b.poly).y - p.y))) {
      const pp = route(centre(h.poly));
      if (!pp || !legSafe(pp, false)) continue;
      const c = clickOn(pp, `back into ${h.id}`);
      if (c) return c;
    }
    return { kind: 'wait' as const, why: 'exposed, no safe leg' };
  });
}

export const stealthLog: string[] = [];
async function stealthStep(page: Page): Promise<void> {
  await hold3C(page, true);
  const plan = await planStealth(page);
  const note = plan.why.replace(/\d+/g, '#');
  if (stealthLog[stealthLog.length - 1] !== note) stealthLog.push(note);
  if (stealthLog.length > 400) stealthLog.splice(0, 200);
  if (plan.kind === 'click') { driveLog.clicks++; await page.mouse.click(plan.x!, plan.y!); await page.waitForTimeout(350); return; }
  await page.waitForTimeout(250);
}

/** Plays with real inputs until `until` holds: the Teil-II driver plus the Teil-III situations above. */
export async function drive3(page: Page, opts: DriveOptions & { battle?: BattleOptions }): Promise<Snap> {
  const deadline = Date.now() + (opts.timeoutMs ?? 360000);
  for (;;) {
    const s = await snap(page);
    if (await opts.until(s)) { await hold3C(page, false); return s; }
    if (opts.onSnap) await opts.onSnap(s);
    // Teil-III battles go through the battle UI (menu, cursor keys, Enter, confirm, facing), never through executePlan.
    if (s.tactics) { await playBattleUi(page, { ...opts.battle, until: opts.until }); continue; }
    const sp = await special(page);
    if (sp?.kind === 'aim') { await aimStep(page, sp); continue; }
    if (sp?.kind === 'spirits') { await spiritStep(page, sp); continue; }
    if (sp?.kind === 'look-clue') { await lookClueStep(page, sp); continue; }
    if (sp?.kind === 'explore') { await hold3C(page, false); await exploreStep(page, sp); continue; }
    if (sp?.kind === 'stealth') { await stealthStep(page); continue; }
    await hold3C(page, false);
    const left = deadline - Date.now();
    if (left <= 0) throw new Error(`drive3(${opts.label ?? ''}) timed out in ${s.scene} / ${s.map}; objective=${JSON.stringify(s.objective)}`);
    await drive(page, {
      ...opts, timeoutMs: left,
      until: async s2 => (await opts.until(s2)) || s2.tactics || Boolean(await special(page)),
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Battles through the battle UI (ported from the port stage's scratch check)
// ---------------------------------------------------------------------------------------------------------------
// The turn of the active player unit is PLANNED by reading the battle in the page (AI planner for the general case,
// a small rule for Flick's rush to the stone in the ritual); every action is then given with real input: menu click
// „Bewegen“, arrow keys move the cursor, Enter picks the tile, the ability button, cursor + Enter for the target,
// „Bestätigen“, „Zug beenden“ and the facing confirmation. Enemy and ally turns are the game's own AI.

export interface BattleOptions {
  /** Stops the battle loop early (e.g. a test that only wants to see the first turn). */
  until?: (s: Snap) => boolean | Promise<boolean>;
  /** Called at every player turn (screenshots, state checks). */
  onTurn?: (info: { battle: string; unit: string; turn: number; round: number }) => Promise<void>;
  /** Phone: taps instead of clicks on the battle menu (the cursor still moves with the arrow keys of the keyboard). */
  touch?: boolean;
}

export interface BattleRecord { id: string; outcome: string; rounds: number; turns: number; defeats: string[]; notes: string[]; actions: Record<string, { tries: number; hits: number }> }
export const battleLog3: BattleRecord[] = [];

interface Plan { unit: string; moveTo: { x: number; y: number } | null; ability: string | null; target: { x: number; y: number } | null; actFirst: boolean; self: boolean; note: string }

/** Reads the battle and plans the active player unit's turn (planning only; the turn itself goes through the UI). */
async function planBattleTurn(page: Page): Promise<Plan | null> {
  return page.evaluate(async () => {
    const ai = await import(/* @vite-ignore */ String('/src/tactics/rules/ai.ts'));
    const grid = await import(/* @vite-ignore */ String('/src/tactics/rules/grid.ts'));
    const mv = await import(/* @vite-ignore */ String('/src/tactics/rules/movement.ts'));
    const t = (window as any).__tactics, b = t.ctrl.battle, id = b.activeUnit as string, u = b.unit(id), def = t.ctrl.def.id as string;
    if (!u || u.team !== 'player') return null;
    const self = (ab: string) => b.ability(ab).target === 'self';
    const plan = (moveTo: any, ability: string | null, target: any, actFirst = false, note = '') =>
      ({ unit: id, moveTo, ability, target, actFirst, self: !!ability && self(ability), note });
    const viaAi = (override: any, note: string) => {
      const before = b.aiOverrides.get(id);
      b.aiOverrides.set(id, override);
      const p = ai.planTurn(b, id);
      if (before) b.aiOverrides.set(id, before); else b.aiOverrides.delete(id);
      return plan(p.moveTo, p.action?.ability ?? null, p.action?.target ?? null, p.actFirst, note + ':' + p.reason);
    };
    if (def === 'e3-ritualangriff') {
      const lia = b.unit('lia');
      const STONE = { x: 6, y: 5 };
      if (id === 'flick' && b.has(lia, 'bound')) {
        const sides = [{ x: 5, y: 5 }, { x: 7, y: 5 }, { x: 6, y: 4 }, { x: 6, y: 6 }];
        const near = (p: any) => Math.abs(p.x - STONE.x) + Math.abs(p.y - STONE.y) === 1;
        if (near(u)) return plan(null, 'e3-fesseln-loesen', STONE, false, 'free');
        const reach = b.reach(id);
        const side = sides.find(s => reach.has(grid.key(s.x, s.y)) && !b.unitAt(s.x, s.y));
        if (side) return plan(side, 'e3-fesseln-loesen', STONE, false, 'rush+free');
        const blockers = new Set(b.units.filter((x: any) => !x.down && x.id !== id && x.x > -50).map((x: any) => grid.key(x.x, x.y)));
        const field = mv.distanceField(b.grid, sides.filter(s => !b.unitAt(s.x, s.y)), u.jump, blockers);
        let best: any = null, bd = field.get(grid.key(u.x, u.y)) ?? 999;
        for (const n of reach.values() as any) { const d = field.get(grid.key(n.x, n.y)) ?? 999; if (d < bd && !b.unitAt(n.x, n.y)) { bd = d; best = { x: n.x, y: n.y }; } }
        const at = best ?? u;
        // After the move: topple a stand next to her, else the best shot from there.
        const stands = [[4, 3], [6, 3], [7, 3], [8, 3], [4, 5], [8, 5], [4, 7], [5, 7], [6, 7], [8, 7]];
        const standNear = stands.some(([x, y]) => Math.abs(x - at.x) + Math.abs(y - at.y) === 1 && b.grid.tile(x, y).terrain !== 'dirt');
        if (standNear && u.abilities.includes('e3-umstossen')) return plan(best, 'e3-umstossen', null, false, 'approach+topple');
        let shot: any = null, sv = 0;
        for (const ab of [u.attack, ...u.abilities]) {
          if (!ab) continue;
          const a = b.ability(ab);
          if (a.kind === 'support' || a.kind === 'interact' || !b.abilityReady(u, ab)) continue;
          for (const tc of b.targetCells(id, ab, at)) {
            if (!b.validTarget(id, ab, tc, at)) continue;
            const pv = b.preview(id, ab, tc, at);
            let v = 0;
            for (const tt of pv.targets) { const tu = b.unit(tt.unit); if (b.isEnemy(u, tu)) v += tt.chance / 100 * tt.damage * tt.hits; else v -= 5; }
            if (v > sv) { sv = v; shot = { ab, tc }; }
          }
        }
        return plan(best, shot?.ab ?? null, shot?.tc ?? null, false, 'approach+shoot');
      }
      return viaAi({ profile: id === 'flick' ? 'archer' : 'melee', target: 'baris' }, 'fight');
    }
    if (def === 'e3-vamir-duell') {
      if (u.hp <= u.maxHp * 0.35 && u.abilities.includes('versorgen') && b.abilityReady(u, 'versorgen')) return plan(null, 'versorgen', { x: u.x, y: u.y }, false, 'heal');
      const p = viaAi({ profile: 'archer', target: 'vamir' }, 'duel');
      if (!p.ability && u.abilities.includes('ausweichen') && b.abilityReady(u, 'ausweichen')) return { ...p, ability: 'ausweichen', self: true, target: null, note: p.note + '+dodge' };
      return p;
    }
    return viaAi({ profile: 'melee' }, 'default');
  });
}

async function battleReady(page: Page, timeout = 20000): Promise<'player' | 'outcome' | 'hint' | 'busy' | 'gone'> {
  const h = await page.waitForFunction(() => {
    const t = (window as any).__tactics, G = (window as any).G;
    if (!t?.ready || !t.sys.isActive()) return 'gone';
    if (document.querySelector('.tac-out.show')) return 'outcome';
    if (document.querySelector('.tac-hint:not(.hidden) button')) return 'hint';
    if (G.ui.busy()) return 'busy';
    const b = t.ctrl.battle, u = b.activeUnit && b.unit(b.activeUnit);
    if (u && u.team === 'player' && t.ctrl.inputEnabled() && t.animating === 0 && !t.cameras.main.panEffect.isRunning) return 'player';
    return null;
  }, undefined, { timeout, polling: 150 });
  return h.jsonValue() as Promise<'player' | 'outcome' | 'hint' | 'busy' | 'gone'>;
}

async function battleSettle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const t = (window as any).__tactics;
    if (!t?.ready) return true;
    return !!document.querySelector('.tac-out.show') || !!document.querySelector('.tac-facing:not(.hidden)')
      || !!document.querySelector('.tac-hint:not(.hidden) button') || (window as any).G.ui.busy()
      || (t.animating === 0 && t.ctrl.inputEnabled());
  }, undefined, { timeout: 30000, polling: 150 });
}

async function tapOrClick(page: Page, sel: string, touch: boolean): Promise<void> {
  const loc = page.locator(sel).first();
  if (touch) await loc.tap({ timeout: 5000 }); else await loc.click({ timeout: 5000 });
}

/** Clears hints and dialogue boxes that appear in between (hooks); true when the battle is over. */
async function clearInterruptions(page: Page, touch = false): Promise<boolean> {
  for (let i = 0; i < 80; i++) {
    if (await page.locator('.tac-out.show').count()) return true;
    if (!(await page.evaluate(() => Boolean((window as any).__tactics?.ready)))) return true;
    const hint = page.locator('.tac-hint:not(.hidden) button');
    if (await hint.count()) { await tapOrClick(page, '.tac-hint:not(.hidden) button', touch).catch(() => {}); await page.waitForTimeout(250); continue; }
    if (await page.evaluate(() => (window as any).G.ui.busy())) { await page.keyboard.press('Enter'); await page.waitForTimeout(250); continue; }
    return false;
  }
  return false;
}

/**
 * Touch tap on a battle tile. The page point comes from the battle camera once it stands still; when the tile is off
 * screen or under a panel, the board is first swiped (one-finger drag through CDP, as on a phone) so the tile comes
 * into a free part of the canvas; when a figure in front covers it, the view is turned with the rotate button.
 * False when that does not work within a few tries.
 */
async function tapTile(page: Page, tile: { x: number; y: number }): Promise<boolean> {
  let rotations = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.waitForFunction(() => { const t = (window as any).__tactics; return !t?.cameras.main.panEffect.isRunning; }, undefined, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(120);
    const info = await page.evaluate(async t => {
      const vp = await import(/* @vite-ignore */ String('/src/core/viewport.ts'));
      const tac = (window as any).__tactics;
      const canvas = document.querySelector('canvas')!;
      const r = canvas.getBoundingClientRect();
      const cam = tac.cameras.main;
      const free = (x: number, y: number) => x > 4 && y > 4 && x < innerWidth - 4 && y < innerHeight - 4 && document.elementFromPoint(x, y) === canvas;
      // Which tile a tap at this page point means, by the scene's own rule (read only).
      const means = (x: number, y: number) => {
        const gx = (x - r.left) / r.width * vp.GAME_W, gy = (y - r.top) / r.height * vp.GAME_H;
        const q = tac.pointerTile(cam.worldView.x + gx / cam.zoom, cam.worldView.y + gy / cam.zoom);
        return q && q.x === t.x && q.y === t.y;
      };
      const centre = tac.debugPage(t);
      if (!centre) return null;
      const occupant = tac.ctrl.battle.unitAt(t.x, t.y);
      const cands = [...(occupant ? [tac.debugPage(occupant.id)] : []), centre,
        ...[[0, -4], [0, 4], [-6, 0], [6, 0], [0, -8], [-4, 3], [4, 3], [-4, -3], [4, -3]].map(([dx, dy]) => ({ x: centre.x + dx * r.width / vp.GAME_W, y: centre.y + dy * r.height / vp.GAME_H }))].filter(Boolean);
      // A touch lands on whole pixels and a finger is not a point: the tile must hold a little around the rounded spot.
      const solid = (x: number, y: number) => [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]].every(([dx, dy]) => free(Math.round(x) + dx, Math.round(y) + dy) && means(Math.round(x) + dx, Math.round(y) + dy));
      const found = cands.find((c: any) => solid(c.x, c.y));
      const hit = found ? { x: Math.round(found.x), y: Math.round(found.y) } : undefined;
      // Free canvas points (no panel on top), the one nearest to the middle of the free area first.
      const pts: { x: number; y: number }[] = [];
      for (let gy = 0.08; gy < 0.95; gy += 0.06) for (let gx = 0.06; gx < 0.96; gx += 0.06) { const x = innerWidth * gx, y = innerHeight * gy; if (free(x, y)) pts.push({ x, y }); }
      const mid = pts.length ? { x: pts.reduce((n, q) => n + q.x, 0) / pts.length, y: pts.reduce((n, q) => n + q.y, 0) / pts.length } : null;
      pts.sort((a, b) => Math.hypot(a.x - (mid?.x ?? 0), a.y - (mid?.y ?? 0)) - Math.hypot(b.x - (mid?.x ?? 0), b.y - (mid?.y ?? 0)));
      // On screen and free of panels, but every point means another tile: a figure in front covers this one.
      const covered = !hit && cands.some((c: any) => free(c.x, c.y));
      return { x: hit ? hit.x : centre.x, y: hit ? hit.y : centre.y, free: Boolean(hit), covered, mid: pts[0] ?? null };
    }, tile);
    if (!info) return false;
    if (info.free) {
      await page.touchscreen.tap(info.x, info.y);
      await page.waitForTimeout(250);
      return true;
    }
    if (info.covered && rotations < 3) {
      // A figure in front hides the tile (e.g. Lia on the raised stone in front of Baris): turn the view with the
      // rotate button, as a player would; swiping cannot uncover it.
      rotations++;
      await page.locator('.tac-rot [data-r="1"]').tap();
      await page.waitForTimeout(500);
      continue;
    }
    if (!info.mid) return false;
    // Swipe: put a finger on a free canvas point and drag the board by (middle − tile), at most 160 px per swipe.
    const dx = Math.max(-160, Math.min(160, info.mid.x - info.x)), dy = Math.max(-160, Math.min(160, info.mid.y - info.y));
    const from = info.mid;
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
      for (let k = 1; k <= 8; k++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + dx * k / 8, y: from.y + dy * k / 8 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
    swipes3.count++;
    await page.waitForTimeout(200);
  }
  return false;
}

/** Board swipes done by tapTile (phone). */
export const swipes3 = { count: 0 };

async function hpOf(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => Object.fromEntries((window as any).__tactics.ctrl.battle.units.map((u: any) => [u.id, u.hp])));
}

const ARROW: Record<string, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

/** Walks the battle cursor with the arrow keys to a tile (real keyboard input; the iso view decides the mapping). */
async function cursorTo(page: Page, to: { x: number; y: number }): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => {
      const t = (window as any).__tactics;
      const u = t.sel.unit ? t.ctrl.battle.unit(t.sel.unit) : null;
      const h = t.hover ?? (u ? { x: u.x, y: u.y } : { x: 0, y: 0 });
      const map: Record<string, string> = {};
      for (const d of ['up', 'down', 'left', 'right']) map[d] = t.iso.facingForScreen(d);
      return { h: { x: h.x, y: h.y }, map };
    });
    if (st.h.x === to.x && st.h.y === to.y) return true;
    const need = to.x > st.h.x ? 'e' : to.x < st.h.x ? 'w' : to.y > st.h.y ? 's' : 'n';
    const dir = Object.entries(st.map).find(([, f]) => f === need)?.[0];
    if (!dir) return false;
    await page.keyboard.press(ARROW[dir]);
    await page.waitForTimeout(40);
  }
  return false;
}

async function doMove(page: Page, plan: Plan, rec: BattleRecord, touch: boolean): Promise<void> {
  if (!plan.moveTo) return;
  await battleSettle(page);
  if (await clearInterruptions(page, touch)) return;
  const can = await page.evaluate(({ id }) => {
    const t = (window as any).__tactics, b = t.ctrl.battle, u = b.unit(id);
    return !!u && !u.moved && b.activeUnit === id && t.ctrl.inputEnabled() && !t.ctrl.isEnded;
  }, { id: plan.unit });
  if (!can) return;
  try { await tapOrClick(page, '.tac-menu [data-m="move"]', touch); } catch { rec.notes.push(`${plan.unit}: move button not clickable`); return; }
  if (touch) {
    // Touch: the first tap on a tile marks it, the second one walks there (TacticsScene.click).
    if (!(await tapTile(page, plan.moveTo)) || !(await tapTile(page, plan.moveTo))) { rec.notes.push(`tile ${JSON.stringify(plan.moveTo)} off screen`); return; }
  } else {
    if (!(await cursorTo(page, plan.moveTo))) { rec.notes.push(`cursor could not reach ${JSON.stringify(plan.moveTo)}`); return; }
    await page.keyboard.press('Enter');
  }
  await page.waitForFunction(({ id, to }) => { const u = (window as any).__tactics.ctrl.battle.unit(id); return u.x === to.x && u.y === to.y; }, { id: plan.unit, to: plan.moveTo }, { timeout: 8000 })
    .catch(() => rec.notes.push(`move ${plan.unit} → ${JSON.stringify(plan.moveTo)} failed`));
  await battleSettle(page);
  await clearInterruptions(page, touch);
}

async function doAct(page: Page, plan: Plan, rec: BattleRecord, touch: boolean): Promise<void> {
  if (!plan.ability) return;
  const can = await page.evaluate(({ id }) => {
    const t = (window as any).__tactics, b = t.ctrl.battle, u = b.unit(id);
    return !!u && !u.acted && b.activeUnit === id && t.ctrl.inputEnabled();
  }, { id: plan.unit });
  if (!can) return;
  const btn = page.locator(`.tac-card [data-ab="${plan.ability}"]`).first();
  if (!(await btn.count()) || (await btn.getAttribute('class', { timeout: 2000 }).catch(() => 'dis'))?.includes('dis')) { rec.notes.push(`${plan.unit}: ${plan.ability} not usable`); return; }
  const target = plan.self ? null : plan.target;
  const before = await hpOf(page);
  try { if (touch) await btn.tap({ timeout: 4000 }); else await btn.click({ timeout: 4000 }); } catch { rec.notes.push(`${plan.unit}: ${plan.ability} button not clickable`); return; }
  if (target && touch) {
    // Touch: one tap pins the target and shows the forecast; „Bestätigen“ below.
    if (!(await tapTile(page, target))) { rec.notes.push(`target ${JSON.stringify(target)} off screen`); return; }
  } else if (target) {
    if (!(await cursorTo(page, target))) { rec.notes.push(`cursor could not reach target ${JSON.stringify(target)}`); await page.keyboard.press('Escape'); return; }
    await page.keyboard.press('Enter'); // pins the target and shows the forecast
  }
  const confirm = page.locator('.tac-confirm-target');
  try { await confirm.waitFor({ state: 'visible', timeout: 3000 }); await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.tac-confirm-target')?.disabled, undefined, { timeout: 3000 }); } catch { rec.notes.push(`${plan.unit}: ${plan.ability} target not accepted`); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); return; }
  try { if (touch) await confirm.tap({ timeout: 4000 }); else await confirm.click({ timeout: 4000 }); } catch { rec.notes.push(`${plan.unit}: ${plan.ability} confirm not clickable`); return; }
  await battleSettle(page);
  const after = await hpOf(page);
  const kind = await page.evaluate(ab => (window as any).__tactics.ctrl.battle.ability(ab).kind, plan.ability);
  const r = (rec.actions[`${plan.unit}:${plan.ability}`] ??= { tries: 0, hits: 0 });
  r.tries++;
  if (kind !== 'support' && kind !== 'interact') { if (Object.keys(before).some(k => k !== plan.unit && after[k] !== undefined && after[k] < before[k])) r.hits++; } else r.hits++;
  await clearInterruptions(page, touch);
}

async function endBattleTurn(page: Page, touch: boolean): Promise<void> {
  const facing = page.locator('.tac-facing:not(.hidden) .tac-confirm-facing');
  if (!(await facing.count())) {
    const end = page.locator('.tac-endturn');
    if (await end.isVisible().catch(() => false)) await (touch ? end.tap({ timeout: 4000 }) : end.click({ timeout: 4000 })).catch(() => {});
  }
  const conf = page.locator('.tac-confirm-facing');
  await conf.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  await (touch ? conf.tap({ timeout: 3000 }) : conf.click({ timeout: 3000 })).catch(() => {});
}

/**
 * Plays the running battle to its end through the battle UI (a defeat is retried with „Erneut versuchen“, at most three
 * times) and leaves the outcome screen. Returns the record (also pushed to battleLog3 and teil2Helpers' driveLog).
 */
export async function playBattleUi(page: Page, opts: BattleOptions = {}): Promise<BattleRecord> {
  const touch = Boolean(opts.touch);
  const id = await page.evaluate(() => (window as any).__tactics.ctrl.def.id as string);
  const rec: BattleRecord = { id, outcome: '', rounds: 0, turns: 0, defeats: [], notes: [], actions: {} };
  battleLog3.push(rec);
  for (;;) {
    if (opts.until && await opts.until(await snap(page))) { rec.outcome = 'stopped'; return rec; }
    const st = await battleReady(page, 120000);
    if (st !== 'player') console.log(`BATTLE ${id} state ${st}`);
    if (st === 'gone') { rec.outcome = rec.outcome || 'left'; break; }
    if (st === 'outcome') {
      const win = (await page.locator('.tac-out.show').getAttribute('class', { timeout: 4000 }).catch(() => ''))?.includes('win');
      if (!win) {
        const why = await page.locator('.tac-out.show .s').textContent({ timeout: 2000 }).catch(() => '');
        rec.defeats.push(`round ${await page.evaluate(() => (window as any).__tactics.ctrl.battle.round)}: ${why}`);
        driveLog.defeats++;
        driveLog.battles.push(`${id}:lose (${why})`);
        await shot3(page, `defeat-${id}-${rec.defeats.length}`);
        if (rec.defeats.length > 3) throw new Error(`${id}: lost ${rec.defeats.length} times: ${rec.defeats.join(' | ')}`);
      } else {
        rec.outcome = 'win';
        rec.rounds = await page.evaluate(() => (window as any).__tactics.ctrl.battle.round);
        driveLog.battles.push(`${id}:win`);
      }
      await page.waitForTimeout(600);
      await tapOrClick(page, '.tac-out.show .tac-btn', touch).catch(() => {});
      await page.waitForTimeout(1500);
      if (win) break;
      continue;
    }
    if (st === 'hint' || st === 'busy') { await clearInterruptions(page, touch); continue; }
    const plan = await planBattleTurn(page);
    if (!plan) { await page.waitForTimeout(300); continue; }
    rec.turns++;
    if (rec.turns > 90) throw new Error(`${id}: more than 90 player turns – stall?`);
    const round = await page.evaluate(() => (window as any).__tactics.ctrl.battle.round);
    if (opts.onTurn) await opts.onTurn({ battle: id, unit: plan.unit, turn: rec.turns, round });
    rec.notes.push(`r${round} ${plan.unit} ${plan.note} move=${JSON.stringify(plan.moveTo)} act=${plan.ability}`);
    console.log(`TURN ${id} ${rec.notes[rec.notes.length - 1]}`);
    if (plan.actFirst) { await doAct(page, plan, rec, touch); await doMove(page, plan, rec, touch); } else { await doMove(page, plan, rec, touch); await doAct(page, plan, rec, touch); }
    if (await page.locator('.tac-out.show').count()) continue;
    if (await clearInterruptions(page, touch)) continue;
    const still = await page.evaluate(u => (window as any).__tactics?.ctrl.battle.activeUnit === u, plan.unit);
    if (still) await endBattleTurn(page, touch);
    await page.waitForTimeout(200);
  }
  return rec;
}


// ---------------------------------------------------------------------------------------------------------------
// Reading the Teil-III state (read only)
// ---------------------------------------------------------------------------------------------------------------

/** Looks of the player that are not Lia's poisoned body (Flick, Vamir, the inner world). */
export const NOT_LIAS_BODY = ['flick', 'e2-flick-gefangen', 'vamir', 'e3-lia-innen'];

export interface Probe3 {
  scene: string;
  map: string | null;
  own: number;
  schatten: number;
  fibel: number;
  tincture: number;
  poisoned: boolean;
  /** Player walk/run speed and the map's world scale (engine default walk 64 × k, run 108 × k). */
  walk: number | null;
  run: number | null;
  k: number | null;
  look: string | null;
  free: boolean;
  battle: { id: string; liaAbilities: string[] | null } | null;
  lia: { level: number; exp: number } | null;
  party: string[];
}

export async function probe3(page: Page): Promise<Probe3> {
  return page.evaluate(() => {
    const G = (window as any).G, w = (window as any).__world, t = (window as any).__tactics;
    const worldActive = Boolean(w?.player && w.sys.isActive());
    const look = worldActive ? (w.map?.player ?? w.opts?.player ?? 'lia') : null;
    const battleOn = Boolean(t?.ready && t.sys.isActive());
    const bl = battleOn ? t.ctrl.battle.units.find((u: any) => u.id === 'lia') : null;
    const c = G.state.data.characters.lia;
    return {
      scene: G.currentScene,
      map: worldActive ? w.map?.id ?? null : null,
      own: G.state.count('e3-lia-staff'),
      schatten: G.state.count('e2-schattentoeter'),
      fibel: G.state.count('e3-ordensfibel'),
      tincture: G.state.count('tincture'),
      poisoned: G.state.is('e3-vergiftet') && !G.state.is('e3-gift-abklingend'),
      walk: worldActive ? w.player.walkSpeed : null,
      run: worldActive ? w.player.runSpeed : null,
      k: worldActive ? (w.player.host?.worldK ?? null) : null,
      look: look === null ? null : typeof look === 'string' ? look : 'spec',
      free: worldActive && !w.playerLocked && !G.ui.busy(),
      battle: battleOn ? { id: t.ctrl.def.id as string, liaAbilities: bl ? [...bl.abilities, bl.attack].filter(Boolean) : null } : null,
      lia: c ? { level: c.level, exp: c.exp } : null,
      party: [...G.state.data.party],
    } as Probe3;
  });
}

/** Full copy of the campaign state (read only). */
export const state3 = (page: Page): Promise<any> => page.evaluate(() => JSON.parse(JSON.stringify((window as any).G.state.data)));
