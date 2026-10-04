import { test, expect, type Page } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1280, height: 800, mobile: false },
  { name: 'phone portrait', width: 390, height: 844, mobile: true },
  { name: 'phone landscape', width: 844, height: 390, mobile: true },
];

async function sceneReady(page: Page, key: string) {
  await page.waitForFunction(key => (window as any).game?.scene.isActive(key), key);
}

async function raidStep(page: Page, step: string, ready = true) {
  await expect.poll(() => page.evaluate(() =>
    (window as any).game.scene.getScene('raid').data.get('story:raid')),
  { timeout: 10_000, message: `Raid reaches ${step}${ready ? ' with continuation ready' : ''}` })
    .toMatchObject(ready ? { step, ready: true } : { step });
}

async function interact(page: Page, mobile: boolean) {
  if (mobile) await page.locator('.mobile-action[data-key="E"]').click();
  else await page.keyboard.press('KeyE', { delay: 50 });
}

async function continueRaid(page: Page, mobile: boolean) {
  const before = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('raid');
    return { step: scene.data.get('story:raid').step, typing: scene.data.get('dialogue:typing') };
  });
  if (before.typing) {
    await interact(page, mobile);
    // Natural typing can finish while Playwright waits for a stable touch target.
    // In that case this click already continued the line, so do not press twice.
    if (await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('story:raid').step) !== before.step) return;
    await page.waitForFunction(() => !(window as any).game.scene.getScene('raid').data.get('dialogue:typing'));
  }
  await interact(page, mobile);
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function portraitAboveCaption(page: Page, mobile: boolean) {
  if (mobile) {
    const card = page.locator('.mobile-dialogue-portrait');
    const face = card.locator('img[data-mobile-portrait]');
    await expect(card).toBeVisible();
    await expect(face).toBeVisible();
    await expect.poll(() => face.evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 1)).toBe(true);
    await expect(card.locator('[data-mobile-speaker]')).not.toHaveText('');
    const cardBox = (await card.boundingBox())!;
    const captionBox = (await page.locator('.mobile-caption').boundingBox())!;
    const faceBox = (await face.boundingBox())!;
    expect(Math.abs(cardBox.x - captionBox.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(cardBox.y + cardBox.height - captionBox.y)).toBeLessThanOrEqual(3);
    expect(faceBox.width).toBeGreaterThanOrEqual(80);
    expect(faceBox.height).toBeGreaterThanOrEqual(80);
    expect(cardBox.y).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    await noHorizontalOverflow(page);
  } else {
    const bounds = await page.evaluate(() => {
      const dialogue = (window as any).game.scene.getScene('raid').closeup.dialogue;
      const card = dialogue.portraitCard.list[0].getBounds();
      const panel = dialogue.panelBack.getBounds();
      return { left: card.left, bottom: card.bottom, panelLeft: panel.left, panelTop: panel.top, faceWidth: dialogue.portrait.displayWidth };
    });
    expect(Math.abs(bounds.left - bounds.panelLeft)).toBeLessThanOrEqual(3);
    expect(Math.abs(bounds.bottom - bounds.panelTop)).toBeLessThanOrEqual(3);
    expect(bounds.faceWidth).toBeGreaterThanOrEqual(80);
  }
}

async function fullLossImage(page: Page, key: string, mobile: boolean) {
  const image = await page.evaluate(() => {
    const closeup = (window as any).game.scene.getScene('raid').closeup;
    const image = closeup.image;
    const source = image.texture.getSourceImage();
    const bounds = image.getBounds();
    return {
      visible: closeup.art.visible,
      texture: image.texture.key,
      fullSource: !image.isCropped || (image._crop.width >= source.width && image._crop.height >= source.height),
      left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom,
      width: bounds.width, height: bounds.height,
    };
  });
  expect(image.visible).toBe(true);
  expect(image.texture).toBe(key);
  expect(image.fullSource).toBe(true);
  expect(image.left).toBeGreaterThanOrEqual(-0.5);
  expect(image.top).toBeGreaterThanOrEqual(-0.5);
  expect(image.right).toBeLessThanOrEqual(640.5);
  expect(image.bottom).toBeLessThanOrEqual((mobile ? 360 : 264) + 0.5);
  expect(image.width).toBeGreaterThan(1);
  expect(image.height).toBeGreaterThan(1);
}

async function speakerPortrait(page: Page, sceneKey: string, speaker: string, file: string, mobile: boolean) {
  const portrait = await page.evaluate(sceneKey => {
    const scene = (window as any).game.scene.getScene(sceneKey);
    const dialogue = sceneKey === 'raid' ? scene.closeup.dialogue : scene.dialogue;
    return { speaker: scene.data.get('dialogue:speaker'), texture: dialogue.portrait.texture.key, source: scene.data.get('dialogue:portraitSrc') };
  }, sceneKey);
  expect(portrait.speaker).toBe(speaker);
  expect(portrait.texture).toBe(`portrait-${file}`);
  expect(portrait.source).toContain(`/assets/portraits/${file}.png`);
  if (mobile) {
    const face = page.locator('img[data-mobile-portrait]');
    await expect(face).toBeVisible();
    await expect(face).toHaveAttribute('src', new RegExp(`/assets/portraits/${file}\\.png$`));
    await expect.poll(() => face.evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 1)).toBe(true);
    await expect(page.locator('[data-mobile-speaker]')).toHaveText(speaker);
  }
}

