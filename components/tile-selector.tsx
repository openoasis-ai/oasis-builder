'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TileSprite {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TileSelectorProps {
  onTileSelect: (index: number) => void;
}

export function TileSelector({ onTileSelect }: TileSelectorProps) {
  const [tileSprites, setTileSprites] = useState<TileSprite[]>([]);
  const [detailSprites, setDetailSprites] = useState<TileSprite[]>([]);
  const [buildingSprites, setBuildingSprites] = useState<TileSprite[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedType, setSelectedType] = useState<'tiles' | 'details' | 'buildings'>('tiles');
  const [currentLayer, setCurrentLayer] = useState(0);
  const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
  const tileCanvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const detailCanvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const buildingCanvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleTilesLoaded = (event: CustomEvent) => {
      const sprites = event.detail.tileSprites;
      setTileSprites(sprites);

      setTimeout(() => {
        drawTilePreviews(sprites, tileCanvasRefs, '/assets/cityTiles_sheet.png');
      }, 100);
    };

    const handleDetailsLoaded = (event: CustomEvent) => {
      const sprites = event.detail.detailSprites;
      setDetailSprites(sprites);

      setTimeout(() => {
        drawTilePreviews(sprites, detailCanvasRefs, '/assets/cityDetails_sheet.png');
      }, 100);
    };

    const handleBuildingsLoaded = (event: CustomEvent) => {
      const sprites = event.detail.buildingSprites;
      setBuildingSprites(sprites);

      setTimeout(() => {
        drawTilePreviews(sprites, buildingCanvasRefs, '/assets/buildingTiles_sheet.png');
      }, 100);
    };

    const handleGridPositionChange = (event: CustomEvent) => {
      setGridPosition(event.detail);
    };

    window.addEventListener('phaserTilesLoaded', handleTilesLoaded as EventListener);
    window.addEventListener('phaserDetailsLoaded', handleDetailsLoaded as EventListener);
    window.addEventListener('phaserBuildingsLoaded', handleBuildingsLoaded as EventListener);
    window.addEventListener('gridPositionChange', handleGridPositionChange as EventListener);

    return () => {
      window.removeEventListener('phaserTilesLoaded', handleTilesLoaded as EventListener);
      window.removeEventListener('phaserDetailsLoaded', handleDetailsLoaded as EventListener);
      window.removeEventListener('phaserBuildingsLoaded', handleBuildingsLoaded as EventListener);
      window.removeEventListener('gridPositionChange', handleGridPositionChange as EventListener);
    };
  }, []);

  const drawTilePreviews = (
    sprites: TileSprite[],
    canvasRefs: React.MutableRefObject<{ [key: number]: HTMLCanvasElement | null }>,
    imageSrc: string
  ) => {
    sprites.forEach((sprite, index) => {
      const canvas = canvasRefs.current[index];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.src = imageSrc;

      img.onload = () => {
        const scale = Math.min(46 / sprite.width, 46 / sprite.height) * 0.85;
        const drawWidth = sprite.width * scale;
        const drawHeight = sprite.height * scale;
        const offsetX = (46 - drawWidth) / 2;
        const offsetY = (46 - drawHeight) / 2;

        ctx.clearRect(0, 0, 46, 46);
        ctx.drawImage(img,
          sprite.x, sprite.y, sprite.width, sprite.height,
          offsetX, offsetY, drawWidth, drawHeight);
      };
    });
  };

  const handleTileClick = (tileIndex: number, type: 'tiles' | 'details' | 'buildings') => {
    setSelectedIndex(tileIndex);
    setSelectedType(type);
    onTileSelect(tileIndex);

    // Call Phaser's setSelectedTile with type
    if ((window as any).phaserSetSelectedTile) {
      (window as any).phaserSetSelectedTile(tileIndex, type);
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

  return (
    <Card className="w-80 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">🏙️ City Builder</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col overflow-hidden">
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

        {/* Tabs for Tiles, Details, and Buildings */}
        <Tabs defaultValue="tiles" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tiles">Tiles ({tileSprites.length})</TabsTrigger>
            <TabsTrigger value="details">Details ({detailSprites.length})</TabsTrigger>
            <TabsTrigger value="buildings">Buildings ({buildingSprites.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tiles" className="flex-1 mt-2">
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-6 gap-1">
                {tileSprites.map((sprite, index) => (
                  <Button
                    key={index}
                    variant={selectedType === 'tiles' && index === selectedIndex ? "default" : "outline"}
                    className="w-12 h-12 p-0"
                    onClick={() => handleTileClick(index, 'tiles')}
                  >
                    <canvas
                      ref={(el) => { tileCanvasRefs.current[index] = el; }}
                      width={46}
                      height={46}
                      className="w-full h-full"
                    />
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="details" className="flex-1 mt-2">
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-6 gap-1">
                {detailSprites.map((sprite, index) => (
                  <Button
                    key={index}
                    variant={selectedType === 'details' && index === selectedIndex ? "default" : "outline"}
                    className="w-12 h-12 p-0"
                    onClick={() => handleTileClick(index, 'details')}
                  >
                    <canvas
                      ref={(el) => { detailCanvasRefs.current[index] = el; }}
                      width={46}
                      height={46}
                      className="w-full h-full"
                    />
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="buildings" className="flex-1 mt-2">
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-6 gap-1">
                {buildingSprites.map((sprite, index) => (
                  <Button
                    key={index}
                    variant={selectedType === 'buildings' && index === selectedIndex ? "default" : "outline"}
                    className="w-12 h-12 p-0"
                    onClick={() => handleTileClick(index, 'buildings')}
                  >
                    <canvas
                      ref={(el) => { buildingCanvasRefs.current[index] = el; }}
                      width={46}
                      height={46}
                      className="w-full h-full"
                    />
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Controls:</h3>
          <div className="space-y-1 text-muted-foreground text-xs">
            <p>🖱️ Left Click: Place</p>
            <p>🗑️ Right Click: Delete</p>
            <p>⌨️ WASD / Arrows: Pan</p>
            <p>🔄 Wheel: Zoom</p>
          </div>
        </div>

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p>Position: ({gridPosition.x}, {gridPosition.y})</p>
        </div>
      </CardContent>
    </Card>
  );
}
