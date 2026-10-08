// Scene „e2-der-fremde“ – Der Fremde (docs/teil-2/umsetzung.md §3, F2 12:25–13:35). Dusk at the hermit's clearing.
// Heart (limited agency): Lia opens her eyes (story gesture), gets up and staggers towards the paths – slow, uneven
// steps; her knees give way at most twice, then the stranger helps her to the fire (or she sits down with him on
// her own). A cup of willow-bark tea (lift gesture, explicitly no magic), the questions he dodges („später“) while
// he hints at something larger, and his small amber sleep gesture. Lia alone from now on; she knows nothing about
// the prisoners. → e2-gefangene.
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { halt } from '../kapitel-4/shared';
import { restageGesture } from './gewoelbe-geste';
import { IG_EDGE, IG_SPOT, igFireLight, igLanternLight, ignatiusBase } from './ignatius-lager';
import { AMBER, bg, e2Scene, lia, liaLook, mentor, sfx, ui, until, nextScene } from './shared';

const STRANGER = 'fremder';
const SEAT: [number, number] = [620, 418];

export const fremderLager: MapDef = defineMap({
  ...ignatiusBase,
  id: 'e2-fremder-lager',
  name: 'Eine Lichtung im Wald',
  npcs: [{
    id: STRANGER, preset: 'e2-ignatius', speaker: 'e2-fremder', at: IG_SPOT.mentorSeat, dir: 'left', idle: 'sit',
    verb: 'Reden', talk: talkStranger, barks: ['Hmhm-hmm …', 'Langsam.', 'Der Tee wird nicht wärmer.'], barkEvery: 12000,
  }],
  props: [{ id: 'buecher', prop: 'bookstack', at: [702, 252], collide: false }],
  interactables: [
    { id: 'buecher', verb: 'Ansehen', at: [702, 252], radius: 26, once: false, onInteract: books },
    { id: 'eimer', verb: 'Wasser schöpfen', at: IG_SPOT.bucket, radius: 26, once: false, onInteract: bucket },
    { id: 'holz', verb: 'Ansehen', poly: [[836, 214], [930, 214], [930, 292], [836, 292]], radius: 18, once: false, onInteract: firewood },
  ],
  triggers: [
    { id: 'pfad-sued', poly: [[700, 536], [812, 524], [818, 566], [708, 578]], once: false, onEnter: tryToLeave },
    { id: 'pfad-ost', poly: [[990, 390], [1012, 392], [1012, 446], [990, 440]], once: false, onEnter: tryToLeave },
  ],
  exits: [
    { id: 'weg-sued', poly: IG_EDGE.south, to: 'e2-fremder-lager', spawn: 'bed', when: () => false, blocked: 'Weiter komme ich nicht. Nicht heute.' },
    { id: 'weg-ost', poly: IG_EDGE.east, to: 'e2-fremder-lager', spawn: 'bed', when: () => false, blocked: 'Weiter komme ich nicht. Nicht heute.' },
  ],
  lights: [igFireLight(1, 1), igLanternLight(0.8)],
  time: 'dusk',
  ambience: ['stream', 'fire', 'crickets', 'wind'],
  ambienceVolume: { stream: 0.55, fire: 0.6, crickets: 0.5, wind: 0.3 },
  music: 'refuge',
  playerLight: 34,
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// Unsteady legs
// ---------------------------------------------------------------------------------------------------------------

interface PlayerBody { walkSpeed: number; runSpeed: number; vx: number; vy: number }

/** Slow, uneven steps with a slight sway and a short stumble now and then. Returns the cleanup. */
function staggerWalk(w: WorldCtx): () => void {
  const p = (w.scene as unknown as { player?: PlayerBody }).player;
  if (!p) return () => {};
  const base = p.walkSpeed;
  const reduced = G.settings.reducedMotion;
  let t = 0, stumble = 0, nextStumble = 2.4;
  const onUpdate = (_time: number, delta: number) => {
    if (!w.alive) return;
    const dt = delta / 1000;
    t += dt;
    const moving = Math.hypot(p.vx, p.vy) > 4;
    if (moving) nextStumble -= dt;
    if (nextStumble <= 0) { stumble = 0.32; nextStumble = 2.2 + ((t * 7.3) % 1.4); }
    stumble = Math.max(0, stumble - dt);
    const gait = 0.4 + 0.12 * Math.sin(t * 4.1) + 0.05 * Math.sin(t * 9.7);
    p.walkSpeed = base * (stumble > 0 ? 0.12 : gait);
    p.runSpeed = p.walkSpeed;
    const sprite = w.player.sprite;
    if (sprite) sprite.setAngle(moving && !reduced ? Math.sin(t * 5.2) * 4 + (stumble > 0 ? 5 : 0) : 0);
  };
  w.scene.events.on('update', onUpdate);
  const stop = () => {
    w.scene.events.off('update', onUpdate);
    p.walkSpeed = base * 0.4;
    p.runSpeed = p.walkSpeed;
    w.player.sprite?.setAngle(0);
  };
  w.scene.events.once('shutdown', stop);
  return stop;
}

// ---------------------------------------------------------------------------------------------------------------
// Waking up
// ---------------------------------------------------------------------------------------------------------------

async function wake(w: WorldCtx): Promise<void> {
  const s = w.actor(STRANGER);
  s.hold(true);
  s.setIdle('sit');
  w.player.setIdle('lie');
  w.lockPlayer();
  await w.camera.pan(IG_SPOT.bed, 0);
  await w.camera.zoom(1.35, 0);
  await G.ui.narrate(['Wasser rauscht. Holz knackt. Irgendwer summt, falsch und sehr zufrieden.'], { style: 'card' });
  const wake = G.ui.storyAction('open-eyes', 'Die Augen öffnen');
  restageGesture('open-eyes', 'Schieb die schweren Lider langsam nach oben.');
  await wake;
  await ui().fade('in', 1600);
  await w.cutscene(async () => {
    await w.think('Ein Dach aus Ästen. Felle unter mir. Es riecht nach Rauch und … Minze?');
    await w.think('Der Bach. Kyras Stimme. Sie hat geschrien, dass ich laufen soll. Danach ist alles schwarz.');
    w.player.setIdle('kneel');
    await w.wait(600);
    await lia(w, 'Kyra? … Flick?', 'scared');
    await w.camera.zoom(1, 1200);
    await w.camera.pan(s.id, 900);
    await w.say(mentor(), 'Du hast im Schlaf nach ihnen gerufen. Oft. Ich fürchte, hier antwortet dir nur ich.');
    await w.camera.pan(IG_SPOT.bed, 700);
    w.player.setIdle('idle');
    await lia(w, 'Ich muss zurück. Sie brauchen mich.', 'determined');
    await w.say(mentor(), 'Dann geh. Der Pfad liegt im Süden. Deine Beine werden dir ihre Meinung dazu sagen.');
  });
  w.camera.follow();
  w.unlockPlayer();
  s.hold(false);
}

// ---------------------------------------------------------------------------------------------------------------
// Trying to leave: the knees give way, twice at most
// ---------------------------------------------------------------------------------------------------------------

async function tryToLeave(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-fremder-sitzt') || G.state.is('e2-fremder-knie-busy')) return;
  G.state.set('e2-fremder-knie-busy');
  const n = G.state.inc('e2-fremder-versuche');
  let seated = false;
  await w.cutscene(async () => {
    sfx('fall', { volume: 0.6 });
    await w.player.play('kneel', { ms: 500 });
    w.player.setIdle('kneel');
    w.camera.shake(220, 0.003);
    if (n === 1) {
      await w.think('Meine Knie knicken weg, als hätte jemand die Fäden durchgeschnitten.');
      await w.say(mentor(), 'Wenn ich deine Sohlen richtig lese, bist du gerannt, bis nichts mehr übrig war. Das holt man nicht in einer Stunde nach.');
      await lia(w, 'Ich … steh schon wieder.', 'determined');
      w.player.setIdle('idle');
      const back = w.player.y > 480 ? [w.player.x - 14, w.player.y - 38] as [number, number] : [w.player.x - 40, w.player.y - 6] as [number, number];
      await w.player.walkTo(back[0], back[1]);
      return;
    }
    await w.think('Noch einmal. Ich befehle meinen Beinen. Sie lachen mich aus.');
    const s = w.actor(STRANGER);
    s.hold(true);
    s.setIdle('idle');
    await s.walkTo(w.player.x + 30, w.player.y - 4);
    s.face('player');
    await w.say(mentor(), 'Ich mache dir einen Vorschlag. Erst Tee, dann Heldentaten.');
    await lia(w, 'Ich bin keine Heldin. Ich bin nur die, die weggelaufen ist.', 'sad');
    await w.say(mentor(), 'Dann ist die, die weggelaufen ist, jetzt sehr müde. Stütz dich auf. Ich bin alt, aber ich falle nicht um.');
    w.player.setIdle('idle');
    await Promise.all([w.player.walkTo(SEAT[0], SEAT[1], { face: 'up' }), s.walkTo(IG_SPOT.mentorSeat[0], IG_SPOT.mentorSeat[1], { face: 'left' })]);
    s.setIdle('sit');
    seated = true;
  });
  G.state.set('e2-fremder-knie-busy', false);
  // Set after the cutscene returned the HUD, so the tea scene's own cutscene starts cleanly.
  if (seated) G.state.set('e2-fremder-sitzt');
}

async function talkStranger(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-fremder-sitzt')) return;
  await w.say(mentor(), 'Setz dich. Das Feuer beißt nicht, und ich nur sehr selten.');
  const pick = await w.choose(['Hinsetzen.', '„Erst finde ich den Weg.“']);
  if (pick === 1) {
    await w.say(mentor(), 'Nur zu. Ich halte den Tee warm. Er hat Zeit, ich auch.');
    return;
  }
  G.state.set('e2-fremder-freiwillig');
  await w.cutscene(async () => {
    await w.player.walkTo(SEAT[0], SEAT[1], { face: 'up' });
  });
  G.state.set('e2-fremder-sitzt');
}

// ---------------------------------------------------------------------------------------------------------------
// Optional looks (Lia reads the place even with swimming eyes)
// ---------------------------------------------------------------------------------------------------------------

async function books(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-fremder-buecher')) { await w.think('Die Buchstaben schwimmen immer noch. Später.'); return; }
  G.state.set('e2-fremder-buecher');
  await w.player.play('kneel', { ms: 500 });
  await w.think('Bücher! Hier draußen, unter einem Dach aus Ästen. Ledereinbände, abgegriffen wie Vaters Sattel.');
  await w.think('Ich schlage eins auf. Die Buchstaben schwimmen davon wie Kaulquappen. Zum ersten Mal im Leben kann ich nicht lesen.');
}

async function bucket(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-fremder-eimer')) { await w.think('Noch eine Hand voll Wasser. Hilft nicht mehr als die erste.'); return; }
  G.state.set('e2-fremder-eimer');
  sfx('splash', { volume: 0.5 });
  w.fx.burst(IG_SPOT.bucket, 'splash', 6);
  await w.think('Kaltes Wasser im Gesicht. Jetzt ist mein Kopf wach. Nur meine Beine schlafen weiter.');
}

async function firewood(w: WorldCtx): Promise<void> {
  await w.think('So viel Holz. Wer hier wohnt, rechnet mit einem langen Winter. Oder mit langem Besuch.');
}

// ---------------------------------------------------------------------------------------------------------------
// The cup, the questions, the amber gesture
// ---------------------------------------------------------------------------------------------------------------

async function teaAndQuestions(w: WorldCtx): Promise<void> {
  const s = w.actor(STRANGER);
  s.hold(true);
  await w.cutscene(async () => {
    w.player.teleport(SEAT, 'up');
    w.player.setIdle('sit');
    s.face('player');
    await w.wait(400);
    if (G.state.is('e2-fremder-freiwillig') && !G.state.flag('e2-fremder-versuche')) {
      await w.say(mentor(), 'Kluge Beine. Die meisten probieren erst, wie hart der Boden ist.');
    }
    await w.say(mentor(), 'Trink. Weidenrinde, Minze, ein Löffel Honig. Kein Zauber, nur heißes Wasser mit Geduld.');
    await G.ui.storyAction('lift', 'Den Becher an die Lippen heben', { help: 'Heb den Becher langsam an. Die Hände zittern noch.', illustration: false });
    sfx('eat', { volume: 0.3 });
    await lia(w, 'Bitter. Und süß. Wie Mutters Hustensaft.', 'thinking');
    await w.say(mentor(), 'Gute Mütter verstecken das Bittere im Süßen. Damit man trinkt, ohne es zu merken.');
    await w.think('Seine Augen sind älter als sein Gesicht. Er sieht mich an wie eine Seite, die er schon einmal gelesen hat.');

    const asked = new Set<string>();
    const required = ['wer', 'freunde', 'warum'];
    for (let guard = 0; guard < 12; guard++) {
      const opts: { id: string; text: string }[] = [
        { id: 'wer', text: '„Wem gehört dieses Feuer?“' },
        { id: 'freunde', text: '„Wo sind Kyra und Flick?“' },
        { id: 'weg', text: '„Wie bin ich hierhergekommen?“' },
        { id: 'warum', text: '„Warum helft Ihr mir?“' },
        ...(G.state.is('e2-fremder-buecher') ? [{ id: 'buecher', text: '„Die Bücher in Eurem Unterstand …“' }] : []),
      ].filter(o => !asked.has(o.id));
      if (required.every(id => asked.has(id))) opts.push({ id: 'los', text: '„Danke für den Tee. Aber ich gehe jetzt.“' });
      const pick = opts[await w.choose(opts.map(o => o.text))];
      if (pick.id === 'los') break;
      asked.add(pick.id);
      await answer(w, pick.id);
    }
    G.state.set('e2-fremder-fragen', [...asked].join(','));
    await sleepGesture(w);
  });
}

async function answer(w: WorldCtx, id: string): Promise<void> {
  const say = (text: string, mood?: string) => w.say(mentor(), text, mood ? { mood } : undefined);
  switch (id) {
    case 'wer':
      await say('Mir, solange es keiner merkt. Einem alten Mann mit zu vielen Erinnerungen. Mehr, wenn du nicht mehr schwankst.');
      await lia(w, 'Ich schwanke nicht.');
      await say('Du sitzt. Und schwankst trotzdem.', 'happy');
      return;
    case 'freunde':
      await say('Ich habe dich am Bach gefunden. Allein, mit nassen Schuhen und einem Namen auf den Lippen.');
      await lia(w, 'Das Lager wurde überfallen. Kyra ist zurückgeblieben, damit ich weglaufe. Ich muss wissen, was …', 'sad');
      await say('Ich weiß es nicht. Was ich vermute, sage ich dir später. Nicht heute Abend.', 'worried');
      return;
    case 'weg':
      await say('Getragen. Du wiegst weniger als ein Arm voll Brennholz. Beschwerst dich allerdings mehr.', 'happy');
      return;
    case 'warum':
      await say('Weil man niemanden im Bach liegen lässt. Und weil das, was dir geschieht, weit über diesen Wald hinausreicht.');
      await lia(w, 'Ich bin vom Hof. Bis vor ein paar Wochen war hinter unserem Wald die Welt zu Ende.', 'thinking');
      await say('Manche Lichter sieht man sehr weit. Sogar von hier aus.', 'thinking');
      await lia(w, 'Was meint Ihr damit?');
      await say('Später.');
      return;
    case 'buecher':
      await say('Die letzten aus einer Zeit, in der ich Regale hatte. Lies sie, wenn die Buchstaben wieder stillhalten.');
      return;
  }
}

async function sleepGesture(w: WorldCtx): Promise<void> {
  const s = w.actor(STRANGER);
  w.player.setIdle('kneel');
  await lia(w, 'Kyra würde nicht sitzen bleiben. Und ich bleibe es auch nicht.', 'determined');
  s.setIdle('idle');
  s.face('player');
  await w.say(mentor(), 'Ich glaube dir. Genau deshalb tue ich jetzt etwas, das du mir übelnehmen wirst.', { mood: 'sad' });
  const hand: [number, number] = [s.x - 8, s.y - 30];
  const glow = w.lighting.add({ id: 'e2-bernstein', at: hand, kind: 'plain', color: AMBER, radius: 70, intensity: 0, always: true });
  bg(s.play('cast', { ms: 2400 }));
  sfx('magic', { volume: 0.35, pitch: 0.8 });
  await glow.fadeTo(1, 900);
  w.fx.burst(hand, 'sparkle', 10);
  await w.think('Bernstein. Warm wie Honig in der Sonne. Ganz anders als das, was aus mir gekommen ist.');
  await lia(w, 'Was … macht Ihr …', 'scared');
  w.lighting.flash(AMBER, 500);
  bg(glow.fadeTo(0.4, 1400));
  await w.say(mentor(), 'Schlaf. Morgen reden wir. Das verspreche ich dir.');
  bg(w.player.play('lie'));
  w.player.setIdle('lie');
  await w.wait(700);
  await ui().fade('out', 1800);
  glow.remove();
  await G.ui.narrate(['Und Lia schlief, tief und ohne Gegenwehr, zum ersten Mal seit dem Hof.'], { style: 'card' });
}

// ---------------------------------------------------------------------------------------------------------------

async function fremderScript(w: WorldCtx): Promise<void> {
  G.state.set('e2-fremder-versuche', 0);
  G.state.set('e2-fremder-sitzt', false);
  G.state.set('e2-fremder-knie-busy', false);
  await wake(w);
  const steady = staggerWalk(w);
  // Marker on the path where it leaves the clearing (inside 'pfad-sued'), not further south past the trigger.
  w.setObjective('e2-fremder-pfad', 'Zurück zu Kyra und Flick: Finde den Weg aus der Lichtung.', [762, 552]);
  await until(w, () => G.state.is('e2-fremder-sitzt'));
  steady();
  w.completeObjective('e2-fremder-pfad');
  await teaAndQuestions(w);
  G.state.set('e2-fremder-done');
  halt(w, [STRANGER]);
  await nextScene('e2-gefangene');
}

export const scene = e2Scene('e2-der-fremde', 'Der Fremde', async () => {
  await ui().fade('out', 0); // opens on black: only sounds, then the eyes open
  await startWorld({ map: fremderLager, spawn: 'bed', player: liaLook(), companions: [], fadeIn: false, script: fremderScript });
});
