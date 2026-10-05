import { voiceover } from '../audio/voiceover';
import { advanceGate } from './advance';
import { ctx } from './context';
import { FLOURISH } from './chapterCard';
import { dialogueFocus, el, html, sfx, wait } from './dom';
import { revealWords, Typewriter } from './typewriter';

const MORE = '<svg viewBox="0 0 12 12"><path d="M2 3.5h8L6 9z" fill="currentColor"/></svg>';

/** Book narration (parchment page), card narration (over darkness) and thought lines. */
export class NarrationUi {
  async narrate(lines: string | string[], style: 'book' | 'card' | 'thought' = 'book'): Promise<void> {
    const token = ctx.epoch;
    await voiceover.preload();
    if (ctx.stale() || token !== ctx.epoch) return ctx.never();
    const beats = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    if (!beats.length) return;
    const wrap = el('div', `narr narr-${style}`);
    const page = el('div', style === 'book' ? 'narr-page ch-parch' : 'narr-box');
    const text = el('div', 'narr-text');
    const more = el('div', 'dlg-more');
    more.innerHTML = MORE;
    if (style === 'book') {
      page.appendChild(html('div', 'narr-orn narr-orn-top', FLOURISH));
      page.append(text, html('div', 'narr-orn narr-orn-bottom', FLOURISH), more);
    } else {
      page.append(text, more);
    }
    wrap.appendChild(page);
    ctx.layers.dialog.appendChild(wrap);
    dialogueFocus(true);
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    if (style === 'book') sfx('page', { volume: 0.6 });
    try {
      for (let i = 0; i < beats.length; i++) {
        if (i > 0) {
          text.classList.add('is-turn');
          if (style === 'book') sfx('page', { volume: 0.45, pitch: 1.1 });
          await wait(ctx.reducedMotion ? 40 : 220);
          text.classList.remove('is-turn');
        }
        await this.beat(text, more, beats[i], style);
      }
    } finally {
      wrap.classList.remove('is-in');
      wrap.classList.add('is-out');
      dialogueFocus(false);
      setTimeout(() => wrap.remove(), 420);
    }
  }

  private beat(text: HTMLElement, more: HTMLElement, line: string, style: 'book' | 'card' | 'thought'): Promise<void> {
    const recording = voiceover.play('narrate', 'narrator', line);
    more.classList.remove('on');
    text.classList.remove('rw-all');
    return new Promise(resolve => {
      let completedAt = 0;
      const onDone = () => { completedAt = performance.now(); more.classList.add('on'); };
      const reveal = style === 'thought'
        ? new Typewriter(text, line, { onDone })
        : revealWords(text, line, onDone, style === 'card' ? 95 : 60, style === 'book');
      const gate = advanceGate(`narrate:${style}`, () => {
        if (!reveal.done) { reveal.complete(); return; }
        if (performance.now() - completedAt < 160) return;
        gate.close();
        recording?.stop();
        resolve();
      }, { graceMs: 120 });
    });
  }

  /** Large centered caption over black. Leaves the screen as it found it (keeps an existing fade). */
  async caption(textValue: string, ms = 2600): Promise<void> {
    const layer = el('div', 'caption');
    const line = el('div', 'caption-text', textValue);
    const orn = el('div', 'caption-orn');
    layer.append(line, orn);
    ctx.layers.card.appendChild(layer);
    const closeModal = ctx.open({ id: 'caption', passive: false });
    try {
      requestAnimationFrame(() => layer.classList.add('is-in'));
      await wait(ctx.reducedMotion ? 300 : 900);
      line.classList.add('is-on');
      await wait(Math.max(800, ms));
      line.classList.remove('is-on');
      line.classList.add('is-off');
      await wait(ctx.reducedMotion ? 200 : 800);
      layer.classList.remove('is-in');
      await wait(ctx.reducedMotion ? 200 : 700);
    } finally {
      layer.remove();
      closeModal();
    }
  }
}
