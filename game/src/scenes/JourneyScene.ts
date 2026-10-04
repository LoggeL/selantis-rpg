import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { ROAD_EAST_AREA, FIRST_CAMP_AREA } from '../story/areas/journey';
import { FIELD_RETURN } from '../story/travel';
import { state } from '../world/quests';
import { getSettings, motionDuration, subscribeSettings } from '../settings';
import { FONT } from '../ui';
import { setSceneMusic } from '../audio';
import { liaCloakOnGround } from '../appearance';
import { STAR_REFLECTION_BEATS } from '../story/starReflection';
import { createFireMinigame, fireHitBand, fireMarkerPosition, strokeFireMinigame, tickFireMinigame, type FireMinigameState } from '../story/fireMinigame';
import { FireMinigameUI } from '../story/fireMinigameUI';
import { consumeCampMeal } from '../story/campMeal';
import { Dialogue } from '../dialogue';
import { CAMP_DIALOGUE_CHOICES, CAMP_DIALOGUE_PROMPT, CAMP_DIALOGUE_TUTORIAL, campDialogueBranch, type CampDialogueChoiceId } from '../story/campDialogue';

type CampStep = 'cloak' | 'stones' | 'ring' | 'twigs' | 'fire' | 'meal' | 'sleep' | 'waking' | 'star' | 'complete';

/** Roman S. 22–32: one day on the road and one uneasy night in company. */
export class JourneyScene extends StoryScene {
  private campStep: CampStep = 'cloak';
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
  private campConversationAdvance?: () => void;
  private campConversationEscape?: () => void;
  private campMenuBindings: { key: Phaser.Input.Keyboard.Key; handler: () => void }[] = [];
  private star?: Phaser.GameObjects.Graphics;
  private starReflectionRun = 0;
  private starReflectionIndex = -1;

  constructor() { super('journey'); }

