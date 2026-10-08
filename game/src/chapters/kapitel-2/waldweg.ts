// Kapitel II, Szene 4 `waldweg`: Morgen auf der Lichtung (Azars Wachteleier mit Speck), dann der Waldweg nach Osten
// (1280×720, assets/bg/k2-waldweg.png) mit beiden Gefährten: Barks, die Weggabelung (Azars Moos-Kompass gegen Foltans
// Kerben, Spurenblick), die Mittagsrast (Lia rettet Azars Stolz und nennt ihren Namen, „nicht wie ein Kind besprechen“),
// optional Speikraut mit dem Kräuterlexikon. Weiter zum Goldenen Eber.
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { addCampfire, LAGER_OCCLUDERS, LAGER_WALK, SPOT } from './lager';
import { bg, gotoNext, sfx, sleep } from './shared';
import { forestEncounter, playEncounter, saveEncounterReturn } from '../common/encounters';

const lia = (w: WorldCtx, text: string, mood?: string) => w.say('k2-lia', text, { mood });

// ---------------------------------------------------------------------------------------------------------------
// Morning at the clearing
// ---------------------------------------------------------------------------------------------------------------

export const lagerMorgen: MapDef = defineMap({
  id: 'k2-lager-morgen',
  name: 'Die Lichtung',
  background: 'k2-lager-morgen',
  walk: [LAGER_WALK],
  occluders: LAGER_OCCLUDERS,
  surface: 'forest',
  depthScale: { y0: 100, s0: 0.96, y1: 360, s1: 1.04 },
  resetOnEnter: true,
  props: [
    { prop: 'cloak-spread', id: 'mantel', at: [SPOT.bed[0], SPOT.bed[1] + 4], collide: false, depthOffset: -30 },
    { prop: 'k2-pfanne', id: 'pfanne', at: [SPOT.ring[0] + 18, SPOT.ring[1] + 6], collide: false },
  ],
  npcs: [
    { id: 'azar', preset: 'azar', at: [SPOT.ring[0] + 30, SPOT.ring[1] + 14], dir: 'left', idle: 'kneel', verb: 'Frühstücken', talk: breakfast },
    { id: 'foltan', preset: 'foltan', at: [190, 250], dir: 'right', verb: 'Reden', talk: async w => {
      if (!G.state.is('k2-fruehstueck')) await w.say('foltan', 'Iss erst. Mit leerem Magen läuft niemand einen Tagesmarsch.');
      else await w.say('foltan', 'Abmarsch. Der Pfad dort unten führt zurück auf unseren Weg.');
    } },
  ],
  exits: [{
    id: 'aufbruch', poly: [[98, 344], [166, 344], [166, 360], [98, 360]], to: 'k2-waldweg', spawn: 'west',
    when: () => G.state.is('k2-fruehstueck'), blocked: 'Erst frühstücken. Azar hat extra gekocht.',
  }],
  spawns: { bett: { at: SPOT.bed, dir: 'right' } },
  time: 'day',
  weather: 'pollen',
  ambience: ['birds', 'wind', 'fire'],
  ambienceVolume: { fire: 0.4, birds: 0.8 },
  music: 'exploration',
  onEnter: async w => { addCampfire(w, 0.7); },
});

