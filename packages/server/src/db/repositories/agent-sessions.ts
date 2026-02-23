import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';
import type { AgentStatus } from '@voltron/shared';

export interface AgentSessionRow {
  id: string;
  projectId: string;
  sessionId: string;
  status: AgentStatus;
  model: string;
  prompt: string;
  targetDir: string;
  pid: number | null;
  exitCode: number | null;
  inputTokens: number;
  outputTokens: number;
  injectionCount: number;
  lastError: string | null;
  startedAt: number;
  pausedAt: number | null;
  completedAt: number | null;
}

export class AgentSessionRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  create(session: Omit<AgentSessionRow, 'id' | 'exitCode' | 'inputTokens' | 'outputTokens' | 'injectionCount' | 'lastError' | 'pausedAt' | 'completedAt'>): AgentSessionRow {
    const id = randomUUID();
    this.stmt('insert', `
      INSERT INTO agent_sessions (id, project_id, session_id, status, model, prompt, target_dir, pid, exit_code, input_tokens, output_tokens, injection_count, last_error, started_at, paused_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, 0, NULL, ?, NULL, NULL)
    `).run(id, session.projectId, session.sessionId, session.status, session.model, session.prompt, session.targetDir, session.pid, session.startedAt);
    return { ...session, id, exitCode: null, inputTokens: 0, outputTokens: 0, injectionCount: 0, lastError: null, pausedAt: null, completedAt: null };
  }

  updateStatus(id: string, status: AgentStatus): void {
    this.stmt('updateStatus', `UPDATE agent_sessions SET status = ? WHERE id = ?`).run(status, id);
  }

  updatePid(id: string, pid: number | null): void {
    this.stmt('updatePid', `UPDATE agent_sessions SET pid = ? WHERE id = ?`).run(pid, id);
  }

  updateTokens(id: string, inputTokens: number, outputTokens: number): void {
    this.stmt('updateTokens', `UPDATE agent_sessions SET input_tokens = ?, output_tokens = ? WHERE id = ?`).run(inputTokens, outputTokens, id);
  }

  incrementInjections(id: string): void {
    this.stmt('incInjections', `UPDATE agent_sessions SET injection_count = injection_count + 1 WHERE id = ?`).run(id);
  }

  setError(id: string, error: string): void {
    this.stmt('setError', `UPDATE agent_sessions SET last_error = ? WHERE id = ?`).run(error, id);
  }

  setPaused(id: string): void {
    this.stmt('setPaused', `UPDATE agent_sessions SET status = 'PAUSED', paused_at = ? WHERE id = ?`).run(Date.now(), id);
  }

  setCompleted(id: string, exitCode: number | null): void {
    this.stmt('setCompleted', `UPDATE agent_sessions SET status = 'COMPLETED', exit_code = ?, completed_at = ? WHERE id = ?`).run(exitCode, Date.now(), id);
  }

  setCrashed(id: string, error: string): void {
    this.stmt('setCrashed', `UPDATE agent_sessions SET status = 'CRASHED', last_error = ?, completed_at = ? WHERE id = ?`).run(error, Date.now(), id);
  }

  findById(id: string): AgentSessionRow | null {
    const row = this.stmt('findById', `SELECT * FROM agent_sessions WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findLatestByProject(projectId: string): AgentSessionRow | null {
    const row = this.stmt('findLatest', `SELECT * FROM agent_sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT 1`).get(projectId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findRunningByProject(projectId: string): AgentSessionRow | null {
    const row = this.stmt('findRunning', `SELECT * FROM agent_sessions WHERE project_id = ? AND status IN ('RUNNING', 'PAUSED', 'SPAWNING', 'INJECTING') LIMIT 1`).get(projectId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByProject(projectId: string, limit = 50): AgentSessionRow[] {
    const rows = this.stmt('findByProject', `SELECT * FROM agent_sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?`).all(projectId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: Record<string, unknown>): AgentSessionRow {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      sessionId: r.session_id as string,
      status: r.status as AgentStatus,
      model: r.model as string,
      prompt: r.prompt as string,
      targetDir: r.target_dir as string,
      pid: r.pid as number | null,
      exitCode: r.exit_code as number | null,
      inputTokens: r.input_tokens as number,
      outputTokens: r.output_tokens as number,
      injectionCount: r.injection_count as number,
      lastError: r.last_error as string | null,
      startedAt: r.started_at as number,
      pausedAt: r.paused_at as number | null,
      completedAt: r.completed_at as number | null,
    };
  }
}
