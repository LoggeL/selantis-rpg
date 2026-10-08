// Scene „e2-flicks-herkunft“ – Halb und halb (docs/teil-2/umsetzung.md §3). Night in the camp, fireflies. Lia wakes
// exhausted (slow walking), Kyra tells what she did. Heart: a free night camp – Azar at the kettle (memory), Foltan
// at the palisade (a second chance shaped by e2-foltan-haltung), the druid (neutral about the test), Alastir – and the
// mandatory search for Flick: her footprints (Spurenblick) lead to the foot of the watchtower. Flick explains her
// half origin, the half-truth at the oath, being turned away by humans and elves; Lia asks who sits with her in the
// dark and confirms she belongs (three tones, all yes). No numeric mistrust anywhere. Sleep in the tent → e2-lagerangriff.
import { registerMemories } from '../../core/catalog';
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { campBase } from '../kapitel-4/lager';
import { halt } from '../kapitel-4/shared';
import { bg, e2Scene, lia, sfx, ui, until, nextScene } from './shared';

registerMemories([
  { id: 'e2-mem-nachtsuppe', title: 'Azars Nachtsuppe', text: 'Azar hat mir mitten in der Nacht Suppe gebracht. Rezept aus Ignis: alles hinein, was nicht wegläuft. Sie schmeckte nach Rauch, Liebstöckel und Sorge. Die kocht er immer mit, sagt er.' },
]);

const TENT: [number, number] = [190, 462];
const FLICK_AT: [number, number] = [224, 208];

