// Kapitel V, Szene 2 „faehrte“: tracking with Spurenblick. Hoofprints of six horses, broken twigs, Kyra's beads.
// At both forks the player must read the signs (Flick insists) and pick the right trail; the wrong ones end in dead
// ends (with a small consolation) and cost daylight. Sunset, a small fire, the night talk: Flick was turned away by
// the rebels („Keine wie mich, hieß es.“), the one-woman 'Elfen von Grunwald'; Lia: „In ihrem Lager gibt es Elfen.“ Flick dodges.
// Map: assets/bg/k5-faehrte.png (1280×720, late afternoon). Trails as corridors along the painted paths.
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { ambience, CROUCH, lia, sfx } from './common';
import { corridor, ellipse } from './geom';

const MAIN = corridor([[0, 660], [100, 637], [200, 605], [300, 580], [400, 561], [475, 536], [537, 507], [587, 474], [612, 438]], 25);
const EAST = corridor([[596, 436], [642, 427], [767, 420], [892, 414], [1017, 407], [1044, 404]], 22);
const NORTH = corridor([[1040, 412], [1052, 372], [1078, 326], [1086, 281], [1098, 238], [1092, 196]], 21);
const SOUTH = corridor([[1040, 404], [1054, 444], [1090, 505], [1116, 548]], 20);
const BROOK = corridor([[612, 442], [588, 402], [550, 352], [500, 296], [450, 252], [400, 208], [350, 172], [298, 152]], 21);
const FORK1: [number, number][] = [[570, 420], [610, 404], [650, 418], [656, 452], [620, 470], [578, 462]];
const FORK2: [number, number][] = [[1010, 396], [1040, 380], [1072, 392], [1078, 430], [1048, 446], [1012, 428]];
const CLEARING: [number, number][] = [[944, 112], [982, 84], [1060, 76], [1128, 88], [1158, 128], [1150, 176], [1120, 204], [1104, 222], [1078, 214], [1050, 212], [990, 204], [948, 172]];
const BROOK_END: [number, number][] = [[262, 150], [300, 132], [340, 146], [346, 176], [300, 184], [262, 172]];

