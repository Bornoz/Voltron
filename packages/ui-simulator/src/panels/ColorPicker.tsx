import { useState, useCallback, useEffect, useRef } from 'react';
import { colord, type Colord } from 'colord';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onClose?: () => void;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const [hsl, setHsl] = useState<HSL>(() => {
    try {
      const c = colord(value);
      const parsed = c.toHsl();
      return { h: parsed.h, s: parsed.s, l: parsed.l };
    } catch {
      return { h: 0, s: 0, l: 50 };
    }
  });

  const [hexInput, setHexInput] = useState(() => {
    try {
      return colord(value).toHex();
    } catch {
      return '#000000';
    }
  });

  const [rgbInputs, setRgbInputs] = useState(() => {
    try {
      const c = colord(value);
      const rgb = c.toRgb();
      return { r: rgb.r, g: rgb.g, b: rgb.b };
    } catch {
      return { r: 0, g: 0, b: 0 };
    }
  });

  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync all formats when HSL changes
  useEffect(() => {
    const c = colord({ h: hsl.h, s: hsl.s, l: hsl.l });
    const hex = c.toHex();
    const rgb = c.toRgb();

    setHexInput(hex);
    setRgbInputs({ r: rgb.r, g: rgb.g, b: rgb.b });
    onChange(hex);
  }, [hsl, onChange]);

  // Click outside to close
  useEffect(() => {
    if (!onClose) return;

    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleHslChange = useCallback((channel: 'h' | 's' | 'l', val: number) => {
    setHsl((prev) => ({ ...prev, [channel]: val }));
  }, []);

  const handleHexChange = useCallback((hex: string) => {
    setHexInput(hex);
    try {
      const c = colord(hex);
      if (c.isValid()) {
        const parsed = c.toHsl();
        setHsl({ h: parsed.h, s: parsed.s, l: parsed.l });
      }
    } catch {
      // Invalid hex, ignore
    }
  }, []);

  const handleRgbChange = useCallback((channel: 'r' | 'g' | 'b', val: number) => {
    const clamped = Math.max(0, Math.min(255, val));
    const newRgb = { ...rgbInputs, [channel]: clamped };
    setRgbInputs(newRgb);

    try {
      const c = colord(newRgb);
      const parsed = c.toHsl();
      setHsl({ h: parsed.h, s: parsed.s, l: parsed.l });
    } catch {
      // Invalid, ignore
    }
  }, [rgbInputs]);

  const previewColor = colord({ h: hsl.h, s: hsl.s, l: hsl.l }).toHex();

  // Generate hue gradient background
  const hueGradient = 'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))';

  // Generate saturation gradient
  const satGradient = `linear-gradient(to right, hsl(${hsl.h},0%,${hsl.l}%), hsl(${hsl.h},100%,${hsl.l}%))`;

  // Generate lightness gradient
  const lightGradient = `linear-gradient(to right, hsl(${hsl.h},${hsl.s}%,0%), hsl(${hsl.h},${hsl.s}%,50%), hsl(${hsl.h},${hsl.s}%,100%))`;

  return (
    <div
      ref={pickerRef}
      className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl w-64"
    >
      {/* Preview swatch */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded border border-gray-600"
          style={{ backgroundColor: previewColor }}
        />
        <span className="text-sm font-mono text-gray-300">{previewColor}</span>
      </div>

      {/* HSL Sliders */}
      <div className="space-y-2 mb-3">
        {/* Hue */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">H</label>
            <span className="text-xs font-mono text-gray-400">{Math.round(hsl.h)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={hsl.h}
            onChange={(e) => handleHslChange('h', Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ background: hueGradient }}
          />
        </div>

        {/* Saturation */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">S</label>
            <span className="text-xs font-mono text-gray-400">{Math.round(hsl.s)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={hsl.s}
            onChange={(e) => handleHslChange('s', Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ background: satGradient }}
          />
        </div>

        {/* Lightness */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">L</label>
            <span className="text-xs font-mono text-gray-400">{Math.round(hsl.l)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={hsl.l}
            onChange={(e) => handleHslChange('l', Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ background: lightGradient }}
          />
        </div>
      </div>

      {/* HEX input */}
      <div className="mb-2">
        <label className="text-xs text-gray-400 mb-1 block">HEX</label>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-blue-500"
          maxLength={9}
        />
      </div>

      {/* RGB inputs */}
      <div className="flex gap-2">
        {(['r', 'g', 'b'] as const).map((channel) => (
          <div key={channel} className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block uppercase">{channel}</label>
            <input
              type="number"
              min={0}
              max={255}
              value={rgbInputs[channel]}
              onChange={(e) => handleRgbChange(channel, Number(e.target.value))}
              className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm font-mono text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
