import type Phaser from 'phaser';

export interface SceneEntry {
  /** Unique scene id, used in ?scene=<id> and saves. */
  id: string;
  title: string;
  /** Starts this scene. Called by G.goto(). Should start Phaser scenes and/or run scripts. */
  start(params?: Record<string, unknown>): void | Promise<void>;
  /**
   * Prepares campaign state for a direct warp (debug / ?scene= / chapter select) so the scene works
   * without having played earlier scenes: set flags, inventory, party, abilities, objectives.
   */
  prepare?(): void;
}

/** A part of a long chapter shown as its own entry in the chapter select (scene ids in story order). */
export interface ChapterSection {
  numeral: string;
  title: string;
  subtitle?: string;
  scenes: string[];
}

export interface ChapterEntry {
  id: string;
  /** Sorting order: prolog = 0, kapitel-1 = 1, ... */
  order: number;
  numeral: string;   // 'Prolog', 'I', 'II', ...
  title: string;
  subtitle?: string;
  scenes: SceneEntry[];
  /** Which book of the chronicle the chapter belongs to (1 = book one incl. prolog, 2 = Teil II, 3 = Teil III). */
  book?: number;
  /** Long chapters (Teil II/III) list their scenes in these parts in the chapter select. */
  sections?: ChapterSection[];
  /** Dev/test chapters (demo maps, galleries) are hidden from the title chapter select. */
  hidden?: boolean;
  /** Extra Phaser scenes this chapter needs (minigames). Added once at boot. */
  phaserScenes?: Phaser.Types.Scenes.SceneType[];
}

const chapters: ChapterEntry[] = [];

export function defineChapter(chapter: ChapterEntry): ChapterEntry {
  if (chapters.some(c => c.id === chapter.id)) throw new Error(`Duplicate chapter ${chapter.id}`);
  chapters.push(chapter);
  chapters.sort((a, b) => a.order - b.order);
  return chapter;
}

export function getChapters(): readonly ChapterEntry[] { return chapters; }

export function findScene(id: string): { chapter: ChapterEntry; scene: SceneEntry } | undefined {
  for (const chapter of chapters) {
    const scene = chapter.scenes.find(s => s.id === id);
    if (scene) return { chapter, scene };
  }
  return undefined;
}

/** The scene that follows `id` in story order (next scene of the chapter, or first scene of the next chapter). */
export function nextScene(id: string): SceneEntry | undefined {
  const flat = chapters.filter(c => !c.hidden).flatMap(c => c.scenes);
  const i = flat.findIndex(s => s.id === id);
  return i >= 0 ? flat[i + 1] : undefined;
}
