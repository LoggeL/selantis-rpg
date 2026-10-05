// Scene „augenbinde“ (DESIGN.md §7.4, Kapitel IV/1). Part 1: morning at the brook (wash, tend the heel, the
// question of the blindfold). Part 2: the blindfolded walk into the secret camp on the forest path map – a dark
// screen, Azar's voice in stereo, rings in the dark where sounds come from (see blindfold.ts).
import { G } from '../../core/G';
import type { UiApiExt } from '../../ui';
import { defineMap, type WorldCtx } from '../../world';
import { Blindfold, RING } from './blindfold';
import { bg, corridor, halt, lia, sfx, sneakHeld } from './shared';

// ---------------------------------------------------------------------------------------------------------------
// Map 1: the night camp at the brook, early morning (640×360)
// ---------------------------------------------------------------------------------------------------------------

export const bach = defineMap({
  id: 'k4-bach',
  name: 'Am Bach',
  background: 'k4-bach',
  walk: [[
    [132, 122], [158, 112], [210, 112], [262, 108], [338, 120], [400, 128], [482, 130], [496, 96], [506, 56], [514, 18],
    [518, 0], [562, 0], [562, 30], [552, 70], [548, 108], [576, 140], [600, 170], [602, 232], [580, 262], [540, 280],
    [470, 290], [360, 296], [270, 292], [224, 282], [206, 250], [208, 200], [206, 164], [152, 156], [128, 142],
  ]],
  block: [
    { id: 'feuerstelle', sight: false, poly: [[362, 152], [375, 145], [405, 145], [420, 153], [418, 168], [402, 175], [376, 175], [362, 166]] },
    { id: 'bettrollen', sight: false, poly: [[438, 150], [494, 150], [496, 167], [440, 168]] },
  ],
  surfaces: [
    { id: 'fels', kind: 'stone', poly: [[132, 122], [158, 112], [210, 112], [212, 150], [152, 156], [128, 142]] },
    { id: 'pfad', kind: 'path', poly: [[500, 120], [508, 56], [516, 0], [562, 0], [552, 70], [548, 118], [580, 150], [560, 160]] },
  ],
  surface: 'grass',
  npcs: [
    {
      id: 'azar', preset: 'azar', at: [312, 220], dir: 'right', idle: 'lie', solid: true,
      barks: ['Chrrr … pfffh …', 'Mmmh … Speck …', 'Chrrrr … Wachteleier …'], barkEvery: 4200,
      talk: async w => { await w.think('Er schnarcht wie ein Blasebalg. Ich lasse ihn noch ein bisschen.'); },
    },
    {
      id: 'foltan', preset: 'foltan', at: [540, 214], dir: 'left', idle: 'lie', solid: true,
      barks: ['Hrrrm … Disziplin …', 'Chrr …'], barkEvery: 5200,
      talk: async w => { await w.think('Sogar im Schlaf runzelt er die Stirn.'); },
    },
  ],
  interactables: [
    {
      id: 'bach', verb: 'Waschen', once: false, radius: 30, poly: [[134, 124], [196, 116], [206, 146], [152, 152]],
      standAt: [184, 138], face: 'left', when: () => !G.state.is('k4-gewaschen'), onInteract: wash,
    },
    {
      id: 'ferse', verb: 'Ferse versorgen', once: false, radius: 24, poly: [[346, 104], [478, 112], [482, 130], [346, 124]],
      standAt: [452, 138], face: 'down', when: () => G.state.is('k4-gewaschen') && !G.state.is('k4-ferse'), onInteract: tendHeel,
    },
    {
      id: 'spitzwegerich', verb: 'Pflücken', once: true, radius: 22, sparkle: true, poly: [[228, 262], [252, 258], [258, 276], [232, 280]],
      when: () => G.state.has('book-herbs'), onInteract: pickPlantain,
    },
    {
      id: 'kraut', verb: 'Ansehen', once: true, radius: 22, poly: [[228, 262], [252, 258], [258, 276], [232, 280]],
      when: () => !G.state.has('book-herbs'),
      thought: 'Grünzeug mit breiten, gerippten Blättern. Mutter wüsste, wofür das gut ist. Hätte ich nur ihr Kräuterbuch eingepackt.',
    },
  ],
  exits: [{
    id: 'pfad', poly: [[516, 0], [562, 0], [562, 10], [516, 10]], to: 'k4-bach', spawn: 'start',
    when: () => false, blocked: 'Allein? Ich weiß nicht mal, wohin der Pfad führt.',
  }],
  spawns: { start: { at: [468, 196], dir: 'down' } },
  time: 'dawn',
  weather: 'none',
  ambience: ['stream', 'birds', 'wind'],
  ambienceVolume: { stream: 0.9, wind: 0.35 },
  music: 'refuge',
  lights: [{ id: 'sonne', at: [600, 10], kind: 'plain', radius: 260, color: 0xffd9a0, intensity: 0.35, always: true }],
});

