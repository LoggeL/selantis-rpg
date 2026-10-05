// Scene 'leselager' — campfire in the thicket (DESIGN.md §7.4, Kapitel III/2; novel p. 60–67).
// Heart: gather stones for the fire ring, help Azar's fifth attempt by blowing on the tinder (minigame; Lia's own
// tinder makes it easier), prove that Lia can read (her packed books decide what she reads), the stars, the promise.
import { G } from '../../core/G';
import { defineMap, type MapDef, type WorldCtx } from '../../world';
import { bg, ambience, lia, music, sfx, ui } from './k3';
import { blowGame } from './panels';

const FIRE: [number, number] = [312, 208];
const STONES: [number, number][] = [[146, 165], [230, 114], [150, 232], [440, 128], [468, 140]];

export const leselagerMap: MapDef = defineMap({
  id: 'k3-leselager',
  name: 'Lager im Dickicht',
  background: 'k3-leselager',
  player: 'lia-cloak',
  baked: 'night',
  walk: [[
    [150, 140], [200, 110], [260, 100], [420, 100], [480, 110], [520, 140], [545, 190], [520, 240], [470, 262], [320, 268],
    [306, 290], [300, 360], [232, 360], [234, 290], [200, 262], [150, 250], [120, 215], [118, 170],
  ]],
  block: [
    { id: 'baumstamm', sight: false, poly: [[266, 138], [404, 142], [404, 162], [266, 158]] },
    { id: 'fels', poly: [[412, 192], [474, 192], [474, 214], [412, 214]] },
  ],
  occluders: [
    { id: 'baumstamm', baseline: 160, poly: [[262, 112], [408, 112], [408, 164], [262, 162]] },
    { id: 'fels', baseline: 214, poly: [[408, 172], [478, 172], [478, 216], [408, 216]] },
    { id: 'busch-sw', baseline: 360, poly: [[0, 236], [120, 226], [200, 262], [234, 290], [232, 360], [0, 360]] },
    { id: 'busch-so', baseline: 360, poly: [[306, 290], [320, 268], [470, 262], [560, 236], [640, 230], [640, 360], [300, 360]] },
  ],
  surfaces: [{ id: 'erde', kind: 'dirt', poly: [[262, 182], [362, 182], [370, 222], [262, 226]] }],
  surface: 'darkgrass',
  npcs: [
    { id: 'azar', preset: 'azar', at: [292, 214], dir: 'right', idle: 'kneel', talk: talkAzar, verb: 'Reden' },
    { id: 'foltan', preset: 'foltan', at: [266, 352], dir: 'up', hidden: true },
  ],
  interactables: [
    ...STONES.map((at, i) => ({
      id: `stein-${i + 1}`, at, verb: 'Aufheben', radius: 22, sparkle: true, once: true, prop: 'stones-pile', removeOnUse: true,
      onInteract: async (w: WorldCtx) => { await pickStone(w); },
    })),
    {
      id: 'feuerstelle', verb: 'Steine legen', once: false, radius: 30, poly: [[286, 192], [340, 192], [340, 216], [286, 216]],
      standAt: [292, 232], face: 'up', when: () => !G.state.is('k3-feuer'), onInteract: fireplace,
    },
  ],
  lights: [{ id: 'mond', at: [330, 20], kind: 'moon', radius: 240, intensity: 0.28 }],
  exits: [{ id: 'pfad', poly: [[236, 346], [298, 346], [298, 360], [236, 360]], to: 'k3-leselager', spawn: 'start', when: () => false, blocked: 'Nicht allein in den dunklen Wald. Nicht heute Nacht.' }],
  spawns: { start: { at: [266, 300], dir: 'up' } },
  time: 'night',
  weather: 'fireflies',
  ambience: ['night', 'crickets', 'wind'],
  ambienceVolume: { wind: 0.35 },
  music: null,
  playerLight: 64,
  critters: false,
  onEnter: async w => { if (G.state.is('k3-feuer')) addFire(w); },
});

function addFire(w: WorldCtx): void {
  w.addProp({ prop: 'campfire', at: FIRE, id: 'lagerfeuer' });
  w.lighting.add({ id: 'feuer', at: [FIRE[0], FIRE[1] - 8], kind: 'fire', radius: 160, intensity: 1.35, always: true });
}

