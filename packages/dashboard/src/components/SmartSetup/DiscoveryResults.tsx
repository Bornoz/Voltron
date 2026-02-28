import { useState } from 'react';
import { Star, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { DiscoveredRepoResponse } from '../../lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  skill: 'bg-blue-500/20 text-blue-300',
  hook: 'bg-yellow-500/20 text-yellow-300',
  'mcp-server': 'bg-green-500/20 text-green-300',
  'claude-md': 'bg-purple-500/20 text-purple-300',
  agent: 'bg-red-500/20 text-red-300',
  workflow: 'bg-cyan-500/20 text-cyan-300',
};

interface DiscoveryResultsProps {
  discoveries: DiscoveredRepoResponse[];
  onToggle: (repoId: string) => void;
}

export function DiscoveryResults({ discoveries, onToggle }: DiscoveryResultsProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (discoveries.length === 0) {
    return (
      <div className="text-center py-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {t('smartSetup.noResults')}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {t('smartSetup.resultsTitle')} ({discoveries.length})
      </h3>

      {discoveries.map((repo) => {
        const isExpanded = expandedId === repo.id;
        const scoreColor = repo.relevanceScore >= 70
          ? 'bg-green-500'
          : repo.relevanceScore >= 40
            ? 'bg-yellow-500'
            : 'bg-red-500';

        return (
          <div
            key={repo.id}
            className="rounded-lg border transition-colors"
            style={{ background: 'var(--color-bg-secondary)', borderColor: repo.selected ? 'var(--color-accent)' : 'var(--glass-border)' }}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={repo.selected}
                onChange={() => onToggle(repo.id)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 accent-blue-500 cursor-pointer"
              />

              {/* Repo info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {repo.repoName}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[9px] rounded ${CATEGORY_COLORS[repo.category] ?? 'bg-gray-500/20 text-gray-300'}`}>
                    {repo.category}
                  </span>
                  {repo.relevanceScore >= 80 && (
                    <span className="px-1.5 py-0.5 text-[9px] rounded bg-green-500/20 text-green-300 font-medium">
                      {t('smartSetup.recommended')}
                    </span>
                  )}
                </div>
                <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {repo.description}
                </p>
              </div>

              {/* Score bar */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-12 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreColor}`}
                    style={{ width: `${repo.relevanceScore}%` }}
                  />
                </div>
                <span className="text-[10px] w-7 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                  {repo.relevanceScore}%
                </span>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Star className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}K` : repo.stars}
                </span>
              </div>

              {/* Expand toggle */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : repo.id)}
                className="p-0.5 rounded hover:bg-gray-700 transition-colors"
              >
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                  : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                }
              </button>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-3 pb-2 space-y-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                {repo.relevanceReason && (
                  <p className="text-[11px] pt-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {repo.relevanceReason}
                  </p>
                )}
                {repo.installCommand && (
                  <div>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Install:</span>
                    <code className="block text-[10px] mt-0.5 px-2 py-1 rounded" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)' }}>
                      {repo.installCommand}
                    </code>
                  </div>
                )}
                {repo.configSnippet && (
                  <div>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Config:</span>
                    <code className="block text-[10px] mt-0.5 px-2 py-1 rounded whitespace-pre-wrap" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)' }}>
                      {repo.configSnippet}
                    </code>
                  </div>
                )}
                <a
                  href={repo.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="w-3 h-3" /> GitHub
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
