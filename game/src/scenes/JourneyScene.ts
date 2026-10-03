import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { ROAD_EAST_AREA, FIRST_CAMP_AREA } from '../story/areas/journey';
import { state } from '../world/quests';
import { getSettings, motionDuration } from '../settings';
import { FONT } from '../ui';

type CampStep = 'cloak' | 'twigs' | 'fire' | 'meal' | 'foot' | 'sleep' | 'waking' | 'slip' | 'bound' | 'star' | 'complete';

/** Roman S. 22–32: one day on the road and one uneasy night in company. */
export class JourneyScene extends StoryScene {
  private campStep: CampStep = 'cloak';
  private inCamp = false;
  private conversation = 0;
  private foltan?: Phaser.GameObjects.Image;
  private azar?: Phaser.GameObjects.Image;
  private cloak?: Phaser.GameObjects.Ellipse;
  private blanket?: Phaser.GameObjects.Ellipse;
  private flame?: Phaser.GameObjects.Graphics;
  private rope?: Phaser.GameObjects.Graphics;
  private progress?: Phaser.GameObjects.Rectangle;
  private progressBack?: Phaser.GameObjects.Rectangle;
  private friction = 0;
  private fireBusy = false;
  private fireClick = false;
  private fireClock = 0;

  constructor() { super('journey'); }

