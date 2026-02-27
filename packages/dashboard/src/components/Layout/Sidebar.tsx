import { useState } from 'react';
import { FolderTree, ShieldAlert, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { FileTree } from '../FileTree/FileTree';
import { FileHistory } from '../FileTree/FileHistory';
import { ZoneManager } from '../ZoneManager/ZoneManager';
import { PatternTester } from '../ZoneManager/PatternTester';
import { useFileTreeStore } from '../../stores/fileTreeStore';
import { useTranslation } from '../../i18n';

interface SidebarProps {
  projectId: string | null;
}

export function Sidebar({ projectId }: SidebarProps) {
  const [showZones, setShowZones] = useState(false);
  const [showPatternTester, setShowPatternTester] = useState(false);
  const selectedPath = useFileTreeStore((s) => s.selectedPath);
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full glass" style={{ borderRight: 'none' }}>
      {/* File Tree Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
          <FolderTree className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {t('sidebar.fileExplorer')}
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-[var(--color-accent)]/20 to-transparent" />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <FileTree />
        </div>
      </div>

      {/* File History - shown when file selected */}
      {selectedPath && projectId && (
        <div className="border-t border-white/[0.04]">
          <FileHistory
            projectId={projectId}
            filePath={selectedPath}
            onClose={() => useFileTreeStore.getState().setSelectedPath(null)}
          />
        </div>
      )}

      {/* Zone Manager Toggle */}
      <div className="border-t border-white/[0.04]">
        <button
          onClick={() => setShowZones(!showZones)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
        >
          <ShieldAlert className="w-4 h-4 text-yellow-500 drop-shadow-[0_0_4px_rgba(234,179,8,0.3)]" />
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-1">
            {t('sidebar.protectionZones')}
          </span>
          {showZones ? (
            <ChevronDown className="w-3 h-3 text-gray-500" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500" />
          )}
        </button>
        {showZones && (
          <div className="max-h-64 overflow-y-auto border-t border-white/[0.04]">
            <ZoneManager projectId={projectId} />
            <div className="border-t border-white/[0.04] px-3 py-1.5">
              <button
                onClick={() => setShowPatternTester(!showPatternTester)}
                className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
              >
                <FlaskConical className="w-3 h-3" />
                {t('sidebar.patternTester')}
              </button>
            </div>
            {showPatternTester && <PatternTester />}
          </div>
        )}
      </div>
    </div>
  );
}
