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
      {/* Trail */}
      {trail.map((node, i) => {
        if (node.id === currentNode.id) return null;
        const tx = node.x + NODE.FILE_W / 2;
        const ty = node.y + NODE.FILE_H / 2;
        const opacity = (i + 1) / trail.length * VIEW.CURSOR_TRAIL_OPACITY_DECAY;
        return (
          <circle
            key={`trail-${i}`}
            cx={tx}
            cy={ty}
            r={6}
            fill={color}
            opacity={opacity}
          />
        );
      })}

      {/* Halo ring */}
      <circle
        cx={cx}
        cy={cy}
        r={24}
        fill="none"
        stroke={color}
        strokeWidth={2}
        opacity={0.3}
        filter="url(#gps-glow)"
      >
        <animate
          attributeName="r"
          values="20;28;20"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.2;0.4;0.2"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Agent dot */}
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={color}
        filter="url(#gps-glow)"
        style={{
          transition: `cx ${VIEW.CURSOR_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), cy ${VIEW.CURSOR_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      />

      {/* Inner dot */}
      <circle cx={cx} cy={cy} r={3} fill="#fff" />

      {/* Activity label */}
      <text
        x={cx}
        y={cy - 32}
        fill={color}
        fontSize={10}
        fontWeight={700}
        fontFamily="monospace"
        textAnchor="middle"
      >
        {currentNode.lastActivity}
      </text>
    </g>
  );
});
