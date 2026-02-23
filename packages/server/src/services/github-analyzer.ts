import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  DependencyGraph, DependencyNode, DependencyEdge,
  BreakingChangeReport, ArchitectureComplianceResult,
} from '@voltron/shared';
import { GitHubCacheRepository } from '../db/repositories/github-cache.js';

interface GitHubAnalyzerConfig {
  token: string | null;
  maxRepoSize: number;
  analysisTimeout: number;
  cacheExpiry: number;
}

const DEFAULT_CONFIG: GitHubAnalyzerConfig = {
  token: null,
  maxRepoSize: 500 * 1024 * 1024, // 500MB
  analysisTimeout: 120_000,
  cacheExpiry: 86_400_000, // 24h
};

export class GitHubAnalyzer {
  private config: GitHubAnalyzerConfig;
  private cache = new GitHubCacheRepository();

  constructor(config?: Partial<GitHubAnalyzerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async analyzeRepo(projectId: string, repoUrl: string): Promise<{
    dependencies: DependencyGraph;
    breakingChanges: BreakingChangeReport[];
    compliance: ArchitectureComplianceResult[];
  }> {
    // Check cache
    const cachedDeps = this.cache.get(repoUrl, 'dependencies');
    const cachedBreaking = this.cache.get(repoUrl, 'breaking-changes');
    const cachedCompliance = this.cache.get(repoUrl, 'compliance');

    if (cachedDeps && cachedBreaking && cachedCompliance) {
      return {
        dependencies: JSON.parse(cachedDeps.resultJson),
        breakingChanges: JSON.parse(cachedBreaking.resultJson),
        compliance: JSON.parse(cachedCompliance.resultJson),
      };
    }

    // Clone repo
    const tempDir = join('/tmp', 'voltron-analysis', randomUUID());
    mkdirSync(tempDir, { recursive: true });

    try {
      this.cloneRepo(repoUrl, tempDir);

      const dependencies = this.extractDependencies(tempDir);
      const breakingChanges = this.detectBreakingChanges(tempDir);
      const compliance = this.checkCompliance(tempDir);

      // Cache results
      const commitHash = this.getHeadCommit(tempDir);
      const expiresAt = Date.now() + this.config.cacheExpiry;

      this.cache.set({ projectId, repoUrl, analysisType: 'dependencies', resultJson: JSON.stringify(dependencies), commitHash, expiresAt });
      this.cache.set({ projectId, repoUrl, analysisType: 'breaking-changes', resultJson: JSON.stringify(breakingChanges), commitHash, expiresAt });
      this.cache.set({ projectId, repoUrl, analysisType: 'compliance', resultJson: JSON.stringify(compliance), commitHash, expiresAt });

      return { dependencies, breakingChanges, compliance };
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private cloneRepo(repoUrl: string, targetDir: string): void {
    const args = ['git', 'clone', '--depth=1', '--single-branch'];
    if (this.config.token) {
      const urlObj = new URL(repoUrl);
      urlObj.username = 'x-access-token';
      urlObj.password = this.config.token;
      args.push(urlObj.toString());
    } else {
      args.push(repoUrl);
    }
    args.push(targetDir);

    execSync(args.join(' '), {
      timeout: this.config.analysisTimeout,
      stdio: 'pipe',
    });
  }

  private getHeadCommit(repoDir: string): string {
    try {
      return execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' }).toString().trim().slice(0, 40);
    } catch {
      return '0'.repeat(40);
    }
  }

  private extractDependencies(repoDir: string): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const pkgPath = join(repoDir, 'package.json');

    if (!existsSync(pkgPath)) {
      return { nodes, edges, cycles: [], totalCount: 0 };
    }

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = pkg.dependencies ?? {};
      const devDeps = pkg.devDependencies ?? {};
      const peerDeps = pkg.peerDependencies ?? {};

      for (const [name, version] of Object.entries(deps)) {
        nodes.push({
          name,
          version: version as string,
          isDirect: true,
          dependents: [],
          isDevDependency: false,
        });
        edges.push({ from: pkg.name ?? 'root', to: name, type: 'runtime' });
      }

      for (const [name, version] of Object.entries(devDeps)) {
        nodes.push({
          name,
          version: version as string,
          isDirect: true,
          dependents: [],
          isDevDependency: true,
        });
        edges.push({ from: pkg.name ?? 'root', to: name, type: 'dev' });
      }

      for (const [name, version] of Object.entries(peerDeps)) {
        const existing = nodes.find(n => n.name === name);
        if (!existing) {
          nodes.push({
            name,
            version: version as string,
            isDirect: true,
            dependents: [],
            isDevDependency: false,
          });
        }
        edges.push({ from: pkg.name ?? 'root', to: name, type: 'peer' });
      }

      // Detect cycles (simplified DFS)
      const cycles = this.detectCycles(edges);

      return { nodes, edges, cycles, totalCount: nodes.length };
    } catch {
      return { nodes, edges, cycles: [], totalCount: 0 };
    }
  }

  private detectCycles(edges: DependencyEdge[]): string[][] {
    const graph = new Map<string, string[]>();
    for (const edge of edges) {
      if (!graph.has(edge.from)) graph.set(edge.from, []);
      graph.get(edge.from)!.push(edge.to);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);
      path.push(node);

      for (const neighbor of graph.get(node) ?? []) {
        dfs(neighbor, [...path]);
      }

      stack.delete(node);
    };

    for (const node of graph.keys()) {
      dfs(node, []);
    }

    return cycles;
  }

