import type Phaser from 'phaser';
import type { ControlProfile } from "../platform/input/types";

/** Shared read model for the canvas HUD and accessible DOM renderer. */
export type PresentationSnapshot = {
  name: string; portrait: string; hp: number; hudVisible: boolean; objective: string; hint: string;
  thought: string; thoughtUntil: number; abilities: { key: string; icon: string }[];
  abilitiesVisible: boolean; disabled: boolean; selected: string | null; controls: ControlProfile | null;
  battleStatus: string | null;
  inventory: { open: boolean; available?: boolean; items: { id: string; name: string; count: number }[] } | null;
  bookmarks: { id: string; label: string; selected: boolean }[];
  dialogueActive: boolean; dialogueText: string; dialogueFullText: string; dialogueComplete: string;
  dialogueTyping: boolean; dialogueSpeaker: string; dialogueIdentity: string; dialoguePortraitSrc: string; dialogueEmotion: string;
};
const keys: Record<keyof PresentationSnapshot, string> = {
  name: 'mobile:name', portrait: 'mobile:portrait', hp: 'mobile:hp', hudVisible: 'mobile:hudVisible', objective: 'mobile:objective', hint: 'mobile:hint',
  thought: 'mobile:thought', thoughtUntil: 'mobile:thoughtUntil', abilities: 'mobile:abilities', abilitiesVisible: 'mobile:abilitiesVisible', disabled: 'mobile:disabled',
  selected: 'mobile:selected', controls: 'mobile:controls', battleStatus: 'mobile:battleStatus', inventory: 'mobile:inventory', bookmarks: 'mobile:bookmarks',
  dialogueActive: 'dialogue:active', dialogueText: 'mobile:dialogue', dialogueFullText: 'dialogue:fullText', dialogueComplete: 'dialogue:complete',
  dialogueTyping: 'dialogue:typing', dialogueSpeaker: 'dialogue:speaker', dialogueIdentity: 'dialogue:identity', dialoguePortraitSrc: 'dialogue:portraitSrc', dialogueEmotion: 'dialogue:emotion',
};
const defaults = (): PresentationSnapshot => ({ name: '', portrait: '', hp: 1, hudVisible: true, objective: '', hint: '', thought: '', thoughtUntil: 0,
  abilities: [], abilitiesVisible: true, disabled: false, selected: null, controls: null, battleStatus: null, inventory: null, bookmarks: [],
  dialogueActive: false, dialogueText: '', dialogueFullText: '', dialogueComplete: '', dialogueTyping: false, dialogueSpeaker: '', dialogueIdentity: '', dialoguePortraitSrc: '', dialogueEmotion: '' });

export class PresentationModel {
  private state = defaults();
  private listeners = new Set<(snapshot: Readonly<PresentationSnapshot>) => void>();
  private disposed = false;
  constructor(private readonly mirror?: (patch: Partial<PresentationSnapshot>) => void) {}
  get snapshot(): Readonly<PresentationSnapshot> { return this.state; }
  publish(patch: Partial<PresentationSnapshot>) {
    if (this.disposed) return;
    if (!Object.entries(patch).some(([key, value]) => this.state[key as keyof PresentationSnapshot] !== value)) return;
    this.state = { ...this.state, ...patch }; this.mirror?.(patch);
    for (const listener of this.listeners) listener(this.state);
  }
  subscribe(listener: (snapshot: Readonly<PresentationSnapshot>) => void) {
    if (this.disposed) return () => {};
    this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener);
  }
  dispose() { this.disposed = true; this.listeners.clear(); }
}

const models = new WeakMap<object, PresentationModel>();
/** The legacy data mirror is retained for E2E probes while scenes move to typed publication. */
export function scenePresentation(scene: Phaser.Scene): PresentationModel {
  const existing = models.get(scene); if (existing) return existing;
  let writing = false;
  const model = new PresentationModel(patch => {
    writing = true; scene.data.set(Object.fromEntries(Object.entries(patch).map(([key, value]) => [keys[key as keyof PresentationSnapshot], value]))); writing = false;
  });
  models.set(scene, model);
  const initial: Partial<PresentationSnapshot> = {};
  for (const [field, key] of Object.entries(keys)) { const value = scene.data.get?.(key); if (value !== undefined) (initial as Record<string, unknown>)[field] = value; }
  model.publish(initial);
  const changed = (_data: unknown, key: string) => {
    if (writing) return;
    const field = (Object.keys(keys) as (keyof PresentationSnapshot)[]).find(field => keys[field] === key);
    if (field) model.publish({ [field]: scene.data.get(key) ?? defaults()[field] });
  };
  scene.data.events?.on('changedata', changed); scene.data.events?.on('setdata', changed); scene.data.events?.on('removedata', changed);
  scene.events.once('shutdown', () => {
    model.dispose(); models.delete(scene); scene.data.events?.off('changedata', changed); scene.data.events?.off('setdata', changed); scene.data.events?.off('removedata', changed);
  });
  return model;
}
