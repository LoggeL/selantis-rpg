import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { FARM_DAWN_AREA, FARM_INTERIOR_AREA } from '../story/areas/aftermath';
import type { ItemId, Pt } from '../world/maps';
import { state, type WorldState } from '../world/quests';
import { ambientPrefs, motionDuration } from '../settings';
import { ITEM_FRAME } from '../inventory';
import type { StorySpot } from '../story/types';
import { FIELD_DEPARTURE } from '../story/travel';
import { AFTERMATH_GRIEF_BEATS, needsAftermathGrief } from '../story/grief';

const PACK_FLAGS = ['packedFood', 'packedWater', 'foundCache', 'packedMedicine', 'packedClothes', 'packedBooks'] as const;
type PackFlag = typeof PACK_FLAGS[number];
const HOUSE_FLAGS: Record<string, PackFlag> = {
  food: 'packedFood', water: 'packedWater', cupboard: 'foundCache', medicine: 'packedMedicine', clothing: 'packedClothes', books: 'packedBooks',
};
const HOUSE_PROPS: { flag: PackFlag; texture: string; at: Pt; size: Pt; items: { item: ItemId; at: Pt; size?: number }[] }[] = [
  { flag: 'packedFood', texture: 'house-prop-food', at: [433, 126], size: [80, 28], items: [
    { item: 'proviant', at: [412, 127], size: 22 }, { item: 'proviant', at: [433, 127], size: 22 }, { item: 'proviant', at: [454, 127], size: 22 },
  ] },
  { flag: 'packedWater', texture: 'house-prop-water', at: [519, 128], size: [38, 34], items: [{ item: 'wasserschlauch', at: [518, 131], size: 28 }] },
  { flag: 'foundCache', texture: 'house-prop-cache', at: [551, 175], size: [44, 24], items: [
    { item: 'silber', at: [540, 174], size: 20 }, { item: 'dolch', at: [558, 173], size: 24 },
  ] },
  { flag: 'packedMedicine', texture: 'house-prop-medicine', at: [112, 141], size: [48, 24], items: [{ item: 'heilzeug', at: [112, 141], size: 28 }] },
  { flag: 'packedClothes', texture: 'house-prop-clothes', at: [110, 216], size: [45, 55], items: [{ item: 'reisezeug', at: [110, 209], size: 32 }] },
  { flag: 'packedBooks', texture: 'house-prop-books', at: [290, 155], size: [46, 24], items: [
    { item: 'buch-kraeuter', at: [279, 155], size: 20 }, { item: 'buch-alana', at: [300, 155], size: 20 },
  ] },
];

/** Roman S. 18-22: Was Lia nach der langen Nacht noch für den Aufbruch braucht. */
export class AftermathScene extends StoryScene {
  private st!: WorldState;
  private inside = false;
  private door?: Phaser.GameObjects.Graphics;
  private gate?: Phaser.GameObjects.Graphics;
  private pigs: Phaser.GameObjects.Sprite[] = [];
  private houseItems = new Map<PackFlag, Phaser.GameObjects.Image[]>();
  private houseSpots: StorySpot[] = [];
  private griefNight?: Phaser.GameObjects.Rectangle;
  private griefIndex = -1;
  private griefReady = false;

  constructor() { super('aftermath'); }

  create(data: { from?: string; at?: Pt } = {}) {
    this.st = state(this.registry);
    for (const flag of ['raidWitnessed', 'kyraTaken', 'parentsLost']) {
      if (this.st.flags[flag] === undefined) this.st.flags[flag] = true;
    }
    this.inside = false;
    this.pigs = [];
    this.houseItems.clear();
    this.houseSpots = [];
    this.griefNight = undefined;
    this.griefIndex = -1;
    this.griefReady = false;
    this.begin(data.at ? { ...FARM_DAWN_AREA, start: data.at } : FARM_DAWN_AREA);
    this.configure();
    if (needsAftermathGrief(this.st, data)) this.beginGrief();
    else {
      this.publishGrief(false);
      this.say(data.from ? 'So still war es hier noch nie.' : 'Die Gräber sind fertig. Jetzt muss ich für die Suche nach Kyra packen.');
    }
  }

  private beginGrief() {
    this.setSpots([]);
    this.setLocked(true);
    this.setCinematic(true);
    this.inventory.close();
    this.say('', 0);
    this.griefNight = this.add.rectangle(320, 180, 640, 360, 0x000000)
      .setDepth(905).setScrollFactor(0);
    this.showGriefBeat(0);
  }

  private publishGrief(active: boolean) {
    const beat = AFTERMATH_GRIEF_BEATS[this.griefIndex];
    this.data.set('story:grief', { active, index: this.griefIndex, total: AFTERMATH_GRIEF_BEATS.length,
      step: active ? beat?.id : 'complete', phase: active ? beat?.phase : 'farm', ready: active && this.griefReady });
  }