async function wash(w: WorldCtx): Promise<void> {
  await w.player.play('kneel', { ms: 500 });
  w.player.setIdle('kneel');
  sfx('splash', { volume: 0.7 });
  w.fx.burst([166, 136], 'splash', 8);
  await w.wait(450);
  sfx('splash', { volume: 0.9, pitch: 1.1 });
  w.fx.burst([166, 136], 'splash', 10);
  await w.think('Eiskalt! … Aber endlich bin ich wach.');
  await w.think('Im Wasser sieht mich ein müdes Mädchen an. Kyra hätte mich jetzt nassgespritzt.');
  G.state.addMemory('k4-mem-weiher');
  if (G.state.has('ribbon')) {
    await w.think('Ich halte Kyras Haarband ins Morgenlicht. Ich bringe es dir zurück. Versprochen.');
  }
  w.player.setIdle('idle');
  G.state.set('k4-gewaschen');
}

async function pickPlantain(w: WorldCtx): Promise<void> {
  await w.player.play('kneel', { ms: 600 });
  G.state.set('k4-spitzwegerich');
  await w.think('Spitzwegerich! Seite 112 im Kräuterlexikon: „Zerrieben aufgelegt, kühlt er Blasen und wunde Haut.“');
}

async function tendHeel(w: WorldCtx): Promise<void> {
  w.player.setIdle('sit');
  await w.wait(300);
  await w.think('Der Verband ist schmutzig, aber die Wunde hat sich geschlossen. Die Kruste löst sich schon.');
  const pick = await w.choose([
    { text: 'Mutters Tinktur auftragen', tag: 'Tinktur', disabled: !G.state.has('tincture'), reason: 'Die Tinktur ist weg.' },
    { text: 'Spitzwegerich auflegen', tag: 'Kräuterlexikon', disabled: !G.state.is('k4-spitzwegerich'), reason: G.state.has('book-herbs') ? 'Ich bräuchte frischen Spitzwegerich.' : 'Dafür fehlt mir Mutters Buch.' },
    'Nur die Füße ins kalte Wasser halten',
  ]);
  if (pick === 0) {
    await G.ui.hold('Halte still – es brennt!', 2200, { struggle: true, onRelease: () => sfx('hit', { volume: 0.25, pitch: 1.6 }) });
    sfx('heal', { volume: 0.6 });
    await w.think('Autsch. Mutter hat dabei immer gepustet. Und gesagt, dass es nur brennt, solange es hilft.');
  } else if (pick === 1) {
    sfx('heal', { volume: 0.7 });
    G.state.set('k4-kraeuterkunde');
    await w.think('Zerdrückt und aufgelegt, wie im Lexikon. Es kühlt sofort. Mutter hätte genickt.');
  } else {
    sfx('splash', { volume: 0.5, pitch: 0.8 });
    await w.think('Kalt, aber gut. Meine Beine sehen aus wie eine Reisechronik: jeder Sturz ein blauer Fleck.');
  }
  await w.think('Lederschuhe an, Bänder um die Knöchel. Fertig.');
  w.player.setIdle('idle');
  G.state.set('k4-ferse');
}

/** Morning: wash, tend the heel, then the companions wake up and the blindfold comes. */
export async function morgenSkript(w: WorldCtx): Promise<void> {
  if (!G.state.is('k4-morgen-intro')) {
    await w.cutscene(async () => {
      w.player.setIdle('lie');
      await w.wait(900);
      await w.think('Kaum geschlafen. Zu viele Gedanken. Ob Kyra wohl auch wach liegt?');
      w.player.setIdle('idle');
      await w.wait(300);
      await w.think('Die beiden schnarchen um die Wette. Zeit, mich am Bach frisch zu machen.');
    });
    G.state.set('k4-morgen-intro');
  }
  if (!G.state.is('k4-gewaschen')) {
    w.setObjective('k4-waschen', 'Wasch dich am Bach.', 'bach');
    await w.waitForInteract('bach');
    while (!G.state.is('k4-gewaschen')) await w.wait(200);
    w.completeObjective('k4-waschen');
  }
  if (!G.state.is('k4-ferse')) {
    w.setObjective('k4-ferse', 'Versorge deine wunde Ferse am Baumstamm.', 'ferse');
    while (!G.state.is('k4-ferse')) await w.wait(200);
    w.completeObjective('k4-ferse');
  }
  await aufbruch(w);
}

