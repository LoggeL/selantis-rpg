// Scene „e3-ritualangriff“ – Am Stein (docs/teil-3/umsetzung.md §3, F3 40:39–42:27). Two checkpointed parts (G.goto with
// { part }, a reload restarts the current part):
//  1. default: the tactics battle (ritualangriff-battle.ts; e3-ritual-weg from e3-ritual sets the allies' start).
//     Defeat offers „Erneut versuchen“ in the battle itself. On the win: Kyra free (e3-kyra-frei) and the staff back
//     with Lia (shared.staffBack('e3-stab-zurueck'), normally already handed over during the fight).
//  2. 'nach' (only after the win, e3-ritual-gewonnen): the hilltop right after the fight, torches and smoke, the relics
//     dark on their stands. Lia (own staff, poisoned: slow) goes to Kyra, who kneels by the stone: „ist es vorbei?“,
//     holes in her memory, a sword in her hand she cannot explain; Lia's answer (choice); Kyra needs room. Flick: the
//     staff (plate e3-stabrueckgabe here only if it was not handed over in the fight), where Ignatius went (after
//     Vamir, east). They split up: Flick stays with Kyra, the paladins search the north slope, Lia follows the track
//     east with the Spurenblick. Optional: the relics (e3-lore-relikte, also granted at the end).
//     Sets e3-ritual-gebrochen. → e3-vamir.
import { G } from '../../core/G';
import type { TacticsStartData } from '../../tactics/api';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import { EAST_EXIT, HILL_BLOCKS, HILL_OCCLUDERS, HILL_SPOT, HILL_TOP, STONE_BLOCK, TORCHES } from './ritual-huegel';
import { ritualCircle } from './ritual-kreis';
import { RITUAL_FLAGS, RITUAL_WON, STAFF_RETURNED, ritualBattle } from './ritualangriff-battle';
import { bg, e3Scene, hasOwnStaff, lia, liaGait, liaLook, nextScene, sfx, staffBack, ui, until } from './shared';

/** Flags of the beat after the fight (reset when it starts) and the contract flags. */
const F = {
  handedInFight: 'e3-ra-stab-im-kampf', kyra: 'e3-ra-kyra', flick: 'e3-ra-flick', split: 'e3-ra-aufgeteilt', gone: 'e3-ra-fort',
  kyraFree: 'e3-kyra-frei', broken: 'e3-ritual-gebrochen',
} as const;
const LORE = 'e3-lore-relikte';
const knowsRelics = (): boolean => G.state.data.lore.includes(LORE);

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the battle
// ---------------------------------------------------------------------------------------------------------------

