# Isometric City Builder - Next.js

A modern isometric city builder built with Next.js, Phaser.js, and shadcn/ui components.

## Features

- 🏗️ **Build your city**: Place various buildings and tiles on an isometric grid
- 🎨 **24 different tiles**: Choose from a curated selection of buildings and terrain
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

## Project Structure

```
iso-city-builder/
├── app/
│   ├── page.tsx              # Main page component
│   └── globals.css           # Global styles
├── components/
│   ├── iso-city-game.tsx     # Phaser game component
│   ├── tile-selector.tsx     # Tile selection UI
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
  () => import('@/components/iso-city-game').then((mod) => mod.IsoCityGame),
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
const gridX = Math.floor((isoX / (tileWidth / 2) + isoY / (tileHeight / 2)) / 2);
const gridY = Math.floor((isoY / (tileHeight / 2) - isoX / (tileWidth / 2)) / 2);
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
