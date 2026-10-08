// Easter egg in the Goldener Eber (user's wish, 2026-10-07): Logge, the game's maker, sits drunk at a table and babbles
// about „this game“ — he breaks the fourth wall on purpose. His sober friend Sebastian (playtester; user's wish) sits with
// him and keeps putting the brakes on. Optional; no story knowledge, no rewards beyond a joke item.
// Positions come from the map that hosts him (taverne.ts), so this module stays map-agnostic.
import { G } from '../../core/G';
import { registerItems, registerSpeakers } from '../../core/catalog';
import type { At, InteractableDef, NpcDef, PropDef, WorldCtx } from '../../world';
import { grantOnce, lia } from './shared';

registerSpeakers([
  { id: 'e2-logge', name: 'Logge', portrait: 'logge', voice: { pitch: 160, wave: 'triangle' }, color: '#e08a3c' },
  { id: 'e2-sebastian', name: 'Sebastian', portrait: 'sebastian', voice: { pitch: 140, wave: 'sine' }, color: '#7f8fb8' },
  { id: 'e2-pascal', name: 'Pascal', portrait: 'pascal', voice: { pitch: 150, wave: 'square' }, color: '#d9783a' },
]);

registerItems([
  {
    id: 'e2-logge-zettel', name: 'Loggesche Notiz', icon: 'letter',
    description: 'Ein bierfleckiger Zettel. Darauf steht in krakeliger Schrift „TODO: Teil drei“, darunter eine sehr genaue Zeichnung einer schlafenden Katze.',
    comment: 'Ich kann lesen. Verstehen tu ich’s trotzdem nicht.',
  },
]);

const RAMBLE: [string, string?][] = [
  ['Weißt du, im Film heißt du ganz anders. Pssst. Du bleibst Lia. Lia ist gut. Lia ist besser.'],
  ['Früher haben hier alle Sätze gesagt, die kein Mensch sagt. Dann hat einer „cringe“ gerufen. Jetzt reden alle normal. Fast alle.', 'Ich rede immer normal.'],
  ['Jede Szene braucht ein spielerisches Herzstück. Steht so in der Bibel. Meins ist der Krug. Heben, trinken, absetzen. Ausbalanciert.'],
  ['Drück mal E. … Nein, nicht du. Der da draußen, vor der Scheibe. Hallo! Ja, genau du!', 'Mit wem redet Ihr?'],
  ['Wenn zu viele von uns gleichzeitig denken, stürzt da draußen die Welt ab. Darum sitzen wir nie mehr als zwei an einem Tisch.'],
  ['Wenn du gleich rausgehst … nein. Nix. Ich hab gelernt: keine Vorgriffe im Wirtshaus. Steht auch in der Bibel.'],
  ['Die Katze da oben ist nicht von hier. Die hab ich mitgebracht. Von drüben. Die schläft hier genauso viel wie dort.'],
  ['Prost auf den zweiten Teil! Den dritten trink ich später.'],
];

const BARKS = ['Hicks.', 'Noch eins, Craupor!', 'Ich bin nur Deko.', 'Wer hat die vierte Wand gebaut?', 'Sechshundertvierzig …'];

/** Sebastian brakes Logge after some of his lines (index into RAMBLE → his interjection). */
const BRAKE: Record<number, string> = {
  1: 'Er meint die Proben. Frag nicht.',
  3: 'Logge. Setz dich wieder hin. Da draußen ist niemand.',
  4: 'Das ist kein Witz. Das ist eine Hausregel.',
  5: 'Gut so. Keine Vorgriffe.',
};

const SEB: string[] = [
  'Entschuldigt ihn. Er hat seit Tagen kein Tageslicht gesehen. Nur … Kerzenlicht. Sehr viel Kerzenlicht.',
  'Das mit den Pünktchen meint er ernst. Ich hab irgendwann aufgehört zu widersprechen.',
  'Ich bin hier gegen jede Wand gelaufen, die es gibt. Die beim Kamin ist die beste. Gibt kaum nach.',
  'Ich hab ihm gesagt: Der große Kerl mit der Axt stirbt nicht. Und siehe da. Er lebt noch.',
  'Früher hab ich mal einen alten Zauberer gespielt. Bart bis hier. Lange Geschichte. Sie endet mit einem Knall.',
  'Ich trink Wasser. Einer am Tisch muss wissen, wo die Tür ist.',
];

/** The drunk at the table. `at` is his seat on the hosting map. */
export function loggeNpc(at: At, dir: NpcDef['dir'] = 'right'): NpcDef {
  // 'drunk-sit' is a manifest pose of the logge sprite (slumped, tankard in hand); poses play under their own name.
  const idle = 'drunk-sit' as unknown as NpcDef['idle'];
  return { id: 'e2-logge', preset: 'logge', speaker: 'e2-logge', at, dir, idle, talk: talkLogge, barks: BARKS, barkEvery: 12000 };
}

