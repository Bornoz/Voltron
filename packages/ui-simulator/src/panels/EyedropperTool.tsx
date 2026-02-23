import { useState, useCallback } from 'react';
import { Pipette, Copy, Check } from 'lucide-react';
import type { SandboxBridge } from '../sandbox/SandboxBridge';

interface EyedropperToolProps {
  bridge: SandboxBridge;
  onColorPicked?: (color: string) => void;
}

// Augment window for EyeDropper API (Chrome 95+)
declare global {
  interface EyeDropperOpenResult {
    sRGBHex: string;
  }
  interface EyeDropperConstructor {
    new (): {
      open(options?: { signal?: AbortSignal }): Promise<EyeDropperOpenResult>;
    };
  }
  interface Window {
    EyeDropper?: EyeDropperConstructor;
  }
}

export function EyedropperTool({ bridge, onColorPicked }: EyedropperToolProps) {
  const [isActive, setIsActive] = useState(false);
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [pickedColors, setPickedColors] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const startPicking = useCallback(() => {
    if (isActive) return;
    setIsActive(true);

    // Use EyeDropper API if available (Chrome 95+, Edge 95+)
    if (window.EyeDropper) {
      const dropper = new window.EyeDropper();
      dropper
        .open()
        .then((result) => {
          const color = result.sRGBHex;
          setPickedColor(color);
          setPickedColors((prev) => {
            const next = [color, ...prev.filter((c) => c !== color)];
            return next.slice(0, 12); // Keep last 12
          });
          setIsActive(false);
          onColorPicked?.(color);
        })
        .catch(() => {
          // User cancelled or API error
          setIsActive(false);
        });
    } else {
      // Fallback: use canvas-based pixel sampling from the iframe
      // Capture the iframe as an image via html2canvas approach
      // For now, show a message that EyeDropper API is not supported
      setIsActive(false);
      console.warn(
        '[EyedropperTool] EyeDropper API not available. Use Chrome/Edge 95+ for this feature.',
      );
    }
  }, [isActive, onColorPicked]);

  const copyColor = useCallback((color: string) => {
    navigator.clipboard.writeText(color).then(() => {
      setCopied(color);
      setTimeout(() => setCopied(null), 1500);
    });
  }, []);

  const hasEyeDropperApi = typeof window !== 'undefined' && 'EyeDropper' in window;

  return (
    <div className="space-y-2">
      {/* Eyedropper button */}
      <button
        onClick={startPicking}
        disabled={isActive || !hasEyeDropperApi}
        className={`flex items-center gap-2 w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
          isActive
            ? 'bg-purple-600 text-white animate-pulse'
            : hasEyeDropperApi
              ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600'
              : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
        }`}
        title={
          hasEyeDropperApi
            ? 'Pick a color from anywhere on screen'
            : 'EyeDropper API requires Chrome/Edge 95+'
        }
      >
        <Pipette className="w-4 h-4" />
        {isActive
          ? 'Picking color...'
          : hasEyeDropperApi
            ? 'Pick Color from Page'
            : 'Eyedropper (Chrome/Edge only)'}
      </button>

      {/* Current picked color */}
      {pickedColor && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 rounded border border-gray-700">
          <div
            className="w-8 h-8 rounded border border-gray-600 shrink-0"
            style={{ backgroundColor: pickedColor }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono text-gray-200">{pickedColor}</div>
            <div className="text-[10px] text-gray-500">Last picked</div>
          </div>
          <button
            onClick={() => copyColor(pickedColor)}
            className="text-gray-500 hover:text-gray-300 p-1"
            title="Copy color"
          >
            {copied === pickedColor ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}

      {/* Color history */}
      {pickedColors.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Recent Colors</div>
          <div className="flex flex-wrap gap-1">
            {pickedColors.map((color, i) => (
              <button
                key={`${color}-${i}`}
                onClick={() => {
                  setPickedColor(color);
                  onColorPicked?.(color);
                }}
                onDoubleClick={() => copyColor(color)}
                className="relative group"
                title={`${color} (double-click to copy)`}
              >
                <div
                  className="w-6 h-6 rounded border border-gray-600 hover:border-gray-400 transition-colors"
                  style={{ backgroundColor: color }}
                />
                {copied === color && (
                  <Check className="absolute inset-0 m-auto w-3 h-3 text-white drop-shadow-lg" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
