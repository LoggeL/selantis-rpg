import { G } from '../../core/G';
import { settings } from '../../core/settings';
import { GAME_H, GAME_W, canvasRect } from '../../core/viewport';
import type { BattleUnitDef, HintOptions } from '../api';
import type { AbilityDef, Phase, TargetPreview, Unit } from '../rules/types';
import { ICONS, abilityIcon } from './icons';
import { TACTICS_CSS } from './style';

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
}

export interface AbilitySlot { def: AbilityDef; cooldown: number; usable: boolean; reason?: string }

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
  targets: { unit: Unit; def: BattleUnitDef; p: TargetPreview }[];
  /** Line ability with no unit in it, etc. */
  empty?: string;
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

const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const pct = (x: number, total: number) => `${(x / total) * 100}%`;

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
  private hintResolve: (() => void) | null = null;
  private outcomeResolve: ((v: 'retry' | 'continue') => void) | null = null;
  private lastCard = '';
  private lastMenu = '';
  private lastPreview = '';
  private lastOrder = '';

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
    for (const k of ['obj', 'card', 'menu', 'end', 'rot', 'hint', 'order', 'out']) {
      this.els[k].addEventListener('pointerdown', e => e.stopPropagation());
      this.els[k].addEventListener('wheel', e => e.stopPropagation());
    }
    this.resizeObs = () => this.layout();
  }

  mount(host: HTMLElement): void {
    host.appendChild(this.style);
    host.appendChild(this.root);
    window.addEventListener('resize', this.resizeObs);
    this.layout();
    requestAnimationFrame(() => this.layout());
  }

  destroy(): void {
    window.removeEventListener('resize', this.resizeObs);
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
  }

  setPhase(phase: Phase, round: number): void {
    const p = this.els.phase;
    p.style.display = '';
    p.className = `tac-panel tac-phase ${phase}`;
    p.innerHTML = `<span>${PHASE_LABEL[phase]}</span><span class="rd">Runde ${round}</span>`;
    this.els.end.querySelector('button')!.toggleAttribute('disabled', phase !== 'player');
  }

  async turnBanner(phase: Phase, round: number): Promise<void> {
    this.setPhase(phase, round);
    await this.banner(PHASE_LABEL[phase], `Runde ${round}`, phase, 1250);
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
    const sig = units.map(u => `${u.id}:${u.team}:${u.down}:${done(u)}:${u.hp <= 0}`).join('|') + phase + current;
    if (sig === this.lastOrder) return;
    this.lastOrder = sig;
    const o = this.els.order;
    o.innerHTML = '';
    let lastTeam: string | null = null;
    for (const u of units) {
      if (lastTeam && u.team !== lastTeam) { const s = document.createElement('div'); s.className = 'sep'; o.appendChild(s); }
      lastTeam = u.team;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `o ${u.team}${u.down ? ' down' : done(u) ? ' done' : ''}${current === u.id ? ' cur' : ''}`;
      b.title = `${u.name}${u.down === 'wounded' ? ' (kampfunfähig)' : ''}`;
      b.innerHTML = `<img alt="" src="${portraitFor(defs.get(u.id), u)}">`;
      b.addEventListener('click', e => { e.stopPropagation(); this.h.selectUnit(u.id); });
      o.appendChild(b);
    }
  }

  // ------------------------------------------------------------ unit card
  unitCard(m: CardModel | null): void {
    const c = this.els.card;
    if (!m) { c.classList.add('hidden'); this.lastCard = ''; return; }
    const u = m.unit;
    const sig = JSON.stringify([u.id, u.hp, u.team, u.down, u.statuses, m.abilities.map(a => [a.def.id, a.cooldown, a.usable]), m.selected, m.canAct, m.canMove, m.controllable]);
    if (sig === this.lastCard) { c.classList.remove('hidden'); return; }
    this.lastCard = sig;
    const ratio = u.hp / u.maxHp;
    const hpCls = u.team === 'enemy' ? 'foe' : ratio > 0.5 ? '' : ratio > 0.25 ? 'mid' : 'low';
    const teamLabel = u.team === 'player' ? 'Verbündet' : u.team === 'enemy' ? 'Feind' : 'Begleitung';
    const statuses = Object.entries(u.statuses).filter(([, v]) => (v ?? 0) > 0).map(([k]) => `<span class="tac-chip ${k === 'guarded' ? 'magic' : k === 'stunned' || k === 'bound' ? 'bad' : ''}">${STATUS_LABEL[k] ?? k}</span>`);
    if (u.down === 'wounded') statuses.unshift('<span class="tac-chip bad">Kampfunfähig</span>');
    const abil = m.controllable && !u.down ? `<div class="tac-abil">${m.abilities.map((a, i) => {
      const magic = a.def.kind === 'magic' || a.def.vfx === 'ward' ? ' magic' : '';
      return `<button type="button" data-ab="${a.def.id}" class="${magic}${m.selected === a.def.id ? ' on' : ''}${a.usable ? '' : ' dis'}" ${a.usable ? '' : 'aria-disabled="true"'}>
        <span class="k">${i + 1}</span><span class="ic">${abilityIcon(a.def.vfx)}</span><span class="an">${esc(a.def.name)}</span>${a.cooldown > 0 ? `<span class="cd">${a.cooldown}</span>` : ''}</button>`;
    }).join('')}</div>` : '';
    const doneLine = m.controllable && !u.down && !m.canAct && !m.canMove && u.team === 'player' && !u.statuses.bound ? '<div class="tac-done">Zug beendet</div>' : '';
    const title = m.def.title ? `<div class="ttl">${esc(m.def.title)}</div>` : '';
    c.innerHTML = `<div class="top"><div class="por"><img alt="" src="${portraitFor(m.def, u)}"></div><div style="flex:1;min-width:0">
      <div class="nm">${esc(u.name)}<span class="team ${u.team}">${teamLabel}</span></div>${title}
      <div class="tac-hp"><div class="bar"><b class="${hpCls}" style="width:${Math.max(0, ratio) * 100}%"></b></div><span class="num">${u.hp} / ${u.maxHp}</span></div>
      <div class="tac-stats"><span>Bewegung <b>${u.move}</b></span><span>Sprung <b>${u.jump}</b></span><span>Angriff <b>${u.atk}</b></span><span>Rüstung <b>${u.def}</b></span></div>
      ${statuses.length ? `<div class="tac-chips">${statuses.join('')}</div>` : ''}
      </div></div>${abil}${doneLine}`;
    c.classList.remove('hidden');
    c.querySelectorAll<HTMLButtonElement>('button[data-ab]').forEach(b => {
      const id = b.dataset.ab!;
      const slot = m.abilities.find(a => a.def.id === id)!;
      b.addEventListener('click', e => { e.stopPropagation(); if (slot.usable) this.h.ability(id); });
      b.addEventListener('pointerenter', () => { this.showTip(b, slot); this.h.hoverAbility(slot.usable ? id : null); });
      b.addEventListener('pointerleave', () => { this.hideTip(); this.h.hoverAbility(null); });
    });
  }

  private showTip(anchor: HTMLElement, slot: AbilitySlot): void {
    const a = slot.def;
    const t = this.els.tip;
    const meta: string[] = [];
    const rt = rangeText(a);
    if (rt) meta.push(rt);
    meta.push(shapeText(a));
    if (a.power || a.fixedDamage) meta.push(a.fixedDamage ? `${a.fixedDamage} Schaden` : `Stärke ${a.power}${a.hits && a.hits > 1 ? ` ×${a.hits}` : ''}`);
    if (!a.alwaysHits && a.kind !== 'support') meta.push(`Treffer ${a.accuracy} %`);
    if (a.push) meta.push(`Stoß ${a.push}`);
    if (a.cooldown) meta.push(`Abklingzeit ${a.cooldown}`);
    const magic = a.kind === 'magic' || a.vfx === 'ward';
    t.innerHTML = `<h4>${esc(a.name)}</h4><p>${esc(a.description)}</p><div class="meta">${meta.map(x => `<span class="tac-chip${magic ? ' magic' : ''}">${esc(x)}</span>`).join('')}</div>${slot.reason ? `<div class="meta" style="margin-top:.35em"><span class="tac-chip bad">${esc(slot.reason)}</span></div>` : ''}`;
    t.classList.remove('hidden');
    const rr = this.root.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    t.style.left = `${Math.max(4, Math.min(rr.width - tr.width - 4, ar.left - rr.left))}px`;
    t.style.top = `${Math.max(4, ar.top - rr.top - tr.height - 6)}px`;
  }
  private hideTip(): void { this.els.tip.classList.add('hidden'); }

  // ------------------------------------------------------------ target / preview card
  inspectCard(u: Unit | null, def?: BattleUnitDef, note?: string): void {
    const c = this.els.tcard;
    if (!u) { if (!this.lastPreview.startsWith('P')) { c.classList.add('hidden'); this.lastPreview = ''; } return; }
    const sig = 'I' + JSON.stringify([u.id, u.hp, u.statuses, u.down, note]);
    if (sig === this.lastPreview) return;
    this.lastPreview = sig;
    const ratio = u.hp / u.maxHp;
    const statuses = Object.entries(u.statuses).filter(([, v]) => (v ?? 0) > 0).map(([k]) => `<span class="tac-chip">${STATUS_LABEL[k] ?? k}</span>`).join('');
    c.innerHTML = `<div class="hd"><div class="por"><img alt="" src="${portraitFor(def, u)}"></div><div style="flex:1"><div class="nm">${esc(u.name)}</div>
      <div class="tac-hp"><div class="bar"><b class="${u.team === 'enemy' ? 'foe' : ''}" style="width:${ratio * 100}%"></b></div><span class="num">${u.hp} / ${u.maxHp}</span></div></div></div>
      <div class="tac-stats"><span>Bewegung <b>${u.move}</b></span><span>Sprung <b>${u.jump}</b></span><span>Angriff <b>${u.atk}</b></span><span>Rüstung <b>${u.def}</b></span></div>
      ${statuses || u.down ? `<div class="tac-chips">${u.down === 'wounded' ? '<span class="tac-chip bad">Kampfunfähig</span>' : ''}${statuses}</div>` : ''}
      ${note ? `<div class="tac-push" style="margin-top:.4em"><span>${note}</span></div>` : ''}`;
    c.classList.remove('hidden');
  }

  previewCard(m: PreviewModel | null): void {
    const c = this.els.tcard;
    if (!m) { if (this.lastPreview.startsWith('P')) { c.classList.add('hidden'); this.lastPreview = ''; } return; }
    const sig = 'P' + JSON.stringify([m.ability.id, m.user.id, m.targets.map(t => [t.unit.id, t.p]), m.empty]);
    if (sig === this.lastPreview) { c.classList.remove('hidden'); return; }
    this.lastPreview = sig;
    const magic = m.ability.kind === 'magic' || m.ability.vfx === 'ward' ? ' magic' : '';
    if (!m.targets.length) {
      c.innerHTML = `<div class="ab${magic}">${esc(m.ability.name)}</div><div class="tac-push" style="margin-top:.3em"><span>${esc(m.empty ?? 'Kein Ziel in Reichweite.')}</span></div>`;
      c.classList.remove('hidden');
      return;
    }
    const main = m.targets[0];
    const p = main.p;
    const u = main.unit;
    const offensive = p.damage > 0 || p.relation !== 'none';
    const total = p.damage * p.hits;
    const extra = p.push ? (p.push.collide?.damage ?? 0) + p.push.fallDamage : 0;
    const after = Math.max(0, u.hp - total - extra);
    const ratio = u.hp / u.maxHp;
    const ghostL = (after / u.maxHp) * 100, ghostW = Math.max(0, ratio * 100 - ghostL);
    const mods = p.mods.map(md => `<span class="tac-chip ${md.kind === 'good' ? 'good' : md.kind === 'bad' ? 'bad' : ''}">${esc(md.label)} ${esc(md.text)}</span>`).join('');
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
      ? `<div class="tac-big"><div><span class="v hit">${p.chance} %</span><span class="l">Treffer</span></div><div><span class="v ${p.lethal ? 'lethal' : 'dmg'}">${p.damage}${p.hits > 1 ? `×${p.hits}` : ''}</span><span class="l">Schaden</span></div>${p.lethal ? `<div><span class="v lethal" style="font-size:1em">${u.nonLethal ? 'Kampfunfähig' : 'Besiegt'}</span><span class="l">bei Treffer</span></div>` : ''}</div>`
      : p.frees ? '<div class="tac-push">Die Fesseln lösen. Sie kämpft danach an deiner Seite.</div>'
        : `<div class="tac-chips">${p.statuses.map(s => `<span class="tac-chip magic">${STATUS_LABEL[s] ?? s}</span>`).join('')}${p.heal ? `<span class="tac-chip good">+${p.heal} LP</span>` : ''}</div>`;
    const others = m.targets.slice(1).map(t => `<div class="tac-row"><span class="n">${esc(t.unit.name)}</span><span class="c">${t.p.chance} %</span><span class="d">${t.p.damage}${t.p.hits > 1 ? `×${t.p.hits}` : ''}</span></div>`).join('');
    c.innerHTML = `<div class="hd"><div class="por"><img alt="" src="${portraitFor(main.def, u)}"></div><div style="flex:1;min-width:0"><div class="ab${magic}">${esc(m.ability.name)}</div><div class="nm">${esc(u.name)}</div></div></div>
      ${big}
      ${offensive ? `<div class="tac-hp"><div class="bar"><b class="${u.team === 'enemy' ? 'foe' : ''}" style="width:${ghostL}%"></b><s style="left:${ghostL}%;width:${ghostW}%"></s></div><span class="num">${u.hp} → ${after}</span></div>` : ''}
      ${mods ? `<div class="tac-chips">${mods}</div>` : ''}${pushLine}${others}`;
    c.classList.remove('hidden');
  }

  // ------------------------------------------------------------ action menu
  menu(m: MenuModel | null): void {
    const e = this.els.menu;
    if (!m) { e.classList.add('hidden'); this.lastMenu = ''; return; }
    const sig = JSON.stringify([m.canMove, m.canAct, m.canUndo, m.moveOn, m.actOpen, m.selected, m.abilities.map(a => [a.def.id, a.usable, a.cooldown])]);
    const r = this.root.getBoundingClientRect();
    const px = (m.x / GAME_W) * r.width, py = (m.y / GAME_H) * r.height;
    if (sig !== this.lastMenu) {
      this.lastMenu = sig;
      const btn = (id: string, icon: string, label: string, key: string, enabled: boolean, on = false) =>
        `<button type="button" data-m="${id}" class="${on ? 'on' : ''}" ${enabled ? '' : 'disabled'}>${icon}<span>${label}</span><kbd>${key}</kbd></button>`;
      const sub = m.actOpen ? `<div class="sub">${m.abilities.map((a, i) => `<button type="button" data-ab="${a.def.id}" class="${a.def.kind === 'magic' || a.def.vfx === 'ward' ? 'magic' : ''}${m.selected === a.def.id ? ' on' : ''}${a.usable ? '' : ' dis'}" ${a.usable ? '' : 'aria-disabled="true"'}>${abilityIcon(a.def.vfx)}<span>${esc(a.def.name)}</span><kbd>${a.cooldown > 0 ? `⧗${a.cooldown}` : i + 1}</kbd></button>`).join('')}</div>` : '';
      e.innerHTML = btn('move', ICONS.move, 'Bewegen', 'M', m.canMove, m.moveOn) + btn('act', ICONS.act, 'Handeln', '1–4', m.canAct, m.actOpen) + sub +
        btn('wait', ICONS.wait, 'Warten', 'F', true) + (m.canUndo ? btn('undo', ICONS.undo, 'Rückgängig', 'Z', true) : '');
      e.querySelectorAll<HTMLButtonElement>('button[data-m]').forEach(b => b.addEventListener('click', ev => {
        ev.stopPropagation();
        const id = b.dataset.m;
        if (id === 'move') this.h.moveMode(); else if (id === 'act') this.h.actMenu(); else if (id === 'wait') this.h.wait(); else if (id === 'undo') this.h.undo();
      }));
      e.querySelectorAll<HTMLButtonElement>('button[data-ab]').forEach(b => {
        const id = b.dataset.ab!;
        const slot = m.abilities.find(a => a.def.id === id)!;
        b.addEventListener('click', ev => { ev.stopPropagation(); if (slot.usable) this.h.ability(id); });
        b.addEventListener('pointerenter', () => { this.showTip(b, slot); this.h.hoverAbility(slot.usable ? id : null); });
        b.addEventListener('pointerleave', () => { this.hideTip(); this.h.hoverAbility(null); });
      });
    }
    e.classList.remove('hidden');
    const mr = e.getBoundingClientRect();
    const k = r.width / GAME_W;
    const avoid = (m.avoid ?? []).map(a => ({ x: (a.x / GAME_W) * r.width, y: (a.y / GAME_H) * r.height }));
    const clampTop = (t: number) => Math.max(mr.height / 2 + 8, Math.min(r.height - mr.height / 2 - 8, t));
    const cands = [
      { left: px + 16 * k, top: clampTop(py) },
      { left: px - mr.width - 16 * k, top: clampTop(py) },
      { left: px + 14 * k, top: clampTop(py + mr.height / 2 + 6 * k) },
      { left: px - mr.width - 14 * k, top: clampTop(py + mr.height / 2 + 6 * k) },
      { left: px + 14 * k, top: clampTop(py - mr.height / 2 - 10 * k) },
      { left: px - mr.width - 14 * k, top: clampTop(py - mr.height / 2 - 10 * k) },
    ];
    let best = cands[0], bestScore = Infinity;
    cands.forEach((c, i) => {
      const l = Math.max(8, Math.min(r.width - mr.width - 8, c.left));
      const t0 = c.top - mr.height / 2;
      let score = i * 0.1 + Math.abs(l - c.left) * 0.02;
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
    this.hintResolve?.();
    e.innerHTML = `<div class="h">${ICONS.quill}<span>${esc(opts.title ?? 'Hinweis')}</span></div><div class="b">${text}</div>${withButton ? '<div class="row"><button type="button" class="tac-btn small">Verstanden <kbd>Enter</kbd></button></div>' : '<div class="wait">Probiere es aus …</div>'}`;
    e.classList.remove('hidden');
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