/** His sober friend next to him. */
export function sebastianNpc(at: At, dir: NpcDef['dir'] = 'left'): NpcDef {
  return {
    id: 'e2-sebastian', preset: 'sebastian', speaker: 'e2-sebastian', at, dir, idle: 'sit', talk: talkSebastian,
    barks: ['Logge. Leiser.', 'Noch ein Wasser, bitte.', 'Er meint’s nicht so.'], barkEvery: 15000,
  };
}

/**
 * Pascal sits alone and knows exactly one sentence — the (in)famous line of the guard from the first film's bluff.
 * Whatever Lia says, he answers with it. That is the whole joke.
 */
export function pascalNpc(at: At, dir: NpcDef['dir'] = 'down'): NpcDef {
  return {
    id: 'e2-pascal', preset: 'pascal', speaker: 'e2-pascal', at, dir, idle: 'sit', talk: talkPascal,
    barks: ['Tock. Tock-tock.', '…'], barkEvery: 14000,
  };
}

const PASCAL_LINE = 'Du bist aber auch noch ganz schön jung …';
const LIA_TO_PASCAL = [
  'Guten Abend. Ist hier noch frei?',
  'Das sagtet Ihr schon.',
  'Ich bin sechzehn. Und ich hab schon einen Hauptmann durch die Luft geworfen.',
  'Könnt Ihr auch noch was anderes sagen?',
  'Ihr kommt mir bekannt vor. Wart Ihr mal Wache an einem großen Baum?',
];

async function talkPascal(w: WorldCtx): Promise<void> {
  const n = Number(G.state.flag('e2-pascal-gespraeche') ?? 0);
  await lia(w, LIA_TO_PASCAL[Math.min(n, LIA_TO_PASCAL.length - 1)], n >= 3 ? 'angry' : 'thinking');
  await w.say('e2-pascal', PASCAL_LINE, { mood: n % 2 ? 'smirk' : 'neutral' });
  if (n === 1) w.bark('kyra', 'Der hat nur den einen Satz, oder?');
  if (n === 4) {
    await w.think('Er trommelt mit zwei Holzlöffeln weiter, als wäre nichts gewesen. Vielleicht ist das seine Art von Antwort.');
    if (w.actor('e2-logge').exists) w.bark('e2-logge', 'Sein bester Satz! Ganz großes Kino!');
  }
  G.state.set('e2-pascal-gespraeche', n + 1);
}

async function talkSebastian(w: WorldCtx): Promise<void> {
  const n = Number(G.state.flag('e2-sebastian-gespraeche') ?? 0);
  await w.say('e2-sebastian', SEB[n % SEB.length], { mood: n % 2 ? 'smirk' : 'happy' });
  if (n === 0) {
    await lia(w, 'Ist er immer so?', 'thinking');
    await w.say('e2-sebastian', 'Nur wenn er fertig ist. Oder kurz davor. Also eigentlich immer.', { mood: 'smirk' });
  }
  G.state.set('e2-sebastian-gespraeche', n + 1);
}

/** His orange spectacles, lost somewhere on the floor (the optional little errand). */
export function loggeGlasses(at: At): InteractableDef {
  return {
    id: 'e2-logge-glaeser', verb: 'Aufheben', at, radius: 20, sparkle: false, once: true,
    when: () => G.state.is('e2-logge-sucht') && !G.state.is('e2-logge-glaeser'),
    onInteract: async w => {
      G.state.set('e2-logge-glaeser');
      await w.think('Zwei kleine runde Gläser, orange getönt, in Draht gefasst. Wer trägt so was? Und wozu?');
      w.setObjective('e2-logge-brille', 'Bring Logge seine orangenen Gläser zurück.', 'e2-logge');
    },
  };
}

/**
 * The sleeping black cat, curled up on the cameo table between Logge and Sebastian. On the dark tavern floor the
 * small black sprite read as a blob; on the light tabletop it reads as a cat. Returns the prop (drawn above the
 * table) and the hotspot (the player stands in front of the table, `stand`).
 */
export function loggeCat(at: At, stand: At): { prop: PropDef; spot: InteractableDef } {
  return {
    prop: { id: 'e2-logge-katze', prop: 'e2-katze-liegend', at, collide: false, depthOffset: 10 },
    spot: loggeCatSpot(at, stand),
  };
}

function loggeCatSpot(at: At, standAt: At): InteractableDef {
  return {
    id: 'e2-logge-katze', verb: 'Streicheln', at, radius: 28, standAt, face: 'up', once: false,
    onInteract: async w => {
      await w.think(G.state.is('e2-logge-katze-gestreichelt')
        ? 'Sie schnurrt wieder. Unerschütterlich.'
        : 'Sie schnurrt, ohne die Augen zu öffnen. Wenigstens eine hier, die nüchtern ist.');
      G.state.set('e2-logge-katze-gestreichelt');
    },
  };
}

