import { beforeEach, describe, expect, it, vi } from 'vitest';
const layout = vi.hoisted(() => ({ mobile: false }));
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock("../../dom/dialogs", () => ({ usesMobileInterface: () => layout.mobile }));
vi.mock("../../../app/audio", () => ({ unlockAudio: vi.fn(), sfx: { dialogue: vi.fn() } }));
import { sceneInput } from "../../../platform/input/router";
import { StoryPrologueScene, PROLOGUE_CARDS } from "./StoryPrologueScene";
import { TitleScene } from "./BootScene";
import { dialogueSceneFixture } from "../../../tests/dialogueTestFixture";
import { updateSettings } from "../../../app/settings";
import { musicForScene, MUSIC_TRACKS } from "../../../app/musicPolicy";

function fixture() {
  const f = dialogueSceneFixture();
  const s: any = new StoryPrologueScene();
  Object.assign(s, f.scene);
  const keys = new Map<string, any>();
  s.input = { keyboard: { addKey(name: string) {
    const handlers = new Map<string, () => void>();
    const key = { on: (event: string, callback: () => void) => handlers.set(event, callback),
      off: (event: string) => handlers.delete(event), press: () => handlers.get('down')?.() };
    keys.set(name, key); return key;
  } } };
  s.cameras = { main: { setBackgroundColor: vi.fn() } };
  s.scene = { start: vi.fn() };
  s.create();
  return { ...f, s, press: (name = 'E') => {
    const action = ({ E: 'continue', SPACE: 'wait', ENTER: 'confirm', ESC: 'cancel' } as const)[name as 'E' | 'SPACE' | 'ENTER' | 'ESC'];
    sceneInput(s).dispatch({ action, phase: 'activate', source: 'keyboard' });
  }, keys };
}

beforeEach(() => { layout.mobile = false; updateSettings({ reducedMotion: false }); });

