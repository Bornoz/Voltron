import { z } from 'zod';

/** Tier determines what Voltron can do with this tool */
export const AiToolTier = z.enum(['spawn', 'monitor', 'readonly']);
export type AiToolTier = z.infer<typeof AiToolTier>;

/** Known AI CLI tool identifiers */
export const AiToolId = z.enum([
  'claude-code',
  'aider',
  'codex-cli',
  'cursor',
  'github-copilot',
  'windsurf',
]);
export type AiToolId = z.infer<typeof AiToolId>;

/** Detection status for a single tool */
export const AiToolStatus = z.enum(['detected', 'not_found', 'error', 'scanning']);
export type AiToolStatus = z.infer<typeof AiToolStatus>;

/** Result of detecting a single AI tool */
export const AiToolDetectionResult = z.object({
  toolId: AiToolId,
  name: z.string(),
  status: AiToolStatus,
  tier: AiToolTier,
  version: z.string().nullable(),
  binaryPath: z.string().nullable(),
  detectedVia: z.string(),
  capabilities: z.object({
    canSpawn: z.boolean(),
    canMonitor: z.boolean(),
    structuredOutput: z.boolean(),
  }),
  error: z.string().nullable(),
  detectedAt: z.number(),
  scanDurationMs: z.number(),
});
export type AiToolDetectionResult = z.infer<typeof AiToolDetectionResult>;

/** Result of a full system scan */
export const AiToolScanResult = z.object({
  tools: z.array(AiToolDetectionResult),
  scannedAt: z.number(),
  totalDurationMs: z.number(),
  platform: z.enum(['linux', 'darwin', 'win32', 'unknown']),
});
export type AiToolScanResult = z.infer<typeof AiToolScanResult>;
