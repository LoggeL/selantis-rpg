// Scene „e3-valentus“ – Die Erscheinung (docs/teil-3/umsetzung.md §3, F3 00:21–02:00). The REGULAR ENTRY of Teil III:
// Teil II ends with finishBook2() → G.goto('e3-valentus') and its grown state. enterBook3() only closes leftover
// objectives and empties the party (never a reset); the direct entry gets the documented Teil-II end state from
// prepareE3 (shared.ts). Chapter card, narrator bridge (two days alone, no idea where to).
// Heart: the forest path of e3-lichtwald. Turquoise light points hang scattered on the trees – the pale thing from the
// slope in Teil II shows itself again. Only in Spurenblick (Q) do they line up along the path towards three places
// (stump, rocks, the big rock at the clearing; rules in valentus-spur.ts). When Lia has read all three, Valentus
// appears at the end of the trail (the existing 'valentus' figure, turquoise and translucent: erscheinung.ts).
// Conversation with choices: Lia is angry (parents, Kyra and Flick, „Ihr habt mir das aufgeladen“); he explains only
// briefly (limited, the apparition costs strength, not dead in the usual sense, his coming solves nothing for her),
// offers her a staff of her own, does not contradict Ignatius. He glides ahead to the clearing → e3-eigener-stab.
// Reload restarts at the chapter card; nothing in this scene is granted, only e3-valentus-getroffen at the very end.
import { G } from '../../core/G';
import { defineMap, startWorld, type MapDef, type WorldCtx } from '../../world';
import { pointInPoly } from '../../world/poly';
import { apparition, lightPoints, type Apparition } from './erscheinung';
import { OCCLUDERS, PATH_WALK, SPOT, SURFACES } from './lichtwald';
import { bg, e3Scene, enterBook3, lia, liaLook, nextScene, sfx, ui, until } from './shared';
import { CENTERLINE, nextStation, projectAlong, SCATTER, STATIONS, trailPoints, type StationId } from './valentus-spur';

const VAL = 'valentus';
const found = (id: StationId) => `e3-val-${id}`;
const foundSet = () => new Set(STATIONS.filter(s => G.state.is(found(s.id))).map(s => s.id));
const allFound = () => STATIONS.every(s => G.state.is(found(s.id)));
/** The end of the walk at the gap into the clearing: stepping in here after the talk follows Valentus. */
const GAP_ZONE: [number, number][] = [[556, 336], [578, 334], [582, 380], [562, 380]];
/** Where Lia stands during the conversation (just short of the gap, facing him). */
const TALK_AT: [number, number] = [530, 354];

const val = (w: WorldCtx, text: string, mood?: string) => w.say('e3-valentus', text, mood ? { mood } : undefined);

export const lichtwaldPfad: MapDef = defineMap({
  id: 'e3-lichtwald-pfad',
  name: 'Ein stiller Wald',
  background: 'e3-lichtwald',
  walk: PATH_WALK,
  occluders: OCCLUDERS,
  surfaces: SURFACES,
  surface: 'grass',
  depthScale: { y0: 0, s0: 0.92, y1: 720, s1: 1.04 },
  lookMode: true,
  clues: STATIONS.map(s => ({ id: `spur-${s.id}`, at: s.at, kind: 'glint' as const, verb: 'Ansehen', onInteract: (w: WorldCtx) => readStation(w, s.id) })),
  spawns: { start: { at: SPOT.start, dir: 'up' } },
  time: 'dawn',
  weather: 'leaves',
  ambience: ['birds', 'wind', 'stream'],
  ambienceVolume: { birds: 0.55, wind: 0.45, stream: 0.25 },
  music: 'exploration',
  resetOnEnter: true,
});

// ---------------------------------------------------------------------------------------------------------------
// The light points on the trees
// ---------------------------------------------------------------------------------------------------------------

/**
 * Draws the fifteen light points every frame: faint on their trees, and while the Spurenblick is held the five of the
 * next place glide into a line along the path towards it. Read places dim out.
 */
