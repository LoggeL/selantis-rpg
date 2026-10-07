// Scene „e2-urmacht“ – Was Valentus tat (docs/teil-2/umsetzung.md §3, F2 16:19–18:37). Day at the hermit's clearing.
// Lia wakes after the amber sleep, may look around (charcoal drawings on birch bark, the books, the bucket; the paths
// are no way out yet) and confronts the stranger at the fire. Heart: the question tree (must ask: her friends, the
// light, „what does it have to do with me?“; optional: who he is, the sleep). Lia finishes the Xenovia story herself
// (urmacht-wissen.ts: right answers tagged with her book-one knowledge, wrong ones corrected without penalty), the
// stranger draws while he talks (plates e2-bericht-xenovia / e2-bericht-wiege „Nach der Erzählung des Fremden“), then
// Valentus, the farm couple, the infant. Lia's guilt, her wish to give the power away (choice), his offer to teach.
// He separates what he saw from what he concludes; Lia learns nothing from the captivity interludes. → e2-flicks-verhoer.
import { G } from '../../core/G';
import { registerMemories } from '../../core/catalog';
import type { ChoiceOption } from '../../ui/api';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { halt } from '../kapitel-4/shared';
import { IG_EDGE, IG_SPOT, igFireLight, igLanternLight, ignatiusBase } from './ignatius-lager';
import { e2Scene, lia, liaLook, mentor, sfx, ui, until, nextScene } from './shared';
import { remembersFestival, XENOVIA_STEPS, xenoviaTag, xenoviaVerdict, type BookOneKnowledge } from './urmacht-wissen';

registerMemories([
  {
    id: 'e2-mem-kettengebaeck', title: 'Kettengebäck am Feuer',
    text: 'Ich habe das letzte Stück Kettengebäck mit dem Fremden geteilt. Er hat die Augen zugemacht beim Kauen, als säße er mitten auf dem Markt von Trapas.',
  },
]);

const STRANGER = 'fremder';
/** Lia's place south of the fire, facing the stranger on the east log. */
const SEAT: [number, number] = [620, 418];
/** The pile of charcoal drawings on birch bark next to the stranger. */
const BARK: [number, number] = [664, 414];
const CAPTION = 'Nach der Erzählung des Fremden';

