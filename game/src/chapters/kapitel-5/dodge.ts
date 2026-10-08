// Kapitel V: „Drei Atemzüge“ – the ghoul attack in the rain forest. Lia is no fighter, but she sees: each time the
// Leichenfresser comes, the painted cut-in shows how (crouched with the axe low, the axe high over the bone mask,
// gone into the ferns and only listening), and the player picks what Lia does with what is around her: jump onto the
// root arch, jump behind the beech, throw the wet cloak aside as a decoy. Only one answer fits each swing; a wrong one or freezing (the breath bar
// runs out) costs a scratch and the swing is lost, not repeated. Flick's arrow ends it either way.
// Staged with G.ui.scenePick over the painted cut-in (assets/minigames/k5-dodge-*, Codex, prompts in
// docs/rebuild/art/minigames.json): forest backdrop, the ghoul (wind-up / strike), Lia (ready / dodge / hurt).
import { G } from '../../core/G';
import { assetUrl, manifest } from '../../art/manifest';
import { ctx } from '../../ui/context';
import type { PickCard, PickLine, PickRound } from '../../ui/scenePick';
import { ensureStyles } from './styles';

export type Cue = 'tief' | 'hoch' | 'versteckt';
export type Move = 'wurzel' | 'stamm' | 'mantel';

export const MOVES: readonly (PickCard & { id: Move })[] = [
  { id: 'wurzel', text: 'Auf den Wurzelbogen springen' },
  { id: 'stamm', text: 'Hinter die Buche springen' },
  { id: 'mantel', text: 'Den nassen Mantel als Köder zur Seite werfen' },
];

export interface Swing {
  cue: Cue;
  /** What the player sees as the ghoul hauls back. */
  tell: string;
  answer: Move;
  ok: string;
  /** Lia's line for each wrong move (the right one stays empty). */
  wrong: Record<Move, string>;
}

export const SWINGS: readonly Swing[] = [
  {
    cue: 'tief', answer: 'wurzel',
    tell: 'Er duckt sich tief, die Axt pendelt auf Kniehöhe hin und her. Der Hieb wird flach kommen, quer über den Boden.',
    ok: 'Ich spring auf den Wurzelbogen. Die Klinge fegt unter mir durch und reißt Farn aus dem Matsch.',
    wrong: {
      wurzel: '',
      stamm: 'Hinter der Buche bin ich zu langsam. Die Schneide erwischt mich am Schienbein, bevor ich dort bin.',
      mantel: 'Ein Köder nützt nichts, wenn er mich längst sieht. Die Axt fegt mir die Beine weg, ich lande im Matsch.',
    },
  },
  {
    cue: 'hoch', answer: 'stamm',
    tell: 'Beide Fäuste am Schaft, die Axt steigt hoch über die Knochenmaske. Sie wird senkrecht von oben kommen.',
    ok: 'Ich spring hinter die Buche. Die Axt fährt von oben in den Stamm und bleibt stecken. Er zerrt daran und brüllt.',
    wrong: {
      wurzel: 'Oben auf der Wurzel steh ich ihm genau entgegen. Der Schaft kracht mir auf die Schulter.',
      stamm: '',
      mantel: 'Er schaut mich direkt an, da lockt ihn kein Mantel weg. Die Klinge streift meinen Arm.',
    },
  },
  {
    cue: 'versteckt', answer: 'mantel',
    tell: 'Er ist im Farn verschwunden. Es knackt, mal links, mal rechts. Er schnüffelt. Im Regen sieht er kaum besser als ich.',
    ok: 'Ich werf den nassen Mantel nach links. Die Axt fährt mitten hinein, und ich bin schon rechts weg.',
    wrong: {
      wurzel: 'Auf der Wurzel bin ich das einzige, was sich bewegt. Er kommt aus dem Farn wie ein Hund auf eine Ratte.',
      stamm: 'Ich renne zur Buche, und das Rascheln verrät mich. Die Klaue reißt mir über den Rücken.',
      mantel: '',
    },
  },
];

/** Flick's first remark, by what Lia pulled off (she watched from the trees). */
export function flickOnTricks(tricks: readonly string[]): string | null {
  if (tricks.includes('mantel')) return 'Den Mantel als Köder? Nicht schlecht, Bauernmädchen. Hab ich so auch noch nicht gesehen.';
  if (tricks.includes('stamm')) return 'Ihn die Axt in einen Baum hauen lassen. Gemein. Gefällt mir.';
  if (tricks.includes('wurzel')) return 'Auf die Wurzel gehüpft wie ein Eichhörnchen. Das meine ich als Lob.';
  return null;
}

/** Picked when the breath bar runs out. */
export const FROZEN = 'erstarrt';
export const FROZEN_LINE = 'Ich steh da wie ein Pfosten. Kein Gedanke, nur die Klinge.';
/** Seconds of thought per swing (generous: this is about seeing, not reflexes). */
export const BREATH_MS = 9000;

/** Judges one swing (pure, unit-tested). */
export function judgeSwing(swing: Swing, pick: string): { ok: boolean; line: string } {
  if (pick === swing.answer) return { ok: true, line: swing.ok };
  if (pick === FROZEN) return { ok: false, line: FROZEN_LINE };
  return { ok: false, line: swing.wrong[pick as Move] || FROZEN_LINE };
}

export interface GhoulOptions {
  /** A swing starts (telegraph: the world ghoul winds up). */
  onWindup?(i: number, swing: Swing): void;
  /** Result of a swing (animate dodge / hit in the world). Awaited before the reply. */
  onResult?(ok: boolean, i: number, pick: string): Promise<void> | void;
}

