// Kapitel V, Szene 1 „regenwald“: alone at night, wind, clouds, drizzle, then pouring summer rain. The rain briefly
// retreats around Lia (Urmacht hint). Flick teases, Lia rebuffs her; a Leichenfresser attacks (dodge prompt), Flick's
// arrow saves her. Only then Lia tells her story; Flick offers a city, then helps.
// Map: assets/bg/k5-regenwald.png (1280×720, painted at night). Geometry in map px (F1 overlay, scripts/map_tool.mjs).
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { ambience, lia, sfx, ui } from './common';
import { dodgeQte } from './dodge';

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
  w.bark('player', 'Der Mond ist weg …');
}

async function drizzle(w: WorldCtx): Promise<void> {
  w.weather.set('rain', { intensity: 0.22, ms: 2500 });
  ambience(['wind', 'rain', 'night'], { rain: 0.35, wind: 1 });
  await w.think('Nieselregen. Natürlich. Was auch sonst.');
}

async function pouring(w: WorldCtx): Promise<void> {
  G.state.set('k5-regen');
  w.weather.set('rain', { intensity: 1, ms: 3500 });
  ambience(['wind', 'rain'], { rain: 1, wind: 0.8 }, 3000);
  await w.wait(900);
  w.lighting.flash(0xdfe9ff, 220);
  sfx('thunder', { volume: 0.8, distance: 0.4 });
  w.camera.shake(220, 0.002);
  await w.think('Rauschender Sommerregen. Und ich habe nicht einmal mehr eine Decke über dem Kopf.');
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
    await w.think('Der Regen … hört auf? Nur hier, genau um mich herum?');
    await w.wait(700);
    void glow.fadeTo(0, 500);
    w.weather.set('rain', { intensity: 1, ms: 400 });
    ambience(['wind', 'rain'], { rain: 1, wind: 0.8 }, 400);
    w.lighting.flash(0xdfe9ff, 180);
    sfx('thunder', { volume: 0.7 });
    await w.wait(400);
    glow.remove();
    await w.think('Ich bilde mir Dinge ein. Ich bin nass, müde und allein. Das ist alles.');
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
    await w.say('flick', 'Na, wen haben wir denn da? Ganz schön gefährlich für so ein kleines Mädchen, allein im Wald.', { mood: 'smirk' });
    await G.ui.plate('k5-flick', { caption: 'Eine Fremde im Regen', pan: 'in', durationMs: 26000 });
    await lia('Ich bin nicht klein.', 'angry');
    await w.say('flick', 'Na, wenn das so ist: Was macht dann so ein großes Mädchen allein im Wald?', { mood: 'smirk' });
    const pick = await w.choose([
      '„Das geht Euch überhaupt nichts an.“',
      '„Spazieren. Bei dem herrlichen Wetter.“',
      '„Ich suche jemanden.“',
    ]);
    if (pick === 1) {
      await w.say('flick', 'Ha! Trocken wie der Regen. Gefällt mir.', { mood: 'happy' });
      await lia('Euch muss gar nichts an mir gefallen.', 'angry');
    } else if (pick === 2) {
      await w.say('flick', 'Ach ja? Wen denn? Vielleicht kann ich …', { mood: 'surprised' });
      await lia('Nein. Könnt Ihr nicht.', 'angry');
    } else {
      await w.say('flick', 'Uh. Bissig.', { mood: 'smirk' });
    }
    await w.say('flick', 'Jetzt sei bloß nicht zu freundlich zu mir.', { mood: 'smirk' });
    await lia('Danke. Das habe ich auch nicht vor.');
    await w.say('flick', 'Na dann. Viel Spaß. Allein. In der Wildnis.', { mood: 'smirk' });
    await lia('Danke. Ich komme schon klar.');
    await G.ui.closePlate();
    await flick.walkTo(944, 262, { straight: true, speed: 120 });
    const gone = flick.walkPath([[1080, 268], [1270, 280]], { run: true }).catch(() => {});
    await w.wait(900);
    await w.think('Spitze Ohren. Eine Elfe, hier draußen? Soll sie doch ihrer Wege gehen.');
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
    await w.say('narrator', 'Eine Gestalt mit bleicher Knochenmaske bricht aus dem Gestrüpp, eine schartige Axt in der Faust.');
    await w.say('narrator', 'Ein *Leichenfresser*. Weich seinen Hieben aus!');
    let hits = 0;
    await dodgeQte({
      need: 3,
      onWindup: () => { void ghoul.play('attack', { ms: 1100 }); sfx('whoosh', { volume: 0.5 }); },
      onResult: async ok => {
        if (ok) {
          sfx('dodge');
          const side = w.player.x < ghoul.x ? -1 : 1;
          void w.player.walkTo(w.player.x + side * 12, w.player.y + (Math.random() < 0.5 ? -6 : 6), { straight: true, speed: 160 }).catch(() => {});
          await w.wait(250);
        } else {
          hits++;
          sfx('hit', { volume: 0.8 });
          w.camera.shake(220, 0.004);
          await w.player.play('hit', { ms: 520 });
          if (hits === 2) w.bark('player', 'Au! Hör auf!');
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
    await w.say('flick', 'Nichts zu danken.', { mood: 'smirk' });
    if (hits > 0) await w.say('flick', 'Hat er dich erwischt? Zeig mal … Nur ein Kratzer. Du hast Glück gehabt.');
    await storyTold(w);
  });
}

async function storyTold(w: WorldCtx): Promise<void> {
  await w.say('flick', 'Hey. Willst du mir jetzt nicht endlich sagen, was los ist?');
  const ask = await w.choose(['„Was … war das für ein Ding?“', '(Schweigen.)']);
  if (ask === 0) {
    await w.say('flick', 'Ein Leichenfresser. Seit Dunkelhain streunen sie durch die Wälder und fleddern, was liegen bleibt.', { mood: 'determined' });
    await w.say('flick', 'Leute, die allein im Wald herumirren, zum Beispiel.', { mood: 'smirk' });
    G.state.addLore('k5-lore-leichenfresser');
  }
  await w.say('flick', 'Na schön, dann halt nicht. Trotzdem finde ich, wir sollten besser deine Eltern suchen.');
  await lia('Sie sind tot, okay?', 'angry');
  await w.say('flick', 'Das … wusste ich nicht. Tut mir leid.', { mood: 'sad' });
  await w.say('flick', 'Weißt du, in dieser finsteren Welt müssen viele sterben. Nur ist es besonders schlimm, wenn es einen selbst trifft.', { mood: 'sad' });
  await lia('Aufmuntern gehört nicht gerade zu deinen Stärken.', 'sad');
  await w.say('flick', 'Ach, sind wir jetzt schon beim Du? Na dann: Ich bin Flick.', { mood: 'happy' });
  await lia('Na, herzlichen Glückwunsch.');
  await lia('… Lia.');
  await w.say('flick', 'Hör zu, Lia. Ich kann dir helfen, von hier wegzukommen. In eine der großen Reichsstädte. Da bist du besser aufgehoben.');
  const city = await w.choose(['„Ich kann hier nicht weg. Sie haben meine Schwester.“', '„In eine Stadt, die sich hinter ihren Mauern verkriecht? Nein danke.“']);
  if (city === 1) {
    await w.say('flick', 'Ha. Da hast du nicht ganz unrecht.', { mood: 'smirk' });
    await lia('Und außerdem … sie haben meine Schwester mitgenommen.', 'sad');
  }
  await lia('Schwarz gekleidete Reiter. Sie haben Kyra verschleppt. Ich muss sie retten, aber ich weiß nicht einmal, wie.', 'sad');
  await w.say('flick', 'Schwarz? Oh nein. Das waren bestimmt Dunkelschatten.', { mood: 'surprised' });
  await lia('Dunkel was?');
  await w.say('flick', 'Dunkelschatten. Die Diener des Bösen. Sie verbreiten Angst und Schrecken, seit das Böse in der großen Schlacht gesiegt hat.');
  await lia('Na super. Heute habe ich ja richtig Glück.', 'sad');
  await w.say('flick', 'Aber das klingt doch nach Abenteuer!', { mood: 'happy' });
  await lia('Normalerweise lese ich Abenteuer nur.');
  await w.say('flick', 'Dann wird es Zeit. Die haben sicher schon einen großen Vorsprung …', { mood: 'determined' });
  await w.say('flick', '… aber zum Glück kennst du jetzt die beste Fährtenleserin südlich von Trapas.', { mood: 'smirk' });
  await lia('Na, das kann ja was werden.');
  if (G.state.is('k5-regen-wich')) {
    await lia('Flick? Vorhin, als der Regen … hast du gesehen, wie er …', 'thinking');
    await w.say('flick', 'Wie er was? Nass war? Ja, das hab ich bemerkt.', { mood: 'smirk' });
    await lia('Ach, nichts.');
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
    await w.think(w.weather.kind === 'rain' ? 'Drinnen ist es trocken. Aber Kyra ist da draußen.' : 'Ein guter Unterschlupf. Ich hoffe, ich brauche ihn nicht.');
    return;
  }
  G.state.set('k5-weide');
  w.player.setIdle('sit');
  await w.wait(500);
  await w.think('Der Baum ist hohl wie die alte Weide am Bach.');
  await w.think('Damals hat Kyra meine Hand gehalten, bis das Gewitter vorbei war.');
  G.state.addMemory('k5-mem-gewitter');
  await w.wait(300);
  w.player.setIdle('idle');
  await w.think('Diesmal halte ich deine Hand, Kyra. Versprochen.');
}

async function stagStone(w: WorldCtx): Promise<void> {
  if (G.state.is('k5-regastein')) { await w.think('Der Hirsch sieht aus, als würde er lauschen.'); return; }
  G.state.set('k5-regastein');
  await w.think('Ein alter Stein mit einem Hirsch, das Geweih wie Äste. Keine Schrift, nur das Bild.');
  await w.think('In Mutters Büchern stand so etwas: Rega, der Hirsch des Elfengottes Destar. Hier begann früher das Land der Elfen.');
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
    'Lia rannte, bis die Feuer des Lagers hinter den Bäumen verschwunden waren.',
    'Foltan hatte es gewusst. Die ganze Zeit. Und geschwiegen.',
  ], { style: 'card' });
  await w.think('Dann eben allein. Ich finde dich, Kyra. Ganz egal, wie.');
  w.setObjective('k5-osten', 'Folge dem Pfad nach Osten. Irgendwo dort ist Kyra.', [770, 300]);
}
