import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { ROAD_EAST_AREA, FIRST_CAMP_AREA } from '../story/areas/journey';
import { FIELD_RETURN } from '../story/travel';
import { state } from '../world/quests';
import { getSettings, subscribeSettings } from '../settings';
import { FONT } from '../ui';
import { setSceneMusic } from '../audio';

type CampStep = 'cloak' | 'stones' | 'ring' | 'twigs' | 'fire' | 'meal' | 'sleep' | 'waking' | 'star' | 'complete';

/** Roman S. 22–32: one day on the road and one uneasy night in company. */
export class JourneyScene extends StoryScene {
  private campStep: CampStep = 'cloak';
  private inCamp = false;
  private conversation = 0;
  private foltan?: Phaser.GameObjects.Image;
  private azar?: Phaser.GameObjects.Image;
  private cloak?: Phaser.GameObjects.Image;
  private blanket?: Phaser.GameObjects.Image;
  private flame?: Phaser.GameObjects.Image;
  private fireRing?: Phaser.GameObjects.Image;
  private campLogs?: Phaser.GameObjects.Image;
  private campStones?: Phaser.GameObjects.Image;
  private campTwigs?: Phaser.GameObjects.Image;
  private campBackground?: Phaser.GameObjects.Image;
  private progress?: Phaser.GameObjects.Rectangle;
  private progressBack?: Phaser.GameObjects.Rectangle;
  private friction = 0;
  private fireBusy = false;
  private fireClick = false;
  private fireClock = 0;
  private arrivalClock = 0;
  private arrivalActive = false;

  constructor() { super('journey'); }

