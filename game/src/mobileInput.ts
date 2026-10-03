export type MobileActionKey = 'E' | 'Q' | 'R' | 'SPACE' | 'ENTER' | 'ESC';
export type MobileDirection = 'up' | 'left' | 'down' | 'right';
export type MobileControlProfile = {
  directions: MobileDirection[];
  actions: Partial<Record<MobileActionKey, string>>;
  inventory?: boolean;
  disabled?: boolean;
};

/** Scene overrides replace gameplay controls while retaining unspecified options. */
export function resolveMobileControls(base: MobileControlProfile, override?: MobileControlProfile): MobileControlProfile {
  return override ? { ...base, ...override } : base;
}

/** Small ownership layer for multiple fingers holding the same Phaser key. */
export interface TouchKey {
  isDown: boolean;
  onDown(event: KeyboardEvent): void;
  onUp(event: KeyboardEvent): void;
  reset(): unknown;
}

export class TouchKeyHolds {
  private holds = new Map<TouchKey, { count: number; owned: boolean }>();

  press(key: TouchKey, event: KeyboardEvent) {
    const held = this.holds.get(key);
    if (held) { held.count++; return; }
    const owned = !key.isDown;
    this.holds.set(key, { count: 1, owned });
    if (owned) key.onDown(event);
  }

  release(key: TouchKey, event: KeyboardEvent) {
    const held = this.holds.get(key);
    if (!held) return;
    if (--held.count > 0) return;
    this.holds.delete(key);
    if (held.owned) key.onUp(event);
  }

  cancel(event: KeyboardEvent) {
    // Clear ownership first: an up handler may transition to another scene.
    const held = [...this.holds.entries()];
    this.holds.clear();
    for (const [key, state] of held) {
      if (state.owned) { key.onUp(event); key.reset(); }
    }
  }
}

/** Keep existing scene instructions readable alongside their touch action labels. */
export function touchHint(text: string, labels: Partial<Record<string, string>> = {}): string {
  const holdLabel = (key: string, fallback: string) => {
    const label = labels[key] ?? fallback;
    return label.endsWith('halten') ? label : `${label} halten`;
  };
  return text
    .replace(/WASD\s*\/\s*(?:Pfeiltasten|Pfeile)/gi, 'Steuerkreuz')
    .replace(/WASD|Pfeiltasten|Pfeile(?=\s*\+)/gi, 'Steuerkreuz')
    .replace(/Rechtsklick/gi, labels.ESC ?? 'Zurück')
    .replace(/anklicken/gi, 'antippen')
    .replace(/Klick(?:en)?/gi, 'Tippen')
    .replace(/\b(?:Esc|Escape) halten\b/gi, holdLabel('ESC', 'Weiter'))
    .replace(/\b(?:Leertaste|Space) halten\b/gi, holdLabel('SPACE', 'Weiter'))
    .replace(/\bE halten\b/g, holdLabel('E', 'Aktion'))
    .replace(/\b(?:Esc|Escape)\b/gi, labels.ESC ?? 'Zurück')
    .replace(/\b(?:Leertaste|Space)\b/gi, labels.SPACE ?? 'Weiter')
    .replace(/\bEnter\b/gi, labels.ENTER ?? 'Bestätigen')
    .replace(/(^|[^\p{L}\p{N}_])E(?=$|[^\p{L}\p{N}_])/gu, (_match, prefix: string) => prefix + (labels.E ?? 'Aktion'))
    .replace(/(^|[^\p{L}\p{N}_])Q(?=$|[^\p{L}\p{N}_])/gu, (_match, prefix: string) => prefix + (labels.Q ?? 'Strahl'))
    .replace(/(^|[^\p{L}\p{N}_])R(?=$|[^\p{L}\p{N}_])/gu, (_match, prefix: string) => prefix + (labels.R ?? 'Welle'))
    .replace(/(^|[^\p{L}\p{N}_])I(?=$|[^\p{L}\p{N}_])/gu, (_match, prefix: string) => prefix + ('Tasche'))
    .replace(/Steuerkreuz(?:\s*\/\s*Steuerkreuz)+/g, 'Steuerkreuz')
    .replace(/Tippen:\s*gehen\s*\/\s*untersuchen/gi, 'Tippen: untersuchen')
    .split('·')
    .map(part => part.trim())
    .filter(part => part && !/^Tasche:\s*Tasche\.?$/i.test(part))
    .map(part => part.replace(/^(.+):\s*\1(\.?)$/iu, '$1$2'))
    .join(' · ');
}
