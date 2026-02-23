import { z } from 'zod';

export const WsMessageType = z.enum([
  // Interceptor -> Server
  'ACTION_EVENT',
  'SNAPSHOT_CREATED',
  'PROTECTION_VIOLATION',
  'INTERCEPTOR_HEARTBEAT',
  'INTERCEPTOR_STATUS',

  // Server -> Interceptor
  'COMMAND_STOP',
  'COMMAND_CONTINUE',
  'ZONE_UPDATE',
  'CONFIG_UPDATE',
  'ACK',

  // Server -> Dashboard
  'EVENT_BROADCAST',
  'STATE_CHANGE',
  'RISK_ALERT',
  'STATS_UPDATE',
  'ZONE_BROADCAST',

  // Dashboard -> Server
  'COMMAND_RESET',
  'COMMAND_ROLLBACK',
  'SUBSCRIBE',
  'UNSUBSCRIBE',

  // UI Simulator <-> Server
  'SIMULATOR_PATCH',
  'SIMULATOR_RESYNC',
  'SIMULATOR_SNAPSHOT',
  'SIMULATOR_CONFLICT',

  // Server -> Dashboard (Agent)
  'AGENT_STATUS_CHANGE',
  'AGENT_LOCATION_UPDATE',
  'AGENT_PLAN_UPDATE',
  'AGENT_BREADCRUMB',
  'AGENT_OUTPUT',
  'AGENT_TOKEN_USAGE',
  'AGENT_ERROR',

  // Dashboard -> Server (Agent)
  'AGENT_SPAWN',
  'AGENT_STOP',
  'AGENT_RESUME',
  'AGENT_KILL',
  'AGENT_INJECT_PROMPT',

  // Simulator -> Server (Agent Constraints)
  'SIMULATOR_CONSTRAINT',
  'SIMULATOR_REFERENCE_IMAGE',

  // Simulator -> Server (Design Snapshot)
  'SIMULATOR_DESIGN_SNAPSHOT',
]);
export type WsMessageType = z.infer<typeof WsMessageType>;

export const WsMessage = z.object({
  type: WsMessageType,
  payload: z.unknown(),
  correlationId: z.string().uuid().optional(),
  sequenceNumber: z.number().int().optional(),
  timestamp: z.number(),
  clientId: z.string().uuid().optional(),
});
export type WsMessage = z.infer<typeof WsMessage>;

export const ClientType = z.enum(['interceptor', 'dashboard', 'simulator']);
export type ClientType = z.infer<typeof ClientType>;

export const ClientRegistration = z.object({
  type: z.literal('REGISTER'),
  clientType: ClientType,
  clientId: z.string().uuid(),
  projectId: z.string().uuid(),
  authToken: z.string().optional(),
  lastSequenceNumber: z.number().int().optional(),
});
export type ClientRegistration = z.infer<typeof ClientRegistration>;
