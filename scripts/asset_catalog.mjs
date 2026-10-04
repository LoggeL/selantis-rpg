import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetManifest } from '../game/src/platform/assets/schema.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const categoryOrder = ['bg', 'cut', 'sprites', 'portraits', 'ui', 'props', 'social'];
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));

function graphicDimensions(bytes, file) {
  if (file.endsWith('.png')) {
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.subarray(12, 16).toString() !== 'IHDR') throw new Error(`Invalid PNG: ${file}`);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  const text = bytes.toString('utf8');
  const svg = /<svg\b[^>]*>/.exec(text)?.[0];
  const box = /viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/.exec(svg ?? '');
  const width = /\bwidth=["']([\d.]+)(?:px)?["']/.exec(svg ?? '');
  const height = /\bheight=["']([\d.]+)(?:px)?["']/.exec(svg ?? '');
  if (!svg || (!box && (!width || !height))) throw new Error(`SVG dimensions unavailable: ${file}`);
  return [Number(width?.[1] ?? box[1]), Number(height?.[1] ?? box[2])];
}

/** Existing art producers continue writing the legacy manifest; all consumers use this compilation. */
export function compileAssetCatalog(root = projectRoot) {
  const publicRoot = join(root, 'game/public');
  const source = readJSON(join(publicRoot, 'assets/manifest.json'));
  if (source.schemaVersion !== undefined && source.schemaVersion !== 1) throw new Error('Unsupported source asset schema version');
  if (!source.sprites || !source.images || !source.icons || !Array.isArray(source.icons.names)) throw new Error('Invalid legacy asset manifest');
  const portraits = readJSON(join(root, 'game/src/content/assets/portraits.json'));
  const registrations = readJSON(join(root, 'game/src/content/assets/registrations.json'));
  const definitions = readJSON(join(root, 'game/src/content/assets/packs.json'));
  const byId = new Map(), byFile = new Map();
  function register(id, descriptor) {
    if (byId.has(id)) throw new Error(`Duplicate asset id: ${id}`);
    if (typeof descriptor.file !== 'string' || !/^assets\/[a-zA-Z0-9_./-]+\.(png|svg)$/.test(descriptor.file) || descriptor.file.split('/').includes('..')) throw new Error(`Invalid asset file: ${id}`);
    if (byFile.has(descriptor.file)) throw new Error(`Duplicate asset file: ${descriptor.file}`);
    byId.set(id, descriptor); byFile.set(descriptor.file, { id, ...descriptor });
  }
  for (const [id, sprite] of Object.entries(source.sprites)) register(id, { ...sprite, kind: 'spritesheet' });
  for (const [id, file] of Object.entries(source.images)) register(id, { file, kind: 'image' });
  for (const key of ['icons', 'items']) if (source[key]) {
    const { file, size } = source[key];
    register(key, { file, frameW: size, frameH: size, kind: 'spritesheet' });
  }
  for (const file of new Set([...Object.values(portraits.dialogue), ...Object.values(portraits.expressions)])) {
    const id = `portrait-${file}`, path = `assets/portraits/${file}.png`;
    if (byId.has(id)) {
      if (byId.get(id).file !== path) throw new Error(`Portrait path disagrees: ${id}`);
    } else register(id, { file: path, kind: 'image' });
  }
  for (const [id, file] of Object.entries(registrations)) register(id, { file, kind: 'image' });

  const graphicFiles = [];
  function collect(directory, prefix) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) collect(join(directory, entry.name), file);
      else if (entry.isFile() && /\.(png|svg)$/.test(file)) graphicFiles.push(file);
    }
  }
  collect(join(publicRoot, 'assets'), 'assets');
  for (const { file } of byId.values()) if (!graphicFiles.includes(file)) throw new Error(`Missing asset: ${file}`);
  const assets = graphicFiles.sort().map(file => {
    const bytes = readFileSync(join(publicRoot, file));
    const [width, height] = graphicDimensions(bytes, file);
    const category = file.split('/')[1];
    const meta = byFile.get(file);
    const id = meta?.id ?? `catalog-${category}-${file.split('/').pop().replace(/\.(png|svg)$/, '')}`;
    const revision = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    const asset = { id, file, url: `${file}?v=${revision}`, category, kind: meta?.kind ?? 'image', width, height, bytes: bytes.length };
    if (asset.kind === 'spritesheet') {
      Object.assign(asset, { frameW: meta.frameW, frameH: meta.frameH, cols: meta.cols ?? width / meta.frameW, rows: meta.rows ?? height / meta.frameH });
      if (meta.foot) asset.foot = meta.foot;
    }
    return asset;
  });
  assets.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const selectors = {
    '@valentus-portraits': asset => ['portrait-valentus', 'portrait-valentus-wounded', 'portrait-dialogue-valentus'].includes(asset.id),
    '@lia-portraits': asset => ['portrait-lia', 'portrait-dialogue-lia'].includes(asset.id),
    '@kyra-portraits': asset => ['portrait-kyra', 'portrait-dialogue-kyra'].includes(asset.id),
    '@companions-portraits': asset => ['portrait-foltan', 'portrait-azar', 'portrait-dialogue-foltan', 'portrait-dialogue-azar'].includes(asset.id),
    '@lia-appearances': asset => /^(lia(?:-farm|-travel|-cloak|-crouch)?-walk|lia-hide|lia-story-poses)$/.test(asset.id),
    '@critters': asset => asset.id.startsWith('crt-'),
    '@raid-closeups': asset => asset.id.startsWith('cinematic-raid-'),
    '@camp-props': asset => asset.id.startsWith('camp-'),
  };
  const packs = {};
  for (const [name, entries] of Object.entries(definitions)) {
    packs[name] = [...new Set(entries.flatMap(entry => {
      if (!entry.startsWith('@')) return [entry];
      if (!selectors[entry]) throw new Error(`Unknown asset selector: ${entry}`);
      return assets.filter(selectors[entry]).map(asset => asset.id);
    }))].sort();
  }
  const manifest = validateAssetManifest({ schemaVersion: 1, assets, packs, iconNames: source.icons.names });
  const icons = assets.find(asset => asset.id === 'icons');
  if (manifest.iconNames.length > icons.cols * icons.rows) throw new Error('Icon names exceed atlas frames');
  return manifest;
}

export function assetLoadMetrics(manifest) {
  const bytesFor = ids => {
    const files = new Set();
    return ids.reduce((sum, id) => {
      const asset = manifest.assets.find(asset => asset.id === id);
      if (files.has(asset.file)) return sum;
      files.add(asset.file); return sum + asset.bytes;
    }, 0);
  };
  const startup = [...new Set([...manifest.packs.shared, ...manifest.packs.title])];
  return {
    catalogAssets: manifest.assets.length,
    catalogGraphicBytes: manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
    startupGraphicBytes: bytesFor(startup),
    runtimeManifestBytes: Buffer.byteLength(JSON.stringify(manifest)),
    packGraphicBytes: Object.fromEntries(Object.entries(manifest.packs).map(([name, ids]) => [name, bytesFor(ids)])),
  };
}
