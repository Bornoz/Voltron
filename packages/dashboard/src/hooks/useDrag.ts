import { useRef, useCallback, useEffect } from 'react';

interface UseDragOptions {
  onDragStart?: () => void;
  onDrag: (deltaX: number, deltaY: number) => void;
  onDragEnd?: () => void;
  disabled?: boolean;
}

interface UseDragReturn {
  isDragging: boolean;
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
}

export function useDrag({ onDragStart, onDrag, onDragEnd, disabled }: UseDragOptions): UseDragReturn {
  const isDraggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const elRef = useRef<HTMLElement | null>(null);

  // Use state-like ref to avoid re-render during drag
  const isDragging = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    // Only primary button
    if (e.button !== 0) return;
    // Don't start drag from buttons inside title bar
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    elRef.current = el;

    startRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = true;
    isDragging.current = true;
    onDragStart?.();
  }, [disabled, onDragStart]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        startRef.current = { x: e.clientX, y: e.clientY };
        onDrag(dx, dy);
      });
    };

    const handlePointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      isDragging.current = false;

      if (elRef.current) {
        // releasePointerCapture happens automatically when pointer is released
        elRef.current = null;
      }

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      onDragEnd?.();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onDrag, onDragEnd]);

  return {
    isDragging: isDragging.current,
    dragHandleProps: { onPointerDown: handlePointerDown },
  };
}
