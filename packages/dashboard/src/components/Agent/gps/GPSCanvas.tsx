import { useRef, useCallback, useEffect, type ReactNode, type PointerEvent } from 'react';
import type { GPSViewport } from './types';
import { VIEW } from './constants';

interface GPSCanvasProps {
  viewport: GPSViewport;
  onViewportChange: (vp: GPSViewport) => void;
  width: number;
  height: number;
  children: ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function GPSCanvas({ viewport, onViewportChange, width, height, children, onContextMenu }: GPSCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, vpX: 0, vpY: 0 });

  // Store latest viewport/callback in refs so listeners always see current values
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

  // Pointer-based drag with capture — works even when cursor leaves the SVG
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const handlePointerMove = (e: globalThis.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      onVpChangeRef.current({
        ...vpRef.current,
        x: dragStart.current.vpX + dx,
        y: dragStart.current.vpY + dy,
      });
    };

    const handlePointerUp = (e: globalThis.PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    return () => {
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent<SVGSVGElement>) => {
    // Left click (button 0) or middle click (button 1) to pan
    if (e.button === 0 || e.button === 1) {
      // Skip if clicking on an interactive node element
      const target = e.target as Element;
      if (target.closest('[data-node]') || target.closest('[data-interactive]')) return;

      e.preventDefault();
      dragging.current = true;
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        vpX: vpRef.current.x,
        vpY: vpRef.current.y,
      };
      svgRef.current?.setPointerCapture(e.pointerId);
    }
  }, []);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ background: 'transparent', cursor: dragging.current ? 'grabbing' : 'grab', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
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
