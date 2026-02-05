export interface SpriteData {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  footprint?: { width: number; height: number }; // For multi-tile support
  origin?: { x: number; y: number }; // Anchor point (default: 0.5, 0.65 for legacy assets)
}

export interface AssetSet {
  id: string;
  name: string;
  textureKey: string;
  xmlKey: string;
  sprites: SpriteData[];
  isCustom?: boolean; // Indicates if this is a custom asset (not a default one)
  imageDataUrl?: string; // Data URL for custom assets (for export/import)
}

export interface AssetConfig {
  id: string;
  name: string;
  imagePath: string;
  xmlPath: string;
}
