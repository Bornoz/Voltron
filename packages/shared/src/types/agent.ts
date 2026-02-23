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
});
export type AgentBreadcrumb = z.infer<typeof AgentBreadcrumb>;

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
  }).optional(),
  urgency: z.enum(['low', 'normal', 'high']).default('normal'),
});
export type PromptInjection = z.infer<typeof PromptInjection>;

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
