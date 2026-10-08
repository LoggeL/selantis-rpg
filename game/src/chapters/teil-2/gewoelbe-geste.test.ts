import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../art/assets', () => ({ loadImage: vi.fn(async () => null) }));
vi.mock('../../art/blurhash', () => ({ previewCanvas: (file: string) => ({ width: file.includes('room') ? 640 : 64, height: file.includes('room') ? 360 : 64 }) }));
vi.mock('../../art/manifest', () => ({ manifest: () => ({
  backgrounds: {
    'e3-gastzimmer': { file: 'room.png' }, 'e3-ordenssaal': { file: 'room-hall.png' },
    'e3-falsches-lager': { file: 'room-camp.png' }, legacy: { file: 'room-legacy.png' },
  },
  characters: { doctor: {
    foot: [32, 60],
    poses: { interact: { file: 'doctor.png', w: 64, h: 64, foot: [32, 60], facing: 'right' } },
    walk: { file: 'doctor-walk.png', frameW: 64, frameH: 64, idle: [0, 4, 8, 12] },
  } },
}) }));
import { restageGesture, type GesturePicture } from './gewoelbe-geste';

class Node {
  constructor(private context: unknown = null) {}
  attrs = new Map<string, string>();
  style: Record<string, string> = {};
  className = '';
  textContent = '';
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  removeAttribute(name: string) { this.attrs.delete(name); }
  getContext() { return this.context; }
}

function setup(title: string, oldDescription: string, context: unknown = null) {
  const original = new Node();
  original.setAttribute('role', 'img');
  original.setAttribute('aria-label', oldDescription);
  const images = [original];
  const help = new Node();
  const heading = new Node(); heading.textContent = title;
  const stage = { querySelector: () => original, prepend: (node: Node) => images.unshift(node), getBoundingClientRect: () => ({ width: 640, height: 200 }) };
  const root = {
    isConnected: true, classList: { contains: () => false }, style: { getPropertyValue: () => '' },
    querySelector: (selector: string) => selector === '.action-instruction' ? help : selector === '.ch-title' ? heading : stage,
    getAttribute: () => title,
  };
  vi.stubGlobal('document', { querySelector: () => root, createElement: () => new Node(context) });
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  return { original, images, help };
}

afterEach(() => vi.unstubAllGlobals());

describe('restaged gesture descriptions', () => {
  it('exposes only the current rope picture and removes the old heel picture from accessibility', () => {
    const t = setup('Die Hände im Seil drehen', 'Lia versorgt ihre Ferse mit Mutters Tinktur.');
    const help = 'Dreh die Handgelenke im Seil, hin und her.';
    const picture: GesturePicture = { background: 'camp', focus: [10, 20], zoom: 3, figures: [], glint: [10, 20] };
    restageGesture('tend', help, picture);
    const exposed = t.images.filter(n => n.getAttribute('aria-hidden') !== 'true' && n.getAttribute('role') === 'img');
    expect(exposed).toHaveLength(1);
    expect(exposed[0].getAttribute('aria-label')).toBe(`Die Hände im Seil drehen. ${help}`);
    expect(t.original.getAttribute('aria-hidden')).toBe('true');
    expect(t.original.getAttribute('aria-label')).toBeNull();
    expect(t.original.getAttribute('role')).toBe('presentation');
    expect(t.help.textContent).toBe(help);
  });

  it('updates the reused wake image when there is no replacement picture', () => {
    const t = setup('Die Augen öffnen', 'Durch Lias sich öffnende Augen werden Foltan und Azar sichtbar.');
    const help = 'Die Lider kleben, der Kopf ist schwer. Schieb die Augen trotzdem auf.';
    restageGesture('open-eyes', help);
    expect(t.images).toHaveLength(1);
    expect(t.original.getAttribute('aria-label')).toBe(`Die Augen öffnen. ${help}`);
    expect(t.original.getAttribute('aria-hidden')).toBeNull();
    expect(t.original.getAttribute('role')).toBe('img');
  });

  it.each([
    ['e3-gastzimmer', 2.2, 2.2], ['e3-gastzimmer', undefined, 1], ['e3-ordenssaal', undefined, 1],
    ['e3-falsches-lager', undefined, 1], ['legacy', undefined, 1],
  ] as const)('renders %s with explicit figureScale %s (default 1) without moving pose or walk feet', (background, explicitScale, scale) => {
    const ctx = {
      drawImage: vi.fn(), translate: vi.fn(), save: vi.fn(), restore: vi.fn(), scale: vi.fn(), fillRect: vi.fn(),
      createRadialGradient: () => ({ addColorStop: vi.fn() }),
    };
    setup('Den Kristall berühren', 'Altes Bild', ctx);
    const picture: GesturePicture = {
      background, figureScale: explicitScale, focus: [320, 180], zoom: 3, glint: [320, 180],
      figures: [
        { id: 'doctor', pose: 'interact', at: [300, 160], facing: 'right' },
        { id: 'doctor', pose: 'idle', at: [330, 180], facing: 'right' },
      ],
    };
    restageGesture('reach', 'Die Hände auf den Kristall legen.', picture);
    const figures = ctx.drawImage.mock.calls.slice(1);
    expect(figures).toHaveLength(2);
    for (const args of figures) {
      expect(args.slice(3, 5)).toEqual([64, 64]); // Source frames remain unscaled.
      expect(args[5]).toBeCloseTo(-32 * 3 * scale);
      expect(args[6]).toBeCloseTo(-60 * 3 * scale);
      expect(args[7]).toBeCloseTo(64 * 3 * scale);
      expect(args[8]).toBeCloseTo(64 * 3 * scale);
    }
    const sx = 320 - 640 / 3 / 2, sy = 180 - 200 / 3 / 2;
    expect(ctx.translate.mock.calls[0][0]).toBeCloseTo((300 - sx) * 3);
    expect(ctx.translate.mock.calls[0][1]).toBeCloseTo((160 - sy) * 3);
    expect(ctx.translate.mock.calls[1][0]).toBeCloseTo((330 - sx) * 3);
    expect(ctx.translate.mock.calls[1][1]).toBeCloseTo((180 - sy) * 3);
  });
});
