# Authored asset packages

`game/public/assets/manifest.json` remains the input written by existing image producers. Its optional `schemaVersion` is `1`; older manifests without that field remain accepted. `portraits.json` supplies dialogue profiles and `registrations.json` covers the flight illustration whose legacy scene has its own preload.

`scripts/asset_catalog.mjs` compiles these declarations and all shipped PNG/SVG files into one validated catalog. The public graphic files supply dimensions, byte counts and content hashes. Files not registered for gameplay remain downloadable catalog entries and never enter scene packages automatically. No generation outputs or local QA files supply catalog metadata.

`packs.json` lists the textures needed before each scene starts. `shared` contains UI atlases and inventory graphics. Portraits belong to their scene packages: title loads no cast portraits; later chapters add only their speakers and HUD faces. World includes every map background; each narrative chapter includes its interior/road/camp areas because those transitions occur within the same scene. Named selectors expand deterministically and refer to registered gameplay IDs.

Vite serves and emits `assets/runtime-manifest.json` (catalog plus packages and icon names) and `assets/catalog.json` (the same asset descriptors for the viewer). The site assembler verifies that the source catalog still matches the built catalog. Run `node scripts/validate_assets.mjs` from the repository root to validate files, sheets, foot anchors, IDs and packages, and print byte totals. These totals describe graphic payload sizes, not download or startup timings.
