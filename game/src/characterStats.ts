import { assetUrl } from './assetUrl';
import type Phaser from 'phaser';
import type { ItemId } from './world/maps';
import type { WorldState } from './world/quests';
import { ITEM_NAMES } from './world/quests';
import { BEAM_DAMAGE, BEAM_LENGTH, MOVE_RANGE, WAVE_DAMAGE, WAVE_PUSH, WAVE_RANGE, type Unit } from './battle/grid';
import { createMobileDialog } from './mobileDialogs';
import { settingsAreOpen } from './settings';
import type { BattleSnapshot } from './battle/tactics';
import { availableParty, partyState, type PartyState } from './party';
import { itemIcon } from './itemPresentation';
import { resolvePartyUnitStats, type CombatStats } from './combatStats';

type View = 'party' | 'bag';
type DetailTab = 'values' | 'equipment' | 'abilities';
export type CharacterStatInput = {
  scene: string; units?: readonly Unit[]; moved?: boolean;
  inventory?: Partial<Record<ItemId, number>>; battle?: BattleSnapshot;
  flags?: WorldState['flags']; party?: PartyState; selected?: string;
};
export type CarriedItem = { id: ItemId; name: string; count: number };
export type CharacterSnapshot = {
  id: string; name: string; portrait: string; profile: string;
  stats: { label: string; value: string }[]; hp?: number; maxHp?: number;
  abilities: { name: string; key: string; description: string }[]; items: CarriedItem[];
};
const VALENTUS_SCENES = new Set(['battle', 'break', 'flight', 'refuge']);
const EQUIPMENT = new Set<ItemId>(['dolch', 'reisezeug']);
const PLAYABLE = new Set(['battle', 'break', 'flight', 'refuge', 'lia', 'world', 'raid', 'aftermath', 'journey', 'companions-road']);
export function carriedItems(inventory: CharacterStatInput['inventory'] = {}): CarriedItem[] {
  return (Object.keys(ITEM_NAMES) as ItemId[]).filter(id => Number.isFinite(inventory[id]) && (inventory[id] ?? 0) > 0)
    .map(id => ({ id, name: ITEM_NAMES[id], count: inventory[id]! }));
}
const MAGIC: CharacterSnapshot['abilities'] = [
  { name: 'Strahl', key: 'Q', description: `${BEAM_DAMAGE} Schaden · bis ${BEAM_LENGTH} Felder. Durchdringt Figuren, endet am Fels.` },
  { name: 'Druckwelle', key: 'R', description: `${WAVE_DAMAGE} Schaden · Reichweite ${WAVE_RANGE} Felder · Fläche 3 × 3. Stößt Feinde bis zu ${WAVE_PUSH} Felder zurück.` },
];
const NAMES: Record<string, string> = { valentus: 'Valentus', boy: 'Der Junge', falke: 'Falke', lia: 'Lia', foltan: 'Foltan', azar: 'Azar' };
const PORTRAITS: Record<string, string> = { valentus: 'valentus', boy: 'boy', falke: 'falke', lia: 'lia', foltan: 'foltan', azar: 'azar' };
function appendCombatStats(sheet: CharacterSnapshot, stats: CombatStats) {
  const fields = (count: number) => count === 1 ? '1 Feld' : `${count} Felder`;
  sheet.stats.push({ label: 'Bewegung', value: fields(stats.move) }, { label: 'Angriff', value: `${stats.attack}` },
    { label: 'Verteidigung', value: `${stats.defense}` }, { label: 'Tempo', value: `${stats.speed}` },
    { label: 'Reichweite', value: fields(stats.attackRange) });
  if (typeof stats.magicAttack === 'number') sheet.stats.push({ label: 'Magie', value: `${stats.magicAttack}` });
}
function battleCharacter(input: CharacterStatInput, unit: Unit): CharacterSnapshot {
  const live = input.battle?.units.find(entry => entry.id === unit.id);
  const sheet: CharacterSnapshot = { id: unit.id, name: NAMES[unit.kind] ?? unit.id,
    portrait: PORTRAITS[unit.kind] ?? 'valentus', profile: unit.side === 'valentus' ? 'Die Schlacht von Dunkelhain' : 'An deiner Seite',
    hp: Math.max(0, unit.hp), maxHp: live?.maxHp, stats: [], abilities: unit.kind === 'valentus' ? MAGIC : [], items: [] };
  sheet.stats.push({ label: 'Lebenspunkte', value: live ? `${sheet.hp} / ${live.maxHp} HP` : `${sheet.hp} HP` });
  if (live) appendCombatStats(sheet, live);
  else if (unit.kind === 'valentus') sheet.stats.push({ label: 'Bewegung', value: `${MOVE_RANGE} Felder` });
  if (unit.kind === 'valentus' && live?.magicAttack !== undefined) sheet.abilities = MAGIC.map(ability => ability.name === 'Strahl'
    ? { ...ability, description: ability.description.replace(`${BEAM_DAMAGE} Schaden`, `${live.magicAttack} Schaden`) } : ability);
  if (unit.kind === 'valentus') {
    const moved = input.battle?.moved ?? input.moved;
    if (typeof moved === 'boolean') sheet.stats.push({ label: 'Bewegung im Zug', value: moved ? 'Bereits bewegt' : 'Noch verfügbar' });
    if (input.battle) sheet.stats.push({ label: 'Aktion im Zug', value: input.battle.acted ? 'Bereits ausgeführt' : 'Noch verfügbar' },
      { label: 'Blickrichtung', value: ({ n: 'Norden', e: 'Osten', s: 'Süden', w: 'Westen' })[input.battle.facing] },
      { label: 'Deckung', value: input.battle.guarding ? 'Verstärkt' : 'Normal' });
  }
  return sheet;
}
/** Membership follows the actual encounter; friendly battle health always comes from live units. */
export function partyRoster(input: CharacterStatInput): CharacterSnapshot[] {
  if (input.scene === 'battle') return (input.battle?.units ?? input.units ?? [])
    .filter(unit => unit.alive && unit.side !== 'enemy').map(unit => battleCharacter(input, unit));
  if (VALENTUS_SCENES.has(input.scene)) return [{ id: 'valentus', name: 'Valentus',
    portrait: input.scene === 'flight' || input.scene === 'break' ? 'valentus-wounded' : 'valentus',
    profile: ({ break: 'Verwundet', flight: 'Auf der Flucht', refuge: 'In der Zuflucht' })[input.scene] ?? 'In Dunkelhain',
    stats: input.scene === 'break' || input.scene === 'flight' ? [{ label: 'Zustand', value: 'Verwundet' }] : [],
    abilities: input.scene === 'flight' ? [{ name: 'Strahl', key: 'Q', description: 'Blaue Magie auf der Flucht.' }, { name: 'Druckwelle', key: 'R', description: 'Blaue Magie auf der Flucht.' }] : [], items: [] }];
  return availableParty(input.flags).map(id => {
    const member = input.party?.members[id];
    const sheet: CharacterSnapshot = { id, name: NAMES[id], portrait: PORTRAITS[id], profile: id === 'lia'
      ? ({ lia: 'Mit Kyra am Bach', world: 'Auf dem Heimweg', raid: 'Am Hof', aftermath: 'Vorbereitung auf die Reise', journey: 'Auf der Reise', 'companions-road': 'Mit Foltan und Azar im Wald' })[input.scene] ?? 'Unterwegs'
      : 'Mit Lia unterwegs', stats: [], abilities: [], items: id === 'lia' ? carriedItems(input.inventory) : [] };
    if (member) {
      sheet.hp = member.hp; sheet.maxHp = member.maxHp; sheet.stats.push({ label: 'Lebenspunkte', value: `${member.hp} / ${member.maxHp} HP` });
      appendCombatStats(sheet, resolvePartyUnitStats(member));
    }
    if (id === 'lia' && input.scene === 'journey') sheet.stats.push({ label: 'Nachtlager', value: input.flags?.firstCampRested ? 'Ausgeruht' : 'Noch keine Nachtruhe' });
    return sheet;
  });
}
export function characterSnapshot(input: CharacterStatInput): CharacterSnapshot {
  const roster = partyRoster(input);
  return roster.find(member => member.id === input.selected) ?? roster[0] ?? { id: 'valentus', name: 'Valentus', portrait: 'valentus', profile: 'Die Schlacht von Dunkelhain', stats: [], abilities: [], items: [] };
}

