import { resolve, extname } from 'node:path';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { FileUploadRepository } from '../db/repositories/file-uploads.js';

const UPLOAD_DIR = resolve(process.cwd(), 'data', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIMES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/html': '.html',
  'text/css': '.css',
  'text/javascript': '.js',
  'application/javascript': '.js',
  'application/json': '.json',
  'application/typescript': '.ts',
  'text/typescript': '.ts',
  'text/x-python': '.py',
};

export function uploadRoutes(app: FastifyInstance): void {
  const repo = new FileUploadRepository();

  // Upload file
  app.post<{ Params: { id: string } }>('/api/projects/:id/uploads', async (request, reply) => {
    const projectId = request.params.id;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buf = await data.toBuffer();
    if (buf.length > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'File too large (max 10MB)' });
    }

    const mimeType = data.mimetype || 'application/octet-stream';
    const origFilename = data.filename || 'upload';
    const ext = ALLOWED_MIMES[mimeType] || extname(origFilename) || '.bin';
    const fileId = randomUUID();
    const storedName = `${fileId}${ext}`;

    // Ensure upload directory exists
    const projectDir = resolve(UPLOAD_DIR, projectId);
    if (!existsSync(projectDir)) {
      await mkdir(projectDir, { recursive: true });
    }

    const storagePath = resolve(projectDir, storedName);
    await writeFile(storagePath, buf);

    const url = `/api/uploads/${fileId}/${encodeURIComponent(origFilename)}`;

    const row = repo.insert({
      projectId,
      filename: origFilename,
      mimeType,
      size: buf.length,
      storagePath,
      url,
      uploadedAt: Date.now(),
    });

    return reply.send({
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      url: row.url,
      uploadedAt: row.uploadedAt,
    });
  });

  // List uploads for a project
  app.get<{ Params: { id: string } }>('/api/projects/:id/uploads', async (request, reply) => {
    const rows = repo.findByProject(request.params.id);
    return reply.send(rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      mimeType: r.mimeType,
      size: r.size,
      url: r.url,
      uploadedAt: r.uploadedAt,
    })));
  });

  // Serve uploaded file
  app.get<{ Params: { id: string; filename: string } }>('/api/uploads/:id/:filename', async (request, reply) => {
    const row = repo.findById(request.params.id);
    if (!row) {
      return reply.status(404).send({ error: 'File not found' });
    }

    try {
      const content = await readFile(row.storagePath);
      return reply
        .header('Content-Type', row.mimeType)
        .header('Content-Disposition', `inline; filename="${row.filename}"`)
        .header('Cache-Control', 'public, max-age=3600')
        .send(content);
    } catch {
      return reply.status(404).send({ error: 'File not found on disk' });
    }
  });

  // Delete upload
  app.delete<{ Params: { id: string } }>('/api/uploads/:id', async (request, reply) => {
    const row = repo.findById(request.params.id);
    if (!row) {
      return reply.status(404).send({ error: 'File not found' });
    }

    try {
      await unlink(row.storagePath);
    } catch { /* file already deleted from disk */ }
    repo.delete(row.id);
    return reply.send({ ok: true });
  });
}
