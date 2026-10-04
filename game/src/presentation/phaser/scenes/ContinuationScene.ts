import Phaser from 'phaser';
import { StoryScene } from '../StoryScene';
import { createEndingDialog } from '../../dom/endingDialog';
import { SequenceRunner } from '../../../modules/narrative/sequence';
import { isMapWalkable, clearWalkingLine, findWalkingPath } from '../../../modules/exploration/navigation';
import { state } from '../../../platform/campaignRegistry';
import { setCampaignFlag } from '../../../modules/campaign/commands';
import { actionAvailable, actionComplete, actorVisible, chapterCompleteFlag, chapterEntryFlag, chapterEnteredFlag, chapterExitAvailable, chapterObjective, completeChapter, completeChapterAction, resetChapter } from '../../../modules/continuation/progression';
import type { ContinuationAction, ContinuationBeat, ContinuationChapterDefinition, ContinuationCue } from '../../../modules/continuation/types';
import type { AssetManifest } from '../../../content/assets/types';
import type { Pt } from '../../../modules/narrative/types';
import { setSceneMusic } from '../../../app/audio';
import { ambientPrefs, motionDuration } from '../../../app/settings';

/** Generic explorable chapter adapter; authored events remain data-only. */
export class ContinuationScene extends StoryScene {
  private conversation?: SequenceRunner<ContinuationBeat>;
  private currentAction?: string;
  private chapterActors = new Map<string, Phaser.GameObjects.Sprite>();
  private followerRoutes = new Map<string, { goal: Pt; points: Pt[] }>();
  private actorFacing = new Map<string, 'n' | 's' | 'e' | 'w'>();
  private talking = false;
  private collapsedActors = new Set<string>();
  private ended = false;
  private activeLifetime = 0;
  private activeChallenge?: string;
  private weather?: Phaser.GameObjects.Graphics;
  private weatherTime = 0;
  private visibilityCues = new Map<string, boolean>();
  private boundActors = new Map<string, Phaser.GameObjects.Graphics>();
  private effects = new Set<() => void>();

  constructor(private readonly chapter: ContinuationChapterDefinition) { super(chapter.id); }

  create() {
    const lifetime = ++this.activeLifetime;
    this.conversation?.dispose();
    this.conversation = undefined;
    this.chapterActors.clear(); this.followerRoutes.clear(); this.actorFacing.clear(); this.effects.clear(); this.visibilityCues.clear(); this.boundActors.clear(); this.collapsedActors.clear();
    this.talking = false; this.ended = false; this.weatherTime = 0; this.currentAction = undefined; this.activeChallenge = undefined;
    this.data.set('story:chapter-ended', false);
    this.begin(this.chapter.area);
    const st = state(this.registry);
    setCampaignFlag(st, chapterEnteredFlag(this.chapter.id));
    this.data.set('story:chapter', this.chapter.id);
    this.data.set('story:chapter-source', this.chapter.source);
    for (const actor of this.chapter.actors) {
      const texture = actor.texture.startsWith('portrait-') ? 'story-actors' : actor.texture;
      const asset = (this.cache.json.get('manifest') as AssetManifest | undefined)?.assets.find(asset => asset.id === texture);
      const foot = asset?.foot ?? [32, 60];
      const sprite = this.add.sprite(...actor.at, texture, actor.texture.startsWith('portrait-') ? 0 : actor.frame ?? 0)
        .setDisplaySize(...(actor.displaySize ?? [64, 64])).setOrigin(foot[0] / (asset?.frameW ?? 64), foot[1] / (asset?.frameH ?? 64)).setDepth(actor.at[1]);
      this.areaRoot.add(sprite); this.chapterActors.set(actor.id, sprite);
      this.actorFacing.set(actor.id, 's');
      if (actor.bound) {
        const rope = this.add.graphics(); this.areaRoot.add(rope); this.boundActors.set(actor.id, rope);
      }
    }
    if (st.flags[chapterEntryFlag(this.chapter.id)]) for (const beat of this.chapter.entry ?? []) for (const cue of this.beatCues(beat)) this.restoreCue(cue);
    for (const action of this.chapter.actions) if (actionComplete(st.flags, action)) {
      for (const beat of action.beats) for (const cue of this.beatCues(beat)) {
        // A collapsed character must reopen beside the recovery interaction.
        if (cue.type === 'collapse' && (cue.actor ?? 'lia') === 'lia') this.lia.setPosition(...action.at);
        this.restoreCue(cue);
      }
    }
    this.refreshActors();
    if (this.chapter.atmosphere) {
      this.weather = this.add.graphics().setDepth(900);
      this.areaRoot.add(this.weather);
    }
    setSceneMusic(this, this.chapter.music ?? 'exploration');
    this.refreshSpots();
    this.events.once('shutdown', () => {
      if (this.activeLifetime !== lifetime) return;
      ++this.activeLifetime;
      if (this.activeChallenge) this.scene.stop(this.activeChallenge);
      this.activeChallenge = undefined;
      this.conversation?.dispose();
      for (const cleanup of [...this.effects]) cleanup();
      this.effects.clear(); this.followerRoutes.clear(); this.actorFacing.clear(); this.chapterActors.clear(); this.boundActors.clear();
      this.weather = undefined;
    });
    if (this.chapter.end && st.flags[chapterCompleteFlag(this.chapter.id)]) this.showEnding();
    else if (this.chapter.entry?.length && !st.flags[chapterEntryFlag(this.chapter.id)]) {
      this.runSequence(this.chapter.entry, () => { setCampaignFlag(st, chapterEntryFlag(this.chapter.id)); });
    }
    this.publishSnapshot();
  }

