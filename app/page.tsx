'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { TileSelector } from '@/components/tile-selector';

// Dynamically import Phaser component to avoid SSR issues
const IsoCityGame = dynamic(
  () => import('@/components/iso-city-game').then((mod) => mod.IsoCityGame),
  { ssr: false }
);

export default function Home() {
  const [selectedTile, setSelectedTile] = useState(0);
  const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });

  const handleTileSelect = (tileIndex: number) => {
    setSelectedTile(tileIndex);
  };

  const handleGridPositionChange = (x: number, y: number) => {
    setGridPosition({ x, y });
    // Dispatch custom event for TileSelector
    window.dispatchEvent(new CustomEvent('gridPositionChange', {
      detail: { x, y }
    }));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex-shrink-0 border-r">
        <TileSelector onTileSelect={handleTileSelect} />
      </aside>

      {/* Game Canvas */}
      <main className="flex-1 relative">
        <IsoCityGame
          onTileSelect={handleTileSelect}
          onGridPositionChange={handleGridPositionChange}
        />
      </main>
    </div>
  );
}
