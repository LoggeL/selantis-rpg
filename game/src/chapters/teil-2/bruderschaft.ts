// Scene „e2-bruderschaft“ – Die Bruderschaft (docs/teil-2/umsetzung.md §3). Part 1 on the forest path (k4-waldpfad):
// Spurenblick along the Brotherhood's bark marks, Lia falls behind, Kyra and Flick run ahead; at the brook crossing
// the outpost ambushes them, all three end up tied. Elnon recognises Flick (her concealed origin at the oath) and Lia
// (who vanished the night he spoke with Foltan); Lia talks them loose. Part 2 in the known camp (k4-lager): Azar,
// the mandatory talk with Foltan (e2-foltan-haltung 'kalt' | 'offen', no full reconciliation), Kyra meets Foltan.
import type { CharAnim } from '../../art/api';
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type NpcDef, type WorldCtx } from '../../world';
import { waldpfadBase } from '../kapitel-4/augenbinde';
import { campBase } from '../kapitel-4/lager';
import { halt } from '../kapitel-4/shared';
import { bg, e2Scene, lia, sfx, ui, until, nextScene } from './shared';

const STRUGGLE = 'struggle' as unknown as CharAnim;
const CROSSING: [number, number] = [664, 360];

// ---------------------------------------------------------------------------------------------------------------
// Part 1: the forest path north of the Eber, by day
// ---------------------------------------------------------------------------------------------------------------

export const waldposten: MapDef = defineMap({
  ...waldpfadBase,
  id: 'e2-waldposten',
  name: 'Am Bach im Norden',
  clues: [
    { id: 'kerbe-1', at: [322, 612], kind: 'mark', angle: -90, verb: 'Ansehen', onInteract: w => readMark(w, 1) },
    { id: 'kerbe-2', at: [384, 478], kind: 'mark', angle: -45, verb: 'Ansehen', onInteract: w => readMark(w, 2) },
    { id: 'kerbe-3', at: [530, 362], kind: 'mark', angle: 0, verb: 'Ansehen', onInteract: w => readMark(w, 3) },
    { id: 'fussspuren', at: [552, 356], kind: 'footprint', angle: -10, verb: 'Ansehen', onInteract: footprints },
    {
      id: 'alte-kerbe', at: [372, 272], kind: 'mark', angle: 180, verb: 'Ansehen',
      thought: 'Eine Kerbe, aber alt und schon verwachsen. Die zeigt einen Weg, den es nicht mehr gibt.',
    },
  ],
  triggers: [
    { id: 'zurueckfallen', poly: [[418, 404], [462, 390], [480, 420], [440, 448]], onEnter: fallBehind },
    { id: 'gabel', poly: [[568, 328], [590, 328], [590, 386], [568, 386]], once: false, when: () => !G.state.is('e2-gabel-gelesen'), onEnter: forkGate },
    {
      id: 'sackgasse', poly: [[252, 196], [296, 206], [290, 244], [250, 236]],
      onEnter: async w => {
        await w.think('Eine alte Eiche, ein Haufen Laub, sonst nichts. Hier geht seit Jahren keiner mehr lang.');
        w.setObjectiveTarget(G.state.is('e2-gabel-gelesen') ? CROSSING : 'kerbe-3');
      },
    },
    { id: 'hinterhalt', poly: [[630, 330], [694, 332], [694, 392], [630, 390]], when: () => G.state.is('e2-gabel-gelesen') },
  ],
  spawns: { start: { at: [340, 692], dir: 'up' } },
  time: 'day',
  weather: 'none',
  ambience: ['wind', 'birds', 'stream'],
  ambienceVolume: { stream: 0.55, birds: 0.7, wind: 0.4 },
  music: 'exploration',
  lookMode: true,
  resetOnEnter: true,
});

const marks = (): number => [1, 2, 3].filter(n => G.state.is(`e2-kerbe-${n}`)).length;

