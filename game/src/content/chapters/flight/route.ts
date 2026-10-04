import type { RailPoint } from "../../../modules/flight/rail";
import type { AuthoredFlightStation } from "../../../modules/flight/stations";

// Laufweg über beide Bühnen (Welt 1280 x 360). Romanstationen S. 1–2.
export const FLIGHT_PATH: readonly RailPoint[] = [
  // Enter on the visible trail, clear of the portrait and health panel.
  { x: 170, y: 110 }, { x: 178, y: 113 }, { x: 186, y: 116 }, { x: 193, y: 119 }, { x: 200, y: 122 },
  /* 5: Wurzel */ { x: 250, y: 136 }, { x: 290, y: 162 }, { x: 322, y: 194 }, { x: 362, y: 216 }, { x: 402, y: 238 },
  { x: 442, y: 255 }, { x: 482, y: 274 }, { x: 522, y: 290 }, { x: 562, y: 302 },
  /* 14: Absprung am Bach */ { x: 604, y: 316 },
  /* 15: anderes Ufer */ { x: 700, y: 226 }, { x: 760, y: 216 },
  /* 17: Fuß des Abhangs */ { x: 806, y: 204 },
  /* 18: oben */ { x: 850, y: 134 }, { x: 905, y: 130 }, { x: 955, y: 138 },
  /* 21: krummer Stamm */ { x: 984, y: 146 }, { x: 1040, y: 152 }, { x: 1090, y: 150 },
  /* 24: glitschiger Stein */ { x: 1126, y: 146 },
];

export const FLIGHT_STATIONS: readonly AuthoredFlightStation[] = [
  { pointIndex: 5, kind: 'stumble' },
  { pointIndex: 14, kind: 'jump', hint: 'E / Klick · Springen', toPointIndex: 15 },
  { pointIndex: 17, kind: 'climb', hint: 'E / Klick halten · Hinaufziehen', holdMs: 1800, toPointIndex: 18 },
  { pointIndex: 21, kind: 'brace', hint: 'E / Klick halten · Abstützen', holdMs: 1200 },
  { pointIndex: 24, offset: -2, kind: 'slip' },
];
export const FLIGHT_PAUSES = [
  { pointIndex: 8, kind: 'listen' as const, color: 0xb6bba9 },
  { pointIndex: 20, kind: 'wound' as const, color: 0xc29186 },
] as const;
