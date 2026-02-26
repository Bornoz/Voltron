import { useRef, useCallback, useState, type ReactNode, type WheelEvent, type MouseEvent } from 'react';
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

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -VIEW.ZOOM_STEP : VIEW.ZOOM_STEP;
    const newZoom = Math.max(VIEW.MIN_ZOOM, Math.min(VIEW.MAX_ZOOM, viewport.zoom + delta));
    if (newZoom === viewport.zoom) return;

    // Zoom toward mouse position
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = newZoom / viewport.zoom;
    const newX = mx - (mx - viewport.x) * factor;
    const newY = my - (my - viewport.y) * factor;

    onViewportChange({ x: newX, y: newY, zoom: newZoom });
  }, [viewport, onViewportChange]);

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
      onWheel={handleWheel}
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
