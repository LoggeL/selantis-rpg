// Owned by the tactics agent. Export the Phaser scene classes this module needs.
import type Phaser from 'phaser';
import TacticsScene from './TacticsScene';

export type * from './api';
export { STANDARD_ABILITIES } from './rules/abilities';
export const phaserScenes: Phaser.Types.Scenes.SceneType[] = [TacticsScene];
