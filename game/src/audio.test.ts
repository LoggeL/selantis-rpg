import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./settings', () => ({
  getSettings: () => ({ musicVolume: 0.45, effectsVolume: 0.65 }),
  subscribeSettings: () => () => {},
}));

function sceneFixture() {
  const data = new Map<string, unknown>();
  return { data, scene: {
    data: { set(key: string | Record<string, unknown>, value?: unknown) {
      if (typeof key === 'string') data.set(key, value);
      else Object.entries(key).forEach(([name, v]) => data.set(name, v));
    } },
    events: { once: vi.fn(), off: vi.fn() },
  } as unknown as Phaser.Scene };
}

describe('soundtrack playback', () => {
  const sources: any[] = [];
  const oscillators = vi.fn();
  const decode = vi.fn();
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
  const node = () => {
    const result: any = { gain: parameter(), connect: vi.fn(() => result), disconnect: vi.fn() };
    return result;
  };
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); sources.length = 0; oscillators.mockReset();
    decode.mockReset().mockResolvedValue({ duration: 115 });
    class Context {
      state = 'running'; currentTime = 0; sampleRate = 20; destination = node();
      createGain = node; createConvolver = node; createOscillator = oscillators;
      createBuffer = () => ({ getChannelData: () => new Float32Array(52) });
      createBufferSource = () => { const source = { ...node(), start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; };
      decodeAudioData = decode;
    }
    vi.stubGlobal('AudioContext', Context);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('stays silent while loading, then starts the decoded soundtrack without a synth bed', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const audio = await import('./audio'); const { scene, data } = sceneFixture();
    audio.unlockAudio(); const stop = audio.startAmbient(scene, 'dread');
    expect(data.get('audio:state')).toBe('loading');
    expect(sources).toHaveLength(0); expect(oscillators).not.toHaveBeenCalled();
    finish(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }));
    await vi.waitFor(() => expect(data.get('audio:playing')).toBe(true));
    expect(sources).toHaveLength(1); expect(sources[0].start).toHaveBeenCalledOnce();
    expect(oscillators).not.toHaveBeenCalled();
    stop(); expect(data.get('audio:state')).toBe('stopped'); expect(sources[0].stop).toHaveBeenCalledOnce();
  });

  it('reports an HTML asset response and remains silent rather than humming forever', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>game</html>', { headers: { 'content-type': 'text/html' } })));
    const audio = await import('./audio'); const { scene, data } = sceneFixture();
    audio.unlockAudio(); audio.startAmbient(scene, 'dread');
    await vi.waitFor(() => expect(data.get('audio:failed')).toBe(true));
    expect(data.get('audio:error')).toContain('HTML'); expect(data.get('audio:playing')).toBe(false);
    expect(decode).not.toHaveBeenCalled(); expect(sources).toHaveLength(0); expect(oscillators).not.toHaveBeenCalled();
  });

  it('cannot restart a stopped scene when its download completes late', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const audio = await import('./audio'); const { scene, data } = sceneFixture();
    audio.unlockAudio(); audio.startAmbient(scene, 'dread')();
    finish(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }));
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
    expect(data.get('audio:playing')).toBe(false); expect(data.get('audio:state')).toBe('stopped');
    expect(sources).toHaveLength(0); expect(oscillators).not.toHaveBeenCalled();
  });
});
