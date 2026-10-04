// TEMPORARY STUB — replaced by the audio implementation.
import type { AudioApi } from './api';

export function createAudio(): AudioApi {
  return { unlock() {}, music() {}, sfx() {}, ambience() {}, blip() {} };
}
