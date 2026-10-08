import type { StoryActionKind, StealthKind } from './interactionRules';
import type { StoryActionOptions, StealthOptions } from './interactions';
import type { PickResult, ScenePickOptions } from './scenePick';

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

export type BubbleHandle = (() => void) & { readonly voiced?: boolean; readonly voiceDone?: Promise<void> };

export type ToastKind = 'item' | 'memory' | 'lore' | 'clue' | 'objective' | 'ability' | 'info';

export interface UiApi {
  mount(root: HTMLElement): void;

  /** Dialogue line. speaker = id from core/catalog speakers ('lia', 'kyra', ... ) or 'narrator'. */
  say(speaker: string, text: string, opts?: { portrait?: string; mood?: string }): Promise<void>;
  /** Shows choices (optionally under a speaker line); resolves with the chosen index. */
  choose(options: (string | ChoiceOption)[], opts?: { speaker?: string; prompt?: string }): Promise<number>;
  /** Book-style narration. Each string is one page/beat waiting for continue. */
  narrate(lines: string | string[], opts?: { style?: 'book' | 'card' | 'thought' }): Promise<void>;
  /** Thought line of the player character; an explicit speaker supports changing player characters within a scene. */
  think(text: string, opts?: { speaker?: string }): Promise<void>;

  /**
   * Shows a book plate full screen with slow pan: the painted plate image from the asset manifest
   * (G.art.plateUrl(id), 1280x720) when present, otherwise a picture drawn in code and registered via
   * registerPlate(id, draw) (map of Selantis, constellation, letter, book page, vignette...).
   * Never modelled on film frames or actors (actor privacy — see DESIGN.md §2).
   * Resolves once it is visible (fade-in done). It stays until closePlate(); dialogue can run on top.
   */
  plate(id: string, opts?: { caption?: string; pan?: 'left' | 'right' | 'in' | 'out' | 'none'; durationMs?: number }): Promise<void>;
  /**
   * The sky of the open plate darkens to a storm sky over `ms` (default 7000), lit by short flickers; violet lightning
   * stays bright. Resolves once dark; does nothing without an open plate. Lasts until the plate closes.
   */
  plateStorm(ms?: number): Promise<void>;
  closePlate(): Promise<void>;
  /** Registers a code-drawn plate. `draw` returns a canvas (any size, 16:9 recommended) or an image URL. */
  registerPlate(id: string, draw: () => HTMLCanvasElement | string): void;

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
  /** Screen-space (canvas coords 0..640/0..360) objective direction indicator; null hides. */
  objectivePointer(pos: { x: number; y: number } | null): void;

  /** Interaction hint near a canvas-space point. null hides. */
  hint(h: { verb: string; key?: string; x: number; y: number } | null): void;
  /** Speech bubble anchored to a canvas-space position provider; auto-hides after ms. Returns a remover. */
  bubble(text: string, anchor: () => { x: number; y: number } | null, ms?: number, opts?: { speaker?: string; voiceText?: string; foreground?: boolean }): BubbleHandle;

  /**
   * Legacy progress prompt for the UI demo. Story chapters use storyAction or stealthGame.
   * Resolves when the player held the action for durationMs.
   * If `struggle` is set, the bar drains when released (used for „Halte still“).
   */
  hold(label: string, durationMs: number, opts?: { struggle?: boolean; onRelease?: () => void }): Promise<void>;

  /** Untimed story gesture, driven by directional keys, dragging or the on-screen arrows. */
  storyAction(kind: StoryActionKind, label: string, opts?: StoryActionOptions): Promise<void>;
  /** Short hiding challenge. Mistakes retry the current beat; resolves with the number of noises. */
  stealthGame(kind: StealthKind, label: string, opts?: StealthOptions): Promise<number>;
  /** Decision game over a painted scene: word cards per round, the caller judges each pick (see scenePick.ts). */
  scenePick(opts: ScenePickOptions): Promise<PickResult>;

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
