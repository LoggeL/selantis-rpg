// Scene „e3-schutzreaktion“ – Was in ihr wohnt (docs/teil-3/umsetzung.md §3, F3 08:35–10:54). The hall of the
// Lichterorden (e3-ordenssaal): the Großmeister on the high chair, the captain of the guard, paladins along the runner.
// Lia (bound, e3-lia-gefesselt) walks up the runner with a paladin at her heels; the papers on the long table can be
// read on the way (only Lia can read). Heart: the interrogation with choices – Ignatius sticks to the merchant, Lia
// answers in her own tone (e3-verhoer-ton: schweigen / luege / wut). The Großmeister orders her taken upstairs and
// questioned alone; a paladin grabs her and storyAction('reach', 'Sich losreißen') – she tears free for a breath, then
// the grip only gets harder, and the Urmacht answers without her doing: a turquoise blast (plate e3-schutzreaktion,
// flash, shake), everyone stumbles back, the candles go out, Lia collapses. A scripted protective reaction, not a
// skill (nothing is learned). Then black, voices only: Ignatius drops the cover (one of the Ten), the Großmeister
// wants her kept here, Ignatius: the Urmacht defends itself and its bearer when cornered; the Doctor is sent for,
// Ignatius is sent out, refuses, gives in. → e3-macht-und-schutz. A reload restarts at the hall door.
import { G } from '../../core/G';
import { defineMap, startWorld, type ActorHandle, type MapDef, type WorldCtx } from '../../world';
import {
  BEFORE_DAIS, HALL_BLOCKS, HALL_CANDLES, HALL_OCCLUDERS, HALL_SPOT, HALL_SURFACES, HALL_WALK, hallCandleLights,
} from './schutzreaktion-saal';
import { bg, e3Scene, lia, liaLook, nextScene, sfx, TURQUOISE, ui, until } from './shared';
import { NO_LOOK } from './spuersinn';

const GM = 'grossmeister';
const CAPTAIN = 'hauptmann';
const HOLDER = 'pal-griff';
const SECOND = 'pal-links';
const SIDE_R = 'pal-rechts';
const MENTOR = 'ignatius';
const MENTOR_GUARD = 'pal-wache';
const READ_PAPERS = 'e3-sr-papiere';
const AT_DAIS = 'e3-sr-podest';

/** Lia's tone in the interrogation (e3-verhoer-ton). */
export const VERHOER_TONES = ['schweigen', 'luege', 'wut'] as const;
export type VerhoerTone = typeof VERHOER_TONES[number];

const gm = (w: WorldCtx, text: string, mood?: string) => w.say('e3-grossmeister', text, mood ? { mood } : undefined);
const captain = (w: WorldCtx, text: string) => w.say('e3-hauptmann', text);
const mentor = (w: WorldCtx, text: string, mood?: string) => w.say('e2-ignatius', text, mood ? { mood } : undefined);
/** Lines spoken over black while Lia lies unconscious (no world, only the dialogue box). */
const voice = (speaker: string, text: string, mood?: string) => G.ui.say(speaker, text, mood ? { mood } : undefined);

export const saalVerhoer: MapDef = defineMap({
  id: 'e3-ordenssaal-verhoer',
  name: 'Der Saal des Lichterordens',
  background: 'e3-ordenssaal',
  walk: HALL_WALK,
  block: HALL_BLOCKS,
  occluders: HALL_OCCLUDERS,
  surfaces: HALL_SURFACES,
  surface: 'stone',
  interactables: [
    {
      id: 'papiere', verb: 'Lesen', poly: [[110, 140], [168, 128], [172, 170], [128, 188]], radius: 34, once: false, sparkle: true,
      standAt: HALL_SPOT.table, face: 'left', when: () => !G.state.is(AT_DAIS), onInteract: readPapers,
    },
  ],
  triggers: [{ id: 'vor-podest', poly: BEFORE_DAIS }],
  lights: hallCandleLights(0.8),
  spawns: { tuer: { at: HALL_SPOT.door, dir: 'up' } },
  time: 'day',
  ambience: ['room'],
  ambienceVolume: { room: 0.7 },
  music: 'dread',
  sneak: false,
  lookMode: false,
  critters: false,
  resetOnEnter: true,
  lookBlocked: NO_LOOK.saal,
});

