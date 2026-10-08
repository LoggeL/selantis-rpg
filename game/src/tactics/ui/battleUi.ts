import { G } from '../../core/G';
import { settings } from '../../core/settings';
import { GAME_H, GAME_W, canvasRect } from '../../core/viewport';
import type { BattleUnitDef, HintOptions } from '../api';
import type { AbilityDef, Facing, Phase, TargetPreview, Unit } from '../rules/types';
import { ICONS, abilityIcon } from './icons';
import { TACTICS_CSS } from './style';
import { AP_TO_MASTER, EXP_PER_LEVEL, MAX_LEVEL, WEAPONS } from '../rules/progression';
import { STANDARD_ABILITIES } from '../rules/abilities';
import { HIT_BASE, isPhysical } from '../rules/battle';

export interface UiHandlers {
  endTurn(): void;
  undo(): void;
  wait(): void;
  moveMode(): void;
  actMenu(): void;
  ability(id: string): void;
  rotate(dir: 1 | -1): void;
  selectUnit(id: string): void;
  /** Hovering an ability button previews its range. */
  hoverAbility(id: string | null): void;
  equip(weapon: string): void;
  back(): void;
  confirmTarget(): void;
  face(facing: Facing): void;
  confirmFacing(): void;
  /** Pages the forecast to the previous (-1) or next (1) affected unit. */
  focusTarget(dir: 1 | -1): void;
}

/**
 * One entry under „Aktion“. `attack` marks the basic attack (listed first, hotkey 0); `key` is the hotkey label,
 * for specials the digit of the ability's index in `Unit.abilities`.
 */
export interface AbilitySlot { def: AbilityDef; cooldown: number; usable: boolean; reason?: string; mastered?: boolean; attack?: boolean; key?: string }

export interface CardModel {
  unit: Unit;
  def: BattleUnitDef;
  abilities: AbilitySlot[];
  selected?: string | null;
  canAct: boolean;
  canMove: boolean;
  controllable: boolean;
}

export interface PreviewModel {
  ability: AbilityDef;
  user: Unit;
  userDef?: BattleUnitDef;
  targets: { unit: Unit; def: BattleUnitDef; p: TargetPreview }[];
  /** Line ability with no unit in it, etc. */
  empty?: string;
  /** The player has clicked a target and can now confirm the action. */
  confirmed?: boolean;
  /** Index of the affected unit shown in detail (the pager „‹ 1/3 ›“ flips through `targets`). */
  focus?: number;
}

export interface FacingModel {
  name: string;
  selected: Facing;
  options: { facing: Facing; arrow: string; label: string }[];
}

export interface MenuModel {
  x: number;
  y: number;
  canMove: boolean;
  canAct: boolean;
  canUndo: boolean;
  moveOn: boolean;
  actOpen: boolean;
  abilities: AbilitySlot[];
  selected?: string | null;
  targeting?: boolean;
  /** Canvas points (other units) the menu should not cover. */
  avoid?: { x: number; y: number }[];
}

const STATUS_LABEL: Record<string, string> = {
  guarded: 'Schutzwall', stunned: 'Betäubt', taunt: 'Lenkt ab', evasive: 'Weicht aus', bound: 'Gefesselt', burning: 'Brennt',
};
const PHASE_LABEL: Record<Phase, string> = { player: 'Deine Runde', enemy: 'Feindliche Runde', ally: 'Verbündete' };

const crestCache = new Map<string, string>();
/** Fallback crest when no pixel portrait exists: a small heraldic shield per team. */
export function crest(team: Unit['team'], seed = ''): string {
  const key = `${team}:${seed}`;
  const hit = crestCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0e131d'; g.fillRect(0, 0, 32, 32);
  const shield = () => { g.beginPath(); g.moveTo(7, 6); g.lineTo(25, 6); g.lineTo(25, 16); g.quadraticCurveTo(25, 24, 16, 27); g.quadraticCurveTo(7, 24, 7, 16); g.closePath(); };
  shield();
  g.save(); g.clip();
  if (team === 'enemy') {
    g.fillStyle = '#e6e6ea'; g.fillRect(7, 6, 18, 22);
    g.fillStyle = '#18161e'; g.fillRect(7, 6, 9, 10); g.fillRect(16, 16, 9, 12);
  } else if (team === 'ally') {
    g.fillStyle = '#2f5a3a'; g.fillRect(7, 6, 18, 22);
    g.fillStyle = '#c9a25a'; g.fillRect(15, 6, 2, 22);
  } else {
    g.fillStyle = '#2a4288'; g.fillRect(7, 6, 18, 22);
    g.fillStyle = '#f0f2f6';
    // white raptor
    g.fillRect(11, 13, 10, 2); g.fillRect(13, 15, 6, 2); g.fillRect(15, 11, 2, 9); g.fillRect(10, 12, 2, 1); g.fillRect(20, 12, 2, 1);
  }
  g.restore();
  shield(); g.strokeStyle = '#d8b25a'; g.lineWidth = 1.2; g.stroke();
  const url = c.toDataURL();
  crestCache.set(key, url);
  return url;
}

export function portraitFor(def: BattleUnitDef | undefined, unit: Unit): string {
  const id = def?.portrait ?? def?.preset;
  try {
    if (id && G.art.portraitIds().includes(id)) {
      const mood = unit.down ? 'hurt' : unit.hp / unit.maxHp < 0.35 ? 'hurt' : unit.team === 'enemy' ? 'angry' : 'determined';
      return G.art.portrait(id, mood);
    }
  } catch { /* fall back */ }
  return crest(unit.team, unit.id);
}

const RELATION_TEXT = { front: 'Vorne', side: 'Seite', back: 'Rücken' } as const;
/** Button label of an action: the basic attack reads „Angriff“, plus the weapon move's own name. */
export const slotLabel = (a: AbilitySlot) => a.attack && a.def.name !== 'Angriff' ? `Angriff · ${a.def.name}` : a.attack ? 'Angriff' : a.def.name;

const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const pct = (x: number, total: number) => `${(x / total) * 100}%`;

