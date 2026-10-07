// Teil II „Letzte Hoffnung“: catalog entries (speakers, items, lore, abilities). Scene-specific clues and memories
// may be registered in the scene modules themselves, always with the e2- prefix.
import { registerAbilities, registerItems, registerLore, registerSpeakers } from '../../core/catalog';
import '../common';

registerSpeakers([
  // Lia in her travel clothes (same voice as 'lia'); the staff does not change her portrait.
  { id: 'e2-lia', name: 'Lia', portrait: 'lia-cloak', voice: { pitch: 330, wave: 'triangle' }, color: '#d98b5f' },
  // Ignatius before he gives his name.
  { id: 'e2-fremder', name: 'Der Fremde', portrait: 'e2-ignatius', voice: { pitch: 135, wave: 'sine' }, color: '#d0904a' },
  // Ignatius as forest hermit (overrides the prolog portrait for his own lines in Teil II via portrait option).
  { id: 'e2-ignatius', name: 'Ignatius', portrait: 'e2-ignatius', voice: { pitch: 135, wave: 'sine' }, color: '#d0904a' },
  // The Master once Ignatius named him (book one keeps 'vamir' = „Der Meister“).
  { id: 'e2-vamir', name: 'Vamir', portrait: 'vamir', voice: { pitch: 70, wave: 'sine' }, color: '#9a7ad8' },
  { id: 'e2-baris', name: 'Baris', portrait: 'baris-scarred', voice: { pitch: 72, wave: 'sawtooth' }, color: '#8a3a32' },
  { id: 'e2-druide', name: 'Der Druide', portrait: 'e2-druide', voice: { pitch: 120, wave: 'sine' }, color: '#8aa070' },
  { id: 'e2-flick', name: 'Flick', portrait: 'flick', voice: { pitch: 380, wave: 'sine' }, color: '#7f9a4a' },
  { id: 'e2-kyra-bound', name: 'Kyra', portrait: 'kyra-bound', voice: { pitch: 300, wave: 'triangle' }, color: '#b07a4f' },
  { id: 'e2-kyra-gebannt', name: 'Kyra', portrait: 'e2-kyra-gebannt', voice: { pitch: 240, wave: 'sine' }, color: '#9a7ad8' },
  { id: 'e2-elnon', name: 'Elnon', portrait: 'elnon', voice: { pitch: 125, wave: 'sine' }, color: '#5f9a5a' },
  { id: 'e2-waerter', name: 'Wärter', portrait: 'shadow-club', voice: { pitch: 120, wave: 'square' }, color: '#a8a8a8' },
  { id: 'e2-waerterin', name: 'Wärter mit Schlüssel', portrait: 'shadow-sword', voice: { pitch: 150, wave: 'square' }, color: '#a8a8a8' },
  { id: 'e2-jaeger', name: 'Fallensteller', portrait: 'villager-m', voice: { pitch: 150, wave: 'triangle' }, color: '#8a7a5a' },
  { id: 'e2-posten', name: 'Rebellenposten', portrait: 'guard-brotherhood', voice: { pitch: 165, wave: 'triangle' }, color: '#7a8a5a' },
]);

registerItems([
  {
    id: 'e2-schattentoeter', name: 'Schattentöter', icon: 'e2-schattentoeter',
    description: 'Ignatius’ alter Zauberstock: helles, verwittertes Holz mit einem Knorren an der Spitze und einer abgegriffenen Lederwicklung. Geliehen, nicht geschenkt.',
    comment: 'Er ist leichter, als er aussieht. Und er summt, wenn ich ganz still bin.',
  },
]);

registerAbilities([
  {
    id: 'e2-stabimpuls', name: 'Stabimpuls',
    description: 'Mit Schattentöter sammelt Lia einen kleinen, gezielten Lichtimpuls an der Stabspitze. Nur im Kampf und nur mit dem Stab in der Hand.',
  },
]);

registerLore([
  {
    id: 'e2-lore-pruefung', title: 'Die Prüfung der Bruderschaft',
    text: 'Ein alter Brauch der Rebellen: Der Druide reicht einen Trank, dem nur echte Zauberkraft standhalten soll. Was er mit allen anderen macht, sagt niemand gern laut. Bei Lia hat er etwas geweckt, das man bis weit in die Ferne sehen konnte.',
  },
  {
    id: 'e2-lore-xenovia', title: 'Xenovias Sturz, wie der Fremde ihn erzählt',
    text: 'Die ersten zehn Menschen von Selantis stürzten ihre Schöpferin Xenovia, nahmen ihr die Urmacht, verschlossen sie in einer Höhle und verbannten die Göttin auf den Meeresgrund. Das Volk verehrt sie seither als die Zehn Götter. Über Generationen wachten zehn Zauberkundige über die Höhle, zuletzt der Rat der Zehn Geweihten.',
  },
  {
    id: 'e2-lore-valentus', title: 'Was Valentus tat',
    text: 'Als Dunkelhain verloren war, holte Großmeister Valentus die Urmacht aus der Höhle, bevor die Abtrünnigen sie erreichten. Verwundet fand er Aufnahme bei einem Bauernpaar. Er gab die Macht dem Wehrlosesten, das er finden konnte: einem Säugling. Nach dem Bericht des Fremden war dieser Säugling Lia.',
  },
  {
    id: 'e2-lore-rat', title: 'Ignatius von Ignis',
    text: 'Einst Vertreter der Stadt Ignis im Rat der Zehn Geweihten. Der Rat gab Gesetze für ganz Selantis und hütete die Urmacht. Nach Dunkelhain zog Ignatius sich in die Wälder zurück. Von den Treuen überlebten nach seinem Wissen Valentus, er selbst und Gwynn. Gwynn haben die Abtrünnigen mitgenommen; Ignatius glaubt, dass sie noch lebt und gefangen gehalten wird. Wo, weiß er nicht. Ob sie lebt, auch nicht.',
  },
  {
    id: 'e2-lore-vamir', title: 'Vamir',
    text: 'Einer der vier Abtrünnigen. Nach Ignatius räumte er seine Mitverschwörer aus dem Weg und nennt sich nun Vamir, in der alten Sprache „der Allmächtige“. Er besitzt die Urmacht nicht. Er braucht ihre Trägerin.',
  },
]);
