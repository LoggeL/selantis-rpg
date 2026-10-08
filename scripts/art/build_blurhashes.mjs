#!/usr/bin/env node
/**
 * Precompute previews for every PNG/JPEG/WebP in game/public.
 *
 * Run: node scripts/art/build_blurhashes.mjs [--check] [--force]
 * Requires the game's installed blurhash package and Python 3 with Pillow.
 * The generated JSON doubles as a content-addressed cache. Unchanged image and
 * sidecar bytes skip both image decoding and BlurHash encoding on later runs.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { encode, isBlurhashValid } from '../../game/node_modules/blurhash/dist/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const encoderVersion = JSON.parse(await readFile(resolve(root, 'game/node_modules/blurhash/package.json'), 'utf8')).version;
const settings = { version: 1, encoder: `blurhash@${encoderVersion}`, sampleEdge: 32, components: [4, 3], alpha: 'grayscale', transparentColor: 'nearest-visible', resize: 'bilinear' };
const extensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const args = process.argv.slice(2);
let publicDir = resolve(root, 'game/public');
let output = resolve(root, 'game/src/art/blurhashes.json');
let check = false;
let force = false;
function pathArgument(index) {
  if (!args[index] || args[index].startsWith('--')) throw new Error(`Missing path after ${args[index - 1]}`);
  return resolve(args[index]);
}
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--check': check = true; break;
    case '--force': force = true; break;
    case '--public-dir': publicDir = pathArgument(++i); break;
    case '--output': output = pathArgument(++i); break;
    case '--help':
      console.log('Usage: node scripts/art/build_blurhashes.mjs [--check] [--force] [--public-dir DIR] [--output FILE]');
      process.exit(0);
      break;
    default: throw new Error(`Unknown argument: ${args[i]}`);
  }
}
if (check && force) throw new Error('--force regenerates previews and cannot be combined with --check.');

async function imageFiles(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await imageFiles(resolve(dir, entry.name), relative + '/'));
    else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) files.push(relative);
  }
  return files.sort();
}

async function optionalFile(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function validPreview(preview) {
  return typeof preview?.hash === 'string' && isBlurhashValid(preview.hash).result
    && (preview.alphaHash === undefined || (typeof preview.alphaHash === 'string' && isBlurhashValid(preview.alphaHash).result));
}

function validEntry(entry) {
  if (!entry || !Number.isInteger(entry.width) || !Number.isInteger(entry.height)
    || entry.width < 1 || entry.height < 1 || !validPreview(entry)) return false;
  return entry.frames === undefined || (Array.isArray(entry.frames) && entry.frames.length > 0 && entry.frames.every(frame =>
    Number.isInteger(frame.x) && Number.isInteger(frame.y) && Number.isInteger(frame.width) && Number.isInteger(frame.height)
    && frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0
    && frame.x + frame.width <= entry.width && frame.y + frame.height <= entry.height && validPreview(frame)));
}

function encodePreview(preview) {
  const hash = encode(new Uint8ClampedArray(Buffer.from(preview.rgba, 'base64')), preview.width, preview.height, ...settings.components);
  if (!preview.alpha) return { hash };
  return { hash, alphaHash: encode(new Uint8ClampedArray(Buffer.from(preview.alpha, 'base64')), preview.width, preview.height, ...settings.components) };
}

async function generate(pending, sourceHashes, result) {
  if (!pending.length) return;
  const child = spawn(process.env.SELANTIS_IMAGE_PYTHON || 'python3', [resolve(root, 'scripts/art/blurhash_pixels.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const completed = new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolveExit() : reject(new Error(`BlurHash image sampling failed (${signal ?? code}).`)));
  });
  // Attach a handler immediately so a failing sampler never creates an unhandled rejection.
  completed.catch(() => {});
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', text => process.stderr.write(text));
  child.stdin.on('error', error => { if (error.code !== 'EPIPE') process.stderr.write(`${error.message}\n`); });
  child.stdin.end(JSON.stringify({ settings, images: pending }));
  try {
    for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
      const sampled = JSON.parse(line);
      const entry = { width: sampled.width, height: sampled.height, ...encodePreview(sampled.preview), sourceHash: sourceHashes.get(sampled.file) };
      if (sampled.frames?.length) entry.frames = sampled.frames.map(frame => ({
        x: frame.x, y: frame.y, width: frame.width, height: frame.height, ...encodePreview(frame.preview),
      }));
      result[sampled.file] = entry;
    }
    await completed;
  } catch (error) {
    child.kill();
    throw error;
  }
  for (const image of pending) if (!result[image.file]) throw new Error(`Missing sampled image: ${image.file}`);
}

async function main() {
  const previousBytes = await optionalFile(output);
  let previous = {};
  if (previousBytes) {
    try { previous = JSON.parse(previousBytes.toString()); }
    catch { /* Regenerate an unreadable cache, or report it as stale with --check. */ }
  }
  if (!previous || Array.isArray(previous) || typeof previous !== 'object') previous = {};
  const files = await imageFiles(publicDir);
  const pending = [];
  const sourceHashes = new Map();
  const result = {};
  for (const file of files) {
    const absolute = resolve(publicDir, file);
    const sidecarPath = absolute.slice(0, -extname(absolute).length) + '.json';
    const [bytes, sidecarBytes] = await Promise.all([readFile(absolute), optionalFile(sidecarPath)]);
    const meta = sidecarBytes ? JSON.parse(sidecarBytes.toString()) : {};
    // Include the path because walk-sheet and item-atlas geometry follows folder conventions.
    const sourceHash = createHash('sha256').update(JSON.stringify(settings)).update('\0').update(file)
      .update('\0').update(bytes).update('\0').update(sidecarBytes ?? Buffer.alloc(0)).digest('hex');
    sourceHashes.set(file, sourceHash);
    if (!force && previous[file]?.sourceHash === sourceHash && validEntry(previous[file])) result[file] = previous[file];
    else pending.push({ file, absolute, meta });
  }
  const extra = Object.keys(previous).filter(file => !sourceHashes.has(file));
  if (check) {
    const stale = pending.map(image => image.file);
    if (!previousBytes || stale.length || extra.length) {
      console.error(`BlurHash metadata is stale: ${stale.length} missing/changed images, ${extra.length} removed images.`);
      for (const file of [...stale, ...extra].slice(0, 12)) console.error(`  ${file}`);
      console.error('Run node scripts/art/build_blurhashes.mjs to update it.');
      return 1;
    }
    console.log(`BlurHash metadata is current: ${files.length} images.`);
    return 0;
  }
  await generate(pending, sourceHashes, result);
  const ordered = Object.fromEntries(files.map(file => [file, result[file]]));
  const text = JSON.stringify(ordered, null, 1) + '\n';
  if (previousBytes?.toString() !== text) {
    await mkdir(dirname(output), { recursive: true });
    const temporary = `${output}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, text);
      await rename(temporary, output);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  const frames = Object.values(ordered).reduce((count, entry) => count + (entry.frames?.length ?? 0), 0);
  console.log(`BlurHash metadata: ${files.length} images, ${frames} frames; generated ${pending.length}, reused ${files.length - pending.length}.`);
  return 0;
}

main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
