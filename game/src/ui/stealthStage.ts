import { loadImage } from '../art/assets';
import { manifest, type CharacterEntry, type PoseEntry } from '../art/manifest';
import { stealthPhase, stealthSafe, stealthTarget, stealthTiming, type StealthKind, type StealthState } from './interactionRules';

type Facing = 'down' | 'left' | 'right' | 'up';

/** Painted world assets and the campaign's actual sprite sheets, with foreground occlusion. */
export function createStealthStage(stage: HTMLElement, kind: StealthKind) {
  const canvas = document.createElement('canvas');
  canvas.className = 'stealth-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', kind === 'duck' ? 'Lia duckt sich unter vorbeireitenden Dunkelschatten.' : 'Lia bewegt sich zwischen Deckungen vor einer patrouillierenden Wache.');
  stage.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const art = manifest();
  const playerId = kind === 'listen' ? 'lia-cloak' : 'lia';
  const playerEntry = art.characters[playerId];
  const guardEntry = art.characters['shadow-spear'];
  const riderEntry = art.characters['shadow-rider'];
  const files = {
    ground: art.backgrounds[kind === 'listen' ? 'k3-leselager' : 'art-gallery-meadow']?.file,
    player: playerEntry?.walk?.file,
    crouch: playerEntry?.poses.crouch?.file,
    guard: guardEntry?.walk?.file,
    rider: riderEntry?.walk?.file,
    bush: art.props['iso-bush-1']?.file,
    bush2: art.props['iso-bush-3']?.file,
    tree: art.props['oak-tree']?.file,
    torch: art.props['torch']?.file,
  };
  const pictures: Partial<Record<keyof typeof files, HTMLImageElement>> = {};
  let loaded = false, time = 0, lastPosition = 0.5;
  let facing: Facing = 'right';
  let width = 640, height = 280;
  const ready = Promise.all(Object.entries(files).map(async ([name, file]) => {
    if (file) { const image = await loadImage(file); if (image) pictures[name as keyof typeof files] = image; }
  })).then(() => {
    loaded = Boolean(pictures.player && pictures.crouch && pictures.guard && pictures.bush && pictures.tree && pictures.rider);
    stage.dataset.assets = loaded ? 'ready' : 'failed';
    return loaded;
  });
  stage.dataset.character = playerId;
  stage.dataset.assets = 'loading';

  function sprite(image: HTMLImageElement | undefined, entry: CharacterEntry, x: number, y: number, scale: number, dir: Facing, moving: boolean, pose?: PoseEntry) {
    if (!image) return;
    const walk = entry.walk!;
    const row = walk.dirs.indexOf(dir);
    const frame = moving ? row * walk.cols + Math.floor(time * walk.fps) % walk.cols : (walk.idle?.[row] ?? row * walk.cols);
    const w = pose?.w ?? walk.frameW, h = pose?.h ?? walk.frameH;
    const sx = pose ? 0 : frame % walk.cols * w;
    const sy = pose ? 0 : Math.floor(frame / walk.cols) * h;
    const foot = pose?.foot ?? entry.foot ?? [w / 2, h - 4];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (pose && ((dir === 'left' && pose.facing === 'right') || (dir === 'right' && pose.facing === 'left'))) ctx.scale(-1, 1);
    ctx.drawImage(image, sx, sy, w, h, -foot[0] * scale, -foot[1] * scale, w * scale, h * scale);
    ctx.restore();
  }

  function prop(image: HTMLImageElement | undefined, x: number, y: number, w: number, glow = false) {
    if (!image) return;
    ctx.save();
    if (glow) { ctx.shadowColor = '#b6e3a5'; ctx.shadowBlur = 10; }
    const h = image.height * w / image.width;
    ctx.drawImage(image, Math.round(x - w / 2), Math.round(y - h), w, h);
    ctx.restore();
  }

  function text(label: string, x: number, y: number, color = '#eee5cd') {
    ctx.save();
    ctx.font = '13px Alegreya, Georgia, serif'; ctx.textAlign = 'center';
    ctx.shadowColor = '#030705'; ctx.shadowBlur = 4;
    ctx.fillStyle = color; ctx.fillText(label, x, y);
    ctx.restore();
  }

  function shadow(x: number, y: number, w = 18) {
    ctx.fillStyle = '#030a0866'; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  }

  function marker(x: number, y: number, safe: boolean) {
    ctx.strokeStyle = safe ? '#a9e0a0' : '#e2bc76'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, 22, 6, 0, 0, Math.PI * 2); ctx.stroke();
  }

  function render(state: StealthState, started: boolean, dt = 0) {
    const bounds = stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const nextHeight = Math.round(640 * bounds.height / bounds.width);
    if (canvas.width !== width || canvas.height !== nextHeight) {
      height = nextHeight; canvas.width = width; canvas.height = height;
    }
    ctx.imageSmoothingEnabled = false;
    time += dt;
    const phase = stealthPhase(state, kind);
    const searching = started && phase === 'danger';
    const target = stealthTarget(kind, state.round);
    const safe = stealthSafe(state, kind);
    const moving = Math.abs(state.position - lastPosition) > 0.0005;
    if (moving && kind !== 'duck') facing = state.position < lastPosition ? 'left' : 'right';
    lastPosition = state.position;
    ctx.fillStyle = '#101c19'; ctx.fillRect(0, 0, width, height);
    if (pictures.ground) {
      // The farm's open ground and the camp clearing keep the miniature readable without a second UI diagram.
      ctx.drawImage(pictures.ground, 0, 40, pictures.ground.width, pictures.ground.height - 40, 0, 0, width, height);
    }
    ctx.fillStyle = kind === 'listen' ? '#06132199' : '#14201b55'; ctx.fillRect(0, 0, width, height);
    const vignette = ctx.createRadialGradient(width / 2, height * 0.62, height * 0.15, width / 2, height * 0.62, width * 0.7);
    vignette.addColorStop(0, '#030a0800'); vignette.addColorStop(1, '#030a08b0');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
    if (!loaded) { text(stage.dataset.assets === 'failed' ? 'Die Grafiken konnten nicht geladen werden.' : 'Die Szene wird geladen …', width / 2, height / 2); return; }
    const at = (p: number) => 24 + (width - 48) * p;
    const scale = Math.max(1.35, Math.min(2.4, height / 115));
    let playerX: number, playerY: number, hidden: boolean;

    if (kind === 'duck') {
      playerX = width / 2; playerY = height * (0.42 + state.position * 0.42);
      hidden = state.position > 0.63;
      const riding = searching && target > 0.5;
      const cycle = Math.max(0, state.time - stealthTiming(kind).prepare) / stealthTiming(kind).danger;
      for (let i = 0; i < 3; i++) {
        const x = riding ? width * (1.15 - cycle * 1.8) + i * 100 : width * 0.9 + i * 95;
        shadow(x, height * 0.38, 23);
        sprite(pictures.rider, riderEntry, x, height * 0.38, scale, 'left', riding);
      }
      shadow(playerX, playerY); marker(playerX, playerY + 3, hidden);
      sprite(hidden ? pictures.crouch : pictures.player, playerEntry, playerX, playerY, scale, 'right', false, hidden ? playerEntry.poses.crouch : undefined);
      // Actual foliage in front of the character, rather than fading her icon out.
      for (let i = 0; i < 6; i++) prop(i % 2 ? pictures.bush : pictures.bush2, i * 135 - 15, height + 32, 165);
      text(target > 0.5 ? '↓ Unter die Böschung' : '↑ Nach Kyra sehen', width / 2, height - 13, '#d9edbc');
    } else {
      playerX = at(state.position); playerY = height * 0.81;
      hidden = [0.2, 0.8].some(p => Math.abs(state.position - p) < 0.13);
      const guardX = at(searching ? 0.5 : 0.6 + Math.sin(time * 0.9) * 0.12);
      const guardY = height * 0.39;
      if (searching) {
        const light = ctx.createLinearGradient(guardX, guardY - 20, guardX, playerY);
        light.addColorStop(0, '#efc88166'); light.addColorStop(1, '#edba4a0a');
        ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(guardX, guardY - 20);
        ctx.lineTo(target < 0.5 ? width : 0, height); ctx.lineTo(width * (target < 0.5 ? 0.39 : 0.61), height); ctx.closePath(); ctx.fill();
      }
      shadow(guardX, guardY);
      sprite(pictures.guard, guardEntry, guardX, guardY, scale * 0.8, searching ? 'down' : 'up', started && !searching);
      if (kind === 'listen' && pictures.torch) {
        const torch = art.props.torch;
        const frame = Math.floor(time * (torch.fps ?? 8)) % torch.frames;
        ctx.drawImage(pictures.torch, frame * torch.w, 0, torch.w, torch.h, guardX + 10, guardY - 48, torch.w * 1.1, torch.h * 1.1);
      }
      text(searching ? 'Sie sucht!' : 'Blick abgewandt', guardX, Math.max(16, guardY - 48 * scale * 0.8), searching ? '#f6c49c' : '#d9dac9');
      for (const p of [0.2, 0.8]) {
        const x = at(p);
        shadow(x, playerY + 10, 75);
        if (p === target) { marker(x, playerY + 9, true); text('▼', x, Math.max(22, playerY - (kind === 'listen' ? 200 : 140)), '#cbe6ac'); }
      }
      shadow(playerX, playerY); marker(playerX, playerY + 3, hidden && safe);
      sprite(hidden && !moving ? pictures.crouch : pictures.player, playerEntry, playerX, playerY, scale, facing, moving, hidden && !moving ? playerEntry.poses.crouch : undefined);
      // Foliage and trunks are painted after Lia. Their alpha really occludes her sprite.
      for (const p of [0.2, 0.8]) {
        const x = at(p);
        if (kind === 'listen') prop(pictures.tree, x, playerY + 16, 185, p === target);
        else {
          prop(p === 0.2 ? pictures.bush : pictures.bush2, x - 24, playerY + 10, 125, p === target);
          prop(p === 0.2 ? pictures.bush2 : pictures.bush, x + 29, playerY + 16, 116, p === target);
        }
        text(p === target ? 'Deckung' : '', x, height - 10, '#d4e3b4');
      }
    }
    stage.dataset.pose = hidden && !moving ? 'crouch' : moving ? 'walk' : 'idle';
    stage.dataset.hidden = String(hidden);
    if (!hidden) text('Lia', playerX, Math.min(height - 10, playerY + 22));
    if (phase === 'retry') { ctx.fillStyle = '#a9463025'; ctx.fillRect(0, 0, width, height); }
  }
  return { ready, render };
}
