import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentBreadcrumb } from '@voltron/shared';
import { useTranslation } from '../../i18n';

/* ───── constants ───── */

const ACTIVITY_STROKE: Record<string, string> = {
  READING: '#4ade80',
  WRITING: '#facc15',
  SEARCHING: '#60a5fa',
  EXECUTING: '#fb923c',
  THINKING: '#c084fc',
  WAITING: '#9ca3af',
  IDLE: '#6b7280',
};

const NODE_RADIUS = 18;
const DIR_PAD = 12;
const DIR_LABEL_H = 18;

/* ───── types ───── */

interface FileNode {
  id: string;
  filePath: string;
  fileName: string;
  dir: string;
  visits: number;
  lastActivity: string;
  isCurrent: boolean;
  x: number;
  y: number;
}

interface DirZone {
  dir: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Edge {
  from: string;
  to: string;
}

/* ───── helpers ───── */

function extractFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

function extractDir(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 2) return '/';
  return parts.slice(0, -1).join('/');
}

function shortenDir(dir: string): string {
  const parts = dir.replace(/^\//, '').split('/');
  if (parts.length <= 2) return dir;
  return '.../' + parts.slice(-2).join('/');
}

/* ───── layout engine ───── */

function computeLayout(
  breadcrumbs: AgentBreadcrumb[],
  currentFile: string | null,
  currentActivity: string,
): { nodes: FileNode[]; dirs: DirZone[]; edges: Edge[] } {
  // Build file visit map
  const visitMap: globalThis.Map<string, { visits: number; lastActivity: string; order: number }> = new globalThis.Map();
  let order = 0;
  for (const crumb of breadcrumbs) {
    const existing = visitMap.get(crumb.filePath);
    if (existing) {
      existing.visits++;
      existing.lastActivity = crumb.activity;
      existing.order = order++;
    } else {
      visitMap.set(crumb.filePath, { visits: 1, lastActivity: crumb.activity, order: order++ });
    }
  }

  // Group files by directory
  const dirFiles: globalThis.Map<string, string[]> = new globalThis.Map();
  for (const filePath of visitMap.keys()) {
    const dir = extractDir(filePath);
    const existing = dirFiles.get(dir) ?? [];
    existing.push(filePath);
    dirFiles.set(dir, existing);
  }

  // Layout: place directories as rows, files as columns within each dir
  const dirs: DirZone[] = [];
  const nodes: FileNode[] = [];
  let yOffset = DIR_PAD;

  const sortedDirs = [...dirFiles.entries()].sort(
    (a: [string, string[]], b: [string, string[]]) => {
      const minOrderA = Math.min(...a[1].map((f: string) => visitMap.get(f)!.order));
      const minOrderB = Math.min(...b[1].map((f: string) => visitMap.get(f)!.order));
      return minOrderA - minOrderB;
    },
  );

  for (const [dir, files] of sortedDirs) {
    const cols = Math.min(files.length, 6);
    const rows = Math.ceil(files.length / cols);
    const cellW = NODE_RADIUS * 3;
    const cellH = NODE_RADIUS * 3;
    const zoneW = cols * cellW + DIR_PAD * 2;
    const zoneH = rows * cellH + DIR_LABEL_H + DIR_PAD * 2;

    dirs.push({
      dir,
      label: shortenDir(dir),
      x: DIR_PAD,
      y: yOffset,
      w: zoneW,
      h: zoneH,
    });

    // Sort files by visit order
    const sorted = files.sort((a: string, b: string) => visitMap.get(a)!.order - visitMap.get(b)!.order);

    sorted.forEach((filePath: string, i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const info = visitMap.get(filePath)!;
      const cx = DIR_PAD + DIR_PAD + col * cellW + cellW / 2;
      const cy = yOffset + DIR_LABEL_H + DIR_PAD + row * cellH + cellH / 2;

      nodes.push({
        id: filePath,
        filePath,
        fileName: extractFileName(filePath),
        dir,
        visits: info.visits,
        lastActivity: currentFile === filePath ? currentActivity : info.lastActivity,
        isCurrent: currentFile === filePath,
        x: cx,
        y: cy,
      });
    });

    yOffset += zoneH + DIR_PAD;
  }

  // Edges: sequential navigation between unique files
  const edges: Edge[] = [];
  let lastFile = '';
  for (const crumb of breadcrumbs) {
    if (lastFile && lastFile !== crumb.filePath) {
      // Avoid duplicate edges
      const edgeKey = `${lastFile}->${crumb.filePath}`;
      if (!edges.some((e) => `${e.from}->${e.to}` === edgeKey)) {
        edges.push({ from: lastFile, to: crumb.filePath });
      }
    }
    lastFile = crumb.filePath;
  }

  return { nodes, dirs, edges };
}

/* ───── component ───── */

export function FileNavigationMap() {
  const { t } = useTranslation();
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const currentFile = useAgentStore((s) => s.currentFile);
  const activity = useAgentStore((s) => s.activity);
  const status = useAgentStore((s) => s.status);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodes, dirs, edges } = useMemo(
    () => computeLayout(breadcrumbs, currentFile, activity),
    [breadcrumbs, currentFile, activity],
  );

  const nodeMap = useMemo((): globalThis.Map<string, FileNode> => {
    const m: globalThis.Map<string, FileNode> = new globalThis.Map();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Compute SVG viewBox
  const viewBox = useMemo(() => {
    if (nodes.length === 0) return '0 0 300 200';
    let maxX = 0;
    let maxY = 0;
    for (const d of dirs) {
      maxX = Math.max(maxX, d.x + d.w + DIR_PAD);
      maxY = Math.max(maxY, d.y + d.h + DIR_PAD);
    }
    return `0 0 ${Math.max(maxX, 300)} ${Math.max(maxY, 200)}`;
  }, [nodes, dirs]);

  // Auto-scroll to current node
  useEffect(() => {
    if (!currentFile || !containerRef.current) return;
    const node = nodeMap.get(currentFile);
    if (!node) return;
    // Scroll SVG container to show current node
    const container = containerRef.current;
    const [, , vbW, vbH] = viewBox.split(' ').map(Number);
    const ratioX = node.x / vbW;
    const ratioY = node.y / vbH;
    container.scrollLeft = ratioX * container.scrollWidth - container.clientWidth / 2;
    container.scrollTop = ratioY * container.scrollHeight - container.clientHeight / 2;
  }, [currentFile, nodeMap, viewBox]);

  const isActive = !['IDLE', 'COMPLETED', 'CRASHED'].includes(status);

  // Arrow marker definition
  const renderDefs = useCallback(
    () => (
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#4b5563" />
        </marker>
        {/* Glow filter for current node */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    ),
    [],
  );

  if (!isActive || nodes.length === 0) {
    return (
      <div className="flex flex-col h-full bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800 bg-gray-900/60">
          <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            {t('agent.fileMap')}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MapIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-[11px] text-gray-600">
              {isActive ? t('agent.noNavigation') : t('agent.startAgent')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800 bg-gray-900/60">
        <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
          {t('agent.fileMap')}
        </span>
        <span className="text-[9px] text-gray-600 ml-auto">
          {nodes.length} {nodes.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {/* SVG canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="w-full h-full min-h-[180px]"
          style={{ minWidth: viewBox.split(' ')[2] + 'px' }}
        >
          {renderDefs()}

          {/* Directory zones */}
          {dirs.map((d) => (
            <g key={d.dir}>
              <rect
                x={d.x}
                y={d.y}
                width={d.w}
                height={d.h}
                rx={8}
                fill="#111827"
                stroke="#1f2937"
                strokeWidth={1}
              />
              <text
                x={d.x + DIR_PAD}
                y={d.y + DIR_LABEL_H - 4}
                fill="#6b7280"
                fontSize={10}
                fontFamily="monospace"
              >
                {d.label}
              </text>
            </g>
          ))}

          {/* Edges */}
          {edges.map((e, i) => {
            const from = nodeMap.get(e.from);
            const to = nodeMap.get(e.to);
            if (!from || !to) return null;

            // Calculate edge endpoint on circle boundary
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;

            const x1 = from.x + nx * NODE_RADIUS;
            const y1 = from.y + ny * NODE_RADIUS;
            const x2 = to.x - nx * (NODE_RADIUS + 8);
            const y2 = to.y - ny * (NODE_RADIUS + 8);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#374151"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
                opacity={0.6}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const strokeColor = ACTIVITY_STROKE[node.lastActivity] ?? '#6b7280';
            const r = node.isCurrent ? NODE_RADIUS + 4 : NODE_RADIUS;
            const isHovered = hoveredNode === node.id;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Current node glow */}
                {node.isCurrent && (
                  <>
                    <circle cx={node.x} cy={node.y} r={r + 6} fill="none" stroke="#3b82f6" strokeWidth={1.5} opacity={0.3}>
                      <animate attributeName="r" values={`${r + 4};${r + 10};${r + 4}`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}

                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill="#1e293b"
                  stroke={strokeColor}
                  strokeWidth={node.isCurrent ? 3 : 2}
                  filter={node.isCurrent ? 'url(#glow)' : undefined}
                />

                {/* File name label */}
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={node.isCurrent ? '#e2e8f0' : '#94a3b8'}
                  fontSize={node.fileName.length > 12 ? 7 : 8}
                  fontFamily="sans-serif"
                  fontWeight={node.isCurrent ? 600 : 400}
                >
                  {node.fileName.length > 16 ? node.fileName.slice(0, 14) + '..' : node.fileName}
                </text>

                {/* Visit count badge */}
                {node.visits > 1 && (
                  <>
                    <circle cx={node.x + r - 4} cy={node.y - r + 4} r={7} fill="#3b82f6" />
                    <text
                      x={node.x + r - 4}
                      y={node.y - r + 5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={8}
                      fontWeight={700}
                    >
                      {node.visits}
                    </text>
                  </>
                )}

                {/* Hover tooltip */}
                {isHovered && (
                  <foreignObject x={node.x - 80} y={node.y + r + 6} width={160} height={44}>
                    <div
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 9,
                        color: '#cbd5e1',
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{node.filePath}</div>
                      <div style={{ color: '#64748b' }}>
                        {node.visits} {t('agent.visits')}
                      </div>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
