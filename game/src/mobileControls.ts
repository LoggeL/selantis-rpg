import type Phaser from 'phaser';
import { unlockAudio } from './audio';
import { settingsAreOpen, toggleSettings } from './settings';
import { TouchKeyHolds, touchHint, resolveMobileControls, type MobileActionKey, type MobileDirection, type MobileControlProfile } from './mobileInput';
import { mobileBattleSummary } from './mobileBattleStatus';

export const TOUCH_MEDIA_QUERY = '(any-pointer: coarse), (max-width: 900px)';
type ActionKey = MobileActionKey;
type Direction = MobileDirection;
type Profile = MobileControlProfile;
const allDirections: Direction[] = ['up', 'left', 'down', 'right'];
const explore: Profile = { directions: allDirections, actions: { E: 'Aktion' } };
const profiles: Record<string, Profile> = {
  title: { directions: [], actions: { ENTER: 'Start' } },
  battle: { directions: allDirections, actions: { Q: 'Strahl', R: 'Welle', SPACE: 'Warten', ENTER: 'Bestätigen', ESC: 'Zurück' } },
  break: { directions: [], actions: { E: 'Weiter halten' } },
  flight: { directions: allDirections, actions: { E: 'Aktion halten', Q: 'Strahl', R: 'Welle', ESC: 'Weiter halten' } },
  refuge: { directions: [], actions: { E: 'Weiter halten' } },
  lia: explore, world: explore, raid: explore, aftermath: explore, journey: explore,
};
const codes = { UP: 38, LEFT: 37, DOWN: 40, RIGHT: 39, E: 69, Q: 81, R: 82, SPACE: 32, ENTER: 13, ESC: 27 };
const directionKeys: Record<Direction, keyof typeof codes> = { up: 'UP', left: 'LEFT', down: 'DOWN', right: 'RIGHT' };
const keyNames: Partial<Record<keyof typeof codes, string>> = { UP: 'ArrowUp', LEFT: 'ArrowLeft', DOWN: 'ArrowDown', RIGHT: 'ArrowRight', SPACE: ' ', ENTER: 'Enter', ESC: 'Escape' };

function button(label: string, className: string, aria = label) {
  const result = document.createElement('button');
  result.type = 'button'; result.className = className; result.textContent = label;
  result.setAttribute('aria-label', aria);
  result.style.touchAction = 'none';
  return result;
}

