// Types
export { RiskLevel, RISK_VALUE, OperationType } from './types/risk.js';
export { ProtectionLevel, ProtectionZoneConfig } from './types/protection.js';
export { ExecutionState, ExecutionContext } from './types/state.js';
export { AiActionEvent, Snapshot } from './types/events.js';
export { ProjectConfig, CreateProjectInput, UpdateProjectInput } from './types/project.js';
export { WsMessageType, WsMessage, ClientType, ClientRegistration } from './types/ws-protocol.js';
export {
  DependencyNode, DependencyEdge, DependencyGraph,
  BreakingChangeType, BreakingChangeReport,
  ComplianceCategory, ComplianceViolation, ArchitectureComplianceResult,
} from './types/github.js';
export {
  SimulatorMessageType, StyleChange, LayoutChange,
  ComponentPropChange, SimulatorConflict,
} from './types/simulator.js';
export {
  AgentStatus, AgentActivity, AgentLocation,
  AgentPlanStepStatus, AgentPlanStep, AgentPlan,
  AgentBreadcrumb, PromptInjection, AgentSpawnConfig,
  AgentSession, SimulatorConstraint,
} from './types/agent.js';

// Constants
export { RISK_COLORS, RISK_THRESHOLDS } from './constants/risk-levels.js';
export { SELF_PROTECTION_PATHS, DEFAULT_IGNORE_PATTERNS } from './constants/protection-zones.js';
export { WS_EVENTS } from './constants/event-names.js';
export { DEFAULTS } from './constants/defaults.js';
export { AGENT_CONSTANTS } from './constants/agent.js';

// Utils
export { hashString, hashBuffer, hashStream } from './utils/hash.js';
export { normalizePath, relativePath, isInsidePath, getFileExtension, splitPath } from './utils/path.js';
export { schemas } from './utils/validation.js';
