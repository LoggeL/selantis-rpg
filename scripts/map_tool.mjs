#!/usr/bin/env node
// Map tool without a browser (world engine, DESIGN.md §3/§6.2): checks reachability and renders the geometry.
//   node scripts/map_tool.mjs <mapId|all> [--no-render]
// Output: output/qa/maps/<mapId>.png  (background + walk/blocks/occluders/surfaces/exits/hotspots/spawns…, labels;
//                                      unreachable walkable area tinted red)
//         output/qa/maps/<mapId>.json (geometry in px + findings)
// Exit code 1 when a spawn is not walkable or a spawn/exit/interactable/NPC/clue/trigger/hiding spot cannot be
// reached from the first spawn, a guard waypoint is blocked, or an exit points to a missing map/spawn.
import { build } from '../game/node_modules/esbuild/lib/main.js';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'game');
const OUT = join(ROOT, 'output/qa/maps');
const TMP = join(ROOT, 'output/qa/.map_tool');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--')) ?? 'all';
const render = !args.includes('--no-render');

// Browser globals some modules touch at import time (all optional).
globalThis.window ??= undefined;
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const stubPlugin = {
  name: 'stubs',
  setup(b) {
    b.onResolve({ filter: /^phaser$/ }, () => ({ path: join(ROOT, 'scripts/map/phaser-stub.mjs') }));
    b.onResolve({ filter: /\.css$/ }, () => ({ path: 'css', namespace: 'empty' }));
    b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
  },
};

async function bundle(entryCode, name) {
  const entry = join(TMP, `${name}.ts`);
  writeFileSync(entry, entryCode);
  const out = join(TMP, `${name}-${process.pid}.mjs`);
  await build({
    entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent',
    plugins: [stubPlugin], define: { 'import.meta.env': '{"DEV":false,"PROD":true,"BASE_URL":"/"}' },
  });
  try { return await import(pathToFileURL(out).href); } finally { rmSync(out, { force: true }); }
}

const nav = await bundle(`export * from '${join(ROOT, 'scripts/map/nav-entry.ts')}';\n`, 'nav');

// Collect maps from every chapter (each bundled on its own so one broken chapter does not stop the tool).
const maps = new Map();
const skipped = [];
for (const dir of readdirSync(join(GAME, 'src/chapters'))) {
  const idx = join(GAME, 'src/chapters', dir, 'index.ts');
  if (!existsSync(idx)) continue;
  try {
    const mod = await bundle(`import '${idx}';\nexport { mapIds, getMap } from '${join(GAME, 'src/world/maps.ts')}';\n`, `ch-${dir}`);
    for (const id of mod.mapIds()) maps.set(id, { def: mod.getMap(id), chapter: dir });
  } catch (e) {
    skipped.push(`${dir}: ${String(e?.message ?? e).split('\n')[0]}`);
  }
}
if (skipped.length) console.log(`(Kapitel ohne auswertbare Karten übersprungen: ${skipped.join(' | ')})`);

const manifest = JSON.parse(readFileSync(join(GAME, 'public/assets/manifest.json'), 'utf8'));

