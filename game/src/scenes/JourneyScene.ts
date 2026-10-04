import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { ROAD_EAST_AREA, FIRST_CAMP_AREA } from '../story/areas/journey';
import { FIELD_RETURN } from '../story/travel';
import { state } from '../world/quests';
import { getSettings, motionDuration, subscribeSettings } from '../settings';
import { FONT } from '../ui';
import { setSceneMusic } from '../audio';

type CampStep = 'cloak' | 'twigs' | 'fire' | 'meal' | 'foot' | 'sleep' | 'waking' | 'slip' | 'bound' | 'star' | 'complete';

/** Roman S. 22–32: one day on the road and one uneasy night in company. */
export class JourneyScene extends StoryScene {
  private campStep: CampStep = 'cloak';
  private inCamp = false;
  private conversation = 0;
  private foltan?: Phaser.GameObjects.Image;
  private azar?: Phaser.GameObjects.Image;
  private cloak?: Phaser.GameObjects.Graphics;
  private blanket?: Phaser.GameObjects.Graphics;
  private flame?: Phaser.GameObjects.Graphics;
  private rope?: Phaser.GameObjects.Graphics;
  private progress?: Phaser.GameObjects.Rectangle;
  private progressBack?: Phaser.GameObjects.Rectangle;
  private friction = 0;
  private fireBusy = false;
  private fireClick = false;
  private fireClock = 0;

  constructor() { super('journey'); }

