import { readFileSync } from 'node:fs';
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

export default defineConfig({ plugins: [sceneMusicAssets()] });