const AZAR_FAILS = [
  'Gleich, gleich … *klack* … Pfff.',
  'Der Zunder ist feucht. Eindeutig feucht.',
  'Wer hat diesen Feuerstein gemacht? Ein Stümper!',
];

async function azarTry(w: WorldCtx, n: number): Promise<void> {
  const azar = w.actor('azar');
  sfx('spark', { volume: 0.35, pitch: 1.4 });
  w.fx.burst([FIRE[0] - 6, FIRE[1] - 4], 'sparkle', 4);
  await w.wait(250);
  w.fx.burst([FIRE[0] - 4, FIRE[1] - 6], 'smoke', 3);
  azar.bark(AZAR_FAILS[Math.min(n, AZAR_FAILS.length - 1)], 2600);
  G.state.set('k3-azar-versuche', n + 1);
}

async function pickStone(w: WorldCtx): Promise<void> {
  await w.player.play('kneel', { ms: 500 });
  G.state.give('k3-stein');
  const n = G.state.count('k3-stein');
  w.setObjective('k3-steine', `Sammle Steine für den Steinkreis (${n}/5).`, n >= 5 ? 'feuerstelle' : null);
  const tries = Number(G.state.flag('k3-azar-versuche') ?? 0);
  if ((n === 1 || n === 3 || n === 5) && tries < 3) bg(azarTry(w, tries));
  if (n >= 5) {
    w.completeObjective('k3-steine');
    w.setObjective('k3-feuer', 'Leg die Steine um die Feuerstelle.', 'feuerstelle');
  }
}

async function talkAzar(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar');
  if (G.state.count('k3-stein') < 5) {
    await azar.say(['Du suchst Steine? Gut. Ich bring das hier in Gang. Gleich. Bestimmt.', 'Noch einen Augenblick. Der Funke ziert sich.'][Number(G.state.flag('k3-azar-versuche') ?? 0) % 2]);
    return;
  }
  await azar.say('Leg die Steine um die Stelle, dann geht der Funke nicht verloren. Sagt man.');
}

