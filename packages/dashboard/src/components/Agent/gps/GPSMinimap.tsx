import { memo, useCallback } from 'react';
import type { ForceNode, GPSViewport } from './types';
import { ACTIVITY_COLORS, DARK_THEME, VIEW, NODE } from './constants';

interface GPSMinimapProps {
  nodes: ForceNode[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  viewport: GPSViewport;
  containerWidth: number;
  containerHeight: number;
  onViewportChange: (vp: GPSViewport) => void;
}

export const GPSMinimap = memo(function GPSMinimap({
  nodes, bounds, viewport, containerWidth, containerHeight, onViewportChange,
}: GPSMinimapProps) {
  const bw = bounds.maxX - bounds.minX || 1;
  const bh = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(VIEW.MINIMAP_W / bw, VIEW.MINIMAP_H / bh);

  // Visible rectangle in minimap coords
  const visX = (-viewport.x / viewport.zoom - bounds.minX) * scale;
  const visY = (-viewport.y / viewport.zoom - bounds.minY) * scale;
  const visW = (containerWidth / viewport.zoom) * scale;
  const visH = (containerHeight / viewport.zoom) * scale;

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = mx / scale + bounds.minX;
    const worldY = my / scale + bounds.minY;
    onViewportChange({
      ...viewport,
      x: -worldX * viewport.zoom + containerWidth / 2,
      y: -worldY * viewport.zoom + containerHeight / 2,
    });
  }, [scale, bounds, viewport, containerWidth, containerHeight, onViewportChange]);

  return (
    <svg
      width={VIEW.MINIMAP_W}
      height={VIEW.MINIMAP_H}
      style={{
        background: 'rgba(10,14,26,0.9)',
        border: '1px solid rgba(71,85,105,0.5)',
        borderRadius: 6,
        cursor: 'pointer',
      }}
      onClick={handleClick}
    >
      {/* Nodes as dots */}
      {nodes.map((node) => (
        <rect
          key={node.id}
          x={(node.x - bounds.minX) * scale}
          y={(node.y - bounds.minY) * scale}
          width={Math.max(NODE.FILE_W * scale, 2)}
          height={Math.max(NODE.FILE_H * scale, 1)}
          fill={node.isCurrent
            ? (ACTIVITY_COLORS[node.lastActivity] ?? DARK_THEME.currentGlow)
            : DARK_THEME.fileStroke}
          rx={1}
        />
      ))}

      {/* Viewport rectangle */}
      <rect
        x={Math.max(0, visX)}
        y={Math.max(0, visY)}
        width={Math.min(visW, VIEW.MINIMAP_W)}
        height={Math.min(visH, VIEW.MINIMAP_H)}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={1}
        opacity={0.7}
      />
    </svg>
  );
});
