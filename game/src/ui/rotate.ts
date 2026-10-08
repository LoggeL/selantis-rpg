import { ctx } from './context';
import { el, icon, sfx } from './dom';

const KEY = 'selantis.rotateHint.dismissed';
const PHONE_SVG = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><rect x="10" y="4" width="12" height="24" rx="2.2"/><path d="M14.5 7h3" /><circle cx="16" cy="24.5" r=".9" fill="currentColor"/><path d="M26 11.5a8 8 0 0 1 1.5 6" opacity=".7"/><path d="M27.8 15.6l-.3 2.2-2-1" opacity=".7"/></svg>';

function dismissed(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/**
 * Portrait phones: a dismissable hint that the game is nicest in landscape. Remembered in localStorage
 * once closed; disappears by itself when the phone is turned, and steps aside after a while (it comes
 * back on the next visit until it was closed once).
 */
export class RotateHint {
  private layer!: HTMLElement;
  private node: HTMLElement | null = null;
  /** Shown long enough this session: stays away until the next page load. */
  private retired = false;
  private timer = 0;

  mount(): void {
    // Keep the hint above the title and below modal overlays, in its own layer.
    this.layer = el('div', 'ui-layer ui-layer-rotate-hint');
    ctx.root.appendChild(this.layer);
    ctx.onLayout(() => this.sync());
    this.sync();
  }

  private wanted(): boolean {
    return !this.retired && ctx.portrait && Math.min(window.innerWidth, window.innerHeight) < 820 && !dismissed();
  }

  private sync(): void {
    if (this.wanted()) this.show(); else this.hide();
  }

  private show(): void {
    if (this.node) return;
    const node = el('div', 'rotate-hint ch-panel');
    node.setAttribute('role', 'note');
    const ico = el('span', 'rotate-hint-ico');
    ico.innerHTML = PHONE_SVG;
    const text = el('div', 'rotate-hint-text');
    text.append(el('div', 'rotate-hint-title', 'Am schönsten im Querformat'), el('div', 'rotate-hint-sub', 'Dreh dein Handy für größere Bilder.'));
    const close = el('button', 'rotate-hint-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Hinweis schließen');
    close.appendChild(icon('close'));
    const dismiss = (e: Event) => {
      e.preventDefault(); e.stopPropagation();
      this.retired = true;
      try { localStorage.setItem(KEY, '1'); } catch { /* storage optional */ }
      sfx('ui-close', { volume: 0.5 });
      this.hide();
    };
    close.addEventListener('click', dismiss);
    node.addEventListener('pointerdown', e => e.stopPropagation());
    node.append(ico, text, close);
    this.layer.appendChild(node);
    this.node = node;
    requestAnimationFrame(() => { if (this.node === node) node.classList.add('is-in'); });
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.retired = true; this.hide(); }, 12000);
  }

  private hide(): void {
    clearTimeout(this.timer);
    this.timer = 0;
    const node = this.node;
    if (!node) return;
    this.node = null;
    node.inert = true;
    node.setAttribute('aria-hidden', 'true');
    node.classList.remove('is-in');
    setTimeout(() => node.remove(), 500);
  }
}
