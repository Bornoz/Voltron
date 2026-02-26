import { memo, useCallback } from 'react';
import type { ForceNode } from './types';
import { ACTIVITY_COLORS, ACTIVITY_BG, EXT_ICONS, DARK_THEME, NODE, HEATMAP_COLORS } from './constants';

interface GPSNodesProps {
  nodes: ForceNode[];
  dirZones: Array<{ dir: string; x: number; y: number; w: number; h: number }>;
  heatmapEnabled: boolean;
  maxVisits: number;
  onNodeClick: (node: ForceNode) => void;
  onNodeContextMenu: (node: ForceNode, e: React.MouseEvent) => void;
}

export const GPSNodes = memo(function GPSNodes({
  nodes, dirZones, heatmapEnabled, maxVisits, onNodeClick, onNodeContextMenu,
}: GPSNodesProps) {
  const getHeatColor = useCallback((visits: number) => {
    if (visits === 0 || maxVisits === 0) return DARK_THEME.fileStroke;
    const ratio = Math.min(visits / maxVisits, 1);
    const idx = Math.min(Math.floor(ratio * HEATMAP_COLORS.length), HEATMAP_COLORS.length - 1);
    return HEATMAP_COLORS[idx];
  }, [maxVisits]);

  return (
    <g>
      {/* Directory zones */}
      {dirZones.map((zone) => (
        <g key={zone.dir}>
          <rect
            x={zone.x}
            y={zone.y}
            width={zone.w}
            height={zone.h}
            rx={NODE.DIR_R}
            ry={NODE.DIR_R}
            fill={DARK_THEME.dirFill}
            stroke={DARK_THEME.dirStroke}
            strokeWidth={1}
          />
          <text
            x={zone.x + 12}
            y={zone.y + 18}
            fill={DARK_THEME.dirLabel}
            fontSize={11}
            fontWeight={600}
            fontFamily="monospace"
          >
            {zone.dir === '.' ? '/' : zone.dir}
          </text>
        </g>
      ))}

      {/* File nodes */}
      {nodes.map((node) => {
        const stroke = node.isCurrent
          ? ACTIVITY_COLORS[node.lastActivity] ?? DARK_THEME.currentGlow
          : heatmapEnabled
            ? getHeatColor(node.visits)
            : DARK_THEME.fileStroke;
        const bgFill = node.isCurrent
          ? ACTIVITY_BG[node.lastActivity] ?? DARK_THEME.fileFill
          : DARK_THEME.fileFill;
        const strokeWidth = node.isCurrent ? 2 : 1;
        const extIcon = EXT_ICONS[node.extension] ?? '??';

        return (
          <g
            key={node.id}
            onClick={() => onNodeClick(node)}
            onContextMenu={(e) => onNodeContextMenu(node, e)}
            style={{ cursor: 'pointer' }}
          >
            {/* Glow effect for current file */}
            {node.isCurrent && (
              <rect
                x={node.x - 3}
                y={node.y - 3}
                width={NODE.FILE_W + 6}
                height={NODE.FILE_H + 6}
                rx={NODE.FILE_R + 2}
                ry={NODE.FILE_R + 2}
                fill="none"
                stroke={stroke}
                strokeWidth={1}
                opacity={0.4}
                filter="url(#gps-pulse-glow)"
              >
                <animate
                  attributeName="opacity"
                  values="0.2;0.5;0.2"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </rect>
            )}

            {/* Node body */}
            <rect
              x={node.x}
              y={node.y}
              width={NODE.FILE_W}
              height={NODE.FILE_H}
              rx={NODE.FILE_R}
              ry={NODE.FILE_R}
              fill={bgFill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />

            {/* Extension badge */}
            <rect
              x={node.x + 4}
              y={node.y + 8}
              width={22}
              height={18}
              rx={4}
              fill={stroke}
              opacity={0.2}
            />
            <text
              x={node.x + 15}
              y={node.y + 21}
              fill={stroke}
              fontSize={9}
              fontWeight={700}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {extIcon}
            </text>

            {/* File name */}
            <text
              x={node.x + 30}
              y={node.y + 22}
              fill={DARK_THEME.fileLabel}
              fontSize={10}
              fontFamily="monospace"
              clipPath={`inset(0 0 0 0)`}
            >
              {node.fileName.length > 9 ? node.fileName.slice(0, 8) + '…' : node.fileName}
            </text>

            {/* Visit count badge */}
            {node.visits > 0 && (
              <>
                <circle
                  cx={node.x + NODE.FILE_W - 8}
                  cy={node.y + 8}
                  r={8}
                  fill={stroke}
                  opacity={0.85}
                />
                <text
                  x={node.x + NODE.FILE_W - 8}
                  y={node.y + 12}
                  fill="#fff"
                  fontSize={8}
                  fontWeight={700}
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {node.visits > 99 ? '99+' : node.visits}
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
});