function resources(u: Unit, afterHp?: number, afterMp?: number): string {
  const row = (label: string, value: number, max: number, cls: string, after?: number) => {
    const remaining = after ?? value;
    const width = max > 0 ? remaining / max * 100 : 0;
    const ghost = max > 0 ? Math.max(0, value - remaining) / max * 100 : 0;
    return `<div class="tac-hp ${cls}"><span class="resource-label">${label}</span><div class="bar"><b class="${label === 'HP' && u.team === 'enemy' ? 'foe' : ''}" style="width:${width}%"></b>${ghost ? `<s style="left:${width}%;width:${ghost}%"></s>` : ''}</div><span class="num">${value}${after !== undefined && after !== value ? ` → ${after}` : ''} / ${max}</span></div>`;
  };
  return `${row('HP', u.hp, u.maxHp, '', afterHp)}${row('MP', u.mp, u.maxMp, 'tac-mp', afterMp)}<div class="tac-growth"><span>Lvl <b>${u.level}</b></span><span>Exp <b>${u.level === MAX_LEVEL ? 'MAX' : `${u.exp} / ${EXP_PER_LEVEL}`}</b></span><span>Tempo <b>${u.speed}</b></span></div><div class="tac-expbar" aria-label="Erfahrung"><b style="width:${u.level === MAX_LEVEL ? 100 : u.exp}%"></b></div>`;
}

function combatant(u: Unit, def?: BattleUnitDef, hp?: number, mp?: number): string {
  return `<div class="tac-combatant ${u.team}"><div class="hd"><div class="por"><img alt="" src="${portraitFor(def, u)}"></div><div><div class="nm">${esc(u.name)}</div><div class="ab">${esc(def?.title ?? (u.team === 'enemy' ? 'Feind' : 'Verbündet'))}</div></div></div>${resources(u, hp, mp)}<div class="tac-weapon-name">${u.weapon ? esc(WEAPONS[u.weapon].name) : 'Ohne Waffe'}</div></div>`;
}

function shapeText(a: AbilityDef): string {
  switch (a.shape.type) {
    case 'line': return `Linie, ${a.shape.length} Felder`;
    case 'ring': return 'Alle Nachbarfelder';
    case 'cone': return `Kegel, ${a.shape.length} Felder`;
    case 'area': return `Fläche, Radius ${a.shape.radius}`;
    case 'self': return 'Selbst';
    default: return a.target === 'ally' ? 'Verbündeter' : a.target === 'bound' ? 'Gefangene' : 'Einzelziel';
  }
}
function rangeText(a: AbilityDef): string {
  if (a.shape.type === 'self' || a.shape.type === 'ring' || a.target === 'self') return '';
  if (a.shape.type === 'line') return '';
  const [lo, hi] = a.range;
  return lo === hi ? `Reichweite ${hi}` : `Reichweite ${lo}–${hi}${a.heightRange ? ' (+Höhe)' : ''}`;
}

export class BattleUi {
  readonly root: HTMLDivElement;
  private style: HTMLStyleElement;
  private els: Record<string, HTMLElement> = {};
  private resizeObs: () => void;
  private canvasObserver: ResizeObserver | null = null;
  private hintResolve: (() => void) | null = null;
  private outcomeResolve: ((v: 'retry' | 'continue') => void) | null = null;
  private lastCard = '';
  private lastMenu = '';
  private lastPreview = '';
  private lastFacing = '';
  private lastOrder = '';
  private tipBlockedAbility: string | null = null;
  private dismissTip = (event: Event) => {
    this.hideTip();
    this.tipBlockedAbility = event.type === 'pointerdown' && event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('button[data-ab]')?.dataset.ab ?? null : null;
  };

