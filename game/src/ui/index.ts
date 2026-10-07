import { screenVoicePan } from '../audio/recordedMediaRouting';
import { bindRecordedMediaRouting, bindVoiceVolume, bindWorldVoicePlayer, voiceover } from '../audio/voiceover';
import { G } from '../core/G';
import { openBag, registerItemAction, type ItemAction } from './bag';
import { chapterCard } from './chapterCard';
import { ctx, type HudMode } from './context';
import { openDebug } from './debug';
import { DialogueUi } from './dialogue';
import { el, nextFrame, sfx, wait } from './dom';
import { FxUi } from './fx';
import { BubbleUi, HintUi } from './hint';
import { hold } from './hold';
import { storyAction, stealthGame } from './interactions';
import { HudUi } from './hud';
import { openJournal } from './journal';
import { openMenu } from './menu';
import { NarrationUi } from './narration';
import type { OverlayHandle } from './overlay';
import { PlateUi } from './plate';
import { registerDefaultSpeakers } from './speakers';
import { RotateHint } from './rotate';
import { showTitle } from './title';
import { preloadBackdrop } from './titleBackdrop';
import { ToastUi } from './toast';
import { TouchUi } from './touch';
import type { UiApi } from './api';
import { WorldVoicePlayer } from './worldVoicePlayer';
import type { WorldScene } from '../world/WorldScene';
import { trackProgress } from './unlocks';
import './styles.css';

export type { UiApi } from './api';

/**
 * Extensions of the UiApi contract (additive; see docs/rebuild/ui-guide.md).
 */
export interface UiApiExt extends UiApi {
  /** Clears all transient UI (dialogue, plates, overlays, bubbles, hint, panels, letterbox; fade unless keepFade). */
  reset(opts?: { keepFade?: boolean }): void;
  /** Resolves when no modal UI is open (e.g. after openJournal()). */
  whenIdle(): Promise<void>;
  /**
   * Scene transition: fade out, reset UI, stop gameplay scenes, run `start` (not awaited to completion),
   * then fade back in — unless the started scene took over the fade itself (called fade() meanwhile).
   */
  transition(start: () => void | Promise<void>, opts?: { fadeMs?: number }): Promise<void>;
  /** Contextual touch buttons (Schleichen / Spurenblick). */
  setTouchExtras(opts: { sneak?: boolean; look?: boolean }): void;
  /** Ids of registered (code-drawn) plates. */
  plateIds(): string[];
  /** Loads a plate (painted image or code-drawn) ahead of time, so a later plate(id) opens without delay. */
  prefetchPlate(id: string): void;
  /** Current HUD mode. */
  hudMode(): HudMode;

  /**
   * Scene-safe sleep for story scripts: resolves after `ms`, or NEVER if the player left the scene meanwhile
   * (title, warp, transition). Use it instead of setTimeout so a script stops at its next await.
   */
  wait(ms: number): Promise<void>;
  /** Current UI epoch; compare later with alive(token) to know whether the scene is still the same. */
  token(): number;
  /** False once the player left the scene that was current when `token` was taken. */
  alive(token: number): boolean;
  /**
   * Bag action for an item (default label „Benutzen“). Shown as a button in the bag's detail pane and
   * triggered with Enter/E/tap on the selected slot. `when` false shows the button disabled.
   * `closeBag` (default true) closes the bag before `run`.
   */
  registerItemAction(itemId: string, action: ItemAction): void;
  /**
   * Lets the running gameplay scene claim Escape before the menu opens (battle: cancel targeting/selection first).
   * The handler returns true when it used the key. Only asked while no modal UI is open. Pass null to clear.
   */
  setEscapeHandler(fn: (() => boolean) | null): void;
}

export type { ItemAction } from './bag';

/**
 * Passes a short tap from the touch stick zone through to the game canvas (tap-to-walk), as a
 * mousedown/mouseup pair on the canvas — Phaser treats it like a pointer press on the game.
 */
function forwardTapToCanvas(x: number, y: number): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game canvas');
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
  const init: MouseEventInit = { clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: 1, bubbles: true, cancelable: true, view: window };
  canvas.dispatchEvent(new MouseEvent('mousemove', { ...init, buttons: 0 }));
  canvas.dispatchEvent(new MouseEvent('mousedown', init));
  setTimeout(() => canvas.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 })), 60);
}

