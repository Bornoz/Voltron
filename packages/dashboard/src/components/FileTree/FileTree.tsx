import { FolderTree, Flame } from 'lucide-react';
import { clsx } from 'clsx';
import { useFileTreeStore } from '../../stores/fileTreeStore';
import { useEventStore } from '../../stores/eventStore';
import { FileNodeComponent } from './FileNode';
import { EmptyState } from '../common/EmptyState';
import { useTranslation } from '../../i18n';

export function FileTree() {
  const { t } = useTranslation();
  const root = useFileTreeStore((s) => s.root);
  const setSelectedPath = useFileTreeStore((s) => s.setSelectedPath);
  const heatMapEnabled = useFileTreeStore((s) => s.heatMapEnabled);
  const toggleHeatMap = useFileTreeStore((s) => s.toggleHeatMap);
  const setFilter = useEventStore((s) => s.setFilter);

  const children = [...root.children.values()].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const handleSelectFile = (path: string) => {
    setSelectedPath(path);
    // Also filter the event feed to show this file's events
    setFilter({ fileSearch: path });
  };

  if (children.length === 0) {
    return (
      <EmptyState
        icon={<FolderTree className="w-8 h-8" />}
        title={t('common.noFiles')}
        description={t('common.filesWillAppear')}
      />
    );
  }

  return (
    <div className="text-xs">
      {/* Heat map toggle */}
      <div className="flex items-center justify-end px-2 py-1 border-b border-gray-800/50">
        <button
          onClick={toggleHeatMap}
          className={clsx(
            'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors',
            heatMapEnabled
              ? 'bg-orange-900/30 text-orange-400 border border-orange-800/50'
              : 'text-gray-500 hover:text-gray-300',
          )}
          title={t('fileTree.heatMap')}
        >
          <Flame className="w-3 h-3" />
          {t('fileTree.heatMap')}
        </button>
      </div>

      {children.map((node) => (
        <FileNodeComponent
          key={node.path}
          node={node}
          depth={0}
          onSelectFile={handleSelectFile}
        />
      ))}
    </div>
  );
}
