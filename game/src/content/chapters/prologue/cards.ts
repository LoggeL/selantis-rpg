/** Novel pages 51–52 for the factions; page 3 for the moment before battle.
 * The council's protection of the Urmacht and the four masters' claim follow
 * the film prologue and Ignatius' explanation (episode 2, 16:57–17:09).
 * The intro ends before the historical battle, without showing its outcome. */
export const PROLOGUE_CARDS = [
  { id: 'power', narrativeId: 'prologue.cards.power', art: 'prologue-power', title: 'Der gespaltene Rat',
    attribution: '',
    text: 'Der Rat der Zehn wacht über die Urmacht, damit niemand sie für eigene Zwecke nutzt. Vier Zaubermeister wollen sie für sich gewinnen. Die sechs anderen stellen sich ihnen entgegen.' },
  { id: 'conflict', narrativeId: 'prologue.cards.conflict', art: 'prologue-conflict', title: 'Die verfeindeten Mächte',
    attribution: 'Nach Foltans Bericht',
    text: 'Aus dem Streit um die Urmacht wird Krieg. Die Fürsten unterstützen die sechs ratstreuen Meister, um ihr Herrschaftsrecht zu schützen. Die vier abtrünnigen Magier haben Räuber, Söldner und bewaffnete Bauern hinter sich versammelt.' },
  { id: 'falken', narrativeId: 'prologue.cards.falken', art: 'prologue-falken', title: 'Vor Dunkelhain', attribution: '',
    text: 'Auf dem Hügel stehen die Paladine des Lichts, Ebarils achte und elfte Brigade und die Falken aus Portas. Am Fuß des Hangs wartet das schwarz gekleidete Heer.' },
  { id: 'valentus', narrativeId: 'prologue.cards.valentus', art: 'prologue-valentus-ready', title: 'Valentus', attribution: '',
    text: 'Der Magier Valentus steht vor den Reihen der Verbündeten. Der Wind zerrt an seiner blau-weißen Robe. Vor ihm wartet das feindliche Heer. Gleich beginnt die Schlacht.' },
] as const;
