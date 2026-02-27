import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { History, FileText, Search, Trash2, X, Clock, Sparkles, Copy, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptHistoryItem {
  id: string;
  prompt: string;
  timestamp: number;
  model?: string;
}

interface PromptTemplate {
  id: string;
  label: string;
  prompt: string;
  icon: 'sparkles' | 'bug' | 'layout' | 'zap' | 'test' | 'refactor';
}

interface PromptHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'voltron_prompt_history';
const MAX_ITEMS = 50;

const TEMPLATES: PromptTemplate[] = [
  {
    id: 'tpl-landing',
    label: 'Build a landing page',
    prompt: 'Build a landing page',
    icon: 'layout',
  },
  {
    id: 'tpl-fix-bugs',
    label: 'Fix bugs in current code',
    prompt: 'Fix bugs in current code',
    icon: 'bug',
  },
  {
    id: 'tpl-responsive',
    label: 'Add responsive design',
    prompt: 'Add responsive design',
    icon: 'layout',
  },
  {
    id: 'tpl-perf',
    label: 'Optimize performance',
    prompt: 'Optimize performance',
    icon: 'zap',
  },
  {
    id: 'tpl-tests',
    label: 'Add unit tests',
    prompt: 'Add unit tests',
    icon: 'test',
  },
  {
    id: 'tpl-refactor',
    label: 'Refactor component',
    prompt: 'Refactor component',
    icon: 'refactor',
  },
];

type Tab = 'history' | 'templates';

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

function loadHistory(): PromptHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate shape loosely - filter out malformed entries
    return parsed.filter(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as PromptHistoryItem).id === 'string' &&
        typeof (item as PromptHistoryItem).prompt === 'string' &&
        typeof (item as PromptHistoryItem).timestamp === 'number',
    ) as PromptHistoryItem[];
  } catch {
    return [];
  }
}

function saveHistory(items: PromptHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // Storage quota exceeded or unavailable - silently fail
  }
}

function deleteHistoryItem(id: string): PromptHistoryItem[] {
  const items = loadHistory().filter((item) => item.id !== id);
  saveHistory(items);
  return items;
}

// ---------------------------------------------------------------------------
// Utility: relative time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatModelShort(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Static: add to history (callable from outside the component)
// ---------------------------------------------------------------------------

/**
 * Adds a prompt to the history store. This is a standalone function so it can
 * be called from SpawnDialog or any other component without mounting
 * PromptHistory first.
 */
export function addPromptToHistory(prompt: string, model?: string): void {
  const trimmed = prompt.trim();
  if (!trimmed) return;

  const items = loadHistory();

  // Deduplicate: if the exact same prompt already exists, move it to top
  const filtered = items.filter((item) => item.prompt !== trimmed);

  const newItem: PromptHistoryItem = {
    id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: trimmed,
    timestamp: Date.now(),
    model,
  };

  const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
  saveHistory(updated);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptHistory({ isOpen, onClose, onSelect }: PromptHistoryProps) {
  const [tab, setTab] = useState<Tab>('history');
  const [history, setHistory] = useState<PromptHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load history when opened
  useEffect(() => {
    if (isOpen) {
      setHistory(loadHistory());
      setSearch('');
      // Focus search input after mount
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Keyboard: Escape to close, focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Filtered history
  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase().trim();
    return history.filter(
      (item) =>
        item.prompt.toLowerCase().includes(q) ||
        (item.model && item.model.toLowerCase().includes(q)),
    );
  }, [history, search]);

  // Handlers
  const handleSelect = useCallback(
    (prompt: string) => {
      onSelect(prompt);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteHistoryItem(id);
    setHistory(updated);
  }, []);

  const handleCopy = useCallback((e: React.MouseEvent, item: PromptHistoryItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.prompt).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    saveHistory([]);
    setHistory([]);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Prompt History"
    >
      <div
        ref={dialogRef}
        className="w-[520px] max-h-[80vh] bg-gray-900/98 border border-gray-700/60 rounded-xl shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-gray-200">Prompt History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-800/60 flex-shrink-0" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'history'}
            onClick={() => setTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === 'history'
                ? 'text-blue-400 border-blue-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            History
            {history.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-800 text-gray-500 rounded-full">
                {history.length}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'templates'}
            onClick={() => setTab('templates')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === 'templates'
                ? 'text-blue-400 border-blue-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Templates
          </button>
        </div>

        {/* ── Tab Panels ── */}
        {tab === 'history' && (
          <div role="tabpanel" className="flex flex-col flex-1 min-h-0">
            {/* Search bar */}
            <div className="px-4 py-2.5 border-b border-gray-800/40 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search history..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-300 placeholder:text-gray-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            {/* History list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                  <History className="w-8 h-8 mb-2 opacity-40" />
                  <span className="text-xs">
                    {search.trim()
                      ? 'No matching prompts found'
                      : 'No prompt history yet'}
                  </span>
                  <span className="text-[10px] mt-1 text-gray-700">
                    {search.trim()
                      ? 'Try a different search term'
                      : 'Prompts will appear here after you spawn an agent'}
                  </span>
                </div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.prompt)}
                    className="w-full text-left px-4 py-3 border-b border-gray-800/30 hover:bg-gray-800/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed flex-1">
                        {item.prompt}
                      </p>
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleCopy(e, item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCopy(e as unknown as React.MouseEvent, item);
                          }}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-500" />
                          )}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleDelete(e, item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent, item.id);
                          }}
                          className="p-1 hover:bg-red-900/40 rounded transition-colors"
                          title="Delete from history"
                        >
                          <Trash2 className="w-3 h-3 text-gray-500 hover:text-red-400" />
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-600">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.timestamp)}
                      </span>
                      {item.model && (
                        <>
                          <span className="text-gray-700">|</span>
                          <span className="text-gray-500">{formatModelShort(item.model)}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer: clear all */}
            {history.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-800/40 flex-shrink-0">
                <span className="text-[10px] text-gray-600">
                  {filtered.length} of {history.length} prompts
                </span>
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400/80 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'templates' && (
          <div role="tabpanel" className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelect(tpl.prompt)}
                  className="flex items-start gap-3 p-3 bg-gray-800/40 border border-gray-700/40 rounded-lg hover:bg-gray-800/70 hover:border-gray-600/60 transition-all text-left group"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <TemplateIcon type={tpl.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-300 group-hover:text-gray-200 transition-colors">
                      {tpl.label}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Click to use</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 px-1">
              <p className="text-[10px] text-gray-700 text-center">
                Select a template to use as your prompt. You can edit it before spawning.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TemplateIcon({ type }: { type: PromptTemplate['icon'] }) {
  const base = 'w-4 h-4';
  switch (type) {
    case 'sparkles':
      return <Sparkles className={`${base} text-yellow-400`} />;
    case 'bug':
      return <span className={`${base} inline-flex items-center justify-center text-red-400 text-sm`}>B</span>;
    case 'layout':
      return <FileText className={`${base} text-blue-400`} />;
    case 'zap':
      return <Sparkles className={`${base} text-orange-400`} />;
    case 'test':
      return <FileText className={`${base} text-emerald-400`} />;
    case 'refactor':
      return <FileText className={`${base} text-purple-400`} />;
    default:
      return <FileText className={`${base} text-gray-400`} />;
  }
}
