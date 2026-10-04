import Phaser from 'phaser';
import { StoryScene } from "../StoryScene";
import { ROAD_EAST_AREA, FIRST_CAMP_AREA } from "../../../content/areas/journey";
import { FIELD_RETURN } from "../../../app/travel";
import { state } from "../../../platform/campaignRegistry";
import { getSettings, motionDuration, subscribeSettings } from "../../../app/settings";
import { FONT } from "../Hud";
import { setSceneMusic } from "../../../app/audio";
import { liaCloakOnGround } from "../../../modules/party/appearance";
import { STAR_REFLECTION_BEATS } from "../../../content/chapters/firstJourney/starReflection";
import { createFireMinigame, fireHitBand, fireMarkerPosition, strokeFireMinigame, tickFireMinigame, type FireMinigameState } from "../../../modules/camp/fireMinigame";
import { FireMinigameUI } from "../FireMinigameUI";
import { executeCampAction, campActionRejection, campStep, canUseCampSpot, restoreCamp } from "../../../modules/camp/progression";
import { setCampaignFlag } from "../../../modules/campaign/commands";
import { prepareCampaignCheckpoint } from "../../../modules/campaign/checkpoints";
import { campStepDefinition, campSpotDisabledHint, type CampStep } from "../../../content/chapters/firstJourney/camp";
import { CAMP_OBSERVATION_BEATS, CAMP_INTRODUCTION_BEATS, JOURNEY_TEXT, type JourneyBeat } from "../../../content/chapters/firstJourney/dialogue";
import { sceneInput, type SceneInputScope } from "../../../platform/input/router";
import { Dialogue } from "../Dialogue";
import { CAMP_DIALOGUE_BEATS, CAMP_DIALOGUE_CHOICES, CAMP_DIALOGUE_PROMPT, CAMP_DIALOGUE_TUTORIAL, campDialogueBranch, type CampDialogueChoiceId } from "../../../content/chapters/firstJourney/campDialogue";

/** Roman S. 22–32: one day on the road and one uneasy night in company. */
export class JourneyScene extends StoryScene {
  private campRestPending = false;
  private get campStep(): CampStep { return this.campRestPending ? 'waking' : campStep(state(this.registry)); }
  private inCamp = false;
  private conversation = 0;
  private foltan?: Phaser.GameObjects.Sprite;
  private azar?: Phaser.GameObjects.Sprite;
  private foltanShadow?: Phaser.GameObjects.Image;
  private azarShadow?: Phaser.GameObjects.Image;
  private cloak?: Phaser.GameObjects.Image;
  private blanket?: Phaser.GameObjects.Image;
  private flame?: Phaser.GameObjects.Image;
  private fireRing?: Phaser.GameObjects.Image;
  private campLogs?: Phaser.GameObjects.Image;
  private campStones?: Phaser.GameObjects.Image;
  private campTwigs?: Phaser.GameObjects.Image;
  private campBackground?: Phaser.GameObjects.Image;
  private fireGame?: FireMinigameState;
  private fireUI?: FireMinigameUI;
  private fireCompletionTimer?: Phaser.Time.TimerEvent;
  private fireBusy = false;
  private fireEHeld = false;
  private fireEscapeHeld = false;
  private fireStrokeCooldown = 0;
  private fireFeedback = 'Sechs ruhige Schläge lassen Glut entstehen.';
  private readonly onFireKeyDown = () => {
    if (!this.fireBusy || this.fireEHeld) return;
    this.fireEHeld = true; this.fireStroke();
  };
  private readonly onFireKeyUp = () => { this.fireEHeld = false; };
  private readonly onFireEscapeDown = () => {
    if (!this.fireBusy || this.fireEscapeHeld) return;
    this.fireEscapeHeld = true; this.pauseFire();
  };
  private readonly onFireEscapeUp = () => { this.fireEscapeHeld = false; };
  private fireClock = 0;
  private arrivalClock = 0;
  private arrivalActive = false;
  private campDeparturePending = false;
  private campSeatActive = false;
  private campSeatRun = 0;
  private campDialogue?: Dialogue;
  private campMenu?: Phaser.GameObjects.Container;
  private campConversationActive = false;
  private campConversationBindings?: () => void;
  private campConversationControls?: ReturnType<SceneInputScope['setControls']>;
  private campMenuBindings?: () => void;
  private campMenuControls?: () => void;
  private fireBindings?: () => void;
  private fireControls?: () => void;
  private fireInputLock?: () => void;
  private campConversationInputLock?: () => void;
  private star?: Phaser.GameObjects.Graphics;
  private starReflectionRun = 0;
  private starReflectionIndex = -1;

  constructor() { super('journey'); }