async function readPapers(w: WorldCtx): Promise<void> {
  if (G.state.is(READ_PAPERS)) { await w.think('Höfe, Menschen, Scheffel Korn. Und eine Zahl, die jemand größer gemacht hat.'); return; }
  G.state.set(READ_PAPERS);
  await w.think('Papiere, sauber gestapelt. Eine Liste von Höfen, daneben Zahlen: Menschen, Tiere, Scheffel Korn.');
  await w.think('Unten hat jemand eine Zahl durchgestrichen und eine größere darübergeschrieben. Mit derselben ruhigen Hand.');
  w.bark(HOLDER, 'Hände weg vom Tisch. Weiter.', 2200);
}

// ---------------------------------------------------------------------------------------------------------------
// Arrival
// ---------------------------------------------------------------------------------------------------------------

function stageHall(w: WorldCtx): void {
  const g = w.spawn({ id: GM, preset: 'e3-grossmeister', speaker: 'e3-grossmeister', at: HALL_SPOT.chair, dir: 'down', idle: 'sit', solid: false, facePlayer: false });
  g.hold(true);
  w.spawn({ id: CAPTAIN, preset: 'paladin-hauptmann', speaker: 'e3-hauptmann', at: HALL_SPOT.captain, dir: 'left', solid: false }).hold(true);
  w.spawn({ id: SECOND, preset: 'paladin-jung', speaker: 'e3-paladin-jung', at: HALL_SPOT.sideLeft, dir: 'right', solid: false }).hold(true);
  w.spawn({ id: SIDE_R, preset: 'paladin-anfuehrer', speaker: 'e3-paladin', at: HALL_SPOT.sideRight, dir: 'left', solid: false }).hold(true);
  w.spawn({ id: MENTOR, preset: 'e3-ignatius-gefesselt', speaker: 'e2-ignatius', at: [350, 352], dir: 'up', solid: false }).hold(true);
  w.spawn({ id: MENTOR_GUARD, preset: 'paladin', speaker: 'e3-paladin', at: [362, 358], dir: 'up', solid: false }).hold(true);
}

async function walkUp(w: WorldCtx): Promise<void> {
  await ui().fade('in', 1000);
  await w.cutscene(async () => {
    await w.player.walkTo(300, 300, { face: 'up' });
    await w.think('Ein Saal, in den unser ganzer Hof gepasst hätte. Zweimal. Mit Scheune.');
  });
  bg(w.actor(MENTOR).walkTo(HALL_SPOT.mentor[0], HALL_SPOT.mentor[1], { face: 'up' }));
  bg(w.actor(MENTOR_GUARD).walkTo(HALL_SPOT.mentorGuard[0], HALL_SPOT.mentorGuard[1], { face: 'up' }));
  w.setObjective('e3-sr-vortreten', 'Tritt vor den Großmeister.', [320, 196]);
  w.unlockPlayer();
  // The paladin behind her hurries her along if she dawdles.
  bg((async () => {
    let i = 0;
    while (w.alive && !G.state.is(AT_DAIS)) {
      await w.wait(8000);
      if (G.state.is(AT_DAIS) || G.ui.busy()) continue;
      w.bark(HOLDER, ['Zum Podest. Na los.', 'Der Großmeister wartet.'][i++ % 2], 2200);
    }
  })());
  await w.waitForTrigger('vor-podest');
  G.state.set(AT_DAIS);
  await until(w, () => !G.ui.busy(), 120);
  w.completeObjective('e3-sr-vortreten');
}

// ---------------------------------------------------------------------------------------------------------------
// Heart: the interrogation
// ---------------------------------------------------------------------------------------------------------------

