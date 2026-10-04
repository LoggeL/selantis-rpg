import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'output/site');
const media = [
  'output/imagegen/lia-pixel-film-look.png',
  'output/imagegen/tutorial-valentus-battle-film-look.png',
  'output/audio/rauberlied-lyria-3-5.mp3',
  'output/audio/scenes/battle-dark-lyria-3-5.mp3',
  'output/audio/scenes/dread-lyria-3-5.mp3',
  'output/audio/scenes/grief-lyria-3-5.mp3',
  'output/audio/scenes/flight-lyria-3-5.mp3',
  'output/audio/scenes/refuge-lyria-3-5.mp3',
  'output/audio/scenes/exploration-lyria-3-5.mp3',
];

async function commitId() {
  try {
    let head = (await readFile(join(root, '.git/HEAD'), 'utf8')).trim();
    if (head.startsWith('ref: ')) {
      const ref = head.slice(5);
      if (ref !== 'refs/heads/main') return null;
      try { head = (await readFile(join(root, '.git', ref), 'utf8')).trim(); }
      catch {
        const packed = await readFile(join(root, '.git/packed-refs'), 'utf8');
        head = packed.split('\n').find(line => line.endsWith(` ${ref}`))?.split(' ')[0] ?? '';
      }
    }
    return /^[a-f0-9]{40}$/.test(head) ? head : null;
  } catch { return null; }
}

async function files(directory, relative = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), name));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}

await rm(target, { recursive: true, force: true });
await cp(join(root, 'game/dist'), target, { recursive: true });
for (const name of media) {
  await mkdir(dirname(join(target, name)), { recursive: true });
  await cp(join(root, name), join(target, name));
}
let concept = await readFile(join(root, 'konzept.html'), 'utf8');
concept = concept.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '');
concept = concept.replace('Konzept und Medien, noch kein Spielbuild.',
  'Visuelles Konzept. <a href="/">Spielbaren Prolog öffnen</a>.');
await writeFile(join(target, 'konzept.html'), concept);
await cp(join(root, 'musik.html'), join(target, 'musik.html'));
await cp(join(root, 'assets.html'), join(target, 'assets.html'));
await cp(join(root, 'site'), join(target, 'site'), { recursive: true });
// Catalog the selected public graphics only. No raw generations or QA files enter the site.
const manifest = JSON.parse(await readFile(join(target, 'assets/manifest.json'), 'utf8'));
const metadata = new Map();
for (const [id, sprite] of Object.entries(manifest.sprites)) metadata.set(sprite.file, { id, ...sprite });
for (const [id, file] of Object.entries(manifest.images)) metadata.set(file, { id });
for (const key of ['icons', 'items']) {
  const atlas = manifest[key];
  if (atlas) metadata.set(atlas.file, { id: key, frameW: atlas.size, frameH: atlas.size });
}
metadata.set('assets/sprites/road-travelers-walk.png', { id: 'road-travelers-walk', frameW: 128, frameH: 64 });
const categoryOrder = ['bg', 'cut', 'sprites', 'portraits', 'ui', 'social'];
const catalog = [];
for (const file of await files(join(target, 'assets'), 'assets')) {
  if (!file.endsWith('.png')) continue;
  const category = file.split('/')[1];
  if (!categoryOrder.includes(category)) continue;
  const bytes = await readFile(join(target, file));
  if (bytes.subarray(1, 4).toString() !== 'PNG') throw new Error(`Invalid PNG: ${file}`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const meta = metadata.get(file) ?? {};
  const asset = { id: meta.id ?? file.split('/').pop().slice(0, -4), file, category, width, height };
  if (meta.frameW && meta.frameH) {
    if (width % meta.frameW || height % meta.frameH) throw new Error(`Invalid sprite grid: ${file}`);
    Object.assign(asset, { frameW: meta.frameW, frameH: meta.frameH, cols: width / meta.frameW, rows: height / meta.frameH });
  }
  catalog.push(asset);
}
catalog.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || a.id.localeCompare(b.id));
await writeFile(join(target, 'assets/catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
const hashes = {};
for (const name of await files(target)) {
  hashes[name] = createHash('sha256').update(await readFile(join(target, name))).digest('hex');
}
const gitCommit = await commitId();
const createdAt = new Date().toISOString();
const release = {
  release: `selantis-${gitCommit?.slice(0, 12) ?? createdAt.replace(/\D/g, '').slice(0, 14)}`,
  domain: 'selantis.logge.top', gitCommit, createdAt, files: hashes,
};
await writeFile(join(target, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify({ release: release.release, gitCommit, files: Object.keys(hashes).length }));
