// Kapitel V: staging of the bluff at the guards' fire (rules and texts in bluff.ts).
import { G } from '../../core/G';
import type { WorldCtx } from '../../world';
import { BEAT_NOISE, BEAT_YOUNG, beatGoods, clampPoints, verdict, type BluffOption } from './bluff';
import { lia, sfx } from './common';

async function play(w: WorldCtx, options: BluffOption[]): Promise<number> {
  const pick = await w.choose(options.map(o => (o.tag ? { text: o.text, tag: o.tag } : o.text)));
  const o = options[pick];
  if (o.take) G.state.take(o.take);
  for (const [speaker, text, mood] of o.reply) await w.say(speaker, text, mood ? { mood } : undefined);
  if (o.delta > 0) sfx('discover', { volume: 0.35 });
  else if (o.delta < 0) sfx('suspicious', { volume: 0.6 });
  return o.delta;
}

/** Lia walks into the camp and talks. Returns the distraction points 0..3. */
export async function runBluff(w: WorldCtx): Promise<number> {
  let points = 1;
  const algard = w.actor('algard'), maedchen = w.actor('maedchen'), schuetze = w.actor('schuetze');
  await w.cutscene(async () => {
    w.stealth.enable(false);
    for (const g of [maedchen, schuetze]) g.hold(true);
    await maedchen.emote('!', 600);
    await w.say('maedchen', 'He, du! Stehen bleiben!', { mood: 'angry' });
    algard.setIdle('idle');
    algard.face('player');
    void schuetze.walkTo(w.player.x + 50, w.player.y + 30).catch(() => {});
    await maedchen.walkTo(w.player.x + 30, w.player.y - 16);
    maedchen.face('player');
    w.player.face('maedchen');
    await w.camera.pan([w.player.x + 20, w.player.y - 10], 600);
    await lia('Guten Abend! Ich … will morgen in Trapas auf den Markt. Mit Waren. Zum Verkaufen.', 'scared');
    await lia('Ich hab mich seit Mittag ein kleines bisschen verlaufen. Ist das hier noch die Straße?');
    await w.say('algard', 'Allein, nach Sonnenuntergang? Du bist aber noch viel zu jung.');
    points += await play(w, BEAT_YOUNG);
    await w.say('maedchen', 'Marktmädchen, ja? Du hast aber gar nichts zum Verkaufen dabei?', { mood: 'angry' });
    points += await play(w, beatGoods(id => G.state.has(id)));
    sfx('rustle', { volume: 0.5, pan: 0.4 });
    maedchen.face('kyra');
    await w.say('maedchen', 'Still mal. Da hinten am Baum hat sich was bewegt.', { mood: 'angry' });
    points += await play(w, BEAT_NOISE);
    points = clampPoints(points);
    maedchen.face('player');
    await w.say('narrator', verdict(points));
    await w.say('algard', 'Moment mal. Du verkaufst uns hier für dumm, oder?', { mood: 'angry' });
    await w.say('maedchen', 'Wer schickt dich? Rede!', { mood: 'angry' });
    await lia('Also … das ist so … ähm …', 'scared');
    sfx('bow', { volume: 0.8, pan: 0.5 });
    w.camera.punch(0.5);
    await w.wait(400);
  });
  return points;
}
