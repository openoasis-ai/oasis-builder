"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
    null
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

  const imageInputRef = useRef<HTMLInputElement>(null);
  const tilePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const singleImageInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Open dialog when addToAssetId is set from parent
  useEffect(() => {
    if (addToAssetId) {
      setActiveAddToAssetId(addToAssetId);
      setOpen(true);
      setMode("generate"); // Default to single image mode for adding to existing
    }
  }, [addToAssetId]);

  // Draw tile preview with sprite positioned according to origin
  useEffect(() => {
    const canvas = tilePreviewCanvasRef.current;
    if (!canvas || !processedImage || !processedDimensions) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tileWidth = 132;
    const tileHeight = 66;
    const padding = 20;

    // Calculate canvas size based on footprint and sprite
    const footprintPixelWidth = tileWidth * footprintWidth;
    const footprintPixelHeight = tileHeight * footprintHeight;
    const canvasWidth = Math.max(footprintPixelWidth, processedDimensions.width) + padding * 2;
    const canvasHeight = footprintPixelHeight + processedDimensions.height + padding * 2;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Calculate center position for the footprint
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight - padding - footprintPixelHeight / 2;

    // Draw isometric diamond tiles for the footprint
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(0, 255, 0, 0.2)";

    for (let fx = 0; fx < footprintWidth; fx++) {
      for (let fy = 0; fy < footprintHeight; fy++) {
        // Calculate isometric position for each tile
        const isoX = (fx - fy) * (tileWidth / 2);
        const isoY = (fx + fy) * (tileHeight / 2);
        const tileX = centerX + isoX;
        const tileY = centerY + isoY - (footprintWidth + footprintHeight - 2) * (tileHeight / 4);

        ctx.beginPath();
        ctx.moveTo(tileX, tileY - tileHeight / 2); // top
        ctx.lineTo(tileX + tileWidth / 2, tileY); // right
        ctx.lineTo(tileX, tileY + tileHeight / 2); // bottom
        ctx.lineTo(tileX - tileWidth / 2, tileY); // left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw anchor point indicator (small red dot at tile center)
    const anchorScreenX = centerX;
    const anchorScreenY = centerY - (footprintWidth + footprintHeight - 2) * (tileHeight / 4);
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(anchorScreenX, anchorScreenY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Load and draw the sprite
    const img = new window.Image();
    img.onload = () => {
      // Calculate sprite position based on origin
      // Origin (0.5, 0.85) means the point at 50% width, 85% height of sprite
      // should be at the anchor point (tile center)
      const spriteX = anchorScreenX - processedDimensions.width * originX;
      const spriteY = anchorScreenY - processedDimensions.height * originY;

      ctx.drawImage(img, spriteX, spriteY, processedDimensions.width, processedDimensions.height);

      // Redraw anchor point on top
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(anchorScreenX, anchorScreenY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw crosshair at anchor
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(anchorScreenX - 10, anchorScreenY);
      ctx.lineTo(anchorScreenX + 10, anchorScreenY);
      ctx.moveTo(anchorScreenX, anchorScreenY - 10);
      ctx.lineTo(anchorScreenX, anchorScreenY + 10);
      ctx.stroke();
    };
    img.src = processedImage;
  }, [processedImage, processedDimensions, footprintWidth, footprintHeight, originX, originY]);

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
      processImageForIsometric(dataUrl);
    };
    reader.readAsDataURL(file);

    if (!assetName) {
      const name = file.name.replace(/\.[^/.]+$/, "");
      setAssetName(name);
    }
  };

  // Trim transparent edges from an image
  const trimTransparentEdges = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): { x: number; y: number; width: number; height: number } => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 10) {
          // Threshold for non-transparent
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Add small padding
    const padding = 2;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  };

  // Process image to fit isometric grid
  const processImageForIsometric = useCallback(
    (imageDataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        // Store original dimensions
        setOriginalDimensions({ width: img.width, height: img.height });

        // First, draw to temp canvas to trim transparent edges
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");

        if (!tempCtx) return;

        tempCtx.drawImage(img, 0, 0);

        // Find the bounding box of non-transparent pixels
        const bounds = trimTransparentEdges(tempCtx, img.width, img.height);

        // Calculate target dimensions based on footprint
        // Base tile is 132x66, but sprites can be taller
        const tileWidth = 132;
        const targetWidth = tileWidth * footprintWidth;
        // Scale based on trimmed width
        const scale = targetWidth / bounds.width;
        const targetHeight = Math.round(bounds.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Enable high-quality scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Draw only the trimmed portion, scaled to target size
          ctx.drawImage(
            img,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            0,
            0,
            targetWidth,
            targetHeight
          );

          const processedDataUrl = canvas.toDataURL("image/png");
          setProcessedImage(processedDataUrl);
          setProcessedDimensions({ width: targetWidth, height: targetHeight });
        }
      };
      img.src = imageDataUrl;
    },
    [footprintWidth]
  );

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
      processImageForIsometric(data.imageDataUrl);

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
    if (generatedImage) {
      processImageForIsometric(generatedImage);
    }
  };

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
    }>
  ) => {
    // If adding to existing asset, use the add sprite function
    if (isAddingToExisting && activeAddToAssetId) {
      const addSpriteToAsset = (window as any).phaserAddSpriteToAsset;
      if (addSpriteToAsset) {
        const success = await addSpriteToAsset(
          activeAddToAssetId,
          imageDataUrl,
          sprites[0]
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
                  max={4}
                  value={footprintWidth}
                  onChange={(e) =>
                    handleFootprintChange(
                      Number(e.target.value),
                      footprintHeight
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
                  max={4}
                  value={footprintHeight}
                  onChange={(e) =>
                    handleFootprintChange(
                      footprintWidth,
                      Number(e.target.value)
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
                <Label className="text-sm font-medium block">
                  Preview
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  {generatedImage && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Original
                        {originalDimensions && (
                          <span className="ml-1 text-primary">
                            ({originalDimensions.width}x{originalDimensions.height})
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
                            ({processedDimensions.width}x{processedDimensions.height})
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
                {processedImage && (
                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium mb-2 block">
                      Tile Alignment Preview
                      <span className="text-xs text-muted-foreground ml-2">
                        (red crosshair = tile center anchor point)
                      </span>
                    </Label>
                    <div className="flex justify-center mb-3">
                      <canvas
                        ref={tilePreviewCanvasRef}
                        className="border rounded max-w-full"
                        style={{ maxHeight: "200px", imageRendering: "pixelated" }}
                      />
                    </div>

                    {/* Origin Controls */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">
                          Origin X: {originX.toFixed(2)}
                        </Label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={originX}
                          onChange={(e) => setOriginX(parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Left</span>
                          <span>Center</span>
                          <span>Right</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">
                          Origin Y: {originY.toFixed(2)}
                        </Label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={originY}
                          onChange={(e) => setOriginY(parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Top</span>
                          <span>Middle</span>
                          <span>Bottom</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Adjust origin to align sprite with tile. The origin point on the sprite will be placed at the red crosshair (tile center).
                    </p>
                  </div>
                )}
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
