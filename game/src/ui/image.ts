import { previewDataUrl, previewInfo } from '../art/blurhash';
import { assetUrl } from '../art/manifest';
import './image.css';

interface PendingImage { url: string; shown: string; lazy: boolean; start: () => void }
const pending = new WeakMap<HTMLImageElement, PendingImage>();
const autoSized = new WeakSet<HTMLImageElement>();
let intersection: IntersectionObserver | null = null;

/** Invalidate an in-flight picture when a locked or empty selection has no illustration. */
export function clearImageSource(img: HTMLImageElement): void {
  pending.delete(img);
  intersection?.unobserve(img);
  delete img.dataset.imageState;
  delete img.dataset.imageSource;
  img.removeAttribute('src');
}

/** Show the local Blurhash immediately, then swap only after the full image is decoded. */
export function setImageSource(img: HTMLImageElement, file: string, opts: { lazy?: boolean } = {}): void {
  const url = assetUrl(file);
  if (pending.get(img)?.url === url) return;
  intersection?.unobserve(img);
  const info = previewInfo(url), placeholder = previewDataUrl(url);
  img.decoding = 'async';
  if (!info || !placeholder) {
    pending.delete(img);
    delete img.dataset.imageState;
    delete img.dataset.imageSource;
    img.src = url;
    return;
  }
  // Preserve authored sizing, while reserving the intrinsic aspect ratio in viewers and portraits.
  if (autoSized.has(img) || (!img.hasAttribute('width') && !img.hasAttribute('height'))) {
    img.width = info.width; img.height = info.height;
    autoSized.add(img);
  }
  img.dataset.imageSource = url;
  img.dataset.imageState = 'loading';
  img.src = placeholder;
  let started = false;
  const state: PendingImage = { url, shown: placeholder, lazy: opts.lazy ?? img.loading === 'lazy', start() {
    if (started || pending.get(img) !== state) return;
    started = true;
    intersection?.unobserve(img);
    const full = new Image();
    full.decoding = 'async';
    full.onload = async () => {
      try { await full.decode(); } catch { /* onload confirms usable pixels */ }
      if (pending.get(img) !== state) return;
      state.shown = url;
      img.src = url;
      img.dataset.imageState = 'ready';
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches && typeof img.animate === 'function') {
        img.animate([{ filter: 'blur(3px)' }, { filter: 'blur(0)' }], { duration: 220, easing: 'ease-out' });
      }
    };
    full.onerror = () => {
      if (pending.get(img) !== state) return;
      img.dataset.imageState = 'error';
      // Authored images may already have an error fallback, such as the packing panel's item icons.
      img.dispatchEvent(new Event('error'));
    };
    full.src = url;
  } };
  pending.set(img, state);
  if (state.lazy && typeof IntersectionObserver !== 'undefined') {
    intersection ??= new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) pending.get(entry.target as HTMLImageElement)?.start();
    }, { rootMargin: '240px' });
    intersection.observe(img);
  } else state.start();
}

/** Cover small UI images authored via HTML templates as well as later additions. */
export function observeImagePlaceholders(root: HTMLElement): () => void {
  const visit = (img: HTMLImageElement) => {
    if (img.dataset.imageManaged === 'true') return;
    const src = img.getAttribute('src');
    if (!src) { pending.delete(img); intersection?.unobserve(img); return; }
    if (/^(data:|blob:)/.test(src)) return;
    if (!previewInfo(src)) return;
    const state = pending.get(img);
    if (state && (src === state.shown || img.src === state.shown)) {
      if (state.lazy && img.dataset.imageState === 'loading') intersection?.observe(img);
      return;
    }
    if (!state && img.complete && img.naturalWidth > 0) return;
    setImageSource(img, src);
  };
  const scan = (node: Node) => {
    if (!(node instanceof Element)) return;
    if (node instanceof HTMLImageElement) visit(node);
    node.querySelectorAll<HTMLImageElement>('img').forEach(visit);
  };
  scan(root);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') scan(record.target);
      else record.addedNodes.forEach(scan);
      for (const node of record.removedNodes) {
        if (node instanceof HTMLImageElement) intersection?.unobserve(node);
        if (node instanceof Element) node.querySelectorAll('img').forEach(img => intersection?.unobserve(img));
      }
    }
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  return () => observer.disconnect();
}