  private refreshActors() {
    const flags = state(this.registry).flags;
    for (const definition of this.chapter.actors) this.chapterActors.get(definition.id)?.setVisible(actorVisible(flags, definition) && this.visibilityCues.get(definition.id) !== false);
  }

  private refreshSpots() {
    const flags = state(this.registry).flags;
    this.setObjective(chapterObjective(flags, this.chapter));
    this.data.set('story:chapter-actions', this.chapter.actions.filter(action => actionAvailable(flags, action)).map(action => action.id));
    this.setSpots([
      ...this.chapter.actions.map(action => ({
        id: action.id, label: action.label, at: action.at, radius: action.radius,
        enabled: () => !this.talking && actionAvailable(state(this.registry).flags, action),
        markerVisible: () => !actionComplete(state(this.registry).flags, action),
        markerWhenDisabled: true,
        disabledHint: () => action.disabledHint ?? 'Zuerst die übrigen Spuren und Gespräche hier verfolgen.',
        onUse: () => this.useAction(action),
      })),
      { id: this.chapter.exit.id ?? 'chapter-exit', label: this.chapter.exit.label, at: this.chapter.exit.at, radius: this.chapter.exit.radius,
        enabled: () => !this.talking && chapterExitAvailable(state(this.registry).flags, this.chapter),
        markerWhenDisabled: true, disabledHint: () => chapterObjective(state(this.registry).flags, this.chapter),
        onUse: () => this.leaveChapter() },
    ]);
  }

  private useAction(action: ContinuationAction) {
    if (this.talking || !actionAvailable(state(this.registry).flags, action)) return;
    this.currentAction = action.id;
    if (action.challenge) { this.runChallenge(action); return; }
    this.runSequence(action.beats, () => {
      completeChapterAction(state(this.registry), action);
      this.refreshLiaAppearance(); this.refreshActors();
    });
  }

  private runChallenge(action: ContinuationAction) {
    const challenge = action.challenge!;
    const key = challenge.kind === 'rescue' ? 'rescue-battle' : 'tracking';
    const lifetime = this.activeLifetime;
    let returned = false;
    this.conversation?.dispose();
    this.hideCloseup(); this.inventory.close();
    this.talking = true; this.setLocked(true); this.setCinematic(false);
    this.activeChallenge = key; this.publishSnapshot();
    // A sleeping chapter cannot consume the encounter's keyboard/touch actions.
    this.scene.sleep();
    this.scene.launch(key, { onComplete: (success: boolean) => {
      if (returned || lifetime !== this.activeLifetime || this.activeChallenge !== key) return;
      returned = true; this.activeChallenge = undefined;
      setSceneMusic(this, this.chapter.music ?? 'exploration');
      if (!success) {
        this.talking = false; this.currentAction = undefined; this.setLocked(false);
        this.refreshSpots(); this.publishSnapshot(); this.scene.wake();
        return;
      }
      if (challenge.successPosition) this.lia.setPosition(...challenge.successPosition).setDepth(challenge.successPosition[1]);
      if (challenge.kind === 'tracking') {
        this.runSequence(action.beats, () => {
          completeChapterAction(state(this.registry), action);
          this.refreshLiaAppearance(); this.refreshActors();
        });
      } else {
        // The player has already freed Kyra and held the guards off. Restore that
        // result instead of replaying an automatic fight after the earned win.
        for (const beat of action.beats) for (const cue of this.beatCues(beat)) this.restoreCue(cue);
        completeChapterAction(state(this.registry), action);
        this.talking = false; this.currentAction = undefined; this.setLocked(false);
        this.refreshLiaAppearance(); this.refreshActors(); this.refreshSpots();
        this.say('Kyra ist frei. Lia stellt sich zwischen sie und Vardis.');
      }
      this.publishSnapshot();
      // Wake subscribers receive the completed result and current controls.
      this.scene.wake();
    } });
  }