  constructor(private h: UiHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'tac';
    this.style = document.createElement('style');
    this.style.textContent = TACTICS_CSS;
    const mk = (name: string, cls: string, html = '') => {
      const e = document.createElement('div');
      e.className = cls;
      e.innerHTML = html;
      this.root.appendChild(e);
      this.els[name] = e;
      return e;
    };
    mk('obj', 'tac-panel tac-obj', '<div class="lbl">Ziel</div><div class="txt"></div><div class="det"></div><div class="prog"></div>');
    mk('phase', 'tac-panel tac-phase hidden-init');
    mk('order', 'tac-order');
    const rot = mk('rot', 'tac-rot', `<button type="button" data-r="-1" title="Ansicht drehen (Q)" aria-label="Ansicht nach links drehen">${ICONS.rotL}</button><button type="button" data-r="1" title="Ansicht drehen (R)" aria-label="Ansicht nach rechts drehen">${ICONS.rotR}</button>`);
    rot.querySelectorAll('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); this.h.rotate(Number((b as HTMLElement).dataset.r) as 1 | -1); }));
    mk('card', 'tac-panel tac-card hidden');
    mk('tcard', 'tac-panel tac-tcard hidden');
    mk('facing', 'tac-panel tac-facing hidden');
    mk('tile', 'tac-panel tac-tile hidden');
    const end = mk('end', 'tac-end', `<button type="button" class="tac-btn tac-endturn" title="Zug beenden (Leertaste)"><span class="hg">${ICONS.hourglass}</span>Zug beenden <kbd>Leertaste</kbd></button>`);
    end.querySelector('button')!.addEventListener('click', e => { e.stopPropagation(); this.h.endTurn(); });
    mk('menu', 'tac-panel tac-menu hidden');
    mk('tip', 'tac-panel tac-tip hidden');
    mk('banner', 'tac-banner', '<div class="rib"></div><div class="sub"></div>');
    mk('title', 'tac-title', '<div class="pre">Taktischer Kampf</div><div class="t"></div><div class="line"></div><div class="s"></div>');
    mk('plate', 'tac-panel tac-plate');
    mk('floats', 'tac-floats');
    mk('hint', 'tac-panel tac-hint hidden');
    mk('out', 'tac-out', '<div class="t"></div><div class="line"></div><div class="s"></div><div class="btns"></div>');
    this.els.phase.style.display = 'none';
    // Swallow pointer events on panels so clicks don't reach the canvas.
    for (const k of ['obj', 'card', 'tcard', 'facing', 'menu', 'end', 'rot', 'hint', 'order', 'out']) {
      this.els[k].addEventListener('pointerdown', e => e.stopPropagation());
      this.els[k].addEventListener('wheel', e => e.stopPropagation());
    }
    this.resizeObs = () => this.layout();
  }

  mount(host: HTMLElement): void {
    host.appendChild(this.style);
    host.appendChild(this.root);
    window.addEventListener('resize', this.resizeObs);
    document.addEventListener('pointerdown', this.dismissTip, true);
    window.addEventListener('keydown', this.dismissTip, true);
    // Phaser resizes its canvas after the window event; observe the final canvas dimensions.
    const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
    if (canvas) {
      this.canvasObserver = new ResizeObserver(() => this.layout());
      this.canvasObserver.observe(canvas);
    }
    this.layout();
    requestAnimationFrame(() => this.layout());
  }

  destroy(): void {
    window.removeEventListener('resize', this.resizeObs);
    document.removeEventListener('pointerdown', this.dismissTip, true);
    window.removeEventListener('keydown', this.dismissTip, true);
    this.canvasObserver?.disconnect();
    this.root.remove();
    this.style.remove();
    this.hintResolve?.();
  }

  layout(): void {
    const r = canvasRect();
    if (!r) return;
    const s = this.root.style;
    s.left = `${r.left}px`; s.top = `${r.top}px`; s.width = `${r.width}px`; s.height = `${r.height}px`;
    const fs = Math.max(10, Math.min(20, r.width / 78));
    s.setProperty('--fs', `${fs}px`);
    this.root.classList.toggle('compact', r.width < 900);
    this.root.classList.toggle('reduced', settings.reducedMotion);
    this.layoutChrome();
  }

  /** Reserve space for the actual HUD controls, including Escape outside the battle layer. */
  private layoutChrome(): void {
    const r = this.root.getBoundingClientRect();
    if (!r.width) return;
    const menuButton = document.querySelector<HTMLElement>('.hud-btn-menu');
    const escape = menuButton?.getBoundingClientRect();
    const keyBottom = menuButton?.querySelector('.hud-btn-key')?.getBoundingClientRect().bottom ?? 0;
    const escapeInField = escape && escape.bottom > r.top && escape.top < r.bottom;
    const controlsTop = escapeInField ? Math.max(escape.bottom, keyBottom) - r.top + 8 : 8;
    this.root.style.setProperty('--tac-controls-top', `${controlsTop}px`);
    this.root.style.setProperty('--tac-target-top', `${controlsTop + this.els.rot.getBoundingClientRect().height + 8}px`);
    const phase = this.els.phase.getBoundingClientRect();
    if (phase.height) this.els.order.style.top = `${phase.bottom - r.top + 6}px`;
    const header = Math.max(...['obj', 'phase', 'order'].map(k => this.els[k].getBoundingClientRect().bottom - r.top), 0) + 12;
    this.root.style.setProperty('--tac-header', `${header}px`);
    this.root.style.setProperty('--tac-footer', `${this.els.end.getBoundingClientRect().height + 16}px`);
    this.els.hint.style.top = `${header}px`;
  }

  private occupied(exclude?: HTMLElement): DOMRect[] {
    const nodes = ['obj', 'phase', 'order', 'rot', 'card', 'tcard', 'facing', 'end', 'hint', 'tile', 'menu'].map(k => this.els[k]);
    const escape = document.querySelector<HTMLElement>('.hud-btn-menu');
    if (escape) nodes.push(escape);
    const key = escape?.querySelector<HTMLElement>('.hud-btn-key');
    if (key) nodes.push(key);
    return nodes.filter(e => e !== exclude && !e.classList.contains('hidden') && !e.classList.contains('hidden-init'))
      .filter(e => {
        const s = getComputedStyle(e);
        // A tooltip must not make its own action menu jump when it temporarily hides another panel.
        const reserveHint = exclude === this.els.menu && e === this.els.hint && this.root.classList.contains('has-hint') && !this.root.classList.contains('has-forecast');
        const reserveInspect = exclude === this.els.menu && e === this.els.tcard && this.root.classList.contains('has-tip') && !this.root.classList.contains('has-hint');
        return s.display !== 'none' && (s.visibility !== 'hidden' || reserveHint || reserveInspect);
      })
      .map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  }

  private overlap(left: number, top: number, width: number, height: number, occupied: DOMRect[], padding = 6): number {
    return occupied.reduce((area, r) => area + Math.max(0, Math.min(left + width, r.right + padding) - Math.max(left, r.left - padding)) *
      Math.max(0, Math.min(top + height, r.bottom + padding) - Math.max(top, r.top - padding)), 0);
  }

  private placeTip(anchor: HTMLElement): void {
    const t = this.els.tip, r = this.root.getBoundingClientRect(), a = anchor.getBoundingClientRect(), p = t.getBoundingClientRect();
    const occupied = this.occupied(t);
    const parent = anchor.closest('.tac-panel')?.getBoundingClientRect() ?? a;
    const candidates = [
      { left: parent.left, top: parent.top - p.height - 8 },
      { left: parent.right + 8, top: a.bottom - p.height },
      { left: parent.left - p.width - 8, top: a.bottom - p.height },
      { left: a.left, top: a.top - p.height - 8 },
      { left: a.right + 8, top: a.bottom - p.height },
      { left: a.left - p.width - 8, top: a.bottom - p.height },
      { left: a.left, top: a.bottom + 8 },
      { left: r.left + 8, top: r.top + 8 },
      { left: r.right - p.width - 8, top: r.top + 8 },
      { left: r.left + (r.width - p.width) / 2, top: r.top + (r.height - p.height) / 2 },
    ];
    const xs = [r.left + 6, r.right - p.width - 6, ...occupied.flatMap(o => [o.right + 8, o.left - p.width - 8])];
    const ys = [r.top + 6, r.bottom - p.height - 6, ...occupied.flatMap(o => [o.bottom + 8, o.top - p.height - 8])];
    for (const left of xs) for (const top of ys) candidates.push({ left, top });
    let best = candidates[0], score = Infinity;
    candidates.forEach((c, i) => {
      const left = Math.max(r.left + 6, Math.min(r.right - p.width - 6, c.left));
      const top = Math.max(r.top + 6, Math.min(r.bottom - p.height - 6, c.top));
      const value = this.overlap(left, top, p.width, p.height, occupied) + i * .01 + Math.hypot(left - a.left, top + p.height - a.top) * .001;
      if (value < score) { best = { left, top }; score = value; }
    });
    t.style.left = `${best.left - r.left}px`; t.style.top = `${best.top - r.top}px`;
  }

  // ------------------------------------------------------------ objective + phase
  setObjective(text: string, detail?: string, progress?: { done: number; total: number } | null, flash = false): void {
    const o = this.els.obj;
    o.querySelector('.txt')!.textContent = text;
    (o.querySelector('.det') as HTMLElement).textContent = detail ?? '';
    const prog = o.querySelector('.prog') as HTMLElement;
    prog.innerHTML = progress ? Array.from({ length: progress.total }, (_, i) => `<i class="${i < progress.done ? 'on' : ''}" title="Runde ${i + 1}"></i>`).join('') : '';
    prog.style.display = progress ? 'flex' : 'none';
    if (flash) { o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash'); }
    this.layoutChrome();
  }

  setPhase(phase: Phase, round: number, unit?: Unit): void {
    const p = this.els.phase;
    p.style.display = '';
    p.className = `tac-panel tac-phase ${phase}`;
    p.innerHTML = `<span>${unit ? esc(unit.name) : PHASE_LABEL[phase]}</span><span class="rd">Runde ${round}${unit ? ` · Tempo ${unit.speed}` : ''}</span>`;
    this.els.end.querySelector('button')!.toggleAttribute('disabled', phase !== 'player');
    this.layoutChrome();
  }

  async turnBanner(phase: Phase, round: number, unit?: Unit): Promise<void> {
    this.setPhase(phase, round, unit);
    await this.banner(unit ? `${unit.name} ist am Zug` : PHASE_LABEL[phase], `Runde ${round}${unit ? ` · Tempo ${unit.speed}` : ''}`, phase, 650);
  }

  banner(text: string, sub = '', kind: string = 'player', ms = 1500): Promise<void> {
    const b = this.els.banner;
    b.className = `tac-banner ${kind}`;
    b.querySelector('.rib')!.textContent = text;
    b.querySelector('.sub')!.textContent = sub;
    b.style.setProperty('--dur', `${ms}ms`);
    void b.offsetWidth;
    b.classList.add('show');
    return new Promise(r => setTimeout(() => { b.classList.remove('show'); r(); }, ms));
  }

  async titleCard(title: string, sub?: string): Promise<void> {
    const t = this.els.title;
    t.querySelector('.t')!.textContent = title;
    t.querySelector('.s')!.textContent = sub ?? '';
    t.classList.add('show');
    await new Promise(r => setTimeout(r, 1900));
    t.classList.remove('show');
    await new Promise(r => setTimeout(r, 450));
  }

  // ------------------------------------------------------------ turn order
  setOrder(units: Unit[], defs: Map<string, BattleUnitDef>, phase: Phase, done: (u: Unit) => boolean, current: string | null): void {
    const sig = units.map(u => `${u.id}:${u.team}:${u.down}:${u.speed}:${done(u)}:${u.hp <= 0}`).join('|') + phase + current;
    if (sig === this.lastOrder) return;
    this.lastOrder = sig;
    const o = this.els.order;
    o.innerHTML = '';
    o.setAttribute('aria-label', 'Zugreihenfolge nach Tempo');
    for (const [i, u] of units.entries()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `o ${u.team}${u.down ? ' down' : done(u) ? ' done' : ''}${current === u.id ? ' cur' : ''}`;
      b.title = `${i === 0 ? 'Am Zug' : `Zug ${i + 1}`}: ${u.name} · Tempo ${u.speed}`;
      b.setAttribute('aria-label', u.name);
      b.dataset.unit = u.id;
      b.innerHTML = `<img alt="" src="${portraitFor(defs.get(u.id), u)}"><span class="order-number">${i + 1}</span>`;
      b.addEventListener('click', e => { e.stopPropagation(); this.h.selectUnit(u.id); });
      o.appendChild(b);
    }
    this.layoutChrome();
  }

  // ------------------------------------------------------------ unit card
  unitCard(m: CardModel | null): void {
    const c = this.els.card;
    if (!m) { c.classList.add('hidden'); this.lastCard = ''; this.hideTip(); return; }
    const u = m.unit;
    const sig = JSON.stringify([u, m.abilities.map(a => [a.def.id, a.cooldown, a.usable, a.reason]), m.selected, m.canAct, m.canMove, m.controllable]);
    if (sig === this.lastCard) { c.classList.remove('hidden'); return; }
    this.lastCard = sig;
    this.hideTip();
    const teamLabel = u.team === 'player' ? 'Verbündet' : u.team === 'enemy' ? 'Feind' : 'Begleitung';
    const statuses = Object.entries(u.statuses).filter(([, v]) => (v ?? 0) > 0).map(([k]) => `<span class="tac-chip ${k === 'guarded' ? 'magic' : k === 'stunned' || k === 'bound' ? 'bad' : ''}">${STATUS_LABEL[k] ?? k}</span>`);
    if (u.down === 'wounded') statuses.unshift('<span class="tac-chip bad">Kampfunfähig</span>');
    const abil = m.controllable && !u.down ? `<div class="tac-abil">${m.abilities.map(a => {
      const magic = a.def.kind === 'magic' || a.def.vfx === 'ward' ? ' magic' : '';
      return `<button type="button" data-ab="${a.def.id}" class="${magic}${a.attack ? ' attack' : ''}${m.selected === a.def.id ? ' on' : ''}${a.usable ? '' : ' dis'}" ${a.usable ? '' : 'aria-disabled="true"'}>
        ${a.key ? `<span class="k">${a.key}</span>` : ''}<span class="ic">${abilityIcon(a.def.vfx)}</span><span class="an">${esc(slotLabel(a))}</span>${a.cooldown > 0 ? `<span class="cd">${a.cooldown}</span>` : ''}</button>`;
    }).join('')}</div>` : '';
    const doneLine = m.controllable && !u.down && !m.canAct && !m.canMove && u.team === 'player' && !u.statuses.bound ? '<div class="tac-done">Zug beendet</div>' : '';
    const title = m.def.title ? `<div class="ttl">${esc(m.def.title)}</div>` : '';
    c.innerHTML = `<div class="top"><div class="por"><img alt="" src="${portraitFor(m.def, u)}"></div><div style="flex:1;min-width:0">
      <div class="nm">${esc(u.name)}<span class="team ${u.team}">${teamLabel}</span></div>${title}
      ${resources(u)}
      <div class="tac-stats"><span>Bewegung <b>${u.move}</b></span><span>Sprung <b>${u.jump}</b></span><span>Angriff <b>${u.atk}</b></span><span>Rüstung <b>${u.def}</b></span></div>
      ${statuses.length ? `<div class="tac-chips">${statuses.join('')}</div>` : ''}
      </div></div>${this.equipment(u, m.controllable && m.canAct && !u.moved)}${abil}${doneLine}`;
    c.classList.remove('hidden');
    c.querySelectorAll<HTMLButtonElement>('button[data-weapon]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); this.h.equip(b.dataset.weapon!);
    }));
    c.querySelectorAll<HTMLButtonElement>('button[data-ab]').forEach(b => {
      const id = b.dataset.ab!;
      const slot = m.abilities.find(a => a.def.id === id)!;
      b.addEventListener('click', e => { e.stopPropagation(); if (slot.usable) this.h.ability(id); });
      b.addEventListener('pointerenter', () => { this.showTip(b, slot); this.h.hoverAbility(slot.usable ? id : null); });
      b.addEventListener('pointerleave', () => { this.leaveTip(id); this.h.hoverAbility(null); });
    });
  }

