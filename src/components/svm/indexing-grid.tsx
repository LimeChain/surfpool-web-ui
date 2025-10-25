'use client';

import { useEffect, useRef, useState } from 'react';

interface IndexingGridProps {
  isActive: boolean;
  accountCount: number;
}

export default function IndexingGrid({ isActive, accountCount }: IndexingGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [maxCols, setMaxCols] = useState(50);
  const [activeSquares, setActiveSquares] = useState<Set<number>>(new Set());

  const squareSize = 6;
  const spacing = 4;
  const rows = 3;
  const columnWidth = squareSize + spacing;
  const gridHeight = rows * (squareSize + spacing) - spacing;

  // Calculate how many columns fit
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const width = container.clientWidth;
      const calculatedCols = Math.floor((width + spacing) / columnWidth);
      setMaxCols(Math.max(1, calculatedCols));
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize();

    return () => observer.disconnect();
  }, [columnWidth, spacing]);

  // Every second, pick 10 random squares to light up
  useEffect(() => {
    if (!isActive) {
      setActiveSquares(new Set());
      return;
    }

    const interval = setInterval(() => {
      const totalSquares = maxCols * rows;
      const newActive = new Set<number>();

      // Pick 10 random squares
      for (let i = 0; i < 10; i++) {
        newActive.add(Math.floor(Math.random() * totalSquares));
      }

      setActiveSquares(newActive);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, maxCols, rows]);

  const totalSquares = maxCols * rows;

  return (
    <div ref={containerRef} style={{ width: '100%', height: `${gridHeight}px` }} className="flex gap-1">
      {Array.from({ length: maxCols }).map((_, colIndex) => (
        <div key={colIndex} className="flex flex-col-reverse gap-1">
          {Array.from({ length: rows }).map((_, rowIndex) => {
            const squareIndex = colIndex * rows + rowIndex;
            const isActive = activeSquares.has(squareIndex);

            return (
              <div
                key={rowIndex}
                style={{ width: '6px', height: '6px' }}
                className={
                  isActive
                    ? 'bg-zinc-300 dark:bg-zinc-500'
                    : 'bg-zinc-200 dark:bg-zinc-700'
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