  private runSequence(beats: readonly ContinuationBeat[], complete: () => void) {
    this.conversation?.dispose();
    this.talking = true; this.setLocked(true); this.setCinematic(true);
    const lifetime = this.activeLifetime;
    this.conversation = new SequenceRunner(beats, {
      enter: (beat, _index, ready) => {
        const cleanup: (() => void)[] = [];
        this.data.set('story:chapter-beat', beat.id);
        if (beat.shot && !beat.shot.startsWith('portrait-') && this.textures.exists(beat.shot)) this.showCloseup(beat.shot);
        else this.hideCloseup();
        this.setCloseupText(beat.line);
        // Dialogue consumes its callback before invoking it. Keep early read input
        // harmless until both the visible beat and its choreography are ready.
        this.setCloseupContinue(null);
        const continuation = this.conversation!.continuation();
        let current = true;
        const unlock = () => {
          if (!current || lifetime !== this.activeLifetime) return;
          ready();
          if (this.conversation?.snapshot.status === 'active' && this.conversation.snapshot.ready) this.setCloseupContinue(continuation);
        };
        const cues = this.beatCues(beat);
        let remaining = cues.length;
        if (!remaining) unlock();
        for (const cue of cues) cleanup.push(this.playCue(cue, () => { if (--remaining === 0) unlock(); }));
        return () => { current = false; for (const dispose of cleanup) dispose(); };
      },
      complete: () => {
        if (lifetime !== this.activeLifetime) return;
        complete(); this.hideCloseup(); this.talking = false; this.currentAction = undefined;
        this.setCinematic(false); this.setLocked(false); this.refreshSpots();
      },
    });
    this.conversation.start();
  }

  private beatCues(beat: ContinuationBeat): readonly ContinuationCue[] { return [...(beat.cue ? [beat.cue] : []), ...(beat.cues ?? [])]; }
  private cueActor(id = 'lia'): Phaser.GameObjects.Sprite | undefined { return id === 'lia' ? this.lia : this.chapterActors.get(id); }

  private restoreCue(cue: ContinuationCue) {
    if (cue.type === 'crouch') { this.setLiaCrouched(cue.enabled); return; }
    const actor = this.cueActor('actor' in cue ? cue.actor : cue.type === 'burst' ? cue.target : undefined);
    if (!actor) return;
    switch (cue.type) {
      case 'move': actor.setPosition(...cue.to).setDepth(cue.to[1]); break;
      case 'show': this.visibilityCues.set(cue.actor, true); actor.setVisible(true); break;
      case 'hide': this.visibilityCues.set(cue.actor, false); actor.setVisible(false); break;
      case 'pose': if (cue.angle !== undefined) actor.setAngle(cue.angle); if (cue.tint !== undefined) actor.setTint(cue.tint); if (cue.flipX !== undefined) actor.setFlipX(cue.flipX); break;
      case 'collapse': this.collapsedActors.add(cue.actor ?? 'lia'); actor.anims.stop(); actor.setAngle(78).setAlpha(0.85); break;
      case 'recover': this.collapsedActors.delete(cue.actor ?? 'lia'); actor.setAngle(0).setAlpha(1); break;
      case 'unbind': if (actor.texture.key === 'story-actors') actor.setFrame(0); this.boundActors.get(cue.actor)?.destroy(); this.boundActors.delete(cue.actor); actor.clearTint().setAngle(0); break;
      case 'burst': if (cue.to) actor.setPosition(...cue.to); break;
    }
  }

