import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execSync } from 'node:child_process';
import type { ProjectProfile, DiscoveredRepo, SmartSetupRun } from '@voltron/shared';
import { SmartSetupRepository } from '../db/repositories/smart-setup.js';
import { ProjectRepository } from '../db/repositories/projects.js';

export interface SmartSetupLogger {
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
}

// Command prefix whitelist for security
const ALLOWED_CMD_PREFIXES = ['npm install', 'pnpm add', 'git clone', 'cp ', 'mkdir '];
const BLOCKED_DIRS = ['/etc', '/usr', '/bin', '/sbin', '/var', '/root', '/boot', '/proc', '/sys', '/dev'];

// Known pattern detection from dependencies
const PATTERN_MAP: Record<string, string> = {
  xstate: 'State Machine',
  fastify: 'REST API',
  express: 'REST API',
  'socket.io': 'WebSocket',
  ws: 'WebSocket',
  '@fastify/websocket': 'WebSocket',
  react: 'SPA',
  vue: 'SPA',
  svelte: 'SPA',
  next: 'SSR',
  nuxt: 'SSR',
  vite: 'Bundler',
  webpack: 'Bundler',
  tailwindcss: 'CSS Framework',
  prisma: 'ORM',
  drizzle: 'ORM',
  typeorm: 'ORM',
  zod: 'Validation',
  graphql: 'GraphQL',
  trpc: 'tRPC',
  'better-sqlite3': 'SQLite',
  pg: 'PostgreSQL',
  redis: 'Redis',
  docker: 'Docker',
};

export class SmartSetupService {
  private repo = new SmartSetupRepository();
  private projectRepo = new ProjectRepository();

  constructor(
    private log: SmartSetupLogger,
    private githubToken: string | null,
  ) {}

  // ── 1. Project Profile Analysis (local, no API) ──────────

