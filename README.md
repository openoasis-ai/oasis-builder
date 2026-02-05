# Isometric City Builder - Next.js

A modern isometric city builder built with Next.js, Phaser.js, and shadcn/ui components.

## Features

- 🏗️ **Build your city**: Place various buildings and tiles on an isometric grid
- 🎨 **24 different tiles**: Choose from a curated selection of buildings and terrain
- 🤖 **AI sprite generation**: Generate custom isometric buildings with DALL-E
- 📦 **Custom assets**: Upload your own sprite sheets or single images
- 🎚️ **Sprite controls**: Adjust scale, origin, and multi-tile footprints
- 📹 **Camera controls**: Pan, zoom, and explore your city
- 🖱️ **Intuitive interface**: Modern UI with shadcn components
- 🌙 **Dark mode ready**: Styled with lime theme on stone base
- ⚡ **Next.js 15**: Built with the latest Next.js features
- 🎮 **Phaser.js**: Professional game engine for smooth rendering

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Game Engine**: Phaser.js 3
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Styling**: Tailwind CSS with lime theme
- **TypeScript**: Full type safety

## Getting Started

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file for AI sprite generation:

```bash
OPENAI_API_KEY=your_openai_api_key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Controls

- **Left Click**: Place the selected tile
- **Right Click**: Remove a tile
- **Arrow Keys / WASD**: Pan the camera
- **Mouse Wheel**: Zoom in/out
- **Hover**: See preview of tile placement

## AI Sprite Generation

Generate custom isometric buildings using AI:

1. Click **Add Custom Assets** in the tile selector
2. Switch to **Generate / Single Image** tab
3. Set the footprint size (1x1 to 4x4 tiles)
4. Enter a prompt (e.g., "City Hall", "Fire Station", "Hospital")
5. Click **Generate** to create an isometric sprite
6. Adjust **Scale** (0.5x - 2x) and **Origin** to align with the tile grid
7. Preview shows the sprite on isometric tiles with anchor point
8. Click **Add Asset** to add to your tile palette

Requires `OPENAI_API_KEY` environment variable.

### Adding Sprites to Existing Assets

Click the **+** button on any custom asset set to add more sprites to it.

## Custom Asset Upload

Upload your own sprite sheets:

1. **Sprite Sheet + XML**: Upload a PNG sprite sheet with an XML atlas definition
2. **Single Image**: Upload any PNG/JPEG image to auto-scale for the isometric grid

XML format for sprite sheets:

```xml
<TextureAtlas>
  <SubTexture name="tile.png" x="0" y="0" width="132" height="66"/>
  <SubTexture name="building.png" x="132" y="0" width="132" height="200"
              footprintWidth="2" footprintHeight="2"/>
</TextureAtlas>
```

## Project Structure

```
iso-city-builder/
├── app/
│   ├── page.tsx              # Main page component
│   ├── globals.css           # Global styles
│   └── api/
│       └── generate-sprite/  # AI sprite generation endpoint
├── components/
│   ├── iso-city-game.tsx     # Phaser game component
│   ├── tile-selector.tsx     # Tile selection UI
│   ├── sprite-packer.tsx     # Custom asset & AI generation dialog
│   └── ui/                   # shadcn components
├── public/
│   └── assets/               # Game sprite sheets
└── lib/
    └── utils.ts              # Utility functions
```

## How It Works

### Phaser Integration

The game uses Phaser.js for rendering the isometric city. The Phaser scene is wrapped in a React component and dynamically imported to avoid SSR issues:

```tsx
const IsoCityGame = dynamic(
  () => import("@/components/iso-city-game").then((mod) => mod.IsoCityGame),
  { ssr: false }
);
```

### Isometric Coordinate System

The game converts between grid coordinates and isometric screen coordinates:

```typescript
// Grid to Isometric
const isoX = (gridX - gridY) * (tileWidth / 2);
const isoY = (gridX + gridY) * (tileHeight / 2);

// Isometric to Grid
const gridX = Math.floor(
  (isoX / (tileWidth / 2) + isoY / (tileHeight / 2)) / 2
);
const gridY = Math.floor(
  (isoY / (tileHeight / 2) - isoX / (tileWidth / 2)) / 2
);
```

### Component Communication

Communication between React and Phaser uses:

- Custom window events for data passing
- Window-scoped functions for method calls
- React state for UI updates

## Customization

### Adding More Tiles

Edit the `tilesToShow` array in `components/tile-selector.tsx`:

```typescript
const tilesToShow = [0, 13, 18, 26, 33, 97, ...];
```

### Changing Grid Size

Modify `gridSize` in `components/iso-city-game.tsx`:

```typescript
gridSize = 30; // Change to your desired size
```

### Theme Customization

The project uses shadcn's lime theme on a stone base. To change colors, modify `components.json` and run:

```bash
npx shadcn@latest init
```

## Performance

- Phaser uses WebGL for hardware-accelerated rendering
- Sprite sheets reduce draw calls
- React components only re-render on state changes
- Game loop runs independently of React

## Credits

- Game Engine: [Phaser.js](https://phaser.io/)
- UI Components: [shadcn/ui](https://ui.shadcn.com/)
- Isometric Assets: Kenney's City Kit
- Framework: [Next.js](https://nextjs.org/)

## License

MIT
