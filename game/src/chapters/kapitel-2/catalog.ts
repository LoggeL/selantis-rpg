// Kapitel II catalog: items, lore, memories, clues and extra speakers (ids prefixed k2-, shared ids from common/).
import { registerClues, registerItems, registerLore, registerMemories, registerSpeakers } from '../../core/catalog';
import { G } from '../../core/G';
import { registerItemAction } from '../../ui/bag';
import '../common';

registerItems([
  {
    id: 'k2-speikraut', name: 'Speikraut', icon: 'flowers',
    description: 'Ein Büschel Speikraut vom Bachufer. Zerrieben kühlt es Entzündungen.',
    comment: 'Mutter hat es auf jede Schramme gelegt. Es riecht nach Zuhause.',
  },
]);

registerMemories([
  { id: 'k2-mem-markt', title: 'Vaters Marktfahrten', text: 'Vor Sonnenaufgang spannte Vater an und fuhr nach Trapas. Abends war er zurück, und der Karren roch nach Honig. Einmal brachte er ein Buch mit. Mein Buch.' },
  { id: 'k2-mem-fest', title: 'Zu jung für das Fest', text: '„Nächstes Jahr“, sagte Vater jedes Mal, wenn wir zum Verbannungsfest wollten. Kyra hat geschmollt. Ich habe so getan, als wäre es mir egal. Es war mir nicht egal.' },
  { id: 'k2-mem-feuer', title: 'Badewasser', text: 'Samstags mussten wir Feuer unter dem Kessel machen, damit Mutter Badewasser hatte. Kyra schaffte es immer zuerst und tat, als wäre es Zauberei.' },
  { id: 'k2-mem-tinktur', title: 'Mutters Tinktur', text: '„Es brennt, weil es hilft“, sagte Mutter immer und pustete auf die Wunde. Ich habe nie verstanden, wieso Pusten hilft. Aber es half.' },
  { id: 'k2-mem-sterne', title: 'Auf dem Scheunendach', text: 'Im Sommer kletterten Kyra und ich nachts aufs Scheunendach und zählten Sternschnuppen. Sie wünschte sich ein Pferd. Ich mir ein Buch. Vater hat uns nie erwischt. Glaube ich.' },
]);

registerLore([
  { id: 'k2-lore-xenovia', title: 'Xenovia und das Verbannungsfest', text: 'Die ersten zehn Menschen stürzten ihre Schöpferin Xenovia, nahmen ihr die Urmacht und verbannten sie auf den Meeresgrund. Jeden Sommer feiert Trapas den Sieg mit kettenförmigem Hefegebäck: der Knechtschaft, die zerbrochen wurde.' },
  { id: 'k2-lore-trapas', title: 'Trapas', text: 'Markt- und Festungsstadt im Westen, Heimat von Mutters Familie. Starke Mauern, eine große Garnison und der Lichterorden. Mit dem Karren ist man an einem Tag hin und zurück.' },
  { id: 'k2-lore-strassen', title: 'Nach Dunkelhain', text: 'Seit der Schlacht von Dunkelhain schützt niemand mehr die Straßen. Die Fürsten haben sich hinter die Mauern ihrer Reichsstädte zurückgezogen und das Land den Dunkelschatten, Räubern und Marodeuren überlassen.' },
  { id: 'k2-lore-rat-der-drei', title: 'Der Rat der Drei (Gerücht)', text: 'Die heutige Obrigkeit, machtlos. Ihr Großmeister soll dem Wahnsinn verfallen sein und einen Feldzug gegen fremde Kulte führen, statt die Höfe und Dörfer zu schützen. So jedenfalls erzählt es Foltan.' },
  { id: 'k2-lore-kodex', title: 'Der Kodex', text: 'Foltan und Azar folgen einem Kodex: Niemand Wehrloses wird in der Wildnis zurückgelassen. Wer den Kodex aufgeschrieben hat, sagen sie nicht. Auch nicht, wer „wir“ eigentlich ist.' },
  { id: 'k2-lore-crios', title: 'Crios', text: 'Der hellste Stern am Himmel steht immer im Westen. Er ist nach dem treuen Adler des Aros benannt, des ersten Menschen. Crios half Aros, Xenovia zu stürzen.' },
]);

registerClues([
  { id: 'k2-hufspuren', title: 'Verlorene Hufspuren', text: 'Die Hufspuren der Reiter führen den Feldweg hinauf bis zur Hauptstraße. Auf dem Pflaster verlieren sie sich.' },
  { id: 'k2-wegweiser', title: 'Der Wegweiser', text: 'Westen: Trapas, nah, mit Garnison und Lichterorden. Osten: Portas, eine Reise von Wochen, vorbei an vielen Dörfern.' },
  { id: 'k2-gaukler-reiter', title: 'Reiter am Morgen', text: 'Die Gaukler sind heute früh Reitern in schwarz-weißen Röcken begegnet. Sie ritten nach Osten. Vor einem Sattel lag ein Mädchen und wehrte sich wie eine Wildkatze.' },
  { id: 'k2-zeichen', title: 'Kerben in der Rinde', text: 'Kleine Kerben an den Bäumen, immer auf Hüfthöhe, immer drei schräge Striche. Foltan folgt ihnen. Er tut nur so, als würde er sich am Moos orientieren.' },
]);

registerSpeakers([
  // Lia in her travel clothes (cloak portrait) — the default 'lia' speaker belongs to the farm scenes.
  { id: 'k2-lia', name: 'Lia', portrait: 'lia-cloak', voice: { pitch: 330, wave: 'triangle' }, color: '#d98b5f' },
  { id: 'k2-barde', name: 'Barde', portrait: 'bard', voice: { pitch: 210, wave: 'triangle' }, color: '#b0504a' },
  { id: 'k2-gauklerin', name: 'Gauklerin', portrait: 'villager-f', voice: { pitch: 280, wave: 'sine' }, color: '#c27a5a' },
  { id: 'k2-knecht', name: 'Knecht', portrait: 'villager-m', voice: { pitch: 150, wave: 'square' }, color: '#8a8060' },
]);

// Bag action: the Speikraut can be laid on Lia's sore heel at any time (Kräuterlexikon knowledge, DESIGN §7.4).
registerItemAction('k2-speikraut', {
  label: 'Auf die Ferse legen',
  run: async () => {
    G.state.take('k2-speikraut');
    G.state.set('k2-ferse-speikraut');
    try { G.audio.sfx('heal', { volume: 0.4 }); } catch { /* audio optional */ }
    await G.ui.think('Kühl. Das Brennen lässt nach. Danke, Mutter.');
  },
});
