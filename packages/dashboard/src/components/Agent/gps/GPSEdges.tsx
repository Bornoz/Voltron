import { memo } from 'react';
import type { ForceNode, ForceEdge } from './types';
import { ACTIVITY_COLORS, DARK_THEME, NODE } from './constants';

interface GPSEdgesProps {
  edges: ForceEdge[];
  nodes: ForceNode[];
}

export const GPSEdges = memo(function GPSEdges({ edges, nodes }: GPSEdgesProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <g>
      {edges.map((edge, i) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return null;

        const x1 = src.x + NODE.FILE_W / 2;
        const y1 = src.y + NODE.FILE_H / 2;
        const x2 = tgt.x + NODE.FILE_W / 2;
        const y2 = tgt.y + NODE.FILE_H / 2;

        // Curved path
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - 20;
        const color = ACTIVITY_COLORS[edge.activity] ?? DARK_THEME.edgeDefault;

        return (
          <g key={`${edge.source}-${edge.target}-${i}`}>
            {/* Glow trail behind edge */}
            <path
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeOpacity={edge.opacity * 0.08}
              filter="url(#gps-glow)"
            />
            {/* Main edge line */}
            <path
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={1.2}
              strokeOpacity={edge.opacity * 0.5}
              strokeDasharray="6 3"
              strokeLinecap="round"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="9"
                to="0"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </path>
            {/* Arrow head — glowing dot */}
            <circle cx={x2} cy={y2} r={3} fill={color} opacity={edge.opacity * 0.8} filter="url(#gps-soft-glow)" />
          </g>
        );
      })}
    </g>
  );
});
