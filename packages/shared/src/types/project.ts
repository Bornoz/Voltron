import { z } from 'zod';

export const ProjectConfig = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rootPath: z.string(),
  isActive: z.boolean(),
  watchIgnorePatterns: z.array(z.string()),
  maxFileSize: z.number().int(),
  debounceMs: z.number().int(),
  autoStopOnCritical: z.boolean(),
  snapshotRetention: z.number().int(),
  rateLimit: z.number().int(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ProjectConfig = z.infer<typeof ProjectConfig>;

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(100),
  rootPath: z.string().min(1),
  watchIgnorePatterns: z.array(z.string()).optional(),
  maxFileSize: z.number().int().optional(),
  debounceMs: z.number().int().optional(),
  autoStopOnCritical: z.boolean().optional(),
  snapshotRetention: z.number().int().optional(),
  rateLimit: z.number().int().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  name: z.string().min(1).max(100).optional(),
  watchIgnorePatterns: z.array(z.string()).optional(),
  maxFileSize: z.number().int().optional(),
  debounceMs: z.number().int().optional(),
  autoStopOnCritical: z.boolean().optional(),
  snapshotRetention: z.number().int().optional(),
  rateLimit: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;