  private showGriefBeat(index: number) {
    const beat = AFTERMATH_GRIEF_BEATS[index];
    this.griefIndex = index;
    this.griefReady = false;
    this.setCloseupContinue(null);
    this.publishGrief(true);
    const ready = () => {
      // A fade only exposes the current card; it never advances the story.
      if (this.griefIndex !== index) return;
      this.griefReady = true;
      this.publishGrief(true);
      this.setCloseupContinue(() => {
        if (!this.griefReady || this.griefIndex !== index) return;
        this.griefReady = false;
        this.setCloseupContinue(null);
        if (index + 1 < AFTERMATH_GRIEF_BEATS.length) this.showGriefBeat(index + 1);
        else this.finishGrief();
      }, beat.label ?? 'Weiter');
    };
    const firstDawn = beat.phase === 'dawn' && AFTERMATH_GRIEF_BEATS[index - 1]?.phase === 'night';
    if (firstDawn) {
      this.setLiaPose('lia-grieve');
      this.showCloseup('cut-family-graves', { fit: 'contain' });
    }
    if (beat.id === 'dawn-farewell') this.setLiaPose(null);
    this.setCloseupText(beat.line);
    const duration = firstDawn ? motionDuration(900) : 0;
    if (duration && this.griefNight) this.tweens.add({ targets: this.griefNight, alpha: 0, duration, ease: 'Sine.inOut', onComplete: ready });
    else {
      if (firstDawn) this.griefNight?.setAlpha(0);
      ready();
    }
  }

  private finishGrief() {
    this.st.flags.aftermathGriefSeen = true;
    this.griefNight?.destroy();
    this.griefNight = undefined;
    this.hideCloseup();
    this.setLiaPose(null);
    this.setLocked(false);
    this.setCinematic(false);
    this.publishGrief(false);
    this.data.set({ 'mobile:controls': null, 'mobile:dialogue': '', 'mobile:thought': '' });
    // Intro farewell does not consume either optional grave interaction.
    this.setSpots([]);
    this.configure();
  }

  private configure() {
    this.door = undefined;
    this.gate = undefined;
    this.pigs = [];
    // changeArea owns destruction; do not retain any objects from the previous room.
    this.houseItems.clear();
    this.houseSpots = [];
    if (this.inside) this.configureHouse();
    else this.configureFarm();
    this.refreshProgress();
  }

  private configureHouse() {
    const targets = FARM_INTERIOR_AREA.targets;
    const uses: Record<string, () => void> = {
      food: () => this.pack('packedFood', [['proviant', 1]], 'Speck, ein halber Laib Käse, zwei Brote. Alles in den Lederbeutel vom Ofen. Das muss fürs Erste reichen.'),
      water: () => this.pack('packedWater', [['wasserschlauch', 1]], 'Den Wasserschlauch hänge ich mir um.'),
      cupboard: () => this.pack('foundCache', [['kupfer', 22], ['silber', 7], ['dolch', 1]], 'Vaters doppelter Boden. Den haben sie nicht gefunden: 22 Kupfer, 7 Silber. Und sein Dolch.'),
      medicine: () => this.pack('packedMedicine', [['heilzeug', 1]], 'Mutters Kräutertinktur. Damit hat sie uns jede Schramme versorgt. Die nehme ich mit, und Leinen dazu.'),
      clothing: () => this.pack('packedClothes', [['reisezeug', 1]], 'Ich binde die Haare zurück und ziehe die Lederschuhe an. Der grüne Regenmantel und die Wolldecke kommen in die Tasche.'),
      books: () => this.pack('packedBooks', [['buch-kraeuter', 1], ['buch-alana', 1]], 'Alanas Geschichte und Cronibus Kräuterlexikon kommen in die Tasche.'),
      'exit-door': () => this.leaveHouse(),
    };
    const labels: Record<string, string> = {
      food: 'Proviant einpacken', water: 'Wasserschlauch mitnehmen', cupboard: 'Geheimfach öffnen',
      medicine: 'Heilzeug einpacken', clothing: 'Reisefertig machen', books: 'Bücher einpacken', 'exit-door': 'Zum Hof',
    };
    this.houseSpots = targets.map(target => ({ ...target, label: labels[target.id], onUse: uses[target.id] }));
    this.refreshHouseTargets();
    for (const prop of HOUSE_PROPS) {
      if (this.st.flags[prop.flag]) continue;
      const images = this.textures.exists(prop.texture)
        ? [this.add.image(...prop.at, prop.texture).setDisplaySize(...prop.size)]
        : prop.items.map(({ item, at, size = 24 }) => this.add.image(...at, 'story-items', ITEM_FRAME[item]).setDisplaySize(size, size));
      for (const image of images) { image.setDepth(prop.at[1] + 1); this.areaRoot.add(image); }
      this.houseItems.set(prop.flag, images);
    }
  }