function markObjective(w: WorldCtx): void {
  if (G.state.is('e2-zurueckgefallen')) return;
  const next = [1, 2, 3].find(n => !G.state.is(`e2-kerbe-${n}`));
  w.setObjective('e2-kerben', `Folge den Kerben der Bruderschaft nach Norden (${marks()}/3).`, next ? `kerbe-${next}` : CROSSING);
}

async function readMark(w: WorldCtx, n: number): Promise<void> {
  if (G.state.is(`e2-kerbe-${n}`)) { await w.think('Drei Krähenfüße. Die hab ich schon gelesen.'); return; }
  G.state.set(`e2-kerbe-${n}`);
  if (n === 1) {
    await w.think('Drei Kerben untereinander, wie Krähenfüße. Das Holz darin ist noch hell. Der Fallensteller hatte recht.');
    w.bark('flick', 'Sieh an. Die liest ja auch Rinde.', 2400);
  } else if (n === 2) {
    await w.think('Noch einmal Krähenfüße. Die mittlere Kerbe ist länger und zeigt den Hang hinauf. Ein Wegweiser für Leute, die wissen, wonach sie suchen.');
  } else {
    await w.think('An der Gabelung: die Krähenfüße zeigen nach rechts, zum Wasser. Nicht nach links, zur alten Eiche.');
    G.state.set('e2-gabel-gelesen');
  }
  markObjective(w);
  if (G.state.is('e2-zurueckgefallen') && G.state.is('e2-gabel-gelesen')) w.setObjective('e2-einholen', 'Hol Kyra und Flick ein. Über den Bach.', CROSSING);
}

async function footprints(w: WorldCtx): Promise<void> {
  await w.think('Zwei Paar Spuren, frisch, mit langen Schritten. Kyras Absätze graben sich tief ein. Sie rennt immer, als wäre sie zu spät.');
  if (!G.state.is('e2-gabel-gelesen')) {
    G.state.set('e2-gabel-gelesen');
    if (G.state.is('e2-zurueckgefallen')) w.setObjective('e2-einholen', 'Hol Kyra und Flick ein. Über den Bach.', CROSSING);
  }
}

async function forkGate(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await w.think(`Zwei Wege. Wohin sind die beiden? Ich sollte genau hinsehen. (${w.controlHint('look')} halten)`);
    await w.player.walkTo(512, 376);
  });
  w.setObjectiveTarget('kerbe-3');
}

/** Lia falls behind; Kyra and Flick run ahead and vanish beyond the brook. */
async function fallBehind(w: WorldCtx): Promise<void> {
  if (G.state.is('e2-zurueckgefallen')) return;
  G.state.set('e2-zurueckgefallen');
  const kyra = w.actor('kyra'), flick = w.actor('flick');
  await w.cutscene(async () => {
    bg(w.player.play('kneel', { ms: 900 }));
    w.bark('player', 'Wartet … mein Schuh …', 2000);
    await w.wait(800);
    w.companions.remove('kyra');
    w.companions.remove('flick');
    kyra.face('player'); flick.face('player');
    await w.say('kyra', 'Trödel nicht, Leseratte! … Das sagt Flick immer. Bei mir klingt’s netter.', { mood: 'happy' });
    await w.say('flick', 'Wir sehen vorne nach. Bleib auf dem Pfad und lies schön weiter.', { mood: 'smirk' });
    await lia(w, 'Geht ruhig. Ich komme. In meinem Tempo. Das heißt: später.');
    bg(kyra.walkPath([[510, 372], [600, 356], [715, 362], [820, 360], [880, 340]], { run: true }).then(() => kyra.hide()));
    bg(w.wait(250).then(() => flick.walkPath([[510, 372], [600, 356], [715, 362], [820, 360], [880, 340]], { run: true })).then(() => flick.hide()));
    await w.wait(1200);
  });
  w.setObjective('e2-kerben', 'Folge den Kerben der Bruderschaft nach Norden.', null);
  w.completeObjective('e2-kerben');
  w.setObjective('e2-einholen', 'Hol Kyra und Flick ein. Lies an der Gabelung, wohin sie gelaufen sind.', G.state.is('e2-gabel-gelesen') ? CROSSING : 'kerbe-3');
  bg((async () => {
    const lines = ['Kyra? Flick?', 'Die rennen wie die Hasen …', 'Ich lese. Ich lese ja schon.'];
    for (const line of lines) {
      await w.wait(4200);
      if (!w.alive || G.state.is('e2-hinterhalt')) return;
      if (!G.ui.busy()) w.bark('player', line, 2200);
    }
  })());
}

