// Scene „e2-konzentration“ – Atem (docs/teil-2/umsetzung.md §3, F2 20:50–21:38). Day, the practice ground of the
// hermit's clearing. Lia doubts (her friends might be suffering while she sits in the moss); the stranger asks her
// to gather herself. Heart: the DOM minigame „Sammlung“ (konzentration-game.ts, rules in konzentration-logic.ts):
// a light in the centre, a breathing ring, thoughts („Kyra“, „Flick“, „der Hof“, „Foltan“) that drift past and pull
// the light away; Lia lets them pass, keeps the light centred and lets the breath go when it is full. Three calm
// breaths release a first conscious impulse at a practice stump. Failures only cost time.
// Lichtstoß: without it, Lia learns it here once (grantOnce + ability toast); with it (book one's travel), the
// stranger names the old reflex an instinct and the exercise its control. Nothing is unlearned. → e2-flicks-erinnerungen.
//
// Direct entry (?scene=e2-konzentration) uses the documented default state (no Lichtstoß, see shared.ts prepareE2).
// To test the other branch, after the scene started (no prepare, the state is kept):
//   G.state.learn('lichtstoss'); G.state.set('e2-lichtstoss-vorher', true);
//   G.ui.transition(() => G.goto('e2-konzentration'));   // transition clears open UI of the running scene first
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { halt } from '../kapitel-4/shared';
import { IG_EDGE, IG_SPOT, IG_STUMPS, igFireLight, ignatiusBase } from './ignatius-lager';
import { sammlungGame, type SammlungResult } from './konzentration-game';
import { bg, e2Scene, grantOnce, knewLichtstossBefore, lia, liaLook, mentor, sfx, ui, until, nextScene } from './shared';

const MENTOR = 'fremder';
/** Lia sits between the stumps, looking east across the practice ground. */
const LIA_SEAT: [number, number] = [236, 290];
const MENTOR_AT: [number, number] = [300, 318];
/** The stump the first impulse is aimed at. */
const AIM = IG_STUMPS[0];

