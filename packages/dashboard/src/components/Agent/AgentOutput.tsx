import { useRef, useEffect, useState } from 'react';
import { Terminal, Search, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { useAgentStore, type AgentOutputEntry } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';

const TYPE_COLORS: Record<string, string> = {
  text: 'text-gray-200',
  delta: 'text-gray-200',
  tool: 'text-blue-400',
  error: 'text-red-400',
  thinking: 'text-gray-500',
};

function ToolCard({ entry }: { entry: AgentOutputEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-0.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="font-mono">{entry.text}</span>
      </button>
      {expanded && entry.input && (
        <pre className="text-[9px] text-gray-600 ml-4 mt-0.5 max-h-24 overflow-auto font-mono">
          {JSON.stringify(entry.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

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
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-800">
        <Terminal className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{t('agent.output')}</span>
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

      {/* Output */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed space-y-px"
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
            return (
              <div key={i} className={TYPE_COLORS[entry.type] ?? 'text-gray-300'}>
                {entry.type === 'error' && <span className="text-red-500 font-bold mr-1">ERR</span>}
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
