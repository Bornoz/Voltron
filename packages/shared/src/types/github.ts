import { z } from 'zod';
import { RiskLevel } from './risk.js';

export const DependencyNode = z.object({
  name: z.string(),
  version: z.string(),
  isDirect: z.boolean(),
  dependents: z.array(z.string()),
  isDevDependency: z.boolean(),
  hasKnownVulnerabilities: z.boolean().optional(),
  latestVersion: z.string().optional(),
});
export type DependencyNode = z.infer<typeof DependencyNode>;

export const DependencyEdge = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(['runtime', 'dev', 'peer', 'optional']),
});
export type DependencyEdge = z.infer<typeof DependencyEdge>;

export const DependencyGraph = z.object({
  nodes: z.array(DependencyNode),
  edges: z.array(DependencyEdge),
  cycles: z.array(z.array(z.string())),
  totalCount: z.number().int(),
});
export type DependencyGraph = z.infer<typeof DependencyGraph>;

export const BreakingChangeType = z.enum([
  'API_SIGNATURE', 'TYPE_CHANGE', 'REMOVAL', 'BEHAVIORAL',
  'DEPENDENCY_UPGRADE', 'ENUM_CHANGE', 'SCHEMA_CHANGE',
]);
export type BreakingChangeType = z.infer<typeof BreakingChangeType>;

export const BreakingChangeReport = z.object({
  file: z.string(),
  changeType: BreakingChangeType,
  severity: RiskLevel,
  confidence: z.number().min(0).max(1),
  description: z.string(),
  affectedDependents: z.array(z.string()),
  suggestedFix: z.string().optional(),
});
export type BreakingChangeReport = z.infer<typeof BreakingChangeReport>;

export const ComplianceCategory = z.enum([
  'STRUCTURE', 'DEPENDENCY', 'NAMING', 'PATTERN', 'SECURITY', 'PERFORMANCE',
]);
export type ComplianceCategory = z.infer<typeof ComplianceCategory>;

export const ComplianceViolation = z.object({
  file: z.string(),
  line: z.number().optional(),
  message: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
});
export type ComplianceViolation = z.infer<typeof ComplianceViolation>;

export const ArchitectureComplianceResult = z.object({
  rule: z.string(),
  category: ComplianceCategory,
  passed: z.boolean(),
  violations: z.array(ComplianceViolation),
});
export type ArchitectureComplianceResult = z.infer<typeof ArchitectureComplianceResult>;
