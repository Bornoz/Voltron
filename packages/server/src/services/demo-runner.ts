import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { AiActionEvent, RiskLevel, OperationType } from '@voltron/shared';
import type { AgentActivity } from '@voltron/shared';
import { RiskEngine, type RiskResult } from './risk-engine.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import { WS_EVENTS } from '@voltron/shared';

/** Map file operation to GPS activity */
function actionToActivity(action: OperationType): AgentActivity {
  switch (action) {
    case 'FILE_CREATE':
    case 'FILE_MODIFY':
      return 'WRITING';
    case 'FILE_DELETE':
    case 'DIR_DELETE':
      return 'EXECUTING';
    case 'CONFIG_CHANGE':
    case 'DEPENDENCY_CHANGE':
      return 'SEARCHING';
    default:
      return 'READING';
  }
}

interface DemoPhase {
  name: string;
  events: Array<{
    file: string;
    action: OperationType;
    delayMs: number;
    diff?: string;
    fileSize?: number;
    isBinary?: boolean;
  }>;
}

const DEMO_PHASES: DemoPhase[] = [
  {
    name: 'Project Setup',
    events: [
      { file: 'package.json', action: 'FILE_CREATE', delayMs: 800, diff: '+{\n+  "name": "my-app",\n+  "version": "1.0.0"\n+}' },
      { file: 'tsconfig.json', action: 'FILE_CREATE', delayMs: 600, diff: '+{\n+  "compilerOptions": { "strict": true }\n+}' },
      { file: '.gitignore', action: 'FILE_CREATE', delayMs: 400, diff: '+node_modules/\n+dist/' },
      { file: 'README.md', action: 'FILE_CREATE', delayMs: 500, diff: '+# My App\n+A new project' },
    ],
  },
  {
    name: 'Building Source',
    events: [
      { file: 'src/index.ts', action: 'FILE_CREATE', delayMs: 700, diff: '+import { app } from "./app";\n+app.listen(3000);' },
      { file: 'src/app.ts', action: 'FILE_CREATE', delayMs: 600, diff: '+import express from "express";\n+export const app = express();' },
      { file: 'src/utils/logger.ts', action: 'FILE_CREATE', delayMs: 500, diff: '+export function log(msg: string) {\n+  console.log(`[${new Date().toISOString()}] ${msg}`);\n+}' },
      { file: 'src/utils/helpers.ts', action: 'FILE_CREATE', delayMs: 400 },
      { file: 'src/__tests__/app.test.ts', action: 'FILE_CREATE', delayMs: 600, diff: '+describe("App", () => {\n+  it("should start", () => {\n+    expect(true).toBe(true);\n+  });\n+});' },
      { file: 'src/__tests__/utils.test.ts', action: 'FILE_CREATE', delayMs: 400 },
    ],
  },
  {
    name: 'Configuration Changes',
    events: [
      { file: 'src/config.ts', action: 'FILE_CREATE', delayMs: 800, diff: '+export const config = {\n+  port: 3000,\n+  dbUrl: process.env.DATABASE_URL\n+};' },
      { file: 'package.json', action: 'FILE_MODIFY', delayMs: 600, diff: '-  "version": "1.0.0"\n+  "version": "1.1.0"\n+  "dependencies": {\n+    "express": "^4.18.0"\n+  }' },
      { file: 'docker-compose.yml', action: 'FILE_CREATE', delayMs: 700, diff: '+version: "3.8"\n+services:\n+  app:\n+    build: .\n+    ports:\n+      - "3000:3000"' },
    ],
  },
  {
    name: 'DANGER: Security File Access',
    events: [
      { file: '.env', action: 'FILE_CREATE', delayMs: 1200, diff: '+DATABASE_URL=postgres://admin:secret@localhost:5432/mydb\n+API_SECRET=sk-super-secret-key-12345\n+JWT_SECRET=my-jwt-secret' },
      { file: '.env.production', action: 'FILE_CREATE', delayMs: 800, diff: '+DATABASE_URL=postgres://prod:REAL_PASSWORD@prod-db:5432/app\n+STRIPE_KEY=sk_live_XXXXX' },
    ],
  },
  {
    name: 'DANGER: Cascade Attack',
    events: [
      // Rapid-fire 20 events in different directories to trigger cascade detection
      ...Array.from({ length: 20 }, (_, i) => ({
        file: `src/modules/module-${i}/index.ts`,
        action: 'FILE_CREATE' as OperationType,
        delayMs: 50, // Very fast — triggers rate anomaly
      })),
    ],
  },
];

export class DemoRunner {
  private running = false;
  private currentPhase = 0;
  private sequenceNumber = 0;
  private timers: NodeJS.Timeout[] = [];
  private projectId: string;
  private riskEngine: RiskEngine;
  private broadcaster: Broadcaster;
  private onComplete?: () => void;

