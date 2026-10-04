import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock("../../../app/audio", () => ({ sfx: {}, startAmbient: vi.fn() }));
import { LiaScene } from "./LiaScene";
import { RefugeScene } from "./RefugeScene";
import { updateSettings } from "../../../app/settings";
import { CHAPTER_TRANSITION, KYRA_INTRO } from "../../../content/chapters/homecoming/kyraIntro";

function object() {
  const o: any = {};
  for (const name of ['setOrigin', 'setDepth', 'setAlpha']) o[name] = vi.fn(() => o);
  o.destroy = vi.fn();
  return o;
}

function chapter() {
  const s: any = new LiaScene();
  const timers: Array<{ delay: number; run: () => void }> = [];
  const objects: any[] = [];
  const add = () => { const o = object(); objects.push(o); return o; };
  s.add = { rectangle: vi.fn(add), text: vi.fn(add) };
  s.cameras = { main: { setBackgroundColor: vi.fn() } };
  s.tweens = { add: vi.fn() };
  s.time = { delayedCall: (delay: number, run: () => void) => { timers.push({ delay, run }); } };
  s.ghosts = [];
  s.readingCloseup = { show: vi.fn(), setText: vi.fn(), setContinue: vi.fn() };
  s.showHud = vi.fn();
  s.startSisterConversation = vi.fn();
  return { s, timers, objects };
}

beforeEach(() => updateSettings({ reducedMotion: false }));

describe('Valentus to chapter 1', () => {
  it.each([false, true])('holds the black chapter card with reduced motion %s and waits before enabling Kyra captions', reducedMotion => {
    updateSettings({ reducedMotion });
    const { s, timers, objects } = chapter();
    s.intro();
    expect(s.add.text).toHaveBeenCalledWith(320, 180, '14 Jahre später', expect.any(Object));
    expect(s.phase).toBe('intro');
    expect(s.readingCloseup.setText).not.toHaveBeenCalled();
    expect(timers[0].delay).toBe(CHAPTER_TRANSITION.titleHold + (reducedMotion ? 0 : CHAPTER_TRANSITION.titleFade));
    timers[0].run();
    expect(s.phase).toBe('intro');
    expect(s.readingCloseup.show).toHaveBeenCalledWith('cut-kyra-wood');
    expect(s.readingCloseup.setContinue).toHaveBeenCalledWith(null);
    expect(s.readingCloseup.setText).not.toHaveBeenCalled();
    expect(timers[1].delay).toBe(reducedMotion ? 0 : CHAPTER_TRANSITION.revealFade);
    timers[1].run();
    expect(objects.every(o => o.destroy.mock.calls.length === 1)).toBe(true);
    expect(s.phase).toBe('kyra');
    expect(s.readingCloseup.setText).toHaveBeenLastCalledWith(KYRA_INTRO[0].line);
  });

  it('advances gathering, forest and discovery only through the caption continuation, then introduces the sisters', () => {
    const { s } = chapter();
    s.showKyraLine();
    expect(s.showHud).not.toHaveBeenCalled();
    for (let i = 0; i < KYRA_INTRO.length; i++) {
      expect(s.readingCloseup.show).toHaveBeenLastCalledWith(KYRA_INTRO[i].art);
      expect(s.readingCloseup.setText).toHaveBeenLastCalledWith(KYRA_INTRO[i].line);
      s.readingCloseup.setContinue.mock.calls.at(-1)[0]();
      if (i < KYRA_INTRO.length - 1) expect(s.startSisterConversation).not.toHaveBeenCalled();
    }
    expect(s.showHud).toHaveBeenCalledOnce();
    expect(s.startSisterConversation).toHaveBeenCalledOnce();
  });

  it.each([false, true])('finishes the two-second refuge fade on the scene clock with reduced motion %s', reducedMotion => {
    updateSettings({ reducedMotion });
    const s: any = new RefugeScene();
    const black = object();
    s.add = { rectangle: () => black };
    s.ui = { add: vi.fn() };
    s.tweens = { add: vi.fn() };
    s.time = { delayedCall: vi.fn() };
    s.scene = { start: vi.fn() };
    s.wipe = vi.fn();
    s.fadeToNextChapter();
    expect(s.time.delayedCall).toHaveBeenCalledWith(2000, expect.any(Function));
    expect(s.scene.start).not.toHaveBeenCalled();
    s.time.delayedCall.mock.calls[0][1]();
    expect(s.scene.start).toHaveBeenCalledWith('lia');
    if (reducedMotion) expect(s.tweens.add).not.toHaveBeenCalled();
    else expect(s.tweens.add).toHaveBeenCalledWith(expect.objectContaining({ duration: 2000, alpha: 1 }));
  });
});
