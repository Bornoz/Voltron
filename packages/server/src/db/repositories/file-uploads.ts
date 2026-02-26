import { randomUUID } from 'node:crypto';
import { getDb } from '../connection.js';

export interface FileUploadRow {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  url: string;
  uploadedAt: number;
}

export class FileUploadRepository {
  insert(row: Omit<FileUploadRow, 'id'>): FileUploadRow {
    const db = getDb();
    const id = randomUUID();
    db.prepare(
      `INSERT INTO file_uploads (id, project_id, filename, mime_type, size, storage_path, url, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, row.projectId, row.filename, row.mimeType, row.size, row.storagePath, row.url, row.uploadedAt);
    return { id, ...row };
  }

  findByProject(projectId: string): FileUploadRow[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, project_id as projectId, filename, mime_type as mimeType, size, storage_path as storagePath, url, uploaded_at as uploadedAt FROM file_uploads WHERE project_id = ? ORDER BY uploaded_at DESC',
    ).all(projectId) as FileUploadRow[];
    return rows;
  }

  findById(id: string): FileUploadRow | null {
    const db = getDb();
    const row = db.prepare(
      'SELECT id, project_id as projectId, filename, mime_type as mimeType, size, storage_path as storagePath, url, uploaded_at as uploadedAt FROM file_uploads WHERE id = ?',
    ).get(id) as FileUploadRow | undefined;
    return row ?? null;
  }

  delete(id: string): void {
    const db = getDb();
    db.prepare('DELETE FROM file_uploads WHERE id = ?').run(id);
  }
}