export const faehrteMap: MapDef = defineMap({
  id: 'k5-faehrte',
  name: 'Die Fährte',
  background: 'k5-faehrte',
  walk: [MAIN, EAST, NORTH, SOUTH, BROOK, FORK1, FORK2, CLEARING, BROOK_END],
  block: [
    { id: 'feuerring', sight: false, poly: ellipse(1053, 153, 30, 17) },
    { id: 'baumstamm', sight: false, poly: [[1044, 112], [1114, 116], [1118, 138], [1046, 136]] },
  ],
  occluders: [
    { id: 'baumstamm', baseline: 138, poly: [[1040, 104], [1116, 106], [1122, 140], [1042, 140]] },
  ],
  surfaces: [
    { id: 'pfade', kind: 'dirt', poly: MAIN }, { id: 'ost', kind: 'dirt', poly: EAST }, { id: 'nord', kind: 'dirt', poly: NORTH },
    { id: 'sued', kind: 'dirt', poly: SOUTH }, { id: 'bach', kind: 'dirt', poly: BROOK }, { id: 'ufer', kind: 'stone', poly: BROOK_END },
  ],
  interactables: [
    { id: 'steine', verb: 'Steine werfen', poly: [[240, 120], [300, 106], [346, 118], [342, 140], [250, 142]], standAt: [300, 158], face: 'up', onInteract: skipStones },
    { id: 'beeren', verb: 'Pflücken', poly: [[1100, 552], [1150, 540], [1180, 566], [1140, 584], [1100, 576]], standAt: [1112, 546], face: 'down', item: { id: 'k5-brombeeren' }, thought: 'Brombeeren. Wenigstens das schuldet mir der Umweg.' },
    {
      id: 'feuerstelle', verb: 'Untersuchen', poly: ellipse(1053, 150, 32, 20), standAt: [1053, 190], face: 'up',
      when: () => !G.state.is('k5-feuer'), onInteract: campfire,
    },
  ],
  clues: [
    { id: 'hufe', at: [168, 624], kind: 'hoof', angle: 0, clue: 'k5-spur-hufe', onInteract: hoofs },
    { id: 'g1-reh', at: [588, 410], kind: 'hoof', angle: -60, onInteract: g1Deer },
    { id: 'g1-zweig', at: [662, 424], kind: 'branch', angle: 0, clue: 'k5-spur-zweige', onInteract: g1Twig },
    { id: 'perle-1', at: [820, 418], kind: 'bead', verb: 'Aufheben', onInteract: bead },
    { id: 'g2-alt', at: [1050, 444], kind: 'hoof', angle: 70, onInteract: g2Old },
    { id: 'g2-frisch', at: [1056, 384], kind: 'hoof', angle: -70, clue: 'k5-spur-frisch', onInteract: g2Fresh },
    { id: 'perle-2', at: [1088, 272], kind: 'bead', verb: 'Aufheben', onInteract: bead },
    { id: 'perle-3', at: [990, 160], kind: 'bead', verb: 'Aufheben', onInteract: bead },
  ],
  triggers: [
    { id: 'tor-g1-bach', area: { x: 530, y: 330, w: 44, h: 36 }, once: false, onEnter: w => gate(w, 1) },
    { id: 'tor-g1-ost', area: { x: 700, y: 396, w: 26, h: 56 }, once: false, onEnter: w => gate(w, 1) },
    { id: 'tor-g2-sued', area: { x: 1060, y: 462, w: 44, h: 30 }, once: false, onEnter: w => gate(w, 2) },
    { id: 'tor-g2-nord', area: { x: 1060, y: 316, w: 44, h: 30 }, once: false, onEnter: w => gate(w, 2) },
    { id: 'sackgasse-bach', area: { x: 330, y: 150, w: 50, h: 50 }, onEnter: w => deadEnd(w, 'bach') },
    { id: 'sackgasse-dornen', area: { x: 1086, y: 512, w: 50, h: 36 }, onEnter: w => deadEnd(w, 'dornen') },
    { id: 'lager', area: { x: 1070, y: 210, w: 50, h: 20 }, onEnter: arriveCamp },
  ],
  spawns: {
    start: { at: [36, 652], dir: 'right' },
    gabel1: { at: [612, 446], dir: 'up' },
    gabel2: { at: [1030, 410], dir: 'right' },
    lager: { at: [1060, 196], dir: 'up' },
  },
  time: 'day',
  weather: 'leaves',
  ambience: ['wind', 'birds'],
  ambienceVolume: { birds: 0.7, wind: 0.5 },
  music: 'exploration',
  lookMode: true,
  depthScale: { y0: 80, s0: 0.92, y1: 720, s1: 1.04 },
});

// ---------------------------------------------------------------------------------------------------------------

const read = (id: string) => G.state.is(`k5-gelesen-${id}`);
const mark = (id: string) => G.state.set(`k5-gelesen-${id}`);
const forkRead = (n: 1 | 2) => (n === 1 ? read('g1-reh') && read('g1-zweig') : read('g2-alt') && read('g2-frisch'));

async function hoofs(w: WorldCtx): Promise<void> {
  mark('hufe');
  await w.think('Hufabdrücke. Ich zähle … sechs Pferde. Fünf tief eingesunken, eins kaum.');
  await w.say('flick', 'Fünf schwere Kerle und ein leichtes Bündel. Dein Bündel, schätze ich.', { mood: 'happy' });
  await lia('Sie heißt Kyra. Nicht Bündel.', 'angry');
  await w.say('flick', 'Schon gut. Kyra. Merk dir eins: An Gabelungen fragst du den Boden, nicht deinen Bauch. Der Bauch lügt gern.');
  w.completeObjective('k5-spuren');
  w.setObjective('k5-faehrte', 'Folge der Fährte. Lies an jeder Gabelung die Spuren.', 'g1-zweig');
}

async function g1Deer(w: WorldCtx): Promise<void> {
  mark('g1-reh');
  await w.think('Abdrücke, ja. Aber klein, gespalten, in Sprüngen. Rehe. Ein Pferd hüpft nicht.');
  await forkHint(w, 1);
}

async function g1Twig(w: WorldCtx): Promise<void> {
  mark('g1-zweig');
  await w.think('Geknickte Zweige, so hoch wie ein Reiterknie. Innen ist das Holz noch hell. Frisch.');
  await forkHint(w, 1);
}

async function g2Old(w: WorldCtx): Promise<void> {
  mark('g2-alt');
  await w.think('Spuren nach Süden. Da wächst schon Gras drin, und nirgends ein Hufeisen. Wochen alt, mindestens.');
  await forkHint(w, 2);
}

