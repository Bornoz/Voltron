import { AiActionEvent, Snapshot } from '../types/events.js';
import { ProjectConfig, CreateProjectInput, UpdateProjectInput } from '../types/project.js';
import { ProtectionZoneConfig } from '../types/protection.js';
import { WsMessage, ClientRegistration } from '../types/ws-protocol.js';

export const schemas = {
  AiActionEvent,
  Snapshot,
  ProjectConfig,
  CreateProjectInput,
  UpdateProjectInput,
  ProtectionZoneConfig,
  WsMessage,
  ClientRegistration,
} as const;
