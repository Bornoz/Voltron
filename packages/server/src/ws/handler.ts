import { resolve, isAbsolute, normalize } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import { ClientRegistration, WsMessage, hashString, schemas, type AiActionEvent, type Snapshot } from '@voltron/shared';
import { Broadcaster } from './broadcaster.js';
import { Replayer } from './replayer.js';
import { EventBus } from '../services/event-bus.js';
import { StateMachineService } from '../services/state-machine.js';
import { RiskEngine } from '../services/risk-engine.js';
import { CircuitBreaker } from '../services/rate-monitor.js';
import { ActionRepository } from '../db/repositories/actions.js';
import { SnapshotRepository } from '../db/repositories/snapshots.js';
import { ProjectRepository } from '../db/repositories/projects.js';
import { ProtectionZoneRepository } from '../db/repositories/protection-zones.js';
import { SessionRepository } from '../db/repositories/sessions.js';
import { AgentSpawnConfig, PromptInjection, SimulatorConstraint, AGENT_CONSTANTS } from '@voltron/shared';
import type { AgentRunner } from '../services/agent-runner.js';
import { SimulatorConstraintRepository } from '../db/repositories/simulator-constraints.js';
import type { ServerConfig } from '../config.js';
import { verifyToken } from '../plugins/auth.js';

// --- Event Deduplication ---
// LRU-style set with max capacity to prevent unbounded memory growth
class EventDeduplicator {
  #seen = new Map<string, number>(); // eventId -> timestamp
  #maxSize: number;
  #ttlMs: number;

  constructor(maxSize = 10_000, ttlMs = 300_000) { // 5 min TTL
    this.#maxSize = maxSize;
    this.#ttlMs = ttlMs;
  }

  /** Returns true if event is a duplicate */
  isDuplicate(eventId: string): boolean {
    const now = Date.now();
    // Periodic cleanup when approaching capacity
    if (this.#seen.size > this.#maxSize * 0.9) {
      this.#cleanup(now);
    }
    if (this.#seen.has(eventId)) {
      return true;
    }
    this.#seen.set(eventId, now);
    return false;
  }

  #cleanup(now: number): void {
    for (const [id, ts] of this.#seen) {
      if (now - ts > this.#ttlMs) {
        this.#seen.delete(id);
      }
    }
    // If still over capacity after TTL cleanup, remove oldest entries
    if (this.#seen.size > this.#maxSize) {
      const entries = [...this.#seen.entries()].sort((a, b) => a[1] - b[1]);
      const toRemove = entries.slice(0, entries.length - this.#maxSize);
      for (const [id] of toRemove) {
        this.#seen.delete(id);
      }
    }
  }
}

// --- Sequence Number Tracker ---
class SequenceTracker {
  #sequences = new Map<string, number>(); // clientId -> last sequence number

  /** Validates and tracks sequence number. Returns false if out of order. */
  validate(clientId: string, sequenceNumber: number): { valid: boolean; expected: number; gap: number } {
    const last = this.#sequences.get(clientId) ?? 0;
    const expected = last + 1;
    const gap = sequenceNumber - expected;

    // Accept if sequence is greater than last seen (handles gaps gracefully)
    if (sequenceNumber > last) {
      this.#sequences.set(clientId, sequenceNumber);
      return { valid: true, expected, gap: Math.max(0, gap) };
    }

    // Reject: sequence number <= last seen (duplicate or reorder)
    return { valid: false, expected, gap };
  }

  remove(clientId: string): void {
    this.#sequences.delete(clientId);
  }
}

// --- Per-Client Rate Limiter ---
class ClientRateLimiter {
  #windows = new Map<string, { count: number; windowStart: number }>();
  #maxPerSecond: number;
  #windowMs = 1000;

  constructor(maxPerSecond = 100) {
    this.#maxPerSecond = maxPerSecond;
  }

