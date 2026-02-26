import { memo } from 'react';
import {
  Undo2, Redo2, MousePointer2, Move, Maximize2, Layers, GitCompare, Send,
} from 'lucide-react';
import { ViewportSelector, type ViewportPreset } from './ViewportSelector';
import { useTranslation } from '../../../i18n';

export type EditorTool = 'select' | 'move' | 'resize';

interface EditorToolbarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  viewport: ViewportPreset;
  onViewportChange: (vp: ViewportPreset) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleTree: () => void;
  onToggleDiff: () => void;
  onSave: () => void;
  editCount: number;
  treeVisible: boolean;
  diffVisible: boolean;
}

export const EditorToolbar = memo(function EditorToolbar({
  activeTool, onToolChange, viewport, onViewportChange,
  canUndo, canRedo, onUndo, onRedo,
  onToggleTree, onToggleDiff, onSave,
  editCount, treeVisible, diffVisible,
}: EditorToolbarProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 shrink-0"
      style={{
        background: 'rgba(15,23,42,0.9)',
        borderBottom: '1px solid rgba(71,85,105,0.3)',
      }}
    >
      {/* Undo/Redo */}
      <ToolBtn
        icon={<Undo2 size={13} />}
        disabled={!canUndo}
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
      />
      <ToolBtn
        icon={<Redo2 size={13} />}
        disabled={!canRedo}
        onClick={onRedo}
        title="Redo (Ctrl+Y)"
      />

      <div className="w-px h-4 bg-slate-700/50 mx-1" />

      {/* Tool modes */}
      <ToolBtn
        icon={<MousePointer2 size={13} />}
        active={activeTool === 'select'}
        onClick={() => onToolChange('select')}
        title={t('agent.toolSelect')}
      />
      <ToolBtn
        icon={<Move size={13} />}
        active={activeTool === 'move'}
        onClick={() => onToolChange('move')}
        title={t('agent.toolMove')}
      />
      <ToolBtn
        icon={<Maximize2 size={13} />}
        active={activeTool === 'resize'}
        onClick={() => onToolChange('resize')}
        title={t('agent.toolResize')}
      />

      <div className="w-px h-4 bg-slate-700/50 mx-1" />

      {/* Viewport presets */}
      <ViewportSelector current={viewport} onChange={onViewportChange} />

      <div className="w-px h-4 bg-slate-700/50 mx-1" />

      {/* Panel toggles */}
      <ToolBtn
        icon={<Layers size={13} />}
        active={treeVisible}
        onClick={onToggleTree}
        title="DOM Tree"
      />
      <ToolBtn
        icon={<GitCompare size={13} />}
        active={diffVisible}
        onClick={onToggleDiff}
        title="Diff View"
      />

      <div className="flex-1" />

      {/* Save */}
      {editCount > 0 && (
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium rounded transition-colors"
        >
          <Send size={11} />
          {t('agent.saveAndSend')} ({editCount})
        </button>
      )}
    </div>
  );
});

function ToolBtn({ icon, active, disabled, onClick, title }: {
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        disabled
          ? 'text-slate-600 cursor-not-allowed'
          : active
            ? 'bg-blue-500/20 text-blue-400'
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
      }`}
    >
      {icon}
    </button>
  );
}
