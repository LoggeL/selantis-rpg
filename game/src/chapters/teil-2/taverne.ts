// Scene „e2-taverne“ – Rast im Goldenen Eber (docs/teil-2/umsetzung.md §3). Teil II opens where book one lied to Lia:
// the Goldener Eber, early evening. Heart: three sources (Craupor questioned by Flick, a trapper, the barmaid) each
// give one piece of today's way to the Brotherhood's camp; at the table the three pick the route (taverne-route.ts),
// wrong picks are corrected by Flick without penalty. Optional: Kyra at the stable door, Craupor's provisions once.
import { registerClues, registerMemories } from '../../core/catalog';
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { eberMap } from '../kapitel-3/eber';
import { halt } from '../kapitel-4/shared';
import { loggeCat, loggeGlasses, loggeNpc, pascalNpc, sebastianNpc } from './logge';
import { judgeRoute, ROUTE_CLUES, ROUTES, routeTag, sourcesFound } from './taverne-route';
import { bg, e2Scene, grantOnce, knewLichtstossBefore, lia, noteLichtstossOrigin, sfx, ui, until, nextScene } from './shared';

registerClues([
  { id: ROUTE_CLUES.craupor, title: 'Craupor: Posten weit draußen', text: 'Das Lager der Bruderschaft liegt nah, sagt Craupor. Wo genau, verrät ihm keiner. Ihre Posten stehen weit vor dem Lager: Wer es sieht, ist längst gesehen worden.' },
  { id: ROUTE_CLUES.rinde, title: 'Kerben am Bach', text: 'Der Fallensteller hat am Bach nördlich des Ebers frische Kerben in der Rinde gesehen, drei untereinander wie Krähenfüße. Nicht seine Zeichen und keine von Holzfällern.' },
  { id: ROUTE_CLUES.eiche, title: 'Mehl nach Norden', text: 'Jeden Morgen holt ein schweigsamer Mann zwei Säcke Mehl im Eber und geht nach Norden, an der umgestürzten Eiche vorbei. Er zahlt in Kupfer und sagt nie seinen Namen.' },
  { id: 'e2-spur-zugang', title: 'Der Weg zur Bruderschaft', text: 'Nach Norden bis zur umgestürzten Eiche, dann den Bach hinauf, den frischen Kerben in der Rinde nach. Irgendwo davor stehen Posten. Die sehen uns zuerst.' },
]);

registerMemories([
  { id: 'e2-mem-stalltuer', title: 'Die Stalltür im Eber', text: 'Kyra stand vor der Stalltür und ging nicht hinein. Durch ein Loch im Dach hatte sie dort nachts einen Stern gesehen und sich vorgestellt, ich sähe ihn auch. Ich hab ihn gesehen. Jede Nacht.' },
]);

// ---------------------------------------------------------------------------------------------------------------
// Map: the taproom in the early evening (geometry and lights of k3-eber)
// ---------------------------------------------------------------------------------------------------------------

const SEAT_LIA: [number, number] = [112, 160];
const SEAT_KYRA: [number, number] = [198, 150];
const SEAT_FLICK: [number, number] = [46, 150];
const TABLE_STAND: [number, number] = [112, 176];
const COUNTER: [number, number] = [504, 134];
const DOOR: [number, number] = [284, 336];

/** Logge's cat sleeps on the cameo table; the player pets it from the gap between the two stools. */
const CAT = loggeCat([446, 170], [440, 196]);

const found = (): number => sourcesFound(G.state.data.clues);

