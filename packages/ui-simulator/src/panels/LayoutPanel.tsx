import { useState, useCallback, useEffect } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { useSimulatorStore } from '../stores/simulatorStore';
import { useHistoryStore, createHistoryEntry } from '../stores/historyStore';
import type { SandboxBridge } from '../sandbox/SandboxBridge';

interface LayoutPanelProps {
  bridge: SandboxBridge;
}

interface DimensionInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

function DimensionInput({ label, value, onChange, placeholder }: DimensionInputProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 w-12 shrink-0">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'auto'}
        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

interface BoxModelEditorProps {
  label: string;
  color: string;
  values: { top: string; right: string; bottom: string; left: string };
  onChange: (side: string, val: string) => void;
}

function BoxModelEditor({ label, color, values, onChange }: BoxModelEditorProps) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
      <div className="grid grid-cols-3 gap-1 items-center">
        {/* Top */}
        <div />
        <input
          type="text"
          value={values.top}
          onChange={(e) => onChange('top', e.target.value)}
          className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] font-mono text-gray-300 text-center focus:outline-none focus:border-blue-500 w-full"
          placeholder="0"
        />
        <div />

        {/* Left + Label + Right */}
        <input
          type="text"
          value={values.left}
          onChange={(e) => onChange('left', e.target.value)}
          className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] font-mono text-gray-300 text-center focus:outline-none focus:border-blue-500 w-full"
          placeholder="0"
        />
        <div
          className="text-[10px] text-center py-0.5 rounded"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {label}
        </div>
        <input
          type="text"
          value={values.right}
          onChange={(e) => onChange('right', e.target.value)}
          className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] font-mono text-gray-300 text-center focus:outline-none focus:border-blue-500 w-full"
          placeholder="0"
        />

        {/* Bottom */}
        <div />
        <input
          type="text"
          value={values.bottom}
          onChange={(e) => onChange('bottom', e.target.value)}
          className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] font-mono text-gray-300 text-center focus:outline-none focus:border-blue-500 w-full"
          placeholder="0"
        />
        <div />
      </div>
    </div>
  );
}