  create(data: { from?: string } = {}) {
    this.inCamp = false; this.campStep = 'cloak'; this.conversation = 0;
    this.foltan = undefined; this.azar = undefined; this.cloak = undefined;
    this.blanket = undefined; this.flame = undefined; this.rope = undefined;
    this.progress = undefined; this.progressBack = undefined;
    this.friction = 0; this.fireBusy = false; this.fireClick = false; this.fireClock = 0;
    this.input.on('pointerdown', this.clickFire, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', this.clickFire, this));
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
    this.say('Der Rock bleibt hängen. Ein Riss. Hundert Meter von der Straße reichen.', 3100);
    const snag = this.add.graphics().setDepth(288);
    snag.lineStyle(2, 0x73544a).lineBetween(525, 277, 541, 264);
    this.areaRoot.add(snag);
    this.time.delayedCall(900, () => { snag.destroy(); this.setLocked(false); this.campSpots(); });
  }

  private setupCamp(fresh: boolean) {
    this.inCamp = true;
    const flags = state(this.registry).flags;
    this.cloak = this.add.graphics().setPosition(201, 248).setDepth(245).setVisible(!!flags.journeyCloakSpread);
    this.cloth(this.cloak, ['...sssssssss....', '.ssmmmmmmmmmmss.', 'smmmmhhmmmmmmmms', 'smmhhmmmmmmmsmms', '.smmmmmmssmmmms.', '..ssssssssssss..'], { s: 0x344d39, m: 0x47634b, h: 0x627c59 }, 4);
    this.blanket = this.add.graphics().setPosition(211, 246).setDepth(270).setVisible(false);
    this.cloth(this.blanket, ['.ssssssssssssssssssss.', 'smmmmmmmmmmmmmmmmmmmmms', 'smmhhhhmmmmmmhhhhmmmms', 'smmmmmmmmmmmmmmmmmmmmms', 'smmmmssmmmmmmssmmmmmmms', 'smmmmmmmmmmmmmmmmmmmmms', '.ssssssssssssssssssss.'], { s: 0x746b55, m: 0x9c9276, h: 0xb4a689 }, 2);
    this.flame = this.add.graphics().setDepth(230);
    this.areaRoot.add([this.cloak, this.blanket, this.flame]);
    if (fresh) this.campStep = 'cloak';
    else this.campStep = !flags.journeyCloakSpread ? 'cloak' : !flags.journeyTwigsGathered ? 'twigs' : !flags.campfireLit ? 'fire' : !flags.journeyAte ? 'meal' : !flags.journeyFeetChecked ? 'foot' : 'sleep';
    this.drawFire();
  }

  private cloth(graphics: Phaser.GameObjects.Graphics, rows: string[], colors: Record<string, number>, pixel: number) {
    rows.forEach((row, y) => [...row].forEach((shade, x) => {
      if (shade !== '.') graphics.fillStyle(colors[shade]).fillRect(x * pixel, y * pixel, pixel, pixel);
    }));
  }

  private campSpots() {
    const objectives: Record<CampStep, string> = {
      cloak: 'Den grünen Regenmantel ausbreiten.', twigs: 'Trockenes Laub und Zweige sammeln.',
      fire: 'Mit Holzreibung ein Feuer entzünden.', meal: 'Etwas Brot und Käse essen.',
      foot: 'Nach den schmerzenden Füßen sehen.', sleep: 'Unter der Wolldecke schlafen.',
      waking: '', slip: 'Während des Streits zur Straße schleichen.', bound: 'Den Fremden zuhören.',
      star: 'Zum westlichen Stern hinaufsehen.', complete: 'Ende des Prototyps · Die Reise geht morgen weiter.',
    };
    this.setObjective(objectives[this.campStep]);
    const required: Record<CampStep, string> = {
      cloak: 'bedroll', twigs: 'twigs', fire: 'fire', meal: 'fire', foot: 'bedroll', sleep: 'bedroll',
      waking: '', slip: 'road', bound: 'trunk', star: 'star', complete: '',
    };
    const labels: Partial<Record<CampStep, string>> = {
      cloak: 'Mantel ausbreiten', twigs: 'Laub und Zweige sammeln', fire: 'Holz reiben',
      meal: 'Brot und Käse essen', foot: 'Füße ansehen', sleep: 'Hinlegen und zudecken',
      slip: 'Leise zur Straße', bound: this.conversation ? 'Weiter zuhören' : 'Zuhören', star: 'Crios ansehen',
    };
    this.setSpots(FIRST_CAMP_AREA.targets.map(target => ({
      ...target,
      label: target.id === required[this.campStep] ? labels[this.campStep] ?? target.label : target.label,
      enabled: () => !this.fireBusy && (this.campStep === 'complete' || target.id === required[this.campStep]),
      onUse: () => this.useCampSpot(target.id),
    })));
  }

  private useCampSpot(id: string) {
    const flags = state(this.registry).flags;
    if (this.campStep === 'complete') {
      this.say(id === 'star' ? 'Crios steht im Westen. Sieht Kyra gerade denselben Stern?' : id === 'trunk' ? 'Foltan hält Wache. Azar schnarcht bereits.' : id === 'road' ? 'Erst bei Tageslicht. Das Lager ist noch einen Fußmarsch entfernt.' : id === 'fire' ? 'Die Glut wärmt. Morgen gehen wir gemeinsam weiter.' : 'Endlich ein wenig Ruhe.', 2500);
      return;
    }
    switch (this.campStep) {
      case 'cloak':
        flags.journeyCloakSpread = true; this.cloak?.setVisible(true);
        this.say('Der Regenmantel schützt mich vor dem kalten Boden.', 2100); this.campStep = 'twigs'; break;
      case 'twigs':
        flags.journeyTwigsGathered = true;
        this.say('Trockenes Laub, Zweige und ein flaches Holzstück. Den Zunder habe ich vergessen.', 2900); this.campStep = 'fire'; break;
      case 'fire': this.lightFire(); return;
      case 'meal':
        flags.journeyAte = true;
        // Proviant is the whole travel bundle; a small meal does not consume it.
        this.say('Ein Stück Brot und Käse. Mehr brauche ich jetzt nicht.', 2000); this.campStep = 'foot'; break;
      case 'foot':
        flags.journeyFeetChecked = true; this.campStep = 'sleep';
        this.lia.setPosition(233, 260); this.setLiaPose('lia-footcare');
        this.say('', 0);
        this.showCloseup('cut-camp-rest');
        this.setCloseupText('Die Schuhe ausziehen. Die Ferse schmerzt noch vom langen Marsch.');
        this.setCloseupContinue(() => { this.hideCloseup(); this.setLiaPose(null); this.campSpots(); }, 'Hinlegen');
        this.campSpots(); return;
      case 'sleep': this.sleep(); return;
      case 'slip': this.caught(); return;
      case 'bound': this.listen(); return;
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
    this.flame.clear();
    if (!flags.campfireLit) return;
    this.flame.fillStyle(0xe37335, 0.14).fillRect(299, 220, 36, 12).fillRect(303, 216, 28, 20);
    this.flame.fillStyle(0xb74d28).fillRect(310, 224, 4, 4).fillRect(319, 224, 4, 4);
    if (!flags.firstCampRested || flags.metFoltanAzar) {
      const sway = getSettings().reducedMotion ? 0 : Math.floor(this.fireClock / 180) % 2 * 2;
      this.flame.fillStyle(0xd87937).fillRect(309, 219, 14, 6).fillRect(313, 213, 8, 6).fillRect(315 + sway, 207, 2, 6);
      this.flame.fillStyle(0xedbf66).fillRect(313, 220, 6, 4).fillRect(315, 214, 2, 6);
    }
  }

  private sleep() {
    this.campStep = 'waking'; this.campSpots(); this.setLocked(true);
    this.lia.setPosition(233, 260).setDepth(260); this.blanket?.setVisible(true);
    this.setLiaPose('lia-sleep');
    this.say('Die Decke bis zum Hals. Ich habe letzte Nacht kein Auge zugetan.', 2100);
    this.time.delayedCall(1500, () => {
      state(this.registry).flags.firstCampRested = true;
      this.wakeEncounter();
    });
  }

  private addStrangers(introduced = false) {
    this.foltan = this.addActor('story-actors', 5, introduced ? [355, 231] : [259, 245]);
    this.azar = this.addActor('story-actors', 6, introduced ? [397, 265] : [295, 242]);
    if (introduced) this.azar.setAngle(82);
  }

  private wakeEncounter() {
    setSceneMusic(this, 'dread');
    this.campStep = 'waking'; this.setLocked(true); this.campSpots();
    this.lia.setPosition(233, 260).setDepth(260); this.blanket?.setVisible(true);
    this.setLiaPose('lia-sleep');
    this.addStrangers(); this.drawFire();
    this.say('', 0);
    this.showCloseup('cut-camp-wake');
    const lines = [
      'Der Dicke: "Ist sie tot?"',
      'Der Schmale: "Nein. Sie hat noch Puls."',
      'Lia: "Ah!"',
      'Der Dicke: "Aaah!"',
      'Der Schmale: "Still!"',
      'Der Dicke: "Ich bin schreckhaft."',
    ];
    const showLine = (index: number) => {
      if (index === 2) { this.blanket?.setVisible(false); this.setLiaPose('lia-wake'); }
      this.setCloseupText(lines[index]);
      this.setCloseupContinue(() => {
        if (index + 1 < lines.length) showLine(index + 1);
        else {
          this.hideCloseup(); this.setLiaPose(null);
          this.campStep = 'slip'; this.setLocked(false); this.campSpots();
        }
      }, index === lines.length - 1 ? 'Leise weiter' : 'Weiter');
    };
    showLine(0);
  }

  private caught() {
    this.campStep = 'waking'; this.campSpots(); this.setLocked(true);
    this.say('Der Dicke: "He, sie haut ab!"', 1300);
    const finish = () => {
      this.lia.setPosition(470, 190).setDepth(190);
      this.foltan?.setPosition(443, 206).setDepth(206);
      this.azar?.setPosition(408, 217).setDepth(217);
      if (!this.anims.exists('lia-bound-sit')) {
        this.rope = this.add.graphics().setDepth(191);
        this.rope.fillStyle(0xb69a6e).fillRect(461, 174, 18, 2).fillRect(462, 179, 17, 2).fillRect(465, 188, 10, 2);
        this.areaRoot.add(this.rope);
      }
      this.campStep = 'bound'; this.conversation = 0;
      this.setLiaPose('lia-bound-sit');
      this.say('', 0);
      this.showCloseup('cut-camp-capture');
      this.setCloseupText('Der Schmale: "Damit du uns zuhörst."');
      this.setCloseupContinue(() => this.listen(), 'Zuhören');
      this.campSpots();
    };
    const duration = motionDuration(550);
    if (!duration) finish();
    else {
      this.setLiaPose(null);
      this.lia.play('lia-walk-e', true);
      this.tweens.add({ targets: this.lia, x: 470, y: 190, duration, onComplete: finish });
    }
  }

  private listen() {
    const lines = [
      'Foltan: "Ich war Leutnant der Stadtgarde von Portas. Das ist Azar, Schmied aus Ignis."',
      'Lia: "Was macht ihr hier?"',
      'Foltan: "Wir sind Gegner der Dunkelschatten."',
      'Lia: "Sie haben meine Eltern getötet und Kyra mitgenommen. Ich muss meine Schwester finden."',
      'Foltan: "Versprechen können wir dir nichts. Aber wir nehmen dich mit zu unserem Lager."',
      'Lia: "Und Kyra?"',
      'Foltan: "Allein kannst du sie nicht retten. Schlaf dich erst aus."',
      'Azar: "Bei uns bist du sicherer."',
      'Foltan: "Wir halten abwechselnd Wache."',
    ];
    if (this.conversation < lines.length) {
      this.setCloseupText(lines[this.conversation++]);
      this.setCloseupContinue(() => this.listen());
      this.campSpots();
      return;
    }
    const flags = state(this.registry).flags;
    flags.metFoltanAzar = true;
    flags.journeyRopesReleased = true;
    setSceneMusic(this, 'refuge');
    this.rope?.destroy(); this.rope = undefined;
    this.lia.setPosition(454, 210).setDepth(210);
    this.foltan?.setPosition(355, 231).setDepth(231);
    this.azar?.setPosition(397, 265).setDepth(265).setAngle(82);
    this.campStep = 'star'; this.setLiaPose(null);
    this.say('', 0);
    this.showCloseup('cut-camp-companions');
    this.setCloseupText('Die Fesseln sind gelöst. Foltan hält zuerst Wache. Morgen nehmen sie mich mit.');
    this.setCloseupContinue(() => { this.hideCloseup(); this.setLocked(false); this.campSpots(); }, 'Zum Stern');
    this.drawFire(); this.campSpots();
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
    if (this.fireBusy) {
      if (this.fireClick || this.keys.E.isDown) this.friction += Math.min(delta, 50);
      this.hud.hint('E halten: Holz reiben · Klick auf die Feuerstelle: fertigreiben', true);
      this.progress?.setSize(60 * Math.min(1, this.friction / 1100), 3);
      if (this.friction >= 1100) {
        this.fireBusy = false;
        this.progress?.destroy(); this.progressBack?.destroy();
        this.progress = undefined; this.progressBack = undefined;
        state(this.registry).flags.campfireLit = true;
        this.setLocked(false); this.campStep = 'meal';
        this.say('Es brennt. Trockenes Laub und Zweige nachlegen.', 2000);
        this.campSpots();
      }
    }
    this.drawFire();
  }
}
