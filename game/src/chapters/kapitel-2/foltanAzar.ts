// Kapitel II, Szene 3 `foltan-azar`: Nachts auf der Lichtung. Schritte, Lia wird geweckt (nicht gefesselt, Vorgabe
// des Nutzers), ein bedrohliches Missverständnis mit Auswahl und Lias trockenem Humor, der Kodex, „Versprechen können
// wir dir nichts“. Danach schnarcht Azar, Lia findet Crios im Westen (Sternbild-Moment), Schnitt zu Kyra im Stall.
import { registerSpeakers } from '../../core/catalog';
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { addCampfire, LAGER_OCCLUDERS, LAGER_WALK, SPOT } from './lager';
import { bg, gotoNext, sfx, sleep, ui } from './shared';
import { findCrios } from './sterne';

registerSpeakers([
  { id: 'k2-stimme-a', name: 'Eine Stimme', portrait: 'k2-unbekannt', voice: { pitch: 105, wave: 'square' }, color: '#9a8a70' },
  { id: 'k2-stimme-b', name: 'Eine andere Stimme', portrait: 'k2-unbekannt', voice: { pitch: 150, wave: 'triangle' }, color: '#8a9ab0' },
]);

export const lagerNacht: MapDef = defineMap({
  id: 'k2-lager-nacht',
  name: 'Die Lichtung',
  background: 'k2-lager',
  baked: 'dusk',
  walk: [LAGER_WALK],
  occluders: LAGER_OCCLUDERS,
  surface: 'forest',
  depthScale: { y0: 100, s0: 0.96, y1: 360, s1: 1.04 },
  resetOnEnter: true,
  props: [
    { prop: 'cloak-spread', id: 'mantel', at: [SPOT.bed[0], SPOT.bed[1] + 4], collide: false, depthOffset: -30 },
  ],
  npcs: [
    { id: 'foltan', preset: 'foltan', at: [120, 330], dir: 'up', hidden: true, solid: false, verb: 'Ansprechen', talk: w => talkDuringBicker(w) },
    { id: 'azar', preset: 'azar', at: [140, 350], dir: 'up', hidden: true, solid: false, verb: 'Ansprechen', talk: w => talkDuringBicker(w) },
  ],
  triggers: [
    { id: 'flucht', once: true, poly: [[98, 290], [168, 290], [168, 360], [98, 360]], when: () => G.state.is('k2-streit'), onEnter: w => caught(w) },
  ],
  spawns: { bett: { at: SPOT.bed, dir: 'right' } },
  time: 'night',
  weather: 'none',
  ambience: ['night', 'crickets', 'fire'],
  ambienceVolume: { fire: 0.35, night: 0.7 },
  music: null,
  playerLight: 40,
});

// ---------------------------------------------------------------------------------------------------------------

const lia = (w: WorldCtx, text: string, mood?: string) => w.say('k2-lia', text, { mood });

