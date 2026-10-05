// Pure engine modules used by scripts/map_tool.mjs (no Phaser).
export { buildPaintedGrid, normBlocks, normOccluders, normWalk } from '../../game/src/world/navgrid';
export { CollisionGrid, CELL, setFootScale, FOOT_HW, FOOT_HH } from '../../game/src/world/grid';
export { agentGrid, findPath } from '../../game/src/world/pathfind';
export { areaPx, setMapUnits, setWorldScale, toPx, unitPx, wk } from '../../game/src/world/geom';
export { closestOnPoly, distToPoly, pointInPoly, polyBounds, polyCentroid } from '../../game/src/world/poly';
