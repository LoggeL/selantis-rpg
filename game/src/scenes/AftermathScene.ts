import Phaser from 'phaser';
import { StoryScene } from '../story/StoryScene';
import { FARM_DAWN_AREA, FARM_INTERIOR_AREA } from '../story/areas/aftermath';
import type { ItemId, Pt } from '../world/maps';
import { state, type WorldState } from '../world/quests';
import { ambientPrefs } from '../settings';

const PACK_FLAGS = ['packedFood', 'packedWater', 'foundCache', 'heelTreated', 'packedClothes', 'packedBooks'] as const;
type PackFlag = typeof PACK_FLAGS[number];

/** Roman S. 18-22: Was Lia nach der langen Nacht noch für den Aufbruch braucht. */
export class AftermathScene extends StoryScene {
  private st!: WorldState;
  private inside = false;
  private badges: { flag: string; graphics: Phaser.GameObjects.Graphics; at: Pt }[] = [];
  private door?: Phaser.GameObjects.Graphics;
  private gate?: Phaser.GameObjects.Graphics;
  private pigs: Phaser.GameObjects.Sprite[] = [];

  constructor() { super('aftermath'); }

  create() {
    this.st = state(this.registry);
    for (const flag of ['raidWitnessed', 'kyraTaken', 'parentsLost']) {
      if (this.st.flags[flag] === undefined) this.st.flags[flag] = true;
    }
    this.inside = false;
    this.badges = [];
    this.pigs = [];
    this.begin(FARM_DAWN_AREA);
    this.configure();
    this.say('Die Steingräber sind fertig. Meine Hände und Füße brennen.');
  }

  private configure() {
    this.badges = [];
    this.door = undefined;
    this.gate = undefined;
    this.pigs = [];
    if (this.inside) this.configureHouse();
    else this.configureFarm();
    this.refreshProgress();
  }

  private configureHouse() {
    const targets = FARM_INTERIOR_AREA.targets;
    const uses: Record<string, () => void> = {
      food: () => this.pack('packedFood', [['proviant', 1]], 'Speck, ein halber Käse, zwei Brote. In den Lederbeutel neben dem Ofen.'),
      water: () => this.pack('packedWater', [['wasserschlauch', 1]], 'Den Wasserschlauch hänge ich mir um.'),
      cupboard: () => this.pack('foundCache', [['kupfer', 22], ['silber', 7], ['dolch', 1]], 'Vaters doppelter Boden: 22 Kupfer, 7 Silber. Und sein Dolch in der Scheide.'),
      medicine: () => this.pack('heelTreated', [['heilzeug', 1]], 'Mutters Tinktur auf Lakenstreifen. Vorsichtig um die wunde Ferse.'),
      clothing: () => {
        if (!this.st.flags.heelTreated) { this.say('Erst die Ferse verbinden. Mutters Tinktur steht im Medizinschrank.'); return; }
        this.pack('packedClothes', [['reisezeug', 1]], 'Haarband, Lederschuhe. Den grünen Regenmantel und die Wolldecke nehme ich mit.');
      },
      books: () => this.pack('packedBooks', [['buch-kraeuter', 1], ['buch-alana', 1]], 'Cronibus Kräuterlexikon. Und Alana, die Geschichte wollte ich noch zu Ende lesen.'),
      'exit-door': () => this.leaveHouse(),
    };
    const labels: Record<string, string> = {
      food: 'Proviant einpacken', water: 'Wasserschlauch mitnehmen', cupboard: 'Geheimfach öffnen',
      medicine: 'Ferse verbinden', clothing: 'Reisefertig machen', books: 'Bücher einpacken', 'exit-door': 'Zum Hof',
    };
    this.setSpots(targets.map(target => ({ ...target, label: labels[target.id], onUse: uses[target.id] })));
    const flags: Record<string, PackFlag> = {
      food: 'packedFood', water: 'packedWater', cupboard: 'foundCache', medicine: 'heelTreated', clothing: 'packedClothes', books: 'packedBooks',
    };
    for (const target of targets) if (flags[target.id]) this.badge(flags[target.id], target.at);
  }

  private configureFarm() {
    const targets = FARM_DAWN_AREA.targets;
    const uses: Record<string, () => void> = {
      'grave-mother': () => this.showDetail('cut-family-graves', 'Danke, Mutter.'),
      'grave-father': () => this.showDetail('cut-family-graves', 'Ich werde alles tun, um Kyra zu finden.'),
      door: () => {
        if (this.packed() && !this.st.flags.houseClosed) {
          this.st.flags.houseClosed = true;
          this.refreshProgress();
          this.say('Langsam ziehe ich die Tür zu.');
        } else this.enterHouse();
      },
      'pig-gate': () => this.releasePigs(),
      'east-departure': () => this.depart(),
    };
    const labels: Record<string, string> = {
      'grave-mother': 'Bei Mutter', 'grave-father': 'Bei Vater',
      door: this.packed() && !this.st.flags.houseClosed ? 'Tür schließen' : 'Haus betreten',
      'pig-gate': this.st.flags.pigsReleased ? 'Offenes Gatter' : 'Die Schweine freilassen',
      'east-departure': 'Hohlweg nach Osten',
    };
    this.setSpots(targets.map(target => ({ ...target, label: labels[target.id], onUse: uses[target.id] })));
    this.door = this.add.graphics().setDepth(176);
    this.gate = this.add.graphics().setDepth(100);
    this.areaRoot.add([this.door, this.gate]);
    this.badge('pigsReleased', [154, 108]);
    this.badge('houseClosed', [273, 182]);
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
    if (this.st.flags.houseClosed) this.say('Ich ziehe die Tür hinter mir zu. Die Gräber liegen rechts von mir.');
  }

