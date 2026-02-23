import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { AGENT_CONSTANTS, type AgentStatus, type AgentActivity, type AgentLocation, type AgentPlan, type AgentBreadcrumb, type AgentSpawnConfig, type PromptInjection, type SimulatorConstraint } from '@voltron/shared';
import { AgentStreamParser, type LocationChangeEvent, type TokenUsageEvent } from './agent-stream-parser.js';
import { extractPlan, updatePlanProgress } from './agent-plan-extractor.js';
import { AgentSessionRepository } from '../db/repositories/agent-sessions.js';
import { AgentBreadcrumbRepository } from '../db/repositories/agent-breadcrumbs.js';
import { AgentPlanRepository } from '../db/repositories/agent-plans.js';
import { AgentInjectionRepository } from '../db/repositories/agent-injections.js';
import { SimulatorConstraintRepository } from '../db/repositories/simulator-constraints.js';
import type { EventBus } from './event-bus.js';

interface RunningAgent {
  process: ChildProcess;
  parser: AgentStreamParser;
  projectId: string;
  sessionDbId: string;
  sessionId: string;
  status: AgentStatus;
  model: string;
  prompt: string;
  targetDir: string;
  location: AgentLocation | null;
  plan: AgentPlan | null;
  breadcrumbs: AgentBreadcrumb[];
  inputTokens: number;
  outputTokens: number;
  startedAt: number;
  lastThinkingText: string;
  planDebounceTimer: ReturnType<typeof setTimeout> | null;
  killTimer: ReturnType<typeof setTimeout> | null;
}

export class AgentRunner extends EventEmitter {
  private agents = new Map<string, RunningAgent>();
  private sessionRepo = new AgentSessionRepository();
  private breadcrumbRepo = new AgentBreadcrumbRepository();
  private planRepo = new AgentPlanRepository();
  private injectionRepo = new AgentInjectionRepository();
  private constraintRepo = new SimulatorConstraintRepository();

  constructor(private eventBus: EventBus, private claudeBinary: string = AGENT_CONSTANTS.CLAUDE_BINARY) {
    super();
  }

  /**
   * Spawn a new Claude agent for a project.
   * Enforces 1 agent per project.
   */
  async spawn(config: AgentSpawnConfig): Promise<string> {
    const { projectId, model, prompt, targetDir } = config;

    // Enforce 1 agent per project
    if (this.agents.has(projectId)) {
      const existing = this.agents.get(projectId)!;
      if (['RUNNING', 'SPAWNING', 'INJECTING', 'PAUSED'].includes(existing.status)) {
        throw new Error(`Agent already running for project ${projectId} (status: ${existing.status})`);
      }
    }

    const sessionId = config.sessionId ?? randomUUID();
    const sessionDbRow = this.sessionRepo.create({
      projectId,
      sessionId,
      status: 'SPAWNING',
      model: model ?? AGENT_CONSTANTS.DEFAULT_MODEL,
      prompt,
      targetDir,
      pid: null,
      startedAt: Date.now(),
    });

    const agent: RunningAgent = {
      process: null as any,
      parser: new AgentStreamParser(),
      projectId,
      sessionDbId: sessionDbRow.id,
      sessionId,
      status: 'SPAWNING',
      model: model ?? AGENT_CONSTANTS.DEFAULT_MODEL,
      prompt,
      targetDir,
      location: null,
      plan: null,
      breadcrumbs: [],
      inputTokens: 0,
      outputTokens: 0,
      startedAt: Date.now(),
      lastThinkingText: '',
      planDebounceTimer: null,
      killTimer: null,
    };

    this.agents.set(projectId, agent);
    this.emitStatus(projectId, 'SPAWNING');

    try {
      this.spawnProcess(agent, prompt);
    } catch (err) {
      this.setStatus(agent, 'CRASHED');
      this.sessionRepo.setCrashed(sessionDbRow.id, err instanceof Error ? err.message : 'Spawn failed');
      this.agents.delete(projectId);
      throw err;
    }

    return sessionDbRow.id;
  }

  /**
   * Pause the agent (SIGTSTP).
   */
  pause(projectId: string): void {
    const agent = this.getRunningAgent(projectId);
    if (agent.status !== 'RUNNING') {
      throw new Error(`Cannot pause agent in status ${agent.status}`);
    }
    agent.process.kill('SIGTSTP');
    this.setStatus(agent, 'PAUSED');
    this.sessionRepo.setPaused(agent.sessionDbId);
  }