async function talkLogge(w: WorldCtx): Promise<void> {
  if (!G.state.is('e2-logge-getroffen')) { await firstMeeting(w); return; }
  if (G.state.is('e2-logge-glaeser') && !G.state.is('e2-logge-zurueck')) { await giveBack(w); return; }
  const n = Number(G.state.flag('e2-logge-geschwaetz') ?? 0);
  const [line, reply] = RAMBLE[n % RAMBLE.length];
  await w.say('e2-logge', line, { mood: n % 3 === 0 ? 'happy' : 'smirk' });
  if (reply) {
    await lia(w, reply, 'thinking');
    await w.say('e2-logge', n % RAMBLE.length === 1 ? 'Du ja. Du hast den besten Text.' : 'Mit dem, der dir sagt, wohin du läufst. Grüß ihn.', { mood: 'happy' });
  }
  const brake = BRAKE[n % RAMBLE.length];
  if (brake && w.actor('e2-sebastian').exists) await w.say('e2-sebastian', brake, { mood: 'worried' });
  G.state.set('e2-logge-geschwaetz', n + 1);
}

async function firstMeeting(w: WorldCtx): Promise<void> {
  G.state.set('e2-logge-getroffen');
  await w.say('e2-logge', 'Ah! Die Hauptfigur! Setz dich! … Nein, warte. Du kannst dich hier nicht setzen. Dafür fehlt dir die Pose.', { mood: 'happy' });
  await lia(w, 'Kennen wir uns?', 'surprised');
  await w.say('e2-logge', 'Du mich nicht. Ich dich schon. Ich hab dich gemacht. Also … mitgemacht. Den Rest hat ein sehr fleißiger Gehilfe geschrieben.', { mood: 'smirk' });
  const pick = await w.choose([
    '„Ihr seid betrunken.“',
    '„Gemacht? Wie meint Ihr das?“',
    '„Ich geh dann mal wieder.“',
  ]);
  if (pick === 0) {
    await w.say('e2-logge', 'Ich bin Chronist. Das gehört zum Beruf. Wie die Tinte an den Fingern.', { mood: 'smirk' });
  } else if (pick === 1) {
    await w.say('e2-logge', 'Du bist aus lauter kleinen Pünktchen. Sechshundertvierzig mal dreihundertsechzig. Ich hab nachgezählt. Zweimal. Kam jedes Mal was anderes raus.', { mood: 'thinking' });
    await lia(w, 'Ich hab schon seltsamere Bücher gelesen. Aber nicht viele.', 'thinking');
  } else {
    await w.say('e2-logge', 'Warte! Eins noch. Ich find meine Gläser nicht. Die orangenen. Ohne die sieht die Welt so … ungefärbt aus.', { mood: 'surprised' });
  }
  if (w.actor('e2-sebastian').exists) await w.say('e2-sebastian', 'Logge. Lass die Leute in Ruhe. Sie haben eine Geschichte zu erleben.', { mood: 'worried' });
  w.bark('kyra', 'Soll ich ihn rauswerfen?');
  w.bark('flick', 'Lass. Der ist harmlos. Glaub ich.');
  if (pick !== 2) await w.say('e2-logge', 'Ach, und wo du schon da bist: Hast du meine Gläser gesehen? Die orangenen. Ohne seh ich hier alles ungefärbt.', { mood: 'surprised' });
  G.state.set('e2-logge-sucht');
  w.setObjective('e2-logge-brille', 'Optional: Such Logges orangene Gläser im Schankraum.');
}

async function giveBack(w: WorldCtx): Promise<void> {
  G.state.set('e2-logge-zurueck');
  w.completeObjective('e2-logge-brille');
  await lia(w, 'Eure Gläser. Sie lagen unter der Bank.', 'happy');
  await w.say('e2-logge', 'Ahhh. Jetzt ist alles wieder schön warm und orange. Wie ein Sonnenuntergang, der nicht aufhören will.', { mood: 'happy' });
  grantOnce('e2-logge-dank', () => G.state.give('e2-logge-zettel'));
  await w.say('e2-logge', 'Hier. Mein wertvollster Besitz. Eine Notiz. Pass gut drauf auf. Da steht drauf, was als Nächstes kommt.', { mood: 'smirk' });
  await lia(w, '„TODO: Teil drei.“ Und eine Katze.', 'thinking');
  await w.say('e2-logge', 'Genau. Mehr weiß ich auch noch nicht.', { mood: 'happy' });
  if (w.actor('e2-sebastian').exists) await w.say('e2-sebastian', 'Danke. Er hat sie seit gestern gesucht. Auf seinem Kopf, meistens.', { mood: 'smirk' });
}
