import { AssetConfig } from "./game-types";

// Default asset configurations
export const DEFAULT_ASSET_CONFIGS: AssetConfig[] = [
  {
    id: "tiles",
    name: "City Tiles",
    imagePath: "/assets/cityTiles_sheet.png",
    xmlPath: "/assets/cityTiles_sheet.xml",
  },
  {
    id: "details",
    name: "City Details",
    imagePath: "/assets/cityDetails_sheet.png",
    xmlPath: "/assets/cityDetails_sheet.xml",
  },
  {
    id: "buildings",
    name: "Buildings",
    imagePath: "/assets/buildingTiles_sheet.png",
    xmlPath: "/assets/buildingTiles_sheet.xml",
  },
];