  /**
   * Resume a paused agent (SIGCONT).
   */
  resume(projectId: string): void {
    const agent = this.getRunningAgent(projectId);
    if (agent.status !== 'PAUSED') {
      throw new Error(`Cannot resume agent in status ${agent.status}`);
    }
    agent.process.kill('SIGCONT');
    this.setStatus(agent, 'RUNNING');
    this.sessionRepo.updateStatus(agent.sessionDbId, 'RUNNING');
  }

  /**
   * Inject a prompt into a running agent.
   * Kills current process, restarts with --continue and enriched context.
   */
  async injectPrompt(projectId: string, injection: PromptInjection): Promise<void> {
    const agent = this.getRunningAgent(projectId);
    const prevStatus = agent.status;

    // Record injection in DB
    this.injectionRepo.insert({
      sessionId: agent.sessionId,
      projectId,
      prompt: injection.prompt,
      contextFile: injection.context?.filePath ?? null,
      contextLineStart: injection.context?.lineRange?.start ?? null,
      contextLineEnd: injection.context?.lineRange?.end ?? null,
      constraints: injection.context?.constraints ? JSON.stringify(injection.context.constraints) : null,
      urgency: injection.urgency ?? 'normal',
      injectedAt: Date.now(),
      agentStatusBefore: prevStatus,
    });

    this.sessionRepo.incrementInjections(agent.sessionDbId);
    this.setStatus(agent, 'INJECTING');

    // Kill current process
    await this.killProcess(agent);

    // Build enriched prompt
    const enrichedPrompt = this.buildEnrichedPrompt(agent, injection, projectId);

    // Respawn with --continue
    this.spawnProcess(agent, enrichedPrompt, true);
  }

  /**
   * Kill an agent (SIGTERM with SIGKILL fallback).
   */
  async kill(projectId: string): Promise<void> {
    const agent = this.agents.get(projectId);
    if (!agent) return;

    this.setStatus(agent, 'STOPPING');
    await this.killProcess(agent);
    this.setStatus(agent, 'COMPLETED');
    this.sessionRepo.setCompleted(agent.sessionDbId, null);
    this.agents.delete(projectId);
  }

  /**
   * Get the current session for a project.
   */
  getSession(projectId: string): RunningAgent | null {
    return this.agents.get(projectId) ?? null;
  }

  /**
   * Get session from database.
   */
  getSessionFromDb(projectId: string) {
    return this.sessionRepo.findLatestByProject(projectId);
  }

  /**
   * Get all sessions from database.
   */
  getSessionHistory(projectId: string, limit = 50) {
    return this.sessionRepo.findByProject(projectId, limit);
  }

  /**
   * Get breadcrumbs for a project's active session.
   */
  getBreadcrumbs(projectId: string) {
    const agent = this.agents.get(projectId);
    if (agent) return agent.breadcrumbs;
    const session = this.sessionRepo.findLatestByProject(projectId);
    if (!session) return [];
    return this.breadcrumbRepo.findBySession(session.sessionId);
  }

  /**
   * Get current plan.
   */
  getPlan(projectId: string) {
    const agent = this.agents.get(projectId);
    if (agent?.plan) return agent.plan;
    const session = this.sessionRepo.findLatestByProject(projectId);
    if (!session) return null;
    const planRow = this.planRepo.findActiveBySession(session.sessionId);
    if (!planRow) return null;
    return {
      summary: planRow.summary,
      steps: JSON.parse(planRow.stepsJson),
      currentStepIndex: planRow.currentStep,
      totalSteps: planRow.totalSteps,
      confidence: planRow.confidence,
    };
  }

  /**
   * Get injection history.
   */
  getInjections(projectId: string) {
    return this.injectionRepo.findByProject(projectId);
  }

