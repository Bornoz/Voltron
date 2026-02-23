import { useState, useMemo } from 'react';
import { CheckCircle, XCircle, FlaskConical } from 'lucide-react';
import { useFileTreeStore, type FileNode } from '../../stores/fileTreeStore';
import { useTranslation } from '../../i18n';

// Simple glob pattern matching (picomatch-like)
function matchGlob(pattern: string, path: string): boolean {
  // Escape regex special chars except * and ?
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  // If pattern doesn't start with /, match from any directory level
  if (!pattern.startsWith('/')) {
    regex = `(^|/)${regex}`;
  }

  return new RegExp(`${regex}$`).test(path);
}

/** Recursively collect all file paths from a FileNode tree */
function collectFilePaths(node: FileNode, paths: string[] = []): string[] {
  if (!node.isDirectory) {
    paths.push(node.path);
  }
  for (const child of node.children.values()) {
    collectFilePaths(child, paths);
  }
  return paths;
}

interface PatternTesterProps {
  initialPattern?: string;
}

export function PatternTester({ initialPattern }: PatternTesterProps) {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState(initialPattern ?? '');
  const [testPath, setTestPath] = useState('');
  const root = useFileTreeStore((s) => s.root);

  // Get all file paths from the tree
  const filePaths = useMemo(() => {
    return collectFilePaths(root).sort();
  }, [root]);

  // Match results
  const matchResults = useMemo(() => {
    if (!pattern.trim()) return { matched: [], unmatched: filePaths };

    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const path of filePaths) {
      if (matchGlob(pattern, path)) {
        matched.push(path);
      } else {
        unmatched.push(path);
      }
    }

    return { matched, unmatched };
  }, [pattern, filePaths]);

  // Single path test
  const singleTestResult = useMemo(() => {
    if (!pattern.trim() || !testPath.trim()) return null;
    return matchGlob(pattern, testPath);
  }, [pattern, testPath]);

  return (
    <div className="border border-gray-800 rounded-lg">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
        <FlaskConical className="w-3 h-3 text-purple-400" />
        <span className="text-[11px] font-medium text-gray-300">{t('patternTester.title')}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Pattern input */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">{t('patternTester.globPattern')}</label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="**/*.env, src/config/*, .git/**"
            className="w-full px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-600"
          />
        </div>

        {/* Single path test */}
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">{t('patternTester.testPath')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={testPath}
              onChange={(e) => setTestPath(e.target.value)}
              placeholder="/opt/voltron/.env"
              className="flex-1 px-2 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-600"
            />
            {singleTestResult !== null && (
              <div className="flex items-center">
                {singleTestResult ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results against file tree */}
        {pattern.trim() && filePaths.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              {t('patternTester.fileTreeMatches')} <span className="text-green-400">{matchResults.matched.length}</span>
              {' / '}
              <span className="text-gray-400">{filePaths.length}</span>
            </div>
            <div className="max-h-32 overflow-y-auto scrollbar-thin space-y-0.5">
              {matchResults.matched.slice(0, 50).map((path) => (
                <div key={path} className="flex items-center gap-1.5 text-[10px]">
                  <CheckCircle className="w-2.5 h-2.5 text-green-500 shrink-0" />
                  <span className="text-green-300 font-mono truncate">{path}</span>
                </div>
              ))}
              {matchResults.matched.length > 50 && (
                <div className="text-[10px] text-gray-600 pl-4">
                  +{matchResults.matched.length - 50} {t('patternTester.more')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pattern hints */}
        <div className="text-[10px] text-gray-600 space-y-0.5">
          <div><code className="text-gray-500">**</code> {t('patternTester.recursiveMatch')}</div>
          <div><code className="text-gray-500">*</code> {t('patternTester.singleLevelMatch')}</div>
          <div><code className="text-gray-500">?</code> {t('patternTester.singleCharacter')}</div>
        </div>
      </div>
    </div>
  );
}
