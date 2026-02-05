# Asset Guide - Making the City Builder Universal

## Understanding Tile Dimensions

### Base Tile Footprint vs Sprite Size

**Important Distinction:**
- **`tileWidth` and `tileHeight`**: Define the **grid footprint** (the diamond base on the ground)
- **Sprite dimensions**: The actual image size (can be much taller than the footprint)

```
Current values (Kenney assets):
tileWidth = 132   // Width of the diamond base
tileHeight = 66   // Half-height for isometric grid spacing (132 / 2)

Standard isometric ratio: 2:1 (width:height)
```

### How It Works

```
┌─────────────────┐
│  Tall Building  │  ← Sprite can be any height
│     Sprite      │
│      (200px     │
│      tall)      │
├─────────────────┤
│   /\   /\       │
│  /  \ /  \      │  ← Base footprint (132x66)
│ /    X    \     │     This is what tileWidth/Height define
│/     │     \    │
└──────┴──────────┘
   Grid cell
```

## Adapting to Different Assets

### 1. For Standard Isometric Tiles (2:1 ratio)

If your tiles use the standard 2:1 isometric ratio:

```typescript
// In components/iso-city-game.tsx, line 22-23:
tileWidth = YOUR_TILE_WIDTH;    // e.g., 64, 128, 256
tileHeight = YOUR_TILE_WIDTH / 2; // Half of width for 2:1 ratio
```

**Examples:**
- 64x32 tiles: `tileWidth = 64; tileHeight = 32;`
- 128x64 tiles: `tileWidth = 128; tileHeight = 64;`
- 256x128 tiles: `tileWidth = 256; tileHeight = 128;`

### 2. For Non-Standard Ratios

If your isometric tiles use a different ratio (e.g., 3:1, 4:1):

```typescript
tileWidth = 200;   // Your tile width
tileHeight = 50;   // Adjust based on your isometric angle
```

### 3. Does Sprite Size Matter?

**No!** Sprite images can be ANY size. The system handles this automatically:

```typescript
// A sprite can be:
// - 132x66 (fits exactly in one tile)
// - 132x200 (tall building on 1x1 footprint)
// - 132x400 (skyscraper on 1x1 footprint)

// The footprint (tileWidth x tileHeight) stays the same
```

The sprite's **visual size doesn't affect the grid** - only the footprint does.

## Multi-Tile Sprites (Future Feature)

### Current Limitation

Currently, each sprite occupies exactly **1x1 grid cell**, regardless of its visual size.

### What Multi-Tile Means

A multi-tile sprite occupies **multiple grid cells**:

```
Single tile (1x1):        Multi-tile (2x2):        Multi-tile (2x3):
    ┌─────┐                  ┌──────────┐              ┌──────────┐
    │  🏠  │                  │          │              │          │
    └─────┘                  │   🏢     │              │   🏢     │
    1 cell                   │          │              │   🏢     │
                             └──────────┘              │   🏢     │
                             4 cells (2x2)             └──────────┘
                                                       6 cells (2x3)
```

### Implementing Multi-Tile Support

To add a sprite with a 2x2 footprint, you would need to:

1. **Define footprint metadata** in your sprite data:
```typescript
{
  name: "large_building.png",
  x: 0, y: 0,
  width: 264, height: 400,
  footprint: { width: 2, height: 2 }  // Occupies 2x2 tiles
}
```

2. **Update placement logic** to:
   - Check if all footprint cells are available
   - Reserve all cells when placing
   - Clear all cells when removing

3. **Adjust sprite positioning**:
```typescript
// For a 2x2 sprite, place at center of 4 tiles
const centerX = gridX + (footprint.width - 1) / 2;
const centerY = gridY + (footprint.height - 1) / 2;
const isoPos = this.gridToIso(centerX, centerY);
```

## Loading Custom Assets

### Required Files

For each asset set, you need:
1. **PNG sprite sheet** (e.g., `myTiles_sheet.png`)
2. **XML definitions** (e.g., `myTiles_sheet.xml`)

### XML Format

```xml
<TextureAtlas imagePath="sheet.png">
  <SubTexture name="tile_001.png" x="0" y="0" width="132" height="66"/>
  <SubTexture name="building_tall.png" x="132" y="0" width="132" height="200"/>
  <!-- Can mix different sizes -->
</TextureAtlas>
```

### Adding Custom Asset Sets

1. **Place files** in `public/assets/`:
```
public/assets/
  ├── myTiles_sheet.png
  ├── myTiles_sheet.xml
  ├── myBuildings_sheet.png
  └── myBuildings_sheet.xml
```

2. **Update preload** in `components/iso-city-game.tsx`:
```typescript
preload() {
  this.load.image('myTiles', '/assets/myTiles_sheet.png');
  this.load.text('myTilesXML', '/assets/myTiles_sheet.xml');
}
```

3. **Add parsing**:
```typescript
create() {
  this.parseMyTiles();
}

parseMyTiles() {
  const xmlText = this.cache.text.get('myTilesXML');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  // ... same parsing logic
}
```

4. **Add UI tab** in `components/tile-selector.tsx`

## Camera & Zoom Adjustments

For different tile sizes, adjust the initial camera zoom:

```typescript
// In create() method
this.cameras.main.zoom = 1.0; // Default

// For larger tiles (256x128):
this.cameras.main.zoom = 0.4;

// For smaller tiles (64x32):
this.cameras.main.zoom = 1.5;
```

## Quick Reference

### File Locations to Edit

1. **Tile dimensions**: `components/iso-city-game.tsx` lines 22-23
2. **Asset loading**: `components/iso-city-game.tsx` lines 43-48
3. **Camera zoom**: `components/iso-city-game.tsx` line 60
4. **Grid size**: `components/iso-city-game.tsx` line 21

### Common Tile Sizes

| Asset Pack | tileWidth | tileHeight | Ratio |
|------------|-----------|------------|-------|
| Kenney     | 132       | 66         | 2:1   |
| Standard Small | 64   | 32         | 2:1   |
| Standard Medium | 128 | 64       | 2:1   |
| Standard Large | 256  | 128        | 2:1   |

### Testing New Assets

1. Update `tileWidth` and `tileHeight`
2. Reload the page
3. Check:
   - Grid alignment (tiles snap to grid)
   - Hover preview (green diamond fits tile)
   - Depth sorting (tiles in front appear on top)
4. Adjust camera zoom if needed

## Future Enhancements

To make fully universal:

- [ ] Settings UI to change tile dimensions at runtime
- [ ] Auto-detect tile dimensions from sprite sheet
- [ ] Multi-tile sprite support
- [ ] Dynamic asset loading (upload your own sprite sheets)
- [ ] Footprint editor (define which tiles a sprite occupies)
- [ ] Support for non-isometric grids (orthogonal, hexagonal)
