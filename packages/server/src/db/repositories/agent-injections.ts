import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface AgentInjectionRow {
  id: string;
  sessionId: string;
  projectId: string;
  prompt: string;
  contextFile: string | null;
  contextLineStart: number | null;
  contextLineEnd: number | null;
  constraints: string | null;
  urgency: string;
  injectedAt: number;
  agentStatusBefore: string | null;
}

export class AgentInjectionRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  insert(injection: Omit<AgentInjectionRow, 'id'>): AgentInjectionRow {
    const id = randomUUID();
    this.stmt('insert', `
      INSERT INTO agent_prompt_injections (id, session_id, project_id, prompt, context_file, context_line_start, context_line_end, constraints, urgency, injected_at, agent_status_before)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, injection.sessionId, injection.projectId, injection.prompt, injection.contextFile, injection.contextLineStart, injection.contextLineEnd, injection.constraints, injection.urgency, injection.injectedAt, injection.agentStatusBefore);
    return { ...injection, id };
  }

  findBySession(sessionId: string): AgentInjectionRow[] {
    const rows = this.stmt('findBySession', `
      SELECT * FROM agent_prompt_injections WHERE session_id = ? ORDER BY injected_at DESC
    `).all(sessionId) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  findByProject(projectId: string, limit = 50): AgentInjectionRow[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM agent_prompt_injections WHERE project_id = ? ORDER BY injected_at DESC LIMIT ?
    `).all(projectId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: Record<string, unknown>): AgentInjectionRow {
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      projectId: r.project_id as string,
      prompt: r.prompt as string,
      contextFile: r.context_file as string | null,
      contextLineStart: r.context_line_start as number | null,
      contextLineEnd: r.context_line_end as number | null,
      constraints: r.constraints as string | null,
      urgency: r.urgency as string,
      injectedAt: r.injected_at as number,
      agentStatusBefore: r.agent_status_before as string | null,
    };
  }
}
