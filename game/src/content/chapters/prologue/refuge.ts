/** The refuge's authored words; timers and physical actions belong to its adapter. */
export const REFUGE_BEATS = {
  water: { narrativeId: 'prologue.refuge.water', line: 'Schnell, hole ihm etwas Wasser! Ich glaube, er wacht auf.', speaker: 'Frau' },
  rescued: { narrativeId: 'prologue.refuge.rescued', line: 'Unglaublich. Als ich ihn gefunden habe, dachte ich schon, er sei tot. Sein Herzschlag war kaum mehr zu spüren.', speaker: 'Mann' },
  reassurance: { narrativeId: 'prologue.refuge.reassurance', line: 'Habt keine Angst. Ihr seid in guten Händen.', speaker: 'Frau' },
  fear: { narrativeId: 'prologue.refuge.fear', line: 'Sie werden mich hier finden.' },
  danger: { narrativeId: 'prologue.refuge.danger', line: 'Und dann töten sie die beiden gleich mit.' },
  hope: { narrativeId: 'prologue.refuge.hope', line: 'Die Hoffnung muss weiterleben.' },
  apology: { narrativeId: 'prologue.refuge.apology', line: 'Es tut mir leid. Ich hoffe, du kannst mir verzeihen.' },
  water_observation: { narrativeId: 'prologue.refuge.water-observation', line: 'Wasser. Sie haben es mir hingestellt.' },
  supplies_observation: { narrativeId: 'prologue.refuge.supplies-observation', line: 'Tücher und Töpfe, alles griffbereit. Sie haben gut für mich gesorgt.' },
} as const;