  /** Returns true if the client should be throttled */
  shouldThrottle(clientId: string): boolean {
    const now = Date.now();
    let entry = this.#windows.get(clientId);

    if (!entry || now - entry.windowStart >= this.#windowMs) {
      // New window
      entry = { count: 1, windowStart: now };
      this.#windows.set(clientId, entry);
      return false;
    }

    entry.count++;
    return entry.count > this.#maxPerSecond;
  }

  remove(clientId: string): void {
    this.#windows.delete(clientId);
  }
}

export function createWsServices(config: ServerConfig, eventBus: EventBus, agentRunner?: AgentRunner) {
  const broadcaster = new Broadcaster();
  const replayer = new Replayer();
  const stateMachine = new StateMachineService(eventBus);
  const riskEngine = new RiskEngine();
  const circuitBreaker = new CircuitBreaker();
  const actionRepo = new ActionRepository();
  const snapshotRepo = new SnapshotRepository();
  const projectRepo = new ProjectRepository();
  const zoneRepo = new ProtectionZoneRepository();
  const sessionRepo = new SessionRepository();
  const deduplicator = new EventDeduplicator();
  const sequenceTracker = new SequenceTracker();
  const rateLimiter = new ClientRateLimiter(100); // 100 msg/sec per client

  const constraintRepo = new SimulatorConstraintRepository();

  // Periodic dead client cleanup
  setInterval(() => broadcaster.cleanupDead(), 30_000);

  // Wire agent EventBus listeners to broadcast to dashboards
  if (agentRunner) {
    const agentEvents = [
      'AGENT_STATUS_CHANGE',
      'AGENT_LOCATION_UPDATE',
      'AGENT_PLAN_UPDATE',
      'AGENT_BREADCRUMB',
      'AGENT_OUTPUT',
      'AGENT_TOKEN_USAGE',
      'AGENT_ERROR',
      'AGENT_PHASE_UPDATE',
      'AGENT_BREAKPOINT_HIT',
      'AGENT_BREAKPOINT_SET',
      'AGENT_BREAKPOINT_REMOVED',
      'AGENT_INJECTION_QUEUED',
      'AGENT_INJECTION_APPLIED',
      'AGENT_REDIRECTED',
      'AGENT_CHECKPOINT_SAVED',
      'DEV_SERVER_STATUS',
    ] as const;

    for (const eventType of agentEvents) {
      eventBus.on(eventType, (payload: { projectId: string; [key: string]: unknown }) => {
        broadcaster.broadcast('dashboard', payload.projectId, {
          type: eventType,
          payload,
          timestamp: Date.now(),
        });
        // Also broadcast to simulator for AGENT_STATUS_CHANGE and AGENT_LOCATION_UPDATE
        if (eventType === 'AGENT_STATUS_CHANGE' || eventType === 'AGENT_LOCATION_UPDATE') {
          broadcaster.broadcast('simulator', payload.projectId, {
            type: eventType,
            payload,
            timestamp: Date.now(),
          });
        }
      });
    }

    // Wire AgentRunner status changes to XState state machine
    eventBus.on('AGENT_STATUS_CHANGE', (payload: { projectId: string; status: string; sessionId?: string; error?: string }) => {
      const { projectId: pid, status, sessionId: sid } = payload;
      if (status === 'RUNNING' || status === 'SPAWNING') {
        stateMachine.send(pid, { type: 'AGENT_SPAWNED', sessionId: sid ?? '' }, 'agent-runner');
      } else if (status === 'COMPLETED') {
        stateMachine.send(pid, { type: 'AGENT_COMPLETED', sessionId: sid ?? '' }, 'agent-runner');
      } else if (status === 'CRASHED') {
        stateMachine.send(pid, { type: 'AGENT_CRASHED', sessionId: sid ?? '', error: (payload as Record<string, unknown>).error as string ?? 'Agent crashed' }, 'agent-runner');
      }
    });
  }

  return { broadcaster, replayer, stateMachine, riskEngine, circuitBreaker, actionRepo, snapshotRepo, projectRepo, zoneRepo, sessionRepo, deduplicator, sequenceTracker, rateLimiter, agentRunner, constraintRepo };
}

export function registerWsHandler(
  app: FastifyInstance,
  config: ServerConfig,
  services: ReturnType<typeof createWsServices>,
): void {
  const { broadcaster, replayer, stateMachine, riskEngine, circuitBreaker, actionRepo, snapshotRepo, projectRepo, zoneRepo, sessionRepo, deduplicator, sequenceTracker, rateLimiter, agentRunner, constraintRepo } = services;

  app.get('/ws', { websocket: true }, (socket: WebSocket, request) => {
    // Origin validation
    const origin = request.headers.origin;
    if (origin) {
      const allowed = config.corsOrigins.some((o) => origin === o);
      if (!allowed) {
        if (process.env.NODE_ENV === 'production') {
          socket.close(4004, 'Origin not allowed');
          return;
        }
        app.log.warn(`[WS] Connection from unrecognized origin: ${origin}`);
      }
    }

    let clientId: string | null = null;
    let registered = false;
    let throttleWarned = false;

    const timeout = setTimeout(() => {
      if (!registered) socket.close(4001, 'Registration timeout');
    }, 10_000);

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      let data: unknown;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid JSON' }, timestamp: Date.now() }));
        return;
      }

      // Handle registration
      if (!registered) {
        const reg = ClientRegistration.safeParse(data);
        if (!reg.success) {
          socket.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid registration' }, timestamp: Date.now() }));
          socket.close(4002, 'Invalid registration');
          return;
        }

        // Validate auth tokens
        if (reg.data.clientType === 'interceptor' && config.interceptorSecret) {
          if (reg.data.authToken !== config.interceptorSecret) {
            socket.close(4003, 'Invalid auth token');
            return;
          }
        } else if ((reg.data.clientType === 'dashboard' || reg.data.clientType === 'simulator') && config.authSecret) {
          // Dashboard/Simulator must provide a valid JWT auth token
          if (!reg.data.authToken || !verifyToken(reg.data.authToken, config.authSecret)) {
            socket.close(4003, 'Invalid or missing auth token');
            return;
          }
        }

        clearTimeout(timeout);
        clientId = reg.data.clientId;
        registered = true;

        broadcaster.register({
          ws: socket,
          clientId: reg.data.clientId,
          clientType: reg.data.clientType,
          projectId: reg.data.projectId,
          connectedAt: Date.now(),
        });

        try {
          sessionRepo.create({
            id: reg.data.clientId,
            clientType: reg.data.clientType,
            projectId: reg.data.projectId,
            connectedAt: Date.now(),
          });
        } catch (err) {
          // Session upsert failed - non-fatal, continue
          console.warn('[WS] Session create failed:', err instanceof Error ? err.message : err);
        }

        // Replay missed events
        if (reg.data.lastSequenceNumber !== undefined) {
          try {
            const missed = replayer.getMissedEvents(reg.data.projectId, reg.data.lastSequenceNumber, reg.data.clientId);
            for (const msg of missed) {
              socket.send(JSON.stringify(msg));
            }
          } catch (err) {
            console.warn('[WS] Replay failed:', err instanceof Error ? err.message : err);
          }
        }

        // Send current state
        try {
          const state = stateMachine.getState(reg.data.projectId);
          socket.send(JSON.stringify({
            type: 'STATE_CHANGE',
            payload: state,
            timestamp: Date.now(),
          }));
        } catch (err) {
          console.warn('[WS] State send failed:', err instanceof Error ? err.message : err);
        }

        return;
      }

      // --- Per-client rate limiting ---
      if (clientId && rateLimiter.shouldThrottle(clientId)) {
        if (!throttleWarned) {
          socket.send(JSON.stringify({
            type: 'ERROR',
            payload: { message: 'Rate limit exceeded (>100 msg/sec). Messages are being dropped.' },
            timestamp: Date.now(),
          }));
          throttleWarned = true;
          // Reset warning flag after 1 second
          setTimeout(() => { throttleWarned = false; }, 1000);
        }
        return; // Drop the message
      }

      // Handle regular messages
      const msg = WsMessage.safeParse(data);
      if (!msg.success) {
        socket.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid message format' }, timestamp: Date.now() }));
        return;
      }

      const client = clientId ? broadcaster.getClient(clientId) : null;
      if (!client) return;

      try {
        handleMessage(msg.data, client.projectId, client.clientType, clientId!, {
          broadcaster, stateMachine, riskEngine, circuitBreaker, actionRepo, snapshotRepo, projectRepo, zoneRepo, sessionRepo, deduplicator, sequenceTracker, agentRunner, constraintRepo,
        }, socket);
      } catch (err) {
        console.error('[WS] handleMessage error:', err instanceof Error ? err.message : err);
        socket.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Internal server error processing message' },
          timestamp: Date.now(),
        }));
      }
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      if (clientId) {
        try {
          sessionRepo.disconnect(clientId);
        } catch { /* non-fatal */ }
        broadcaster.unregister(clientId);
        sequenceTracker.remove(clientId);
        rateLimiter.remove(clientId);
      }
    });
  });
}