  private pack(flag: PackFlag, items: [ItemId, number][], thought: string) {
    if (this.st.flags[flag]) { this.say('Das habe ich schon erledigt.'); return; }
    this.st.flags[flag] = true;
    for (const [item, count] of items) this.st.inv[item] = (this.st.inv[item] ?? 0) + count;
    this.inventory.refresh(this.st.inv);
    this.refreshProgress();
    this.showDetail('cut-travel-pack', thought);
  }

  /** Packing and farewell share the chapter's single manual caption control. */
  private showDetail(texture: string, text: string) {
    if (!this.textures.exists(texture)) { this.say(text); return; }
    this.say('', 0);
    this.setLiaPose(texture === 'cut-family-graves' ? 'lia-grieve' : 'lia-pack');
    this.showCloseup(texture);
    this.setCloseupText(text);
    this.setCloseupContinue(() => { this.hideCloseup(); this.setLiaPose(null); }, 'Zurück');
  }

  private releasePigs() {
    if (this.st.flags.pigsReleased) { this.say('Das Gatter bleibt offen.'); return; }
    this.st.flags.pigsReleased = true;
    this.refreshProgress();
    this.say('Macht\'s gut. Ich hoffe, ihr kommt ohne mich klar.');
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
    if (!this.st.flags.heelTreated) return 'Die wunde Ferse braucht Mutters Tinktur im Haus.';
    if (!this.st.flags.packedFood) return 'Im Haus liegt noch Proviant. Den brauche ich.';
    if (!this.st.flags.packedWater) return 'Den Wasserschlauch im Haus darf ich nicht vergessen.';
    if (!this.st.flags.foundCache) return 'Vaters Geheimfach im Küchenschrank. Vielleicht ist dort noch etwas.';
    if (!this.st.flags.packedClothes) return 'Schuhe, Mantel und Decke fehlen noch.';
    if (!this.st.flags.packedBooks) return 'Die beiden Bücher nehme ich noch mit.';
    if (!this.st.flags.houseClosed) return 'Die Haustür will ich noch schließen.';
    if (!this.st.flags.pigsReleased) return 'Die drei Schweine kann ich nicht eingesperrt zurücklassen.';
    return 'Die Dunkelschatten ritten nach Osten. Mehr weiß ich nicht.';
  }

  private depart() {
    this.refreshProgress();
    if (!this.st.flags.departureReady) { this.say(this.nextStep()); return; }
    this.st.flags.aftermathComplete = true;
    this.goTo('journey');
  }

  private badge(flag: string, at: Pt) {
    const graphics = this.add.graphics().setDepth(800);
    this.areaRoot.add(graphics);
    this.badges.push({ flag, graphics, at });
  }

  private refreshProgress() {
    const count = PACK_FLAGS.filter(flag => this.st.flags[flag]).length;
    this.st.flags.departureReady = this.packed() && !!this.st.flags.houseClosed && !!this.st.flags.pigsReleased;
    this.setObjective(this.st.flags.departureReady ? 'Nach Osten aufbrechen.' : this.packed()
      ? !this.st.flags.houseClosed ? 'Die Haustür schließen.' : 'Die drei Schweine freilassen.'
      : `Für den Aufbruch packen (${count}/${PACK_FLAGS.length}).`);
    for (const { flag, graphics, at } of this.badges) {
      const done = !!this.st.flags[flag];
      const x = at[0] - 5, y = at[1] - 25;
      graphics.clear();
      graphics.fillStyle(0x16211e, 0.92).fillRect(x - 3, y - 3, 19, 18);
      // Kleiner Lederbeutel, daneben nach dem Einpacken ein Häkchen.
      graphics.fillStyle(done ? 0x9cad82 : 0xb6986a).fillRect(x, y + 4, 8, 8).fillRect(x + 2, y + 1, 4, 4);
      graphics.fillStyle(0x584936).fillRect(x, y + 4, 8, 1);
      if (done) graphics.fillStyle(0xdce9b8).fillRect(x + 9, y + 8, 2, 3).fillRect(x + 11, y + 6, 2, 3).fillRect(x + 13, y + 4, 2, 3);
    }
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
