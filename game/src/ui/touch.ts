import { virtualInput } from '../core/input';
import { ctx } from './context';
import { el, icon, sfx } from './dom';

/**
 * Touch controls (explore HUD on touch devices, or with ?touch): a floating virtual stick that appears
 * where the thumb lands (lower left), a big action button (right), a run toggle and contextual hold
 * buttons (Schleichen, Spurenblick). Writes core/input virtualInput.
 */
export class TouchUi {
  private root = el('div', 'touch');
  private zone = el('div', 'touch-zone');
  private base = el('div', 'touch-stick');
  private knob = el('div', 'touch-knob');
  private action = el('button', 'touch-btn touch-action');
  private actionVerb = el('span', 'touch-action-verb');
  private run = el('button', 'touch-btn touch-run');
  private sneak = el('button', 'touch-btn touch-ctx touch-sneak');
  private look = el('button', 'touch-btn touch-ctx touch-look');
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };
  /** A finger that landed in the zone but has not moved far enough to become the stick (maybe a tap). */
  private pending: { id: number; x: number; y: number; t: number } | null = null;
  /** Short taps in the stick zone (not a drag): world tap-to-walk or tapping the hint. Client coordinates. */
  onTap: (x: number, y: number) => void = () => {};

  constructor() {
    this.base.appendChild(this.knob);
    this.action.type = this.run.type = this.sneak.type = this.look.type = 'button';
    this.action.append(icon('hand'), this.actionVerb);
    this.action.setAttribute('aria-label', 'Aktion');
    this.run.append(icon('run'), el('span', 'touch-label', 'Rennen'));
    this.sneak.append(icon('sneak'), el('span', 'touch-label', 'Schleichen'));
    this.look.append(icon('eye'), el('span', 'touch-label', 'Spurenblick'));
    this.sneak.hidden = this.look.hidden = true;
    const right = el('div', 'touch-right');
    right.append(this.look, this.sneak, this.run, this.action);
    this.root.append(this.zone, this.base, right);

    this.zone.addEventListener('pointerdown', e => this.stickDown(e));
    this.zone.addEventListener('pointermove', e => this.stickMove(e));
    this.zone.addEventListener('pointerup', e => this.stickUp(e));
    this.zone.addEventListener('pointercancel', e => this.stickUp(e));

    this.action.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      virtualInput.actionPressed = true;
      this.press(this.action);
    });
    this.run.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      virtualInput.run = !virtualInput.run;
      this.run.classList.toggle('on', virtualInput.run);
      sfx('ui-move', { volume: 0.4 });
    });
    const holdBtn = (btn: HTMLElement, key: 'sneak' | 'look') => {
      btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); btn.setPointerCapture?.(e.pointerId); virtualInput[key] = true; btn.classList.add('on'); });
      const up = () => { virtualInput[key] = false; btn.classList.remove('on'); };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    };
    holdBtn(this.sneak, 'sneak');
    holdBtn(this.look, 'look');
    // While a modal is open the stick must not keep pushing the player.
    new MutationObserver(() => { if (ctx.root.classList.contains('is-modal')) this.resetStick(); }).observe(ctx.root ?? document.body, { attributes: true, attributeFilter: ['class'] });
  }

  mount(): void { ctx.layers.touch.appendChild(this.root); }

  /** Action button label follows the current interaction hint. */
  setVerb(verb: string | null): void {
    this.actionVerb.textContent = verb ?? '';
    this.action.classList.toggle('has-verb', Boolean(verb));
  }

  setExtras(opts: { sneak?: boolean; look?: boolean }): void {
    if (opts.sneak !== undefined) this.sneak.hidden = !opts.sneak;
    if (opts.look !== undefined) this.look.hidden = !opts.look;
  }

  private press(btn: HTMLElement): void {
    btn.classList.remove('is-press');
    void btn.offsetWidth;
    btn.classList.add('is-press');
  }

  private radius(): number { return Math.max(34, ctx.fontPx * 2.6); }

  /** The stick only starts once the finger moved this far; shorter touches are taps. */
  private static readonly DRAG_PX = 11;
  private static readonly TAP_MS = 260;

  private stickDown(e: PointerEvent): void {
    if (this.stickId !== null || this.pending) return;
    e.preventDefault();
    this.zone.setPointerCapture?.(e.pointerId);
    this.pending = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  }

  private startStick(id: number, x: number, y: number): void {
    this.stickId = id;
    this.origin = { x, y };
    this.base.style.transform = `translate(${x}px, ${y}px)`;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.base.classList.add('on');
  }

  private stickMove(e: PointerEvent): void {
    const p = this.pending;
    if (p && e.pointerId === p.id) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < TouchUi.DRAG_PX) return;
      this.pending = null;
      this.startStick(p.id, p.x, p.y); // the stick appears where the thumb landed
    }
    if (e.pointerId !== this.stickId) return;
    const R = this.radius();
    let dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
    const len = Math.hypot(dx, dy);
    // Floating stick: drag the base along when the thumb goes far beyond the rim.
    if (len > R * 1.6) {
      const k = (len - R * 1.6) / len;
      this.origin.x += dx * k; this.origin.y += dy * k;
      this.base.style.transform = `translate(${this.origin.x}px, ${this.origin.y}px)`;
      dx = e.clientX - this.origin.x; dy = e.clientY - this.origin.y;
    }
    const l2 = Math.hypot(dx, dy);
    const cl = Math.min(R, l2);
    const nx = l2 ? dx / l2 : 0, ny = l2 ? dy / l2 : 0;
    this.knob.style.transform = `translate(calc(-50% + ${nx * cl}px), calc(-50% + ${ny * cl}px))`;
    const mag = cl / R;
    const dead = 0.18;
    const m = mag < dead ? 0 : (mag - dead) / (1 - dead);
    virtualInput.x = Math.round(nx * m * 100) / 100;
    virtualInput.y = Math.round(ny * m * 100) / 100;
  }

  private stickUp(e: PointerEvent): void {
    const p = this.pending;
    if (p && e.pointerId === p.id) {
      this.pending = null;
      if (e.type === 'pointerup' && performance.now() - p.t < TouchUi.TAP_MS) this.onTap(p.x, p.y);
      return;
    }
    if (e.pointerId !== this.stickId) return;
    this.resetStick();
  }

  private resetStick(): void {
    this.pending = null;
    this.stickId = null;
    virtualInput.x = 0;
    virtualInput.y = 0;
    this.base.classList.remove('on');
  }
}
