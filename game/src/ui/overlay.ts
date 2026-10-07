import { ctx, type LayerName } from './context';
import { el, icon, sfx } from './dom';

export interface OverlayHandle {
  root: HTMLElement;
  panel: HTMLElement;
  body: HTMLElement;
  close(): void;
  readonly closed: boolean;
}

/**
 * Modal overlay (journal, bag, menu, debug). Dims the game, locks input, closes with Esc or the ✕ button
 * (and `closeKeys`). `onKey` gets every other key first.
 */
export function openOverlay(opts: {
  id: string;
  className: string;
  title?: string;
  layer?: LayerName;
  closeKeys?: string[];
  onKey?: (e: KeyboardEvent) => boolean;
  onClose?: () => void;
  /** Return false to veto closing via Esc (e.g. go back a sub page instead). */
  onEscape?: () => boolean;
  panelClass?: string;
  sound?: boolean;
}): OverlayHandle {
  const root = el('div', `overlay ${opts.className}`);
  const scrim = el('div', 'overlay-scrim');
  const panel = el('div', opts.panelClass ?? 'overlay-panel ch-panel');
  const body = el('div', 'overlay-body');
  if (opts.title) {
    const head = el('div', 'overlay-head');
    head.appendChild(el('h2', 'overlay-title', opts.title));
    panel.appendChild(head);
  }
  const closeBtn = el('button', 'overlay-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.appendChild(icon('close'));
  panel.append(body, closeBtn);
  root.append(scrim, panel);
  ctx.layers[opts.layer ?? 'overlay'].appendChild(root);
  requestAnimationFrame(() => root.classList.add('is-in'));
  if (opts.sound !== false) sfx('ui-open', { volume: 0.7 });

  let closed = false;
  const closeModal = ctx.open({
    id: opts.id,
    allowMenu: false,
    pauseVoice: true,
    onKey: e => {
      if (e.key === 'Escape' || opts.closeKeys?.includes(e.key)) {
        if (e.repeat) return true;
        if (e.key === 'Escape' && opts.onEscape && opts.onEscape() === false) return true;
        handle.close();
        return true;
      }
      if (opts.onKey?.(e)) return true;
      return e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Enter';
    },
  });
  const handle: OverlayHandle = {
    root, panel, body,
    get closed() { return closed; },
    close() {
      if (closed) return;
      closed = true;
      closeModal();
      sfx('ui-close', { volume: 0.6 });
      root.classList.remove('is-in');
      root.classList.add('is-out');
      setTimeout(() => root.remove(), 260);
      opts.onClose?.();
    },
  };
  scrim.addEventListener('pointerdown', e => { e.preventDefault(); handle.close(); });
  closeBtn.addEventListener('click', () => handle.close());
  return handle;
}
