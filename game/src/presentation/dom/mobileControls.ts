import { assetUrl } from "../../platform/assets/url";
import type Phaser from 'phaser';
import { unlockAudio } from "../../app/audio";
import { settingsAreOpen, toggleSettings } from "../../app/settings";
import { touchHint, resolveMobileControls, type MobileActionKey, type MobileDirection, type MobileControlProfile } from "./controlLabels";
import { mobileBattleSummary } from "./battleStatus";
import { actionBarSlots } from "./actionBar";
import { openBag, openCharacterStats } from "./characterSheetControls";
import { sceneInput, type SceneInputScope, type InputAction } from "../../platform/input/router";
import { KEY_ACTIONS } from "../../platform/input/types";
import { scenePresentation, type PresentationSnapshot } from "../model";
import './actionBar.css';

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
  lia: explore, world: explore, raid: explore, aftermath: explore, journey: explore, 'companions-road': explore,
};
const directionActions: Record<Direction, InputAction> = { up: 'move-up', left: 'move-left', down: 'move-down', right: 'move-right' };

function button(label: string, className: string, aria = label) {
  const result = document.createElement('button');
  result.type = 'button'; result.className = className; result.textContent = label;
  result.setAttribute('aria-label', aria);
  result.style.touchAction = 'none';
  return result;
}

