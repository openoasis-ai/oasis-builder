/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { AssetSet, AssetConfig } from "./game-types";

interface CityBuilderConfig {
  tileWidth: number;
  tileHeight: number;
  gridSize?: number;
  assetConfigs: AssetConfig[];
  onTileSelect?: (tileIndex: number) => void;
  onGridPositionChange?: (x: number, y: number) => void;
}

export class CityBuilder extends Phaser.Scene {
  gridSize: number;
  tileWidth: number;
  tileHeight: number;
  originOffsetX: number;
  originOffsetY: number;
  cityMap = new Map();
  selectedSpriteIndex = 0;
  assetSets: Map<string, AssetSet> = new Map();
  selectedAssetSetId = "";
  currentLayer = 0; // For stacking buildings
  hoverSprite: Phaser.GameObjects.Image | null = null;
  hoverGraphics!: Phaser.GameObjects.Graphics;
  gridGraphics!: Phaser.GameObjects.Graphics;
  gridVisible = true;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  canvasFocused = false;
  lastHoverGridX = -1;
  lastHoverGridY = -1;
  private lastCameraScrollX = -Infinity;
  private lastCameraScrollY = -Infinity;
  private lastCameraZoom = -1;
  assetConfigList: AssetConfig[];
  isPanning = false;
  spaceKeyDown = false;
  panStartX = 0;
  panStartY = 0;
  panStartScrollX = 0;
  panStartScrollY = 0;
  onTileSelect?: (tileIndex: number) => void;
  onGridPositionChange?: (x: number, y: number) => void;
  private autoSaveTimeout: number | null = null;
  private readonly AUTO_SAVE_KEY = "oasis-builder-autosave";
  private readonly AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

