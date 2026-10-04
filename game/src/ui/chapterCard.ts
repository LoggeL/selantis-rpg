import { advanceGate } from './advance';
import { ctx } from './context';
import { el, html, sfx, wait } from './dom';

/** SVG flourish used under chapter titles and in journals. */
export const FLOURISH = `<svg viewBox="0 0 240 24" class="flourish" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round">
<path d="M8 12h78" stroke-width="1"/><path d="M154 12h78" stroke-width="1"/>
<path d="M86 12c8 0 10-7 18-7 6 0 8 4 8 7s-2 7-8 7c-8 0-10-7-18-7" stroke-width="1.3"/>
<path d="M154 12c-8 0-10-7-18-7-6 0-8 4-8 7s2 7 8 7c8 0 10-7 18-7" stroke-width="1.3"/>
<path d="M120 4l5 8-5 8-5-8z" fill="currentColor" stroke-width="1"/>
<circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="234" cy="12" r="1.6" fill="currentColor"/></g></svg>`;

const isRomanish = (n: string) => /^[IVXLCDM]+$/.test(n);

/** Chapter title card: an open book whose page turns to reveal numeral, title and subtitle. */
export async function chapterCard(numeral: string, title: string, subtitle?: string): Promise<void> {
  const root = el('div', 'ccard');
  const book = el('div', 'ccard-book');
  const left = el('div', 'ccard-page ccard-left ch-parch');
  const right = el('div', 'ccard-page ccard-right ch-parch');
  const leaf = el('div', 'ccard-leaf');
  const leafFront = el('div', 'ccard-leaf-face ccard-leaf-front ch-parch');
  const leafBack = el('div', 'ccard-leaf-face ccard-leaf-back ch-parch');

  // Left page (revealed on the leaf's back): the chronicle's emblem.
  const emblem = html('div', 'ccard-emblem', `
    <div class="ccard-emblem-star"><svg viewBox="0 0 64 64"><g fill="currentColor">
      <path d="M32 4l3.2 24.8L60 32l-24.8 3.2L32 60l-3.2-24.8L4 32l24.8-3.2z" opacity=".9"/>
      <path d="M32 18l1.4 12.6L46 32l-12.6 1.4L32 46l-1.4-12.6L18 32l12.6-1.4z" opacity=".55" transform="rotate(45 32 32)"/></g></svg></div>
    <div class="ccard-emblem-title">Die Chroniken<br>von Selantis</div>${FLOURISH}
    <div class="ccard-emblem-sub">Das Buch der Schwestern</div>`);
  leafBack.appendChild(emblem);
  leafFront.appendChild(html('div', 'ccard-faint', '❦'));
  left.appendChild(html('div', 'ccard-faint', '❦'));

  const isWord = !isRomanish(numeral);
  const content = el('div', 'ccard-content');
  if (!isWord) content.appendChild(el('div', 'ccard-kicker', 'Kapitel'));
  content.appendChild(el('div', isWord ? 'ccard-numeral is-word' : 'ccard-numeral', numeral));
  content.appendChild(html('div', 'ccard-orn', FLOURISH));
  content.appendChild(el('div', 'ccard-title', title));
  if (subtitle) content.appendChild(el('div', 'ccard-sub', subtitle));
  right.appendChild(content);

  leaf.append(leafFront, leafBack);
  book.append(left, right, leaf, el('div', 'ccard-spine'));
  root.appendChild(book);
  ctx.layers.card.appendChild(root);

  let revealed = false;
  let revealedAt = Infinity;
  let skip!: () => void;
  const skipped = new Promise<void>(r => { skip = r; });
  let resolveWait!: () => void;
  const waited = new Promise<void>(r => { resolveWait = r; });
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    revealedAt = performance.now();
    root.classList.add('is-turned', 'is-revealed');
  };
  const gate = advanceGate('chapterCard', () => {
    if (!revealed) { root.classList.add('is-skip'); reveal(); skip(); return; }
    if (performance.now() - revealedAt < 250) return;
    resolveWait();
  }, { layer: 'card', allowMenu: false, graceMs: 200 });

  try {
    requestAnimationFrame(() => root.classList.add('is-in'));
    await Promise.race([wait(ctx.reducedMotion ? 150 : 700), skipped]);
    if (!revealed) {
      sfx('page', { volume: 0.9 });
      root.classList.add('is-turned');
    }
    await Promise.race([wait(ctx.reducedMotion ? 200 : 1250), skipped]);
    reveal();
    await Promise.race([wait(4200), waited]);
  } finally {
    gate.close();
    root.classList.add('is-out');
    await wait(ctx.reducedMotion ? 150 : 700);
    root.remove();
  }
}
