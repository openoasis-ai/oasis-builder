/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { AssetSet, AssetConfig } from "./game-types";

interface CityBuilderConfig {
  tileWidth: number;
  tileHeight: number;
  gridSize: number;
  assetConfigs: AssetConfig[];
  onTileSelect?: (tileIndex: number) => void;
  onGridPositionChange?: (x: number, y: number) => void;
}

export class CityBuilder extends Phaser.Scene {
  gridSize: number;
  tileWidth: number;
  tileHeight: number;
  cityMap = new Map();
  selectedSpriteIndex = 0;
  assetSets: Map<string, AssetSet> = new Map();
  selectedAssetSetId = "";
  currentLayer = 0; // For stacking buildings
  hoverSprite: Phaser.GameObjects.Image | null = null;
  hoverGraphics!: Phaser.GameObjects.Graphics;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  canvasFocused = false;
  lastHoverGridX = -1;
  lastHoverGridY = -1;
  assetConfigList: AssetConfig[];
  isPanning = false;
  spaceKeyDown = false;
  panStartX = 0;
  panStartY = 0;
  panStartScrollX = 0;
  panStartScrollY = 0;
  onTileSelect?: (tileIndex: number) => void;
  onGridPositionChange?: (x: number, y: number) => void;

  constructor(config: CityBuilderConfig) {
    super({ key: "CityBuilder" });
    this.gridSize = config.gridSize;
    this.tileWidth = config.tileWidth;
    this.tileHeight = config.tileHeight;
    this.assetConfigList = config.assetConfigs;
    this.onTileSelect = config.onTileSelect;
    this.onGridPositionChange = config.onGridPositionChange;
  }

  preload() {
    console.log("Loading assets...");

    // Dynamically load all configured asset sets
    this.assetConfigList.forEach((config) => {
      const textureKey = `texture_${config.id}`;
      const xmlKey = `xml_${config.id}`;
      this.load.image(textureKey, config.imagePath);
      this.load.text(xmlKey, config.xmlPath);
    });

    this.load.on("complete", () => {
      console.log("Assets loaded successfully");
    });

    this.load.on("loaderror", (file: any) => {
      console.error("Error loading file:", file.key, file.src);
    });
  }

  create() {
    // Parse all configured asset sets
    this.assetConfigList.forEach((config) => {
      this.parseAssetSet(config);
    });

    // Select first asset set by default
    if (this.assetConfigList.length > 0) {
      this.selectedAssetSetId = this.assetConfigList[0].id;
    }

    this.cameras.main.setBackgroundColor("#87CEEB");
    this.cameras.main.zoom = 0.6; // Start more zoomed out

    const centerX = (this.gridSize * this.tileWidth) / 2;
    const centerY = (this.gridSize * this.tileHeight) / 2;
    this.cameras.main.centerOn(centerX, centerY + 200);

    this.drawGrid();
    this.hoverGraphics = this.add.graphics();
    this.hoverGraphics.setDepth(9999); // Keep hover above everything except preview sprite

    this.setupInput();

    this.cursors = this.input.keyboard!.createCursorKeys();

    // Remove all key captures so they don't block input fields
    // createCursorKeys() adds captures for arrow keys and space which we need to clear
    this.input.keyboard!.clearCaptures();
  }