export function LayoutPanel({ bridge }: LayoutPanelProps) {
  const selectedElement = useSimulatorStore((s) => s.selectedElement);
  const pushHistory = useHistoryStore((s) => s.push);

  const styles = selectedElement?.computedStyles ?? {};

  const [width, setWidth] = useState(styles['width'] ?? '');
  const [height, setHeight] = useState(styles['height'] ?? '');
  const [top, setTop] = useState(styles['top'] ?? '');
  const [left, setLeft] = useState(styles['left'] ?? '');

  const [margin, setMargin] = useState({
    top: styles['margin-top'] ?? '0px',
    right: styles['margin-right'] ?? '0px',
    bottom: styles['margin-bottom'] ?? '0px',
    left: styles['margin-left'] ?? '0px',
  });

  const [padding, setPadding] = useState({
    top: styles['padding-top'] ?? '0px',
    right: styles['padding-right'] ?? '0px',
    bottom: styles['padding-bottom'] ?? '0px',
    left: styles['padding-left'] ?? '0px',
  });

  // --- Interactive Resize Preview ---
  type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  const [dragging, setDragging] = useState<ResizeHandle | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [previewSize, setPreviewSize] = useState({
    w: selectedElement ? Math.round(selectedElement.bounds.width) || 100 : 100,
    h: selectedElement ? Math.round(selectedElement.bounds.height) || 80 : 80,
  });

  const handleResizeStart = useCallback((handle: ResizeHandle, e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      setPreviewSize(prev => {
        let w = prev.w;
        let h = prev.h;
        if (dragging.includes('e')) w = Math.max(20, prev.w + dx);
        if (dragging.includes('w')) w = Math.max(20, prev.w - dx);
        if (dragging.includes('s')) h = Math.max(20, prev.h + dy);
        if (dragging.includes('n')) h = Math.max(20, prev.h - dy);
        return { w, h };
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleUp = () => {
      setDragging(null);
      // Apply dimensions to the actual element via bridge
      if (selectedElement) {
        const selector = selectedElement.selector;
        const changes: Record<string, string> = {
          width: `${previewSize.w}px`,
          height: `${previewSize.h}px`,
        };
        bridge.updateLayout(selector, changes);

        // Record in history
        pushHistory(
          createHistoryEntry(
            'layout',
            selector,
            `Interactive resize to ${previewSize.w}x${previewSize.h}px`,
            {
              selector,
              changes: [
                { property: 'width', value: `${previewSize.w}px` },
                { property: 'height', value: `${previewSize.h}px` },
              ],
            },
            {
              selector,
              changes: [
                { property: 'width', value: styles['width'] ?? '' },
                { property: 'height', value: styles['height'] ?? '' },
              ],
            },
          ),
        );

        // Sync the form inputs
        setWidth(`${previewSize.w}px`);
        setHeight(`${previewSize.h}px`);
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, dragStart, bridge, selectedElement, previewSize, pushHistory, styles]);

  const handleMarginChange = useCallback((side: string, val: string) => {
    setMargin((prev) => ({ ...prev, [side]: val }));
  }, []);

  const handlePaddingChange = useCallback((side: string, val: string) => {
    setPadding((prev) => ({ ...prev, [side]: val }));
  }, []);

  const handleApply = useCallback(() => {
    if (!selectedElement) return;

    const selector = selectedElement.selector;
    const changes: Record<string, string> = {};
    const prevChanges: Record<string, string> = {};

    // Dimensions
    if (width && width !== styles['width']) {
      changes['width'] = width;
      prevChanges['width'] = styles['width'] ?? '';
    }
    if (height && height !== styles['height']) {
      changes['height'] = height;
      prevChanges['height'] = styles['height'] ?? '';
    }
    if (top && top !== styles['top']) {
      changes['top'] = top;
      prevChanges['top'] = styles['top'] ?? '';
    }
    if (left && left !== styles['left']) {
      changes['left'] = left;
      prevChanges['left'] = styles['left'] ?? '';
    }

    // Margin
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const prop = `margin-${side}`;
      if (margin[side] !== styles[prop]) {
        changes[prop] = margin[side];
        prevChanges[prop] = styles[prop] ?? '';
      }
    }

    // Padding
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const prop = `padding-${side}`;
      if (padding[side] !== styles[prop]) {
        changes[prop] = padding[side];
        prevChanges[prop] = styles[prop] ?? '';
      }
    }

    if (Object.keys(changes).length === 0) return;

    // Apply layout changes
    bridge.updateLayout(selector, changes);

    // Also inject individual styles for non-layout properties
    for (const [prop, val] of Object.entries(changes)) {
      if (!['width', 'height', 'top', 'left', 'position'].includes(prop)) {
        bridge.injectStyles(selector, prop, val);
      }
    }

    // Record in history
    pushHistory(
      createHistoryEntry(
        'layout',
        selector,
        `Layout change (${Object.keys(changes).length} properties)`,
        {
          selector,
          changes: Object.entries(changes).map(([property, value]) => ({ property, value })),
        },
        {
          selector,
          changes: Object.entries(prevChanges).map(([property, value]) => ({ property, value })),
        },
      ),
    );
  }, [selectedElement, width, height, top, left, margin, padding, styles, bridge, pushHistory]);

  if (!selectedElement) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 p-4">
        <LayoutDashboard className="w-10 h-10 text-gray-600" />
        <p className="text-sm text-center">Select an element to edit its layout.</p>
      </div>
    );
  }

  const display = styles['display'] ?? 'block';
  const position = styles['position'] ?? 'static';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <LayoutDashboard className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-gray-200">Layout</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Interactive Resize Preview */}
        <div className="mb-3">
          <div className="text-[10px] text-gray-500 mb-1">Interactive Resize</div>
          <div className="relative bg-gray-900 border border-gray-700 rounded p-2" style={{ height: '120px' }}>
            <div
              className="absolute bg-blue-900/30 border border-blue-500/50"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${Math.min(previewSize.w, 140)}px`,
                height: `${Math.min(previewSize.h, 100)}px`,
              }}
            >
              <div className="absolute text-[8px] text-blue-400 bottom-0.5 right-1">
                {previewSize.w}x{previewSize.h}
              </div>
              {/* Corner resize handles */}
              {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                <div
                  key={h}
                  onMouseDown={(e) => handleResizeStart(h, e)}
                  className="absolute w-2 h-2 bg-blue-500 border border-blue-300"
                  style={{
                    top: h.includes('n') ? -3 : undefined,
                    bottom: h.includes('s') ? -3 : undefined,
                    left: h.includes('w') ? -3 : undefined,
                    right: h.includes('e') ? -3 : undefined,
                    cursor: h === 'ne' || h === 'sw' ? 'nesw-resize' : 'nwse-resize',
                  }}
                />
              ))}
            </div>
            {dragging && (
              <div className="absolute bottom-1 left-2 text-[9px] text-yellow-400 font-mono">
                Dragging: {previewSize.w} x {previewSize.h}
              </div>
            )}
          </div>
        </div>

        {/* Element bounds info */}
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-xs text-gray-400 mb-1">Current Bounds</div>
          <div className="grid grid-cols-2 gap-1 text-xs font-mono text-gray-300">
            <span>x: {Math.round(selectedElement.bounds.x)}px</span>
            <span>y: {Math.round(selectedElement.bounds.y)}px</span>
            <span>w: {Math.round(selectedElement.bounds.width)}px</span>
            <span>h: {Math.round(selectedElement.bounds.height)}px</span>
          </div>
        </div>

        {/* Display & Position */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16">Display</span>
            <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-blue-400">
              {display}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16">Position</span>
            <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-blue-400">
              {position}
            </span>
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Dimensions
          </span>
          <DimensionInput label="Width" value={width} onChange={setWidth} />
          <DimensionInput label="Height" value={height} onChange={setHeight} />
        </div>

        {/* Position */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Position
          </span>
          <DimensionInput label="Top" value={top} onChange={setTop} />
          <DimensionInput label="Left" value={left} onChange={setLeft} />
        </div>

        {/* Margin */}
        <BoxModelEditor
          label="Margin"
          color="#f97316"
          values={margin}
          onChange={handleMarginChange}
        />

        {/* Padding */}
        <BoxModelEditor
          label="Padding"
          color="#22c55e"
          values={padding}
          onChange={handlePaddingChange}
        />

        {/* Apply button */}
        <button
          onClick={handleApply}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
        >
          Apply Layout Changes
        </button>
      </div>
    </div>
  );
}