async function breakfast(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  if (G.state.is('k2-fruehstueck')) {
    await azar.say(['Noch ein Ei? Nein? Selbst schuld.', 'Der Abwasch macht sich nicht von allein. Doch, eigentlich schon. Ich lass ihn liegen.'][Number(G.state.inc('k2-azar-morgen')) % 2]);
    return;
  }
  azar.setIdle('idle');
  azar.face('player');
  await azar.say('Wachteleier mit Speck. Nach Art des Hauses Azar. Die Eier hab ich heute früh selbst gefunden!', { mood: 'happy' });
  const pastry = G.state.has('chain-pastry');
  const p = await w.choose([
    'Schweigend essen.',
    '„Danke.“',
    { text: 'Kettengebäck mit ihm teilen.', disabled: !pastry, reason: 'Kein Kettengebäck dabei.', tag: pastry ? 'Kettengebäck' : undefined },
  ]);
  sfx('eat');
  if (p === 0) {
    await w.think('Es schmeckt wirklich gut. Aber reden mag ich nicht.');
    await azar.say('Schweigsam wie ein Grab, die Kleine. Na, Hauptsache, es schmeckt.', { mood: 'worried' });
  } else if (p === 1) {
    G.state.inc('k2-azar-mag');
    bg(azar.emote('heart', 1000));
    await azar.say('Sie spricht! Und dann gleich etwas so Kluges.', { mood: 'happy' });
  } else {
    G.state.take('chain-pastry');
    G.state.inc('k2-azar-mag', 2);
    bg(azar.emote('heart', 1200));
    await azar.say('Kettengebäck! Zum Verbannungsfest! Mädchen, du bist ein Engel.', { mood: 'happy' });
    await w.say('foltan', 'Jetzt hast du ihn für immer. Werd ihn mal wieder los.');
  }
  if (G.state.has('bacon')) await azar.say('Deinen Speck heben wir auf. Man weiß nie, wann man ihn braucht.');
  G.state.set('k2-fruehstueck');
  w.completeObjective('k2-morgen-essen');
  await w.say('foltan', 'Genug geschlemmt. Aufbruch. Bis zum Hauptlager ist es ein Tagesmarsch.');
  w.companions.add('foltan', 'foltan', 'foltan');
  w.companions.add('azar', 'azar', 'azar');
  w.setObjective('k2-aufbruch', 'Brich mit Foltan und Azar auf.', 'aufbruch');
}

export async function waldwegSkript(w: WorldCtx): Promise<void> {
  addCampfire(w, 0.7);
  w.player.teleport(SPOT.bed, 'right');
  w.player.setIdle('lie');
  await w.cutscene(async () => {
    await sleep(1200);
    w.bark('azar', '♪ Ein Ei, zwei Ei, drei Ei, Speck …', 2600);
    sfx('fire-ignite', { volume: 0.3 });
    await sleep(1600);
    w.player.setIdle('idle');
    w.player.teleport([SPOT.bed[0] - 12, SPOT.bed[1] + 10], 'left');
    await w.think('Ich habe tatsächlich geschlafen. Und es riecht … nach Speck?');
  });
  w.setObjective('k2-morgen-essen', 'Frühstücke mit Azar.', 'azar');
}

// ---------------------------------------------------------------------------------------------------------------
// The forest path
// ---------------------------------------------------------------------------------------------------------------