  parseAssetSet(config: AssetConfig) {
    const textureKey = `texture_${config.id}`;
    const xmlKey = `xml_${config.id}`;
    const xmlText = this.cache.text.get(xmlKey);

    if (!xmlText) {
      console.error(`Failed to load XML for asset set: ${config.id}`);
      return;
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const subtextures = xmlDoc.querySelectorAll("SubTexture");

    const sourceTexture = this.textures.get(textureKey);

    if (!sourceTexture) {
      console.error(`Failed to load texture for asset set: ${config.id}`);
      return;
    }

    const sprites: any[] = [];

    subtextures.forEach((subtexture: Element) => {
      const name = subtexture.getAttribute("name")!;
      const x = parseInt(subtexture.getAttribute("x")!);
      const y = parseInt(subtexture.getAttribute("y")!);
      const width = parseInt(subtexture.getAttribute("width")!);
      const height = parseInt(subtexture.getAttribute("height")!);

      // Support for multi-tile footprint in XML (optional attributes)
      const footprintWidth = subtexture.getAttribute("footprintWidth");
      const footprintHeight = subtexture.getAttribute("footprintHeight");
      const footprint =
        footprintWidth && footprintHeight
          ? {
              width: parseInt(footprintWidth),
              height: parseInt(footprintHeight),
            }
          : undefined;

      sourceTexture.add(name, 0, x, y, width, height);

      sprites.push({
        name,
        x,
        y,
        width,
        height,
        footprint,
      });
    });

    const assetSet: AssetSet = {
      id: config.id,
      name: config.name,
      textureKey,
      xmlKey,
      sprites,
    };

    this.assetSets.set(config.id, assetSet);
    console.log(
      `Loaded ${sprites.length} sprites for asset set: ${config.name}`
    );

    // Emit generic asset loaded event
    window.dispatchEvent(
      new CustomEvent("phaserAssetSetLoaded", {
        detail: { assetSet },
      })
    );
  }

  drawGrid() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x999999, 0.4);

    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        const pos = this.gridToIso(col, row);

