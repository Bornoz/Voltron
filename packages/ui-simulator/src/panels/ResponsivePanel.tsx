import { useState, useCallback } from 'react';
import {
  Monitor, Smartphone, Tablet, RotateCw,
} from 'lucide-react';
import { useSimulatorStore, VIEWPORT_PRESETS, type ViewportSize } from '../stores/simulatorStore';

const BREAKPOINT_ICONS: Record<string, typeof Monitor> = {
  sm: Smartphone,
  md: Tablet,
  lg: Monitor,
  xl: Monitor,
  '2xl': Monitor,
  full: Monitor,
};

const BREAKPOINT_LABELS: Record<string, string> = {
  sm: 'Small (640px)',
  md: 'Medium (768px)',
  lg: 'Large (1024px)',
  xl: 'Extra Large (1280px)',
  '2xl': '2X Large (1536px)',
  full: 'Full Width',
};

export function ResponsivePanel() {
  const viewportSize = useSimulatorStore((s) => s.viewportSize);
  const setViewportSize = useSimulatorStore((s) => s.setViewportSize);

  const [customWidth, setCustomWidth] = useState(String(viewportSize.width || ''));
  const [customHeight, setCustomHeight] = useState(String(viewportSize.height || ''));
  const [isLandscape, setIsLandscape] = useState(false);

  const handlePresetSelect = useCallback(
    (preset: ViewportSize) => {
      let w = preset.width;
      let h = preset.height;

      // Swap if landscape and width < height
      if (isLandscape && w > 0 && h > 0 && h > w) {
        [w, h] = [h, w];
      }

      const newSize: ViewportSize = { width: w, height: h, label: preset.label };
      setViewportSize(newSize);
      setCustomWidth(String(w || ''));
      setCustomHeight(String(h || ''));
    },
    [setViewportSize, isLandscape],
  );

  const handleCustomApply = useCallback(() => {
    const w = parseInt(customWidth, 10);
    const h = parseInt(customHeight, 10);

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return;

    setViewportSize({
      width: w,
      height: h,
      label: `${w}x${h}`,
    });
  }, [customWidth, customHeight, setViewportSize]);

  const handleOrientationToggle = useCallback(() => {
    setIsLandscape((prev) => !prev);

    if (viewportSize.width > 0 && viewportSize.height > 0) {
      const newSize: ViewportSize = {
        width: viewportSize.height,
        height: viewportSize.width,
        label: viewportSize.label,
      };
      setViewportSize(newSize);
      setCustomWidth(String(newSize.width));
      setCustomHeight(String(newSize.height));
    }
  }, [viewportSize, setViewportSize]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <Monitor className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-gray-200">Responsive</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Current viewport */}
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-xs text-gray-400 mb-1">Current Viewport</div>
          <div className="font-mono text-sm text-blue-400">
            {viewportSize.label === 'full'
              ? 'Full Width'
              : `${viewportSize.width} x ${viewportSize.height}`}
          </div>
        </div>

        {/* Preset breakpoints */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Breakpoints
          </span>
          <div className="grid grid-cols-2 gap-2">
            {VIEWPORT_PRESETS.map((preset) => {
              const Icon = BREAKPOINT_ICONS[preset.label] ?? Monitor;
              const isActive = viewportSize.label === preset.label;

              return (
                <button
                  key={preset.label}
                  onClick={() => handlePresetSelect(preset)}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-left transition-colors ${
                    isActive
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                      : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-xs font-medium">{preset.label}</div>
                    <div className="text-[10px] text-gray-500">
                      {preset.label === 'full'
                        ? 'Auto'
                        : `${preset.width}x${preset.height}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orientation toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleOrientationToggle}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 hover:border-gray-500 hover:bg-gray-700 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            {isLandscape ? 'Landscape' : 'Portrait'}
          </button>
        </div>

        {/* Custom size */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Custom Size
          </span>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 mb-0.5 block">Width</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                placeholder="Width"
                min={200}
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <span className="text-gray-500 mt-4">x</span>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 mb-0.5 block">Height</label>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                placeholder="Height"
                min={200}
                className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleCustomApply}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
          >
            Apply Custom Size
          </button>
        </div>

        {/* Common device presets */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Device Presets
          </span>
          <div className="space-y-1">
            {[
              { label: 'iPhone SE', width: 375, height: 667 },
              { label: 'iPhone 14 Pro', width: 393, height: 852 },
              { label: 'iPad Mini', width: 768, height: 1024 },
              { label: 'iPad Pro 12.9"', width: 1024, height: 1366 },
              { label: 'MacBook Air', width: 1440, height: 900 },
              { label: 'Desktop 1080p', width: 1920, height: 1080 },
            ].map((device) => (
              <button
                key={device.label}
                onClick={() => handlePresetSelect({ ...device, label: device.label })}
                className="flex items-center justify-between w-full px-3 py-1.5 rounded hover:bg-gray-800/50 text-left transition-colors"
              >
                <span className="text-xs text-gray-300">{device.label}</span>
                <span className="text-[10px] font-mono text-gray-500">
                  {device.width}x{device.height}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Breakpoint labels reference */}
        <div className="space-y-1 pt-2 border-t border-gray-800">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Tailwind Breakpoints
          </span>
          {Object.entries(BREAKPOINT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-mono">{key}</span>
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
