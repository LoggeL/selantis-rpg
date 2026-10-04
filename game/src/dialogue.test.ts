import { beforeEach, describe, expect, it, vi } from 'vitest';
const layout = vi.hoisted(() => ({ mobile: false }));
vi.mock('./audio', () => ({ sfx: { dialogue: vi.fn() } }));
vi.mock('./mobileDialogs', () => ({ usesMobileInterface: () => layout.mobile }));
vi.mock('./portraits', () => ({
  parseDialogue: (text: string) => { const match = /^([^:]+):\s*"?(.*?)"?$/.exec(text); return match ? { name: match[1], text: match[2] } : { text }; },
  resolvePortrait: (_scene: unknown, name: string) => ({ texture: `portrait-${name.toLowerCase()}`, src: `assets/portraits/${name.toLowerCase()}.png` }),
}));
import { Dialogue } from './dialogue';
import { sfx } from './audio';
import { updateSettings } from './settings';
import { dialogueSceneFixture } from './dialogueTestFixture';

beforeEach(() => { updateSettings({ reducedMotion: false }); layout.mobile = false; vi.clearAllMocks(); });
function fixture() { const f = dialogueSceneFixture(); return { ...f, reader: new Dialogue(f.scene) }; }

describe('dialogue reader', () => {
  it('clears a spoken portrait for narration, then restores the next speaker', () => {
    const { reader, objects, data } = fixture();
    reader.setText('Lia: "Wer ist da?"');
    expect(objects[4].visible).toBe(true);
    reader.setText('Im Dunkeln nähern sich zwei Männer dem Lager.');
    expect(objects[4].visible).toBe(false);
    expect(objects[3].value).toBe('');
    expect(data.get('dialogue:speaker')).toBe('');
    expect(data.get('dialogue:identity')).toBe('');
    expect(data.get('dialogue:portraitSrc')).toBe('');
    reader.setText('Azar: "Ist sie tot?"');
    expect(objects[4].visible).toBe(true);
    expect(data.get('dialogue:speaker')).toBe('Azar');
    expect(data.get('dialogue:portraitSrc')).toBe('/assets/portraits/azar.png');
    reader.destroy();
  });
  it('keeps the strangers unidentified while resolving their distinct portraits', () => {
    const { reader, objects, data } = fixture();
    reader.setText('Der Dicke: "Ist sie tot?"');
    expect(data.get('dialogue:speaker')).toBe('???');
    expect(data.get('dialogue:identity')).toBe('Der Dicke');
    expect(objects[3].value).toBe('???');
    expect(data.get('dialogue:portraitSrc')).toContain('der dicke.png');
    reader.setText('Der Schmale: "Ich bin Foltan. Und das ist Azar."');
    reader.finishTyping();
    expect(data.get('dialogue:speaker')).toBe('???');
    reader.setText('Azar: "Schmied."');
    expect(data.get('dialogue:speaker')).toBe('Azar');
    reader.destroy();
  });
  it('reveals only spoken text, then consumes first press without continuing', () => {
    const { reader, data, tick } = fixture(); const next = vi.fn();
    reader.setText('Lia: "Hallo dort."'); reader.setContinue(next);
    expect(data.get('dialogue:speaker')).toBe('Lia');
    tick(); expect(data.get('mobile:dialogue')).toBe('H');
    expect(data.get('dialogue:complete')).toBe('');
    reader.advance(); expect(data.get('mobile:dialogue')).toBe('Hallo dort.'); expect(next).not.toHaveBeenCalled();
    reader.advance(); reader.advance(); expect(next).toHaveBeenCalledTimes(1);
    reader.destroy();
  });
  it('never advances a locked cinematic action, including after finishing letters', () => {
    const { reader, data } = fixture(); reader.setText('Still.'); reader.setContinue(null);
    expect(data.get('mobile:controls')).toMatchObject({ disabled: false });
    reader.advance(); reader.advance();
    expect(data.get('mobile:controls')).toMatchObject({ disabled: true });
    expect(reader.visible).toBe(true); reader.destroy();
  });
  it('lets a callback install a new line and continuation without double advancing', () => {
    const { reader } = fixture(); const second = vi.fn();
    reader.setText('Erste.'); reader.setContinue(() => { reader.setText('Zweite.'); reader.setContinue(second); });
    reader.advance(); reader.advance(); expect(reader.isTyping).toBe(true); expect(second).not.toHaveBeenCalled();
    reader.advance(); reader.advance(); expect(second).toHaveBeenCalledTimes(1); reader.destroy();
  });
  it('uses scene clock letters and a quiet sound at every third spoken letter', () => {
    const { reader, tick } = fixture(); reader.setText('Hallo');
    tick(); tick(); expect(sfx.dialogue).not.toHaveBeenCalled();
    tick(); expect(sfx.dialogue).toHaveBeenCalledTimes(1);
    reader.hide(); tick(); expect(sfx.dialogue).toHaveBeenCalledTimes(1); reader.destroy();
  });
  it('finishes immediately when reduced motion is enabled during reading', () => {
    const { reader, data, tick } = fixture(); reader.setText('Eine lange Zeile.');
    updateSettings({ reducedMotion: true });
    expect(reader.isTyping).toBe(false); expect(data.get('dialogue:complete')).toBe('Eine lange Zeile.');
    tick(); expect(sfx.dialogue).not.toHaveBeenCalled(); reader.destroy();
  });
  it('restores controls once and cancels timers and listeners at shutdown', () => {
    const { reader, data, tick, emit, listeners } = fixture(); const controls = { directions: ['up'] }; data.set('mobile:controls', controls);
    reader.setText('Hi'); reader.setContinue(() => {}); emit('shutdown'); reader.destroy(); tick();
    expect(data.get('mobile:controls')).toBe(controls); expect(data.get('mobile:dialogue')).toBe('');
    expect(listeners.get('update')?.size).toBe(0); expect(data.get('dialogue:active')).toBe(false);
  });
  it('anchors portrait left above its textbox and supplies a native mobile portrait', () => {
    const { reader, objects, data } = fixture(); reader.setText('Lia: "Hallo"', undefined, 'grief');
    const portrait = objects[1], card = objects[4], panel = objects[9];
    expect(portrait.setDisplaySize).toHaveBeenCalledWith(96, 96); expect(objects[3].value).toBe('Lia');
    expect(card.x - 50).toBe(objects[5].x - objects[5].width / 2);
    expect(card.y + 56).toBe(objects[5].y - objects[5].height / 2 + 2);
    expect(data.get('dialogue:portraitSrc')).toBe('/assets/portraits/lia.png');
    expect(data.get('dialogue:emotion')).toBe('grief');
    layout.mobile = true; reader.update(); expect(card.visible).toBe(false); expect(panel.visible).toBe(false);
    layout.mobile = false; reader.update(); expect(panel.visible).toBe(true); expect(card.visible).toBe(true); reader.destroy();
  });
  it('sizes the bottom panel to the full wrapped line before revealing any letters', () => {
    const { reader, objects } = fixture(); reader.setText('Lia: "' + 'a'.repeat(240) + '"');
    expect(objects[5].height).toBe(124); expect(objects[6].y).toBe(236);
    expect(objects[4].y + 56).toBe(226);
    reader.advance(); expect(objects[5].height).toBe(124); reader.destroy();
  });
});