  constructor(config: CityBuilderConfig) {
    super({ key: "CityBuilder" });
    this.gridSize = config.gridSize ?? 50;
    this.tileWidth = config.tileWidth;
    this.tileHeight = config.tileHeight;
    this.originOffsetX = (this.gridSize * this.tileWidth) / 2;
    this.originOffsetY = 200;
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

  async create() {
    // Parse all configured asset sets
    this.assetConfigList.forEach((config) => {
      this.parseAssetSet(config);
    });

    // Select first asset set by default
    if (this.assetConfigList.length > 0) {
      this.selectedAssetSetId = this.assetConfigList[0].id;
    }

    // Initialize graphics and camera BEFORE async operations
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.cameras.main.zoom = 0.2; // Start more zoomed out

    const centerX = this.originOffsetX;
    const centerY = (this.gridSize * this.tileHeight) / 2;
    this.cameras.main.centerOn(centerX, centerY + this.originOffsetY);

    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(-1);

    this.hoverGraphics = this.add.graphics();
    this.hoverGraphics.setDepth(9999); // Keep hover above everything except preview sprite

    this.setupInput();

    this.cursors = this.input.keyboard!.createCursorKeys();

    // Remove all key captures so they don't block input fields
    // createCursorKeys() adds captures for arrow keys and space which we need to clear
    this.input.keyboard!.clearCaptures();

    // Try to load from local storage first
    const loadedFromStorage = await this.loadFromLocalStorage();

    if (!loadedFromStorage) {
      // If no saved data, load the oasis map first, then prefill empty cells with grass
      await this.loadOasisMap();
      this.prefillMapWithGrass();
    }

    // Draw grid after everything is loaded
    this.drawVisibleGrid();
    this.time.delayedCall(100, () => {
      this.drawVisibleGrid();
    });
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

      // Support for custom origin in XML (optional attributes)
      const originX = subtexture.getAttribute("originX");
      const originY = subtexture.getAttribute("originY");
      const origin =
        originX && originY
          ? {
            x: parseFloat(originX),
            y: parseFloat(originY),
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
        origin,
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

  prefillMapWithGrass() {
    const floorsAssetSet = this.assetSets.get("floors");
    if (!floorsAssetSet) {
      console.warn("Floors asset set not found, skipping prefill");
      return;
    }

    // Find grass_02_11 sprite (try with and without .png extension)
    const grassSprite = floorsAssetSet.sprites.find(
      (s) => s.name === "grass_02_11"
    );
    if (!grassSprite) {
      console.warn("grass_02_11 not found in floors asset set. Available sprites:", floorsAssetSet.sprites.map(s => s.name));
      return;
    }

    const textureKey = floorsAssetSet.textureKey;
    const tileName = grassSprite.name;
    const footprint = grassSprite.footprint || { width: 1, height: 1 };
    const origin = grassSprite.origin || { x: 0.5, y: 0.5 };

    let filledCount = 0;
    // Fill only empty cells with grass tiles
    for (let gridY = 0; gridY < this.gridSize; gridY++) {
      for (let gridX = 0; gridX < this.gridSize; gridX++) {
        const key = `${gridX},${gridY},0`;

        // Skip if this cell already has a tile
        if (this.cityMap.has(key)) {
          continue;
        }

        const isoPos = this.gridToIso(gridX, gridY);
        const sprite = this.add.image(isoPos.x, isoPos.y, textureKey, tileName);
        sprite.setOrigin(origin.x, origin.y);
        sprite.setDepth((gridX + gridY) * 100);

        this.cityMap.set(key, {
          sprite,
          tileName,
          textureKey,
          layer: 0,
          footprint,
          origin,
          isAnchor: true,
        });
        filledCount++;
      }
    }

    console.log(`Prefilled ${filledCount} empty cells with grass_02_11 tiles`);
  }

  async loadOasisMap() {
    try {
      const response = await fetch("/oasis-map.json");
      if (!response.ok) {
        console.log("No oasis-map.json found, skipping");
        return;
      }
      const mapData = await response.json();
      console.log("Loading oasis map on top of grass prefill...");
      await this.loadMap(mapData);
      console.log("Oasis map loaded successfully");
    } catch (error) {
      console.warn("Failed to load oasis-map.json:", error);
    }
  }

  async loadFromLocalStorage(): Promise<boolean> {
    try {
      const savedData = localStorage.getItem(this.AUTO_SAVE_KEY);
      if (!savedData) {
        console.log("No auto-save data found");
        return false;
      }

      const jsonData = JSON.parse(savedData);
      console.log("Loading map from auto-save...");
      await this.loadMap(jsonData);
      console.log("Auto-save loaded successfully");
      return true;
    } catch (error) {
      console.error("Error loading from local storage:", error);
      localStorage.removeItem(this.AUTO_SAVE_KEY); // Clear corrupted data
      return false;
    }
  }

  saveToLocalStorage() {
    try {
      const mapData: any[] = [];
      this.cityMap.forEach((tileData: any, key: string) => {
        if (!tileData.isAnchor) return;

        const [gridX, gridY, layer] = key.split(",").map(Number);
        const exportTile: any = {
          x: gridX,
          y: gridY,
          layer: layer || 0,
          tileName: tileData.tileName,
          textureKey: tileData.textureKey,
        };

        if (
          tileData.footprint &&
          (tileData.footprint.width > 1 || tileData.footprint.height > 1)
        ) {
          exportTile.footprint = tileData.footprint;
        }

        if (
          tileData.origin &&
          (tileData.origin.x !== 0.5 || tileData.origin.y !== 0.5)
        ) {
          exportTile.origin = tileData.origin;
        }

        mapData.push(exportTile);
      });

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
        version: "4.0",
        gridSize: this.gridSize,
        originOffsetX: this.originOffsetX,
        originOffsetY: this.originOffsetY,
        tileWidth: this.tileWidth,
        tileHeight: this.tileHeight,
        customAssets: customAssets,
        tiles: mapData,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem(this.AUTO_SAVE_KEY, JSON.stringify(jsonData));
      console.log("Auto-saved to local storage");
    } catch (error) {
      console.error("Error saving to local storage:", error);
    }
  }

  scheduleAutoSave() {
    if (this.autoSaveTimeout !== null) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = window.setTimeout(() => {
      this.saveToLocalStorage();
      this.autoSaveTimeout = null;
    }, this.AUTO_SAVE_DELAY);
  }

  drawVisibleGrid() {
    this.gridGraphics.clear();

    if (!this.gridVisible) return;

    this.gridGraphics.lineStyle(1, 0x999999, 0.4);

    const cam = this.cameras.main;
    const worldView = cam.worldView;

    // Convert the 4 corners of the viewport to grid coordinates
    const topLeft = this.isoToGrid(worldView.x, worldView.y);
    const topRight = this.isoToGrid(worldView.right, worldView.y);
    const bottomLeft = this.isoToGrid(worldView.x, worldView.bottom);
    const bottomRight = this.isoToGrid(worldView.right, worldView.bottom);

    const buffer = 3;
    // Clamp to grid bounds [0, gridSize)
    const minGridX = Math.max(0, Math.min(topLeft.gridX, topRight.gridX, bottomLeft.gridX, bottomRight.gridX) - buffer);
    const maxGridX = Math.min(this.gridSize - 1, Math.max(topLeft.gridX, topRight.gridX, bottomLeft.gridX, bottomRight.gridX) + buffer);
    const minGridY = Math.max(0, Math.min(topLeft.gridY, topRight.gridY, bottomLeft.gridY, bottomRight.gridY) - buffer);
    const maxGridY = Math.min(this.gridSize - 1, Math.max(topLeft.gridY, topRight.gridY, bottomLeft.gridY, bottomRight.gridY) + buffer);

    for (let row = minGridY; row <= maxGridY; row++) {
      for (let col = minGridX; col <= maxGridX; col++) {
        const pos = this.gridToIso(col, row);

        this.gridGraphics.beginPath();
        this.gridGraphics.moveTo(pos.x, pos.y - this.tileHeight / 2);
        this.gridGraphics.lineTo(pos.x + this.tileWidth / 2, pos.y);
        this.gridGraphics.lineTo(pos.x, pos.y + this.tileHeight / 2);
        this.gridGraphics.lineTo(pos.x - this.tileWidth / 2, pos.y);
        this.gridGraphics.closePath();
        this.gridGraphics.strokePath();
      }
    }
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
        const origin = sprite.origin || { x: 0.5, y: 0.5 };

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

    return {
      x: isoX + this.originOffsetX,
      y: isoY + this.originOffsetY,
    };
  }

  isoToGrid(isoX: number, isoY: number) {
    const adjustedX = isoX - this.originOffsetX;
    const adjustedY = isoY - this.originOffsetY;

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
          0.15,
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
      gridPos.gridX < 0 ||
      gridPos.gridX >= this.gridSize ||
      gridPos.gridY < 0 ||
      gridPos.gridY >= this.gridSize
    ) return;

    const assetSet = this.assetSets.get(this.selectedAssetSetId);
    const spriteData = assetSet?.sprites[this.selectedSpriteIndex];
    if (!assetSet || !spriteData) return;

    const footprint = spriteData.footprint || { width: 1, height: 1 };
    const origin = spriteData.origin || { x: 0.5, y: 0.5 };
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
    sprite.setDepth((centerX + centerY) * 100 + this.currentLayer * 1000);

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

    // Schedule auto-save
    this.scheduleAutoSave();
  }

  removeTile(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y
    );
    const gridPos = this.isoToGrid(worldPoint.x, worldPoint.y);

    if (
      gridPos.gridX < 0 ||
      gridPos.gridX >= this.gridSize ||
      gridPos.gridY < 0 ||
      gridPos.gridY >= this.gridSize
    ) return;

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

        // Schedule auto-save
        this.scheduleAutoSave();
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

  setGridVisible(visible: boolean) {
    this.gridVisible = visible;
    this.lastCameraScrollX = -Infinity; // Force redraw
  }

  expandGrid(amount: number) {
    this.gridSize = Math.max(5, this.gridSize + amount);
    this.lastCameraScrollX = -Infinity; // Force redraw
    window.dispatchEvent(
      new CustomEvent("phaserGridSizeChanged", {
        detail: { gridSize: this.gridSize },
      })
    );
    // Schedule auto-save when grid size changes
    this.scheduleAutoSave();
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
        (tileData.origin.x !== 0.5 || tileData.origin.y !== 0.5)
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
      version: "4.0",
      gridSize: this.gridSize,
      originOffsetX: this.originOffsetX,
      originOffsetY: this.originOffsetY,
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

      // Restore origin offset from save data, or compute from gridSize for legacy maps
      if (jsonData.originOffsetX !== undefined) {
        this.originOffsetX = jsonData.originOffsetX;
        this.originOffsetY = jsonData.originOffsetY ?? 200;
      } else if (jsonData.gridSize) {
        this.originOffsetX = (jsonData.gridSize * this.tileWidth) / 2;
        this.originOffsetY = 200;
      }

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
        const origin = tile.origin || { x: 0.5, y: 0.5 };
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
        sprite.setDepth((centerX + centerY) * 100 + layer * 1000);

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

      // Save to local storage after importing a map
      this.saveToLocalStorage();
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

    // Redraw grid and reposition background when camera moves or zooms
    const cam = this.cameras.main;
    if (
      cam.scrollX !== this.lastCameraScrollX ||
      cam.scrollY !== this.lastCameraScrollY ||
      cam.zoom !== this.lastCameraZoom
    ) {
      this.lastCameraScrollX = cam.scrollX;
      this.lastCameraScrollY = cam.scrollY;
      this.lastCameraZoom = cam.zoom;
      this.drawVisibleGrid();
    }
  }
}