  private equipment(u: Unit, canEquip: boolean): string {
    if (!u.weapon) return '';
    const w = WEAPONS[u.weapon];
    const skills = w.skills.map(id => `<span class="tac-chip ${u.mastered.includes(id) ? 'good' : ''}">${esc(STANDARD_ABILITIES[id]?.name ?? id)}: ${u.mastered.includes(id) ? 'Gemeistert' : `${u.abilityAp[id] ?? 0} / ${AP_TO_MASTER} AP`}</span>`).join('');
    return `<div class="tac-equipment"><div class="tac-weapon-name">${esc(w.name)}</div>${u.weapons.length > 1 ? `<div class="tac-equip-buttons" aria-label="Waffe ausrüsten">${u.weapons.map(id => `<button type="button" data-weapon="${id}" class="${u.weapon === id ? 'on' : ''}" ${canEquip ? '' : 'disabled'}>${esc(WEAPONS[id].name)}</button>`).join('')}</div>` : ''}<div class="tac-chips">${skills}</div></div>`;
  }

  private showTip(anchor: HTMLElement, slot: AbilitySlot): void {
    const a = slot.def;
    if (anchor.classList.contains('on') || this.tipBlockedAbility === a.id) return;
    this.tipBlockedAbility = null;
    const t = this.els.tip;
    const meta: string[] = [];
    const rt = rangeText(a);
    if (rt) meta.push(rt);
    meta.push(shapeText(a));
    if (a.power || a.fixedDamage) meta.push(a.fixedDamage ? `${a.fixedDamage} Schaden` : `Stärke ${a.power}${a.hits && a.hits > 1 ? ` ×${a.hits}` : ''}`);
    if (isPhysical(a)) {
      const hit = (base: number) => Math.max(5, Math.min(100, base + (a.hitMod ?? 0)));
      meta.push(`Treffer ${hit(HIT_BASE.front)}–${hit(HIT_BASE.back)} % je nach Richtung`);
    } else if (!a.alwaysHits && a.kind !== 'support') meta.push(`Treffer ${a.accuracy} %`);
    if (a.push) meta.push(`Stoß ${a.push}`);
    if (a.cooldown) meta.push(`Abklingzeit ${a.cooldown}`);
    if (a.mpCost) meta.push(`${a.mpCost} MP`);
    if (slot.mastered) meta.push('Gemeistert, dauerhaft verfügbar');
    const magic = a.kind === 'magic' || a.vfx === 'ward';
    t.innerHTML = `<h4>${esc(slotLabel(slot))}</h4><p>${esc(a.description)}</p><div class="meta">${meta.map(x => `<span class="tac-chip${magic ? ' magic' : ''}">${esc(x)}</span>`).join('')}</div>${slot.reason ? `<div class="meta" style="margin-top:.35em"><span class="tac-chip bad">${esc(slot.reason)}</span></div>` : ''}`;
    t.classList.remove('hidden');
    this.root.classList.add('has-tip');
    this.placeTip(anchor);
  }
  private hideTip(): void { this.els.tip.classList.add('hidden'); this.root.classList.remove('has-tip'); }
  private leaveTip(id: string): void { if (this.tipBlockedAbility === id) this.tipBlockedAbility = null; this.hideTip(); }

