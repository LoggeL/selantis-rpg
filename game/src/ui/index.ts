// TEMPORARY STUB — replaced by the UI agent. Minimal, unstyled, but functional.
import { inputLock } from '../core/input';
import { speaker } from '../core/catalog';
import type { ChoiceOption, UiApi } from './api';

export function createUi(): UiApi {
  let root: HTMLElement;
  let modal = 0;
  const box = (html: string) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;left:5%;right:5%;bottom:4%;background:#141a26ee;color:#efe3c8;padding:12px 16px;font:18px Alegreya,serif;border:1px solid #d8b25a;pointer-events:auto';
    el.innerHTML = html; root.appendChild(el); return el;
  };
  const waitContinue = (el: HTMLElement) => new Promise<void>(resolve => {
    modal++; inputLock.push();
    const done = () => { window.removeEventListener('keydown', key); el.remove(); modal--; inputLock.pop(); resolve(); };
    const key = (e: KeyboardEvent) => { if ([' ', 'Enter', 'e', 'E'].includes(e.key)) done(); };
    setTimeout(() => { window.addEventListener('keydown', key); el.addEventListener('click', done); }, 150);
  });
  const api: UiApi = {
    mount(r) { root = r; },
    say: (s, t) => waitContinue(box(`<b>${speaker(s).name}</b><br>${t}`)),
    async choose(options, opts) {
      return new Promise(resolve => {
        modal++; inputLock.push();
        const el = box(opts?.prompt ?? '');
        options.forEach((o, i) => {
          const opt: ChoiceOption = typeof o === 'string' ? { text: o } : o;
          const b = document.createElement('button'); b.textContent = `${i + 1}. ${opt.text}`; b.disabled = !!opt.disabled;
          b.style.cssText = 'display:block;margin:4px 0'; b.onclick = () => { el.remove(); modal--; inputLock.pop(); resolve(i); };
          el.appendChild(b);
        });
      });
    },
    async narrate(lines) { for (const l of Array.isArray(lines) ? lines : [lines]) await waitContinue(box(`<i>${l}</i>`)); },
    think: t => waitContinue(box(`<i>${t}</i>`)),
    async plate(id, opts) { const el = document.createElement('img'); el.dataset.plate = id; el.src = `art/plates/${id}.jpg`; el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'; root.prepend(el); void opts; },
    async closePlate() { root.querySelectorAll('[data-plate]').forEach(e => e.remove()); },
    chapterCard: (n, t, s) => waitContinue(box(`<h2>${n}: ${t}</h2>${s ?? ''}`)),
    async fade() {},
    letterbox() {},
    caption: (t) => waitContinue(box(`<center>${t}</center>`)),
    toast(t) { const el = box(t); el.style.bottom = '80%'; setTimeout(() => el.remove(), 2000); },
    objective(t) { console.info('[objective]', t); },
    objectivePointer() {},
    hint() {},
    bubble() { return () => {}; },
    hold: (label) => waitContinue(box(`Halte: ${label}`)),
    panel(cls) { const el = document.createElement('div'); el.className = cls ?? ''; el.style.cssText = 'position:absolute;inset:0;pointer-events:auto'; root.appendChild(el); return el; },
    openJournal() {}, openBag() {}, openMenu() {},
    async title() { return 'new'; },
    setHud() {},
    busy: () => modal > 0,
  };
  return api;
}
