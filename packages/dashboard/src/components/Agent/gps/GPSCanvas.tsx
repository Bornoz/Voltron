import { useRef, useCallback, useState, useEffect, type ReactNode, type MouseEvent } from 'react';
import type { GPSViewport } from './types';
import { VIEW } from './constants';

interface GPSCanvasProps {
  viewport: GPSViewport;
  onViewportChange: (vp: GPSViewport) => void;
  width: number;
  height: number;
  children: ReactNode;
  onContextMenu?: (e: MouseEvent) => void;
}

export function GPSCanvas({ viewport, onViewportChange, width, height, children, onContextMenu }: GPSCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, vpX: 0, vpY: 0 });

  // Store latest viewport/callback in refs so the native listener always sees current values
  const vpRef = useRef(viewport);
  const onVpChangeRef = useRef(onViewportChange);
  vpRef.current = viewport;
  onVpChangeRef.current = onViewportChange;

  // Register wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const handleWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const vp = vpRef.current;
      const delta = e.deltaY > 0 ? -VIEW.ZOOM_STEP : VIEW.ZOOM_STEP;
      const newZoom = Math.max(VIEW.MIN_ZOOM, Math.min(VIEW.MAX_ZOOM, vp.zoom + delta));
      if (newZoom === vp.zoom) return;

      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = newZoom / vp.zoom;
      const newX = mx - (mx - vp.x) * factor;
      const newY = my - (my - vp.y) * factor;

      onVpChangeRef.current({ x: newX, y: newY, zoom: newZoom });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, vpX: viewport.x, vpY: viewport.y };
    }
  }, [viewport]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    onViewportChange({ ...viewport, x: dragStart.current.vpX + dx, y: dragStart.current.vpY + dy });
  }, [dragging, viewport, onViewportChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ background: 'transparent', cursor: dragging ? 'grabbing' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={onContextMenu}
    >
      <defs>
        <filter id="gps-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="gps-pulse-glow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {children}
      </g>
    </svg>
  );
}
