import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Shield, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import type { FileNode as FileNodeType } from '../../stores/fileTreeStore';
import { useFileTreeStore } from '../../stores/fileTreeStore';
import { useZoneStore } from '../../stores/zoneStore';
import { useMemo } from 'react';

const statusColors = {
  created: 'text-green-400',
  modified: 'text-yellow-400',
  deleted: 'text-red-400 line-through opacity-60',
  unchanged: 'text-gray-400',
};

const statusDots = {
  created: 'bg-green-400',
  modified: 'bg-yellow-400',
  deleted: 'bg-red-400',
  unchanged: '',
};

// Heat map: risk-based background colors with opacity based on eventCount
const HEAT_COLORS: Record<string, string> = {
  NONE: 'rgba(107, 114, 128, 0.08)',
  LOW: 'rgba(34, 197, 94, 0.12)',
  MEDIUM: 'rgba(234, 179, 8, 0.15)',
  HIGH: 'rgba(249, 115, 22, 0.20)',
  CRITICAL: 'rgba(239, 68, 68, 0.25)',
};

function getHeatIntensity(eventCount: number): number {
  // Scale: 0 events=0.3, 5+=0.7, 20+=1.0
  if (eventCount <= 0) return 0.3;
  if (eventCount >= 20) return 1.0;
  return 0.3 + (eventCount / 20) * 0.7;
}

function matchesZone(filePath: string, zonePath: string): boolean {
  // Simple glob matching for common patterns
  if (zonePath.endsWith('/**')) {
    const prefix = zonePath.slice(0, -3);
    return filePath.startsWith(prefix) || filePath === prefix;
  }
  if (zonePath.endsWith('/*')) {
    const prefix = zonePath.slice(0, -2);
    const remaining = filePath.slice(prefix.length);
    return filePath.startsWith(prefix) && remaining.split('/').filter(Boolean).length <= 1;
  }
  if (zonePath.includes('*')) {
    // Convert glob to regex
    const pattern = zonePath.replace(/\./g, '\\.').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*');
    return new RegExp(`^${pattern}$`).test(filePath);
  }
  return filePath === zonePath || filePath.startsWith(zonePath + '/');
}

interface FileNodeProps {
  node: FileNodeType;
  depth: number;
  onSelectFile: (path: string) => void;
}

export function FileNodeComponent({ node, depth, onSelectFile }: FileNodeProps) {
  const expandedPaths = useFileTreeStore((s) => s.expandedPaths);
  const toggleExpanded = useFileTreeStore((s) => s.toggleExpanded);
  const selectedPath = useFileTreeStore((s) => s.selectedPath);
  const heatMapEnabled = useFileTreeStore((s) => s.heatMapEnabled);
  const agentCurrentFile = useFileTreeStore((s) => s.agentCurrentFile);
  const agentVisitedFiles = useFileTreeStore((s) => s.agentVisitedFiles);
  const zones = useZoneStore((s) => s.zones);

  const isAgentHere = agentCurrentFile === node.path;
  const wasVisitedByAgent = agentVisitedFiles.has(node.path);

  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  // Check if file is in a protection zone
  const matchedZone = useMemo(() => {
    for (const zone of zones) {
      if (matchesZone(node.path, zone.path)) {
        return zone;
      }
    }
    return null;
  }, [zones, node.path]);

  // Sort children: directories first, then by name
  const sortedChildren = node.isDirectory
    ? [...node.children.values()].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    : [];

  const handleClick = () => {
    if (node.isDirectory) {
      toggleExpanded(node.path);
    } else {
      onSelectFile(node.path);
    }
  };

  // Heat map style
  const heatStyle = heatMapEnabled && !node.isDirectory && node.eventCount > 0
    ? {
        paddingLeft: `${depth * 12 + 4}px`,
        backgroundColor: HEAT_COLORS[node.maxRisk] ?? HEAT_COLORS.NONE,
        opacity: getHeatIntensity(node.eventCount),
      }
    : { paddingLeft: `${depth * 12 + 4}px` };

  // Zone overlay style
  const isProtected = matchedZone !== null;
  const isDNT = matchedZone?.level === 'DO_NOT_TOUCH';

  return (
    <div>
      <button
        onClick={handleClick}
        className={clsx(
          'flex items-center gap-1.5 w-full text-left py-0.5 px-1 rounded text-xs hover:bg-gray-800/50 transition-colors',
          isSelected && 'bg-blue-900/30',
          isProtected && !isDNT && 'border-l-2 border-yellow-600/50 zone-overlay-surgical',
          isDNT && 'border-l-2 border-red-600/50 zone-overlay-dnt',
        )}
        style={heatStyle}
      >
        {/* Expand/Collapse for directories */}
        {node.isDirectory ? (
          isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Icon */}
        {node.isDirectory ? (
          isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          )
        ) : (
          <File className={clsx('w-3.5 h-3.5 shrink-0', statusColors[node.status])} />
        )}

        {/* Name */}
        <span
          className={clsx(
            'truncate',
            node.isDirectory ? 'text-gray-300 font-medium' : statusColors[node.status],
          )}
          title={node.path}
        >
          {node.name}
        </span>

        {/* Protection zone indicator */}
        {isProtected && (
          isDNT ? (
            <ShieldAlert className="w-3 h-3 text-red-400 shrink-0" />
          ) : (
            <Shield className="w-3 h-3 text-yellow-400 shrink-0" />
          )
        )}

        {/* Agent GPS indicator */}
        {isAgentHere && (
          <span className="relative flex h-2 w-2 shrink-0 ml-auto">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
        )}
        {!isAgentHere && wasVisitedByAgent && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0 ml-auto bg-gray-500 opacity-50" />
        )}

        {/* Status dot */}
        {!isAgentHere && !wasVisitedByAgent && !node.isDirectory && node.status !== 'unchanged' && (
          <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0 ml-auto', statusDots[node.status])} />
        )}

        {/* Event count */}
        {node.eventCount > 0 && (
          <span className={clsx(
            'text-[9px] shrink-0 ml-1',
            heatMapEnabled && node.maxRisk === 'CRITICAL' ? 'text-red-400 font-bold' :
            heatMapEnabled && node.maxRisk === 'HIGH' ? 'text-orange-400 font-semibold' :
            'text-gray-600',
          )}>
            {node.eventCount}
          </span>
        )}
      </button>

      {/* Children */}
      {node.isDirectory && isExpanded && (
        <div>
          {sortedChildren.map((child) => (
            <FileNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
