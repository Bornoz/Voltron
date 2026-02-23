import { z } from 'zod';
import { RiskLevel, OperationType } from './risk.js';
import { ProtectionLevel } from './protection.js';

export const AiActionEvent = z.object({
  id: z.string().uuid(),
  sequenceNumber: z.number().int(),
  projectId: z.string().uuid(),
  action: OperationType,
  file: z.string(),
  risk: RiskLevel,
  snapshotId: z.string().uuid(),
  timestamp: z.number(),
  hash: z.string().length(64),
  previousHash: z.string().length(64).optional(),
  diff: z.string().optional(),
  diffTruncated: z.boolean().optional(),
  protectionZone: ProtectionLevel.optional(),
  riskReasons: z.array(z.string()).optional(),
  parentEventHash: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  isBinary: z.boolean().optional(),
  fileSize: z.number().int().optional(),
});
export type AiActionEvent = z.infer<typeof AiActionEvent>;

export const Snapshot = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  gitCommitHash: z.string().length(40),
  label: z.string().optional(),
  fileCount: z.number().int(),
  totalSize: z.number().int(),
  isCritical: z.boolean(),
  createdAt: z.number(),
});
export type Snapshot = z.infer<typeof Snapshot>;
