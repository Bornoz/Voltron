import type { ForceNode, ForceEdge } from './types';
import { FORCE, NODE } from './constants';
import type { AgentBreadcrumb } from '@voltron/shared';

interface LayoutInput {
  files: string[];
  breadcrumbs: AgentBreadcrumb[];
  currentFile: string | null;
  width: number;
  height: number;
}

interface LayoutResult {
  nodes: ForceNode[];
  edges: ForceEdge[];
  dirZones: Array<{ dir: string; x: number; y: number; w: number; h: number }>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Pure force-directed layout engine (no external dependencies).
 * Uses spring forces, repulsion, directory containment, and center gravity.
 */
export function computeForceLayout(input: LayoutInput): LayoutResult {
  const { files, breadcrumbs, currentFile, width, height } = input;
  if (files.length === 0) return { nodes: [], edges: [], dirZones: [], bounds: { minX: 0, minY: 0, maxX: width, maxY: height } };

  // Build visit counts & activity map
  const visitMap = new Map<string, number>();
  const activityMap = new Map<string, string>();
  for (const bc of breadcrumbs) {
    visitMap.set(bc.filePath, (visitMap.get(bc.filePath) ?? 0) + 1);
    activityMap.set(bc.filePath, bc.activity);
  }
  const maxVisits = Math.max(1, ...visitMap.values());

  // Build edges from consecutive breadcrumbs
  const edges: ForceEdge[] = [];
  const edgeSet = new Set<string>();
  for (let i = 1; i < breadcrumbs.length; i++) {
    const src = breadcrumbs[i - 1].filePath;
    const tgt = breadcrumbs[i].filePath;
    if (src === tgt) continue;
    const key = `${src}→${tgt}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({
        source: src,
        target: tgt,
        timestamp: breadcrumbs[i].timestamp,
        activity: breadcrumbs[i].activity as ForceEdge['activity'],
        opacity: 0.3 + 0.7 * (i / breadcrumbs.length),
      });
    }
  }

  // Create nodes
  const dirSet = new Set<string>();
  const nodes: ForceNode[] = files.map((filePath, idx) => {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
    dirSet.add(dir);
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()! : '';
    const visits = visitMap.get(filePath) ?? 0;
    const radius = NODE.MIN_RADIUS + (NODE.MAX_RADIUS - NODE.MIN_RADIUS) * (visits / maxVisits);

    // Initial position: spread by directory in a grid
    const dirIdx = [...dirSet].indexOf(dir);
    const angle = (dirIdx * 2.399 + idx * 0.5) % (2 * Math.PI); // golden angle
    const r = 80 + dirIdx * 60 + Math.random() * 40;
    const cx = width / 2 + r * Math.cos(angle);
    const cy = height / 2 + r * Math.sin(angle);

    return {
      id: filePath,
      filePath,
      fileName,
      dir,
      type: 'file' as const,
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      radius,
      visits,
      lastActivity: (activityMap.get(filePath) ?? 'IDLE') as ForceNode['lastActivity'],
      isCurrent: filePath === currentFile,
      extension: ext,
    };
  });

  // Build adjacency for spring forces
  const adjacency = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
    if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
    adjacency.get(e.source)!.add(e.target);
    adjacency.get(e.target)!.add(e.source);
  }

  // Also connect files in same directory
  const dirFiles = new Map<string, ForceNode[]>();
  for (const n of nodes) {
    if (!dirFiles.has(n.dir)) dirFiles.set(n.dir, []);
    dirFiles.get(n.dir)!.push(n);
  }

  // Directory center nodes (virtual)
  const dirCenters = new Map<string, { x: number; y: number }>();
  for (const [dir, fns] of dirFiles) {
    const avgX = fns.reduce((s, n) => s + n.x, 0) / fns.length;
    const avgY = fns.reduce((s, n) => s + n.y, 0) / fns.length;
    dirCenters.set(dir, { x: avgX, y: avgY });
  }

  // Force simulation
  const centerX = width / 2;
  const centerY = height / 2;
  const n = nodes.length;

  for (let iter = 0; iter < FORCE.ITERATIONS; iter++) {
    // Repulsion (all pairs — simplified O(n²), fine for <500 nodes)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < FORCE.MIN_DIST) dist = FORCE.MIN_DIST;
        const force = FORCE.REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Spring forces (connected nodes)
    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.source);
      const b = nodes.find((n) => n.id === e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - FORCE.SPRING_REST;
      const force = FORCE.SPRING_K * displacement;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Directory containment (pull toward directory center)
    for (const node of nodes) {
      const center = dirCenters.get(node.dir);
      if (!center) continue;
      const dx = center.x - node.x;
      const dy = center.y - node.y;
      node.vx += dx * FORCE.DIR_GRAVITY;
      node.vy += dy * FORCE.DIR_GRAVITY;
    }

    // Center gravity
    for (const node of nodes) {
      node.vx += (centerX - node.x) * FORCE.CENTER_GRAVITY;
      node.vy += (centerY - node.y) * FORCE.CENTER_GRAVITY;
    }

    // Apply velocities with damping
    for (const node of nodes) {
      if (node.fx !== undefined) { node.x = node.fx; node.vx = 0; }
      else { node.vx *= FORCE.DAMPING; node.x += node.vx; }
      if (node.fy !== undefined) { node.y = node.fy; node.vy = 0; }
      else { node.vy *= FORCE.DAMPING; node.y += node.vy; }
    }

    // Update directory centers
    for (const [dir, fns] of dirFiles) {
      const avgX = fns.reduce((s, n) => s + n.x, 0) / fns.length;
      const avgY = fns.reduce((s, n) => s + n.y, 0) / fns.length;
      dirCenters.set(dir, { x: avgX, y: avgY });
    }
  }

  // Calculate directory zones
  const dirZones = [...dirFiles.entries()].map(([dir, fns]) => {
    const minX = Math.min(...fns.map((n) => n.x)) - NODE.DIR_PAD;
    const minY = Math.min(...fns.map((n) => n.y)) - NODE.DIR_PAD - NODE.DIR_LABEL_H;
    const maxX = Math.max(...fns.map((n) => n.x + NODE.FILE_W)) + NODE.DIR_PAD;
    const maxY = Math.max(...fns.map((n) => n.y + NODE.FILE_H)) + NODE.DIR_PAD;
    return { dir, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  });

  // Compute bounds
  const allX = nodes.map((n) => n.x);
  const allY = nodes.map((n) => n.y);
  const bounds = {
    minX: Math.min(...allX) - 50,
    minY: Math.min(...allY) - 50,
    maxX: Math.max(...allX) + NODE.FILE_W + 50,
    maxY: Math.max(...allY) + NODE.FILE_H + 50,
  };

  return { nodes, edges, dirZones, bounds };
}
