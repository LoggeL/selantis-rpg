import type { UiApi } from '../ui/api';
import type { Unit } from './rules/types';

/** Battle hooks name units by their authored IDs; bank aliases resolve those identities. */
export function presentTacticalBark(ui: Pick<UiApi, 'bubble'>, unit: Pick<Unit, 'id'>,
  text: string, anchor: () => { x: number; y: number } | null, ms: number): void {
  ui.bubble(text, anchor, ms, { speaker: unit.id });
}
