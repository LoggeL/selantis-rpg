import { boltLine, eq, key, manhattan, reachable, type Cell, type Unit, type BattleBoard } from '../combat/grid';
import { freshTurn, spendTurn, type TurnBudget } from '../combat/tactics';

export type RescueUnitId = 'lia' | 'flick' | 'kyra' | 'guard' | 'captain';
export type RescueAllyId = 'lia' | 'flick';
export interface RescueEncounter { board: BattleBoard; units: ReadonlyArray<Omit<RescueUnit, 'hp' | 'withdrawn'>> }

export interface RescueUnit { id: RescueUnitId; name: string; side: 'ally' | 'protected' | 'enemy'; cell: Cell; hp: number; maxHp: number; move: number; attack: number; range: number; withdrawn: boolean }
export interface RescueState {
  phase: 'player' | 'enemy' | 'won' | 'failed'; round: number; selected: RescueAllyId;
  units: RescueUnit[]; budgets: Record<RescueAllyId, TurnBudget>; guarding: RescueAllyId[];
  distracted: RescueUnitId[]; warned: boolean; freed: boolean; message: string;
}
export interface RescueIntent { enemy: RescueUnitId; target: RescueUnitId; distracted: boolean; text: string }
export interface RescueEvent { actor: RescueUnitId; target?: RescueUnitId; from?: Cell; to?: Cell; damage?: number; text: string }