  // ------------------------------------------------------------ target / preview card
  inspectCard(u: Unit | null, def?: BattleUnitDef, note?: string): void {
    const c = this.els.tcard;
    if (!u) { if (!this.lastPreview.startsWith('P')) { c.classList.add('hidden'); this.lastPreview = ''; } return; }
    const sig = 'I' + JSON.stringify([u, note]);
    if (sig === this.lastPreview) return;
    this.lastPreview = sig;
    c.classList.remove('forecast'); this.root.classList.remove('has-forecast');
    const statuses = Object.entries(u.statuses).filter(([, v]) => (v ?? 0) > 0).map(([k]) => `<span class="tac-chip">${STATUS_LABEL[k] ?? k}</span>`).join('');
    c.innerHTML = `<div class="hd"><div class="por"><img alt="" src="${portraitFor(def, u)}"></div><div style="flex:1"><div class="nm">${esc(u.name)}</div>
      </div></div>${resources(u)}<div class="tac-weapon-name">${u.weapon ? esc(WEAPONS[u.weapon].name) : 'Ohne Waffe'}</div>
      <div class="tac-stats"><span>Bewegung <b>${u.move}</b></span><span>Sprung <b>${u.jump}</b></span><span>Angriff <b>${u.atk}</b></span><span>Rüstung <b>${u.def}</b></span></div>
      ${statuses || u.down ? `<div class="tac-chips">${u.down === 'wounded' ? '<span class="tac-chip bad">Kampfunfähig</span>' : ''}${statuses}</div>` : ''}
      ${note ? `<div class="tac-push" style="margin-top:.4em"><span>${note}</span></div>` : ''}`;
    c.classList.remove('hidden');
  }