async function aufbruch(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  const foltan = w.actor('foltan');
  await w.cutscene(async () => {
    azar.hold(); foltan.hold();
    azar.setIdle('idle');
    bg(azar.emote('!'));
    await azar.hop();
    await azar.say('Hm? Was? Wo ist … Lia?! Foltan, das Mädchen ist weg!', { mood: 'worried' });
    azar.face('player');
    w.player.face('azar');
    bg(azar.emote('drop'));
    await azar.walkTo(w.player.x - 34, w.player.y + 6, { run: true });
    await azar.say('Ach, da bist du ja! Ich habe dich gesucht. Also … gerade eben. Sehr gründlich.', { mood: 'happy' });
    await lia(w, 'Als ich aufgestanden bin, wart ihr noch schwer damit beschäftigt, den ganzen Wald abzuholzen.');
    bg(azar.emote('?'));
    await azar.say('Abzuholzen?');
    await lia(w, 'Ihr habt geschnarcht. Beide. Laut.', 'happy');
    await azar.say('Ich schnarche nicht. Ich atme nur mit Überzeugung.', { mood: 'happy' });
    if (G.state.is('k4-kraeuterkunde')) {
      await azar.say('Riecht hier nach … Kräutern? Du hast deine Ferse selbst verarztet? Mit Grünzeug? Donnerwetter.', { mood: 'surprised' });
    }
    foltan.setIdle('idle');
    await foltan.walkTo(w.player.x + 34, w.player.y + 4);
    foltan.face('player');
    await foltan.say('Genug geplaudert. Wir brechen auf. Bis zum Lager ist es nicht mehr weit.');
    await foltan.say('Vorher: die Binde. Kein Fremder darf den Weg zum Lager kennen.');
    const pick = await w.choose(['„Ihr vertraut mir also nicht.“', '„Soll ich mir auch die Ohren zuhalten?“', '„Und wenn ich gegen einen Baum laufe?“']);
    if (pick === 0) {
      await azar.say('Ich schon! Aber die anderen müssen wir erst noch überzeugen.', { mood: 'sad' });
      await foltan.say('So sind die Regeln. Ein falsches Wort, und das ganze Lager hängt.');
    } else if (pick === 1) {
      await foltan.say('Bei Azars Geplapper wäre das fast eine Gnade.');
      bg(azar.emote('anger'));
      await azar.say('He! Mein Geplapper hat dich schon zweimal vor Langeweile gerettet.');
    } else {
      await azar.say('Dann hörst du ihn vorher! Bäume rascheln. Meistens.', { mood: 'happy' });
      await foltan.say('Dann weißt du, wo einer steht.');
    }
    await foltan.say('Azar geht vor. Folge seiner Stimme. Ich bleibe hinter dir.');
    await lia(w, 'Na gut. Aber wenn ich mir die Nase breche, trägst du mich.', 'determined');
    await w.think('Das Tuch riecht nach Rauch und Leder. Dann wird es dunkel.');
  });
  G.state.set('k4-morgen-done');
  w.completeObjective('k4-ferse');
  await G.ui.fade('out', 900);
  halt(w, ['azar', 'foltan']);
  await G.goto('augenbinde', { part: 'binde' });
}

// ---------------------------------------------------------------------------------------------------------------
// Map 2: the forest path, walked blind (1280×720; reused at night for the flight in „verrat“)
// ---------------------------------------------------------------------------------------------------------------

