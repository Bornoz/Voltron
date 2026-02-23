import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Check, Clock, Hash, ChevronRight, Loader2, ArrowLeftRight } from 'lucide-react';
import * as api from '../../lib/api';
import { useTranslation } from '../../i18n';
import { formatRelativeTime } from '../../lib/formatters';

interface PromptManagerProps {
  projectId: string;
}

export function PromptManager({ projectId }: PromptManagerProps) {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<api.PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<{ from: api.PromptVersion; to: api.PromptVersion; changes: string[] } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPromptVersions(projectId);
      setVersions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim() || !content.trim()) return;
    setCreating(true);
    try {
      await api.createPromptVersion(projectId, name.trim(), content.trim());
      setName('');
      setContent('');
      setShowForm(false);
      load();
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (versionId: string) => {
    try {
      await api.activatePromptVersion(projectId, versionId);
      load();
    } catch {
      // silent
    }
  };

  const handleDiff = async (fromId: string, toId: string) => {
    setDiffLoading(true);
    try {
      const result = await api.getPromptDiff(projectId, fromId, toId);
      setDiffResult(result);
    } catch {
      // silent
    } finally {
      setDiffLoading(false);
    }
  };

  const selected = versions.find((v) => v.id === selectedId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/30">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-gray-300">{t('prompts.title')}</span>
          <span className="text-[10px] text-gray-600">({versions.length})</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-indigo-400 transition-colors"
        >
          <Plus className="w-3 h-3" />
          {t('prompts.newVersion')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Create form */}
        {showForm && (
          <div className="p-3 border-b border-gray-800 bg-gray-900/20 space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('prompts.namePlaceholder')}
              className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-indigo-600"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('prompts.contentPlaceholder')}
              rows={6}
              className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-indigo-600 font-mono resize-y"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim() || !content.trim()}
                className="flex items-center gap-1 px-3 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded disabled:opacity-50 transition-colors"
              >
                {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {t('prompts.create')}
              </button>
              <button
                onClick={() => { setShowForm(false); setName(''); setContent(''); }}
                className="px-3 py-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t('prompts.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Version list */}
        <div className="divide-y divide-gray-800/50">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`px-3 py-2 cursor-pointer transition-colors ${
                selectedId === v.id ? 'bg-gray-800/50' : 'hover:bg-gray-800/30'
              }`}
              onClick={() => setSelectedId(selectedId === v.id ? null : v.id)}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-[10px] font-mono text-gray-600">v{v.version}</span>
                  <span className="text-xs text-gray-300 truncate">{v.name}</span>
                  {v.isActive && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] bg-green-900/40 text-green-400 border border-green-800 rounded">
                      <Check className="w-2.5 h-2.5" />
                      {t('prompts.active')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                    <Hash className="w-3 h-3" />
                    {v.hash.slice(0, 8)}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(v.createdAt)}
                  </span>
                  <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${selectedId === v.id ? 'rotate-90' : ''}`} />
                </div>
              </div>

              {/* Expanded detail */}
              {selectedId === v.id && (
                <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <pre className="text-[10px] text-gray-400 bg-gray-900 rounded p-2 overflow-x-auto max-h-48 font-mono whitespace-pre-wrap">
                    {v.content}
                  </pre>
                  <div className="flex items-center gap-2">
                    {!v.isActive && (
                      <button
                        onClick={() => handleActivate(v.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-green-900/30 text-green-400 border border-green-800 rounded hover:bg-green-900/50 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        {t('prompts.activate')}
                      </button>
                    )}
                    {v.parentId && (
                      <button
                        onClick={() => handleDiff(v.parentId!, v.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-indigo-400 transition-colors"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        {t('prompts.compareParent')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {versions.length === 0 && !showForm && (
          <div className="text-center py-8 text-xs text-gray-600">{t('prompts.noVersions')}</div>
        )}

        {/* Diff overlay */}
        {diffLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
          </div>
        )}
        {diffResult && !diffLoading && (
          <div className="mx-3 mb-3 p-2 bg-gray-900 border border-gray-800 rounded space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">
                v{diffResult.from.version} → v{diffResult.to.version}
              </span>
              <button
                onClick={() => setDiffResult(null)}
                className="text-[10px] text-gray-600 hover:text-gray-400"
              >
                ✕
              </button>
            </div>
            {diffResult.changes.length > 0 ? (
              <pre className="text-[10px] font-mono text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {diffResult.changes.join('\n')}
              </pre>
            ) : (
              <div className="text-[10px] text-gray-600">{t('prompts.noChanges')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
