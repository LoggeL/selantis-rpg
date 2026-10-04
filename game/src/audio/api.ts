/**
 * CONTRACT for audio/. Music moods map to authored tracks; SFX and ambience are procedural (WebAudio).
 */
export type MusicMood = 'battle' | 'flight' | 'refuge' | 'exploration' | 'dread' | 'grief' | 'tavern';

export type SfxName =
  | 'step-grass' | 'step-dirt' | 'step-wood' | 'step-stone' | 'step-water'
  | 'ui-move' | 'ui-confirm' | 'ui-cancel' | 'ui-open' | 'ui-close' | 'page'
  | 'pickup' | 'objective' | 'memory' | 'discover'
  | 'hit' | 'hit-heavy' | 'swing' | 'bow' | 'arrow-hit' | 'block' | 'dodge' | 'fall'
  | 'magic' | 'beam' | 'shockwave' | 'urmacht' | 'heal'
  | 'heartbeat' | 'alert' | 'suspicious'
  | 'fire-ignite' | 'thunder' | 'door' | 'chest' | 'splash' | 'rustle' | 'bark-dog' | 'horse'
  | 'drill' | 'whoosh' | 'thud'
  // ---- additions (audio agent, polish pass) ----
  /** A dry branch cracking underfoot (stealth: almost giving away the hiding place). */
  | 'branch-snap'
  /** Pig grunt/squeal (feeding and releasing the pigs). */
  | 'pig'
  /** A heavy stone set down on others (carrying stones for the graves). */
  | 'stone-place'
  /** A blade cutting through rope or bonds. */
  | 'rope-cut'
  /** Chain rattle (Kyra in chains). */
  | 'chain'
  /** Sword drawn from its scabbard. */
  | 'sword-draw'
  /** Crossbow shot: latch click, heavy string, bolt leaving. */
  | 'crossbow'
  /** Something thrown by hand (Lia throws a stone). */
  | 'throw'
  /** A small turquoise spark jumping over (Urmacht hint, e.g. when lighting the fire). */
  | 'spark'
  /** Quill scratching on paper (diary / objective note). */
  | 'write'
  /** Eating: a crunchy bite and chewing. */
  | 'eat';

export type AmbienceLayer =
  | 'wind' | 'birds' | 'crickets' | 'rain' | 'storm' | 'fire' | 'tavern' | 'stream' | 'night' | 'camp'
  // ---- additions (audio agent, polish pass) ----
  /** Distant battle: clashing steel, shouts and drums far away (prolog-schlacht). */
  | 'battle-far'
  /** Quiet indoor room tone with a candle hiss and the odd creak (farm parlour, council hall). */
  | 'room'
  /** Farmyard: pigs and hens. */
  | 'farm'
  /** Smithy: anvil strikes, bellows and embers (Bruderschaft camp). */
  | 'forge'
  /** Still water at a pond or lake: lapping, frogs, a distant waterbird. */
  | 'lake';

/** Options for one sound effect. */
export interface SfxOptions {
  /** 0..2, default 1. */
  volume?: number;
  /** Playback ratio, default 1. */
  pitch?: number;
  /** -1 (left) .. 1 (right), default 0. */
  pan?: number;
  /**
   * 0 = right here (default) .. 1 = far away. Far sounds are darker (lowpass ~12 kHz -> 900 Hz),
   * quieter (0 -> -18 dB) and wetter (reverb send x1 -> x3). Use for approaching riders, distant dogs.
   */
  distance?: number;
  /**
   * Throttle key: identical effects with the same key are rate limited, different keys are not
   * (e.g. pass the unit id so the footsteps of several companions are all heard).
   */
  key?: string;
}

/** Handle for a playing effect. Calling stop() on a finished sound is harmless. */
export interface SfxHandle {
  /** Fades the sound out (default 120 ms) and frees it. */
  stop(fadeMs?: number): void;
  /** Length of the sound in seconds (0 when it was dropped: throttled, muted or audio locked). */
  readonly duration: number;
}

/** Options for a repeating effect (heartbeat, friction, hooves). */
export interface SfxLoopOptions {
  /** Seconds between two triggers (default: the effect's natural length). Changes apply smoothly. */
  interval?: number;
  volume?: number;
  pan?: number;
  pitch?: number;
  distance?: number;
}

export interface SfxLoop {
  /** Changes tempo, volume, pan, pitch or distance while the loop runs. */
  set(opts: SfxLoopOptions): void;
  /** Fades the loop out (default 250 ms) and stops scheduling. */
  stop(fadeMs?: number): void;
}

/**
 * Event emitted on core/events as 'audio:lightning' shortly BEFORE the storm layer's thunder:
 * flash now, thunder follows after `delayMs` (near: 100..300 ms, far: 1.5..3 s).
 * `strength` 0..1 is a hint for the flash brightness.
 */
export interface LightningEvent { near: boolean; delayMs: number; strength: number }

export interface AudioApi {
  /** Must be called from a user gesture once; safe to call repeatedly. */
  unlock(): void;
  /**
   * Crossfades to the mood's track (null = fade to silence). Calls before unlock() are remembered and
   * start on unlock. `restart` replays from the beginning even if the mood is already playing.
   * Calm moods (exploration, refuge, tavern) resume where they left off; the others start fresh.
   */
  music(mood: MusicMood | null, opts?: { fadeMs?: number; restart?: boolean }): void;
  /**
   * volume 0..2 (default 1), pitch as playback ratio (default 1), pan -1..1, distance 0..1.
   * Identical spam is throttled (per `key`). Returns a handle to stop long sounds early.
   */
  sfx(name: SfxName, opts?: SfxOptions): SfxHandle;
  /**
   * Sets the active ambience layers (crossfades in/out). Empty array = silence.
   * `volume` scales individual layers (0..1.5, default 1), e.g. { fire: 0.4 } for a distant fire.
   */
  ambience(layers: AmbienceLayer[], opts?: { fadeMs?: number; volume?: Partial<Record<AmbienceLayer, number>> }): void;
  /**
   * Dialogue blip for the typewriter. `pan` -1..1 places the voice (e.g. the speaker's screen position,
   * used by the blindfold scene), `volume` 0..2 (default 1).
   */
  blip(pitch: number, wave?: OscillatorType, opts?: { pan?: number; volume?: number }): void;

  // ---- additions (audio agent) ----
  /** Temporarily lowers the music, e.g. under an important line. db < 0 (default -9), ms hold time (default 1500). */
  duck(db?: number, ms?: number): void;
  /** Fades out music, ambience, running effects and loops (e.g. before a hard cut to black or a skip). */
  stopAll(fadeMs?: number): void;
  /** The mood currently requested (null = no music). */
  currentMusic(): MusicMood | null;
  /** The ambience layers currently requested. */
  currentAmbience(): AmbienceLayer[];

  // ---- additions (audio agent, polish pass) ----
  /**
   * Repeats an effect on the audio clock until stopped, e.g.
   * `const hb = G.audio.loop('heartbeat', { interval: 0.8 }); hb.set({ interval: 0.45 }); hb.stop();`
   */
  loop(name: SfxName, opts?: SfxLoopOptions): SfxLoop;
  /**
   * While on, music sits 5 dB and ambience 3 dB lower so dialogue stays intelligible.
   * The UI calls it when a dialogue/narration box opens (true) and closes (false).
   */
  dialogueFocus(on: boolean): void;
}