export function createUi(): UiApiExt {
  let escapeHandler: (() => boolean) | null = null;
  registerDefaultSpeakers();
  trackProgress();
  let dialogue!: DialogueUi;
  let narration!: NarrationUi;
  let fx!: FxUi;
  let plates!: PlateUi;
  let hud!: HudUi;
  let toasts!: ToastUi;
  let hints!: HintUi;
  let bubbles!: BubbleUi;
  let touch!: TouchUi;
  let mounted = false;
  let overlay: { id: string; handle: OverlayHandle } | null = null;
  let fadeGen = 0;
  const pendingPlates: [string, () => HTMLCanvasElement | string][] = [];

  const openOverlayOnce = (id: string, open: () => OverlayHandle) => {
    if (overlay && !overlay.handle.closed) {
      const same = overlay.id === id;
      overlay.handle.close();
      overlay = null;
      if (same) return;
    }
    overlay = { id, handle: open() };
  };

  const toTitle = () => {
    void import('../scenes/BootScene').then(m => m.showTitle());
  };
  const warp = (id: string) => {
    void api.transition(() => G.warp(id));
  };

  const api: UiApiExt = {
    mount(root) {
      if (mounted) return;
      mounted = true;
      ctx.mount(root);
      ctx.onVoicePause = paused => voiceover.setPaused(paused);
      bindVoiceVolume(() => G.settings.voice);
      bindRecordedMediaRouting(element => G.audio?.routeRecordedMedia?.(element) ?? null);
      const worldPlayer = new WorldVoicePlayer();
      const currentWorld = () => G.game?.scene.getScenes(false).find(scene => scene.sys.settings.key === 'World') as WorldScene | undefined;
      bindWorldVoicePlayer(scene => worldPlayer.speaker(scene, currentWorld()));
      G.events.on('world:ready', () => worldPlayer.ready(G.currentScene, currentWorld()));
      void voiceover.preload('prolog');
      void voiceover.preload('story');
      voiceover.scene(G.currentScene);
      G.events.on('scene:goto', ({ id }) => { worldPlayer.sceneChanged(); voiceover.scene(id); });
      G.events.on('settings:changed', () => voiceover.refreshVolume());
      document.addEventListener('visibilitychange', () => { if (document.hidden) voiceover.stop(); });
      dialogue = new DialogueUi();
      narration = new NarrationUi();
      fx = new FxUi();
      fx.mount();
      plates = new PlateUi(on => fx.letterbox(on));
      for (const [id, draw] of pendingPlates) plates.register(id, draw);
      hud = new HudUi({ journal: () => api.openJournal(), bag: () => api.openBag(), menu: () => api.openMenu() });
      hud.mount();
      toasts = new ToastUi();
      toasts.mount();
      hints = new HintUi();
      hints.mount();
      bubbles = new BubbleUi();
      touch = new TouchUi();
      touch.mount();
      new RotateHint().mount();
      preloadBackdrop(); // the title painting loads while Phaser boots
      hints.onChange = h => touch.setVerb(h?.verb ?? null);
      touch.onTap = (x, y) => { if (!hints.tapAt(x, y)) forwardTapToCanvas(x, y); };
      // A new scene is running: story UI may draw again.
      G.events.on('scene:goto', () => { ctx.transitioning = false; });
      api.setHud('none');
      ctx.globalKeys = e => {
        if (e.repeat) return false;
        const k = e.key;
        if (k === 'F2') { openOverlayOnce('debug', () => openDebug({ warp, toTitle })); return true; }
        if (ctx.has('title')) return false;
        const top = ctx.top();
        const explore = ctx.hudMode === 'explore' || Boolean(top?.allowJournal);
        if (k === 'Escape') { if (!top && escapeHandler?.()) return true; api.openMenu(); return true; }
        if ((k === 'Tab' || k === 'j' || k === 'J') && explore) { api.openJournal(); return true; }
        if ((k === 'i' || k === 'I') && explore) { api.openBag(); return true; }
        return false;
      };
      // Panels belong to the scene that created them.
      G.events.on('scene:goto', () => { ctx.layers.overlay.querySelectorAll('.ui-panel').forEach(n => n.remove()); });
    },

    // Story calls from a scene the player already left (title is up / transition running) render nothing
    // and never resolve, so stale scripts stop where they are.
    say: (speaker, text, opts) => dialogue.say(speaker, text, opts),
    choose: (options, opts) => dialogue.choose(options, opts),
    narrate: (lines, opts) => (ctx.stale() ? ctx.never() : narration.narrate(lines, opts?.style)),
    think: (text, opts) => dialogue.think(text, opts),

    plate: (id, opts) => (ctx.stale() ? ctx.never() : plates.show(id, opts)),
    closePlate: () => plates.close(),
    registerPlate(id, draw) {
      if (plates) plates.register(id, draw); else pendingPlates.push([id, draw]);
    },
    plateIds: () => (plates ? plates.ids() : pendingPlates.map(p => p[0])),
    prefetchPlate: id => plates?.prefetch(id),

    chapterCard: (numeral, title, subtitle) => (ctx.stale() ? ctx.never() : chapterCard(numeral, title, subtitle)),
    fade(dir, ms, color) { fadeGen++; return fx.fade(dir, ms, color); },
    letterbox: on => { if (!(on && ctx.stale())) fx.letterbox(on); },
    caption: (text, ms) => (ctx.stale() ? ctx.never() : narration.caption(text, ms)),

    toast: (text, kind) => toasts.toast(text, kind),
    objective: text => { if (!ctx.stale()) hud.objective(text); },
    objectivePointer: pos => hud.objectivePointer(ctx.stale() ? null : pos),
    hint: h => hints.hint(ctx.stale() ? null : h),
    bubble: (text, anchor, ms, opts) => {
      if (ctx.stale() || (!opts?.foreground && ctx.busy())) return () => {};
      const voice = opts?.speaker && !ctx.busy() ? voiceover.play('bark', opts.speaker, opts.voiceText ?? text, undefined, undefined, opts.foreground, opts.foreground ? () => screenVoicePan(anchor()?.x) : undefined) : null;
      return Object.assign(bubbles.bubble(text, anchor, ms, voice, opts?.voiceText), { voiced: Boolean(voice), voiceDone: voice?.done });
    },
    hold: (label, durationMs, opts) => (ctx.stale() ? ctx.never() : hold(label, durationMs, opts)),
    storyAction,
    stealthGame,

    panel(className) {
      const node = el('div', `ui-panel${className ? ` ${className}` : ''}`);
      ctx.layers.overlay.appendChild(node);
      return node;
    },

    openJournal() {
      if (ctx.has('title')) return;
      openOverlayOnce('journal', () => openJournal());
    },
    openBag() {
      if (ctx.has('title')) return;
      openOverlayOnce('bag', () => openBag());
    },
    openMenu() {
      if (ctx.has('title')) return;
      openOverlayOnce('menu', () => openMenu({
        journal: () => api.openJournal(),
        bag: () => api.openBag(),
        warp,
        toTitle,
        debug: () => new URLSearchParams(location.search).has('dev'),
      }));
    },

    title: () => showTitle(),

    setHud(mode) {
      ctx.hudMode = mode;
      hud.setMode(mode);
      if (mode !== 'explore') hints.hint(null);
    },
    hudMode: () => ctx.hudMode,
    setTouchExtras: opts => touch.setExtras(opts),

    wait(ms) {
      const token = ctx.epoch;
      return new Promise<void>(resolve => setTimeout(() => { if (token === ctx.epoch) resolve(); }, Math.max(0, ms)));
    },
    token: () => ctx.epoch,
    alive: token => token === ctx.epoch && !ctx.stale(),
    registerItemAction,
    setEscapeHandler(fn) { escapeHandler = fn; },

    busy: () => ctx.busy(),
    async whenIdle() {
      while (ctx.busy()) await wait(50);
    },

    reset(opts) {
      voiceover.stop();
      ctx.epoch++;
      dialogue.clear();
      plates.clear();
      bubbles.clear();
      hints.hint(null);
      hud.objectivePointer(null);
      toasts.clear();
      if (overlay && !overlay.handle.closed) overlay.handle.close();
      overlay = null;
      for (const name of ['dialog', 'card', 'overlay', 'debug', 'title'] as const) ctx.layers[name].textContent = '';
      ctx.root.classList.remove('title-active', 'title-subpage');
      const game = document.getElementById('game');
      if (game) game.style.background = '';
      fx.letterbox(false);
      if (!opts?.keepFade) fx.clearFade();
      ctx.clearModals();
    },

    async transition(start, opts) {
      const ms = opts?.fadeMs ?? 550;
      ctx.transitioning = true;
      voiceover.stop();
      ctx.epoch++; // scripts of the scene we leave stop at their next G.ui.wait()
      await api.fade('out', ms);
      api.reset({ keepFade: true });
      toasts.mute(); // rewards granted while the next scene prepares stay silent (until scene:goto)
      G.stopGameplayScenes();
      ctx.transitioning = false;
      const gen = fadeGen;
      let failed = false;
      try {
        const p = start();
        if (p) p.catch(err => { failed = true; console.error('[ui] scene start failed', err); api.toast('Diese Szene konnte nicht gestartet werden.', 'info'); });
      } catch (err) {
        failed = true;
        console.error('[ui] scene start failed', err);
        api.toast('Diese Szene konnte nicht gestartet werden.', 'info');
      }
      await nextFrame(); await nextFrame(); await wait(160);
      if (fadeGen === gen || failed) await api.fade('in', ms);
      if (failed) sfx('ui-cancel');
    },
  };
  return api;
}
