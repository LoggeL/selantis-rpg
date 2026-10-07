import { G } from '../../core/G';
import { findScene } from '../../core/registry';
import { defineMap, type WorldCtx } from '../../world';
import { BOOK2, continueToBook2 } from '../common/bookContract';
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
    { id: 'reiseende', verb: 'Reise beenden', at: [40, 482], radius: 26, sparkle: true, once: false, onInteract: finish },
  ],
  onEnter: async w => {
    G.state.setParty(['flick', 'kyra']);
    w.setObjective('k5-weiterreise', 'Sichert gemeinsam den Weg. Am Rastplatz könnt ihr euren Fortschritt ansehen.', 'reiseweg');
    if (!G.state.is('k5-weiterreise-start')) {
      G.state.set('k5-weiterreise-start');
      await w.say('flick', 'Eine Regel: Keiner läuft mehr allein in den Wald. Ich schau dabei übrigens niemanden an. Schon gar nicht dich.');
      await w.say('kyra', 'Und ich lauf diesmal freiwillig mit. Ganz ohne Strick.');
      await w.think('Kyra redet seit Stunden ohne Pause. Ich hab nie etwas Schöneres gehört.');
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
    await w.say('flick', 'Da war’s wieder, dein Licht. Nur hattest du es diesmal an der Leine.');
    await w.think('Keine Welle. Ein Stoß, nicht größer als eine Faust. Und ich hab ihn gewollt … glaube ich.');
    G.ui.toast('Lia lernt Lichtstoß.', 'ability');
  } else if (wins === 1) {
    await w.say('kyra', 'Woher wusstest du, wo die stehen? Steht das auch in deinen Büchern?');
    await w.think('Angst hatte ich trotzdem. Sie war nur leiser als meine Gedanken.');
  }
  saveEncounterReturn(w);
}

async function rest(w: WorldCtx): Promise<void> {
  await w.say('flick', 'Erst Wunden verbinden, dann weiter. Und keiner bleibt liegen, verstanden?');
  const lines = ['lia', 'flick', 'kyra'].map(id => {
    const p = G.state.character(id);
    const name = id === 'lia' ? 'Lia' : id === 'flick' ? 'Flick' : 'Kyra';
    return p ? `${name}: Level ${p.level}, ${p.exp}/100 EXP.` : `${name}: Die ersten gemeinsamen Schritte stehen noch bevor.`;
  });
  await w.narrate(lines, { style: 'card' });
  saveEncounterReturn(w);
}

async function finish(w: WorldCtx): Promise<void> {
  const book2 = Boolean(findScene(BOOK2.entry));
  const pick = await w.choose([
    { text: 'Noch weiterreisen.' },
    { text: 'Das erste Buch abschließen.' },
    { text: 'Weiter zu den Rebellen: Teil II „Letzte Hoffnung“.', disabled: !book2, reason: book2 ? undefined : 'Noch nicht verfügbar.' },
  ]);
  if (pick === 2) {
    w.lockPlayer();
    await G.ui.fade('out', 700);
    await continueToBook2();
    return;
  }
  if (pick !== 1) return;
  saveEncounterReturn(w);
  w.lockPlayer();
  await G.ui.fade('out', 700);
  await showCredits();
  const { showTitle } = await import('../../scenes/BootScene');
  await showTitle();
}