export const PATH: [number, number][] = [
  [346, 720], [336, 650], [318, 600], [324, 545], [358, 500], [404, 462], [440, 425], [470, 400], [510, 372], [560, 355],
  [600, 356], [660, 358], [715, 362], [760, 368], [820, 360], [875, 342], [920, 312], [952, 286], [968, 262], [985, 232],
  [1010, 200], [1040, 170], [1048, 140], [1030, 110], [1015, 80], [1028, 45], [1048, 10], [1052, 0],
];
const BRANCH: [number, number][] = [[500, 366], [455, 325], [405, 292], [355, 262], [300, 232], [266, 218]];
/** The gap under the fallen trunk: walking through it upright hurts. */
export const DUCK_ZONE: [number, number][] = [[936, 282], [966, 240], [988, 214], [1008, 232], [986, 268], [960, 304]];
const STREAM: [number, number][] = [[640, 0], [650, 120], [640, 240], [650, 356], [660, 480], [700, 600], [720, 720]];

export const waldpfadBase = {
  background: 'k4-waldpfad',
  walk: [...corridor(PATH, 24), ...corridor(BRANCH, 20)],
  surfaces: [
    { id: 'furt', kind: 'shallow' as const, poly: [[590, 330], [724, 334], [726, 388], [588, 386]] as [number, number][] },
    ...[[610, 348], [652, 347], [694, 349], [606, 367], [648, 368], [688, 368], [726, 366]].map(([x, y], i) => ({
      id: `stein-${i}`, kind: 'stone' as const, poly: [[x - 15, y - 6], [x + 15, y - 6], [x + 16, y + 6], [x - 15, y + 7]] as [number, number][],
    })),
  ],
  surface: 'dirt' as const,
  occluders: [
    { id: 'stamm', baseline: 272, fade: 0.5, poly: [[800, 236], [840, 214], [960, 196], [1060, 164], [1112, 168], [1104, 206], [1000, 244], [930, 262], [826, 274]] as [number, number][] },
  ],
};

export const waldpfad = defineMap({
  ...waldpfadBase,
  id: 'k4-waldpfad',
  name: 'Im Wald, mit verbundenen Augen',
  npcs: [{ id: 'azar', preset: 'azar', at: [334, 640], dir: 'up', solid: false, speed: 40 }],
  spawns: { binde: { at: [342, 700], dir: 'up' } },
  time: 'day',
  ambience: ['wind', 'birds', 'stream'],
  ambienceVolume: { stream: 0.25, birds: 0.7 },
  music: null,
  sneak: true,
  resetOnEnter: true,
});

interface Leg { at: [number, number]; intro?: string; arrive?: (w: WorldCtx, b: Blindfold) => Promise<void> }

const AZAR = { pitch: 105, wave: 'square' as OscillatorType, color: RING.azar, name: 'Azar' };
const FOLTAN = { pitch: 150, wave: 'triangle' as OscillatorType, color: RING.foltan, name: 'Foltan' };
const STRANGER = { pitch: 175, wave: 'sine' as OscillatorType, color: RING.stranger, name: 'Fremde Stimme' };

/** Nearest point of the brook (for its sound and rings). */
function nearestStream(x: number, y: number): [number, number] {
  let best: [number, number] = STREAM[0];
  let bd = Infinity;
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, ay] = STREAM[i], [bx, by] = STREAM[i + 1];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
    const d = Math.hypot(px - x, py - y);
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return best;
}