async function ambush(w: WorldCtx): Promise<void> {
  G.state.set('e2-hinterhalt');
  w.completeObjective('e2-einholen');
  const spawnPost = (id: string, preset: string, at: [number, number], dir: NpcDef['dir']) =>
    w.spawn({ id, preset, speaker: 'e2-posten', at, dir, solid: false });
  await w.cutscene(async () => {
    sfx('bow', { volume: 0.8 });
    await w.wait(250);
    sfx('arrow-hit', { volume: 0.9 });
    w.fx.burst([w.player.x + 26, w.player.y - 2], 'dust', 8);
    w.camera.punch();
    void w.player.emote('!');
    G.audio.music(null, { fadeMs: 600 });
    await w.say('e2-posten', 'Keinen Schritt weiter. Hände so, dass ich sie sehe.');
    spawnPost('posten-1', 'guard-brotherhood', [744, 332], 'left');
    spawnPost('posten-2', 'elf-f', [706, 404], 'up');
    spawnPost('posten-3', 'elf-m', [604, 318], 'down');
    w.fx.burst([744, 332], 'leaves', 6);
    w.fx.burst([706, 404], 'leaves', 6);
    await w.camera.pan([760, 356], 800);
    const kyra = w.actor('kyra'), flick = w.actor('flick');
    kyra.teleport([800, 364], 'left'); kyra.show();
    flick.teleport([838, 352], 'left'); flick.show();
    spawnPost('posten-4', 'guard-brotherhood', [866, 340], 'left');
    await w.say('kyra', 'Lia, lauf! … Nein, warte. Lauf nicht. Die haben Bögen.', { mood: 'scared' });
    await w.say('flick', 'Ruhig, Leseratte. Die schießen nur, wenn man dumm guckt.', { mood: 'smirk' });
    await lia(w, 'Ich gucke immer so.', 'scared');
    await w.say('e2-posten', 'Fesseln. Alle drei. Und gebt auf die Kleine mit dem Mund acht, die hat nach mir geschnappt.');
  });
  await ui().fade('out', 700);
  await w.narrate('Die Bruderschaft nahm es mit Stricken sehr genau.', { style: 'card' });
  // Tableau: the three at the alders on the far bank.
  const kyra = w.actor('kyra'), flick = w.actor('flick');
  kyra.hold(true); flick.hold(true);
  w.player.teleport([732, 366], 'right');
  w.player.setIdle('kneel');
  kyra.teleport([776, 374], 'left'); kyra.setIdle(STRUGGLE);
  flick.teleport([816, 362], 'left'); flick.setIdle(STRUGGLE);
  w.actor('posten-1').teleport([760, 332], 'down');
  w.actor('posten-2').teleport([700, 398], 'right');
  w.actor('posten-3').teleport([846, 382], 'left');
  const elnon = w.spawn({ id: 'elnon', preset: 'elnon', at: [930, 306], dir: 'left', solid: false });
  await w.camera.pan([790, 356], 0);
  await w.camera.zoom(1.3, 0);
  void ui().fade('in', 800);
  await w.cutscene(async () => {
    sfx('rustle', { volume: 0.6 });
    await elnon.walkTo(842, 346, { face: 'left' });
    G.audio.music('dread', { fadeMs: 1200 });
    elnon.face('flick');
    await elnon.say('Sieh an. Die Fährtenleserin, die uns beim Eid nur die Hälfte erzählt hat.', { mood: 'grim' });
    await w.say('flick', 'Ich hab nicht gelogen. Ich hab nur nicht alles gesagt.', { mood: 'angry' });
    await elnon.say('Bei uns ist das dasselbe. Du hast geschworen, nichts zu verbergen. Zwei Wochen später wusste es das ganze Lager.');
    await elnon.say('Ein Halbblut, das beim Eid lügt, steht auf keiner meiner Wachen. Daran hat sich nichts geändert.', { mood: 'grim' });
    await w.say('kyra', 'Sag das noch mal, und ich beiß dir in die Wade. Ich hab Übung.', { mood: 'angry' });
    elnon.face('player');
    await elnon.say('Und du. Foltans Fundstück. In der Nacht, als ich mit ihm sprach, warst du auf einmal fort.');
    await elnon.say('Azar hat bis zum Morgen den Wald abgesucht. Foltan hat seitdem kaum ein Wort gesagt.');
    await w.think('Er weiß nicht, dass ich gelauscht habe. Oder er weiß es genau und will es von mir hören.');
    const pick = await w.choose([
      '„Ich hab gelauscht. Das ist eine meiner wenigen Begabungen.“',
      '„Bindet uns los, dann erzähl ich, warum euer Lieblingshauptmann neuerdings ohne Axt reist.“',
      '„Das da ist meine Schwester. Die, die Foltan schon abgeschrieben hatte. Schaut sie euch ruhig an.“',
    ]);
    G.state.set('e2-posten-wahl', pick);
    if (pick === 0) {
      await elnon.say('Ehrlich wenigstens. … An deiner Stelle hätte ich dasselbe getan. Das sage ich nicht gern.');
    } else if (pick === 1) {
      void elnon.emote('!');
      await elnon.say('Baris? Ohne Axt?', { mood: 'surprised' });
      await w.say('flick', 'Ohne Axt. Kyra sagt, er ist ihnen auf allen vieren hinterhergekrochen. Das war sie, nicht ich.', { mood: 'smirk' });
    } else {
      elnon.face('kyra');
      await w.wait(700);
      await w.say('kyra', 'Glotz nicht so. Ich bin echt. Ich kann’s dir beweisen, siehe Wade.', { mood: 'angry' });
      elnon.face('player');
      await elnon.say('Foltan hat gesagt, für sie gebe es keine Hoffnung mehr. Foltan irrt sich selten.');
    }
    await lia(w, 'Wir sind zu euch gekommen, nicht gegen euch. Und meine Hände schlafen gerade ein.', 'determined');
    await w.wait(600);
    await elnon.say('Bindet sie los. Alle drei.', { mood: 'grim' });
    await w.say('e2-posten', 'Die Halbe auch?');
    await elnon.say('Alle drei, habe ich gesagt. Und die Binden, wie immer.');
    for (let i = 0; i < 3; i++) { sfx('rope-cut', { volume: 0.7 }); await w.wait(320); }
    w.player.setIdle('idle'); kyra.setIdle('idle'); flick.setIdle('idle');
    await lia(w, 'Ich kenne das Spiel. Darf ich den Knoten diesmal selbst machen?', 'happy');
    await elnon.say('Nein.');
  });
  await ui().fade('out', 900);
  await w.camera.zoom(1, 0);
  w.camera.follow();
  await w.narrate('Wieder ein Tuch vor den Augen, wieder Moos unter den Schuhen. Diesmal redete niemand. Lia vermisste Azars Geplapper mehr, als sie zugeben wollte.', { style: 'card' });
  kyra.hold(false); flick.hold(false);
  w.companions.add('kyra');
  w.companions.add('flick');
}

