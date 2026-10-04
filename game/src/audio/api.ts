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
  | 'drill' | 'whoosh' | 'thud';

export type AmbienceLayer = 'wind' | 'birds' | 'crickets' | 'rain' | 'storm' | 'fire' | 'tavern' | 'stream' | 'night' | 'camp';

export interface AudioApi {
  /** Must be called from a user gesture once; safe to call repeatedly. */
  unlock(): void;
  music(mood: MusicMood | null, opts?: { fadeMs?: number }): void;
  sfx(name: SfxName, opts?: { volume?: number; pitch?: number; pan?: number }): void;
  /** Sets the active ambience layers (crossfades in/out). Empty array = silence. */
  ambience(layers: AmbienceLayer[]): void;
  /** Dialogue blip for the typewriter. */
  blip(pitch: number, wave?: OscillatorType): void;
}