async function g2Fresh(w: WorldCtx): Promise<void> {
  mark('g2-frisch');
  await w.think('Nach Norden: Hufeisen, tief eingedrückt, die Ränder noch scharf. Nicht mal einen Tag alt.');
  await forkHint(w, 2);
}

async function forkHint(w: WorldCtx, n: 1 | 2): Promise<void> {
  if (!forkRead(n) || G.state.is(`k5-gabel${n}-klar`)) return;
  G.state.set(`k5-gabel${n}-klar`);
  await w.say('flick', n === 1 ? 'Und? Was steht da geschrieben?' : 'Zwei Wege, ein Trupp. Welcher ist unserer?', { mood: 'smirk' });
  await w.think('Ich glaube, ich weiß es. Jetzt nur noch richtig abbiegen.');
}

/** Flick holds Lia back until she has read both signs of the fork. */
async function gate(w: WorldCtx, n: 1 | 2): Promise<void> {
  if (forkRead(n)) return;
  await w.cutscene(async () => {
    await w.say('flick', 'Halt, Leseratte. Erst lesen, dann laufen.', { mood: 'determined' });
    await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick leuchten die Hinweise an der Gabelung.`);
    await w.player.walkTo(n === 1 ? [612, 446] : [1030, 412]);
  });
  w.setObjectiveTarget(n === 1 ? (read('g1-reh') ? 'g1-zweig' : 'g1-reh') : (read('g2-alt') ? 'g2-frisch' : 'g2-alt'));
}

async function deadEnd(w: WorldCtx, which: 'bach' | 'dornen'): Promise<void> {
  const n = G.state.inc('k5-umwege');
  await w.cutscene(async () => {
    if (which === 'bach') {
      await w.say('flick', 'Wasser, Kiesel, kein einziger Huf. Hier hatte höchstens ein Reh Durst.', { mood: 'smirk' });
      await lia('Ich bin also Rehen nachgelaufen. Schreib das bitte nirgends auf.');
    } else {
      await w.say('flick', 'Dornen bis zum Hals. Wer hier durchreitet, hat sein Pferd nicht lieb.', { mood: 'smirk' });
      await lia('Gras in den Spuren. Ich hab’s gesehen. Nur nicht gelesen.');
    }
    await w.say('flick', n > 1 ? 'Noch so ein Ausflug, und die Fährte ist kalt.' : 'Zurück zur Gabelung. Das hat uns eine Stunde Licht gekostet.');
  });
  void w.lighting.set('dusk', 4000);
  w.setObjectiveTarget(which === 'bach' ? 'g1-zweig' : 'g2-frisch');
}

async function bead(w: WorldCtx): Promise<void> {
  G.state.give('bead');
  const n = G.state.count('bead');
  if (n === 1) {
    G.state.addClue('k5-spur-perlen');
    await w.think('Eine Holzperle. Kyras. Die verliert sie nicht einfach … die hat sie hingelegt.');
    await w.say('flick', 'Deine Schwester denkt mit. Liegt das in der Familie?', { mood: 'smirk' });
    await lia('Ich denke. Kyra macht. So war das immer.', 'sad');
    w.setObjectiveTarget('g2-frisch');
  } else if (n === 2) {
    await w.think('Noch eine. Streu weiter, Kyra. Ich sammle alles ein.');
    w.setObjectiveTarget('feuerstelle');
  } else {
    await w.think('Die dritte. Hier hat sie gesessen, nah am Feuer. Wenigstens war ihr warm.');
    G.state.addMemory('k5-mem-perlen');
  }
}

async function skipStones(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-steine')) { await w.think('Zwei Sprünge. Wie immer.'); return; }
  G.state.set('k5-steine');
  await w.player.play(CROUCH, { ms: 700 });
  sfx('throw');
  await w.wait(500);
  sfx('splash', { volume: 0.5 });
  await w.wait(260);
  sfx('splash', { volume: 0.35 });
  await w.think('Zwei Sprünge. Kyra hätte fünf geschafft. „Du denkst zu viel“, hat sie immer gesagt.');
  G.state.addMemory('k5-mem-steine');
}

async function arriveCamp(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    void w.lighting.set('dusk', 3000);
    ambience(['wind', 'crickets'], { crickets: 0.6, wind: 0.4 });
    await w.say('flick', 'Riechst du das? Rauch. Hier haben sie Rast gemacht.', { mood: 'determined' });
  });
  w.setObjective('k5-asche', 'Untersuche die Feuerstelle.', 'feuerstelle');
}

async function campfire(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    G.state.addClue('k5-spur-asche');
    await w.player.play('kneel', { ms: 900 });
    await w.think('Die Asche ist noch warm. Heute Morgen saßen sie hier.');
    await w.say('flick', 'Ein halber Tag Vorsprung, höchstens. Mit einer Gefangenen reitet keiner schnell.', { mood: 'determined' });
    if (G.state.count('bead') < 3) await w.say('flick', 'Da drüben im Gras liegt noch was. Deine Schwester hört gar nicht mehr auf.', { mood: 'smirk' });
    await lia('Dann los. Jetzt gleich. Wir sind so nah.', 'determined');
    await w.say('flick', 'Im Dunkeln? Da liest keiner mehr eine Fährte, auch ich nicht. Wir bleiben. Bei Licht holen wir sie ein.');
    G.state.set('k5-feuer');
    w.completeObjective('k5-faehrte');
    w.completeObjective('k5-asche');
    void w.lighting.set('night', 3500);
    G.audio.music('refuge', { fadeMs: 3000 });
    if (G.state.has('tinder')) {
      const pick = await w.choose([{ text: '„Warte. Ich hab Zunder.“', tag: 'Zunder' }, '„Mach du. Meine Hände zittern.“']);
      if (pick === 0) {
        await w.say('flick', 'Sieh an. Die fast Fertige denkt mit.', { mood: 'surprised' });
        await lia('Zunder hab ich. Funken schlagen kann ich nicht.');
        await w.say('flick', 'Gib her. Das ist der leichte Teil.', { mood: 'smirk' });
      } else await w.say('flick', 'Lass mal. Feuerstein, Stahl und ein kleiner Fluch. Mehr braucht’s nicht.', { mood: 'smirk' });
    } else {
      await w.say('flick', 'Feuerstein, Stahl, Geduld. Das Dritte fehlt den meisten.', { mood: 'smirk' });
    }
    sfx('fire-ignite');
    w.lighting.add({ id: 'k5-lagerfeuer', at: [1053, 152], kind: 'fire', radius: 130, intensity: 1.1, flame: 1, always: true });
    w.fx.burst([1053, 148], 'smoke', 6);
    ambience(['fire', 'crickets', 'night'], { fire: 0.9, crickets: 0.6 });
    await w.wait(600);
    // Flick sits on the log, Lia at the fire.
    w.companions.remove('flick');
    const f = w.spawn({ id: 'flick', preset: 'flick', at: [w.player.x + 30, w.player.y], dir: 'left' });
    await f.walkTo(1086, 146);
    f.setIdle('sit');
    f.face('down');
    await w.player.walkTo(1020, 178, { face: 'up' });
    w.player.setIdle('sit');
    await w.camera.pan([1053, 160], 900);
    await w.camera.zoom(1.35, 900);
    await nightTalk(w);
  });
  await G.ui.fade('out', 1400);
  await G.goto('schattenlager');
}

async function nightTalk(w: WorldCtx): Promise<void> {
  await w.say('narrator', 'Das Feuer knackte. Über den Wipfeln kamen die Sterne heraus, erst einzeln, dann zu Hunderten.');
  if (G.state.has('k5-brombeeren')) {
    const offer = await w.choose([{ text: 'Flick Brombeeren anbieten', tag: 'Brombeeren' }, 'Schweigend ins Feuer sehen']);
    if (offer === 0) {
      G.state.take('k5-brombeeren');
      sfx('eat');
      await w.say('flick', 'Aus den Dornen? Dann nehm ich alles zurück, was ich über den Umweg gesagt hab. Fast alles.', { mood: 'happy' });
    }
  }
  await lia('Du hättest mich im Wald liegen lassen können.', 'thinking');
  await w.say('flick', 'Hätte ich. Der Leichenfresser hätte sich gefreut.', { mood: 'smirk' });
  await lia('Ich mein’s ernst. Du kennst mich seit gestern. Warum bist du noch hier?');
  await w.say('flick', 'Eigentlich war ich auf dem Weg zur Freien Bruderschaft. Wollte mitmachen.', { mood: 'sad' });
  await w.say('flick', 'Die haben mich nicht genommen. Keine wie mich, hieß es.', { mood: 'sad' });
  const pick = await w.choose([
    '„Was heißt denn ‚wie dich‘?“',
    '„Ihr Pech. Die hätten eine Fährtenleserin gebraucht.“',
    '„Aber in ihrem Lager gibt es Elfen. Ich hab sie gesehen.“',
  ]);
  if (pick === 0) {
    await w.say('flick', 'Leute, die nirgends ganz hingehören. Lange Geschichte. Langweilig auch.', { mood: 'sad' });
    await lia('Ich war in ihrem Lager. Da sitzen Elfen aus Ebaril am Feuer, ein ganzer Haufen.', 'thinking');
  } else if (pick === 1) {
    await w.say('flick', 'Sag ich mir jeden Morgen. Satt wird man davon nicht.', { mood: 'smirk' });
    await lia('Komisch nur. In ihrem Lager hab ich jede Menge Elfen gesehen.', 'thinking');
  } else {
    await lia('Elfen aus Ebaril, an jedem zweiten Feuer.', 'thinking');
  }
  await w.say('flick', 'Du warst bei denen drin? Mit Augenbinde, wette ich.', { mood: 'surprised' });
  await w.say('flick', 'Elfen nehmen sie. Nur keine, die … ach, lass gut sein.', { mood: 'angry' });
  G.state.set('k5-flick-ausgewichen');
  await w.say('flick', 'Dann gründ ich eben selbst was. Die Elfen von Grunwald. Klingt nach mehr, als es ist.', { mood: 'happy' });
  await lia('Und wie viele Elfen hat Grunwald?');
  await w.say('flick', 'Eine. Und die hat dich gestern aus dem Matsch gezogen. Also Vorsicht.', { mood: 'smirk' });
  await lia('Sag der ganzen Truppe, ich bin beeindruckt.', 'happy');
  G.state.addLore('k5-lore-grunwald');
  if (G.state.is('k5-regastein')) {
    await lia('Im Wald stand ein Stein mit einem Hirsch drauf. Das ist Rega, oder?');
    await w.say('flick', 'Regas Zeichen. Meine Mutter ist mit mir die alten Steine abgelaufen, als ich …', { mood: 'sad' });
    await w.say('flick', 'Egal. Woher kennst du Rega überhaupt?', { mood: 'surprised' });
    await lia('Aus einem Buch. Wie fast alles, was ich weiß.');
  } else if (G.state.has('book-alana')) {
    await lia('Ich hab ein Buch dabei. Die Magierin Alana. Soll ich vorlesen?');
    await w.say('flick', 'Lass mich raten: Prinzessinnen, Drachen, am Ende eine Hochzeit.', { mood: 'smirk' });
    await lia('Eine Magierin. Und ein Rat, der sie nicht haben wollte.');
    await w.say('flick', 'Hm. Kommt mir bekannt vor.', { mood: 'sad' });
  }
  await w.say('flick', 'Wir brechen auf, bevor die Vögel wach sind. Die Kerle schlafen nicht ewig.');
  await lia('Und wenn wir sie einholen?');
  await w.say('flick', 'Dann zähl ich erst mal. Ich plane nichts, was ich nicht zählen kann.');
  await lia('Sehr beruhigend.');
  await w.wait(900);
  await lia('Danke. Dass du geblieben bist.', 'thinking');
  await w.say('flick', 'Wohin denn sonst? Die Bruderschaft hat ja abgesagt.', { mood: 'smirk' });
  await lia('Dann hat Grunwald jetzt eben zwei.', 'happy');
  await w.say('flick', 'Auf Probe. Schlaf, Lia. Ich pass aufs Feuer auf.', { mood: 'happy' });
}

export async function faehrteScript(w: WorldCtx): Promise<void> {
  w.lookMode.enable(true);
  await w.wait(500);
  await w.narrate(['Am Morgen war der Regen weitergezogen. Flick fand die Fährte dort, wo Lia nur Matsch gesehen hatte.'], { style: 'card' });
  await w.say('flick', 'Bücher hast du genug gelesen, Leseratte. Jetzt lies mal den Boden.', { mood: 'smirk' });
  await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick leuchten Spuren türkis auf. Untersuche sie mit ${w.controlHint('interact')}.`);
  w.setObjective('k5-spuren', 'Lies die Spuren am Wegrand (Spurenblick).', 'hufe');
}