export async function foltanAzarSkript(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan'), azar = w.actor('azar');
  ui().prefetchPlate('k2-geweckt');
  ui().prefetchPlate('k2-kyra-stall');
  addCampfire(w, 0.35);
  w.player.teleport(SPOT.bed, 'right');
  w.player.setIdle('lie');
  w.lockPlayer();
  G.ui.setHud('cinematic');
  // Black screen: only sounds and voices.
  await ui().fade('out', 0);
  await sleep(900);
  for (const d of [0.9, 0.75, 0.6]) { sfx('step-dirt', { distance: d, volume: 0.8 }); await sleep(420); }
  sfx('branch-snap', { distance: 0.4 });
  await sleep(700);
  for (const d of [0.4, 0.3, 0.2]) { sfx('step-dirt', { distance: d }); await sleep(360); }
  await w.say('narrator', 'Schritte. Ganz nah.');
  await w.say('k2-stimme-a', '„Ist sie tot?“');
  await w.say('k2-stimme-b', '„Nein. Sie hat noch Puls.“');
  await w.say('k2-stimme-a', '„Was macht denn ein junges Mädchen allein in der Wildnis?“');
  await w.say('k2-stimme-b', '„Woher soll ich das wissen, du Ochse?“');
  await w.say('k2-stimme-a', '„Das war eine rhetorische Frage. Kein Grund, ausfallend zu werden.“');
  await w.say('narrator', 'Jemand hält Lias Handgelenk. Das ist kein Traum.');
  await G.ui.storyAction('open-eyes', 'Augen öffnen', { backdrop: 'k2-geweckt', caption: 'Zwei Männer und eine Laterne. Über mir.' });

  // Stage the two men over Lia, then the painted tableau.
  foltan.teleport([SPOT.bed[0] - 26, SPOT.bed[1] + 18], 'right');
  azar.teleport([SPOT.bed[0] - 50, SPOT.bed[1] + 30], 'right');
  foltan.show(); azar.show();
  foltan.setIdle('kneel');
  const lantern = w.lighting.add({ id: 'azar-laterne', at: [SPOT.bed[0] - 50, SPOT.bed[1] + 6], kind: 'lantern', radius: 70, intensity: 1, always: true });
  await G.ui.plate('k2-geweckt', { pan: 'in', durationMs: 20000 });
  await ui().fade('in', 400);
  sfx('alert');
  await lia(w, 'Aaaah!', 'scared');
  await w.say('azar', 'Aaaaah!', { mood: 'surprised' });
  await lia(w, 'AAAAAH!', 'scared');
  await w.say('azar', 'AAAAAAAH!', { mood: 'surprised' });
  await w.say('narrator', 'Der Schmale presst Lia die Hand auf den Mund.');
  await w.say('foltan', 'Psst! Wir wollen dir nichts tun.', { mood: 'worried' });
  await w.say('foltan', 'Ich nehme die Hand jetzt weg. Dann bist du still. Einverstanden?');
  const hasDagger = G.state.has('dagger');
  const p = await w.choose([
    'Nicken.',
    'In die Hand beißen.',
    { text: 'Nach Vaters Dolch tasten.', disabled: !hasDagger, reason: 'Kein Dolch im Beutel.', tag: hasDagger ? 'Dolch' : undefined },
  ]);
  if (p === 0) {
    await w.say('foltan', 'Braves Mädchen.');
    await w.think('Braves Mädchen? Ich bin doch kein Hund.');
  } else if (p === 1) {
    sfx('hit', { volume: 0.5 });
    G.state.inc('k2-foltan-respekt');
    await w.say('foltan', 'Au! Bei allen Zehn …!', { mood: 'angry' });
    await w.say('azar', 'Ha! Die hat Zähne!', { mood: 'happy' });
    await w.say('foltan', 'Na schön. Das hab ich wohl verdient.');
  } else {
    G.state.set('k2-dolch-gezogen');
    await w.say('foltan', 'Ruhig, Mädchen. Ich sehe, dass du zustechen würdest. Aber ich bin nicht der, den du suchst. Und deine Hand zittert.');
    await w.think('Ja, sie zittert. Aber ich habe schon einmal im Gebüsch gesessen und nichts getan. Nie wieder.');
  }
  await w.say('foltan', 'Und du hältst jetzt auch die Klappe, ja?', { mood: 'angry' });
  await w.say('azar', '’Tschuldige. Du weißt doch, dass ich schreckhaft bin.', { mood: 'worried' });
  await w.say('foltan', 'Dank dir weiß jetzt der halbe Wald, wo wir sind.');
  await w.say('azar', 'Kann ja nicht jeder Nerven aus Draht haben wie der feine Herr Foltan.', { mood: 'angry' });
  await G.ui.closePlate();

  // A short playable beat while they bicker: sneak away … or stay.
  foltan.setIdle('idle');
  foltan.teleport([SPOT.bed[0] - 70, SPOT.bed[1] + 26], 'left');
  azar.teleport([SPOT.bed[0] - 110, SPOT.bed[1] + 28], 'right');
  lantern.set({ at: [SPOT.bed[0] - 110, SPOT.bed[1] + 6] });
  w.player.setIdle('idle');
  w.player.teleport([SPOT.bed[0] - 10, SPOT.bed[1] + 10], 'down');
  G.ui.setHud('explore');
  w.unlockPlayer();
  G.state.set('k2-streit');
  w.setObjective('k2-nacht-flucht', 'Schleich dich davon, solange sie streiten. Oder bleib.', SPOT.path);
  await w.say('narrator', `Die beiden streiten. Halte ${w.controlHint('sneak')} gedrückt, um zu schleichen. Oder sprich sie an.`);
  const bicker: [string, string][] = [
    ['foltan', 'Meine Ausbildung rettet dir ständig den Hintern!'],
    ['azar', 'Einmal! Und das war ein Wildschwein!'],
    ['foltan', 'Ein sehr großes Wildschwein.'],
    ['azar', 'Der feine Herr, immer so überlegen …'],
    ['foltan', 'Ich bin nicht überlegen. Ich habe recht.'],
    ['azar', 'Das ist dasselbe, nur lauter!'],
  ];
  for (let i = 0; i < bicker.length && G.state.is('k2-streit'); i++) {
    w.bark(bicker[i][0], bicker[i][1], 2600);
    await sleep(2800);
  }
  await w.wait(400);
  // Caught on the path or talked to them: that handler continues the scene.
  if (!G.state.is('k2-streit') || G.state.is('k2-verhoer')) return;
  bg(azar.emote('!', 900));
  await w.say('azar', 'Sieh mal, sie ist ja wach. Und brav sitzen geblieben.');
  await interrogation(w);
}

