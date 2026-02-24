import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import type { EventBus } from './event-bus.js';

export interface DevServerInfo {
  projectId: string;
  process: ChildProcess | null;
  port: number;
  url: string;
  status: 'installing' | 'starting' | 'ready' | 'error' | 'stopped';
  targetDir: string;
  projectType: ProjectType;
  error?: string;
}

type ProjectType = 'vite' | 'next' | 'generic' | 'static';

export class DevServerManager {
  private servers = new Map<string, DevServerInfo>();

  constructor(private eventBus: EventBus) {}

  async startForProject(projectId: string, targetDir: string): Promise<DevServerInfo> {
    // Kill existing dev server for this project
    if (this.servers.has(projectId)) {
      await this.stopForProject(projectId);
    }

    const projectType = this.detectProjectType(targetDir);

    // Static projects don't need a dev server
    if (projectType === 'static') {
      const info: DevServerInfo = {
        projectId, process: null, port: 0,
        url: '', status: 'stopped', targetDir, projectType,
      };
      return info;
    }

    const port = await this.findFreePort();
    const info: DevServerInfo = {
      projectId, process: null, port,
      url: `http://localhost:${port}`,
      status: 'installing', targetDir, projectType,
    };
    this.servers.set(projectId, info);
    this.emitStatus(projectId, info);

    // Run install then start (async, non-blocking)
    this.runLifecycle(projectId, info).catch((err) => {
      console.error(`[DevServer] Lifecycle error for ${projectId}:`, err);
      info.status = 'error';
      info.error = err instanceof Error ? err.message : String(err);
      this.emitStatus(projectId, info);
    });

    return info;
  }

  async stopForProject(projectId: string): Promise<void> {
    const info = this.servers.get(projectId);
    if (!info) return;

    if (info.process && info.process.exitCode === null) {
      info.process.kill('SIGTERM');
      // SIGKILL fallback after 3s
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (info.process && info.process.exitCode === null) {
            info.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);
        info.process!.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    info.status = 'stopped';
    this.emitStatus(projectId, info);
    this.servers.delete(projectId);
  }

  async stopAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const projectId of this.servers.keys()) {
      promises.push(this.stopForProject(projectId));
    }
    await Promise.allSettled(promises);
  }

  getInfo(projectId: string): DevServerInfo | null {
    return this.servers.get(projectId) ?? null;
  }

  // ── Internal ─────────────────────────────────────────

  private async runLifecycle(projectId: string, info: DevServerInfo): Promise<void> {
    // Install if needed
    if (this.needsInstall(info.targetDir)) {
      info.status = 'installing';
      this.emitStatus(projectId, info);

      await this.runInstall(info.targetDir);
    }

    // Check still tracked (may have been stopped during install)
    if (!this.servers.has(projectId)) return;

    // Start dev server
    info.status = 'starting';
    this.emitStatus(projectId, info);

    const proc = this.spawnDevServer(info);
    info.process = proc;

    proc.on('exit', (code) => {
      // Only update if still tracked
      if (this.servers.has(projectId) && info.status !== 'stopped') {
        info.status = 'error';
        info.error = `Dev server exited with code ${code}`;
        this.emitStatus(projectId, info);
      }
    });

    proc.on('error', (err) => {
      if (this.servers.has(projectId) && info.status !== 'stopped') {
        info.status = 'error';
        info.error = err.message;
        this.emitStatus(projectId, info);
      }
    });

    // Wait for ready
    const ready = await this.waitForReady(info.port, 60_000);
    if (!this.servers.has(projectId)) return;

    if (ready) {
      info.status = 'ready';
      this.emitStatus(projectId, info);
    } else {
      info.status = 'error';
      info.error = 'Dev server did not become ready within timeout';
      this.emitStatus(projectId, info);
    }
  }

  private spawnDevServer(info: DevServerInfo): ChildProcess {
    const { targetDir, port, projectType } = info;

    let cmd: string;
    let args: string[];

    switch (projectType) {
      case 'vite':
        cmd = 'pnpm';
        args = ['exec', 'vite', '--port', String(port), '--host'];
        break;
      case 'next':
        cmd = 'pnpm';
        args = ['exec', 'next', 'dev', '--port', String(port)];
        break;
      case 'generic':
        cmd = 'pnpm';
        args = ['dev', '--', '--port', String(port)];
        break;
      default:
        cmd = 'pnpm';
        args = ['dev'];
        break;
    }

    return spawn(cmd, args, {
      cwd: targetDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port) },
    });
  }

  private detectProjectType(targetDir: string): ProjectType {
    // Vite check
    const viteConfigs = ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs'];
    for (const f of viteConfigs) {
      if (existsSync(`${targetDir}/${f}`)) return 'vite';
    }

    // Next.js check
    const nextConfigs = ['next.config.js', 'next.config.ts', 'next.config.mjs'];
    for (const f of nextConfigs) {
      if (existsSync(`${targetDir}/${f}`)) return 'next';
    }

    // package.json with dev script
    if (existsSync(`${targetDir}/package.json`)) {
      try {
        const pkg = JSON.parse(require('node:fs').readFileSync(`${targetDir}/package.json`, 'utf-8'));
        if (pkg.scripts?.dev) return 'generic';
      } catch { /* ignore parse errors */ }
    }

    return 'static';
  }

  private async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          const port = addr.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Could not determine port')));
        }
      });
      server.on('error', reject);
    });
  }

  private needsInstall(targetDir: string): boolean {
    return existsSync(`${targetDir}/package.json`) && !existsSync(`${targetDir}/node_modules`);
  }

  private runInstall(targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('pnpm', ['install'], {
        cwd: targetDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pnpm install failed (code ${code}): ${stderr.slice(0, 500)}`));
      });
      proc.on('error', reject);
    });
  }

  private waitForReady(port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const start = Date.now();

      const check = () => {
        if (Date.now() - start > timeoutMs) {
          resolve(false);
          return;
        }

        const req = httpGet(`http://localhost:${port}`, (res) => {
          // Any response means server is up
          res.resume();
          resolve(true);
        });

        req.on('error', () => {
          setTimeout(check, 500);
        });

        req.setTimeout(2000, () => {
          req.destroy();
          setTimeout(check, 500);
        });
      };

      // Initial delay to let server start
      setTimeout(check, 1000);
    });
  }

  private emitStatus(projectId: string, info: DevServerInfo): void {
    this.eventBus.emit('DEV_SERVER_STATUS', {
      projectId,
      status: info.status,
      port: info.port,
      url: info.url,
      projectType: info.projectType,
      error: info.error,
    });
  }
}
