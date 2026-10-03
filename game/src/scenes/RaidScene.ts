import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { RAID_APPROACH_AREA, RAID_AREA } from '../story/areas/raid';
import type { Pt } from '../story/types';
import { state } from '../world/quests';
import { motionDuration } from '../settings';

type Beat = 'approach' | 'hidden' | 'departure' | 'parents' | 'vow' | 'busy';

type ObservationBeat = {
  line: string;
  shot?: string;
  shotAfterAction?: boolean;
  speaker?: () => Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | undefined;
  action?: (done: () => void) => void;
};

/** Roman pp. 13-17: Lia is a witness in hiding, with no combat or spell abilities. */
export class RaidScene extends StoryScene {
  private beat: Beat = 'approach';
  private raiders: Phaser.GameObjects.Image[] = [];
  private leader!: Phaser.GameObjects.Image;
  private mother!: Phaser.GameObjects.Image;
  private father!: Phaser.GameObjects.Image;
  private kyra?: Phaser.GameObjects.Image;
  private cover?: Phaser.GameObjects.Graphics;
  private spear?: Phaser.GameObjects.Graphics;
  private dagger?: Phaser.GameObjects.Graphics;
  private browWound?: Phaser.GameObjects.Rectangle;
  private speakerMark?: Phaser.GameObjects.Triangle;
  private nextBeat?: () => void;
  private observation: ObservationBeat[] = [];

  constructor() { super('raid'); }

  create() {
    this.beat = 'approach';
    this.raiders = [];
    this.kyra = undefined;
    this.browWound = undefined;
    this.speakerMark = undefined;
    this.nextBeat = undefined;
    this.data.set({ 'mobile:controls': null, 'mobile:dialogue': '' });
    this.begin(RAID_APPROACH_AREA);
    this.setObjective('In der Böschung links am Weg verstecken.');
    this.say('Mutter und Vater knien vor der offenen Tür.', 2400);
    this.populateFarm();
    this.setSpots([{
      ...RAID_AREA.targets[0],
      enabled: () => this.beat === 'approach',
      onUse: () => this.hide(),
    }]);
  }

  private person(frame: number, at: Pt, fallback: string): Phaser.GameObjects.Image {
    return this.addActor(this.textures.exists('story-actors') ? 'story-actors' : fallback,
      this.textures.exists('story-actors') ? frame : 0, at);
  }

  private populateFarm() {
    this.mother = this.person(3, [259, 194], 'woman').setScale(0.95);
    this.father = this.person(4, [283, 195], 'warrior');
    this.leader = this.person(2, [262, 224], 'warrior');
    // Four initial humans include the grey-haired leader; the scarred fifth arrives from the house.
    const spearman = this.addActor('warrior', 8, [223, 204]);
    const axeman = this.addActor('axe', 0, [309, 205]);
    const hooded = this.addActor('warrior', 8, [310, 182]).setTint(0xc4c4c4);
    this.raiders = [spearman, axeman, hooded, this.leader];
    this.spear = this.add.graphics().setDepth(206);
    this.spear.lineStyle(2, 0x725c38).lineBetween(215, 153, 215, 200);
    this.spear.fillStyle(0xb7b8ae).fillTriangle(211, 155, 219, 155, 215, 147);
    this.areaRoot.add(this.spear);
    this.areaRoot.add(this.add.rectangle(320, 180, 640, 360, 0x252d25, 0.11).setDepth(600));
  }

  private hide() {
    this.beat = 'busy';
    this.setSpots([]);
    this.setLocked(true);
    this.setCinematic(true);
    this.inventory.close();
    this.cinemaControls(false);
    this.say('', 0);
    // Lia first steps off the road, then visibly lowers herself into the roadside brush.
    this.lia.play('lia-walk-w');
    this.tweens.add({ targets: this.lia, x: 96, y: 179, duration: motionDuration(620), onComplete: () => {
      this.cover = this.add.graphics().setDepth(700);
      this.cover.fillStyle(0x344d25, 0.94);
      for (let x = 80; x <= 116; x += 4) this.cover.fillTriangle(x, 185, x + 3, 185, x + 2, 174 - x % 7);
      this.areaRoot.add(this.cover);
      const hidden = () => {
        if (this.anims.exists('lia-hidden-e')) this.setLiaPose('lia-hidden-e');
        else this.lia.stop().play('lia-idle-e');
        // Hold the actual lowered sprite for a beat before opening the actor close-up.
        this.time.delayedCall(motionDuration(300), () => this.startObservation());
      };
      if (this.anims.exists('lia-hide-e')) {
        this.lia.once('animationcomplete-lia-hide-e', hidden);
        this.lia.play('lia-hide-e');
      } else hidden();
    } });
  }