/** The DOM renderer sends semantic actions to the same scope as the desktop adapter. */
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
  const inputRow = root.querySelector<HTMLElement>('.mobile-input-row')!;
  const actionBar = document.createElement('nav');
  actionBar.className = 'game-action-bar'; actionBar.setAttribute('aria-label', 'Fähigkeiten und Inventar'); actionBar.hidden = true;
  root.append(actionBar);
  const bag = button('Tasche', 'mobile-control mobile-bag'); bag.dataset.mobileBag = '';
  const party = button('Gruppe', 'mobile-control mobile-party', 'Gruppe ansehen · C');
  party.setAttribute('aria-haspopup', 'dialog'); party.dataset.mobileParty = '';
  const settings = button('Optionen', 'mobile-control mobile-settings', 'Einstellungen'); settings.dataset.mobileSettings = '';
  toolbar.append(bag, party, settings);
  const shortcuts = new Map<HTMLButtonElement, string>([[bag, 'I'], [party, 'C'], [settings, 'O']]);
  const directionButtons = new Map<Direction, HTMLButtonElement>();
  const actionButtons = new Map<ActionKey, HTMLButtonElement>();
  const arrows: Record<Direction, string> = { up: '↑', left: '←', down: '↓', right: '→' };
  const directionNames: Record<Direction, string> = { up: 'Nach oben', left: 'Nach links', down: 'Nach unten', right: 'Nach rechts' };
  for (const direction of allDirections) {
    const control = button(arrows[direction], 'mobile-control mobile-direction', directionNames[direction]);
    control.dataset.direction = direction; control.dataset.intent = directionActions[direction]; directionButtons.set(direction, control); dpad.append(control);
  }
  for (const key of ['E', 'Q', 'R', 'SPACE', 'ENTER', 'ESC'] as const) {
    const control = button(key, 'mobile-control mobile-action');
    control.dataset.key = key; actionButtons.set(key, control); actions.append(control);
    shortcuts.set(control, key === 'SPACE' ? '␣' : key === 'ENTER' ? '↵' : key === 'ESC' ? 'Esc' : key);
  }
  const bookmarks = document.createElement('div'); bookmarks.className = 'mobile-bookmarks';
  bookmarks.setAttribute('role', 'group'); bookmarks.setAttribute('aria-label', 'Lesezeichen'); actions.append(bookmarks);
  (document.getElementById('game-shell') ?? document.body).append(root);

  const media = matchMedia(TOUCH_MEDIA_QUERY);
  const pointers = new Map<number, { action: InputAction; scope: SceneInputScope; button: HTMLButtonElement }>();
  let snapshot: Readonly<PresentationSnapshot> | undefined;
  let unsubscribePresentation: (() => void) | undefined;
  let unsubscribeActions: (() => void) | undefined;
  let releaseModalLock: (() => void) | undefined;
  let scene: Phaser.Scene | undefined;
  let enabled = false, blocked = false, disposed = false, dataDirty = true;
  let bookmarkSignature = '';
  let showingActionBar = false;
  let abilitiesRevealed = false;
  let returnFocus: HTMLButtonElement | undefined;
  document.documentElement.dataset.actionBarInstalled = 'true';

  function release(pointerId: number) {
    const press = pointers.get(pointerId); if (!press) return;
    pointers.delete(pointerId); press.scope.dispatch({ action: press.action, phase: 'end', source: 'touch', owner: `touch:${pointerId}` });
    if (![...pointers.values()].some(other => other.button === press.button)) press.button.classList.remove('is-pressed');
    if (press.button.hasPointerCapture(pointerId)) press.button.releasePointerCapture(pointerId);
  }
  function cancel() {
    const presses = [...pointers.entries()];
    for (const [id] of presses) release(id);
    for (const [id, press] of presses) {
      press.button.classList.remove('is-pressed');
      if (press.button.hasPointerCapture(id)) press.button.releasePointerCapture(id);
    }
  }
  function sceneStopped() { cancel(); dataDirty = true; }
  function sceneResumed() { dataDirty = true; sync(); }
  function sceneShutdown() {
    cancel(); detachScene(); scene = undefined; snapshot = undefined;
    dataDirty = true; bookmarkSignature = ''; abilitiesRevealed = false;
  }
  function detachScene() {
    unsubscribePresentation?.(); unsubscribePresentation = undefined;
    unsubscribeActions?.(); unsubscribeActions = undefined;
    releaseModalLock?.(); releaseModalLock = undefined;
    if (!scene) return;
    scene.events.off('shutdown', sceneShutdown);
    for (const event of ['pause', 'sleep']) scene.events.off(event, sceneStopped);
    for (const event of ['resume', 'wake']) scene.events.off(event, sceneResumed);
  }
  function stopEvent(event: Event) { event.stopPropagation(); }
  function press(control: HTMLButtonElement, action: InputAction, pointerId?: number) {
    sync();
    if (!enabled || blocked || !scene || control.disabled || control.hidden || !scene.input.enabled || !scene.sys.isActive()) return;
    unlockAudio();
    const scope = sceneInput(scene);
    const key = (Object.keys(KEY_ACTIONS) as ActionKey[]).find(key => KEY_ACTIONS[key] === action);
    if (key) action = scope.actionForKey(key);
    if (pointerId === undefined) { scope.dispatch({ action, phase: 'activate', source: 'touch' }); return; }
    if (pointers.has(pointerId)) release(pointerId);
    pointers.set(pointerId, { action, scope, button: control }); control.classList.add('is-pressed');
    control.setPointerCapture(pointerId);
    scope.dispatch({ action, phase: 'begin', source: 'touch', owner: `touch:${pointerId}` });
  }
  function wire(control: HTMLButtonElement, action: InputAction) {
    control.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      press(control, action, event.pointerId);
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
      press(target, directionActions[direction], event.pointerId);
    });
    control.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (event.detail === 0) press(control, action);
    });
  }
  for (const [direction, control] of directionButtons) wire(control, directionActions[direction]);
  for (const [key, control] of actionButtons) wire(control, KEY_ACTIONS[key]);
  root.querySelector<HTMLElement>('.mobile-caption')!.addEventListener('click', event => {
    if (!snapshot?.dialogueActive) return;
    event.preventDefault(); event.stopPropagation();
    press(actionButtons.get('E')!, 'continue');
  });
  bag.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation(); sync();
    if (!enabled || blocked || !scene || bag.hidden) return;
    cancel(); unlockAudio(); returnFocus = bag; sceneInput(scene).dispatch({ action: 'inventory', phase: 'activate', source: 'touch' }); sync();
  });
  settings.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation(); if (!enabled) return;
    cancel(); unlockAudio(); if (scene) sceneInput(scene).dispatch({ action: 'settings', phase: 'activate', source: 'touch' }); sync();
  });
  party.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation(); sync();
    if (!enabled || blocked || !scene || party.hidden) return;
    cancel(); unlockAudio(); returnFocus = party; sceneInput(scene).dispatch({ action: 'party', phase: 'activate', source: 'touch' }); sync();
  });
  for (const type of ['pointerdown', 'pointerup', 'pointermove', 'click', 'contextmenu']) root.addEventListener(type, stopEvent);
  for (const type of ['keydown', 'keyup']) root.addEventListener(type, event => {
    const key = event as KeyboardEvent;
    if (key.target instanceof HTMLButtonElement && (key.code === 'Enter' || key.code === 'Space')) key.stopPropagation();
  });
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
    const touchEnabled = touch === undefined ? media.matches : touch === 'true';
    const nextScene = game.scene.getScenes(false).find(candidate => candidate.sys.settings.key !== 'Settings' &&
      (candidate.sys.isActive() || candidate.sys.isPaused()));
    const nextProfile = resolveMobileControls(profiles[nextScene?.sys.settings.key ?? ''] ?? { directions: [], actions: {} }, nextScene ? scenePresentation(nextScene).snapshot.controls ?? undefined : undefined);
    const nextActionBar = !!nextScene && !!scenePresentation(nextScene).snapshot.name && scenePresentation(nextScene).snapshot.hudVisible !== false &&
      !scenePresentation(nextScene).snapshot.dialogueActive;
    const cinematicControls = !touchEnabled && !nextActionBar && !!Object.keys(nextProfile.actions).length;
    const nextEnabled = touchEnabled || nextActionBar || cinematicControls;
    const nextBlocked = settingsAreOpen() || !!nextScene && scenePresentation(nextScene).snapshot.inventory?.open || !!document.querySelector('dialog[open]');
    const justUnblocked = blocked && !nextBlocked;
    if (scene !== nextScene) {
      cancel(); detachScene(); scene = nextScene; snapshot = undefined; dataDirty = true; bookmarkSignature = ''; abilitiesRevealed = false;
      if (scene) {
        const attached = scene;
        const scope = sceneInput(attached);
        unsubscribeActions = scope.bind({
          inventory: intent => { if (intent.phase !== 'end' && !openBag(game)) attached.events.emit('mobile-inventory-toggle'); },
          party: intent => { if (intent.phase !== 'end') openCharacterStats(game); },
          settings: intent => { if (intent.phase !== 'end') toggleSettings(game); },
          bookmark: intent => { if (intent.phase !== 'end') attached.events.emit('mobile-bookmark', intent.value); },
        }, -100);
        unsubscribePresentation = scenePresentation(attached).subscribe(next => {
          if (snapshot?.controls !== next.controls) cancel();
          if (!next.abilities.length) abilitiesRevealed = false;
          snapshot = next; dataDirty = true;
        });
        scene.events.on('shutdown', sceneShutdown);
        for (const event of ['pause', 'sleep']) scene.events.on(event, sceneStopped);
        for (const event of ['resume', 'wake']) scene.events.on(event, sceneResumed);
      }
    }
    if ((!nextEnabled && enabled) || (nextBlocked && !blocked)) cancel();
    if (nextBlocked && !releaseModalLock && scene) releaseModalLock = sceneInput(scene).lock({ priority: 1000 });
    if (!nextBlocked) { releaseModalLock?.(); releaseModalLock = undefined; }
    if (enabled !== nextEnabled || blocked !== nextBlocked || showingActionBar !== nextActionBar) dataDirty = true;
    enabled = nextEnabled; blocked = nextBlocked; root.hidden = !enabled;
    if (!dataDirty) return;
    dataDirty = false;
    const key = scene?.sys.settings.key ?? 'boot'; root.dataset.scene = key;
    root.dataset.desktopReader = String(cinematicControls);
    const profile = nextProfile;
    showingActionBar = nextActionBar;
    document.documentElement.dataset.actionBar = String(showingActionBar);
    actionBar.hidden = !showingActionBar;
    if (showingActionBar && toolbar.parentElement !== actionBar) actionBar.append(toolbar, actions);
    else if (!showingActionBar && toolbar.parentElement === actionBar) { root.prepend(toolbar); inputRow.append(actions); }
    root.dataset.controlMode = scene?.data.get('story:camp-dialogue')?.stage === 'menu' ? 'choice'
      : !profile.directions.length && Object.keys(profile.actions).length === 1 ? 'cinematic' : 'gameplay';
    dpad.hidden = !touchEnabled || (blocked && !showingActionBar) || !profile.directions.length;
    for (const [direction, control] of directionButtons) { control.hidden = !profile.directions.includes(direction); control.disabled = blocked || !!profile.disabled; }
    const abilityDisabled = !!snapshot?.disabled;
    const selected = snapshot?.selected;
    const abilities = (snapshot?.abilities ?? []) as { key: string; icon: string }[];
    if (snapshot?.abilitiesVisible !== false || profile.actions.Q || profile.actions.R) abilitiesRevealed = true;
    const slots = actionBarSlots(profile, abilities, { visible: abilitiesRevealed, disabled: abilityDisabled, selected });
    function setButtonLabel(control: HTMLButtonElement, label: string) {
      const signature = `${showingActionBar}:${label}`;
      if (control.dataset.label === signature) return;
      control.dataset.label = signature;
      const text = document.createElement('span'); text.className = 'mobile-action-label'; text.textContent = label;
      const shortcut = document.createElement('kbd'); shortcut.textContent = shortcuts.get(control) ?? ''; shortcut.setAttribute('aria-hidden', 'true');
      control.replaceChildren(text, shortcut);
    }
    for (const [action, control] of actionButtons) {
      const slot = slots.find(entry => entry.key === action);
      control.dataset.intent = scene ? sceneInput(scene).actionForKey(action) : KEY_ACTIONS[action];
      const label = showingActionBar ? slot?.label : profile.actions[action]; control.hidden = (blocked && !showingActionBar) || !label;
      control.disabled = blocked || (showingActionBar ? !!slot?.disabled : !!profile.disabled || (abilityDisabled && (action === 'Q' || action === 'R')));
      setButtonLabel(control, label ?? action); control.setAttribute('aria-label', label ?? action);
      control.setAttribute('aria-pressed', String(showingActionBar ? !!slot?.selected : abilities.some(ability => ability.key === action && ability.icon === selected)));
      control.title = `${label ?? action}${control.disabled && !blocked && (action === 'Q' || action === 'R') ? ' · Zurzeit nicht verfügbar' : ''}`;
    }
    const inventory = snapshot?.inventory; bag.hidden = !inventory || inventory.available === false || profile.inventory === false; bag.disabled = blocked;
    bag.dataset.count = String((inventory?.items ?? []).reduce((total: number, item: { count: number }) => total + item.count, 0));
    party.hidden = !showingActionBar; party.disabled = blocked;
    const world = game.registry.get('world');
    const battleParty = game.registry.get('battle:state')?.units?.filter((unit: { alive: boolean; side: string }) => unit.alive && unit.side !== 'enemy').length;
    party.dataset.count = String(key === 'battle' ? battleParty || 1 : ['flight', 'break', 'refuge'].includes(key) ? 1 : world?.flags?.metFoltanAzar ? 3 : 1);
    const portraitKey = String(snapshot?.portrait ?? 'portrait-lia').replace(/^portrait-/, '');
    party.style.setProperty('--party-portrait', `url('${assetUrl(`/assets/portraits/${portraitKey}.png`)}')`);
    party.setAttribute('aria-expanded', String(!!document.querySelector('#character-dialog[open]')));
    for (const [control, label] of [[bag, 'Tasche'], [party, 'Gruppe'], [settings, 'Optionen']] as const) setButtonLabel(control, label);
    bag.setAttribute('aria-expanded', String(!!inventory?.open)); settings.disabled = settingsAreOpen();
    if (justUnblocked && returnFocus) {
      if (returnFocus.isConnected && !returnFocus.hidden && !returnFocus.disabled) returnFocus.focus({ preventScroll: true });
      returnFocus = undefined;
    }
    const dialogueActive = !!snapshot?.dialogueActive;
    const hudVisible = snapshot?.hudVisible !== false && !dialogueActive;
    const battleStatus = hudVisible ? mobileBattleSummary(snapshot?.battleStatus) : '';
    root.dataset.dialogue = String(dialogueActive);
    root.dataset.battleStatus = String(!!battleStatus);
    const name = snapshot?.name, hp = snapshot?.hp;
    setCaption('.mobile-identity', battleStatus ? '' : hudVisible && typeof name === 'string' ? `${name}${typeof hp === 'number' ? ` · ${Math.round(hp * 100)} %` : ''}` : hudVisible ? 'SELANTIS' : '');
    setCaption('[data-mobile-objective]', hudVisible ? snapshot?.objective : '');
    setCaption('[data-mobile-battle-status]', battleStatus);
    setCaption('[data-mobile-thought]', dialogueActive ? snapshot?.dialogueText : snapshot?.thought);
    setCaption('[data-mobile-dialogue-measure]', dialogueActive ? snapshot?.dialogueFullText : '');
    setCaption('[data-mobile-hint]', hudVisible ? touchHint(snapshot?.hint ?? '', profile.actions) : '');
    const thought = root.querySelector<HTMLElement>('[data-mobile-thought]')!;
    thought.setAttribute('aria-hidden', String(dialogueActive));
    const announcement = root.querySelector<HTMLElement>('[data-mobile-announcement]')!;
    const completed = dialogueActive ? snapshot?.dialogueComplete ?? '' : snapshot?.thought ?? '';
    if (announcement.textContent !== completed) announcement.textContent = completed;
    const speaker = snapshot?.dialogueSpeaker;
    const caption = root.querySelector<HTMLElement>('.mobile-caption')!;
    caption.hidden = !root.querySelector<HTMLElement>('.mobile-caption-text')!.textContent?.trim() && !dialogueActive;
    caption.setAttribute('aria-label', dialogueActive && speaker ? `Dialog: ${speaker}` : 'Spielhinweise');
    const portrait = root.querySelector<HTMLElement>('.mobile-dialogue-portrait')!;
    const face = root.querySelector<HTMLElement>('.mobile-dialogue-face')!;
    const image = root.querySelector<HTMLImageElement>('[data-mobile-portrait]')!;
    const portraitSource = snapshot?.dialoguePortraitSrc;
    portrait.hidden = !dialogueActive || !speaker;
    image.hidden = !portraitSource;
    face.dataset.fallback = String(!portraitSource);
    if (portraitSource && image.getAttribute('src') !== portraitSource) image.setAttribute('src', portraitSource);
    image.alt = speaker ? `Porträt: ${speaker}` : '';
    setCaption('[data-mobile-speaker]', speaker);
    const choices = (snapshot?.bookmarks ?? []) as { id: string; label: string; selected: boolean }[];
    const signature = JSON.stringify(choices); bookmarks.hidden = blocked || profile.inventory === false || !choices.length;
    if (signature !== bookmarkSignature) {
      bookmarkSignature = signature;
      bookmarks.replaceChildren(...choices.map(choice => {
        const control = button(choice.label, 'mobile-control mobile-bookmark'); control.dataset.bookmark = choice.id;
        control.setAttribute('aria-pressed', String(choice.selected));
        control.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation(); sync(); if (!enabled || blocked) return;
          cancel(); if (scene) sceneInput(scene).dispatch({ action: 'bookmark', phase: 'activate', source: 'touch', value: choice.id });
        });
        return control;
      }));
    }
    // Captions and action rows can move the centered canvas without changing
    // its dimensions. Refresh its input origin after the DOM has reflowed.
    const captionText = root.querySelector<HTMLElement>('.mobile-caption-text')!;
    caption.dataset.scrollable = String(captionText.scrollHeight > captionText.clientHeight);
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
    delete document.documentElement.dataset.actionBarInstalled; delete document.documentElement.dataset.actionBar;
  };
  game.events.once('destroy', dispose);
  return dispose;
}