  private playCue(cue: ContinuationCue, done: () => void): () => void {
    let cancelled = false;
    let tween: Phaser.Tweens.Tween | undefined;
    let graphic: Phaser.GameObjects.Graphics | undefined;
    const finish = () => { if (!cancelled) {
      if (actor && cue.type === 'move') this.animateCueActor(cue.actor, actor, cue.to, false);
      done();
    } };
    const cleanup = () => { cancelled = true; tween?.stop(); graphic?.destroy(); this.effects.delete(cleanup); };
    this.effects.add(cleanup);
    const actor = this.cueActor('actor' in cue ? cue.actor : cue.type === 'burst' ? cue.target : undefined);
    if (cue.type === 'move' && actor) {
      this.animateCueActor(cue.actor, actor, cue.to, true);
      const duration = motionDuration(cue.duration ?? 550);
      if (duration) tween = this.tweens.add({ targets: actor, x: cue.to[0], y: cue.to[1], duration, onUpdate: () => { actor.setDepth(actor.y); this.areaRoot.sort('depth'); }, onComplete: finish });
      else { this.restoreCue(cue); finish(); }
    } else if (cue.type === 'burst') {
      // This involuntary blue burst never unlocks a repeatable spell action.
      const color = cue.color ?? 0x397fc1;
      graphic = this.add.graphics().setDepth(950);
      // World effects follow the map and stay beneath illustrated close-ups.
      this.areaRoot.add(graphic);
      graphic.fillStyle(color, 0.34).fillCircle(this.lia.x, this.lia.y - 24, 23);
      graphic.fillStyle(0xb3f5ed, 0.88).fillCircle(this.lia.x, this.lia.y - 24, 9);
      graphic.lineStyle(3, color, 0.95).strokeCircle(this.lia.x, this.lia.y - 24, 35);
      const duration = motionDuration(cue.duration ?? 600);
      if (duration) {
        if (actor && cue.to) tween = this.tweens.add({ targets: actor, x: cue.to[0], y: cue.to[1], duration, ease: 'Cubic.Out', onComplete: finish });
        else tween = this.tweens.add({ targets: graphic, alpha: 0.15, duration, onComplete: finish });
      } else { this.restoreCue(cue); finish(); }
    } else { this.restoreCue(cue); finish(); }
    return cleanup;
  }

  private animateCueActor(id: string, actor: Phaser.GameObjects.Sprite, to: Pt, walking: boolean) {
    const dx = to[0] - actor.x, dy = to[1] - actor.y;
    const direction = Math.hypot(dx, dy) > 0.05
      ? Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'e' : 'w' : dy > 0 ? 's' : 'n'
      : this.actorFacing.get(id) ?? 's';
    this.actorFacing.set(id, direction);
    if (id === 'lia') { this.playLiaMovement(direction, walking); return; }
    const definition = this.chapter.actors.find(actor => actor.id === id);
    if (!definition) return;
    const key = `${definition.texture.replace(/-walk$/, '')}-${walking ? 'walk' : 'idle'}-${direction}`;
    if (this.anims.exists(key)) actor.play(key, true);
  }

  private leaveChapter() {
    const st = state(this.registry);
    if (!chapterExitAvailable(st.flags, this.chapter)) return;
    completeChapter(st, this.chapter);
    if (this.chapter.end) this.showEnding();
    else this.goTo(this.chapter.exit.to);
  }

  private showEnding() {
    if (this.ended || !this.chapter.end) return;
    this.ended = true; this.talking = true; this.setLocked(true); this.setCinematic(true);
    this.hideCloseup(); this.inventory.close();
    this.hud.setObjective(''); this.hud.hint('', true); this.hud.thought('', 0);
    this.hud.setCinematic(true); this.hud.setObjectiveVisible(false);
    const disposeEnding = createEndingDialog({
      title: this.chapter.end.title,
      text: this.chapter.end.text,
      replay: () => { resetChapter(state(this.registry), this.chapter); this.scene.start(this.chapter.id); },
      titleScreen: () => this.scene.start(this.chapter.end!.titleTo ?? 'title'),
    });
    this.data.set('story:chapter-ended', true);
    this.events.once('shutdown', disposeEnding);
  }

