// Kapitel V, Szene 1 „regenwald“: alone at night, wind, clouds, drizzle, then pouring summer rain. The rain briefly
// retreats around Lia (Urmacht hint). Flick teases, Lia rebuffs her; a Leichenfresser attacks („Drei Atemzüge“), Flick's
// arrow saves her. Only then Lia tells her story; Flick offers a city, then helps.
// Map: assets/bg/k5-regenwald.png (1280×720, painted at night). Geometry in map px (F1 overlay, scripts/map_tool.mjs).
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { ambience, lia, sfx, ui } from './common';
import { flickOnTricks, ghoulFight } from './dodge';

export const regenwaldMap: MapDef = defineMap({
  id: 'k5-regenwald',
  name: 'Der Wald im Regen',
  background: 'k5-regenwald',
  baked: 'night',
  walk: [[
    [0, 598], [100, 575], [200, 535], [262, 495], [290, 450], [300, 400], [285, 350], [268, 300], [272, 262], [300, 252],
    [330, 256], [350, 290], [372, 330], [400, 345], [440, 330], [466, 308], [552, 308], [600, 296], [630, 252], [660, 216],
    [700, 192], [760, 176], [835, 214], [1025, 226], [1060, 206], [1090, 200], [1150, 222], [1230, 234], [1280, 238],
    [1280, 326], [1200, 345], [1150, 372], [1130, 420], [1120, 466], [1060, 486], [980, 486], [900, 484], [820, 478],
    [740, 470], [680, 455], [640, 422], [560, 412], [470, 404], [420, 412], [390, 442], [360, 482], [320, 540], [260, 590],
    [190, 630], [130, 672], [100, 720], [0, 720],
  ]],
  block: [
    { id: 'findling', poly: [[835, 216], [870, 202], [1000, 206], [1025, 226], [1015, 250], [960, 256], [860, 254], [835, 240]] },
    { id: 'baumstamm', sight: false, poly: [[915, 425], [1060, 360], [1105, 362], [1115, 385], [985, 450], [930, 462]] },
  ],
  occluders: [
    { id: 'baumstamm', baseline: 456, poly: [[902, 404], [1000, 352], [1080, 338], [1126, 350], [1126, 392], [1000, 458], [930, 474], [898, 456]] },
    { id: 'farne-vorne', baseline: 720, fade: 0.6, poly: [[214, 720], [240, 650], [330, 572], [400, 494], [470, 478], [560, 470], [640, 486], [700, 500], [700, 720]] },
    { id: 'busch-sued', baseline: 720, fade: 0.6, poly: [[700, 500], [820, 492], [980, 498], [1100, 486], [1160, 440], [1280, 420], [1280, 720], [700, 720]] },
  ],
  surfaces: [
    { id: 'pfad', kind: 'mud', speed: 0.92, poly: [
      [0, 610], [110, 590], [215, 548], [280, 502], [312, 450], [318, 404], [304, 356], [292, 300], [300, 262], [326, 262],
      [345, 300], [360, 345], [395, 365], [450, 352], [540, 340], [596, 316], [628, 270], [662, 228], [706, 204], [770, 188],
      [790, 214], [720, 236], [688, 262], [650, 316], [600, 352], [540, 372], [450, 384], [395, 396], [368, 440], [340, 500],
      [300, 548], [240, 590], [170, 626], [120, 664], [92, 720], [0, 720],
    ] },
    { id: 'pfad-ost', kind: 'mud', speed: 0.92, poly: [[1150, 252], [1280, 246], [1280, 318], [1200, 330], [1150, 300]] },
  ],
  surface: 'darkgrass',
  interactables: [
    {
      id: 'hohler-baum', verb: 'Unterstellen', poly: [[282, 170], [318, 166], [334, 240], [276, 244]],
      standAt: [302, 266], face: 'up', onInteract: shelter,
    },
    {
      id: 'hirschstein', verb: 'Untersuchen', poly: [[478, 202], [506, 188], [536, 196], [546, 296], [476, 298]],
      standAt: [510, 318], face: 'up', onInteract: stagStone,
    },
  ],
  triggers: [
    { id: 'wolken', area: { x: 150, y: 380, w: 50, h: 340 }, onEnter: clouds },
    { id: 'niesel', area: { x: 330, y: 200, w: 50, h: 520 }, onEnter: drizzle },
    { id: 'regen', area: { x: 560, y: 200, w: 50, h: 520 }, onEnter: pouring },
    { id: 'urmacht', area: { x: 700, y: 150, w: 50, h: 560 }, when: () => G.state.is('k5-regen'), onEnter: rainRetreats },
    { id: 'flick', area: { x: 790, y: 150, w: 70, h: 560 }, when: () => G.state.is('k5-regen-wich'), onEnter: meetFlick },
    { id: 'ghul', area: { x: 1040, y: 150, w: 60, h: 560 }, when: () => G.state.is('k5-flick-weg'), onEnter: ghoulAttack },
    { id: 'ausgang', poly: [[1256, 236], [1280, 236], [1280, 328], [1256, 328]], once: false, when: () => G.state.is('k5-flick-dabei'), onEnter: leave },
  ],
  lights: [{ id: 'mond', at: [700, 0], kind: 'moon', radius: 520, intensity: 0.3 }],
  spawns: {
    start: { at: [56, 646], dir: 'right' },
    lichtung: { at: [770, 300], dir: 'right' },
  },
  time: 'night',
  weather: 'none',
  ambience: ['wind', 'night'],
  ambienceVolume: { wind: 1.2 },
  music: 'grief',
  playerLight: 62,
  lookMode: true,
  depthScale: { y0: 170, s0: 0.94, y1: 720, s1: 1.04 },
});