        graphics.beginPath();
        graphics.moveTo(pos.x, pos.y - this.tileHeight / 2);
        graphics.lineTo(pos.x + this.tileWidth / 2, pos.y);
        graphics.lineTo(pos.x, pos.y + this.tileHeight / 2);
        graphics.lineTo(pos.x - this.tileWidth / 2, pos.y);
        graphics.closePath();
        graphics.strokePath();
      }
    }
    graphics.setDepth(-1);
  }

  updateHoverPreview(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y
    );
    const gridPos = this.isoToGrid(worldPoint.x, worldPoint.y);

    // Only update if grid position changed
    if (
      gridPos.gridX === this.lastHoverGridX &&
      gridPos.gridY === this.lastHoverGridY
    ) {
      return;
    }

    this.lastHoverGridX = gridPos.gridX;
    this.lastHoverGridY = gridPos.gridY;
    this.hoverGraphics.clear();

    if (
      gridPos.gridX >= 0 &&
      gridPos.gridX < this.gridSize &&
      gridPos.gridY >= 0 &&
      gridPos.gridY < this.gridSize
    ) {
      const assetSet = this.assetSets.get(this.selectedAssetSetId);
      const sprite = assetSet?.sprites[this.selectedSpriteIndex];
      const footprint = sprite?.footprint || { width: 1, height: 1 };

      // Draw hover indicator for all footprint tiles
      this.hoverGraphics.lineStyle(2, 0x00ff00, 0.8);
      this.hoverGraphics.fillStyle(0x00ff00, 0.2);

      for (let fx = 0; fx < footprint.width; fx++) {
        for (let fy = 0; fy < footprint.height; fy++) {
          const tileX = gridPos.gridX + fx;
          const tileY = gridPos.gridY + fy;
          if (tileX >= this.gridSize || tileY >= this.gridSize) continue;

          const isoPos = this.gridToIso(tileX, tileY);
          this.hoverGraphics.beginPath();
          this.hoverGraphics.moveTo(
            isoPos.x,
            isoPos.y - this.tileHeight / 2
          );
          this.hoverGraphics.lineTo(
            isoPos.x + this.tileWidth / 2,
            isoPos.y
          );
          this.hoverGraphics.lineTo(
            isoPos.x,
            isoPos.y + this.tileHeight / 2
          );
          this.hoverGraphics.lineTo(
            isoPos.x - this.tileWidth / 2,
            isoPos.y
          );
          this.hoverGraphics.closePath();
          this.hoverGraphics.strokePath();
          this.hoverGraphics.fillPath();
        }
      }

      // Position sprite at the center of the footprint
      const centerX = gridPos.gridX + (footprint.width - 1) / 2;
      const centerY = gridPos.gridY + (footprint.height - 1) / 2;
      const isoPos = this.gridToIso(centerX, centerY);

      if (assetSet && sprite) {
        const textureKey = assetSet.textureKey;
        const tileName = sprite.name;
        const origin = sprite.origin || { x: 0.5, y: 0.65 };

        if (this.hoverSprite) {
          this.hoverSprite.setTexture(textureKey, tileName);
          this.hoverSprite.setOrigin(origin.x, origin.y);
          this.hoverSprite.setPosition(
            isoPos.x,
            isoPos.y - this.currentLayer * 30
          );
          this.hoverSprite.setVisible(true);
        } else {
          this.hoverSprite = this.add.image(
            isoPos.x,
            isoPos.y - this.currentLayer * 30,
            textureKey,
            tileName
          );
          this.hoverSprite.setOrigin(origin.x, origin.y);
          this.hoverSprite.setAlpha(0.5);
          this.hoverSprite.setDepth(10000);
        }
      }

      if (this.onGridPositionChange) {
        this.onGridPositionChange(gridPos.gridX, gridPos.gridY);
      }
    } else {
      if (this.hoverSprite) {
        this.hoverSprite.setVisible(false);
      }
    }
  }

  gridToIso(gridX: number, gridY: number) {
    const isoX = (gridX - gridY) * (this.tileWidth / 2);
    const isoY = (gridX + gridY) * (this.tileHeight / 2);
    const offsetX = (this.gridSize * this.tileWidth) / 2;
    const offsetY = 200;

    return {
      x: isoX + offsetX,
      y: isoY + offsetY,
    };
  }

  isoToGrid(isoX: number, isoY: number) {
    const offsetX = (this.gridSize * this.tileWidth) / 2;
    const offsetY = 200;
    const adjustedX = isoX - offsetX;
    const adjustedY = isoY - offsetY;

    const gridX = Math.floor(
      (adjustedX / (this.tileWidth / 2) +
        adjustedY / (this.tileHeight / 2)) /
        2
    );
    const gridY = Math.floor(
      (adjustedY / (this.tileHeight / 2) -
        adjustedX / (this.tileWidth / 2)) /
        2
    );

    return { gridX, gridY };
  }

  // Check if user is typing in an input field
  isUserTyping() {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    const tagName = activeElement.tagName.toLowerCase();
    return (
      tagName === "input" ||
      tagName === "textarea" ||
      activeElement.getAttribute("contenteditable") === "true"
    );
  }

  setupInput() {
    // Disable right-click context menu on the game canvas
    this.game.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    // Track canvas focus
    this.game.canvas.setAttribute("tabindex", "0");
    this.game.canvas.addEventListener("focus", () => {
      this.canvasFocused = true;
    });
    this.game.canvas.addEventListener("blur", () => {
      this.canvasFocused = false;
      this.spaceKeyDown = false;
      this.game.canvas.style.cursor = "default";
    });
    // Focus canvas on click
    this.game.canvas.addEventListener("mousedown", () => {
      this.game.canvas.focus();
    });

    // Track space key for pan mode (only when not typing)
    this.input.keyboard!.on("keydown-SPACE", () => {
      if (this.isUserTyping()) return;
      this.spaceKeyDown = true;
      this.game.canvas.style.cursor = "grab";
    });

    this.input.keyboard!.on("keyup-SPACE", () => {
      this.spaceKeyDown = false;
      if (!this.isPanning) {
        this.game.canvas.style.cursor = "default";
      }
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.spaceKeyDown && pointer.leftButtonDown()) {
        // Start panning with Space + Left Click
        this.isPanning = true;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
        this.panStartScrollX = this.cameras.main.scrollX;
        this.panStartScrollY = this.cameras.main.scrollY;
        this.game.canvas.style.cursor = "grabbing";
      } else if (pointer.leftButtonDown()) {
        this.placeTile(pointer);
      } else if (pointer.rightButtonDown()) {
        this.removeTile(pointer);
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        const deltaX =
          (this.panStartX - pointer.x) / this.cameras.main.zoom;
        const deltaY =
          (this.panStartY - pointer.y) / this.cameras.main.zoom;
        this.cameras.main.scrollX = this.panStartScrollX + deltaX;
        this.cameras.main.scrollY = this.panStartScrollY + deltaY;
      } else {
        this.updateHoverPreview(pointer);
      }
    });

    this.input.on("pointerup", () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.game.canvas.style.cursor = this.spaceKeyDown
          ? "grab"
          : "default";
      }
    });

    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: any,
        _deltaX: number,
        deltaY: number
      ) => {
        const zoomAmount = deltaY > 0 ? -0.03 : 0.03;
        const newZoom = Phaser.Math.Clamp(
          this.cameras.main.zoom + zoomAmount,
          0.3,
          2
        );
        this.cameras.main.zoom = newZoom;
      }
    );
  }

  placeTile(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y
    );
    const gridPos = this.isoToGrid(worldPoint.x, worldPoint.y);

    if (
      gridPos.gridX >= 0 &&
      gridPos.gridX < this.gridSize &&
      gridPos.gridY >= 0 &&
      gridPos.gridY < this.gridSize
    ) {
      const assetSet = this.assetSets.get(this.selectedAssetSetId);
      const spriteData = assetSet?.sprites[this.selectedSpriteIndex];
      if (!assetSet || !spriteData) return;

      const footprint = spriteData.footprint || { width: 1, height: 1 };
      const origin = spriteData.origin || { x: 0.5, y: 0.65 };
      const textureKey = assetSet.textureKey;
      const tileName = spriteData.name;

      // Check if all footprint cells are within bounds
      for (let fx = 0; fx < footprint.width; fx++) {
        for (let fy = 0; fy < footprint.height; fy++) {
          const tileX = gridPos.gridX + fx;
          const tileY = gridPos.gridY + fy;
          if (tileX >= this.gridSize || tileY >= this.gridSize) return;
        }
      }

      // Clear any existing tiles in the footprint area
      for (let fx = 0; fx < footprint.width; fx++) {
        for (let fy = 0; fy < footprint.height; fy++) {
          const tileX = gridPos.gridX + fx;
          const tileY = gridPos.gridY + fy;
          const key = `${tileX},${tileY},${this.currentLayer}`;
          if (this.cityMap.has(key)) {
            const existing = this.cityMap.get(key);
            // Only destroy sprite if it's the anchor cell
            if (existing.isAnchor) {
              existing.sprite.destroy();
            }
            this.cityMap.delete(key);
          }
        }
      }

      // Position sprite at the center of the footprint
      const centerX = gridPos.gridX + (footprint.width - 1) / 2;
      const centerY = gridPos.gridY + (footprint.height - 1) / 2;
      const isoPos = this.gridToIso(centerX, centerY);

      // Offset Y position for stacking (higher layers appear above)
      const yOffset = this.currentLayer * 30;
      const sprite = this.add.image(
        isoPos.x,
        isoPos.y - yOffset,
        textureKey,
        tileName
      );
      sprite.setOrigin(origin.x, origin.y);
      // Depth based on center position
      sprite.setDepth((centerX + centerY) * 100 + this.currentLayer * 10);

      // Store anchor cell with sprite
      const anchorKey = `${gridPos.gridX},${gridPos.gridY},${this.currentLayer}`;
      this.cityMap.set(anchorKey, {
        sprite,
        tileName,
        textureKey,
        layer: this.currentLayer,
        footprint,
        origin,
        isAnchor: true,
      });

      // Mark all other footprint cells (non-anchor)
      for (let fx = 0; fx < footprint.width; fx++) {
        for (let fy = 0; fy < footprint.height; fy++) {
          if (fx === 0 && fy === 0) continue; // Skip anchor
          const tileX = gridPos.gridX + fx;
          const tileY = gridPos.gridY + fy;
          const key = `${tileX},${tileY},${this.currentLayer}`;
          this.cityMap.set(key, {
            sprite: null,
            tileName,
            textureKey,
            layer: this.currentLayer,
            footprint,
            origin,
            isAnchor: false,
            anchorKey,
          });
        }
      }
    }
  }

  removeTile(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y
    );
    const gridPos = this.isoToGrid(worldPoint.x, worldPoint.y);

    if (
      gridPos.gridX >= 0 &&
      gridPos.gridX < this.gridSize &&
      gridPos.gridY >= 0 &&
      gridPos.gridY < this.gridSize
    ) {
      const key = `${gridPos.gridX},${gridPos.gridY},${this.currentLayer}`;

      if (this.cityMap.has(key)) {
        const tileData = this.cityMap.get(key);

        // Find the anchor cell
        let anchorKey = key;
        if (!tileData.isAnchor && tileData.anchorKey) {
          anchorKey = tileData.anchorKey;
        }

        const anchorData = this.cityMap.get(anchorKey);
        if (anchorData) {
          // Parse anchor position
          const [anchorX, anchorY, layer] = anchorKey
            .split(",")
            .map(Number);
          const footprint = anchorData.footprint || { width: 1, height: 1 };

          // Remove all footprint cells
          for (let fx = 0; fx < footprint.width; fx++) {
            for (let fy = 0; fy < footprint.height; fy++) {
              const cellKey = `${anchorX + fx},${anchorY + fy},${layer}`;
              this.cityMap.delete(cellKey);
            }
          }

          // Destroy the sprite
          if (anchorData.sprite) {
            anchorData.sprite.destroy();
          }
        }
      }
    }
  }

  setSelectedTile(index: number, assetSetId?: string) {
    this.selectedSpriteIndex = index;
    if (assetSetId && this.assetSets.has(assetSetId)) {
      this.selectedAssetSetId = assetSetId;
    }
    // Force hover update by resetting last position
    this.lastHoverGridX = -1;
    this.lastHoverGridY = -1;
  }

  setLayer(layer: number) {
    this.currentLayer = Math.max(0, Math.min(layer, 10)); // Max 10 layers
    this.lastHoverGridX = -1;
    this.lastHoverGridY = -1;
    console.log("Current layer:", this.currentLayer);
  }

  exportMap() {
    const mapData: any[] = [];
    this.cityMap.forEach((tileData: any, key: string) => {
      // Only export anchor cells (avoid duplicates for multi-tile sprites)
      if (!tileData.isAnchor) return;

      const [gridX, gridY, layer] = key.split(",").map(Number);
      const exportTile: any = {
        x: gridX,
        y: gridY,
        layer: layer || 0,
        tileName: tileData.tileName,
        textureKey: tileData.textureKey,
      };

      // Include footprint if it's multi-tile
      if (
        tileData.footprint &&
        (tileData.footprint.width > 1 || tileData.footprint.height > 1)
      ) {
        exportTile.footprint = tileData.footprint;
      }

      // Include origin if it's not the default
      if (
        tileData.origin &&
        (tileData.origin.x !== 0.5 || tileData.origin.y !== 0.65)
      ) {
        exportTile.origin = tileData.origin;
      }

      mapData.push(exportTile);
    });

    // Export custom assets
    const customAssets: any[] = [];
    this.assetSets.forEach((assetSet) => {
      if (assetSet.isCustom && assetSet.imageDataUrl) {
        customAssets.push({
          id: assetSet.id,
          name: assetSet.name,
          imageDataUrl: assetSet.imageDataUrl,
          sprites: assetSet.sprites.map((sprite) => ({
            name: sprite.name,
            x: sprite.x,
            y: sprite.y,
            width: sprite.width,
            height: sprite.height,
            footprint: sprite.footprint,
            origin: sprite.origin,
          })),
        });
      }
    });

    const jsonData = {
      version: "3.0",
      gridSize: this.gridSize,
      tileWidth: this.tileWidth,
      tileHeight: this.tileHeight,
      customAssets: customAssets,
      tiles: mapData,
      timestamp: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(jsonData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `city-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    console.log("Map exported with", mapData.length, "tiles");
  }

  async loadMap(jsonData: any) {
    try {
      // Clear existing map
      this.cityMap.forEach((tileData: any) => {
        if (tileData.sprite) tileData.sprite.destroy();
      });
      this.cityMap.clear();

      // Load custom assets first if they exist
      if (jsonData.customAssets && jsonData.customAssets.length > 0) {
        console.log(`Loading ${jsonData.customAssets.length} custom assets...`);

        for (const customAsset of jsonData.customAssets) {
          const textureKey = `texture_${customAsset.id}`;

          // Load the image as a texture
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              try {
                // Remove existing texture if it exists
                if (this.textures.exists(textureKey)) {
                  this.textures.remove(textureKey);
                }

                // Add texture to Phaser
                this.textures.addImage(textureKey, img);
                const sourceTexture = this.textures.get(textureKey);

                // Add frames for each sprite
                customAsset.sprites.forEach((sprite: any) => {
                  sourceTexture.add(
                    sprite.name,
                    0,
                    sprite.x,
                    sprite.y,
                    sprite.width,
                    sprite.height
                  );
                });

                // Create asset set
                const assetSet = {
                  id: customAsset.id,
                  name: customAsset.name,
                  textureKey,
                  xmlKey: `custom_${customAsset.id}`,
                  sprites: customAsset.sprites,
                  isCustom: true,
                  imageDataUrl: customAsset.imageDataUrl,
                };

                this.assetSets.set(customAsset.id, assetSet);
                console.log(`Loaded custom asset: ${customAsset.name}`);

                // Emit event for UI to update
                window.dispatchEvent(
                  new CustomEvent("phaserAssetSetLoaded", {
                    detail: { assetSet, imagePath: customAsset.imageDataUrl },
                  })
                );

                resolve();
              } catch (error) {
                console.error("Error adding texture:", error);
                reject(error);
              }
            };
            img.onerror = () => {
              console.error(`Failed to load custom asset image: ${customAsset.name}`);
              reject(new Error(`Failed to load custom asset: ${customAsset.name}`));
            };
            img.src = customAsset.imageDataUrl;
          });
        }
      }

      // Load tiles from JSON
      jsonData.tiles.forEach((tile: any) => {
        const footprint = tile.footprint || { width: 1, height: 1 };
        const origin = tile.origin || { x: 0.5, y: 0.65 };
        const layer = tile.layer || 0;

        // Handle legacy textureKey format (convert old format to new)
        let textureKey = tile.textureKey;
        if (textureKey === "cityTiles") textureKey = "texture_tiles";
        else if (textureKey === "cityDetails")
          textureKey = "texture_details";
        else if (textureKey === "buildingTiles")
          textureKey = "texture_buildings";
        else if (!textureKey.startsWith("texture_"))
          textureKey = `texture_${textureKey}`;

        // Position sprite at the center of the footprint
        const centerX = tile.x + (footprint.width - 1) / 2;
        const centerY = tile.y + (footprint.height - 1) / 2;
        const isoPos = this.gridToIso(centerX, centerY);
        const yOffset = layer * 30;

        const sprite = this.add.image(
          isoPos.x,
          isoPos.y - yOffset,
          textureKey,
          tile.tileName
        );
        sprite.setOrigin(origin.x, origin.y);
        sprite.setDepth((centerX + centerY) * 100 + layer * 10);

        // Store anchor cell
        const anchorKey = `${tile.x},${tile.y},${layer}`;
        this.cityMap.set(anchorKey, {
          sprite,
          tileName: tile.tileName,
          textureKey,
          layer,
          footprint,
          origin,
          isAnchor: true,
        });

        // Mark all other footprint cells
        for (let fx = 0; fx < footprint.width; fx++) {
          for (let fy = 0; fy < footprint.height; fy++) {
            if (fx === 0 && fy === 0) continue;
            const cellKey = `${tile.x + fx},${tile.y + fy},${layer}`;
            this.cityMap.set(cellKey, {
              sprite: null,
              tileName: tile.tileName,
              textureKey,
              layer,
              footprint,
              origin,
              isAnchor: false,
              anchorKey,
            });
          }
        }
      });

      console.log("Map loaded with", jsonData.tiles.length, "tiles");
    } catch (error) {
      console.error("Error loading map:", error);
    }
  }

  update() {
    // Don't handle keys when user is typing in input fields
    if (this.isUserTyping()) return;

    const panSpeed = 8;

    if (this.cursors?.left.isDown) {
      this.cameras.main.scrollX -= panSpeed;
    }
    if (this.cursors?.right.isDown) {
      this.cameras.main.scrollX += panSpeed;
    }
    if (this.cursors?.up.isDown) {
      this.cameras.main.scrollY -= panSpeed;
    }
    if (this.cursors?.down.isDown) {
      this.cameras.main.scrollY += panSpeed;
    }
  }
}