function startTrail(w: WorldCtx): void {
  const motes = STATIONS.flatMap(s => SCATTER[s.id].map(([x, y], i) => ({ station: s.id, i, sx: x, sy: y, x, y, phase: (x * 7 + y * 3) % 6.28 })));
  const pts = lightPoints(w, motes.length, 1.1);
  let look = 0, time = 0;
  const onUpdate = (_t: number, delta: number) => {
    const dt = Math.min(0.1, delta / 1000);
    time += dt;
    let active = false;
    try { active = w.lookMode.active; } catch { /* scene ending */ }
    look += ((active ? 1 : 0) - look) * Math.min(1, dt * 4);
    const done = foundSet();
    const next = nextStation(done);
    const line = next ? trailPoints(next, projectAlong(CENTERLINE, [w.player.x, w.player.y]), done, 5) : [];
    motes.forEach((m, idx) => {
      let tx = m.sx + Math.sin(time * 0.8 + m.phase) * 3, ty = m.sy + Math.cos(time * 1.1 + m.phase) * 2;
      const read = done.has(m.station);
      let a = read ? 0.08 : 0.5 + 0.15 * Math.sin(time * 2 + m.phase);
      if (next && m.station === next.id) {
        const [lx, ly] = line[m.i];
        tx += (lx - tx) * look;
        ty += (ly - 14 + Math.sin(time * 3 + m.i) * 2 - ty) * look;
        a += (0.95 - a) * look;
      } else if (!read) a *= 1 - 0.6 * look;
      m.x += (tx - m.x) * Math.min(1, dt * 5);
      m.y += (ty - m.y) * Math.min(1, dt * 5);
      pts.set(idx, m.x, m.y, a);
    });
  };
  w.scene.events.on('update', onUpdate);
  w.scene.events.once('shutdown', () => w.scene.events.off('update', onUpdate));
}

const STATION_THOUGHTS: Record<StationId, string> = {
  stumpf: 'Am alten Stumpf sammeln sie sich wie Tau, der sich verabredet hat. Und weiter oben hängen schon die nächsten.',
  fels: 'Wieder am Felsen. In meinen Büchern locken Irrlichter Leute ins Moor. Hier gibt es kein Moor. Hoffe ich.',
  felsblock: 'Hier hört die Linie auf. Als hätte jemand mit Licht einen Pfeil gemalt und dann den Pinsel abgesetzt.',
};

async function readStation(w: WorldCtx, id: StationId): Promise<void> {
  const first = !G.state.is(found(id));
  G.state.set(found(id));
  sfx('spark', { volume: 0.4 });
  await w.think(STATION_THOUGHTS[id]);
  if (!first) return;
  const next = nextStation(foundSet());
  if (next) w.setObjectiveTarget(next.at);
}

// ---------------------------------------------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------------------------------------------

async function noticeLights(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    w.player.face('up');
    await w.player.emote('?');
    await w.camera.pan([250, 470], 900);
    await w.think('Da, an den Stämmen. Kleine Lichtpunkte. Türkis, wie das Licht in mir, wenn es aufwacht.');
    if (G.state.is('e2-hang-gerastet')) {
      await w.think('Am Hang habe ich mir eingeredet, ich hätte zu wenig geschlafen. Letzte Nacht habe ich geschlafen.');
    } else {
      await w.think('Glühwürmchen gibt es im Herbst nicht. Das steht in jedem Buch über Käfer. Also sind das keine.');
    }
    await w.think('Einzeln ergeben sie nichts. Vielleicht muss ich anders hinsehen. So, wie Flick es mir gezeigt hat.');
    w.camera.follow();
  });
  w.completeObjective('e3-val-pfad');
  w.setObjective('e3-val-spur', `Halte ${w.controlHint('look')} gedrückt (Spurenblick): Ordnen sich die Lichter? Folge ihnen.`, nextStation(foundSet())?.at ?? null);
}

