import { assetUrl, manifest } from '../art/manifest';
import { speakers } from '../core/catalog';
import { devMode } from './chapters';
import { ctx } from './context';
import { el, sfx } from './dom';
import { setImageSource } from './image';
import { NavList, type NavItem } from './nav';
import { everythingUnlocked } from './unlocks';

/**
 * Title-menu gallery: book plates, portraits and painted places. Every picture unlocks the first time the game shows
 * it (plate, dialogue portrait, map background) and stays unlocked across saves; dev mode and the unlock cheat show
 * everything.
 */

type Kind = 'plate' | 'portrait' | 'background';
interface Seen { plate: Record<string, string>; portrait: Record<string, string[]>; background: Record<string, string> }

const STORE = 'selantis.gallery.v1';
let seen: Seen | null = null;

function load(): Seen {
  if (seen) return seen;
  seen = { plate: {}, portrait: {}, background: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Seen>;
    seen = { plate: raw.plate ?? {}, portrait: raw.portrait ?? {}, background: raw.background ?? {} };
  } catch { /* storage optional */ }
  return seen;
}

function save(): void {
  try { localStorage.setItem(STORE, JSON.stringify(seen)); } catch { /* storage optional */ }
}

/** Unlocks a picture for the gallery. `label` is the plate caption / place name; for portraits the mood. */
export function markSeen(kind: Kind, id: string, label = ''): void {
  if (!id) return;
  const s = load();
  if (kind === 'portrait') {
    const mood = label || 'neutral';
    const moods = s.portrait[id] ?? (s.portrait[id] = []);
    if (moods.includes(mood)) return;
    moods.push(mood);
  } else {
    if (s[kind][id] !== undefined && (s[kind][id] || !label)) return;
    s[kind][id] = label;
  }
  save();
}

/** Story order of an asset id by its prefix: prologue, chapters I–V, part 2, part 3, the rest. */
function rank(id: string): number {
  const m = /^(k(\d)|e(\d)|p|prolog)-/.exec(id);
  if (!m) return 9;
  if (m[2]) return Number(m[2]);
  if (m[3]) return 4 + Number(m[3]);
  return 0;
}
const byStory = (a: string, b: string) => rank(a) - rank(b) || a.localeCompare(b);