  create(data: { from?: string } = {}) {
    this.inCamp = false; this.campRestPending = false; this.conversation = 0;
    this.foltan = undefined; this.azar = undefined; this.cloak = undefined;
    this.blanket = undefined; this.flame = undefined; this.fireRing = undefined; this.campLogs = undefined;
    this.campStones = undefined; this.campTwigs = undefined; this.campBackground = undefined;
    this.arrivalClock = 0; this.arrivalActive = false; this.campDeparturePending = false;
    this.campSeatActive = false; this.campSeatRun++;
    this.campDialogue = undefined; this.campMenu = undefined; this.campConversationActive = false;
    this.campConversationBindings = undefined; this.campConversationControls = undefined; this.campMenuBindings = undefined; this.campMenuControls = undefined;
    this.data.set({ 'story:camp-seated': false, 'story:camp-dialogue': { active: false, choices: [] } });
    this.star = undefined; this.starReflectionIndex = -1; this.starReflectionRun++;
    this.data.set('story:star-reflection', { active: false, index: -1, step: '' });
    this.data.set({ 'story:camp-arrival': '', 'mobile:controls': null });
    this.fireCompletionTimer?.remove(); this.fireCompletionTimer = undefined;
    this.fireUI?.destroy(); this.fireUI = undefined; this.fireGame = undefined;
    this.fireBusy = false; this.fireEHeld = false; this.fireEscapeHeld = false; this.fireStrokeCooldown = 0; this.fireClock = 0;
    this.data.set('story:fire-minigame', { active: false });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.detachFireKeys();
      this.fireCompletionTimer?.remove(); this.fireCompletionTimer = undefined;
      this.fireUI?.destroy(); this.fireUI = undefined; this.fireGame = undefined; this.fireBusy = false;
      this.data.set('story:fire-minigame', { active: false });
      this.arrivalActive = false;
      this.campSeatActive = false; this.campSeatRun++;
      this.closeCampConversation(true);
      this.starReflectionIndex = -1; this.starReflectionRun++;
    });
    const st = state(this.registry);
    // Scene links are a development entry, never a second grant after departure.
    if (new URLSearchParams(window.location.search).get('scene') === 'journey' && !st.flags.departureReady) {
      prepareCampaignCheckpoint(st, 'road');
    }
    if (data.from !== 'felder' && (st.flags.journeyCampReached || st.flags.firstCampRested || st.flags.metFoltanAzar)) {
      this.begin(FIRST_CAMP_AREA);
      this.setupCamp(false);
      if (st.flags.metFoltanAzar) {
        setSceneMusic(this, 'refuge');
        this.addStrangers(true);
        this.drawStar();
      } else if (st.flags.firstCampRested) {
        this.wakeEncounter();
        return;
      }
      this.campSpots();
    } else {
      this.begin(ROAD_EAST_AREA);
      this.roadSpots();
      this.sayJourneyBeat(JOURNEY_TEXT.roadArrival, 2600);
      this.passingTravelers();
    }
  }

  private sayJourneyBeat(beat: JourneyBeat, duration: number) {
    this.data.set('story:journey-beat', beat.id);
    this.say(beat.line, duration);
  }

  private setJourneyCloseupBeat(beat: JourneyBeat) {
    this.data.set('story:journey-beat', beat.id);
    this.setCloseupText(beat.line);
  }

  private roadSpots() {
    const flags = state(this.registry).flags;
    this.setObjective(!flags.streamVisited ? 'Am Bach trinken und Wasser nachfüllen.' : !flags.journeyEastChosen ? 'Die Weggabelung ansehen.' : 'Nach Osten bis zum Wald gehen.');
    this.setSpots(ROAD_EAST_AREA.targets.map(target => ({
      ...target,
      markerVisible: () => target.id === 'stream' ? !flags.streamVisited : target.id === 'fork' ? !flags.journeyEastChosen : true,
      enabled: () => target.id === 'farm-return' || target.id === 'stream' || (target.id === 'fork' && !!flags.streamVisited) || (target.id === 'east' && !!flags.journeyEastChosen),
      onUse: () => {
        if (target.id === 'farm-return') {
          this.scene.start('world', FIELD_RETURN);
          return;
        } else if (target.id === 'stream') {
          if (!setCampaignFlag(state(this.registry), 'streamVisited')) return;
          this.sayJourneyBeat(JOURNEY_TEXT.streamDrink, 2200);
        } else if (target.id === 'fork') {
          if (!flags.streamVisited || !setCampaignFlag(state(this.registry), 'journeyEastChosen')) return;
          this.sayJourneyBeat(JOURNEY_TEXT.eastFork, 3300);
        } else {
          this.requestCampArrival(); return;
        }
        this.roadSpots();
      },
    })));
  }

  /** Anonymous travelers have their own authored atlas, never a named actor frame. */
  private passingTravelers() {
    if (!this.textures.exists('road-travelers')) return;
    // The traveler atlas faces right; Trapas lies west (decreasing x).
    const walkingSheet = this.textures.exists('road-travelers-walk') ? 'road-travelers-walk' : 'road-travelers';
    const troupeFrame = walkingSheet === 'road-travelers-walk' ? 4 : 1;
    const wagon = this.add.sprite(515, 193, walkingSheet, 0).setFlipX(true).setOrigin(0.5, 60 / 64).setDepth(193);
    const troupe = this.add.sprite(580, 199, walkingSheet, troupeFrame).setFlipX(true).setOrigin(0.5, 60 / 64).setDepth(199);
    this.areaRoot.add([wagon, troupe]);
    const tag = this.add.text(565, 219, 'Gaukler · nach Trapas zum Verbannungsfest', {
      fontFamily: FONT, fontSize: '8px', color: '#ddd1ad', stroke: '#252722', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(270);
    this.areaRoot.add(tag);
    if (getSettings().reducedMotion) { wagon.x = 110; troupe.x = 80; tag.x = 230; return; }
    const travelers = [
      { sprite: wagon, animation: 'road-wagon-walk', idle: 0 },
      { sprite: troupe, animation: 'road-troupe-walk', idle: troupeFrame },
    ];
    const idle = (traveler: typeof travelers[number]) => {
      traveler.sprite.anims.stop();
      traveler.sprite.setTexture(walkingSheet, traveler.idle);
    };
    const walk = (traveler: typeof travelers[number]) => {
      if (this.anims.exists(traveler.animation)) traveler.sprite.play(traveler.animation, true);
    };
    travelers.forEach(walk);
    const movement = [
      ...travelers.map((traveler, i) => this.tweens.add({
        targets: traveler.sprite, x: -65, duration: i ? 16000 : 13000,
        onStop: () => idle(traveler),
        onComplete: () => { idle(traveler); traveler.sprite.destroy(); },
      })),
      this.tweens.add({ targets: tag, alpha: 0, delay: 4300, duration: 700, onComplete: () => tag.destroy() }),
    ];
    const unsubscribe = subscribeSettings(settings => {
      for (const tween of movement) {
        if (tween.isDestroyed() || tween.isPendingRemove()) continue;
        if (settings.reducedMotion) tween.pause(); else tween.resume();
      }
      for (let i = 0; i < travelers.length; i++) {
        const traveler = travelers[i], tween = movement[i];
        if (!traveler.sprite.active || tween.isDestroyed() || tween.isPendingRemove()) continue;
        if (settings.reducedMotion) idle(traveler); else walk(traveler);
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }

  private requestCampArrival() {
    if (this.campDeparturePending || this.inCamp) return;
    this.campDeparturePending = true;
    this.setLocked(true);
    this.setJourneyCloseupBeat(JOURNEY_TEXT.eveningArrival);
    let continued = false;
    this.setCloseupContinue(() => {
      if (continued) return;
      continued = true;
      this.hideCloseup();
      const veil = this.add.rectangle(320, 180, 640, 360, 0x000000).setDepth(2000).setScrollFactor(0).setAlpha(0);
      this.tweens.add({
        targets: veil, alpha: 1, duration: motionDuration(300),
        onComplete: () => {
          this.enterCamp();
          this.tweens.add({ targets: veil, alpha: 0, duration: motionDuration(300), onComplete: () => veil.destroy() });
        },
      });
    }, 'Im Wald ein Lager suchen');
  }

  private enterCamp() {
    const world = state(this.registry);
    if (!world.flags.journeyEastChosen || !setCampaignFlag(world, 'journeyCampReached')) return;
    this.changeArea(FIRST_CAMP_AREA);
    this.setupCamp(true);
    this.setLocked(true);
    this.sayJourneyBeat(JOURNEY_TEXT.campClearing, 4800);
    const snag = this.add.graphics().setDepth(288);
    snag.lineStyle(2, 0x73544a).lineBetween(525, 277, 541, 264);
    this.areaRoot.add(snag);
    this.time.delayedCall(900, () => { snag.destroy(); this.setLocked(false); this.campSpots(); });
  }

  private setupCamp(fresh: boolean) {
    this.inCamp = true;
    const flags = state(this.registry).flags;
    // Existing saves with a lit fire already have a constructed fireplace.
    restoreCamp(state(this.registry));
    this.campBackground = this.areaRoot.list[0] as Phaser.GameObjects.Image;
    if (flags.firstCampRested && this.textures.exists('bg-first-camp-night')) this.campBackground.setTexture('bg-first-camp-night');
    this.data.set('story:camp-time', flags.firstCampRested ? 'night' : 'dusk');
    this.cloak = this.add.image(233, 260, 'camp-cloak-detailed').setDepth(245).setVisible(liaCloakOnGround(flags));
    this.blanket = this.add.image(233, 254, 'camp-blanket-detailed').setDepth(270).setVisible(false);
    this.campStones = this.add.image(155, 235, 'camp-stones-detailed').setDepth(232).setVisible(!flags.journeyStonesGathered);
    this.campTwigs = this.add.image(409, 251, 'camp-twigs-detailed').setDepth(251).setVisible(!flags.journeyTwigsGathered);
    this.fireRing = this.add.image(317, 225, 'camp-fire-ring-detailed').setDepth(229).setVisible(!!flags.journeyFirepitBuilt);
    this.campLogs = this.add.image(317, 225, 'camp-logs-detailed').setDepth(229.5).setVisible(!!flags.campfireLit);
    this.flame = this.add.image(317, 225, 'camp-fire-detailed').setOrigin(0.5, 1).setDepth(230).setVisible(!!flags.campfireLit);
    this.areaRoot.add([this.cloak, this.blanket, this.campStones, this.campTwigs, this.fireRing, this.campLogs, this.flame]);
    this.drawFire();
  }

  private campSpots() {
    const definition = campStepDefinition(this.campStep);
    this.setObjective(definition.objective);
    this.inventory?.setItemActions(this.campStep === 'meal' && state(this.registry).flags.campfireLit
      ? [{ item: 'proviant', label: 'Essen', onUse: () => this.eatCampProviant() }] : [],
      this.campStep === 'meal' ? 'Wähle Reiseproviant und dann Essen.' : '');
    const flags = state(this.registry).flags;
    const social = ['foltan', 'azar'];
    this.setSpots(FIRST_CAMP_AREA.targets.map(target => ({
      ...target,
      markerWhenDisabled: true,
      markerVisible: () => this.campStep !== 'waking' && (!social.includes(target.id) || !!flags.metFoltanAzar)
        && (target.id !== 'stones' || !flags.journeyStonesGathered) && (target.id !== 'twigs' || !flags.journeyTwigsGathered),
      disabledHint: () => campSpotDisabledHint(target.id, this.campStep),
      label: target.id === 'bedroll' && flags.metFoltanAzar ? 'Bis zum Morgen schlafen'
        : target.id === 'fire-seat' ? flags.campfireLit ? 'Ans Feuer setzen / aufstehen' : 'Sitzplatz (erst Feuer entzünden)'
        : target.id === 'star' && !flags.metFoltanAzar ? 'Westlicher Himmel (später ansehen)'
        : target.id === 'fire' && flags.campfireLit && this.campStep !== 'meal' ? 'Glut ansehen'
        : target.id === definition.requiredSpot ? definition.label ?? target.label : target.label,
      enabled: () => this.canUseCampSpot(target.id),
      onUse: () => this.useCampSpot(target.id),
    })));
  }

  private canUseCampSpot(id: string): boolean {
    if (this.fireBusy || this.campStep === 'waking' || this.campConversationActive || this.starReflectionIndex >= 0) return false;
    return canUseCampSpot(state(this.registry), id, campStepDefinition(this.campStep));
  }

  private useCampSpot(id: string) {
    const { flags, inv } = state(this.registry);
    if (!this.canUseCampSpot(id)) return;
    if (id === 'fire-seat') { this.toggleCampSeat(); return; }
    if (this.campSeatActive) this.standFromFire(false);
    if (id === 'foltan') { this.openCampConversation(); return; }
    if (id === 'azar') { this.snoreAzar(); return; }
    if (id === 'road') { this.sayJourneyBeat(JOURNEY_TEXT.stayInCamp, 2600); return; }
    if (id === 'star') { this.beginStarReflection(); return; }
    if (id === 'bedroll' && (flags.metFoltanAzar)) {
      const recovery = executeCampAction(state(this.registry), 'recover-cloak');
      if (!recovery.accepted && recovery.reason !== 'already-complete') return;
      this.cloak?.setVisible(false); this.blanket?.setVisible(false);
      this.setLiaPose(null);
      this.goTo('companions-road'); return;
    }
    if (id === 'fire' && flags.campfireLit && this.campStep !== 'meal') {
      this.sayJourneyBeat(JOURNEY_TEXT.warmEmbers, 2600); return;
    }
    switch (this.campStep) {
      case 'cloak':
        if (!inv.reisezeug) { this.sayJourneyBeat(JOURNEY_TEXT.missingCloak, 2100); return; }
        if (!executeCampAction(state(this.registry), 'spread-cloak').accepted) return;
        this.cloak?.setVisible(true); this.setLiaPose(null);
        this.sayJourneyBeat(JOURNEY_TEXT.cloakSpread, 2800); break;
      case 'stones':
        if (!executeCampAction(state(this.registry), 'gather-stones').accepted) return;
        this.campStones?.setVisible(false);
        this.sayJourneyBeat(JOURNEY_TEXT.stonesGathered, 3200); break;
      case 'ring':
        if ((inv.steine ?? 0) < 6) { this.sayJourneyBeat(JOURNEY_TEXT.missingStones, 2400); return; }
        if (!executeCampAction(state(this.registry), 'build-firepit').accepted) return;
        this.drawFire();
        this.sayJourneyBeat(JOURNEY_TEXT.firepitBuilt, 2400); break;
      case 'twigs':
        if (!executeCampAction(state(this.registry), 'gather-twigs').accepted) return;
        this.campTwigs?.setVisible(false);
        this.sayJourneyBeat(JOURNEY_TEXT.twigsGathered, 3200); break;
      case 'fire': this.lightFire(); return;
      case 'meal':
        this.sayJourneyBeat(inv.proviant ? JOURNEY_TEXT.openProvisions : JOURNEY_TEXT.missingProvisions, 3000);
        this.inventory?.toggle(); return;
      case 'sleep': this.sleep(); return;
      case 'star':
        this.beginStarReflection(); return;
      default: return;
    }
    this.campSpots();
  }

  private lightFire() {
    if (this.fireBusy) return;
    const world = state(this.registry);
    if (world.flags.campfireLit) return;
    if (campActionRejection(world, 'light-fire')) { this.sayJourneyBeat(JOURNEY_TEXT.needFireMaterials, 2400); return; }
    this.fireGame ??= createFireMinigame(getSettings().reducedMotion);
    this.fireBusy = true;
    const input = sceneInput(this);
    // Changing control ownership releases the opening press before any stroke.
    this.fireEHeld = input.isHeld('interact');
    this.fireEscapeHeld = input.isHeld('cancel');
    this.fireBindings = input.bind({
      interact: intent => {
        if (intent.phase === 'end') this.onFireKeyUp();
        else if (intent.phase === 'activate') this.fireStroke();
        else this.onFireKeyDown();
      },
      cancel: intent => { if (intent.phase === 'end') this.onFireEscapeUp(); else this.onFireEscapeDown(); },
    }, 120);
    this.fireStrokeCooldown = 0;
    this.inventory.close(); this.say('', 0);
    this.setLocked(true); this.setCinematic(true); this.campSpots();
    this.fireInputLock = input.lock({ priority: 120, allow: ['interact', 'cancel', 'settings'] });
    this.fireControls = input.setControls({ directions: [], actions: { E: 'Holz bohren', ESC: 'Pause' }, inventory: false }, { priority: 120 });
    this.fireUI = new FireMinigameUI(this,
      () => input.dispatch({ action: 'interact', phase: 'activate', source: 'pointer' }),
      () => input.dispatch({ action: 'cancel', phase: 'activate', source: 'pointer' }));
    this.fireUI.update(this.fireGame);
    this.publishFireState();
  }

  private fireStroke() {
    if (!this.fireBusy || !this.fireGame || this.fireGame.finished || this.fireStrokeCooldown > 0) return;
    this.fireStrokeCooldown = 400;
    const result = strokeFireMinigame(this.fireGame);
    this.fireFeedback = result === 'miss' ? 'Etwas ruhiger. Warte auf das grüne Feld.' : result === 'complete' ? 'Die Zweige fangen Feuer.' : 'Gut! Der Zunder wird wärmer.';
    this.fireUI?.result(result); this.fireUI?.update(this.fireGame);
    this.publishFireState();
    if (result !== 'complete') return;
    const st = state(this.registry);
    // Only a finished fire consumes gathered wood. Pausing leaves it in the bag.
    const completion = executeCampAction(st, 'light-fire');
    if (!completion.accepted) { this.closeFireUI(); this.fireGame = undefined; this.campSpots(); return; }
    this.drawFire();
    // Keep the ignition visible before returning the player's controls to camp.
    const completedGame = this.fireGame;
    this.fireCompletionTimer = this.time.delayedCall(700, () => {
      if (!this.fireBusy || this.fireGame !== completedGame) return;
      this.fireCompletionTimer = undefined;
      this.closeFireUI(); this.fireGame = undefined;
      this.campSpots(); this.sayJourneyBeat(JOURNEY_TEXT.fireLit, 2400);
    });
  }

  private pauseFire() {
    if (!this.fireBusy || this.fireGame?.finished) return;
    this.closeFireUI(); this.campSpots();
    this.sayJourneyBeat(JOURNEY_TEXT.firePause, 2400);
  }

  private closeFireUI() {
    this.fireCompletionTimer?.remove(); this.fireCompletionTimer = undefined;
    this.fireBusy = false; this.detachFireKeys();
    this.fireUI?.destroy(); this.fireUI = undefined;
    this.data.set('mobile:controls', null); this.data.set('mobile:thought', '');
    this.setCinematic(false); this.setLocked(false);
    this.publishFireState();
  }

  private detachFireKeys() {
    this.fireBindings?.(); this.fireBindings = undefined;
    this.fireInputLock?.(); this.fireInputLock = undefined;
    this.fireControls?.(); this.fireControls = undefined;
    this.fireEHeld = false; this.fireEscapeHeld = false;
  }

  private publishFireState() {
    const game = this.fireGame;
    if (this.fireBusy && game) {
      const instruction = game.reducedMotion ? 'Tippe in Ruhe einzeln auf Holz bohren.' : 'Tippe auf Holz bohren, wenn der Strich im grünen Feld steht.';
      this.data.set('mobile:thought', `Feuerbohren: ${instruction} Glut: ${game.heat} / 6. ${this.fireFeedback}`);
    }
    this.data.set('story:fire-minigame', game ? {
      active: this.fireBusy, heat: game.heat, hits: game.hits, misses: game.misses,
      marker: fireMarkerPosition(game), band: fireHitBand(game),
      reducedMotion: game.reducedMotion, ready: !game.finished && this.fireStrokeCooldown <= 0,
    } : { active: false });
  }

  private updateFire(delta: number) {
    if (!this.fireBusy || !this.fireGame) return;
    this.fireGame.reducedMotion = getSettings().reducedMotion;
    tickFireMinigame(this.fireGame, Math.min(delta, 100));
    this.fireStrokeCooldown = Math.max(0, this.fireStrokeCooldown - Math.min(delta, 100));
    if (this.fireBusy) { this.fireUI?.update(this.fireGame); this.publishFireState(); }
  }

  private drawFire() {
    if (!this.flame) return;
    const flags = state(this.registry).flags;
    this.fireRing?.setVisible(!!flags.journeyFirepitBuilt);
    this.campLogs?.setVisible(!!flags.campfireLit);
    this.flame.setVisible(!!flags.campfireLit);
    if (!flags.campfireLit) return;
    const embers = flags.firstCampRested && !flags.metFoltanAzar;
    const flicker = getSettings().reducedMotion ? 0 : Math.sin(this.fireClock / 83) * 0.065 + Math.sin(this.fireClock / 137) * 0.035;
    this.flame.setScale(1 - flicker / 2, (embers ? 0.25 : 0.94) + flicker)
      .setAlpha(embers ? 0.48 : 0.94 + flicker / 2);
  }

  private sleep() {
    if (!state(this.registry).flags.journeyAte) {
      this.sayJourneyBeat(JOURNEY_TEXT.eatBeforeSleep, 2800);
      this.campSpots(); return;
    }
    if (campActionRejection(state(this.registry), 'rest')) return;
    this.campRestPending = true; this.campSpots(); this.setLocked(true);
    this.lia.setPosition(233, 260).setDepth(260); this.blanket?.setVisible(true);
    this.setLiaPose('lia-sleep');
    this.sayJourneyBeat(JOURNEY_TEXT.lieDown, 2100);
    this.time.delayedCall(1500, () => {
      const result = executeCampAction(state(this.registry), 'rest');
      this.campRestPending = false;
      if (!result.accepted) { this.setLocked(false); this.campSpots(); return; }
      this.data.set('story:camp-time', 'night');
      if (this.textures.exists('bg-first-camp-night')) this.campBackground?.setTexture('bg-first-camp-night');
      this.sayJourneyBeat(JOURNEY_TEXT.nightfall, 2700);
      this.time.delayedCall(2700, () => this.wakeEncounter());
    });
  }

  private eatCampProviant(): boolean {
    if (this.campStep !== 'meal' || !this.inCamp) return false;
    const world = state(this.registry);
    const result = executeCampAction(world, 'eat');
    if (!result.accepted) {
      if (result.reason === 'no-provisions') this.sayJourneyBeat(JOURNEY_TEXT.missingProvisions, 2800);
      return false;
    }
    this.inventory.refresh(world.inv);
    this.inventory.close();
    this.sayJourneyBeat(JOURNEY_TEXT.mealEaten, 3400);
    this.campSpots();
    return true;
  }

  private toggleCampSeat() {
    if (this.campSeatActive) { this.standFromFire(); return; }
    const run = ++this.campSeatRun;
    this.campSeatActive = true;
    this.data.set('story:camp-seated', true);
    this.lia.setPosition(288, 250).setDepth(250);
    this.setLiaPose('lia-camp-sit-down');
    this.sayJourneyBeat(JOURNEY_TEXT.sitByFire, 3300);
    this.time.delayedCall(motionDuration(400), () => {
      if (this.campSeatActive && run === this.campSeatRun) this.setLiaPose('lia-camp-sit');
    });
    this.campSpots();
  }

  private standFromFire(animated = true) {
    if (!this.campSeatActive) return;
    this.campSeatActive = false;
    const run = ++this.campSeatRun;
    this.data.set('story:camp-seated', false);
    if (animated) {
      this.setLiaPose('lia-camp-stand-up');
      this.time.delayedCall(motionDuration(200), () => {
        if (!this.campSeatActive && run === this.campSeatRun) this.setLiaPose(null);
      });
    } else this.setLiaPose(null);
    // Pointer walking already has a route; keep it while the sitting pose ends.
    if (animated) this.campSpots();
  }

  private snoreAzar() {
    if (!this.azar?.active) return;
    const snore = this.add.text(this.azar.x, this.azar.y - 31, 'Zzzzz', {
      fontFamily: FONT, fontSize: '13px', color: '#eee4c9', stroke: '#17221e', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(880);
    this.areaRoot.add(snore);
    this.time.delayedCall(2200, () => snore.destroy());
    this.sayJourneyBeat(JOURNEY_TEXT.azarSleeping, 2100);
  }

  private openCampConversation() {
    if (this.campConversationActive) return;
    this.campConversationActive = true;
    this.inventory.close(); this.inventory.setVisible(false); this.setLocked(true); this.setCinematic(true);
    this.campSpots();
    this.campDialogue ??= new Dialogue(this, { manageControls: false });
    const input = sceneInput(this);
    this.campConversationBindings = input.bind({
      continue: intent => { if (intent.phase !== 'end') this.campDialogue?.advance(); },
      interact: intent => { if (intent.phase !== 'end') this.campDialogue?.advance(); },
      cancel: intent => { if (intent.phase !== 'end') this.closeCampConversation(); },
    }, 120);
    this.campDialogue.setText(CAMP_DIALOGUE_PROMPT);
    this.campDialogue.setContinue(() => this.showCampConversationMenu(), 'Gesprächsthema wählen');
    this.campConversationInputLock = input.lock({ priority: 120, allow: ['continue', 'interact', 'cancel', 'beam', 'wave', 'wait', 'confirm', 'settings'] });
    this.campConversationControls = input.setControls({ directions: [], actions: { E: 'Gesprächsthema wählen', ESC: 'Zurück' }, bindings: { E: 'continue' }, inventory: false }, { priority: 120 });
    this.data.set('story:camp-dialogue', { active: true, stage: 'intro', choices: [] });
  }

  private clearCampMenu() {
    this.campMenuBindings?.(); this.campMenuBindings = undefined;
    this.campMenuControls?.(); this.campMenuControls = undefined;
    this.campMenu?.destroy(); this.campMenu = undefined;
  }

  private showCampConversationMenu() {
    if (!this.campConversationActive) return;
    this.campDialogue?.hide(); this.clearCampMenu();
    const panel = this.add.rectangle(320, 196, 404, 216, 0x101b17, 0.98).setStrokeStyle(2, 0xafa083);
    const title = this.add.text(142, 106, 'Gespräch mit Foltan', { fontFamily: FONT, fontSize: '19px', color: '#f4e5bd' });
    const hint = this.add.text(142, 131, CAMP_DIALOGUE_TUTORIAL, { fontFamily: FONT, fontSize: '12px', color: '#d5c9b3', wordWrap: { width: 356 } });
    const controls = ['Q', 'R', 'SPACE', 'ESC'] as const;
    const input = sceneInput(this);
    const choose = (choice: CampDialogueChoiceId) => (intent: { phase: string }) => { if (intent.phase !== 'end') this.chooseCampConversation(choice); };
    this.campMenuBindings = input.bind({
      beam: choose('kyra'), wave: choose('road'), wait: choose('watch'),
      confirm: intent => { if (intent.phase !== 'end' && CAMP_DIALOGUE_CHOICES.some(choice => choice.id === intent.value)) this.chooseCampConversation(intent.value as CampDialogueChoiceId); },
    }, 130);
    const children: Phaser.GameObjects.GameObject[] = [panel, title, hint];
    CAMP_DIALOGUE_CHOICES.forEach((choice, index) => {
      const rowY = 182 + index * 30;
      const row = this.add.rectangle(320, rowY, 360, 25, 0x233229, 0.95).setStrokeStyle(1, 0x655e4c).setInteractive({ useHandCursor: true });
      const keyName = controls[index];
      const shortcut = keyName === 'SPACE' ? 'Leertaste' : keyName === 'ESC' ? 'Esc' : keyName;
      const label = this.add.text(152, rowY, `${choice.label}  [${shortcut}]`, { fontFamily: FONT, fontSize: '15px', color: '#f4ecd8' }).setOrigin(0, 0.5);
      row.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation(); input.dispatch({ action: 'confirm', phase: 'activate', source: 'pointer', value: choice.id });
      });
      children.push(row, label);
    });
    this.campMenu = this.add.container(0, 0, children).setDepth(1200).setScrollFactor(0);
    this.data.set('story:camp-dialogue', { active: true, stage: 'menu', choices: CAMP_DIALOGUE_CHOICES.map(choice => choice.id) });
    this.campMenuControls = input.setControls({ directions: [], actions: { Q: 'Über Kyra', R: 'Über den Weg', SPACE: 'Über die Wache', ESC: 'Zurück' }, inventory: false }, { priority: 130 });
  }

  private chooseCampConversation(choice: CampDialogueChoiceId) {
    if (!this.campConversationActive) return;
    if (choice === 'back') { this.closeCampConversation(); return; }
    this.clearCampMenu();
    const lines = campDialogueBranch(choice);
    this.data.set('story:camp-dialogue', { active: true, stage: choice, choices: [] });
    const showLine = (index: number) => {
      if (!this.campConversationActive) return;
      this.data.set('story:journey-beat', CAMP_DIALOGUE_BEATS[choice][index].id);
      this.campDialogue!.setText(lines[index]);
      this.campDialogue!.setContinue(() => index + 1 < lines.length ? showLine(index + 1) : this.showCampConversationMenu(), index + 1 < lines.length ? 'Weiter' : 'Weitere Frage');
    };
    this.campConversationControls?.update({ directions: [], actions: { E: 'Weiter', ESC: 'Zurück' }, bindings: { E: 'continue' }, inventory: false });
    showLine(0);
  }

  private closeCampConversation(shutdown = false) {
    if (!this.campConversationActive) return;
    this.campConversationActive = false;
    this.clearCampMenu(); this.campDialogue?.hide();
    this.campConversationBindings?.(); this.campConversationBindings = undefined;
    this.campConversationInputLock?.(); this.campConversationInputLock = undefined;
    this.campConversationControls?.(); this.campConversationControls = undefined;
    this.data.set('story:camp-dialogue', { active: false, choices: [] });
    this.data.set('mobile:controls', null);
    if (shutdown) return;
    this.setLocked(false); this.setCinematic(false); this.inventory.setVisible(true); this.campSpots();
  }

  private addStrangers(introduced = false, arriving = false) {
    // The same directional companions walk into camp and follow Lia next day.
    const create = (name: 'foltan' | 'azar', [x, y]: [number, number]) => {
      const shadow = this.add.image(x, y - 1, 'shadow').setDepth(y - 1);
      const sprite = this.add.sprite(x, y, `${name}-walk`, 0).setOrigin(0.5, 60 / 64).setDepth(y);
      if (this.anims.exists(`${name}-idle-s`)) sprite.play(`${name}-idle-s`, true);
      this.areaRoot.add([shadow, sprite]);
      return { sprite, shadow };
    };
    const foltan = create('foltan', introduced ? [355, 231] : arriving ? [545, 282] : [259, 245]);
    const azar = create('azar', introduced ? [397, 265] : arriving ? [563, 296] : [295, 242]);
    this.foltan = foltan.sprite; this.foltanShadow = foltan.shadow;
    this.azar = azar.sprite; this.azarShadow = azar.shadow;
    if (introduced) this.azar.setAngle(82);
    this.areaRoot.sort('depth');
  }

  private wakeEncounter() {
    setSceneMusic(this, 'refuge');
    this.conversation = 0;
    this.campRestPending = false; this.setLocked(true); this.campSpots();
    this.lia.setPosition(233, 260).setDepth(260); this.blanket?.setVisible(true);
    this.setLiaPose('lia-sleep');
    this.addStrangers(false, true); this.drawFire();
    this.say('', 0);
    this.setCinematic(true);
    this.data.set('mobile:controls', { directions: [], actions: {}, inventory: false, disabled: true });
    this.arrivalClock = 0; this.arrivalActive = true;
    this.data.set('story:camp-arrival', 'entering');
  }

  /** Follow the clearing south of the fire; keep the sleeping map visible first. */
  private updateArrival(delta: number) {
    if (!this.arrivalActive) return;
    this.arrivalClock += Math.min(delta, 50);
    const reduced = getSettings().reducedMotion;
    const progress = reduced ? 1 : Math.min(1, this.arrivalClock / 4300);
    const move = (actor: Phaser.GameObjects.Sprite | undefined, shadow: Phaser.GameObjects.Image | undefined, name: 'foltan' | 'azar', points: number[][]) => {
      if (!actor?.active) return;
      const part = progress < 0.58 ? progress / 0.58 : (progress - 0.58) / 0.42;
      const [from, to] = progress < 0.58 ? [points[0], points[1]] : [points[1], points[2]];
      const previous = [actor.x, actor.y];
      actor.setPosition(from[0] + (to[0] - from[0]) * part, from[1] + (to[1] - from[1]) * part)
        .setAngle(0).setDepth(actor.y);
      const dx = actor.x - previous[0], dy = actor.y - previous[1];
      const walking = !reduced && progress < 1 && Math.hypot(dx, dy) > 0.05;
      const facing = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1]) ? to[0] > from[0] ? 'e' : 'w' : to[1] > from[1] ? 's' : 'n';
      const animation = `${name}-${walking ? 'walk' : 'idle'}-${facing}`;
      if (!walking && actor.anims.currentAnim?.key !== animation) actor.anims.stop();
      if (this.anims.exists(animation) && (walking || actor.anims.currentAnim?.key !== animation)) actor.play(animation, true);
      shadow?.setPosition(actor.x, actor.y - 1).setDepth(actor.y - 1);
    };
    move(this.foltan, this.foltanShadow, 'foltan', [[545, 282], [338, 282], [259, 245]]);
    move(this.azar, this.azarShadow, 'azar', [[563, 296], [372, 293], [295, 242]]);
    this.areaRoot.sort('depth');
    if (this.arrivalClock < (reduced ? 650 : 4700)) return;
    this.arrivalActive = false;
    this.data.set('story:camp-arrival', 'observing');
    this.observeSleepingLia();
  }

  private observeSleepingLia() {
    this.data.set('mobile:controls', null);
    this.showCloseup('cinematic-camp-observe');
    const beats = CAMP_OBSERVATION_BEATS;
    const showLine = (index: number) => {
      if (beats[index].cue === 'lia-wakes') {
        this.blanket?.setVisible(false); this.setLiaPose('lia-wake');
        this.showCloseup('cut-camp-wake');
      }
      this.data.set('story:journey-beat', beats[index].id);
      this.setCloseupText(beats[index].line);
      this.setCloseupContinue(() => {
        if (index + 1 < beats.length) showLine(index + 1);
        else this.listen();
      });
    };
    showLine(0);
  }

  private listen() {
    const beats = CAMP_INTRODUCTION_BEATS;
    if (this.conversation === 0) {
      this.setLiaPose(null);
      this.showCloseup('cut-camp-companions');
    }
    if (this.conversation < beats.length) {
      this.data.set('story:journey-beat', beats[this.conversation].id);
      this.setCloseupText(beats[this.conversation++].line);
      this.setCloseupContinue(() => this.listen());
      return;
    }
    this.setJourneyCloseupBeat(JOURNEY_TEXT.companionsSettled);
    this.setCloseupContinue(() => {
      if (!executeCampAction(state(this.registry), 'introduce-companions').accepted) return;
      this.lia.setPosition(454, 210).setDepth(210);
      this.foltan?.setPosition(355, 231).setDepth(231);
      this.azar?.setPosition(397, 265).setDepth(265).setAngle(82);
      this.foltanShadow?.setPosition(355, 230).setDepth(230);
      this.azarShadow?.setPosition(397, 264).setDepth(264);
      this.setLiaPose(null);
      this.hideCloseup(); this.setCinematic(false); this.setLocked(false); this.drawFire(); this.drawStar(); this.campSpots();
    }, 'Lager erkunden');
  }

  private drawStar() {
    if (this.star?.active) return;
    const star = this.star = this.add.graphics().setDepth(50);
    star.fillStyle(0xf3e7b4).fillRect(152, 58, 3, 3);
    star.lineStyle(1, 0xbecdda, 0.7).lineBetween(153, 54, 153, 65).lineBetween(148, 59, 158, 59);
    this.areaRoot.add(star);
  }

  private beginStarReflection() {
    const flags = state(this.registry).flags;
    if (this.starReflectionIndex >= 0 || !flags.metFoltanAzar) return;
    if (flags.criosObserved) { this.sayJourneyBeat(JOURNEY_TEXT.criosSeen, 2800); return; }
    const run = ++this.starReflectionRun;
    this.inventory.close(); this.setLocked(true); this.setCinematic(true);
    this.drawStar();
    this.showCloseup('cut-crios-reflection', { fit: 'contain' });
    const showBeat = (index: number) => {
      if (run !== this.starReflectionRun) return;
      this.starReflectionIndex = index;
      const beat = STAR_REFLECTION_BEATS[index];
      this.data.set('story:star-reflection', { active: true, index, step: beat.id });
      this.setCloseupText(beat.line);
      let consumed = false;
      this.setCloseupContinue(() => {
        if (consumed || run !== this.starReflectionRun || this.starReflectionIndex !== index) return;
        consumed = true;
        if (index + 1 < STAR_REFLECTION_BEATS.length) { showBeat(index + 1); return; }
        if (!executeCampAction(state(this.registry), 'observe-crios').accepted) return;
        this.starReflectionIndex = -1;
        this.data.set('story:star-reflection', { active: false, index, step: 'complete' });
        this.hideCloseup(); this.setCinematic(false); this.setLocked(false); this.campSpots();
      }, beat.label ?? 'Weiter');
    };
    showBeat(0);
  }

  update(time: number, delta: number) {
    const seatedAt = this.campSeatActive ? [this.lia.x, this.lia.y] : undefined;
    super.update(time, delta);
    if (!this.inCamp) return;
    if (seatedAt && (Math.abs(this.lia.x - seatedAt[0]) + Math.abs(this.lia.y - seatedAt[1]) > 0.01)) this.standFromFire(false);
    this.fireClock += delta;
    this.updateArrival(delta);
    this.updateFire(delta);
    this.drawFire();
  }
}