// ---------------------------------------------------------------------------------------------------------------
// Part 2: back in the camp, by day
// ---------------------------------------------------------------------------------------------------------------

export const lagerTag: MapDef = defineMap({
  ...campBase,
  id: 'e2-lager-tag',
  name: 'Das Lager der Freien Bruderschaft',
  npcs: [
    { id: 'azar', preset: 'azar', at: [968, 292], dir: 'right', talk: talkAzar, barks: ['Wer hat schon wieder meinen Hammer?', 'Ein Schmied ist unentbehrlich!'], barkEvery: 11000 },
    { id: 'foltan', preset: 'foltan', at: [704, 380], dir: 'left', talk: talkFoltan, verb: 'Reden' },
    { id: 'alastir', preset: 'alastir', at: [792, 232], dir: 'down', talk: talkAlastir, verb: 'Reden' },
    { id: 'elnon', preset: 'elnon', at: [636, 236], dir: 'down' },
    { id: 'e2-koechin', preset: 'villager-f', at: [572, 292], dir: 'right', barks: ['Die Kleine ist wieder da!', 'Wer hat den Lorbeer?'], barkEvery: 9000 },
    { id: 'e2-holzhacker', preset: 'dwarf', at: [786, 378], dir: 'up', barks: ['Holz. Immer Holz.', 'Pah. Die Halbe ist auch wieder da.'], barkEvery: 10000 },
    { id: 'e2-schuetzin', preset: 'elf-f', at: [104, 298], dir: 'left', barks: ['Ruhig atmen … und los.', 'Fast in die Mitte.'], barkEvery: 9500 },
    { id: 'e2-torwache', preset: 'guard-brotherhood', at: [600, 540], dir: 'down', barks: ['Losung ist Losung.'], barkEvery: 14000 },
  ],
  interactables: [
    {
      id: 'zelt-eingang', verb: 'Hineingehen', poly: [[612, 166], [656, 166], [658, 206], [612, 206]], standAt: [634, 228], face: 'up', once: false,
      onInteract: enterTent,
    },
  ],
  lights: [
    { id: 'esse', at: [1024, 236], kind: 'fire', radius: 60, intensity: 0.8, always: true },
    { id: 'feuer', at: [636, 330], kind: 'fire', radius: 70, intensity: 0.5, flame: 0.7 },
  ],
  exits: [{
    id: 'tor', poly: [[588, 706], [680, 706], [680, 720], [588, 720]], to: 'e2-lager-tag', spawn: 'tor',
    when: () => false, blocked: 'Gerade erst angekommen. Und diesmal laufe ich nicht weg.',
  }],
  spawns: { tor: { at: [634, 586], dir: 'up' } },
  time: 'day',
  ambience: ['camp', 'forge', 'birds', 'wind'],
  ambienceVolume: { forge: 0.55, birds: 0.5, wind: 0.4 },
  music: 'refuge',
  resetOnEnter: true,
});

