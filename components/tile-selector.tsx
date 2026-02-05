'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SpritePacker } from './sprite-packer';

interface SpriteData {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  footprint?: { width: number; height: number };
}

interface AssetSet {
  id: string;
  name: string;
  textureKey: string;
  xmlKey: string;
  sprites: SpriteData[];
}

interface AssetSetWithPreviews extends AssetSet {
  previews: string[];
  imagePath: string;
  isCustom?: boolean;
}

interface TileSelectorProps {
  onTileSelect: (index: number) => void;
}

// Map texture keys to image paths
const TEXTURE_TO_IMAGE: Record<string, string> = {
  'texture_tiles': '/assets/cityTiles_sheet.png',
  'texture_details': '/assets/cityDetails_sheet.png',
  'texture_buildings': '/assets/buildingTiles_sheet.png',
};

export function TileSelector({ onTileSelect }: TileSelectorProps) {
  const [assetSets, setAssetSets] = useState<Map<string, AssetSetWithPreviews>>(new Map());
  const [selectedAssetSetId, setSelectedAssetSetId] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleAssetSetLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const assetSet: AssetSet = customEvent.detail.assetSet;

      // Use imagePath from event if provided (for custom assets), otherwise determine from texture key
      const imagePath = customEvent.detail.imagePath ||
        TEXTURE_TO_IMAGE[assetSet.textureKey] ||
        `/assets/${assetSet.id}_sheet.png`;

      // Generate previews asynchronously
      generatePreviews(assetSet.sprites, imagePath).then((previews) => {
        setAssetSets((prev) => {
          const newMap = new Map(prev);
          newMap.set(assetSet.id, {
            ...assetSet,
            previews,
            imagePath,
            isCustom: !TEXTURE_TO_IMAGE[assetSet.textureKey]
          } as AssetSetWithPreviews);
          return newMap;
        });
      });

      // Select first asset set by default
      setSelectedAssetSetId((current) => current || assetSet.id);
    };

    const handleAssetSetRemoved = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { id } = customEvent.detail;
      setAssetSets((prev) => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      setSelectedAssetSetId((current) => {
        if (current === id) {
          const remaining = Array.from(assetSets.keys()).filter(k => k !== id);
          return remaining[0] || '';
        }
        return current;
      });
    };

    const handleGridPositionChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      setGridPosition(customEvent.detail);
    };

    window.addEventListener('phaserAssetSetLoaded', handleAssetSetLoaded);
    window.addEventListener('phaserAssetSetRemoved', handleAssetSetRemoved);
    window.addEventListener('gridPositionChange', handleGridPositionChange);

    return () => {
      window.removeEventListener('phaserAssetSetLoaded', handleAssetSetLoaded);
      window.removeEventListener('phaserAssetSetRemoved', handleAssetSetRemoved);
      window.removeEventListener('gridPositionChange', handleGridPositionChange);
    };
  }, [assetSets]);

  const generatePreviews = async (sprites: SpriteData[], imageSrc: string): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const previews = sprites.map((sprite) => {
          const canvas = document.createElement('canvas');
          canvas.width = 46;
          canvas.height = 46;
          const ctx = canvas.getContext('2d');
          if (!ctx) return '';

          const scale = Math.min(46 / sprite.width, 46 / sprite.height) * 0.85;
          const drawWidth = sprite.width * scale;
          const drawHeight = sprite.height * scale;
          const offsetX = (46 - drawWidth) / 2;
          const offsetY = (46 - drawHeight) / 2;

          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            img,
            sprite.x, sprite.y, sprite.width, sprite.height,
            offsetX, offsetY, drawWidth, drawHeight
          );

          return canvas.toDataURL();
        });
        resolve(previews);
      };
      img.onerror = () => resolve([]);
      img.src = imageSrc;
    });
  };

  const handleTileClick = (tileIndex: number, assetSetId: string) => {
    setSelectedIndex(tileIndex);
    setSelectedAssetSetId(assetSetId);
    onTileSelect(tileIndex);

    if ((window as any).phaserSetSelectedTile) {
      (window as any).phaserSetSelectedTile(tileIndex, assetSetId);
    }
  };

  const handleLayerChange = (delta: number) => {
    const newLayer = Math.max(0, Math.min(currentLayer + delta, 10));
    setCurrentLayer(newLayer);
    if ((window as any).phaserSetLayer) {
      (window as any).phaserSetLayer(newLayer);
    }
  };

  const handleExport = () => {
    if ((window as any).phaserExportMap) {
      (window as any).phaserExportMap();
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        if ((window as any).phaserLoadMap) {
          (window as any).phaserLoadMap(jsonData);
        }
      } catch (error) {
        console.error('Error loading map file:', error);
        alert('Error loading map file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRemoveCustomAsset = (id: string) => {
    if ((window as any).phaserRemoveCustomAsset) {
      (window as any).phaserRemoveCustomAsset(id);
    }
  };

  const assetSetArray = Array.from(assetSets.values());

  return (
    <Card className="w-80 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">City Builder</CardTitle>
      </CardHeader>
        <CardContent className="space-y-3 flex-1 flex flex-col overflow-hidden pt-0">
          {/* Save/Load Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleExport} className="flex-1" variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleImport} className="flex-1" variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileLoad}
              className="hidden"
            />
          </div>

          {/* Layer Controls */}
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <span className="text-xs font-medium">Layer: {currentLayer}</span>
            <div className="flex gap-1 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleLayerChange(-1)}
                disabled={currentLayer === 0}
                className="h-7 px-2"
              >
                -
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleLayerChange(1)}
                disabled={currentLayer === 10}
                className="h-7 px-2"
              >
                +
              </Button>
            </div>
          </div>

          {/* Custom Asset Packer */}
          <SpritePacker />

          {/* Dynamic Tabs for Asset Sets */}
          {assetSetArray.length > 0 && (
            <Tabs
              value={selectedAssetSetId}
              onValueChange={setSelectedAssetSetId}
              className="flex-1 flex flex-col overflow-hidden min-h-0"
            >
              <div className="w-full flex-shrink-0 overflow-x-auto">
                <TabsList className="inline-flex w-max min-w-full">
                  {assetSetArray.map((assetSet) => (
                    <TabsTrigger key={assetSet.id} value={assetSet.id} className="text-xs px-2 whitespace-nowrap">
                      {assetSet.name.replace('City ', '')} ({assetSet.sprites.length})
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {assetSetArray.map((assetSet) => (
                <TabsContent key={assetSet.id} value={assetSet.id} className="flex-1 mt-2 overflow-hidden flex flex-col min-h-0">
                  {assetSet.isCustom && (
                    <div className="flex justify-end mb-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleRemoveCustomAsset(assetSet.id)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  )}
                  <div className="flex-1 min-h-0 overflow-auto">
                    <div className="grid grid-cols-6 gap-1 pr-2">
                      {assetSet.previews.map((preview, index) => {
                        const sprite = assetSet.sprites[index];
                        const hasFootprint = sprite?.footprint &&
                          (sprite.footprint.width > 1 || sprite.footprint.height > 1);

                        return (
                          <Button
                            key={index}
                            variant={selectedAssetSetId === assetSet.id && index === selectedIndex ? "default" : "outline"}
                            className="w-12 h-12 p-0 relative"
                            onClick={() => handleTileClick(index, assetSet.id)}
                            title={sprite?.footprint ? `${sprite.footprint.width}x${sprite.footprint.height}` : '1x1'}
                          >
                            {preview && <img src={preview} alt="" className="w-full h-full" />}
                            {hasFootprint && (
                              <span className="absolute bottom-0 right-0 text-[8px] bg-blue-500 text-white px-0.5 rounded-tl">
                                {sprite.footprint?.width}x{sprite.footprint?.height}
                              </span>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}

          {assetSetArray.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Loading assets...
            </div>
          )}

          <div className="pt-2 border-t text-xs text-muted-foreground flex-shrink-0">
          <p>Position: ({gridPosition.x}, {gridPosition.y}) | Layer: {currentLayer}</p>
        </div>
      </CardContent>
    </Card>
  );
}