  async analyzeProject(projectId: string): Promise<ProjectProfile> {
    const project = this.projectRepo.findById(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const targetDir = project.rootPath;
    if (!existsSync(targetDir)) throw new Error(`Project directory not found: ${targetDir}`);

    const languages: string[] = [];
    const frameworks: string[] = [];
    let packageManager = 'npm';
    let hasTests = false;
    let testFramework: string | null = null;
    let hasClaude = false;
    let hasClaudeSkills = false;
    let hasMcp = false;
    let hasHooks = false;
    let monorepo = false;
    const detectedPatterns: string[] = [];

    const rootFiles = readdirSync(targetDir);

    // package.json analysis
    const pkgPath = join(targetDir, 'package.json');
    if (existsSync(pkgPath)) {
      languages.push('TypeScript', 'JavaScript');
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Frameworks
        if (allDeps.react) frameworks.push('React');
        if (allDeps.vue) frameworks.push('Vue');
        if (allDeps.svelte) frameworks.push('Svelte');
        if (allDeps.next) frameworks.push('Next.js');
        if (allDeps.nuxt) frameworks.push('Nuxt');
        if (allDeps.fastify) frameworks.push('Fastify');
        if (allDeps.express) frameworks.push('Express');
        if (allDeps.nestjs || allDeps['@nestjs/core']) frameworks.push('NestJS');

        // Test frameworks
        if (allDeps.vitest) { hasTests = true; testFramework = 'vitest'; }
        else if (allDeps.jest) { hasTests = true; testFramework = 'jest'; }
        else if (allDeps.playwright || allDeps['@playwright/test']) { hasTests = true; testFramework = 'playwright'; }
        else if (allDeps.mocha) { hasTests = true; testFramework = 'mocha'; }

        // Patterns from deps
        for (const [dep, pattern] of Object.entries(PATTERN_MAP)) {
          if (allDeps[dep] && !detectedPatterns.includes(pattern)) {
            detectedPatterns.push(pattern);
          }
        }
      } catch { /* malformed package.json */ }
    }

    // Language detection — tsconfig, pyproject, go.mod
    if (rootFiles.includes('tsconfig.json')) {
      if (!languages.includes('TypeScript')) languages.push('TypeScript');
    }
    if (rootFiles.includes('pyproject.toml') || rootFiles.includes('setup.py') || rootFiles.includes('requirements.txt')) {
      languages.push('Python');
    }
    if (rootFiles.includes('go.mod')) languages.push('Go');
    if (rootFiles.includes('Cargo.toml')) languages.push('Rust');
    if (rootFiles.includes('pom.xml') || rootFiles.includes('build.gradle')) languages.push('Java');

    // Package manager
    if (rootFiles.includes('pnpm-lock.yaml') || rootFiles.includes('pnpm-workspace.yaml')) packageManager = 'pnpm';
    else if (rootFiles.includes('yarn.lock')) packageManager = 'yarn';
    else if (rootFiles.includes('bun.lockb')) packageManager = 'bun';

    // Claude ecosystem
    if (rootFiles.includes('CLAUDE.md')) hasClaude = true;
    if (existsSync(join(targetDir, '.claude', 'skills'))) hasClaudeSkills = true;
    if (rootFiles.includes('.mcp.json')) hasMcp = true;
    const claudeSettingsPath = join(targetDir, '.claude', 'settings.json');
    if (existsSync(claudeSettingsPath)) {
      try {
        const settings = JSON.parse(readFileSync(claudeSettingsPath, 'utf-8'));
        if (settings.hooks && Object.keys(settings.hooks).length > 0) hasHooks = true;
      } catch { /* */ }
    }

    // Monorepo
    if (rootFiles.includes('pnpm-workspace.yaml') || rootFiles.includes('lerna.json') ||
        rootFiles.includes('nx.json') || rootFiles.includes('turbo.json')) {
      monorepo = true;
    }

    // Test config files
    for (const f of rootFiles) {
      if (f.startsWith('vitest.config') || f.startsWith('jest.config') || f.startsWith('playwright.config')) {
        hasTests = true;
        if (!testFramework) testFramework = f.split('.')[0];
      }
    }

    // Count lines of code and files (src/ or root *.ts/*.js)
    let linesOfCode = 0;
    let fileCount = 0;
    const codeExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java']);
    try {
      const countDir = existsSync(join(targetDir, 'src')) ? join(targetDir, 'src') : targetDir;
      this.walkDir(countDir, (filePath) => {
        const ext = extname(filePath);
        if (codeExts.has(ext)) {
          fileCount++;
          try {
            const content = readFileSync(filePath, 'utf-8');
            linesOfCode += content.split('\n').length;
          } catch { /* skip unreadable */ }
        }
      }, 3); // max depth 3
    } catch { /* dir walk fail */ }

    return {
      languages: [...new Set(languages)],
      frameworks,
      packageManager,
      hasTests,
      testFramework,
      hasClaude,
      hasClaudeSkills,
      hasMcp,
      hasHooks,
      monorepo,
      linesOfCode,
      fileCount,
      detectedPatterns,
    };
  }

  // ── 2. GitHub Discovery ────────────────────────────────

  async discoverRepos(profile: ProjectProfile): Promise<DiscoveredRepo[]> {
    if (!this.githubToken) {
      this.log.warn('No GitHub token configured, skipping repo discovery');
      return [];
    }

    const queries = this.buildSearchQueries(profile);
    const allRepos: DiscoveredRepo[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      try {
        const repos = await this.searchGitHub(query);
        for (const repo of repos) {
          if (!seenUrls.has(repo.repoUrl)) {
            seenUrls.add(repo.repoUrl);
            allRepos.push(repo);
          }
        }
      } catch (err) {
        this.log.warn(`GitHub search failed for query "${query}": ${err}`);
      }
    }

    return allRepos;
  }

  private buildSearchQueries(profile: ProjectProfile): string[] {
    const queries: string[] = [];

    // General Claude Code tools
    queries.push('claude code skills');

    // Framework-specific
    for (const fw of profile.frameworks.slice(0, 2)) {
      queries.push(`claude code ${fw.toLowerCase()}`);
    }

    // MCP servers
    if (!profile.hasMcp) {
      queries.push('claude mcp server');
    }

    // Testing if missing
    if (!profile.hasTests) {
      queries.push('claude code testing');
    }

    // Hooks
    if (!profile.hasHooks) {
      queries.push('claude hooks');
    }

    return queries.slice(0, 5); // max 5 queries
  }