async function arrival(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar'), elnon = w.actor('elnon');
  azar.hold(true);
  void ui().fade('in', 900);
  await w.cutscene(async () => {
    w.player.face('up');
    await w.wait(500);
    await w.think('Das Lager. Dieselben Zelte, derselbe Rauch. Als wäre ich nie weggelaufen.');
    w.bark('azar', '… LIA?!', 1800);
    void azar.emote('!');
    await azar.walkTo(636, 548, { run: true, face: 'down' });
    await azar.say('Du lebst! Ich hab nach dir gerufen, bis ich klang wie ein rostiger Blasebalg!', { mood: 'happy' });
    await azar.say('Was der Wald verschluckt, spuckt er auch wieder aus. Sagt meine Großmutter. Über Pilze, aber trotzdem.', { mood: 'happy' });
    const pick = await w.choose(['(Azar umarmen)', '„Hallo, Azar.“']);
    if (pick === 0) {
      void azar.emote('heart');
      G.state.set('e2-azar-umarmt');
      await azar.say('Uff. Vorsicht, Kind. Ich bin weich, aber nicht unzerbrechlich.', { mood: 'happy' });
    } else {
      await azar.say('„Hallo, Azar.“ Tagelang Sorgen, und ich krieg ein Hallo. Na schön. Ich nehm’s.', { mood: 'happy' });
    }
    await w.say('kyra', 'Bist du der mit dem Eintopf? Lia sagt, du kochst fast so gut wie unsere Mutter.', { mood: 'happy' });
    await azar.say('Fast?! … Moment. Du bist die Schwester. Die Schwester! Foltan hat gesagt …', { mood: 'surprised' });
    void azar.emote('drop');
    await azar.say('Ach, Foltan sagt viel, wenn der Tag lang ist.', { mood: 'worried' });
    azar.face('flick');
    await azar.say('Und die Fährtenleserin. Mutig, sich hier wieder blicken zu lassen.');
    await w.say('flick', 'Mutig oder dumm. Such’s dir aus.', { mood: 'smirk' });
    await w.camera.pan('elnon', 800);
    await elnon.say('Azar. Später. Foltan soll mit ihr reden. Danach will ich alle drei in meinem Zelt.');
    await elnon.walkTo(634, 214, { face: 'up' });
    elnon.hide();
    w.camera.follow();
    azar.hold(false);
    bg(azar.walkTo(968, 292, { face: 'right' }));
  });
}

