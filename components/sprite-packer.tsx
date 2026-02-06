"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Plus,
  ImagePlus,
  FileCode,
  Wand2,
  Loader2,
  Upload,
} from "lucide-react";
import { processImageForIsometric } from "@/lib/image-processing";
import { SpritePreviewCanvas } from "@/components/sprite-preview-canvas";

interface SpritePackerProps {
  onAssetAdded?: () => void;
  addToAssetId?: string | null;
  onClose?: () => void;
}

export function SpritePacker({
  onAssetAdded,
  addToAssetId,
  onClose,
}: SpritePackerProps) {
  const [open, setOpen] = useState(false);
  const [activeAddToAssetId, setActiveAddToAssetId] = useState<string | null>(
    null,
  );
  const isAddingToExisting = !!activeAddToAssetId;
  const [mode, setMode] = useState<"upload" | "generate">("upload");

  // Common state
  const [assetName, setAssetName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Upload mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Generate mode state
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [footprintWidth, setFootprintWidth] = useState(1);
  const [footprintHeight, setFootprintHeight] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [processedDimensions, setProcessedDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [originX, setOriginX] = useState(0.5);
  const [originY, setOriginY] = useState(0.85);
  const [spriteScale, setSpriteScale] = useState(1.0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const singleImageInputRef = useRef<HTMLInputElement>(null);

  // Open dialog when addToAssetId is set from parent
  useEffect(() => {
    if (addToAssetId) {
      setActiveAddToAssetId(addToAssetId);
      setOpen(true);
      setMode("generate"); // Default to single image mode for adding to existing
    }
  }, [addToAssetId]);

  const handleClose = () => {
    setOpen(false);
    resetForm();
    setActiveAddToAssetId(null);
    onClose?.();
  };

  const handleOpenForNewAsset = () => {
    setActiveAddToAssetId(null);
    setMode("upload");
    setOpen(true);
  };

  // Upload handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    if (!assetName) {
      const name = file.name.replace(/\.[^/.]+$/, "").replace(/_sheet$/, "");
      setAssetName(name);
    }
  };

  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlFile(file);
    setError(null);
  };

  // Single image upload for generate mode (upload instead of generate)
  const handleSingleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setGeneratedImage(dataUrl);
      handleProcessImage(dataUrl);
    };
    reader.readAsDataURL(file);

    if (!assetName) {
      const name = file.name.replace(/\.[^/.]+$/, "");
      setAssetName(name);
    }
  };

  // Process image to fit isometric grid
  const handleProcessImage = async (imageDataUrl: string) => {
    try {
      const result = await processImageForIsometric(
        imageDataUrl,
        footprintWidth,
        footprintHeight,
        spriteScale,
      );
      setOriginalDimensions({
        width: result.originalWidth,
        height: result.originalHeight,
      });
      setProcessedImage(result.dataUrl);
      setProcessedDimensions({ width: result.width, height: result.height });
    } catch (error) {
      console.error("Error processing image:", error);
      setError("Failed to process image");
    }
  };

  // Generate image with AI
  const handleGenerate = async () => {
    if (!generatePrompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setProcessedImage(null);

    try {
      const response = await fetch("/api/generate-sprite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: generatePrompt,
          footprintWidth,
          footprintHeight,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      setGeneratedImage(data.imageDataUrl);
      handleProcessImage(data.imageDataUrl);

      // Auto-set asset name from prompt if not set
      if (!assetName) {
        setAssetName(generatePrompt.split(" ").slice(0, 3).join(" "));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Re-process when footprint changes
  const handleFootprintChange = (width: number, height: number) => {
    setFootprintWidth(width);
    setFootprintHeight(height);
  };

  // Re-process when footprint or scale changes
  useEffect(() => {
    if (generatedImage) {
      handleProcessImage(generatedImage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedImage, footprintWidth, footprintHeight, spriteScale]);

  // Add asset from upload mode (PNG + XML)
  const handleAddFromUpload = async () => {
    if (!assetName || !imageFile || !xmlFile) return;

    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const xmlText = await xmlFile.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const subtextures = xmlDoc.querySelectorAll("SubTexture");

      if (subtextures.length === 0) {
        setError("No SubTexture elements found in XML");
        return;
      }

      const sprites: Array<{
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
        footprint?: { width: number; height: number };
      }> = [];

      subtextures.forEach((subtexture) => {
        const name = subtexture.getAttribute("name") || "";
        const x = parseInt(subtexture.getAttribute("x") || "0");
        const y = parseInt(subtexture.getAttribute("y") || "0");
        const width = parseInt(subtexture.getAttribute("width") || "0");
        const height = parseInt(subtexture.getAttribute("height") || "0");
        const fpWidth = subtexture.getAttribute("footprintWidth");
        const fpHeight = subtexture.getAttribute("footprintHeight");

        sprites.push({
          name,
          x,
          y,
          width,
          height,
          footprint:
            fpWidth && fpHeight
              ? { width: parseInt(fpWidth), height: parseInt(fpHeight) }
              : undefined,
        });
      });

      await addAssetToGame(assetName, imageDataUrl, sprites);
    } catch (err) {
      setError("Error parsing files: " + (err as Error).message);
    }
  };

  // Add asset from generate mode (single processed image)
  const handleAddFromGenerate = async () => {
    if (!processedImage) return;
    if (!isAddingToExisting && !assetName) return;

    // Get the processed image dimensions
    const img = new Image();
    img.src = processedImage;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // Generate sprite name - use assetName or timestamp for new sprites
    const spriteName = assetName
      ? `${assetName.toLowerCase().replace(/\s+/g, "_")}.png`
      : `sprite_${Date.now()}.png`;

    const sprites = [
      {
        name: spriteName,
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
        footprint:
          footprintWidth > 1 || footprintHeight > 1
            ? { width: footprintWidth, height: footprintHeight }
            : undefined,
        // Use the user-adjusted origin values
        origin: { x: originX, y: originY },
      },
    ];

    await addAssetToGame(assetName || "sprite", processedImage, sprites);
  };

  // Common add to game function
  const addAssetToGame = async (
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
    }>,
  ) => {
    // If adding to existing asset, use the add sprite function
    if (isAddingToExisting && activeAddToAssetId) {
      const addSpriteToAsset = (window as any).phaserAddSpriteToAsset;
      if (addSpriteToAsset) {
        const success = await addSpriteToAsset(
          activeAddToAssetId,
          imageDataUrl,
          sprites[0],
        );
        if (success) {
          handleClose();
          onAssetAdded?.();
        } else {
          setError("Failed to add sprite to asset");
        }
      } else {
        setError("Game not ready");
      }
      return;
    }

    // Otherwise create a new asset set
    const id = name.toLowerCase().replace(/\s+/g, "_");
    const addCustomAsset = (window as any).phaserAddCustomAsset;

    if (addCustomAsset) {
      const success = await addCustomAsset(id, name, imageDataUrl, sprites);
      if (success) {
        handleClose();
        onAssetAdded?.();
      } else {
        setError("Failed to add asset to game");
      }
    } else {
      setError("Game not ready");
    }
  };

  const resetForm = () => {
    setAssetName("");
    setImageFile(null);
    setXmlFile(null);
    setImagePreview(null);
    setError(null);
    setGeneratePrompt("");
    setFootprintWidth(1);
    setFootprintHeight(1);
    setGeneratedImage(null);
    setProcessedImage(null);
    setOriginalDimensions(null);
    setProcessedDimensions(null);
    setOriginX(0.5);
    setOriginY(0.85);
    setSpriteScale(1.0);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleOpenForNewAsset}
      >
        <ImagePlus className="w-4 h-4 mr-2" />
        Add Custom Assets
      </Button>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isAddingToExisting
              ? "Add Sprite to Asset Set"
              : "Add Custom Asset"}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "upload" | "generate")}
        >
          {!isAddingToExisting && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </TabsTrigger>
              <TabsTrigger value="generate">
                <Wand2 className="w-4 h-4 mr-2" />
                Generate / Single Image
              </TabsTrigger>
            </TabsList>
          )}

          {/* Upload Mode: PNG + XML */}
          <TabsContent value="upload" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm">Asset Name</Label>
              <Input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="My Custom Tiles"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Sprite Sheet (PNG)</Label>
                <div
                  className="mt-1 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary transition-colors text-center min-h-[120px] flex items-center justify-center"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <div className="space-y-2">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-20 mx-auto"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <p className="text-xs text-muted-foreground">
                        {imageFile?.name}
                      </p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <ImagePlus className="w-8 h-8 mx-auto mb-1" />
                      <p className="text-sm">Click to upload PNG</p>
                    </div>
                  )}
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              <div>
                <Label className="text-sm">Atlas Definition (XML)</Label>
                <div
                  className="mt-1 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary transition-colors text-center min-h-[120px] flex items-center justify-center"
                  onClick={() => xmlInputRef.current?.click()}
                >
                  {xmlFile ? (
                    <div className="text-sm">
                      <FileCode className="w-8 h-8 mx-auto mb-1 text-green-500" />
                      <p>{xmlFile.name}</p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <FileCode className="w-8 h-8 mx-auto mb-1" />
                      <p className="text-sm">Click to upload XML</p>
                    </div>
                  )}
                </div>
                <input
                  ref={xmlInputRef}
                  type="file"
                  accept=".xml,text/xml"
                  onChange={handleXmlUpload}
                  className="hidden"
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              <p className="font-medium mb-1">XML format:</p>
              <pre className="overflow-x-auto">
                {`<TextureAtlas>
  <SubTexture name="tile.png" x="0" y="0" width="132" height="66"/>
  <SubTexture name="building.png" x="132" y="0" width="132" height="200"
              footprintWidth="2" footprintHeight="2"/>
</TextureAtlas>`}
              </pre>
            </div>
          </TabsContent>

          {/* Generate Mode: AI or Single Image Upload */}
          <TabsContent value="generate" className="space-y-4 mt-4">
            {!isAddingToExisting && (
              <div>
                <Label className="text-sm">Asset Name</Label>
                <Input
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="City Hall"
                  className="mt-1"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Footprint Width (tiles)</Label>
                <Input
                  type="number"
                  min={1}
                  // max={4}
                  value={footprintWidth}
                  onChange={(e) =>
                    handleFootprintChange(
                      Number(e.target.value),
                      footprintHeight,
                    )
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Footprint Height (tiles)</Label>
                <Input
                  type="number"
                  min={1}
                  // max={4}
                  value={footprintHeight}
                  onChange={(e) =>
                    handleFootprintChange(
                      footprintWidth,
                      Number(e.target.value),
                    )
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">
                Option 1: Generate with AI
              </Label>
              <div className="flex gap-2">
                <Input
                  value={generatePrompt}
                  onChange={(e) => setGeneratePrompt(e.target.value)}
                  placeholder="e.g., City Hall, Fire Station, Hospital..."
                  className="flex-1"
                  onKeyDown={(e) =>
                    e.key === "Enter" && !isGenerating && handleGenerate()
                  }
                />
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !generatePrompt.trim()}
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  <span className="ml-2">
                    {isGenerating ? "Generating..." : "Generate"}
                  </span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Generates an isometric building using AI. Requires
                OPENAI_API_KEY environment variable.
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">
                Option 2: Upload Single Image
              </Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => singleImageInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload PNG Image
              </Button>
              <input
                ref={singleImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleSingleImageUpload}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                Upload any image and it will be scaled to fit the isometric
                grid.
              </p>
            </div>

            {/* Preview */}
            {(generatedImage || processedImage) && (
              <div className="border rounded-lg p-4 space-y-4">
                <Label className="text-sm font-medium block">Preview</Label>
                <div className="grid grid-cols-2 gap-4">
                  {generatedImage && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Original
                        {originalDimensions && (
                          <span className="ml-1 text-primary">
                            ({originalDimensions.width}x
                            {originalDimensions.height})
                          </span>
                        )}
                      </p>
                      <img
                        src={generatedImage}
                        alt="Generated"
                        className="max-h-32 mx-auto border rounded"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                  )}
                  {processedImage && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Processed ({footprintWidth}x{footprintHeight} tiles)
                        {processedDimensions && (
                          <span className="ml-1 text-primary">
                            ({processedDimensions.width}x
                            {processedDimensions.height})
                          </span>
                        )}
                      </p>
                      <div className="relative inline-block">
                        <img
                          src={processedImage}
                          alt="Processed"
                          className="max-h-32 mx-auto border rounded"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tile Alignment Preview */}
                <SpritePreviewCanvas
                  processedImage={processedImage}
                  processedDimensions={processedDimensions}
                  footprintWidth={footprintWidth}
                  footprintHeight={footprintHeight}
                  originX={originX}
                  originY={originY}
                  spriteScale={spriteScale}
                  onOriginXChange={setOriginX}
                  onOriginYChange={setOriginY}
                  onScaleChange={setSpriteScale}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive mt-2">{error}</p>}

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          {mode === "upload" ? (
            <Button
              onClick={handleAddFromUpload}
              disabled={!assetName || !imageFile || !xmlFile}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Asset Set
            </Button>
          ) : (
            <Button
              onClick={handleAddFromGenerate}
              disabled={(!isAddingToExisting && !assetName) || !processedImage}
            >
              <Plus className="w-4 h-4 mr-2" />
              {isAddingToExisting ? "Add Sprite" : "Add Asset"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