  /**
   * FFTA-style forecast: the attacker beside one focused affected unit (portrait, HP now → after, hit chance, damage,
   * direction, modifiers). Every affected unit keeps its own `.tac-target` node; only the focused one (`.on`) is
   * expanded, the pager „‹ 1/3 ›“ (or Tab) flips through the rest.
   */
  previewCard(m: PreviewModel | null): void {
    const c = this.els.tcard;
    if (!m) { this.root.classList.remove('has-forecast'); c.classList.remove('forecast'); if (this.lastPreview.startsWith('P')) { c.classList.add('hidden'); this.lastPreview = ''; } return; }
    const n = m.targets.length;
    const focus = n ? ((m.focus ?? 0) % n + n) % n : 0;
    const sig = 'P' + JSON.stringify([m.ability.id, m.user, m.targets.map(t => [t.unit, t.p]), m.empty, m.confirmed, focus]);
    if (sig === this.lastPreview) { c.classList.remove('hidden'); return; }
    this.lastPreview = sig;
    c.classList.toggle('forecast', n > 0);
    this.root.classList.toggle('has-forecast', n > 0);
    const magic = m.ability.kind === 'magic' || m.ability.vfx === 'ward' ? ' magic' : '';
    if (!n) {
      c.innerHTML = `<div class="ab${magic}">${esc(m.ability.name)}</div><div class="tac-push" style="margin-top:.3em"><span>${esc(m.empty ?? 'Kein Ziel in Reichweite.')}</span></div>`;
      c.classList.remove('hidden');
      return;
    }
    const targets = m.targets.map(({ unit: u, def, p }, i) => {
      const offensive = p.damage > 0 || p.relation !== 'none';
      const total = p.damage * p.hits;
      const extra = p.push ? (p.push.collide?.damage ?? 0) + p.push.fallDamage + (p.push.intoFire ? 3 : 0) : 0;
      const after = offensive ? Math.max(0, u.hp - total - extra) : Math.min(u.maxHp, u.hp + p.heal);
      // The facing sets the base chance of physical attacks; it is shown as „Richtung“, its percentage as „Basis“.
      const dir = p.relation !== 'none' ? RELATION_TEXT[p.relation] : null;
      const mods = p.mods.map(md => {
        const label = md.label === dir && md.kind !== 'bad' ? 'Basis' : md.label;
        return `<span class="tac-chip ${md.kind === 'good' && label !== 'Basis' ? 'good' : md.kind === 'bad' ? 'bad' : ''}">${esc(label)} ${esc(md.text)}</span>`;
      }).join('');
      let pushLine = '';
      if (p.push) {
        const parts: string[] = [];
        if (p.push.path.length) parts.push(`${p.push.path.length} Feld${p.push.path.length > 1 ? 'er' : ''} weg`);
        if (p.push.collide) {
          const what = p.push.collide.kind === 'unit' ? 'Aufprall an Einheit' : p.push.collide.kind === 'cliff' ? 'Aufprall an Kante' : p.push.collide.kind === 'edge' ? 'Aufprall am Rand' : 'Aufprall an Hindernis';
          parts.push(`${what} <b>+${p.push.collide.damage}</b>${p.push.collide.otherDamage ? ` (dort +${p.push.collide.otherDamage})` : ''}`);
        }
        if (p.push.drop >= 2) parts.push(`Sturz ${p.push.drop} Ebenen <b>+${p.push.fallDamage}</b>`);
        if (p.push.intoWater) parts.push('ins Wasser');
        if (!parts.length) parts.push('kann nicht gestoßen werden');
        pushLine = `<div class="tac-push">${ICONS.push}<span>Stoß: ${parts.join(' · ')}</span></div>`;
      }
      const big = offensive
        ? `<div class="tac-big"><div><span class="v hit">${p.chance} %</span><span class="l">Treffer</span></div><div><span class="v ${p.lethal ? 'lethal' : 'dmg'}">${p.damage}${p.hits > 1 ? `×${p.hits}` : ''}</span><span class="l">Schaden</span></div>${dir ? `<div><span class="v dir ${p.relation}">${dir}</span><span class="l">Richtung</span></div>` : ''}${p.lethal ? `<div><span class="v lethal" style="font-size:1em">${u.nonLethal ? 'Kampfunfähig' : 'Besiegt'}</span><span class="l">bei Treffer</span></div>` : ''}</div>`
        : p.frees ? '<div class="tac-push">Die Fesseln lösen. Sie kämpft danach an deiner Seite.</div>'
          : `<div class="tac-chips">${p.statuses.map(s => `<span class="tac-chip magic">${STATUS_LABEL[s] ?? s}</span>`).join('')}${p.heal ? `<span class="tac-chip good">+${p.heal} LP</span>` : ''}</div>`;
      const on = i === focus;
      return `<div class="tac-target${on ? ' on' : ''}" data-target="${esc(u.id)}"${on ? ' aria-current="true"' : ''}>${combatant(u, def, after)}${big}${mods ? `<div class="tac-chips">${mods}</div>` : ''}${pushLine}</div>`;
    }).join('');
    const pager = n > 1
      ? `<span class="tac-pager" role="group" aria-label="Betroffene Figuren durchblättern"><button type="button" class="tac-prev" aria-label="Vorheriges Ziel">‹</button><span class="tac-page">${focus + 1}/${n}</span><button type="button" class="tac-next" aria-label="Nächstes Ziel">›</button></span>`
      : '';
    c.innerHTML = `<div class="forecast-title"><span class="ab${magic}">${esc(m.ability.name)}${m.ability.mpCost ? ` · ${m.ability.mpCost} MP` : ''}</span>${pager}<span class="tac-count">${n === 1 ? '1 Ziel' : `${n} Ziele`}</span></div>
      <div class="tac-forecast-body"><div class="tac-versus">${combatant(m.user, m.userDef, undefined, m.user.mp - (m.ability.mpCost ?? 0))}<div class="tac-versus-arrow">→</div><div class="tac-targets">${targets}</div></div></div>
      <div class="tac-forecast-actions"><span>${m.confirmed ? `Ziel gewählt.${n > 1 ? ' Tab blättert.' : ''} Zweiter Klick oder Enter bestätigt.` : 'Ziel anklicken, dann bestätigen.'}</span><button type="button" class="tac-btn tac-confirm-target" ${m.confirmed ? '' : 'disabled'}>Bestätigen <kbd>Enter</kbd></button></div>`;
    c.querySelector('.tac-confirm-target')!.addEventListener('click', e => { e.stopPropagation(); this.h.confirmTarget(); });
    c.querySelector('.tac-prev')?.addEventListener('click', e => { e.stopPropagation(); this.h.focusTarget(-1); });
    c.querySelector('.tac-next')?.addEventListener('click', e => { e.stopPropagation(); this.h.focusTarget(1); });
    c.classList.remove('hidden');
  }