  private refreshHouseTargets() {
    // Remove the pickup marker and action too, so the emptied place stays empty.
    this.setSpots(this.houseSpots.filter(spot => !HOUSE_FLAGS[spot.id] || !this.st.flags[HOUSE_FLAGS[spot.id]]));
  }

  private configureFarm() {
    const targets = FARM_DAWN_AREA.targets;
    const uses: Record<string, () => void> = {
      'grave-mother': () => this.showDetail('cut-family-graves', 'Danke, Mutter. Für alles. Auch fürs Lesenlernen.', () => { this.st.picked['farewell-mother'] = true; }),
      'grave-father': () => this.showDetail('cut-family-graves', 'Danke, Vater. Ich werde alles tun, um Kyra zu finden.', () => { this.st.picked['farewell-father'] = true; }),
      door: () => {
        if (this.packed() && !this.st.flags.houseClosed) {
          this.st.flags.houseClosed = true;
          this.refreshProgress();
          this.say('Langsam ziehe ich die Tür zu.');
        } else this.enterHouse();
      },
      'pig-gate': () => this.releasePigs(),
      'east-departure': () => this.depart(),
      backtrack: () => this.scene.start('world', { map: 'hohlweg', from: 'hof' }),
    };
    const labels: Record<string, string> = {
      'grave-mother': 'Bei Mutter', 'grave-father': 'Bei Vater',
      door: this.packed() && !this.st.flags.houseClosed ? 'Tür schließen' : 'Haus betreten',
      'pig-gate': this.st.flags.pigsReleased ? 'Offenes Gatter' : 'Die Schweine freilassen',
      'east-departure': 'Zu den Feldern',
      backtrack: 'Zum Hohlweg',
    };
    this.setSpots(targets.map(target => ({
      ...target, label: labels[target.id], onUse: uses[target.id],
      markerVisible: () => target.id === 'pig-gate' ? !this.st.flags.pigsReleased
        : target.id === 'door' ? !this.st.flags.houseClosed
        : target.id === 'grave-mother' ? !this.st.picked['farewell-mother']
        : target.id === 'grave-father' ? !this.st.picked['farewell-father'] : true,
    })));
    this.door = this.add.graphics().setDepth(176);
    this.gate = this.add.graphics().setDepth(100);
    this.areaRoot.add([this.door, this.gate]);
    if (this.textures.exists('crt-pig')) {
      const positions: Pt[] = this.st.flags.pigsReleased ? [[72, 189], [96, 201], [119, 209]] : [[176, 74], [212, 78], [245, 82]];
      this.pigs = positions.map(at => {
        const pig = this.add.sprite(at[0], at[1], 'crt-pig', 0).setOrigin(0.5, 29 / 32).setDepth(at[1]);
        this.areaRoot.add(pig);
        if (this.anims.exists('pig-idle')) pig.play('pig-idle');
        return pig;
      });
    }
  }

  private enterHouse() {
    this.st.flags.houseClosed = false;
    this.st.flags.departureReady = false;
    this.tweens.killTweensOf(this.pigs);
    this.inside = true;
    this.changeArea(FARM_INTERIOR_AREA);
    this.configure();
  }

  private leaveHouse() {
    this.inside = false;
    this.st.flags.houseClosed = this.packed();
    this.changeArea({ ...FARM_DAWN_AREA, start: [273, 198] });
    this.configure();
    if (this.st.flags.houseClosed) this.say('Langsam ziehe ich die Tür hinter mir zu. Rechts liegen die Gräber.');
  }

  private pack(flag: PackFlag, items: [ItemId, number][], thought: string) {
    if (this.st.flags[flag]) { this.say('Das habe ich schon erledigt.'); return; }
    this.st.flags[flag] = true;
    for (const [item, count] of items) this.st.inv[item] = (this.st.inv[item] ?? 0) + count;
    for (const image of this.houseItems.get(flag) ?? []) image.destroy();
    this.houseItems.delete(flag);
    if (this.inside) this.refreshHouseTargets();
    this.inventory.refresh(this.st.inv);
    this.refreshProgress();
    this.refreshLiaAppearance();
    this.say(thought, 4500);
  }

  /** The graves remain an optional farewell; ordinary packing stays in the room. */
  private showDetail(texture: string, text: string, complete?: () => void) {
    if (!this.textures.exists(texture)) { this.say(text); complete?.(); return; }
    this.say('', 0);
    this.setLiaPose(texture === 'cut-family-graves' ? 'lia-grieve' : 'lia-pack');
    this.showCloseup(texture);
    this.setCloseupText(text);
    this.setCloseupContinue(() => { this.hideCloseup(); this.setLiaPose(null); complete?.(); }, 'Zurück');
  }

