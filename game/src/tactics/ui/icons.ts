import type { AbilityVfx } from '../rules/types';

const svg = (body: string, vb = '0 0 16 16') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  hourglass: svg('<path d="M4 1.5h8M4 14.5h8"/><path d="M5 1.5c0 3.2 2.6 4.4 3 6.5-.4 2.1-3 3.3-3 6.5M11 1.5c0 3.2-2.6 4.4-3 6.5.4 2.1 3 3.3 3 6.5"/><path d="M6.2 13.2c.6-1.4 1.2-2 1.8-2.2.6.2 1.2.8 1.8 2.2z" fill="currentColor" stroke="none"/><path d="M6.5 4.2h3c-.4.9-.9 1.5-1.5 2-.6-.5-1.1-1.1-1.5-2z" fill="currentColor" stroke="none" opacity=".6"/>'),
  move: svg('<path d="M8 1.5v13M1.5 8h13"/><path d="M6 3.5 8 1.5l2 2M6 12.5l2 2 2-2M3.5 6 1.5 8l2 2M12.5 6l2 2-2 2"/>'),
  act: svg('<path d="M3 13 12.5 3.5M10.5 2.5h3v3"/><path d="M2.5 10.5l3 3M4 12l-2 2"/>'),
  wait: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>'),
  undo: svg('<path d="M4.5 6.5H10a3.5 3.5 0 0 1 0 7H6"/><path d="M7 3.5l-3 3 3 3"/>'),
  rotL: svg('<path d="M3 8a5 5 0 1 0 1.6-3.7"/><path d="M4.5 1.8v2.8H7.3"/>'),
  rotR: svg('<path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M11.5 1.8v2.8H8.7"/>'),
  push: svg('<path d="M2 8h9M8 5l3 3-3 3"/><path d="M13.5 3v10"/>'),
  fall: svg('<path d="M3 3h5v4h5"/><path d="M10.5 9.5v4M8.5 11.5l2 2 2-2"/>'),
  quill: svg('<path d="M13.5 2.5C8 3 5 7 3.5 13.5"/><path d="M13.5 2.5c-.5 4-3 6.5-7 7.5"/><path d="M2.5 14.5l1-1"/>'),
  star: svg('<path d="M8 1.8l1.8 4 4.3.4-3.3 2.9 1 4.2L8 11.1 4.2 13.3l1-4.2L1.9 6.2l4.3-.4z"/>'),
};

const ABILITY_ICONS: Record<AbilityVfx, string> = {
  slash: svg('<path d="M3 13 12 4M10 2.5l3.5 3.5"/><path d="M2.5 10.5l3 3"/>'),
  double: svg('<path d="M3 13 11 5M13 13 5 5"/><path d="M9.5 3.5l3 3M6.5 3.5l-3 3"/>'),
  thrust: svg('<path d="M2 14 12.5 3.5"/><path d="M10 2.5h3.5V6z" fill="currentColor"/>'),
  heavy: svg('<path d="M4 14 11 4"/><path d="M9.5 2.5c2.5-.5 4.5 1.5 4 4l-3-1z" fill="currentColor"/>'),
  kick: svg('<path d="M5 2v6l-2 4.5h7.5l3-1.5V9.5L8 8.5V2"/>'),
  palm: svg('<path d="M5 13V7.5M7 13V5M9 13V5.5M11 13V8"/><path d="M5 9.5 3 8M4 13h8"/><circle cx="8" cy="3" r="1.2"/>'),
  arrow: svg('<path d="M3 13c-1.5-4 1-9 6-10.5"/><path d="M3 13c4 1.5 9-1 10.5-6"/><path d="M3 13 13 3M10.5 3H13v2.5"/>'),
  bolt: svg('<path d="M2.5 6.5h11M8 3v7"/><path d="M8 10v4M2.5 6.5c0 2 2.5 3.5 5.5 3.5s5.5-1.5 5.5-3.5"/>'),
  stone: svg('<path d="M4 11.5c-1.5-2 0-5.5 3-6.5 3-.8 6 1 5.5 4-.5 2.5-3 3.5-5.5 3.5-1.3 0-2.3-.3-3-1z" fill="currentColor" fill-opacity=".25"/>'),
  dagger: svg('<path d="M4 12 11 5l1.5-2.5L10 4 3 11"/><path d="M2.5 9.5l4 4M3 13l-1 1"/>'),
  beam: svg('<path d="M1.5 8h13" stroke-width="2.2"/><path d="M4 5.5 6 8l-2 2.5M9 5l1.5 3L9 11" stroke-width="1.1"/>'),
  shockwave: svg('<circle cx="8" cy="8" r="1.8" fill="currentColor"/><path d="M4.3 4.3a5.2 5.2 0 0 0 0 7.4M11.7 4.3a5.2 5.2 0 0 1 0 7.4"/><path d="M2 2.5a8 8 0 0 0 0 11M14 2.5a8 8 0 0 1 0 11" opacity=".55"/>'),
  ward: svg('<path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.3-5.5 6.3C4.9 13.3 2.5 11.2 2.5 8V4z"/><path d="M8 4.5v7M5 7.5h6" opacity=".6"/>'),
  taunt: svg('<path d="M8 2.5v7" stroke-width="2.4"/><circle cx="8" cy="13" r="1.2" fill="currentColor"/>'),
  dodge: svg('<path d="M2 5h7M4 8h8M2 11h6"/><path d="M11 3.5c2 1 2.5 3 1 4.5"/>'),
  free: svg('<path d="M3 6c2-2 4 2 6 0s3-2 4 0M3 10c2-2 4 2 6 0"/><path d="M11 9.5l3 3M14 9.5l-3 3"/>'),
};

export function abilityIcon(vfx: AbilityVfx): string { return ABILITY_ICONS[vfx] ?? ABILITY_ICONS.slash; }
