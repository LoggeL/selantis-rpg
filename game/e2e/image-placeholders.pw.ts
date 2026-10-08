import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { disableReloads } from './noReloads';

test.use({ viewport: { width: 1280, height: 720 } });
test.beforeEach(async ({ page }) => {
  await disableReloads(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('selantis.settings.v1', JSON.stringify({ music: 0, voice: 0, sfx: 0, textSpeed: 0, reducedMotion: true }));
  });
});

/** Hold full assets without delaying the inline previews or the app's manifest. */
async function holdImages(page: Page, pattern: RegExp) {
  const routes = new Map<string, Route[]>();
  const released = new Set<string>();
  await page.route(pattern, async route => {
    const path = new URL(route.request().url()).pathname;
    if (released.has(path)) { await route.continue(); return; }
    const held = routes.get(path) ?? [];
    held.push(route);
    routes.set(path, held);
  });
  const release = async (file: string) => {
    const path = new URL(file, 'http://local.test').pathname;
    released.add(path);
    const held = routes.get(path) ?? [];
    routes.delete(path);
    await Promise.all(held.map(route => route.continue()));
  };
  return { routes, release, releaseAll: async () => { for (const path of [...routes.keys()]) await release(path); } };
}

async function expectInlinePreview(img: Locator): Promise<void> {
  await expect(img).toHaveAttribute('data-image-state', 'loading');
  await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect.poll(() => img.evaluate(node => {
    const image = node as HTMLImageElement;
    if (!image.complete || !image.naturalWidth) return false;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, i) => i % 4 < 3 && value > 0) && pixels.some((value, i) => i % 4 === 3 && value > 0);
  })).toBe(true);
}

test('the title painting decodes after a delayed request and fades in over its immediate preview', async ({ page }) => {
  const held = await holdImages(page, /\/assets\/ui\/title\.png(?:\?.*)?$/);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const painting = page.locator('.tb-img');
  const preview = page.locator('.tb-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveCSS('background-image', /^url\(["']?data:image\/png;base64,/);
  await expect.poll(() => held.routes.has('/assets/ui/title.png')).toBe(true);
  await expect(painting).not.toHaveClass(/is-loaded/);
  await expect(painting).toHaveCSS('opacity', '0');
  await held.release('/assets/ui/title.png');
  await expect(painting).toHaveClass(/is-loaded/);
  await expect(painting).toHaveCSS('opacity', '1');
  expect(await painting.evaluate(node => ({ width: (node as HTMLImageElement).naturalWidth, height: (node as HTMLImageElement).naturalHeight })))
    .toEqual({ width: 1280, height: 720 });
});

