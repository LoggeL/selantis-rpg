import Phaser from 'phaser';
import { TrackingModel, TRACKING_CLUES, TRACKING_ROUTES, type ClueId, type RouteId } from '../../../modules/tracking/model';
import { FLICK_TRAIL_AREA } from '../../../content/areas/continuationFilm';
import type { AssetManifest } from '../../../content/assets/types';
import { scenePresentation } from '../../model';
import './tracking.css';

export interface TrackingLaunch { onComplete?: (success: boolean) => void }

/** One small evidence puzzle on the authored forest path. No campaign writes. */
export class TrackingScene extends Phaser.Scene {
  private model = new TrackingModel();
  private onComplete?: (success: boolean) => void;
  private dialog?: HTMLDialogElement;
  private finished = false;
  constructor() { super('tracking'); }
  init(data: TrackingLaunch = {}) { this.onComplete = data.onComplete; }
  create() {
    this.model = new TrackingModel(); this.finished = false;
    this.add.image(0, 0, FLICK_TRAIL_AREA.bg).setOrigin(0).setDisplaySize(640, 360);
    scenePresentation(this).publish({ hudVisible: false, objective: '', hint: '', inventory: null,
      abilitiesVisible: false, dialogueActive: false, controls: { directions: [], actions: {}, inventory: false, disabled: true } });
    const dialog = this.dialog = document.createElement('dialog');
    dialog.className = 'tracking-dialog'; dialog.setAttribute('aria-labelledby', 'tracking-title');
    const bg = (this.cache.json.get('manifest') as AssetManifest).assets.find(asset => asset.id === FLICK_TRAIL_AREA.bg)!.url;
    dialog.innerHTML = `<header><h2 id="tracking-title">Flicks Fährte</h2><p>Spuren untersuchen. Dann den Weg wählen.</p><button type="button" data-tracking-cancel aria-label="Zurück zur Wegplanung">Zurück</button></header>
      <div class="tracking-map" aria-label="Waldweg mit Hufabdrücken, Rindenspur und feuchter Erde">
        <img alt="" src="${bg}">
        <svg viewBox="0 0 640 360" aria-hidden="true"><g fill="#55362b" stroke="#ead9a5" stroke-width="1.4">
        <path d="M267 238v-11q6-8 12 0v11h-4v-9q-2-4-4 0v9z M286 229v-11q6-8 12 0v11h-4v-9q-2-4-4 0v9z M306 219v-11q6-8 12 0v11h-4v-9q-2-4-4 0v9z"/>
        </g><g stroke="#e7bd81" stroke-width="3"><path d="M310 129l10-7 M309 137l12-8 M312 145l11-8"/></g></svg>
      </div>
      <section class="tracking-reading"><p data-tracking-evidence></p><p data-tracking-detail>Die markierten Stellen auf dem Waldweg lassen sich untersuchen.</p><p data-tracking-feedback role="status" aria-live="polite"></p>
      <div class="tracking-routes" role="group" aria-label="Weg wählen"></div>
      <div class="tracking-result"><button type="button" data-tracking-retry>Zur Wurzel zurück</button><button type="button" data-tracking-follow>Der Spur folgen</button></div></section>`;
    const map = dialog.querySelector('.tracking-map')!;
    for (const [index, clue] of TRACKING_CLUES.entries()) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'tracking-clue';
      button.dataset.trackingClue = clue.id; button.style.left = `${clue.at[0]}%`; button.style.top = `${clue.at[1]}%`;
      button.textContent = `${index + 1}`; button.setAttribute('aria-label', `${clue.title} untersuchen`); button.title = clue.title;
      button.addEventListener('click', () => { if (!this.scene.isActive()) return; this.model.inspect(clue.id); this.render(); }); map.append(button);
    }
    const routes = dialog.querySelector('.tracking-routes')!;
    for (const route of TRACKING_ROUTES) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.trackingRoute = route.id;
      button.textContent = route.label; button.addEventListener('click', () => this.choose(route.id)); routes.append(button);
    }
    dialog.querySelector('[data-tracking-cancel]')!.addEventListener('click', () => { this.model.cancel(); this.finish(false); });
    dialog.querySelector('[data-tracking-retry]')!.addEventListener('click', () => { this.model.retry(); this.render(); });
    dialog.querySelector('[data-tracking-follow]')!.addEventListener('click', () => { if (this.model.state.phase === 'solved') this.finish(true); });
    const keydown = (event: KeyboardEvent) => {
      if (event.code === 'KeyO') { event.preventDefault(); event.stopPropagation(); return; }
      if (!this.scene.isActive() || event.repeat) return;
      const clue = TRACKING_CLUES[Number(event.key) - 1];
      if (clue && /^[123]$/.test(event.key)) { event.preventDefault(); this.model.inspect(clue.id); this.render(); }
      else if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); this.model.cancel(); this.finish(false); }
      else if (event.code === 'KeyR') { event.preventDefault(); this.model.retry(); this.render(); }
      else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault(); this.model.select(event.code === 'ArrowLeft' ? 'back' : 'forward'); this.render();
      } else if (event.code === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault(); if (this.model.state.phase === 'solved') this.finish(true);
        else if (this.model.state.selected) this.choose(this.model.state.selected);
      }
    };
    dialog.addEventListener('keydown', keydown);
    dialog.addEventListener('cancel', event => { event.preventDefault(); this.model.cancel(); this.finish(false); });
    document.body.append(dialog); dialog.showModal(); dialog.tabIndex = -1; dialog.focus();
    const cleanup = () => {
      dialog.close(); dialog.remove(); if (this.dialog === dialog) this.dialog = undefined;
      this.events.off('shutdown', cleanup); this.events.off('destroy', cleanup);
    };
    this.events.once('shutdown', cleanup); this.events.once('destroy', cleanup);
    this.render();
  }
  private choose(route: RouteId) { if (!this.scene.isActive()) return; this.model.choose(route); this.render(); }
  private render() {
    const dialog = this.dialog, st = this.model.state; if (!dialog) return;
    dialog.dataset.phase = st.phase;
    dialog.querySelector('[data-tracking-detail]')!.textContent = st.detail || 'Die markierten Stellen auf dem Waldweg lassen sich untersuchen.';
    dialog.querySelector('[data-tracking-feedback]')!.textContent = st.feedback;
    dialog.querySelector('[data-tracking-evidence]')!.textContent = `Untersucht: ${st.examined.length}/3 · ${TRACKING_CLUES.map(clue => `${clue.title}${st.examined.includes(clue.id) ? ' ✓' : ''}`).join(' · ')}`;
    for (const button of Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-tracking-clue]'))) button.dataset.examined = String(st.examined.includes(button.dataset.trackingClue as ClueId));
    for (const button of Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-tracking-route]'))) {
      button.disabled = st.phase !== 'inspect'; button.setAttribute('aria-pressed', String(st.selected === button.dataset.trackingRoute));
    }
    (dialog.querySelector('[data-tracking-retry]') as HTMLButtonElement).hidden = st.phase !== 'failed';
    (dialog.querySelector('[data-tracking-follow]') as HTMLButtonElement).hidden = st.phase !== 'solved';
    this.registry.set('tracking:state', this.model.snapshot());
  }
  private finish(success: boolean) {
    if (this.finished) return; this.finished = true;
    const complete = this.onComplete; this.onComplete = undefined;
    this.events.once('shutdown', () => complete?.(success));
    if (complete) this.scene.stop(); else this.scene.start('flick-trail');
  }
}
