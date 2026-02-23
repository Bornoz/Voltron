import { Move, Copy, Trash2, GripVertical } from 'lucide-react';
import { useSimulatorStore } from '../stores/simulatorStore';
import type { SandboxBridge } from '../sandbox/SandboxBridge';

interface ElementToolbarProps {
  bridge: SandboxBridge;
}

export function ElementToolbar({ bridge }: ElementToolbarProps) {
  const selectedElement = useSimulatorStore((s) => s.selectedElement);
  const dragMode = useSimulatorStore((s) => s.dragMode);
  const setDragMode = useSimulatorStore((s) => s.setDragMode);

  if (!selectedElement) return null;

  const handleMove = () => {
    const newDragMode = !dragMode;
    setDragMode(newDragMode);
    bridge.enableDragMode(newDragMode);
    if (newDragMode) {
      bridge.showElementToolbar(selectedElement.selector);
    }
  };

  const handleDuplicate = () => {
    bridge.duplicateElement(selectedElement.selector);
  };

  const handleDelete = () => {
    bridge.deleteElement(selectedElement.selector);
    useSimulatorStore.getState().clearSelection();
  };

  return (
    <div className="flex items-center gap-1 px-4 py-1 bg-gray-900/70 border-b border-gray-800">
      <GripVertical className="w-3 h-3 text-gray-600 mr-1" />
      <span className="text-[10px] text-gray-500 mr-2 font-mono truncate max-w-[200px]">
        {selectedElement.tagName}
        {selectedElement.id ? `#${selectedElement.id}` : ''}
      </span>

      <div className="flex items-center gap-0.5 ml-auto">
        <button
          onClick={handleMove}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
            dragMode
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
          }`}
          title="Move element (drag)"
        >
          <Move className="w-3 h-3" />
          Move
        </button>

        <button
          onClick={handleDuplicate}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
          title="Duplicate element"
        >
          <Copy className="w-3 h-3" />
          Duplicate
        </button>

        <button
          onClick={handleDelete}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
          title="Delete element"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    </div>
  );
}
