import type { AgentActivity } from '@voltron/shared';

export interface ForceNode {
  id: string;
  filePath: string;
  fileName: string;
  dir: string;
  type: 'file' | 'directory';
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
  radius: number;
  visits: number;
  lastActivity: AgentActivity;
  isCurrent: boolean;
  extension: string;
  children?: ForceNode[];
}

export interface ForceEdge {
  source: string;
  target: string;
  timestamp: number;
  activity: AgentActivity;
  opacity: number;
}

export interface GPSTheme {
  background: string;
  dirFill: string;
  dirStroke: string;
  dirLabel: string;
  fileFill: string;
  fileStroke: string;
  fileLabel: string;
  currentGlow: string;
  edgeDefault: string;
  trailDefault: string;
  cursorHalo: string;
  textPrimary: string;
  textSecondary: string;
}

export interface GPSViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FilePreviewData {
  filePath: string;
  content?: string;
  breadcrumbs: Array<{
    activity: AgentActivity;
    timestamp: number;
    toolName?: string;
    contentSnippet?: string;
    editDiff?: string;
  }>;
  visits: number;
  totalDuration: number;
}

export interface GPSStats {
  totalFiles: number;
  visitedFiles: number;
  totalVisits: number;
  topFiles: Array<{ path: string; visits: number; activity: AgentActivity }>;
  averageVisitsPerFile: number;
}
