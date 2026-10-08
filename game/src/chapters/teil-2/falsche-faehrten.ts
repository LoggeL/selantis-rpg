// „Falsche Fährten“ (e2-flicks-erinnerungen): the Master leafs through Flick's head looking for Lia. Flick cannot
// shut him out, so she shows him other things – true, but harmless memories of her own: the one-woman Elves of
// Grunwald, a stolen pie in Trapas, the rebels' gate. Every answer has to fit his question; a memory that brushes
// against Lia, or one that obviously dodges, makes him dig (a rustle – the count `noise` changes his next line).
// Pure data, tested in falsche-faehrten.test.ts; staged by flicks-erinnerungen.ts through G.ui.scenePick.
import type { PickCard } from '../../ui/scenePick';

export interface Trail extends PickCard { ok: boolean; reply: string }
export interface Probe { id: string; question: string; trails: Trail[] }

export const PROBES: readonly Probe[] = [
  {
    id: 'zuletzt', question: 'Wo hast du sie zuletzt gesehen? Zeig es mir.',
    trails: [
      { id: 'bach', text: 'Der Bach im Morgengrauen, Kyra schreit „Lauf!“', ok: false,
        reply: 'Ein Bach. Wasser über Steinen, jemand rennt. Welcher Bach, kleine Halbelfe?' },
      { id: 'grunwald', text: 'Der Grunwald, als ich ganz allein die Elfen von Grunwald war', ok: true,
        reply: 'Ein Wald, ein Lager für eine Person, ein selbstgemaltes Banner. Wie rührend. Und kein Mädchen weit und breit.' },
      { id: 'zaehlen', text: 'Steine. Ganz viele Steine. Eins, zwei, drei …', ok: false,
        reply: 'Du zählst. Wer zählt, will etwas übertönen. Was übertönst du?' },
      { id: 'trapas', text: 'Die Gasse hinter der Bäckerei in Trapas', ok: true,
        reply: 'Eine Gasse, ein offenes Fenster, ein Kuchen auf dem Sims. Du warst ein diebisches Kind. Das wusste ich schon.' },
    ],
  },
  {
    id: 'denken', question: 'Woran denkst du, wenn du an sie denkst?',
    trails: [
      { id: 'kuchen', text: 'Warmer Apfelkuchen. Gestohlen, natürlich', ok: true,
        reply: 'Kuchen. Du denkst an Kuchen. Was für ein enttäuschend kleiner Kopf.' },
      { id: 'buecher', text: 'Jemand, der Bücher zitiert, statt wegzulaufen', ok: false,
        reply: 'Bücher! Ein Mädchen, das liest. Davon gibt es nicht viele zwischen hier und Portas.' },
      { id: 'tor', text: 'Das Tor der Rebellen. „Keine wie dich.“', ok: true,
        reply: 'Ah. Das tut weh, nicht wahr? Das schmeckt mir. Aber sie ist es nicht.' },
      { id: 'witze', text: 'Furchtbare Witze. Einer schlechter als der andere', ok: false,
        reply: 'Witze. Jemand hat dir schlechte Witze erzählt, und du hast gelacht. Wer war das?' },
    ],
  },
  {
    id: 'wohin', question: 'Wohin würde sie gehen? Ein Weg, ein Fluss, eine Richtung.',
    trails: [
      { id: 'lager', text: 'Zelte, Rauch, ein Druide mit einer Schale', ok: false,
        reply: 'Zelte. Rauch. Ein Lager voller Leute, die nicht lachen … und weg. Du machst schnell zu, Halbelfe.' },
      { id: 'sueden', text: 'Nach Süden. Den Fluss runter, wohin alle fliehen', ok: true,
        reply: 'Süden. Alle laufen nach Süden. Das ist keine Spur, das ist ein Sprichwort.' },
      { id: 'weissnicht', text: 'Ich weiß es nicht. Ehrlich nicht.', ok: true,
        reply: 'Die Wahrheit. Wie unerquicklich. Du weißt es wirklich nicht.' },
    ],
  },
];
