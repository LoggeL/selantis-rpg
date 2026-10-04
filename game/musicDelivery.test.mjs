import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { sceneMusicAssets } from './vite.config.mjs';
import { MUSIC_TRACKS } from './src/audio/tracks';

describe('authored scene music delivery', () => {
  let server;
  let origin;
  let http;
  const sourceRoot = new URL('../', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('output/audio/scenes/manifest.json', sourceRoot), 'utf8'));

  it('covers every soundtrack requested by the game', () => {
    expect(Object.values(MUSIC_TRACKS).sort()).toEqual(manifest.map(track => `output/audio/scenes/${track.file}`).sort());
  });
  beforeAll(async () => {
    server = await createServer({ configFile: false, root: new URL('.', import.meta.url).pathname,
      base: '/play/', plugins: [sceneMusicAssets()], optimizeDeps: { noDiscovery: true, include: [] },
      // Immutable delivery checks need neither HMR nor filesystem watchers.
      server: { middlewareMode: true, hmr: false, watch: null } });
    http = createHttpServer(server.middlewares);
    await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${http.address().port}`;
  });
  afterAll(async () => {
    await new Promise(resolve => http?.close(resolve));
    await server?.close();
  });

  it('serves every selected MP3 with its exact manifest bytes, including a nested base path', async () => {
    for (const track of manifest) {
      const response = await fetch(`${origin}/play/output/audio/scenes/${track.file}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('audio/mpeg');
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(bytes.length).toBe(track.size_bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(track.sha256);
    }
  });

  it('returns 404 for a missing MP3 instead of the HTML application shell', async () => {
    const response = await fetch(`${origin}/play/output/audio/scenes/missing.mp3`);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type') ?? '').not.toContain('text/html');
  });
});
