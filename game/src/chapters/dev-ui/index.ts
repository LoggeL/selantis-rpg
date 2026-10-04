import { registerAbilities, registerClues, registerItems, registerLore, registerMemories } from '../../core/catalog';
import { G } from '../../core/G';
import { defineChapter } from '../../core/registry';
import type { UiApiExt } from '../../ui';
import type TitleScene from '../../scenes/TitleScene';
import { drawSelantisMap } from './map';

/**
 * Hidden dev chapter: a guided tour of every UI building block.
 * ?scene=ui-demo starts it; ?scene=ui-demo&step=<name> jumps to a step (see STEPS).
 */

/**
 * Sample catalog entries. Registered lazily when the demo starts (never at import time), so they never
 * appear in the real game's journal; ids start with demo- (the journal ignores those as missing entries).
 */
let catalogRegistered = false;
function registerCatalog(): void {
  if (catalogRegistered) return;
  catalogRegistered = true;
  registerItems([
    { id: 'demo-alana', name: 'Die Geschichten der Magierin Alana', icon: 'book', description: 'Ein abgegriffenes Buch mit Goldprägung. Vater hat es vom Markt in Trapas mitgebracht.', comment: 'Ich habe es schon dreimal gelesen. Beim vierten Mal merke ich mir vielleicht endlich alle Namen.' },
    { id: 'demo-lexikon', name: 'Cronibus großes Kräuterlexikon', icon: 'herb-book', description: 'Schwer, dick und voller gepresster Blätter. Mutters wertvollstes Buch.', comment: 'Speikraut gegen Entzündungen. Ich wusste, dass das irgendwann nützlich wird.' },
    { id: 'demo-kuchen', name: 'Honig-Apfelkuchen', icon: 'cake', description: 'Noch warm, in ein Tuch geschlagen.', comment: 'Mein Lieblingskuchen. Kyra bekommt die Hälfte. Vielleicht.' },
    { id: 'demo-zunder', name: 'Zunder', icon: 'tinder', description: 'Getrockneter Baumschwamm in einer kleinen Dose.', comment: 'Ohne den wird das mit dem Feuer schwierig.' },
    { id: 'demo-muenzen', name: 'Kupfermünzen', icon: 'coins', description: 'Ein paar Münzen aus dem Geheimfach im Küchenschrank.' },
  ]);
  registerMemories([
    { id: 'demo-mem-kuchen', title: 'Honig und Äpfel', text: 'Jedes Mal, wenn Vater vom Markt zurückkam, roch der ganze Karren nach Honig. Kyra und ich rannten ihm schon am Hohlweg entgegen.' },
    { id: 'demo-mem-lesen', title: 'Lesestunden', text: 'Mutter saß mit uns am Küchentisch und zeigte auf die Buchstaben. Kyra lief immer nach dem dritten Wort weg.' },
    { id: 'demo-mem-fest', title: 'Zu jung für das Fest', text: 'Das Verbannungsfest in Trapas. „Nächstes Jahr“, hatte Vater gesagt. Jedes Jahr.' },
  ]);
  registerLore([
    { id: 'demo-lore-crios', title: 'Crios', text: 'Der hellste Stern am Himmel steht immer im Westen. Er ist nach dem treuen Adler des Aros benannt, des ersten Menschen, der ihm half, Xenovia zu stürzen.' },
    { id: 'demo-lore-urmacht', title: 'Die Urmacht', text: 'Eine uralte Kraft, die die ersten zehn Menschen ihrer Schöpferin nahmen und in einer Höhle versiegelten. Sie wählt ihre Trägerin selbst.' },
  ]);
  registerClues([
    { id: 'demo-clue-hufe', title: 'Frische Hufspuren', text: 'Mindestens fünf Pferde, beschlagen. Sie kamen von der Straße her und führen zum Hof.' },
  ]);
  registerAbilities([
    { id: 'demo-spurenblick', name: 'Spurenblick', key: 'Q', description: 'Lia sieht genau hin: Die Welt verblasst, Spuren und Hinweise leuchten auf.' },
  ]);
  ui().registerItemAction('demo-kuchen', {
    label: 'Essen',
    run: async () => {
      G.state.take('demo-kuchen');
      try { G.audio.sfx('eat'); } catch { /* audio optional */ }
      await G.ui.think('Mmh. Kyra bekommt die andere Hälfte. Ganz bestimmt.');
    },
  });
  ui().registerItemAction('demo-zunder', {
    label: 'Feuer machen',
    when: () => false,
    reason: 'Hier ist keine Feuerstelle. Und Mutter würde mich umbringen.',
    run: () => {},
  });
}