async function canvasClick(page: Page, x: number, y: number) {
  const bounds = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * x / 640, bounds.y + bounds.height * y / 360);
}

for (const viewport of viewports) {
  test(`Raid dialogue follows real input through deaths and vow on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(70_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?scene=raid');
    await sceneReady(page, 'raid');
    expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').raiders.map((actor: any) => [actor.name, actor.texture.key, Number(actor.frame.name), actor.flipX])))
      .toEqual([['raid-spearman', 'raid-spearman', 0, false], ['raid-axeman', 'axe', 0, true], ['raid-hooded', 'warrior', 0, true], ['raid-leader', 'story-actors', 2, false]]);
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('raid');
      return scene.spear == null && !scene.areaRoot.list.some((object: any) => object.type === 'Graphics' && object.depth === 206);
    })).toBe(true);
    const shotKeys = ['cinematic-raid-father-death', 'cinematic-raid-mother-death', 'cinematic-raid-parents-aftermath', 'cinematic-raid-father-stab', 'cinematic-raid-mother-stab'];
    expect(await page.evaluate(keys => keys.map(key => {
      const textures = (window as any).game.textures;
      const source = textures.get(key).getSourceImage();
      return textures.exists(key) && source.width > 1 && source.height > 1;
    }), shotKeys)).toEqual([true, true, true, true, true]);
    // Position fixtures only remove walking time; interaction, animation and every
    // authored observation beat still run through the scene's actual input path.
    await page.evaluate(() => (window as any).game.scene.getScene('raid').lia.setPosition(104, 185));
    await interact(page, viewport.mobile);
    await raidStep(page, 'cover');
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('raid');
      return [scene.hud.root.visible, scene.data.get('mobile:hudVisible'), scene.locked];
    })).toEqual([false, false, true]);
    if (viewport.mobile) {
      await expect(page.locator('.mobile-dpad')).toBeHidden();
      await expect(page.locator('.mobile-identity')).toBeHidden();
      const fontSize = await page.locator('[data-mobile-thought]').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(viewport.height > viewport.width ? 18 : 16);
      await noHorizontalOverflow(page);
      if (viewport.width > viewport.height) {
        expect(await page.evaluate(() => document.body.scrollHeight <= innerHeight)).toBe(true);
        for (const button of await page.locator('.mobile-toolbar button:visible').all()) {
          const box = await button.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.y).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
          expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
    await continueRaid(page, viewport.mobile);
    await raidStep(page, 'kyra-found', false);
    expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('story:raid').ready)).toBe(false);
    // Revealing a line during its arrival action cannot skip that action.
    await page.keyboard.press('KeyE', { delay: 50 });
    await page.keyboard.press('KeyE', { delay: 50 });
    expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('story:raid').step)).toBe('kyra-found');
    await speakerPortrait(page, 'raid', 'Narbiger', 'dialogue-scarred', viewport.mobile);
    await raidStep(page, 'kyra-found');
    expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').raiders[4].flipX)).toBe(false);
    await continueRaid(page, viewport.mobile);
    await raidStep(page, 'question');
    await continueRaid(page, viewport.mobile);
    await raidStep(page, 'father-denial');
    expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('dialogue:typing'))).toBe(true);
    await interact(page, viewport.mobile);
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('raid');
      return [scene.data.get('story:raid').step, scene.data.get('dialogue:typing'), scene.data.get('dialogue:complete')];
    })).toEqual(['father-denial', false, 'Ich kenne sie nicht. Sie ist nur ein neugieriges Kind. Lasst sie laufen.']);
    await portraitAboveCaption(page, viewport.mobile);
    await interact(page, viewport.mobile);
    const beats = ['intimidation', 'father-plea', 'threat', 'hands', 'captivity', 'father-protest', 'father-stab', 'father-death', 'kyra-bound', 'mother-threat', 'mother-stab', 'mother-death', 'kyra-vow', 'captor-order', 'departure'];
    for (const beat of beats) {
      if (beat.endsWith('-stab')) {
        await raidStep(page, beat, false);
        expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('story:raid').ready)).toBe(false);
        // The stabbing action is a separate illustrated card. Revealing and
        // pressing again while its animation runs cannot jump to the death card.
        await page.keyboard.press('KeyE', { delay: 50 });
        await page.keyboard.press('KeyE', { delay: 50 });
        expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('story:raid').step)).toBe(beat);
      }
      await raidStep(page, beat);
      if (beat === 'kyra-bound') {
        expect(await page.evaluate(() => {
          const raiders = (window as any).game.scene.getScene('raid').raiders;
          return [raiders[4].flipX, raiders[1].flipX];
        })).toEqual([true, false]);
      }
      if (beat === 'threat') {
        if (await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('dialogue:typing'))) await interact(page, viewport.mobile);
        await speakerPortrait(page, 'raid', 'Kapuzenmann', 'dialogue-hooded', viewport.mobile);
      }
      if (beat.endsWith('-stab') || beat.endsWith('-death')) {
        expect(await page.evaluate(() => {
          const scene = (window as any).game.scene.getScene('raid');
          return [scene.closeup.art.visible, scene.closeup.image.texture.key, scene.hud.root.visible];
        })).toEqual([true, `cinematic-raid-${beat}`, false]);
        await fullLossImage(page, `cinematic-raid-${beat}`, viewport.mobile);
        if (beat.endsWith('-stab')) {
          await page.screenshot({ path: `../output/qa/raid-${beat}-${viewport.width}x${viewport.height}.png`, fullPage: true });
        }
        if (beat === 'father-death') {
          if (await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('dialogue:typing'))) {
            await interact(page, viewport.mobile);
            await page.waitForFunction(() => !(window as any).game.scene.getScene('raid').data.get('dialogue:typing'));
          }
          await page.screenshot({ path: `../output/qa/raid-dialogue-${viewport.width}x${viewport.height}.png`, fullPage: true });
        }
      }
      await continueRaid(page, viewport.mobile);
    }
    await raidStep(page, 'seek-parents', false);
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('raid');
      return [scene.locked, scene.hud.root.visible, scene.data.get('mobile:hudVisible'), scene.data.get('mobile:closeup'), scene.data.get('mobile:controls')];
    })).toEqual([false, !viewport.mobile, true, '', null]);
    await expect(page.locator('#character-stats-button')).toBeVisible();
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('raid');
      return [scene.data.get('story:lia-crouched'), scene.lia.texture.key, scene.lia.anims.currentAnim.key.startsWith('lia-crouch')];
    })).toEqual([false, 'lia-walk', false]);
    // The reader releases controls when the shot closes.
    const beforeX = await page.evaluate(() => (window as any).game.scene.getScene('raid').lia.x);
    await page.keyboard.down('ArrowRight');
    await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('raid').lia.x)).toBeGreaterThan(beforeX);
    await page.keyboard.up('ArrowRight');
    await page.evaluate(() => (window as any).game.scene.getScene('raid').lia.setPosition(267, 207));
    await interact(page, viewport.mobile);
    await raidStep(page, 'parents-aftermath');
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('raid');
      return [scene.closeup.art.visible, scene.closeup.image.texture.key, scene.hud.root.visible];
    })).toEqual([true, shotKeys[2], false]);
    await fullLossImage(page, shotKeys[2], viewport.mobile);
    if (!viewport.mobile) {
      if (await page.evaluate(() => (window as any).game.scene.getScene('raid').data.get('dialogue:typing'))) {
        await interact(page, false);
        await page.waitForFunction(() => !(window as any).game.scene.getScene('raid').data.get('dialogue:typing'));
      }
      await page.screenshot({ path: '../output/qa/raid-parents-aftermath-desktop.png', fullPage: true });
    }
    await continueRaid(page, viewport.mobile);
    await raidStep(page, 'vow');
    await continueRaid(page, viewport.mobile);
    await sceneReady(page, 'aftermath');
    expect(await page.evaluate(() => {
      const flags = (window as any).game.registry.get('world').flags;
      return [flags.raidWitnessed, flags.parentsLost, flags.kyraTaken];
    })).toEqual([true, true, true]);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test(`Party portraits, separate bag and modal controls work on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?scene=world&map=wiese');
    await sceneReady(page, 'world');
    await page.evaluate(() => {
      (window as any).game.registry.get('world').inv = { proviant: 4, dolch: 1, silber: 7 };
    });
    const portraitButton = page.getByRole('button', { name: 'Gruppe ansehen · C', exact: true });
    await expect(portraitButton).toBeVisible();
    const portraitBox = (await portraitButton.boundingBox())!;
    const canvasBox = (await page.locator('canvas').boundingBox())!;
    expect(portraitBox.x).toBeLessThan(canvasBox.x + canvasBox.width * 0.12);
    expect(portraitBox.y).toBeLessThan(canvasBox.y + canvasBox.height * 0.2);
    await portraitButton.click();
    const dialog = page.locator('#character-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Lia', exact: true })).toBeVisible();
    await expect(dialog.locator('[data-party-member]')).toHaveCount(1);
    await expect(dialog.locator('dl')).toContainText('100 / 100 HP');
    const face = dialog.locator('.character-profile').getByRole('img', { name: 'Porträt von Lia' });
    await expect.poll(() => face.evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 1)).toBe(true);
    const position = await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('world');
      return [scene.lia.x, scene.lia.y];
    });
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => {
      const game = (window as any).game, scene = game.scene.getScene('world');
      return [scene.lia.x, scene.lia.y, scene.input.enabled, scene.input.keyboard.enabled, game.scene.isPaused('world')];
    })).toEqual([...position, false, false, true]);
    await expect(dialog.getByRole('tab')).toHaveCount(3);
    await dialog.getByRole('tab', { name: 'Ausrüstung', exact: true }).click();
    await expect(dialog.getByRole('listitem')).toHaveCount(1);
    await expect(dialog.getByRole('listitem')).toContainText('Familientolch');
    await dialog.getByRole('tab', { name: 'Fähigkeiten', exact: true }).click();
    await expect(dialog).toContainText('Noch keine Kampffähigkeiten');
    await expect(dialog).not.toContainText('Untersuchen');
    await expect(dialog).not.toContainText('Gehen');
    await page.keyboard.press('Home');
    await expect(dialog.getByRole('tab', { name: 'Werte', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await dialog.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
    await noHorizontalOverflow(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    // Membership follows the actual joined flags, and health reads the same
    // persisted party state used by damage/healing rather than invented values.
    await page.evaluate(() => {
      const game = (window as any).game;
      Object.assign(game.registry.get('world').flags, { metFoltanAzar: true, journeyRopesReleased: true });
      game.registry.get('party').members.lia.hp = 73;
    });
    await page.keyboard.press('KeyC', { delay: 50 });
    await expect(dialog.locator('[data-party-member]')).toHaveCount(3);
    await expect(dialog.locator('dl')).toContainText('73 / 100 HP');
    for (const name of ['Foltan', 'Azar']) {
      await dialog.getByRole('button', { name: `${name} ansehen`, exact: true }).click();
      await expect(dialog.getByRole('heading', { name, exact: true })).toBeVisible();
      const member = await page.evaluate(id => (window as any).game.registry.get('party').members[id], name.toLowerCase());
      await expect(dialog.locator('dl')).toContainText(`${member.hp} / ${member.maxHp} HP`);
      for (const [label, field] of [['Angriff', 'attack'], ['Verteidigung', 'defense'], ['Tempo', 'speed']] as const) {
        await expect(dialog.locator('dt').filter({ hasText: label }).locator('xpath=following-sibling::dd[1]')).toHaveText(String(member.combat[field]));
      }
      await expect(dialog).not.toContainText('MP');
    }
    await page.keyboard.press('KeyI', { delay: 50 });
    await expect(dialog).toHaveCount(0);
    const bag = page.locator('#bag-dialog');
    await expect(bag).toBeVisible();
    await expect(bag.getByRole('listitem')).toHaveCount(3);
    await expect(bag.locator('[data-item="proviant"]')).toContainText('× 4');
    await expect(bag.locator('[data-item="silber"]')).toContainText('× 7');
    await expect(bag.getByRole('tab')).toHaveCount(0);
    await expect.poll(() => bag.locator('.bag-artwork').evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 1)).toBe(true);
    const bagGeometry = await bag.evaluate(dialog => {
      const art = dialog.querySelector<HTMLImageElement>('.bag-artwork')!;
      const bounds = art.getBoundingClientRect(), ratio = art.naturalWidth / art.naturalHeight;
      const width = Math.min(bounds.width, bounds.height * ratio), height = Math.min(bounds.height, bounds.width / ratio);
      const items = dialog.querySelector('.bag-items')!.getBoundingClientRect();
      return { left: bounds.left + (bounds.width - width) / 2, right: bounds.left + (bounds.width + width) / 2,
        top: bounds.top + (bounds.height - height) / 2, bottom: bounds.top + (bounds.height + height) / 2,
        items: { left: items.left, right: items.right, top: items.top, bottom: items.bottom } };
    });
    expect(bagGeometry.items.left).toBeGreaterThanOrEqual(bagGeometry.left - 1);
    expect(bagGeometry.items.right).toBeLessThanOrEqual(bagGeometry.right + 1);
    expect(bagGeometry.items.top).toBeGreaterThanOrEqual(bagGeometry.top - 1);
    expect(bagGeometry.items.bottom).toBeLessThanOrEqual(bagGeometry.bottom + 1);
    const closeBox = (await bag.getByRole('button', { name: 'Zurück zum Spiel' }).boundingBox())!;
    expect(closeBox.y).toBeGreaterThanOrEqual(0);
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(viewport.height);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `../output/qa/bag-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(bag).toHaveCount(0);
    if (viewport.mobile) {
      await page.locator('.mobile-bag').click();
      await expect(bag).toBeVisible();
      await bag.getByRole('button', { name: 'Zurück zum Spiel' }).click();
    }
    expect(await page.evaluate(() => {
      const game = (window as any).game, scene = game.scene.getScene('world');
      return [scene.input.enabled, scene.input.keyboard.enabled, game.input.keyboard.enabled, game.scene.isActive('world')];
    })).toEqual([true, true, true, true]);
    await page.keyboard.down('ArrowRight');
    await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('world').lia.x)).toBeGreaterThan(position[0]);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('KeyC', { delay: 50 });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('KeyO', { delay: 50 });
    await expect(dialog).toHaveCount(0);
    await sceneReady(page, 'Settings');
    await page.keyboard.press('KeyO', { delay: 50 });
    await sceneReady(page, 'world');
    await page.keyboard.press('KeyC', { delay: 50 });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('F2');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#playtest-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await sceneReady(page, 'world');
    expect(errors).toEqual([]);
  });

  test(`Normal new game reads four prologue cards before battle on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(40_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await sceneReady(page, 'title');
    expect(await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('title');
      return [scene.data.get('mobile:name'), scene.children.list.some((object: any) => object.texture?.key === 'bg-title-splash')];
    })).toEqual(['Die Chroniken von Selantis', true]);
    await page.screenshot({ path: `../output/qa/title-${viewport.width}x${viewport.height}.png`, fullPage: true });
    if (viewport.mobile) await page.locator('.mobile-action[data-key="ENTER"]').click();
    else await page.keyboard.press('Enter', { delay: 50 });
    await sceneReady(page, 'storyprologue');
    const cards = ['power', 'conflict', 'falken', 'valentus'];
    for (const [index, id] of cards.entries()) {
      await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('storyprologue').data.get('story:prologue'))).toEqual({ index, id, total: 4 });
      const state = await page.evaluate(() => {
        const scene = (window as any).game.scene.getScene('storyprologue');
        const image = scene.closeup.image, source = image.texture.getSourceImage(), bounds = image.getBounds();
        return { speaker: scene.data.get('dialogue:speaker'), portrait: scene.data.get('dialogue:portraitSrc'), hud: scene.data.get('mobile:hudVisible'),
          texture: image.texture.key, loaded: source.width > 1 && source.height > 1,
          full: !image.isCropped || image._crop.width >= source.width && image._crop.height >= source.height,
          bottom: bounds.bottom, top: bounds.top, right: bounds.right, left: bounds.left };
      });
      expect(state.speaker).toBe('');
      expect(state.portrait).toBe('');
      expect(state.hud).toBe(false);
      expect(state.texture).toBe(`prologue-${id}`);
      expect(state.loaded).toBe(true);
      expect(state.full).toBe(true);
      expect(state.bottom).toBeLessThanOrEqual((viewport.mobile ? 360 : 220) + 0.5);
      expect(state.top).toBeGreaterThanOrEqual(-0.5);
      expect(state.left).toBeGreaterThanOrEqual(-0.5);
      expect(state.right).toBeLessThanOrEqual(640.5);
      if (viewport.mobile) {
        await expect(page.locator('.mobile-dialogue-portrait')).toBeHidden();
        await expect(page.locator('.mobile-action[data-key="ESC"]')).toHaveAccessibleName('Überspringen');
        await expect(page.locator('#character-stats-button')).toBeHidden();
      }
      // First genuine key/touch reveals the current card; the second advances.
      if (viewport.mobile) await interact(page, true);
      else await page.keyboard.press(['KeyE', 'Space', 'Enter', 'KeyE'][index], { delay: 50 });
      expect(await page.evaluate(() => (window as any).game.scene.getScene('storyprologue').data.get('story:prologue').index)).toBe(index);
      await expect.poll(() => page.evaluate(() => {
        const scene = (window as any).game.scene.getScene('storyprologue');
        return !scene.data.get('dialogue:typing') && scene.data.get('dialogue:complete') === scene.data.get('dialogue:fullText');
      })).toBe(true);
      await noHorizontalOverflow(page);
      if (viewport.mobile) {
        const caption = (await page.locator('.mobile-caption').boundingBox())!;
        expect(caption.x).toBeGreaterThanOrEqual(0);
        expect(caption.x + caption.width).toBeLessThanOrEqual(viewport.width);
        expect(caption.y + caption.height).toBeLessThanOrEqual(viewport.height);
      }
      if (index === 0) await page.screenshot({ path: `../output/qa/prologue-${viewport.width}x${viewport.height}.png`, fullPage: true });
      if (viewport.mobile) {
        await expect(page.locator('.mobile-action[data-key="E"]')).toHaveAccessibleName(index === 3 ? 'Schlacht beginnen' : 'Weiter');
        await interact(page, true);
      } else if (index === 2) await canvasClick(page, 320, 120);
      else await page.keyboard.press(['Space', 'Enter', 'KeyE', 'KeyE'][index], { delay: 50 });
    }
    await sceneReady(page, 'battle');
    expect(await page.evaluate(() => (window as any).game.scene.isActive('storyprologue'))).toBe(false);
    await page.goto('/');
    await sceneReady(page, 'title');
    if (viewport.mobile) await page.locator('.mobile-action[data-key="ENTER"]').click();
    else await page.keyboard.press('Enter', { delay: 50 });
    await sceneReady(page, 'storyprologue');
    if (viewport.mobile) await page.getByRole('button', { name: 'Überspringen', exact: true }).click();
    else await page.keyboard.press('Escape');
    await sceneReady(page, 'battle');
    expect(errors).toEqual([]);
  });

  test(`Refuge Mann has his own portrait after real dialogue input on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?scene=refuge');
    await sceneReady(page, 'refuge');
    await page.waitForFunction(() => (window as any).game.scene.getScene('refuge').data.get('dialogue:speaker') === 'Frau');
    if (await page.evaluate(() => (window as any).game.scene.getScene('refuge').data.get('dialogue:typing'))) {
      await interact(page, viewport.mobile);
      await page.waitForFunction(() => !(window as any).game.scene.getScene('refuge').data.get('dialogue:typing'));
    }
    await interact(page, viewport.mobile);
    await page.waitForFunction(() => (window as any).game.scene.getScene('refuge').data.get('dialogue:speaker') === 'Mann');
    await interact(page, viewport.mobile);
    await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('refuge').data.get('dialogue:complete'))).toContain('Unglaublich. Als ich ihn gefunden habe');
    await speakerPortrait(page, 'refuge', 'Mann', 'dialogue-refuge-man', viewport.mobile);
    await noHorizontalOverflow(page);
  });
}

test('Discovery stays crouched through keyboard and pointer approach into the brush', async ({ page }) => {
  test.setTimeout(35_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=world&map=hof');
  await sceneReady(page, 'world');
  await page.evaluate(() => (window as any).game.scene.getScene('world').lia.setPosition(266, 193));
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => (window as any).game.scene.getScene('world').ending);
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => (window as any).game.scene.getScene('world').lia.anims.currentAnim.key === 'lia-hidden-e');
  expect(await page.evaluate(() => {
    const lia = (window as any).game.scene.getScene('world').lia;
    return [lia.texture.key, Number(lia.frame.name), lia.flipX];
  })).toEqual(['lia-hide', 7, false]);
  await page.screenshot({ path: '../output/qa/crouch-discovery-desktop.png', fullPage: true });
  await sceneReady(page, 'raid');
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('raid');
    return [scene.data.get('story:lia-crouched'), scene.lia.texture.key, scene.lia.anims.currentAnim.key];
  })).toEqual([true, 'lia-hide', 'lia-crouch-idle-s']);
  // Observe real elapsed scene frames while the keyboard moves Lia. A lower
  // animation name alone would not establish that the reduced speed is applied.
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('raid');
    const sample = { elapsed: 0, distance: 0, previousX: scene.lia.x, frames: [] as number[], animations: [] as string[] };
    (window as any).crouchSample = sample;
    const collect = (_time: number, dt: number) => {
      if (!scene.keys.LEFT.isDown) return;
      sample.elapsed += Math.min(dt, 50);
      sample.distance += Math.abs(scene.lia.x - sample.previousX);
      sample.previousX = scene.lia.x;
      sample.frames.push(Number(scene.lia.frame.name)); sample.animations.push(scene.lia.anims.currentAnim.key);
    };
    scene.events.on('update', collect);
    (window as any).stopCrouchSample = () => scene.events.off('update', collect);
  });
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => (window as any).crouchSample.elapsed >= 650);
  await page.keyboard.up('ArrowLeft');
  const sample = await page.evaluate(() => { (window as any).stopCrouchSample(); return (window as any).crouchSample; });
  expect(sample.distance * 1000 / sample.elapsed).toBeGreaterThan(39);
  expect(sample.distance * 1000 / sample.elapsed).toBeLessThan(49);
  expect(new Set(sample.frames.slice(1))).toEqual(new Set([6, 7]));
  expect(sample.animations.slice(1).every((animation: string) => animation === 'lia-crouch-walk-w')).toBe(true);
  await page.waitForFunction(() => (window as any).game.scene.getScene('raid').lia.anims.currentAnim.key === 'lia-crouch-idle-w');
  await page.screenshot({ path: '../output/qa/crouch-raid-approach-desktop.png', fullPage: true });
  const beforeX = await page.evaluate(() => (window as any).game.scene.getScene('raid').lia.x);
  await canvasClick(page, 164, 222);
  await page.waitForFunction(beforeX => (window as any).game.scene.getScene('raid').lia.x > beforeX + 5, beforeX);
  expect(await page.evaluate(() => (window as any).game.scene.getScene('raid').lia.anims.currentAnim.key)).toBe('lia-crouch-walk-e');
  await page.waitForFunction(() => !(window as any).game.scene.getScene('raid').destination);
  await canvasClick(page, 104, 185);
  await raidStep(page, 'hiding', false);
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('raid');
    return [scene.data.get('story:lia-crouched'), scene.lia.texture.key, scene.lia.anims.currentAnim.key];
  })).toEqual([true, 'lia-hide', 'lia-crouch-walk-w']);
  await raidStep(page, 'cover');
  expect(await page.evaluate(() => {
    const lia = (window as any).game.scene.getScene('raid').lia;
    return [lia.texture.key, Number(lia.frame.name), lia.anims.currentAnim.key, lia.flipX];
  })).toEqual(['lia-hide', 7, 'lia-hidden-e', false]);
});

test('Valentus character values reflect the live battle unit and combat rules', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=battle');
  await sceneReady(page, 'battle');
  await page.evaluate(() => (window as any).game.scene.getScene('battle').sprites.get('valentus').setPosition(160, 221));
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase !== 'arrival');
  await page.keyboard.up('ArrowDown');
  await page.waitForFunction(() => (window as any).game.scene.getScene('battle').phase === 'plan');
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('battle');
    scene.units.find((unit: any) => unit.id === 'valentus').hp = 61;
    scene.units.find((unit: any) => unit.id === 'valentus').magicAttack = 87;
    scene.hud.setHp(0.61, false);
    scene.turn.moved = true;
    scene.addUnit({ id: 'boy', kind: 'boy', side: 'ally', cell: { x: 7, y: 3 }, hp: 20, alive: true });
    scene.units.find((unit: any) => unit.id === 'boy').hp = 11;
    scene.addUnit({ id: 'fallen-ally', kind: 'falke', side: 'ally', cell: { x: 8, y: 3 }, hp: 30, alive: false });
    scene.refreshTacticalStatus();
  });
  await page.keyboard.press('KeyC');
  const dialog = page.locator('#character-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Valentus', exact: true })).toBeVisible();
  await expect(dialog.locator('dl')).toContainText('61 / 100 HP');
  await expect(dialog.locator('dl')).toContainText('4 Felder');
  await expect(dialog.locator('dl')).toContainText('Bereits bewegt');
  await expect(dialog.locator('[data-party-member]')).toHaveCount(2);
  await expect(dialog.locator('[data-party-member="fallen-ally"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Der Junge ansehen', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Der Junge', exact: true })).toBeVisible();
  await expect(dialog.locator('dl')).toContainText('11 / 20 HP');
  await expect(dialog.locator('dl')).toContainText('3 Felder');
  await dialog.getByRole('button', { name: 'Valentus ansehen', exact: true }).click();
  await page.screenshot({ path: '../output/qa/character-battle-desktop.png', fullPage: true });
  await dialog.getByRole('tab', { name: 'Fähigkeiten', exact: true }).click();
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Strahl' })).toContainText('87 Schaden');
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Druckwelle' })).toContainText('80 Schaden');
  await expect(dialog.getByRole('listitem')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Zurück zum Spiel' }).click();
  await sceneReady(page, 'battle');
  expect(await page.evaluate(() => (window as any).game.scene.getScene('battle').input.keyboard.enabled)).toBe(true);
  expect(await page.evaluate(() => (window as any).game.scene.getScene('battle').tacticalPanel.visible)).toBe(true);
  await page.screenshot({ path: '../output/qa/battle-status-desktop.png', fullPage: true });
});

test('House pickups disappear independently without interrupting packing and stay collected on reentry', async ({ page }) => {
  test.setTimeout(40_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?scene=aftermath');
  await sceneReady(page, 'aftermath');
  const use = async (at: number[]) => {
    await page.evaluate(at => (window as any).game.scene.getScene('aftermath').lia.setPosition(at[0], at[1]), at);
    await page.keyboard.press('KeyE', { delay: 50 });
  };
  await use([273, 198]);
  await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').inside);
  expect(await page.evaluate(() => (window as any).game.scene.getScene('aftermath').houseItems.size)).toBe(6);
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('aftermath');
    (window as any).houseProps = Object.fromEntries(scene.houseItems);
  });
  // Clothing remains present until Lia has treated her heel.
  await use([142, 216]);
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('aftermath');
    return [!!scene.st.flags.packedClothes, scene.houseItems.has('packedClothes'), scene.st.inv.reisezeug ?? 0];
  })).toEqual([false, true, 0]);
  const pickups = [
    { id: 'food', flag: 'packedFood', at: [431, 188] },
    { id: 'water', flag: 'packedWater', at: [518, 176] },
    { id: 'cupboard', flag: 'foundCache', at: [505, 201] },
    { id: 'medicine', flag: 'heelTreated', at: [145, 145] },
    { id: 'clothing', flag: 'packedClothes', at: [142, 216] },
    { id: 'books', flag: 'packedBooks', at: [289, 210] },
  ];
  for (const [index, pickup] of pickups.entries()) {
    await use(pickup.at);
    await expect.poll(() => page.evaluate(flag => (window as any).game.registry.get('world').flags[flag], pickup.flag)).toBe(true);
    expect(await page.evaluate(({ flag, id }) => {
      const scene = (window as any).game.scene.getScene('aftermath');
      const refs = (window as any).houseProps[flag];
      return [scene.houseItems.size, scene.houseItems.has(flag), refs.length > 0 && refs.every((image: any) => !image.active), scene.spots.some((spot: any) => spot.id === id), !!scene.closeup?.visible, !!scene.closeup?.hasCaption, scene.locked];
    }, pickup)).toEqual([5 - index, false, true, false, false, false, false]);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  }
  const inventory = { proviant: 1, wasserschlauch: 1, kupfer: 22, silber: 7, dolch: 1, heilzeug: 1, reisezeug: 1, 'buch-kraeuter': 1, 'buch-alana': 1 };
  expect(await page.evaluate(() => (window as any).game.registry.get('world').inv)).toEqual(inventory);
  await use([431, 188]);
  expect(await page.evaluate(() => (window as any).game.registry.get('world').inv)).toEqual(inventory);
  await page.screenshot({ path: '../output/qa/house-picked-clean-desktop.png', fullPage: true });
  await use([310, 306]);
  await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').inside);
  await use([273, 198]);
  await page.waitForFunction(() => (window as any).game.scene.getScene('aftermath').inside);
  expect(await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('aftermath');
    return [scene.houseItems.size, scene.spots.map((spot: any) => spot.id), scene.st.inv];
  })).toEqual([0, ['exit-door'], inventory]);
  await use([310, 306]);
  await page.waitForFunction(() => !(window as any).game.scene.getScene('aftermath').inside);
  await use([154, 108]);
  await expect.poll(() => page.evaluate(() => (window as any).game.registry.get('world').flags.departureReady)).toBe(true);
  const beforeDeparture = await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('aftermath');
    return [scene.lia.x, scene.lia.y];
  });
  // Click the actual painted upper-right exit, allowing the scene path finder
  // and target interaction to carry Lia there from the pig gate.
  await canvasClick(page, 596, 40);
  await expect.poll(() => page.evaluate(() => (window as any).game.scene.getScene('aftermath').lia.x)).toBeGreaterThan(beforeDeparture[0] + 10);
  await sceneReady(page, 'journey');
  expect(await page.evaluate(() => {
    const game = (window as any).game, scene = game.scene.getScene('journey');
    return [game.registry.get('world').flags.aftermathComplete, scene.lia.x, scene.lia.y];
  })).toEqual([true, 45, 193]);
});

test('Anonymous bridge travelers animate while moving and honor reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scene=journey');
  await sceneReady(page, 'journey');
  await page.evaluate(() => {
    const scene = (window as any).game.scene.getScene('journey');
    const actors = scene.areaRoot.list.filter((actor: any) => actor.type === 'Sprite' && actor.texture.key === 'road-travelers-walk');
    (window as any).bridgeActors = actors;
    const sample = { elapsed: 0, start: actors.map((actor: any) => actor.x), frames: actors.map(() => [] as number[]) };
    (window as any).bridgeSample = sample;
    const collect = (_time: number, dt: number) => {
      sample.elapsed += dt;
      actors.forEach((actor: any, index: number) => sample.frames[index].push(Number(actor.frame.name)));
    };
    scene.events.on('update', collect);
    (window as any).stopBridgeSample = () => scene.events.off('update', collect);
  });
  await page.waitForFunction(() => (window as any).bridgeSample.elapsed >= 650);
  const moving = await page.evaluate(() => {
    (window as any).stopBridgeSample();
    return { sample: (window as any).bridgeSample, actors: (window as any).bridgeActors.map((actor: any) => ({ x: actor.x, animation: actor.anims.currentAnim.key, playing: actor.anims.isPlaying, flipX: actor.flipX })) };
  });
  expect(moving.actors).toHaveLength(2);
  expect(new Set(moving.sample.frames[0])).toEqual(new Set([0, 1]));
  expect(new Set(moving.sample.frames[1])).toEqual(new Set([2, 3]));
  expect(moving.actors.map((actor: any) => [actor.animation, actor.playing, actor.flipX])).toEqual([['road-wagon-walk', true, true], ['road-troupe-walk', true, true]]);
  moving.actors.forEach((actor: any, index: number) => expect(actor.x).toBeLessThan(moving.sample.start[index]));
  await page.screenshot({ path: '../output/qa/bridge-walking-phone.png', fullPage: true });
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByLabel('Ruhige Bewegung', { exact: true }).check();
  await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
  await sceneReady(page, 'journey');
  const stopped = await page.evaluate(() => ({ frame: (window as any).game.loop.frame, actors: (window as any).bridgeActors.map((actor: any) => ({ x: actor.x, texture: actor.texture.key, frame: Number(actor.frame.name), playing: actor.anims.isPlaying })) }));
  expect(stopped.actors.map((actor: any) => [actor.texture, actor.frame, actor.playing])).toEqual([['road-travelers', 0, false], ['road-travelers', 1, false]]);
  await page.waitForFunction(frame => (window as any).game.loop.frame > frame + 20, stopped.frame);
  expect(await page.evaluate(() => (window as any).bridgeActors.map((actor: any) => actor.x))).toEqual(stopped.actors.map((actor: any) => actor.x));
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  await page.getByLabel('Ruhige Bewegung', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Zurück zum Spiel', exact: true }).click();
  await sceneReady(page, 'journey');
  await page.waitForFunction(xs => (window as any).bridgeActors.every((actor: any, index: number) => actor.x < xs[index]), stopped.actors.map((actor: any) => actor.x));
  expect(await page.evaluate(() => (window as any).bridgeActors.map((actor: any) => [actor.texture.key, actor.anims.isPlaying]))).toEqual([['road-travelers-walk', true], ['road-travelers-walk', true]]);
});
