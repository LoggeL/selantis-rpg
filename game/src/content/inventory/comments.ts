import type { ItemComments } from '../../modules/inventory/inspection';

/** Game adaptation of carried items, anchored in the existing farm and journey chapters. */
export const ITEM_COMMENTS: ItemComments = {
  apfel: { line: 'Ein Apfel für unterwegs. Den hebe ich mir auf.' },
  kornblume: { line: 'Eine Kornblume vom Feldrand. Die Farbe gefällt mir.' },
  kupfer: { line: 'Ein paar Kupferstücke. Die kann ich unterwegs brauchen.' },
  feder: { line: 'Eine kleine Feder. So leicht, dass ich sie kaum spüre.', variants: [
    { flags: { chickReturned: true }, line: 'Die Feder von der Eiche. Das Kleine ist wieder bei seiner Mutter.' },
  ] },
  kueken: { line: 'Ganz ruhig, Kleines. Ich bringe dich zum Nest in der Eiche am Waldrand.' },
  proviant: { line: 'Brot, Käse und Speck. Ich muss damit haushalten.', variants: [
    { flags: { journeyAte: true }, line: 'Den übrigen Proviant hebe ich für den weiteren Weg auf.' },
    { flags: { campfireLit: true, journeyAte: false }, line: 'Das Feuer brennt. Jetzt kann ich etwas Brot und Käse essen.' },
  ] },
  wasserschlauch: { line: 'Der Wasserschlauch muss bis zum nächsten Bach reichen.', variants: [
    { flags: { streamVisited: true }, line: 'Am Bach habe ich den Schlauch aufgefüllt. Gut, dass ich ihn mitgenommen habe.' },
  ] },
  dolch: { line: 'Vaters Dolch. Ich lasse ihn in der Tasche.' },
  silber: { line: 'Die Silbermünzen waren im doppelten Boden. Ich passe auf sie auf.' },
  reisezeug: { line: 'Lederschuhe, Regenmantel und Wolldecke. Das muss reichen.', variants: [
    { flags: { journeyCloakRecovered: false, journeyCloakSpread: true }, line: 'Der Mantel liegt an meinem Schlafplatz. Die Decke brauche ich für die Nacht.' },
  ] },
  heilzeug: { line: 'Mutters Kräutertinktur und ein Stück Leinen. Für den Fall, dass ich mich verletze.' },
  'buch-kraeuter': { line: 'Cronibus Kräuterlexikon. Ich kenne noch längst nicht alle Pflanzen.' },
  'buch-alana': { line: 'Ob Alana ihren Balduin wiedersieht? Ich möchte weiterlesen.' },
  steine: { line: 'Damit kann ich eine Feuerstelle bauen. Ich brauche einen Platz im Lager.' },
  zunderholz: { line: 'Trockenes Laub und Zweige. An der Feuerstelle kann ich sie gebrauchen.' },
};