// ---------------------------------------------------------------------------------------------------------------

async function clouds(w: WorldCtx): Promise<void> {
  void w.lighting.get('mond').fadeTo(0.04, 5000);
  w.weather.set('leaves', { intensity: 0.5, ms: 1500 });
  sfx('rustle', { volume: 0.6 });
  w.bark('player', 'Jetzt ist auch der Mond weg.');
}

async function drizzle(w: WorldCtx): Promise<void> {
  w.weather.set('rain', { intensity: 0.22, ms: 2500 });
  ambience(['wind', 'rain', 'night'], { rain: 0.35, wind: 1 });
  await w.think('Nieselregen. Der Himmel hat wohl auf mich gewartet.');
}

async function pouring(w: WorldCtx): Promise<void> {
  G.state.set('k5-regen');
  w.weather.set('rain', { intensity: 1, ms: 3500 });
  ambience(['wind', 'rain'], { rain: 1, wind: 0.8 }, 3000);
  await w.wait(900);
  w.lighting.flash(0xdfe9ff, 220);
  sfx('thunder', { volume: 0.8, distance: 0.4 });
  w.camera.shake(220, 0.002);
  await w.think('Zu Hause hätte ich jetzt dem Regen auf dem Dach zugehört. Unter zwei Decken.');
  w.setObjective('k5-osten', 'Weiter nach Osten. Irgendwo dort ist Kyra.', [770, 300]);
}

/** Urmacht hint: for a few heartbeats the rain stops around Lia. */
async function rainRetreats(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    w.player.face('up');
    await w.wait(500);
    w.weather.set('rain', { intensity: 0.06, ms: 600 });
    ambience(['wind', 'rain'], { rain: 0.25, wind: 0.4 }, 600);
    const glow = w.lighting.add({ id: 'k5-trocken', at: [w.player.x, w.player.y - 12], kind: 'urmacht', radius: 56, intensity: 0, always: true });
    void glow.fadeTo(0.85, 800);
    w.fx.burst('player', 'urmacht', 9);
    sfx('urmacht', { volume: 0.35 });
    await w.player.emote('?', 900);
    await w.think('Kein Tropfen trifft mich. Eine Armlänge weiter schüttet es wie vorher.');
    await w.wait(700);
    void glow.fadeTo(0, 500);
    w.weather.set('rain', { intensity: 1, ms: 400 });
    ambience(['wind', 'rain'], { rain: 1, wind: 0.8 }, 400);
    w.lighting.flash(0xdfe9ff, 180);
    sfx('thunder', { volume: 0.7 });
    await w.wait(400);
    glow.remove();
    await w.think('Wieder klatschnass. Ich bin müde, sonst nichts. Müde Augen sehen Dinge, die nicht da sind.');
  });
  G.state.set('k5-regen-wich');
}