export const urmachtLager: MapDef = defineMap({
  ...ignatiusBase,
  id: 'e2-urmacht-lager',
  name: 'Die Lichtung des Fremden',
  npcs: [{
    id: STRANGER, preset: 'e2-ignatius', speaker: 'e2-fremder', at: IG_SPOT.mentorSeat, dir: 'left', idle: 'sit',
    verb: 'Zur Rede stellen', talk: talkStranger,
    barks: ['Hm. Die Wellen sind zu zahm.', 'Kohle und Geduld.', 'Setz dich, wenn du so weit bist.'], barkEvery: 11000,
  }],
  props: [{ id: 'buecher', prop: 'bookstack', at: [702, 252], collide: false }],
  interactables: [
    { id: 'rinde', verb: 'Ansehen', at: BARK, radius: 22, once: false, sparkle: true, onInteract: lookBark },
    { id: 'buecher', verb: 'Ansehen', at: [702, 252], radius: 26, once: false, onInteract: books },
    { id: 'eimer', verb: 'Gesicht waschen', at: IG_SPOT.bucket, radius: 26, once: false, onInteract: bucket },
  ],
  triggers: [
    { id: 'pfad-sued', poly: [[700, 536], [812, 524], [818, 566], [708, 578]], once: false, onEnter: notYet },
    { id: 'pfad-ost', poly: [[990, 390], [1012, 392], [1012, 446], [990, 440]], once: false, onEnter: notYet },
  ],
  exits: [
    { id: 'weg-sued', poly: IG_EDGE.south, to: 'e2-urmacht-lager', spawn: 'bed', when: () => false, blocked: 'Erst will ich Antworten.' },
    { id: 'weg-ost', poly: IG_EDGE.east, to: 'e2-urmacht-lager', spawn: 'bed', when: () => false, blocked: 'Erst will ich Antworten.' },
  ],
  lights: [igFireLight(0.6, 0.6), igLanternLight(0.3)],
  time: 'day',
  ambience: ['stream', 'birds', 'wind', 'fire'],
  ambienceVolume: { stream: 0.5, birds: 0.6, wind: 0.3, fire: 0.35 },
  music: 'refuge',
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Waking up and looking around
// ---------------------------------------------------------------------------------------------------------------

async function wake(w: WorldCtx): Promise<void> {
  const s = w.actor(STRANGER);
  s.hold(true);
  s.setIdle('sit');
  w.player.setIdle('lie');
  w.lockPlayer();
  await w.camera.pan(IG_SPOT.bed, 0);
  await w.camera.zoom(1.3, 0);
  await G.ui.narrate(['Vogelstimmen. Ein Bach. Und das Kratzen von Kohle auf Rinde.'], { style: 'card' });
  await ui().fade('in', 1400);
  await w.cutscene(async () => {
    await w.think('Hell. Schon wieder Tag. Oder schon der nächste?');
    w.player.setIdle('kneel');
    await w.wait(500);
    await w.think('Seine Hand. Das warme Licht. Dann nichts mehr. Er hat mich einfach schlafen geschickt.');
    await w.camera.zoom(1, 1000);
    await w.camera.pan(s.id, 900);
    await w.say(mentor(), 'Ein Tag und eine Nacht. Du hast geschlafen wie jemand, der weiß, dass er nichts verpasst.', { mood: 'happy' });
    await w.camera.pan(IG_SPOT.bed, 700);
    w.player.setIdle('idle');
    await lia(w, 'Ihr habt mich schlafen gelegt wie Vater die Hühner! Kopf unter den Flügel, und weg.', 'angry');
    await w.say(mentor(), 'Mit weniger Federn. Komm ans Feuer, wenn du schimpfen willst. Da ist es wärmer.');
  });
  w.camera.follow();
  w.unlockPlayer();
}

async function lookBark(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-urmacht-rinde')) { await w.think('Wellen, Arme, eine Höhle. Ich warte, bis er es mir erklärt.'); return; }
  G.state.set('e2-urmacht-rinde');
  await w.player.play('kneel', { ms: 500 });
  await w.think('Birkenrinde, mit Kohle bemalt. Wellen. Viele kleine Menschen mit erhobenen Armen. Eine Höhle mit einem Stein davor.');
  await w.think('Und auf dem obersten Stück eine Wiege. Er hat sie noch nicht fertig gezeichnet.');
}

async function books(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-urmacht-buecher')) { await w.think('Das verschnürte lasse ich zu. Fremde Bücher sind wie fremde Briefe.'); return; }
  G.state.set('e2-urmacht-buecher');
  await w.player.play('kneel', { ms: 500 });
  if (G.state.is('e2-fremder-buecher')) await w.think('Gestern schwammen die Buchstaben. Heute halten sie still. Ich hätte nie gedacht, dass mich das so erleichtert.');
  await w.think('Ein Kräuterbuch, älter als Cronibus. Eins über Sterne. Und eins ohne Titel, mit einem Lederriemen verschnürt.');
}

async function bucket(w: WorldCtx): Promise<void> {
  sfx('splash', { volume: 0.5 });
  w.fx.burst(IG_SPOT.bucket, 'splash', 6);
  await w.think(G.state.is('e2-urmacht-eimer') ? 'Noch einmal. Mein Kopf ist längst wach.' : 'Kaltes Wasser. Jetzt ist mein Kopf klar. Klarer, als mir lieb ist.');
  G.state.set('e2-urmacht-eimer');
}

async function notYet(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-urmacht-sitzt')) return;
  await w.think('Losrennen, ohne zu wissen, wohin? Das hat beim letzten Mal am Bach geendet.');
  await w.player.walkTo(w.player.x - 10, w.player.y - 30);
}

async function talkStranger(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-urmacht-sitzt')) return;
  await w.cutscene(async () => {
    await w.player.walkTo(SEAT[0], SEAT[1], { face: 'up' });
  });
  G.state.set('e2-urmacht-sitzt');
}

// ---------------------------------------------------------------------------------------------------------------
// The conversation
// ---------------------------------------------------------------------------------------------------------------

const say = (w: WorldCtx, text: string, mood?: string) => w.say(mentor(), text, mood ? { mood } : undefined);

function knowledge(): BookOneKnowledge {
  const d = G.state.data;
  return { lore: d.lore, memories: d.memories, items: Object.keys(d.inventory).filter(id => G.state.has(id)) };
}

async function conversation(w: WorldCtx): Promise<void> {
  const s = w.actor(STRANGER);
  s.hold(true);
  w.player.teleport(SEAT, 'up');
  w.player.setIdle('sit');
  s.setIdle('sit');
  s.face('player');
  // Frame both above the dialogue box.
  await w.camera.pan([650, 408], 700);
  await w.camera.zoom(1.25, 700);
  await say(w, 'Ich habe dir gestern ein Gespräch versprochen. Ich halte, was ich verspreche. Meistens etwas zu spät.');
  if (G.state.is('e2-urmacht-rinde')) await say(w, 'Du hast schon in meinen Bildern geblättert. Gut. Dann erkennst du sie wieder.', 'happy');
  await lia(w, 'Dann fange ich an. Mit Fragen. Ich hab viele.', 'determined');
  await say(w, 'Damit habe ich gerechnet. Ich habe Holz für drei Kannen gesammelt.');

  const asked = new Set<string>();
  for (let guard = 0; guard < 12; guard++) {
    const ready = asked.has('freunde') && asked.has('licht');
    const opts: { id: string; text: string }[] = [
      { id: 'freunde', text: '„Wo sind Kyra und Flick?“' },
      { id: 'licht', text: '„Was ist dieses Licht in mir?“' },
      ...(ready ? [{ id: 'ich', text: '„Was hat das alles mit mir zu tun?“' }] : []),
      { id: 'wer', text: '„Wer seid Ihr eigentlich?“' },
      { id: 'schlaf', text: '„Wie habt Ihr mich gestern schlafen geschickt?“' },
    ].filter(o => !asked.has(o.id));
    const pick = opts[await w.choose(opts.map(o => o.text))];
    asked.add(pick.id);
    if (pick.id === 'ich') break;
    await answer(w, pick.id);
  }
  G.state.set('e2-urmacht-fragen', [...asked].join(','));
  await revelation(w);
  await guilt(w);
}

async function answer(w: WorldCtx, id: string): Promise<void> {
  switch (id) {
    case 'freunde': return friends(w);
    case 'licht': return xenovia(w);
    case 'wer':
      await lia(w, 'Ihr wisst, wie ich schlafe und wie ich Tee trinke. Ich weiß nicht mal, wie Ihr heißt.');
      await say(w, 'Ein alter Mann, der zu lange allein im Wald war. Deshalb rede ich viel. Nur nicht über mich.');
      await lia(w, 'Das ist keine Antwort.', 'angry');
      await say(w, 'Nein. Das ist eine Ausrede. Eine gute, finde ich.', 'happy');
      G.state.set('e2-urmacht-wer');
      return;
    case 'schlaf':
      await say(w, 'Ein kleiner Kniff aus einer Zeit, in der ich mehr konnte als Kniffe. Für ein müdes Mädchen reicht er.');
      await lia(w, 'Macht das nie wieder. Nicht ohne zu fragen.', 'angry');
      await say(w, 'Nicht ohne zu fragen. Das verspreche ich dir. Und diesmal pünktlich.');
      G.state.set('e2-urmacht-schlaf');
      return;
  }
}

async function friends(w: WorldCtx): Promise<void> {
  await lia(w, 'Gestern habt Ihr gesagt: später. Jetzt ist später. Wo sind Kyra und Flick?');
  await say(w, 'Während du geschlafen hast, war ich an eurem Lager. Ich sage dir, was ich gesehen habe. Und getrennt davon, was ich glaube.');
  await say(w, 'Gesehen: niedergetretene Zelte, kalte Asche, keine Gräber. Am Bach schwere Stiefel und kleine Füße, die sich gestemmt haben.', 'grim');
  await say(w, 'Geglaubt: Man hat sie mitgenommen. Lebend. Wer jemanden fesselt, will ihn behalten.', 'worried');
  await lia(w, 'Gefangen. Schon wieder. Kyra war doch gerade erst frei …', 'scared');
  const pick = await w.choose(['„Dann hole ich sie. Heute noch.“', '„Und die anderen? Foltan? Azar?“', '(Schweigen.)']);
  if (pick === 0) {
    G.state.set('e2-urmacht-freunde', 'holen');
    await say(w, 'Wohin? Die Stiefel enden am Weg, und der Weg führt überallhin.');
    await lia(w, 'Ich hab Kyra schon einmal gefunden. Mit nichts als ein paar Perlen im Gras.', 'determined');
    await say(w, 'Diesmal hat niemand Perlen gestreut. Hör mich zuerst an. Danach entscheidest du, wohin du läufst.');
  } else if (pick === 1) {
    G.state.set('e2-urmacht-freunde', 'andere');
    await say(w, 'Die Namen sagen mir nichts. Nicht alle Spuren führten in Gefangenschaft. Mehr kann ich dir nicht ehrlich sagen.');
  } else {
    G.state.set('e2-urmacht-freunde', 'still');
    await say(w, 'Schweigen ist auch eine Antwort. Man sieht sie dir an.', 'sad');
  }
}

/** Lia completes the Xenovia story herself; plate „Nach der Erzählung des Fremden“. */
async function xenovia(w: WorldCtx): Promise<void> {
  await lia(w, 'Und das Licht? Bei den Rebellen haben sie gesagt, es sei wie in den alten Geschichten. Welche Geschichten?');
  await say(w, 'Dann fange ich bei der ältesten an, die es gibt. Unterbrich mich, wenn du sie kennst.', 'thinking');
  ui().prefetchPlate('e2-bericht-xenovia');
  sfx('page', { volume: 0.5 });
  await G.ui.plate('e2-bericht-xenovia', { caption: CAPTION, pan: 'in', durationMs: 60000 });
  await say(w, 'Am Anfang schuf die Göttin Xenovia Selantis, und die ersten Menschen. Zehn von ihnen …');
  await lia(w, '… stürzten sie und nahmen ihr die ~Urmacht~. Die kenne ich! Die steht in jedem zweiten Buch.', 'happy');
  await say(w, 'Dann erzähl du weiter. Meine Stimme ist alt, die schont es.', 'happy');

  const k = knowledge();
  let firstTry = 0;
  for (const step of XENOVIA_STEPS) {
    await say(w, step.question);
    const left = step.options.slice();
    for (let attempt = 0; attempt < 3; attempt++) {
      const choices: ChoiceOption[] = left.map(o => ({ text: o.text, tag: xenoviaTag(step.id, o, k) }));
      const o = left[await w.choose(choices)];
      if (o.correct) { if (attempt === 0) firstTry++; break; }
      if (o.wrong?.by === 'lia') await lia(w, o.wrong.text, o.wrong.mood);
      else if (o.wrong) await say(w, o.wrong.text, o.wrong.mood);
      left.splice(left.indexOf(o), 1);
    }
    if (step.id === 'meeresgrund') await say(w, 'Auf den Grund des Meeres. Genau so.');
    if (step.id === 'fest') {
      await lia(w, remembersFestival(k) ? 'Ich durfte nie mit. Vater sagte jedes Jahr: nächstes Jahr.' : 'Vater ist jedes Jahr hingefahren. Wir waren immer zu jung.', 'sad');
    }
    if (step.id === 'gebaeck') await say(w, 'Süße Ketten. Die Leute essen am liebsten, was sie früher gefesselt hat.', 'happy');
  }
  G.state.set('e2-urmacht-vorwissen', firstTry);
  await say(w, xenoviaVerdict(firstTry), firstTry >= 2 ? 'happy' : undefined);
  await say(w, 'Jetzt kommt der Teil, den man auf Festen nicht singt.', 'thinking');
  await say(w, 'Das Licht der Göttin verschlossen die Zehn hinter einem Stein. Davor saßen Hüter, immer zehn, so lange, dass keiner mehr die Jahre zählte.');
  await say(w, 'Die letzten Hüter nannten sich den Rat der Zehn Geweihten. Immer zehn, damit keiner die Urmacht für sich allein nimmt.');
  if (G.state.data.lore.includes('k3-lore-alana') || G.state.has('book-alana')) {
    await lia(w, 'Der Rat der Zehn! In den wurde Alana aufgenommen, in meinem Buch. Ich dachte, den gibt es nur auf Papier.', 'surprised');
    await say(w, 'Papier merkt sich manches besser als die Leute. Den Rat gab es. Bis Dunkelhain.', 'sad');
  } else {
    await lia(w, 'Ein Rat, der eine Höhle bewacht. Klingt nach dem langweiligsten Amt der Welt.');
    await say(w, 'Das war es auch. Bis es aufhörte, langweilig zu sein.', 'sad');
  }
  G.state.addLore('e2-lore-xenovia');
  await G.ui.closePlate();
  await sharePastry(w);
}

/** Optional: the last piece of chain pastry from book one. */
async function sharePastry(w: WorldCtx): Promise<void> {
  if (!G.state.has('chain-pastry') || G.state.flag('e2-urmacht-gebaeck') !== undefined) return;
  await w.think('In meiner Tasche ist noch ein Kettengebäck. Zerdrückt, aber es ist eins.');
  const pick = await w.choose([{ text: 'Mit dem Fremden teilen.', tag: 'Kettengebäck' }, 'Für Kyra aufheben.']);
  if (pick === 0) {
    G.state.set('e2-urmacht-gebaeck', 'geteilt');
    G.state.take('chain-pastry');
    sfx('eat', { volume: 0.3 });
    await say(w, 'Seit Jahren keins mehr gegessen. Es schmeckt nach Markt und nach Lärm. Danke.', 'happy');
    G.state.addMemory('e2-mem-kettengebaeck');
  } else {
    G.state.set('e2-urmacht-gebaeck', 'kyra');
    await say(w, 'Gut. Dann hat sie jemanden, der etwas für sie aufhebt.');
  }
}

async function revelation(w: WorldCtx): Promise<void> {
  await lia(w, 'Schöne Geschichte. Aber was hat sie mit mir zu tun? Mit einem Mädchen vom Hof?');
  await say(w, 'Dunkelhain. Du kennst den Namen.');
  await lia(w, 'Jeder kennt ihn. Seit Dunkelhain ist man nirgends mehr sicher, sagt Kyra immer.', 'sad');
  await say(w, 'Bei Dunkelhain fiel alles, was der Rat hatte. Nur nicht das Wichtigste. Der Großmeister des Rates war schneller.');
  await say(w, 'Valentus. Als die Dunkelschatten die Höhle erreichten, war sie leer. Er trug das Licht davon, mit einer Wunde in der Seite.', 'sad');
  ui().prefetchPlate('e2-bericht-wiege');
  sfx('page', { volume: 0.5 });
  await G.ui.plate('e2-bericht-wiege', { caption: CAPTION, pan: 'in', durationMs: 60000 });
  await say(w, 'Er kam bis in einen Wald, weit fort von allem, und dann nicht weiter. Ein Bauer fand ihn und trug ihn heim.');
  await say(w, 'Er und seine Frau pflegten ihn, obwohl sie selbst kaum genug hatten. In ihrem Haus stand eine Wiege.');
  await say(w, 'Er ahnte, dass er nicht lange bleiben konnte. Also legte er das Licht in das Kleinste, das in diesem Haus atmete. In einen Säugling.');
  const pick = await w.choose([
    '„Zwei Kinder. Ein Hof im Wald … Das war unser Hof.“',
    '„Bauernhöfe mit Zwillingen gibt es viele.“',
    '(Die Rinde anstarren.)',
  ]);
  if (pick === 0) {
    G.state.set('e2-urmacht-erkenntnis', 'sofort');
  } else if (pick === 1) {
    G.state.set('e2-urmacht-erkenntnis', 'zweifel');
    await say(w, 'Viele. Und wie viele davon wurden in diesem Sommer überfallen, von Leuten, die ein Kind suchen?', 'grim');
  } else {
    G.state.set('e2-urmacht-erkenntnis', 'still');
    await w.think('Zwei Kinder in einer Wiege. Mutter hat immer erzählt, wir hätten nicht getrennt schlafen wollen.');
  }
  await lia(w, 'Das Kind war ich. Nicht Kyra. Ich.', 'scared');
  await say(w, 'Beweisen kann ich es dir nicht. Aber du hast es gewusst, bevor ich den Satz zu Ende hatte.', 'sad');
  G.state.addLore('e2-lore-valentus');
  await lia(w, 'Warum ich? Warum nicht sie?');
  await say(w, 'Das weiß nur Valentus. Ich weiß, was er tat. Warum, kann ich nur vermuten, und Vermuten ist billig.', 'thinking');
  await lia(w, 'Und wo ist er jetzt?');
  await say(w, 'Ich weiß es nicht. Niemand hat ihn danach gesehen. Mehr sage ich nicht, weil ich mehr nicht weiß.', 'sad');
  await lia(w, 'Woher wisst Ihr das alles überhaupt?', 'thinking');
  await say(w, 'Das erzähle ich dir ein andermal. Heute würde es dir nur noch mehr Fragen machen.');
  await G.ui.closePlate();
}

async function guilt(w: WorldCtx): Promise<void> {
  await lia(w, 'Die Männer auf unserem Hof. Mutter und Vater. Kyra an der Kette. Und jetzt Kyra und Flick …', 'sad');
  await lia(w, 'Die haben nie Kyra gesucht. Die suchen mich. Und alle, die neben mir stehen, bezahlen dafür.', 'hurt');
  await say(w, 'Sie bezahlen für die Gier eines anderen. Nicht für dich.', 'determined');
  await lia(w, 'Dann sollen sie es eben haben. Dann ist es vorbei.', 'angry');
  const pick = await w.choose([
    '„Ich gehe zu ihnen und gebe es her. Dann lassen sie Kyra frei.“',
    '„Nehmt Ihr es. Ihr wisst wenigstens, was es ist.“',
    '„Kann man es nicht zurück in die Höhle sperren?“',
  ]);
  if (pick === 0) {
    G.state.set('e2-urmacht-hergeben', 'ausliefern');
    await say(w, 'Wer sie besitzt, hat ganz Selantis an der Kehle. Glaubst du, so einer lässt danach Mädchen laufen?', 'grim');
    await say(w, 'Er bräuchte euch nicht mehr. Das ist nicht besser. Das ist schlimmer.', 'grim');
  } else if (pick === 1) {
    G.state.set('e2-urmacht-hergeben', 'abgeben');
    await say(w, 'Sie hat nicht mich gewählt. Man legt sie nicht ab wie einen nassen Mantel.');
    await say(w, 'Und ehrlich gesagt: Ich würde sie auch nicht tragen wollen.', 'sad');
  } else {
    G.state.set('e2-urmacht-hergeben', 'einsperren');
    await say(w, 'Die Höhle ist leer, und ihre Hüter sind fort. Ein Schloss ohne Wächter ist nur eine Einladung.', 'thinking');
  }
  await say(w, 'Gibst du sie aus der Hand, bezahlt ein ganzes Land die Rechnung. Und die könntest du nie begleichen.', 'determined');
  await lia(w, 'Und wenn ich sie behalte, leiden die zwei, die ich liebe.', 'sad');
  await say(w, 'Dann lerne, sie zu halten, statt von ihr gehalten zu werden. Ich kann dir zeigen, wie.');
  await lia(w, 'Ihr könnt das?', 'surprised');
  await say(w, 'Ein wenig. Genug für den Anfang. Den Rest musst du selbst finden.');
  const answer = await w.choose([
    '„Dann fangen wir an. Jetzt gleich.“',
    '„Und Kyra und Flick? Die können nicht warten, bis ich fertig bin.“',
    '„Ich bin keine Zauberin. Ich hab Hühner gefüttert und Bücher gelesen.“',
  ]);
  if (answer === 0) {
    G.state.set('e2-urmacht-antwort', 'sofort');
    await say(w, 'Nach dem Essen. Mit leerem Magen hält man nicht einmal eine Kerze still.', 'happy');
  } else if (answer === 1) {
    G.state.set('e2-urmacht-antwort', 'freunde');
    await say(w, 'Nein. Darum fangen wir heute an und nicht morgen.', 'determined');
  } else {
    G.state.set('e2-urmacht-antwort', 'zweifel');
    await say(w, 'Beides braucht Geduld. Und mit Geduld fängt alles an, was ich dir zeigen kann.', 'happy');
  }
  await w.think('Ein Fremder ohne Namen, eine Geschichte auf Baumrinde. Und ich mittendrin.');
}

// ---------------------------------------------------------------------------------------------------------------

async function urmachtScript(w: WorldCtx): Promise<void> {
  G.state.set('e2-urmacht-sitzt', false);
  await wake(w);
  w.setObjective('e2-urmacht-reden', 'Stell den Fremden am Feuer zur Rede.', STRANGER);
  await until(w, () => G.state.is('e2-urmacht-sitzt'));
  w.completeObjective('e2-urmacht-reden');
  await w.cutscene(() => conversation(w));
  await w.camera.zoom(1, 0);
  halt(w, [STRANGER]);
  await ui().fade('out', 1200);
  G.state.set('e2-urmacht-erklaert');
  await nextScene('e2-flicks-verhoer');
}

export const scene = e2Scene('e2-urmacht', 'Was Valentus tat', async () => {
  await ui().fade('out', 0);
  await startWorld({ map: urmachtLager, spawn: 'bed', player: liaLook(), companions: [], fadeIn: false, script: urmachtScript });
});
