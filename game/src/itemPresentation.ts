import type { ItemId } from './world/maps';
export const ITEM_FRAME: Record<ItemId, number> = {
  apfel: 0, feder: 2, kupfer: 3, kornblume: 4, kueken: -1,
  proviant: 0, wasserschlauch: 1, dolch: 2, silber: 3, reisezeug: 4, heilzeug: 5, 'buch-kraeuter': 6, 'buch-alana': 7,
};
const TRAVEL = new Set<ItemId>(['proviant', 'wasserschlauch', 'dolch', 'silber', 'reisezeug', 'heilzeug', 'buch-kraeuter', 'buch-alana']);
export const itemTexture = (item: ItemId) => TRAVEL.has(item) ? 'story-items' : 'items';

export function itemIcon(item: ItemId): HTMLSpanElement {
  const icon = document.createElement('span'); icon.className = 'bag-item-icon'; icon.setAttribute('aria-hidden', 'true');
  if (item === 'kueken') {
    icon.style.backgroundImage = 'url("/assets/sprites/crt-fledgling.png")'; icon.style.backgroundSize = '128px 32px';
  } else {
    const story = itemTexture(item) === 'story-items', columns = story ? 4 : 8, frame = ITEM_FRAME[item];
    icon.style.backgroundImage = `url("/assets/ui/${story ? 'story-items' : 'items'}.png")`;
    icon.style.backgroundSize = story ? '128px 64px' : '256px 32px';
    icon.style.backgroundPosition = `${-(frame % columns) * 32}px ${-Math.floor(frame / columns) * 32}px`;
  }
  return icon;
}