export const lagerNacht: MapDef = defineMap({
  ...campBase,
  id: 'e2-lager-nacht',
  name: 'Das Lager bei Nacht',
  npcs: [
    { id: 'kyra', preset: 'kyra', at: [148, 474], dir: 'right', talk: talkKyra, verb: 'Reden' },
    { id: 'azar', preset: 'azar', at: [568, 302], dir: 'right', talk: talkAzar, verb: 'Reden', barks: ['Suppe! Wer will noch?', 'Psst. Die Kleine schläft. Ach nein, da ist sie ja.'], barkEvery: 12000 },
    { id: 'foltan', preset: 'foltan', at: [744, 504], dir: 'down', talk: talkFoltan, verb: 'Reden' },
    { id: 'druide', preset: 'e2-druide', speaker: 'e2-druide', at: [960, 438], dir: 'left', talk: talkDruid, verb: 'Reden' },
    { id: 'alastir', preset: 'alastir', at: [792, 232], dir: 'down', talk: talkAlastir, verb: 'Reden' },
    { id: 'flick', preset: 'flick', at: FLICK_AT, dir: 'up', idle: 'sit', talk: talkFlick, verb: 'Reden' },
    { id: 'e2-nachtwache', preset: 'guard-brotherhood', at: [600, 540], dir: 'down', barks: ['Ruhige Nacht. Zu ruhig.'], barkEvery: 15000 },
  ],
  props: [
    { prop: 'torch', at: [462, 262], collide: false },
    { prop: 'torch', at: [820, 262], collide: false },
    { prop: 'torch', at: [546, 486], collide: false },
    { prop: 'torch', at: [714, 486], collide: false },
  ],
  interactables: [
    {
      id: 'zelt', verb: 'Schlafen gehen', poly: [[150, 384], [206, 380], [216, 426], [164, 440]], standAt: TENT, face: 'up', once: false,
      onInteract: async w => {
        if (!G.state.is('e2-flick-gespraech')) { await w.think('Noch nicht. Erst will ich wissen, wo Flick steckt.'); return; }
        G.state.set('e2-schlafen');
      },
    },
  ],
  clues: [
    { id: 'spur-1', at: [480, 282], kind: 'footprint', angle: 190, verb: 'Ansehen', onInteract: w => track(w, 1) },
    { id: 'spur-2', at: [336, 282], kind: 'footprint', angle: 185, verb: 'Ansehen', onInteract: w => track(w, 2) },
    { id: 'spur-3', at: [256, 238], kind: 'footprint', angle: 225, verb: 'Ansehen', onInteract: w => track(w, 3) },
  ],
  lights: [
    { id: 'lagerfeuer', at: [636, 330], kind: 'fire', radius: 170, intensity: 1.1, flame: 1.1 },
    { id: 'esse', at: [1024, 236], kind: 'fire', radius: 60, intensity: 0.6 },
    { id: 'zelt-licht', at: [172, 420], kind: 'candle', radius: 40, intensity: 0.6 },
    { id: 'mond', at: [200, 0], kind: 'moon', radius: 420, intensity: 0.3 },
  ],
  exits: [{
    id: 'tor', poly: [[588, 706], [680, 706], [680, 720], [588, 720]], to: 'e2-lager-nacht', spawn: 'zelt',
    when: () => false, blocked: 'Nachts raus? Mit diesen Beinen? Nein.',
  }],
  spawns: { zelt: { at: TENT, dir: 'down' } },
  time: 'night',
  weather: 'fireflies',
  ambience: ['night', 'crickets', 'fire', 'camp'],
  ambienceVolume: { fire: 0.6, camp: 0.3, crickets: 0.7 },
  music: 'refuge',
  playerLight: 60,
  lookMode: true,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------

interface PlayerSpeed { walkSpeed: number; runSpeed: number }

/** Exhausted after the test: Lia walks slowly and cannot really run. */
function tired(w: WorldCtx): void {
  const p = (w.scene as unknown as { player?: PlayerSpeed }).player;
  if (!p) return;
  p.walkSpeed *= 0.55;
  p.runSpeed = p.walkSpeed * 1.15;
}

async function wake(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra');
  kyra.hold(true);
  w.player.setIdle('lie');
  void ui().fade('in', 1400);
  await w.cutscene(async () => {
    await w.wait(900);
    await w.think('Mein Kopf ist aus Watte. Meine Arme aus Blei. Und irgendwer hat mir über Nacht die Knochen ausgetauscht.');
    await w.say('kyra', 'Wach? Sag was. Irgendwas. Notfalls was Kluges.', { mood: 'worried' });
    await lia(w, 'Was Kluges … hab ich gerade nicht. Nur Kopfschmerzen.', 'pained');
    w.player.setIdle('kneel');
    await w.wait(700);
    w.player.setIdle('idle');
    w.player.face('kyra');
    await lia(w, 'Was ist passiert? Ich weiß nur noch die Schale.', 'thinking');
    await w.say('kyra', 'Was passiert ist? Du hast den Strick an deinen Handgelenken zerrissen wie Spinnweben!', { mood: 'happy' });
    await w.say('kyra', 'Zwei Rebellen haben dich gehalten. Am Ende saßen beide im Gras, und einer hatte den Kessel auf dem Schoß.', { mood: 'happy' });
    await w.say('kyra', 'Der Druide sagt, du warst wie die Zehn in den alten Geschichten. Und dass vielleicht einer namens Ignatius helfen kann.');
    await lia(w, 'Ich hab vor allen Leuten geleuchtet. Großartig. Ich wollte nie auffallen.', 'sad');
    await w.say('kyra', 'Zu spät. Die Hälfte vom Lager guckt dich jetzt an wie einen Geist. Die andere will dir Suppe bringen.', { mood: 'happy' });
    await lia(w, 'Wo ist Flick?');
    await w.say('kyra', 'Weg, seit du schläfst. Das macht sie, wenn ihr was zu viel wird. Irgendwo an der Palisade, wo keiner hinguckt.', { mood: 'worried' });
    await w.say('narrator', `Flicks Spuren findest du im Spurenblick (${w.controlHint('look')} halten). Langsam: Deine Beine wollen noch nicht so recht.`);
  });
  kyra.hold(false);
}

async function track(w: WorldCtx, n: number): Promise<void> {
  if (G.state.is(`e2-flickspur-${n}`)) { await w.think('Die hab ich schon gesehen.'); return; }
  G.state.set(`e2-flickspur-${n}`);
  if (n === 1) await w.think('Weiche Sohlen, kurze Schritte, kaum eingedrückt. So läuft nur eine, die nicht gehört werden will.');
  else if (n === 2) await w.think('Sie hat einen Bogen um die Wache gemacht. Natürlich hat sie das.');
  else await w.think('Die Spur endet am Turm. Da oben sitzt jemand und tut so, als wäre er ein Schatten.');
  const next = [1, 2, 3].find(i => !G.state.is(`e2-flickspur-${i}`));
  if (!G.state.is('e2-flick-gespraech')) w.setObjectiveTarget(n === 3 || !next ? 'flick' : `spur-${next}`);
}

// ---------------------------------------------------------------------------------------------------------------
// Optional night talks
// ---------------------------------------------------------------------------------------------------------------

async function talkKyra(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-flick-gespraech')) { await w.say('kyra', 'Rein mit dir. Morgen erzählst du mir, was ein Druide eigentlich den ganzen Tag macht.', { mood: 'happy' }); return; }
  await w.say('kyra', 'Geh schon, such sie. Ich warte hier. Im Warten bin ich neuerdings richtig gut.', { mood: 'happy' });
}

async function talkAzar(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  if (G.state.data.memories.includes('e2-mem-nachtsuppe')) {
    await azar.say(G.state.flag<string>('e2-foltan-haltung') === 'kalt'
      ? 'Foltan steht an der Palisade und traut sich nicht her. Ich sag ja nichts. Ich hab’s nur gesagt.'
      : 'Noch eine Kelle? Nein? Dann ess ich sie. Wäre schade drum.', { mood: 'happy' });
    return;
  }
  azar.face('player');
  await azar.say('Du! Setz dich. Nein, steh lieber. Egal. Iss.', { mood: 'happy' });
  sfx('eat', { volume: 0.6 });
  await azar.say('Nachtsuppe nach dem Rezept meiner Großmutter aus Ignis. Alles rein, was nicht wegläuft.');
  await lia(w, 'Schmeckt nach Rauch. Und nach Liebstöckel.', 'happy');
  await azar.say('Und nach Sorge. Die koch ich immer mit. Gibt Farbe.', { mood: 'happy' });
  G.state.addMemory('e2-mem-nachtsuppe');
  await azar.say('Wer leuchtet, muss essen. Steht in keinem Buch, ist aber wahr.');
}

async function talkFoltan(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan');
  const night = G.state.flag<string>('e2-foltan-nacht');
  if (night) { await foltan.say('Gute Nacht, Lia.', { mood: 'ashamed' }); return; }
  foltan.face('player');
  if (G.state.flag<string>('e2-foltan-haltung') === 'offen') {
    await foltan.say('Ich hab heute Abend gebetet. Ich bete nie. Azar sagt, man hört es mir an.', { mood: 'ashamed' });
    await lia(w, 'Für wen?');
    await foltan.say('Für eine Leserin mit zu viel Mut und zu wenig Schlaf.');
    const pick = await w.choose(['„Danke.“', '„Bete nächstes Mal vorher. Bevor mir jemand eine Schale gibt.“']);
    G.state.set('e2-foltan-nacht', pick === 0 ? 'dank' : 'spitz');
    if (pick === 0) await foltan.say('Bedank dich nicht. Ich hab noch einiges abzutragen.');
    else await foltan.say('Gerechtfertigt. Ich hätte mit Elnon streiten sollen. Ich hab gezögert. Schon wieder.', { mood: 'ashamed' });
    return;
  }
  await foltan.say('Ich weiß. Du willst mich nicht sehen. Ich bleib hier stehen, du musst nicht näherkommen.', { mood: 'ashamed' });
  await foltan.say('Vorhin, als das Licht aus dir kam, dachte ich: Jetzt verlier ich sie auch noch. Durch unseren eigenen Anführer.');
  const pick = await w.choose(['„Sag den Rest. Ich hör zu. Diesmal.“', '„Nicht heute, Foltan.“']);
  if (pick === 0) {
    G.state.set('e2-foltan-nacht', 'angehoert');
    await foltan.say('Der Rest ist kurz. Ich lag falsch. Über Kyra und über dich. Mehr hab ich nicht.');
    await lia(w, 'Das ist nicht viel.', 'thinking');
    await foltan.say('Nein. Aber es ist ehrlich. Das war ich dir lange schuldig.');
  } else {
    G.state.set('e2-foltan-nacht', 'abgewiesen');
    await foltan.say('Dann morgen. Oder übermorgen. Geduld hab ich von der Garde. Viel mehr ist mir von dort nicht geblieben.');
  }
}

async function talkDruid(w: WorldCtx): Promise<void> {
  const say = (t: string, mood?: string) => w.say('e2-druide', t, mood ? { mood } : undefined);
  if (!G.state.is('e2-druide-nacht')) {
    G.state.set('e2-druide-nacht');
    await say('Du stehst. Das ist mehr, als ich heute Abend zu hoffen gewagt habe.');
  }
  const pick = await w.choose([
    '„Was macht der Trank mit Leuten ohne Kraft?“',
    '„Wer ist dieser Ignatius?“',
    '„Danke. Glaub ich.“',
  ]);
  if (pick === 0) {
    await say('Darüber rede ich nicht vor dem Schlafen. Nur so viel: Elnon hat es sich nicht leicht gemacht. Ich auch nicht.', 'grim');
  } else if (pick === 1) {
    await say('Einer der Zehn Geweihten, aus Ignis. Ob er lebt, weiß ich nicht. Ich denke noch nach, wie man ihn fände.');
  } else {
    await say('Dank ist ein großes Wort für einen, der dir die Schale gereicht hat.');
  }
  if (!G.state.is('e2-druide-sorge')) {
    G.state.set('e2-druide-sorge');
    await say('Ein Licht wie deins sieht man weit. Ich hoffe, heute Abend haben nur wir hingesehen.', 'worried');
  }
}

async function talkAlastir(w: WorldCtx): Promise<void> {
  const al = w.actor('alastir');
  if (G.state.is('e2-alastir-nacht')) { await al.say('Schlaf. Licht braucht Ruhe, wie alles andere.'); return; }
  G.state.set('e2-alastir-nacht');
  await al.say('Du hast heute den Himmel angezündet. Ebaril brannte auch hell.', { mood: 'grim' });
  await al.say('Deins war schöner. Es hat niemanden verbrannt.');
}

// ---------------------------------------------------------------------------------------------------------------
// The mandatory talk at the foot of the tower
// ---------------------------------------------------------------------------------------------------------------

async function talkFlick(w: WorldCtx): Promise<void> {
  const flick = w.actor('flick');
  if (G.state.is('e2-flick-gespraech')) { await w.say('flick', 'Schlaf, Leseratte. Ich hab die Wache. Freiwillig.', { mood: 'smirk' }); return; }
  const kyra = w.actor('kyra');
  await w.cutscene(async () => {
    await w.player.walkTo(FLICK_AT[0] + 24, FLICK_AT[1] + 10, { face: 'left' });
    w.player.setIdle('sit');
    flick.face('player');
    await w.say('flick', 'Na, Leseratte. Wieder unter den Lebenden? Du hast vorhin geleuchtet bis über die Wipfel.', { mood: 'smirk' });
    await w.say('flick', 'Die halbe Bruderschaft hat jetzt Respekt vor dir. Die andere Hälfte Angst. Gute Mischung.');
    await lia(w, 'Und du sitzt hier im Dunkeln.');
    await w.say('flick', 'Hier guckt keiner. Bester Platz im Lager.');
    await lia(w, 'Du hast gesagt, die wollen keine wie dich. Aber hier laufen Elfen herum wie Hühner auf unserem Hof.', 'thinking');
    await w.say('flick', 'Ganze Elfen. Ich bin nur die Hälfte.', { mood: 'sad' });
    await w.say('flick', 'Halb Elfe, halb Mensch. Für die einen zu spitz, für die anderen zu rund.', { mood: 'smirk' });
    await lia(w, 'Und deswegen der Ärger mit Elnon?');
    await w.say('flick', 'Beim Eid haben sie gefragt, wer ich bin. Ich hab die Hälfte erzählt, die sie hören wollten.', { mood: 'sad' });
    await w.say('flick', 'Als die andere Hälfte rauskam, war ich keine Halbelfe mehr. Ich war eine Lügnerin. Das wiegt bei Elnon schwerer.');
    await lia(w, 'Und die Menschen? Die sind doch nicht …');
    await w.say('flick', 'In Trapas haben sie unter meiner Mütze nach Ohren gesucht. Bei den Elfen nach dem Rest. Gefunden haben beide was.', { mood: 'angry' });
    await w.say('flick', 'Irgendwann hört man auf, sich zu ärgern. Fast.');
    await lia(w, 'Und wer sitzt dann mit dir im Dunkeln?', 'sad');
    await w.wait(800);
    await w.say('flick', 'Bis vor ein paar Tagen? Keiner. Die Elfen von Grunwald sind ein sehr ruhiger Haufen.', { mood: 'smirk' });
    await w.say('flick', 'Man redet viel mit Bäumen. Die widersprechen wenigstens nicht.', { mood: 'sad' });
    const pick = await w.choose([
      '„Jetzt sitze ich hier. Und Kyra kommt gleich nach, wetten?“',
      '„Grunwald hat jetzt drei Mitglieder. Eine davon schnarcht.“',
      '„Du gehörst zu uns. Nicht zur Hälfte. Ganz.“',
    ]);
    G.state.set('e2-flick-ton', pick);
    if (pick === 0) {
      await w.say('flick', 'Die Wette hast du verloren, bevor du sie angefangen hast. Ich hör sie schon trampeln.', { mood: 'happy' });
    } else if (pick === 1) {
      await w.say('flick', 'Drei. Damit sind wir größer als manche Fürstengarde. Und kleiner als jede Schafherde.', { mood: 'smirk' });
    } else {
      void flick.emote('…');
      await w.wait(900);
      await w.say('flick', 'Sag so was nicht so laut. Sonst muss ich nett zu euch sein.', { mood: 'happy' });
    }
    kyra.hold(true);
    await kyra.walkTo(FLICK_AT[0] - 26, FLICK_AT[1] + 12, { face: 'right' });
    await w.say('kyra', 'Hier steckt ihr! Rückt mal. Ich hab Brot geklaut. Also, geliehen.', { mood: 'happy' });
    kyra.setIdle('sit');
    sfx('eat', { volume: 0.4 });
    await w.wait(700);
    await w.say('flick', 'Geht schlafen, ihr zwei. Ich halte Wache. Freiwillig.', { mood: 'smirk' });
    await w.think('Zum ersten Mal seit dem Hof fühlt sich ein Lager an wie ein Zuhause. Ein kleines. Mit Palisade.');
    G.state.set('e2-flick-gespraech');
    w.player.setIdle('idle');
    kyra.setIdle('idle');
    bg(kyra.walkTo(TENT[0] - 30, TENT[1] + 12, { face: 'up' }));
  });
}

// ---------------------------------------------------------------------------------------------------------------

async function herkunftScript(w: WorldCtx): Promise<void> {
  await wake(w);
  tired(w);
  w.setObjective('e2-flick-suchen', 'Such Flick. Irgendwo an der Palisade.', 'spur-1');
  await until(w, () => G.state.is('e2-flick-gespraech'));
  w.completeObjective('e2-flick-suchen');
  w.setObjective('e2-schlafen', 'Geh schlafen. Rede vorher mit wem du magst.', 'zelt');
  await until(w, () => G.state.is('e2-schlafen'));
  w.completeObjective('e2-schlafen');
  w.lockPlayer();
  await w.cutscene(async () => {
    w.player.setIdle('lie');
    await ui().fade('out', 1200);
    await w.narrate('Lia schlief, kaum dass sie lag. Draußen saß Flick am Turm und zählte Sterne. Sie kam bis Crios. Weiter wollte sie gar nicht.', { style: 'card' });
  });
  G.state.set('e2-flick-zugehoerig');
  halt(w, ['kyra', 'flick', 'azar', 'foltan']);
  await nextScene('e2-lagerangriff');
}

export const scene = e2Scene('e2-flicks-herkunft', 'Halb und halb', () =>
  startWorld({ map: lagerNacht, spawn: 'zelt', player: 'lia-cloak', companions: [], fadeIn: false, script: herkunftScript }));