export const waldweg: MapDef = defineMap({
  id: 'k2-waldweg',
  name: 'Der Waldweg',
  background: 'k2-waldweg',
  walk: [
    // Main path with the lawns along it, up to the brook.
    [[0, 446], [96, 438], [196, 446], [236, 420], [214, 380], [236, 336], [300, 300], [420, 288], [560, 288], [604, 262], [610, 120],
      [598, 0], [662, 0], [682, 140], [690, 206], [770, 214], [900, 238], [960, 266], [984, 290], [984, 346], [978, 400], [986, 470],
      [970, 560], [900, 596], [760, 604], [620, 600], [520, 566], [430, 520], [330, 516], [220, 540], [100, 524], [0, 520]],
    // Stepping stones over the brook.
    [[982, 296], [1112, 290], [1112, 342], [982, 348]],
    // Far bank and the path out east.
    [[1100, 252], [1160, 236], [1280, 222], [1280, 326], [1190, 336], [1100, 346]],
  ],
  block: [
    { id: 'felsen-nord', poly: [[330, 190], [560, 190], [566, 282], [520, 286], [420, 284], [330, 286]] },
    { id: 'findling', poly: [[776, 438], [916, 440], [920, 476], [780, 478]] },
    { id: 'baumstamm', poly: [[722, 470], [760, 458], [910, 522], [910, 556], [882, 562], [726, 494]] },
    { id: 'stein-ost', poly: [[580, 300], [604, 300], [604, 312], [580, 312]], sight: false },
  ],
  occluders: [
    { id: 'findling', baseline: 476, fade: 0.6, poly: [[770, 384], [920, 384], [926, 476], [774, 478]] },
    { id: 'stamm-links', baseline: 494, poly: [[716, 462], [800, 470], [800, 512], [722, 496]] },
    { id: 'stamm-rechts', baseline: 560, poly: [[800, 470], [912, 516], [912, 562], [800, 512]] },
    { id: 'wald-sued', baseline: 720, fade: 0.6, poly: [[0, 530], [100, 532], [220, 548], [330, 524], [430, 528], [520, 574], [620, 608], [760, 612], [900, 604], [980, 566], [1000, 720], [0, 720]] },
  ],
  surfaces: [
    { id: 'pfad', kind: 'path', poly: [[0, 456], [200, 470], [300, 440], [400, 400], [560, 360], [640, 330], [800, 302], [980, 296], [980, 336], [800, 344], [660, 362], [560, 396], [400, 432], [300, 476], [200, 512], [0, 500]] },
    { id: 'seitenpfad', kind: 'path', poly: [[612, 0], [652, 0], [672, 140], [676, 300], [640, 320], [624, 140]] },
    { id: 'trittsteine', kind: 'shallow', speed: 0.85, poly: [[982, 296], [1112, 290], [1112, 342], [982, 348]] },
    { id: 'pfad-ost', kind: 'path', poly: [[1100, 280], [1280, 240], [1280, 300], [1100, 336]] },
  ],
  npcs: [],
  props: [{ prop: 'k2-speikraut', id: 'speikraut-prop', at: [952, 432], collide: false }],
  interactables: [
    {
      id: 'wegelagerer', verb: 'Weg am Bach prüfen', at: [972, 330], radius: 32, sparkle: true,
      when: () => G.state.is('k2-rast-fertig') && !G.state.is('k2-wegelagerer-besiegt') && !G.state.is('k2-wegelagerer-umgangen'),
      onInteract: async w => {
        await w.say('foltan', 'Zwei Kerle am anderen Ufer. Rostige Helme, geflickte Röcke. Wegelagerer. Wir jagen sie weg, oder wir queren weiter unten.');
        const pick = await w.choose(['„Gehen wir ihnen aus dem Weg.“', '„Ich komme mit. Ich schaue nicht mehr nur zu.“']);
        if (pick === 0) {
          G.state.set('k2-wegelagerer-umgangen');
          saveEncounterReturn(w);
          await w.say('foltan', 'Vernünftig. Wir sind wegen deiner Schwester unterwegs, nicht wegen zwei Strauchdieben.');
          return;
        }
        await w.say('foltan', 'Gut. Bleib an meiner Seite, nicht vor mir. Stich zu, wenn einer dir den Rücken zeigt. Azar, du deckst sie.');
        const result = await playEncounter(w, forestEncounter(), 'k2-wegelagerer-besiegt');
        if (result.outcome === 'win') {
          await w.think('Meine Hände zittern noch. Aber wir sind durchgekommen.');
          await w.say('azar', 'Für heute reicht mir das. Beim nächsten Bach wünsche ich mir wieder Eichhörnchen.');
        }
      },
    },
    {
      id: 'speikraut', verb: 'Untersuchen', at: [952, 432], radius: 24, once: false, sparkle: true,
      when: () => !G.state.is('k2-speikraut-gepflueckt'),
      onInteract: onSpeikraut,
    },
    {
      id: 'moos', verb: 'Moos prüfen', radius: 22, once: false,
      poly: [[560, 196], [600, 190], [604, 260], [566, 266]],
      onInteract: async w => {
        await w.think('Moos auf der Nordseite. Und auf der Südseite. Und obendrauf. Das Moos sagt gar nichts, Azar.');
        G.state.set('k2-moos-geprueft');
      },
    },
    {
      id: 'rastplatz', verb: 'Rasten', at: [872, 578], radius: 26, once: false, standAt: [872, 580], face: 'down',
      when: () => G.state.is('k2-rast-angesagt') && !G.state.is('k2-rast'),
      onInteract: rest,
    },
  ],
  clues: [
    { id: 'kerbe-1', at: [708, 300], kind: 'mark', angle: 0, clue: 'k2-zeichen', thought: 'Drei schräge Kerben in der Rinde. Frisch geschnitten. Das ist kein Zufall.' },
    { id: 'kerbe-2', at: [860, 296], kind: 'mark', angle: 0, thought: 'Wieder drei Kerben. Immer auf Hüfthöhe.' },
    { id: 'kerbe-3', at: [1150, 272], kind: 'mark', angle: 0, thought: 'Und hier noch einmal. Foltan folgt nicht dem Moos.' },
  ],
  triggers: [
    { id: 'gabelung', once: true, poly: [[560, 290], [620, 290], [640, 400], [560, 410]], onEnter: atFork },
    { id: 'sackgasse', once: false, poly: [[600, 0], [664, 0], [670, 60], [604, 60]], onEnter: deadEnd },
    { id: 'rast', once: true, poly: [[860, 296], [900, 296], [900, 420], [860, 420]], onEnter: middayRest },
    { id: 'osten', once: false, poly: [[1256, 222], [1280, 222], [1280, 326], [1256, 326]], onEnter: toBoar },
    { id: 'zurueck', once: false, poly: [[0, 440], [16, 440], [16, 524], [0, 524]], onEnter: async w => {
      w.bark('foltan', 'Falsche Richtung, Mädchen.');
      await w.cutscene(() => w.player.walkTo([60, w.player.y], { straight: true }));
    } },
  ],
  spawns: { west: { at: [40, 482], dir: 'right' } },
  depthScale: { y0: 0, s0: 0.95, y1: 720, s1: 1.04 },
  time: 'day',
  weather: 'leaves',
  ambience: ['birds', 'wind', 'stream'],
  ambienceVolume: { stream: 0.7, birds: 0.9, wind: 0.4 },
  music: 'exploration',
  lookMode: true,
  critters: true,
  onEnter: async w => {
    // The party follows (also after a reload on this map or a skipped breakfast).
    for (const id of ['foltan', 'azar']) if (!w.companions.ids.includes(id) && !(G.state.is('k2-rast-angesagt') && !G.state.is('k2-rast-fertig'))) w.companions.add(id, id, id);
    if (G.state.is('k2-waldweg-start')) return;
    G.state.set('k2-waldweg-start');
    bantering(w);
    await sleep(600);
    w.setObjective('k2-waldweg', 'Folge dem Waldweg nach Osten.', [640, 330]);
    await w.say('azar', 'Morgenstund hat Gold im Mund. Und Wachteleier im Bauch!', { mood: 'happy' });
    await w.say('foltan', 'Und Blei in den Beinen, wenn du so weitertrödelst.');
  },
});