async function meetFlick(w: WorldCtx): Promise<void> {
  ui().prefetchPlate('k5-flick');
  const flick = w.spawn({ id: 'flick', preset: 'flick', at: [930, 206], dir: 'left', solid: false });
  await w.cutscene(async () => {
    flick.face('player');
    sfx('rustle', { volume: 0.8 });
    await w.wait(300);
    await w.player.emote('!', 700);
    w.player.face([930, 206]);
    await w.camera.pan([880, 250], 700);
    await w.say('flick', 'Sieh an. Ein nasses Küken, mutterseelenallein im Wald. Hast du dich verlaufen, Kleine?', { mood: 'smirk' });
    await G.ui.plate('k5-flick', { caption: 'Eine Fremde im Regen', pan: 'in', durationMs: 26000 });
    await lia('Ich bin nicht klein. Ich bin nur noch nicht fertig.', 'angry');
    await w.say('flick', 'Verzeihung, die Dame. Und was führt die Dame nachts in den Regen?', { mood: 'smirk' });
    const pick = await w.choose([
      '„Das ist meine Sache, nicht Eure.“',
      '„Baden. Sieht man doch.“',
      '„Jemanden suchen. Nicht Euch.“',
    ]);
    if (pick === 1) {
      await w.say('flick', 'Ha. Wenigstens dein Witz ist trocken geblieben.', { mood: 'happy' });
      await lia('Spart Euch das. Ich bin nicht zum Lachen hier.', 'angry');
    } else if (pick === 2) {
      await w.say('flick', 'Ach? Und wen? Ich kenn mich hier aus, vielleicht …', { mood: 'surprised' });
      await lia('Nein. Danke.', 'angry');
    } else {
      await w.say('flick', 'Oha. Stacheln hat sie auch.', { mood: 'smirk' });
    }
    await w.say('flick', 'Du bist ja ein richtiger Sonnenschein. Passt zum Wetter.', { mood: 'smirk' });
    await lia('Wenn Ihr fertig seid, würde ich gern weitergehen.');
    await w.say('flick', 'Bitte sehr. Der Wald gehört dir. Mit allem, was drin wohnt.', { mood: 'smirk' });
    await lia('Gute Nacht.');
    await G.ui.closePlate();
    await flick.walkTo(944, 262, { straight: true, speed: 120 });
    const gone = flick.walkPath([[1080, 268], [1270, 280]], { run: true }).catch(() => {});
    await w.wait(900);
    await w.think('Spitze Ohren. In Mutters Büchern waren Elfen höflicher.');
    await gone;
  });
  w.despawn('flick');
  G.state.set('k5-flick-weg');
  w.setObjective('k5-osten', 'Weiter nach Osten. Irgendwo dort ist Kyra.', 'ausgang');
}

