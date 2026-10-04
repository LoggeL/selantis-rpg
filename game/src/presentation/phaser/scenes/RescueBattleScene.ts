import Phaser from 'phaser';
import { RESCUE } from '../../../content/encounters/rescue';
import { RescueModel, type RescueAllyId, type RescueUnitId } from '../../../modules/rescue/model';
import { cellAt, cellCenter, eq, inside, key, type Cell } from '../../../modules/combat/grid';
import { bindSceneInput, type SceneInputScope, type InputAction } from '../../../platform/input/router';
import { scenePresentation } from '../../model';
import { usesMobileInterface } from '../../dom/dialogs';
import { resolveLiaAppearance } from '../../../modules/party/appearance';
import { state } from '../../../platform/campaignRegistry';
import type { AssetManifest } from '../../../content/assets/types';
import { FONT } from '../Hud';
import { motionDuration } from '../../../app/settings';
import { setSceneMusic } from '../../../app/audio';

export interface RescueBattleLaunch { onComplete?: (success: boolean) => void }

/** A separate scene keeps the historical Valentus tutorial untouched. */
export class RescueBattleScene extends Phaser.Scene {
  private model = new RescueModel(RESCUE);
  private cursor: Cell = { x: 1, y: 3 };
  private inputScope?: SceneInputScope;
  private controls?: ReturnType<SceneInputScope['setControls']>;
  private sprites = new Map<RescueUnitId, Phaser.GameObjects.Sprite>();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private unitLabels = new Map<RescueUnitId, Phaser.GameObjects.Text>();
  private panelBackdrop!: Phaser.GameObjects.Rectangle;
  private lastMobile?: boolean;
  private panel!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private onComplete?: (success: boolean) => void;
  private exitRequested = false;
  private targetMode = false;
  private animating = false;
  private releaseMovement?: () => void;
  private buttons: Phaser.GameObjects.Container[] = [];