/** Talking to either of them ends the bickering beat. Later: short lines. */
async function talkDuringBicker(w: WorldCtx): Promise<void> {
  if (!G.state.is('k2-streit') || G.state.is('k2-verhoer')) {
    await w.say('foltan', 'Schlaf jetzt. Morgen wird ein langer Tag.');
    return;
  }
  G.state.set('k2-angesprochen');
  G.state.set('k2-streit', false);
  bg(w.actor('foltan').emote('?', 800));
  await lia(w, 'Seid ihr fertig? Manche Leute wollen hier schlafen.', 'angry');
  await w.say('azar', 'Ha! Da hat sie dich, Foltan.', { mood: 'happy' });
  G.state.inc('k2-azar-mag');
  await interrogation(w);
}

async function caught(w: WorldCtx): Promise<void> {
  if (G.state.is('k2-verhoer') || G.state.is('k2-gefangen')) return;
  G.state.set('k2-gefangen');
  G.state.set('k2-streit', false);
  G.state.set('k2-fluchtversuch');
  const sneaking = w.stealth.hidden;
  await w.cutscene(async () => {
    bg(w.actor('azar').emote('!', 900));
    await w.say('azar', 'He! Sieh mal, die Kleine haut ab!', { mood: 'surprised' });
    await w.actor('foltan').walkTo([w.player.x + 10, w.player.y - 16], { run: true });
    w.actor('foltan').face('player');
    if (sneaking) {
      G.state.inc('k2-foltan-respekt');
      await w.say('foltan', 'Nicht schlecht. Leise wie eine Katze. Aber nicht leise genug.');
    } else {
      await w.say('foltan', 'Wohin so eilig? Im Dunkeln, ohne Feuer, mit Wölfen im Wald?');
    }
    await lia(w, 'Lasst mich los! Ich hab euch nichts getan!', 'angry');
    await w.say('foltan', 'Ich halte dich nicht fest. Ich bitte dich nur: Setz dich. Wir reden.');
    await w.player.walkTo([SPOT.bed[0] - 20, SPOT.bed[1] + 12]);
    await w.actor('foltan').walkTo([SPOT.bed[0] - 70, SPOT.bed[1] + 26]);
  });
  await interrogation(w);
}

