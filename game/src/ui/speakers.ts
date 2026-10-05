import { registerSpeakers, speakers } from '../core/catalog';
import type { SpeakerDef } from '../core/types';

/**
 * Default speakers for all story characters (DESIGN.md §3). Chapters may override any entry with
 * registerSpeakers([...]) — later registrations win. Portrait ids default to the speaker id and are
 * resolved by G.art.portrait(id, mood) (painted Codex portraits from the asset manifest, original designs, never film
 * likenesses). Generic roles point at the matching painted character (e.g. 'zwerg' → 'dwarf').
 */
export const DEFAULT_SPEAKERS: SpeakerDef[] = [
  { id: 'narrator', name: '', voice: { pitch: 0 } },
  // Family
  { id: 'lia', name: 'Lia', voice: { pitch: 330, wave: 'triangle' }, color: '#d98b5f' },
  { id: 'kyra', name: 'Kyra', voice: { pitch: 290, wave: 'triangle' }, color: '#b07a4a' },
  { id: 'mutter', name: 'Mutter', portrait: 'mother', voice: { pitch: 255, wave: 'sine' }, color: '#c46a4e' },
  { id: 'vater', name: 'Vater', portrait: 'father', voice: { pitch: 140, wave: 'triangle' }, color: '#9a7a52' },
  // Prolog
  { id: 'valentus', name: 'Valentus', voice: { pitch: 120, wave: 'sine' }, color: '#7fa6d8' },
  { id: 'baeuerin', name: 'Die Bäuerin', portrait: 'mother', voice: { pitch: 250, wave: 'sine' }, color: '#c46a4e' },
  { id: 'bauer', name: 'Der Bauer', portrait: 'father', voice: { pitch: 140, wave: 'triangle' }, color: '#9a7a52' },
  { id: 'ignatius', name: 'Ignatius von Ignis', voice: { pitch: 135, wave: 'sine' }, color: '#d0904a' },
  { id: 'ratsherr', name: 'Ratsmitglied', portrait: 'council-mage-a', voice: { pitch: 150, wave: 'sine' }, color: '#8fa0b8' },
  { id: 'abtruenniger', name: 'Abtrünniger', portrait: 'council-mage-b', voice: { pitch: 110, wave: 'sawtooth' }, color: '#a04848' },
  { id: 'verschwoerer', name: 'Kapuzengestalt', portrait: 'conspirator', voice: { pitch: 95, wave: 'sawtooth' }, color: '#b03a3a' },
  { id: 'falke', name: 'Falke', portrait: 'falke-soldier', voice: { pitch: 175, wave: 'square' }, color: '#7a9ccc' },
  { id: 'paladin', name: 'Paladin', voice: { pitch: 160, wave: 'square' }, color: '#c9d6ea' },
  // Freischärler
  { id: 'foltan', name: 'Foltan', voice: { pitch: 150, wave: 'triangle' }, color: '#5f86c4' },
  { id: 'azar', name: 'Azar', voice: { pitch: 105, wave: 'square' }, color: '#d6a640' },
  { id: 'craupor', name: 'Craupor', voice: { pitch: 175, wave: 'triangle' }, color: '#a38e6e' },
  { id: 'schankmaid', name: 'Schankmaid', portrait: 'barmaid', voice: { pitch: 300, wave: 'sine' }, color: '#c9887a' },
  { id: 'zwerg', name: 'Zwerg', portrait: 'dwarf', voice: { pitch: 95, wave: 'square' }, color: '#9c7a5a' },
  { id: 'gaukler', name: 'Gaukler', portrait: 'juggler', voice: { pitch: 230, wave: 'triangle' }, color: '#c25a8a' },
  { id: 'haendler', name: 'Händler', portrait: 'merchant', voice: { pitch: 160, wave: 'triangle' }, color: '#a0905a' },
  // Freie Bruderschaft
  { id: 'elnon', name: 'Elnon', voice: { pitch: 125, wave: 'sine' }, color: '#5f9a5a' },
  { id: 'alastir', name: 'Alastir', voice: { pitch: 145, wave: 'sine' }, color: '#b8c0c8' },
  { id: 'rebell', name: 'Rebell', portrait: 'guard-brotherhood', voice: { pitch: 165, wave: 'triangle' }, color: '#7a8a5a' },
  { id: 'flick', name: 'Flick', voice: { pitch: 380, wave: 'sine' }, color: '#7f9a4a' },
  // Dunkelschatten
  { id: 'grauhaarige', name: 'Der Grauhaarige', portrait: 'orwen', voice: { pitch: 115, wave: 'sawtooth' }, color: '#9a9aa2' },
  { id: 'orwen', name: 'Orwen', voice: { pitch: 115, wave: 'sawtooth' }, color: '#9a9aa2' },
  { id: 'baris', name: 'Baris', voice: { pitch: 78, wave: 'sawtooth' }, color: '#8a3a32' },
  { id: 'algard', name: 'Algard', voice: { pitch: 130, wave: 'square' }, color: '#8a7a6a' },
  { id: 'maedchen', name: '„Mädchen“', voice: { pitch: 185, wave: 'square' }, color: '#c08080' },
  { id: 'harro', name: 'Harro', voice: { pitch: 140, wave: 'square' }, color: '#7a7a6a' },
  { id: 'dunkelschatten', name: 'Dunkelschatten', portrait: 'shadow-sword', voice: { pitch: 120, wave: 'square' }, color: '#c8c8c8' },
  { id: 'wache', name: 'Wache', portrait: 'shadow-sword', voice: { pitch: 130, wave: 'square' }, color: '#c8c8c8' },
  { id: 'leichenfresser', name: 'Leichenfresser', voice: { pitch: 70, wave: 'sawtooth' }, color: '#7a5a4a' },
  { id: 'vamir', name: 'Der Meister', voice: { pitch: 70, wave: 'sine' }, color: '#9a7ad8' },
];

/** Registers the defaults without overwriting entries a chapter already registered. */
export function registerDefaultSpeakers(): void {
  registerSpeakers(DEFAULT_SPEAKERS.filter(s => !speakers.has(s.id)));
}