  private detectBreakingChanges(repoDir: string): BreakingChangeReport[] {
    const reports: BreakingChangeReport[] = [];
    const pkgPath = join(repoDir, 'package.json');

    if (!existsSync(pkgPath)) return reports;

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

      // Check for major version dependencies
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(allDeps)) {
        const versionStr = version as string;
        if (versionStr.startsWith('^') || versionStr.startsWith('~')) {
          const majorMatch = versionStr.match(/\d+/);
          if (majorMatch && parseInt(majorMatch[0]) >= 1) {
            // Check if there's a next major version pattern
          }
        }
      }

      // Scan source files for export changes
      const srcDir = join(repoDir, 'src');
      if (existsSync(srcDir)) {
        this.scanForBreakingPatterns(srcDir, reports);
      }
    } catch {
      // ignore
    }

    return reports;
  }

  private scanForBreakingPatterns(dir: string, reports: BreakingChangeReport[]): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          this.scanForBreakingPatterns(fullPath, reports);
          continue;
        }

        if (!entry.match(/\.(ts|tsx|js|jsx)$/)) continue;
        const content = readFileSync(fullPath, 'utf8');

        // Check for type/interface exports that could break consumers
        const typeExports = content.match(/export\s+(type|interface)\s+(\w+)/g);
        if (typeExports && typeExports.length > 5) {
          reports.push({
            file: fullPath,
            changeType: 'TYPE_CHANGE',
            severity: 'MEDIUM',
            confidence: 0.5,
            description: `File exports ${typeExports.length} types/interfaces - review for compatibility`,
            affectedDependents: [],
          });
        }

        // Check for enum exports
        const enumExports = content.match(/export\s+enum\s+(\w+)/g);
        if (enumExports) {
          for (const match of enumExports) {
            const name = match.replace(/export\s+enum\s+/, '');
            reports.push({
              file: fullPath,
              changeType: 'ENUM_CHANGE',
              severity: 'HIGH',
              confidence: 0.7,
              description: `Enum "${name}" - enum changes can break consumers with stored values`,
              affectedDependents: [],
            });
          }
        }
      } catch {
        // skip unreadable
      }
    }
  }

  private checkCompliance(repoDir: string): ArchitectureComplianceResult[] {
    const results: ArchitectureComplianceResult[] = [];

    // Rule 1: TypeScript strict mode
    results.push(this.checkTsStrict(repoDir));

    // Rule 2: No hardcoded secrets
    results.push(this.checkNoSecrets(repoDir));

    // Rule 3: Test file presence
    results.push(this.checkTestFiles(repoDir));

    // Rule 4: No eval/Function
    results.push(this.checkNoEval(repoDir));

    // Rule 5: Max file size
    results.push(this.checkMaxFileSize(repoDir));

    // Rule 6: Error handling
    results.push(this.checkErrorHandling(repoDir));

    return results;
  }

  private checkTsStrict(repoDir: string): ArchitectureComplianceResult {
    const tsConfigPath = join(repoDir, 'tsconfig.json');
    if (!existsSync(tsConfigPath)) {
      return { rule: 'TypeScript Strict Mode', category: 'PATTERN', passed: false, violations: [{ file: 'tsconfig.json', message: 'tsconfig.json not found', severity: 'warning' }] };
    }
    try {
      const content = readFileSync(tsConfigPath, 'utf8');
      const passed = content.includes('"strict": true') || content.includes('"strict":true');
      return {
        rule: 'TypeScript Strict Mode',
        category: 'PATTERN',
        passed,
        violations: passed ? [] : [{ file: 'tsconfig.json', message: 'strict mode is not enabled', severity: 'error' }],
      };
    } catch {
      return { rule: 'TypeScript Strict Mode', category: 'PATTERN', passed: false, violations: [{ file: 'tsconfig.json', message: 'Cannot read tsconfig.json', severity: 'warning' }] };
    }
  }

  private checkNoSecrets(repoDir: string): ArchitectureComplianceResult {
    const violations: ArchitectureComplianceResult['violations'] = [];
    const secretPatterns = [
      /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/gi,
      /(?:AKIA|sk-|ghp_|gho_|ghs_|ghr_)[A-Za-z0-9]{10,}/g,
    ];

    this.walkFiles(repoDir, (filePath, content) => {
      if (filePath.includes('node_modules') || filePath.includes('.git')) return;
      if (!filePath.match(/\.(ts|tsx|js|jsx|json|yaml|yml|env)$/)) return;
      if (basename(filePath).includes('.example')) return;

      for (const pattern of secretPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          violations.push({
            file: filePath.slice(repoDir.length + 1),
            message: `Potential hardcoded secret found`,
            severity: 'error',
          });
          break;
        }
      }
    });

    return { rule: 'No Hardcoded Secrets', category: 'SECURITY', passed: violations.length === 0, violations };
  }

  private checkTestFiles(repoDir: string): ArchitectureComplianceResult {
    let srcFileCount = 0;
    let testFileCount = 0;

    this.walkFiles(repoDir, (filePath) => {
      if (filePath.includes('node_modules') || filePath.includes('.git')) return;
      if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
        if (filePath.match(/\.(test|spec)\./)) {
          testFileCount++;
        } else {
          srcFileCount++;
        }
      }
    });

    const hasTests = testFileCount > 0;
    const ratio = srcFileCount > 0 ? testFileCount / srcFileCount : 0;
    const violations: ArchitectureComplianceResult['violations'] = [];

    if (!hasTests) {
      violations.push({ file: '', message: 'No test files found', severity: 'warning' });
    } else if (ratio < 0.1) {
      violations.push({ file: '', message: `Low test coverage: ${testFileCount} tests for ${srcFileCount} source files`, severity: 'info' });
    }

    return { rule: 'Test File Presence', category: 'PATTERN', passed: hasTests, violations };
  }

  private checkNoEval(repoDir: string): ArchitectureComplianceResult {
    const violations: ArchitectureComplianceResult['violations'] = [];
    const dangerousPatterns = [/\beval\s*\(/, /new\s+Function\s*\(/];

    this.walkFiles(repoDir, (filePath, content) => {
      if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('dist')) return;
      if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return;

      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          violations.push({
            file: filePath.slice(repoDir.length + 1),
            message: `Dangerous pattern: ${pattern.source}`,
            severity: 'error',
          });
        }
      }
    });

    return { rule: 'No eval/Function', category: 'SECURITY', passed: violations.length === 0, violations };
  }

  private checkMaxFileSize(repoDir: string): ArchitectureComplianceResult {
    const MAX_SIZE = 500_000; // 500KB
    const violations: ArchitectureComplianceResult['violations'] = [];

    this.walkFiles(repoDir, (filePath) => {
      if (filePath.includes('node_modules') || filePath.includes('.git')) return;
      if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return;

      try {
        const stat = statSync(filePath);
        if (stat.size > MAX_SIZE) {
          violations.push({
            file: filePath.slice(repoDir.length + 1),
            message: `File too large: ${(stat.size / 1024).toFixed(0)}KB (max: ${MAX_SIZE / 1024}KB)`,
            severity: 'warning',
          });
        }
      } catch {
        // skip
      }
    });

    return { rule: 'Max File Size', category: 'PERFORMANCE', passed: violations.length === 0, violations };
  }

  private checkErrorHandling(repoDir: string): ArchitectureComplianceResult {
    const violations: ArchitectureComplianceResult['violations'] = [];
    let asyncFunctions = 0;
    let asyncWithCatch = 0;

    this.walkFiles(repoDir, (filePath, content) => {
      if (filePath.includes('node_modules') || filePath.includes('.git')) return;
      if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) return;

      const asyncMatches = content.match(/async\s+function|\basync\s+\(/g);
      if (asyncMatches) {
        asyncFunctions += asyncMatches.length;
        const catchMatches = content.match(/\.catch\s*\(|try\s*\{/g);
        asyncWithCatch += catchMatches?.length ?? 0;
      }
    });

    if (asyncFunctions > 0 && asyncWithCatch / asyncFunctions < 0.3) {
      violations.push({
        file: '',
        message: `Low error handling coverage: ${asyncWithCatch} catch blocks for ${asyncFunctions} async functions`,
        severity: 'info',
      });
    }

    return { rule: 'Error Handling', category: 'PATTERN', passed: violations.length === 0, violations };
  }

  private walkFiles(dir: string, callback: (filePath: string, content: string) => void): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry)) {
            this.walkFiles(fullPath, callback);
          }
        } else if (stat.isFile() && stat.size < 1_000_000) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            callback(fullPath, content);
          } catch {
            // skip binary or unreadable
          }
        }
      } catch {
        // skip
      }
    }
  }
}