/** Companions banter while walking (barks, non-blocking). Azar falls behind and „checks the moss“. */
function bantering(w: WorldCtx): void {
  const lines: [string, string][] = [
    ['azar', 'Wer rastet, der rostet. Sagt man.'],
    ['foltan', 'Weniger reden, mehr laufen.'],
    ['azar', 'Der feine Herr Foltan rennt wie auf der Flucht.'],
    ['azar', 'Ich … prüfe nur das Moos. Für die Richtung.'],
    ['foltan', 'Augen offen. Hier gibt’s nicht nur Eichhörnchen.'],
    ['azar', 'Was war das?! … Nur ein Eichhörnchen.'],
    ['azar', 'Ein leerer Bauch marschiert nicht gern.'],
    ['foltan', 'Azar. Das Moos wächst auf allen Seiten.'],
  ];
  void (async () => {
    for (let i = 0; w.alive; i++) {
      await w.wait(9500);
      if (G.state.is('k2-rast-angesagt') && !G.state.is('k2-rast-fertig')) continue;
      const [who, text] = lines[i % lines.length];
      w.bark(who, text, 3200);
    }
  })().catch(() => { /* world stopped */ });
}

async function atFork(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan'), azar = w.actor('azar');
  await w.cutscene(async () => {
    await w.camera.pan([640, 250], 900);
    await w.say('azar', 'Halt! Das Moos sagt: dort hinauf. Das Moos ist mein Kompass!', { mood: 'happy' });
    bg(foltan.emote('…', 1000));
    await w.say('foltan', 'Dein Kompass hat uns letzten Winter in einen Sumpf geführt.');
    await w.say('azar', 'Das war ein sehr trockener Sumpf!', { mood: 'angry' });
    w.camera.follow();
  });
  w.setObjective('k2-gabelung', 'Welcher Weg? Sieh dich an der Gabelung um.', 'kerbe-1');
  await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt. Vielleicht verrät der Wald mehr als das Moos.`);
  w.on('clue', 'kerbe-1', async () => {
    w.completeObjective('k2-gabelung');
    G.state.set('k2-kerben');
    await w.say('foltan', 'Du hast die Kerben gesehen. Gute Augen.', { mood: 'surprised' });
    await w.say('foltan', 'Und jetzt vergiss sie wieder. Diese Zeichen hast du nie gesehen.');
    bg(azar.emote('drop', 900));
    w.setObjective('k2-waldweg', 'Folge den Kerben nach Osten.', 'kerbe-2');
  });
  w.on('clue', 'kerbe-2', () => { if (!G.state.is('k2-rast')) w.setObjectiveTarget([880, 330]); });
}

async function deadEnd(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await w.think('Brombeeren. Undurchdringlich. Hier geht es nicht weiter.');
    if (!G.state.is('k2-sackgasse')) {
      G.state.set('k2-sackgasse');
      await w.say('azar', 'Das Moos … hat sich geirrt. Das kommt in den besten Familien vor.', { mood: 'worried' });
      await w.say('foltan', 'In deiner Familie offenbar ständig.');
    }
    await w.player.walkTo([w.player.x + 4, 110], { straight: true });
  });
}

async function middayRest(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar'), foltan = w.actor('foltan');
  await w.cutscene(async () => {
    bg(azar.emote('drop', 1200));
    await w.say('azar', 'Wann … machen wir eigentlich … Mittagsrast?', { mood: 'worried' });
    await w.say('foltan', 'Bist du schon wieder hungrig?');
    await w.say('azar', 'Nein! Aber denk an das junge Mädchen. Wir müssen Rücksicht auf unser schwächstes Glied nehmen.');
    await w.think('Er schnauft wie ein Blasebalg. Und sein Gesicht glänzt.');
    const p = await w.choose([
      '„Ja. Ich brauche wirklich eine Pause.“',
      '„Also wegen mir müssen wir nicht …“',
      '„Ich glaube eher, Azar braucht eine Pause.“',
    ]);
    if (p === 0) {
      G.state.set('k2-azar-stolz');
      await lia(w, 'Ja. Ich wäre über eine Pause wirklich dankbar.', 'sad');
    } else if (p === 1) {
      await lia(w, 'Also wegen mir müssen wir nicht …');
      bg(azar.emote('drop', 1200));
      await w.think('Er sieht mich an wie ein Hund, dem man den Knochen wegnimmt.');
      const p2 = await w.choose(['„… Doch. Eine Pause wäre schön.“', '„… wirklich nicht anhalten.“']);
      if (p2 === 0) {
        G.state.set('k2-azar-stolz');
        await lia(w, 'Ich meine: doch. Eine Pause wäre schön.');
      } else {
        await w.say('azar', 'Ugh. Dann … dann laufe ich eben … bis ich umfalle.', { mood: 'sad' });
        await w.say('foltan', 'Gut, kurze Rast. Bevor er mir wirklich umfällt.');
      }
    } else {
      G.state.set('k2-azar-blamiert');
      bg(azar.emote('anger', 1200));
      await w.say('azar', 'Unerhört! Ich habe eine ausgezeichnete Kondition!', { mood: 'angry' });
      bg(foltan.emote('note', 900));
      await w.say('foltan', 'Ha! Gut beobachtet. Na schön, kurze Rast. Für den Mann mit der ausgezeichneten Kondition.');
    }
    if (G.state.is('k2-azar-stolz')) await w.say('foltan', 'Wenn ihr meint. Dann setzt euch kurz. Ich schlage mich mal in die Büsche.');
    else await w.say('foltan', 'Ich schlage mich so lange in die Büsche.');
  });
  G.state.set('k2-rast-angesagt');
  w.setObjective('k2-rast', 'Setz dich zu Azar an den Baumstamm und raste.', 'rastplatz');
  void (async () => {
    // Foltan leaves for the bushes; Azar plops down on the log.
    w.companions.remove('foltan');
    w.companions.remove('azar');
    await Promise.all([
      foltan.walkTo([700, 590]).then(() => foltan.hide()),
      azar.walkTo([800, 552]).then(() => { azar.face('right'); azar.setIdle('sit'); }),
    ]);
  })().catch(() => { /* world stopped */ });
}

async function rest(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar'), foltan = w.actor('foltan');
  G.state.set('k2-rast');
  w.completeObjective('k2-rast');
  await w.cutscene(async () => {
    w.player.setIdle('sit');
    if (azar.exists) { azar.teleport([800, 552], 'right'); azar.setIdle('sit'); }
    await w.camera.pan([838, 560], 700);
    await w.camera.zoom(1.25, 900);
    await sleep(500);
    sfx('splash', { volume: 0.3 });
    await w.think('Ein Schluck aus dem Wasserschlauch. Kühl. Endlich.');
    if (G.state.is('k2-azar-stolz')) {
      await w.say('azar', 'Danke. Sonst würden wir jetzt immer noch quer durch den Wald hetzen.', { mood: 'happy' });
      await w.say('azar', 'Was ist eigentlich dein Name, Kleine? Ich möchte wenigstens wissen, bei wem ich mich bedanke.');
    } else if (G.state.is('k2-azar-blamiert')) {
      await w.say('azar', 'Ausgezeichnete Kondition, hab ich gesagt. Hmpf.', { mood: 'angry' });
      await w.say('azar', 'Wie heißt du eigentlich, Kleine? Ich möchte wissen, über wen ich mich ärgere.');
    } else {
      await w.say('azar', 'Puh. Was ist eigentlich dein Name, Kleine? Wir reden seit gestern, und ich weiß ihn nicht.');
    }
    await w.camera.zoom(1.4, 600);
    await lia(w, 'Lia.');
    await w.camera.zoom(1.25, 600);
    await w.say('azar', 'Lia. Schöner Name. Du redest nicht gern, hab ich recht? Nicht mal beim Frühstück. Und das war köstlich.', { mood: 'happy' });
    await w.say('azar', 'Ich war nie besonders zurückhaltend, weißt du?');
    foltan.show();
    foltan.teleport([700, 590], 'up');
    await foltan.walkTo([754, 570]);
    foltan.face('player');
    await w.say('foltan', 'Das hat sie gestern Abend schon gemerkt, glaub mir.');
    await w.say('foltan', 'Lass sie. Die hat mehr verloren als wir beide zusammen. Gib ihr Zeit.');
    await w.say('azar', 'Immerhin hat sie mir ihren Namen verraten. Sie heißt Lia.', { mood: 'happy' });
    await w.say('foltan', 'Schön. Dann wissen wir wenigstens, wen wir ins Lager befördern.');
    await lia(w, 'Was ist das für ein Lager, in das ihr mich bringt?', 'thinking');
    await w.say('azar', 'Ein ganzer Satz! Nicht schlecht.');
    await w.say('foltan', 'Wir sind Späher. Unsere Leute jagen Dunkelschatten. Wo das Lager liegt, musst du nicht wissen.');
    await w.say('foltan', 'Dort wird entschieden, was aus dir wird. Vielleicht hat ein anderer Trupp die Entführer deiner Schwester gesehen.');
    await w.say('foltan', 'Mach dir aber keine großen Hoffnungen. Dunkelschatten fragen nicht, wie alt jemand ist.', { mood: 'sad' });
    await w.say('azar', 'Eben noch „gib ihr Zeit“, und jetzt so was? Du hast das Feingefühl eines Ambosses!', { mood: 'angry' });
    await w.say('foltan', 'Ich will ihr nichts vormachen. Ich bin nur ehrlich.');
    const p = await w.choose([
      '„Könnt ihr bitte aufhören, so über mich zu reden, wenn ich neben euch sitze?“',
      '„Ich sitze übrigens direkt neben euch. Mit Ohren.“',
    ]);
    if (p === 0) await lia(w, 'Könnt ihr bitte aufhören, so über mich zu reden, wenn ich neben euch sitze?', 'angry');
    else { G.state.inc('k2-azar-mag'); await lia(w, 'Ich sitze übrigens direkt neben euch. Mit Ohren. Zwei Stück.', 'angry'); }
    bg(azar.emote('!', 800)); bg(foltan.emote('!', 800));
    await lia(w, 'Schlimmer kann es nicht mehr werden. Ich hab schon alles verloren. Bis auf Kyra.', 'sad');
    await lia(w, 'Also kann es nur besser werden. Spätestens, wenn ich sie zurückhabe.', 'determined');
    await w.say('azar', 'Interessante Form von Optimismus.');
    await w.say('foltan', 'Wir werden sehen, was sich machen lässt. Reden können wir heute Abend am Feuer. Los.');
    await w.say('azar', 'Man soll aufhören, wenn’s am schönsten ist …', { mood: 'sad' });
    await w.camera.zoom(1, 800);
    w.player.setIdle('idle');
    azar.setIdle('idle');
  });
  G.state.set('k2-rast-fertig');
  G.state.set('k2-name-genannt');
  w.companions.add('foltan', 'foltan', 'foltan');
  w.companions.add('azar', 'azar', 'azar');
  w.setObjective('k2-osten', 'Weiter nach Osten, über die Trittsteine.', [1270, 274]);
  w.bark('foltan', 'Am Bach stehen Fremde. Sieh dir den Weg an, bevor wir hinübergehen.', 4200);
}

async function onSpeikraut(w: WorldCtx): Promise<void> {
  if (!G.state.has('book-herbs')) {
    await w.think('Ein Kraut mit feinen Blättern und winzigen weißen Blüten. Mutter hätte gewusst, wofür es gut ist.');
    return;
  }
  await w.player.play('kneel', { ms: 600 });
  await w.think('Feine, gefiederte Blätter, kleine weiße Dolden … Speikraut! Mutters Lexikon hat eine ganze Seite darüber.');
  await w.think('Zerrieben kühlt es Entzündungen. Mutter hat daneben geschrieben: „Hilft auch gegen Blasen.“');
  G.state.set('k2-speikraut-gepflueckt');
  w.prop('speikraut-prop').remove();
  G.state.give('k2-speikraut');
  const p = await w.choose([
    'Auf die eigene Ferse legen.',
    { text: 'Azar für seine Füße geben.', disabled: !w.actor('azar').exists },
    'Für später aufheben.',
  ]);
  if (p === 0) {
    G.state.take('k2-speikraut');
    G.state.set('k2-ferse-speikraut');
    sfx('heal', { volume: 0.4 });
    await w.think('Kühl. Das Brennen lässt nach. Danke, Mutter.');
  } else if (p === 1) {
    G.state.take('k2-speikraut');
    G.state.set('k2-speikraut-azar');
    G.state.inc('k2-azar-mag');
    await w.say('azar', 'Für meine Füße? Woher weißt du so etwas, Lia? Bist du ein Kräuterweiblein?', { mood: 'surprised' });
    await lia(w, 'Meine Mutter kannte jede Pflanze. Ich habe … gut aufgepasst.');
    await w.say('azar', 'Ahhh … himmlisch. Foltan, sie bleibt. Ich bestehe darauf.', { mood: 'happy' });
  } else {
    await w.think('Ich nehme es mit. Wer weiß, wann ich es brauche.');
  }
}

async function toBoar(w: WorldCtx): Promise<void> {
  if (!G.state.is('k2-rast-fertig')) {
    w.bark('foltan', 'Erst rasten wir. Azar fällt sonst um.');
    await w.cutscene(() => w.player.walkTo([1220, w.player.y], { straight: true }));
    return;
  }
  w.completeObjective('k2-osten');
  await w.cutscene(async () => {
    await w.player.walkTo([1276, w.player.y], { straight: true });
  });
  await G.ui.fade('out', 1000);
  await G.ui.narrate([
    'Sie liefen, bis die Schatten lang wurden. Foltan vorneweg, Lia in der Mitte, Azar schnaufend hinterher.',
    'Am Abend lichtete sich der Wald. An der Straße lag eine Schenke mit einem goldenen Eber über der Tür.',
  ], { style: 'card' });
  await gotoNext('eber');
}
