// Stand-in for Phaser when chapter modules are bundled for node (scripts/map_tool.mjs): every property access,
// call and construction returns the stub again, so class definitions and constants evaluate without a browser.
const handler = {
  get: (_t, p) => (p === Symbol.toPrimitive ? () => 0 : p === 'prototype' ? {} : stub),
  apply: () => stub,
  construct: () => stub,
};
const stub = new Proxy(function PhaserStub() {}, handler);
export default stub;