async function ghoulAttack(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    G.audio.music('dread', { fadeMs: 600 });
    sfx('rustle', { volume: 1, pan: 0.6 });
    w.player.face('down');
    await w.wait(500);
    sfx('branch-snap', { volume: 0.9, pan: 0.5 });
    await w.player.emote('!', 600);
    const px = w.player.x, py = w.player.y;
    const ghoul = w.spawn({ id: 'ghoul', preset: 'ghoul', speaker: 'leichenfresser', at: [px + 120, py + 120], dir: 'left', solid: false, speed: 80 });
    await w.camera.pan([px + 40, py + 20], 400);
    await ghoul.walkTo(px + 26, py + 6, { straight: true, run: true, speed: 150 });
    ghoul.face('player');
    w.player.face('ghoul');
    w.camera.punch(0.6);
    await w.say('narrator', 'Das Gestrüpp reißt auf. Eine bleiche Knochenmaske, dahinter ein Keuchen, in der Faust eine schartige Axt.');
    await w.say('narrator', 'Ein *Leichenfresser*, und er holt schon aus.');
    await w.think('Ich kann nicht kämpfen. Aber ich kann hinsehen. Wurzeln, eine Buche, mein Mantel, schwer vom Regen.');
    let hits = 0;
    const tricks: string[] = [];
    await ghoulFight({
      onWindup: () => { void ghoul.play('attack', { ms: 1100 }); },
      onResult: async (ok, _i, pick) => {
        if (ok) {
          tricks.push(pick);
          sfx('dodge');
          const side = w.player.x < ghoul.x ? -1 : 1;
          void w.player.walkTo(w.player.x + side * 12, w.player.y + (Math.random() < 0.5 ? -6 : 6), { straight: true, speed: 160 }).catch(() => {});
          await w.wait(250);
        } else {
          hits++;
          sfx('hit', { volume: 0.8 });
          w.camera.shake(220, 0.004);
          await w.player.play('hit', { ms: 520 });
        }
      },
    });
    G.state.set('k5-ghul-treffer', hits);
    sfx('bow', { volume: 0.9, pan: 0.7 });
    await w.wait(220);
    sfx('arrow-hit', { volume: 1 });
    await ghoul.play('hit', { ms: 500 });
    w.bark('ghoul', 'Grrhhh …!');
    await ghoul.walkTo(ghoul.x + 140, ghoul.y + 150, { straight: true, run: true, speed: 170 });
    w.despawn('ghoul');
    const flick = w.spawn({ id: 'flick', preset: 'flick', at: [1270, 282], dir: 'left' });
    await flick.walkTo(w.player.x + 34, w.player.y - 4, { run: true });
    flick.face('player');
    w.player.face('flick');
    G.audio.music('refuge', { fadeMs: 2500 });
    await w.say('flick', 'Du darfst ruhig ‚danke‘ sagen. Wenn du wieder Luft kriegst.', { mood: 'smirk' });
    const trick = flickOnTricks(tricks);
    if (trick) await w.say('flick', trick, { mood: 'smirk' });
    if (hits > 0) await w.say('flick', 'Zeig mal her. … Ein Kratzer. Bis du heiratest, ist der weg.');
    await storyTold(w);
  });
}

async function storyTold(w: WorldCtx): Promise<void> {
  await w.say('flick', 'So. Jetzt, wo du mir was schuldest: Was treibst du hier draußen?');
  const ask = await w.choose(['„Erst Ihr. Was war das für ein Ding?“', '(Schweigen.)']);
  if (ask === 0) {
    await w.say('flick', 'Ein Leichenfresser. Die ziehen hinter jedem Krieg her und fleddern, was liegen bleibt. Hier bleibt seit Jahren viel liegen.', { mood: 'determined' });
    await w.say('flick', 'Und wer allein durch den Wald stolpert, ist für die nur ein bisschen früh dran.', { mood: 'smirk' });
    G.state.addLore('k5-lore-leichenfresser');
  }
  await w.say('flick', 'Gut, du redest nicht gern. Dann bring ich dich wenigstens heim. Wo sind deine Eltern?');
  await lia('Unter zwei Steinhügeln vor unserem Haus. Die Steine hab ich selbst getragen.', 'sad');
  await w.say('flick', 'Oh. Ich … Verdammt. Tut mir leid.', { mood: 'sad' });
  await w.say('flick', 'Ich bin schlecht in so was. Mit Bäumen red ich besser als mit Leuten.', { mood: 'sad' });
  await lia('Merkt man. Dann geh doch zurück zu deinen Bäumen.', 'sad');
  await w.say('flick', 'Jetzt bin ich also ‚du‘. Immerhin ein Fortschritt. Flick heiß ich.', { mood: 'happy' });
  await lia('Flick. Klingt wie ein Geräusch, nicht wie ein Name.');
  await lia('… Lia.');
  await w.say('flick', 'Hör zu, Lia. Ich bring dich in eine der Reichsstädte. Mauern, Wachen, warme Suppe. Da bist du sicher.');
  const city = await w.choose(['„Ohne meine Schwester gehe ich nirgendwohin.“', '„Damit ich hinter Mauern sitze und warte? Nein.“']);
  if (city === 1) {
    await w.say('flick', 'Ha. Das hätte ich auch gesagt.', { mood: 'smirk' });
    await lia('Außerdem wartet jemand auf mich. Nur nicht hinter Mauern.', 'sad');
  }
  await lia('Reiter in Schwarz haben Kyra geholt. Meine Zwillingsschwester. Ich hol sie zurück. Ich weiß nur noch nicht, wie.', 'sad');
  await w.say('flick', 'In Schwarz, sagst du? Dann waren’s Dunkelschatten. Verflucht.', { mood: 'surprised' });
  await lia('Das klingt wie aus einem Schauermärchen.');
  await w.say('flick', 'Schön wär’s. Seit Dunkelhain nehmen die sich, was sie wollen. Und keiner hält sie auf.');
  await lia('Wunderbar. Und ich habe nicht mal einen Plan.', 'sad');
  await w.say('flick', 'Klingt nach einer Geschichte, die man später gern erzählt. Wenn man sie überlebt.', { mood: 'smirk' });
  await lia('In meinen Büchern kann man an solchen Stellen umblättern.');
  await w.say('flick', 'Reiter sind schnell. Aber Pferde hinterlassen Spuren, und der Regen macht den Boden weich.', { mood: 'determined' });
  await w.say('flick', 'Und zufällig liest südlich von Trapas niemand Spuren so gut wie ich.', { mood: 'smirk' });
  await lia('Und bescheiden ist sie auch noch.');
  if (G.state.is('k5-regen-wich')) {
    await lia('Flick? Vorhin, im Regen … ist dir da was aufgefallen?', 'thinking');
    await w.say('flick', 'Am Regen? Er war nass. Ich hab genau hingesehen.', { mood: 'smirk' });
    await lia('Vergiss es.');
  }
  G.state.setParty(['flick']);
  G.state.set('k5-flick-dabei');
  w.companions.add('flick');
  w.weather.set('rain', { intensity: 0.45, ms: 4000 });
  ambience(['rain', 'wind'], { rain: 0.6, wind: 0.5 });
  w.completeObjective('k5-osten');
  w.setObjective('k5-flick', 'Folge dem Pfad mit Flick nach Osten.', 'ausgang');
}

