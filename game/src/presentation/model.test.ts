import { describe, expect, it, vi } from 'vitest';
import { PresentationModel, scenePresentation } from "./model";
import { dialogueSceneFixture } from "../tests/dialogueTestFixture";

describe('presentation snapshot', () => {
  it('publishes atomic updates to both renderers and keeps unsubscribed views detached', () => {
    const model = new PresentationModel(), canvas = vi.fn(), dom = vi.fn();
    const unsubscribe = model.subscribe(canvas); model.subscribe(dom);
    model.publish({ name: 'Lia', hp: 0.5 }); expect(canvas.mock.lastCall?.[0]).toMatchObject({ name: 'Lia', hp: 0.5 });
    expect(dom.mock.lastCall?.[0]).toBe(canvas.mock.lastCall?.[0]); unsubscribe(); model.publish({ objective: 'Zum Lager gehen.' });
    expect(canvas).toHaveBeenCalledTimes(2); expect(dom).toHaveBeenCalledTimes(3);
    model.dispose(); model.publish({ hp: 0 }); expect(dom).toHaveBeenCalledTimes(3);
  });
  it('mirrors typed publication for legacy E2E probes and disposes on scene shutdown', () => {
    const fixture = dialogueSceneFixture(), model = scenePresentation(fixture.scene), listener = vi.fn();
    model.subscribe(listener); model.publish({ dialogueText: 'Hallo', dialogueActive: true, objective: 'Weitergehen.' });
    expect(fixture.data.get('mobile:dialogue')).toBe('Hallo'); expect(fixture.data.get('dialogue:active')).toBe(true);
    fixture.emit('shutdown'); model.publish({ dialogueActive: false }); expect(listener).toHaveBeenCalledTimes(2);
  });
});
