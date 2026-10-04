import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const sourceRoot = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('../output/audio/scenes/manifest.json', import.meta.url), 'utf8'));
const tracks = manifest.map(({ file }) => `output/audio/scenes/${file}`);

/** The authored tracks live outside game/public; serve and bundle the same bytes. */
export function sceneMusicAssets() {
  let base = '/';
  return {
    name: 'selantis-scene-music',
    configResolved(config) { base = config.base; },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0];
        if (!path?.startsWith(`${base}output/audio/scenes/`)) return next();
        const track = tracks.find(name => `${base}${name}` === path);
        if (!track || !['GET', 'HEAD'].includes(request.method)) {
          response.statusCode = 404;
          response.end();
          return;
        }
        try {
          const bytes = readFileSync(new URL(track, sourceRoot));
          response.setHeader('Content-Type', 'audio/mpeg');
          response.setHeader('Content-Length', bytes.length);
          response.setHeader('Cache-Control', 'no-cache');
          response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch (error) { next(error); }
      });
    },
    buildStart() {
      // A missing selected track must fail a release, rather than ship silent music.
      for (const name of tracks) this.addWatchFile(fileURLToPath(new URL(name, sourceRoot)));
    },
    generateBundle() {
      for (const name of tracks) {
        this.emitFile({ type: 'asset', fileName: name, source: readFileSync(new URL(name, sourceRoot)) });
      }
    },
  };
}

/** Stable across builds; changes when any served graphic or manifest bytes change. */
export function assetContentVersion(root = fileURLToPath(new URL('./public/assets/', import.meta.url))) {
  const paths = [];
  function collect(directory, prefix = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) collect(join(directory, entry.name), `${relative}/`);
      else if (entry.isFile()) paths.push(relative);
    }
  }
  collect(root);
  const digest = createHash('sha256');
  for (const relative of paths.sort()) {
    const bytes = readFileSync(join(root, relative));
    digest.update(`${relative}\0${bytes.length}\0`).update(bytes);
  }
  return digest.digest('hex').slice(0, 12);
}

export default defineConfig({
  plugins: [sceneMusicAssets()],
  define: { __ASSET_VERSION__: JSON.stringify(assetContentVersion()) },
});