/** The apparition at the end of the trail. Returns the styled NPC. */
async function appear(w: WorldCtx): Promise<Apparition> {
  w.lockPlayer();
  ui().prefetchPlate('e3-erscheinung');
  w.spawn({ id: VAL, preset: 'valentus', speaker: 'e3-valentus', at: SPOT.valentusGap, dir: 'left', solid: false });
  const ghost = apparition(w, VAL, 0);
  w.actor(VAL).hold(true);
  await w.cutscene(async () => {
    await w.player.walkTo(TALK_AT[0], TALK_AT[1], { face: 'right' });
    await w.camera.pan([570, 330], 800);
    try { G.audio.music('refuge', { fadeMs: 2500 }); } catch { /* audio optional */ }
    sfx('urmacht', { volume: 0.35, pitch: 0.8 });
    w.lighting.flash(0x5fe0d0, 260);
    await ghost.fadeTo(0.62, 1800);
    w.player.face(VAL);
    await w.player.hop();
    await w.player.emote('!');
    await G.ui.plate('e3-erscheinung', { caption: 'Die Erscheinung', pan: 'in', durationMs: 24000 });
    await val(w, 'Lass den Stab ruhig unten. Gegen mich hilft er nicht, und nötig ist er auch nicht.');
    await lia(w, 'Ihr leuchtet. Wer in meinen Büchern leuchtet, ist entweder ein Heiliger oder Ärger.', 'scared');
    await val(w, 'Hoffentlich keins von beidem.', 'happy');
    await G.ui.closePlate();
  });
  return ghost;
}

async function conversation(w: WorldCtx): Promise<void> {
  await w.cutscene(async () => {
    await lia(w, 'Grauer Bart, blau-weiße Robe … Ignatius hat Euch beschrieben. Ihr seid Valentus.', 'surprised');
    await val(w, 'Den Bart hat er sicher kürzer beschrieben. Er hat mich lange nicht gesehen.', 'happy');
    await lia(w, 'Es heißt, Ihr seid nach Dunkelhain gestorben. In einem grellen Licht.');
    await val(w, 'Tot ist ein grobes Wort für das, was ich bin. Sagen wir: woanders. Und nur kurz zu Besuch.', 'sad');
    await w.think('Sechzehn Jahre. Und jetzt steht er einfach da und leuchtet.');
    await lia(w, 'Kurz zu Besuch. Wie schön für Euch.', 'angry');

    const asked = new Set<number>();
    for (;;) {
      const pick = await w.choose([
        { text: '„Meine Eltern sind tot. Weil Ihr damals etwas in mich hineingelegt habt.“', disabled: asked.has(0), reason: 'Das habe ich ihm gesagt.' },
        { text: '„Kyra und Flick sind in Vamirs Händen. Habt Ihr dabei zugesehen? Von Eurem Woanders aus?“', disabled: asked.has(1), reason: 'Das habe ich ihm gesagt.' },
        { text: '„Ihr habt mir das aufgeladen. Ohne zu fragen. Ich lag in einer Wiege!“', disabled: asked.has(2), reason: 'Das habe ich ihm gesagt.' },
        ...(asked.size ? ['„Genug. Warum seid Ihr hier?“'] : []),
      ]);
      if (pick === 3) break;
      if (!asked.size) G.state.set('e3-val-vorwurf', ['eltern', 'freunde', 'aufgeladen'][pick]);
      asked.add(pick);
      if (pick === 0) {
        await val(w, 'Deine Eltern haben mich gepflegt, als ich nicht mehr gehen konnte. Ich habe ihnen Gefahr ins Haus getragen. Das weiß ich.', 'sad');
        await lia(w, 'Davon werden sie nicht wieder lebendig.', 'angry');
        await val(w, 'Nein. Ich wollte nur nicht, dass du glaubst, ich hätte sie vergessen.', 'sad');
      } else if (pick === 1) {
        await val(w, 'Ich sehe wenig von dort, und tun kann ich noch weniger. Ich öffne keine Türen mehr und halte keine Klinge auf.', 'pained');
        await lia(w, 'Wozu seid Ihr dann überhaupt gut?', 'angry');
        await val(w, 'Für sehr wenig. Deshalb gehe ich sparsam damit um.');
      } else {
        await val(w, 'Ich hatte eine Nacht, eine Wunde und eine Wiege vor mir. Fragen konnte ich dich nicht. Das stimmt.');
        await lia(w, 'Dann hättet Ihr es lassen sollen!', 'angry');
        await val(w, 'Dann hätte es sich ein anderer genommen. Einer, der sich heute Vamir nennt.', 'sad');
      }
      if (asked.size === 3) break;
    }

    await val(w, 'Hör mir zu, solange ich es kann. Dieses Bild von mir kostet Kraft. Mehr, als ich übrig habe.', 'pained');
    await val(w, 'Ich kann nicht für dich kämpfen, nichts tragen, niemanden suchen. Dass ich hier bin, löst nichts für dich.');
    await lia(w, 'Ein Geist mit Bedingungen. Wie in den schlechteren Märchen.');
    await val(w, 'Ignatius hat dir einen Stab geliehen. Leihen ist gut für den Anfang. Ich bin hier, damit du einen eigenen bekommst.', 'happy');
    await lia(w, 'Einen eigenen? Von … Euch?', 'surprised');
    await val(w, 'Von der Weide dort oben. Ich frage sie nur.');
    await lia(w, 'Ignatius sagt, ich bin nicht bereit. Für den Weg nicht, für den Stab nicht, für gar nichts.', 'sad');
    await val(w, 'Er kennt dich seit Wochen. Ich seit einer Nacht vor sechzehn Jahren. Ich widerspreche ihm nicht.');
    await lia(w, 'Zwei alte Männer, eine Meinung. Großartig.', 'angry');
    await val(w, 'Bereit oder nicht: Einen eigenen Stab kann man trotzdem haben. Komm. Die Lichtung ist gleich dort.', 'happy');
  });
}