async function fireplace(w: WorldCtx): Promise<void> {
  if (G.state.count('k3-stein') < 5) { await w.think(`Für einen Steinkreis brauche ich mehr Steine. (${G.state.count('k3-stein')}/5)`); return; }
  G.state.take('k3-stein', 5);
  w.completeObjective('k3-feuer');
  const azar = w.actor('azar'), foltan = w.actor('foltan');
  await w.cutscene(async () => {
    await w.player.play('kneel', { ms: 900 });
    sfx('stone-place');
    w.addProp({ prop: 'firering', at: FIRE, id: 'steinkreis' });
    await w.wait(300);
    w.player.teleport([280, 228], 'right');
    w.player.setIdle('sit');
    await azarTry(w, 3);
    await w.wait(900);
    await azar.say('Sag mal … für das, dass du in der Schenke so aufgetaut bist, bist du jetzt ganz schön still.');
    if (G.state.is('k3-luege-bemerkt')) {
      await lia(w, 'Kyra war dort, Azar. Ich weiß es. Und Foltan sagt, Craupor weiß nichts.', 'sad');
      void azar.emote('drop');
      await azar.say('Foltan … wird schon seine Gründe haben. Er ist ein guter Mann. Meistens.', { mood: 'worried' });
    } else {
      await lia(w, 'Ich hatte gehofft, dort etwas über Kyra zu erfahren. War dumm, ich weiß.', 'sad');
    }
    await azar.say('Quatsch. Hoffnung ist wichtig. Sie treibt auch Foltan und mich an.');
    await azar.say('Auch wenn wir nur ein Sandkorn sind. In der großen Sanduhr der Zeit.');
    // Foltan comes back with an armful of sticks.
    foltan.show();
    foltan.hold(true);
    await foltan.walkTo([350, 214], { face: 'left' });
    w.addProp({ prop: 'twigs', at: [338, 226], id: 'reisig' });
    await foltan.say('Da ist man einmal unterwegs, und schon wirst du zum Philosophen.', { mood: 'happy' });
    await foltan.say('Außerdem sind wir schon zwei Sandkörner. Mit der Bruderschaft sogar wesentlich mehr.');
    await azar.say('Lächerlich wenige gegen die Dunkelschatten. Aber das heißt nicht, dass wir nichts bewirken können.');
    await azar.say('Hoffnung kann Stürme beschwören!', { mood: 'happy' });
    await foltan.say('Es heißt: Berge versetzen.');
    const proverb = await w.choose(['„Glaube kann Berge versetzen.“', '„Hoffnung kann Stürme beschwören? Klingt nach einem Zauberbuch.“', '(Lächeln und schweigen)']);
    if (proverb === 0) {
      G.state.set('k3-sprichwort');
      await azar.say('Na da sieh an! Hier ist noch jemand schlauer als der feine Herr Foltan!', { mood: 'happy' });
    } else if (proverb === 1) {
      await azar.say('Klingt nach einem *guten* Zauberbuch. Ha!', { mood: 'happy' });
    } else {
      await azar.say('Siehst du, Foltan? Die Kleine lacht über dich.', { mood: 'happy' });
    }
    // Fifth try: Lia helps.
    await azar.say('So. Fünfter Anlauf. Jetzt aber.');
    sfx('spark', { volume: 0.5 });
    w.fx.burst([FIRE[0] - 4, FIRE[1] - 5], 'sparkle', 6);
    await azar.say('Da! Es glimmt! Lia, puste! Aber sanft, sanft!', { mood: 'surprised' });
    let withTinder = false;
    if (G.state.has('tinder')) {
      const t = await w.choose([{ text: '„Nimm meinen Zunder. Der ist trocken.“', tag: 'Zunder' }, '„Ich puste einfach.“']);
      withTinder = t === 0;
      if (withTinder) { await azar.say('Zunder aus der Küche? Du bist ein Schatz!', { mood: 'happy' }); G.state.set('k3-zunder-geteilt'); }
    }
    w.player.setIdle('kneel');
    await blowGame(withTinder);
    w.player.setIdle('sit');
    addFire(w);
    G.state.set('k3-feuer');
    w.fx.burst([FIRE[0], FIRE[1] - 6], 'sparkle', 10);
    ambience(['night', 'crickets', 'fire', 'wind'], { volume: { wind: 0.25 } });
    music('refuge', 2500);
    await w.wait(500);
    await azar.say('Jetzt hab ich’s! Warum nicht gleich so? Fünfter Anlauf. Genau wie geplant.', { mood: 'happy' });
    if (proverb === 0) await foltan.say('Ganz schön schlau für ein Bauernmädchen. „Glaube kann Berge versetzen.“ Woher hast du das?');
    else await foltan.say('Sag mal, Lia. Das mit dem Zauberbuch … du redest wie jemand, der viel gelesen hat.');
    await lia(w, 'Ich kenne viele Redewendungen. Aus Büchern.');
    void foltan.emote('?');
    await foltan.say('Aus Büchern? Kannst du etwa lesen?', { mood: 'surprised' });
    await lia(w, 'Ja. Was soll man denn sonst mit Büchern machen?');
    await azar.say('Natürlich! Du kannst lesen, und ich lasse ein gutes Essen verkommen! Hohoho!', { mood: 'happy' });
    await lia(w, 'Ich mache keinen Spaß. Meine Mutter hat es mir beigebracht. Hört her.', 'angry');
    G.state.addMemory('k3-mem-lesestunde');
    azar.setIdle('sit');
    azar.teleport([286, 198], 'right');
    foltan.setIdle('sit');
    foltan.teleport([346, 212], 'left');
    await reading(w);
    await stars(w);
  });
  await ui().fade('out', 1200);
  await G.ui.narrate(['Zwei Tagesritte weiter östlich brannte in derselben Nacht ein anderes Feuer.', 'Dort sang niemand von Sternen.'], { style: 'card' });
  await G.goto('kyra');
}

