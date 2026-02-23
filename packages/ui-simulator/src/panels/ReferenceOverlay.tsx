import { useState, useCallback, useRef, useEffect } from 'react';
import { ImagePlus, Eye, EyeOff, Trash2, Move } from 'lucide-react';

interface ReferenceOverlayProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onImageUpload?: (imageDataUrl: string) => void;
}

export function ReferenceOverlay({ containerRef, onImageUpload }: ReferenceOverlayProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(50);
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [moveMode, setMoveMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size (max 10MB)
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
      setVisible(true);
      setPosition({ x: 0, y: 0 });
      // Notify server about the reference image upload
      onImageUpload?.(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  // Drag logic: attach window-level mousemove/mouseup while dragging
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragStart]);

  const handleRemove = useCallback(() => {
    setImageUrl(null);
    setVisible(false);
    setPosition({ x: 0, y: 0 });
    setMoveMode(false);
    setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleResetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <ImagePlus className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-gray-200">Reference Overlay</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 rounded text-sm font-medium transition-colors"
        >
          <ImagePlus className="w-4 h-4" />
          {imageUrl ? 'Change Reference Image' : 'Upload Reference Image'}
        </button>

        {/* Description when no image */}
        {!imageUrl && (
          <div className="text-xs text-gray-500 leading-relaxed">
            Upload a design mockup (PNG, JPEG, SVG, WebP) to overlay on the iframe preview for
            pixel-perfect comparison. Max 10MB.
          </div>
        )}

        {/* Controls (only show when image loaded) */}
        {imageUrl && (
          <>
            {/* Visibility toggle + Move + Remove */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVisible(!visible)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  visible
                    ? 'bg-blue-900/30 text-blue-400 border border-blue-800'
                    : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}
              >
                {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {visible ? 'Visible' : 'Hidden'}
              </button>
              <button
                onClick={() => setMoveMode(!moveMode)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  moveMode
                    ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                    : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}
              >
                <Move className="w-3 h-3" />
                Move
              </button>
              <button
                onClick={handleRemove}
                className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-red-900/30 text-gray-500 hover:text-red-400 border border-gray-700 rounded text-xs transition-colors ml-auto"
                title="Remove reference image"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Opacity slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">Opacity</span>
                <span className="text-[10px] text-gray-400 font-mono">{opacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={(e) => setOpacity(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Position info + reset */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-600 font-mono">
                offset: {position.x}px, {position.y}px
              </span>
              {(position.x !== 0 || position.y !== 0) && (
                <button
                  onClick={handleResetPosition}
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Move mode hint */}
            {moveMode && (
              <div className="text-[10px] text-yellow-500/70 bg-yellow-900/10 border border-yellow-900/30 rounded px-2 py-1">
                Move mode active. Click and drag the overlay image on the preview to reposition it.
              </div>
            )}
          </>
        )}
      </div>

      {/* The actual overlay - rendered as a portal-like element positioned over the iframe */}
      {imageUrl && visible && containerRef?.current && (
        <ReferenceOverlayImage
          imageUrl={imageUrl}
          opacity={opacity}
          position={position}
          moveMode={moveMode}
          onDragStart={handleDragStart}
          containerRef={containerRef}
        />
      )}
    </div>
  );
}

/**
 * The overlay image rendered via React portal into the iframe container.
 * This is a separate component to keep concerns clean.
 */
import { createPortal } from 'react-dom';

interface ReferenceOverlayImageProps {
  imageUrl: string;
  opacity: number;
  position: { x: number; y: number };
  moveMode: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function ReferenceOverlayImage({
  imageUrl,
  opacity,
  position,
  moveMode,
  onDragStart,
  containerRef,
}: ReferenceOverlayImageProps) {
  const container = containerRef.current;
  if (!container) return null;

  return createPortal(
    <div
      className="reference-overlay-image"
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        opacity: opacity / 100,
        pointerEvents: moveMode ? 'auto' : 'none',
        zIndex: 50,
        cursor: moveMode ? 'move' : 'default',
        width: '100%',
        height: '100%',
      }}
      onMouseDown={moveMode ? onDragStart : undefined}
    >
      <img
        src={imageUrl}
        alt="Reference overlay"
        className="max-w-full max-h-full select-none"
        draggable={false}
      />
    </div>,
    container,
  );
}
