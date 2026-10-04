import { G } from '../../core/G';
import { events } from '../../core/events';
import { defineChapter } from '../../core/registry';
import { settings, updateSettings } from '../../core/settings';
import type { AmbienceLayer, LightningEvent, MusicMood, SfxLoop, SfxName } from '../../audio/api';
import { audioDebug } from '../../audio';
import { analyse, encodeWav, renderOffline, smallSpeaker } from '../../audio/lab';
import { SFX_NAMES } from '../../audio/sfx';
import { AMBIENCE_LAYERS } from '../../audio/ambience';

const MOODS: [MusicMood, string][] = [
  ['exploration', 'Erkundung'], ['refuge', 'Zuflucht'], ['tavern', 'Taverne'], ['flight', 'Flucht'],
  ['battle', 'Kampf'], ['dread', 'Grauen'], ['grief', 'Trauer'],
];

const LAYER_LABELS: Record<AmbienceLayer, string> = {
  wind: 'Wind', birds: 'Vögel', crickets: 'Grillen', rain: 'Regen', storm: 'Gewitter',
  fire: 'Feuer', tavern: 'Schankraum', stream: 'Bach', night: 'Nacht', camp: 'Lager',
  'battle-far': 'Ferne Schlacht', room: 'Stube', farm: 'Hof', forge: 'Schmiede', lake: 'Weiher',
};

const SFX_GROUPS: [string, [SfxName, string][]][] = [
  ['Schritte', [['step-grass', 'Gras'], ['step-dirt', 'Erde'], ['step-wood', 'Holz'], ['step-stone', 'Stein'], ['step-water', 'Pfütze']]],
  ['Oberfläche', [['ui-move', 'Auswahl'], ['ui-confirm', 'Bestätigen'], ['ui-cancel', 'Abbrechen'], ['ui-open', 'Öffnen'], ['ui-close', 'Schließen'], ['page', 'Seite']]],
  ['Belohnung', [['pickup', 'Fund'], ['discover', 'Entdeckung'], ['objective', 'Ziel erledigt'], ['memory', 'Erinnerung']]],
  ['Kampf', [['swing', 'Schwung'], ['hit', 'Treffer'], ['hit-heavy', 'Schwerer Treffer'], ['bow', 'Bogen'], ['arrow-hit', 'Pfeiltreffer'], ['block', 'Block'], ['dodge', 'Ausweichen'], ['fall', 'Sturz'], ['sword-draw', 'Schwert ziehen'], ['crossbow', 'Armbrust'], ['throw', 'Werfen']]],
  ['Magie', [['magic', 'Schimmer'], ['heal', 'Heilung'], ['beam', 'Strahl'], ['shockwave', 'Druckwelle'], ['urmacht', 'Urmacht'], ['spark', 'Funke']]],
  ['Schleichen', [['heartbeat', 'Herzschlag'], ['suspicious', 'Verdacht „?“'], ['alert', 'Entdeckt „!“'], ['branch-snap', 'Ast knackt']]],
  ['Requisiten', [['pig', 'Schwein'], ['stone-place', 'Stein ablegen'], ['rope-cut', 'Fessel schneiden'], ['chain', 'Kette'], ['write', 'Schreiben'], ['eat', 'Essen']]],
  ['Welt', [['door', 'Tür'], ['chest', 'Truhe'], ['rustle', 'Busch'], ['splash', 'Platschen'], ['fire-ignite', 'Feuer entfachen'], ['drill', 'Feuerbohren'], ['bark-dog', 'Hund'], ['horse', 'Hufe'], ['thunder', 'Donner'], ['whoosh', 'Luftzug'], ['thud', 'Dumpfer Schlag']]],
];

const VOICES: { name: string; pitch: number; wave: OscillatorType; line: string; roam?: boolean }[] = [
  { name: 'Lia', pitch: 330, wave: 'triangle', line: '„Ich lese nur noch ein Kapitel, versprochen!“' },
  { name: 'Kyra', pitch: 290, wave: 'triangle', line: '„Du und deine Bücher. Die Schweine warten!“' },
  { name: 'Valentus', pitch: 120, wave: 'sine', line: '„Die Urmacht darf nicht in falsche Hände fallen.“' },
  { name: 'Foltan', pitch: 150, wave: 'triangle', line: '„Wir reden morgen. Schlaf jetzt.“' },
  { name: 'Azar', pitch: 105, wave: 'square', line: '„Ha! Mein Krummschwert und ich sind bereit.“' },
  { name: 'Flick', pitch: 380, wave: 'sine', line: '„Spuren lügen nicht. Menschen schon.“' },
  { name: 'Azar wandernd', pitch: 105, wave: 'square', line: '„Hier entlang, Mädchen. Nein, links! Jetzt geradeaus, immer meiner Stimme nach.“', roam: true },
];

