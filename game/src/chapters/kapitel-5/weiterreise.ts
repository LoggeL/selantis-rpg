import { G } from '../../core/G';
import { defineMap, type WorldCtx } from '../../world';
import { onwardEncounter, playEncounter, saveEncounterReturn } from '../common/encounters';
import { waldweg } from '../kapitel-2/waldweg';
import { showCredits } from './credits';

/** Optional playable travel after the first book. Reuses forest art and geometry, with its own map memory. */
export const weiterreiseMap = defineMap({
  ...waldweg,
  id: 'k5-weiterreise', name: 'Zu dritt nach Süden', resetOnEnter: false,
  props: [], clues: [], triggers: [], exits: [],
  spawns: { start: { at: [260, 458], dir: 'right' } },
  interactables: [
    { id: 'reiseweg', verb: 'Weg sichern', at: [420, 400], radius: 30, sparkle: true, onInteract: nextEncounter },
    { id: 'reiserast', verb: 'Mit der Gruppe rasten', at: [260, 490], radius: 28, onInteract: rest },
    { id: 'reiseende', verb: 'Das erste Buch abschließen', at: [40, 482], radius: 26, sparkle: true, onInteract: finish },
  ],
  onEnter: async w => {
    G.state.setParty(['flick', 'kyra']);
    w.setObjective('k5-weiterreise', 'Sichert gemeinsam den Weg. Am Rastplatz könnt ihr euren Fortschritt ansehen.', 'reiseweg');
    if (!G.state.is('k5-weiterreise-start')) {
      G.state.set('k5-weiterreise-start');
      await w.say('flick', 'Wir bleiben zusammen. Wenn auf dem Weg Räuber stehen, halten wir einander den Rücken frei.');
      await w.say('kyra', 'Und diesmal bin ich auch dabei. Ohne Seil.');
      await w.think('Kyra ist frei. Zum ersten Mal seit Tagen kann ich weiter als bis zum nächsten Schritt denken.');
      saveEncounterReturn(w);
    }
  },
});

async function nextEncounter(w: WorldCtx): Promise<void> {
  const pick = await w.choose(['Den nächsten Wegabschnitt gemeinsam sichern.', 'Noch am Rastplatz bleiben.']);
  if (pick !== 0) return;
  const visit = Number(G.state.flag('k5-reisekaempfe') ?? 0);
  const learnsLight = visit >= 1 && !G.state.knows('lichtstoss');
  const result = await playEncounter(w, onwardEncounter(visit), undefined, () => {
    G.state.inc('k5-reisekaempfe');
    if (learnsLight) G.state.learn('lichtstoss');
  });
  if (result.outcome !== 'win') return;
  const wins = Number(G.state.flag('k5-reisekaempfe'));
  if (learnsLight) {
    await w.say('flick', 'Eben war wieder dieses Licht um deine Hand. Du hast es diesmal gehalten.');
    await w.think('Nicht die Welle von damals. Nur ein kleiner Stoß. Aber diesmal weiß ich, was ich tue.');
    G.ui.toast('Lia lernt Lichtstoß.', 'ability');
  } else if (wins === 1) {
    await w.say('kyra', 'Du hast gleich gesehen, wo wir hinmüssen.');
    await w.think('Ich hatte immer noch Angst. Aber ich konnte dabei nachdenken.');
  }
  saveEncounterReturn(w);
}

async function rest(w: WorldCtx): Promise<void> {
  await w.say('flick', 'Wir versorgen uns vor jedem neuen Wegabschnitt. Alle kommen mit, niemand bleibt zurück.');
  const lines = ['lia', 'flick', 'kyra'].map(id => {
    const p = G.state.character(id);
    const name = id === 'lia' ? 'Lia' : id === 'flick' ? 'Flick' : 'Kyra';
    return p ? `${name}: Level ${p.level}, ${p.exp}/100 EXP.` : `${name}: Die ersten gemeinsamen Schritte stehen noch bevor.`;
  });
  await w.narrate(lines, { style: 'card' });
  saveEncounterReturn(w);
}

async function finish(w: WorldCtx): Promise<void> {
  const pick = await w.choose(['Noch weiterreisen.', 'Das erste Buch abschließen.']);
  if (pick !== 1) return;
  saveEncounterReturn(w);
  w.lockPlayer();
  await G.ui.fade('out', 700);
  await showCredits();
  const { showTitle } = await import('../../scenes/BootScene');
  await showTitle();
}