async function pfadScript(w: WorldCtx): Promise<void> {
  for (const s of STATIONS) G.state.set(found(s.id), false);
  G.state.set('e3-val-gesprochen', false);
  w.lockPlayer();
  startTrail(w);
  await ui().fade('in', 1100);
  w.unlockPlayer();
  await w.think('Ein Wald, der nach nassem Laub riecht und nach sonst gar nichts. Kein Rauch, kein Pferd, kein Mensch.');
  await w.think('Flick würde jetzt etwas über Spuren sagen. Ich weiß nur, dass meine Füße wehtun.');
  w.setObjective('e3-val-pfad', 'Folge dem Pfad in den Wald hinein.', [236, 540]);
  await w.waitForNear([214, 540], 90);
  await noticeLights(w);
  await until(w, allFound);
  w.completeObjective('e3-val-spur');
  await w.wait(400);
  await until(w, () => !G.ui.busy(), 120);
  const ghost = await appear(w);
  await conversation(w);
  G.state.set('e3-val-gesprochen');
  // He glides ahead into the clearing and thins out; she follows (her walk ends at the gap).
  const v = w.actor(VAL);
  bg(v.walkTo(720, 318, { straight: true, speed: 30 }).then(() => ghost.fadeTo(0.15, 1600)));
  w.unlockPlayer();
  await w.think('Er geht nicht. Er schwebt. Und er wartet nicht, ob ich mitkomme.');
  w.setObjective('e3-val-folgen', 'Folge Valentus auf die Lichtung.', SPOT.gap);
  await until(w, () => !G.ui.busy() && pointInPoly(w.player.x, w.player.y, GAP_ZONE));
  w.completeObjective('e3-val-folgen');
  w.lockPlayer();
  await ui().fade('out', 1000);
  G.state.set('e3-valentus-getroffen');
  await nextScene('e3-eigener-stab');
}

export const scene = e3Scene('e3-valentus', 'Die Erscheinung', async () => {
  await ui().fade('out', 0);
  // Regular entry and direct entry alike: keeps the real state, only closes leftover Teil-II objectives.
  enterBook3();
  await G.ui.chapterCard('Teil III', 'Falscher Glaube', 'Ein eigener Stab');
  await G.ui.narrate([
    'Zwei Tage war Lia nun allein unterwegs. Sie hatte unter Wurzeln geschlafen, Bäche durchwatet und mehr Wege verworfen als gefunden.',
    'Wohin man Kyra und Flick gebracht hatte, wusste sie noch immer nicht. Nur, dass sie nicht umkehren würde.',
  ], { style: 'card' });
  await startWorld({ map: lichtwaldPfad, spawn: 'start', player: liaLook(), companions: [], fadeIn: false, script: pfadScript });
});
