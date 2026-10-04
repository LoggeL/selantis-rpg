import { ctx } from './context';
import { el, wait } from './dom';

/** Full-screen DOM fade and cinematic letterbox bars. */
export class FxUi {
  private fadeEl: HTMLElement;
  private bars: HTMLElement;
  private fadeToken = 0;
  opaque = false;

  constructor() {
    this.fadeEl = el('div', 'fade');
    this.bars = el('div', 'letterbox');
    this.bars.append(el('div', 'lb lb-top'), el('div', 'lb lb-bottom'));
  }

  mount(): void {
    ctx.layers.fade.appendChild(this.fadeEl);
    ctx.layers.letterbox.appendChild(this.bars);
  }

  async fade(dir: 'out' | 'in', ms = 600, color = '#07080c'): Promise<void> {
    const token = ++this.fadeToken;
    const node = this.fadeEl;
    const dur = ctx.reducedMotion ? Math.min(ms, 200) : ms;
    node.style.background = color;
    node.style.transitionDuration = `${dur}ms`;
    if (dir === 'out') {
      node.style.visibility = 'visible';
      void node.offsetWidth;
      node.style.opacity = '1';
      this.opaque = true;
    } else {
      node.style.opacity = '0';
      this.opaque = false;
    }
    await wait(dur + 20);
    if (token === this.fadeToken && dir === 'in') node.style.visibility = 'hidden';
  }

  /** Instantly clears the fade (reset). */
  clearFade(): void {
    this.fadeToken++;
    this.fadeEl.style.transitionDuration = '0ms';
    this.fadeEl.style.opacity = '0';
    this.fadeEl.style.visibility = 'hidden';
    this.opaque = false;
  }

  letterbox(on: boolean): void {
    this.bars.classList.toggle('on', on);
    ctx.root.classList.toggle('has-letterbox', on);
  }
}
