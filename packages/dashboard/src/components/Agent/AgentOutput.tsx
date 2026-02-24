import { useRef, useEffect, useState } from 'react';
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Brain,
  Eye,
  Pencil,
  Terminal as TerminalIcon,
  FileText,
  Wrench,
} from 'lucide-react';
import { useAgentStore, type AgentOutputEntry } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';

/* ───── Tool icon mapping ───── */
const TOOL_ICONS: Record<string, typeof Eye> = {
  Read: Eye,
  Write: Pencil,
  Edit: Pencil,
  Bash: TerminalIcon,
  Glob: FileText,
  Grep: Search,
};

function getToolIcon(entry: AgentOutputEntry) {
  if (entry.toolName && TOOL_ICONS[entry.toolName]) {
    return TOOL_ICONS[entry.toolName];
  }
  return Wrench;
}

function extractFilePath(entry: AgentOutputEntry): string | null {
  if (!entry.input) return null;
  const input = entry.input as Record<string, unknown>;
  return (input.file_path ?? input.filePath ?? input.path ?? input.command) as string | null;
}

/* ───── Card: Tool call ───── */
function ToolCard({ entry }: { entry: AgentOutputEntry }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(entry);
  const filePath = extractFilePath(entry);

  return (
    <div className="my-1 rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-gray-800/50 transition-colors"
      >
        <Icon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-[11px] text-blue-300 font-medium">
          {entry.toolName ?? 'Tool'}
        </span>
        {filePath && (
          <span className="text-[10px] text-gray-500 truncate flex-1 font-mono">
            {filePath}
          </span>
        )}
        <span className="text-[9px] text-gray-600 ml-auto shrink-0">
          {t('agent.clickToExpand')}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-600 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
        )}
      </button>
      {expanded && entry.input && (
        <div className="px-3 py-2 border-t border-gray-800 bg-gray-950/50">
          <pre className="text-[10px] text-gray-500 max-h-32 overflow-auto whitespace-pre-wrap break-all">
            {JSON.stringify(entry.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ───── Card: Thinking block ───── */
function ThinkingCard({ entry }: { entry: AgentOutputEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1 rounded-lg border border-purple-900/30 bg-purple-950/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left px-3 py-1.5 hover:bg-purple-900/20 transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span className="text-[10px] text-purple-400 font-medium">
          {entry.text.slice(0, 60)}{entry.text.length > 60 ? '...' : ''}
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-purple-600 ml-auto shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-purple-600 ml-auto shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-purple-900/30">
          <p className="text-[11px] text-purple-300/80 leading-relaxed whitespace-pre-wrap">
            {entry.text}
          </p>
        </div>
      )}
    </div>
  );
}

/* ───── Card: Error ───── */
function ErrorCard({ entry }: { entry: AgentOutputEntry }) {
  return (
    <div className="my-1 flex items-start gap-2 px-3 py-2 rounded-lg border border-red-900/40 bg-red-950/20">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-red-300 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
    </div>
  );
}

/* ───── Main component ───── */
export function AgentOutput() {
  const { t } = useTranslation();
  const output = useAgentStore((s) => s.output);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const filteredOutput = filter
    ? output.filter((e) => e.text.toLowerCase().includes(filter.toLowerCase()))
    : output;

  const handleExport = () => {
    const text = output.map((e) => `[${e.type}] ${e.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-output-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 bg-gray-900/30">
        <FileText className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{t('agent.output')}</span>
        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="w-3 h-3 text-gray-600 absolute left-1.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('agent.search')}
            className="pl-5 pr-2 py-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-300 w-32 focus:outline-none focus:border-blue-600"
          />
        </div>

        <button
          onClick={handleExport}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          title={t('agent.export')}
        >
          <Download className="w-3 h-3 text-gray-500" />
        </button>
      </div>

      {/* Output area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5"
      >
        {filteredOutput.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-600">
            {t('agent.noOutput')}
          </div>
        ) : (
          filteredOutput.map((entry, i) => {
            if (entry.type === 'tool') {
              return <ToolCard key={i} entry={entry} />;
            }
            if (entry.type === 'thinking') {
              return <ThinkingCard key={i} entry={entry} />;
            }
            if (entry.type === 'error') {
              return <ErrorCard key={i} entry={entry} />;
            }
            // Normal text / delta
            return (
              <div key={i} className="px-1 py-0.5 text-[11px] text-gray-300 leading-relaxed">
                {entry.text}
              </div>
            );
          })
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && output.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-2 right-2 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded shadow-lg"
        >
          {t('agent.scrollToBottom')}
        </button>
      )}
    </div>
  );
}