test('large gallery artwork has immediate inline previews and upgrades after the full image loads', async ({ page }) => {
  const held = await holdImages(page, /\/assets\/(?:bg|cut)\/[^?]+\.(?:png|jpe?g|webp)(?:\?.*)?$/);
  await page.goto('/?scene=art-gallery&page=backgrounds', { waitUntil: 'domcontentloaded' });
  const img = page.locator('.art-gallery-overlay .dom img').first();
  await expect(img).toBeVisible();
  await expectInlinePreview(img);
  const full = await img.getAttribute('data-image-source');
  expect(full).toMatch(/\/assets\/bg\//);
  // Authored dimensions remain stable while the tiny thumbnail is on screen.
  expect(await img.evaluate(node => ({ width: (node as HTMLImageElement).width, height: (node as HTMLImageElement).height })))
    .toEqual({ width: 384, height: 216 });
  await expect.poll(() => held.routes.has(full!)).toBe(true);
  await held.release(full!);
  await expect(img).toHaveAttribute('data-image-state', 'ready');
  await expect(img).toHaveAttribute('src', full!);
  await expect.poll(() => img.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(32);
});

test('a failed portrait download keeps its usable local preview', async ({ page }) => {
  await page.route(/\/assets\/portraits\/[^?]+\.png(?:\?.*)?$/, route => route.abort('failed'));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?scene=art-gallery&page=portraits', { waitUntil: 'domcontentloaded' });
  const img = page.locator('.art-gallery-overlay .dom img').first();
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('data-image-state', 'error');
  await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/);
  expect(await img.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  let unregisteredRequests = 0;
  await page.route('**/assets/ui/unregistered-missing.png', async route => {
    unregisteredRequests++;
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Missing' });
  });
  const missing = await page.evaluate(async () => {
    const image = new Image();
    const failed = new Promise<void>(resolve => { image.onerror = () => resolve(); });
    image.src = '/assets/ui/unregistered-missing.png';
    document.body.appendChild(image);
    await failed;
    // A source-mutation loop would starve rendering even after this failed download.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const result = { src: image.getAttribute('src'), state: image.dataset.imageState ?? null };
    image.remove();
    return result;
  });
  expect(missing).toEqual({ src: '/assets/ui/unregistered-missing.png', state: null });
  expect(unregisteredRequests).toBe(1);
  expect(errors).toEqual([]);
});

test('a failed painted packing item invokes its authored icon fallback exactly once', async ({ page }) => {
  let failDownload!: () => void;
  const fail = new Promise<void>(resolve => { failDownload = resolve; });
  await page.route('**/assets/minigames/packen-apple.png', async route => {
    await fail;
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Missing painted item' });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Galerie', exact: true })).toBeVisible();
  const fallback = await page.evaluate(async () => {
    // Open the real packing panel, including its existing once-only error fallback.
    const panelModule = '/src/chapters/kapitel-1/packingPanel.ts';
    const catalogModule = '/src/core/catalog.ts';
    const [{ openPacking }, { items }] = await Promise.all([import(panelModule), import(catalogModule)]);
    void openPacking(() => 1, {});
    return (window as any).G.art.iconDataUrl(items.get('apple')?.icon ?? 'apple') as string;
  });
  const img = page.locator('.k1-pack-item[data-item="apple"] .k1-pack-obj img');
  await expectInlinePreview(img);
  await img.evaluate(node => {
    const image = node as HTMLImageElement;
    image.dataset.observedErrorCount = '0';
    image.addEventListener('error', () => { image.dataset.observedErrorCount = String(Number(image.dataset.observedErrorCount) + 1); });
  });
  failDownload();
  await expect(img).toHaveAttribute('src', fallback);
  await expect(img).toHaveAttribute('data-observed-error-count', '1');
  await expect(img).toHaveCSS('image-rendering', 'pixelated');
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await expect(img).toHaveAttribute('src', fallback);
  await expect(img).toHaveAttribute('data-observed-error-count', '1');
  await expect.poll(() => img.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
});

test('rapid viewer navigation ignores earlier full-image loads arriving after the current picture', async ({ page }) => {
  const held = await holdImages(page, /\/assets\/cut\/[^?]+\.(?:png|jpe?g|webp)(?:\?.*)?$/);
  await page.goto('/?dev', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Galerie', exact: true }).click();
  const thumbnail = page.locator('.gal-thumb').first();
  const expectLandscapeThumbnail = async () => {
    const bounds = await thumbnail.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(0);
    expect(bounds!.height).toBeCloseTo(bounds!.width * 9 / 16, 0);
  };
  await expectInlinePreview(thumbnail);
  await expectLandscapeThumbnail();
  await page.locator('.gal-tile:not(.is-locked)').first().click();
  const img = page.locator('.gal-view-img');
  await expectInlinePreview(img);
  const previous = [await img.getAttribute('data-image-source')];
  await page.keyboard.press('ArrowRight');
  await expectInlinePreview(img);
  previous.push(await img.getAttribute('data-image-source'));
  await page.keyboard.press('ArrowRight');
  await expectInlinePreview(img);
  const current = await img.getAttribute('data-image-source');
  expect(new Set([...previous, current]).size).toBe(3);
  await expect.poll(() => held.routes.has(current!)).toBe(true);
  await held.release(current!);
  await expect(img).toHaveAttribute('data-image-state', 'ready');
  await expect(img).toHaveAttribute('src', current!);
  for (const file of previous) {
    await held.release(file!);
    await expect(page.locator(`.gal-thumb[data-image-source=${JSON.stringify(file)}]`)).toHaveAttribute('data-image-state', 'ready');
  }
  await expectLandscapeThumbnail();
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await expect(img).toHaveAttribute('data-image-source', current!);
  await expect(img).toHaveAttribute('src', current!);
  await expect(img).toHaveAttribute('data-image-state', 'ready');

  // Empty selections cancel in-flight images, so a late download cannot restore the previous art.
  await page.keyboard.press('ArrowRight');
  await expectInlinePreview(img);
  const cleared = await img.getAttribute('data-image-source');
  await page.evaluate(async () => {
    const imageModule = '/src/ui/image.ts';
    const { clearImageSource } = await import(imageModule);
    clearImageSource(document.querySelector('.gal-view-img'));
  });
  await expect(img).not.toHaveAttribute('src', /./);
  await held.release(cleared!);
  await expect(page.locator(`.gal-thumb[data-image-source=${JSON.stringify(cleared)}]`)).toHaveAttribute('data-image-state', 'ready');
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await expect(img).not.toHaveAttribute('src', /./);
  await expect(img).not.toHaveAttribute('data-image-source', /./);
  await expect(img).not.toHaveAttribute('data-image-state', /./);
});

async function textureState(page: Page) {
  return page.evaluate(() => {
    const textures = (window as any).G.game.textures;
    const get = (key: string) => {
      const texture = textures.get(key);
      const canvas = texture.getSourceImage() as HTMLCanvasElement;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let checksum = 0, minAlpha = 255, maxAlpha = 0;
      for (let i = 0; i < pixels.length; i++) {
        checksum = (checksum + pixels[i] * ((i % 251) + 1)) % 2147483647;
        if (i % 4 === 3) { minAlpha = Math.min(minAlpha, pixels[i]); maxAlpha = Math.max(maxAlpha, pixels[i]); }
      }
      return { canvas, pixels, checksum, minAlpha, maxAlpha, frames: texture.frames };
    };
    const walk = get('chr:lia'), fly = get('chr:crow:fly'), flip = get('chr:crow:fly:flip');
    let mirrorDifference = 0;
    for (let y = 0; y < fly.canvas.height; y++) for (let x = 0; x < fly.canvas.width; x++) {
      const mirroredX = Math.floor(x / 64) * 64 + 63 - x % 64;
      for (let channel = 0; channel < 4; channel++) {
        mirrorDifference = Math.max(mirrorDifference,
          Math.abs(fly.pixels[(y * fly.canvas.width + x) * 4 + channel]
            - flip.pixels[(y * flip.canvas.width + mirroredX) * 4 + channel]));
      }
    }
    return {
      walk: { checksum: walk.checksum, minAlpha: walk.minAlpha, maxAlpha: walk.maxAlpha,
        width: walk.canvas.width, height: walk.canvas.height,
        frames: Array.from({ length: 16 }, (_, i) => {
          const frame = walk.frames[i];
          return { x: frame.cutX, y: frame.cutY, width: frame.cutWidth, height: frame.cutHeight };
        }) },
      fly: { checksum: fly.checksum, minAlpha: fly.minAlpha, maxAlpha: fly.maxAlpha }, mirrorDifference,
    };
  });
}

test('canvas sprites appear before download with transparent cells and per-frame mirroring, then upgrade in place', async ({ page }) => {
  const held = await holdImages(page, /\/assets\/sprites\/(?:lia-walk|crow-fly)\.png(?:\?.*)?$/);
  await page.goto('/?scene=art-gallery&page=walk', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.art-gallery-overlay')).toBeVisible();
  await page.waitForFunction(() => {
    const textures = (window as any).G?.game?.textures;
    return textures?.exists('chr:lia') && textures.exists('chr:crow:fly') && textures.exists('chr:crow:fly:flip');
  });
  await expect.poll(() => held.routes.size).toBe(2);
  const before = await textureState(page);
  expect(before.walk.width).toBe(256);
  expect(before.walk.height).toBe(256);
  expect(before.walk.frames).toEqual(Array.from({ length: 16 }, (_, i) => ({ x: i % 4 * 64, y: Math.floor(i / 4) * 64, width: 64, height: 64 })));
  expect(before.walk.minAlpha).toBeLessThan(20);
  expect(before.walk.maxAlpha).toBeGreaterThan(100);
  expect(before.fly.minAlpha).toBeLessThan(20);
  // The small bird occupies only a fraction of its frame, so its blurred alpha is faint.
  expect(before.fly.maxAlpha).toBeGreaterThan(20);
  expect(before.mirrorDifference).toBeLessThanOrEqual(2);
  await held.releaseAll();
  await expect.poll(async () => (await textureState(page)).walk.checksum).not.toBe(before.walk.checksum);
  await expect.poll(async () => (await textureState(page)).fly.checksum).not.toBe(before.fly.checksum);
  const after = await textureState(page);
  expect(after.walk.frames).toEqual(before.walk.frames);
  expect(after.walk.minAlpha).toBe(0);
  expect(after.walk.maxAlpha).toBe(255);
  expect(after.mirrorDifference).toBeLessThanOrEqual(2);
});