  private releasePigs() {
    if (this.st.flags.pigsReleased) { this.say('Das Gatter bleibt offen.'); return; }
    this.st.flags.pigsReleased = true;
    this.refreshProgress();
    this.say('Macht\'s gut. Ihr seid jetzt auf euch gestellt. … Ich rede mit Schweinen.');
    if (ambientPrefs().reducedMotion) {
      this.pigs.forEach((pig, index) => pig.setPosition(72 + index * 24, 189 + index * 10).setDepth(189 + index * 10));
      return;
    }
    this.pigs.forEach((pig, index) => {
      if (this.anims.exists('pig-walk')) pig.play('pig-walk');
      const onUpdate = () => pig.setDepth(pig.y);
      this.tweens.chain({
        targets: pig,
        tweens: [
          // Zuerst entlang der Innenseite des Zauns, dann durch das Tor.
          { x: 154, y: 74, duration: 1800 + index * 350, delay: index * 300, onUpdate },
          { x: 154, y: 108, duration: 1200, onUpdate },
          { x: 154, y: 188, duration: 2300, onUpdate },
          { x: 72 + index * 24, y: 189 + index * 10, duration: 2300, onUpdate },
        ],
        onComplete: () => { if (pig.active && this.anims.exists('pig-idle')) pig.play('pig-idle'); },
      });
    });
  }

  private packed() { return PACK_FLAGS.every(flag => this.st.flags[flag]); }

  private nextStep() {
    if (!this.st.flags.packedMedicine) return 'Mutters Tinktur und Leinen nehme ich noch für unterwegs mit.';
    if (!this.st.flags.packedFood) return 'Im Haus liegt noch Proviant. Den brauche ich.';
    if (!this.st.flags.packedWater) return 'Den Wasserschlauch im Haus darf ich nicht vergessen.';
    if (!this.st.flags.foundCache) return 'Vaters Geheimfach im Küchenschrank. Vielleicht ist dort noch etwas.';
    if (!this.st.flags.packedClothes) return 'Schuhe, Mantel und Decke fehlen noch.';
    if (!this.st.flags.packedBooks) return 'Die beiden Bücher nehme ich noch mit.';
    if (!this.st.flags.houseClosed) return 'Die Haustür will ich noch schließen.';
    if (!this.st.flags.pigsReleased) return 'Gefüttert habe ich die Schweine nicht mehr. Eingesperrt lasse ich sie nicht zurück.';
    return 'Die Hufspuren führen über die Felder zum Nebenweg nach Osten. Dort suche ich weiter nach Kyra.';
  }

  private depart() {
    this.refreshProgress();
    if (this.st.flags.departureReady) this.st.flags.aftermathComplete = true;
    this.scene.start('world', FIELD_DEPARTURE);
  }

  private refreshProgress() {
    const count = PACK_FLAGS.filter(flag => this.st.flags[flag]).length;
    this.st.flags.departureReady = this.packed() && !!this.st.flags.houseClosed && !!this.st.flags.pigsReleased;
    this.setObjective(this.st.flags.departureReady ? 'Über die Felder den Hufspuren nach Osten folgen.' : this.packed()
      ? !this.st.flags.houseClosed ? 'Die Haustür schließen.' : 'Die drei Schweine freilassen.'
      : `Für den Aufbruch packen (${count}/${PACK_FLAGS.length}).`);
    if (this.door) {
      this.door.clear().fillStyle(this.st.flags.houseClosed ? 0x6d5034 : 0x171b21).fillRect(264, 151, 18, 23);
      if (this.st.flags.houseClosed) this.door.fillStyle(0x987349).fillRect(268, 153, 1, 19).fillRect(273, 153, 1, 19).fillRect(278, 153, 1, 19);
      else this.door.fillStyle(0x6d5034).fillRect(282, 152, 4, 22);
    }
    if (this.gate) {
      this.gate.clear();
      if (this.st.flags.pigsReleased) {
        // Die gemalten Querlatten überdecken, damit der offene Durchgang sichtbar ist.
        this.gate.fillStyle(0x675132).fillRect(149, 82, 17, 18);
        this.gate.fillStyle(0x7c623a).fillRect(151, 86, 3, 2).fillRect(158, 91, 4, 2).fillRect(151, 97, 4, 2);
        this.gate.fillStyle(0x8d7352).fillRect(143, 80, 3, 18).fillRect(144, 82, 7, 2);
      } else this.gate.fillStyle(0x8d7352).fillRect(143, 86, 24, 3).fillRect(143, 93, 24, 3).fillRect(145, 81, 3, 19).fillRect(163, 81, 3, 19);
    }
  }
}
