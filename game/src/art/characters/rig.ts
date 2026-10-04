import type { CharAnim } from '../api';

/** Extra animations beyond the CharAnim contract (keys follow the same scheme). */
export type CharAnimExtra = 'sit-read' | 'crouch' | 'sleep' | 'struggle' | 'wave' | 'point' | 'talk' | 'cheer';
export type AnyAnim = CharAnim | CharAnimExtra;

export const BASE_ANIMS: CharAnim[] = ['idle', 'walk', 'run', 'sneak', 'interact', 'kneel', 'sit', 'lie', 'cast', 'attack', 'shoot', 'hit', 'fall', 'carry', 'read'];
export const EXTRA_ANIMS: CharAnimExtra[] = ['sit-read', 'crouch', 'sleep', 'struggle', 'wave', 'point', 'talk', 'cheer'];
export const ALL_ANIMS: AnyAnim[] = [...BASE_ANIMS, ...EXTRA_ANIMS];

export type BodyType = 'slim' | 'normal' | 'broad' | 'huge' | 'child' | 'dwarf';

/** Body metrics in frame pixels. All characters share these proportions per body type. */
export interface Metrics {
  fw: number; fh: number;
  /** Body centre column boundary: pixels < cx are the left half. */
  cx: number;
  ground: number;      // feet row
  legTop: number;      // first leg row
  shoulder: number;    // first torso row
  headTop: number;     // first skin row of the head
  headW: number; headH: number;
  torsoW: number;      // front-view torso width
  sideW: number;       // side-view torso width
  legW: number;
  legGap: number;      // gap between legs in front view
  armW: number;
  armLen: number;      // shoulder → hand
  s: number;           // scale for pose offsets
}

export function metrics(body: BodyType, opts: { tall?: boolean; hunch?: boolean } = {}): Metrics {
  let m: Metrics;
  switch (body) {
    case 'huge':
      m = { fw: 32, fh: 32, cx: 16, ground: 31, legTop: 23, shoulder: 12, headTop: 2, headW: 10, headH: 10, torsoW: 14, sideW: 10, legW: 4, legGap: 2, armW: 3, armLen: 8, s: 1.45 };
      break;
    case 'broad':
      m = { fw: 24, fh: 24, cx: 12, ground: 23, legTop: 18, shoulder: 11, headTop: 3, headW: 8, headH: 8, torsoW: 10, sideW: 7, legW: 3, legGap: 1, armW: 2, armLen: 5, s: 1 };
      break;
    case 'slim':
      m = { fw: 24, fh: 24, cx: 12, ground: 23, legTop: 18, shoulder: 11, headTop: 3, headW: 8, headH: 8, torsoW: 6, sideW: 5, legW: 2, legGap: 0, armW: 2, armLen: 5, s: 1 };
      break;
    case 'child':
      m = { fw: 24, fh: 24, cx: 12, ground: 23, legTop: 20, shoulder: 14, headTop: 6, headW: 8, headH: 8, torsoW: 6, sideW: 5, legW: 2, legGap: 0, armW: 2, armLen: 4, s: 0.8 };
      break;
    case 'dwarf':
      m = { fw: 24, fh: 24, cx: 12, ground: 23, legTop: 20, shoulder: 13, headTop: 5, headW: 8, headH: 8, torsoW: 10, sideW: 8, legW: 3, legGap: 1, armW: 2, armLen: 4, s: 0.9 };
      break;
    default:
      m = { fw: 24, fh: 24, cx: 12, ground: 23, legTop: 18, shoulder: 11, headTop: 3, headW: 8, headH: 8, torsoW: 8, sideW: 6, legW: 2, legGap: 2, armW: 2, armLen: 5, s: 1 };
  }
  if (opts.tall && body !== 'huge') { m.headTop -= 1; m.shoulder -= 1; m.legTop -= 1; }
  if (opts.hunch) { m.headTop += 2; m.shoulder += 1; }
  return m;
}

export interface Limb { x: number; y: number }

