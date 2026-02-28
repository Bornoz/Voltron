import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { openSync, existsSync, mkdirSync } from 'node:fs';
import { AGENT_CONSTANTS, type AgentStatus, type AgentActivity, type AgentLocation, type AgentPlan, type AgentBreadcrumb, type AgentSpawnConfig, type PromptInjection, type SimulatorConstraint } from '@voltron/shared';
import { AgentStreamParser, type LocationChangeEvent, type TokenUsageEvent } from './agent-stream-parser.js';
import { extractPlan, updatePlanProgress } from './agent-plan-extractor.js';
import { AgentSessionRepository } from '../db/repositories/agent-sessions.js';
import { AgentBreadcrumbRepository } from '../db/repositories/agent-breadcrumbs.js';
import { AgentPlanRepository } from '../db/repositories/agent-plans.js';
import { AgentCheckpointRepository } from '../db/repositories/agent-checkpoints.js';
import { AgentInjectionRepository } from '../db/repositories/agent-injections.js';
import { SimulatorConstraintRepository } from '../db/repositories/simulator-constraints.js';
import { ProjectRulesRepository } from '../db/repositories/project-rules.js';
import { ProjectMemoryRepository } from '../db/repositories/project-memory.js';
import type { EventBus } from './event-bus.js';
import { FileUploadRepository } from '../db/repositories/file-uploads.js';
import type { DevServerManager } from './dev-server-manager.js';

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
  lastTextOutput: string;
  hasReceivedThinking: boolean;
  planDebounceTimer: ReturnType<typeof setTimeout> | null;
  textPlanDebounceTimer: ReturnType<typeof setTimeout> | null;
  killTimer: ReturnType<typeof setTimeout> | null;
  // Soft pause
  paused: boolean;
  pausedEventQueue: Array<{ event: string; payload: unknown }>;
  // Breakpoints (Phase 4)
  breakpoints: Set<string>;
  // Injection queue (Phase 4)
  injectionQueue: Array<{ id: string; injection: PromptInjection; queuedAt: number }>;
  lastToolInput: Record<string, unknown> | null;
  // Live preview: debounce dev server start
  _devServerDebounce: ReturnType<typeof setTimeout> | null;
  // Session end tracking for completion detection
  _sessionEnded: boolean;
  _sessionEndError: boolean;
  // Agent timeout timer
  _timeoutTimer: ReturnType<typeof setTimeout> | null;
  // Resume retry tracking
  _isResume: boolean;
  _resumeRetried: boolean;
  _spawnPrompt: string;
  _eventsReceived: number;
  _stderrBuffer: string;
}

export class AgentRunner extends EventEmitter {
  private agents = new Map<string, RunningAgent>();
  private sessionRepo = new AgentSessionRepository();
  private breadcrumbRepo = new AgentBreadcrumbRepository();
  private planRepo = new AgentPlanRepository();
  private injectionRepo = new AgentInjectionRepository();
  private constraintRepo = new SimulatorConstraintRepository();
  private checkpointRepo = new AgentCheckpointRepository();
  private rulesRepo = new ProjectRulesRepository();
  private memoryRepo = new ProjectMemoryRepository();
  private uploadRepo = new FileUploadRepository();

  constructor(
    private eventBus: EventBus,
    private claudeBinary: string = AGENT_CONSTANTS.CLAUDE_BINARY,
    private devServerManager?: DevServerManager,
  ) {
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

    // Check for existing COMPLETED session to RESUME (AI memory continuity)
    // Only create a truly new session for brand new projects with no successful history
    const lastSession = this.sessionRepo.findLatestCompletedByProject(projectId);
    const isResume = !!lastSession && !config.sessionId;
    const sessionId = config.sessionId ?? (lastSession?.sessionId ?? randomUUID());

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
      lastTextOutput: '',
      hasReceivedThinking: false,
      planDebounceTimer: null,
      textPlanDebounceTimer: null,
      killTimer: null,
      paused: false,
      pausedEventQueue: [],
      breakpoints: new Set(),
      injectionQueue: [],
      lastToolInput: null,
      _devServerDebounce: null,
      _sessionEnded: false,
      _sessionEndError: false,
      _timeoutTimer: null,
      _isResume: isResume,
      _resumeRetried: false,
      _spawnPrompt: '',
      _eventsReceived: 0,
      _stderrBuffer: '',
    };

    this.agents.set(projectId, agent);

    if (isResume) {
      console.log(`[AgentRunner] Resuming existing session for project=${projectId}, session=${sessionId}, model=${agent.model}`);
    } else {
      console.log(`[AgentRunner] Spawning NEW agent for project=${projectId}, session=${sessionId}, model=${agent.model}, targetDir=${targetDir}`);
    }
    this.emitStatus(projectId, 'SPAWNING');