function pretty(id: string): string {
  const name = id.replace(/^(k\d|e\d|p|prolog)-/, '').replace(/-/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function speakerName(portraitId: string): string {
  for (const def of speakers.values()) if ((def.portrait ?? def.id) === portraitId && def.name) return def.name;
  return pretty(portraitId);
}

const MOOD_LABEL: Record<string, string> = {
  neutral: 'Ruhig', happy: 'Fröhlich', sad: 'Traurig', angry: 'Wütend', surprised: 'Überrascht', determined: 'Entschlossen',
  hurt: 'Verletzt', pained: 'Erschöpft', thinking: 'Nachdenklich', scared: 'Verängstigt', worried: 'Besorgt',
  ashamed: 'Beschämt', smirk: 'Spöttisch', grim: 'Finster', cold: 'Kalt', struggle: 'Im Widerstreit', devoted: 'Ergeben',
};

/** Bonus artworks: never shown in the story, open from the start. */
const BONUS: Record<string, string> = { 'bonus-goldener-eber': 'Im Goldenen Eber' };

interface Entry { id: string; title: string; open: boolean; images: { url: string; note: string }[] }

function entries(tab: Kind): Entry[] {
  const m = manifest();
  const all = devMode() || everythingUnlocked();
  const s = load();
  if (tab === 'plate') {
    return Object.keys(m.plates).sort(byStory).map(id => ({
      id, title: s.plate[id] || BONUS[id] || pretty(id), open: all || id in s.plate || id in BONUS,
      images: [{ url: assetUrl(m.plates[id].file), note: '' }],
    }));
  }
  if (tab === 'background') {
    return Object.keys(m.backgrounds).filter(id => !/^(dev-|art-gallery)/.test(id)).sort(byStory).map(id => ({
      id, title: s.background[id] || pretty(id), open: all || id in s.background,
      images: [{ url: assetUrl(m.backgrounds[id].file), note: '' }],
    }));
  }
  return Object.keys(m.portraits).sort((a, b) => speakerName(a).localeCompare(speakerName(b), 'de') || a.localeCompare(b)).map(id => {
    const set = m.portraits[id];
    const moods = Object.keys(set).filter(mood => all || s.portrait[id]?.includes(mood))
      .sort((a, b) => (a === 'neutral' ? -1 : b === 'neutral' ? 1 : a.localeCompare(b)));
    return { id, title: speakerName(id), open: moods.length > 0, images: moods.map(mood => ({ url: assetUrl(set[mood]), note: MOOD_LABEL[mood] ?? pretty(mood) })) };
  });
}

const TABS: { kind: Kind; label: string }[] = [
  { kind: 'plate', label: 'Bilder' },
  { kind: 'portrait', label: 'Figuren' },
  { kind: 'background', label: 'Schauplätze' },
];

export interface GalleryCtl { key(e: KeyboardEvent): boolean }

/** Builds the gallery into `host`. Q / Tab (or the tab buttons) switch sections, Enter opens a picture. */
export function buildGallery(host: HTMLElement, onBack: () => void): GalleryCtl {
  host.textContent = '';
  const tabs = el('div', 'gal-tabs');
  const count = el('div', 'gal-count');
  const grid = el('div', 'gal-grid');
  host.append(tabs, count, grid);
  let tab = 0;
  let nav: NavList | null = null;
  let viewer: { close(): void; key(e: KeyboardEvent): boolean } | null = null;
  const tabButtons = TABS.map((t, i) => {
    const b = el('button', 'gal-tab', t.label);
    b.type = 'button';
    b.addEventListener('click', e => { e.stopPropagation(); show(i); });
    tabs.appendChild(b);
    return b;
  });
  const back = el('button', 'gal-back', 'Zurück');
  back.type = 'button';
  back.addEventListener('click', e => { e.stopPropagation(); onBack(); });
  tabs.appendChild(back);

  function show(i: number): void {
    if (i !== tab) sfx('ui-move', { volume: 0.5 });
    tab = (i + TABS.length) % TABS.length;
    tabButtons.forEach((b, k) => b.classList.toggle('on', k === tab));
    const list = entries(TABS[tab].kind);
    const open = list.filter(e => e.open);
    count.textContent = `${open.length} von ${list.length} entdeckt`;
    grid.textContent = '';
    grid.classList.toggle('is-portraits', TABS[tab].kind === 'portrait');
    const items: NavItem[] = list.map(entry => {
      const tile = el('button', entry.open ? 'gal-tile' : 'gal-tile is-locked');
      tile.type = 'button';
      if (entry.open) {
        const img = el('img', 'gal-thumb');
        img.loading = 'lazy';
        img.alt = entry.title;
        setImageSource(img, entry.images[0].url, { lazy: true });
        tile.append(img, el('span', 'gal-label', entry.title));
      } else {
        tile.append(el('span', 'gal-lock', '?'), el('span', 'gal-label', '???'));
      }
      grid.appendChild(tile);
      return { el: tile, activate: () => (entry.open ? openViewer(open, open.indexOf(entry)) : sfx('ui-cancel', { volume: 0.5 })) };
    });
    nav = new NavList(items, { columns: ctx.root.classList.contains('is-small') ? 3 : 4 });
    grid.scrollTop = 0;
  }

  function openViewer(list: Entry[], index: number): void {
    sfx('ui-open', { volume: 0.6 });
    const root = el('div', 'gal-view');
    const img = el('img', 'gal-view-img');
    const caption = el('div', 'gal-view-cap');
    const hint = el('div', 'gal-view-hint', '← → blättern · Esc schließen');
    root.append(img, caption, hint);
    host.appendChild(root);
    let i = index, mood = 0;
    const paint = () => {
      const entry = list[i];
      const pic = entry.images[mood] ?? entry.images[0];
      setImageSource(img, pic.url);
      img.classList.toggle('is-portrait', TABS[tab].kind === 'portrait');
      const moods = entry.images.length > 1 ? `  ·  ${pic.note} (${mood + 1}/${entry.images.length})` : '';
      caption.textContent = entry.title + moods;
    };
    // ← → step through moods first (portraits), then to the neighbouring picture.
    const step = (d: number) => {
      const n = list[i].images.length;
      if (mood + d >= 0 && mood + d < n) mood += d;
      else { i = (i + d + list.length) % list.length; mood = d > 0 ? 0 : list[i].images.length - 1; }
      sfx('ui-move', { volume: 0.45 });
      paint();
    };
    const close = () => { root.remove(); viewer = null; sfx('ui-cancel', { volume: 0.5 }); };
    root.addEventListener('click', e => {
      e.stopPropagation();
      const r = root.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.25) step(-1); else if (x > 0.75) step(1); else close();
    });
    viewer = {
      close,
      key(e) {
        if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Enter' || e.key === ' ') { close(); return true; }
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { step(-1); return true; }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { step(1); return true; }
        return true;
      },
    };
    paint();
  }

  show(0);
  return {
    key(e) {
      if (viewer) return viewer.key(e);
      if (e.key === 'q' || e.key === 'Q' || e.key === 'PageUp') { show(tab - 1); return true; }
      if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); show(tab - 1); return true; }
      if (e.key === 'Tab' || e.key === 'PageDown') { e.preventDefault(); show(tab + 1); return true; }
      return nav?.key(e) ?? false;
    },
  };
}
