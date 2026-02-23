import { z } from 'zod';
import { RiskLevel } from './risk.js';

export const ExecutionState = z.enum(['IDLE', 'RUNNING', 'STOPPED', 'RESUMING', 'ERROR']);
export type ExecutionState = z.infer<typeof ExecutionState>;

export const ExecutionContext = z.object({
  lastSnapshotId: z.string().nullable(),
  lastActionEventId: z.string().nullable(),
  pendingActions: z.number().int(),
  stoppedAt: z.number().nullable(),
  stopReason: z.string().nullable(),
  errorMessage: z.string().nullable(),
  errorTimestamp: z.number().nullable(),
  totalActionsProcessed: z.number().int(),
  sessionStartedAt: z.number().nullable(),
  autoStopRiskThreshold: RiskLevel,
  rateLimit: z.number().int(),
});
export type ExecutionContext = z.infer<typeof ExecutionContext>;