  constructor() { super('rescue-battle'); }
  init(data: RescueBattleLaunch = {}) { this.onComplete = data.onComplete; }
  create() {
    this.model = new RescueModel(RESCUE); this.cursor = { ...this.model.unit('lia').cell };
    this.sprites.clear(); this.unitLabels.clear(); this.buttons = []; this.exitRequested = false; this.targetMode = false; this.animating = false;
    this.controls = undefined;
    this.data.set('rescue:animating', false); this.data.set('rescue:last-enemy-events', []);
    this.add.image(0, 0, 'bg-shadow-camp').setOrigin(0).setDisplaySize(640, 360).setAlpha(.6);
    this.add.rectangle(12, 74, 376, 260, 0x111a1c, .6).setOrigin(0);
    this.panelBackdrop = this.add.rectangle(396, 74, 232, 260, 0x111a1c, .94).setOrigin(0).setStrokeStyle(1, 0x677561);
    this.gridGraphics = this.add.graphics().setDepth(1);
    this.title = this.add.text(20, 12, 'KYRA BEFREIEN', { fontFamily: FONT, fontSize: '20px', color: '#eee7cf' });
    this.add.text(20, 40, 'Flick: Fesseln lösen. Lia: Neben Kyra decken. Dann die Runde halten.',
      { fontFamily: FONT, fontSize: '12px', color: '#d9ddcd', wordWrap: { width: 605 } });
    this.panel = this.add.text(408, 85, '', { fontFamily: FONT, fontSize: '12px', color: '#eee7cf', lineSpacing: 4, wordWrap: { width: 208 } }).setDepth(1000);
    this.message = this.add.text(20, 336, '', { fontFamily: FONT, fontSize: '11px', color: '#fff0b3', wordWrap: { width: 610 } }).setDepth(1000);
    const manifest = this.cache.json.get('manifest') as AssetManifest;
    const liaAppearance = resolveLiaAppearance({ flags: state(this.registry).flags, areaId: 'sisters-reunited', direction: 'e' });
    for (const definition of RESCUE.units) {
      const unit = this.model.unit(definition.id), center = cellCenter(unit.cell, RESCUE.layout);
      const texture = unit.id === 'lia' ? liaAppearance.texture : definition.texture;
      const asset = manifest.assets.find(asset => asset.id === texture), foot = asset?.foot ?? [32, 60];
      const sprite = this.add.sprite(center.x, center.y + 12, texture, definition.frame)
        .setOrigin(foot[0] / (asset?.frameW ?? 64), foot[1] / (asset?.frameH ?? 64))
        .setDisplaySize(definition.display, definition.display).setDepth(center.y);
      if (unit.id === 'lia') sprite.play(liaAppearance.animation);
      if (unit.id === 'flick') sprite.play('flick-idle-s');
      this.sprites.set(unit.id, sprite);
      this.unitLabels.set(unit.id, this.add.text(center.x, center.y + 16, '', { fontFamily: FONT, fontSize: '8px', align: 'center', color: '#ffffff', backgroundColor: '#101613' }).setOrigin(.5, 0).setDepth(900));
    }
    this.inputScope = bindSceneInput(this, {
      'move-left': intent => { if (intent.phase !== 'end') this.moveCursor(-1, 0); },
      'move-right': intent => { if (intent.phase !== 'end') this.moveCursor(1, 0); },
      'move-up': intent => { if (intent.phase !== 'end') this.moveCursor(0, -1); },
      'move-down': intent => { if (intent.phase !== 'end') this.moveCursor(0, 1); },
      confirm: intent => { if (intent.phase !== 'end') this.confirm(); },
      interact: intent => { if (intent.phase !== 'end') this.switchAlly(); },
      beam: intent => { if (intent.phase !== 'end' && !this.exitRequested && this.model.state.phase === 'player') { this.model.guard(); this.targetMode = false; this.render(); } },
      wave: intent => { if (intent.phase !== 'end') this.chooseTarget(); },
      wait: intent => { if (intent.phase !== 'end') this.endRound(); },
      cancel: intent => { if (intent.phase !== 'end') this.cancel(); },
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const cell = cellAt(pointer.worldX, pointer.worldY, RESCUE.board, RESCUE.layout);
      if (this.animating || !cell || this.model.state.phase !== 'player' || this.exitRequested) return;
      this.cursor = cell; this.confirm();
    });
    this.events.once('shutdown', () => { this.releaseMovement?.(); this.releaseMovement = undefined; });
    this.render(); setSceneMusic(this, 'dread');
  }
  private moveCursor(dx: number, dy: number) {
    if (this.model.state.phase !== 'player' || this.exitRequested) return;
    const next = { x: this.cursor.x + dx, y: this.cursor.y + dy };
    if (inside(next, RESCUE.board)) this.cursor = next;
    this.render();
  }
  private switchAlly() {
    if (this.exitRequested) { this.finish(false); return; }
    if (this.model.state.phase === 'won') { this.finish(true); return; }
    if (this.model.state.phase === 'failed') { this.retry(); return; }
    if (this.model.state.phase !== 'player' || this.exitRequested) return;
    this.model.select(this.model.state.selected === 'lia' ? 'flick' : 'lia');
    this.cursor = { ...this.model.unit(this.model.state.selected).cell }; this.targetMode = false; this.render();
  }
  private chooseTarget() {
    if (this.model.state.phase !== 'player' || this.exitRequested) return;
    this.targetMode = true;
    this.model.state.message = this.model.state.selected === 'lia' ? 'Ziel wählen: Wache ablenken oder Kyra warnen.' : 'Ziel wählen: Gegner treffen oder Kyras Fesseln lösen.';
    this.render();
  }
  private confirm() {
    if (this.animating) return;
    if (this.model.state.phase !== 'player' || this.exitRequested) return;
    const moving = this.model.state.selected;
    const path = this.model.paths().get(key(this.cursor));
    const from = { ...this.model.unit(moving).cell };
    const occupant = this.model.state.units.find(unit => !unit.withdrawn && eq(unit.cell, this.cursor));
    if (occupant?.side === 'ally' && !this.targetMode) this.model.select(occupant.id as RescueAllyId);
    else if (occupant) this.model.use(occupant.id);
    else if (this.targetMode) this.model.state.message = 'Wähle eine Wache oder Kyra als Ziel.';
    else this.model.move(this.cursor);
    this.targetMode = false; this.render();
    if (!eq(from, this.model.unit(moving).cell) && path) this.animateMovement(moving, path);
  }
  private animateMovement(id: RescueAllyId, path: Cell[]) {
    const duration = motionDuration(110);
    if (!duration || path.length < 2) return;
    this.animating = true; this.data.set('rescue:animating', true);
    this.releaseMovement = this.inputScope!.lock({ priority: 10, allow: ['settings', 'party'] });
    const sprite = this.sprites.get(id)!;
    const origin = cellCenter(path[0], RESCUE.layout); sprite.setPosition(origin.x, origin.y + 12);
    let step = 1;
    const next = () => {
      if (step === path.length) {
        this.animating = false; this.data.set('rescue:animating', false);
        this.releaseMovement?.(); this.releaseMovement = undefined;
        const profile = id === 'flick' ? 'flick' : sprite.texture.key.replace('-walk', '');
        sprite.play(`${profile}-idle-s`); return;
      }
      const from = path[step - 1], to = path[step++], center = cellCenter(to, RESCUE.layout);
      const direction = to.x > from.x ? 'e' : to.x < from.x ? 'w' : to.y > from.y ? 's' : 'n';
      const profile = id === 'flick' ? 'flick' : sprite.texture.key.replace('-walk', '');
      sprite.play(`${profile}-walk-${direction}`, true);
      this.tweens.add({ targets: sprite, x: center.x, y: center.y + 12, duration, ease: 'Sine.easeInOut', onComplete: next });
    };
    next();
  }
  private endRound() {
    if (this.animating || this.exitRequested || !this.model.beginEnemyTurn()) return;
    this.targetMode = false; this.render();
    this.time.delayedCall(850, () => {
      const events = this.model.resolveEnemyTurn();
      this.data.set('rescue:last-enemy-events', events);
      for (const event of events) if (event.damage && event.target) {
        const sprite = this.sprites.get(event.target)!; sprite.setTint(0xff7676);
        this.time.delayedCall(350, () => sprite.clearTint());
      }
      this.render();
    });
  }
  private cancel() {
    if (this.model.state.phase === 'enemy') return;
    if (this.exitRequested) { this.exitRequested = false; this.render(); return; }
    if (this.model.state.phase === 'failed') { this.finish(false); return; }
    if (this.targetMode) { this.targetMode = false; this.model.state.message = 'Zielauswahl beendet.'; this.render(); return; }
    if (this.model.state.phase === 'won') return;
    this.exitRequested = true; this.render();
  }
  private retry() {
    this.model = new RescueModel(RESCUE); this.cursor = { ...this.model.unit('lia').cell }; this.exitRequested = false; this.targetMode = false;
    for (const sprite of this.sprites.values()) sprite.clearTint().setVisible(true).setAlpha(1);
    this.render();
  }
  private finish(success: boolean) {
    const complete = this.onComplete; this.onComplete = undefined;
    // Shutdown disposes the scope and publication before returning to the chapter.
    this.events.once('shutdown', () => { if (complete) complete(success); });
    if (!complete) this.scene.start('sisters-reunited');
    else this.scene.stop();
  }
  private canvasButton(x: number, y: number, label: string, action: InputAction) {
    let button = this.buttons.find(button => button.x === x && button.y === y);
    if (!button) {
      const box = this.add.rectangle(0, 0, 208, 23, 0x253b3c).setStrokeStyle(1, 0x7c9484).setInteractive({ useHandCursor: true });
      const text = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '11px', color: '#f2eddc' }).setOrigin(.5);
      button = this.add.container(x, y, [box, text]).setDepth(1001);
      const slot = button;
      box.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.inputScope?.dispatch({ action: slot.getData('rescue:action') as InputAction, phase: 'activate', source: 'pointer' });
      });
      this.buttons.push(button);
    }
    // Stable hit targets remain registered with Phaser between rapid clicks.
    // Replacing them during a click leaves new targets pending until preUpdate.
    button.setData('rescue:action', action).setVisible(true);
    (button.list[1] as Phaser.GameObjects.Text).setText(label);
  }
  private render() {
    const st = this.model.state, selected = this.model.unit(st.selected), budget = st.budgets[st.selected];
    const objective = this.exitRequested ? 'Rettungsversuch verlassen? Der Fortschritt bleibt unvollständig.'
      : st.phase === 'won' ? 'Kyra ist frei und geschützt.'
      : st.phase === 'failed' ? 'Rettungsversuch gescheitert. Erneut versuchen.'
      : st.freed ? 'Lia direkt neben Kyra: Decken und die Runde halten.' : 'Flick direkt neben Kyra: Fesseln lösen.';
    this.gridGraphics.clear();
    const paths = st.phase === 'player' && !budget.moved && !this.targetMode ? this.model.paths() : new Map();
    for (let y = 0; y < RESCUE.board.rows; y++) for (let x = 0; x < RESCUE.board.cols; x++) {
      const cell = { x, y }, center = cellCenter(cell, RESCUE.layout), blocked = RESCUE.board.blocked.some(rock => eq(rock, cell));
      this.gridGraphics.fillStyle(blocked ? 0x77776c : paths.has(key(cell)) ? 0x548273 : 0x1b2b26, blocked ? .95 : .55)
        .fillRect(center.x - 19, center.y - 19, 38, 38).lineStyle(1, 0x99b8a4, .35).strokeRect(center.x - 20, center.y - 20, 40, 40);
      if (blocked) this.gridGraphics.lineStyle(2, 0xb8b7a0, .75).lineBetween(center.x - 10, center.y - 10, center.x + 10, center.y + 10).lineBetween(center.x + 10, center.y - 10, center.x - 10, center.y + 10);
    }
    for (const unit of st.units) {
      const center = cellCenter(unit.cell, RESCUE.layout), sprite = this.sprites.get(unit.id)!;
      sprite.setPosition(center.x, center.y + 12).setDepth(center.y).setAlpha(unit.withdrawn ? .35 : 1);
      const color = unit.side === 'enemy' ? 0xe5a195 : unit.id === 'kyra' ? 0xe9cd73 : 0xa7d7ba;
      this.gridGraphics.lineStyle(unit.id === st.selected ? 3 : 1, color, .9).strokeEllipse(center.x, center.y + 9, 28, 10);
      if (unit.id === 'kyra' && !st.freed) this.gridGraphics.lineStyle(2, 0xe0c69b).lineBetween(center.x - 10, center.y - 8, center.x + 10, center.y - 4).lineBetween(center.x - 10, center.y - 4, center.x + 10, center.y - 8);
      if (st.guarding.includes(unit.id as RescueAllyId)) this.gridGraphics.lineStyle(3, 0xc4e7fa).strokeCircle(center.x, center.y - 5, 19);
      this.unitLabels.get(unit.id)!.setPosition(center.x, center.y + 18).setText(`${unit.name}\n${unit.hp}/${unit.maxHp}`).setAlpha(unit.withdrawn ? .6 : 1);
    }
    const cursor = cellCenter(this.cursor, RESCUE.layout);
    this.gridGraphics.lineStyle(3, this.targetMode ? 0xf2bd77 : 0xffefad).strokeRect(cursor.x - 18, cursor.y - 18, 36, 36);
    const allyStatus = `Einsatz-LP: Lia ${this.model.unit('lia').hp}/36 · Flick ${this.model.unit('flick').hp}/40\nKyra ${this.model.unit('kyra').hp}/24 · ${st.freed ? 'frei' : 'gefesselt'}`;
    const turnStatus = `${selected.name}: Bewegung ${budget.moved ? 'verbraucht' : 'frei'} · Aktion ${budget.acted ? 'verbraucht' : 'frei'}`;
    const enemyStatus = st.units.filter(unit => unit.side === 'enemy').map(unit => `${unit.name}: ${unit.withdrawn ? 'zurückgewichen' : `${unit.hp}/${unit.maxHp} LP`}`).join('\n');
    const intents = this.model.intents().map(intent => intent.text).join('\n');
    this.panel.setText(`Runde ${st.round} · ${st.phase === 'enemy' ? 'GEGNERZUG' : st.phase === 'player' ? selected.name.toUpperCase() : st.phase === 'won' ? 'GESCHAFFT' : 'GESCHEITERT'}\n${allyStatus}\n\n${turnStatus.replace(' · ', '\n')}\n\n${enemyStatus}\n${intents}`);
    this.message.setText(st.message);
    this.title.setText(`KYRA BEFREIEN · RUNDE ${st.round}`);
    for (const button of this.buttons) button.setVisible(false);
    const actions = this.exitRequested ? { E: 'Zur Planung', ESC: 'Fortsetzen' }
      : st.phase === 'won' ? { E: 'Geschichte fortsetzen' }
      : st.phase === 'failed' ? { E: 'Erneut versuchen', ESC: 'Zur Planung' }
      : st.phase === 'enemy' ? {} : { E: `${st.selected === 'lia' ? 'Flick' : 'Lia'} wählen`, ...(budget.acted ? {} : { Q: 'Decken', R: st.selected === 'lia' ? 'Ablenken / Warnen' : 'Angriff / Befreien' }), ENTER: 'Feld wählen', SPACE: 'Runde beenden', ESC: 'Abbrechen' };
    const profile = { directions: st.phase === 'player' && !this.exitRequested ? ['up', 'left', 'down', 'right'] as const : [], actions, inventory: false, disabled: st.phase === 'enemy' };
    const normalizedProfile = { ...profile, directions: [...profile.directions] };
    if (this.controls) this.controls.update(normalizedProfile); else this.controls = this.inputScope!.setControls(normalizedProfile);
    if (this.exitRequested) {
      // Rebind terminal choices through the same scene input authority.
      this.canvasButton(512, 271, 'Zur Planung', 'interact');
      this.canvasButton(512, 302, 'Fortsetzen', 'cancel');
    } else if (st.phase === 'won') this.canvasButton(512, 302, 'Geschichte fortsetzen · E', 'interact');
    else if (st.phase === 'failed') { this.canvasButton(512, 271, 'Erneut versuchen · E', 'interact'); this.canvasButton(512, 302, 'Zur Planung · Esc', 'cancel'); }
    else if (st.phase === 'player') { this.canvasButton(512, 271, `${selected.name}: Decken · Q`, 'beam'); this.canvasButton(512, 302, 'Runde beenden · Leertaste', 'wait'); }
    const mobile = usesMobileInterface(); this.lastMobile = mobile;
    this.panelBackdrop.setVisible(!mobile);
    if (mobile) for (const button of this.buttons) button.setVisible(false);
    this.cameras.main.setZoom(mobile ? 1.42 : 1);
    this.cameras.main.centerOn(mobile ? 200 : 320, mobile ? 206 : 180);
    this.title.setVisible(!mobile); this.panel.setVisible(!mobile); this.message.setVisible(!mobile);
    const compactEnemies = st.units.filter(unit => unit.side === 'enemy').map(unit => {
      if (unit.withdrawn) return `${unit.name} weicht zurück`;
      const intent = this.model.intents().find(intent => intent.enemy === unit.id)!;
      return `${unit.name} ${unit.hp}/${unit.maxHp} → ${intent.distracted ? 'abgelenkt' : this.model.unit(intent.target).name}`;
    }).join(' · ');
    scenePresentation(this).publish({ name: 'Lia und Flick', portrait: 'portrait-lia', hp: selected.hp / selected.maxHp, hudVisible: true,
      objective, hint: st.phase === 'player' && !this.exitRequested ? 'Figur oder Feld wählen. Kyra / Wache wählen für eine Aktion.' : '',
      thought: st.message, battleStatus: `BEFREIUNG\nEinsatz: Lia ${this.model.unit('lia').hp}/36 · Flick ${this.model.unit('flick').hp}/40 · Kyra ${this.model.unit('kyra').hp}/24\n${selected.name}: Gehen ${budget.moved ? 'verbraucht' : 'frei'} · Aktion ${budget.acted ? 'verbraucht' : 'frei'}\n${compactEnemies}`,
      controls: normalizedProfile, abilities: [], abilitiesVisible: false, disabled: st.phase === 'enemy', dialogueActive: false,
      inventory: null });
    this.registry.set('rescue:state', this.model.snapshot()); this.data.set('rescue:cursor', { ...this.cursor });
  }
  update() { if (this.lastMobile !== undefined && this.lastMobile !== usesMobileInterface()) this.render(); }
}
