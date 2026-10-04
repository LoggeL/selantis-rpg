import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assetContentVersion } from "../../vite.config.mjs";
const temporary = [];
function fixture(entries) {
  const root = mkdtempSync(join(tmpdir(), 'selantis-asset-revision-'));
  temporary.push(root);
  for (const [path, bytes] of entries) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), bytes);
  }
  return root;
}
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
describe('asset content revision', () => {
  it('is deterministic across creation order and independent of Git or timestamps', () => {
    const entries = [['sprites/walk.png', Buffer.from([1, 2, 3])], ['manifest.json', '{}']];
    expect(assetContentVersion(fixture(entries))).toBe(assetContentVersion(fixture([...entries].reverse())));
  });
  it('changes for edited bytes, a renamed asset, or a changed manifest', () => {
    const root = fixture([['walk.png', Buffer.from([1, 2])], ['manifest.json', '{}']]);
    const first = assetContentVersion(root);
    writeFileSync(join(root, 'walk.png'), Buffer.from([2, 1]));
    const edited = assetContentVersion(root);
    expect(edited).not.toBe(first);
    renameSync(join(root, 'walk.png'), join(root, 'run.png'));
    const renamed = assetContentVersion(root);
    expect(renamed).not.toBe(edited);
    writeFileSync(join(root, 'manifest.json'), '{"cols":4,"rows":2}');
    expect(assetContentVersion(root)).not.toBe(renamed);
  });
});
