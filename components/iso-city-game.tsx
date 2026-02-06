/* eslint-disable react-hooks/unsupported-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { CityBuilder } from "@/lib/city-builder-scene";
import { AssetConfig } from "@/lib/game-types";
import { DEFAULT_ASSET_CONFIGS } from "@/lib/game-constants";

interface IsoCityGameProps {
  onTileSelect?: (tileIndex: number) => void;
  onGridPositionChange?: (x: number, y: number) => void;
  tileWidth?: number;
  tileHeight?: number;
  gridSize?: number;
  assetConfigs?: AssetConfig[];
}

export function IsoCityGame({
  onTileSelect,
  onGridPositionChange,
  tileWidth: propTileWidth = 132,
  tileHeight: propTileHeight = 66,
  gridSize: propGridSize = 30,
  assetConfigs = DEFAULT_ASSET_CONFIGS,
}: IsoCityGameProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current || phaserGameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: gameRef.current,
      scene: class extends CityBuilder {
        constructor() {
          super({
            tileWidth: propTileWidth,
            tileHeight: propTileHeight,
            gridSize: propGridSize,
            assetConfigs,
            onTileSelect,
            onGridPositionChange,
          });
        }
      },
      transparent: true,
      pixelArt: false,
      antialias: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    const game = new Phaser.Game(config);
    phaserGameRef.current = game;

    // Expose game functions to window
    (window as any).phaserSetSelectedTile = (
      index: number,
      assetSetId?: string
    ) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        scene.setSelectedTile(index, assetSetId);
      }
    };

    (window as any).phaserSetLayer = (layer: number) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        scene.setLayer(layer);
      }
    };

    (window as any).phaserExportMap = () => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        scene.exportMap();
      }
    };

    (window as any).phaserLoadMap = async (jsonData: any) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        await scene.loadMap(jsonData);
      }
    };

    (window as any).phaserGetAssetSets = () => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        return Array.from(scene.assetSets.values());
      }
      return [];
    };

    (window as any).phaserSetTileDimensions = (
      tileWidth: number,
      tileHeight: number
    ) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        scene.tileWidth = tileWidth;
        scene.tileHeight = tileHeight;
        // Force grid redraw on next frame by invalidating cache
        scene.lastCameraScrollX = -Infinity;
      }
    };

    (window as any).phaserSetGridVisible = (visible: boolean) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        scene.setGridVisible(visible);
      }
    };

    (window as any).phaserExpandGrid = (amount: number) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        scene.expandGrid(amount);
      }
    };

    (window as any).phaserGetGridSize = () => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene) {
        return scene.gridSize;
      }
      return 30;
    };

    // Add custom asset set at runtime
    (window as any).phaserAddCustomAsset = (
      id: string,
      name: string,
      imageDataUrl: string,
      sprites: Array<{
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
        footprint?: { width: number; height: number };
        origin?: { x: number; y: number };
      }>
    ) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (!scene) return false;

      const textureKey = `texture_${id}`;

      // Load the image as a texture
      return new Promise<boolean>((resolve) => {
        // Create an image element to load the data URL
        const img = new Image();
        img.onload = () => {
          // Add texture to Phaser
          if (scene.textures.exists(textureKey)) {
            scene.textures.remove(textureKey);
          }
          scene.textures.addImage(textureKey, img);

          const sourceTexture = scene.textures.get(textureKey);

          // Add frames for each sprite
          sprites.forEach((sprite) => {
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
            id,
            name,
            textureKey,
            xmlKey: `custom_${id}`,
            sprites,
            isCustom: true,
            imageDataUrl: imageDataUrl,
          };

          scene.assetSets.set(id, assetSet);
          console.log(
            `Added custom asset set: ${name} with ${sprites.length} sprites`
          );

          // Emit event for UI to update
          window.dispatchEvent(
            new CustomEvent("phaserAssetSetLoaded", {
              detail: { assetSet, imagePath: imageDataUrl },
            })
          );

          resolve(true);
        };
        img.onerror = () => {
          console.error("Failed to load custom asset image");
          resolve(false);
        };
        img.src = imageDataUrl;
      });
    };

    // Add sprite to existing custom asset set
    (window as any).phaserAddSpriteToAsset = (
      assetId: string,
      imageDataUrl: string,
      sprite: {
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
        footprint?: { width: number; height: number };
        origin?: { x: number; y: number };
      }
    ) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (!scene || !scene.assetSets.has(assetId)) return false;

      const assetSet = scene.assetSets.get(assetId);
      const textureKey = assetSet.textureKey;

      return new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Get existing texture
          const existingTexture = scene.textures.get(textureKey);
          if (!existingTexture) {
            resolve(false);
            return;
          }

          // Create a new canvas that combines existing texture with new sprite
          const existingSource =
            existingTexture.getSourceImage() as HTMLImageElement;
          const newWidth = Math.max(existingSource.width, sprite.width);
          const newHeight = existingSource.height + img.height;

          const canvas = document.createElement("canvas");
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve(false);
            return;
          }

          // Draw existing texture
          ctx.drawImage(existingSource, 0, 0);

          // Calculate new sprite position (below existing content)
          const newSpriteY = existingSource.height;

          // Draw new sprite
          ctx.drawImage(img, 0, newSpriteY);

          // Create new sprite data with updated position
          const newSprite = {
            ...sprite,
            x: 0,
            y: newSpriteY,
            width: img.width,
            height: img.height,
          };

          // Load the new combined image FIRST, before removing old texture
          // This prevents the glTexture crash from async gap
          const newImg = new Image();
          newImg.onload = () => {
            // Destroy hover sprite before texture manipulation
            if (scene.hoverSprite) {
              scene.hoverSprite.destroy();
              scene.hoverSprite = null;
            }

            // Temporarily destroy all placed sprites using this texture and store their data
            const spritesToRecreate: Array<{
              key: string;
              tileData: any;
              position: { x: number; y: number };
              depth: number;
            }> = [];

            scene.cityMap.forEach((tileData: any, key: string) => {
              if (tileData.sprite && tileData.textureKey === textureKey && tileData.isAnchor) {
                // Store sprite data for recreation
                spritesToRecreate.push({
                  key,
                  tileData: { ...tileData },
                  position: { x: tileData.sprite.x, y: tileData.sprite.y },
                  depth: tileData.sprite.depth,
                });
                // Destroy the sprite
                tileData.sprite.destroy();
                tileData.sprite = null;
              }
            });

            // NOW do the synchronous texture swap (no async gap)
            scene.textures.remove(textureKey);
            scene.textures.addImage(textureKey, newImg);
            const newTexture = scene.textures.get(textureKey);

            // Re-add all existing frames
            assetSet.sprites.forEach((existingSprite: any) => {
              newTexture.add(
                existingSprite.name,
                0,
                existingSprite.x,
                existingSprite.y,
                existingSprite.width,
                existingSprite.height
              );
            });

            // Add new frame
            newTexture.add(
              newSprite.name,
              0,
              newSprite.x,
              newSprite.y,
              newSprite.width,
              newSprite.height
            );

            // Recreate all sprites with the new texture
            spritesToRecreate.forEach(({ key, tileData, position, depth }) => {
              const newSpriteObj = scene.add.image(
                position.x,
                position.y,
                textureKey,
                tileData.tileName
              );
              newSpriteObj.setOrigin(tileData.origin.x, tileData.origin.y);
              newSpriteObj.setDepth(depth);

              // Update the sprite reference in cityMap
              const mapData = scene.cityMap.get(key);
              if (mapData) {
                mapData.sprite = newSpriteObj;
              }
            });

            // Update asset set
            assetSet.sprites.push(newSprite);

            // Update the imageDataUrl with the new combined image
            assetSet.imageDataUrl = canvas.toDataURL();

            // Reset hover position to force recreation of hover sprite on next move
            scene.lastHoverGridX = -1;
            scene.lastHoverGridY = -1;

            console.log(
              `Added sprite ${newSprite.name} to asset set ${assetId}`
            );

            // Emit event for UI to update - send full updated asset set
            window.dispatchEvent(
              new CustomEvent("phaserAssetSetLoaded", {
                detail: { assetSet, imagePath: assetSet.imageDataUrl },
              })
            );

            resolve(true);
          };
          newImg.src = canvas.toDataURL();
        };
        img.onerror = () => {
          console.error("Failed to load sprite image");
          resolve(false);
        };
        img.src = imageDataUrl;
      });
    };

    // Remove a single sprite from a custom asset set
    (window as any).phaserRemoveSpriteFromAsset = (
      assetId: string,
      spriteIndex: number
    ) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (!scene || !scene.assetSets.has(assetId)) return false;

      const assetSet = scene.assetSets.get(assetId);
      const textureKey = assetSet.textureKey;

      if (spriteIndex < 0 || spriteIndex >= assetSet.sprites.length)
        return false;

      const removedSprite = assetSet.sprites[spriteIndex];

      // Destroy hover sprite before texture manipulation
      if (scene.hoverSprite) {
        scene.hoverSprite.destroy();
        scene.hoverSprite = null;
      }

      // Remove all placed tiles that use this specific sprite
      const keysToRemove: string[] = [];
      scene.cityMap.forEach((tileData: any, key: string) => {
        if (
          tileData.textureKey === textureKey &&
          tileData.tileName === removedSprite.name
        ) {
          if (tileData.sprite) {
            tileData.sprite.destroy();
          }
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach((key: string) => scene.cityMap.delete(key));

      // Store placed sprites that use other sprites in this set for recreation
      const spritesToRecreate: Array<{
        key: string;
        tileData: any;
        position: { x: number; y: number };
        depth: number;
      }> = [];

      scene.cityMap.forEach((tileData: any, key: string) => {
        if (
          tileData.sprite &&
          tileData.textureKey === textureKey &&
          tileData.isAnchor
        ) {
          spritesToRecreate.push({
            key,
            tileData: { ...tileData },
            position: { x: tileData.sprite.x, y: tileData.sprite.y },
            depth: tileData.sprite.depth,
          });
          tileData.sprite.destroy();
          tileData.sprite = null;
        }
      });

      // Remove the sprite from the array
      const remainingSprites = assetSet.sprites.filter(
        (_: any, i: number) => i !== spriteIndex
      );
      assetSet.sprites = remainingSprites;

      // Rebuild the texture from remaining sprites
      const existingSource =
        scene.textures.get(textureKey).getSourceImage() as HTMLImageElement;

      // Remove old texture
      scene.textures.remove(textureKey);

      if (remainingSprites.length === 0) {
        // No sprites left - create a 1x1 transparent placeholder
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const placeholderImg = new Image();
        placeholderImg.onload = () => {
          scene.textures.addImage(textureKey, placeholderImg);
          assetSet.imageDataUrl = canvas.toDataURL();

          scene.lastHoverGridX = -1;
          scene.lastHoverGridY = -1;

          window.dispatchEvent(
            new CustomEvent("phaserAssetSetLoaded", {
              detail: { assetSet, imagePath: assetSet.imageDataUrl },
            })
          );
        };
        placeholderImg.src = canvas.toDataURL();
      } else {
        // Rebuild canvas with remaining sprites packed vertically
        let totalHeight = 0;
        let maxWidth = 0;
        const spriteImages: Array<{
          sx: number;
          sy: number;
          sw: number;
          sh: number;
        }> = [];

        remainingSprites.forEach((s: any) => {
          spriteImages.push({ sx: s.x, sy: s.y, sw: s.width, sh: s.height });
          maxWidth = Math.max(maxWidth, s.width);
          totalHeight += s.height;
        });

        const canvas = document.createElement("canvas");
        canvas.width = maxWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;

        let yOffset = 0;
        remainingSprites.forEach((s: any, i: number) => {
          const src = spriteImages[i];
          ctx.drawImage(
            existingSource,
            src.sx,
            src.sy,
            src.sw,
            src.sh,
            0,
            yOffset,
            src.sw,
            src.sh
          );
          s.x = 0;
          s.y = yOffset;
          yOffset += src.sh;
        });

        const newImg = new Image();
        newImg.onload = () => {
          scene.textures.addImage(textureKey, newImg);
          const newTexture = scene.textures.get(textureKey);

          remainingSprites.forEach((s: any) => {
            newTexture.add(s.name, 0, s.x, s.y, s.width, s.height);
          });

          // Recreate placed sprites
          spritesToRecreate.forEach(({ key, tileData, position, depth }) => {
            const newSpriteObj = scene.add.image(
              position.x,
              position.y,
              textureKey,
              tileData.tileName
            );
            newSpriteObj.setOrigin(tileData.origin.x, tileData.origin.y);
            newSpriteObj.setDepth(depth);

            const mapData = scene.cityMap.get(key);
            if (mapData) {
              mapData.sprite = newSpriteObj;
            }
          });

          assetSet.imageDataUrl = canvas.toDataURL();

          scene.lastHoverGridX = -1;
          scene.lastHoverGridY = -1;

          window.dispatchEvent(
            new CustomEvent("phaserAssetSetLoaded", {
              detail: { assetSet, imagePath: assetSet.imageDataUrl },
            })
          );
        };
        newImg.src = canvas.toDataURL();
      }

      // Update selected sprite index if needed
      if (scene.selectedAssetSetId === assetId) {
        if (scene.selectedSpriteIndex >= remainingSprites.length) {
          scene.selectedSpriteIndex = Math.max(0, remainingSprites.length - 1);
        }
      }

      return true;
    };

    // Remove custom asset set
    (window as any).phaserRemoveCustomAsset = (id: string) => {
      const scene = game.scene.getScene("CityBuilder") as any;
      if (scene && scene.assetSets.has(id)) {
        const textureKey = `texture_${id}`;

        // First, remove all placed tiles that use this texture
        const keysToRemove: string[] = [];
        scene.cityMap.forEach((tileData: any, key: string) => {
          if (tileData.textureKey === textureKey) {
            if (tileData.sprite) {
              tileData.sprite.destroy();
            }
            keysToRemove.push(key);
          }
        });
        keysToRemove.forEach((key: string) => scene.cityMap.delete(key));

        // Reset selection if this asset set was selected
        if (scene.selectedAssetSetId === id) {
          const allIds = Array.from(scene.assetSets.keys()) as string[];
          const remainingIds = allIds.filter((k) => k !== id);
          scene.selectedAssetSetId = remainingIds[0] || "";
          scene.selectedSpriteIndex = 0;
        }

        // Clear hover sprite if it uses this texture
        if (scene.hoverSprite) {
          scene.hoverSprite.setVisible(false);
        }

        // Remove the asset set first, then the texture
        scene.assetSets.delete(id);

        // Use a small delay to ensure all references are cleared before removing texture
        setTimeout(() => {
          if (scene.textures.exists(textureKey)) {
            scene.textures.remove(textureKey);
          }
        }, 100);

        window.dispatchEvent(
          new CustomEvent("phaserAssetSetRemoved", { detail: { id } })
        );
        return true;
      }
      return false;
    };

    return () => {
      game.destroy(true);
      phaserGameRef.current = null;
    };
  }, []); // Empty deps - only create once

  return (
    <div
      ref={gameRef}
      className="w-full h-full"
      style={{
        backgroundImage: "url(/dessert.png)",
        backgroundSize: "100% 100%",
      }}
    />
  );
}