export interface Pose {
  bob: number;
  crouch: number;
  lean: number;
  headX: number;
  headY: number;
  footN: Limb;
  footF: Limb;
  /** Hand offsets from the default hanging position (x forward/out, y down). */
  handN: Limb;
  handF: Limb;
  eyes: 'open' | 'closed' | 'wide' | 'hurt';
  hair: number;
  cloak: number;
  /** Weapon angle in radians in the near hand (0 = forward, +π/2 = down). undefined = carry pose. */
  weapon?: number;
  weaponF?: number;
  weaponHidden?: boolean;
  bowDraw?: number;
  arrow?: boolean;
  item?: 'book' | 'book-flip' | 'bundle';
  glow?: number;
  special?: 'lie' | 'sit' | 'kneel' | 'sitread';
  /** Arms behind the back (tied or struggling). */
  behind?: boolean;
  shake?: number;
  mouth?: 'open' | 'shout';
}

export interface AnimDef { frames: number; fps: number; repeat: boolean }

export const ANIM_DEFS: Record<AnyAnim, AnimDef> = {
  idle: { frames: 4, fps: 4, repeat: true },
  walk: { frames: 6, fps: 10, repeat: true },
  run: { frames: 6, fps: 14, repeat: true },
  sneak: { frames: 6, fps: 7, repeat: true },
  interact: { frames: 4, fps: 8, repeat: false },
  kneel: { frames: 2, fps: 2, repeat: true },
  sit: { frames: 2, fps: 2, repeat: true },
  lie: { frames: 2, fps: 1.5, repeat: true },
  cast: { frames: 4, fps: 8, repeat: false },
  attack: { frames: 4, fps: 12, repeat: false },
  shoot: { frames: 4, fps: 8, repeat: false },
  hit: { frames: 2, fps: 8, repeat: false },
  fall: { frames: 4, fps: 7, repeat: false },
  carry: { frames: 6, fps: 8, repeat: true },
  read: { frames: 4, fps: 2, repeat: true },
  'sit-read': { frames: 4, fps: 2, repeat: true },
  crouch: { frames: 2, fps: 2, repeat: true },
  sleep: { frames: 2, fps: 1, repeat: true },
  struggle: { frames: 4, fps: 8, repeat: true },
  wave: { frames: 4, fps: 6, repeat: true },
  point: { frames: 2, fps: 2, repeat: true },
  talk: { frames: 4, fps: 5, repeat: true },
  cheer: { frames: 4, fps: 6, repeat: true },
};

const base = (): Pose => ({
  bob: 0, crouch: 0, lean: 0, headX: 0, headY: 0,
  footN: { x: 0, y: 0 }, footF: { x: 0, y: 0 },
  handN: { x: 0, y: 0 }, handF: { x: 0, y: 0 },
  eyes: 'open', hair: 0, cloak: 0,
});

export type WeaponKind = 'sword' | 'scimitar' | 'axe' | 'club' | 'spear' | 'dagger' | 'bow' | 'crossbow' | 'twin-swords' | 'staff' | 'lute' | 'none';

export function weaponKind(w?: string): WeaponKind {
  switch (w) {
    case 'sword': case 'scimitar': case 'axe': case 'club': case 'spear': case 'dagger': case 'bow': case 'crossbow':
    case 'twin-swords': case 'staff': case 'lute': return w;
    case 'knife': return 'dagger';
    default: return 'none';
  }
}

/**
 * Pose for an animation frame. Coordinates are "side view" semantics: x = forward, y = down.
 * Front/back views reinterpret forward motion as lift and swing.
 */