async function talkAzar(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  const lines = [
    'Heute Abend koch ich. Elnon weiß es noch nicht. Er wird es schmecken.',
    'Foltan schläft schlecht, seit du weg warst. Hab ich nicht gesagt. Ich sag nie was.',
    'Ein Schmied ist unentbehrlich. Eine Lia offenbar auch.',
  ];
  const n = G.state.inc('e2-azar-plausch');
  await azar.say(lines[(n - 1) % lines.length], { mood: 'happy' });
}

async function talkAlastir(w: WorldCtx): Promise<void> {
  const al = w.actor('alastir');
  if (G.state.is('e2-alastir')) { await al.say('Geh. Elnon wartet nicht gern. Er tut nur so.'); return; }
  G.state.set('e2-alastir');
  await al.say('Die Kleine mit den Fragen. Und mit der Schwester, die alle für tot hielten.');
  await al.say('Elnon zählt. Heute hat er sich verzählt. Das passiert ihm selten, und es gefällt ihm nicht.', { mood: 'grim' });
  const pick = await w.choose(['„Gut.“', '„Und du? Hast du mitgezählt?“']);
  if (pick === 0) await al.say('Ja. Gut. Sag es ihm nur nicht so.');
  else await al.say('Ich habe gehofft. Das ist leiser als Zählen. Und man verrechnet sich seltener.');
}

async function talkFoltan(w: WorldCtx): Promise<void> {
  const foltan = w.actor('foltan');
  if (G.state.is('e2-foltan-gesprochen')) {
    await foltan.say(G.state.flag<string>('e2-foltan-haltung') === 'offen' ? 'Geh zu Elnon, Lia. Ich … bin hier.' : 'Elnon wartet.', { mood: 'ashamed' });
    return;
  }
  const kyra = w.actor('kyra');
  await w.cutscene(async () => {
    foltan.face('player');
    w.player.face('foltan');
    await foltan.say('Lia.');
    await w.wait(600);
    await foltan.say('Du hast sie gefunden. Allein.');
    await w.think('Er sieht aus, als hätte er seit Wochen nicht geschlafen. Gut so. … Nein. Nicht gut.');
    const pick = await w.choose([
      '„Nicht allein. Mit Flick. Ohne dich.“',
      '„Sag, was du sagen willst. Ich hör zu.“',
      '(An ihm vorbeisehen und schweigen)',
    ]);
    let stance: 'kalt' | 'offen';
    if (pick === 1) {
      stance = 'offen';
      await foltan.say('Ich hielt deine Schwester für verloren. Fünf Mann, ein Kind, eine Grotte irgendwo. Ich hab gerechnet und geschwiegen.', { mood: 'ashamed' });
      await foltan.say('Das war falsch. Ich bin schlecht in so etwas. In der Garde entschuldigt man sich nicht. Man meldet sich ab.', { mood: 'ashamed' });
      await lia(w, 'Ich hab zugehört. Verziehen hab ich dir noch nicht.', 'thinking');
      await foltan.say('Das ist mehr, als ich erwartet habe.');
    } else {
      stance = 'kalt';
      if (pick === 2) { w.player.face('right'); await w.wait(900); }
      await foltan.say('Ich hielt sie für verloren. Ich wollte dir eine Hoffnung ersparen, die ich selbst nicht hatte.', { mood: 'ashamed' });
      await lia(w, 'Du wolltest mir gar nichts ersparen. Du wolltest dein Geweih.', 'angry');
      await foltan.say('… Vielleicht beides.', { mood: 'ashamed' });
      await lia(w, 'Ich hab dir vertraut. Das passiert mir nicht noch mal.', 'angry');
    }
    G.state.set('e2-foltan-haltung', stance);
    kyra.face('foltan');
    await w.say('kyra', 'Du bist also Foltan.');
    await foltan.say('Und du bist … die Schwester. Lebendig.', { mood: 'surprised' });
    await w.say('kyra', 'Lia hat unterwegs alles erzählt. Ich hab lange überlegt, ob ich dich beiße.');
    await foltan.say('Und?');
    await w.say('kyra', 'Ich überleg noch. Ich hab Zeit.', { mood: 'determined' });
    G.state.set('e2-foltan-gesprochen');
  });
}

