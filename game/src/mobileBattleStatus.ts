/** Keep the next decisions visible on a phone; the character panel has details. */
export function mobileBattleSummary(status: unknown): string {
  if (typeof status !== 'string' || !status) return '';
  const lines = status.split('\n');
  const hp = lines.find(line => line.startsWith('LP '))?.split(' · ')[0] ?? '';
  const facing = lines.find(line => line.startsWith('Blick: '))?.replace('Blick: ', 'Blick ') ?? '';
  const move = lines.find(line => line.startsWith('Bewegen: '))?.replace('Bewegen: ', 'Bewegen ').replace(' Felder', '') ?? '';
  const action = lines.find(line => line.startsWith('Aktion: '));
  const actionLabel = action ? `Aktion ${action.includes('verbraucht') ? 'verbraucht' : 'frei'}` : '';
  const enemies = lines.filter(line => /^\d+\. /.test(line)).map(line => line.replace(/^\d+\. /, '').split(' · LP')[0].replace(' · ', ' '));
  const facingLabel = lines[0] === 'BLICKRICHTUNG WÄHLEN' ? `${facing} wählen` : facing;
  return [
    [hp, facingLabel].filter(Boolean).join(' · '),
    [move, actionLabel].filter(Boolean).join(' · '),
    enemies.length ? `Danach: ${enemies.slice(0, 3).join(' → ')}${enemies.length > 3 ? ' …' : ''}` : '',
  ].filter(Boolean).join('\n');
}