  facingCard(m: FacingModel | null): void {
    const c = this.els.facing;
    this.root.classList.toggle('has-facing', !!m);
    if (!m) { c.classList.add('hidden'); this.lastFacing = ''; return; }
    const sig = JSON.stringify(m);
    if (sig !== this.lastFacing) {
      this.lastFacing = sig;
      c.innerHTML = `<div class="forecast-title"><span>${esc(m.name)}</span><span>Blickrichtung wählen</span></div>
        <div class="tac-directions">${m.options.map(o => `<button type="button" data-facing="${o.facing}" class="${o.facing === m.selected ? 'on' : ''}" aria-pressed="${o.facing === m.selected}" aria-label="Nach ${o.label} schauen">${o.arrow}</button>`).join('')}</div>
        <div class="tac-facing-note">Pfeiltasten wählen die Richtung. Enter beendet den Zug.</div>
        <div class="tac-facing-actions"><button type="button" class="tac-btn tac-face-back">Zurück <kbd>Esc</kbd></button><button type="button" class="tac-btn tac-confirm-facing">Bestätigen <kbd>Enter</kbd></button></div>`;
      c.querySelectorAll<HTMLButtonElement>('[data-facing]').forEach(button => button.addEventListener('click', e => {
        e.stopPropagation(); this.h.face(button.dataset.facing as Facing);
      }));
      c.querySelector('.tac-face-back')!.addEventListener('click', e => { e.stopPropagation(); this.h.back(); });
      c.querySelector('.tac-confirm-facing')!.addEventListener('click', e => { e.stopPropagation(); this.h.confirmFacing(); });
    }
    c.classList.remove('hidden');
  }

  // ------------------------------------------------------------ action menu
  menu(m: MenuModel | null): void {
    const e = this.els.menu;
    this.root.classList.toggle('choosing', !!m && (!!m.targeting || m.moveOn));
    if (!m) { e.classList.add('hidden'); this.lastMenu = ''; this.hideTip(); return; }
    const sig = JSON.stringify([m.targeting, m.canMove, m.canAct, m.canUndo, m.moveOn, m.actOpen, m.selected, m.abilities.map(a => [a.def.id, a.usable, a.cooldown])]);
    const r = this.root.getBoundingClientRect();
    const px = (m.x / GAME_W) * r.width, py = (m.y / GAME_H) * r.height;
    if (sig !== this.lastMenu) {
      this.lastMenu = sig;
      this.hideTip();
      const btn = (id: string, icon: string, label: string, key: string, enabled: boolean, on = false) =>
        `<button type="button" data-m="${id}" class="${on ? 'on' : ''}" ${enabled ? '' : 'disabled'}>${icon}<span>${label}</span><kbd>${key}</kbd></button>`;
      // „Aktion“ lists the basic attack first (hotkey 0), then the specials (digits = index in Unit.abilities).
      const sub = m.actOpen ? `<div class="sub">${m.abilities.map(a => `<button type="button" data-ab="${a.def.id}" class="${a.def.kind === 'magic' || a.def.vfx === 'ward' ? 'magic' : ''}${a.attack ? ' attack' : ''}${m.selected === a.def.id ? ' on' : ''}${a.usable ? '' : ' dis'}" ${a.usable ? '' : 'aria-disabled="true"'}>${abilityIcon(a.def.vfx)}<span>${esc(slotLabel(a))}</span><kbd>${a.cooldown > 0 ? `⧗${a.cooldown}` : a.key ?? ''}</kbd></button>`).join('')}</div>` : '';
      const keys = m.abilities.map(a => a.key).filter((k): k is string => !!k);
      const actKey = keys.length > 1 ? `${keys[0]}–${keys[keys.length - 1]}` : keys[0] ?? '';
      e.innerHTML = btn('move', ICONS.move, 'Bewegen', 'M', m.canMove, m.moveOn) + btn('act', ICONS.act, 'Aktion', actKey, m.canAct, m.actOpen) + sub +
        btn('wait', ICONS.wait, 'Warten', 'F', true) + (m.canUndo ? btn('undo', ICONS.undo, 'Rückgängig', 'Z', true) : '');
      const chosen = m.abilities.find(a => a.def.id === m.selected);
      if (m.targeting || m.moveOn) e.innerHTML = `<div class="tac-target-name">${m.moveOn ? 'Bewegung wählen' : esc(chosen ? slotLabel(chosen) : 'Ziel wählen')}</div>` + btn('back', ICONS.undo, 'Abbrechen', 'Esc', true);
      e.querySelectorAll<HTMLButtonElement>('button[data-m]').forEach(b => b.addEventListener('click', ev => {
        ev.stopPropagation();
        const id = b.dataset.m;
        if (id === 'move') this.h.moveMode(); else if (id === 'act') this.h.actMenu(); else if (id === 'wait') this.h.wait(); else if (id === 'undo') this.h.undo(); else if (id === 'back') this.h.back();
      }));
      e.querySelectorAll<HTMLButtonElement>('button[data-ab]').forEach(b => {
        const id = b.dataset.ab!;
        const slot = m.abilities.find(a => a.def.id === id)!;
        b.addEventListener('click', ev => { ev.stopPropagation(); if (slot.usable) this.h.ability(id); });
        b.addEventListener('pointerenter', () => { this.showTip(b, slot); this.h.hoverAbility(slot.usable ? id : null); });
        b.addEventListener('pointerleave', () => { this.leaveTip(id); this.h.hoverAbility(null); });
      });
    }
    e.classList.remove('hidden');
    e.classList.toggle('targeting', !!m.targeting || m.moveOn);
    if (m.targeting || m.moveOn) {
      e.style.left = 'auto'; e.style.right = '.8em'; e.style.top = 'var(--tac-target-top)';
      return;
    }
    e.style.right = 'auto';
    const mr = e.getBoundingClientRect();
    const k = r.width / GAME_W;
    const avoid = (m.avoid ?? []).map(a => ({ x: (a.x / GAME_W) * r.width, y: (a.y / GAME_H) * r.height }));
    const styles = getComputedStyle(this.root);
    const header = parseFloat(styles.getPropertyValue('--tac-header')) || 8;
    const footer = parseFloat(styles.getPropertyValue('--tac-footer')) || 8;
    const clampTop = (t: number) => Math.max(header + mr.height / 2, Math.min(r.height - footer - mr.height / 2, t));
    const panels = this.occupied(e);
    const cands = [
      { left: px + 16 * k, top: clampTop(py) },
      { left: px - mr.width - 16 * k, top: clampTop(py) },
      { left: px + 14 * k, top: clampTop(py + mr.height / 2 + 6 * k) },
      { left: px - mr.width - 14 * k, top: clampTop(py + mr.height / 2 + 6 * k) },
      { left: px + 14 * k, top: clampTop(py - mr.height / 2 - 10 * k) },
      { left: px - mr.width - 14 * k, top: clampTop(py - mr.height / 2 - 10 * k) },
      { left: 8, top: clampTop(py) },
      { left: r.width - mr.width - 8, top: clampTop(py) },
    ];
    let best = cands[0], bestScore = Infinity;
    cands.forEach((c, i) => {
      const l = Math.max(8, Math.min(r.width - mr.width - 8, c.left));
      const t0 = c.top - mr.height / 2;
      let score = i * 0.1 + Math.abs(l - c.left) * 0.02;
      score += this.overlap(r.left + l, r.top + t0, mr.width, mr.height, panels) / Math.max(1, mr.width * mr.height) * 1000;
      for (const a of avoid) {
        const pad = 10 * k;
        if (a.x > l - pad && a.x < l + mr.width + pad && a.y > t0 - pad * 2 && a.y < t0 + mr.height + pad) score += 10;
      }
      if (score < bestScore) { bestScore = score; best = { left: l, top: c.top }; }
    });
    e.style.left = `${best.left}px`;
    e.style.top = `${best.top}px`;
  }

