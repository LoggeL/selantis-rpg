import { ctx, isConfirm, type LayerName } from './context';
import { el } from './dom';

export interface AdvanceGate {
  /** Removes catcher + modal. Idempotent. */
  close(): void;
  readonly catcher: HTMLElement;
}

/**
 * Modal "press to continue" input: confirm keys and pointer/tap anywhere call `onPress`.
 * Robust against stale input: key repeats are ignored, and only events that happen after the gate
 * opened (plus a small grace period) count, so early presses never skip unseen text.
 */
export function advanceGate(id: string, onPress: () => void, opts: { layer?: LayerName; allowMenu?: boolean; graceMs?: number; extraKey?: (e: KeyboardEvent) => boolean } = {}): AdvanceGate {
  const openedAt = performance.now();
  const grace = opts.graceMs ?? 90;
  const fresh = (stamp: number) => stamp >= openedAt + grace || performance.now() >= openedAt + grace;
  const catcher = el('div', 'ui-catcher');
  (ctx.layers[opts.layer ?? 'dialog']).prepend(catcher);
  const onPointer = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!fresh(e.timeStamp)) return;
    e.preventDefault();
    onPress();
  };
  catcher.addEventListener('pointerdown', onPointer);
  const closeModal = ctx.open({
    id,
    allowMenu: opts.allowMenu ?? true,
    allowJournal: false,
    onKey: e => {
      if (opts.extraKey?.(e)) return true;
      if (!isConfirm(e)) return false;
      if (!e.repeat && fresh(e.timeStamp)) onPress();
      return true;
    },
  });
  let closed = false;
  return {
    catcher,
    close() {
      if (closed) return;
      closed = true;
      catcher.removeEventListener('pointerdown', onPointer);
      catcher.remove();
      closeModal();
    },
  };
}
