// Prolog catalog: speakers of the council, lore entries the prologue reveals.
import { registerLore, registerSpeakers } from '../../core/catalog';

registerSpeakers([
  { id: 'prolog-wortfuehrer', name: 'Der Wortführer der Vier', portrait: 'council-mage-b', voice: { pitch: 108, wave: 'sawtooth' }, color: '#a04848' },
  { id: 'prolog-hagere', name: 'Der Hagere', portrait: 'council-mage-c', voice: { pitch: 128, wave: 'sawtooth' }, color: '#b8893a' },
  { id: 'prolog-aelteste', name: 'Die Älteste', portrait: 'council-mage-a', voice: { pitch: 205, wave: 'sine' }, color: '#5f9a6a' },
  { id: 'prolog-rat', name: 'Ratsmitglied', portrait: 'council-mage-a', voice: { pitch: 160, wave: 'sine' }, color: '#8fa0b8' },
  { id: 'prolog-abtruenniger', name: 'Abtrünniger', portrait: 'council-mage-b', voice: { pitch: 115, wave: 'sawtooth' }, color: '#a04848' },
  { id: 'prolog-falke', name: 'Falke aus Portas', portrait: 'falke-soldier', voice: { pitch: 175, wave: 'square' }, color: '#7a9ccc' },
  { id: 'prolog-axtkaempfer', name: 'Axtkämpfer', portrait: 'baris-young', voice: { pitch: 82, wave: 'sawtooth' }, color: '#8a3a32' },
  { id: 'prolog-stimme', name: 'Eine Stimme', portrait: 'prolog-stimme', voice: { pitch: 140, wave: 'triangle' }, color: '#9a7a52' },
  { id: 'prolog-fackeltraeger', name: 'Fackelträger', portrait: 'shadow-sword', voice: { pitch: 125, wave: 'square' }, color: '#c8c8c8' },
]);

registerLore([
  { id: 'lore-urmacht', title: 'Die Urmacht', text: 'Die Kraft, mit der die Göttin Xenovia Selantis schuf. Die ersten zehn Menschen nahmen sie ihr und versiegelten sie in einer Höhle hinter dem Ratssaal. Ihr Licht ist türkis.' },
  { id: 'lore-xenovia', title: 'Xenovia und das Verbannungsfest', text: 'Die Zehn stürzten ihre Schöpferin und verbannten sie auf den Meeresgrund. Jeden Sommer feiert Trapas den Sieg mit kettenförmigem Hefegebäck: die gebrochene Knechtschaft.' },
  { id: 'lore-rat-der-zehn', title: 'Der Rat der Zehn Geweihten', text: 'Zehn Geweihte, jeder für eine große Stadt. Sie gaben Gesetze für ganz Selantis und wachten vor allem über das Siegel der Urmacht. Ihr Großmeister war Valentus.' },
  { id: 'lore-dunkelhain', title: 'Dunkelhain', text: 'Vor sechzehn Jahren hielten Paladine des Lichts, Brigaden aus Ebaril und die Falken aus Portas einen Hügel gegen ein schwarzes Heer. Die Dunkelheit siegte.' },
  { id: 'lore-crios', title: 'Crios', text: 'Der hellste Stern steht immer im Westen. Er trägt den Namen des treuen Adlers des Aros, des ersten Menschen, der ihm half, Xenovia zu stürzen.' },
]);
