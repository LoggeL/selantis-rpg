import { assetUrl } from "../../platform/assets/url";
import { ITEM_FRAME, itemTexture, type ItemId } from "../../modules/inventory/catalog";
export { ITEM_FRAME, itemTexture } from "../../modules/inventory/catalog";

export function itemIcon(item: ItemId): HTMLSpanElement {
  const icon = document.createElement('span'); icon.className = 'bag-item-icon'; icon.setAttribute('aria-hidden', 'true');
  if (item === 'steine' || item === 'zunderholz') {
    icon.style.backgroundImage = `url("${assetUrl(`/assets/ui/${item === 'steine' ? 'camp-stones' : 'camp-wood'}.svg`)}")`; icon.style.backgroundSize = '32px 32px';
  } else if (item === 'kueken') {
    icon.style.backgroundImage = `url("${assetUrl('/assets/sprites/crt-fledgling.png')}")`; icon.style.backgroundSize = '128px 32px';
  } else {
    const story = itemTexture(item) === 'story-items', columns = story ? 4 : 8, frame = ITEM_FRAME[item];
    icon.style.backgroundImage = `url("${assetUrl(`/assets/ui/${story ? 'story-items' : 'items'}.png`)}")`;
    icon.style.backgroundSize = story ? '128px 64px' : '256px 32px';
    icon.style.backgroundPosition = `${-(frame % columns) * 32}px ${-Math.floor(frame / columns) * 32}px`;
  }
  return icon;
}