/** Mission health is ephemeral and never writes into the campaign's party state. */
export class RescueModel {
  readonly state: RescueState;
  constructor(private readonly encounter: RescueEncounter) { this.state = {
    phase: 'player', round: 1, selected: 'lia',
    units: encounter.units.map(unit => ({ ...unit, cell: { ...unit.cell }, hp: unit.maxHp, withdrawn: false })),
    budgets: { lia: freshTurn(), flick: freshTurn() }, guarding: [], distracted: [], warned: false, freed: false,
    message: 'Flick löst die Fesseln. Lia muss zu Kyra gelangen und sie decken.',
  }; }
  unit(id: RescueUnitId) { return this.state.units.find(unit => unit.id === id)!; }
  private gridUnits(): Unit[] { return this.state.units.map(unit => ({ id: unit.id, kind: 'warrior', side: unit.side === 'enemy' ? 'enemy' : 'ally', cell: unit.cell, hp: unit.hp, alive: unit.hp > 0 && !unit.withdrawn })); }
  paths(id = this.state.selected) { return reachable(this.gridUnits(), this.unit(id).cell, this.unit(id).move, this.encounter.board); }
  select(id: RescueAllyId) { if (this.state.phase !== 'player') return; this.state.selected = id; this.state.message = `${this.unit(id).name} ist am Zug.`; }
  private reject(text: string) { this.state.message = text; return false; }
  private ready(id: RescueAllyId, choice: 'move' | 'act') {
    if (this.state.phase !== 'player') return this.reject('Der Gegnerzug läuft.');
    if (!spendTurn(this.state.budgets[id], choice)) return this.reject(choice === 'move' ? 'Bewegung bereits verbraucht. Die Aktion bleibt verfügbar.' : 'Aktion bereits verbraucht. Die Bewegung bleibt verfügbar.');
    return true;
  }
  move(to: Cell, id = this.state.selected) {
    if (!this.ready(id, 'move')) return false;
    const unit = this.unit(id), path = this.paths(id).get(key(to));
    if (!path || eq(to, unit.cell)) return this.reject('Feld nicht erreichbar: Ruine, Figur oder Bewegungsreichweite.');
    unit.cell = { ...to }; this.state.budgets[id] = spendTurn(this.state.budgets[id], 'move')!;
    // Moving out of a protective stance removes its protection.
    this.state.guarding = this.state.guarding.filter(guard => guard !== id);
    this.state.message = `${unit.name} geht ${path.length - 1} Felder. Bewegung verbraucht.`; return true;
  }
  guard(id = this.state.selected) {
    if (!this.ready(id, 'act')) return false;
    this.state.budgets[id] = spendTurn(this.state.budgets[id], 'act')!;
    this.state.guarding.push(id);
    this.state.message = id === 'lia' && manhattan(this.unit(id).cell, this.unit('kyra').cell) === 1
      ? 'Lia stellt sich schützend vor Kyra. Jetzt die Runde beenden.'
      : `${this.unit(id).name} deckt sich. Lia schützt Kyra nur direkt neben ihr.`;
    return true;
  }
  use(target: RescueUnitId, id = this.state.selected) {
    if (!this.ready(id, 'act')) return false;
    const actor = this.unit(id), victim = this.unit(target), distance = manhattan(actor.cell, victim.cell);
    if (target === 'kyra') {
      if (id === 'flick') {
        if (this.state.freed) return this.reject('Kyra ist bereits frei. Lia muss sie nun neben dem Baum decken.');
        if (distance !== 1) return this.reject('Flick muss direkt neben Kyra stehen, um die Fesseln zu lösen.');
        this.state.freed = true; this.state.message = 'Flick schneidet die Fesseln durch. Lia muss Kyra direkt neben ihr decken.';
      } else {
        if (distance > 4) return this.reject('Kyra ist für die Warnung zu weit entfernt.');
        this.state.warned = true; this.state.message = 'Lia warnt Kyra. Kyra duckt sich im nächsten Gegnerzug.';
      }
    } else {
      if (victim.side !== 'enemy' || victim.withdrawn) return this.reject('Wähle eine aktive Wache oder Kyra.');
      if (distance > actor.range) return this.reject('Außer Reichweite. Erst näher herangehen.');
      if (id === 'lia') {
        this.state.distracted.push(target); this.state.message = `Lia lenkt ${victim.name} ab. Dieser Gegner setzt einmal aus.`;
      } else {
        const sight = boltLine(actor.cell, victim.cell, this.encounter.board);
        if (!sight.some(cell => eq(cell, victim.cell))) return this.reject('Die Ruine blockiert Flicks Schuss.');
        victim.hp = Math.max(0, victim.hp - actor.attack);
        if (victim.hp === 0) { victim.withdrawn = true; this.state.message = `${victim.name} weicht kampfunfähig zurück. Kein Todesstoß.`; }
        else this.state.message = `Flick trifft ${victim.name}: ${actor.attack} Schaden, ${victim.hp}/${victim.maxHp} LP.`;
      }
    }
    this.state.budgets[id] = spendTurn(this.state.budgets[id], 'act')!; return true;
  }
  intents(): RescueIntent[] {
    return this.state.units.filter(unit => unit.side === 'enemy' && !unit.withdrawn).map(enemy => {
      const target = this.targetFor(enemy);
      return { enemy: enemy.id, target: target.id, distracted: this.state.distracted.includes(enemy.id),
        text: this.state.distracted.includes(enemy.id) ? `${enemy.name}: abgelenkt, setzt aus` : `${enemy.name} → ${target.name} (${enemy.attack} Schaden)` };
    });
  }
  private targetFor(enemy: RescueUnit) {
    if (enemy.id === 'captain') return this.unit(this.state.freed ? 'kyra' : 'lia');
    const allies = [this.unit('lia'), this.unit('flick')];
    return allies.sort((a, b) => manhattan(enemy.cell, a.cell) - manhattan(enemy.cell, b.cell) || a.id.localeCompare(b.id))[0];
  }
  beginEnemyTurn() { if (this.state.phase !== 'player') return false; this.state.phase = 'enemy'; this.state.message = 'Gegnerzug: Die Wache und Vardis handeln.'; return true; }
  resolveEnemyTurn(): RescueEvent[] {
    if (this.state.phase !== 'enemy') return [];
    const events: RescueEvent[] = [];
    for (const enemy of this.state.units.filter(unit => unit.side === 'enemy' && !unit.withdrawn)) {
      if (this.state.distracted.includes(enemy.id)) { events.push({ actor: enemy.id, text: `${enemy.name} ist abgelenkt und setzt aus.` }); continue; }
      let target = this.targetFor(enemy);
      const from = { ...enemy.cell };
      if (manhattan(enemy.cell, target.cell) > 1) {
        const options = [...reachable(this.gridUnits(), enemy.cell, enemy.move, this.encounter.board).values()]
          .sort((a, b) => manhattan(a.at(-1)!, target.cell) - manhattan(b.at(-1)!, target.cell) || a.length - b.length);
        enemy.cell = { ...options[0].at(-1)! };
      }
      if (!eq(from, enemy.cell)) events.push({ actor: enemy.id, from, to: { ...enemy.cell }, text: `${enemy.name} nähert sich ${target.name}.` });
      if (manhattan(enemy.cell, target.cell) === 1) {
        // The captain approaches Kyra; adjacent Lia intercepts his actual strike.
        if (target.id === 'kyra' && this.state.guarding.includes('lia') && manhattan(this.unit('lia').cell, target.cell) === 1) target = this.unit('lia');
        const protectedTarget = target.side === 'ally' && this.state.guarding.includes(target.id as RescueAllyId);
        const damage = Math.round(enemy.attack * (protectedTarget ? .4 : target.id === 'kyra' && this.state.warned ? .5 : 1));
        target.hp = Math.max(0, target.hp - damage);
        events.push({ actor: enemy.id, target: target.id, damage, text: `${enemy.name} trifft ${target.name}: ${damage} Schaden${protectedTarget ? ' (Deckung)' : ''}.` });
      }
      if (['lia', 'flick', 'kyra'].some(id => this.unit(id as RescueUnitId).hp === 0)) break;
    }
    if (['lia', 'flick', 'kyra'].some(id => this.unit(id as RescueUnitId).hp === 0)) {
      this.state.phase = 'failed'; this.state.message = 'Der Rettungsversuch scheitert. Erneut versuchen oder zur Planung zurückkehren.';
    } else if (this.state.freed && this.state.guarding.includes('lia') && manhattan(this.unit('lia').cell, this.unit('kyra').cell) === 1 && manhattan(this.unit('flick').cell, this.unit('kyra').cell) <= 3) {
      this.state.phase = 'won'; this.state.message = 'Kyra ist frei. Lia hält den Hauptmann auf, Flick deckt die Schwestern. Weiter zur Geschichte.';
    } else {
      this.state.phase = 'player'; this.state.round++; this.state.budgets = { lia: freshTurn(), flick: freshTurn() };
      this.state.guarding = []; this.state.distracted = []; this.state.warned = false;
      this.state.message = events.at(-1)?.text ?? 'Neue Runde: Jede Figur hat eine Bewegung und eine Aktion.';
    }
    return events;
  }
  snapshot() { return structuredClone(this.state); }
}