  private async searchGitHub(query: string): Promise<DiscoveredRepo[]> {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=10`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${this.githubToken}`,
        'User-Agent': 'Voltron-SmartSetup',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { items: Array<{
      html_url: string;
      full_name: string;
      stargazers_count: number;
      description: string | null;
      topics: string[];
    }> };

    return (data.items ?? []).map((item) => ({
      id: randomUUID(),
      repoUrl: item.html_url,
      repoName: item.full_name,
      stars: item.stargazers_count,
      description: item.description ?? '',
      category: this.categorizeRepo(item.full_name, item.description ?? '', item.topics ?? []),
      relevanceScore: 0,
      relevanceReason: '',
      installCommand: null,
      configSnippet: null,
      selected: false,
    }));
  }

  private categorizeRepo(name: string, desc: string, topics: string[]): DiscoveredRepo['category'] {
    const text = `${name} ${desc} ${topics.join(' ')}`.toLowerCase();
    if (text.includes('mcp') && text.includes('server')) return 'mcp-server';
    if (text.includes('skill')) return 'skill';
    if (text.includes('hook')) return 'hook';
    if (text.includes('claude.md') || text.includes('claudemd')) return 'claude-md';
    if (text.includes('agent')) return 'agent';
    if (text.includes('workflow') || text.includes('action')) return 'workflow';
    return 'skill'; // default
  }

  // ── 3. Heuristic Evaluation (no AI needed) ────────────

