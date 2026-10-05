import type { SpeakerDef } from '../../core/types';

/** Mythology source.pdf, Rat der Zehn, one year before Dunkelhain. */
export const COUNCIL = [
  { id: 'ulfbert', name: 'Ulfbert von Rogar', gender: 'male', renegade: true, pitch: 108, wave: 'sawtooth', color: '#a04848' },
  { id: 'loyla', name: 'Loyla von Imandur', gender: 'male', renegade: true, pitch: 115, wave: 'sawtooth', color: '#9274ac' },
  { id: 'burm', name: 'Burm von Rogar', gender: 'male', renegade: false, pitch: 145, wave: 'triangle', color: '#8fa0b8' },
  { id: 'ignatius', name: 'Ignatius von Ignis', gender: 'male', renegade: false, pitch: 135, wave: 'sine', color: '#d0904a' },
  { id: 'gira', name: 'Gira von Imandur', gender: 'female', renegade: false, pitch: 205, wave: 'sine', color: '#5f9a6a' },
  { id: 'tholoss', name: 'Tholloss von Trapas', gender: 'male', renegade: true, pitch: 128, wave: 'sawtooth', color: '#b8893a' },
  { id: 'valentus', name: 'Valentus von Trapas', gender: 'male', renegade: false, pitch: 120, wave: 'sine', color: '#7fa6d8' },
  { id: 'gwynn', name: 'Gwynn von Portas', gender: 'female', renegade: false, pitch: 220, wave: 'sine', color: '#689fac' },
  { id: 'samira', name: 'Samira von Ignis', gender: 'female', renegade: false, pitch: 240, wave: 'triangle', color: '#c98969' },
  { id: 'rikkon', name: 'Rikkon von Portas', gender: 'male', renegade: true, pitch: 125, wave: 'square', color: '#9696a8' },
] as const;

export const COUNCIL_SPEAKERS: SpeakerDef[] = COUNCIL.map(member => ({
  id: member.id, name: member.name, portrait: member.id,
  voice: { pitch: member.pitch, wave: member.wave }, color: member.color,
}));
