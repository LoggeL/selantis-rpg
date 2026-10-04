export type CatalogAsset = {
  id: string;
  file: string;
  url: string;
  kind: 'image' | 'spritesheet';
  category: string;
  width: number;
  height: number;
  bytes: number;
  frameW?: number;
  frameH?: number;
  cols?: number;
  rows?: number;
  foot?: [number, number];
};

/** Build output consumed by both the Phaser loader and downloadable asset viewer. */
export type AssetManifest = {
  schemaVersion: 1;
  assets: CatalogAsset[];
  packs: Record<string, string[]>;
  iconNames: string[];
};
