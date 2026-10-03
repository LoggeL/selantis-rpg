import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { RAID_APPROACH_AREA, RAID_AREA } from '../story/areas/raid';
import type { Pt } from '../story/types';
import { state } from '../world/quests';
import { motionDuration } from '../settings';

type Beat = 'approach' | 'hidden' | 'kyra' | 'loss' | 'departure' | 'parents' | 'vow' | 'busy';

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

  constructor() { super('raid'); }

  create() {
    this.beat = 'approach';
    this.raiders = [];
    this.kyra = undefined;
    this.browWound = undefined;
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
    this.mother = this.person(3, [259, 194], 'woman').setScale(0.82, 0.65);
    this.father = this.person(4, [283, 195], 'warrior').setScale(0.85, 0.67);
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
    this.lia.stop().play('lia-idle-e');
    this.tweens.add({ targets: this.lia, x: 104, y: 182, duration: motionDuration(330), onComplete: () => {
      this.lia.setAlpha(0.72);
      // Foreground grass conceals Lia's feet without replacing the farm artwork.
      this.cover = this.add.graphics().setDepth(700);
      this.cover.fillStyle(0x344d25, 0.94);
      for (let x = 87; x <= 120; x += 4) this.cover.fillTriangle(x, 185, x + 3, 185, x + 2, 174 - x % 7);
      this.areaRoot.add(this.cover);
      this.beat = 'hidden';
      this.setObjective('In Deckung bleiben und den Hof beobachten.');
      this.say('Dunkelschatten.', 1600);
      this.observationSpot('Geschehen beobachten', () => this.bringKyra());
    } });
  }

  private observationSpot(label: string, onUse: () => void) {
    this.setSpots([{ id: 'observe', at: [104, 182], radius: 18, label, onUse }]);
  }

  private bringKyra() {
    this.beat = 'busy';
    this.setSpots([]);
    const captor = this.addActor('warrior', 8, [273, 177]).setTint(0xc9c9c9);
    this.raiders.push(captor);
    this.kyra = this.person(0, [282, 177], 'woman');
    this.tweens.add({ targets: [captor, this.kyra], y: 216, duration: motionDuration(1100), ease: 'Sine.inOut' });
    this.time.delayedCall(1250, () => {
      this.kyra?.setScale(0.88, 0.75);
      this.browWound = this.add.rectangle(284, 188, 2, 2, 0x87574e).setDepth(240);
      this.areaRoot.add(this.browWound);
      this.beat = 'kyra';
      this.say('Kyra ist verletzt.', 1800);
      this.observationSpot('Weiter beobachten', () => this.parentsKilled());
    });
  }

  private parentsKilled() {
    this.beat = 'busy';
    this.setSpots([]);
    this.setObjective('Still bleiben.');
    this.say('Lasst sie in Ruhe!', 1600);
    this.tweens.add({ targets: this.leader, x: 281, y: 207, duration: motionDuration(450) });
    this.time.delayedCall(550, () => {
      // A brief local silhouette hides the blade contact, with no gore or battle interaction.
      this.dagger = this.add.graphics().setDepth(280);
      this.dagger.lineStyle(2, 0xc2c7c5).lineBetween(281, 182, 289, 178);
      this.areaRoot.add(this.dagger);
      this.silhouetteFall(this.father);
      const book = this.add.graphics().setDepth(701);
      book.fillStyle(0x6a523b).fillRect(110, 183, 7, 5);
      book.fillStyle(0xd4c6a0).fillRect(111, 184, 5, 2);
      this.areaRoot.add(book);
    });
    this.time.delayedCall(1400, () => {
      this.browWound?.destroy();
      if (this.textures.exists('story-actors')) this.kyra?.setFrame(1);
      this.kyra?.setScale(1).setPosition(288, 215);
      this.tweens.add({ targets: this.kyra, x: 282, duration: motionDuration(130), yoyo: true, repeat: 2 });
      const captor = this.raiders[4];
      this.tweens.add({ targets: captor, x: 296, y: 218, duration: motionDuration(350) });
      // Kyra's injured atlas pose has wrists behind her; a small cord is added only now.
      const cord = this.add.graphics().setDepth(220);
      cord.lineStyle(2, 0x9b8060).lineBetween(285, 202, 291, 202);
      this.areaRoot.add(cord);
      this.time.delayedCall(800, () => cord.destroy());
      this.tweens.add({ targets: this.leader, x: 260, duration: motionDuration(400) });
    });
    this.time.delayedCall(2100, () => {
      this.dagger?.setPosition(-21, 0);
      this.silhouetteFall(this.mother);
    });
    this.time.delayedCall(2900, () => {
      this.dagger?.destroy();
      this.dagger = undefined;
      this.beat = 'loss';
      this.say('Ich kann ihnen nicht helfen.', 1800);
      this.observationSpot('Tiefer in Deckung bleiben', () => this.depart());
    });
  }

  private silhouetteFall(actor: Phaser.GameObjects.Image) {
    const shade = this.add.rectangle(actor.x, actor.y - 18, 42, 46, 0x171b19, 0).setDepth(750);
    this.areaRoot.add(shade);
    this.tweens.add({ targets: shade, alpha: 0.96, duration: 140, yoyo: true, hold: 230,
      onYoyo: () => actor.setAngle(-90).setScale(0.76).setOrigin(0.5).setY(actor.y + 1).setTint(0x737c78),
      onComplete: () => shade.destroy(),
    });
  }

  private depart() {
    this.beat = 'departure';
    this.setSpots([]);
    this.setObjective('Die Reiter vorbeiziehen lassen.');
    this.say('Kyra!', 1600);
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
    this.time.delayedCall(2850, () => this.emptyFarm());
  }

  private emptyFarm() {
    this.beat = 'parents';
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
    this.lia.stop().play('lia-idle-n');
    this.lia.setScale(1, 0.78);
    this.say('Ich werde dich finden, Kyra.', 2700);
    const flags = state(this.registry).flags;
    flags.raidWitnessed = true;
    flags.parentsLost = true;
    flags.kyraTaken = true;
    this.setObjective('Bei den Eltern bleiben.');
    this.setSpots([]);
    this.time.delayedCall(900, () => this.setSpots([{
      id: 'night', at: [this.lia.x, this.lia.y], radius: 20, label: 'Bei den Eltern bleiben',
      onUse: () => { this.setSpots([]); this.goTo('aftermath'); },
    }]));
  }
}
