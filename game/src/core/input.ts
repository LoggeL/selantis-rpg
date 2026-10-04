/**
 * Shared virtual input written by touch controls (ui/) and read by gameplay scenes (world/, tactics/).
 * Keyboard input is read by Phaser scenes directly; this object only carries touch/DOM state.
 */
export const virtualInput = {
  /** Analog stick vector, each axis -1..1. */
  x: 0,
  y: 0,
  run: false,
  sneak: false,
  look: false,
  /** Set true for one frame by the action button; consumers must reset it after reading via consumeAction(). */
  actionPressed: false,
};

export function consumeAction(): boolean {
  const pressed = virtualInput.actionPressed;
  virtualInput.actionPressed = false;
  return pressed;
}

/** True while any modal UI (dialogue, menu, journal, plate) owns input. Gameplay must ignore input then. */
export const inputLock = {
  count: 0,
  get locked(): boolean { return this.count > 0; },
  push(): void { this.count++; },
  pop(): void { this.count = Math.max(0, this.count - 1); },
};

/** Whether the current device is primarily touch. */
export const isTouch = typeof window !== 'undefined' && (matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