export function pose(anim: AnyAnim, f: number, weapon: WeaponKind, bound = false): Pose {
  const p = base();
  const W = weapon;
  const carryAngle = W === 'spear' || W === 'staff' ? -Math.PI / 2 : W === 'bow' ? -Math.PI / 2 : W === 'crossbow' ? 0.2 : Math.PI / 2 - 0.25;
  p.weapon = W === 'none' ? undefined : carryAngle;
  if (W === 'twin-swords') p.weaponF = Math.PI / 2 - 0.25;
  switch (anim) {
    case 'idle': {
      p.bob = [0, 0, 1, 1][f];
      p.hair = [0, 0, 1, 0][f];
      p.handN.y = [0, 0, 1, 1][f] * 0;
      if (f === 3) p.eyes = 'closed';
      break;
    }
    case 'walk': {
      const nx = [3, 1, -1, -3, -1, 1][f];
      p.footN = { x: nx, y: [0, 0, 0, 0, -1, -1][f] };
      p.footF = { x: -nx, y: [0, -1, -1, 0, 0, 0][f] };
      p.bob = [1, 0, 0, 1, 0, 0][f];
      p.handN = { x: -Math.round(nx * 0.7), y: 0 };
      p.handF = { x: Math.round(nx * 0.7), y: 0 };
      p.hair = [1, 1, 2, 1, 1, 2][f];
      p.cloak = [1, 2, 2, 1, 2, 2][f];
      break;
    }
    case 'run': {
      const nx = [4, 2, -2, -4, -2, 2][f];
      p.footN = { x: nx, y: [0, 0, -1, -2, -2, -1][f] };
      p.footF = { x: -nx, y: [-2, -2, -1, 0, 0, -1][f] };
      p.bob = [1, 0, -1, 1, 0, -1][f];
      p.lean = 1;
      p.handN = { x: -Math.round(nx * 0.8), y: -2 };
      p.handF = { x: Math.round(nx * 0.8), y: -2 };
      p.hair = [2, 2, 3, 2, 2, 3][f];
      p.cloak = [3, 3, 4, 3, 3, 4][f];
      break;
    }
    case 'sneak': {
      const nx = [2, 1, -1, -2, -1, 1][f];
      p.crouch = 3;
      p.lean = 1;
      p.headY = 1;
      p.footN = { x: nx + 1, y: [0, 0, 0, 0, -1, -1][f] };
      p.footF = { x: -nx, y: [0, -1, -1, 0, 0, 0][f] };
      p.handN = { x: 2, y: -2 };
      p.handF = { x: 1, y: -2 };
      p.hair = 1;
      p.cloak = 1;
      break;
    }
    case 'crouch': {
      p.crouch = 4; p.lean = 1; p.headY = 1;
      p.footN = { x: 2, y: 0 }; p.footF = { x: -1, y: 0 };
      p.handN = { x: 2, y: -2 }; p.handF = { x: 1, y: -2 };
      p.bob = f;
      break;
    }
    case 'interact': {
      p.handN = [{ x: 0, y: 0 }, { x: 3, y: -1 }, { x: 4, y: 0 }, { x: 1, y: 0 }][f];
      p.lean = [0, 1, 1, 0][f];
      p.crouch = [0, 1, 1, 0][f];
      p.weaponHidden = true;
      break;
    }
    case 'kneel': {
      p.special = 'kneel';
      p.crouch = 4;
      p.footN = { x: 3, y: 0 };
      p.footF = { x: -2, y: 0 };
      p.bob = f;
      p.handN = { x: 2, y: -2 };
      p.handF = { x: 1, y: -1 };
      p.weaponHidden = true;
      break;
    }
    case 'sit': {
      p.special = 'sit';
      p.bob = f;
      p.handN = { x: 2, y: -2 };
      p.handF = { x: 2, y: -2 };
      p.weaponHidden = true;
      break;
    }
    case 'sit-read': {
      p.special = 'sitread';
      p.item = f === 2 ? 'book-flip' : 'book';
      p.handN = { x: 3, y: -3 };
      p.handF = { x: 3, y: -3 };
      p.headY = 1;
      p.bob = f === 3 ? 1 : 0;
      p.eyes = f === 1 ? 'closed' : 'open';
      p.weaponHidden = true;
      break;
    }
    case 'lie': case 'sleep': {
      p.special = 'lie';
      p.eyes = 'closed';
      p.bob = f;
      p.weaponHidden = true;
      break;
    }
    case 'cast': {
      p.handN = [{ x: -2, y: -1 }, { x: 3, y: -4 }, { x: 4, y: -3 }, { x: 4, y: -3 }][f];
      p.handF = [{ x: -1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 0 }, { x: 0, y: 0 }][f];
      p.glow = [0.3, 0.6, 1, 0.8][f];
      p.lean = [0, 1, 1, 1][f];
      p.hair = [0, 1, 2, 2][f];
      p.cloak = [0, 1, 2, 2][f];
      p.weaponHidden = true;
      break;
    }
    case 'attack': attackPose(p, f, W); break;
    case 'shoot': shootPose(p, f, W); break;
    case 'hit': {
      p.lean = [-2, -1][f];
      p.headX = [-1, 0][f];
      p.headY = [0, 0][f];
      p.eyes = 'hurt';
      p.handN = { x: -2, y: -1 };
      p.handF = { x: -2, y: -1 };
      p.hair = [-2, -1][f];
      p.cloak = [-2, -1][f];
      break;
    }
    case 'fall': {
      if (f < 3) {
        p.crouch = [1, 3, 5][f];
        p.lean = [-1, 0, 1][f];
        p.eyes = f === 0 ? 'hurt' : 'closed';
        p.handN = { x: [-1, 1, 2][f], y: [0, -1, -1][f] };
        p.handF = { x: [-1, 0, 1][f], y: 0 };
        p.footN = { x: [0, 2, 3][f], y: 0 };
        p.footF = { x: [0, -1, -2][f], y: 0 };
        if (f === 2) p.special = 'kneel';
      } else {
        p.special = 'lie';
        p.eyes = 'closed';
      }
      p.weaponHidden = f >= 2;
      break;
    }
    case 'carry': {
      const nx = [2, 1, -1, -2, -1, 1][f];
      p.footN = { x: nx, y: [0, 0, 0, 0, -1, -1][f] };
      p.footF = { x: -nx, y: [0, -1, -1, 0, 0, 0][f] };
      p.bob = [1, 0, 0, 1, 0, 0][f];
      p.handN = { x: 3, y: -3 };
      p.handF = { x: 3, y: -3 };
      p.item = 'bundle';
      p.weaponHidden = true;
      p.hair = 1;
      break;
    }
    case 'read': {
      p.item = f === 2 ? 'book-flip' : 'book';
      p.handN = { x: 3, y: -3 };
      p.handF = { x: 3, y: -3 };
      p.headY = 1;
      p.bob = f === 3 ? 1 : 0;
      p.weaponHidden = true;
      break;
    }
    case 'struggle': {
      p.behind = true;
      p.lean = [0, 1, 0, -1][f];
      p.headX = [0, 1, 0, -1][f];
      p.shake = [0, 1, 0, -1][f];
      p.eyes = f % 2 ? 'hurt' : 'open';
      p.hair = [0, 1, 0, -1][f];
      p.weaponHidden = true;
      break;
    }
    case 'wave': {
      p.handN = [{ x: 1, y: -8 }, { x: 2, y: -9 }, { x: 1, y: -8 }, { x: 0, y: -9 }][f];
      p.weaponHidden = true;
      break;
    }
    case 'point': {
      p.handN = { x: 5, y: -4 };
      p.lean = 1;
      p.bob = f;
      p.weaponHidden = true;
      break;
    }
    case 'talk': {
      p.handN = [{ x: 1, y: -2 }, { x: 2, y: -3 }, { x: 1, y: -2 }, { x: 0, y: 0 }][f];
      p.handF = [{ x: 0, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 0 }, { x: 1, y: -2 }][f];
      p.headY = [0, 0, 1, 0][f];
      p.mouth = f % 2 ? 'open' : undefined;
      p.weaponHidden = true;
      break;
    }
    case 'cheer': {
      p.handN = [{ x: 0, y: -8 }, { x: 1, y: -9 }, { x: 0, y: -8 }, { x: 1, y: -9 }][f];
      p.handF = [{ x: 0, y: -8 }, { x: 1, y: -9 }, { x: 0, y: -8 }, { x: 1, y: -9 }][f];
      p.bob = [0, -1, 0, -1][f];
      p.footN.y = [0, -1, 0, -1][f];
      p.footF.y = [0, -1, 0, -1][f];
      p.mouth = 'open';
      p.weaponHidden = true;
      break;
    }
  }
  if (bound && anim !== 'lie' && anim !== 'sleep' && p.special !== 'lie') {
    p.behind = true;
    p.weaponHidden = true;
    p.item = undefined;
    p.glow = undefined;
  }
  return p;
}