/** URL of a painted cut-in image (manifest first, conventional path as fallback). */
const art = (key: string, ext = 'png') => assetUrl(manifest().images?.[`minigames/${key}`]?.file ?? `assets/minigames/${key}.${ext}`);
const reduced = () => ctx.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const sfx = (name: Parameters<typeof G.audio.sfx>[0], opts?: Parameters<typeof G.audio.sfx>[1]) => { try { G.audio.sfx(name, opts); } catch { /* audio optional */ } };

/** Rain streaks over the cut-in (a light canvas effect; static drizzle with reduced motion). */
function startRain(canvas: HTMLCanvasElement, root: HTMLElement): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  let w = 0;
  let h = 0;
  type Drop = { x: number; y: number; l: number; v: number; a: number };
  let drops: Drop[] = [];
  const spawn = (d: Drop, top: boolean) => {
    d.x = Math.random() * (w + h * 0.3) - h * 0.15;
    d.y = top ? -Math.random() * h * 0.3 : Math.random() * h;
    d.l = 10 + Math.random() * 26;
    d.v = 0.9 + Math.random() * 0.8;
    d.a = 0.12 + Math.random() * 0.3;
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (Math.round(r.width) === w && Math.round(r.height) === h) return;
    w = canvas.width = Math.max(1, Math.round(r.width));
    h = canvas.height = Math.max(1, Math.round(r.height));
    const n = Math.min(260, Math.round((w * h) / 4200));
    drops = Array.from({ length: n }, () => { const d = { x: 0, y: 0, l: 0, v: 0, a: 0 }; spawn(d, false); return d; });
  };
  const draw = (dt: number) => {
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    for (const d of drops) {
      d.y += d.v * dt * 1.15;
      d.x -= d.v * dt * 0.2;
      if (d.y - d.l > h) spawn(d, true);
      g.strokeStyle = `rgba(196, 210, 236, ${d.a.toFixed(3)})`;
      g.lineWidth = d.l > 28 ? 1.6 : 1;
      g.beginPath();
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + d.l * 0.17, d.y - d.l);
      g.stroke();
    }
  };
  resize();
  if (reduced()) { draw(0); return; }
  let last = performance.now();
  const loop = (now: number) => {
    if (!root.isConnected || root.dataset.state === 'done') return;
    resize();
    draw(Math.min(50, now - last));
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}


/** The painted fight cut-in as the stage of a scene pick. Resolves with the number of scratches. */
export async function ghoulFight(opts: GhoulOptions = {}): Promise<number> {
  ensureStyles();
  let cut: HTMLElement | null = null;
  const lia: PickLine = { speaker: 'k5-lia', text: '' };
  const rounds: PickRound[] = SWINGS.map((swing, i) => ({
    cue: swing.cue,
    prompt: { text: swing.tell },
    cards: MOVES.map(m => ({ ...m })),
    timeoutMs: BREATH_MS,
    timeoutPick: FROZEN,
    judge: pick => {
      const v = judgeSwing(swing, pick);
      return { ok: v.ok, endRound: true, mood: v.ok ? 'good' : 'hurt', reply: { ...lia, text: v.line } };
    },
  }));
  const result = await G.ui.scenePick({
    label: 'Drei Atemzüge',
    help: 'Sieh hin, wie er ausholt, und nutz, was um dich ist. Der Balken ist dein Atem.',
    layout: 'row',
    className: 'k5-ghoul',
    rounds,
    decorate(stage) {
      cut = document.createElement('div');
      cut.className = 'k5-qte k5-ghoul-cut';
      cut.setAttribute('aria-hidden', 'true');
      cut.innerHTML = `
        <div class="k5-qte-scene">
          <div class="k5-qte-bg" style="background-image:url('${art('k5-dodge-bg', 'jpg')}')"></div>
          <div class="k5-qte-mist"></div>
          <div class="k5-qte-fig k5-qte-ghoul"><div class="k5-qte-shadow"></div>
            <img class="pose-windup" alt="" draggable="false" src="${art('k5-dodge-ghoul-windup')}">
            <img class="pose-strike" alt="" draggable="false" src="${art('k5-dodge-ghoul-strike')}"></div>
          <div class="k5-qte-impact"></div>
          <div class="k5-qte-fig k5-qte-lia"><div class="k5-qte-shadow"></div>
            <img class="pose-ready" alt="" draggable="false" src="${art('k5-dodge-lia-ready')}">
            <img class="pose-dodge" alt="" draggable="false" src="${art('k5-dodge-lia-dodge')}">
            <img class="pose-hurt" alt="" draggable="false" src="${art('k5-dodge-lia-hurt')}"></div>
          <canvas class="k5-qte-rain"></canvas>
          <div class="k5-qte-vignette"></div>
        </div>`;
      stage.prepend(cut);
      startRain(cut.querySelector('.k5-qte-rain') as HTMLCanvasElement, cut);
      requestAnimationFrame(() => cut?.classList.add('is-in'));
      if (!reduced()) sfx('thunder', { volume: 0.35 });
    },
    onRound(i) {
      if (!cut) return;
      cut.classList.remove('is-good', 'is-bad', 'fx-dodge', 'fx-hurt');
      cut.dataset.cue = SWINGS[i].cue;
      cut.classList.add('is-run');
      sfx('whoosh', { volume: 0.45 });
      opts.onWindup?.(i, SWINGS[i]);
    },
    async onVerdict(v, i, pick) {
      if (cut) {
        cut.classList.remove('is-run');
        cut.classList.add(v.ok ? 'is-good' : 'is-bad', v.ok ? 'fx-dodge' : 'fx-hurt');
      }
      await opts.onResult?.(v.ok, i, pick);
    },
  });
  if (cut) (cut as HTMLElement).dataset.state = 'done';
  return result.mistakes;
}
