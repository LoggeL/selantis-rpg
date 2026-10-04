import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
const renderers = vi.hoisted(() => ({ character: true, touch: false, dialog: { content: {}, destroy: vi.fn() } }));
vi.mock('../../presentation/dom/characterSheetControls', () => ({ openBag: () => renderers.character, closeCharacterStats: vi.fn() }));
vi.mock('../../presentation/dom/dialogs', () => ({ usesMobileInterface: () => renderers.touch, createMobileDialog: () => renderers.dialog }));
import { InventoryHud } from '../../presentation/phaser/InventoryHud';

afterEach(() => vi.clearAllMocks());
function fixture() {
  const visibility = () => ({ visible: false, setVisible(value: boolean) { this.visible = value; } });
  const bag: any = Object.create(InventoryHud.prototype);
  const published: unknown[] = [];
  Object.assign(bag, {
    enabled: true, openState: false, characterDialog: false, inv: { proviant: 1 }, itemActions: [],
    scene: { game: {}, data: { set: (_key: string, value: unknown) => published.push(value) }, input: { keyboard: { resetKeys: vi.fn() } } },
    panel: visibility(), tooltip: visibility(), frame: { setStrokeStyle: vi.fn() },
    refresh: vi.fn(), renderMobileItems: vi.fn(), onOpen: vi.fn(),
  });
  return { bag, published };
}
describe('inventory renderer ownership', () => {
  it.each([
    { character: true, touch: false, canvas: false },
    { character: false, touch: true, canvas: false },
    { character: false, touch: false, canvas: true },
  ])('keeps the inventory gate open with character=$character and touch=$touch', ({ character, touch, canvas }) => {
    renderers.character = character; renderers.touch = touch;
    const { bag, published } = fixture();
    bag.toggle();
    expect(bag.isOpen).toBe(true); expect(bag.panel.visible).toBe(canvas);
    expect(published.at(-1)).toMatchObject({ open: true, available: true });
    bag.toggle();
    expect(bag.isOpen).toBe(false); expect(bag.panel.visible).toBe(false);
    expect(published.at(-1)).toMatchObject({ open: false });
    if (touch) expect(renderers.dialog.destroy).toHaveBeenCalledOnce();
  });
});
