// Pure rules of e3-paladine (no Phaser): the cover-story answers and the patrol's mood (e3-tarnung), the escort
// distance on the way through Trapas, the leash while the leader talks to the smith, and the confiscation of the
// staffs (inventory is the truth, umsetzung.md §2 Stäbe).
import { G } from '../../core/G';
import { STAFF } from '../common/bookContract';
import { staffAway } from './shared';

// ---------------------------------------------------------------------------------------------------------------
// The cover story
// ---------------------------------------------------------------------------------------------------------------

/** What an answer gives away: nothing (fits Ignatius' story) or one of the things that must not come up. */
export type Slip = 'none' | 'hof' | 'schwester' | 'urmacht' | 'fest';

export interface CoverAnswer {
  text: string;
  slip: Slip;
}

/** First moment: the young paladin asks where the goods are. */
export const GOODS_ANSWERS: CoverAnswer[] = [
  { text: '„In Trapas, bei einem Händler am Markt. Bei ihm sind sie sicherer als bei uns.“', slip: 'none' },
  { text: '„Zu Hause auf dem Hof. Also … auf dem Hof, den wir … Vergesst es.“', slip: 'hof' },
  { text: '„Bei meiner Schwester. Glaube ich. Hoffe ich.“', slip: 'schwester' },
];

/** Second moment: the leader asks why a merchant walks without a cart. */
export const ROAD_ANSWERS: CoverAnswer[] = [
  { text: '„Gerade deshalb. Zwischen Portas und hier wird jeder volle Wagen ausgeräumt. Uns kann keiner was nehmen.“', slip: 'none' },
  { text: '„Weil uns etwas … folgt. Also, nicht uns. Mir. Nein, gar nichts. Wir sind nur müde.“', slip: 'urmacht' },
  { text: '„Wir sind Pilger. Auf dem Weg zum Verbannungsfest.“', slip: 'fest' },
];

/** e3-tarnung: how many of the two answers held the story (0–2). */
export function coverScore(slips: readonly Slip[]): number {
  return slips.filter(s => s === 'none').length;
}

/** The leader's parting remark once both are bound: ironic praise when the story held, dry otherwise. */
export function leaderVerdict(score: number): 'familiensinn' | 'vernunft' {
  return score >= 2 ? 'familiensinn' : 'vernunft';
}

// ---------------------------------------------------------------------------------------------------------------
// The escort through Trapas
// ---------------------------------------------------------------------------------------------------------------

export interface EscortRules {
  /** Close enough: the leader walks on. */
  near: number;
  /** Farther than this: a paladin tells her off. */
  warn: number;
  /** Farther than this: she is fetched back. */
  pull: number;
}

export const ESCORT: EscortRules = { near: 74, warn: 140, pull: 210 };

export type EscortVerdict = 'near' | 'ok' | 'warn' | 'pull';

/** Distance verdict between Lia and the leader of the escort. */
export function escortVerdict(dist: number, rules: EscortRules = ESCORT): EscortVerdict {
  if (dist <= rules.near) return 'near';
  if (dist <= rules.warn) return 'ok';
  if (dist <= rules.pull) return 'warn';
  return 'pull';
}

export interface Leash { cx: number; cy: number; rx: number; ry: number }

/** Inside the leash ellipse (the part of the square Lia may walk while she waits). */
export function insideLeash(x: number, y: number, l: Leash): boolean {
  const dx = (x - l.cx) / l.rx, dy = (y - l.cy) / l.ry;
  return dx * dx + dy * dy <= 1;
}

// ---------------------------------------------------------------------------------------------------------------
// Confiscation
// ---------------------------------------------------------------------------------------------------------------

/**
 * The patrol takes Lia's own staff (→ armoury, e3-stab-ort) and, should she still carry it, the borrowed
 * Schattentöter as well (in the regular run she gave it back in e3-eigener-stab; Ignatius' own one goes to the armoury
 * with his things). Idempotent: a second call takes nothing more.
 */
export function confiscateStaffs(): void {
  staffAway('waffenkammer');
  if (G.state.has(STAFF.borrowed)) G.state.take(STAFF.borrowed, G.state.count(STAFF.borrowed));
}