export function inPoly(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The blindfolded walk. */
export async function blindSkript(w: WorldCtx): Promise<void> {
  const ui = G.ui as UiApiExt;
  const b = new Blindfold(w);
  await b.set(1);
  void ui.fade('in', 500);
  const azar = w.actor('azar');
  const st = { bumps: 0, wet: false, branchWarned: false, lastCall: 0, ducked: false, bonks: 0, far: 0 };
  const say = (text: string, ms?: number) => b.voice('azar', text, { ...AZAR, ms });
  const fsay = (text: string, ms?: number) => b.voice('foltan', text, { ...FOLTAN, ms });
  const me = (text: string, ms = 1600) => { w.bark('player', text, ms); };

  b.onBump = () => {
    st.bumps++;
    G.state.inc('k4-beulen');
    b.pain();
    const p = w.player;
    b.soundAt(st.bumps % 2 ? 'thud' : 'rustle', p.x, p.y - 8, RING.leaves, 0.9);
    const lines = ['Au!', 'Autsch, Dornen!', 'Wer stellt hier Bäume hin?!', 'Uff. Ein Busch.', 'Meine Nase …'];
    me(lines[(st.bumps - 1) % lines.length]);
    if (st.bumps === 2) void say('Oh je! Alles heil? Hier lang, zu mir!');
    else if (st.bumps === 4) void fsay('Langsamer. Hör hin, bevor du gehst.');
    else if (st.bumps === 6) void say('Die Bäume werden dich vermissen. Folge meiner Stimme!');
  };

  // Continuous senses: the brook, Azar's footsteps, wet feet, the dead-end branch, ducking, straying.
  let tick = 0, stepT = 0, streamT = 0, lastStreamVol = -1, lastAzarX = azar.x;
  let bonkCool = 0;
  const onUpdate = (_t: number, delta: number) => {
    if (!w.alive) return;
    const dt = delta / 1000;
    tick += dt; stepT += dt; streamT += dt; bonkCool -= dt;
    const p = w.player;
    // brook
    const [sx, sy] = nearestStream(p.x, p.y);
    const sd = Math.hypot(sx - p.x, sy - p.y);
    if (streamT > 1.6 && sd < 340) { streamT = 0; b.rippleAt(sx, sy, RING.water, Math.max(0.3, 1 - sd / 340)); }
    const vol = Math.round(Math.max(0.15, 1.1 - sd / 300) * 10) / 10;
    if (vol !== lastStreamVol && tick > 0.5) {
      lastStreamVol = vol;
      try { G.audio.ambience(['wind', 'birds', 'stream'], { fadeMs: 600, volume: { stream: vol, birds: 0.7 } }); } catch { /* */ }
    }
    // Azar's footsteps
    if (azar.exists && stepT > 0.5 && b.covered) {
      const moving = Math.abs(azar.x - lastAzarX) > 0.5;
      lastAzarX = azar.x;
      stepT = 0;
      if (moving) b.rippleAt(azar.x, azar.y, RING.azar, 0.35);
    }
    const terr = (w.scene as unknown as { terrainAt(x: number, y: number): string | undefined }).terrainAt(p.x, p.y);
    if (terr === 'shallow' && !st.wet) {
      st.wet = true;
      me('Iiih! Nasse Füße!');
      void say('Die Steine, Lia! Von Stein zu Stein!');
    }
    // the dead-end branch towards the old oak
    if (!st.branchWarned && p.x < 470 && p.y < 345 && p.y > 200) {
      st.branchWarned = true;
      void say('Nicht da lang! Da geht es nur zur alten Eiche. Hierher, zu mir!');
    }
    // the fallen trunk: duck (sneak) or bonk
    if (bonkCool <= 0 && inPoly(p.x, p.y, DUCK_ZONE)) {
      if (sneakHeld(w)) {
        if (!st.ducked) { st.ducked = true; b.soundAt('rustle', p.x, p.y - 30, RING.leaves, 0.5); me('Moos am Hinterkopf … geschafft.'); }
      } else {
        bonkCool = 1.4;
        st.bonks++;
        b.pain();
        b.soundAt('thud', p.x, p.y - 30, RING.pain, 1.1);
        me(st.bonks === 1 ? 'AU! Mein Kopf!' : 'Schon wieder …!');
        void fsay(st.bonks === 1 ? `Ducken, hat er gesagt. (${w.controlHint('sneak')} halten)` : 'Tiefer. Ganz unten durch.');
        // push back out of the gap
        w.player.teleport([p.x - 14, p.y + 16]);
      }
    }
    // straying far from Azar
    if (azar.exists) {
      const d = Math.hypot(azar.x - p.x, azar.y - p.y);
      st.far = d > 230 ? st.far + dt : 0;
    }
  };
  w.scene.events.on('update', onUpdate);
  w.scene.events.once('shutdown', () => w.scene.events.off('update', onUpdate));

  w.setObjective('k4-stimme', 'Folge Azars Stimme durch den Wald.', null);
  await w.say('narrator', 'Dunkelheit. Nur Geräusche. Folge Azars Stimme: Sie kommt von links, rechts oder vorn. Ringe im Dunkeln zeigen, woher ein Klang kommt.');
  await w.say('narrator', 'Kopfhörer helfen. Läufst du gegen etwas, spürst du es.');
  await say('Ich gehe vor. Folge einfach meiner Stimme, Lia!');

  const legs: Leg[] = [
    { at: [318, 596], intro: 'Hier! Geradeaus!' },
    { at: [358, 500], intro: 'Jetzt ein Stück nach rechts. Hörst du mich?' },
    {
      at: [470, 400], intro: 'Weiter so! Hier ist der Boden schön hart.',
      arrive: async () => {
        b.soundAt('rustle', w.player.x - 120, w.player.y - 30, RING.leaves, 1.2);
        await ui.wait(250);
        me('Was war das?!');
        await ui.wait(900);
        await say('Ein Reh, glaube ich. Oder ein sehr dünner Bär.');
        await fsay('Ein Reh.');
      },
    },
    { at: [566, 355], intro: 'Hörst du den Bach? Da müssen wir rüber.' },
    {
      at: [742, 366], intro: 'Jetzt über die Steine. Große Schritte, ich bin auf der anderen Seite!',
      arrive: async () => { await blinzeln(w, b, fsay); },
    },
    { at: [918, 314], intro: 'Hier entlang! Gleich wird es eng.' },
    {
      at: [1012, 198],
      intro: `Achtung! Ein umgestürzter Baum. Kopf runter und unten durch! (${w.controlHint('sneak')} halten)`,
    },
    { at: [1040, 112], intro: 'Geschafft! Jetzt bergauf, nicht mehr weit.' },
    { at: [1036, 52], intro: 'Da vorne ist es.' },
  ];

  for (const leg of legs) {
    if (leg.intro) void say(leg.intro);
    await azar.walkTo(leg.at[0], leg.at[1]);
    azar.face('player');
    let since = 0;
    while (Math.hypot(azar.x - w.player.x, azar.y - w.player.y) > 54) {
      await w.wait(250);
      since += 250;
      if (since > 3600 && !G.ui.busy()) {
        since = 0;
        void say(callLine(b, azar.x, azar.y));
      }
      if (st.far > 6) {
        st.far = 0;
        await fsay('Falsche Richtung. Komm, ich bring dich zurück.');
        await ui.wait(400);
        w.player.teleport([azar.x - 6, azar.y + 30], 'up');
        void say('Da bist du ja wieder!');
      }
    }
    if (leg.arrive) await leg.arrive(w, b);
  }
  w.completeObjective('k4-stimme');

  // Arrival: voices ahead, the password, the gate.
  w.lockPlayer();
  await fsay('Da vorne ist es. Bleib stehen.');
  await ui.wait(300);
  b.ripple(320, 60, RING.stranger, 1.4);
  await b.voice(null, 'Halt! Wer da?', { ...STRANGER, ms: 1500 });
  await fsay('Foltan und Azar. Und ein Gast.');
  await b.voice(null, 'Losung?', { ...STRANGER, ms: 1200 });
  await fsay('Asche und Eichenlaub.');
  sfx('door', { volume: 0.9, pitch: 0.7 });
  b.ripple(320, 70, RING.stranger, 2);
  await ui.wait(600);
  const bumps = G.state.flag<number>('k4-beulen') ?? 0;
  await say(bumps <= 2 ? 'Du hast es geschafft, Lia. Du läufst ja wie eine Katze!' : 'Du hast es geschafft, Lia. Die Bäume werden dich vermissen.');
  G.state.set('k4-augenbinde-done');
  await ui.fade('out', 700, '#fff8e8');
  halt(w, ['azar']);
  await G.goto('bruderschaft');
}

/** Halfway: the blindfold slips for a moment and Lia glimpses the forest. */
async function blinzeln(w: WorldCtx, b: Blindfold, fsay: (t: string, ms?: number) => Promise<void>): Promise<void> {
  const ui = G.ui as UiApiExt;
  w.lockPlayer();
  w.bark('player', 'Die Binde rutscht …', 1200);
  await ui.wait(700);
  await b.set(0, 380);
  sfx('whoosh', { volume: 0.4 });
  await ui.wait(400);
  await w.think('Licht! Moos, Farn, ein schmaler Pfad nach Nordosten … und ein riesiger umgestürzter Baum.');
  G.state.set('k4-blinzeln');
  void fsay('Die Binde! Sofort!', 1300);
  await ui.wait(500);
  await b.set(1, 260);
  w.bark('player', 'Ich hab nichts gesehen. Fast nichts.', 1800);
  w.unlockPlayer();
}

/** Azar calls from where he stands: the words tell the direction too. */
function callLine(b: Blindfold, x: number, y: number): string {
  const e = b.ear(x, y);
  if (e.pan < -0.45) return 'Hier drüben! Links von dir!';
  if (e.pan > 0.45) return 'Mehr nach rechts, Lia!';
  return e.dist > 120 ? 'Geradeaus! Ich warte hier.' : 'Fast da, noch ein paar Schritte!';
}
