import { execSync } from 'node:child_process';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SnapshotRepository } from '../db/repositories/snapshots.js';
import { ProjectRepository } from '../db/repositories/projects.js';

const LabelBody = z.object({ label: z.string().min(1).max(500) });
const GIT_HASH_RE = /^[0-9a-f]{40}$/;

const SnapshotQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

const PruneQuery = z.object({
  keep: z.coerce.number().int().min(1).max(10_000).default(100),
});

export async function snapshotRoutes(app: FastifyInstance): Promise<void> {
  const repo = new SnapshotRepository();
  const projectRepo = new ProjectRepository();

  app.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/projects/:id/snapshots',
    async (request, reply) => {
      const parsed = SnapshotQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error.issues });
      const { limit, offset } = parsed.data;
      return reply.send(repo.findByProject(request.params.id, limit, offset));
    },
  );

  app.get<{ Params: { id: string; sid: string } }>(
    '/api/projects/:id/snapshots/:sid',
    async (request, reply) => {
      const snapshot = repo.findById(request.params.sid);
      if (!snapshot) return reply.status(404).send({ error: 'Snapshot not found' });
      return reply.send(snapshot);
    },
  );

  app.post<{ Params: { id: string; sid: string }; Body: { label: string } }>(
    '/api/projects/:id/snapshots/:sid/label',
    async (request, reply) => {
      const parsed = LabelBody.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'label is required (1-500 chars)' });
      repo.updateLabel(request.params.sid, parsed.data.label);
      return reply.send({ success: true });
    },
  );

  // Snapshot rollback - mark the target snapshot and log it
  app.post<{ Params: { id: string; sid: string } }>(
    '/api/projects/:id/snapshots/:sid/rollback',
    async (request, reply) => {
      const snapshot = repo.findById(request.params.sid);
      if (!snapshot) return reply.status(404).send({ error: 'Snapshot not found' });
      if (snapshot.projectId !== request.params.id) return reply.status(403).send({ error: 'Snapshot does not belong to this project' });

      // Mark as critical so it won't be pruned
      repo.markCritical(request.params.sid);

      return reply.send({
        success: true,
        snapshot,
        message: 'Snapshot marked for rollback. Interceptor will restore to this git commit.',
        gitCommitHash: snapshot.gitCommitHash,
      });
    },
  );

  // Get diff between two snapshots
  app.get<{ Params: { id: string; sid: string }; Querystring: { compareWith?: string } }>(
    '/api/projects/:id/snapshots/:sid/diff',
    async (request, reply) => {
      const snapshot = repo.findById(request.params.sid);
      if (!snapshot) return reply.status(404).send({ error: 'Snapshot not found' });

      const compareId = request.query.compareWith;
      const compareWith = compareId ? repo.findById(compareId) : null;

      return reply.send({
        snapshot,
        compareWith,
        gitCommitHash: snapshot.gitCommitHash,
        compareGitCommitHash: compareWith?.gitCommitHash ?? null,
      });
    },
  );

  // List files in a snapshot via git tree listing
  app.get<{ Params: { id: string; sid: string } }>(
    '/api/projects/:id/snapshots/:sid/files',
    async (request, reply) => {
      const snapshot = repo.findById(request.params.sid);
      if (!snapshot) return reply.status(404).send({ error: 'Snapshot not found' });
      if (snapshot.projectId !== request.params.id) return reply.status(403).send({ error: 'Snapshot does not belong to this project' });

      const project = projectRepo.findById(request.params.id);
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      try {
        // Validate git hash to prevent shell injection
        if (!GIT_HASH_RE.test(snapshot.gitCommitHash)) {
          return reply.status(400).send({ error: 'Invalid git commit hash format' });
        }
        // Use git ls-tree to list all files at the snapshot's commit
        const output = execSync(
          `git ls-tree -r --name-only ${snapshot.gitCommitHash}`,
          { cwd: project.rootPath, stdio: 'pipe', timeout: 10_000 },
        ).toString().trim();

        const files = output ? output.split('\n') : [];
        return reply.send({
          snapshotId: snapshot.id,
          gitCommitHash: snapshot.gitCommitHash,
          files,
          fileCount: files.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to list files';
        return reply.status(500).send({ error: `Git ls-tree failed: ${message}` });
      }
    },
  );

  // Prune old snapshots (keep N most recent)
  app.delete<{ Params: { id: string }; Querystring: { keep?: string } }>(
    '/api/projects/:id/snapshots/prune',
    async (request, reply) => {
      const parsed = PruneQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid query parameters', details: parsed.error.issues });
      const { keep } = parsed.data;

      const before = repo.count(request.params.id);
      const deleted = repo.prune(request.params.id, keep);

      return reply.send({
        success: true,
        deleted,
        remaining: before - deleted,
      });
    },
  );
}
