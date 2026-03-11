import type {
  ProjectConfig,
  CreateProjectInput,
  UpdateProjectInput,
  AiActionEvent,
  Snapshot,
  ProtectionZoneConfig,
  ExecutionState,
  ExecutionContext,
  RiskLevel,
  OperationType,
  ProtectionLevel,
} from '@voltron/shared';

const BASE = '/api';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000;

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() ?? 'GET';
  const isRetryable = method === 'GET';
  const maxAttempts = isRetryable ? MAX_RETRIES : 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Exponential backoff on retry
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {};
      const method = (options?.method ?? 'GET').toUpperCase();
      // Set Content-Type for all mutation methods (POST/PUT/PATCH/DELETE)
      // Fastify rejects requests with content-type json but no/invalid body
      if (method !== 'GET' && method !== 'HEAD') {
        headers['Content-Type'] = 'application/json';
        // Ensure body is never undefined for mutation methods
        if (!options) options = { body: '{}' };
        else if (!options.body) options = { ...options, body: '{}' };
      }
      const token = localStorage.getItem('voltron_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE}${path}`, {
        headers,
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }));
        const err = new ApiError(response.status, body.error ?? 'Unknown error');

        // 401 → clear all auth state and redirect to login
        if (response.status === 401) {
          localStorage.removeItem('voltron_token');
          localStorage.removeItem('voltron-auth'); // clear zustand persist
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
          throw err;
        }

        // Only retry on 5xx, not 4xx
        if (response.status >= 500 && isRetryable && attempt < maxAttempts - 1) {
          lastError = err;
          continue;
        }
        throw err;
      }

      return response.json() as Promise<T>;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) throw err;

      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new TimeoutError(DEFAULT_TIMEOUT_MS);
        if (!isRetryable || attempt >= maxAttempts - 1) throw lastError;
        continue;
      }

      // Network error — retry on GET
      lastError = err instanceof Error ? err : new Error(String(err));
      if (isRetryable && attempt < maxAttempts - 1) continue;
      throw lastError;
    }
  }

  throw lastError ?? new Error('Request failed');
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Projects ──────────────────────────────────────────────

export function getProjects(): Promise<ProjectConfig[]> {
  return request<ProjectConfig[]>('/projects');
}

// ── Actions ───────────────────────────────────────────────

export function getActions(projectId: string, query?: { limit?: number; offset?: number; risk?: RiskLevel }): Promise<AiActionEvent[]> {
  const params = new URLSearchParams();
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.offset) params.set('offset', String(query.offset));
  if (query?.risk) params.set('risk', query.risk);
  const qs = params.toString();
  return request<AiActionEvent[]>(`/projects/${projectId}/actions${qs ? `?${qs}` : ''}`);
}

export function getActionsByFile(projectId: string, filePath: string): Promise<AiActionEvent[]> {
  const params = new URLSearchParams({ path: filePath });
  return request<AiActionEvent[]>(`/projects/${projectId}/actions/file?${params}`);
}

// ── Snapshots ─────────────────────────────────────────────

export function getSnapshots(
  projectId: string,
  limit = 50,
  offset = 0,
): Promise<Snapshot[]> {
  return request<Snapshot[]>(`/projects/${projectId}/snapshots?limit=${limit}&offset=${offset}`);
}

// ── Protection Zones ──────────────────────────────────────

export function getZones(projectId: string): Promise<ProtectionZoneConfig[]> {
  return request<ProtectionZoneConfig[]>(`/projects/${projectId}/zones`);
}

export interface CreateZoneInput {
  path: string;
  level: ProtectionLevel;
  reason?: string;
  allowedOperations?: OperationType[];
}

