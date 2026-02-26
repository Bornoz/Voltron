import { useRef, useCallback, useEffect } from 'react';

export type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

interface UseResizeOptions {
  onResizeStart?: () => void;
  onResize: (
    direction: ResizeDirection,
    deltaX: number,
    deltaY: number,
  ) => void;
  onResizeEnd?: () => void;
  disabled?: boolean;
}

interface UseResizeReturn {
  isResizing: boolean;
  getHandleProps: (direction: ResizeDirection) => {
    onPointerDown: (e: React.PointerEvent) => void;
    style: React.CSSProperties;
    className: string;
  };
}

const CURSOR_MAP: Record<ResizeDirection, string> = {
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
};

const HANDLE_STYLES: Record<ResizeDirection, React.CSSProperties> = {
  n:  { top: -3, left: 6, right: 6, height: 6, cursor: 'ns-resize' },
  ne: { top: -3, right: -3, width: 12, height: 12, cursor: 'nesw-resize' },
  e:  { top: 6, right: -3, bottom: 6, width: 6, cursor: 'ew-resize' },
  se: { bottom: -3, right: -3, width: 12, height: 12, cursor: 'nwse-resize' },
  s:  { bottom: -3, left: 6, right: 6, height: 6, cursor: 'ns-resize' },
  sw: { bottom: -3, left: -3, width: 12, height: 12, cursor: 'nesw-resize' },
  w:  { top: 6, left: -3, bottom: 6, width: 6, cursor: 'ew-resize' },
  nw: { top: -3, left: -3, width: 12, height: 12, cursor: 'nwse-resize' },
};

export function useResize({ onResizeStart, onResize, onResizeEnd, disabled }: UseResizeOptions): UseResizeReturn {
  const isResizingRef = useRef(false);
  const isResizing = useRef(false);
  const dirRef = useRef<ResizeDirection>('se');
  const startRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  const handlePointerDown = useCallback((dir: ResizeDirection, e: React.PointerEvent) => {
    if (disabled) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dirRef.current = dir;
    startRef.current = { x: e.clientX, y: e.clientY };
    isResizingRef.current = true;
    isResizing.current = true;
    onResizeStart?.();
  }, [disabled, onResizeStart]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isResizingRef.current) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        startRef.current = { x: e.clientX, y: e.clientY };
        onResize(dirRef.current, dx, dy);
      });
    };

    const handlePointerUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      isResizing.current = false;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      onResizeEnd?.();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onResize, onResizeEnd]);

  const getHandleProps = useCallback((direction: ResizeDirection) => ({
    onPointerDown: (e: React.PointerEvent) => handlePointerDown(direction, e),
    style: {
      position: 'absolute' as const,
      ...HANDLE_STYLES[direction],
      zIndex: 10,
    },
    className: 'hover:bg-blue-500/20 transition-colors',
  }), [handlePointerDown]);

  return {
    isResizing: isResizing.current,
    getHandleProps,
  };
}

/**
 * Compute new geometry for a panel after resize in a given direction.
 * Returns { x, y, width, height } to be applied to the panel.
 */
export function computeResize(
  direction: ResizeDirection,
  dx: number,
  dy: number,
  panel: { x: number; y: number; width: number; height: number; minWidth: number; minHeight: number },
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = panel;
  const { minWidth, minHeight } = panel;

  // East
  if (direction === 'e' || direction === 'ne' || direction === 'se') {
    width = Math.max(minWidth, width + dx);
  }

  // West
  if (direction === 'w' || direction === 'nw' || direction === 'sw') {
    const newW = Math.max(minWidth, width - dx);
    const delta = width - newW;
    x += delta;
    width = newW;
  }

  // South
  if (direction === 's' || direction === 'se' || direction === 'sw') {
    height = Math.max(minHeight, height + dy);
  }

  // North
  if (direction === 'n' || direction === 'ne' || direction === 'nw') {
    const newH = Math.max(minHeight, height - dy);
    const delta = height - newH;
    y += delta;
    height = newH;
  }

  return { x, y, width, height };
}