type PauseScene = { input: { enabled: boolean; keyboard?: { enabled: boolean; resetKeys(): unknown } | null } };
export class CharacterInputPause {
  private held = new Map<PauseScene, { input: boolean; keyboard?: boolean }>();
  hold(scene: PauseScene) {
    if (this.held.has(scene)) return;
    this.held.set(scene, { input: scene.input.enabled, keyboard: scene.input.keyboard?.enabled });
    scene.input.keyboard?.resetKeys(); scene.input.enabled = false;
    if (scene.input.keyboard) scene.input.keyboard.enabled = false;
  }
  release(scene: PauseScene) {
    const state = this.held.get(scene); if (!state) return;
    this.held.delete(scene); scene.input.keyboard?.resetKeys(); scene.input.enabled = state.input;
    if (scene.input.keyboard && state.keyboard !== undefined) scene.input.keyboard.enabled = state.keyboard;
  }
  forget(scene: PauseScene) { this.held.delete(scene); }
}
let controls: { game: Phaser.Game; open(view: View, onClose?: () => void, selected?: string): boolean; close(): void } | undefined;
export function openCharacterStats(game: Phaser.Game, selected?: string): boolean { return controls?.game === game ? controls.open('party', undefined, selected) : false; }
export function openBag(game: Phaser.Game, onClose?: () => void): boolean { return controls?.game === game ? controls.open('bag', onClose) : false; }
export function closeCharacterStats() { controls?.close(); }

