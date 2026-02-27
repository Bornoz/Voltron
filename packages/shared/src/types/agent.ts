import { z } from 'zod';

// ── Agent Status ─────────────────────────────────────────
export const AgentStatus = z.enum([
  'IDLE',
  'SPAWNING',
  'RUNNING',
  'PAUSED',
  'INJECTING',
  'STOPPING',
  'CRASHED',
  'COMPLETED',
]);
export type AgentStatus = z.infer<typeof AgentStatus>;

// ── Agent Activity ───────────────────────────────────────
export const AgentActivity = z.enum([
  'THINKING',
  'READING',
  'WRITING',
  'SEARCHING',
  'EXECUTING',
  'WAITING',
  'IDLE',
]);
export type AgentActivity = z.infer<typeof AgentActivity>;

// ── Agent Location (GPS) ────────────────────────────────
export const AgentLocation = z.object({
  filePath: z.string(),
  activity: AgentActivity,
  toolName: z.string().optional(),
  lineRange: z.object({
    start: z.number().int(),
    end: z.number().int(),
  }).optional(),
  timestamp: z.number(),
  durationMs: z.number().int().optional(),
});
export type AgentLocation = z.infer<typeof AgentLocation>;

// ── Agent Plan ──────────────────────────────────────────
export const AgentPlanStepStatus = z.enum(['pending', 'active', 'completed', 'skipped']);
export type AgentPlanStepStatus = z.infer<typeof AgentPlanStepStatus>;

export const AgentPlanStep = z.object({
  index: z.number().int(),
  description: z.string(),
  status: AgentPlanStepStatus,
  filePath: z.string().optional(),
});
export type AgentPlanStep = z.infer<typeof AgentPlanStep>;

export const AgentPlan = z.object({
  summary: z.string(),
  steps: z.array(AgentPlanStep),
  currentStepIndex: z.number().int(),
  totalSteps: z.number().int(),
  confidence: z.number().min(0).max(1),
});
export type AgentPlan = z.infer<typeof AgentPlan>;

// ── Agent Breadcrumb ────────────────────────────────────
export const AgentBreadcrumb = z.object({
  filePath: z.string(),
  activity: AgentActivity,
  timestamp: z.number(),
  durationMs: z.number().int().optional(),
  toolName: z.string().optional(),
  lineRange: z.object({ start: z.number().int(), end: z.number().int() }).optional(),
  contentSnippet: z.string().max(200).optional(),
  editDiff: z.string().max(500).optional(),
  toolInput: z.record(z.unknown()).optional(),
});
export type AgentBreadcrumb = z.infer<typeof AgentBreadcrumb>;

// ── File Tree ──────────────────────────────────────────
export const FileTreeNode: z.ZodType<FileTreeNodeType> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['file', 'directory']),
    size: z.number().optional(),
    lastModified: z.number().optional(),
    extension: z.string().optional(),
    children: z.array(FileTreeNode).optional(),
    agentVisits: z.number().int().optional(),
    lastActivity: AgentActivity.optional(),
  }),
);

export interface FileTreeNodeType {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: number;
  extension?: string;
  children?: FileTreeNodeType[];
  agentVisits?: number;
  lastActivity?: z.infer<typeof AgentActivity>;
}

// ── Prompt Injection ────────────────────────────────────
export const PromptInjection = z.object({
  prompt: z.string(),
  context: z.object({
    filePath: z.string().optional(),
    lineRange: z.object({
      start: z.number().int(),
      end: z.number().int(),
    }).optional(),
    constraints: z.array(z.string()).optional(),
    referenceImageUrl: z.string().optional(),
    simulatorPatches: z.array(z.unknown()).optional(),
    attachmentUrls: z.array(z.string()).optional(),
  }).optional(),
  urgency: z.enum(['low', 'normal', 'high']).default('normal'),
});
export type PromptInjection = z.infer<typeof PromptInjection>;

// ── Injection Queue Entry ──────────────────────────────
export const InjectionQueueEntry = z.object({
  id: z.string().uuid(),
  injection: PromptInjection,
  queuedAt: z.number(),
  status: z.enum(['queued', 'applying', 'applied', 'failed']),
});
export type InjectionQueueEntry = z.infer<typeof InjectionQueueEntry>;

// ── Agent Spawn Config ──────────────────────────────────
export const AgentSpawnConfig = z.object({
  projectId: z.string().uuid(),
  model: z.string().default('claude-haiku-4-5-20251001'),
  prompt: z.string().min(1),
  targetDir: z.string(),
  sessionId: z.string().uuid().optional(),
  systemPrompt: z.string().optional(),
});
export type AgentSpawnConfig = z.infer<typeof AgentSpawnConfig>;

// ── Agent Session ───────────────────────────────────────
export const AgentSession = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  sessionId: z.string().uuid(),
  status: AgentStatus,
  model: z.string(),
  prompt: z.string(),
  targetDir: z.string(),
  pid: z.number().int().nullable(),
  exitCode: z.number().int().nullable(),
  location: AgentLocation.nullable(),
  plan: AgentPlan.nullable(),
  breadcrumbs: z.array(AgentBreadcrumb),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  injectionCount: z.number().int(),
  lastError: z.string().nullable(),
  startedAt: z.number(),
  pausedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
});
export type AgentSession = z.infer<typeof AgentSession>;

// ── Phase Execution ─────────────────────────────────────
export const PhaseEditSchema = z.object({
  index: z.number().int(),
  type: z.string(),
  selector: z.string().optional(),
  description: z.string().optional(),
});
export type PhaseEdit = z.infer<typeof PhaseEditSchema>;

export const PhaseStatus = z.enum([
  'pending', 'running', 'awaiting_approval', 'approved', 'rejected', 'completed',
]);
export type PhaseStatus = z.infer<typeof PhaseStatus>;

export const PhaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  edits: z.array(PhaseEditSchema),
  status: PhaseStatus,
  result: z.string().optional(),
});
export type Phase = z.infer<typeof PhaseSchema>;

export const PhaseExecutionStatus = z.enum(['idle', 'running', 'awaiting_approval', 'completed', 'failed']);
export type PhaseExecutionStatus = z.infer<typeof PhaseExecutionStatus>;

export const PhaseExecutionSchema = z.object({
  phases: z.array(PhaseSchema),
  currentPhaseIndex: z.number().int(),
  status: PhaseExecutionStatus,
});
export type PhaseExecution = z.infer<typeof PhaseExecutionSchema>;

// ── Simulator Constraint ────────────────────────────────
export const SimulatorConstraint = z.object({
  type: z.enum(['style_change', 'layout_change', 'reference_image']),
  selector: z.string().optional(),
  property: z.string().optional(),
  value: z.string().optional(),
  imageUrl: z.string().optional(),
  description: z.string(),
});
export type SimulatorConstraint = z.infer<typeof SimulatorConstraint>;
