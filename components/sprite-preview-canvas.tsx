"use client";

import { useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";

interface SpritePreviewCanvasProps {
  processedImage: string | null;
  processedDimensions: { width: number; height: number } | null;
  footprintWidth: number;
  footprintHeight: number;
  originX: number;
  originY: number;
  spriteScale: number;
  onOriginXChange: (value: number) => void;
  onOriginYChange: (value: number) => void;
  onScaleChange: (value: number) => void;
}

/**
 * Canvas component that previews sprite alignment on isometric tile grid
 * Shows red crosshair anchor point and allows adjusting origin/scale
 */
export function SpritePreviewCanvas({
  processedImage,
  processedDimensions,
  footprintWidth,
  footprintHeight,
  originX,
  originY,
  spriteScale,
  onOriginXChange,
  onOriginYChange,
  onScaleChange,
}: SpritePreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw tile preview with sprite positioned according to origin
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !processedImage || !processedDimensions) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tileWidth = 132;
    const tileHeight = 66;
    const padding = 20;

    // Calculate canvas size based on footprint and sprite
    const footprintPixelWidth = tileWidth * footprintWidth;
    const footprintPixelHeight = tileHeight * footprintHeight;
    const canvasWidth =
      Math.max(footprintPixelWidth, processedDimensions.width) + padding * 2;
    const canvasHeight =
      footprintPixelHeight + processedDimensions.height + padding * 2;

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
        const tileY =
          centerY +
          isoY -
          (footprintWidth + footprintHeight - 2) * (tileHeight / 4);

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

    // Draw anchor point indicator at the CENTER of the multi-tile footprint
    // For a 3x3 footprint, the center tile is (1,1), for 2x2 it's (0.5, 0.5), etc.
    const centerTileX = (footprintWidth - 1) / 2;
    const centerTileY = (footprintHeight - 1) / 2;
    // Convert center tile position to isometric screen coordinates
    const anchorIsoX = (centerTileX - centerTileY) * (tileWidth / 2);
    const anchorIsoY = (centerTileX + centerTileY) * (tileHeight / 2);
    const anchorScreenX = centerX + anchorIsoX;
    const anchorScreenY =
      centerY +
      anchorIsoY -
      (footprintWidth + footprintHeight - 2) * (tileHeight / 4);
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

      ctx.drawImage(
        img,
        spriteX,
        spriteY,
        processedDimensions.width,
        processedDimensions.height,
      );

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
  }, [
    processedImage,
    processedDimensions,
    footprintWidth,
    footprintHeight,
    originX,
    originY,
  ]);

  if (!processedImage) {
    return null;
  }

  return (
    <div className="border-t pt-4">
      <Label className="text-sm font-medium mb-2 block">
        Tile Alignment Preview
        <span className="text-xs text-muted-foreground ml-2">
          (red crosshair = tile center anchor point)
        </span>
      </Label>
      <div className="flex justify-center mb-3">
        <canvas
          ref={canvasRef}
          className="border rounded max-w-full"
          style={{ maxHeight: "200px", imageRendering: "pixelated" }}
        />
      </div>

      {/* Scale Control */}
      <div className="mb-4">
        <Label className="text-xs">
          Scale: {spriteScale.toFixed(2)}x
          {processedDimensions && (
            <span className="ml-2 text-muted-foreground">
              ({processedDimensions.width}x{processedDimensions.height}px)
            </span>
          )}
        </Label>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.05"
          value={spriteScale}
          onChange={(e) => onScaleChange(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0.5x</span>
          <span>1x</span>
          <span>2x</span>
        </div>
      </div>

      {/* Origin Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Origin X: {originX.toFixed(2)}</Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={originX}
            onChange={(e) => onOriginXChange(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Left</span>
            <span>Center</span>
            <span>Right</span>
          </div>
        </div>
        <div>
          <Label className="text-xs">Origin Y: {originY.toFixed(2)}</Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={originY}
            onChange={(e) => onOriginYChange(parseFloat(e.target.value))}
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
        Adjust scale to resize the sprite. Adjust origin to align sprite with
        tile center (red crosshair).
      </p>
    </div>
  );
}