  private cinemaControls(ready: boolean, label = 'Weiter') {
    this.data.set('mobile:controls', { directions: [], actions: { E: label }, inventory: false, disabled: !ready });
  }

  private caption(line: string, speaker?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite) {
    this.setCloseupText(line);
    this.speakerMark?.destroy();
    this.speakerMark = undefined;
    if (!this.closeupVisible && speaker && speaker !== this.lia) {
      this.speakerMark = this.add.triangle(speaker.x, speaker.y - (speaker === this.mother || speaker === this.father ? 34 : 52), 0, 0, 6, 0, 3, 4, 0xe5cd86).setDepth(720);
      this.areaRoot.add(this.speakerMark);
    }
  }

  private advanceDialogue() {
    const next = this.nextBeat;
    if (!next) return;
    this.nextBeat = undefined;
    this.setSpots([]);
    this.cinemaControls(false);
    this.setCloseupContinue(null);
    next();
  }

  private readyToContinue(next: () => void, label = 'Weiter') {
    this.nextBeat = next;
    this.setCloseupContinue(() => this.advanceDialogue(), label);
  }

  private startObservation() {
    this.beat = 'hidden';
    this.setObjective('Im Versteck bleiben und zuhören.');
    // Dialogue is adapted from Roman pp. 13-17; the next line never advances on a timer.
    this.observation = [
      { line: 'Lia (Gedanke): Dunkelschatten.', shot: 'cinematic-raid-cover', speaker: () => this.lia },
      { line: 'Narbiger: Seht mal, wen ich gefunden habe.', shot: 'cinematic-raid-confrontation', speaker: () => this.raiders[4],
        action: done => this.bringKyra(done) },
      { line: 'Grauhaariger: Ihr sagtet, ihr seid allein. Wer ist sie?', shot: 'cinematic-raid-confrontation', speaker: () => this.leader },
      { line: 'Vater: Ich kenne sie nicht. Sie ist nur ein neugieriges Kind. Lasst sie laufen.', speaker: () => this.father },
      { line: 'Grauhaariger: Schon wieder solche Lügen. Ihr Bauern seid doch alle gleich.', speaker: () => this.leader,
        action: done => this.intimidateFather(done) },
      { line: 'Vater: Bitte lasst sie gehen!', speaker: () => this.father },
      { line: 'Kapuzenmann: Sollen wir sie vor ihren Eltern auspeitschen?', speaker: () => this.raiders[2] },
      { line: 'Grauhaariger: Nein. Zeig deine Hände!', speaker: () => this.leader,
        action: done => this.inspectHands(done) },
      { line: 'Grauhaariger: Du bist harte Arbeit gewohnt. Der Hauptmann braucht eine Dienstmagd.', speaker: () => this.leader },
      { line: 'Vater: Lasst sie in Ruhe!', speaker: () => this.father },
      { line: 'Lia (Gedanke): Vater!', shot: 'cinematic-raid-loss', speaker: () => this.lia, action: done => this.killFather(done) },
      { line: 'Lia (Gedanke): Sie fesseln Kyras Hände hinter dem Rücken.', shot: 'cinematic-raid-kyra', shotAfterAction: true, speaker: () => this.lia,
        action: done => this.bindKyra(done) },
      { line: 'Grauhaariger: Wenn ihr euch so allein fühlt, dann folgt ihm ins Jenseits.', speaker: () => this.leader,
        action: done => {
          this.mother.setScale(0.9, 0.8);
          this.tweens.add({ targets: this.leader, x: 260, y: 207, duration: motionDuration(400), onComplete: done });
        } },
      { line: 'Mutter: Kyra...', shot: 'cinematic-raid-loss', speaker: () => this.mother, action: done => this.killMother(done) },
      { line: 'Kyra: Ich werde euch töten! Das schwöre ich bei allen Göttern!', speaker: () => this.kyra },
      { line: 'Grauhaariger: Verwahrt sie gut. Der Hauptmann wird sich über unser Geschenk freuen.', speaker: () => this.leader },
      { line: 'Lia (Gedanke): Sie nehmen Kyra mit.', shot: 'cinematic-raid-departure', speaker: () => this.lia, action: done => this.depart(done) },
    ];
    this.showObservationBeat(0);
  }

