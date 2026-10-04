import { GUIDES, currentGuide } from "../../app/walkthrough";
import type Phaser from 'phaser';
import { closeSettings, settingsAreOpen } from "../../app/settings";
import { DebugPause, FLAG_GROUPS, ITEMS, editFlag, editItem } from "../../app/debugState";
import { DEBUG_STARTUPS } from "../../app/sceneCatalog";
import { prepareCampaignCheckpoint } from "../../modules/campaign/checkpoints";
import { state } from "../../platform/campaignRegistry";
import type { WorldState } from "../../modules/campaign/state";
import type { ItemId } from "../../modules/inventory/catalog";

/** Public playtest tools; no saves, eval, network requests or hidden credentials. */
export function installDebugControls(game: Phaser.Game): () => void {
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'playtest-debug'; button.textContent = 'Debug';
  button.setAttribute('aria-label', 'Debug · Playtest'); button.title = 'Playtest-Menü · F2';
  const style = document.createElement('style');
  style.textContent = `#playtest-debug{position:fixed;right:max(8px,env(safe-area-inset-right));top:max(8px,env(safe-area-inset-top));z-index:1500;min-height:36px;padding:6px 12px;background:#14171b;color:#e8e2d0;border:1px solid #8a7a5a;font:16px var(--ui-font);cursor:pointer}
  #playtest-dialog{width:min(600px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;overscroll-behavior:contain;background:#14171b;color:#e8e2d0;border:2px solid #8a7a5a;padding:18px;font:16px/1.4 system-ui}
  #playtest-dialog summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:#e5cd86} #playtest-dialog details{margin:16px 0;border-block:1px solid #8a7a5a;padding:8px 0} #playtest-dialog #debug-guide{width:100%;min-width:0} #playtest-dialog label:has(#debug-guide){display:block} #debug-guide-content li{margin:12px 0;overflow-wrap:anywhere} #debug-guide-content ol{padding-left:24px}
  #playtest-dialog::backdrop{background:#070b0ae8} #playtest-dialog h2{margin-top:0} #playtest-dialog label{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;overflow-wrap:anywhere}
  #playtest-dialog :is(button,select,input[type=number]){min-height:44px;max-width:100%;padding:6px;font:inherit} #playtest-dialog input[type=number]{width:90px} #playtest-dialog input[type=checkbox]{width:24px;height:24px;flex:none} #playtest-dialog pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px} #playtest-dialog fieldset{margin:12px 0;border:1px solid #8a7a5a} #playtest-dialog :focus-visible,#playtest-debug:focus-visible{outline:3px solid #d6ad59;outline-offset:2px}`;
  const dialog = document.createElement('dialog'); dialog.id = 'playtest-dialog'; dialog.setAttribute('aria-labelledby', 'debug-heading');
  document.head.append(style); document.body.append(button, dialog);
  const pause = new DebugPause();
  const held = new Map<Phaser.Scene, () => void>();
  let keyboardEnabled = true;
  let draft: WorldState;
  let focus: HTMLElement | null = null;
  let stats: HTMLPreElement;
  let sceneKey = '';
  let sceneData: { map?: string } = {};
  const world = (): WorldState => state(game.registry);
  function suspend() {
    if (!dialog.open) return;
    for (const scene of game.scene.getScenes(true)) {
      if (held.has(scene)) continue;
      const shutdown = () => { pause.forget(scene); held.delete(scene); };
      held.set(scene, shutdown); scene.events.once('shutdown', shutdown);
      pause.hold(scene); game.scene.pause(scene.sys.settings.key);
    }
  }
  function close() {
    if (!dialog.open) return;
    dialog.close();
    game.input.keyboard!.enabled = keyboardEnabled;
    for (const [scene, shutdown] of held) {
      scene.events.off('shutdown', shutdown); pause.release(scene);
      if (game.scene.isPaused(scene.sys.settings.key)) game.scene.resume(scene.sys.settings.key);
    }
    held.clear(); focus?.focus();
  }
  function restart(key: string, data: { map?: string }) {
    const scenes = [...held.keys()];
    close();
    for (const scene of scenes) game.scene.stop(scene.sys.settings.key);
    game.scene.start(key, data);
  }
  function makeButton(text: string, action: () => void) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = text; el.addEventListener('click', action); return el;
  }
  function show() {
    if (dialog.open) { close(); return; }
    window.dispatchEvent(new Event('selantis:close-character'));
    if (settingsAreOpen()) closeSettings();
    const active = game.scene.getScenes(true).find(scene => !['boot', 'Settings'].includes(scene.sys.settings.key));
    if (!active) return;
    sceneKey = active.sys.settings.key;
    const scene = active as unknown as Record<string, any>;
    sceneData = sceneKey === 'world' ? { map: scene.map?.id ?? 'wiese' } : {};
    const st = world(); draft = { inv: { ...st.inv }, flags: { ...st.flags }, picked: { ...st.picked } };
    focus = document.activeElement as HTMLElement | null;
    dialog.replaceChildren();
    const heading = document.createElement('h2'); heading.id = 'debug-heading'; heading.textContent = 'Debug · Playtest';
    const warning = document.createElement('p'); warning.textContent = 'Achtung: Warps ersetzen Kapitel-Fortschritt und Reiseausrüstung. Flag-Edits dürfen absichtlich widersprüchlich sein. Anwenden startet die Szene neu; laufende Dialoge gehen verloren. Kein Spielstand wird gespeichert.';
    dialog.append(heading, makeButton('Schließen · Esc', close));
    const walkthrough = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = 'Walkthrough · Spoiler';
    const explanation = document.createElement('p'); explanation.textContent = 'Nur Anleitung: Lesen verändert weder Fortschritt noch Inventar. Enthält Lösungen und Kapitel-Spoiler. Zum Spielen das Debug-Menü schließen. In begehbaren Lia-Bereichen: WASD/Pfeile oder Ziel anklicken, nahe Ziele mit E benutzen; auf dem Handy Richtungstasten und benannte Aktion nutzen. Nahaufnahmen mit Weiter/Zurück fortsetzen.';
    const guides = document.createElement('select'); guides.id = 'debug-guide';
    const relevant = currentGuide({ scene: sceneKey, map: scene.map?.id, area: scene.area?.id, campStep: scene.campStep, beat: scene.beat });
    for (const guide of GUIDES) {
      const option = document.createElement('option'); option.value = guide.id; option.textContent = guide.title; guides.append(option);
    }
    guides.value = relevant?.id ?? GUIDES[0].id;
    const guideLabel = document.createElement('label'); guideLabel.htmlFor = guides.id; guideLabel.textContent = 'Walkthrough für'; guideLabel.append(guides);
    const content = document.createElement('section'); content.id = 'debug-guide-content'; content.setAttribute('aria-live', 'polite');
    const renderGuide = () => {
      const guide = GUIDES.find(entry => entry.id === guides.value)!;
      const title = document.createElement('h3'); title.textContent = `${guide.title} · ${guide.kind}`;
      const list = document.createElement('ol');
      for (const step of guide.steps) { const item = document.createElement('li'); item.textContent = step; list.append(item); }
      const end = document.createElement('p'); end.textContent = `Abschluss: ${guide.completion}`;
      content.replaceChildren(title, list, end);
    };
    guides.addEventListener('change', renderGuide);
    const current = makeButton('Aktueller Bereich', () => { if (relevant) { guides.value = relevant.id; renderGuide(); } });
    current.disabled = !relevant;
    walkthrough.append(summary, explanation, guideLabel, current, content); renderGuide();
    const cheatsHeading = document.createElement('h3'); cheatsHeading.textContent = 'Cheats · Fortschritt bearbeiten';
    dialog.append(walkthrough, cheatsHeading, warning);
    stats = document.createElement('pre'); stats.setAttribute('aria-label', 'Live-Stats'); dialog.append(stats);
    const select = document.createElement('select'); select.id = 'debug-warp';
    for (const [id, name] of DEBUG_STARTUPS) { const option = document.createElement('option'); option.value = id; option.textContent = name; select.append(option); }
    const label = document.createElement('label'); label.htmlFor = select.id; label.textContent = 'Einstieg'; label.append(select); dialog.append(label);
    dialog.append(makeButton('Zum Einstieg', () => { const target = prepareCampaignCheckpoint(world(), select.value); restart(target.scene, target.data); }));
    for (const [group, flags] of Object.entries(FLAG_GROUPS)) {
      const fieldset = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = group; fieldset.append(legend);
      for (const flag of flags) {
        const row = document.createElement('label'); row.textContent = flag;
        const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!draft.flags[flag];
        input.addEventListener('change', () => editFlag(draft, flag, input.checked)); row.append(input); fieldset.append(row);
      }
      dialog.append(fieldset);
    }
    const inventory = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = 'Inventar · Anzahl 0–999'; inventory.append(legend);
    const inputs: HTMLInputElement[] = [];
    for (const [id, name] of Object.entries(ITEMS)) {
      const row = document.createElement('label'); row.textContent = name;
      const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = '999'; input.step = '1'; input.required = true; input.value = String(draft.inv[id as ItemId] ?? 0);
      input.addEventListener('input', () => { const valid = input.value !== '' && editItem(draft, id, Number(input.value)); input.setCustomValidity(valid ? '' : 'Ganze Anzahl zwischen 0 und 999 eingeben.'); });
      row.append(input); inventory.append(row); inputs.push(input);
    }
    dialog.append(inventory, makeButton('Änderungen anwenden', () => {
      if (inputs.some(input => !input.reportValidity())) return;
      const current = world(); Object.assign(current.flags, draft.flags); Object.assign(current.inv, draft.inv);
      restart(sceneKey, sceneData);
    }));
    const confirmation = document.createElement('label'); confirmation.textContent = 'Fortschritt wirklich zurücksetzen';
    const confirm = document.createElement('input'); confirm.type = 'checkbox'; confirmation.append(confirm);
    const reset = makeButton('Alles zurücksetzen · Titel', () => {
      if (!confirm.checked) return;
      game.registry.remove('world'); game.registry.remove('party'); game.registry.remove('visited'); game.registry.remove('liaBookmark'); game.registry.remove('lastMagic'); restart('title', {});
    }); reset.disabled = true; confirm.addEventListener('change', () => { reset.disabled = !confirm.checked; }); dialog.append(confirmation, reset);
    keyboardEnabled = game.input.keyboard!.enabled;
    dialog.showModal(); suspend(); game.input.keyboard!.enabled = false; refresh();
    dialog.querySelector('button')?.focus();
  }
  function refresh() {
    if (!dialog.open) return;
    suspend();
    const lines: string[] = [];
    for (const active of held.keys()) {
      const s = active as unknown as Record<string, any>;
      const pos = s.lia ?? s.pos;
      lines.push(`Szene: ${active.sys.settings.key} · Bereich: ${s.map?.id ?? s.area?.id ?? '–'}`, `Position: ${Number.isFinite(pos?.x) ? pos.x.toFixed(1) + ', ' + pos.y.toFixed(1) : '–'}`, `Phase: ${s.phase ?? s.beat ?? '–'} · Schritt: ${s.campStep ?? s.step ?? s.beat ?? '–'}`, `Locks: busy=${!!s.busy}, locked=${!!s.locked}, cinematic=${!!s.cinematic}, leaving=${!!s.leaving} · Input: Debug-Pause`);
      if (Array.isArray(s.units)) for (const u of s.units) lines.push(`${u.id}: HP ${u.hp} · ${u.alive ? 'aktiv' : 'tot'} · Zelle ${u.cell.x},${u.cell.y}`);
      if (Array.isArray(s.units)) lines.push(`Bewegung verbraucht: ${!!s.moved} · AP-System: nicht vorhanden`);
    }
    lines.push(`Gesammelte Fundstellen: ${Object.keys(world().picked).length}`, `Besuchte Karten: ${Object.keys(game.registry.get('visited') ?? {}).join(', ') || '–'}`);
    stats.textContent = lines.join('\n');
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.code === 'F2' && !event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); show(); return; }
    if (dialog.open) {
      event.stopImmediatePropagation();
      if (event.code === 'Escape') { event.preventDefault(); close(); }
    }
  };
  const cancel = (event: Event) => { event.preventDefault(); close(); };
  dialog.addEventListener('cancel', cancel); button.addEventListener('click', show);
  window.addEventListener('keydown', keydown, true);
  const interval = window.setInterval(refresh, 200);
  game.events.on('prestep', suspend);
  const dispose = () => { close(); clearInterval(interval); window.removeEventListener('keydown', keydown, true); game.events.off('prestep', suspend); button.remove(); dialog.remove(); style.remove(); };
  game.events.once('destroy', dispose);
  return dispose;
}
