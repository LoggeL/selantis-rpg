/** Recorded speech has its own HTMLMediaElement volume, independent of music and effects buses. */
export class CapturedMediaRoutingError extends Error {
  constructor() { super('Recorded media routing failed after capture'); this.name = 'CapturedMediaRoutingError'; }
}

export interface RecordedMediaRoute { setPan(pan: number): void; disconnect(): void }

export function screenVoicePan(x: number | undefined, width = 640): number {
  if (x === undefined || !Number.isFinite(x) || !Number.isFinite(width) || width <= 0) return 0;
  return Math.max(-1, Math.min(1, (x - width / 2) / (width / 2)));
}

/** Use only an already unlocked context; unavailable WebAudio leaves native media playback untouched. */
export function routeRecordedMedia(context: AudioContext | null, audio: HTMLAudioElement): RecordedMediaRoute | null {
  if (!context || context.state !== 'running' || typeof context.createStereoPanner !== 'function') return null;
  let panner: StereoPannerNode | undefined;
  let source: MediaElementAudioSourceNode | undefined;
  let direct = false;
  try {
    // Prepare the output first: do not capture native media if this browser cannot build the route.
    panner = context.createStereoPanner();
    panner.connect(context.destination);
    source = context.createMediaElementSource(audio);
    try { source.connect(panner); }
    catch {
      // Capturing the element redirects its output. A direct destination keeps this failure audible.
      source.connect(context.destination);
      panner.disconnect();
      direct = true;
    }
  } catch {
    try { source?.disconnect(); } catch { /* Already detached. */ }
    try { panner?.disconnect(); } catch { /* Already detached. */ }
    if (source) throw new CapturedMediaRoutingError();
    return null;
  }
  let closed = false;
  return {
    setPan(value) {
      if (closed || direct || !panner || context.state !== 'running') return;
      const pan = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
      try { panner.pan.setTargetAtTime(pan, context.currentTime, .025); } catch { /* Optional spatial route. */ }
    },
    disconnect() {
      if (closed) return;
      closed = true;
      try { source?.disconnect(); } catch { /* Already detached. */ }
      try { panner?.disconnect(); } catch { /* Already detached. */ }
    },
  };
}