  create(data: { from?: string } = {}) {
    this.inCamp = false; this.campStep = 'cloak'; this.conversation = 0;
    this.foltan = undefined; this.azar = undefined; this.cloak = undefined;
    this.blanket = undefined; this.flame = undefined; this.fireRing = undefined; this.campLogs = undefined;
    this.campStones = undefined; this.campTwigs = undefined; this.campBackground = undefined;
    this.arrivalClock = 0; this.arrivalActive = false;
    this.data.set({ 'story:camp-arrival': '', 'mobile:controls': null });
    this.progress = undefined; this.progressBack = undefined;
    this.friction = 0; this.fireBusy = false; this.fireClick = false; this.fireClock = 0;
    this.input.on('pointerdown', this.clickFire, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.clickFire, this);
      this.arrivalActive = false;
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
        if (st.flags.criosObserved) this.drawStar();
      } else if (st.flags.firstCampRested) {
        this.wakeEncounter();
        return;
      }
      this.campSpots();
    } else {
      this.begin(ROAD_EAST_AREA);
      this.roadSpots();
      this.say('Seit Stunden unterwegs. Am Bach kann ich Wasser nachfüllen.', 2600);
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
          this.say('Kühles Wasser. Der Schlauch ist wieder voll.', 2200);
        } else if (target.id === 'fork') {
          flags.journeyEastChosen = true;
          this.say('Westen: Trapas. Osten: Portas. Die Entführer ritten nach Osten.', 3300);
        } else {
          this.enterCamp(); return;
        }
        this.roadSpots();
      },
    })));
  }

  /** Anonymous travelers have their own authored atlas, never a named actor frame. */
  private passingTravelers() {
    if (!this.textures.exists('road-travelers')) return;
    // The traveler atlas faces right; Trapas lies west (decreasing x).
    const wagon = this.add.sprite(515, 193, 'road-travelers', 0).setFlipX(true).setOrigin(0.5, 60 / 64).setDepth(193);
    const troupe = this.add.sprite(580, 199, 'road-travelers', 1).setFlipX(true).setOrigin(0.5, 60 / 64).setDepth(199);
    this.areaRoot.add([wagon, troupe]);
    const tag = this.add.text(565, 219, 'Gaukler · nach Trapas zum Verbannungsfest', {
      fontFamily: FONT, fontSize: '8px', color: '#ddd1ad', stroke: '#252722', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(270);
    this.areaRoot.add(tag);
    if (getSettings().reducedMotion) { wagon.x = 110; troupe.x = 80; tag.x = 230; return; }
    const travelers = [
      { sprite: wagon, animation: 'road-wagon-walk', idle: 0 },
      { sprite: troupe, animation: 'road-troupe-walk', idle: 1 },
    ];
    const idle = (traveler: typeof travelers[number]) => {
      traveler.sprite.anims.stop();
      traveler.sprite.setTexture('road-travelers', traveler.idle);
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

  private enterCamp() {
    state(this.registry).flags.journeyCampReached = true;
    this.changeArea(FIRST_CAMP_AREA);
    this.setupCamp(true);
    this.setLocked(true);
    this.say('Seit Stunden unterwegs. Die Sonne geht unter. Ich bin müde und schlage hier ein Lager auf.', 4100);
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
    this.cloak = this.add.image(233, 260, 'camp-cloak-detailed').setDepth(245).setVisible(!!flags.journeyCloakSpread);
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
      cloak: 'Den grünen Regenmantel aus der Tasche ausbreiten.', stones: 'Sechs Steine für die Feuerstelle sammeln.', ring: 'Aus den Steinen in der Tasche eine Feuerstelle bauen.', twigs: 'Trockenes Laub und Zweige sammeln.',
      fire: 'Mit Holzreibung ein Feuer entzünden.', meal: 'Etwas Brot und Käse essen.',
      sleep: 'Unter der Wolldecke schlafen.',
      waking: '',
      star: 'Zum westlichen Stern hinaufsehen.', complete: 'Ende des Prototyps · Die Reise geht morgen weiter.',
    };
    this.setObjective(objectives[this.campStep]);
    const required: Record<CampStep, string> = {
      cloak: 'bedroll', stones: 'stones', ring: 'fire', twigs: 'twigs', fire: 'fire', meal: 'fire', sleep: 'bedroll',
      waking: '', star: 'star', complete: '',
    };
    const labels: Partial<Record<CampStep, string>> = {
      cloak: 'Mantel ausbreiten', stones: 'Steine sammeln', ring: 'Steine zu einer Feuerstelle legen', twigs: 'Laub und Zweige sammeln', fire: 'Holz reiben',
      meal: 'Brot und Käse essen', sleep: 'Hinlegen und zudecken',
      star: 'Crios ansehen',
    };
    this.setSpots(FIRST_CAMP_AREA.targets.map(target => ({
      ...target,
      markerVisible: () => this.campStep !== 'complete',
      label: target.id === required[this.campStep] ? labels[this.campStep] ?? target.label : target.label,
      enabled: () => !this.fireBusy && (this.campStep === 'complete' || target.id === required[this.campStep]),
      onUse: () => this.useCampSpot(target.id),
    })));
  }

  private useCampSpot(id: string) {
    const { flags, inv } = state(this.registry);
    const targets: Partial<Record<CampStep, string>> = { cloak: 'bedroll', stones: 'stones', ring: 'fire', twigs: 'twigs', fire: 'fire', meal: 'fire', sleep: 'bedroll', star: 'star' };
    if (this.campStep !== 'complete' && id !== targets[this.campStep]) return;
    if (this.campStep === 'complete') {
      this.say(id === 'star' ? 'Crios steht im Westen. Sieht Kyra gerade denselben Stern?' : id === 'trunk' ? 'Foltan hält Wache. Azar schnarcht bereits.' : id === 'road' ? 'Erst bei Tageslicht. Das Lager ist noch einen Fußmarsch entfernt.' : id === 'fire' ? 'Die Glut wärmt. Morgen gehen wir gemeinsam weiter.' : 'Endlich ein wenig Ruhe.', 2500);
      return;
    }
    switch (this.campStep) {
      case 'cloak':
        if (!inv.reisezeug) { this.say('Dafür brauche ich meinen eingepackten Regenmantel.', 2100); return; }
        flags.journeyCloakSpread = true; this.cloak?.setVisible(true);
        this.say('Der Regenmantel aus der Tasche schützt mich vor dem kalten Boden.', 2400); this.campStep = 'stones'; break;
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
        this.say('Trockenes Laub und Zweige sind in der Tasche (I). Ein flaches Holzstück hilft beim Feuerreiben.', 3200); this.campStep = 'fire'; break;
      case 'fire': this.lightFire(); return;
      case 'meal':
        if (!inv.proviant) { this.say('In meiner Tasche fehlt der Reiseproviant.', 2100); return; }
        flags.journeyAte = true;
        // The bundle holds several meals; record this portion, keep the rest.
        flags.journeyProviantPortionUsed = true;
        this.say('Ein Stück Brot und Käse aus dem Proviant. Den Rest hebe ich für morgen auf.', 2800); this.campStep = 'sleep'; break;
      case 'sleep': this.sleep(); return;
      case 'star':
        flags.criosObserved = true; this.campStep = 'complete';
        this.say('Crios, der Adler des Aros. Ein treuer Gefährte. Ob Kyra ihn auch sieht?', 3300);
        this.drawStar(); break;
      default: return;
    }
    this.campSpots();
  }

  private lightFire() {
    if (this.fireBusy) return;
    const { flags, inv } = state(this.registry);
    if (!flags.journeyFirepitBuilt || !inv.zunderholz) { this.say('Erst die Feuerstelle bauen und trockenes Holz sammeln.', 2400); return; }
    this.fireBusy = true; this.friction = 0;
    this.fireClick = !this.keys.E.isDown;
    this.setLocked(true); this.campSpots();
    this.say('Das Stöckchen drehen. Rauch ... noch ein wenig.', 1700);
    this.progressBack = this.add.rectangle(317, 250, 60, 5, 0x17201c).setDepth(300);
    this.progress = this.add.rectangle(287, 250, 0, 3, 0xc7a063).setOrigin(0, 0.5).setDepth(301);
    this.areaRoot.add([this.progressBack, this.progress]);
    // Releasing E pauses progress. A click completes the same action without holding.
  }

  private clickFire(pointer: Phaser.Input.Pointer) {
    if (this.fireBusy && Math.hypot(pointer.worldX - 317, pointer.worldY - 225) <= 30) this.fireClick = true;
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

  private addStrangers(introduced = false, arriving = false) {
    // Foltan is the lanky mercenary, Azar the broad blacksmith. Both keep
    // their established actor frames, with empty hands and no restraining pose.
    this.foltan = this.addActor('story-actors', 5, introduced ? [355, 231] : arriving ? [545, 282] : [259, 245]);
    this.azar = this.addActor('story-actors', 6, introduced ? [397, 265] : arriving ? [563, 296] : [295, 242]);
    if (introduced) this.azar.setAngle(82);
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
    const move = (actor: Phaser.GameObjects.Image | undefined, points: number[][], offset: number) => {
      if (!actor?.active) return;
      const part = progress < 0.58 ? progress / 0.58 : (progress - 0.58) / 0.42;
      const [from, to] = progress < 0.58 ? [points[0], points[1]] : [points[1], points[2]];
      const gait = reduced || progress === 1 ? 0 : Math.sin(this.arrivalClock / 92 + offset);
      actor.setPosition(from[0] + (to[0] - from[0]) * part, from[1] + (to[1] - from[1]) * part - Math.abs(gait) * 1.5)
        .setAngle(gait * 1.6);
    };
    move(this.foltan, [[545, 282], [338, 282], [259, 245]], 0);
    move(this.azar, [[563, 296], [372, 293], [295, 242]], 1.1);
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
      'Der Schmale: "Nein. Sie hat noch Puls."',
      'Lia: "Ah!"',
      'Der Dicke: "Aaah!"',
      'Der Schmale: "Du erschreckst sie noch mehr."',
      'Der Dicke: "Ich bin schreckhaft."',
      'Der Schmale: "Das haben wir jetzt alle gehört. Wir tun dir nichts."',
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
      'Der Schmale: "Ich bin Foltan. Früher Leutnant der Stadtgarde von Portas, jetzt Söldner. Und das ist Azar, Schmied aus Ignis."',
      'Azar: "Schmied. Kein Totengräber. Ich wollte nur sehen, ob du Hilfe brauchst."',
      'Foltan: "Dann frag das nächstes Mal zuerst."',
      'Azar: "Bei meinem Amboss antwortet auch keiner."',
      'Lia: "Was macht ihr hier?"',
      'Foltan: "Wir sind Gegner der Dunkelschatten."',
      'Lia: "Sie haben meine Eltern getötet und Kyra mitgenommen. Ich muss meine Schwester finden."',
      'Foltan: "Versprechen können wir dir nichts. Aber wir nehmen dich mit zu unserem Lager."',
      'Lia: "Und Kyra?"',
      'Foltan: "Allein kannst du sie nicht retten. Schlaf dich erst aus."',
      'Azar: "Bei uns bist du sicherer."',
      'Foltan: "Wir halten abwechselnd Wache."',
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
    this.setCloseupText('Foltan hält zuerst Wache. Morgen nehmen sie mich mit. Für heute muss ich nicht mehr allein weiter.');
    this.setCloseupContinue(() => {
      state(this.registry).flags.metFoltanAzar = true;
      this.lia.setPosition(454, 210).setDepth(210);
      this.foltan?.setPosition(355, 231).setDepth(231);
      this.azar?.setPosition(397, 265).setDepth(265).setAngle(82);
      this.campStep = 'star'; this.setLiaPose(null);
      this.hideCloseup(); this.setCinematic(false); this.setLocked(false); this.drawFire(); this.campSpots();
    }, 'Zum Stern');
  }

  private drawStar() {
    const star = this.add.graphics().setDepth(50);
    star.fillStyle(0xf3e7b4).fillRect(152, 58, 3, 3);
    star.lineStyle(1, 0xbecdda, 0.7).lineBetween(153, 54, 153, 65).lineBetween(148, 59, 158, 59);
    this.areaRoot.add(star);
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (!this.inCamp) return;
    this.fireClock += delta;
    this.updateArrival(delta);
    if (this.fireBusy) {
      if (this.fireClick || this.keys.E.isDown) this.friction += Math.min(delta, 50);
      this.hud.hint('E halten: Holz reiben · Klick auf die Feuerstelle: fertigreiben', true);
      this.progress?.setSize(60 * Math.min(1, this.friction / 1100), 3);
      if (this.friction >= 1100) {
        this.fireBusy = false;
        this.progress?.destroy(); this.progressBack?.destroy();
        this.progress = undefined; this.progressBack = undefined;
        const st = state(this.registry);
        st.flags.campfireLit = true;
        st.inv.zunderholz! -= 1; if (!st.inv.zunderholz) delete st.inv.zunderholz;
        this.setLocked(false); this.campStep = 'meal';
        this.say('Es brennt. Trockenes Laub und Zweige nachlegen.', 2000);
        this.campSpots();
      }
    }
    this.drawFire();
  }
}