  /**
   * Shutdown all running agents.
   */
  async shutdownAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const projectId of this.agents.keys()) {
      promises.push(this.kill(projectId));
    }
    await Promise.allSettled(promises);
  }

  // ── Internal ─────────────────────────────────────────

  private spawnProcess(agent: RunningAgent, prompt: string, isContinue = false): void {
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--model', agent.model,
      '--verbose',
    ];

    if (isContinue) {
      args.push('--continue');
      args.push('--session-id', agent.sessionId);
    }

    args.push(prompt);

    const proc = spawn(this.claudeBinary, args, {
      cwd: agent.targetDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'voltron' },
    });

    agent.process = proc;
    this.sessionRepo.updatePid(agent.sessionDbId, proc.pid ?? null);
    this.setStatus(agent, 'RUNNING');
    this.sessionRepo.updateStatus(agent.sessionDbId, 'RUNNING');

    // Wire up parser
    agent.parser = new AgentStreamParser();
    this.wireParser(agent);

    proc.stdout?.on('data', (data: Buffer) => {
      agent.parser.feed(data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      this.eventBus.emit('AGENT_ERROR', {
        projectId: agent.projectId,
        error: text,
        timestamp: Date.now(),
      });
    });

    proc.on('exit', (code, signal) => {
      agent.parser.flush();
      if (agent.killTimer) {
        clearTimeout(agent.killTimer);
        agent.killTimer = null;
      }

      if (agent.status === 'INJECTING') {
        // Expected kill during injection - don't mark as completed
        return;
      }

      if (agent.status === 'STOPPING') {
        // Expected kill
        this.setStatus(agent, 'COMPLETED');
        this.sessionRepo.setCompleted(agent.sessionDbId, code);
        this.agents.delete(agent.projectId);
        return;
      }

      if (code === 0 || signal === 'SIGTERM') {
        this.setStatus(agent, 'COMPLETED');
        this.sessionRepo.setCompleted(agent.sessionDbId, code);
      } else {
        this.setStatus(agent, 'CRASHED');
        this.sessionRepo.setCrashed(agent.sessionDbId, `Exit code ${code}, signal ${signal}`);
      }
      this.agents.delete(agent.projectId);
    });

    proc.on('error', (err) => {
      this.setStatus(agent, 'CRASHED');
      this.sessionRepo.setCrashed(agent.sessionDbId, err.message);
      this.agents.delete(agent.projectId);
    });
  }

  private wireParser(agent: RunningAgent): void {
    const parser = agent.parser;
    const projectId = agent.projectId;

    parser.on('location_change', (loc: LocationChangeEvent) => {
      const location: AgentLocation = {
        filePath: loc.filePath,
        activity: loc.activity,
        toolName: loc.toolName,
        lineRange: loc.lineRange,
        timestamp: loc.timestamp,
      };
      agent.location = location;

      // Add breadcrumb
      const crumb: AgentBreadcrumb = {
        filePath: loc.filePath,
        activity: loc.activity,
        timestamp: loc.timestamp,
        toolName: loc.toolName,
      };
      agent.breadcrumbs.push(crumb);
      if (agent.breadcrumbs.length > AGENT_CONSTANTS.MAX_BREADCRUMBS) {
        agent.breadcrumbs.shift();
      }

      // Persist breadcrumb
      this.breadcrumbRepo.insert({
        sessionId: agent.sessionId,
        projectId,
        filePath: loc.filePath,
        activity: loc.activity,
        toolName: loc.toolName ?? null,
        durationMs: null,
        timestamp: loc.timestamp,
      });

      // Update plan progress if we have a plan
      if (agent.plan) {
        agent.plan = updatePlanProgress(agent.plan, loc.filePath);
        this.eventBus.emit('AGENT_PLAN_UPDATE', { projectId, plan: agent.plan });
      }

      this.eventBus.emit('AGENT_LOCATION_UPDATE', { projectId, location });
      this.eventBus.emit('AGENT_BREADCRUMB', { projectId, breadcrumb: crumb });
    });

    parser.on('thinking', (text: string) => {
      agent.lastThinkingText += text;
    });

    parser.on('plan_detected', (thinkingText: string) => {
      // Debounce plan extraction
      if (agent.planDebounceTimer) {
        clearTimeout(agent.planDebounceTimer);
      }
      agent.planDebounceTimer = setTimeout(() => {
        const result = extractPlan(agent.lastThinkingText);
        if (result && result.confidence >= 0.4) {
          agent.plan = result.plan;

          // Persist plan
          this.planRepo.insert({
            sessionId: agent.sessionId,
            projectId,
            summary: result.plan.summary,
            stepsJson: JSON.stringify(result.plan.steps),
            currentStep: result.plan.currentStepIndex,
            totalSteps: result.plan.totalSteps,
            confidence: result.confidence,
            extractedAt: Date.now(),
          });

          this.eventBus.emit('AGENT_PLAN_UPDATE', { projectId, plan: result.plan });
        }
        agent.lastThinkingText = '';
      }, AGENT_CONSTANTS.PLAN_DEBOUNCE_MS);
    });

    parser.on('text_output', (text: string) => {
      this.eventBus.emit('AGENT_OUTPUT', { projectId, text, type: 'text', timestamp: Date.now() });
    });

    parser.on('text_delta', (text: string) => {
      this.eventBus.emit('AGENT_OUTPUT', { projectId, text, type: 'delta', timestamp: Date.now() });
    });

    parser.on('tool_start', (event: { toolName: string; input: Record<string, unknown>; timestamp: number }) => {
      this.eventBus.emit('AGENT_OUTPUT', {
        projectId,
        text: `Tool: ${event.toolName}`,
        type: 'tool',
        input: event.input,
        timestamp: event.timestamp,
      });
    });

    parser.on('token_usage', (usage: TokenUsageEvent) => {
      agent.inputTokens = usage.inputTokens;
      agent.outputTokens = usage.outputTokens;
      this.sessionRepo.updateTokens(agent.sessionDbId, usage.inputTokens, usage.outputTokens);
      this.eventBus.emit('AGENT_TOKEN_USAGE', {
        projectId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
    });

    parser.on('session_end', (info: { isError: boolean; result?: string; sessionId?: string }) => {
      if (info.isError) {
        this.eventBus.emit('AGENT_ERROR', {
          projectId,
          error: info.result ?? 'Agent session ended with error',
          timestamp: Date.now(),
        });
      }
    });
  }

  private async killProcess(agent: RunningAgent): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!agent.process || agent.process.exitCode !== null) {
        resolve();
        return;
      }

      const onExit = () => {
        if (agent.killTimer) {
          clearTimeout(agent.killTimer);
          agent.killTimer = null;
        }
        resolve();
      };

      agent.process.once('exit', onExit);

      // Send SIGTERM first
      agent.process.kill('SIGTERM');

      // SIGKILL fallback after timeout
      agent.killTimer = setTimeout(() => {
        if (agent.process && agent.process.exitCode === null) {
          agent.process.kill('SIGKILL');
        }
      }, AGENT_CONSTANTS.KILL_TIMEOUT_MS);
    });
  }

  private buildEnrichedPrompt(agent: RunningAgent, injection: PromptInjection, projectId: string): string {
    const parts: string[] = [];

    // Context info
    if (injection.context?.filePath) {
      parts.push(`[Context: Currently working on ${injection.context.filePath}]`);
    }

    // Simulator constraints
    const constraints = this.constraintRepo.findPendingByProject(projectId);
    if (constraints.length > 0) {
      parts.push('[Human Operator Constraints:');
      for (const c of constraints) {
        if (c.constraintType === 'style_change') {
          parts.push(`  - Change ${c.property} of "${c.selector}" to "${c.value}"`);
        } else if (c.constraintType === 'layout_change') {
          parts.push(`  - Layout: ${c.description}`);
        } else if (c.constraintType === 'reference_image') {
          parts.push(`  - Follow reference design: ${c.description}`);
        }
      }
      parts.push(']');
    }

    // Reference image
    if (injection.context?.referenceImageUrl) {
      parts.push(`[Reference Image: ${injection.context.referenceImageUrl} - Adapt the design to match this reference]`);
    }

    // Additional constraints
    if (injection.context?.constraints?.length) {
      parts.push(`[Additional Constraints: ${injection.context.constraints.join(', ')}]`);
    }

    // The actual prompt
    parts.push(injection.prompt);

    return parts.join('\n\n');
  }

  private setStatus(agent: RunningAgent, status: AgentStatus): void {
    agent.status = status;
    this.emitStatus(agent.projectId, status);
  }

  private emitStatus(projectId: string, status: AgentStatus): void {
    const agent = this.agents.get(projectId);
    this.eventBus.emit('AGENT_STATUS_CHANGE', {
      projectId,
      status,
      sessionId: agent?.sessionId,
      location: agent?.location,
      model: agent?.model,
      pid: agent?.process?.pid,
      inputTokens: agent?.inputTokens ?? 0,
      outputTokens: agent?.outputTokens ?? 0,
      startedAt: agent?.startedAt,
      timestamp: Date.now(),
    });
  }

  private getRunningAgent(projectId: string): RunningAgent {
    const agent = this.agents.get(projectId);
    if (!agent) {
      throw new Error(`No agent running for project ${projectId}`);
    }
    return agent;
  }
}
