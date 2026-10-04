import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'output/site');
const media = [
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
await cp(join(root, 'musik.html'), join(target, 'musik.html'));
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
