export type StarReflectionBeat = { id: string; line: string; label?: string };

/** Original game adaptation of Roman PDF p. 32, after Foltan and Azar introduce themselves.
 * The day, bereavement and uncertain search are Lia's thoughts, not predictions of later events.
 */
export const STAR_REFLECTION_BEATS: readonly StarReflectionBeat[] = [
  { id: 'day', line: 'Die Straße, der Bach, das Feuer. Jetzt, wo es still wird, spüre ich erst, wie müde ich bin.', label: 'Noch einen Moment' },
  { id: 'parents', line: 'Zu Hause hätten wir um diese Zeit am Ofen gesessen. Mutter, Vater ... Morgen wird es wieder hell. Und ihr werdet immer noch fehlen.', label: 'Bei dem Gedanken bleiben' },
  { id: 'crios', line: 'Crios. Der Adler des Aros, sein treuer Gefährte. In den Geschichten wusste immer jemand, wohin es weiterging.' },
  { id: 'kyra', line: 'Kyra, siehst du denselben Stern? Ich wüsste so gern, wo du bist. Ob du frierst. Ob du überhaupt schlafen kannst.', label: 'Zum Stern schauen' },
  { id: 'company', line: 'Azar schnarcht schon. Foltan hält Wache. Ich bin nicht mehr allein. Vielleicht können sie mir helfen. Noch weiß ich nicht, ob ich ihnen vertrauen kann.' },
  { id: 'tomorrow', line: 'Morgen gehe ich mit ihnen. Ich weiß nicht, wohin dieser Weg führt oder wie ich Kyra finden soll. Für heute muss ich mich ausruhen.', label: 'Zurück zum Lager' },
];
