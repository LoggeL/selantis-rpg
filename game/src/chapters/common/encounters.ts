import { G } from '../../core/G';
import type { BattleDef, BattleResult, TacticsStartData } from '../../tactics/api';
import { startWorld, type MapDef, type StartWorldOptions, type WorldCtx } from '../../world';
import { WorldStopped } from '../../world/ctx';
export { forestEncounter, escortEncounter, onwardEncounter } from './travelBattles';

/**
 * Checkpoint with the player's position as return point. Keeps the scene's own start params (e.g. `part`) and, like
 * G.goto, never writes the campaign save from a hidden dev chapter.
 */
export function saveEncounterReturn(w: WorldCtx): void {
  G.checkpoint({ encounterReturn: { scene: G.currentScene, map: w.map.id, x: w.player.x, y: w.player.y } });
}

/** Resume the same exploration instance. Its scripts and timers sleep while tactics has control. */
export async function playEncounter(w: WorldCtx, battle: BattleDef, completedFlag?: string, onVictory?: () => void): Promise<BattleResult> {
  if (completedFlag && G.state.is(completedFlag)) throw new Error(`Encounter already completed: ${battle.id}`);
  saveEncounterReturn(w);
  w.lockPlayer();
  G.ui.hint(null); G.ui.objectivePointer(null);
  w.scene.scene.sleep();
  return new Promise<BattleResult>((resolve, reject) => {
    const abandoned = () => reject(new WorldStopped());
    w.scene.events.once('shutdown', abandoned);
    G.game.scene.start('Tactics', {
      battle,
      onEnd: result => {
        w.scene.events.off('shutdown', abandoned);
        if (!w.alive) { reject(new WorldStopped()); return; }
        if (result.outcome === 'win') {
          if (completedFlag) G.state.set(completedFlag);
          onVictory?.();
        }
        saveEncounterReturn(w);
        G.game.scene.stop('Tactics');
        w.scene.scene.wake();
        w.unlockPlayer();
        G.ui.setHud('explore');
        G.ui.objective(G.state.activeObjective()?.text ?? null);
        if (w.map.music) G.audio.music(w.map.music, { fadeMs: 800 });
        if (w.map.ambience) G.audio.ambience(w.map.ambience);
        resolve(result);
      },
    } satisfies TacticsStartData);
  });
}

export function startEncounterWorld(opts: Omit<StartWorldOptions, 'map'> & { map: MapDef }): Promise<void> {
  const p = G.state.data.params?.encounterReturn as { scene?: string; map?: string; x?: number; y?: number } | undefined;
  if (p?.scene === G.currentScene && p.map === opts.map.id && Number.isFinite(p.x) && Number.isFinite(p.y)) {
    return startWorld({ ...opts, map: { ...opts.map, spawns: { ...opts.map.spawns, 'encounter-return': { at: [p.x!, p.y!] } } }, spawn: 'encounter-return' });
  }
  return startWorld(opts);
}