  create() {
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
    if (st.flags.journeyCampReached || st.flags.firstCampRested || st.flags.metFoltanAzar) {
      this.begin(FIRST_CAMP_AREA);
      this.setupCamp(false);
      if (st.flags.metFoltanAzar) {
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
      enabled: () => target.id === 'stream' || (target.id === 'fork' && !!flags.streamVisited) || (target.id === 'east' && !!flags.journeyEastChosen),
      onUse: () => {
        if (target.id === 'stream') {
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

  /** Anonymous road travelers are silhouettes, not reused named actor frames. */
  private passingTravelers() {
    const wagon = this.add.container(515, 193).setDepth(193);
    const g = this.add.graphics();
    g.fillStyle(0x6d5137).fillRect(-15, -17, 30, 13);
    g.fillStyle(0xbbb092).fillRect(-14, -29, 28, 12);
    g.fillStyle(0x302d28).fillCircle(-10, -3, 5).fillCircle(10, -3, 5);
    g.fillStyle(0x7f684e).fillRect(-32, -19, 13, 8).fillRect(-30, -11, 3, 10).fillRect(-22, -11, 3, 10);
    g.fillStyle(0xa98b68).fillCircle(6, -34, 4);
    wagon.add(g); this.areaRoot.add(wagon);
    const troupe = this.add.container(580, 199).setDepth(199);
    const troupeArt = this.add.graphics();
    [-12, 1, 14].forEach((x, i) => {
      troupeArt.fillStyle([0x764449, 0x537266, 0xa68a45][i]).fillTriangle(x - 5, -4, x + 5, -4, x, -23);
      troupeArt.fillStyle(0xc49b74).fillCircle(x, -26, 3);
      troupeArt.lineStyle(2, 0x3a312a).lineBetween(x - 2, -4, x - 3, 0).lineBetween(x + 2, -4, x + 3, 0);
    });
    troupe.add(troupeArt); this.areaRoot.add(troupe);
    // A modest side observation; the main route remains open.
    const tag = this.add.text(565, 219, 'Gaukler · nach Trapas zum Verbannungsfest', {
      fontFamily: FONT, fontSize: '8px', color: '#ddd1ad', stroke: '#252722', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(270);
    this.areaRoot.add(tag);
    if (getSettings().reducedMotion) { wagon.x = 110; troupe.x = 80; tag.x = 230; return; }
    this.tweens.add({ targets: wagon, x: -55, duration: 13000, onComplete: () => wagon.destroy() });
    this.tweens.add({ targets: troupe, x: -30, duration: 16000, onComplete: () => troupe.destroy() });
    this.tweens.add({ targets: tag, alpha: 0, delay: 4300, duration: 700, onComplete: () => tag.destroy() });
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
    this.cloak = this.add.ellipse(233, 260, 66, 22, 0x47634b).setDepth(245).setVisible(!!flags.journeyCloakSpread);
    this.blanket = this.add.ellipse(233, 254, 46, 17, 0x9c9276).setDepth(270).setVisible(false);
    this.flame = this.add.graphics().setDepth(230);
    this.areaRoot.add([this.cloak, this.blanket, this.flame]);
    if (fresh) this.campStep = 'cloak';
    else this.campStep = !flags.journeyCloakSpread ? 'cloak' : !flags.journeyTwigsGathered ? 'twigs' : !flags.campfireLit ? 'fire' : !flags.journeyAte ? 'meal' : !flags.journeyFeetChecked ? 'foot' : 'sleep';
    this.drawFire();
  }

  private campSpots() {
    const objectives: Record<CampStep, string> = {
      cloak: 'Den grünen Regenmantel ausbreiten.', twigs: 'Trockenes Laub und Zweige sammeln.',
      fire: 'Mit Holzreibung ein Feuer entzünden.', meal: 'Etwas Brot und Käse essen.',
      foot: 'Nach den schmerzenden Füßen sehen.', sleep: 'Unter der Wolldecke schlafen.',
      waking: '', slip: 'Während des Streits zur Straße schleichen.', bound: 'Den Fremden zuhören.',
      star: 'Zum westlichen Stern hinaufsehen.', complete: 'Morgen folgen wir dem Waldweg.',
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
        flags.journeyFeetChecked = true;
        this.say('Die Schuhe ausziehen. Die Ferse schmerzt noch vom langen Marsch.', 2500); this.campStep = 'sleep'; break;
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
    this.flame.fillStyle(0xe37335, 0.3).fillEllipse(317, 226, 43, 16);
    this.flame.fillStyle(0xb74d28).fillCircle(312, 226, 3).fillCircle(321, 226, 3);
    if (!flags.firstCampRested || flags.metFoltanAzar) {
      const sway = getSettings().reducedMotion ? 0 : Math.sin(this.fireClock / 140) * 2;
      this.flame.fillStyle(0xd87937).fillTriangle(309, 225, 323, 225, 316 + sway, 207);
      this.flame.fillStyle(0xedbf66).fillTriangle(313, 224, 320, 224, 317, 214);
    }
  }

  private sleep() {
    this.campStep = 'waking'; this.campSpots(); this.setLocked(true);
    this.lia.setPosition(233, 260).setDepth(260); this.blanket?.setVisible(true);
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
    this.campStep = 'waking'; this.setLocked(true); this.campSpots();
    this.lia.setPosition(233, 260).setDepth(260); this.blanket?.setVisible(true);
    this.addStrangers(); this.drawFire();
    const wrist = this.add.line(0, 0, 248, 246, 231, 247, 0xcba783).setLineWidth(2).setDepth(270);
    this.areaRoot.add(wrist);
    this.say('Fremder: "Ist sie tot?"', 1200);
    this.time.delayedCall(1300, () => this.say('Fremder: "Nein. Sie hat noch Puls."', 1600));
    this.time.delayedCall(2900, () => {
      wrist.destroy(); this.blanket?.setVisible(false);
      this.say('Lia: "Ah!"   Fremder: "Aaah!"', 1300);
      for (const [x, y] of [[233, 213], [295, 194]]) {
        const bang = this.add.text(x, y, '!', { fontFamily: FONT, fontSize: '18px', color: '#e9d5a4' }).setDepth(400);
        this.areaRoot.add(bang); this.time.delayedCall(800, () => bang.destroy());
      }
    });
    this.time.delayedCall(4250, () => {
      this.say('Der Schmale: "Still!"   Der Dicke: "Ich bin schreckhaft."', 2500);
      this.campStep = 'slip'; this.setLocked(false); this.campSpots();
    });
  }

  private caught() {
    this.campStep = 'waking'; this.campSpots(); this.setLocked(true);
    this.say('Der Dicke: "He, sie haut ab!"', 1300);
    const finish = () => {
      this.lia.setPosition(470, 190).setDepth(190);
      this.foltan?.setPosition(443, 206).setDepth(206);
      this.azar?.setPosition(408, 217).setDepth(217);
      this.rope = this.add.graphics().setDepth(191);
      this.rope.lineStyle(2, 0xb69a6e).lineBetween(461, 174, 479, 174).lineBetween(462, 179, 479, 179).lineBetween(465, 188, 475, 188);
      this.areaRoot.add(this.rope);
      this.campStep = 'bound'; this.conversation = 0;
      this.say('Der Schmale bindet meine Hände und Füße. "Damit du uns zuhörst."', 2600);
      this.campSpots();
    };
    const duration = motionDuration(550);
    if (!duration) finish();
    else this.tweens.add({ targets: this.lia, x: 470, y: 190, duration, onComplete: finish });
  }

  private listen() {
    const lines = [
      'Foltan: "Ich war Leutnant der Stadtgarde von Portas. Das ist Azar, Schmied aus Ignis."',
      'Lia: "Was macht ihr hier?"   Foltan: "Wir sind Gegner der Dunkelschatten."',
      'Lia: "Sie haben meine Eltern getötet und Kyra mitgenommen. Ich muss meine Schwester finden."',
      'Foltan: "Versprechen können wir dir nichts. Aber wir nehmen dich mit zu unserem Lager."',
      'Lia: "Und Kyra?"   Foltan: "Allein kannst du sie nicht retten. Schlaf dich erst aus."',
      'Azar: "Bei uns bist du sicherer."   Foltan: "Wir halten abwechselnd Wache."',
    ];
    if (this.conversation < lines.length) {
      this.say(lines[this.conversation++], 4500);
      this.campSpots();
      return;
    }
    const flags = state(this.registry).flags;
    flags.metFoltanAzar = true;
    flags.journeyRopesReleased = true;
    this.rope?.destroy(); this.rope = undefined;
    this.lia.setPosition(454, 210).setDepth(210);
    this.foltan?.setPosition(355, 231).setDepth(231);
    this.azar?.setPosition(397, 265).setDepth(265).setAngle(82);
    this.campStep = 'star'; this.setLocked(false);
    this.say('Die Fesseln sind gelöst. Foltan legt Zweige auf die Glut. Azar schläft schon.', 3200);
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
