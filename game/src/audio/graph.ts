/**
 * Mixer graph shared by the real-time engine and offline renders:
 *
 *   sfx ─────────────┐
 *   voice ───────────┼─> fx sum ─> glue compressor ─┐
 *   amb ─> ambFocus ─┤                              ├─> limiter ─> soft clip ─> analyser ─> destination
 *   reverb return ───┘   duck ─> musicFocus ─> music┘
 *
 * Music bypasses the glue compressor so authored tracks keep their dynamics, but everything meets the
 * final limiter and a gentle soft clipper, so nothing can ever clip harshly.
 */
import { mulberry32 } from './math';

export interface Graph {
  ctx: BaseAudioContext;
  /** Settings-controlled buses. */
  music: GainNode;
  sfx: GainNode;
  amb: GainNode;
  voice: GainNode;
  /** Duck stage for music (stings lower it briefly). */
  duck: GainNode;
  /** Dialogue focus stages: hold music / ambience a little lower while a dialogue box is open. */
  musicFocus: GainNode;
  ambFocus: GainNode;
  /** Reverb send input (unscaled). */
  verb: GainNode;
  /** Reverb sends that follow the sfx / ambience volume settings. Recipes send here. */
  sfxVerb: GainNode;
  ambVerb: GainNode;
  master: GainNode;
  analyser: AnalyserNode;
}

/** Stereo impulse response: a warm, mid-sized room/hall with a soft pre-delay. */
export function makeImpulse(ctx: BaseAudioContext, seconds = 2.2, seed = 7): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  const pre = Math.floor(rate * 0.018);
  for (let ch = 0; ch < 2; ch++) {
    const rnd = mulberry32(seed + ch * 101);
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / (length - pre);
      // darker as it decays: one-pole lowpass with falling cutoff
      const a = 0.55 + 0.4 * t;
      lp = lp * a + (rnd() * 2 - 1) * (1 - a);
      const decay = Math.pow(1 - t, 2.4) * Math.exp(-t * 2.5);
      data[i] = lp * decay * 2.2;
    }
    // a few early reflections
    for (const [ms, g] of [[11, 0.5], [23, 0.35], [37, 0.25], [53, 0.18]] as const) {
      const idx = Math.floor((ms + ch * 3) * rate / 1000);
      if (idx < length) data[idx] += g * (ch ? -1 : 1) * 0.6;
    }
  }
  return buffer;
}

/** Soft clipper: linear up to 0.8, then smoothly saturates towards ±1. */
export function softClipTable(n = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const knee = 0.8;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + (1 - knee) * Math.tanh((ax - knee) / (1 - knee));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

export function buildGraph(ctx: BaseAudioContext, destination: AudioNode = ctx.destination): Graph {
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;

  const clip = ctx.createWaveShaper();
  clip.curve = softClipTable();

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 2;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;

  const master = g(0.9);
  master.connect(limiter);
  limiter.connect(clip);
  clip.connect(analyser);
  analyser.connect(destination);

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -14;
  glue.knee.value = 10;
  glue.ratio.value = 3;
  glue.attack.value = 0.004;
  glue.release.value = 0.22;
  const fxSum = g(1);
  fxSum.connect(glue);
  glue.connect(master);

  const sfx = g(1); sfx.connect(fxSum);
  const voice = g(1); voice.connect(fxSum);
  const ambFocus = g(1); ambFocus.connect(fxSum);
  const amb = g(1); amb.connect(ambFocus);

  // reverb: band-limited send so the tail stays clean
  const verb = g(1);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = makeImpulse(ctx);
  const ret = g(0.55);
  verb.connect(hp).connect(lp).connect(conv).connect(ret).connect(fxSum);

  const sfxVerb = g(1); sfxVerb.connect(verb);
  const ambVerb = g(1); ambVerb.connect(verb);

  const duck = g(1);
  const musicFocus = g(1);
  const music = g(1);
  duck.connect(musicFocus).connect(music);
  music.connect(master);

  return { ctx, music, sfx, amb, voice, duck, musicFocus, ambFocus, verb, sfxVerb, ambVerb, master, analyser };
}