describe('four manual prologue cards', () => {
  it('introduces the Urmacht dispute and stays before the historical battle', () => {
    const [council, conflict, army, valentus] = PROLOGUE_CARDS;
    expect(council.text).toContain('wacht über die Urmacht');
    expect(council.text).toContain('Vier Zaubermeister wollen sie für sich gewinnen');
    expect(council.text).toContain('sechs anderen stellen sich ihnen entgegen');
    expect(conflict.text).toContain('Aus dem Streit um die Urmacht wird Krieg');
    expect(army.title).toBe('Vor Dunkelhain');
    expect(valentus.art).toBe('prologue-valentus-ready');
    expect(valentus.text).toContain('Gleich beginnt die Schlacht');
    expect(PROLOGUE_CARDS.map(card => card.text).join(' ')).not.toMatch(/Fiebertraum|flieht|flüchtet|verwundet|Wiege/i);
  });

  it('provides quiet tension beneath the prologue and changes mood for the battle', () => {
    expect(musicForScene('storyprologue')).toBe('dread');
    expect(MUSIC_TRACKS[musicForScene('storyprologue')!]).toContain('dread-lyria-3-5.mp3');
    expect(musicForScene('battle')).toBe('battle');
  });

  it('reveals each card before advancing and starts the battle only after the fourth', () => {
    const { s, data, press, emit } = fixture();
    expect(PROLOGUE_CARDS).toHaveLength(4);
    for (const [index, card] of PROLOGUE_CARDS.entries()) {
      expect(card.text.length).toBeGreaterThan(30);
      expect(data.get('story:prologue')).toEqual({ index, id: card.id, total: 4 });
      expect(data.get('dialogue:typing')).toBe(true);
      press();
      expect(data.get('dialogue:complete')).toBe(card.text);
      expect((data.get('story:prologue') as any).index).toBe(index);
      expect(s.scene.start).not.toHaveBeenCalled();
      press();
    }
    expect(s.scene.start).toHaveBeenCalledExactlyOnceWith('battle');
    press(); expect(s.scene.start).toHaveBeenCalledOnce(); emit('shutdown');
  });

  it('never advances a readable card automatically after its text timer finishes', () => {
    const { s, data, tick, emit } = fixture();
    for (let n = 0; n < PROLOGUE_CARDS[0].text.length + 500; n++) tick();
    expect(data.get('dialogue:typing')).toBe(false);
    expect((data.get('story:prologue') as any).index).toBe(0);
    expect(s.scene.start).not.toHaveBeenCalled();
    expect(data.get('dialogue:speaker')).toBe('');
    expect(data.get('dialogue:portraitSrc')).toBe('');
    expect(data.get('mobile:hudVisible')).toBe(false); emit('shutdown');
  });

  it('supports Space, Enter and touch with the same reveal-then-continue behavior', () => {
    const { data, press, objects, emit } = fixture();
    press('SPACE'); expect((data.get('story:prologue') as any).index).toBe(0);
    press('ENTER'); expect((data.get('story:prologue') as any).index).toBe(1);
    const event = { stopPropagation: vi.fn() };
    objects[3].handlers.pointerdown(undefined, 0, 0, event);
    expect((data.get('story:prologue') as any).index).toBe(1);
    objects[3].handlers.pointerdown(undefined, 0, 0, event);
    expect((data.get('story:prologue') as any).index).toBe(2);
    expect(event.stopPropagation).toHaveBeenCalledTimes(2); emit('shutdown');
  });

  it('keeps mobile narration and explicit skip controls, then removes listeners on shutdown', () => {
    layout.mobile = true;
    const { s, data, press, tick, emit } = fixture();
    tick(); s.update();
    expect(data.get('mobile:controls')).toMatchObject({ directions: [], inventory: false,
      actions: { E: 'Text zeigen', ESC: 'Überspringen' } });
    press('ESC'); press('ESC');
    expect(s.scene.start).toHaveBeenCalledExactlyOnceWith('battle');
    emit('shutdown'); press();
    expect(data.get('dialogue:active')).toBe(false);
    expect(s.scene.start).toHaveBeenCalledOnce();
  });

  it('reframes the whole illustration on resize without restarting the current text', () => {
    const { s, data, objects, tick, emit } = fixture();
    tick(); tick();
    const currentText = data.get('mobile:dialogue');
    expect(objects[1].setScale).toHaveBeenLastCalledWith(220 / 360);
    layout.mobile = true; s.update();
    expect(objects[1].setScale).toHaveBeenLastCalledWith(1);
    expect(data.get('mobile:dialogue')).toBe(currentText);
    expect((data.get('story:prologue') as any).index).toBe(0);
    layout.mobile = false; s.update();
    expect(objects[1].setScale).toHaveBeenLastCalledWith(220 / 360);
    expect(objects[1].setCrop).toHaveBeenLastCalledWith();
    expect(data.get('mobile:dialogue')).toBe(currentText); emit('shutdown');
  });
});

describe('new game entry', () => {
  it('routes the title through the prologue once even if pointer and keyboard fire together', () => {
    const f = dialogueSceneFixture(); const s: any = new TitleScene(); Object.assign(s, f.scene);
    const pointer = new Map<string, () => void>(), keyboard = new Map<string, () => void>();
    let faded!: () => void;
    s.input = { once: (event: string, callback: () => void) => pointer.set(event, callback),
      keyboard: { once: (event: string, callback: () => void) => keyboard.set(event, callback) } };
    s.cameras = { main: { setBackgroundColor: vi.fn(), fadeOut: vi.fn(), once: (_event: string, callback: () => void) => { faded = callback; } } };
    s.tweens = { add: vi.fn() }; s.scene = { start: vi.fn() };
    s.create(); pointer.get('pointerdown')!(); keyboard.get('keydown')!();
    expect(s.cameras.main.fadeOut).toHaveBeenCalledOnce(); faded();
    expect(s.scene.start).toHaveBeenCalledExactlyOnceWith('storyprologue');
  });
});