async function handleMessage(
  msg: WsMessage,
  projectId: string,
  clientType: string,
  clientId: string,
  services: Pick<ReturnType<typeof createWsServices>, 'broadcaster' | 'stateMachine' | 'riskEngine' | 'circuitBreaker' | 'actionRepo' | 'snapshotRepo' | 'projectRepo' | 'zoneRepo' | 'sessionRepo' | 'deduplicator' | 'sequenceTracker' | 'agentRunner' | 'constraintRepo'>,
  socket: WebSocket,
): Promise<void> {
  const { broadcaster, stateMachine, riskEngine, circuitBreaker, actionRepo, snapshotRepo, projectRepo, zoneRepo, sessionRepo, deduplicator, sequenceTracker } = services;

  switch (msg.type) {
    case 'ACTION_EVENT': {
      if (clientType !== 'interceptor') return;
      const parsed = schemas.AiActionEvent.safeParse(msg.payload);
      if (!parsed.success) {
        socket.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid ACTION_EVENT payload', details: parsed.error.issues },
          timestamp: Date.now(),
        }));
        return;
      }
      const event = parsed.data;

      // --- Event UUID Deduplication ---
      if (deduplicator.isDuplicate(event.id)) {
        // Still ACK so the client doesn't retry, but don't process again
        socket.send(JSON.stringify({
          type: 'ACK',
          payload: { eventId: event.id, duplicate: true },
          correlationId: msg.correlationId,
          timestamp: Date.now(),
        }));
        return;
      }

      // --- Sequence Number Tracking ---
      if (event.sequenceNumber !== undefined) {
        const seqResult = sequenceTracker.validate(clientId, event.sequenceNumber);
        if (!seqResult.valid) {
          // Out-of-order or duplicate sequence - ACK but skip processing
          socket.send(JSON.stringify({
            type: 'ACK',
            payload: { eventId: event.id, outOfOrder: true, expected: seqResult.expected },
            correlationId: msg.correlationId,
            timestamp: Date.now(),
          }));
          return;
        }
        // Warn about gaps (missing events) but still process
        if (seqResult.gap > 0) {
          socket.send(JSON.stringify({
            type: 'WARNING',
            payload: { message: `Sequence gap detected: expected ${seqResult.expected}, got ${event.sequenceNumber}. ${seqResult.gap} event(s) may be missing.` },
            timestamp: Date.now(),
          }));
        }
      }

      // Get project and zones for risk classification
      const project = projectRepo.findById(projectId);
      if (!project) return;

      const zones = zoneRepo.findByProject(projectId);
      const riskResult = riskEngine.classify(event, {
        protectionZones: zones,
        autoStopThreshold: project.autoStopOnCritical ? 'CRITICAL' : 'NONE' as any,
        rateLimit: project.rateLimit,
      });

      // Verify hash chain continuity
      if (event.parentEventHash) {
        const lastEvent = actionRepo.getLatestForProject(projectId);
        if (lastEvent && lastEvent.id) {
          const expectedParent = hashString(lastEvent.id + lastEvent.hash);
          if (event.parentEventHash !== expectedParent) {
            console.warn(`[WS] Hash chain break detected! Expected ${expectedParent.substring(0, 8)}, got ${event.parentEventHash.substring(0, 8)}`);
            // Don't reject - log warning and continue (could be reconnect gap)
          }
        }
      }

      // Update event with risk info
      const enrichedEvent = { ...event, risk: riskResult.risk, riskReasons: riskResult.reasons };

      // Store in DB
      actionRepo.insert(enrichedEvent);

      // Circuit breaker
      circuitBreaker.recordEvent(event.timestamp);

      // State machine
      stateMachine.send(projectId, {
        type: 'ACTION_EVENT',
        snapshotId: event.snapshotId,
        eventId: event.id,
      });

      // Auto-stop
      if (riskResult.shouldAutoStop) {
        stateMachine.send(projectId, {
          type: 'AUTO_STOP',
          reason: `Auto-stop: ${riskResult.reasons.join(', ')}`,
          timestamp: Date.now(),
        }, 'system');
        broadcaster.broadcast('interceptor', projectId, {
          type: 'COMMAND_STOP',
          payload: { reason: 'auto_stop' },
          timestamp: Date.now(),
        });
      }

      // Broadcast to dashboards
      broadcaster.broadcast('dashboard', projectId, {
        type: 'EVENT_BROADCAST',
        payload: enrichedEvent,
        timestamp: Date.now(),
      });

      // Risk alert for HIGH+
      if (['HIGH', 'CRITICAL'].includes(riskResult.risk)) {
        broadcaster.broadcast('dashboard', projectId, {
          type: 'RISK_ALERT',
          payload: { event: enrichedEvent, riskResult },
          timestamp: Date.now(),
        });
      }

      // ACK
      socket.send(JSON.stringify({
        type: 'ACK',
        payload: { eventId: event.id },
        correlationId: msg.correlationId,
        timestamp: Date.now(),
      }));
      break;
    }

    case 'SNAPSHOT_CREATED': {
      if (clientType !== 'interceptor') return;
      const snapParsed = schemas.Snapshot.safeParse(msg.payload);
      if (!snapParsed.success) {
        socket.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid SNAPSHOT_CREATED payload', details: snapParsed.error.issues },
          timestamp: Date.now(),
        }));
        return;
      }
      snapshotRepo.insert(snapParsed.data);
      break;
    }

    case 'COMMAND_STOP': {
      if (clientType !== 'dashboard') return;
      sessionRepo.incrementCommands(clientId);
      stateMachine.send(projectId, {
        type: 'STOP_CMD',
        reason: 'operator',
        timestamp: Date.now(),
      }, clientId);
      broadcaster.broadcast('interceptor', projectId, {
        type: 'COMMAND_STOP',
        payload: { reason: 'operator' },
        timestamp: Date.now(),
      });
      break;
    }

    case 'COMMAND_CONTINUE': {
      if (clientType !== 'dashboard') return;
      sessionRepo.incrementCommands(clientId);
      stateMachine.send(projectId, { type: 'CONTINUE_CMD' }, clientId);
      // Auto-complete resume
      setTimeout(() => {
        stateMachine.send(projectId, { type: 'RESUME_COMPLETE' }, 'system');
      }, 500);
      broadcaster.broadcast('interceptor', projectId, {
        type: 'COMMAND_CONTINUE',
        payload: {},
        timestamp: Date.now(),
      });
      break;
    }

    case 'COMMAND_RESET': {
      if (clientType !== 'dashboard') return;
      sessionRepo.incrementCommands(clientId);
      stateMachine.send(projectId, { type: 'RESET_CMD' }, clientId);
      circuitBreaker.reset();
      break;
    }

    case 'INTERCEPTOR_HEARTBEAT': {
      socket.send(JSON.stringify({ type: 'ACK', payload: { heartbeat: true }, timestamp: Date.now() }));
      break;
    }

    case 'SIMULATOR_PATCH':
    case 'SIMULATOR_RESYNC':
    case 'SIMULATOR_SNAPSHOT':
    case 'SIMULATOR_CONFLICT': {
      // Relay to appropriate targets
      const targetType = clientType === 'simulator' ? 'dashboard' : 'simulator';
      broadcaster.broadcast(targetType as any, projectId, msg);
      break;
    }

    // ── Agent Commands (Dashboard -> Server) ────────────
    case 'AGENT_SPAWN': {
      if (clientType !== 'dashboard') return;
      const { agentRunner } = services as typeof services & { agentRunner?: AgentRunner };
      if (!agentRunner) return;
      const SpawnPayloadSchema = z.object({
        model: z.string().optional(),
        prompt: z.string().min(1),
        targetDir: z.string().min(1),
      });
      const spawnParsed = SpawnPayloadSchema.safeParse(msg.payload);
      if (!spawnParsed.success) {
        socket.send(JSON.stringify({ type: 'AGENT_ERROR', payload: { error: 'Invalid spawn payload' }, timestamp: Date.now() }));
        return;
      }
      const spawnPayload = spawnParsed.data;

      // Resolve targetDir relative to project rootPath
      const project = projectRepo.findById(projectId);
      const resolvedDir = project && !isAbsolute(spawnPayload.targetDir)
        ? resolve(project.rootPath, spawnPayload.targetDir)
        : spawnPayload.targetDir;

      // Path traversal protection
      const BLOCKED_PATHS = ['/etc', '/usr', '/bin', '/sbin', '/boot', '/proc', '/sys', '/dev', '/var/run'];
      const normalizedDir = normalize(resolvedDir);
      if (BLOCKED_PATHS.some((bp) => normalizedDir === bp || normalizedDir.startsWith(bp + '/'))) {
        socket.send(JSON.stringify({ type: 'AGENT_ERROR', payload: { error: 'Target directory is in a protected zone' }, timestamp: Date.now() }));
        return;
      }

      try {
        const sessionId = await agentRunner.spawn({
          projectId,
          model: spawnPayload.model ?? AGENT_CONSTANTS.DEFAULT_MODEL,
          prompt: spawnPayload.prompt,
          targetDir: resolvedDir,
        });
        socket.send(JSON.stringify({ type: 'ACK', payload: { sessionId, status: 'SPAWNING' }, correlationId: msg.correlationId, timestamp: Date.now() }));
      } catch (err) {
        socket.send(JSON.stringify({ type: 'AGENT_ERROR', payload: { error: err instanceof Error ? err.message : 'Spawn failed' }, timestamp: Date.now() }));
      }
      break;
    }

    case 'AGENT_STOP': {
      if (clientType !== 'dashboard') return;
      const { agentRunner: runner1 } = services as typeof services & { agentRunner?: AgentRunner };
      if (!runner1) return;
      try {
        runner1.pause(projectId);
      } catch (err) {
        socket.send(JSON.stringify({ type: 'AGENT_ERROR', payload: { error: err instanceof Error ? err.message : 'Stop failed' }, timestamp: Date.now() }));
      }
      break;
    }

    case 'AGENT_RESUME': {
      if (clientType !== 'dashboard') return;
      const { agentRunner: runner2 } = services as typeof services & { agentRunner?: AgentRunner };
      if (!runner2) return;
      try {
        runner2.resume(projectId);
      } catch (err) {
        socket.send(JSON.stringify({ type: 'AGENT_ERROR', payload: { error: err instanceof Error ? err.message : 'Resume failed' }, timestamp: Date.now() }));
      }
      break;
    }

    case 'AGENT_KILL': {
      if (clientType !== 'dashboard') return;
      const { agentRunner: runner3 } = services as typeof services & { agentRunner?: AgentRunner };
      if (!runner3) return;
      try {
        await runner3.kill(projectId);
      } catch (err) {
        socket.send(JSON.stringify({ type: 'AGENT_ERROR', payload: { error: err instanceof Error ? err.message : 'Kill failed' }, timestamp: Date.now() }));
      }
      break;
    }

    case 'AGENT_INJECT_PROMPT': {
      if (clientType !== 'dashboard') return;
      const { agentRunner: runner4 } = services as typeof services & { agentRunner?: AgentRunner };
      if (!runner4) return;
      const InjectPayloadSchema = z.object({
        prompt: z.string().min(1),
        context: z.record(z.unknown()).optional(),
        urgency: z.enum(['low', 'normal', 'high']).optional(),
      });
      const injectParsed = InjectPayloadSchema.safeParse(msg.payload);
      if (!injectParsed.success) {
        socket.send(JSON.stringify({ type: 'AGENT_ERROR', payload: { error: 'Invalid inject payload' }, timestamp: Date.now() }));
        return;
      }
      const injectPayload = injectParsed.data;
      try {
        await runner4.injectPrompt(projectId, {
          prompt: injectPayload.prompt,
          context: injectPayload.context as PromptInjection['context'],
          urgency: injectPayload.urgency ?? 'normal',
        });
      } catch (err) {
        socket.send(JSON.stringify({ type: 'AGENT_ERROR', payload: { error: err instanceof Error ? err.message : 'Inject failed' }, timestamp: Date.now() }));
      }
      break;
    }

    // ── Simulator Constraints ───────────────────────────
    case 'SIMULATOR_CONSTRAINT': {
      if (clientType !== 'simulator') return;
      const constraintPayload = msg.payload as { type: string; selector?: string; property?: string; value?: string; description: string };
      const { constraintRepo, agentRunner: runner5 } = services as typeof services & { constraintRepo?: SimulatorConstraintRepository; agentRunner?: AgentRunner };
      if (!constraintRepo) break;
      const session = runner5?.getSession(projectId);
      constraintRepo.insert({
        sessionId: session?.sessionId ?? 'none',
        projectId,
        constraintType: constraintPayload.type,
        selector: constraintPayload.selector ?? null,
        property: constraintPayload.property ?? null,
        value: constraintPayload.value ?? null,
        imageUrl: null,
        description: constraintPayload.description,
        appliedAt: Date.now(),
      });
      // Relay to dashboard
      broadcaster.broadcast('dashboard', projectId, {
        type: 'SIMULATOR_CONSTRAINT',
        payload: constraintPayload,
        timestamp: Date.now(),
      });
      break;
    }

    case 'SIMULATOR_REFERENCE_IMAGE': {
      if (clientType !== 'simulator') return;
      const imagePayload = msg.payload as { imageUrl: string; description: string };
      const { constraintRepo: cRepo2, agentRunner: runner6 } = services as typeof services & { constraintRepo?: SimulatorConstraintRepository; agentRunner?: AgentRunner };
      if (!cRepo2) break;
      const sess = runner6?.getSession(projectId);
      cRepo2.insert({
        sessionId: sess?.sessionId ?? 'none',
        projectId,
        constraintType: 'reference_image',
        selector: null,
        property: null,
        value: null,
        imageUrl: imagePayload.imageUrl,
        description: imagePayload.description,
        appliedAt: Date.now(),
      });
      // Relay to dashboard
      broadcaster.broadcast('dashboard', projectId, {
        type: 'SIMULATOR_REFERENCE_IMAGE',
        payload: imagePayload,
        timestamp: Date.now(),
      });
      break;
    }

    // ── Design Snapshot (Simulator -> Server) ────────────
    case 'SIMULATOR_DESIGN_SNAPSHOT': {
      if (clientType !== 'simulator') return;
      const designPayload = msg.payload as {
        addedElements: Array<{ selector: string; html: string; parentSelector: string }>;
        deletedElements: Array<{ selector: string; outerHTML: string; parentSelector: string }>;
        movedElements: Array<{ selector: string; deltaX: number; deltaY: number }>;
        styleChanges: Array<{ selector: string; property: string; oldValue: string; newValue: string }>;
        timestamp: number;
      };
      const { constraintRepo: cRepo3, agentRunner: runner7 } = services as typeof services & { constraintRepo?: SimulatorConstraintRepository; agentRunner?: AgentRunner };

      // Store as a design_snapshot constraint
      if (cRepo3) {
        const session7 = runner7?.getSession(projectId);
        cRepo3.insert({
          sessionId: session7?.sessionId ?? 'none',
          projectId,
          constraintType: 'design_snapshot',
          selector: null,
          property: null,
          value: JSON.stringify(designPayload),
          imageUrl: null,
          description: buildDesignSnapshotDescription(designPayload),
          appliedAt: Date.now(),
        });
      }

      // If agent is running, inject the design changes as a prompt
      if (runner7) {
        const activeSession = runner7.getSession(projectId);
        if (activeSession && ['RUNNING', 'PAUSED'].includes(activeSession.status)) {
          const designPrompt = buildDesignSnapshotPrompt(designPayload);
          try {
            await runner7.injectPrompt(projectId, {
              prompt: designPrompt,
              urgency: 'high',
            });
          } catch (err) {
            console.warn('[WS] Design snapshot injection failed:', err instanceof Error ? err.message : err);
          }
        }
      }

      // Relay to dashboard
      broadcaster.broadcast('dashboard', projectId, {
        type: 'SIMULATOR_DESIGN_SNAPSHOT',
        payload: designPayload,
        timestamp: Date.now(),
      });
      break;
    }
  }
}

