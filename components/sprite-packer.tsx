'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Plus, ImagePlus, FileCode } from 'lucide-react';

interface SpritePackerProps {
  onAssetAdded?: () => void;
}

export function SpritePacker({ onAssetAdded }: SpritePackerProps) {
  const [open, setOpen] = useState(false);
  const [assetName, setAssetName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Set default name from filename
    if (!assetName) {
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/_sheet$/, '');
      setAssetName(name);
    }
  };

  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlFile(file);
    setError(null);
  };

  const handleAddAsset = async () => {
    if (!assetName || !imageFile || !xmlFile) return;

    try {
      // Read image as data URL
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      // Read and parse XML
      const xmlText = await xmlFile.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const subtextures = xmlDoc.querySelectorAll('SubTexture');

      if (subtextures.length === 0) {
        setError('No SubTexture elements found in XML');
        return;
      }

      // Parse sprites from XML
      const sprites: Array<{
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
        footprint?: { width: number; height: number };
      }> = [];

      subtextures.forEach((subtexture) => {
        const name = subtexture.getAttribute('name') || '';
        const x = parseInt(subtexture.getAttribute('x') || '0');
        const y = parseInt(subtexture.getAttribute('y') || '0');
        const width = parseInt(subtexture.getAttribute('width') || '0');
        const height = parseInt(subtexture.getAttribute('height') || '0');
        const footprintWidth = subtexture.getAttribute('footprintWidth');
        const footprintHeight = subtexture.getAttribute('footprintHeight');

        sprites.push({
          name,
          x,
          y,
          width,
          height,
          footprint: footprintWidth && footprintHeight
            ? { width: parseInt(footprintWidth), height: parseInt(footprintHeight) }
            : undefined,
        });
      });

      // Add to game
      const id = assetName.toLowerCase().replace(/\s+/g, '_');
      const addCustomAsset = (window as any).phaserAddCustomAsset;

      if (addCustomAsset) {
        const success = await addCustomAsset(id, assetName, imageDataUrl, sprites);
        if (success) {
          setOpen(false);
          resetForm();
          onAssetAdded?.();
        } else {
          setError('Failed to add asset to game');
        }
      } else {
        setError('Game not ready');
      }
    } catch (err) {
      setError('Error parsing files: ' + (err as Error).message);
    }
  };

  const resetForm = () => {
    setAssetName('');
    setImageFile(null);
    setXmlFile(null);
    setImagePreview(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <ImagePlus className="w-4 h-4 mr-2" />
          Add Custom Assets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Asset Set</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Name */}
          <div>
            <Label className="text-sm">Asset Name</Label>
            <Input
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="My Custom Tiles"
              className="mt-1"
            />
          </div>

          {/* Image Upload */}
          <div>
            <Label className="text-sm">Sprite Sheet (PNG)</Label>
            <div
              className="mt-1 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary transition-colors text-center"
              onClick={() => imageInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className="space-y-2">
                  <img src={imagePreview} alt="Preview" className="max-h-32 mx-auto" style={{ imageRendering: 'pixelated' }} />
                  <p className="text-xs text-muted-foreground">{imageFile?.name}</p>
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

          {/* XML Upload */}
          <div>
            <Label className="text-sm">Atlas Definition (XML)</Label>
            <div
              className="mt-1 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary transition-colors text-center"
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="text-xs text-muted-foreground">
            <p>XML format example:</p>
            <pre className="bg-muted p-2 rounded mt-1 overflow-x-auto">
{`<TextureAtlas>
  <SubTexture name="tile.png"
    x="0" y="0" width="132" height="66"/>
</TextureAtlas>`}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleAddAsset}
            disabled={!assetName || !imageFile || !xmlFile}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Asset Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