async function enterTent(w: WorldCtx): Promise<void> {
  if (!G.state.is('e2-foltan-gesprochen')) {
    await w.think('Erst Foltan. Elnon will es so. Und ich will es hinter mir haben.');
    return;
  }
  G.state.set('e2-zelt');
}

async function campPart(w: WorldCtx): Promise<void> {
  await arrival(w);
  w.setObjective('e2-foltan', 'Sprich mit Foltan.', 'foltan');
  await until(w, () => G.state.is('e2-foltan-gesprochen'));
  w.completeObjective('e2-foltan');
  w.setObjective('e2-elnon-zelt', 'Geh mit Kyra und Flick in Elnons Zelt.', 'zelt-eingang');
  await until(w, () => G.state.is('e2-zelt'));
  w.completeObjective('e2-elnon-zelt');
  w.lockPlayer();
  await ui().fade('out', 900);
  await w.narrate('Elnon ließ sie warten, bis die Sonne hinter der Palisade stand. Dann hörte er zu.', { style: 'card' });
  G.state.set('e2-angekommen');
  halt(w, ['kyra', 'flick', 'azar', 'foltan']);
  await nextScene('e2-pruefung');
}

// ---------------------------------------------------------------------------------------------------------------
// Main script
// ---------------------------------------------------------------------------------------------------------------

async function bruderschaftScript(w: WorldCtx): Promise<void> {
  await w.narrate('Im Morgengrauen zogen sie nach Norden, an der umgestürzten Eiche vorbei, den Bach hinauf.', { style: 'card' });
  void ui().fade('in', 900);
  await w.cutscene(async () => {
    await w.wait(500);
    await w.say('kyra', 'Ich riech Bach! Und Pilze. Lia, kann man die essen?', { mood: 'happy' });
    await lia(w, 'Nein. Die nicht. Die auch nicht. Die da ganz bestimmt nicht.');
    await w.say('flick', 'Augen auf die Rinde, Leseratte. Du hast die Krähenfüße doch selbst bestellt.', { mood: 'smirk' });
    await w.say('narrator', `Halte ${w.controlHint('look')} gedrückt: Im Spurenblick leuchten Zeichen und Spuren auf. Untersuche sie mit ${w.controlHint('interact')}.`);
  });
  markObjective(w);
  await w.waitForTrigger('hinterhalt');
  await ambush(w);
  await w.changeMap(lagerTag, 'tor', { fadeMs: 0 });
  await campPart(w);
}

export const scene = e2Scene('e2-bruderschaft', 'Die Bruderschaft', () =>
  startWorld({ map: waldposten, spawn: 'start', player: 'lia-cloak', companions: ['flick', 'kyra'], fadeIn: false, script: bruderschaftScript }));