/** Lia proves she can read; what she reads depends on the books she packed (Kapitel I). */
async function reading(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar'), foltan = w.actor('foltan');
  const herbs = G.state.has('book-herbs'), alana = G.state.has('book-alana');
  const opts = [
    { text: 'Aus Cronibus großem Kräuterlexikon vorlesen', tag: 'Kräuterlexikon', disabled: !herbs, reason: 'Das Kräuterlexikon liegt zu Hause im Regal.' },
    { text: 'Das Ende der Alana-Geschichte vorlesen', tag: 'Alana-Buch', disabled: !alana, reason: 'Das Alana-Buch habe ich nicht eingepackt.' },
    { text: 'Ihre Namen in die Erde schreiben' },
  ];
  const pick = await w.choose(opts);
  w.player.setIdle(pick === 2 ? 'kneel' : 'sit');
  if (pick === 0) {
    G.state.set('k3-gelesen', 'kraeuter');
    await G.ui.narrate(['*„S“ wie Speikraut.* „Das gemeine Speikraut gehört zur Familie der Knöterichgewächse und ist auf Wiesen und am Waldrand zu finden.“',
      '„Seinen Namen erhielt es durch seine Wirkung: Unwohlsein bis hin zu heftigem Erbrechen. Genutzt wird es ausschließlich bei Vergiftungen.“'], { style: 'book' });
    G.state.addLore('k3-lore-speikraut');
    await lia(w, 'Soll ich weiterlesen, oder glaubt ihr mir jetzt?', 'happy');
  } else if (pick === 1) {
    G.state.set('k3-gelesen', 'alana');
  } else {
    G.state.set('k3-gelesen', 'namen');
    sfx('write', { volume: 0.8 });
    await w.say('narrator', 'Lia nimmt einen Zweig und kratzt Buchstaben in die weiche Erde am Feuer: A – Z – A – R.');
    void azar.emote('!');
    await azar.say('Das … das bin ich? Das bin ICH! Foltan, sieh dir das an!', { mood: 'surprised' });
    await foltan.say('Oder irgendwelche Kratzer.');
    sfx('write', { volume: 0.8 });
    await lia(w, 'F – O – L – T – A – N. Und jetzt halt still, sonst schreibe ich „Ziegenbart“ daneben.', 'happy');
  }
  void foltan.emote('…');
  await foltan.say('Ich bin beeindruckt. Sei uns nicht böse, aber jemand wie du, der lesen kann … Nicht mal wir beide können das.');
  await lia(w, 'Echt nicht?', 'surprised');
  await foltan.say('Lesen ist etwas für die hohen Herren. Ich habe es nie vermisst.');
  await azar.say('Ich schon. Dann hätte ich vielleicht nicht so viele Schulden gemacht.', { mood: 'sad' });
  await azar.say('Sag mal … kannst du uns etwas vorlesen? Eine richtige Geschichte?', { mood: 'happy' });
  if (alana) {
    if (pick === 0) await lia(w, 'Ich habe nur noch dieses Buch dabei. Es sei denn, ihr wollt noch mehr über Kräuter erfahren?', 'happy');
    await G.ui.narrate([
      '„Nachdem sie den Dämon gemeinsam in die Flucht geschlagen hatten, küsste die Magierin ihren Geliebten innig. In Riccard hatte sie endlich jemanden gefunden, der sie verstand.“',
      '„Alana und Riccard lebten viele Jahre in Imandur und forschten an der dortigen Magierakademie.“',
      '„Schließlich rief sie wieder die Pflicht, als sie im Jahre 256 vor Dunkelhain in den Rat der Zehn aufgenommen wurden. Aber das ist eine andere Geschichte.“',
    ], { style: 'book' });
  } else {
    await lia(w, 'Das Alana-Buch habe ich zu Hause gelassen. Aber das Ende kenne ich auswendig.');
    await G.ui.narrate([
      'Lia schließt die Augen. „Alana und Riccard schlugen den Dämon in die Flucht. Viele Jahre forschten sie an der Magierakademie von Imandur …“',
      '„… bis sie im Jahre 256 vor Dunkelhain in den Rat der Zehn aufgenommen wurden. Aber das ist eine andere Geschichte.“',
    ], { style: 'book' });
    await foltan.say('Auswendig. Natürlich.');
  }
  G.state.addLore('k3-lore-alana');
  w.player.setIdle('sit');
  await azar.say('Eine schöne Geschichte …', { mood: 'happy' });
  await foltan.say('Wenn es im Leben doch auch so ginge. Die Guten gewinnen, die Bösen werden bestraft. Mumpitz.');
  await lia(w, 'Vorne im Buch steht, dass die Geschichte auf wahren Tatsachen beruht.');
  await foltan.say('Alana und Riccard gab es wirklich. Aber all die Abenteuer? Ich halte das für Mumpitz.');
}

