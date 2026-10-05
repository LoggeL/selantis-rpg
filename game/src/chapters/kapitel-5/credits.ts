// Kapitel V: closing credits in book style („Ende des ersten Buches“), then back to the title.
import { G } from '../../core/G';
import { ctx, isConfirm } from '../../ui/context';
import { FLOURISH } from '../../ui/chapterCard';
import { ensureStyles } from './styles';

const PAGES = `
  <h1>Ende des ersten Buches</h1>
  <div class="flourish">${FLOURISH}</div>
  <p>Die Chroniken von Selantis</p>
  <p><em>Das Buch der Schwestern</em></p>
  <h2>Was bisher geschah</h2>
  <p>Ein Hof, ein Überfall, ein Versprechen.<br>Eine Schwester, die nicht aufgab.<br>Und ein Licht, das niemand erklären kann.</p>
  <p class="k5-turq">Die Urmacht hat ihre Trägerin gewählt.</p>
  <h2>Figuren</h2>
  <p>Lia · Kyra · Flick<br>Foltan · Azar<br>Elnon · Alastir · Craupor<br>Baris · Orwen · Algard · „Mädchen“<br>Valentus<br>und der Meister</p>
  <h2>Nach dem Roman und den Filmen</h2>
  <p>„Die Chroniken von Selantis“</p>
  <p class="k5-small">Bilder gemalt mit der Codex-Bildgenerierung · Musik aus den Filmen · Geräusche aus dem Code</p>
  <div class="flourish">${FLOURISH}</div>
  <p><em>Fortsetzung folgt im zweiten Buch.</em></p>
`;

/** Shows the credits; resolves when they ran through or the player skipped them (E / Space / click). */
export function showCredits(): Promise<void> {
  ensureStyles();
  if (ctx.stale()) return new Promise(() => {});
  const root = G.ui.panel('k5-credits');
  root.innerHTML = `<div class="k5-credits-page ch-parch"><div class="k5-credits-roll">${PAGES}</div></div>
    <div class="k5-credits-hint">${ctx.root.classList.contains('is-touch') ? 'Tippen zum Fortfahren' : 'E · Leertaste · Klick zum Fortfahren'}</div>`;
  const page = root.querySelector('.k5-credits-page') as HTMLElement;
  const roll = root.querySelector('.k5-credits-roll') as HTMLElement;
  return new Promise<void>(resolve => {
    let done = false;
    let opened = performance.now();
    const finish = () => {
      if (done || performance.now() - opened < 4000) return;
      done = true;
      closeModal();
      root.classList.remove('is-in');
      root.classList.add('is-out');
      setTimeout(() => { root.remove(); resolve(); }, 1200);
    };
    const closeModal = ctx.open({
      id: 'k5-credits', allowMenu: false,
      onKey: e => { if (isConfirm(e) && !e.repeat) finish(); return true; },
    });
    root.addEventListener('pointerdown', e => { e.preventDefault(); finish(); });
    requestAnimationFrame(() => {
      root.classList.add('is-in');
      opened = performance.now();
      const overflow = Math.max(0, roll.scrollHeight - page.clientHeight + 40);
      const ms = ctx.reducedMotion ? 0 : 6000 + overflow * 45;
      setTimeout(() => {
        roll.style.transitionDuration = `${ms}ms`;
        roll.style.transform = `translateY(-${overflow}px)`;
      }, 2600);
      setTimeout(() => { if (!done) { opened = 0; finish(); } }, 2600 + ms + 6000);
    });
  });
}
