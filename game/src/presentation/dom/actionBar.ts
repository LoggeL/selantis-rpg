import type { MobileActionKey, MobileControlProfile } from "./controlLabels";

export type ActionSlot = { key: MobileActionKey; label: string; disabled: boolean; selected: boolean };
export type LearnedAbility = { key: string; icon: string };
const ABILITY_NAMES: Record<string, string> = { beam: 'Strahl', wave: 'Druckwelle', wait: 'Warten' };
const ORDER: MobileActionKey[] = ['E', 'Q', 'R', 'SPACE', 'ENTER', 'ESC'];

/** Learned abilities keep their slots when a turn is spent, without granting actions. */
export function actionBarSlots(profile: MobileControlProfile, learned: readonly LearnedAbility[] = [],
  options: { visible?: boolean; disabled?: boolean; selected?: string | null } = {}): ActionSlot[] {
  const available = options.visible === false ? [] : learned;
  return ORDER.flatMap(key => {
    const ability = available.find(entry => entry.key === key || (key === 'SPACE' && entry.key === '␣'));
    const label = profile.actions[key] ?? (ability ? ABILITY_NAMES[ability.icon] : undefined);
    if (!label) return [];
    return [{ key, label: label === 'Aktion' ? 'Interagieren' : label,
      disabled: !!profile.disabled || !profile.actions[key] || (!!options.disabled && (key === 'Q' || key === 'R')),
      selected: !!ability && ability.icon === options.selected }];
  });
}
