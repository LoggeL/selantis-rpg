// Contract between the three books (docs/handoff/transition-contract.md). Teil II implements its side; Teil III may
// import these ids and the documented end state for its own direct entry without importing Teil II story files.
import { G } from '../../core/G';
import { findScene } from '../../core/registry';
import type { UiApiExt } from '../../ui';

export const BOOK2 = { chapter: 'teil-2', entry: 'e2-taverne', last: 'e2-aufbruch', finished: 'e2-finished' } as const;
export const BOOK3 = { chapter: 'teil-3', entry: 'e3-valentus', last: 'e3-epilog', finished: 'e3-finished' } as const;

/** Flags reserved by the contract for the Teil II → Teil III boundary. */
export const E2_FLAGS = {
  finished: 'e2-finished',
  staffReceived: 'e2-staff-received',
  trainingComplete: 'e2-training-complete',
  flickEscaped: 'e2-flick-escaped',
  kyraControlled: 'e2-kyra-controlled',
  elnonStruck: 'e2-elnon-struck',
} as const;

/** The borrowed staff of Teil II and Lia's own staff of Teil III are different objects. */
export const STAFF = { borrowed: 'e2-schattentoeter', own: 'e3-lia-staff' } as const;

/**
 * Regular continuation from book one (finale or weiterreise) into Teil II. Keeps the whole grown state
 * (inventory, levels, abilities, memories, choices); only makes sure the companions are the two sisters' friends.
 */
export async function continueToBook2(): Promise<void> {
  if (!findScene(BOOK2.entry)) throw new Error(`Teil II fehlt: ${BOOK2.entry}`);
  G.state.setParty(['flick', 'kyra']);
  // Book one is over: no open book-one objective (e.g. the optional travel's 'k5-weiterreise') follows into
  // Teil II, where the HUD would fall back to it whenever no newer objective is open.
  for (const o of G.state.data.objectives) if (!o.done) G.state.complete(o.id);
  // Like the title's scene transition: toasts and other transient UI of book one stay behind.
  (G.ui as UiApiExt | undefined)?.reset?.({ keepFade: true });
  await G.goto(BOOK2.entry);
}

/**
 * TEST FIXTURE for direct entries only (G.warp → prepare): the documented end state of Teil II. Never call it on a
 * loaded or continued campaign — the regular transition keeps the real state.
 */
export function prepareBook2EndState(): void {
  const s = G.state;
  for (const [id, n] of [['bread', 1], ['cheese', 1], ['waterskin', 1], ['blanket', 1], ['cloak', 1], ['coins', 1], ['tincture', 1], ['dagger', 1], ['book-alana', 1]] as const) s.give(id, n);
  s.give(STAFF.borrowed);
  for (const a of ['spurenblick', 'schleichen', 'ausweichen', 'ablenken', 'urmacht', 'lichtstoss', 'e2-stabimpuls']) s.learn(a);
  for (const f of ['k4-verrat', 'k5-urmacht', 'k5-ende', 'e2-getrennt', 'e2-urmacht-erklaert', 'e2-ignatius-vorgestellt', ...Object.values(E2_FLAGS)]) s.set(f);
  s.setParty([]);
}

/**
 * End of Teil II: hands over to Teil III when its first scene exists, otherwise back to the title.
 * The caller has already shown the book-two credits.
 */
export async function finishBook2(): Promise<void> {
  if (findScene(BOOK3.entry)) { await G.goto(BOOK3.entry); return; }
  const { showTitle } = await import('../../scenes/BootScene');
  await showTitle();
}
