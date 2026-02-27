import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import type { AgentBreadcrumb } from '@voltron/shared';
import { ACTIVITY_COLORS } from './constants';

interface GPSTimelineProps {
  breadcrumbs: AgentBreadcrumb[];
  timelineIndex: number | null;
  onTimelineChange: (index: number | null) => void;
}

export const GPSTimeline = memo(function GPSTimeline({
  breadcrumbs, timelineIndex, onTimelineChange,
}: GPSTimelineProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = breadcrumbs.length;

  // Cleanup on unmount
  useEffect(() => () => {
    if (playRef.current) clearInterval(playRef.current);
  }, []);

  const handlePlay = useCallback(() => {
    if (total === 0) return;
    setPlaying(true);
    const start = timelineIndex ?? 0;
    let idx = start;
    playRef.current = setInterval(() => {
      idx++;
      if (idx >= total) {
        if (playRef.current) clearInterval(playRef.current);
        setPlaying(false);
        onTimelineChange(null); // Return to live mode
        return;
      }
      onTimelineChange(idx);
    }, 500 / speed);
  }, [total, timelineIndex, speed, onTimelineChange]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    if (playRef.current) clearInterval(playRef.current);
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    onTimelineChange(val >= total ? null : val);
  }, [total, onTimelineChange]);

  const handleLive = useCallback(() => {
    handlePause();
    onTimelineChange(null);
  }, [handlePause, onTimelineChange]);

  if (total === 0) return null;

  const current = timelineIndex ?? total;
  const isLive = timelineIndex === null;
  const currentBC = timelineIndex !== null ? breadcrumbs[timelineIndex] : breadcrumbs[total - 1];
  const color = currentBC ? (ACTIVITY_COLORS[currentBC.activity] ?? '#6b7280') : '#6b7280';

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5"
      style={{
        background: 'rgba(17,24,39,0.6)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Controls */}
      <button
        onClick={() => onTimelineChange(0)}
        className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 transition-colors"
        title="Start"
      >
        <SkipBack size={14} />
      </button>

      {playing ? (
        <button onClick={handlePause} className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 transition-colors" title="Pause">
          <Pause size={14} />
        </button>
      ) : (
        <button onClick={handlePlay} className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 transition-colors" title="Play">
          <Play size={14} />
        </button>
      )}

      <button
        onClick={handleLive}
        className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 transition-colors"
        title="Skip to live"
      >
        <SkipForward size={14} />
      </button>

      {/* Speed */}
      <button
        onClick={() => setSpeed((s) => s === 1 ? 2 : s === 2 ? 4 : 1)}
        className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-slate-300 hover:bg-white/[0.08] transition-colors"
      >
        {speed}x
      </button>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={total}
        value={current}
        onChange={handleSliderChange}
        className="flex-1 h-1 appearance-none bg-slate-700 rounded cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${(current / total) * 100}%, #334155 ${(current / total) * 100}%, #334155 100%)`,
        }}
      />

      {/* Status */}
      <span className="text-[10px] font-mono text-slate-400 min-w-[60px] text-right">
        {isLive ? (
          <span className="text-green-400" style={{ textShadow: '0 0 8px rgba(34,197,94,0.5)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1 align-middle animate-pulse" />
            LIVE
          </span>
        ) : (
          `${current + 1}/${total}`
        )}
      </span>
    </div>
  );
});
