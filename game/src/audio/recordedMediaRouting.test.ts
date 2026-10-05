import { describe, expect, it, vi } from 'vitest';
import { CapturedMediaRoutingError, routeRecordedMedia, screenVoicePan } from './recordedMediaRouting';

function context() {
  const destination = {};
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const panner = { connect: vi.fn(), disconnect: vi.fn(), pan: { setTargetAtTime: vi.fn() } };
  const audioContext = { state: 'running', currentTime: 10, destination,
    createStereoPanner: vi.fn(() => panner), createMediaElementSource: vi.fn(() => source) };
  return { audioContext, source, panner, destination };
}
describe('recorded media spatial route', () => {
  it('distinguishes captured media failure from native fallback and cleans every created graph node', () => {
    const { audioContext, source, panner } = context();
    source.connect.mockImplementation(() => { throw new Error('all connections failed'); });
    expect(() => routeRecordedMedia(audioContext as unknown as AudioContext, {} as HTMLAudioElement)).toThrow(CapturedMediaRoutingError);
    expect(source.disconnect).toHaveBeenCalledOnce(); expect(panner.disconnect).toHaveBeenCalledOnce();
  });
  it('uses game canvas direction with finite clamped stereo pan', () => {
    expect(screenVoicePan(0)).toBe(-1); expect(screenVoicePan(320)).toBe(0); expect(screenVoicePan(640)).toBe(1);
    expect(screenVoicePan(-100)).toBe(-1); expect(screenVoicePan(999)).toBe(1);
    expect(screenVoicePan(undefined)).toBe(0); expect(screenVoicePan(Number.NaN)).toBe(0);
  });
  it('routes to destination independently of sound/music buses, preserves media time and frees graph once', () => {
    const { audioContext, source, panner, destination } = context();
    const media = { currentTime: 7.2, volume: .3, playbackRate: 1 };
    const route = routeRecordedMedia(audioContext as unknown as AudioContext, media as HTMLAudioElement)!;
    expect(source.connect).toHaveBeenCalledWith(panner); expect(panner.connect).toHaveBeenCalledWith(destination);
    route.setPan(-.7); route.setPan(.4);
    expect(panner.pan.setTargetAtTime.mock.calls).toEqual([[-.7, 10, .025], [.4, 10, .025]]);
    expect(media).toEqual({ currentTime: 7.2, volume: .3, playbackRate: 1 });
    route.disconnect(); route.disconnect(); route.setPan(1);
    expect(source.disconnect).toHaveBeenCalledOnce(); expect(panner.disconnect).toHaveBeenCalledOnce();
    expect(panner.pan.setTargetAtTime).toHaveBeenCalledTimes(2);
  });
  it('does not capture native media without a running compatible context', () => {
    const { audioContext } = context(); const media = {} as HTMLAudioElement;
    expect(routeRecordedMedia(null, media)).toBeNull();
    audioContext.state = 'suspended'; expect(routeRecordedMedia(audioContext as unknown as AudioContext, media)).toBeNull();
    expect(audioContext.createMediaElementSource).not.toHaveBeenCalled();
    audioContext.state = 'running'; audioContext.createStereoPanner.mockImplementationOnce(() => { throw new Error('unsupported'); });
    expect(routeRecordedMedia(audioContext as unknown as AudioContext, media)).toBeNull();
    expect(audioContext.createMediaElementSource).not.toHaveBeenCalled();
  });
  it('keeps captured media audible if the stereo connection fails', () => {
    const { audioContext, source, destination } = context();
    source.connect.mockImplementationOnce(() => { throw new Error('unsupported stereo input'); });
    const route = routeRecordedMedia(audioContext as unknown as AudioContext, {} as HTMLAudioElement)!;
    expect(source.connect).toHaveBeenLastCalledWith(destination);
    route.setPan(1); route.disconnect(); expect(source.disconnect).toHaveBeenCalledOnce();
  });
});
