import type Phaser from 'phaser';
import { fitGameScale } from "../presentation/layout";
import type { Disposer } from "./lifetime";

/** Viewport and touch listeners belong to one application instance. */
export function installApplicationViewport(game: Phaser.Game, host: HTMLElement, controls?: HTMLElement | null): Disposer {
  const touchMode = window.matchMedia('(any-pointer: coarse), (max-width: 900px)');
  const previousTouchMode = document.documentElement.dataset.touchEnabled;
  let frame = 0;
  let disposed = false;
  const resize = () => {
    frame = 0;
    if (disposed) return;
    const zoom = fitGameScale(host.clientWidth, host.clientHeight, false);
    if (!zoom) return;
    game.scale.setZoom(zoom);
    game.scale.refresh();
  };
  const queueResize = () => {
    if (disposed) return;
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(resize);
  };
  const setTouchMode = () => { document.documentElement.dataset.touchEnabled = String(touchMode.matches); queueResize(); };
  const observer = new ResizeObserver(queueResize);
  observer.observe(host);
  if (controls) observer.observe(controls);
  window.addEventListener('resize', queueResize);
  window.visualViewport?.addEventListener('resize', queueResize);
  touchMode.addEventListener('change', setTouchMode);
  setTouchMode();
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', queueResize);
    window.visualViewport?.removeEventListener('resize', queueResize);
    touchMode.removeEventListener('change', setTouchMode);
    if (previousTouchMode === undefined) delete document.documentElement.dataset.touchEnabled;
    else document.documentElement.dataset.touchEnabled = previousTouchMode;
  };
}