function attackPose(p: Pose, f: number, W: WeaponKind): void {
  if (W === 'spear' || W === 'staff') {
    p.handN = [{ x: -2, y: -1 }, { x: 4, y: -1 }, { x: 4, y: -1 }, { x: 1, y: 0 }][f];
    p.handF = [{ x: -1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: -1 }, { x: 0, y: 0 }][f];
    p.weapon = 0;
    p.lean = [-1, 2, 2, 0][f];
    p.footN = { x: [0, 3, 3, 1][f], y: 0 };
  } else if (W === 'dagger') {
    p.handN = [{ x: -1, y: -2 }, { x: 4, y: -2 }, { x: 3, y: -1 }, { x: 0, y: 0 }][f];
    p.weapon = 0;
    p.lean = [0, 1, 1, 0][f];
  } else if (W === 'bow' || W === 'crossbow') {
    shootPose(p, f, W);
    return;
  } else if (W === 'none' || W === 'lute') {
    p.handN = [{ x: -1, y: -2 }, { x: 4, y: -3 }, { x: 3, y: -2 }, { x: 0, y: 0 }][f];
    p.lean = [-1, 2, 1, 0][f];
    p.weaponHidden = true;
  } else {
    // overhead swing: sword, axe, club, scimitar, twin swords
    p.weapon = [-2.4, -0.6, 0.9, 1.3][f];
    p.handN = [{ x: -2, y: -7 }, { x: 3, y: -5 }, { x: 4, y: -1 }, { x: 2, y: 0 }][f];
    if (W === 'twin-swords') { p.weaponF = [-0.6, -2.4, 1.3, 0.9][f]; p.handF = [{ x: 3, y: -4 }, { x: -2, y: -6 }, { x: 2, y: 0 }, { x: 4, y: -1 }][f]; }
    p.lean = [-1, 1, 2, 1][f];
    p.crouch = [0, 0, 1, 1][f];
    p.footN = { x: [0, 2, 3, 2][f], y: 0 };
    p.hair = [-1, 1, 2, 1][f];
    p.cloak = [-1, 2, 3, 2][f];
  }
}

