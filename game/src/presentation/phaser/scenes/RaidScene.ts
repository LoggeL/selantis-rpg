import Phaser from 'phaser';
import { StoryScene } from "../StoryScene";
import { RAID_APPROACH_AREA, RAID_AREA } from "../../../content/areas/raid";
import type { Pt } from "../../../modules/narrative/types";
import { setCampaignFlag, setCampaignFlags } from "../../../modules/campaign/commands";
import { state } from "../../../platform/campaignRegistry";
import { motionDuration } from "../../../app/settings";
import { setSceneMusic } from "../../../app/audio";
import { RAID_OBSERVATION_BEATS, type RaidCueId, type RaidSpeakerId } from "../../../content/chapters/homecoming/raid";
import { SequenceRunner } from "../../../modules/narrative/sequence";
import type { CloseupOptions } from "../StoryCloseup";
import { RAID_GRIEF_BEATS, PARENTS_GRIEF_BEATS } from "../../../content/chapters/aftermath/grief";

type Beat = 'approach' | 'hidden' | 'departure' | 'parents' | 'vow' | 'busy';

type ObservationBeat = {
  id: string;
  line: string;
  shot?: string;
  shotOptions?: CloseupOptions;
  shotAfterAction?: boolean;
  courtyard?: boolean;
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
  private dagger?: Phaser.GameObjects.Graphics;
  private browWound?: Phaser.GameObjects.Rectangle;
  private speakerMark?: Phaser.GameObjects.Triangle;
  private nextBeat?: () => void;
  private observation: ObservationBeat[] = [];
  private observationIndex = -1;
  private observationSequence?: SequenceRunner<ObservationBeat>;
  private storyStep = 'approach';
  private currentShot = '';

  constructor() { super('raid'); }

  create() {
    this.beat = 'approach';
    this.raiders = [];
    this.kyra = undefined;
    this.browWound = undefined;
    this.speakerMark = undefined;
    this.nextBeat = undefined;
    this.observation = [];
    this.observationIndex = -1;
    this.storyStep = 'approach';
    this.currentShot = '';
    this.data.set({ 'mobile:controls': null, 'mobile:dialogue': '' });
    this.publishProgress(false);
    this.events?.once('shutdown', () => this.observationSequence?.dispose());
    this.begin(RAID_APPROACH_AREA);
    this.setLiaCrouched(true);
    this.setObjective('In der Böschung links am Weg verstecken.');
    this.say('Was ist da los? Mutter und Vater knien vor der offenen Tür …', 2400);
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

  private faceTowards(actor: Phaser.GameObjects.Image, focusX: number) {
    actor.setFlipX(actor.x > focusX);
  }

  private populateFarm() {
    this.mother = this.person(3, [259, 194], 'woman').setScale(0.95);
    this.father = this.person(4, [283, 195], 'warrior');
    this.leader = this.person(2, [262, 224], 'warrior').setName('raid-leader');
    // Four initial humans include the grey-haired leader; the scarred fifth arrives from the house.
    // Frame 0 is the face-visible standing guard, frame 8 shows the back.
    const spearman = this.addActor(this.textures.exists('raid-spearman') ? 'raid-spearman' : 'warrior', 0, [223, 204]).setName('raid-spearman');
    const axeman = this.addActor('axe', 0, [309, 205]).setName('raid-axeman');
    const hooded = this.addActor('warrior', 0, [310, 182]).setTint(0xc4c4c4).setName('raid-hooded');
    this.raiders = [spearman, axeman, hooded, this.leader];
    this.raiders.forEach(actor => this.faceTowards(actor, 271));
    this.areaRoot.add(this.add.rectangle(320, 180, 640, 360, 0x252d25, 0.11).setDepth(600));
  }

  private hide() {
    this.beat = 'busy';
    this.storyStep = 'hiding';
    this.publishProgress(false);
    this.setSpots([]);
    this.setLocked(true);
    this.setCinematic(true);
    this.inventory.close();
    this.cinemaControls(false);
    this.say('', 0);
    // Lia stays low for the last few steps off the road and into the brush.
    this.playLiaMovement('w', true);
    this.tweens.add({ targets: this.lia, x: 96, y: 179, duration: motionDuration(820), onComplete: () => {
      this.cover = this.add.graphics().setDepth(700);
      this.cover.fillStyle(0x344d25, 0.94);
      for (let x = 80; x <= 116; x += 4) this.cover.fillTriangle(x, 185, x + 3, 185, x + 2, 174 - x % 7);
      this.areaRoot.add(this.cover);
      const hidden = () => {
        if (this.anims.exists('lia-hidden-e')) this.setLiaPose('lia-hidden-e');
        else this.playLiaMovement('e', false);
        // Hold the actual lowered sprite for a beat before opening the actor close-up.
        this.time.delayedCall(motionDuration(300), () => this.startObservation());
      };
      hidden();
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
    this.publishProgress(false);
    this.setSpots([]);
    this.cinemaControls(false);
    this.setCloseupContinue(null);
    next();
  }

  private readyToContinue(next: () => void, label = 'Weiter') {
    this.nextBeat = next;
    this.setCloseupContinue(() => this.advanceDialogue(), label);
    this.publishProgress(true);
  }

  /** Runtime QA follows the visible cards and input readiness, not quest flags. */
  private publishProgress(ready: boolean) {
    this.data.set('story:raid', {
      phase: this.beat, step: this.storyStep, index: this.observationIndex,
      total: this.observation.length, shot: this.currentShot, ready,
    });
  }

  private startObservation() {
    this.beat = 'hidden';
    this.setObjective('Im Versteck bleiben und zuhören.');
    // Dialogue is adapted from Roman pp. 13-17; the next line never advances on a timer.
    const actors: Record<RaidSpeakerId, () => Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | undefined> = {
      lia: () => this.lia, father: () => this.father, mother: () => this.mother, leader: () => this.leader,
      kyra: () => this.kyra, captor: () => this.raiders[4], hooded: () => this.raiders[2],
    };
    const cues: Record<RaidCueId, (done: () => void) => void> = {
      bringKyra: done => this.bringKyra(done), intimidateFather: done => this.intimidateFather(done),
      inspectHands: done => this.inspectHands(done), killFather: done => this.killFather(done),
      bindKyra: done => this.bindKyra(done), killMother: done => this.killMother(done), depart: done => this.depart(done),
      threatenMother: done => {
        this.mother.setScale(0.9, 0.8);
        this.faceTowards(this.leader, this.mother.x);
        this.tweens.add({ targets: this.leader, x: 260, y: 207, duration: motionDuration(400), onComplete: done });
      },
    };
    this.observation = RAID_OBSERVATION_BEATS.map(beat => ({ ...beat,
      speaker: beat.actor ? actors[beat.actor] : undefined,
      action: beat.cue ? cues[beat.cue] : undefined,
    }));
    this.observationSequence?.dispose();
    this.observationSequence = new SequenceRunner(this.observation, {
      enter: (_beat, index, ready) => this.showObservationBeat(index, ready),
      complete: () => this.emptyFarm(),
    });
    this.observationSequence.start();
  }

  private showObservationBeat(index: number, ready: () => void) {
    const beat = this.observation[index];
    this.observationIndex = index;
    this.storyStep = beat.id;
    this.nextBeat = undefined;
    this.setSpots([]);
    this.cinemaControls(false);
    if (beat.courtyard) {
      this.hideCloseup();
      this.currentShot = '';
      // Show the actual doorway-to-courtyard movement before the discovery art.
      // The parents and unbound Kyra remain large enough to read above dialogue.
      this.areaRoot.setScale(2.3).setPosition(320 - 271 * 2.3, 219 - 207 * 2.3);
    }
    if (beat.shot && !beat.shotAfterAction) { this.showCloseup(beat.shot, beat.shotOptions); this.currentShot = beat.shot; }
    this.publishProgress(false);
    this.caption(beat.line, beat.speaker?.());
    this.setCloseupContinue(null);
    const complete = () => {
      if (this.observationSequence?.snapshot.status !== 'active' || this.observationIndex !== index) return;
      if (beat.shot && beat.shotAfterAction && this.textures.exists(beat.shot)) {
        this.showCloseup(beat.shot, beat.shotOptions); this.currentShot = beat.shot;
      }
      // Preserve the reader's typing/reveal progress when the animation ends.
      ready();
      this.readyToContinue(this.observationSequence!.continuation());
    };
    if (beat.action) beat.action(complete); else complete();
  }

  private bringKyra(done: () => void) {
    const captor = this.addActor('warrior', 0, [273, 177]).setTint(0xc9c9c9).setName('raid-captor');
    this.raiders.push(captor);
    this.kyra = this.person(0, [282, 177], 'woman').setName('raid-kyra');
    this.faceTowards(captor, this.kyra.x);
    this.tweens.add({ targets: [captor, this.kyra], y: 216, duration: motionDuration(950), ease: 'Sine.inOut',
      onUpdate: () => this.faceTowards(captor, this.kyra!.x), onComplete: () => {
      this.kyra?.setScale(0.88, 0.75);
      this.browWound = this.add.rectangle(284, 188, 2, 2, 0x87574e).setDepth(240);
      this.areaRoot.add(this.browWound);
      done();
    } });
  }

  private intimidateFather(done: () => void) {
    this.faceTowards(this.leader, this.father.x);
    this.tweens.add({ targets: this.leader, x: 282, y: 207, duration: motionDuration(250), onComplete: () => {
      this.tweens.add({ targets: this.father, x: 287, duration: motionDuration(120), yoyo: true, onComplete: done });
    } });
  }

  private inspectHands(done: () => void) {
    this.faceTowards(this.leader, this.kyra!.x);
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
    this.faceTowards(this.leader, this.father.x);
    this.tweens.add({ targets: this.leader, x: 281, y: 207, duration: motionDuration(350), onComplete: () => {
      this.drawDagger(281);
      this.silhouetteFall(this.father, done);
      const book = this.add.graphics().setDepth(701);
      book.fillStyle(0x6a523b).fillRect(110, 183, 7, 5);
      book.fillStyle(0xd4c6a0).fillRect(111, 184, 5, 2);
      this.areaRoot.add(book);
      setCampaignFlag(state(this.registry), 'parentDeath');
      this.refreshLiaAppearance();
    } });
  }

  private bindKyra(done: () => void) {
    this.browWound?.destroy();
    this.kyra!.setScale(1);
    const captor = this.raiders[4], axeman = this.raiders[1];
    this.tweens.add({ targets: captor, x: 296, y: 214, duration: motionDuration(300),
      onUpdate: () => this.faceTowards(captor, this.kyra!.x) });
    this.tweens.add({ targets: axeman, x: 272, y: 215, duration: motionDuration(300),
      onUpdate: () => this.faceTowards(axeman, this.kyra!.x) });
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
    this.publishProgress(false);
    this.setSpots([]);
    this.setObjective('Die Reiter vorbeiziehen lassen.');
    this.lia.setAlpha(0.45);
    this.raiders.forEach((rider, index) => {
      const mount = this.add.container(312 + index * 30, 210 + index % 2 * 6).setDepth(240 + index);
      this.areaRoot.add(mount);
      if (this.textures.exists('raid-horse')) {
        const horse = this.add.sprite(0, 0, 'raid-horse', index % 4).setOrigin(0.5, 60 / 64);
        mount.add(horse);
        if (this.anims.exists('raid-horse-walk')) horse.play({ key: 'raid-horse-walk', startFrame: index % 4 });
      }
      // The rider and captive travel together along the Hohlweg past Lia's cover.
      mount.add(rider);
      rider.setPosition(0, -15).setOrigin(0.5, 0.8).setScale(0.82).setFlipX(true);
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
    setSceneMusic(this, 'grief');
    this.beat = 'parents';
    this.storyStep = 'seek-parents';
    this.observationIndex = -1;
    this.currentShot = '';
    this.publishProgress(false);
    this.hideCloseup();
    this.setLiaPose(null);
    this.setLiaCrouched(false);
    this.setCinematic(false);
    this.areaRoot.setScale(1).setPosition(0, 0);
    this.speakerMark?.destroy();
    this.speakerMark = undefined;
    this.data.set({ 'mobile:controls': null, 'mobile:dialogue': '', 'mobile:thought': '' });
    this.changeArea({ ...RAID_AREA, start: [104, 185] });
    this.lia.setAlpha(1);
    this.setLocked(true);
    this.setCinematic(true);
    this.mother = this.person(3, [257, 196], 'woman').setOrigin(0.5).setAngle(-90).setScale(0.76).setTint(0x737c78);
    this.father = this.person(4, [279, 196], 'warrior').setOrigin(0.5).setAngle(-90).setScale(0.76).setTint(0x737c78);
    this.setSpots([]);
    this.setLiaPose('lia-grieve');
    this.setObjective('Einen Moment bleiben.');
    this.showTears(0);
  }

  private showTears(index: number) {
    const beat = RAID_GRIEF_BEATS[index];
    this.storyStep = beat.id;
    this.caption(beat.line);
    this.readyToContinue(() => {
      if (index + 1 < RAID_GRIEF_BEATS.length) { this.showTears(index + 1); return; }
      this.hideCloseup();
      this.setLiaPose(null);
      this.setLocked(false);
      this.setCinematic(false);
      this.storyStep = 'seek-parents';
      this.publishProgress(false);
      this.data.set({ 'mobile:controls': null, 'mobile:dialogue': '', 'mobile:thought': '' });
      this.setObjective('Die Eltern auf dem Hof aufsuchen.');
      this.setSpots([{ ...RAID_AREA.targets[1], onUse: () => this.vow() }]);
    }, beat.label);
  }

  private vow() {
    if (this.beat !== 'parents') return;
    this.beat = 'vow';
    this.setLocked(true);
    this.setCinematic(true);
    this.setLiaPose('lia-grieve');
    this.storyStep = 'parents-aftermath';
    this.currentShot = 'cinematic-raid-parents-aftermath';
    this.showCloseup(this.currentShot, { fit: 'contain' });
    this.say('', 0);
    setCampaignFlags(state(this.registry), { raidWitnessed: true, parentsLost: true, kyraTaken: true });
    this.setObjective('Bei den Eltern bleiben.');
    this.setSpots([]);
    this.cinemaControls(false);
    this.publishProgress(false);
    this.showParentsGrief(0);
  }

  private showParentsGrief(index: number) {
    const beat = PARENTS_GRIEF_BEATS[index];
    this.storyStep = beat.id;
    this.caption(beat.line);
    this.readyToContinue(() => {
      if (index + 1 < PARENTS_GRIEF_BEATS.length) { this.showParentsGrief(index + 1); return; }
      this.storyStep = 'complete';
      this.publishProgress(false);
      this.setSpots([]);
      this.goTo('aftermath');
    }, beat.label);
  }
}
