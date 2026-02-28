import { Check, X } from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { ProjectProfileResponse } from '../../lib/api';

const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  JavaScript: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Python: 'bg-green-500/20 text-green-300 border-green-500/30',
  Go: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Rust: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Java: 'bg-red-500/20 text-red-300 border-red-500/30',
};

interface ProjectProfileProps {
  profile: ProjectProfileResponse;
}

export function ProjectProfile({ profile }: ProjectProfileProps) {
  const { t } = useTranslation();

  const setupItems = [
    { key: 'CLAUDE.md', has: profile.hasClaude },
    { key: 'Skills', has: profile.hasClaudeSkills },
    { key: 'MCP', has: profile.hasMcp },
    { key: 'Hooks', has: profile.hasHooks },
    { key: 'Tests', has: profile.hasTests },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {t('smartSetup.profileTitle')}
      </h3>

      {/* Languages */}
      <div className="flex flex-wrap gap-1.5">
        {profile.languages.map((lang) => (
          <span
            key={lang}
            className={`px-2 py-0.5 text-[11px] rounded-md border ${LANG_COLORS[lang] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}
          >
            {lang}
          </span>
        ))}
        {profile.frameworks.map((fw) => (
          <span
            key={fw}
            className="px-2 py-0.5 text-[11px] rounded-md border bg-purple-500/20 text-purple-300 border-purple-500/30"
          >
            {fw}
          </span>
        ))}
        {profile.monorepo && (
          <span className="px-2 py-0.5 text-[11px] rounded-md border bg-pink-500/20 text-pink-300 border-pink-500/30">
            Monorepo
          </span>
        )}
        <span className="px-2 py-0.5 text-[11px] rounded-md border bg-gray-500/20 text-gray-300 border-gray-500/30">
          {profile.packageManager}
        </span>
      </div>

      {/* Patterns */}
      {profile.detectedPatterns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.detectedPatterns.map((p) => (
            <span key={p} className="px-1.5 py-0.5 text-[10px] rounded" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Existing setup checklist */}
      <div className="flex flex-wrap gap-2">
        {setupItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: item.has ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          >
            {item.has ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 opacity-40" />}
            {item.key}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
        <span>{profile.fileCount.toLocaleString()} {t('agent.history.filesCount')}</span>
        <span>{profile.linesOfCode.toLocaleString()} LOC</span>
        {profile.testFramework && <span>{profile.testFramework}</span>}
      </div>
    </div>
  );
}