  evaluateRepos(profile: ProjectProfile, repos: DiscoveredRepo[]): DiscoveredRepo[] {
    return repos.map((repo) => {
      const { score, reason } = this.scoreRepo(profile, repo);
      return {
        ...repo,
        relevanceScore: score,
        relevanceReason: reason,
        selected: score >= 70, // auto-select high relevance
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private scoreRepo(profile: ProjectProfile, repo: DiscoveredRepo): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Stars bonus
    if (repo.stars >= 1000) { score += 20; reasons.push('Populer repo'); }
    else if (repo.stars >= 100) { score += 10; reasons.push('Iyi yildiz sayisi'); }
    else if (repo.stars >= 10) { score += 5; }

    // Category match
    if (repo.category === 'mcp-server' && !profile.hasMcp) { score += 25; reasons.push('MCP eksik, bu kurar'); }
    if (repo.category === 'hook' && !profile.hasHooks) { score += 20; reasons.push('Hook eksik, bu kurar'); }
    if (repo.category === 'skill' && !profile.hasClaudeSkills) { score += 20; reasons.push('Skill eksik, bu kurar'); }
    if (repo.category === 'claude-md' && !profile.hasClaude) { score += 15; reasons.push('CLAUDE.md eksik'); }

    // Framework match
    const text = `${repo.repoName} ${repo.description}`.toLowerCase();
    for (const fw of profile.frameworks) {
      if (text.includes(fw.toLowerCase())) {
        score += 15;
        reasons.push(`${fw} ile uyumlu`);
        break;
      }
    }

    // Language match
    for (const lang of profile.languages) {
      if (text.includes(lang.toLowerCase())) {
        score += 10;
        reasons.push(`${lang} destekli`);
        break;
      }
    }

    // Patterns match
    for (const pattern of profile.detectedPatterns) {
      if (text.includes(pattern.toLowerCase())) {
        score += 10;
        reasons.push(`${pattern} destegi`);
        break;
      }
    }

    return {
      score: Math.min(100, score),
      reason: reasons.length > 0 ? reasons.join('. ') : 'Genel Claude Code araci',
    };
  }

  // ── 4. Apply Setup ────────────────────────────────────

  async applySetup(runId: string, selectedRepoIds: string[]): Promise<void> {
    const run = this.repo.findById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    if (run.status !== 'ready') throw new Error(`Run is not ready for apply (current: ${run.status})`);

    const project = this.projectRepo.findById(run.projectId);
    if (!project) throw new Error(`Project ${run.projectId} not found`);

    const targetDir = project.rootPath;

    // Validate targetDir is not a blocked path
    for (const blocked of BLOCKED_DIRS) {
      if (targetDir.startsWith(blocked + '/') || targetDir === blocked) {
        throw new Error(`Cannot apply setup to restricted directory: ${targetDir}`);
      }
    }

    this.repo.update(runId, { status: 'applying' });

    const selected = run.discoveries.filter((d) => selectedRepoIds.includes(d.id));
    let appliedCount = 0;

    for (const repo of selected) {
      try {
        if (repo.installCommand) {
          // Validate command
          const isAllowed = ALLOWED_CMD_PREFIXES.some((prefix) => repo.installCommand!.startsWith(prefix));
          if (!isAllowed) {
            this.log.warn(`Skipping unsafe command: ${repo.installCommand}`);
            continue;
          }

          // Execute safely — no shell interpolation
          execSync(repo.installCommand, { cwd: targetDir, timeout: 60_000, stdio: 'pipe' });
          this.log.info(`Applied install: ${repo.installCommand}`);
        }

        if (repo.configSnippet && repo.category === 'mcp-server') {
          // Merge into .mcp.json
          const mcpPath = join(targetDir, '.mcp.json');
          let mcpConfig: Record<string, unknown> = {};
          if (existsSync(mcpPath)) {
            try { mcpConfig = JSON.parse(readFileSync(mcpPath, 'utf-8')); } catch { /* */ }
          }
          try {
            const snippet = JSON.parse(repo.configSnippet);
            mcpConfig = { ...mcpConfig, ...snippet };
            const { writeFileSync } = await import('node:fs');
            writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2));
            this.log.info(`Updated .mcp.json for ${repo.repoName}`);
          } catch {
            this.log.warn(`Failed to parse configSnippet for ${repo.repoName}`);
          }
        }

        appliedCount++;
      } catch (err) {
        this.log.error(`Failed to apply ${repo.repoName}: ${err}`);
      }
    }

    this.repo.update(runId, { status: 'completed', appliedCount });
  }

  // ── 5. Full Pipeline ──────────────────────────────────

  async runFullPipeline(projectId: string, options?: { skipGithub?: boolean }): Promise<string> {
    // Pre-validate project exists before creating DB record (FK constraint)
    const project = this.projectRepo.findById(projectId);
    if (!project) {
      // Create a synthetic failed run without DB (return a temp ID)
      const tempId = `failed-${Date.now()}`;
      this.log.error(`[SmartSetup] Project ${projectId} not found`);
      return tempId;
    }

    const run = this.repo.create(projectId);
    const runId = run.id;

    try {
      // Phase 1: Analyze project
      this.repo.update(runId, { status: 'analyzing' });
      this.log.info(`[SmartSetup] Analyzing project ${projectId}...`);
      const profile = await this.analyzeProject(projectId);
      this.repo.update(runId, { profile });

      // Phase 2: GitHub discovery (optional)
      if (options?.skipGithub) {
        // Skip GitHub — go straight to ready with no discoveries
        this.log.info(`[SmartSetup] Skipping GitHub discovery (user preference)`);
        this.repo.update(runId, { status: 'ready', discoveries: [] });
        return runId;
      }

      this.repo.update(runId, { status: 'discovering' });
      this.log.info(`[SmartSetup] Discovering repos on GitHub...`);
      const rawRepos = await this.discoverRepos(profile);

      // Phase 3: Evaluate repos
      this.repo.update(runId, { status: 'evaluating' });
      this.log.info(`[SmartSetup] Evaluating ${rawRepos.length} repos...`);
      const scoredRepos = this.evaluateRepos(profile, rawRepos);

      // Done — ready for user selection
      this.repo.update(runId, { status: 'ready', discoveries: scoredRepos });
      this.log.info(`[SmartSetup] Ready with ${scoredRepos.length} discoveries`);

      return runId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(`[SmartSetup] Pipeline failed: ${message}`);
      this.repo.update(runId, { status: 'failed', error: message });
      return runId;
    }
  }

  // ── Getters ────────────────────────────────────────────

  getRun(id: string): SmartSetupRun | null {
    return this.repo.findById(id);
  }

  getRuns(projectId: string): SmartSetupRun[] {
    return this.repo.findByProject(projectId);
  }

  getProfile(projectId: string): Promise<ProjectProfile> {
    return this.analyzeProject(projectId);
  }

  // ── Helpers ────────────────────────────────────────────

  private walkDir(dir: string, callback: (filePath: string) => void, maxDepth: number, depth = 0): void {
    if (depth > maxDepth) return;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'build') continue;
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            this.walkDir(fullPath, callback, maxDepth, depth + 1);
          } else {
            callback(fullPath);
          }
        } catch { /* skip inaccessible */ }
      }
    } catch { /* skip unreadable dir */ }
  }
}