async function interrogation(w: WorldCtx): Promise<VerhoerTone> {
  const m = w.actor(MENTOR);
  return w.cutscene(async () => {
    await w.player.walkTo(HALL_SPOT.lia[0], HALL_SPOT.lia[1], { face: 'up' });
    bg(w.actor(HOLDER).walkTo(HALL_SPOT.holder[0], HALL_SPOT.holder[1], { face: 'up' }));
    await w.camera.pan([320, 150], 700);
    await w.actor(CAPTAIN).walkTo(380, 160, { face: 'up' });
    await captain(w, 'Großmeister. Zwei vom Landweg nach Portas. Er nennt sich Händler, sie nennt sich seine Tochter.');
    await captain(w, 'Keine Ware, kein Wagen. Dafür zwei Stäbe, und einer davon ist warm, als hätte er in der Sonne gelegen.');
    await gm(w, 'Zwei Stäbe für Nadeln und Faden.', 'thinking');
    await gm(w, 'Ein Händler, eine Tochter, zwei Stäbe. Erklärt mir, wie das zusammenpasst.', 'grim');
    await mentor(w, 'Ganz einfach, Großmeister: Der Händler bin ich, die Tochter ist sie, und die Stäbe sind zum Gehen da.');
    await gm(w, 'Händler reden über Preise. Ihr redet wie einer, der das Reden dort gelernt hat, wo man dafür bezahlt wird.', 'thinking');
    await gm(w, 'Noch einmal. Wer seid ihr?', 'angry');
    await mentor(w, 'Ein Händler. Mit wunden Füßen und viel Pech an Straßensperren.', 'grim');
    w.actor(GM).face('player');
    await gm(w, 'Und du, Mädchen. Sieh mich an. Wer ist dieser Mann?', 'grim');
    const pick = await w.choose([
      '(Schweigen und auf den Läufer starren.)',
      '„Mein Vater. Er verkauft Faden, schnarcht und erzählt zu lange Geschichten. Mehr gibt es nicht.“',
      '„Einer, den Eure Leute ohne Grund gefesselt haben. Fragt doch lieber die, wer hier lügt!“',
    ]);
    const tone = VERHOER_TONES[pick];
    G.state.set('e3-verhoer-ton', tone);
    if (tone === 'schweigen') {
      w.player.face('down');
      await w.think('Nichts sagen. Nichts falsch machen. Die Vögel auf dem Läufer zählen. Es sind siebenundzwanzig.');
      await gm(w, 'Schweigen ist auch eine Antwort. Oft die ehrlichste im ganzen Saal.', 'thinking');
    } else if (tone === 'luege') {
      await gm(w, 'Schnarcht er. So.', 'thinking');
      await gm(w, 'Du lügst gut für dein Alter, Mädchen. Zu gut für eine Händlertochter.', 'grim');
    } else {
      await gm(w, 'Ohne Grund? Draußen brennen Höfe. Ich brauche keinen Grund. Ich brauche Gewissheit.', 'angry');
      m.face('player');
      await mentor(w, 'Lia. Bitte.', 'worried');
    }
    await gm(w, 'Bringt das Mädchen nach oben, Hauptmann. Allein redet es sich leichter, ohne einen Vater, der vorsagt.', 'determined');
    m.face(GM);
    await mentor(w, 'Großmeister, das ist nicht nötig. Sie ist ein Kind, sie weiß nichts …', 'worried');
    await gm(w, 'Dann wird sie mir genau das erzählen. Allein.', 'determined');
    return tone;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The grab and the Urmacht's answer
// ---------------------------------------------------------------------------------------------------------------

async function grab(w: WorldCtx): Promise<void> {
  const holder = w.actor(HOLDER), second = w.actor(SECOND);
  await w.cutscene(async () => {
    await holder.walkTo(HALL_SPOT.lia[0] - 16, HALL_SPOT.lia[1] + 6, { face: 'right' });
    sfx('swing', { volume: 0.4, pitch: 0.7 });
    w.player.face('left');
    await lia(w, 'Fasst mich nicht an!', 'scared');
    bg(w.player.play('struggle' as never, { ms: 2400 }));
    await w.wait(300);
  });
  w.lockPlayer();
  await w.cutscene(async () => {
    await w.camera.zoom(1.5, 400);
    await w.think('Ich reiße am Arm, mit allem, was ich habe. Der Griff ist wie ein Schraubstock aus Eisenhandschuh.');
    w.camera.shake(220, 0.004);
    sfx('hit', { volume: 0.4, pitch: 0.8 });
    await w.say('narrator', 'Für einen Atemzug ist ihr Arm frei. Dann greift eine zweite Hand zu, und die erste packt fester als zuvor.');
    await second.walkTo(HALL_SPOT.lia[0] + 16, HALL_SPOT.lia[1] + 4, { face: 'left', run: true });
    bg(w.player.play('struggle' as never, { ms: 2000 }));
    await lia(w, 'Lasst … mich … los!', 'scared');
    await w.camera.zoom(1, 500);
  });
}

/** Pushes an actor straight back, away from Lia, and lets it stumble. */
function knockBack(a: ActorHandle, to: readonly [number, number]): Promise<void> {
  if (!a.exists) return Promise.resolve();
  return a.walkTo(to[0], to[1], { straight: true, speed: 230 }).then(() => a.play('fall', { ms: 900 }));
}

async function urmachtAnswers(w: WorldCtx): Promise<void> {
  ui().prefetchPlate('e3-schutzreaktion');
  await w.cutscene(async () => {
    sfx('heartbeat', { volume: 0.7 });
    await w.wait(700);
    sfx('heartbeat', { volume: 0.9, pitch: 1.1 });
    const glow = w.lighting.add({ id: 'e3-schutz', at: [HALL_SPOT.lia[0], HALL_SPOT.lia[1] - 16], kind: 'urmacht', color: TURQUOISE, radius: 40, intensity: 0, always: true });
    await glow.fadeTo(1, 500);
    w.lighting.flash(TURQUOISE, 450);
    sfx('shockwave', { volume: 0.9 });
    sfx('urmacht', { volume: 0.8 });
    glow.set({ radius: 150, intensity: 1.4 });
    w.camera.shake(700, 0.008);
    w.fx.burst('player', 'urmacht', 32);
    bg(knockBack(w.actor(HOLDER), [234, 262]));
    bg(knockBack(w.actor(SECOND), [250, 150]));
    bg(knockBack(w.actor(SIDE_R), [470, 196]));
    bg(knockBack(w.actor(MENTOR_GUARD), [430, 270]));
    bg(knockBack(w.actor(CAPTAIN), [470, 140]));
    void w.actor(GM).emote('!');
    // The candles bow and go out, one after the other.
    HALL_CANDLES.forEach((at, i) => {
      bg((async () => {
        await w.wait(120 + i * 110);
        void w.lighting.get(`e3-kerze-${i}`).fadeTo(0, 260);
        w.fx.burst(at, 'smoke', 4);
      })());
    });
    bg(w.lighting.set('dusk', 900));
    await w.wait(1100);
    await G.ui.plate('e3-schutzreaktion', { caption: 'Was in ihr wohnt', pan: 'in', durationMs: 30000 });
    await w.say('narrator', 'Es kam nicht aus ihren Händen. Es kam von überall in ihr: ~türkis~, kalt und hell, wie Wind durch eine aufgestoßene Tür.');
    await w.say('narrator', 'Die Paladine stolperten zurück. Die Kerzen bogen sich, eine nach der anderen, und gingen aus.');
    await w.say('narrator', 'Der Großmeister hob den Arm vor die Augen. Nur Ignatius sah nicht weg.');
    await G.ui.closePlate();
    void glow.fadeTo(0, 900);
    sfx('fall', { volume: 0.6 });
    bg(w.player.play('fall'));
    w.player.setIdle('lie');
    await w.wait(900);
    await w.think('Ich wollte doch nur meinen Arm zurück.');
  });
  w.lockPlayer();
  await ui().fade('out', 1800);
}

// ---------------------------------------------------------------------------------------------------------------
// Black: voices only
// ---------------------------------------------------------------------------------------------------------------

async function voicesInTheDark(): Promise<void> {
  await G.ui.narrate(['Stimmen. Weit weg, als läge Wasser zwischen ihr und der Welt.'], { style: 'card' });
  await voice('e3-grossmeister', 'Hauptmann? Was … Licht! Jemand soll Licht machen!', 'surprised');
  await voice('e3-hauptmann', 'Drei Mann am Boden, Großmeister. Keiner verletzt. Nur … weggeweht.');
  await voice('e3-grossmeister', 'Ein Händler und seine Tochter. So nennt Ihr das?', 'angry');
  await voice('e2-ignatius', 'Nein. So habe ich es Euch verkauft. Lasst sie liegen und atmen, dann sage ich Euch, was sie ist.', 'worried');
  await voice('e2-ignatius', 'Ich bin Ignatius von Ignis. Ich saß im Rat der Zehn, bis es keinen Rat mehr gab.', 'grim');
  await voice('e3-grossmeister', 'Ignatius. Ich dachte, Ihr wärt längst irgendwo im Wald verrottet.', 'surprised');
  await voice('e2-ignatius', 'Beinahe. Das Mädchen trägt die ~Urmacht~. Seit Dunkelhain. Seit sie in der Wiege lag.');
  await voice('e3-grossmeister', 'Die Urmacht. In einem Mädchen, das auf meinem Teppich liegt.', 'thinking');
  await voice('e3-grossmeister', 'Wisst Ihr, was die Dunkelschatten mit so etwas anrichten würden? Sie bleibt hier. Hinter unseren Mauern.', 'determined');
  await voice('e2-ignatius', 'Was Ihr eben gesehen habt, war keine Drohung. Das war eine Tür, die zuschlägt, wenn man sich dagegenwirft.', 'thinking');
  await voice('e2-ignatius', 'Treibt man die Urmacht in die Enge, wehrt sie sich. Für sich selbst und für die, die sie trägt.');
  await voice('e3-grossmeister', 'Dann treiben wir sie nicht. Hauptmann, holt den Doktor. Er soll sie sich ansehen, gründlich und ohne Hast.');
  await voice('e3-hauptmann', 'Sofort, Großmeister.');
  await voice('e3-grossmeister', 'Und Ihr geht jetzt, Ignatius. Ihr habt für heute genug erklärt.', 'grim');
  await voice('e2-ignatius', 'Nein. Ich bleibe, bis sie die Augen aufmacht. Das bin ich ihr schuldig.', 'determined');
  await voice('e3-grossmeister', 'Ihr habt sie mit einer Lüge in meine Stadt gebracht. Bedingungen stellt Ihr heute keine mehr.', 'grim');
  await voice('e3-grossmeister', 'Niemand krümmt ihr ein Haar. Der Doktor sieht sie sich an, mehr nicht. Darauf habt Ihr mein Wort.');
  await voice('e2-ignatius', '… Ich werde Euch an dieses Wort erinnern. Jeden Tag, wenn es sein muss.', 'grim');
  await G.ui.narrate(['Schritte, die sich entfernten. Eine Tür. Dann nichts mehr.'], { style: 'card' });
}

async function saalScript(w: WorldCtx): Promise<void> {
  for (const f of [READ_PAPERS, AT_DAIS]) G.state.set(f, false);
  w.lockPlayer();
  stageHall(w);
  await walkUp(w);
  await interrogation(w);
  await grab(w);
  await urmachtAnswers(w);
  await voicesInTheDark();
  G.state.set('e3-schutz-ausgeloest');
  await nextScene('e3-macht-und-schutz');
}

export const scene = e3Scene('e3-schutzreaktion', 'Was in ihr wohnt', async () => {
  await ui().fade('out', 0);
  await startWorld({
    map: saalVerhoer, spawn: 'tuer', player: liaLook({ bound: true }), fadeIn: false, script: saalScript,
    companions: [{ id: HOLDER, preset: 'paladin-wache', speaker: 'e3-paladin-wache' }],
  });
});
