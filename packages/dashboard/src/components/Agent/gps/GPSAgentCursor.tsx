import { memo, useMemo } from 'react';
import type { ForceNode } from './types';
import { ACTIVITY_COLORS, VIEW, NODE } from './constants';
import type { AgentBreadcrumb } from '@voltron/shared';

interface GPSAgentCursorProps {
  currentNode: ForceNode | null;
  breadcrumbs: AgentBreadcrumb[];
  nodes: ForceNode[];
}

export const GPSAgentCursor = memo(function GPSAgentCursor({
  currentNode, breadcrumbs, nodes,
}: GPSAgentCursorProps) {
  // Build trail from recent breadcrumbs
  const trail = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const recent = breadcrumbs.slice(-VIEW.TRAIL_LENGTH);
    return recent
      .map((bc) => nodeMap.get(bc.filePath))
      .filter((n): n is ForceNode => n != null);
  }, [breadcrumbs, nodes]);

  if (!currentNode) return null;

  const cx = currentNode.x + NODE.FILE_W / 2;
  const cy = currentNode.y + NODE.FILE_H / 2;
  const color = ACTIVITY_COLORS[currentNode.lastActivity] ?? '#3b82f6';

  return (
    <g>
      {/* Trail — fading breadcrumbs */}
      {trail.map((node, i) => {
        if (node.id === currentNode.id) return null;
        const tx = node.x + NODE.FILE_W / 2;
        const ty = node.y + NODE.FILE_H / 2;
        const opacity = (i + 1) / trail.length * VIEW.CURSOR_TRAIL_OPACITY_DECAY;
        return (
          <g key={`trail-${i}`}>
            <circle cx={tx} cy={ty} r={8} fill={color} opacity={opacity * 0.15} filter="url(#gps-glow)" />
            <circle cx={tx} cy={ty} r={4} fill={color} opacity={opacity} />
          </g>
        );
      })}

      {/* Outer halo — large pulsing ring */}
      <circle
        cx={cx}
        cy={cy}
        r={32}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.15}
        filter="url(#gps-cursor-glow)"
      >
        <animate attributeName="r" values="24;36;24" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.08;0.2;0.08" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* Inner halo ring */}
      <circle
        cx={cx}
        cy={cy}
        r={20}
        fill="none"
        stroke={color}
        strokeWidth={2}
        opacity={0.3}
        filter="url(#gps-glow)"
      >
        <animate attributeName="r" values="18;24;18" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0.35;0.15" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Agent dot — core with glow */}
      <circle
        cx={cx}
        cy={cy}
        r={9}
        fill={color}
        filter="url(#gps-cursor-glow)"
        style={{
          transition: `cx ${VIEW.CURSOR_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), cy ${VIEW.CURSOR_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      />

      {/* Inner white dot */}
      <circle cx={cx} cy={cy} r={3.5} fill="#fff" />

      {/* Activity label — pill background */}
      <rect
        x={cx - 28}
        y={cy - 44}
        width={56}
        height={16}
        rx={8}
        fill="rgba(0,0,0,0.6)"
        stroke={color}
        strokeWidth={0.5}
        opacity={0.8}
      />
      <text
        x={cx}
        y={cy - 33}
        fill={color}
        fontSize={9}
        fontWeight={700}
        fontFamily="monospace"
        textAnchor="middle"
      >
        {currentNode.lastActivity}
      </text>
    </g>
  );
});