const ui = () => G.ui as UiApiExt;
/** Scene-safe sleep: never resolves once the player left the demo (title, warp), so the script stops. */
const sleep = (ms: number) => ui().wait(ms);
const title = () => G.game.scene.getScene('Title') as TitleScene | null;

let platesRegistered = false;
function registerPlates(): void {
  if (platesRegistered) return;
  platesRegistered = true;
  G.ui.registerPlate('dev-selantis-karte', drawSelantisMap);
}

type Step = [name: string, run: () => Promise<void>];

const STEPS: Step[] = [
  ['card', async () => {
    await ui().fade('out', 0);
    await G.ui.chapterCard('I', 'Der letzte Sommertag', 'Eine Vorführung der Chronik');
    ui().setHud('explore');
    await G.ui.fade('in', 900);
  }],
  ['narrate', async () => {
    G.state.objective('demo-karte', 'Sieh dir Mutters Karte von Selantis an');
    await sleep(600);
    await G.ui.narrate([
      'Es war der letzte Tag des Sommers. Seit Tagen war kein Regen gefallen, und über den Feldern flirrte die Hitze.',
      'Lia saß unter dem alten Apfelbaum und las. Die Welt in ihren Büchern war immer größer gewesen als die echte – *bis heute*.',
    ]);
  }],
  ['plate', async () => {
    await G.ui.plate('dev-selantis-karte', { caption: 'Selantis, wie Mutter es zeichnete', pan: 'right', durationMs: 22000 });
    await G.ui.say('lia', 'Trapas im Westen, Portas im Osten. Und wir mittendrin, wo nie etwas passiert.', { mood: 'happy' });
    await G.ui.say('kyra', 'Du träumst schon wieder. Die Schweine füttern sich nicht von allein!', { mood: 'angry' });
    const pick = await G.ui.choose([
      '„Nur noch ein Kapitel, versprochen!“',
      { text: '„Soll ich dir was vorlesen?“', disabled: true, reason: 'Kyra hat für Bücher gerade keine Geduld.' },
      { text: '„Ich weiß, wo das Speikraut wächst.“', tag: 'Kräuterlexikon' },
      '„Schon gut, ich komme ja.“',
    ]);
    if (pick === 0) await G.ui.say('kyra', 'Das sagst du jedes Mal. *Jedes. Mal.*', { mood: 'angry' });
    else if (pick === 2) await G.ui.say('kyra', 'Angeberin. Aber gut, zeig es mir nachher.', { mood: 'happy' });
    else await G.ui.say('kyra', 'Na also. Wer zuerst am Gatter ist!', { mood: 'happy' });
    await G.ui.say('narrator', 'Über Selantis stand Crios, wie immer im Westen. Niemand ahnte, wie bald sich alles ändern würde.');
    await G.ui.closePlate();
    G.state.complete('demo-karte');
    await sleep(400);
    G.state.objective('demo-rest', 'Entdecke, was die Chronik noch kann');
  }],
  ['think', async () => {
    await G.ui.think('Irgendwann sehe ich mehr von der Welt als nur diesen Hof.');
  }],
  ['toasts', async () => {
    G.state.give('demo-alana');
    await sleep(650);
    G.state.give('demo-lexikon');
    await sleep(650);
    G.state.addMemory('demo-mem-kuchen');
    await sleep(650);
    G.state.addLore('demo-lore-crios');
    await sleep(650);
    G.state.addClue('demo-clue-hufe');
    await sleep(650);
    G.state.learn('demo-spurenblick');
    G.state.give('demo-kuchen');
    G.state.give('demo-muenzen', 22);
    G.state.give('demo-zunder');
    G.state.addMemory('demo-mem-lesen');
    G.state.addLore('demo-lore-urmacht');
    await sleep(1800);
  }],
  ['world', async () => {
    const t = title();
    const removeA = G.ui.bubble('Lia! Kyra! Abendessen!', () => t?.anchor('house') ?? { x: 400, y: 180 }, 4200);
    await sleep(1200);
    G.ui.bubble('Sssst …', () => t?.anchor('firefly') ?? null, 3000);
    const tree = t?.anchor('tree') ?? { x: 160, y: 180 };
    G.ui.hint({ verb: 'Untersuchen', x: tree.x, y: tree.y - 8 });
    G.ui.objectivePointer({ x: 640, y: 120 });
    await sleep(3400);
    G.ui.hint(null);
    G.ui.objectivePointer(null);
    removeA();
  }],
  ['hold', async () => {
    G.ui.letterbox(true);
    await G.ui.say('narrator', 'Reiter auf dem Hohlweg. Lia presst sich in die Böschung.');
    await G.ui.hold('Halte still', 2400, {
      struggle: true,
      onRelease: () => { try { G.audio.sfx('branch-snap'); } catch { /* audio optional */ } },
    });
    await G.ui.say('lia', 'Sie … sie sind vorbeigeritten.', { mood: 'scared' });
    G.ui.letterbox(false);
  }],
  ['caption', async () => {
    await G.ui.narrate(['Er übergab die ~Urmacht~ dem Unschuldigsten und Wehrlosesten, was er finden konnte …'], { style: 'card' });
    await G.ui.fade('out', 900);
    await G.ui.caption('Sechzehn Jahre später', 2200);
    await G.ui.fade('in', 900);
    G.state.complete('demo-rest');
  }],
  ['menu', async () => {
    for (;;) {
      const i = await G.ui.choose([
        'Tagebuch öffnen',
        'Tasche öffnen',
        'Noch einmal von vorn',
        'Frei umsehen (HUD-Test)',
        'Zum Titel',
      ], { speaker: 'narrator', prompt: 'Was möchtest du dir noch ansehen?' });
      if (i === 0) { G.ui.openJournal(); await sleep(50); await ui().whenIdle(); }
      else if (i === 1) { G.ui.openBag(); await sleep(50); await ui().whenIdle(); }
      else if (i === 2) { await runFrom(0); return; }
      else if (i === 3) { await freeLook(); }
      else { const m = await import('../../scenes/BootScene'); await m.showTitle(); return; }
    }
  }],
];