function shootPose(p: Pose, f: number, W: WeaponKind): void {
  if (W === 'crossbow') {
    p.weapon = 0;
    p.handN = [{ x: 2, y: -3 }, { x: 3, y: -4 }, { x: 2, y: -4 }, { x: 1, y: -1 }][f];
    p.handF = [{ x: 3, y: -3 }, { x: 4, y: -4 }, { x: 3, y: -4 }, { x: 2, y: -1 }][f];
    p.lean = [0, 0, -1, 0][f];
    p.arrow = f < 2;
    return;
  }
  // bow: held in the far hand pointing forward; near hand draws the string
  p.weapon = undefined;
  p.weaponF = -Math.PI / 2;
  p.handF = [{ x: 3, y: -4 }, { x: 4, y: -4 }, { x: 4, y: -4 }, { x: 4, y: -4 }][f];
  p.handN = [{ x: 3, y: -4 }, { x: 0, y: -4 }, { x: -1, y: -4 }, { x: 0, y: -3 }][f];
  p.bowDraw = [0, 0.6, 1, 0][f];
  p.arrow = f > 0 && f < 3;
  p.lean = [0, 0, 0, -1][f];
}

/** Total frames used by a character sheet row per anim (for tests and sheet layout). */
export function maxFrames(): number {
  return Math.max(...Object.values(ANIM_DEFS).map(a => a.frames));
}
