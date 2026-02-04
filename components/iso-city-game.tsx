/* eslint-disable react-hooks/unsupported-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

interface IsoCityGameProps {
  onTileSelect?: (tileIndex: number) => void;
  onGridPositionChange?: (x: number, y: number) => void;
}

export function IsoCityGame({ onTileSelect, onGridPositionChange }: IsoCityGameProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current || phaserGameRef.current) return;

    class CityBuilder extends Phaser.Scene {
      gridSize = 30;
      tileWidth = 132;
      tileHeight = 66;
      cityMap = new Map();
      selectedTileIndex = 0;
      tileSprites: any[] = [];
      detailSprites: any[] = [];
      buildingSprites: any[] = [];
      selectedSpriteType: 'tiles' | 'details' | 'buildings' = 'tiles';
      currentLayer = 0; // For stacking buildings
      hoverSprite: Phaser.GameObjects.Image | null = null;
      hoverGraphics!: Phaser.GameObjects.Graphics;
      cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
      wasd!: any;
      lastHoverGridX = -1;
      lastHoverGridY = -1;

      constructor() {
        super({ key: 'CityBuilder' });
      }

      preload() {
        console.log('Loading assets...');
        this.load.image('cityTiles', '/assets/cityTiles_sheet.png');
        this.load.image('cityDetails', '/assets/cityDetails_sheet.png');
        this.load.image('buildingTiles', '/assets/buildingTiles_sheet.png');
        this.load.text('cityTilesXML', '/assets/cityTiles_sheet.xml');
        this.load.text('cityDetailsXML', '/assets/cityDetails_sheet.xml');
        this.load.text('buildingTilesXML', '/assets/buildingTiles_sheet.xml');

        this.load.on('complete', () => {
          console.log('Assets loaded successfully');
        });

        this.load.on('loaderror', (file: any) => {
          console.error('Error loading file:', file.key, file.src);
        });
      }

      create() {
        this.parseAndCreateFrames();
        this.parseAndCreateDetailsFrames();
        this.parseAndCreateBuildingFrames();
        this.cameras.main.setBackgroundColor('#87CEEB');
        this.cameras.main.zoom = 0.6; // Start more zoomed out

        const centerX = this.gridSize * this.tileWidth / 2;
        const centerY = this.gridSize * this.tileHeight / 2;
        this.cameras.main.centerOn(centerX, centerY + 200);

        this.drawGrid();
        this.hoverGraphics = this.add.graphics();
        this.hoverGraphics.setDepth(9999); // Keep hover above everything except preview sprite

        this.setupInput();

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys({
          up: Phaser.Input.Keyboard.KeyCodes.W,
          down: Phaser.Input.Keyboard.KeyCodes.S,
          left: Phaser.Input.Keyboard.KeyCodes.A,
          right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
          this.updateHoverPreview(pointer);
        });
      }

      parseAndCreateFrames() {
        const xmlText = this.cache.text.get('cityTilesXML');

        if (!xmlText) {
          console.error('Failed to load cityTilesXML');
          return;
        }

        // Parse XML text
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const subtextures = xmlDoc.querySelectorAll('SubTexture');

        const sourceTexture = this.textures.get('cityTiles');

        if (!sourceTexture) {
          console.error('Failed to load cityTiles texture');
          return;
        }

        subtextures.forEach((subtexture: Element) => {
          const name = subtexture.getAttribute('name')!;
          const x = parseInt(subtexture.getAttribute('x')!);
          const y = parseInt(subtexture.getAttribute('y')!);
          const width = parseInt(subtexture.getAttribute('width')!);
          const height = parseInt(subtexture.getAttribute('height')!);

          sourceTexture.add(name, 0, x, y, width, height);

          this.tileSprites.push({
            name: name,
            x: x,
            y: y,
            width: width,
            height: height
          });
        });

        console.log(`Loaded ${this.tileSprites.length} tile sprites`);

        // Emit tiles loaded event
        window.dispatchEvent(new CustomEvent('phaserTilesLoaded', {
          detail: { tileSprites: this.tileSprites }
        }));
      }

      parseAndCreateDetailsFrames() {
        const xmlText = this.cache.text.get('cityDetailsXML');

        if (!xmlText) {
          console.error('Failed to load cityDetailsXML');
          return;
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const subtextures = xmlDoc.querySelectorAll('SubTexture');

        const sourceTexture = this.textures.get('cityDetails');

        if (!sourceTexture) {
          console.error('Failed to load cityDetails texture');
          return;
        }

        subtextures.forEach((subtexture: Element) => {
          const name = subtexture.getAttribute('name')!;
          const x = parseInt(subtexture.getAttribute('x')!);
          const y = parseInt(subtexture.getAttribute('y')!);
          const width = parseInt(subtexture.getAttribute('width')!);
          const height = parseInt(subtexture.getAttribute('height')!);

          sourceTexture.add(name, 0, x, y, width, height);

          this.detailSprites.push({
            name: name,
            x: x,
            y: y,
            width: width,
            height: height
          });
        });

        console.log(`Loaded ${this.detailSprites.length} detail sprites`);

        // Emit details loaded event
        window.dispatchEvent(new CustomEvent('phaserDetailsLoaded', {
          detail: { detailSprites: this.detailSprites }
        }));
      }

      parseAndCreateBuildingFrames() {
        const xmlText = this.cache.text.get('buildingTilesXML');

        if (!xmlText) {
          console.error('Failed to load buildingTilesXML');
          return;
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const subtextures = xmlDoc.querySelectorAll('SubTexture');

        const sourceTexture = this.textures.get('buildingTiles');

        if (!sourceTexture) {
          console.error('Failed to load buildingTiles texture');
          return;
        }

        subtextures.forEach((subtexture: Element) => {
          const name = subtexture.getAttribute('name')!;
          const x = parseInt(subtexture.getAttribute('x')!);
          const y = parseInt(subtexture.getAttribute('y')!);
          const width = parseInt(subtexture.getAttribute('width')!);
          const height = parseInt(subtexture.getAttribute('height')!);

          sourceTexture.add(name, 0, x, y, width, height);

          this.buildingSprites.push({
            name: name,
            x: x,
            y: y,
            width: width,
            height: height
          });
        });

        console.log(`Loaded ${this.buildingSprites.length} building sprites`);

        // Emit buildings loaded event
        window.dispatchEvent(new CustomEvent('phaserBuildingsLoaded', {
          detail: { buildingSprites: this.buildingSprites }
        }));
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
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const gridPos = this.isoToGrid(worldPoint.x, worldPoint.y);

        // Only update if grid position changed
        if (gridPos.gridX === this.lastHoverGridX && gridPos.gridY === this.lastHoverGridY) {
          return;
        }

        this.lastHoverGridX = gridPos.gridX;
        this.lastHoverGridY = gridPos.gridY;
        this.hoverGraphics.clear();

        if (gridPos.gridX >= 0 && gridPos.gridX < this.gridSize &&
            gridPos.gridY >= 0 && gridPos.gridY < this.gridSize) {

          const isoPos = this.gridToIso(gridPos.gridX, gridPos.gridY);

          this.hoverGraphics.lineStyle(2, 0x00ff00, 0.8);
          this.hoverGraphics.fillStyle(0x00ff00, 0.2);
          this.hoverGraphics.beginPath();
          this.hoverGraphics.moveTo(isoPos.x, isoPos.y - this.tileHeight / 2);
          this.hoverGraphics.lineTo(isoPos.x + this.tileWidth / 2, isoPos.y);
          this.hoverGraphics.lineTo(isoPos.x, isoPos.y + this.tileHeight / 2);
          this.hoverGraphics.lineTo(isoPos.x - this.tileWidth / 2, isoPos.y);
          this.hoverGraphics.closePath();
          this.hoverGraphics.strokePath();
          this.hoverGraphics.fillPath();

          // Update sprite position instead of destroying/creating
          const sprites = this.selectedSpriteType === 'tiles' ? this.tileSprites :
                          this.selectedSpriteType === 'details' ? this.detailSprites :
                          this.buildingSprites;
          const textureKey = this.selectedSpriteType === 'tiles' ? 'cityTiles' :
                             this.selectedSpriteType === 'details' ? 'cityDetails' :
                             'buildingTiles';
          const tileName = sprites[this.selectedTileIndex]?.name;

          if (tileName) {
            if (this.hoverSprite) {
              this.hoverSprite.setTexture(textureKey, tileName);
              this.hoverSprite.setPosition(isoPos.x, isoPos.y - (this.currentLayer * 30));
              this.hoverSprite.setVisible(true);
            } else {
              this.hoverSprite = this.add.image(isoPos.x, isoPos.y - (this.currentLayer * 30), textureKey, tileName);
              this.hoverSprite.setOrigin(0.5, 0.65);
              this.hoverSprite.setAlpha(0.5);
              this.hoverSprite.setDepth(10000);
            }
          }

          if (onGridPositionChange) {
            onGridPositionChange(gridPos.gridX, gridPos.gridY);
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
        const offsetX = this.gridSize * this.tileWidth / 2;
        const offsetY = 200;

        return {
          x: isoX + offsetX,
          y: isoY + offsetY
        };
      }

      isoToGrid(isoX: number, isoY: number) {
        const offsetX = this.gridSize * this.tileWidth / 2;
        const offsetY = 200;
        const adjustedX = isoX - offsetX;
        const adjustedY = isoY - offsetY;

        const gridX = Math.floor((adjustedX / (this.tileWidth / 2) + adjustedY / (this.tileHeight / 2)) / 2);
        const gridY = Math.floor((adjustedY / (this.tileHeight / 2) - adjustedX / (this.tileWidth / 2)) / 2);

        return { gridX, gridY };
      }

      setupInput() {
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.leftButtonDown()) {
            this.placeTile(pointer);
          } else if (pointer.rightButtonDown()) {
            this.removeTile(pointer);
          }
        });

        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: any, _deltaX: number, deltaY: number) => {
          const zoomAmount = deltaY > 0 ? -0.1 : 0.1;
          const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom + zoomAmount, 0.5, 2);
          this.cameras.main.zoom = newZoom;
        });
      }

      placeTile(pointer: Phaser.Input.Pointer) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const gridPos = this.isoToGrid(worldPoint.x, worldPoint.y);

        if (gridPos.gridX >= 0 && gridPos.gridX < this.gridSize &&
            gridPos.gridY >= 0 && gridPos.gridY < this.gridSize) {

          const key = `${gridPos.gridX},${gridPos.gridY},${this.currentLayer}`;

          // Check if there's already a tile at this position and layer
          if (this.cityMap.has(key)) {
            this.cityMap.get(key).sprite.destroy();
          }

          const isoPos = this.gridToIso(gridPos.gridX, gridPos.gridY);
          const sprites = this.selectedSpriteType === 'tiles' ? this.tileSprites :
                          this.selectedSpriteType === 'details' ? this.detailSprites :
                          this.buildingSprites;
          const textureKey = this.selectedSpriteType === 'tiles' ? 'cityTiles' :
                             this.selectedSpriteType === 'details' ? 'cityDetails' :
                             'buildingTiles';
          const tileName = sprites[this.selectedTileIndex]?.name;

          if (tileName) {
            // Offset Y position for stacking (higher layers appear above)
            const yOffset = this.currentLayer * 30;
            const sprite = this.add.image(isoPos.x, isoPos.y - yOffset, textureKey, tileName);
            sprite.setOrigin(0.5, 0.65);
            // Depth includes layer to ensure proper rendering order
            sprite.setDepth((gridPos.gridX + gridPos.gridY) * 100 + this.currentLayer * 10);

            this.cityMap.set(key, { sprite, tileName, textureKey, layer: this.currentLayer });
          }
        }
      }

      removeTile(pointer: Phaser.Input.Pointer) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const gridPos = this.isoToGrid(worldPoint.x, worldPoint.y);

        if (gridPos.gridX >= 0 && gridPos.gridX < this.gridSize &&
            gridPos.gridY >= 0 && gridPos.gridY < this.gridSize) {

          const key = `${gridPos.gridX},${gridPos.gridY},${this.currentLayer}`;

          if (this.cityMap.has(key)) {
            this.cityMap.get(key).sprite.destroy();
            this.cityMap.delete(key);
          }
        }
      }

      setSelectedTile(index: number, type: 'tiles' | 'details' | 'buildings' = 'tiles') {
        this.selectedTileIndex = index;
        this.selectedSpriteType = type;
        // Force hover update by resetting last position
        this.lastHoverGridX = -1;
        this.lastHoverGridY = -1;
      }

      setLayer(layer: number) {
        this.currentLayer = Math.max(0, Math.min(layer, 10)); // Max 10 layers
        this.lastHoverGridX = -1;
        this.lastHoverGridY = -1;
        console.log('Current layer:', this.currentLayer);
      }

      exportMap() {
        const mapData: any[] = [];
        this.cityMap.forEach((tileData: any, key: string) => {
          const [gridX, gridY, layer] = key.split(',').map(Number);
          mapData.push({
            x: gridX,
            y: gridY,
            layer: layer || 0,
            tileName: tileData.tileName,
            textureKey: tileData.textureKey || 'cityTiles'
          });
        });

        const jsonData = {
          version: '1.0',
          gridSize: this.gridSize,
          tiles: mapData,
          timestamp: new Date().toISOString()
        };

        const dataStr = JSON.stringify(jsonData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `city-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);

        console.log('Map exported with', mapData.length, 'tiles');
      }

      loadMap(jsonData: any) {
        try {
          // Clear existing map
          this.cityMap.forEach((tileData: any) => tileData.sprite.destroy());
          this.cityMap.clear();

          // Load tiles from JSON
          jsonData.tiles.forEach((tile: any) => {
            const isoPos = this.gridToIso(tile.x, tile.y);
            const textureKey = tile.textureKey || 'cityTiles';
            const layer = tile.layer || 0;
            const yOffset = layer * 30;
            const sprite = this.add.image(isoPos.x, isoPos.y - yOffset, textureKey, tile.tileName);
            sprite.setOrigin(0.5, 0.65);
            sprite.setDepth((tile.x + tile.y) * 100 + layer * 10);
            this.cityMap.set(`${tile.x},${tile.y},${layer}`, {
              sprite,
              tileName: tile.tileName,
              textureKey,
              layer
            });
          });

          console.log('Map loaded with', jsonData.tiles.length, 'tiles');
        } catch (error) {
          console.error('Error loading map:', error);
        }
      }

      update() {
        const panSpeed = 8;

        if (this.cursors?.left.isDown || this.wasd?.left.isDown) {
          this.cameras.main.scrollX -= panSpeed;
        }
        if (this.cursors?.right.isDown || this.wasd?.right.isDown) {
          this.cameras.main.scrollX += panSpeed;
        }
        if (this.cursors?.up.isDown || this.wasd?.up.isDown) {
          this.cameras.main.scrollY -= panSpeed;
        }
        if (this.cursors?.down.isDown || this.wasd?.down.isDown) {
          this.cameras.main.scrollY += panSpeed;
        }
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: gameRef.current,
      scene: CityBuilder,
      backgroundColor: '#87CEEB',
      pixelArt: false,
      antialias: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    };

    const game = new Phaser.Game(config);
    phaserGameRef.current = game;

    // Expose game functions to window
    (window as any).phaserSetSelectedTile = (index: number, type: 'tiles' | 'details' | 'buildings' = 'tiles') => {
      const scene = game.scene.getScene('CityBuilder') as any;
      if (scene) {
        scene.setSelectedTile(index, type);
      }
    };

    (window as any).phaserSetLayer = (layer: number) => {
      const scene = game.scene.getScene('CityBuilder') as any;
      if (scene) {
        scene.setLayer(layer);
      }
    };

    (window as any).phaserExportMap = () => {
      const scene = game.scene.getScene('CityBuilder') as any;
      if (scene) {
        scene.exportMap();
      }
    };

    (window as any).phaserLoadMap = (jsonData: any) => {
      const scene = game.scene.getScene('CityBuilder') as any;
      if (scene) {
        scene.loadMap(jsonData);
      }
    };

    return () => {
      game.destroy(true);
      phaserGameRef.current = null;
    };
  }, []); // Empty deps - only create once

  return <div ref={gameRef} className="w-full h-full" />;
}