  constructor(broadcaster: Broadcaster) {
    this.projectId = 'demo-' + randomUUID().slice(0, 8);
    this.riskEngine = new RiskEngine();
    this.broadcaster = broadcaster;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get phase(): string {
    if (!this.running) return 'idle';
    return DEMO_PHASES[this.currentPhase]?.name ?? 'complete';
  }

  get sessionId(): string {
    return this.projectId;
  }

  start(onComplete?: () => void): string {
    if (this.running) throw new Error('Demo already running');

    this.running = true;
    this.currentPhase = 0;
    this.sequenceNumber = 0;
    this.projectId = 'demo-' + randomUUID().slice(0, 8);
    this.riskEngine = new RiskEngine();
    this.onComplete = onComplete;

    // Broadcast demo start
    this.broadcaster.broadcastToDashboards({
      type: 'DEMO_STATUS',
      payload: { running: true, phase: this.phase, sessionId: this.projectId },
      timestamp: Date.now(),
    });

    // Set agent status to RUNNING so GPS panel becomes visible
    this.broadcaster.broadcastToDashboards({
      type: 'AGENT_STATUS_CHANGE',
      payload: {
        projectId: this.projectId,
        status: 'RUNNING',
        sessionId: this.projectId,
        model: 'demo',
        startedAt: Date.now(),
      },
      timestamp: Date.now(),
    });

    this.schedulePhase(0);
    return this.projectId;
  }

  stop(): void {
    this.running = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];

    this.broadcaster.broadcastToDashboards({
      type: 'DEMO_STATUS',
      payload: { running: false, phase: 'stopped', sessionId: this.projectId },
      timestamp: Date.now(),
    });

    // Reset agent status
    this.broadcaster.broadcastToDashboards({
      type: 'AGENT_STATUS_CHANGE',
      payload: { projectId: this.projectId, status: 'IDLE' },
      timestamp: Date.now(),
    });
  }

  private schedulePhase(phaseIndex: number): void {
    if (!this.running || phaseIndex >= DEMO_PHASES.length) {
      // Demo complete
      this.running = false;
      this.broadcaster.broadcastToDashboards({
        type: 'DEMO_STATUS',
        payload: { running: false, phase: 'complete', sessionId: this.projectId },
        timestamp: Date.now(),
      });

      // Set agent status to COMPLETED
      this.broadcaster.broadcastToDashboards({
        type: 'AGENT_STATUS_CHANGE',
        payload: { projectId: this.projectId, status: 'COMPLETED' },
        timestamp: Date.now(),
      });

      this.onComplete?.();
      return;
    }

    this.currentPhase = phaseIndex;
    const phase = DEMO_PHASES[phaseIndex];

    // Broadcast phase change
    this.broadcaster.broadcastToDashboards({
      type: 'DEMO_STATUS',
      payload: { running: true, phase: phase.name, sessionId: this.projectId },
      timestamp: Date.now(),
    });

    // Emit a THINKING breadcrumb at phase start (agent is "planning")
    const firstFile = phase.events[0]?.file ?? 'project';
    this.broadcaster.broadcastToDashboards({
      type: 'AGENT_BREADCRUMB',
      payload: {
        breadcrumb: {
          filePath: firstFile,
          activity: 'THINKING' as AgentActivity,
          timestamp: Date.now(),
          toolName: 'Plan',
        },
        projectId: this.projectId,
      },
      timestamp: Date.now(),
    });

    let cumulativeDelay = 0;

    for (const event of phase.events) {
      cumulativeDelay += event.delayMs;

      const timer = setTimeout(() => {
        if (!this.running) return;
        this.emitEvent(event);
      }, cumulativeDelay);

      this.timers.push(timer);
    }

    // Schedule next phase after all events
    const nextPhaseTimer = setTimeout(() => {
      if (!this.running) return;
      this.schedulePhase(phaseIndex + 1);
    }, cumulativeDelay + 2000); // 2s pause between phases

    this.timers.push(nextPhaseTimer);
  }

  private emitEvent(eventDef: DemoPhase['events'][number]): void {
    const hash = createHash('sha256').update(eventDef.file + Date.now()).digest('hex');

    const event: AiActionEvent = {
      id: randomUUID(),
      sequenceNumber: this.sequenceNumber++,
      projectId: this.projectId,
      action: eventDef.action,
      file: eventDef.file,
      risk: 'NONE', // Will be overwritten by risk engine
      snapshotId: randomUUID(),
      timestamp: Date.now(),
      hash,
      diff: eventDef.diff,
      isBinary: eventDef.isBinary,
      fileSize: eventDef.fileSize,
      metadata: { demo: true },
    };

    // Run through real risk engine
    const riskResult: RiskResult = this.riskEngine.classify(event, {
      protectionZones: [],
      autoStopThreshold: 'CRITICAL',
      rateLimit: 50,
    });

    event.risk = riskResult.risk;
    event.riskReasons = riskResult.reasons;

    // Broadcast to all connected dashboards
    this.broadcaster.broadcastToDashboards({
      type: WS_EVENTS.EVENT_BROADCAST,
      payload: event,
      timestamp: Date.now(),
    });

    // Emit GPS breadcrumb so the map tracks file activity
    const activity = actionToActivity(eventDef.action);
    this.broadcaster.broadcastToDashboards({
      type: 'AGENT_BREADCRUMB',
      payload: {
        breadcrumb: {
          filePath: eventDef.file,
          activity,
          timestamp: Date.now(),
          toolName: activity === 'WRITING' ? 'Write' : 'Read',
          contentSnippet: eventDef.diff?.slice(0, 100),
        },
        projectId: this.projectId,
      },
      timestamp: Date.now(),
    });

    // Emit location update so GPS cursor moves
    this.broadcaster.broadcastToDashboards({
      type: 'AGENT_LOCATION_UPDATE',
      payload: {
        location: {
          filePath: eventDef.file,
          activity,
          timestamp: Date.now(),
          toolName: activity === 'WRITING' ? 'Write' : 'Read',
        },
        projectId: this.projectId,
      },
      timestamp: Date.now(),
    });

    // If critical, also send risk alert
    if (riskResult.risk === 'CRITICAL' || riskResult.risk === 'HIGH') {
      this.broadcaster.broadcastToDashboards({
        type: WS_EVENTS.RISK_ALERT,
        payload: {
          riskLevel: riskResult.risk,
          message: riskResult.reasons.join(', '),
          eventId: event.id,
        },
        timestamp: Date.now(),
      });
    }
  }
}
