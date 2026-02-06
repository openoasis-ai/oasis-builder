"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, X, Plus, Grid3X3, Expand, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpritePacker } from "./sprite-packer";
import { SpriteData, AssetSet } from "@/lib/game-types";

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
  texture_tiles: "/assets/cityTiles_sheet.png",
  texture_details: "/assets/cityDetails_sheet.png",
  texture_buildings: "/assets/buildingTiles_sheet.png",
};

export function TileSelector({ onTileSelect }: TileSelectorProps) {
  const [assetSets, setAssetSets] = useState<Map<string, AssetSetWithPreviews>>(
    new Map()
  );
  const [selectedAssetSetId, setSelectedAssetSetId] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [addToAssetId, setAddToAssetId] = useState<string | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [gridSize, setGridSize] = useState(30);
  const [newTabDialogOpen, setNewTabDialogOpen] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    assetSetId: string;
    spriteIndex: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleAssetSetLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const assetSet: AssetSet = customEvent.detail.assetSet;

      // Use imagePath from event if provided (for custom assets), otherwise determine from texture key
      const imagePath =
        customEvent.detail.imagePath ||
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
            isCustom: !TEXTURE_TO_IMAGE[assetSet.textureKey],
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
          const remaining = Array.from(assetSets.keys()).filter(
            (k) => k !== id
          );
          return remaining[0] || "";
        }
        return current;
      });
    };

    const handleGridPositionChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      setGridPosition(customEvent.detail);
    };

    const handleGridSizeChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      setGridSize(customEvent.detail.gridSize);
    };

    window.addEventListener("phaserAssetSetLoaded", handleAssetSetLoaded);
    window.addEventListener("phaserAssetSetRemoved", handleAssetSetRemoved);
    window.addEventListener("gridPositionChange", handleGridPositionChange);
    window.addEventListener("phaserGridSizeChanged", handleGridSizeChanged);

    return () => {
      window.removeEventListener("phaserAssetSetLoaded", handleAssetSetLoaded);
      window.removeEventListener(
        "phaserAssetSetRemoved",
        handleAssetSetRemoved
      );
      window.removeEventListener(
        "gridPositionChange",
        handleGridPositionChange
      );
      window.removeEventListener(
        "phaserGridSizeChanged",
        handleGridSizeChanged
      );
    };
  }, [assetSets]);

  const generatePreviews = async (
    sprites: SpriteData[],
    imageSrc: string
  ): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const previews = sprites.map((sprite) => {
          const canvas = document.createElement("canvas");
          canvas.width = 46;
          canvas.height = 46;
          const ctx = canvas.getContext("2d");
          if (!ctx) return "";

          const scale = Math.min(46 / sprite.width, 46 / sprite.height) * 0.85;
          const drawWidth = sprite.width * scale;
          const drawHeight = sprite.height * scale;
          const offsetX = (46 - drawWidth) / 2;
          const offsetY = (46 - drawHeight) / 2;

          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            img,
            sprite.x,
            sprite.y,
            sprite.width,
            sprite.height,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight
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
        console.error("Error loading map file:", error);
        alert("Error loading map file. Please check the file format.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleToggleGrid = () => {
    const newVisible = !gridVisible;
    setGridVisible(newVisible);
    if ((window as any).phaserSetGridVisible) {
      (window as any).phaserSetGridVisible(newVisible);
    }
  };

  const handleExpandGrid = (amount: number) => {
    if ((window as any).phaserExpandGrid) {
      (window as any).phaserExpandGrid(amount);
    }
  };

  const handleCreateTab = () => {
    const name = newTabName.trim();
    if (!name) return;

    const id = name.toLowerCase().replace(/\s+/g, "_");

    // Create a 1x1 transparent image as placeholder
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const emptyImageDataUrl = canvas.toDataURL();

    const addCustomAsset = (window as any).phaserAddCustomAsset;
    if (addCustomAsset) {
      addCustomAsset(id, name, emptyImageDataUrl, []);
    }

    setNewTabDialogOpen(false);
    setNewTabName("");
  };

  const handleRemoveSprite = (assetSetId: string, spriteIndex: number) => {
    if ((window as any).phaserRemoveSpriteFromAsset) {
      (window as any).phaserRemoveSpriteFromAsset(assetSetId, spriteIndex);
    }
    setContextMenu(null);
  };

  const handleRemoveCustomAsset = (id: string) => {
    if ((window as any).phaserRemoveCustomAsset) {
      (window as any).phaserRemoveCustomAsset(id);
    }
    setDeleteConfirmId(null);
  };

  const assetSetArray = Array.from(assetSets.values());
  const assetToDelete = deleteConfirmId ? assetSets.get(deleteConfirmId) : null;

  return (
    <>
      <Card className="w-80 h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">City Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 flex flex-col overflow-hidden pt-0">
          {/* Save/Load Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              className="flex-1"
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={handleImport}
              className="flex-1"
              variant="outline"
              size="sm"
            >
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

          {/* Grid Controls */}
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <Button
              size="sm"
              variant={gridVisible ? "default" : "outline"}
              onClick={handleToggleGrid}
              className="h-7 px-2"
              title={gridVisible ? "Hide grid" : "Show grid"}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-medium">Grid: {gridSize}x{gridSize}</span>
            <div className="flex gap-1 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExpandGrid(-5)}
                disabled={gridSize <= 5}
                className="h-7 px-2"
                title="Shrink grid by 5"
              >
                -
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExpandGrid(5)}
                className="h-7 px-2"
                title="Expand grid by 5"
              >
                <Expand className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Custom Asset Packer */}
          <SpritePacker
            addToAssetId={addToAssetId}
            onClose={() => setAddToAssetId(null)}
          />

          {/* Dynamic Tabs for Asset Sets */}
          {assetSetArray.length > 0 && (
            <Tabs
              value={selectedAssetSetId}
              onValueChange={setSelectedAssetSetId}
              className="flex-1 flex flex-col overflow-hidden min-h-0"
            >
              <div className="w-full flex-shrink-0 overflow-x-auto">
                <div className="inline-flex items-center w-max min-w-full gap-1">
                  <TabsList className="inline-flex">
                    {assetSetArray.map((assetSet) => (
                      <TabsTrigger
                        key={assetSet.id}
                        value={assetSet.id}
                        className="text-xs px-2 whitespace-nowrap relative group"
                      >
                        {assetSet.name.replace("City ", "")} (
                        {assetSet.sprites.length})
                        {assetSet.isCustom && (
                          <span
                            role="button"
                            className="absolute -top-1 -right-1 w-4 h-4 bg-muted-foreground/20 hover:bg-muted-foreground/40 text-muted-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setDeleteConfirmId(assetSet.id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 flex-shrink-0"
                    onClick={() => setNewTabDialogOpen(true)}
                    title="Add new tab"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {assetSetArray.map((assetSet) => (
                <TabsContent
                  key={assetSet.id}
                  value={assetSet.id}
                  className="flex-1 mt-2 overflow-hidden flex flex-col min-h-0"
                >
                  <div className="flex-1 min-h-0 overflow-auto">
                    <div className="grid grid-cols-6 gap-1 pr-2">
                      {assetSet.previews.map((preview, index) => {
                        const sprite = assetSet.sprites[index];
                        const hasFootprint =
                          sprite?.footprint &&
                          (sprite.footprint.width > 1 ||
                            sprite.footprint.height > 1);
                        const isContextTarget =
                          contextMenu?.assetSetId === assetSet.id &&
                          contextMenu?.spriteIndex === index;

                        const tileButton = (
                          <Button
                            variant={
                              selectedAssetSetId === assetSet.id &&
                              index === selectedIndex
                                ? "default"
                                : "outline"
                            }
                            className="w-12 h-12 p-0 relative"
                            onClick={() => handleTileClick(index, assetSet.id)}
                            onContextMenu={(e) => {
                              if (!assetSet.isCustom) return;
                              e.preventDefault();
                              setContextMenu({
                                assetSetId: assetSet.id,
                                spriteIndex: index,
                              });
                            }}
                            title={
                              sprite?.footprint
                                ? `${sprite.footprint.width}x${sprite.footprint.height}`
                                : "1x1"
                            }
                          >
                            {preview && (
                              <img
                                src={preview}
                                alt=""
                                className="w-full h-full"
                              />
                            )}
                            {hasFootprint && (
                              <span className="absolute bottom-0 right-0 text-[8px] bg-blue-500 text-white px-0.5 rounded-tl">
                                {sprite.footprint?.width}x
                                {sprite.footprint?.height}
                              </span>
                            )}
                          </Button>
                        );

                        if (assetSet.isCustom) {
                          return (
                            <Popover
                              key={index}
                              open={isContextTarget}
                              onOpenChange={(open) => {
                                if (!open) setContextMenu(null);
                              }}
                            >
                              <PopoverTrigger asChild>
                                {tileButton}
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-1"
                                side="right"
                                align="start"
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-destructive hover:text-destructive h-8 px-2"
                                  onClick={() =>
                                    handleRemoveSprite(
                                      assetSet.id,
                                      index
                                    )
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                                  Delete
                                </Button>
                              </PopoverContent>
                            </Popover>
                          );
                        }

                        return (
                          <span key={index}>{tileButton}</span>
                        );
                      })}
                      {/* Add button for custom assets */}
                      {assetSet.isCustom && (
                        <Button
                          variant="outline"
                          className="w-12 h-12 p-0 border-dashed"
                          onClick={() => setAddToAssetId(assetSet.id)}
                          title="Add more sprites"
                        >
                          <Plus className="w-5 h-5 text-muted-foreground" />
                        </Button>
                      )}
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
            <p>
              Position: ({gridPosition.x}, {gridPosition.y}) | Layer:{" "}
              {currentLayer}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* New Tab Dialog */}
      <Dialog
        open={newTabDialogOpen}
        onOpenChange={(open) => {
          setNewTabDialogOpen(open);
          if (!open) setNewTabName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Tab</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="tab-name">Name</Label>
            <Input
              id="tab-name"
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              placeholder="My Custom Tiles"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTabName.trim()) handleCreateTab();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewTabDialogOpen(false);
                setNewTabName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTab} disabled={!newTabName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Asset?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assetToDelete?.name}"? This will
              also remove all placed tiles using this asset from the map. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteConfirmId && handleRemoveCustomAsset(deleteConfirmId)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
