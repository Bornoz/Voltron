import { memo } from 'react';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

export type ViewportPreset = 'desktop' | 'tablet' | 'mobile';

interface ViewportSelectorProps {
  current: ViewportPreset;
  onChange: (preset: ViewportPreset) => void;
}

const PRESETS: Array<{ key: ViewportPreset; icon: React.ReactNode; label: string; width: string }> = [
  { key: 'desktop', icon: <Monitor size={13} />, label: 'Desktop', width: '100%' },
  { key: 'tablet', icon: <Tablet size={13} />, label: '768px', width: '768px' },
  { key: 'mobile', icon: <Smartphone size={13} />, label: '375px', width: '375px' },
];

export const ViewportSelector = memo(function ViewportSelector({ current, onChange }: ViewportSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 bg-slate-800/50 rounded-md p-0.5">
      {PRESETS.map((preset) => (
        <button
          key={preset.key}
          onClick={() => onChange(preset.key)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
            current === preset.key
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
          }`}
          title={preset.label}
        >
          {preset.icon}
        </button>
      ))}
    </div>
  );
});

export function getViewportWidth(preset: ViewportPreset): string {
  switch (preset) {
    case 'desktop': return '100%';
    case 'tablet': return '768px';
    case 'mobile': return '375px';
  }
}