/** The stars, Lia's parents and the promise (novel p. 65–67). */
async function stars(w: WorldCtx): Promise<void> {
  const azar = w.actor('azar'), foltan = w.actor('foltan');
  try { ui().prefetchPlate('k3-sterne'); } catch { /* */ }
  await azar.say('Aber schöner Mumpitz. Ich glaube, die beiden sind immer noch vereint. Da oben sitzen sie, auf den Sternen.', { mood: 'happy' });
  await G.ui.plate('k3-sterne', { caption: 'Sterne über dem Dickicht', pan: 'in', durationMs: 26000 });
  await foltan.say('In der Tat … eine schöne Vorstellung.');
  await w.say('narrator', 'Eine kurze, stille Weile. Nur das Feuer knistert.');
  await lia(w, 'Meint ihr … meine Eltern sind auch da oben?', 'sad');
  await azar.say('Ja. Da bin ich mir sicher. Vielleicht auf dem Stern direkt neben Alana und Riccard. Sie wachen über dich.', { mood: 'sad' });
  await lia(w, 'Ich hatte kaum Zeit zu trauern. Nur wenn ich zu viel nachdenke, merke ich, dass sie nicht mehr da sind.', 'sad');
  await lia(w, 'Ich fühle mich allein. Mit einer Aufgabe, die ich nicht tragen kann. Aber Kyra braucht mich. Sie hat sonst niemanden.', 'sad');
  await azar.say('Wir verstehen dich. Wir haben doch gesagt, dass wir dir helfen, deine Schwester zu finden.', { mood: 'sad' });
  await lia(w, 'Versprecht ihr es mir? Nehmt ihr mich ernst, oder bin ich nur das dumme kleine Mädchen?', 'determined');
  await azar.say('Wir nehmen dich ernst. Ich verspreche es dir.');
  await foltan.say('Ich habe doch bereits versichert, dass …');
  const opts = ['„Foltan. Bitte.“', '(Ihn nur ansehen.)'];
  if (G.state.is('k3-luege-bemerkt')) opts.push('„Dann versprich es. Und sag mir die Wahrheit über Craupor.“');
  const pick = await w.choose(opts);
  if (pick === 2) {
    void foltan.emote('…');
    await foltan.say('Ich habe dir gesagt, was ich weiß.', { mood: 'angry' });
    G.state.set('k3-foltan-gelogen');
  } else if (pick === 1) {
    await w.think('Er hält meinem Blick nicht stand.');
  }
  void azar.emote('anger');
  await azar.say('Verspreche es!', { mood: 'angry' });
  await foltan.say('… Schön. Ich verspreche es dir auch.', { mood: 'ashamed' });
  G.state.set('k3-versprechen');
  await azar.say('Da siehst du, Kleine … ich meine: Lia. Du bist nicht mehr allein.', { mood: 'happy' });
  await G.ui.closePlate();
  if (G.state.is('k3-luege-bemerkt')) await w.think('Ein Versprechen. Ich werde dich daran erinnern, Foltan.');
  else await w.think('Ein Versprechen. Zum ersten Mal seit Tagen fühle ich mich nicht ganz allein.');
}

export async function leselagerScript(w: WorldCtx): Promise<void> {
  await w.narrate([
    'Sie entfernten sich vom Goldenen Eber, um den Dunkelschatten nicht über den Weg zu laufen, die dreist die Handelsstraßen nutzten.',
    'Im Schutz eines Dickichts schlugen sie ihr Nachtlager auf.',
  ], { style: 'card' });
  void ui().fade('in', 900);
  const azar = w.actor('azar'), foltan = w.actor('foltan');
  await w.cutscene(async () => {
    foltan.show();
    foltan.teleport([300, 300], 'up');
    await foltan.say('Ich suche trockenes Holz. Azar, du machst Feuer. Du hast doch den Feuerstein.');
    await azar.say('Feuer machen ist meine leichteste Übung!', { mood: 'happy' });
    foltan.hold(true);
    await foltan.walkTo([266, 352]);
    foltan.hide();
    await lia(w, 'Dann suche ich Steine für die Feuerstelle. Der Wald ist trocken wie Zunder.');
  });
  w.setObjective('k3-steine', 'Sammle Steine für den Steinkreis (0/5).', null);
}