async function freeLook(): Promise<void> {
  ui().setHud('explore');
  G.state.objective('demo-frei', 'Drück J, I oder Esc – oder warte kurz');
  const t = title();
  const tree = t?.anchor('tree') ?? { x: 160, y: 180 };
  G.ui.hint({ verb: 'Reden', x: tree.x, y: tree.y - 8 });
  await sleep(6000);
  await ui().whenIdle();
  G.ui.hint(null);
  G.state.complete('demo-frei');
}

async function runFrom(index: number): Promise<void> {
  for (let i = index; i < STEPS.length; i++) await STEPS[i][1]();
}

function prepareFor(step: number): void {
  // Give later steps the state earlier steps would have produced.
  if (step > STEPS.findIndex(s => s[0] === 'plate')) G.state.objective('demo-rest', 'Entdecke, was die Chronik noch kann');
  if (step > STEPS.findIndex(s => s[0] === 'toasts')) {
    for (const id of ['demo-alana', 'demo-lexikon', 'demo-kuchen', 'demo-zunder']) G.state.give(id);
    G.state.give('demo-muenzen', 22);
    G.state.addMemory('demo-mem-kuchen'); G.state.addMemory('demo-mem-lesen');
    G.state.addLore('demo-lore-crios'); G.state.addLore('demo-lore-urmacht');
    G.state.addClue('demo-clue-hufe'); G.state.learn('demo-spurenblick');
  }
}

async function startDemo(): Promise<void> {
  registerCatalog();
  registerPlates();
  G.stopGameplayScenes();
  G.game.scene.start('Title', { mode: 'backdrop' });
  ui().setHud('explore');
  const wanted = new URLSearchParams(location.search).get('step');
  const index = Math.max(0, STEPS.findIndex(s => s[0] === wanted));
  if (index > 0) {
    prepareFor(index);
    await ui().fade('in', 300);
  }
  await runFrom(index);
}

defineChapter({
  id: 'dev-ui',
  order: 901,
  numeral: 'Dev',
  title: 'Werkbank der Chronik',
  subtitle: 'UI-Vorführung',
  hidden: true,
  scenes: [
    { id: 'ui-demo', title: 'UI-Vorführung', start: startDemo },
    // Empty stage for e2e tests: backdrop only, no script (drive G.ui from the test).
    { id: 'ui-sandbox', title: 'Leere Bühne (Tests)', start: () => { registerCatalog(); registerPlates(); G.stopGameplayScenes(); G.game.scene.start('Title', { mode: 'backdrop' }); ui().setHud('explore'); } },
  ],
});
