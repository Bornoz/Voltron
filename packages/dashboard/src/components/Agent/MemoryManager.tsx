import { useEffect, useState, useRef } from 'react';
import { Brain, Plus, Pin, PinOff, Pencil, Trash2, X, Check } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n';

interface MemoryManagerProps {
  projectId: string;
}

const CATEGORIES = [
  { id: 'architecture', color: 'text-blue-400' },
  { id: 'conventions', color: 'text-purple-400' },
  { id: 'bugs', color: 'text-red-400' },
  { id: 'patterns', color: 'text-amber-400' },
  { id: 'general', color: 'text-gray-400' },
] as const;

export function MemoryManager({ projectId }: MemoryManagerProps) {
  const { t } = useTranslation();
  const {
    memories, memoriesLoading, loadMemories,
    addMemory, updateMemory, deleteMemory, togglePin,
  } = useSettingsStore();

  const [filter, setFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      loadMemories(projectId);
    }
  }, [projectId, loadMemories]);

  const filtered = filter === 'all' ? memories : memories.filter((m) => m.category === filter);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    await addMemory(projectId, { category: newCategory, title: newTitle.trim(), content: newContent.trim() });
    setNewTitle('');
    setNewContent('');
    setNewCategory('general');
    setShowAdd(false);
  };

  const handleEdit = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    await updateMemory(projectId, id, { title: editTitle.trim(), content: editContent.trim() });
    setEditingId(null);
  };

  const startEdit = (m: typeof memories[0]) => {
    setEditingId(m.id);
    setEditTitle(m.title);
    setEditContent(m.content);
  };

  const getCategoryColor = (cat: string) => CATEGORIES.find((c) => c.id === cat)?.color ?? 'text-gray-400';

  if (memoriesLoading) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-500">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900/95">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <Brain className="w-3 h-3" />
          <span>{t('agent.memory.title')}</span>
          <span className="text-gray-600">({memories.length})</span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-400 hover:bg-blue-900/60 transition-colors"
        >
          <Plus className="w-3 h-3" />
          {t('agent.memory.add')}
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-gray-800/50 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
            filter === 'all' ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
              filter === c.id ? 'bg-gray-700 text-gray-200' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t(`agent.memory.category${c.id.charAt(0).toUpperCase() + c.id.slice(1)}` as never)}
          </button>
        ))}
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && !showAdd && (
          <div className="flex items-center justify-center h-full text-xs text-gray-600">
            {t('agent.memory.noMemories')}
          </div>
        )}

        {filtered.map((m) => (
          <div
            key={m.id}
            className={`px-3 py-2 border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors ${
              m.pinned ? 'bg-gray-800/20' : ''
            }`}
          >
            {editingId === m.id ? (
              /* Edit mode */
              <div className="space-y-1.5">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
                  rows={3}
                />
                <div className="flex gap-1 justify-end">
                  <button onClick={() => setEditingId(null)} className="p-1 hover:bg-gray-700 rounded">
                    <X className="w-3 h-3 text-gray-500" />
                  </button>
                  <button onClick={() => handleEdit(m.id)} className="p-1 hover:bg-gray-700 rounded">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {m.pinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                    <span className={`text-[10px] font-medium ${getCategoryColor(m.category)}`}>
                      [{m.category}]
                    </span>
                    <span className="text-xs text-gray-200 truncate font-medium">{m.title}</span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => startEdit(m)}
                      className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                      title={t('agent.memory.edit')}
                    >
                      <Pencil className="w-3 h-3 text-gray-500" />
                    </button>
                    <button
                      onClick={() => togglePin(projectId, m.id)}
                      className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                      title={m.pinned ? t('agent.memory.unpin') : t('agent.memory.pin')}
                    >
                      {m.pinned
                        ? <PinOff className="w-3 h-3 text-amber-400" />
                        : <Pin className="w-3 h-3 text-gray-500" />}
                    </button>
                    <button
                      onClick={() => deleteMemory(projectId, m.id)}
                      className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                      title={t('agent.memory.delete')}
                    >
                      <Trash2 className="w-3 h-3 text-gray-500 hover:text-red-400" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {m.content}
                </p>
              </>
            )}
          </div>
        ))}

        {/* Add form */}
        {showAdd && (
          <div className="px-3 py-2 border-b border-gray-800/30 space-y-1.5 bg-gray-800/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-medium">{t('agent.memory.addNew')}</span>
              <button onClick={() => setShowAdd(false)} className="p-0.5 hover:bg-gray-700 rounded">
                <X className="w-3 h-3 text-gray-500" />
              </button>
            </div>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(`agent.memory.category${c.id.charAt(0).toUpperCase() + c.id.slice(1)}` as never)}
                </option>
              ))}
            </select>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('agent.memory.titlePlaceholder')}
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={t('agent.memory.contentPlaceholder')}
              rows={3}
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex justify-end gap-1">
              <button
                onClick={() => setShowAdd(false)}
                className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t('agent.memory.cancelMemory')}
              </button>
              <button
                onClick={handleAdd}
                disabled={!newTitle.trim() || !newContent.trim()}
                className="px-2 py-1 text-[10px] font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
              >
                {t('agent.memory.saveMemory')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-gray-800 text-[10px] text-gray-600">
        {t('agent.memory.pinnedWillBeIncluded')}
      </div>
    </div>
  );
}
