import { loadImage } from '../art/assets';
import { manifest, type CharacterEntry } from '../art/manifest';
import type { StoryActionKind } from './interactionRules';

export type IllustrationKind = StoryActionKind | 'blow' | 'stake';
export interface IllustrationState { progress: number; position?: number; breath?: number; noise?: number; watch?: boolean; beat?: boolean; puff?: boolean }

/** Story-specific miniature scenes using the same painted assets as exploration. */
export function createMiniIllustration(host: HTMLElement, kind: IllustrationKind) {
  const art = manifest();
  const canvas = document.createElement('canvas');
  canvas.className = 'mini-illustration';
  canvas.setAttribute('role', 'img');
  const descriptions: Record<IllustrationKind, string> = {
    reach: 'Valentus führt seine Hand zum Licht der Urmacht.', lift: 'Valentus hebt seine Hand über die Wiege der Zwillinge.',
    'open-eyes': 'Durch Lias sich öffnende Augen werden Foltan und Azar sichtbar.', tend: 'Lia versorgt ihre Ferse mit Mutters Tinktur.',
    bellows: 'Azar arbeitet am Amboss neben dem Blasebalg.', blow: 'Lia und Azar knien an der Glut im Steinring.',
    stake: 'Kyra zieht an dem Pflock, während ein Dunkelschatten am Feuer Wache hält.',
  };
  canvas.setAttribute('aria-label', descriptions[kind]);
  host.prepend(canvas);
  host.classList.add('has-mini-art');
  const ctx = canvas.getContext('2d')!;
  const pictures = new Map<string, HTMLImageElement>();
  const files = new Map<string, string>();
  const addCharacter = (id: string, poses: string[]) => {
    const entry = art.characters[id];
    if (entry?.walk) files.set(`${id}:walk`, entry.walk.file);
    for (const pose of poses) if (entry?.poses[pose]) files.set(`${id}:${pose}`, entry.poses[pose].file);
  };
  if (kind === 'lift') addCharacter('valentus', ['cast']);
  if (kind === 'tend') addCharacter('lia', ['sit']);
  if (kind === 'bellows' || kind === 'blow') addCharacter('azar', ['kneel']);
  if (kind === 'blow') addCharacter('lia', ['kneel']);
  if (kind === 'stake') { addCharacter('kyra-bound', ['sit', 'crouch']); addCharacter('shadow-spear', []); }
  const props = kind === 'lift' ? ['cradle-twins'] : kind === 'tend' ? ['blanket'] : kind === 'bellows' ? ['anvil'] : kind === 'blow' ? ['firering', 'campfire'] : kind === 'stake' ? ['iso-stake-0', 'campfire', 'keg'] : [];
  for (const id of props) if (art.props[id]) files.set(id, art.props[id].file);
  if (kind === 'tend') files.set('items', art.icons.atlas);
  const backdrop = kind === 'lift' ? art.backgrounds['prolog-zuflucht'] : kind === 'reach' ? art.plates['prolog-hoehle']
    : kind === 'open-eyes' ? art.plates['k2-geweckt'] : kind === 'tend' ? art.backgrounds['k4-bach']
    : kind === 'blow' ? art.backgrounds['k3-leselager'] : kind === 'stake' ? art.backgrounds['k2-lager']
    : kind === 'bellows' ? art.backgrounds['minigame-forge'] : undefined;
  if (backdrop) files.set('backdrop', backdrop.file);
  host.dataset.art = 'loading';
  let loaded = false, time = 0, height = 200;
  const ready = Promise.all([...files].map(async ([id, file]) => { const image = await loadImage(file); if (image) pictures.set(id, image); })).then(() => {
    loaded = pictures.size === files.size;
    host.dataset.art = loaded ? 'ready' : 'failed';
    return loaded;
  });

  const character = (id: string, pose: string, x: number, y: number, scale: number, facing: 'left' | 'right' = 'right') => {
    const entry: CharacterEntry = art.characters[id];
    const pe = entry.poses[pose];
    const image = pictures.get(`${id}:${pe ? pose : 'walk'}`);
    if (!image) return;
    const w = pe?.w ?? 64, h = pe?.h ?? 64, foot = pe?.foot ?? entry.foot ?? [32, 60];
    const index = entry.walk?.idle?.[facing === 'right' ? 2 : 1] ?? (facing === 'right' ? 8 : 4);
    ctx.save(); ctx.translate(x, y);
    if (pe && facing !== pe.facing && ['left', 'right'].includes(pe.facing)) ctx.scale(-1, 1);
    ctx.drawImage(image, pe ? 0 : index % 4 * 64, pe ? 0 : Math.floor(index / 4) * 64, w, h, -foot[0] * scale, -foot[1] * scale, w * scale, h * scale);
    ctx.restore();
  };
  const prop = (id: string, x: number, y: number, scale: number, rotate = 0, opacity = 1) => {
    const image = pictures.get(id), entry = art.props[id];
    if (!image || !entry) return;
    const frame = Math.floor(time * (entry.fps ?? 6)) % entry.frames;
    ctx.save(); ctx.globalAlpha = opacity; ctx.translate(x, y); ctx.rotate(rotate);
    ctx.drawImage(image, frame * entry.w, 0, entry.w, entry.h, -entry.anchor[0] * scale, -entry.anchor[1] * scale, entry.w * scale, entry.h * scale);
    ctx.restore();
  };
  const glow = (x: number, y: number, radius: number, strength: number, magical = false) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, magical ? '#c2fff9' : '#fff0a8'); gradient.addColorStop(0.2, magical ? '#59e8d7aa' : '#ffa44daa'); gradient.addColorStop(1, '#00000000');
    ctx.save(); ctx.globalAlpha = strength; ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
  };
  const sparks = (x: number, y: number, p: number, magical = false) => {
    ctx.fillStyle = magical ? '#b6ffee' : '#ffc06f';
    for (let i = 0; i < 12; i++) {
      const t = (time * 0.4 + i / 12) % 1;
      ctx.globalAlpha = (1 - t) * p;
      ctx.fillRect(x + Math.sin(i * 3.2 + time) * 22 * t, y - t * 60, 2, 2);
    }
    ctx.globalAlpha = 1;
  };

  function render(state: IllustrationState, dt = 0) {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    height = Math.round(640 * bounds.height / bounds.width);
    if (canvas.width !== 640 || canvas.height !== height) { canvas.width = 640; canvas.height = height; }
    ctx.imageSmoothingEnabled = false; time += dt;
    ctx.fillStyle = '#111b27'; ctx.fillRect(0, 0, 640, height);
    const background = pictures.get('backdrop');
    if (background) {
      // Crop to the card instead of squeezing characters and scenery into its wide aspect ratio.
      const cropH = Math.min(background.height, background.width * height / 640);
      const focus = kind === 'reach' || kind === 'open-eyes' ? 0.38 : 0.64;
      const top = Math.max(0, Math.min(background.height - cropH, background.height * focus - cropH / 2));
      ctx.drawImage(background, 0, top, background.width, cropH, 0, 0, 640, height);
    }
    ctx.fillStyle = kind === 'open-eyes' ? '#00000000' : '#07102099'; ctx.fillRect(0, 0, 640, height);
    if (!loaded) return;
    const p = Math.max(0, Math.min(1, state.progress));
    const y = height * (kind === 'blow' || kind === 'stake' ? 0.87 : 0.78), scale = Math.max(1.3, Math.min(3.6, height / 80));
    if (kind === 'reach') {
      // Valentus is already painted in this plate. The light answers the player's gesture.
      const x = 285;
      const sourceX = 465 - p * 140, sourceY = height * 0.42;
      glow(sourceX, sourceY, 72, 0.65 + p * 0.35, true); sparks(sourceX, sourceY, 0.7, true);
      ctx.strokeStyle = '#74e4d5'; ctx.globalAlpha = p * 0.55; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sourceX, sourceY); ctx.quadraticCurveTo(370, sourceY - 25, x + 43, sourceY + 9); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (kind === 'lift') {
      character('valentus', p > 0.12 ? 'cast' : 'idle', 230, y - p * 7, scale);
      glow(395, y - 25 * scale, 80, p * 0.75, true);
      prop('cradle-twins', 410, y, scale * 1.35); sparks(410, y - 26 * scale, p, true);
    } else if (kind === 'open-eyes') {
      ctx.fillStyle = '#050912';
      const lid = (1 - p) * height * 0.48;
      ctx.fillRect(0, 0, 640, lid); ctx.fillRect(0, height - lid, 640, lid);
      ctx.fillStyle = '#05091277'; ctx.fillRect(0, lid, 640, (1 - p) * height * 0.035); ctx.fillRect(0, height - lid - (1 - p) * height * 0.035, 640, (1 - p) * height * 0.035);
    } else if (kind === 'tend') {
      prop('blanket', 202, y + 8, scale * 1.8);
      character('lia', 'sit', 220, y, scale * 1.4);
      const items = pictures.get('items');
      if (items) {
        const index = art.icons.ids.tincture, cell = art.icons.cell;
        ctx.drawImage(items, index % art.icons.cols * cell, Math.floor(index / art.icons.cols) * cell, cell, cell, 432, height * 0.25, 74, 74);
      }
      // A folded corner of the painted linen is the swab, moving over Lia's outstretched feet.
      const linen = pictures.get('blanket');
      if (linen) ctx.drawImage(linen, 17, 3, 13, 11, 226 + (state.position ?? 0) * 75, y - 14 * scale, 35, 29);
      glow(276, y - 7 * scale, 36, p * 0.35, true);
    } else if (kind === 'bellows') {
      character('azar', 'idle', 100, y + 10, scale * 1.2);
      prop('anvil', 535, y + 4, scale * 1.35);
      glow(500, height * 0.25, 70, 0.12 + p * 0.4);
      sparks(535, y - 18 * scale, p * 0.8);
    } else if (kind === 'blow') {
      const x = 330;
      character('lia', 'kneel', 182, y, scale, 'right'); character('azar', 'kneel', 492, y, scale, 'left');
      glow(x, y - 20, 80, 0.2 + p * 0.75);
      prop('firering', x, y, scale * 1.6);
      if (p > 0.1) prop('campfire', x, y, scale * 1.3, 0, p);
      sparks(x, y - 20, p);
      const breath = state.breath ?? 0;
      for (let i = 0; i < 5; i++) {
        const t = (time * (0.4 + breath) + i / 5) % 1;
        ctx.fillStyle = `rgba(230,238,232,${breath * (1 - t) * 0.65})`;
        ctx.fillRect(198 + t * 118, y - 28 * scale + t * 50, 4, 2);
      }
      if (state.puff) { ctx.fillStyle = '#b6b9ad55'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + Math.sin(i * 4) * 16, y - 32 - i * 12, 8 + i * 4, 0, Math.PI * 2); ctx.fill(); } }
    } else if (kind === 'stake') {
      prop('campfire', 478, height * 0.49, scale * 0.75);
      prop('keg', 555, height * 0.52, scale * 0.65);
      character('shadow-spear', 'idle', 523, height * 0.44, scale * 0.6, state.watch ? 'left' : 'right');
      const tug = state.beat ? Math.sin(time * 25) * 4 : 0;
      character('kyra-bound', 'sit', 245 - p * 12 + tug, y, scale * 1.1, 'right');
      const stakeY = y - p * 25;
      prop('iso-stake-0', 332 + tug * 0.7, stakeY, scale * 0.9, state.beat ? Math.sin(time * 15) * 0.09 : 0);
      ctx.strokeStyle = '#c2a379'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(255 + tug, y - 17 * scale); ctx.lineTo(332, stakeY - 22 * scale); ctx.stroke();
      if (state.watch) { glow(523, height * 0.32, 40, 0.45); }
    }
  }
  return { ready, render };
}