export const eberAbend: MapDef = defineMap({
  ...eberMap,
  id: 'e2-eber',
  name: 'Zum Goldenen Eber',
  npcs: [
    { id: 'craupor', preset: 'craupor', at: [538, 98], dir: 'left', talk: talkCounter, verb: 'Reden' },
    { id: 'flick', preset: 'flick', at: SEAT_FLICK, dir: 'right', idle: 'sit', talk: talkFlick, verb: 'Reden' },
    { id: 'kyra', preset: 'kyra', at: SEAT_KYRA, dir: 'left', idle: 'sit' },
    {
      id: 'schankmaid', preset: 'barmaid', speaker: 'schankmaid', at: [392, 268], wander: 30, speed: 38, talk: talkMaid, verb: 'Reden',
      barks: ['Heiß! Aus dem Weg!', 'Wer hat den Krug da stehen lassen?'], barkEvery: 10000,
    },
    {
      id: 'jaeger', preset: 'villager-m', speaker: 'e2-jaeger', at: [40, 238], dir: 'up', talk: talkTrapper, verb: 'Reden',
      barks: ['Hmpf.', 'Drei Hasen. Drei! In einer Woche.'], barkEvery: 12000,
    },
    { id: 'zwerg', preset: 'dwarf', speaker: 'zwerg', at: [98, 284], dir: 'left', talk: talkDwarf, verb: 'Reden' },
    { id: 'spielmann', preset: 'bard', at: [262, 132], dir: 'left', barks: ['♪ Leise, leise, der Abend ist jung … ♪', '♪ Ein Krug für den, der singt! ♪'], barkEvery: 8000 },
    {
      id: 'hund', preset: 'dog', at: [80, 116], dir: 'right', idle: 'lie', solid: false, verb: 'Streicheln',
      talk: async w => { void w.actor('hund').emote('heart'); await w.think('Er erkennt mich. Oder er erkennt meinen Beutel mit dem Käse.'); },
    },
    // Cameo guests (user's wish): Logge, drunk and breaking the fourth wall, his sober friend Sebastian, and Pascal alone.
    loggeNpc([419, 184], 'right'),
    sebastianNpc([461, 184], 'left'),
    pascalNpc([476, 300], 'left'),
  ],
  interactables: [
    CAT.spot,
    loggeGlasses([214, 236]),
    {
      id: 'stalltuer', verb: 'Zur Stalltür', at: [365, 92], radius: 26, standAt: [365, 104], face: 'up', once: false,
      onInteract: stableDoor,
    },
    {
      id: 'pfeiler', verb: 'Ansehen', once: false, radius: 26, poly: [[316, 108], [350, 108], [350, 220], [316, 220]],
      onInteract: pillar,
    },
    {
      id: 'tisch', verb: 'Weg besprechen', once: false, radius: 30, poly: [[70, 120], [180, 120], [180, 150], [70, 150]],
      standAt: TABLE_STAND, face: 'up', when: () => found() >= 3 && !G.state.is('e2-route-klar'), onInteract: routeTable,
    },
  ],
  clues: [],
  triggers: [
    { id: 'ausgang', poly: [[228, 342], [338, 342], [338, 360], [228, 360]], when: () => G.state.is('e2-route-klar') },
    {
      id: 'tuer-zu', poly: [[228, 342], [338, 342], [338, 360], [228, 360]], once: false, when: () => !G.state.is('e2-route-klar'),
      onEnter: async w => { await w.think(found() >= 3 ? 'Erst den Weg festlegen. Am Tisch, mit den beiden.' : 'Wohin denn? Ich weiß ja nicht mal, wo das Lager heute ist.'); },
    },
  ],
  exits: [],
  // A free-standing table for the cameo guests: the painted tables hide seated figures behind their edges.
  props: [
    { prop: 'stool', at: [419, 186], id: 'hocker-logge', collide: false },
    { prop: 'stool', at: [461, 186], id: 'hocker-sebastian', collide: false },
    { prop: 'table', at: [440, 178], id: 'tisch-gaeste' },
    CAT.prop,
  ],
  spawns: { tisch: { at: TABLE_STAND, dir: 'up' }, eingang: { at: [284, 326], dir: 'up' } },
  time: 'dusk',
  ambience: ['tavern', 'fire'],
  ambienceVolume: { fire: 0.45, tavern: 0.8 },
  music: 'tavern',
  lookMode: false,
  onEnter: undefined,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Opening at the table
// ---------------------------------------------------------------------------------------------------------------

async function intro(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra'), flick = w.actor('flick');
  kyra.hold(true); flick.hold(true);
  w.player.teleport(SEAT_LIA, 'right');
  w.player.setIdle('sit');
  await w.narrate([
    'Drei Tagesmärsche nach der Nacht unter Crios hing das Wildschwein wieder über ihnen: Zum Goldenen Eber.',
    'Hier hatte Foltan gelogen. Hier hatte Kyra im Stall an der Kette gelegen. Und hier gab es den besten Eintopf zwischen Trapas und Portas.',
  ], { style: 'card' });
  void ui().fade('in', 900);
  await w.cutscene(async () => {
    await w.wait(500);
    sfx('eat', { volume: 0.5 });
    await lia(w, 'Ich hab meine Blasen gezählt. Links sieben. Rechts hab ich aufgegeben.', 'pained');
    await w.say('flick', 'Sieben? Anfängerin. Ich hatte mal elf. Eine davon hab ich Bertold getauft.', { mood: 'smirk' });
    await w.say('kyra', 'Wir sitzen im Warmen, es riecht nach Speck, und du jammerst über Füße.', { mood: 'happy' });
    await lia(w, 'Ich jammere nicht. Ich führe Buch.');
    await w.wait(400);
    await lia(w, 'Dieses Licht in mir … Deswegen jagen sie uns. Nicht wegen Kyra. Wegen mir.', 'sad');
    await lia(w, 'Mutter, Vater, der Hof, Kyra am Baum. Alles, weil irgendwas in mir leuchtet. Ich hab nie darum gebeten.', 'sad');
    if (knewLichtstossBefore()) {
      await lia(w, 'Unterwegs hab ich es zweimal gerufen. Klein, wie eine Faust. Es macht mir trotzdem Angst.', 'worried');
    }
    await w.say('kyra', 'Leuchten! Du hast einen Riesen umgepustet! Andere Mädchen kriegen zum Sechzehnten ein Haarband.', { mood: 'happy' });
    await lia(w, 'Andere Mädchen werden zum Sechzehnten nicht gejagt.');
    await w.say('kyra', 'Stell dir vor, das steht irgendwann in einem von deinen Büchern. Mit uns drin. Mit mir auf dem Umschlag.', { mood: 'happy' });
    await w.say('flick', 'Wer dich jagen will, muss erst an mir vorbei. Und an ihr. Die ist schlimmer als ich.', { mood: 'smirk' });
    await w.say('kyra', 'Nur, wenn’s nötig ist.', { mood: 'happy' });
    const pick = await w.choose([
      '„Ich will nur, dass irgendwann wieder ein langweiliger Dienstag ist.“',
      '„Ich will meinen Ofen zurück. Ein Buch, eine Decke. Mehr nicht.“',
      '(Schweigen und in den Krug starren)',
    ]);
    if (pick === 0) {
      await w.say('flick', 'Langweilige Dienstage gibt’s. Nur nicht auf unserem Weg.', { mood: 'smirk' });
    } else if (pick === 1) {
      await w.say('kyra', 'Den Ofen kriegst du wieder. Ich bau ihn dir selbst, wenn’s sein muss. Schief, aber warm.', { mood: 'determined' });
    } else {
      w.player.face('down');
      await w.wait(700);
      await w.say('kyra', 'Wenn du so guckst, ist es schlimm. Das weiß ich seit sechzehn Jahren.', { mood: 'sad' });
      await lia(w, 'Ich will mein altes Leben zurück. Nur das.', 'sad');
    }
    G.state.set('e2-taverne-wunsch', pick);
    await w.say('flick', 'Erst die Rebellen. Wenn einer weiß, was du da mit dir rumträgst, dann die.', { mood: 'determined' });
    await w.think('Die Rebellen. Elnon, der über meinen Kopf hinweg geredet hat. Und Foltan. An diesem Tisch hat er mir gesagt, Craupor wüsste nichts.');
    await lia(w, 'Das Dumme ist nur: Ich kenne den Weg nicht. Ich hatte eine Augenbinde.', 'thinking');
    await lia(w, 'Ich kenne den Weg als Geräusch. Azar hat geredet, ein Bach hat gerauscht, ein Baum hat mich umgehauen.');
    await w.say('flick', 'Und mich lassen die seit dem Rauswurf nicht mal in die Nähe. Ihre Posten und Zeichen wechseln sie ständig.', { mood: 'sad' });
    await w.say('flick', 'Ich nehm mir den Wirt vor. Ihr hört euch um. Wirte wissen viel und sagen wenig. Gäste ist es umgekehrt.', { mood: 'smirk' });
    await w.say('kyra', 'Ich komm mit dir, Lia. Vom Sitzen krieg ich Ameisen in die Beine.', { mood: 'happy' });
  });
  // Flick goes to the counter, Kyra joins Lia.
  w.player.setIdle('idle');
  w.player.teleport(TABLE_STAND, 'down');
  flick.setIdle('idle');
  kyra.setIdle('idle');
  kyra.teleport([214, 164], 'left');
  flick.hold(false);
  bg(flick.walkTo(COUNTER[0], COUNTER[1], { face: 'right' }).then(() => flick.hold(true)));
  w.companions.add('kyra');
  G.state.set('e2-taverne-intro');
}

function updateObjective(w: WorldCtx): void {
  const n = found();
  if (n >= 3) return;
  const c = G.state.data.clues;
  const next = !c.includes(ROUTE_CLUES.craupor) ? 'flick' : !c.includes(ROUTE_CLUES.rinde) ? 'jaeger' : 'schankmaid';
  w.setObjective('e2-zugang', `Finde heraus, wie man heute zum Lager der Bruderschaft kommt (${n}/3).`, next);
}

// ---------------------------------------------------------------------------------------------------------------
// The three sources
// ---------------------------------------------------------------------------------------------------------------

async function talkFlick(w: WorldCtx): Promise<void> {
  if (G.state.hasClue(ROUTE_CLUES.craupor)) {
    await w.say('flick', found() >= 3 ? 'Wir haben, was wir brauchen. Ab an den Tisch.' : 'Craupor ist ausgequetscht. Jetzt du. Die Gäste.', { mood: 'smirk' });
    return;
  }
  await talkCounter(w);
}

async function talkCounter(w: WorldCtx): Promise<void> {
  const craupor = w.actor('craupor');
  if (G.state.hasClue(ROUTE_CLUES.craupor)) {
    await craupor.say('Mehr weiß ich nicht, Mädchen. Ehrlich. Ich schwör’s auf mein bestes Fass.');
    return;
  }
  await w.cutscene(async () => {
    await w.player.walkTo(476, 156, { face: 'right' });
    w.actor('flick').face('craupor');
    void craupor.emote('!');
    await craupor.say('Bei allen Fässern! Du bist doch Foltans Begleiterin. Die mit den vielen Fragen.', { mood: 'surprised' });
    await lia(w, 'Die mit den vielen Fragen. So kann man’s sagen.');
    await craupor.say('Foltans Leute zahlen bei mir nicht. Das gilt auch, wenn er selber nicht dabei ist.', { mood: 'happy' });
    if (grantOnce('e2-proviant', () => { G.state.give('bread'); G.state.give('cheese'); })) {
      await craupor.say('Brot und Käse für unterwegs. Und keine Widerrede, sonst pack ich noch Speck dazu.', { mood: 'happy' });
    }
    await w.say('flick', 'Wo du gerade so freigebig bist: Wo liegt das Lager der Bruderschaft im Moment?');
    void craupor.emote('drop');
    await craupor.say('Pst! Nicht so laut. … Nah. Näher, als mir lieb ist. Aber wo genau, sagt mir keiner. Mit Absicht.', { mood: 'worried' });
    await craupor.say('Ich weiß nur, dass ihre Posten weit draußen stehen. Wer das Lager sieht, ist längst gesehen worden.');
    await w.say('flick', 'Hilfreich wie ein Loch im Eimer.', { mood: 'smirk' });
    await craupor.say('Fragt die Gäste. Der Fallensteller da hinten läuft jeden Tag durch die Wälder. Und meine Schankmaid weiß, wer bei mir Vorräte holt.');
    G.state.addClue(ROUTE_CLUES.craupor);
    await w.think('An diesem Tresen hat Craupor Foltan von Kyra erzählt. Und Foltan kam an den Tisch zurück und sagte: nichts.');
    await craupor.say('Grüß Foltan von mir, wenn ihr ihn seht.');
    const pick = await w.choose(['„Mach ich.“', '„Grüß ihn selbst.“']);
    if (pick === 1) { void craupor.emote('?'); await craupor.say('Hab ich was Falsches gesagt?'); }
  });
  updateObjective(w);
}

async function talkTrapper(w: WorldCtx): Promise<void> {
  const say = (t: string, mood?: string) => w.say('e2-jaeger', t, mood ? { mood } : undefined);
  if (G.state.hasClue(ROUTE_CLUES.rinde)) { await say('Krähenfüße am Bach. Mehr sag ich nicht. Hab ich ja schon.'); return; }
  await say('Setz dich nicht hin. Ich bin nicht gesellig.');
  await lia(w, 'Ich bleib stehen. Du gehst jeden Tag in den Wald?');
  await say('Fallen stellen, Fallen leeren. Und neuerdings Zeichen finden, die nicht von mir sind.');
  const pick = await w.choose([
    { text: '„Ein Stück Käse gegen das, was du gesehen hast?“', tag: 'Käse', disabled: !G.state.has('cheese'), reason: 'Ich habe keinen Käse mehr.' },
    '„Bitte. Es ist wichtig.“',
    '„Kyra, sag du was.“',
  ]);
  if (pick === 0) {
    G.state.take('cheese');
    await say('Käse. Mit Käse kann man reden.', 'happy');
  } else if (pick === 1) {
    await say('Wichtig ist es immer, bei allen. Na schön. Du hast ehrliche Augen. Leider.');
  } else {
    await w.say('kyra', 'Wenn du nichts sagst, setz ich mich zu dir. Und ich rede gern. Stundenlang. Über Schweine.', { mood: 'happy' });
    await say('Gnade. Ich sag ja alles.');
  }
  await say('Am Bach nördlich von hier hat jemand frische Kerben in die Rinde geschnitten. Drei untereinander, wie Krähenfüße.');
  await say('Keine Holzfäller. Die hauen drauf. Das da war ordentlich, mit einem guten Messer.');
  G.state.addClue(ROUTE_CLUES.rinde);
  updateObjective(w);
}

async function talkMaid(w: WorldCtx): Promise<void> {
  const maid = w.actor('schankmaid');
  maid.hold(true);
  try {
    if (G.state.hasClue(ROUTE_CLUES.eiche)) { await maid.say('Nach Norden, an der Eiche vorbei. Und jetzt lass mich arbeiten.'); return; }
    maid.face('kyra');
    void maid.emote('!');
    await maid.say('Dich kenn ich doch! Für dich haben mir die Schwarzweißen mein Schminktäschchen geklaut!', { mood: 'surprised' });
    await w.say('kyra', 'Ich hab’s nie gesehen. Sonst hätte ich’s dem Kahlen an den Kopf geworfen.', { mood: 'angry' });
    await maid.say('Ha! Das hätte ich gern gesehen.', { mood: 'happy' });
    maid.face('player');
    await lia(w, 'Holt hier jemand regelmäßig Vorräte? Viel auf einmal, und immer derselbe?');
    await maid.say('Jeden Morgen, kurz nach dem Hahn. Ein stiller Kerl. Zwei Säcke Mehl, zahlt in Kupfer, sagt kein Wort.');
    await maid.say('Dann geht er nach Norden, an der umgestürzten Eiche vorbei. Ich seh ihn vom Brunnen aus.');
    await lia(w, 'Zwei Säcke Mehl am Tag. Das ist kein Mann. Das ist ein ganzes Lager.', 'thinking');
    G.state.addClue(ROUTE_CLUES.eiche);
  } finally { maid.hold(false); }
  updateObjective(w);
}

// ---------------------------------------------------------------------------------------------------------------
// Optional: the stable door, the pillar, the dwarf
// ---------------------------------------------------------------------------------------------------------------

async function stableDoor(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-kyra-stall')) { await w.think('Dahinter liegt der Stall. Wir lassen die Tür zu. Beide.'); return; }
  G.state.set('e2-kyra-stall');
  const kyra = w.actor('kyra');
  await w.cutscene(async () => {
    w.companions.remove('kyra');
    await kyra.walkTo(392, 108, { face: 'up' });
    await w.wait(400);
    await w.say('kyra', 'Da hinten ist der Stall, oder? Ich kenn ihn nur von innen. Mit Kette am Fuß.', { mood: 'sad' });
    await w.say('kyra', 'Durchs Dach sah man einen Stern. Ich hab mir eingeredet, du guckst gerade auch hin.', { mood: 'sad' });
    const pick = await w.choose(['„Hab ich. Crios. Jede Nacht.“', '„Wir müssen da nicht rein.“', '(Ihre Hand nehmen)']);
    if (pick === 0) {
      await w.say('kyra', 'Wusst ich’s doch. Du kannst ja nicht mal einschlafen, ohne in den Himmel zu glotzen.', { mood: 'happy' });
    } else if (pick === 1) {
      await w.say('kyra', 'Wollt ich auch nicht. Ich wollt nur gucken, ob die Tür noch da ist. Ist sie. Blöde Tür.', { mood: 'angry' });
    } else {
      kyra.face('player');
      void kyra.emote('heart');
      await w.wait(900);
      await w.say('kyra', '… Deine Hand ist kalt. Wie immer.', { mood: 'happy' });
    }
    await w.say('kyra', 'Komm. Zurück zum Speck.', { mood: 'determined' });
    G.state.addMemory('e2-mem-stalltuer');
  });
  w.companions.add('kyra');
}

async function pillar(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-pfeiler')) { await w.think('Kerben in Sitzhöhe. Ich weiß jetzt, von wem.'); return; }
  G.state.set('e2-pfeiler');
  w.bark('kyra', 'Mein Pfeiler! Schlechteste Gesellschaft.', 2600);
  await w.think('Hier hat sie gesessen, festgebunden. Jetzt steht sie neben mir und beschwert sich über die Aussicht.');
}

async function talkDwarf(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-zwerg')) { await w.say('zwerg', 'Beil griffbereit. Wie abgemacht.'); return; }
  G.state.set('e2-zwerg');
  await w.say('zwerg', 'Hm? Lass mich, ich trinke.');
  await w.say('kyra', 'Du! Du warst doch der, der weggeguckt hat, als die mich hier angebunden hatten.', { mood: 'angry' });
  void w.actor('zwerg').emote('drop');
  await w.say('zwerg', '… Du lebst. Bei allen Ambossen von Moneda.');
  await w.say('zwerg', 'Ich hab seitdem jeden Abend auf dich getrunken. Das war feige. Und das Bier war schlecht.');
  const pick = await w.choose(['„Kyra, lass ihn.“', '(Kyra machen lassen)']);
  if (pick === 0) {
    await w.say('kyra', 'Schon gut. Aber er soll’s nicht wieder tun.', { mood: 'angry' });
  }
  await w.say('kyra', 'Nächstes Mal sagst du nicht: „Geht mich nichts an.“ Nächstes Mal sagst du: „Wo ist mein Beil?“', { mood: 'determined' });
  await w.say('zwerg', 'Abgemacht. Beim Bart meines Großvaters.');
}

// ---------------------------------------------------------------------------------------------------------------
// The route at the table
// ---------------------------------------------------------------------------------------------------------------

async function routeTable(w: WorldCtx): Promise<void> {
  const kyra = w.actor('kyra'), flick = w.actor('flick');
  await w.cutscene(async () => {
    w.companions.remove('kyra');
    flick.hold(false);
    bg(kyra.walkTo(SEAT_KYRA[0] + 16, SEAT_KYRA[1] + 14));
    await flick.walkTo(SEAT_FLICK[0] - 2, SEAT_FLICK[1] + 22);
    flick.teleport(SEAT_FLICK, 'right'); flick.setIdle('sit');
    kyra.teleport(SEAT_KYRA, 'left'); kyra.setIdle('sit');
    w.player.teleport(SEAT_LIA, 'right'); w.player.setIdle('sit');
    await w.say('flick', 'Also, Leseratte. Du hast zugehört, ich hab zugehört. Wohin?', { mood: 'smirk' });
    await w.think('Posten weit draußen. Kerben am Bach im Norden. Mehlsäcke an der umgestürzten Eiche vorbei.');
    const clues = G.state.data.clues;
    for (;;) {
      const pick = await w.choose(ROUTES.map(r => ({ text: r.text, tag: routeTag(r, clues) })));
      const route = ROUTES[pick];
      const verdict = judgeRoute(route.id, clues);
      if (verdict === 'richtig') break;
      if (verdict === 'binde') {
        await w.say('flick', 'Mit Augenbinde? Du willst einem Bach nachhorchen, bis dich der nächste Baum umhaut?', { mood: 'smirk' });
        await lia(w, 'Hat beim letzten Mal auch geklappt. Irgendwie.');
      } else if (verdict === 'widerspruch') {
        await w.say('kyra', 'Die Schankmaid hat Norden gesagt. Das hab sogar ich mir gemerkt, und ich merk mir nie was.', { mood: 'happy' });
      } else if (verdict === 'luecke') {
        await w.say('flick', 'Halb richtig. Wir brauchen die Eiche und die Kerben, sonst laufen wir im Kreis.');
      } else {
        await w.say('flick', 'Westen? Da kommen Neuigkeiten her, ja. Und Dunkelschatten. Kein Mensch hier hat Westen gesagt.', { mood: 'smirk' });
      }
      await w.say('flick', 'Noch mal. Ohne Bauch, mit Kopf.');
    }
    await w.say('flick', 'Eiche, Bach, Kerben. Und vorher Posten, die uns zuerst sehen. Klingt ganz nach der Bruderschaft.', { mood: 'happy' });
    G.state.addClue('e2-spur-zugang');
    await w.say('kyra', 'Gehen wir gleich? Ich hab noch nie ein geheimes Lager gesehen!', { mood: 'happy' });
    await w.say('flick', 'Bei Sonnenaufgang. Kerben liest man nicht im Dunkeln. Craupor hat ein Dach, und der Wind kommt von Norden.');
    await lia(w, 'Dann schlafen wir unter einem Dach. Das klingt fast nach Festtag.', 'happy');
    G.state.set('e2-route-klar');
    w.completeObjective('e2-weg');
    w.player.setIdle('idle'); w.player.teleport(TABLE_STAND, 'down');
    flick.setIdle('idle'); flick.teleport([SEAT_FLICK[0] + 10, SEAT_FLICK[1] + 26], 'down');
    kyra.setIdle('idle'); kyra.teleport([SEAT_KYRA[0] + 10, SEAT_KYRA[1] + 18], 'down');
  });
  w.companions.add('kyra');
  w.companions.add('flick');
}

// ---------------------------------------------------------------------------------------------------------------
// Main script
// ---------------------------------------------------------------------------------------------------------------

async function taverneScript(w: WorldCtx): Promise<void> {
  await intro(w);
  updateObjective(w);
  await until(w, () => found() >= 3);
  w.completeObjective('e2-zugang');
  const flick = w.actor('flick');
  flick.hold(false);
  w.bark('flick', 'Leseratte! Tisch. Wir haben genug.', 2600);
  bg(flick.walkTo(SEAT_FLICK[0] + 10, SEAT_FLICK[1] + 26, { face: 'up' }));
  w.setObjective('e2-weg', 'Setz dich mit Kyra und Flick an den Tisch und legt den Weg fest.', 'tisch');
  await until(w, () => G.state.is('e2-route-klar'));
  w.setObjective('e2-aufbruch', 'Brich mit Kyra und Flick auf.', DOOR);
  await w.waitForTrigger('ausgang');
  w.lockPlayer();
  w.completeObjective('e2-aufbruch');
  G.state.set('e2-taverne-done');
  await ui().fade('out', 800);
  halt(w, ['kyra', 'flick', 'schankmaid', 'craupor']);
  // The optional glasses errand ends with the evening (the tavern is not revisited): never left open for later scenes.
  w.completeObjective('e2-logge-brille');
  await nextScene('e2-bruderschaft');
}

export const scene = e2Scene('e2-taverne', 'Rast im Goldenen Eber', async () => {
  await ui().fade('out', 0);
  noteLichtstossOrigin();
  await G.ui.chapterCard('Teil II', 'Letzte Hoffnung', 'Zurück zu den Rebellen');
  await startWorld({ map: eberAbend, spawn: 'tisch', player: 'lia-cloak', companions: [], fadeIn: false, script: taverneScript });
});
