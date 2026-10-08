// Teil III „Falscher Glaube“: catalog entries (speakers, items, lore, clues, abilities, bag actions). Scene-specific
// clues and memories may be registered in the scene modules themselves, always with the e3- prefix.
import { G } from '../../core/G';
import { registerAbilities, registerClues, registerItems, registerLore, registerSpeakers } from '../../core/catalog';
import { registerItemAction } from '../../ui/bag';
import '../common';
import '../teil-2/catalog';
import { poisoned } from './shared';

registerSpeakers([
  { id: 'e3-lia', name: 'Lia', portrait: 'lia-cloak', voice: { pitch: 330, wave: 'triangle' }, color: '#d98b5f' },
  // Valentus' limited apparition (turquoise, translucent): same portrait and voice as in the prolog.
  { id: 'e3-valentus', name: 'Valentus', portrait: 'valentus', voice: { pitch: 110, wave: 'sine' }, color: '#5fe0d0' },
  { id: 'e3-grossmeister', name: 'Der Großmeister', portrait: 'e3-grossmeister', voice: { pitch: 105, wave: 'square' }, color: '#6f8fc8' },
  { id: 'e3-doktor', name: 'Der Doktor', portrait: 'e3-doktor', voice: { pitch: 150, wave: 'triangle' }, color: '#7a7a8a' },
  { id: 'e3-paladin', name: 'Paladin', portrait: 'paladin', voice: { pitch: 140, wave: 'square' }, color: '#c8d4e8' },
  { id: 'e3-hauptmann', name: 'Hauptmann der Wache', portrait: 'paladin', voice: { pitch: 120, wave: 'square' }, color: '#c8d4e8' },
  { id: 'e3-novize', name: 'Novize', portrait: 'paladin', voice: { pitch: 190, wave: 'triangle' }, color: '#c8d4e8' },
  { id: 'e3-heilerin', name: 'Heilerin des Ordens', portrait: 'villager-f', voice: { pitch: 260, wave: 'sine' }, color: '#b8c8a0' },
  { id: 'e3-gestalt', name: 'Die Gestalt', portrait: 'e3-gestalt', voice: { pitch: 300, wave: 'sine' }, color: '#e6eef5' },
  { id: 'e3-kyra', name: 'Kyra', portrait: 'kyra', voice: { pitch: 300, wave: 'triangle' }, color: '#b07a4f' },
  // The three goblins who caught Flick (comic relief, e3-waldgegner).
  { id: 'e3-ratz', name: 'Ratz', portrait: 'goblin-ratz', voice: { pitch: 150, wave: 'sawtooth' }, color: '#8a9a4a' },
  { id: 'e3-hotze', name: 'Hotze', portrait: 'goblin-hotze', voice: { pitch: 95, wave: 'sawtooth' }, color: '#9a8a4a' },
  { id: 'e3-fips', name: 'Fips', portrait: 'goblin-fips', voice: { pitch: 230, wave: 'square' }, color: '#6d9a6a' },
]);

registerItems([
  {
    id: 'e3-lia-staff', name: 'Lias Stab', icon: 'e3-lia-staff',
    description: 'Ein langer, fast weißer Stab mit spiralförmigen Segmenten und kantigen Zeichen, die niemand lesen kann. Unter der Weide gewachsen, als Valentus es wollte.',
    comment: 'Meiner. Nicht geliehen. Er ist warm, auch wenn es kalt ist.',
  },
  {
    id: 'e3-ordensfibel', name: 'Fibel des Lichterordens', icon: 'e3-ordensfibel',
    description: 'Eine runde Fibel: ein weißer Vogel auf Blau. Wer sie trägt, steht unter dem Schutz des Ordens.',
    comment: 'Schutz. Nicht Gehorsam. Das hat er vor allen gesagt.',
  },
]);

registerAbilities([
  {
    id: 'e3-stabstrahl', name: 'Stabstrahl',
    description: 'Mit ihrem eigenen Stab bündelt Lia das Licht zu einem schmalen Strahl. Nur im Kampf und nur, wenn sie den Stab wirklich in der Hand hat.',
  },
]);

registerLore([
  {
    id: 'e3-lore-lichterorden', title: 'Der Lichterorden von Trapas',
    text: 'Paladine in Weiß und Silber unter einem blau-weißen Banner mit weißem Vogel. Ihr Großmeister sitzt in Trapas und, so heißt es, auch dem Rat der Drei vor. Auf den Straßen halten sie jeden an, der nach Dunkelschatten aussieht. Oder nach Händler ohne Waren.',
  },
  {
    id: 'e3-lore-aros', title: 'Der Glaube an Aros',
    text: 'Der Orden verehrt Aros, den ersten der zehn Menschen, die Xenovia stürzten. Ihr Name gilt in Trapas als Fluch. Über dem Altar der Ordenskapelle leuchtet ein Fenster aus blauem und goldenem Glas, ganz ohne Bild.',
  },
  {
    id: 'e3-lore-glaube', title: 'Was der Großmeister will',
    text: 'Der Großmeister will die Urmacht, um den Glauben an Aros über das ganze Land zu tragen. Zum Wohl der Menschen, sagt er. Ignatius nennt es Zwang. Dass die Trägerin dabei sterben könnte, nimmt der Großmeister in Kauf.',
  },
  {
    id: 'e3-lore-relikte', title: 'Zehn Relikte',
    text: 'Zehn sehr alte Dinge standen auf Ständern im Kreis um den Stein, jedes auf Lia gerichtet. Im Buch des Doktors stand etwas über das, „was den Ersten gehörte“, und daneben ein Kreis aus zehn Strichen. Welche Dinge es waren und wohin sie nach dem Kampf kamen, weiß niemand.',
  },
]);

registerClues([
  {
    id: 'e3-hinweis-gwynn', title: 'Was Ignatius gesagt hat',
    text: 'Nachts vor dem Arbeitszimmer: Ignatius wollte, dass der Großmeister ihn Gwynn befreien lässt. Dafür hätte der Orden mich haben können. So hat er es gesagt.',
  },
  {
    id: 'e3-kyras-bericht', title: 'Kyras Bericht (unbestätigt)',
    text: 'Kyra sagt: Flick sei geflohen, um Hilfe zu holen. Versprengte Rebellen hätten angegriffen, sie und Elnon seien geflohen, sie habe ihn im Durcheinander verloren. Ein Lager versprengter Rebellen liege in der Nähe. Mehr wollte sie nicht erzählen.',
  },
]);

// Mother's tincture is for scratches and sore heels. Against Vamir's poison it does nothing (umsetzung.md §2 Gift).
registerItemAction('tincture', {
  label: 'Auftragen',
  when: () => poisoned(),
  // Registered globally (ui/bag has no way to unregister): the reason must read right in every chapter.
  reason: 'Mutters Tinktur. Die hebe ich mir für einen Kratzer auf, der es wirklich braucht.',
  run: async () => {
    await G.ui.think('Ich reibe ein paar Tropfen auf die Schläfen. Es riecht nach Zuhause und hilft kein bisschen. Das hier ist kein Kratzer. Das sitzt tiefer.');
  },
});