  update(time: number, dt: number) {
    super.update(time, this.collapsedActors.has('lia') ? 0 : dt);
    if (!this.lia?.active) return;
    this.updateWeather(dt);
    this.publishSnapshot();
    for (const [id, rope] of this.boundActors) {
      const actor = this.chapterActors.get(id);
      rope.clear().setVisible(!!actor?.visible);
      if (actor?.visible) rope.lineStyle(2, 0xab8158, 1).strokeRect(actor.x - 9, actor.y - 28, 18, 8).setDepth(actor.y + 1);
    }
    if (this.talking || this.ended || this.inventory.isOpen || this.hud.dialogueVisible || this.closeupVisible) return;
    const walkable = (x: number, y: number) => isMapWalkable(this.chapter.area, x, y);
    let index = 0;
    for (const definition of this.chapter.actors) {
      const actor = this.chapterActors.get(definition.id);
      if (!definition.follow || !actor?.visible || actor.angle) continue;
      const from: Pt = [actor.x, actor.y];
      const target: Pt = [this.lia.x - (18 + index++ * 18), this.lia.y + 8];
      let goal: Pt = walkable(...target) ? target : [this.lia.x, this.lia.y];
      if (!clearWalkingLine(from, goal, walkable)) {
        let route = this.followerRoutes.get(definition.id);
        if (!route || Math.hypot(route.goal[0] - goal[0], route.goal[1] - goal[1]) > 14 || !route.points.length) {
          route = { goal, points: findWalkingPath(from, goal, walkable, 0) }; this.followerRoutes.set(definition.id, route);
        }
        while (route.points.length && Math.hypot(actor.x - route.points[0][0], actor.y - route.points[0][1]) < 1) route.points.shift();
        goal = route.points[0] ?? from;
      } else this.followerRoutes.delete(definition.id);
      const distance = Math.hypot(goal[0] - actor.x, goal[1] - actor.y);
      const step = Math.min(distance, 85 * Math.min(dt, 50) / 1000);
      if (distance > 1) {
        const next: Pt = [actor.x + (goal[0] - actor.x) / distance * step, actor.y + (goal[1] - actor.y) / distance * step];
        if (clearWalkingLine(from, next, walkable)) actor.setPosition(...next);
      }
      const dx = actor.x - from[0], dy = actor.y - from[1];
      const moved = Math.hypot(dx, dy) > 0.05;
      const facing = moved ? Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'e' : 'w' : dy > 0 ? 's' : 'n' : this.actorFacing.get(definition.id) ?? 's';
      this.actorFacing.set(definition.id, facing);
      const animation = `${definition.texture.replace(/-walk$/, '')}-${moved ? 'walk' : 'idle'}-${facing}`;
      if (this.anims.exists(animation)) actor.play(animation, true);
      actor.setDepth(actor.y);
    }
    this.areaRoot.sort('depth');
  }

  private publishSnapshot() {
    const flags = state(this.registry).flags;
    this.data.set('story:continuation', {
      chapter: this.chapter.id, talking: this.talking, conversationActive: this.talking && !this.ended && !this.activeChallenge, currentAction: this.currentAction ?? null, challenge: this.activeChallenge ?? null, sequence: this.conversation?.snapshot ?? null,
      actions: this.chapter.actions.map(action => ({ id: action.id, at: action.at, radius: action.radius, flag: action.completionFlag, challenge: action.challenge?.kind ?? null, available: actionAvailable(flags, action), complete: actionComplete(flags, action) })),
      exit: { at: this.chapter.exit.at, radius: this.chapter.exit.radius, available: chapterExitAvailable(flags, this.chapter), to: this.chapter.exit.to },
      actors: this.chapter.actors.map(actor => { const sprite = this.chapterActors.get(actor.id); return { id: actor.id, texture: sprite?.texture.key ?? actor.texture, visible: sprite?.visible ?? false, at: sprite ? [sprite.x, sprite.y] : actor.at, frame: sprite?.frame.name, angle: sprite?.angle ?? 0, bound: this.boundActors.has(actor.id) }; }), ended: this.ended,
    });
  }

  private updateWeather(dt: number) {
    if (!this.weather) return;
    this.weather.clear();
    if (this.chapter.atmosphere === 'night') this.weather.fillStyle(0x10223f, 0.14).fillRect(0, 0, 640, 360);
    if (!ambientPrefs().particles || !['rain', 'wind'].includes(this.chapter.atmosphere ?? '')) return;
    this.weatherTime += Math.min(dt, 50);
    const rain = this.chapter.atmosphere === 'rain';
    this.weather.lineStyle(1, rain ? 0xabcde0 : 0xd3dbc4, rain ? 0.32 : 0.2);
    for (let i = 0; i < (rain ? 54 : 18); i++) {
      const x = (i * 113 + this.weatherTime * (rain ? -0.045 : 0.06) + 100000) % 660 - 10;
      const y = (i * 71 + this.weatherTime * (rain ? 0.18 : 0.012)) % 380 - 10;
      this.weather.beginPath().moveTo(x, y).lineTo(x + (rain ? -4 : 15), y + (rain ? 13 : 2)).strokePath();
    }
  }
}
