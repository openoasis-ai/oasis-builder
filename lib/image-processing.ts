/**
 * Image processing utilities for sprite assets
 * Pure functions with no React dependencies
 */

export interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessedImageResult {
  originalWidth: number;
  originalHeight: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Trims transparent edges from a canvas context
 * Finds the bounding box of non-transparent pixels
 */
export function trimTransparentEdges(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): ImageBounds {
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
}

/**
 * Processes an image to fit the isometric grid based on footprint
 * Trims transparent edges, scales to match tile dimensions, and applies user scale
 *
 * @param imageDataUrl - The source image as a data URL
 * @param footprintWidth - Width in tiles (1-4)
 * @param footprintHeight - Height in tiles (1-4)
 * @param spriteScale - User scale multiplier (0.5-2.0)
 * @returns Promise with processed image data and dimensions
 */
export async function processImageForIsometric(
  imageDataUrl: string,
  footprintWidth: number,
  footprintHeight: number,
  spriteScale: number
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const originalWidth = img.width;
        const originalHeight = img.height;

        // First, draw to temp canvas to trim transparent edges
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");

        if (!tempCtx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        tempCtx.drawImage(img, 0, 0);

        // Find the bounding box of non-transparent pixels
        const bounds = trimTransparentEdges(tempCtx, img.width, img.height);

        // Calculate target dimensions based on footprint
        // Base tile is 132x66, but sprites can be taller
        const tileWidth = 132;
        const baseTargetWidth = tileWidth * footprintWidth;
        // Scale based on trimmed width, then apply user scale
        const baseScale = baseTargetWidth / bounds.width;
        const targetWidth = Math.round(baseTargetWidth * spriteScale);
        const targetHeight = Math.round(bounds.height * baseScale * spriteScale);

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

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

        resolve({
          originalWidth,
          originalHeight,
          dataUrl: processedDataUrl,
          width: targetWidth,
          height: targetHeight,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageDataUrl;
  });
}