// ---------------------------------------------------------------------------------------------------------------

async function shelter(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-weide')) {
    await w.think(w.weather.kind === 'rain' ? 'Trocken hier drin. Kyra hat es nicht so gut.' : 'Hier könnte man sich verkriechen. Später vielleicht.');
    return;
  }
  G.state.set('k5-weide');
  w.player.setIdle('sit');
  await w.wait(500);
  await w.think('Hohl, wie die alte Weide am Bach. Da haben wir uns früher versteckt.');
  await w.think('Beim Gewitter hat Kyra behauptet, die Götter rücken nur Möbel. Und meine Hand gehalten, bis es vorbei war.');
  G.state.addMemory('k5-mem-gewitter');
  await w.wait(300);
  w.player.setIdle('idle');
  await w.think('Diesmal bin ich dran mit Handhalten, Kyra.');
}

async function stagStone(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-regastein')) { await w.think('Der Hirsch lauscht. Auf den Regen oder auf mich.'); return; }
  G.state.set('k5-regastein');
  await w.think('Ein Hirsch, in den Stein gehauen. Das Geweih verzweigt sich wie eine Baumkrone.');
  await w.think('Rega, der Hirsch des Elfengottes Destar. Das Bild stand in einem von Mutters Büchern. Dann war das hier früher Elfenland.');
  G.state.addLore('k5-lore-rega');
}

async function leave(): Promise<void> {
  if (G.state.is('k5-regenwald-done')) return;
  G.state.set('k5-regenwald-done');
  G.state.complete('k5-flick');
  // Leave the world's update loop before restarting the scene (a trigger handler runs inside update()).
  await ui().wait(60);
  await G.goto('faehrte');
}

export async function regenwaldScript(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-flick-dabei')) {
    w.setObjective('k5-flick', 'Folge dem Pfad mit Flick nach Osten.', 'ausgang');
    return;
  }
  await w.wait(600);
  await w.narrate([
    'Lia lief, bis kein Feuerschein mehr durch die Bäume drang.',
    'Foltan hatte es gewusst. Er hatte ihr Brot gereicht und dabei geschwiegen.',
  ], { style: 'card' });
  await w.think('Dann eben allein. Halt durch, Kyra.');
  w.setObjective('k5-osten', 'Folge dem Pfad nach Osten. Irgendwo dort ist Kyra.', [770, 300]);
}
