import { z } from 'zod';

export const RiskLevel = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const RISK_VALUE: Record<RiskLevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const OperationType = z.enum([
  'FILE_CREATE', 'FILE_MODIFY', 'FILE_DELETE', 'FILE_RENAME',
  'DIR_CREATE', 'DIR_DELETE', 'DEPENDENCY_CHANGE', 'CONFIG_CHANGE',
]);
export type OperationType = z.infer<typeof OperationType>;
