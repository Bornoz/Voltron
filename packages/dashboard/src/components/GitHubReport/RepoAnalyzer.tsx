import { useState } from 'react';
import { GitBranch, Loader2, AlertTriangle, Bot, Search } from 'lucide-react';
import * as api from '../../lib/api';
import { DependencyGraph } from './DependencyGraph';
import { BreakingChanges } from './BreakingChanges';
import { ComplianceCheck } from './ComplianceCheck';
import { useTranslation } from '../../i18n';

interface AnalysisResult {
  dependencies?: any;
  breaking?: any;
  compliance?: any;
}

interface RepoAnalyzerProps {
  projectId: string;
}

export function RepoAnalyzer({ projectId }: RepoAnalyzerProps) {
  const { t } = useTranslation();
  const [repoUrl, setRepoUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'deps' | 'breaking' | 'compliance'>('deps');

  // Search & Adapt state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFramework, setSearchFramework] = useState('');
  const [searchTargetDir, setSearchTargetDir] = useState('./src');
  const [searchModel, setSearchModel] = useState('claude-haiku-4-5-20251001');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ sessionId: string; message: string } | null>(null);

  const analyze = async () => {
    if (!repoUrl.trim()) return;
    setAnalyzing(true);
    setError(null);

    try {
      const data = await api.analyzeRepo(projectId, repoUrl);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notifications.unknownError'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSearchAndAdapt = async () => {
    if (!searchQuery.trim() || !searchTargetDir.trim()) return;
    setIsSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      const data = await api.githubSearchAndAdapt(projectId, {
        query: searchQuery,
        framework: searchFramework || undefined,
        targetDir: searchTargetDir,
        model: searchModel,
      });
      setSearchResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notifications.unknownError'));
    } finally {
      setIsSearching(false);
    }
  };

  const FRAMEWORK_OPTIONS = [
    { value: '', label: t('github.anyFramework') },
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'svelte', label: 'Svelte' },
    { value: 'next', label: 'Next.js' },
    { value: 'angular', label: 'Angular' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <GitBranch className="w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-600"
          onKeyDown={(e) => e.key === 'Enter' && analyze()}
        />
        <button
          onClick={analyze}
          disabled={analyzing || !repoUrl.trim()}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors flex items-center gap-1"
        >
          {analyzing && <Loader2 className="w-3 h-3 animate-spin" />}
          {analyzing ? t('github.analyzing') : t('github.analyze')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border-b border-red-800">
          <AlertTriangle className="w-3 h-3 text-red-400" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Search & Adapt with Claude */}
      <div className="border-b border-gray-800">
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/10 border-b border-purple-900/20">
          <Bot className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-medium text-purple-300">{t('github.searchAndAdapt')}</span>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('github.searchPlaceholder')}
              className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-600"
              onKeyDown={(e) => e.key === 'Enter' && handleSearchAndAdapt()}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={searchFramework}
              onChange={(e) => setSearchFramework(e.target.value)}
              className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-purple-600"
            >
              {FRAMEWORK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={searchTargetDir}
              onChange={(e) => setSearchTargetDir(e.target.value)}
              placeholder={t('github.targetDir')}
              className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={searchModel}
              onChange={(e) => setSearchModel(e.target.value)}
              className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-purple-600"
            >
              <option value="claude-haiku-4-5-20251001">Haiku</option>
              <option value="claude-sonnet-4-6">Sonnet</option>
            </select>
            <button
              onClick={handleSearchAndAdapt}
              disabled={isSearching || !searchQuery.trim()}
              className="flex-1 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors flex items-center justify-center gap-1"
            >
              {isSearching && <Loader2 className="w-3 h-3 animate-spin" />}
              {isSearching ? t('github.searching') : t('github.searchAndAdaptBtn')}
            </button>
          </div>
          {searchResult && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-green-900/20 border border-green-800/30 rounded">
              <Bot className="w-3 h-3 text-green-400 shrink-0" />
              <span className="text-[10px] text-green-400">{searchResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {(['deps', 'breaking', 'compliance'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs transition-colors ${
                  activeTab === tab
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'deps' ? t('github.dependencies') : tab === 'breaking' ? t('github.breakingChanges') : t('github.compliance')}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-3">
            {activeTab === 'deps' && <DependencyGraph data={result.dependencies} />}
            {activeTab === 'breaking' && <BreakingChanges data={result.breaking} />}
            {activeTab === 'compliance' && <ComplianceCheck data={result.compliance} />}
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !analyzing && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <GitBranch className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-600">{t('github.enterRepoUrl')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