function pngSize(file) {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function backgroundFile(def) {
  const rel = def.backgroundUrl ?? manifest.backgrounds?.[def.background]?.file ?? `assets/bg/${def.background}.png`;
  const f = join(GAME, 'public', rel);
  return existsSync(f) ? f : null;
}

const ids = target === 'all' ? [...maps.keys()] : [target];
let failed = false;

for (const id of ids) {
  const entry = maps.get(id);
  if (!entry) { console.error(`✗ Unbekannte Karte: ${id} (bekannt: ${[...maps.keys()].join(', ')})`); failed = true; continue; }
  const def = entry.def;
  const problems = [];
  nav.setMapUnits(def.units ?? 'px');
  const k = def.worldScale ?? 1.75;
  nav.setWorldScale(k);
  nav.setFootScale(k);
  const hw = nav.FOOT_HW, hh = nav.FOOT_HH;

  if (!def.background) problems.push('Karte ohne background (Karten sind gemalte Hintergründe)');
  const bgFile = def.background ? backgroundFile(def) : null;
  const size = def.size ?? (bgFile ? pngSize(bgFile) : null);
  if (!size) problems.push(`Hintergrund '${def.background}' fehlt (game/public/assets/bg/)`);
  const w = size?.w ?? 640, h = size?.h ?? 360;
  const grid = nav.buildPaintedGrid(def, w, h);
  for (const [i, wa] of nav.normWalk(def).entries()) if (wa.poly.length < 3) problems.push(`walk[${i}] hat weniger als 3 Punkte`);

  const walkable = (x, y) => grid.boxFree(x, y, hw, hh);
  const spawns = Object.entries(def.spawns ?? {});
  const spawnPx = Object.fromEntries(spawns.map(([n, s]) => [n, nav.toPx(s.at)]));
  for (const [n, p] of Object.entries(spawnPx)) if (!walkable(p.x, p.y)) problems.push(`Start '${n}' (${Math.round(p.x)}, ${Math.round(p.y)}) nicht begehbar`);
  const start = Object.entries(spawnPx).find(([, p]) => walkable(p.x, p.y));

  // Flood fill of the agent grid from the first walkable spawn = everything the player can reach.
  const walk = nav.agentGrid(grid, hw, hh);
  const cols = grid.cols, rows = grid.rows, C = nav.CELL;
  const reach = new Uint8Array(cols * rows);
  if (start) {
    const s0 = Math.floor(start[1].y / C) * cols + Math.floor(start[1].x / C);
    const q = [s0]; reach[s0] = 1;
    while (q.length) {
      const i = q.pop(); const c = i % cols, r = (i / cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dx, nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = nr * cols + nc;
        if (!reach[ni] && walk[ni]) { reach[ni] = 1; q.push(ni); }
      }
    }
  } else problems.push('kein begehbarer Start');
  const reachAt = (x, y) => { const c = Math.floor(x / C), r = Math.floor(y / C); return c >= 0 && r >= 0 && c < cols && r < rows && reach[r * cols + c] === 1; };
  /** Some reachable cell within `radius` of a point (or inside/near a polygon). */
  const reachNear = (x, y, radius, poly) => {
    for (let r = 0; r <= radius; r += 2) for (let a = 0; a < 24; a++) {
      const px = x + Math.cos((a / 24) * Math.PI * 2) * r, py = y + Math.sin((a / 24) * Math.PI * 2) * r;
      if (reachAt(px, py)) return true;
      if (r === 0) break;
    }
    if (poly) {
      const b = nav.polyBounds(poly);
      for (let py = b.y - radius; py <= b.y + b.h + radius; py += 2) for (let px = b.x - radius; px <= b.x + b.w + radius; px += 2) {
        if (reachAt(px, py) && nav.distToPoly(px, py, poly) <= radius) return true;
      }
    }
    return false;
  };
  const areaPoly = (o) => (o.poly ? o.poly : o.area ? (() => { const r = nav.areaPx(o.area); return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; })() : null);
  const anyReachIn = (poly) => {
    const b = nav.polyBounds(poly);
    for (let py = b.y; py <= b.y + b.h; py += 2) for (let px = b.x; px <= b.x + b.w; px += 2) if (nav.pointInPoly(px, py, poly) && reachAt(px, py)) return true;
    return false;
  };

  if (start) {
    for (const [n, p] of Object.entries(spawnPx)) if (walkable(p.x, p.y) && !reachAt(p.x, p.y)) problems.push(`Start '${n}' von '${start[0]}' aus nicht erreichbar`);
    const inter = [...(def.interactables ?? []), ...(def.props ?? []).filter(p => p.interact).map(p => ({ ...p.interact, id: p.interact.id ?? p.id ?? p.prop, at: p.at }))];
    for (const it of inter) {
      const b = it.poly ? nav.polyBounds(it.poly) : null;
      const p = it.at ? nav.toPx(it.at) : b ? { x: b.x + b.w / 2, y: b.y + b.h } : null;
      if (!p) { problems.push(`Objekt '${it.id}' ohne at/poly`); continue; }
      const radius = (it.radius ?? 18 * k) - 2;
      if (!reachNear(p.x, p.y, radius, it.poly)) problems.push(`Objekt '${it.id}' unerreichbar (Radius ${Math.round(radius)})`);
      if (it.standAt && Array.isArray(it.standAt)) { const sp = nav.toPx(it.standAt); if (!reachNear(sp.x, sp.y, 18 * k)) problems.push(`standAt von '${it.id}' unerreichbar`); }
    }
    for (const n of def.npcs ?? []) { const p = nav.toPx(n.at); if (!reachNear(p.x, p.y, 22 * k)) problems.push(`NPC '${n.id}' unerreichbar`); }
    for (const c of def.clues ?? []) { const p = nav.toPx(c.at); if (!reachNear(p.x, p.y, 16 * k)) problems.push(`Hinweis '${c.id}' unerreichbar`); }
    for (const t of def.triggers ?? []) { const p = areaPoly(t); if (p && !anyReachIn(p)) problems.push(`Trigger '${t.id}' nicht betretbar`); }
    for (const hs of def.hidingSpots ?? []) { const p = areaPoly(hs); if (p && !anyReachIn(p)) problems.push(`Versteck '${hs.id ?? '?'}' nicht betretbar`); }
    for (const e of def.exits ?? []) {
      if (e.door) { const d = nav.toPx(e.door.at); if (!reachNear(d.x, d.y, 20 * k)) problems.push(`Tür '${e.id}' unerreichbar`); }
      else { const p = areaPoly(e); if (p && !anyReachIn(p)) problems.push(`Ausgang '${e.id}' nicht betretbar/erreichbar`); }
      const to = maps.get(e.to);
      if (!to) problems.push(`Ausgang '${e.id}' zeigt auf unbekannte Karte '${e.to}'`);
      else if (e.spawn && !to.def.spawns?.[e.spawn]) problems.push(`Ausgang '${e.id}' zeigt auf fehlenden Start '${e.to}:${e.spawn}'`);
    }
    for (const g of def.guards ?? []) g.path.forEach((wp, i) => {
      const at = Array.isArray(wp) || !('at' in wp) ? wp : wp.at;
      const p = nav.toPx(at);
      if (!walkable(p.x, p.y)) problems.push(`Wache '${g.id}' Wegpunkt ${i} nicht begehbar`);
    });
  }
  // Exits of other maps that lead here must name an existing spawn.
  for (const [oid, o] of maps) for (const e of o.def.exits ?? []) {
    if (e.to === id && e.spawn && !def.spawns?.[e.spawn]) problems.push(`Ausgang ${oid}.${e.id} zeigt auf fehlenden Start '${e.spawn}'`);
  }

  const P = (at) => { const p = nav.toPx(at); return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]; };
  const report = {
    id, name: def.name ?? null, chapter: entry.chapter, size: [w, h], bg: bgFile, problems,
    reach: Buffer.from(reach).toString('base64'), walkMask: Buffer.from(walk).toString('base64'), cell: C, cols, rows,
    geometry: {
      walk: nav.normWalk(def), block: nav.normBlocks(def), occluders: nav.normOccluders(def), surfaces: def.surfaces ?? [],
      hiding: (def.hidingSpots ?? []).map(hs => ({ id: hs.id ?? null, kind: hs.kind ?? 'bush', poly: areaPoly(hs) })),
      triggers: (def.triggers ?? []).map(t => ({ id: t.id, poly: areaPoly(t) })),
      exits: (def.exits ?? []).map(e => ({ id: e.id, to: e.to, spawn: e.spawn ?? null, poly: areaPoly(e), door: e.door ? P(e.door.at) : null })),
      interactables: [...(def.interactables ?? []), ...(def.props ?? []).filter(p => p.interact).map(p => ({ ...p.interact, id: p.interact.id ?? p.id ?? p.prop, at: p.at }))]
        .map(it => ({ id: it.id, verb: it.verb ?? null, poly: it.poly ?? null, at: it.at ? P(it.at) : null, radius: it.radius ?? 18 * k, standAt: Array.isArray(it.standAt) ? P(it.standAt) : null })),
      spawns: Object.fromEntries(spawns.map(([n, s]) => [n, { at: P(s.at), dir: s.dir ?? 'down' }])),
      npcs: (def.npcs ?? []).map(n => ({ id: n.id, at: P(n.at) })),
      guards: (def.guards ?? []).map(g => ({ id: g.id, mode: g.mode ?? 'loop', path: g.path.map(wp => P(Array.isArray(wp) || !('at' in wp) ? wp : wp.at)) })),
      clues: (def.clues ?? []).map(c => ({ id: c.id, at: P(c.at) })),
      lights: (def.lights ?? []).map(l => ({ id: l.id ?? l.kind ?? null, at: P(l.at), radius: l.radius ?? 56 })),
      props: (def.props ?? []).map(p => ({ id: p.id ?? p.prop, at: P(p.at) })),
    },
  };
  const json = join(OUT, `${id}.json`);
  writeFileSync(json, JSON.stringify(report));
  if (render) {
    try { execFileSync('python3', [join(ROOT, 'scripts/map/overlay.py'), json, join(OUT, `${id}.png`)], { stdio: 'inherit' }); }
    catch { problems.push('Vorschau konnte nicht gerendert werden (python3 + Pillow nötig)'); }
  }
  console.log(`${problems.length ? '✗' : '✓'} ${id}${render ? ` → output/qa/maps/${id}.png` : ''}${problems.length ? '\n  - ' + problems.join('\n  - ') : ''}`);
  if (problems.length) failed = true;
}
process.exit(failed ? 1 : 0);