function startBattle(): void {
  // In the regular story Flick carries the staff; if Lia already has it, there is nothing to hand over.
  const hadStaff = hasOwnStaff();
  G.stopGameplayScenes();
  ui().prefetchPlate('e3-stabrueckgabe');
  void G.ui.fade('in', 900);
  G.game.scene.start('Tactics', {
    battle: ritualBattle(),
    onEnd: async result => {
      if (result.outcome !== 'win') { await nextScene('e3-ritualangriff'); return; }
      G.state.set(F.handedInFight, !hadStaff && result.flags.includes(RITUAL_FLAGS.staff));
      // Inventory is the truth: the staff is back with Lia (idempotent; the battle's onWin already did it).
      staffBack(STAFF_RETURNED);
      G.state.set(F.kyraFree);
      await G.ui.fade('out', 900);
      await nextScene('e3-ritualangriff', { part: 'nach' });
    },
  } satisfies TacticsStartData);
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: after the fight
// ---------------------------------------------------------------------------------------------------------------

export const huegelDanach: MapDef = defineMap({
  id: 'e3-ritualhuegel-danach',
  name: 'Am Stein',
  background: 'e3-ritualhuegel',
  walk: [HILL_TOP],
  block: [...HILL_BLOCKS, STONE_BLOCK],
  occluders: HILL_OCCLUDERS,
  surface: 'dirt',
  npcs: [
    { id: 'kyra', preset: 'kyra', speaker: 'e3-kyra', at: HILL_SPOT.kyraAfter, dir: 'left', idle: 'kneel', facePlayer: false, verb: 'Zu Kyra', talk: talkKyra },
    { id: 'flick', preset: 'flick', speaker: 'e2-flick', at: HILL_SPOT.flickAfter, dir: 'right', verb: 'Mit Flick reden', talk: talkFlick },
    { id: 'paladin-1', preset: 'paladin-anfuehrer', speaker: 'e3-paladin', at: HILL_SPOT.paladinAfter1, dir: 'up', barks: ['Keiner mehr da.', 'Sie sind weg.'], barkEvery: 9000 },
    { id: 'paladin-2', preset: 'paladin-jung', speaker: 'e3-paladin-jung', at: HILL_SPOT.paladinAfter2, dir: 'left' },
  ],
  interactables: [
    { id: 'relikt', at: HILL_SPOT.relicStand, verb: 'Ansehen, was auf dem Ständer liegt', radius: 22, standAt: HILL_SPOT.relicStandAt, face: 'up', once: false, sparkle: true, when: () => !knowsRelics(), onInteract: lookAtRelic },
  ],
  clues: [
    { id: 'e3-ra-asche', at: HILL_SPOT.ash, kind: 'mark', thought: 'Asche, die nach nichts riecht. Kalt wie Eisen. Hier ist Vamir verschwunden.' },
    { id: 'e3-ra-spur-1', at: [790, 262], kind: 'footprint', angle: 20, thought: 'Ignatius’ Stiefel. Große, schnelle Schritte. Er ist gerannt.' },
    { id: 'e3-ra-spur-2', at: HILL_SPOT.trackStart, kind: 'mark', thought: 'Ein Brandfleck im Gras, noch warm. Bernsteinfarben. Er hat hier etwas abgewehrt.' },
    { id: 'e3-ra-spur-3', at: [1088, 334], kind: 'branch', angle: 0, thought: 'Abgeknickte Zweige. Hier ist er in den Wald, nach Osten.' },
  ],
  triggers: [
    { id: 'osten', poly: EAST_EXIT, once: false, when: () => G.state.is(F.split), onEnter: () => { G.state.set(F.gone); } },
  ],
  lights: TORCHES.map((t, i) => ({ id: `fackel-${i + 1}`, at: t.light, kind: 'fire' as const, radius: 110, intensity: 1, flame: 0.7, always: true })),
  spawns: { stein: { at: HILL_SPOT.liaAfter, dir: 'right' } },
  time: 'dusk',
  ambience: ['wind', 'fire'],
  ambienceVolume: { wind: 0.55, fire: 0.35 },
  music: null,
  lookMode: true,
  sneak: false,
  critters: false,
  resetOnEnter: true,
});

async function talkKyra(w: WorldCtx, kyra: ActorHandle): Promise<void> {
  if (G.state.is(F.kyra)) {
    await w.say('e3-kyra', G.state.is(F.split) ? 'Geh. Ich lauf dir nicht weg. Diesmal nicht.' : 'Nur noch ein bisschen sitzen. Dann geht es.', { mood: 'sad' });
    return;
  }
  await w.cutscene(async () => {
    await w.player.walkTo(HILL_SPOT.kyraAfter[0] - 24, HILL_SPOT.kyraAfter[1] + 2, { face: 'right' });
    w.player.setIdle('kneel');
    kyra.face('player');
    await w.say('e3-kyra', 'Lia? … Bist du das? Ist es vorbei? Bitte sag, dass es vorbei ist.', { mood: 'scared' });
    await lia(w, 'Es ist vorbei. Sie sind weg. Und du bist wieder du. Deine Augen sind wieder braun.', 'happy');
    await w.say('e3-kyra', 'Ich hatte ein Schwert in der Hand. Ich weiß nicht, woher. Und auch nicht, was ich damit gemacht hab.', { mood: 'scared' });
    await w.say('e3-kyra', 'Da sind Löcher, Lia. Tage. Und in den Löchern bin ich neben dir hergegangen und hab gelächelt.', { mood: 'sad' });
    const pick = await w.choose(['„Das warst nicht du.“', '„Später. Jetzt atmest du erst mal.“', 'Sie in den Arm nehmen'], { prompt: 'Was tut Lia?', speaker: 'e3-lia' });
    G.state.set('e3-ra-kyra-antwort', pick);
    if (pick === 0) {
      await lia(w, 'Das warst nicht du. Das war er. Ich hab es dir angesehen, die ganze Zeit, ich wollte es nur nicht glauben.', 'determined');
      await w.say('e3-kyra', 'Und wenn doch ein Stück von mir dabei war? Wie soll ich das je wissen?', { mood: 'sad' });
      await lia(w, 'Dann finden wir es zusammen raus. Aber nicht heute.', 'sad');
    } else if (pick === 1) {
      await lia(w, 'Später. Jetzt atmest du erst mal. Ein, aus. Das konntest du immer besser als ich.', 'sad');
      await w.say('e3-kyra', 'Angeberin.', { mood: 'happy' });
      await w.think('Ein halbes Lächeln. Ihr eigenes. Das reicht mir fürs Erste.');
    } else {
      w.player.setIdle('idle');
      await w.wait(300);
      await w.say('e3-kyra', 'Nicht … bitte noch nicht. Ich muss erst wissen, wo ich aufhöre und wo er angefangen hat.', { mood: 'scared' });
      w.player.setIdle('kneel');
      await lia(w, 'Gut. Ich bleib einfach hier. Ohne anfassen.', 'sad');
    }
    await w.say('e3-kyra', 'Lass mich ein bisschen hier sitzen. Allein. Nur ein bisschen.', { mood: 'sad' });
    w.player.setIdle('idle');
    await w.think('Ich bin so froh, dass sie da ist, dass es wehtut. Und sie kann mir kaum in die Augen sehen.');
  });
  G.state.set(F.kyra);
  w.setObjective('e3-ra-weiter', 'Flick wartet am Stein.', 'flick');
}

async function talkFlick(w: WorldCtx, flick: ActorHandle): Promise<void> {
  if (!G.state.is(F.kyra)) {
    await w.say('e2-flick', 'Erst Kyra. Ich lauf nicht weg, ich steh hier rum und seh gefährlich aus.', { mood: 'smirk' });
    return;
  }
  if (G.state.is(F.flick)) {
    await w.say('e2-flick', 'Osten, Leseratte. Und schrei, wenn du ihn findest.', { mood: 'determined' });
    return;
  }
  await w.cutscene(async () => {
    flick.face('player');
    if (G.state.is(F.handedInFight)) {
      await w.say('e2-flick', 'Und? Liegt er noch gut in der Hand? Ich hab ihn nicht ein Mal fallen lassen. Fast nicht.', { mood: 'smirk' });
      await lia(w, 'Er liegt, als wäre er nie weg gewesen. Danke, Flick. Für alles. Du bist wirklich gekommen.', 'happy');
    } else {
      await ui().plate('e3-stabrueckgabe', { caption: 'Lias Stab', pan: 'in', durationMs: 9000 });
      await w.say('e2-flick', 'Bevor ich’s vergesse, Zauberin. Der gehört dir. Ignatius hat ihn mir aus der Kammer geholt.', { mood: 'smirk' });
      await lia(w, 'Du hast ihn mir hergebracht. Durch den halben Wald.', 'surprised');
      await w.say('e2-flick', 'Und über einen Hügel voller Leute, die mich nicht leiden können. Gern geschehen.', { mood: 'smirk' });
      await ui().closePlate();
      await lia(w, 'Danke, Flick. Wirklich. Du bist gekommen.', 'happy');
    }
    await w.say('e2-flick', 'Hab ich doch gesagt. Ich bin schwer abzuschütteln.', { mood: 'happy' });
    await lia(w, 'Wo ist Ignatius? Er ist Vamir nach, als der im Rauch verschwand. Allein.', 'scared');
    await w.say('e2-flick', 'Er hat nur gerufen, dass er ihn diesmal nicht laufen lässt. Dann war er weg. Nach Osten, den Hang runter.', { mood: 'determined' });
    await w.say('e3-paladin', 'Wir durchkämmen den Nordhang. Falls Vamir dort einen Weg hinunter hat, finden wir ihn.');
    await w.say('e2-flick', 'Ich bleib bei Kyra. Die steht so bald nicht auf, und allein lass ich sie hier oben nicht.', { mood: 'determined' });
    await lia(w, 'Dann nehme ich die Spur nach Osten.', 'determined');
    await w.say('e2-flick', 'Mit Gift in den Beinen? Leseratte …', { mood: 'angry' });
    await lia(w, 'Ich muss ihn noch etwas fragen. Und das geht nicht, wenn Vamir ihn vorher erwischt.', 'determined');
    await w.say('e2-flick', 'Dann schrei, wenn du ihn findest. Laut. Wir hören dich.', { mood: 'determined' });
  });
  G.state.set(F.flick);
  G.state.set(F.split);
  w.completeObjective('e3-ra-weiter');
  w.setObjective('e3-ra-spur', `Folge Ignatius’ Spur nach Osten (${w.controlHint('look')} halten für den Spurenblick).`, HILL_SPOT.eastEdge);
}

async function lookAtRelic(w: WorldCtx): Promise<void> {
  if (knowsRelics()) return;
  await w.cutscene(async () => {
    await w.think('Ein Horn mit einem langen Riss. Daneben auf den anderen Ständern eine Schale, ein Reif, ein Stein mit Rillen.');
    await w.think('Alt. Älter als jedes Buch, das ich kenne. Und vorhin haben sie alle auf mich gezeigt.');
    await w.say('e3-paladin', 'Rührt das nicht an. Der Großmeister wird wissen wollen, was mit diesen Dingen geschieht.');
  });
  G.state.addLore(LORE);
}

/** Smoke drifts from where the fight was; the relics stay dark. */
async function smoke(w: WorldCtx): Promise<void> {
  const spots: [number, number][] = [[520, 380], [780, 300], [430, 280], [860, 420]];
  for (let i = 0; w.alive; i++) {
    w.fx.burst(spots[i % spots.length], 'smoke', 4);
    await w.wait(1400);
  }
}

async function nachScript(w: WorldCtx): Promise<void> {
  for (const f of [F.kyra, F.flick, F.split, F.gone]) G.state.set(f, false);
  w.lockPlayer();
  liaGait(w);
  const circle = ritualCircle(w, { veiled: false });
  circle.breakOff();
  bg(smoke(w));
  await ui().fade('in', 1400);
  await w.cutscene(async () => {
    await w.wait(500);
    sfx('rustle', { volume: 0.3 });
    await w.think('Still. Nur die Fackeln knacken, und irgendwo unten am Hang rennt jemand durchs Unterholz davon.');
    await w.think('Der Faden in meiner Brust ist weg. Mir ist schwindlig, die Beine sind Watte. Aber er ist weg.');
  });
  w.setObjective('e3-ra-weiter', 'Kyra kniet neben dem Stein. Geh zu ihr.', 'kyra');
  w.unlockPlayer();
  await until(w, () => G.state.is(F.gone) && !G.ui.busy(), 150);
  w.completeObjective('e3-ra-spur');
  w.lockPlayer();
  await lia(w, 'Ignatius! Warte auf mich!', 'scared');
  // End of the scene: the ritual is broken; what was on the stands is known (nameless).
  G.state.addLore(LORE);
  G.state.set(F.broken);
  await ui().fade('out', 1000);
  await nextScene('e3-vamir');
}

export const scene = e3Scene('e3-ritualangriff', 'Am Stein', async params => {
  if (params?.part === 'nach' && G.state.is(RITUAL_WON)) {
    await ui().fade('out', 0);
    await startWorld({ map: huegelDanach, spawn: 'stein', player: liaLook(), companions: [], fadeIn: false, script: nachScript });
    return;
  }
  startBattle();
});