const CSS = `
.audio-lab{position:absolute;inset:0;overflow:auto;background:radial-gradient(ellipse at 30% 0%,#1d2638 0%,#0b0e15 70%);color:#efe3c8;font-family:Alegreya,Georgia,serif;pointer-events:auto;padding:28px 32px 40px}
.audio-lab *{box-sizing:border-box}
.audio-lab header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:1px solid #d8b25a55;padding-bottom:14px;margin-bottom:20px}
.audio-lab h1{font-family:Cinzel,serif;font-weight:700;font-size:30px;letter-spacing:.06em;margin:0;color:#e9c977;text-shadow:0 2px 0 #0008}
.audio-lab .sub{font-style:italic;color:#c9b993;margin-top:4px;font-size:17px}
.audio-lab .status{font-family:'Alegreya Sans SC',sans-serif;font-size:14px;letter-spacing:.08em;padding:6px 12px;border-radius:999px;border:1px solid #d4573b;color:#f0a08a;background:#d4573b18;white-space:nowrap}
.audio-lab .status.on{border-color:#49e0c8;color:#9ff3e4;background:#49e0c814;box-shadow:0 0 14px #49e0c833}
.audio-lab .grid{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:20px}
@media (max-width:900px){.audio-lab .grid{grid-template-columns:1fr}}
@media (max-width:600px){.audio-lab{padding:18px 16px 32px}.audio-lab header{flex-direction:column;align-items:flex-start}.audio-lab h1{font-size:24px}}
.audio-lab section{position:relative;background:linear-gradient(180deg,#171e2cee,#121825ee);border:1px solid #d8b25a66;border-radius:10px;padding:14px 16px 16px;margin-bottom:18px;box-shadow:inset 0 0 0 3px #0c101a,0 8px 24px #0007}
.audio-lab section::before,.audio-lab section::after{content:'';position:absolute;width:12px;height:12px;border:2px solid #d8b25a;opacity:.8}
.audio-lab section::before{top:-2px;left:-2px;border-right:0;border-bottom:0;border-top-left-radius:6px}
.audio-lab section::after{bottom:-2px;right:-2px;border-left:0;border-top:0;border-bottom-right-radius:6px}
.audio-lab h2{font-family:Cinzel,serif;font-size:16px;letter-spacing:.12em;text-transform:uppercase;color:#d8b25a;margin:0 0 12px;display:flex;align-items:center;gap:10px}
.audio-lab h2::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#d8b25a66,transparent)}
.audio-lab h3{font-family:'Alegreya Sans SC',sans-serif;font-size:13px;letter-spacing:.14em;color:#a99a78;margin:12px 0 7px;font-weight:500}
.audio-lab .btns{display:flex;flex-wrap:wrap;gap:7px}
.audio-lab button{font-family:Alegreya,Georgia,serif;font-size:16px;color:#efe3c8;background:linear-gradient(180deg,#26324a,#1b2436);border:1px solid #d8b25a55;border-radius:7px;padding:6px 12px 7px;cursor:pointer;transition:transform .08s,border-color .15s,box-shadow .15s,background .15s;line-height:1.1}
.audio-lab button small{display:block;font-family:'Alegreya Sans SC',sans-serif;font-size:11px;letter-spacing:.06em;color:#8e8670;margin-top:2px}
.audio-lab button:hover{border-color:#d8b25a;box-shadow:0 0 0 1px #d8b25a55,0 4px 12px #0006}
.audio-lab button:active{transform:translateY(1px) scale(.98)}
.audio-lab button:focus{outline:none}
.audio-lab button:focus-visible{outline:2px solid #d8b25a;outline-offset:2px}
@media (pointer:coarse){.audio-lab button{min-height:40px}}
.audio-lab .flashlight{position:fixed;inset:0;pointer-events:none;background:#dfe9ff;opacity:0;mix-blend-mode:screen;z-index:5}
.audio-lab button.on{border-color:#49e0c8;background:linear-gradient(180deg,#1f4a4a,#173535);box-shadow:0 0 12px #49e0c844}
.audio-lab button.flash{border-color:#49e0c8;box-shadow:0 0 16px #49e0c877}
.audio-lab button.quiet{color:#c9b993;font-style:italic}
.audio-lab .row{display:grid;grid-template-columns:90px 1fr 46px;align-items:center;gap:10px;margin:8px 0;font-size:16px}
.audio-lab .row span:last-child{font-family:'Alegreya Sans SC',sans-serif;color:#c9b993;text-align:right;font-size:14px}
.audio-lab input[type=range]{width:100%;accent-color:#d8b25a}
.audio-lab canvas{width:100%;height:75px;display:block;border-radius:6px;background:#0a0d14;border:1px solid #d8b25a33}
.audio-lab .readout{font-family:'Alegreya Sans SC',sans-serif;font-size:13px;letter-spacing:.05em;color:#a99a78;margin-top:8px;min-height:18px}
.audio-lab .line{font-style:italic;color:#c9b993;font-size:15px;margin-top:8px;min-height:20px}
.audio-lab .hint{font-size:14px;color:#a99a78;font-style:italic;margin:2px 0 8px}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function startDemo(): void {
  G.stopGameplayScenes();
  G.ui.setHud('none');
  const root = G.ui.panel('audio-lab');
  root.classList.add('audio-lab');
  const style = el('style', undefined, CSS);
  root.appendChild(style);

  // QA hook for scripted offline analysis.
  (window as unknown as Record<string, unknown>).selantisAudioLab = {
    renderOffline, analyse, smallSpeaker, SFX_NAMES, AMBIENCE_LAYERS, debug: audioDebug,
    async wav(req: Parameters<typeof renderOffline>[0]) {
      const buf = await renderOffline(req);
      const bytes = new Uint8Array(encodeWav(buf));
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { b64: btoa(bin), stats: analyse(buf) };
    },
  };

  const header = el('header');
  const titles = el('div');
  titles.append(el('h1', undefined, 'Klangwerkstatt'), el('div', 'sub', 'Musik, Effekte und Atmosphären von Selantis zum Anhören'));
  const status = el('div', 'status', 'Ton gesperrt – einmal klicken');
  header.append(titles, status);
  root.appendChild(header);

  const grid = el('div', 'grid');
  const left = el('div');
  const right = el('div');
  grid.append(left, right);
  root.appendChild(grid);

  let pitch = 1;
  let pan = 0;
  let distance = 0;
  let lastSfx: SfxName = 'pickup';
  const readout = el('div', 'readout', '');

  // ---- music
  const music = el('section');
  music.appendChild(el('h2', undefined, 'Musik'));
  const musicBtns = el('div', 'btns');
  const moodButtons = new Map<MusicMood | null, HTMLButtonElement>();
  const markMood = () => moodButtons.forEach((b, m) => b.classList.toggle('on', G.audio.currentMusic() === m));
  for (const [mood, label] of MOODS) {
    const b = el('button', undefined, label);
    b.onclick = () => { G.audio.unlock(); G.audio.music(mood); markMood(); };
    moodButtons.set(mood, b);
    musicBtns.appendChild(b);
  }
  const silence = el('button', 'quiet', 'Stille');
  silence.onclick = () => { G.audio.music(null); markMood(); };
  moodButtons.set(null, silence);
  musicBtns.appendChild(silence);
  music.appendChild(musicBtns);
  left.appendChild(music);

  // ---- ambience
  const amb = el('section');
  amb.appendChild(el('h2', undefined, 'Atmosphäre'));
  const ambBtns = el('div', 'btns');
  const active = new Set<AmbienceLayer>();
  for (const layer of AMBIENCE_LAYERS) {
    const b = el('button', undefined, LAYER_LABELS[layer]);
    b.dataset.layer = layer;
    b.onclick = () => {
      G.audio.unlock();
      if (active.has(layer)) active.delete(layer); else active.add(layer);
      b.classList.toggle('on', active.has(layer));
      G.audio.ambience([...active]);
    };
    ambBtns.appendChild(b);
  }
  const ambOff = el('button', 'quiet', 'Alles aus');
  ambOff.onclick = () => { active.clear(); ambBtns.querySelectorAll('button').forEach(b => b.classList.remove('on')); G.audio.ambience([]); };
  ambBtns.appendChild(ambOff);
  amb.appendChild(ambBtns);
  left.appendChild(amb);

  // ---- mixer
  const mix = el('section');
  mix.appendChild(el('h2', undefined, 'Regler'));
  const slider = (label: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string, on: (v: number) => void) => {
    const row = el('label', 'row');
    const input = el('input');
    input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
    const out = el('span', undefined, fmt(value));
    input.oninput = () => { const v = Number(input.value); out.textContent = fmt(v); on(v); };
    row.append(el('span', undefined, label), input, out);
    mix.appendChild(row);
  };
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  slider('Musik', 0, 1, 0.01, settings.music, pct, v => updateSettings({ music: v }));
  slider('Effekte', 0, 1, 0.01, settings.sfx, pct, v => updateSettings({ sfx: v }));
  slider('Tonhöhe', 0.5, 2, 0.01, 1, v => `×${v.toFixed(2).replace('.', ',')}`, v => { pitch = v; });
  slider('Panorama', -1, 1, 0.05, 0, v => (Math.abs(v) < 0.03 ? 'Mitte' : v < 0 ? `L ${Math.round(-v * 100)}` : `R ${Math.round(v * 100)}`), v => { pan = v; });
  slider('Entfernung', 0, 1, 0.05, 0, v => (v < 0.03 ? 'nah' : v > 0.97 ? 'fern' : `${Math.round(v * 100)} %`), v => { distance = v; });
  const duck = el('button', undefined, 'Musik absenken');
  duck.onclick = () => G.audio.duck(-12, 1500);
  const focus = el('button', undefined, 'Dialog-Fokus');
  focus.onclick = () => { G.audio.unlock(); const on = !audioDebug.focus(); G.audio.dialogueFocus(on); focus.classList.toggle('on', on); };
  const stop = el('button', 'quiet', 'Alles ausblenden');
  stop.onclick = () => { G.audio.stopAll(); stopLoops(); active.clear(); ambBtns.querySelectorAll('button').forEach(b => b.classList.remove('on')); markMood(); };
  const extra = el('div', 'btns');
  extra.style.marginTop = '10px';
  extra.append(duck, focus, stop);
  mix.appendChild(extra);
  left.appendChild(mix);

  // ---- voices
  const voices = el('section');
  voices.appendChild(el('h2', undefined, 'Stimmen'));
  const vbtns = el('div', 'btns');
  const lineEl = el('div', 'line', '');
  let speaking = 0;
  for (const voice of VOICES) {
    const b = el('button', undefined, `${voice.name}<small>${voice.roam ? 'Augenbinde · Stereo' : `${voice.pitch} Hz · ${voice.wave}`}</small>`);
    b.onclick = () => {
      G.audio.unlock();
      const id = ++speaking;
      const chars = [...voice.line];
      let i = 0;
      lineEl.textContent = '';
      const step = () => {
        if (id !== speaking || i >= chars.length) return;
        const ch = chars[i++];
        lineEl.textContent += ch;
        if (/[\p{L}]/u.test(ch) && i % 2 === 0) G.audio.blip(voice.pitch, voice.wave, { pan: voice.roam ? Math.sin(i / 6) * 0.9 : pan });
        window.setTimeout(step, /[.,!?…]/.test(ch) ? 140 : 1000 / 40);
      };
      step();
    };
    vbtns.appendChild(b);
  }
  voices.append(vbtns, lineEl);
  left.appendChild(voices);

  // ---- loops
  const loopsSec = el('section');
  loopsSec.appendChild(el('h2', undefined, 'Schleifen'));
  loopsSec.appendChild(el('div', 'hint', 'Wiederholte Klänge auf der Audio-Uhr: Tempo und Entfernung ändern sich fließend.'));
  const loopBtns = el('div', 'btns');
  const running = new Map<string, { loop: SfxLoop; timer?: number }>();
  const stopLoops = () => {
    running.forEach(r => { r.loop.stop(); window.clearInterval(r.timer); });
    running.clear();
    loopBtns.querySelectorAll('button').forEach(b => b.classList.remove('on'));
  };
  const toggle = (id: string, label: string, sub: string, start: () => { loop: SfxLoop; timer?: number }) => {
    const b = el('button', undefined, `${label}<small>${sub}</small>`);
    b.onclick = () => {
      G.audio.unlock();
      const r = running.get(id);
      if (r) { r.loop.stop(400); window.clearInterval(r.timer); running.delete(id); b.classList.remove('on'); return; }
      running.set(id, start());
      b.classList.add('on');
    };
    loopBtns.appendChild(b);
  };
  let tension = 0;
  toggle('heart', 'Herzschlag', 'wird schneller', () => {
    tension = 0;
    const loop = G.audio.loop('heartbeat', { interval: 0.95 });
    const timer = window.setInterval(() => { tension = Math.min(1, tension + 0.08); loop.set({ interval: 0.95 - tension * 0.5, volume: 0.8 + tension * 0.4 }); }, 400);
    return { loop, timer };
  });
  toggle('riders', 'Reiter ziehen vorbei', 'nah → fern, links → rechts', () => {
    const loop = G.audio.loop('horse', { interval: 0.76, distance: 1, pan: -1 });
    const t0 = performance.now();
    const timer = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 9000);
      loop.set({ pan: -1 + 2 * k, distance: Math.min(1, Math.abs(k - 0.4) * 1.6) }); // closest at 40 %
      if (k >= 1) { loop.stop(800); window.clearInterval(timer); running.delete('riders'); loopBtns.querySelector('[data-loop=riders]')?.classList.remove('on'); }
    }, 100);
    return { loop, timer };
  });
  loopBtns.lastElementChild?.setAttribute('data-loop', 'riders');
  toggle('dogs', 'Hunde in der Ferne', 'Verfolger nahen', () => ({ loop: G.audio.loop('bark-dog', { interval: 1.7, distance: 0.85, pan: 0.5 }) }));
  const drill = el('button', undefined, 'Feuerbohren<small>gedrückt halten</small>');
  let drillLoop: SfxLoop | null = null;
  const drillStop = () => { drillLoop?.stop(150); drillLoop = null; drill.classList.remove('on'); };
  drill.onpointerdown = () => { G.audio.unlock(); drillLoop?.stop(); drillLoop = G.audio.loop('drill', { interval: 0.55 }); drill.classList.add('on'); };
  drill.onpointerup = drillStop;
  drill.onpointerleave = drillStop;
  loopBtns.appendChild(drill);
  loopsSec.appendChild(loopBtns);
  left.appendChild(loopsSec);

  // ---- lightning sync: the storm layer announces each flash before its thunder
  const flash = el('div', 'flashlight');
  root.appendChild(flash);
  const offLightning = events.on('audio:lightning', (e: LightningEvent) => {
    if (!root.isConnected) { offLightning(); return; }
    flash.animate([{ opacity: 0 }, { opacity: 0.55 * e.strength }, { opacity: 0.1 }, { opacity: 0.4 * e.strength }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
  });

  // ---- sfx
  const fx = el('section');
  fx.appendChild(el('h2', undefined, 'Effekte'));
  for (const [group, list] of SFX_GROUPS) {
    fx.appendChild(el('h3', undefined, group));
    const btns = el('div', 'btns');
    for (const [name, label] of list) {
      const b = el('button', undefined, `${label}<small>${name}</small>`);
      b.dataset.sfx = name;
      b.onclick = () => {
        G.audio.unlock();
        G.audio.sfx(name, { pitch, pan, distance });
        lastSfx = name;
        b.classList.add('flash');
        window.setTimeout(() => b.classList.remove('flash'), 220);
      };
      btns.appendChild(b);
    }
    fx.appendChild(btns);
  }

  // ---- meter
  const meter = el('section');
  meter.appendChild(el('h2', undefined, 'Pegel'));
  const canvas = el('canvas');
  canvas.width = 1000; canvas.height = 150;
  meter.appendChild(canvas);
  const analyseBtn = el('button', undefined, 'Letzten Effekt vermessen');
  analyseBtn.style.marginTop = '10px';
  analyseBtn.onclick = async () => {
    readout.textContent = `Vermesse „${lastSfx}“ …`;
    const buf = await renderOffline({ sfx: lastSfx, pitch, distance, seconds: 5 });
    const stats = analyse(buf);
    const sp = await smallSpeaker(buf);
    const fmt = (x: number) => x.toFixed(1).replace('.', ',');
    readout.textContent = `${lastSfx}: Spitze ${fmt(stats.peakDb)} dBFS · Lautheit ${fmt(sp.full)} · Handy-Lautsprecher ${fmt(sp.small)} (${fmt(sp.loss)} dB)`;
  };
  meter.append(analyseBtn, readout);
  right.append(meter, fx);

  // Keep the toggles in sync with programmatic calls (e.g. from the console or QA scripts).
  const syncButtons = () => {
    markMood();
    const wanted = new Set(G.audio.currentAmbience());
    active.clear();
    wanted.forEach(l => active.add(l));
    ambBtns.querySelectorAll<HTMLButtonElement>('button[data-layer]').forEach(b => b.classList.toggle('on', wanted.has(b.dataset.layer as AmbienceLayer)));
  };

  const g2d = canvas.getContext('2d')!;
  let data: Float32Array<ArrayBuffer> | null = null;
  let peakHold = 0;
  const draw = () => {
    if (!root.isConnected) return;
    requestAnimationFrame(draw);
    const state = audioDebug.state();
    const m = audioDebug.music();
    const playing = m.playing && m.mood ? ` · ♪ ${MOODS.find(x => x[0] === m.mood)?.[1] ?? m.mood}` : '';
    const n = audioDebug.effects() + audioDebug.loops();
    const l = audioDebug.layers().length;
    status.textContent = state === 'running'
      ? `Ton aktiv · ${n} ${n === 1 ? 'Effekt' : 'Effekte'} · ${l} ${l === 1 ? 'Atmosphäre' : 'Atmosphären'}${playing}`
      : 'Ton gesperrt – einmal klicken';
    syncButtons();
    status.classList.toggle('on', state === 'running');
    const an = audioDebug.analyser();
    const W = canvas.width, H = canvas.height;
    g2d.fillStyle = '#0a0d14';
    g2d.fillRect(0, 0, W, H);
    g2d.strokeStyle = '#d8b25a22';
    g2d.lineWidth = 1;
    for (let y = 1; y < 4; y++) { g2d.beginPath(); g2d.moveTo(0, (H * y) / 4); g2d.lineTo(W - 70, (H * y) / 4); g2d.stroke(); }
    if (!an) return;
    if (!data || data.length !== an.fftSize) data = new Float32Array(new ArrayBuffer(an.fftSize * 4));
    an.getFloatTimeDomainData(data);
    let peak = 0;
    g2d.strokeStyle = '#49e0c8';
    g2d.lineWidth = 2;
    g2d.shadowColor = '#49e0c8';
    g2d.shadowBlur = 8;
    g2d.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * (W - 80);
      const y = H / 2 - data[i] * (H / 2 - 6);
      peak = Math.max(peak, Math.abs(data[i]));
      if (i === 0) g2d.moveTo(x, y); else g2d.lineTo(x, y);
    }
    g2d.stroke();
    g2d.shadowBlur = 0;
    peakHold = Math.max(peak, peakHold * 0.97);
    const db = peakHold > 0 ? 20 * Math.log10(peakHold) : -60;
    const frac = Math.max(0, Math.min(1, (db + 48) / 48));
    const grad = g2d.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, '#2c7f72'); grad.addColorStop(0.75, '#d8b25a'); grad.addColorStop(1, '#d4573b');
    g2d.fillStyle = '#1a2130';
    g2d.fillRect(W - 50, 6, 36, H - 12);
    g2d.fillStyle = grad;
    g2d.fillRect(W - 50, 6 + (H - 12) * (1 - frac), 36, (H - 12) * frac);
  };
  draw();
  markMood();
}

defineChapter({
  id: 'dev-audio',
  order: 905,
  numeral: 'Dev',
  title: 'Klangwerkstatt',
  subtitle: 'Audio-Testbank',
  hidden: true,
  scenes: [{ id: 'audio-demo', title: 'Klangwerkstatt', start: startDemo }],
});