  private showObservationBeat(index: number) {
    const beat = this.observation[index];
    this.nextBeat = undefined;
    this.setSpots([]);
    this.cinemaControls(false);
    if (beat.shot && !beat.shotAfterAction) this.showCloseup(beat.shot);
    this.caption(beat.line, beat.speaker?.());
    this.setCloseupContinue(null);
    const complete = () => {
      if (beat.shot && beat.shotAfterAction) this.showCloseup(beat.shot);
      // The arriving/moving speaker may not yet have existed when the line was first displayed.
      this.caption(beat.line, beat.speaker?.());
      this.readyToContinue(() => index + 1 < this.observation.length ? this.showObservationBeat(index + 1) : this.emptyFarm());
    };
    if (beat.action) beat.action(complete); else complete();
  }

  private bringKyra(done: () => void) {
    const captor = this.addActor('warrior', 8, [273, 177]).setTint(0xc9c9c9);
    this.raiders.push(captor);
    this.kyra = this.person(0, [282, 177], 'woman');
    this.tweens.add({ targets: [captor, this.kyra], y: 216, duration: motionDuration(950), ease: 'Sine.inOut', onComplete: () => {
      this.kyra?.setScale(0.88, 0.75);
      this.browWound = this.add.rectangle(284, 188, 2, 2, 0x87574e).setDepth(240);
      this.areaRoot.add(this.browWound);
      done();
    } });
  }

  private intimidateFather(done: () => void) {
    this.tweens.add({ targets: this.leader, x: 282, y: 207, duration: motionDuration(250), onComplete: () => {
      this.tweens.add({ targets: this.father, x: 287, duration: motionDuration(120), yoyo: true, onComplete: done });
    } });
  }

  private inspectHands(done: () => void) {
    this.tweens.add({ targets: this.leader, x: 267, y: 215, duration: motionDuration(350), onComplete: () => {
      const hand = this.add.rectangle(277, 191, 8, 3, 0xc7ad8c).setDepth(230);
      this.areaRoot.add(hand);
      this.time.delayedCall(450, () => { hand.destroy(); done(); });
    } });
  }

  private drawDagger(x: number) {
    this.dagger?.destroy();
    this.dagger = this.add.graphics().setDepth(280);
    this.dagger.lineStyle(2, 0xc2c7c5).lineBetween(x, 182, x + 8, 178);
    this.areaRoot.add(this.dagger);
  }

  private killFather(done: () => void) {
    this.tweens.add({ targets: this.leader, x: 281, y: 207, duration: motionDuration(350), onComplete: () => {
      this.drawDagger(281);
      this.silhouetteFall(this.father, done);
      const book = this.add.graphics().setDepth(701);
      book.fillStyle(0x6a523b).fillRect(110, 183, 7, 5);
      book.fillStyle(0xd4c6a0).fillRect(111, 184, 5, 2);
      this.areaRoot.add(book);
    } });
  }

  private bindKyra(done: () => void) {
    this.browWound?.destroy();
    this.kyra!.setScale(1);
    this.tweens.add({ targets: this.raiders[4], x: 296, y: 214, duration: motionDuration(300) });
    this.tweens.add({ targets: this.raiders[1], x: 272, y: 215, duration: motionDuration(300) });
    this.tweens.add({ targets: this.kyra, y: 204, duration: motionDuration(180), yoyo: true, repeat: 2, onComplete: () => {
      if (this.textures.exists('story-actors')) this.kyra?.setFrame(1);
      done();
    } });
  }