/**
 * Build a human-readable description of a design snapshot.
 */
function buildDesignSnapshotDescription(snapshot: {
  addedElements: unknown[];
  deletedElements: unknown[];
  movedElements: unknown[];
  styleChanges: unknown[];
}): string {
  const parts: string[] = [];
  if (snapshot.addedElements.length > 0) parts.push(`${snapshot.addedElements.length} added`);
  if (snapshot.deletedElements.length > 0) parts.push(`${snapshot.deletedElements.length} deleted`);
  if (snapshot.movedElements.length > 0) parts.push(`${snapshot.movedElements.length} moved`);
  if (snapshot.styleChanges.length > 0) parts.push(`${snapshot.styleChanges.length} styled`);
  return `Design snapshot: ${parts.join(', ') || 'no changes'}`;
}

/**
 * Build a prompt string from design snapshot for injecting into the agent.
 */
function buildDesignSnapshotPrompt(snapshot: {
  addedElements: Array<{ selector: string; html: string; parentSelector: string }>;
  deletedElements: Array<{ selector: string; outerHTML: string; parentSelector: string }>;
  movedElements: Array<{ selector: string; deltaX: number; deltaY: number }>;
  styleChanges: Array<{ selector: string; property: string; oldValue: string; newValue: string }>;
}): string {
  const lines: string[] = [
    '[Human Operator Design Changes - Apply these to the source code:]',
    '',
  ];

  if (snapshot.addedElements.length > 0) {
    lines.push('ADDED ELEMENTS:');
    for (const el of snapshot.addedElements) {
      lines.push(`  - Added to "${el.parentSelector}": ${el.html.substring(0, 200)}`);
    }
    lines.push('');
  }

  if (snapshot.deletedElements.length > 0) {
    lines.push('DELETED ELEMENTS:');
    for (const el of snapshot.deletedElements) {
      lines.push(`  - Removed from "${el.parentSelector}": element matching "${el.selector}"`);
    }
    lines.push('');
  }

  if (snapshot.movedElements.length > 0) {
    lines.push('REPOSITIONED ELEMENTS:');
    for (const el of snapshot.movedElements) {
      lines.push(`  - Move "${el.selector}" by (${el.deltaX}px, ${el.deltaY}px)`);
    }
    lines.push('');
  }

  if (snapshot.styleChanges.length > 0) {
    lines.push('STYLE CHANGES:');
    for (const sc of snapshot.styleChanges) {
      lines.push(`  - "${sc.selector}": ${sc.property}: ${sc.oldValue} -> ${sc.newValue}`);
    }
    lines.push('');
  }

  lines.push('Please update the source code to reflect these visual changes made by the human operator.');

  return lines.join('\n');
}
