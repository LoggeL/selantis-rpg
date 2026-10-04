import { compileAssetCatalog, assetLoadMetrics } from './asset_catalog.mjs';
try {
  const manifest = compileAssetCatalog();
  console.log(JSON.stringify(assetLoadMetrics(manifest), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
