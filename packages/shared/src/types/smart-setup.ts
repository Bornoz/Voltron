// ── Smart Setup Types ────────────────────────────────────

export interface ProjectProfile {
  languages: string[];
  frameworks: string[];
  packageManager: string;
  hasTests: boolean;
  testFramework: string | null;
  hasClaude: boolean;
  hasClaudeSkills: boolean;
  hasMcp: boolean;
  hasHooks: boolean;
  monorepo: boolean;
  linesOfCode: number;
  fileCount: number;
  detectedPatterns: string[];
}

export interface DiscoveredRepo {
  id: string;
  repoUrl: string;
  repoName: string;
  stars: number;
  description: string;
  category: 'skill' | 'hook' | 'mcp-server' | 'claude-md' | 'agent' | 'workflow';
  relevanceScore: number;
  relevanceReason: string;
  installCommand: string | null;
  configSnippet: string | null;
  selected: boolean;
}

export interface SmartSetupRun {
  id: string;
  projectId: string;
  status: SmartSetupPhase;
  profile: ProjectProfile | null;
  discoveries: DiscoveredRepo[];
  appliedCount: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export type SmartSetupPhase =
  | 'analyzing'
  | 'discovering'
  | 'evaluating'
  | 'ready'
  | 'applying'
  | 'completed'
  | 'failed';