    // Ensure targetDir exists before spawning
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Enrich prompt with project rules + pinned memory
    const enrichedSpawnPrompt = this.buildSpawnPrompt(projectId, prompt);
    agent._spawnPrompt = enrichedSpawnPrompt;

    try {
      if (isResume) {
        // Resume existing session — AI remembers all previous work
        this.spawnProcess(agent, enrichedSpawnPrompt, true, sessionId);
      } else {
        // Brand new project — fresh session
        this.spawnProcess(agent, enrichedSpawnPrompt);
      }
    } catch (err) {
      this.setStatus(agent, 'CRASHED');
      this.sessionRepo.setCrashed(sessionDbRow.id, err instanceof Error ? err.message : 'Spawn failed');
      this.agents.delete(projectId);
      throw err;
    }

    return sessionDbRow.id;
  }

  /**
   * Soft pause: process keeps running but EventBus emissions are queued.
   * This avoids SIGTSTP which kills the stream.
   */
  pause(projectId: string): void {
    const agent = this.getRunningAgent(projectId);
    if (agent.status !== 'RUNNING') {
      throw new Error(`Cannot pause agent in status ${agent.status}`);
    }
    agent.paused = true;
    agent.pausedEventQueue = [];
    this.setStatus(agent, 'PAUSED');
    this.sessionRepo.setPaused(agent.sessionDbId);
  }

  /**
   * Resume: flush queued events and continue.
   */
  resume(projectId: string): void {
    const agent = this.getRunningAgent(projectId);
    if (agent.status !== 'PAUSED') {
      throw new Error(`Cannot resume agent in status ${agent.status}`);
    }
    agent.paused = false;
    this.setStatus(agent, 'RUNNING');
    this.sessionRepo.updateStatus(agent.sessionDbId, 'RUNNING');

    // Flush queued events
    const queued = agent.pausedEventQueue.splice(0);
    for (const { event, payload } of queued) {
      this.eventBus.emit(event, payload);
    }
  }

  /**
   * Hard pause: save checkpoint to DB, then SIGTERM the process.
   * Can be resumed from checkpoint with full context.
   */
  async hardPause(projectId: string): Promise<string> {
    const agent = this.getRunningAgent(projectId);
    if (!['RUNNING', 'PAUSED'].includes(agent.status)) {
      throw new Error(`Cannot hard pause agent in status ${agent.status}`);
    }

    // Save checkpoint
    const checkpointId = this.checkpointRepo.insert({
      sessionId: agent.sessionId,
      projectId,
      breadcrumbsJson: JSON.stringify(agent.breadcrumbs.slice(-50)),
      planJson: agent.plan ? JSON.stringify(agent.plan) : null,
      locationJson: agent.location ? JSON.stringify(agent.location) : null,
      tokenUsageJson: JSON.stringify({ inputTokens: agent.inputTokens, outputTokens: agent.outputTokens }),
      createdAt: Date.now(),
    });

    this.setStatus(agent, 'PAUSED');
    await this.killProcess(agent);
    this.sessionRepo.setPaused(agent.sessionDbId);

    this.eventBus.emit('AGENT_CHECKPOINT_SAVED', { projectId, checkpointId, timestamp: Date.now() });
    return checkpointId;
  }

  /**
   * Resume from checkpoint: respawn agent with checkpoint context.
   */
  async resumeFromCheckpoint(projectId: string): Promise<void> {
    const agent = this.getRunningAgent(projectId);
    if (agent.status !== 'PAUSED') {
      throw new Error(`Cannot resume from checkpoint in status ${agent.status}`);
    }

    const checkpoint = this.checkpointRepo.findLatestBySession(agent.sessionId);
    const contextParts: string[] = ['[Resuming from checkpoint]'];

    if (checkpoint) {
      try {
        const breadcrumbs = JSON.parse(checkpoint.breadcrumbsJson) as Array<{ filePath: string; activity: string }>;
        const files = [...new Set(breadcrumbs.map((b) => b.filePath))].slice(-10);
        contextParts.push(`[Recent files: ${files.join(', ')}]`);
      } catch { /* ignore */ }

      if (checkpoint.planJson) {
        try {
          const plan = JSON.parse(checkpoint.planJson);
          contextParts.push(`[Active plan: ${plan.summary}]`);
        } catch { /* ignore */ }
      }

      if (checkpoint.locationJson) {
        try {
          const loc = JSON.parse(checkpoint.locationJson);
          contextParts.push(`[Last location: ${loc.filePath} (${loc.activity})]`);
        } catch { /* ignore */ }
      }
    }

    contextParts.push('Continue where you left off.');
    const enrichedPrompt = contextParts.join('\n');

    // Keep same session ID — AI retains full conversation memory
    this.setStatus(agent, 'RUNNING');
    this.sessionRepo.updateStatus(agent.sessionDbId, 'RUNNING');
    this.spawnProcess(agent, enrichedPrompt, true, agent.sessionId);
  }

  /**
   * Redirect agent to focus on a specific file.
   */
  async redirectToFile(projectId: string, filePath: string, instruction?: string): Promise<void> {
    const agent = this.getRunningAgent(projectId);
    const prompt = instruction
      ? `Focus on this file: ${filePath}\n\n${instruction}`
      : `Focus on this file and continue working: ${filePath}`;

    const injection: PromptInjection = {
      prompt,
      context: { filePath },
      urgency: 'normal',
    };

    await this.injectPrompt(projectId, injection);
    this.eventBus.emit('AGENT_REDIRECTED', { projectId, filePath, timestamp: Date.now() });
  }

  /**
   * Set a breakpoint on a file path.
   */
  setBreakpoint(projectId: string, filePath: string): void {
    const agent = this.getRunningAgent(projectId);
    agent.breakpoints.add(filePath);
    this.eventBus.emit('AGENT_BREAKPOINT_SET', { projectId, filePath, timestamp: Date.now() });
  }

  /**
   * Remove a breakpoint from a file path.
   */
  removeBreakpoint(projectId: string, filePath: string): void {
    const agent = this.getRunningAgent(projectId);
    agent.breakpoints.delete(filePath);
    this.eventBus.emit('AGENT_BREAKPOINT_REMOVED', { projectId, filePath, timestamp: Date.now() });
  }

  /**
   * Get all breakpoints for a project.
   */
  getBreakpoints(projectId: string): string[] {
    const agent = this.agents.get(projectId);
    if (!agent) return [];
    return [...agent.breakpoints];
  }

  /**
   * Inject a prompt into a running agent.
   * Kills current process, restarts with --continue and enriched context.
   */
  async injectPrompt(projectId: string, injection: PromptInjection): Promise<void> {
    let agent = this.agents.get(projectId) ?? null;

    // If no active agent, try to resume from last COMPLETED session
    if (!agent) {
      const lastSession = this.sessionRepo.findLatestCompletedByProject(projectId)
        ?? this.sessionRepo.findLatestByProject(projectId);
      if (!lastSession) {
        throw new Error(`No agent running for project ${projectId}`);
      }

      // Re-create agent entry — SAME session ID for AI memory continuity
      const sessionId = lastSession.sessionId;
      const newSessionRow = this.sessionRepo.create({
        projectId,
        sessionId, // Same Claude CLI session — AI remembers everything
        status: 'INJECTING',
        model: lastSession.model ?? AGENT_CONSTANTS.DEFAULT_MODEL,
        prompt: injection.prompt,
        targetDir: lastSession.targetDir,
        pid: null,
        startedAt: Date.now(),
      });

      agent = {
        process: null as any,
        parser: new AgentStreamParser(),
        projectId,
        sessionDbId: newSessionRow.id,
        sessionId, // Same session ID — AI keeps full conversation history
        status: 'INJECTING' as AgentStatus,
        model: lastSession.model ?? AGENT_CONSTANTS.DEFAULT_MODEL,
        prompt: injection.prompt,
        targetDir: lastSession.targetDir,
        location: null,
        plan: null,
        breadcrumbs: [],
        inputTokens: 0,
        outputTokens: 0,
        startedAt: Date.now(),
        lastThinkingText: '',
        lastTextOutput: '',
        hasReceivedThinking: false,
        planDebounceTimer: null,
        textPlanDebounceTimer: null,
        killTimer: null,
        paused: false,
        pausedEventQueue: [],
        breakpoints: new Set(),
        injectionQueue: [],
        lastToolInput: null,
        _devServerDebounce: null,
        _sessionEnded: false,
        _sessionEndError: false,
        _timeoutTimer: null,
        _isResume: true,
        _resumeRetried: false,
        _spawnPrompt: '',
        _eventsReceived: 0,
        _stderrBuffer: '',
      };
      this.agents.set(projectId, agent);

      console.log(`[AgentRunner] Resuming completed agent session for inject (project=${projectId}, session=${sessionId})`);
      this.emitStatus(projectId, 'INJECTING');

      // Record injection in DB
      this.injectionRepo.insert({
        sessionId,
        projectId,
        prompt: injection.prompt,
        contextFile: injection.context?.filePath ?? null,
        contextLineStart: injection.context?.lineRange?.start ?? null,
        contextLineEnd: injection.context?.lineRange?.end ?? null,
        constraints: injection.context?.constraints ? JSON.stringify(injection.context.constraints) : null,
        urgency: injection.urgency ?? 'normal',
        injectedAt: Date.now(),
        agentStatusBefore: 'COMPLETED',
      });

      // Build enriched prompt and --resume same session (AI keeps memory)
      const enrichedPrompt = this.buildEnrichedPrompt(agent, injection, projectId);
      agent._spawnPrompt = enrichedPrompt;
      this.spawnProcess(agent, enrichedPrompt, true, sessionId);
      return;
    }

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

    // Keep SAME session ID — AI retains full conversation memory
    // No new session ID generation — continuity is critical

    // Build enriched prompt
    const enrichedPrompt = this.buildEnrichedPrompt(agent, injection, projectId);
    agent._spawnPrompt = enrichedPrompt;

    // Resume same session — AI keeps all context and memory
    this.spawnProcess(agent, enrichedPrompt, true, agent.sessionId);
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
   * Prefers the latest COMPLETED session (real AI conversation) over CRASHED ones.
   */
  getSessionFromDb(projectId: string) {
    return this.sessionRepo.findLatestCompletedByProject(projectId)
      ?? this.sessionRepo.findLatestByProject(projectId);
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
    const session = this.sessionRepo.findLatestCompletedByProject(projectId)
      ?? this.sessionRepo.findLatestByProject(projectId);
    if (!session) return [];
    return this.breadcrumbRepo.findBySession(session.sessionId);
  }

  /**
   * Get current plan.
   */
  getPlan(projectId: string) {
    const agent = this.agents.get(projectId);
    if (agent?.plan) return agent.plan;
    const session = this.sessionRepo.findLatestCompletedByProject(projectId)
      ?? this.sessionRepo.findLatestByProject(projectId);
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
   * Get count of currently running agents.
   */
  getRunningCount(): number {
    return this.agents.size;
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

  private spawnProcess(agent: RunningAgent, prompt: string, isContinue = false, continueFromSessionId?: string): void {
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--model', agent.model,
      '--verbose',
      '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Read,Write,Edit,Bash,Glob,Grep,NotebookEdit',
    ];

    if (isContinue && continueFromSessionId) {
      // Resume existing session — AI keeps full conversation history & memory
      args.push('--resume', continueFromSessionId);
    }

    // Use explicit -p flag to prevent --allowedTools from swallowing the prompt
    args.push('-p', prompt);

    // Clean env: remove CLAUDECODE to prevent nested session errors
    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;
    delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;
    delete cleanEnv.CLAUDE_DEV;

    // Validate binary exists before spawning
    if (!existsSync(this.claudeBinary)) {
      const errorMsg = `Claude CLI binary not found: ${this.claudeBinary}`;
      console.error(`[AgentRunner] ${errorMsg} (project=${agent.projectId})`);
      this.setStatus(agent, 'CRASHED');
      this.sessionRepo.setCrashed(agent.sessionDbId, errorMsg);
      this.eventBus.emit('AGENT_ERROR', { projectId: agent.projectId, error: errorMsg, timestamp: Date.now() });
      this.agents.delete(agent.projectId);
      return;
    }

    // CRITICAL: Claude CLI hangs when stdin is a Node.js pipe (socketpair).
    // Known bug: https://github.com/anthropics/claude-code/issues/771
    // Fix: Use /dev/null for stdin since we don't need to write to it.
    const devNull = openSync('/dev/null', 'r');
    const proc = spawn(this.claudeBinary, args, {
      cwd: agent.targetDir,
      stdio: [devNull, 'pipe', 'pipe'],
      env: { ...cleanEnv, CLAUDE_CODE_ENTRYPOINT: 'voltron' },
    });

    agent.process = proc;
    console.log(`[AgentRunner] Process spawned: pid=${proc.pid}, binary=${this.claudeBinary}, isContinue=${isContinue} (project=${agent.projectId})`);
    this.sessionRepo.updatePid(agent.sessionDbId, proc.pid ?? null);
    this.setStatus(agent, 'RUNNING');
    this.sessionRepo.updateStatus(agent.sessionDbId, 'RUNNING');

    // Agent timeout enforcement
    if (agent._timeoutTimer) clearTimeout(agent._timeoutTimer);
    const timeoutMs = AGENT_CONSTANTS.AGENT_TIMEOUT_MS || Number(process.env.VOLTRON_AGENT_TIMEOUT_MS) || 0;
    if (timeoutMs > 0) {
      agent._timeoutTimer = setTimeout(() => {
        console.warn(`[AgentRunner] Agent timeout (${timeoutMs}ms) reached for project=${agent.projectId}. Killing.`);
        this.eventBus.emit('AGENT_ERROR', { projectId: agent.projectId, error: `Agent timed out after ${Math.round(timeoutMs / 1000)}s`, timestamp: Date.now() });
        this.kill(agent.projectId).catch(() => {});
      }, timeoutMs);
    }

    // Wire up parser
    agent.parser = new AgentStreamParser();
    this.wireParser(agent);

    proc.stdout?.on('data', (data: Buffer) => {
      agent._eventsReceived++;
      agent.parser.feed(data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      agent._stderrBuffer += text;
      console.error(`[AgentRunner] STDERR (project=${agent.projectId}): ${text.substring(0, 500)}`);
      this.eventBus.emit('AGENT_ERROR', {
        projectId: agent.projectId,
        error: text,
        timestamp: Date.now(),
      });
    });

    proc.on('exit', (code, signal) => {
      console.log(`[AgentRunner] Process exited: code=${code}, signal=${signal}, status=${agent.status}, eventsReceived=${agent._eventsReceived}, isResume=${agent._isResume}, retried=${agent._resumeRetried} (project=${agent.projectId})`);
      if (agent._stderrBuffer) {
        console.error(`[AgentRunner] Full STDERR on exit (project=${agent.projectId}): ${agent._stderrBuffer.substring(0, 1000)}`);
      }
      agent.parser.flush();

      // RESUME FALLBACK: If this was a --resume spawn that crashed immediately
      // (0 events, non-zero exit, not already retried), retry WITHOUT --resume
      if (agent._isResume && !agent._resumeRetried && agent._eventsReceived === 0 &&
          code !== null && code !== 0 && signal !== 'SIGTERM' &&
          agent.status !== 'STOPPING' && agent.status !== 'INJECTING') {
        console.warn(`[AgentRunner] Resume failed immediately (code=${code}, stderr=${agent._stderrBuffer.substring(0, 200)}). Retrying WITHOUT --resume (project=${agent.projectId})`);
        agent._resumeRetried = true;
        agent._isResume = false;
        agent._stderrBuffer = '';
        agent._eventsReceived = 0;
        agent._sessionEnded = false;
        agent._sessionEndError = false;

        // Generate a new session ID for fresh spawn
        const newSessionId = randomUUID();
        agent.sessionId = newSessionId;
        this.sessionRepo.updateSessionId(agent.sessionDbId, newSessionId);

        try {
          this.spawnProcess(agent, agent._spawnPrompt, false);
          return; // Don't process exit further — new process started
        } catch (retryErr) {
          console.error(`[AgentRunner] Resume fallback spawn also failed: ${retryErr instanceof Error ? retryErr.message : retryErr} (project=${agent.projectId})`);
          // Fall through to normal crash handling
        }
      }

      // Flush paused events before processing exit so UI receives final updates
      if (agent.pausedEventQueue.length > 0) {
        const queued = agent.pausedEventQueue.splice(0);
        for (const { event, payload } of queued) {
          this.eventBus.emit(event, payload);
        }
      }

      if (agent._timeoutTimer) {
        clearTimeout(agent._timeoutTimer);
        agent._timeoutTimer = null;
      }
      if (agent.killTimer) {
        clearTimeout(agent.killTimer);
        agent.killTimer = null;
      }
      if (agent.planDebounceTimer) {
        clearTimeout(agent.planDebounceTimer);
        agent.planDebounceTimer = null;
      }
      if (agent.textPlanDebounceTimer) {
        clearTimeout(agent.textPlanDebounceTimer);
        agent.textPlanDebounceTimer = null;
      }

      // Last-chance plan extraction from text output if no plan was found
      if (!agent.plan && agent.lastTextOutput.length >= 30) {
        console.log(`[AgentRunner] Last-chance plan extraction from text output, length=${agent.lastTextOutput.length} (project=${agent.projectId})`);
        const result = extractPlan(agent.lastTextOutput);
        console.log(`[AgentRunner] Last-chance result: ${result ? `confidence=${result.confidence}, steps=${result.plan.steps.length}` : 'null'}`);
        if (result && result.confidence >= 0.4) {
          agent.plan = result.plan;
          this.planRepo.insert({
            sessionId: agent.sessionId,
            projectId: agent.projectId,
            summary: result.plan.summary,
            stepsJson: JSON.stringify(result.plan.steps),
            currentStep: result.plan.currentStepIndex,
            totalSteps: result.plan.totalSteps,
            confidence: result.confidence,
            extractedAt: Date.now(),
          });
          this.eventBus.emit('AGENT_PLAN_UPDATE', { projectId: agent.projectId, plan: result.plan });
        }
      }

      if (agent.status === 'INJECTING') {
        // If process exited unexpectedly during injection (not SIGTERM from us), mark as CRASHED
        if (code !== null && code !== 0 && signal !== 'SIGTERM') {
          console.warn(`[AgentRunner] Unexpected crash during injection: code=${code}, signal=${signal} (project=${agent.projectId})`);
          this.setStatus(agent, 'CRASHED');
          this.sessionRepo.setCrashed(agent.sessionDbId, `Crashed during injection: exit code ${code}, signal ${signal}`);
          this.agents.delete(agent.projectId);
        }
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

      // Determine completion: session_end without error, exit code 0, or SIGTERM all count as success
      const isSuccess = code === 0 || signal === 'SIGTERM' || (agent._sessionEnded && !agent._sessionEndError);

      if (isSuccess) {
        this.setStatus(agent, 'COMPLETED');
        this.sessionRepo.setCompleted(agent.sessionDbId, code);
        // Start dev server if available
        if (this.devServerManager) {
          this.devServerManager.startForProject(agent.projectId, agent.targetDir).catch((err) => {
            console.warn('[AgentRunner] Dev server start failed:', err instanceof Error ? err.message : err);
          });
        }
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

    /** Emit or queue if agent is soft-paused */
    const emitOrQueue = (event: string, payload: unknown): void => {
      if (agent.paused) {
        agent.pausedEventQueue.push({ event, payload });
      } else {
        this.eventBus.emit(event, payload);
      }
    };

    parser.on('location_change', (loc: LocationChangeEvent) => {
      const location: AgentLocation = {
        filePath: loc.filePath,
        activity: loc.activity,
        toolName: loc.toolName,
        lineRange: loc.lineRange,
        timestamp: loc.timestamp,
      };
      agent.location = location;

      // Extract snippet/diff from last tool input
      const toolInput = agent.lastToolInput;
      let contentSnippet: string | undefined;
      let editDiff: string | undefined;

      if (toolInput && loc.toolName) {
        if (loc.toolName === 'Read' && typeof toolInput.file_path === 'string') {
          contentSnippet = `Read: ${toolInput.file_path}`;
          if (toolInput.offset) contentSnippet += ` (line ${toolInput.offset})`;
        } else if (loc.toolName === 'Write' && typeof toolInput.content === 'string') {
          contentSnippet = (toolInput.content as string).slice(0, 200);
        } else if (loc.toolName === 'Edit') {
          const oldStr = typeof toolInput.old_string === 'string' ? toolInput.old_string : '';
          const newStr = typeof toolInput.new_string === 'string' ? toolInput.new_string : '';
          editDiff = `- ${oldStr.slice(0, 240)}\n+ ${newStr.slice(0, 240)}`.slice(0, 500);
        } else if (loc.toolName === 'Bash' && typeof toolInput.command === 'string') {
          contentSnippet = `$ ${(toolInput.command as string).slice(0, 190)}`;
        } else if (loc.toolName === 'Grep' && typeof toolInput.pattern === 'string') {
          contentSnippet = `grep: ${toolInput.pattern}`;
        }
      }

      // Add breadcrumb with enriched data
      const crumb: AgentBreadcrumb = {
        filePath: loc.filePath,
        activity: loc.activity,
        timestamp: loc.timestamp,
        toolName: loc.toolName,
        lineRange: loc.lineRange,
        contentSnippet,
        editDiff,
        toolInput: toolInput ?? undefined,
      };
      agent.breadcrumbs.push(crumb);
      if (agent.breadcrumbs.length > AGENT_CONSTANTS.MAX_BREADCRUMBS) {
        agent.breadcrumbs.shift();
      }

      // Persist breadcrumb with extended fields
      this.breadcrumbRepo.insert({
        sessionId: agent.sessionId,
        projectId,
        filePath: loc.filePath,
        activity: loc.activity,
        toolName: loc.toolName ?? null,
        durationMs: null,
        lineStart: loc.lineRange?.start ?? null,
        lineEnd: loc.lineRange?.end ?? null,
        contentSnippet: contentSnippet ?? null,
        editDiff: editDiff ?? null,
        timestamp: loc.timestamp,
      });

      // Auto-start dev server when agent writes trigger files
      if (this.devServerManager && loc.activity === 'WRITING') {
        const triggerFiles = ['package.json', 'vite.config.ts', 'vite.config.js',
          'next.config.js', 'next.config.ts', 'tsconfig.json'];
        const fileName = loc.filePath.split('/').pop() ?? '';
        if (triggerFiles.includes(fileName)) {
          this.tryStartDevServer(agent);
        }
      }

      // Update plan progress if we have a plan
      if (agent.plan) {
        agent.plan = updatePlanProgress(agent.plan, loc.filePath);
        emitOrQueue('AGENT_PLAN_UPDATE', { projectId, plan: agent.plan });
      }

      // Check breakpoints
      if (agent.breakpoints.has(loc.filePath)) {
        this.pause(projectId);
        emitOrQueue('AGENT_BREAKPOINT_HIT', { projectId, filePath: loc.filePath, timestamp: Date.now() });
      }

      emitOrQueue('AGENT_LOCATION_UPDATE', { projectId, location });
      emitOrQueue('AGENT_BREADCRUMB', { projectId, breadcrumb: crumb });
    });

    parser.on('thinking', (text: string) => {
      agent.lastThinkingText += text;
      agent.hasReceivedThinking = true;
      console.log(`[AgentRunner] Thinking received, total length=${agent.lastThinkingText.length} (project=${projectId})`);
    });

    parser.on('plan_detected', (thinkingText: string) => {
      // Debounce plan extraction
      if (agent.planDebounceTimer) {
        clearTimeout(agent.planDebounceTimer);
      }
      agent.planDebounceTimer = setTimeout(() => {
        console.log(`[AgentRunner] Plan extraction attempt from thinking, length=${agent.lastThinkingText.length} (project=${projectId})`);
        const result = extractPlan(agent.lastThinkingText);
        console.log(`[AgentRunner] Plan extraction result: ${result ? `confidence=${result.confidence}, steps=${result.plan.steps.length}` : 'null'} (project=${projectId})`);
        if (result && result.confidence >= 0.4) {
          agent.plan = result.plan;
          console.log(`[AgentRunner] Plan accepted: "${result.plan.summary}" with ${result.plan.steps.length} steps (project=${projectId})`);

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

          emitOrQueue('AGENT_PLAN_UPDATE', { projectId, plan: result.plan });
        }
        agent.lastThinkingText = '';
      }, AGENT_CONSTANTS.PLAN_DEBOUNCE_MS);
    });

    parser.on('text_output', (text: string) => {
      console.log(`[AgentRunner] Text output: ${text.substring(0, 120)} (project=${projectId})`);
      emitOrQueue('AGENT_OUTPUT', { projectId, text, type: 'text', timestamp: Date.now() });
      // Fallback plan extraction from text output (for models without thinking blocks)
      if (!agent.hasReceivedThinking && !agent.plan) {
        agent.lastTextOutput += text + '\n';
        this.tryExtractPlanFromText(agent);
      }
    });

    parser.on('text_delta', (text: string) => {
      emitOrQueue('AGENT_OUTPUT', { projectId, text, type: 'delta', timestamp: Date.now() });
      // Fallback plan extraction from text delta (for models without thinking blocks)
      if (!agent.hasReceivedThinking && !agent.plan) {
        agent.lastTextOutput += text;
        this.tryExtractPlanFromText(agent);
      }
    });

    parser.on('tool_start', (event: { toolName: string; input: Record<string, unknown>; timestamp: number }) => {
      // Store last tool input for breadcrumb enrichment
      agent.lastToolInput = event.input;
      console.log(`[AgentRunner] Tool: ${event.toolName} (project=${projectId})`);
      emitOrQueue('AGENT_OUTPUT', {
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
      emitOrQueue('AGENT_TOKEN_USAGE', {
        projectId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
    });

    parser.on('session_end', (info: { isError: boolean; result?: string; sessionId?: string }) => {
      if (info.isError) {
        emitOrQueue('AGENT_ERROR', {
          projectId,
          error: info.result ?? 'Agent session ended with error',
          timestamp: Date.now(),
        });
      }
      // Mark that parser received session_end for proc exit handler
      agent._sessionEnded = true;
      agent._sessionEndError = info.isError;
    });
  }

  /**
   * Fallback plan extraction from text output.
   * Used when model doesn't produce thinking blocks (e.g., Haiku).
   * Debounced to avoid excessive extraction attempts on streaming deltas.
   */
  private tryExtractPlanFromText(agent: RunningAgent): void {
    if (agent.textPlanDebounceTimer) {
      clearTimeout(agent.textPlanDebounceTimer);
    }
    agent.textPlanDebounceTimer = setTimeout(() => {
      if (agent.plan || agent.lastTextOutput.length < 30) return;

      const result = extractPlan(agent.lastTextOutput);
      if (result && result.confidence >= 0.4) {
        agent.plan = result.plan;
        const projectId = agent.projectId;

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
        // Clear buffer after successful extraction
        agent.lastTextOutput = '';
      }
    }, AGENT_CONSTANTS.PLAN_DEBOUNCE_MS + 500); // Slightly longer debounce for text fallback
  }

  /**
   * Debounced dev server start — waits 3s after last trigger file write.
   */
  private tryStartDevServer(agent: RunningAgent): void {
    if (!this.devServerManager) return;
    const info = this.devServerManager.getInfo(agent.projectId);
    if (info && ['installing', 'starting', 'ready'].includes(info.status)) return;

    if (agent._devServerDebounce) clearTimeout(agent._devServerDebounce);
    agent._devServerDebounce = setTimeout(() => {
      this.devServerManager!.startForProject(agent.projectId, agent.targetDir).catch((err) => {
        console.warn('[AgentRunner] Dev server auto-start failed:', err instanceof Error ? err.message : err);
      });
    }, 3000);
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

  /**
   * Build enriched prompt for initial spawn: rules + pinned memory + user prompt.
   */
  private buildSpawnPrompt(projectId: string, prompt: string): string {
    const parts: string[] = [];

    // Project rules
    const rules = this.rulesRepo.getByProject(projectId);
    if (rules?.content && rules.isActive) {
      parts.push(`[PROJECT RULES — Always follow these instructions]\n${rules.content}\n[/PROJECT RULES]`);
    }

    // Pinned memory
    const memories = this.memoryRepo.findPinned(projectId);
    if (memories.length > 0) {
      const memLines = memories.map((m) => `- [${m.category}] ${m.title}: ${m.content}`);
      parts.push(`[PROJECT MEMORY — Key facts about this project]\n${memLines.join('\n')}\n[/PROJECT MEMORY]`);
    }

    parts.push(prompt);
    return parts.join('\n\n');
  }

  private buildEnrichedPrompt(agent: RunningAgent, injection: PromptInjection, projectId: string): string {
    const parts: string[] = [];

    // Project rules — repeat in every injection
    const rules = this.rulesRepo.getByProject(projectId);
    if (rules?.content && rules.isActive) {
      parts.push(`[PROJECT RULES — Always follow these instructions]\n${rules.content}\n[/PROJECT RULES]`);
    }

    // Pinned memory
    const memories = this.memoryRepo.findPinned(projectId);
    if (memories.length > 0) {
      const memLines = memories.map((m) => `- [${m.category}] ${m.title}: ${m.content}`);
      parts.push(`[PROJECT MEMORY]\n${memLines.join('\n')}\n[/PROJECT MEMORY]`);
    }

    // SESSION MEMORY — Last 10 breadcrumbs
    if (agent.breadcrumbs.length > 0) {
      const recent = agent.breadcrumbs.slice(-10);
      parts.push('[SESSION MEMORY - Recent Activity:');
      for (const bc of recent) {
        const line = bc.lineRange ? `:${bc.lineRange.start}-${bc.lineRange.end}` : '';
        const tool = bc.toolName ? ` (${bc.toolName})` : '';
        const snippet = bc.contentSnippet ? ` — ${bc.contentSnippet.slice(0, 80)}` : '';
        parts.push(`  ${bc.activity} ${bc.filePath}${line}${tool}${snippet}`);
      }
      parts.push(']');
    }

    // Plan state + progress
    if (agent.plan) {
      const completed = agent.plan.steps.filter((s) => s.status === 'completed').length;
      parts.push(`[PLAN PROGRESS: ${completed}/${agent.plan.totalSteps} steps completed — "${agent.plan.summary}"]`);
      const activeStep = agent.plan.steps.find((s) => s.status === 'active');
      if (activeStep) {
        parts.push(`[CURRENT STEP: ${activeStep.description}]`);
      }
    }

    // Files touched summary
    const touchedFiles = [...new Set(agent.breadcrumbs.map((b) => b.filePath))];
    if (touchedFiles.length > 0) {
      parts.push(`[FILES TOUCHED (${touchedFiles.length}): ${touchedFiles.slice(-15).join(', ')}]`);
    }

    // Token budget
    parts.push(`[TOKEN USAGE: input=${agent.inputTokens}, output=${agent.outputTokens}]`);

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

    // Inline attachment URLs from injection context
    if (injection.context?.attachmentUrls?.length) {
      parts.push('[INLINE ATTACHMENTS');
      for (const url of injection.context.attachmentUrls) {
        parts.push(`  - ${url}`);
      }
      parts.push(']');
    }

    // Attached files
    const uploads = this.uploadRepo.findByProject(projectId);
    if (uploads.length > 0) {
      parts.push('[ATTACHED FILES');
      for (const u of uploads) {
        parts.push(`  - ${u.filename}: ${u.url} (${u.mimeType})`);
      }
      parts.push(']');
    }

    // The actual prompt
    parts.push(injection.prompt);

    return parts.join('\n\n');
  }

  private setStatus(agent: RunningAgent, status: AgentStatus): void {
    const prev = agent.status;
    agent.status = status;
    console.log(`[AgentRunner] Status: ${prev} -> ${status} (project=${agent.projectId})`);
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