export const konzentrationLager: MapDef = defineMap({
  ...ignatiusBase,
  id: 'e2-konzentration-lager',
  name: 'Der Übungsplatz',
  npcs: [{
    id: MENTOR, preset: 'e2-ignatius', speaker: 'e2-fremder', at: MENTOR_AT, dir: 'left',
    verb: 'Reden', talk: talkMentor,
    barks: ['Die Stümpfe laufen nicht weg.', 'Ich warte. Darin bin ich gut.'], barkEvery: 12000,
  }],
  props: [{ id: 'buecher', prop: 'bookstack', at: [702, 252], collide: false }],
  interactables: [
    { id: 'stuempfe', verb: 'Ansehen', at: AIM.base, radius: 26, once: false, onInteract: stumps },
    { id: 'eimer', verb: 'Trinken', at: IG_SPOT.bucket, radius: 26, once: false, onInteract: bucket },
    { id: 'holz', verb: 'Ansehen', poly: [[836, 214], [930, 214], [930, 292], [836, 292]], radius: 18, once: false, onInteract: firewood },
  ],
  exits: [
    { id: 'weg-sued', poly: IG_EDGE.south, to: 'e2-konzentration-lager', spawn: 'fire', when: () => false, blocked: 'Ich hab versprochen, es zu versuchen. Also versuche ich es.' },
    { id: 'weg-ost', poly: IG_EDGE.east, to: 'e2-konzentration-lager', spawn: 'fire', when: () => false, blocked: 'Ich hab versprochen, es zu versuchen. Also versuche ich es.' },
  ],
  lights: [igFireLight(0.4, 0.4)],
  time: 'day',
  ambience: ['birds', 'wind', 'stream'],
  ambienceVolume: { birds: 0.5, wind: 0.4, stream: 0.35 },
  music: 'refuge',
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Optional looks on the way to the practice ground
// ---------------------------------------------------------------------------------------------------------------

async function stumps(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-konzentration-done')) return;
  await w.think('Fünf Baumstümpfe, oben glatt gesessen. Irgendwer hat hier schon sehr lange geübt. Oder sehr lange gewartet.');
}

async function bucket(w: WorldCtx): Promise<void> {
  sfx('splash', { volume: 0.4 });
  await w.think('Kaltes Wasser. Kyra würde jetzt sagen: Trink nicht so hastig, du verschluckst dich. Und dann lachen, wenn ich mich verschlucke.');
}

async function firewood(w: WorldCtx): Promise<void> {
  await w.think('Ein Stapel wie eine Mauer. Für einen alten Mann allein ist das sehr viel Holz.');
}

async function talkMentor(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-konz-bereit')) return;
  G.state.set('e2-konz-bereit');
}

// ---------------------------------------------------------------------------------------------------------------
// Doubt, the exercise, the impulse
// ---------------------------------------------------------------------------------------------------------------

const say = (w: WorldCtx, text: string, mood?: string) => w.say(mentor(), text, mood ? { mood } : undefined);

async function doubt(w: WorldCtx): Promise<void> {
  const m = w.actor(MENTOR);
  m.hold(true);
  await w.player.walkTo(LIA_SEAT[0], LIA_SEAT[1], { face: 'right' });
  m.face('player');
  await say(w, 'Setz dich zwischen die Stümpfe. Nicht drauf. Die gehören den Ameisen.', 'happy');
  w.player.setIdle('sit');
  await w.wait(300);
  const answer = G.state.flag<string>('e2-urmacht-antwort');
  if (answer === 'sofort') await say(w, 'Du wolltest gleich anfangen. Jetzt ist gleich.');
  else if (answer === 'zweifel') await say(w, 'Hühner und Bücher, hast du gesagt. Heute brauchst du die Geduld von beiden.');
  await lia(w, 'Ich sitze hier im Moos. Und Kyra und Flick … vielleicht tut ihnen gerade jemand weh. Und ich übe Atmen.', 'sad');
  await lia(w, 'Ich sollte sie suchen. Nicht hier herumsitzen.', 'angry');
  await say(w, 'Deine Sorge ist laut. So laut, dass in deinem Kopf kein Platz für etwas anderes bleibt.', 'thinking');
  await lia(w, 'Soll ich sie etwa vergessen?', 'angry');
  await say(w, 'Nein. Nur nicht festhalten, solange du übst. Sie laufen dir nicht davon, wenn du sie kurz loslässt.');
  await lia(w, 'Ich bin ein Mädchen vom Hof. Das Licht hat sich die Falsche ausgesucht.', 'sad');
  await say(w, 'Auf dem Hof hast du gelernt, ein Huhn zu halten, ohne es zu zerdrücken. Genau das üben wir. Nur mit Licht.', 'happy');
  const pick = await w.choose(['„Gut. Zeigt es mir.“', '„Und wenn ich es nicht kann?“', '„Atmen kann ich, seit ich auf der Welt bin.“']);
  if (pick === 0) { G.state.set('e2-konz-ton', 'bereit'); await say(w, 'Zeigen musst du es mir. Ich sehe nur zu.'); }
  else if (pick === 1) { G.state.set('e2-konz-ton', 'angst'); await say(w, 'Dann sitzt du ein bisschen länger. Das ist die ganze Strafe.', 'happy'); }
  else { G.state.set('e2-konz-ton', 'trotz'); await say(w, 'Wunderbar. Dann musst du nur noch lernen, dabei mitzuzählen.', 'happy'); }
  await say(w, 'Schließ die Augen. In deiner Mitte ist ein Licht. Halte es dort. Mit den Gedanken, nicht mit der Faust.');
  await say(w, 'Gedanken werden kommen. Lass sie vorbeiziehen. Greifst du nach einem, nimmt er das Licht mit.');
  await say(w, 'Und wenn der Atem voll ist, lass ihn gehen. Dreimal ruhig. Dann sehen wir weiter.');
}

async function exercise(w: WorldCtx): Promise<SammlungResult> {
  // The clearing grows quiet while Lia gathers herself.
  const calmLight = w.lighting.add({ id: 'e2-sammlung', at: [LIA_SEAT[0], LIA_SEAT[1] - 20], kind: 'urmacht', radius: 26, intensity: 0, always: true });
  const result = await sammlungGame({
    advice: 'Der Fremde, leise: „Nicht festhalten. Zusehen, wie sie vorbeiziehen.“',
    onCalm: calm => { bg(calmLight.fadeTo(0.25 * calm, 500)); },
  });
  bg(calmLight.fadeTo(0.9, 300));
  return result;
}

async function impulse(w: WorldCtx): Promise<void> {
  w.player.setIdle('idle');
  await w.player.walkTo(LIA_SEAT[0] + 4, LIA_SEAT[1] + 2, { face: 'up' });
  w.player.face(AIM.base);
  await w.camera.pan([(LIA_SEAT[0] + AIM.top[0]) / 2, (LIA_SEAT[1] + AIM.top[1]) / 2], 700);
  const hand: [number, number] = [w.player.x + 8, w.player.y - 26];
  const glow = w.lighting.add({ id: 'e2-impuls', at: hand, kind: 'urmacht', radius: 30, intensity: 0, always: true });
  bg(w.player.play('cast', { ms: 1600 }));
  await glow.fadeTo(1, 500);
  sfx('beam', { volume: 0.55, pitch: 1.2 });
  w.fx.burst(hand, 'urmacht', 6);
  await w.wait(200);
  glow.set({ at: AIM.top });
  sfx('shockwave', { volume: 0.4, pitch: 1.4 });
  w.fx.burst(AIM.top, 'urmacht', 12);
  w.fx.burst(AIM.top, 'leaves', 8);
  w.camera.punch(0.4);
  await glow.fadeTo(0, 900);
  glow.remove();
  w.lighting.get('e2-sammlung').remove();
  w.camera.follow();
}

async function afterwards(w: WorldCtx, r: SammlungResult): Promise<void> {
  const knew = G.state.knows('lichtstoss');
  if (!knew) {
    await lia(w, 'Das … war ich. Und ich wollte es. Ich hab es wirklich gewollt.', 'surprised');
    await say(w, 'Ein Stoß, nicht größer als eine Faust, genau dahin, wohin du gesehen hast. So fängt es an.', 'happy');
    grantOnce('e2-konz-lichtstoss', () => G.state.learn('lichtstoss'));
  } else {
    G.state.set('e2-konz-kontrolle');
    await lia(w, knewLichtstossBefore()
      ? 'Das kenne ich. Auf der Reise mit Kyra und Flick ist mir das schon passiert, wenn es brenzlig wurde.'
      : 'Das kenne ich. So etwas ist mir schon passiert, wenn es brenzlig wurde.', 'thinking');
    await say(w, 'Damals kam es aus dem Bauch, aus Angst. Ein Instinkt, und er hat dich gerettet.', 'thinking');
    await say(w, 'Heute kam es, weil du es gerufen hast. Das ist der Unterschied. Das nennt man Kontrolle.', 'happy');
    await lia(w, 'Der Unterschied fühlt sich riesig an.');
    await say(w, 'Er ist so groß wie der zwischen Stolpern und Gehen.');
  }
  if (r.heldWords.length) {
    const word = r.heldWords[r.heldWords.length - 1];
    await say(w, `Du hast nach „${word}“ gegriffen, mitten im Atemzug. Das ist kein Fehler. Das ist Liebe. Nur gerade zur falschen Zeit.`, 'sad');
  } else if (r.stats.lost === 0 && r.stats.early + r.stats.restless + r.stats.missed === 0) {
    await say(w, 'Keinen einzigen Gedanken festgehalten. Entweder du hast Talent, oder du hast geschummelt.', 'happy');
    await lia(w, 'Beim Atmen kann man nicht schummeln.');
    await say(w, 'Siehst du. Talent.', 'happy');
  } else {
    await say(w, 'Es ist dir ein paarmal entglitten. Merk dir: Das Licht kommt zurück, wenn man es ruft.');
  }
  G.state.set('e2-konz-versuche', r.stats.lost + r.stats.early + r.stats.restless + r.stats.missed);
  await say(w, 'Morgen noch einmal. Und übermorgen. Bis du es kannst, ohne die Augen zu schließen.');
  await lia(w, 'Und Kyra und Flick?', 'sad');
  await say(w, 'Mit jedem Atemzug, den du beherrschst, bist du ihnen näher. Auch im Sitzen.', 'determined');
  await w.think('Ganz glaube ich ihm nicht. Aber das Licht war da, als ich es gerufen habe.');
}

// ---------------------------------------------------------------------------------------------------------------

async function konzentrationScript(w: WorldCtx): Promise<void> {
  G.state.set('e2-konz-bereit', false);
  w.setObjective('e2-konz-platz', 'Geh zum Übungsplatz. Der Fremde wartet bei den Baumstümpfen.', MENTOR);
  await until(w, () => G.state.is('e2-konz-bereit'));
  w.completeObjective('e2-konz-platz');
  await w.cutscene(() => doubt(w));
  w.setObjective('e2-konz-sammlung', 'Sammle dich: Halte das Licht in der Mitte, dreimal ruhig ausatmen.', null);
  w.lockPlayer();
  const result = await exercise(w);
  w.completeObjective('e2-konz-sammlung');
  w.unlockPlayer();
  await w.cutscene(async () => {
    await impulse(w);
    await afterwards(w, result);
  });
  halt(w, [MENTOR]);
  await ui().fade('out', 1200);
  G.state.set('e2-konzentration-done');
  await nextScene('e2-flicks-erinnerungen');
}

export const scene = e2Scene('e2-konzentration', 'Atem', async () => {
  await startWorld({ map: konzentrationLager, spawn: 'fire', player: liaLook(), companions: [], script: konzentrationScript });
});