async function interrogation(w: WorldCtx): Promise<void> {
  if (G.state.is('k2-verhoer')) return;
  G.state.set('k2-verhoer');
  G.state.set('k2-streit', false);
  w.completeObjective('k2-nacht-flucht');
  const foltan = w.actor('foltan'), azar = w.actor('azar');
  await w.cutscene(async () => {
    await w.player.walkTo([SPOT.bed[0] - 16, SPOT.bed[1] + 10]);
    w.player.face('left');
    w.player.setIdle('sit');
    // Gather at the embers: Foltan squats facing her, Azar holds the lantern behind him.
    await Promise.all([foltan.walkTo([SPOT.bed[0] - 62, SPOT.bed[1] + 18]), azar.walkTo([SPOT.bed[0] - 96, SPOT.bed[1] + 4])]);
    foltan.face('player'); azar.face('player');
    try { w.lighting.get('azar-laterne').set({ at: [SPOT.bed[0] - 96, SPOT.bed[1] - 16] }); } catch { /* no lantern */ }
    await w.camera.pan([SPOT.bed[0] - 50, SPOT.bed[1] + 6], 700);
    await w.camera.zoom(1.35, 900);
    await w.say('foltan', 'Also. Vielleicht hilft es, wenn wir uns vorstellen. Ich bin Foltan, einst Leutnant der Stadtgarde von Portas.');
    await w.say('foltan', 'Und die beleidigte Leberwurst hinter mir ist Azar. Ein Schmied aus Ignis.');
    await w.say('azar', 'Beleidigte Leberwurst. Das merke ich mir, feiner Herr.', { mood: 'angry' });
    await w.say('foltan', 'Jetzt du. Wer bist du, und was machst du hier draußen?');
    const p1 = await w.choose(['„Ihr zuerst. Was macht *ihr* nachts im Wald?“', '„Ich habe geschlafen. Bis eben.“', 'Schweigen.']);
    if (p1 === 0) {
      G.state.inc('k2-foltan-respekt');
      await w.say('foltan', 'Sieh an. Vorlaut ist sie auch noch.', { mood: 'surprised' });
      await w.say('foltan', 'Wir tun Dinge, die nichts für Kinder sind. Belassen wir es dabei.');
      await lia(w, 'Ich bin kein Kind. Und wenn ihr nicht antwortet, antworte ich auch nicht.', 'determined');
    } else if (p1 === 1) {
      G.state.inc('k2-azar-mag');
      bg(azar.emote('note', 900));
      await w.say('azar', 'Ha! Da hat sie dich, Foltan.', { mood: 'happy' });
      await w.say('foltan', 'Sehr witzig. Ihr zwei solltet zusammen auf dem Jahrmarkt auftreten.');
    } else {
      bg(foltan.emote('…', 900));
      await w.say('foltan', 'Schön. Dann halt deinen Mund.');
    }
    await w.say('azar', 'Ich trau ihr nicht. Stille Wasser sind tief.', { mood: 'worried' });
    await w.say('foltan', 'Verschon mich mit deinen Weisheiten. Wieder von irgendeiner Kräuterhexe?');
    await w.say('azar', 'Ein altes Sprichwort! Da hat der feine Herr wohl eine Bildungslücke.', { mood: 'angry' });
    await w.say('azar', 'Vielleicht schickt man sie, gerade *weil* sie nicht wie ein Spion aussieht. Verstehst du?');
    await w.say('foltan', 'Äh … nein.');
    await w.say('azar', 'Weil man denkt, dass wir denken, dass sie keiner ist!');
    await w.say('foltan', 'Klingt gar nicht so dumm. Für deinen Mund.');
    bg(foltan.emote('?', 1000));
    await w.say('foltan', 'Wer weiß. Vielleicht spionierst du für den Lichterorden in Trapas. Oder … für die Dunkelschatten.');
    const p2 = await w.choose([
      '„Für die Dunkelschatten? Die haben meine Eltern umgebracht.“',
      '„Seh ich aus wie ein Spion? Ich hab nicht mal Schuhe an.“',
      '„Moment. Ihr seid gegen die Dunkelschatten?“',
    ]);
    if (p2 === 0) {
      await lia(w, 'Für die? Die haben meine Eltern umgebracht. Ich hab die ganze Nacht Steine für ihre Gräber geschleppt.', 'angry');
      bg(azar.emote('drop', 1000));
      await w.say('foltan', '… Deine Eltern?', { mood: 'sad' });
    } else if (p2 === 1) {
      G.state.inc('k2-azar-mag');
      bg(azar.emote('note', 800));
      await w.say('azar', 'Pfff! Sie hat wirklich keine Schuhe an, Foltan.', { mood: 'happy' });
      await w.say('foltan', 'Wunde Füße. Tagesmarsch. Kein Spitzel läuft sich für einen Auftrag die Fersen blutig.');
    } else {
      G.state.inc('k2-foltan-respekt');
      await w.say('foltan', 'Was denn sonst? Sehen wir etwa aus wie welche? Die Dunkelschatten sind aller Welt Feind.');
    }
    await lia(w, 'Ich erzähle euch alles. Aber erst, wenn ihr versprecht, mir zu helfen.', 'determined');
    bg(foltan.emote('?', 900)); bg(azar.emote('?', 900));
    await sleep(700);
    await w.say('foltan', 'Bitte, warum nicht gleich so. Erzähl erst einmal.');
    await w.say('foltan', 'Aber versprechen können wir dir nichts.');
    await w.narrate([
      'Lia erzählte vom letzten Sommertag. Von den Reitern am Hof, vom Grauhaarigen, von Vater und Mutter.',
      'Von Kyra, die sie auf ein Pferd geworfen hatten. Von zwei Steinhügeln im Morgenlicht. Von den Hufspuren nach Osten.',
    ]);
    if (G.state.hasClue('k2-gaukler-reiter')) {
      await lia(w, 'Gaukler haben sie heute früh auf der Straße gesehen. Fünf Reiter, nach Osten. Kyra hat sich gewehrt.');
      G.state.inc('k2-foltan-respekt');
      await w.say('foltan', 'Du hast herumgefragt. Nicht dumm. Gar nicht dumm.', { mood: 'surprised' });
    }
    await w.say('azar', 'Ach, du armes Ding …', { mood: 'sad' });
    await w.say('foltan', 'Und du bist nicht die Einzige. Witwen und Waisen, wohin man sieht.', { mood: 'sad' });
    await w.say('foltan', 'Kein Fürst schützt mehr seine Höfe. Und den Rat der Drei kannst du vergessen.');
    await w.say('foltan', 'Ihr Großmeister soll den Verstand verloren haben. Jagt fremde Kulte, während die Höfe brennen.', { mood: 'angry' });
    G.state.addLore('k2-lore-rat-der-drei');
    await w.say('foltan', 'Aber sei’s drum. Ich glaube dir. Du kommst mit uns.');
    const p3 = await w.choose(['„Mit? Wohin?“', '„Und wenn ich nicht will?“']);
    if (p3 === 1) await w.say('foltan', 'Dann liegst du schneller erschlagen im Straßengraben, als du glaubst. Dich hier zu lassen, verbietet der Kodex.');
    else await w.say('foltan', 'In unser Lager. Dich allein in der Wildnis zu lassen, verbietet der Kodex.');
    G.state.addLore('k2-lore-kodex');
    await w.say('azar', 'Genau. Bei uns bist du sicherer.', { mood: 'happy' });
    await w.think('Sicherer. Bei zwei Männern, die sich anschreien, sobald sie den Mund aufmachen.');
    await lia(w, 'Und meine Schwester?', 'sad');
    await w.say('foltan', 'Alleine kannst du sie nicht retten. Schlag dir das erst einmal aus dem Kopf.');
    const p4 = await w.choose(['„Aber mit euch beiden schon?“', 'Schweigen.']);
    if (p4 === 0) {
      bg(azar.emote('note', 900));
      await w.say('azar', 'Hoho! Die gefällt mir immer besser.', { mood: 'happy' });
      await w.say('foltan', 'Wir werden sehen, was sich machen lässt. Mehr sage ich nicht.');
    }
    await w.say('foltan', 'Noch etwas. Sobald wir in die Nähe unseres Lagers kommen, verbinden wir dir die Augen.');
    await lia(w, 'Eine Augenbinde. Wie in den Räubergeschichten.', 'thinking');
    await w.say('foltan', 'Zu unserer Sicherheit. Und jetzt schlaf. Wir halten abwechselnd Wache.');
    await w.say('azar', 'Ich schlafe als Erster!', { mood: 'happy' });
    await w.say('foltan', 'Das dachte ich mir.');
    await w.camera.zoom(1, 800);
  });
  G.state.setParty(['foltan', 'azar']);
  G.state.set('k2-foltan-azar');
  await night(w);
}