/** Global keyboard shortcuts obey the same cinematic lock as the visible bag. */
export function characterViewAllowed(hudVisible: unknown, inventoryAvailable: unknown): boolean {
  return hudVisible !== false && inventoryAvailable !== false;
}

/** The top-left portrait and the bag have separate destinations and share only pause ownership. */
export function installCharacterStatsControls(game: Phaser.Game): () => void {
  const button = document.createElement('button'); button.type = 'button'; button.id = 'character-stats-button';
  button.className = 'party-portrait-control'; button.title = 'Gruppe ansehen · C'; button.setAttribute('aria-label', 'Gruppe ansehen · C');
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
  const face = document.createElement('img'); face.alt = ''; button.append(face); document.body.append(button);
  const pause = new CharacterInputPause(); const held = new Map<Phaser.Scene, () => void>();
  let modal: ReturnType<typeof createMobileDialog> | undefined, source: Phaser.Scene | undefined;
  let view: View = 'party', detail: DetailTab = 'values', selected = 'lia';
  let focus: HTMLElement | null = null, keyboardEnabled = true, onDismiss: (() => void) | undefined;
  const active = () => game.scene.getScenes(true).find(scene => PLAYABLE.has(scene.sys.settings.key));
  function suspend() {
    if (!modal) return;
    for (const scene of game.scene.getScenes(true)) {
      if (held.has(scene) || scene.sys.settings.key === 'Settings') continue;
      const shutdown = () => { pause.forget(scene); held.delete(scene); if (scene === source) close(); };
      held.set(scene, shutdown); scene.events.once('shutdown', shutdown); pause.hold(scene); game.scene.pause(scene.sys.settings.key);
    }
  }
  function close() {
    if (!modal) return;
    const closed = modal; modal = undefined; closed.destroy();
    if (view === 'bag') source?.events.emit('character-bag-close');
    if (game.input.keyboard) game.input.keyboard.enabled = keyboardEnabled;
    for (const [scene, shutdown] of held) {
      scene.events.off('shutdown', shutdown);
      if (game.scene.getScene(scene.sys.settings.key) === scene && game.scene.isPaused(scene.sys.settings.key)) { pause.release(scene); game.scene.resume(scene.sys.settings.key); }
      else pause.forget(scene);
    }
    held.clear(); source = undefined; button.setAttribute('aria-expanded', 'false');
    const dismissed = onDismiss; onDismiss = undefined; dismissed?.();
    if (focus?.isConnected) focus.focus({ preventScroll: true });
  }
  function input(): CharacterStatInput {
    const world = game.registry.get('world') as WorldState | undefined;
    const battle = source?.sys.settings.key === 'battle' ? game.registry.get('battle:state') as BattleSnapshot | undefined : undefined;
    return { scene: source!.sys.settings.key, battle, inventory: world?.inv, flags: world?.flags, party: partyState(game.registry, world?.flags), selected };
  }
  function tabs() {
    const entries: [DetailTab, string][] = [['values', 'Werte'], ['equipment', 'Ausrüstung'], ['abilities', 'Fähigkeiten']];
    const group = document.createElement('div'); group.className = 'character-details'; group.setAttribute('role', 'tablist'); group.setAttribute('aria-label', 'Charakterdetails');
    entries.forEach(([id, label]) => {
      const entry = document.createElement('button'); entry.type = 'button'; entry.textContent = label; entry.id = `character-tab-${id}`;
      entry.setAttribute('role', 'tab'); entry.setAttribute('aria-selected', String(id === detail)); entry.setAttribute('aria-controls', 'character-panel-character-details'); entry.tabIndex = id === detail ? 0 : -1;
      entry.addEventListener('click', () => { detail = id; render(); document.getElementById(entry.id)?.focus(); });
      entry.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const index = entries.findIndex(([value]) => value === id);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + entries.length) % entries.length;
        detail = entries[next][0]; render(); document.getElementById(`character-tab-${detail}`)?.focus();
      }); group.append(entry);
    }); return group;
  }
  function itemList(items: CarriedItem[], empty: string, bag = false) {
    if (!items.length) { const text = document.createElement('p'); text.className = 'bag-empty'; text.textContent = empty; return text; }
    const list = document.createElement('ul'); list.className = bag ? 'bag-items' : 'equipment-items';
    for (const item of items) {
      const row = document.createElement('li'); row.dataset.item = item.id;
      const name = document.createElement('span'); name.className = 'bag-item-name'; name.textContent = item.name;
      const count = document.createElement('span'); count.className = 'bag-item-count'; count.textContent = `× ${item.count}`;
      if (bag) {
        const inventory = source?.data.get('mobile:inventory') as { selected?: ItemId; actions?: { item: ItemId; label: string }[] } | undefined;
        const select = document.createElement('button'); select.type = 'button'; select.className = 'bag-item-select';
        select.setAttribute('aria-label', `${item.name} auswählen`); select.setAttribute('aria-pressed', String(inventory?.selected === item.id));
        select.append(itemIcon(item.id), name, count);
        select.addEventListener('click', () => { source?.events.emit('inventory-item-select', item.id); render();
          document.querySelector<HTMLElement>(`#bag-dialog [data-item="${item.id}"]`)?.scrollIntoView({ block: 'nearest' });
          (document.querySelector<HTMLButtonElement>(`[data-item="${item.id}"] .bag-item-use`) ??
            document.querySelector<HTMLButtonElement>(`[data-item="${item.id}"] .bag-item-select`))?.focus({ preventScroll: true }); });
        row.append(select);
        const action = inventory?.actions?.find(action => action.item === item.id);
        if (action && inventory?.selected === item.id) {
          const use = document.createElement('button'); use.type = 'button'; use.className = 'bag-item-use'; use.textContent = action.label;
          use.setAttribute('aria-label', `${item.name}: ${action.label}`);
          use.addEventListener('click', () => { source?.events.emit('inventory-item-use', item.id); if (modal) render(); }); row.append(use);
        }
      } else row.append(itemIcon(item.id), name, count);
      list.append(row);
    } return list;
  }
  function render() {
    if (!modal || !source) return;
    const data = input(), content = modal.content; content.replaceChildren();
    if (view === 'bag') {
      const instruction = source.data.get('mobile:inventory')?.instruction as string | undefined;
      if (instruction) { const hint = document.createElement('p'); hint.className = 'bag-instruction'; hint.textContent = instruction; content.append(hint); }
      const interior = document.createElement('section'); interior.className = 'open-bag-interior'; interior.setAttribute('aria-label', 'Inhalt der Tasche');
      const art = document.createElement('img'); art.className = 'bag-artwork'; art.alt = ''; art.src = assetUrl('/assets/ui/bag-open.png');
      art.addEventListener('load', () => { interior.dataset.art = 'true'; }); art.addEventListener('error', () => { art.hidden = true; });
      interior.append(art);
      interior.append(itemList(VALENTUS_SCENES.has(data.scene) ? [] : carriedItems(data.inventory), 'Deine Tasche ist noch leer.', true)); content.append(interior); return;
    }
    const roster = partyRoster(data); const sheet = roster.find(member => member.id === selected) ?? roster[0];
    if (!sheet) { const empty = document.createElement('p'); empty.textContent = 'Gerade ist niemand in deiner Gruppe.'; content.append(empty); return; }
    selected = sheet.id;
    const layout = document.createElement('div'); layout.className = 'party-layout';
    const members = document.createElement('div'); members.className = 'party-roster'; members.setAttribute('role', 'group'); members.setAttribute('aria-label', 'Gruppenmitglieder');
    for (const member of roster) {
      const choice = document.createElement('button'); choice.type = 'button'; choice.dataset.partyMember = member.id; choice.setAttribute('aria-pressed', String(member.id === selected)); choice.setAttribute('aria-label', `${member.name} ansehen`);
      const portrait = portraitImage(member);
      const name = document.createElement('span'); name.textContent = member.name;
      choice.append(portrait, name); choice.addEventListener('click', () => { selected = member.id; render(); document.querySelector<HTMLButtonElement>(`[data-party-member="${member.id}"]`)?.focus(); }); members.append(choice);
    }
    const panel = document.createElement('section'); panel.className = 'party-member-panel'; panel.dataset.selectedMember = sheet.id;
    const profile = document.createElement('div'); profile.className = 'character-profile';
    const portrait = portraitImage(sheet);
    const identity = document.createElement('div'); const name = document.createElement('h3'); name.textContent = sheet.name;
    const description = document.createElement('p'); description.textContent = sheet.profile; identity.append(name, description); profile.append(portrait, identity); panel.append(profile, tabs());
    const details = document.createElement('section'); details.id = 'character-panel-character-details'; details.setAttribute('role', 'tabpanel'); details.setAttribute('aria-labelledby', `character-tab-${detail}`); details.tabIndex = 0; panel.append(details);
    if (detail === 'values') {
      const list = document.createElement('dl');
      for (const stat of sheet.stats) { const label = document.createElement('dt'); label.textContent = stat.label; const value = document.createElement('dd'); value.textContent = stat.value; list.append(label, value); }
      if (!sheet.stats.length) { const empty = document.createElement('p'); empty.textContent = 'Zurzeit sind keine Werte verfügbar.'; details.append(empty); } else details.append(list);
    } else if (detail === 'equipment') details.append(itemList(sheet.items.filter(item => EQUIPMENT.has(item.id)), 'Keine mitgeführte Ausrüstung.'));
    else if (!sheet.abilities.length) { const empty = document.createElement('p'); empty.textContent = 'Noch keine Kampffähigkeiten.'; details.append(empty); }
    else {
      const list = document.createElement('ul');
      for (const ability of sheet.abilities) {
        const row = document.createElement('li'); row.className = 'character-ability'; const name = document.createElement('span'); name.textContent = ability.name;
        const key = document.createElement('kbd'); key.textContent = ability.key; const description = document.createElement('p'); description.textContent = ability.description;
        row.append(name, key, description); list.append(row);
      } details.append(list);
    }
    layout.append(members, panel); content.append(layout);
  }
  function portraitImage(member: CharacterSnapshot) {
    if (member.portrait === 'falke') {
      const sprite = document.createElement('span'); sprite.className = 'sprite-portrait'; sprite.setAttribute('role', 'img'); sprite.setAttribute('aria-label', member.name);
      sprite.style.backgroundImage = `url("${assetUrl('/assets/sprites/falke.png')}")`; sprite.style.backgroundSize = '400% 300%'; sprite.style.backgroundPosition = '0 100%';
      return sprite;
    }
    const image = document.createElement('img'); image.src = assetUrl(`/assets/portraits/${member.portrait}.png`); image.alt = `Porträt von ${member.name}`; return image;
  }
  function open(nextView: View, callback?: () => void, member?: string) {
    if (modal) { const same = view === nextView && !member; close(); if (same && !callback) return true; }
    if (settingsAreOpen() || document.querySelector('dialog[open]')) return false;
    source = active(); if (!source || !characterViewAllowed(source.data.get('mobile:hudVisible'), source.data.get('mobile:inventory')?.available)) return false;
    focus = document.activeElement as HTMLElement | null; view = nextView; detail = 'values'; selected = member ?? 'lia'; onDismiss = callback;
    source.events.emit('character-open'); keyboardEnabled = game.input.keyboard?.enabled ?? true;
    modal = createMobileDialog(view === 'bag' ? 'Tasche' : 'Gruppe', close);
    modal.content.closest('dialog')!.id = view === 'bag' ? 'bag-dialog' : 'character-dialog';
    if (view === 'bag') source.events.emit('character-bag-open');
    button.setAttribute('aria-expanded', String(view === 'party')); render(); suspend(); if (game.input.keyboard) game.input.keyboard.enabled = false; return true;
  }
  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const editable = target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '');
    if ((event.code === 'KeyC' || event.code === 'KeyI') && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !editable) {
      event.preventDefault(); event.stopImmediatePropagation(); open(event.code === 'KeyI' ? 'bag' : 'party');
    } else if (modal) {
      if (event.code === 'F2' || event.code === 'KeyO') { close(); return; }
      if (!['Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Space'].includes(event.code)) event.stopImmediatePropagation();
      if (event.code === 'Escape') { event.preventDefault(); close(); }
    }
  };
  const click = () => open('party'); button.addEventListener('click', click); window.addEventListener('keydown', keydown, true); window.addEventListener('selantis:close-character', close);
  function update() {
    suspend(); const scene = source ?? active();
    if (scene && !VALENTUS_SCENES.has(scene.sys.settings.key)) {
      const world = game.registry.get('world') as WorldState | undefined; partyState(game.registry, world?.flags);
    }
    const key = scene?.data.get('mobile:portrait') as string | undefined;
    const portrait = key?.replace(/^portrait-/, '') ?? (VALENTUS_SCENES.has(scene?.sys.settings.key ?? '') ? 'valentus' : 'lia');
    if (face.dataset.portrait !== portrait) { face.src = assetUrl(`/assets/portraits/${portrait}.png`); face.dataset.portrait = portrait; }
    button.hidden = !scene || scene.data.get('mobile:hudVisible') === false || !scene.data.get('mobile:name');
    button.disabled = settingsAreOpen() || !!document.querySelector('#playtest-dialog[open]');
    if (game.canvas) {
      const bounds = game.canvas.getBoundingClientRect(), scale = bounds.width / 640;
      const size = Math.max(44, 52 * scale);
      button.style.left = `${bounds.left + 6 * scale}px`; button.style.top = `${bounds.top + 6 * scale}px`;
      button.style.width = `${size}px`; button.style.height = `${size}px`;
    }
  }
  game.events.on('prestep', update); controls = { game, open, close };
  const dispose = () => { close(); window.removeEventListener('keydown', keydown, true); window.removeEventListener('selantis:close-character', close);
    game.events.off('prestep', update); button.removeEventListener('click', click); button.remove(); if (controls?.game === game) controls = undefined; };
  game.events.once('destroy', dispose); update(); return dispose;
}
