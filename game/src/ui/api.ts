/**
 * CONTRACT between ui/ (producer) and everyone else. The UI is DOM/CSS layered over the canvas (#ui).
 * All awaitable calls lock gameplay input (core/input inputLock) while active and are safe against
 * double triggering. The UI agent owns ui/index.ts and may ADD members; it must not remove or rename these.
 */

export interface ChoiceOption {
  text: string;
  /** Disabled options are shown greyed out with an optional reason. */
  disabled?: boolean;
  reason?: string;
  /** Small tag shown next to the option, e.g. 'Kräuterbuch' when an item enables it. */
  tag?: string;
}

export type ToastKind = 'item' | 'memory' | 'lore' | 'clue' | 'objective' | 'ability' | 'info';

export interface UiApi {
  mount(root: HTMLElement): void;

  /** Dialogue line. speaker = id from core/catalog speakers ('lia', 'kyra', ... ) or 'narrator'. */
  say(speaker: string, text: string, opts?: { portrait?: string; mood?: string }): Promise<void>;
  /** Shows choices (optionally under a speaker line); resolves with the chosen index. */
  choose(options: (string | ChoiceOption)[], opts?: { speaker?: string; prompt?: string }): Promise<number>;
  /** Book-style narration. Each string is one page/beat waiting for continue. */
  narrate(lines: string | string[], opts?: { style?: 'book' | 'card' | 'thought' }): Promise<void>;
  /** Thought line of the player character (italic, no portrait box chrome). */
  think(text: string): Promise<void>;

  /**
   * Shows an illustration plate (public/art/plates/<id>.jpg) full screen with slow Ken Burns pan.
   * Resolves once it is visible (fade-in done). It stays until closePlate(); dialogue can run on top.
   */
  plate(id: string, opts?: { caption?: string; pan?: 'left' | 'right' | 'in' | 'out' | 'none'; durationMs?: number }): Promise<void>;
  closePlate(): Promise<void>;

  /** Chapter title card (book page). Waits for continue or ~4s. */
  chapterCard(numeral: string, title: string, subtitle?: string): Promise<void>;
  /** Full-screen fade over everything (DOM). */
  fade(dir: 'out' | 'in', ms?: number, color?: string): Promise<void>;
  letterbox(on: boolean): void;
  /** Large centered caption over black, e.g. „Vierzehn Jahre später“. */
  caption(text: string, ms?: number): Promise<void>;

  toast(text: string, kind?: ToastKind): void;
  /** HUD objective line (top left). null hides it. */
  objective(text: string | null): void;
  /** Screen-space (canvas coords 0..480/0..270) objective direction indicator; null hides. */
  objectivePointer(pos: { x: number; y: number } | null): void;

  /** Interaction hint near a canvas-space point. null hides. */
  hint(h: { verb: string; key?: string; x: number; y: number } | null): void;
  /** Speech bubble anchored to a canvas-space position provider; auto-hides after ms. Returns a remover. */
  bubble(text: string, anchor: () => { x: number; y: number } | null, ms?: number): () => void;

  /**
   * Hold-to-act prompt (e.g. „Hand heben“). Resolves when the player held the action for durationMs.
   * If `struggle` is set, the bar drains when released (used for „Halte still“).
   */
  hold(label: string, durationMs: number, opts?: { struggle?: boolean; onRelease?: () => void }): Promise<void>;

  /** Generic full-screen panel for minigames that need DOM (returns the element; remove() when done). */
  panel(className?: string): HTMLElement;

  openJournal(): void;
  openBag(): void;
  openMenu(): void;
  /** Title screen. Resolves with the player's choice. */
  title(): Promise<'new' | 'continue' | { warp: string }>;
  /** Shows/hides gameplay HUD chrome (objective, buttons, touch controls). */
  setHud(mode: 'explore' | 'battle' | 'cinematic' | 'none'): void;

  /** True while any modal UI is open. */
  busy(): boolean;
}