export function createZone(
  projectId: string,
  input: CreateZoneInput,
): Promise<ProtectionZoneConfig> {
  return request<ProtectionZoneConfig>(`/projects/${projectId}/zones`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteZone(
  projectId: string,
  zoneId: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${projectId}/zones/${zoneId}`, {
    method: 'DELETE',
  });
}

// ── Control ───────────────────────────────────────────────

export interface ControlState {
  state: ExecutionState;
  context: ExecutionContext;
}

export interface ControlHistoryEntry {
  state: ExecutionState;
  timestamp: number;
  reason?: string;
  actor?: string;
}

export function controlStop(projectId: string): Promise<ControlState> {
  return request<ControlState>(`/projects/${projectId}/control/stop`, {
    method: 'POST',
  });
}

export function controlContinue(projectId: string): Promise<ControlState> {
  return request<ControlState>(`/projects/${projectId}/control/continue`, {
    method: 'POST',
  });
}

export function controlReset(projectId: string): Promise<ControlState> {
  return request<ControlState>(`/projects/${projectId}/control/reset`, {
    method: 'POST',
  });
}

export function getControlState(projectId: string): Promise<ControlState> {
  return request<ControlState>(`/projects/${projectId}/control/state`);
}

export function getControlHistory(projectId: string): Promise<ControlHistoryEntry[]> {
  return request<ControlHistoryEntry[]>(`/projects/${projectId}/control/history`);
}

// ── GitHub Analysis ──────────────────────────────────────

export function analyzeRepo(projectId: string, repoUrl: string): Promise<{ dependencies: unknown; breakingChanges: unknown[]; compliance: unknown[] }> {
  return request<{ dependencies: unknown; breakingChanges: unknown[]; compliance: unknown[] }>(`/projects/${projectId}/github/analyze`, {
    method: 'POST',
    body: JSON.stringify({ repoUrl }),
  });
}

// ── Snapshot Additional Endpoints ────────────────────────

export function labelSnapshot(
  projectId: string,
  snapshotId: string,
  label: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${projectId}/snapshots/${snapshotId}/label`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export function rollbackSnapshot(
  projectId: string,
  snapshotId: string,
): Promise<{ success: boolean; snapshot: Snapshot; gitCommitHash: string }> {
  return request<{ success: boolean; snapshot: Snapshot; gitCommitHash: string }>(
    `/projects/${projectId}/snapshots/${snapshotId}/rollback`,
    { method: 'POST' },
  );
}

export function getSnapshotFiles(
  projectId: string,
  snapshotId: string,
): Promise<{ snapshotId: string; gitCommitHash: string; files: string[]; fileCount: number }> {
  return request<{ snapshotId: string; gitCommitHash: string; files: string[]; fileCount: number }>(
    `/projects/${projectId}/snapshots/${snapshotId}/files`,
  );
}

export function pruneSnapshots(
  projectId: string,
  keep?: number,
): Promise<{ success: boolean; deleted: number; remaining: number }> {
  const params = new URLSearchParams();
  if (keep != null) params.set('keep', String(keep));
  const qs = params.toString();
  return request<{ success: boolean; deleted: number; remaining: number }>(
    `/projects/${projectId}/snapshots/prune${qs ? `?${qs}` : ''}`,
    { method: 'DELETE' },
  );
}

// ── Interceptor Status ──────────────────────────

export interface InterceptorStatus {
  interceptorConnected: boolean;
  dashboardConnected: boolean;
  simulatorConnected: boolean;
  totalConnections: number;
  executionState: string;
  currentRate: number;
  timestamp: number;
}

export function getInterceptorStatus(projectId: string): Promise<InterceptorStatus> {
  return request<InterceptorStatus>(`/projects/${projectId}/interceptor/status`);
}

// ── AI Behavior Scoring ─────────────────────────────────

export interface BehaviorScore {
  id: string;
  projectId: string;
  windowStart: number;
  windowEnd: number;
  totalActions: number;
  riskScore: number;
  velocityScore: number;
  complianceScore: number;
  overallScore: number;
  details: Record<string, unknown> | null;
  createdAt: number;
}

export function getBehaviorScores(projectId: string, limit?: number): Promise<BehaviorScore[]> {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  const qs = params.toString();
  return request<BehaviorScore[]>(`/projects/${projectId}/behavior/scores${qs ? `?${qs}` : ''}`);
}

export function getBehaviorLatest(projectId: string): Promise<BehaviorScore> {
  return request<BehaviorScore>(`/projects/${projectId}/behavior/latest`);
}

export function triggerBehaviorScore(projectId: string): Promise<BehaviorScore> {
  return request<BehaviorScore>(`/projects/${projectId}/behavior/score`, { method: 'POST' });
}

// ── Prompt Versioning ───────────────────────────────────

export interface PromptVersion {
  id: string;
  projectId: string;
  version: number;
  name: string;
  content: string;
  hash: string;
  parentId: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: number;
}

export function getPromptVersions(projectId: string): Promise<PromptVersion[]> {
  return request<PromptVersion[]>(`/projects/${projectId}/prompts`);
}

export function createPromptVersion(
  projectId: string,
  name: string,
  content: string,
): Promise<PromptVersion> {
  return request<PromptVersion>(`/projects/${projectId}/prompts`, {
    method: 'POST',
    body: JSON.stringify({ name, content }),
  });
}

export function activatePromptVersion(
  projectId: string,
  versionId: string,
): Promise<PromptVersion> {
  return request<PromptVersion>(`/projects/${projectId}/prompts/${versionId}/activate`, {
    method: 'POST',
  });
}

// ── Agent Orchestration ─────────────────────────────────

export function agentSpawn(
  projectId: string,
  config: { model?: string; prompt: string; targetDir: string },
): Promise<{ sessionId: string; status: string }> {
  return request<{ sessionId: string; status: string }>(`/projects/${projectId}/agent/spawn`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export function agentStop(projectId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/projects/${projectId}/agent/stop`, { method: 'POST' });
}

export function agentResume(projectId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/projects/${projectId}/agent/resume`, { method: 'POST' });
}

export function agentKill(projectId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/projects/${projectId}/agent/kill`, { method: 'POST' });
}

export function agentPhaseDecision(
  projectId: string,
  phaseId: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<{ status: string; decision: string }> {
  return request<{ status: string; decision: string }>(`/projects/${projectId}/agent/phase-decision`, {
    method: 'POST',
    body: JSON.stringify({ phaseId, decision, reason }),
  });
}

export function agentInject(
  projectId: string,
  injection: { prompt: string; context?: Record<string, unknown>; urgency?: string },
): Promise<{ status: string }> {
  return request<{ status: string }>(`/projects/${projectId}/agent/inject`, {
    method: 'POST',
    body: JSON.stringify(injection),
  });
}

// ── Breakpoints ──────────────────────────────────────
export function getBreakpoints(projectId: string): Promise<string[]> {
  return request<string[]>(`/projects/${projectId}/agent/breakpoints`);
}

export function setBreakpoint(projectId: string, filePath: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/projects/${projectId}/agent/breakpoints`, {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  });
}

export function removeBreakpoint(projectId: string, filePath: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/projects/${projectId}/agent/breakpoints`, {
    method: 'DELETE',
    body: JSON.stringify({ filePath }),
  });
}

export function getAgentSession(projectId: string): Promise<Record<string, unknown> | null> {
  return request<Record<string, unknown> | null>(`/projects/${projectId}/agent/session`);
}

export function getAgentPlan(projectId: string): Promise<Record<string, unknown> | null> {
  return request<Record<string, unknown> | null>(`/projects/${projectId}/agent/plan`);
}

export function getAgentBreadcrumbs(projectId: string): Promise<Record<string, unknown>[]> {
  return request<Record<string, unknown>[]>(`/projects/${projectId}/agent/breadcrumbs`);
}

export function getAgentInjections(projectId: string): Promise<Record<string, unknown>[]> {
  return request<Record<string, unknown>[]>(`/projects/${projectId}/agent/injections`);
}

export function getAgentFileTree(projectId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/projects/${projectId}/agent/filetree`);
}

export function githubSearchAndAdapt(
  projectId: string,
  config: { query: string; framework?: string; targetDir: string; model?: string },
): Promise<{ sessionId: string; status: string; message: string }> {
  return request<{ sessionId: string; status: string; message: string }>(`/projects/${projectId}/github/search-and-adapt`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

// ── Project Rules ───────────────────────────────────────

export interface ProjectRules {
  id?: string;
  projectId?: string;
  content: string;
  isActive: boolean;
  updatedAt?: number;
  createdAt?: number;
}

export function getProjectRules(projectId: string): Promise<ProjectRules> {
  return request<ProjectRules>(`/projects/${projectId}/rules`);
}

export function updateProjectRules(projectId: string, content: string): Promise<ProjectRules> {
  return request<ProjectRules>(`/projects/${projectId}/rules`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export function toggleProjectRules(projectId: string): Promise<{ isActive: boolean }> {
  return request<{ isActive: boolean }>(`/projects/${projectId}/rules/toggle`, { method: 'POST' });
}

// ── Project Memory ──────────────────────────────────────

export interface MemoryEntry {
  id: string;
  projectId: string;
  category: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export function getProjectMemories(projectId: string, category?: string): Promise<MemoryEntry[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  const qs = params.toString();
  return request<MemoryEntry[]>(`/projects/${projectId}/memory${qs ? `?${qs}` : ''}`);
}

export function createProjectMemory(
  projectId: string,
  entry: { category: string; title: string; content: string },
): Promise<MemoryEntry> {
  return request<MemoryEntry>(`/projects/${projectId}/memory`, {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export function updateProjectMemory(
  projectId: string,
  memId: string,
  data: Partial<{ title: string; content: string; category: string; pinned: boolean }>,
): Promise<MemoryEntry> {
  return request<MemoryEntry>(`/projects/${projectId}/memory/${memId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProjectMemory(projectId: string, memId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${projectId}/memory/${memId}`, { method: 'DELETE' });
}

export function toggleMemoryPin(projectId: string, memId: string): Promise<{ pinned: boolean }> {
  return request<{ pinned: boolean }>(`/projects/${projectId}/memory/${memId}/pin`, { method: 'POST' });
}

// ── Session History (typed) ─────────────────────────────

export interface AgentSessionInfo {
  id: string;
  sessionId: string;
  status: string;
  model: string;
  prompt: string;
  targetDir: string;
  pid: number | null;
  exitCode: number | null;
  inputTokens: number;
  outputTokens: number;
  injectionCount: number;
  lastError: string | null;
  startedAt: number;
  pausedAt: number | null;
  completedAt: number | null;
}

export function getAgentSessionsTyped(projectId: string): Promise<AgentSessionInfo[]> {
  return request<AgentSessionInfo[]>(`/projects/${projectId}/agent/sessions`);
}

export function getPromptDiff(
  projectId: string,
  fromId: string,
  toId: string,
): Promise<{ from: PromptVersion; to: PromptVersion; changes: string[] }> {
  const params = new URLSearchParams({ from: fromId, to: toId });
  return request<{ from: PromptVersion; to: PromptVersion; changes: string[] }>(
    `/projects/${projectId}/prompts/diff?${params}`,
  );
}

/* ─── File Uploads ─── */

export interface UploadResult {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: number;
}

export async function uploadFile(projectId: string, file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('voltron_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`/api/projects/${projectId}/uploads`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error((err as Record<string, string>).error ?? 'Upload failed');
  }

  return resp.json() as Promise<UploadResult>;
}

export function deleteUpload(id: string): Promise<void> {
  return request<void>(`/uploads/${id}`, { method: 'DELETE' });
}

// ── Demo Mode ───────────────────────────────────────────

export interface DemoStatus {
  running: boolean;
  sessionId?: string;
  phase?: number;
  eventsEmitted?: number;
}

export function startDemo(): Promise<DemoStatus> {
  return request<DemoStatus>('/demo/start', { method: 'POST' });
}

export function stopDemo(): Promise<DemoStatus> {
  return request<DemoStatus>('/demo/stop', { method: 'POST' });
}

export function getDemoStatus(): Promise<DemoStatus> {
  return request<DemoStatus>('/demo/status');
}

// ── Smart Setup ─────────────────────────────────────────

export function startSmartSetup(projectId: string, skipGithub = false): Promise<{ runId: string }> {
  return request<{ runId: string }>(`/projects/${projectId}/smart-setup/run`, {
    method: 'POST',
    body: JSON.stringify({ skipGithub }),
  });
}

export function getSmartSetupRuns(projectId: string): Promise<SmartSetupRunResponse[]> {
  return request<SmartSetupRunResponse[]>(`/projects/${projectId}/smart-setup/runs`);
}

export function getSmartSetupRun(projectId: string, runId: string): Promise<SmartSetupRunResponse> {
  return request<SmartSetupRunResponse>(`/projects/${projectId}/smart-setup/runs/${runId}`);
}

export function applySmartSetup(projectId: string, runId: string, repoIds: string[]): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/projects/${projectId}/smart-setup/runs/${runId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ repoIds }),
  });
}

export function getProjectProfile(projectId: string): Promise<ProjectProfileResponse> {
  return request<ProjectProfileResponse>(`/projects/${projectId}/smart-setup/profile`);
}

export interface ProjectProfileResponse {
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

export interface DiscoveredRepoResponse {
  id: string;
  repoUrl: string;
  repoName: string;
  stars: number;
  description: string;
  category: string;
  relevanceScore: number;
  relevanceReason: string;
  installCommand: string | null;
  configSnippet: string | null;
  selected: boolean;
}

export interface SmartSetupRunResponse {
  id: string;
  projectId: string;
  status: string;
  profile: ProjectProfileResponse | null;
  discoveries: DiscoveredRepoResponse[];
  appliedCount: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}
