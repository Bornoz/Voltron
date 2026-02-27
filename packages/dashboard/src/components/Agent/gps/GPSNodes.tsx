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
      {/* Directory zones — glass containers */}
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
            strokeDasharray="4 2"
          />
          {/* Dir label with accent underline */}
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
          <line
            x1={zone.x + 12}
            y1={zone.y + 22}
            x2={zone.x + 12 + Math.min((zone.dir === '.' ? 1 : zone.dir.length) * 7, zone.w - 24)}
            y2={zone.y + 22}
            stroke="rgba(59,130,246,0.2)"
            strokeWidth={1}
          />
        </g>
      ))}

      {/* File nodes — premium */}
      {nodes.map((node) => {
        const stroke = node.isCurrent
          ? ACTIVITY_COLORS[node.lastActivity] ?? DARK_THEME.currentGlow
          : heatmapEnabled
            ? getHeatColor(node.visits)
            : DARK_THEME.fileStroke;
        const bgFill = node.isCurrent
          ? ACTIVITY_BG[node.lastActivity] ?? DARK_THEME.fileFill
          : DARK_THEME.fileFill;
        const strokeWidth = node.isCurrent ? 1.5 : 0.5;
        const extIcon = EXT_ICONS[node.extension] ?? '??';

        return (
          <g
            key={node.id}
            onClick={() => onNodeClick(node)}
            onContextMenu={(e) => onNodeContextMenu(node, e)}
            style={{ cursor: 'pointer' }}
            data-node
            filter={node.isCurrent ? undefined : 'url(#gps-node-shadow)'}
          >
            {/* Outer glow for current file */}
            {node.isCurrent && (
              <>
                <rect
                  x={node.x - 6}
                  y={node.y - 6}
                  width={NODE.FILE_W + 12}
                  height={NODE.FILE_H + 12}
                  rx={NODE.FILE_R + 4}
                  ry={NODE.FILE_R + 4}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1.5}
                  opacity={0.2}
                  filter="url(#gps-pulse-glow)"
                >
                  <animate
                    attributeName="opacity"
                    values="0.1;0.35;0.1"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </rect>
                <rect
                  x={node.x - 3}
                  y={node.y - 3}
                  width={NODE.FILE_W + 6}
                  height={NODE.FILE_H + 6}
                  rx={NODE.FILE_R + 2}
                  ry={NODE.FILE_R + 2}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={0.8}
                  opacity={0.4}
                >
                  <animate
                    attributeName="opacity"
                    values="0.2;0.5;0.2"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </rect>
              </>
            )}

            {/* Node body — glass card */}
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
            {/* Top inner highlight for depth */}
            <rect
              x={node.x + 1}
              y={node.y + 1}
              width={NODE.FILE_W - 2}
              height={1}
              rx={NODE.FILE_R}
              fill="rgba(255,255,255,0.04)"
            />

            {/* Extension badge */}
            <rect
              x={node.x + 4}
              y={node.y + 8}
              width={22}
              height={18}
              rx={4}
              fill={stroke}
              opacity={0.15}
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
              fill={node.isCurrent ? '#fff' : DARK_THEME.fileLabel}
              fontSize={10}
              fontWeight={node.isCurrent ? 600 : 400}
              fontFamily="monospace"
              clipPath="inset(0 0 0 0)"
            >
              {node.fileName.length > 9 ? node.fileName.slice(0, 8) + '\u2026' : node.fileName}
            </text>

            {/* Visit count badge — glowing */}
            {node.visits > 0 && (
              <>
                <circle
                  cx={node.x + NODE.FILE_W - 8}
                  cy={node.y + 8}
                  r={8}
                  fill={stroke}
                  opacity={0.9}
                  filter={node.visits > 5 ? 'url(#gps-soft-glow)' : undefined}
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
