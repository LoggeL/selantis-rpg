import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, isBlurhashValid } from 'blurhash';
import { afterEach, describe, expect, it, vi } from 'vitest';
import hashes from './blurhashes.json';
import assetManifest from '../../public/assets/manifest.json';
import { previewInfo, type PreviewInfo } from './blurhash';

const registry: Record<string, PreviewInfo> = hashes;
const publicDir = fileURLToPath(new URL('../../public/', import.meta.url));

async function publicImages(dir: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await publicImages(resolve(dir, entry.name), `${file}/`));
    else if (entry.isFile() && /\.(?:png|jpe?g|webp)$/i.test(entry.name)) files.push(file);
  }
  return files.sort();
}

afterEach(() => vi.unstubAllGlobals());

describe('Blurhash asset coverage', () => {
  it('covers every public bitmap, including images outside the manifest', async () => {
    const files = await publicImages(publicDir);
    expect(files.length).toBeGreaterThan(0);
    expect(Object.keys(registry).sort()).toEqual(files);
    for (const file of files) expect(previewInfo(file), file).not.toBeNull();
  });

  it('has decodable colour and alpha previews with frames inside their source image', () => {
    for (const [file, info] of Object.entries(registry)) {
      expect(Number.isInteger(info.width) && info.width > 0, `${file} width`).toBe(true);
      expect(Number.isInteger(info.height) && info.height > 0, `${file} height`).toBe(true);
      for (const preview of [info, ...(info.frames ?? [])]) {
        expect(isBlurhashValid(preview.hash).result, file).toBe(true);
        expect(decode(preview.hash, 3, 2).length, file).toBe(24);
        if (preview.alphaHash) {
          expect(isBlurhashValid(preview.alphaHash).result, `${file} alpha`).toBe(true);
          expect(decode(preview.alphaHash, 3, 2).length, `${file} alpha`).toBe(24);
        }
      }
      for (const frame of info.frames ?? []) {
        expect(frame.x, file).toBeGreaterThanOrEqual(0);
        expect(frame.y, file).toBeGreaterThanOrEqual(0);
        expect(frame.width, file).toBeGreaterThan(0);
        expect(frame.height, file).toBeGreaterThan(0);
        expect(frame.x + frame.width, file).toBeLessThanOrEqual(info.width);
        expect(frame.y + frame.height, file).toBeLessThanOrEqual(info.height);
      }
    }
  });

  it('keeps independent, transparent previews in every walk-sheet animation cell', () => {
    for (const character of Object.values(assetManifest.characters)) {
      for (const sheet of [character.walk, 'sneak' in character ? character.sneak : undefined]) {
        if (!sheet) continue;
        const info = registry[sheet.file];
        expect(info, sheet.file).toBeDefined();
        expect(info.frames, sheet.file).toHaveLength(sheet.cols * sheet.rows);
        info.frames!.forEach((frame, i) => {
          expect({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }, sheet.file).toEqual({
            x: (i % sheet.cols) * sheet.frameW, y: Math.floor(i / sheet.cols) * sheet.frameH,
            width: sheet.frameW, height: sheet.frameH,
          });
          expect(frame.alphaHash, `${sheet.file} frame ${i}`).toBeDefined();
        });
      }
    }
    const walk = registry['assets/sprites/lia-walk.png'];
    expect(new Set(walk.frames!.map(frame => frame.hash)).size).toBeGreaterThan(1);
    const alpha = decode(walk.frames![0].alphaHash!, 32, 32);
    const opacity = Array.from(alpha).filter((_, i) => i % 4 === 0);
    expect(Math.min(...opacity)).toBeLessThan(20);
    expect(Math.max(...opacity)).toBeGreaterThan(100);
  });
});

describe('Blurhash URL resolution', () => {
  it('resolves local asset queries and same-origin absolute URLs', () => {
    vi.stubGlobal('location', { origin: 'https://selantis.example', href: 'https://selantis.example/' });
    const expected = registry['assets/bg/art-gallery-meadow.png'];
    for (const file of [
      'assets/bg/art-gallery-meadow.png', './assets/bg/art-gallery-meadow.png',
      '/assets/bg/art-gallery-meadow.png?v=release#scene',
      'https://selantis.example/assets/bg/art-gallery-meadow.png?v=release',
      '//selantis.example/assets/bg/art-gallery-meadow.png',
      '/assets/bg/art%2Dgallery%2Dmeadow.png',
    ]) expect(previewInfo(file), file).toBe(expected);
  });

  it('leaves unrelated, inline, external and malformed URLs alone', () => {
    vi.stubGlobal('location', { origin: 'https://selantis.example', href: 'https://selantis.example/' });
    for (const file of [
      'assets/missing.png', 'data:image/png;base64,x', 'blob:https://selantis.example/example',
      'https://other.example/assets/bg/art-gallery-meadow.png',
      '//other.example/assets/bg/art-gallery-meadow.png', '/assets/%broken.png',
    ]) expect(previewInfo(file), file).toBeNull();
  });
});
