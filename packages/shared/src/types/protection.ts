import { z } from 'zod';
import { OperationType } from './risk.js';

export const ProtectionLevel = z.enum(['NONE', 'DO_NOT_TOUCH', 'SURGICAL_ONLY']);
export type ProtectionLevel = z.infer<typeof ProtectionLevel>;

export const ProtectionZoneConfig = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  path: z.string(),
  level: ProtectionLevel,
  reason: z.string().optional(),
  allowedOperations: z.array(OperationType).optional(),
  isSystem: z.boolean(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ProtectionZoneConfig = z.infer<typeof ProtectionZoneConfig>;