  // ------------------------------------------------------------ tile info
  tile(info: { label: string; h: number; note?: string } | null): void {
    const t = this.els.tile;
    if (!info) { t.classList.add('hidden'); return; }
    t.innerHTML = `<span>${esc(info.label)}</span><span class="h">Höhe ${info.h}</span>${info.note ? `<span class="note">${esc(info.note)}</span>` : ''}`;
    t.classList.remove('hidden');
  }

  setEndTurn(enabled: boolean, pulse: boolean): void {
    const b = this.els.end.querySelector('button')!;
    b.toggleAttribute('disabled', !enabled);
    b.classList.toggle('pulse', enabled && pulse);
  }

  // ------------------------------------------------------------ hint
  hint(text: string, opts: HintOptions, withButton: boolean): Promise<void> {
    const e = this.els.hint;
    this.hideTip();
    this.hintResolve?.();
    e.innerHTML = `<div class="h">${ICONS.quill}<span>${esc(opts.title ?? 'Hinweis')}</span></div><div class="b">${text}</div>${withButton ? '<div class="row"><button type="button" class="tac-btn small">Verstanden <kbd>Enter</kbd></button></div>' : '<div class="wait">Probiere es aus …</div>'}`;
    e.classList.remove('hidden');
    this.root.classList.add('has-hint');
    this.layoutChrome();
    return new Promise(resolve => {
      this.hintResolve = () => { this.hintResolve = null; resolve(); };
      e.querySelector('button')?.addEventListener('click', ev => { ev.stopPropagation(); this.hintResolve?.(); });
    });
  }
  /** Confirms a click-hint via keyboard. Returns true if one was open. */
  confirmHint(): boolean {
    if (!this.hintResolve || !this.els.hint.querySelector('button')) return false;
    this.hintResolve();
    return true;
  }
  hintOpenWithButton(): boolean { return !!this.hintResolve && !!this.els.hint.querySelector('button') && !this.els.hint.classList.contains('hidden'); }
  clearHint(): void {
    this.els.hint.classList.add('hidden');
    this.root.classList.remove('has-hint');
    this.hintResolve?.();
  }

  // ------------------------------------------------------------ floating text + plates
  float(x: number, y: number, text: string, kind: 'dmg' | 'big' | 'heal' | 'miss' | 'info' | 'bad' | 'magic' = 'dmg'): void {
    const f = document.createElement('div');
    f.className = `tac-float ${kind}`;
    f.textContent = text;
    f.style.left = pct(x, GAME_W);
    f.style.top = pct(y, GAME_H);
    if (settings.reducedMotion) f.style.animationDuration = '1.3s';
    this.els.floats.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  async plate(x: number, y: number, text: string, kind: 'enemy' | 'magic' | 'player'): Promise<void> {
    const p = this.els.plate;
    p.className = `tac-panel tac-plate ${kind}`;
    p.textContent = text;
    p.style.left = pct(x, GAME_W);
    p.style.top = pct(y, GAME_H);
    void p.offsetWidth;
    p.classList.add('show');
    await new Promise(r => setTimeout(r, 650));
    p.classList.remove('show');
  }

  // ------------------------------------------------------------ outcome
  outcome(kind: 'win' | 'lose', retry: boolean, sub: string): Promise<'retry' | 'continue'> {
    const o = this.els.out;
    o.className = `tac-out ${kind}`;
    o.querySelector('.t')!.textContent = kind === 'win' ? 'Sieg' : 'Niederlage';
    o.querySelector('.s')!.textContent = sub;
    const btns = o.querySelector('.btns') as HTMLElement;
    btns.innerHTML = kind === 'win'
      ? '<button type="button" class="tac-btn" data-o="continue">Weiter <kbd>Enter</kbd></button>'
      : retry
        ? `<button type="button" class="tac-btn" data-o="retry">${ICONS.undo}Erneut versuchen <kbd>Enter</kbd></button>`
        : '<button type="button" class="tac-btn" data-o="continue">Weiter <kbd>Enter</kbd></button>';
    void o.offsetWidth;
    o.classList.add('show');
    this.menu(null); this.unitCard(null); this.previewCard(null); this.inspectCard(null);
    return new Promise(resolve => {
      this.outcomeResolve = v => { this.outcomeResolve = null; o.classList.remove('show'); resolve(v); };
      btns.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); this.outcomeResolve?.(b.dataset.o as 'retry' | 'continue'); }));
      setTimeout(() => btns.querySelector('button')?.focus(), 50);
    });
  }
  confirmOutcome(): boolean {
    if (!this.outcomeResolve) return false;
    const b = this.els.out.querySelector<HTMLButtonElement>('button');
    this.outcomeResolve((b?.dataset.o as 'retry' | 'continue') ?? 'continue');
    return true;
  }

  hideAllPanels(hidden: boolean): void {
    for (const k of ['obj', 'order', 'rot', 'end', 'phase', 'tile']) this.els[k].style.visibility = hidden ? 'hidden' : '';
  }
}
