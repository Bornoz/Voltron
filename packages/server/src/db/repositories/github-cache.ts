import { v4 as uuid } from 'uuid';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface GitHubCacheEntry {
  id: string;
  projectId: string;
  repoUrl: string;
  analysisType: string;
  resultJson: string;
  commitHash: string;
  createdAt: number;
  expiresAt: number;
}

export class GitHubCacheRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  set(entry: Omit<GitHubCacheEntry, 'id' | 'createdAt'>): void {
    const now = Date.now();
    this.stmt('insert', `
      INSERT INTO github_analysis_cache (id, project_id, repo_url, analysis_type, result_json, commit_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), entry.projectId, entry.repoUrl, entry.analysisType, entry.resultJson, entry.commitHash, now, entry.expiresAt);
  }

  get(repoUrl: string, analysisType: string): GitHubCacheEntry | null {
    const row = this.stmt('get', `
      SELECT * FROM github_analysis_cache WHERE repo_url = ? AND analysis_type = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1
    `).get(repoUrl, analysisType, Date.now()) as Record<string, unknown> | undefined;

    if (!row) return null;
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      repoUrl: row.repo_url as string,
      analysisType: row.analysis_type as string,
      resultJson: row.result_json as string,
      commitHash: row.commit_hash as string,
      createdAt: row.created_at as number,
      expiresAt: row.expires_at as number,
    };
  }

  cleanup(): number {
    const result = getDb().prepare('DELETE FROM github_analysis_cache WHERE expires_at < ?').run(Date.now());
    return result.changes;
  }
}
