/** Shared boundary validation for build inputs and fetched runtime catalogs. */
export function validateAssetManifest(value) {
  const fail = message => { throw new Error(`Asset manifest: ${message}`); };
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) fail('unsupported schema version');
  if (!Array.isArray(value.assets) || !value.packs || typeof value.packs !== 'object' || Array.isArray(value.packs)) fail('missing assets or packs');
  if (!Array.isArray(value.iconNames) || value.iconNames.some(name => typeof name !== 'string') || new Set(value.iconNames).size !== value.iconNames.length) fail('invalid icon names');
  const ids = new Set();
  for (const asset of value.assets) {
    if (!asset || typeof asset.id !== 'string' || !asset.id || ids.has(asset.id)) fail(`duplicate or invalid id: ${asset?.id}`);
    ids.add(asset.id);
    if (typeof asset.file !== 'string' || !/^assets\/[a-zA-Z0-9_./-]+\.(png|svg)$/.test(asset.file) || asset.file.split('/').includes('..')) fail(`invalid file for ${asset.id}`);
    if (typeof asset.url !== 'string' || !asset.url.startsWith(`${asset.file}?v=`)) fail(`invalid content URL for ${asset.id}`);
    if (typeof asset.category !== 'string' || !asset.category) fail(`invalid category for ${asset.id}`);
    for (const key of ['width', 'height', 'bytes']) if (!Number.isInteger(asset[key]) || asset[key] <= 0) fail(`invalid ${key} for ${asset.id}`);
    if (!['image', 'spritesheet'].includes(asset.kind)) fail(`invalid kind for ${asset.id}`);
    if (asset.kind === 'spritesheet') {
      for (const key of ['frameW', 'frameH', 'cols', 'rows']) if (!Number.isInteger(asset[key]) || asset[key] <= 0) fail(`invalid ${key} for ${asset.id}`);
      if (asset.frameW * asset.cols !== asset.width || asset.frameH * asset.rows !== asset.height) fail(`sheet dimensions disagree for ${asset.id}`);
    }
    if (asset.foot !== undefined) {
      if (asset.kind !== 'spritesheet' || !Array.isArray(asset.foot) || asset.foot.length !== 2 || asset.foot.some((n, i) => !Number.isFinite(n) || n < 0 || n > [asset.frameW, asset.frameH][i])) fail(`invalid foot anchor for ${asset.id}`);
    }
  }
  if (!Array.isArray(value.packs.shared) || !Array.isArray(value.packs.title)) fail('missing startup packs');
  for (const [name, entries] of Object.entries(value.packs)) {
    if (!Array.isArray(entries) || new Set(entries).size !== entries.length) fail(`invalid pack ${name}`);
    for (const id of entries) if (!ids.has(id)) fail(`unknown asset ${id} in pack ${name}`);
  }
  return value;
}