async function night(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan'), azar = w.actor('azar');
  await w.cutscene(async () => {
    // Azar lies down at once; Foltan feeds the embers.
    try { w.lighting.get('azar-laterne').remove(); } catch { /* already gone */ }
    bg(azar.walkTo(SPOT.azarBed));
    await foltan.walkTo([SPOT.foltanSit[0] - 4, SPOT.foltanSit[1] + 6]);
    foltan.face('right');
    foltan.setIdle('kneel');
    sfx('rustle', { volume: 0.5 });
    await sleep(500);
    sfx('fire-ignite', { volume: 0.6 });
    w.fx.burst([SPOT.ring[0], SPOT.ring[1] - 6], 'sparkle', 6);
    await w.lighting.get('feuerlicht').fadeTo(1.15, 1200);
    foltan.setIdle('sit');
    azar.face('down');
    azar.setIdle('lie');
    try { G.audio.ambience(['night', 'crickets', 'fire'], { fadeMs: 1500, volume: { fire: 0.8 } }); } catch { /* audio optional */ }
    await w.player.walkTo([SPOT.bed[0] - 4, SPOT.bed[1] + 2]);
    w.player.teleport(SPOT.bed, 'right');
    w.player.setIdle('lie');
    await w.say('foltan', 'Na los, leg dich hin. Ich nehme die erste Wache. Und die zweite, wie es aussieht.');
    await sleep(800);
    snore(w);
    await sleep(1200);
    await w.say('narrator', 'Lia lag wach. Durch das Blätterdach blinkten ein paar Sterne.');
  });
  try { G.audio.music('refuge', { fadeMs: 2500 }); } catch { /* audio optional */ }
  w.setObjective('k2-nacht-crios', 'Finde Crios am Himmel.');
  await findCrios();
  G.state.addLore('k2-lore-crios');
  w.completeObjective('k2-nacht-crios');
  await w.cutscene(async () => {
    await w.think('Crios. Benannt nach dem Adler des Aros, des ersten Menschen.');
    await w.think('Crios war Aros immer treu. Er half ihm sogar, Xenovia zu stürzen.');
    await w.think('Ein treuer Gefährte … so einen hätte ich jetzt auch gerne.');
    await w.camera.pan('azar', 1200);
    w.bark('azar', 'CHRRRRR … PFFFFFF …', 2600);
    w.camera.shake(200, 0.002);
    await sleep(1600);
    await w.think('… Na gut. Ganz allein bin ich wohl doch nicht.');
    w.camera.follow();
    await sleep(500);
    await w.think('Ob Kyra wohl die gleichen Sterne sieht?');
  });
  await G.ui.fade('out', 1400);
  try { G.audio.music('grief', { fadeMs: 2500 }); } catch { /* audio optional */ }
  await G.ui.plate('k2-kyra-stall', { caption: 'Zur selben Stunde, im Stall des Goldenen Ebers', pan: 'out', durationMs: 22000 });
  await ui().fade('in', 900);
  sfx('chain', { volume: 0.6 });
  await sleep(1400);
  await w.say('kyra', 'Wo bist du, Lia? Hoffentlich hast wenigstens du es geschafft.', { portrait: 'kyra-bound', mood: 'sad' });
  await w.say('kyra', 'Ich heule nicht. Nicht vor denen. Nie.', { portrait: 'kyra-bound', mood: 'determined' });
  await w.say('narrator', 'Durch das marode Stalldach leuchtete Crios.');
  await G.ui.fade('out', 1600);
  await G.ui.closePlate();
  await gotoNext('waldweg');
}

function snore(w: WorldCtx): void {
  const lines = ['Chrrr …', '… pfff …', 'Chrrrr … mmh … Wachteleier …', '… pfff …'];
  void (async () => {
    for (let i = 0; w.alive; i++) {
      w.bark('azar', lines[i % lines.length], 2200);
      await w.wait(3200);
    }
  })().catch(() => { /* world stopped */ });
}