/** Routes touch holds to real scene Key objects without dispatching DOM keyboard events. */
export function installMobileControls(game: Phaser.Game): () => void {
  const root = document.createElement('section');
  root.id = 'mobile-controls'; root.setAttribute('aria-label', 'Spielsteuerung');
  root.innerHTML = `<div class="mobile-toolbar"></div>
    <div class="mobile-caption">
      <div class="mobile-dialogue-portrait" hidden><div class="mobile-dialogue-face"><img data-mobile-portrait alt="" hidden></div><span class="mobile-dialogue-name" data-mobile-speaker></span></div>
      <div class="mobile-caption-text"><span class="mobile-identity"></span><p data-mobile-objective></p><p data-mobile-battle-status aria-label="Lebenspunkte, Zugaktionen, Blickrichtung und nächste Gegner"></p><p data-mobile-thought></p><p class="mobile-dialogue-measure" data-mobile-dialogue-measure aria-hidden="true"></p><span class="mobile-reader-announcement" data-mobile-announcement aria-live="polite" aria-atomic="true"></span><p data-mobile-hint></p></div>
    </div>
    <div class="mobile-input-row"><div class="mobile-dpad" role="group" aria-label="Bewegen"></div><div class="mobile-actions" role="group" aria-label="Aktionen"></div></div>`;
  const toolbar = root.querySelector<HTMLElement>('.mobile-toolbar')!;
  const dpad = root.querySelector<HTMLElement>('.mobile-dpad')!;
  const actions = root.querySelector<HTMLElement>('.mobile-actions')!;
  const bag = button('Tasche', 'mobile-control mobile-bag'); bag.dataset.mobileBag = '';
  const settings = button('Optionen', 'mobile-control mobile-settings', 'Einstellungen'); settings.dataset.mobileSettings = '';
  toolbar.append(bag, settings);
  const directionButtons = new Map<Direction, HTMLButtonElement>();
  const actionButtons = new Map<ActionKey, HTMLButtonElement>();
  const arrows: Record<Direction, string> = { up: '↑', left: '←', down: '↓', right: '→' };
  const directionNames: Record<Direction, string> = { up: 'Nach oben', left: 'Nach links', down: 'Nach unten', right: 'Nach rechts' };
  for (const direction of allDirections) {
    const control = button(arrows[direction], 'mobile-control mobile-direction', directionNames[direction]);
    control.dataset.direction = direction; directionButtons.set(direction, control); dpad.append(control);
  }
  for (const key of ['E', 'Q', 'R', 'SPACE', 'ENTER', 'ESC'] as const) {
    const control = button(key, 'mobile-control mobile-action');
    control.dataset.key = key; actionButtons.set(key, control); actions.append(control);
  }
  const bookmarks = document.createElement('div'); bookmarks.className = 'mobile-bookmarks';
  bookmarks.setAttribute('role', 'group'); bookmarks.setAttribute('aria-label', 'Lesezeichen'); actions.append(bookmarks);
  (document.getElementById('game-shell') ?? document.body).append(root);

  const media = matchMedia(TOUCH_MEDIA_QUERY);
  const holds = new TouchKeyHolds();
  const pointers = new Map<number, { key: Phaser.Input.Keyboard.Key; button: HTMLButtonElement }>();
  let scene: Phaser.Scene | undefined;
  let enabled = false, blocked = false, disposed = false, dataDirty = true;
  let bookmarkSignature = '';
  const eventFor = (name: keyof typeof codes = 'E'): KeyboardEvent => ({
    key: keyNames[name] ?? name.toLowerCase(), code: name.length === 1 ? `Key${name}` : keyNames[name] ?? name,
    keyCode: codes[name], which: codes[name], timeStamp: game.loop.time,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, location: 0, repeat: false,
    preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
  } as KeyboardEvent);

  function release(pointerId: number) {
    const press = pointers.get(pointerId); if (!press) return;
    pointers.delete(pointerId); holds.release(press.key, eventFor());
    if (![...pointers.values()].some(other => other.button === press.button)) press.button.classList.remove('is-pressed');
    if (press.button.hasPointerCapture(pointerId)) press.button.releasePointerCapture(pointerId);
  }
  function cancel() {
    const presses = [...pointers.entries()]; pointers.clear(); holds.cancel(eventFor());
    for (const [id, press] of presses) {
      press.button.classList.remove('is-pressed');
      if (press.button.hasPointerCapture(id)) press.button.releasePointerCapture(id);
    }
  }
  function changed(_data: unknown, key: string) {
    dataDirty = true;
    if (key === 'mobile:controls') cancel();
  }
  function sceneStopped() { cancel(); dataDirty = true; }
  function detachScene() {
    if (!scene) return;
    scene.data.events.off('changedata', changed); scene.data.events.off('setdata', changed); scene.data.events.off('removedata', changed);
    for (const event of ['shutdown', 'pause', 'sleep']) scene.events.off(event, sceneStopped);
  }
  function stopEvent(event: Event) { event.stopPropagation(); }
  function press(control: HTMLButtonElement, name: keyof typeof codes, pointerId?: number) {
    sync();
    if (!enabled || blocked || !scene || control.disabled || control.hidden || !scene.input.enabled || !scene.input.keyboard?.enabled) return;
    unlockAudio();
    // Title listens to the plugin's generic event instead of a Key object.
    if (scene.sys.settings.key === 'title') { scene.input.keyboard.emit('keydown', eventFor('ENTER')); return; }
    const key = scene.input.keyboard.keys[codes[name]];
    if (!key?.enabled) return;
    if (pointerId === undefined) { holds.press(key, eventFor(name)); holds.release(key, eventFor(name)); return; }
    if (pointers.has(pointerId)) release(pointerId);
    // Record first so a synchronous scene transition can cancel the new hold.
    pointers.set(pointerId, { key, button: control }); control.classList.add('is-pressed');
    control.setPointerCapture(pointerId); holds.press(key, eventFor(name));
  }
  function wire(control: HTMLButtonElement, name: keyof typeof codes) {
    control.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      press(control, name, event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      control.addEventListener(type, event => {
        event.preventDefault(); event.stopPropagation();
        if (pointers.get(event.pointerId)?.button === control) release(event.pointerId);
      });
    }
    control.addEventListener('pointermove', event => {
      event.preventDefault(); event.stopPropagation();
      if (!control.dataset.direction || pointers.get(event.pointerId)?.button !== control) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('.mobile-direction');
      if (!target || target === control || !dpad.contains(target) || target.hidden) return;
      const direction = target.dataset.direction as Direction;
      release(event.pointerId);
      press(target, directionKeys[direction], event.pointerId);
    });
    control.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (event.detail === 0) press(control, name);
    });
  }
  for (const [direction, control] of directionButtons) wire(control, directionKeys[direction]);
  for (const [key, control] of actionButtons) wire(control, key);
  root.querySelector<HTMLElement>('.mobile-caption')!.addEventListener('click', event => {
    if (!scene?.data.get('dialogue:active')) return;
    event.preventDefault(); event.stopPropagation();
    press(actionButtons.get('E')!, 'E');
  });
  bag.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation(); sync();
    if (!enabled || blocked || !scene || bag.hidden) return;
    cancel(); unlockAudio(); scene.events.emit('mobile-inventory-toggle'); sync();
  });
  settings.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation(); if (!enabled) return;
    cancel(); unlockAudio(); toggleSettings(game); sync();
  });
  for (const type of ['pointerdown', 'pointerup', 'pointermove', 'click', 'contextmenu']) root.addEventListener(type, stopEvent);
  root.addEventListener('contextmenu', event => event.preventDefault());

  function setCaption(selector: string, value: unknown) {
    const element = root.querySelector<HTMLElement>(selector)!;
    const text = typeof value === 'string' ? value : '';
    if (element.textContent !== text) element.textContent = text;
    element.hidden = !text;
  }
  function sync() {
    if (disposed) return;
    const touch = document.documentElement.dataset.touchEnabled;
    const nextEnabled = touch === undefined ? media.matches : touch === 'true';
    const nextScene = game.scene.getScenes(true).find(candidate => candidate.sys.settings.key !== 'Settings');
    const nextBlocked = settingsAreOpen() || !!nextScene?.data.get('mobile:inventory')?.open || !!document.querySelector('dialog[open]');
    if (scene !== nextScene) {
      cancel(); detachScene(); scene = nextScene; dataDirty = true; bookmarkSignature = '';
      if (scene) {
        scene.data.events.on('changedata', changed); scene.data.events.on('setdata', changed); scene.data.events.on('removedata', changed);
        for (const event of ['shutdown', 'pause', 'sleep']) scene.events.on(event, sceneStopped);
      }
    }
    if ((!nextEnabled && enabled) || (nextBlocked && !blocked)) cancel();
    if (enabled !== nextEnabled || blocked !== nextBlocked) dataDirty = true;
    enabled = nextEnabled; blocked = nextBlocked; root.hidden = !enabled;
    if (!dataDirty) return;
    dataDirty = false;
    const key = scene?.sys.settings.key ?? 'boot'; root.dataset.scene = key;
    const profile = resolveMobileControls(profiles[key] ?? { directions: [], actions: {} }, scene?.data.get('mobile:controls'));
    root.dataset.controlMode = !profile.directions.length && Object.keys(profile.actions).length === 1 ? 'cinematic' : 'gameplay';
    dpad.hidden = blocked || !profile.directions.length;
    for (const [direction, control] of directionButtons) { control.hidden = !profile.directions.includes(direction); control.disabled = blocked || !!profile.disabled; }
    const abilityDisabled = !!scene?.data.get('mobile:disabled');
    const selected = scene?.data.get('mobile:selected');
    const abilities = (scene?.data.get('mobile:abilities') ?? []) as { key: string; icon: string }[];
    for (const [action, control] of actionButtons) {
      const label = profile.actions[action]; control.hidden = blocked || !label;
      control.disabled = blocked || !!profile.disabled || (key === 'battle' && abilityDisabled && (action === 'Q' || action === 'R'));
      control.textContent = label ?? action; control.setAttribute('aria-label', label ?? action);
      control.setAttribute('aria-pressed', String(abilities.some(ability => ability.key === action && ability.icon === selected)));
    }
    const inventory = scene?.data.get('mobile:inventory'); bag.hidden = !inventory || inventory.available === false || profile.inventory === false; bag.disabled = blocked;
    bag.setAttribute('aria-expanded', String(!!inventory?.open)); settings.disabled = settingsAreOpen();
    const dialogueActive = !!scene?.data.get('dialogue:active');
    const hudVisible = scene?.data.get('mobile:hudVisible') !== false && !dialogueActive;
    const battleStatus = hudVisible && key === 'battle' ? mobileBattleSummary(scene?.data.get('mobile:battleStatus')) : '';
    root.dataset.dialogue = String(dialogueActive);
    const name = scene?.data.get('mobile:name'), hp = scene?.data.get('mobile:hp');
    setCaption('.mobile-identity', battleStatus ? '' : hudVisible && typeof name === 'string' ? `${name}${typeof hp === 'number' ? ` · ${Math.round(hp * 100)} %` : ''}` : hudVisible ? 'SELANTIS' : '');
    setCaption('[data-mobile-objective]', hudVisible ? scene?.data.get('mobile:objective') : '');
    setCaption('[data-mobile-battle-status]', battleStatus);
    setCaption('[data-mobile-thought]', dialogueActive ? scene?.data.get('mobile:dialogue') : scene?.data.get('mobile:thought'));
    setCaption('[data-mobile-dialogue-measure]', dialogueActive ? scene?.data.get('dialogue:fullText') : '');
    setCaption('[data-mobile-hint]', hudVisible ? touchHint(scene?.data.get('mobile:hint') ?? '', profile.actions) : '');
    const thought = root.querySelector<HTMLElement>('[data-mobile-thought]')!;
    thought.setAttribute('aria-hidden', String(dialogueActive));
    const announcement = root.querySelector<HTMLElement>('[data-mobile-announcement]')!;
    const completed = dialogueActive ? scene?.data.get('dialogue:complete') ?? '' : scene?.data.get('mobile:thought') ?? '';
    if (announcement.textContent !== completed) announcement.textContent = completed;
    const speaker = scene?.data.get('dialogue:speaker');
    const caption = root.querySelector<HTMLElement>('.mobile-caption')!;
    caption.setAttribute('aria-label', dialogueActive && speaker ? `Dialog: ${speaker}` : 'Spielhinweise');
    const portrait = root.querySelector<HTMLElement>('.mobile-dialogue-portrait')!;
    const face = root.querySelector<HTMLElement>('.mobile-dialogue-face')!;
    const image = root.querySelector<HTMLImageElement>('[data-mobile-portrait]')!;
    const portraitSource = scene?.data.get('dialogue:portraitSrc');
    portrait.hidden = !dialogueActive || !speaker;
    image.hidden = !portraitSource;
    face.dataset.fallback = String(!portraitSource);
    if (portraitSource && image.getAttribute('src') !== portraitSource) image.setAttribute('src', portraitSource);
    image.alt = speaker ? `Porträt: ${speaker}` : '';
    setCaption('[data-mobile-speaker]', speaker);
    const choices = (scene?.data.get('mobile:bookmarks') ?? []) as { id: string; label: string; selected: boolean }[];
    const signature = JSON.stringify(choices); bookmarks.hidden = blocked || profile.inventory === false || !choices.length;
    if (signature !== bookmarkSignature) {
      bookmarkSignature = signature;
      bookmarks.replaceChildren(...choices.map(choice => {
        const control = button(choice.label, 'mobile-control mobile-bookmark'); control.dataset.bookmark = choice.id;
        control.setAttribute('aria-pressed', String(choice.selected));
        control.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation(); sync(); if (!enabled || blocked) return;
          cancel(); scene?.events.emit('mobile-bookmark', choice.id);
        });
        return control;
      }));
    }
    // Captions and action rows can move the centered canvas without changing
    // its dimensions. Refresh its input origin after the DOM has reflowed.
    if (game.canvas) game.scale.updateBounds();
  }
  const modeChanged = () => { cancel(); dataDirty = true; sync(); };
  const visibilityChanged = () => { if (document.hidden) cancel(); };
  window.addEventListener('blur', cancel); window.addEventListener('pagehide', cancel);
  window.addEventListener('resize', cancel);
  document.addEventListener('visibilitychange', visibilityChanged); media.addEventListener('change', modeChanged);
  game.events.on('prestep', sync); game.events.on('blur', cancel);
  const observer = new MutationObserver(modeChanged);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-touch-enabled'] });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
  const dispose = () => {
    if (disposed) return;
    disposed = true; cancel(); detachScene(); observer.disconnect();
    window.removeEventListener('blur', cancel); window.removeEventListener('pagehide', cancel);
    window.removeEventListener('resize', cancel);
    document.removeEventListener('visibilitychange', visibilityChanged); media.removeEventListener('change', modeChanged);
    game.events.off('prestep', sync); game.events.off('blur', cancel); game.events.off('destroy', dispose); root.remove();
  };
  game.events.once('destroy', dispose);
  return dispose;
}