  create(data: { from?: string } = {}) {
    this.inCamp = false; this.campStep = 'cloak'; this.conversation = 0;
    this.foltan = undefined; this.azar = undefined; this.cloak = undefined;
    this.blanket = undefined; this.flame = undefined; this.fireRing = undefined; this.campLogs = undefined;
    this.campStones = undefined; this.campTwigs = undefined; this.campBackground = undefined;
    this.arrivalClock = 0; this.arrivalActive = false; this.campDeparturePending = false;
    this.campSeatActive = false; this.campSeatRun++;
    this.campDialogue = undefined; this.campMenu = undefined; this.campConversationActive = false;
    this.campConversationAdvance = undefined; this.campConversationEscape = undefined; this.campMenuBindings = [];
    this.data.set({ 'story:camp-seated': false, 'story:camp-dialogue': { active: false, choices: [] } });
    this.star = undefined; this.starReflectionIndex = -1; this.starReflectionRun++;
    this.data.set('story:star-reflection', { active: false, index: -1, step: '' });
    this.data.set({ 'story:camp-arrival': '', 'mobile:controls': null });
    this.fireUI?.destroy(); this.fireUI = undefined; this.fireGame = undefined;
    this.fireBusy = false; this.fireEHeld = false; this.fireEscapeHeld = false; this.fireStrokeCooldown = 0; this.fireClock = 0;
    this.data.set('story:fire-minigame', { active: false });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.detachFireKeys();
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
      Object.assign(st.inv, {
        proviant: 1, wasserschlauch: 1, reisezeug: 1, heilzeug: 1, dolch: 1,
        kupfer: 22, silber: 7, 'buch-kraeuter': 1, 'buch-alana': 1,
      });
      st.flags.departureReady = true;
    }
    if (data.from !== 'felder' && (st.flags.journeyCampReached || st.flags.firstCampRested || st.flags.metFoltanAzar)) {
      this.begin(FIRST_CAMP_AREA);
      this.setupCamp(false);
      if (st.flags.metFoltanAzar) {
        setSceneMusic(this, 'refuge');
        this.addStrangers(true);
        this.campStep = st.flags.criosObserved ? 'complete' : 'star';
        this.drawStar();
      } else if (st.flags.firstCampRested) {
        this.wakeEncounter();
        return;
      }
      this.campSpots();
    } else {
      this.begin(ROAD_EAST_AREA);
      this.roadSpots();
      this.say('Endlich die Hauptstraße. Am Bach kann ich trinken und Wasser nachfüllen.', 2600);
      this.passingTravelers();
    }
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
          flags.streamVisited = true;
          this.say('Das kühle Wasser tut gut. Der Schlauch ist wieder voll.', 2200);
        } else if (target.id === 'fork') {
          flags.journeyEastChosen = true;
          this.say('Westen: Trapas. Osten: Portas. Die Reiter sind nach Osten. Hoffentlich nicht bis ganz nach Portas.', 3300);
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
    this.setCloseupText('Lia: Die Sonne geht unter. Ich bin müde. Dort im Wald suche ich mir einen Platz und schlage mein Lager auf.');
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
    state(this.registry).flags.journeyCampReached = true;
    this.changeArea(FIRST_CAMP_AREA);
    this.setupCamp(true);
    this.setLocked(true);
    this.say('Die Sonne geht unter. Mist, ein Loch im Rock. Ich ziehe den grünen Mantel über. Hier sieht mich von der Straße aus keiner, hier bleibe ich.', 4800);
    const snag = this.add.graphics().setDepth(288);
    snag.lineStyle(2, 0x73544a).lineBetween(525, 277, 541, 264);
    this.areaRoot.add(snag);
    this.time.delayedCall(900, () => { snag.destroy(); this.setLocked(false); this.campSpots(); });
  }

  private setupCamp(fresh: boolean) {
    this.inCamp = true;
    const flags = state(this.registry).flags;
    // Existing saves with a lit fire already have a constructed fireplace.
    if (flags.campfireLit) { flags.journeyStonesGathered = true; flags.journeyFirepitBuilt = true; }
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
    this.campStep = fresh ? 'cloak' : !flags.journeyCloakSpread ? 'cloak' : !flags.journeyStonesGathered ? 'stones' : !flags.journeyFirepitBuilt ? 'ring' : !flags.journeyTwigsGathered ? 'twigs' : !flags.campfireLit ? 'fire' : !flags.journeyAte ? 'meal' : 'sleep';
    this.drawFire();
  }

  private campSpots() {
    const objectives: Record<CampStep, string> = {
      cloak: 'Den grünen Regenmantel ausziehen und ausbreiten.', stones: 'Sechs Steine für die Feuerstelle sammeln.', ring: 'Aus den Steinen in der Tasche eine Feuerstelle bauen.', twigs: 'Trockenes Laub und Zweige sammeln.',
      fire: 'Mit Holzreibung ein Feuer entzünden.', meal: 'Öffne die Tasche (I), wähle Reiseproviant und Essen.',
      sleep: 'Unter der Wolldecke schlafen.',
      waking: '',
      star: 'Im Lager zur Ruhe kommen oder bis zum Morgen schlafen.', complete: 'Im Lager zur Ruhe kommen oder bis zum Morgen schlafen.',
    };
    this.setObjective(objectives[this.campStep]);
    const required: Record<CampStep, string> = {
      cloak: 'bedroll', stones: 'stones', ring: 'fire', twigs: 'twigs', fire: 'fire', meal: 'fire', sleep: 'bedroll',
      waking: '', star: 'star', complete: '',
    };
    const labels: Partial<Record<CampStep, string>> = {
      cloak: 'Mantel ausbreiten', stones: 'Steine sammeln', ring: 'Steine zu einer Feuerstelle legen', twigs: 'Laub und Zweige sammeln', fire: 'Holz reiben',
      meal: 'Tasche öffnen · Reiseproviant wählen', sleep: 'Hinlegen und zudecken',
      star: 'Crios ansehen',
    };
    this.inventory?.setItemActions(this.campStep === 'meal' && state(this.registry).flags.campfireLit
      ? [{ item: 'proviant', label: 'Essen', onUse: () => this.eatCampProviant() }] : [],
      this.campStep === 'meal' ? 'Wähle Reiseproviant und dann Essen.' : '');
    const flags = state(this.registry).flags;
    const social = ['foltan', 'azar'];
    this.setSpots(FIRST_CAMP_AREA.targets.map(target => ({
      ...target,
      markerWhenDisabled: true,
      markerVisible: () => this.campStep !== 'waking' && (!social.includes(target.id) || !!flags.metFoltanAzar),
      label: target.id === 'bedroll' && flags.metFoltanAzar ? 'Bis zum Morgen schlafen'
        : target.id === 'fire-seat' ? flags.campfireLit ? 'Ans Feuer setzen / aufstehen' : 'Sitzplatz (erst Feuer entzünden)'
        : target.id === 'star' && !flags.metFoltanAzar ? 'Westlicher Himmel (später ansehen)'
        : target.id === 'fire' && flags.campfireLit && this.campStep !== 'meal' ? 'Glut ansehen'
        : target.id === required[this.campStep] ? labels[this.campStep] ?? target.label : target.label,
      enabled: () => this.canUseCampSpot(target.id),
      onUse: () => this.useCampSpot(target.id),
    })));
  }

  private canUseCampSpot(id: string): boolean {
    if (this.fireBusy || this.campStep === 'waking' || this.campConversationActive || this.starReflectionIndex >= 0) return false;
    const { flags } = state(this.registry);
    if (id === 'road') return true;
    if (id === 'fire-seat') return !!flags.campfireLit;
    if (id === 'foltan' || id === 'azar') return !!flags.metFoltanAzar;
    if (id === 'star') return !!flags.metFoltanAzar;
    if (id === 'bedroll' && (flags.metFoltanAzar || this.campStep === 'complete')) return true;
    if (id === 'fire' && flags.campfireLit) return true;
    const required: Partial<Record<CampStep, string>> = { cloak: 'bedroll', stones: 'stones', ring: 'fire', twigs: 'twigs', fire: 'fire', meal: 'fire', sleep: 'bedroll' };
    return id === required[this.campStep];
  }

  private useCampSpot(id: string) {
    const { flags, inv } = state(this.registry);
    if (!this.canUseCampSpot(id)) return;
    if (id === 'fire-seat') { this.toggleCampSeat(); return; }
    if (this.campSeatActive) this.standFromFire(false);
    if (id === 'foltan') { this.openCampConversation(); return; }
    if (id === 'azar') { this.snoreAzar(); return; }
    if (id === 'road') { this.say('Es ist dunkel. Ich bleibe im Lager und gehe bei Tageslicht weiter.', 2600); return; }
    if (id === 'star') { this.beginStarReflection(); return; }
    if (id === 'bedroll' && (flags.metFoltanAzar || this.campStep === 'complete')) {
      flags.journeyCloakRecovered = true;
      this.cloak?.setVisible(false); this.blanket?.setVisible(false);
      this.setLiaPose(null);
      this.goTo('companions-road'); return;
    }
    if (id === 'fire' && flags.campfireLit && this.campStep !== 'meal') {
      this.say('Die Glut wärmt meine Hände. Hier kann ich einen Augenblick sitzen bleiben.', 2600); return;
    }
    switch (this.campStep) {
      case 'cloak':
        if (!inv.reisezeug) { this.say('Dafür brauche ich meinen eingepackten Regenmantel.', 2100); return; }
        flags.journeyCloakSpread = true; flags.journeyCloakRecovered = false;
        this.cloak?.setVisible(true); this.setLiaPose(null);
        this.say('Ich ziehe den grünen Mantel aus und breite ihn aus. Besser als der kalte Boden.', 2800); this.campStep = 'stones'; break;
      case 'stones':
        inv.steine = (inv.steine ?? 0) + 6; flags.journeyStonesGathered = true;
        this.campStones?.setVisible(false);
        this.say('Sechs Steine. Sie liegen jetzt in meiner Tasche (I). Daraus baue ich eine Feuerstelle.', 3200); this.campStep = 'ring'; break;
      case 'ring':
        if ((inv.steine ?? 0) < 6) { this.say('Für den Ring brauche ich sechs Steine in der Tasche.', 2400); return; }
        inv.steine! -= 6; if (!inv.steine) delete inv.steine;
        flags.journeyFirepitBuilt = true; this.drawFire();
        this.say('Die Steine umschließen die Feuerstelle. Jetzt fehlt trockenes Holz.', 2400); this.campStep = 'twigs'; break;
      case 'twigs':
        flags.journeyTwigsGathered = true; inv.zunderholz = (inv.zunderholz ?? 0) + 1;
        this.campTwigs?.setVisible(false);
        this.say('Trockenes Laub und Zweige, ab in die Tasche (I). Den Zunder von daheim hätte ich mitnehmen sollen.', 3200); this.campStep = 'fire'; break;
      case 'fire': this.lightFire(); return;
      case 'meal':
        this.say(inv.proviant ? 'Ich hole den Reiseproviant aus meiner Tasche. Auswählen und Essen.' : 'In meiner Tasche fehlt der Reiseproviant.', 3000);
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
    const { flags, inv } = state(this.registry);
    if (flags.campfireLit) return;
    if (!flags.journeyFirepitBuilt || !inv.zunderholz) { this.say('Erst die Feuerstelle bauen und trockenes Holz sammeln.', 2400); return; }
    this.fireGame ??= createFireMinigame(getSettings().reducedMotion);
    this.fireBusy = true;
    // Opening the game with E is not its first stroke. Release, then press again.
    this.fireEHeld = this.keys.E.isDown;
    this.keys.ESC ??= this.input.keyboard!.addKey('ESC');
    this.fireEscapeHeld = this.keys.ESC.isDown;
    this.keys.E.on('down', this.onFireKeyDown); this.keys.E.on('up', this.onFireKeyUp);
    this.keys.ESC.on('down', this.onFireEscapeDown); this.keys.ESC.on('up', this.onFireEscapeUp);
    this.fireStrokeCooldown = 0;
    this.inventory.close(); this.say('', 0);
    this.setLocked(true); this.setCinematic(true); this.campSpots();
    this.data.set('mobile:controls', { directions: [], actions: { E: 'Holz bohren', ESC: 'Pause' }, inventory: false });
    this.fireUI = new FireMinigameUI(this, () => this.fireStroke(), () => this.pauseFire());
    this.fireUI.update(this.fireGame);
    this.publishFireState();
  }

  private fireStroke() {
    if (!this.fireBusy || !this.fireGame || this.fireStrokeCooldown > 0) return;
    this.fireStrokeCooldown = 400;
    const result = strokeFireMinigame(this.fireGame);
    this.fireFeedback = result === 'miss' ? 'Etwas ruhiger. Warte auf das grüne Feld.' : result === 'complete' ? 'Die Zweige fangen Feuer.' : 'Gut! Der Zunder wird wärmer.';
    this.fireUI?.result(result); this.fireUI?.update(this.fireGame);
    this.publishFireState();
    if (result !== 'complete') return;
    const st = state(this.registry);
    // Only a finished fire consumes gathered wood. Pausing leaves it in the bag.
    st.flags.campfireLit = true;
    st.inv.zunderholz = Math.max(0, (st.inv.zunderholz ?? 0) - 1);
    if (!st.inv.zunderholz) delete st.inv.zunderholz;
    this.closeFireUI(); this.fireGame = undefined;
    this.campStep = 'meal'; this.campSpots(); this.drawFire();
    this.say('Es brennt! Heute Nacht muss ich wenigstens nicht frieren.', 2400);
  }

  private pauseFire() {
    if (!this.fireBusy) return;
    this.closeFireUI(); this.campSpots();
    this.say('Ich mache kurz Pause. Das Holz und die Wärme im Zunder bleiben erhalten.', 2400);
  }

  private closeFireUI() {
    this.fireBusy = false; this.detachFireKeys();
    this.fireUI?.destroy(); this.fireUI = undefined;
    this.data.set('mobile:controls', null); this.data.set('mobile:thought', '');
    this.setCinematic(false); this.setLocked(false);
    this.publishFireState();
  }

  private detachFireKeys() {
    this.keys?.E?.off('down', this.onFireKeyDown); this.keys?.E?.off('up', this.onFireKeyUp);
    this.keys?.ESC?.off('down', this.onFireEscapeDown); this.keys?.ESC?.off('up', this.onFireEscapeUp);
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
      reducedMotion: game.reducedMotion, ready: this.fireStrokeCooldown <= 0,
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
      this.say('Erst esse ich etwas aus meiner Tasche. Dann lege ich mich hin.', 2800);
      this.campStep = 'meal'; this.campSpots(); return;
    }
    this.campStep = 'waking'; this.campSpots(); this.setLocked(true);
    this.lia.setPosition(233, 260).setDepth(260); this.blanket?.setVisible(true);
    this.setLiaPose('lia-sleep');
    this.say('Die Decke bis zum Hals. Ich habe letzte Nacht kein Auge zugetan.', 2100);
    this.time.delayedCall(1500, () => {
      state(this.registry).flags.firstCampRested = true;
      this.data.set('story:camp-time', 'night');
      if (this.textures.exists('bg-first-camp-night')) this.campBackground?.setTexture('bg-first-camp-night');
      this.say('Einige Stunden später. Es ist Nacht geworden.', 2700);
      this.time.delayedCall(2700, () => this.wakeEncounter());
    });
  }

  private eatCampProviant(): boolean {
    if (this.campStep !== 'meal' || !this.inCamp) return false;
    const world = state(this.registry);
    const result = consumeCampMeal(world);
    if (result !== 'ate') {
      if (result === 'no-provisions') this.say('In meiner Tasche fehlt der Reiseproviant.', 2800);
      return false;
    }
    this.campStep = 'sleep';
    this.inventory.refresh(world.inv);
    this.inventory.close();
    this.say('Brot und Käse. Jetzt lege ich mich auf den Mantel und ziehe die Decke über mich.', 3400);
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
    this.say('Das Feuer wärmt mich. Für einen Moment bleibe ich hier. Mit E oder einer Bewegung stehe ich auf.', 3300);
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
    this.say('Azar schläft schon tief und fest.', 2100);
  }

  private openCampConversation() {
    if (this.campConversationActive) return;
    this.campConversationActive = true;
    this.inventory.close(); this.inventory.setVisible(false); this.setLocked(true); this.setCinematic(true);
    this.campSpots();
    this.campDialogue ??= new Dialogue(this, { manageControls: false });
    this.campConversationAdvance = () => this.campDialogue?.advance();
    this.keys.E.on('down', this.campConversationAdvance);
    this.keys.ESC ??= this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.campConversationEscape = () => this.closeCampConversation();
    this.keys.ESC.on('down', this.campConversationEscape);
    this.campDialogue.setText(CAMP_DIALOGUE_PROMPT);
    this.campDialogue.setContinue(() => this.showCampConversationMenu(), 'Gesprächsthema wählen');
    this.data.set('mobile:controls', { directions: [], actions: { E: 'Gesprächsthema wählen', ESC: 'Zurück' }, inventory: false });
    this.data.set('story:camp-dialogue', { active: true, stage: 'intro', choices: [] });
  }

  private clearCampMenu() {
    for (const { key, handler } of this.campMenuBindings) key.off('down', handler);
    this.campMenuBindings = [];
    this.campMenu?.destroy(); this.campMenu = undefined;
  }

  private showCampConversationMenu() {
    if (!this.campConversationActive) return;
    this.campDialogue?.hide(); this.clearCampMenu();
    const panel = this.add.rectangle(320, 196, 404, 216, 0x101b17, 0.98).setStrokeStyle(2, 0xafa083);
    const title = this.add.text(142, 106, 'Gespräch mit Foltan', { fontFamily: FONT, fontSize: '19px', color: '#f4e5bd' });
    const hint = this.add.text(142, 131, CAMP_DIALOGUE_TUTORIAL, { fontFamily: FONT, fontSize: '12px', color: '#d5c9b3', wordWrap: { width: 356 } });
    const controls = ['Q', 'R', 'SPACE', 'ESC'] as const;
    const children: Phaser.GameObjects.GameObject[] = [panel, title, hint];
    CAMP_DIALOGUE_CHOICES.forEach((choice, index) => {
      const rowY = 182 + index * 30;
      const row = this.add.rectangle(320, rowY, 360, 25, 0x233229, 0.95).setStrokeStyle(1, 0x655e4c).setInteractive({ useHandCursor: true });
      const keyName = controls[index];
      const shortcut = keyName === 'SPACE' ? 'Leertaste' : keyName === 'ESC' ? 'Esc' : keyName;
      const label = this.add.text(152, rowY, `${choice.label}  [${shortcut}]`, { fontFamily: FONT, fontSize: '15px', color: '#f4ecd8' }).setOrigin(0, 0.5);
      row.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation(); this.chooseCampConversation(choice.id);
      });
      // ESC already has the persistent close handler; do not register it twice.
      if (keyName !== 'ESC') {
        this.keys[keyName] ??= this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes[keyName]);
        const handler = () => this.chooseCampConversation(choice.id);
        this.keys[keyName].on('down', handler);
        this.campMenuBindings.push({ key: this.keys[keyName], handler });
      }
      children.push(row, label);
    });
    this.campMenu = this.add.container(0, 0, children).setDepth(1200).setScrollFactor(0);
    this.data.set('story:camp-dialogue', { active: true, stage: 'menu', choices: CAMP_DIALOGUE_CHOICES.map(choice => choice.id) });
    this.data.set('mobile:controls', { directions: [], actions: { Q: 'Über Kyra', R: 'Über den Weg', SPACE: 'Über die Wache', ESC: 'Zurück' }, inventory: false });
  }

  private chooseCampConversation(choice: CampDialogueChoiceId) {
    if (!this.campConversationActive) return;
    if (choice === 'back') { this.closeCampConversation(); return; }
    this.clearCampMenu();
    const lines = campDialogueBranch(choice);
    this.data.set('story:camp-dialogue', { active: true, stage: choice, choices: [] });
    const showLine = (index: number) => {
      if (!this.campConversationActive) return;
      this.campDialogue!.setText(lines[index]);
      this.campDialogue!.setContinue(() => index + 1 < lines.length ? showLine(index + 1) : this.showCampConversationMenu(), index + 1 < lines.length ? 'Weiter' : 'Weitere Frage');
    };
    this.data.set('mobile:controls', { directions: [], actions: { E: 'Weiter', ESC: 'Zurück' }, inventory: false });
    showLine(0);
  }

  private closeCampConversation(shutdown = false) {
    if (!this.campConversationActive) return;
    this.campConversationActive = false;
    this.clearCampMenu(); this.campDialogue?.hide();
    if (this.campConversationAdvance) this.keys.E.off('down', this.campConversationAdvance);
    if (this.campConversationEscape) this.keys.ESC?.off('down', this.campConversationEscape);
    this.campConversationAdvance = undefined; this.campConversationEscape = undefined;
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
    this.campStep = 'waking'; this.setLocked(true); this.campSpots();
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
    const lines = [
      'Der Dicke: "Ist sie tot?"',
      'Der Schmale: "Nein, sie hat noch Puls."',
      'Lia: "Aaah!"',
      'Der Dicke: "Aaaah!"',
      'Der Schmale: "Psst! Du schreist ja lauter als sie."',
      'Der Dicke: "Tschuldige. Du weißt doch, dass ich schreckhaft bin."',
      'Der Schmale: "Glückwunsch, jetzt weiß der halbe Wald, dass wir hier sind. Ganz ruhig, Kleine. Wir tun dir nichts."',
    ];
    const showLine = (index: number) => {
      if (index === 2) {
        this.blanket?.setVisible(false); this.setLiaPose('lia-wake');
        this.showCloseup('cut-camp-wake');
      }
      this.setCloseupText(lines[index]);
      this.setCloseupContinue(() => {
        if (index + 1 < lines.length) showLine(index + 1);
        else this.listen();
      });
    };
    showLine(0);
  }

  private listen() {
    const lines = [
      'Der Schmale: "Ich bin Foltan. Ich war Leutnant der Stadtgarde von Portas. Und das hier ist Azar, ein Schmied aus Ignis."',
      'Azar: "Das mit dem ‚tot‘ war nicht böse gemeint. Du lagst nur so still da."',
      'Foltan: "Manchmal wünschte ich, du würdest einfach schweigen."',
      'Azar: "Na bitte. Soll der feine Herr Foltan machen, was er für richtig hält."',
      'Lia: "Erst sagt ihr mir, was ihr hier macht."',
      'Foltan: "Sieh an, vorlaut ist sie auch noch. Wir sind gegen die Dunkelschatten, falls dich das beruhigt."',
      'Lia: "Dunkelschatten haben gestern meine Eltern umgebracht und Kyra mitgenommen. Meine Schwester. Helft ihr mir?"',
      'Foltan: "Glaub mir, du bist nicht die Einzige, der so etwas passiert ist. Versprechen können wir dir nichts."',
      'Lia: "Und Kyra? Ich kann doch nicht einfach abwarten."',
      'Foltan: "Allein kannst du sie nicht retten. Schlag dir das fürs Erste aus dem Kopf."',
      'Azar: "Komm mit uns in unser Lager. Bei uns bist du sicherer, glaub mir."',
      'Foltan: "Und jetzt schlaf. Wir halten abwechselnd Wache. Azar, du übernimmst die zweite."',
    ];
    if (this.conversation === 0) {
      this.setLiaPose(null);
      this.showCloseup('cut-camp-companions');
    }
    if (this.conversation < lines.length) {
      this.setCloseupText(lines[this.conversation++]);
      this.setCloseupContinue(() => this.listen());
      return;
    }
    this.setCloseupText('Foltan setzt sich ans Feuer, Azar schnarcht schon. Ich bin nicht mehr allein. Ob ich mich darüber freuen soll, weiß ich noch nicht.');
    this.setCloseupContinue(() => {
      state(this.registry).flags.metFoltanAzar = true;
      this.lia.setPosition(454, 210).setDepth(210);
      this.foltan?.setPosition(355, 231).setDepth(231);
      this.azar?.setPosition(397, 265).setDepth(265).setAngle(82);
      this.foltanShadow?.setPosition(355, 230).setDepth(230);
      this.azarShadow?.setPosition(397, 264).setDepth(264);
      this.campStep = 'star'; this.setLiaPose(null);
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
    if (flags.criosObserved) { this.say('Crios steht noch im Westen. Vielleicht sieht Kyra ihn auch.', 2800); return; }
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
        state(this.registry).flags.criosObserved = true;
        this.starReflectionIndex = -1; this.campStep = 'complete';
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