  private killMother(done: () => void) {
    this.drawDagger(260);
    this.silhouetteFall(this.mother, () => { this.dagger?.destroy(); this.dagger = undefined; done(); });
  }

  private silhouetteFall(actor: Phaser.GameObjects.Image, done: () => void) {
    const shade = this.add.rectangle(actor.x, actor.y - 18, 42, 46, 0x171b19, 0).setDepth(750);
    this.areaRoot.add(shade);
    this.tweens.add({ targets: shade, alpha: 0.96, duration: 140, yoyo: true, hold: 230,
      onYoyo: () => actor.setAngle(-90).setScale(0.76).setOrigin(0.5).setY(actor.y + 1).setTint(0x737c78),
      onComplete: () => { shade.destroy(); done(); },
    });
  }

  private depart(done: () => void) {
    this.beat = 'departure';
    this.setSpots([]);
    this.setObjective('Die Reiter vorbeiziehen lassen.');
    this.lia.setAlpha(0.45);
    this.spear?.destroy();
    this.raiders.forEach((rider, index) => {
      const mount = this.add.container(312 + index * 30, 210 + index % 2 * 6).setDepth(240 + index);
      this.areaRoot.add(mount);
      if (this.textures.exists('raid-horse')) {
        mount.add(this.add.image(0, 0, 'raid-horse', index % 4).setOrigin(0.5, 60 / 64));
      }
      // The rider and captive travel together along the Hohlweg past Lia's cover.
      mount.add(rider);
      rider.setPosition(0, -15).setOrigin(0.5, 0.8).setScale(0.82);
      if (rider === this.leader && this.kyra) {
        mount.add(this.kyra);
        this.kyra.setPosition(-10, -7).setAngle(-80).setOrigin(0.5).setScale(0.69);
      }
      this.tweens.add({ targets: mount, x: -75, y: 191, duration: motionDuration(2100),
        delay: index * 120, ease: 'Sine.in', onComplete: () => mount.destroy() });
    });
    this.time.delayedCall(2850, done);
  }

  private emptyFarm() {
    this.beat = 'parents';
    this.hideCloseup();
    this.setLiaPose(null);
    this.setCinematic(false);
    this.areaRoot.setScale(1).setPosition(0, 0);
    this.speakerMark?.destroy();
    this.speakerMark = undefined;
    this.data.set({ 'mobile:controls': null, 'mobile:dialogue': '', 'mobile:thought': '' });
    this.changeArea({ ...RAID_AREA, start: [104, 185] });
    this.lia.setAlpha(1);
    this.setLocked(false);
    this.mother = this.person(3, [257, 196], 'woman').setOrigin(0.5).setAngle(-90).setScale(0.76).setTint(0x737c78);
    this.father = this.person(4, [279, 196], 'warrior').setOrigin(0.5).setAngle(-90).setScale(0.76).setTint(0x737c78);
    this.setObjective('Die Eltern auf dem Hof aufsuchen.');
    this.say('Die Reiter sind verschwunden.', 1500);
    this.setSpots([{ ...RAID_AREA.targets[1], onUse: () => this.vow() }]);
  }

  private vow() {
    if (this.beat !== 'parents') return;
    this.beat = 'vow';
    this.setLocked(true);
    this.setCinematic(true);
    this.setLiaPose('lia-grieve');
    this.showCloseup('cinematic-raid-loss');
    this.say('', 0);
    this.time.delayedCall(1, () => {
      this.caption('Lia: Ich werde dich finden, Kyra.');
      this.readyToContinue(() => { this.setSpots([]); this.goTo('aftermath'); }, 'Bleiben');
    });
    const flags = state(this.registry).flags;
    flags.raidWitnessed = true;
    flags.parentsLost = true;
    flags.kyraTaken = true;
    this.setObjective('Bei den Eltern bleiben.');
    this.setSpots([]);
    this.cinemaControls(false);
  }
}
