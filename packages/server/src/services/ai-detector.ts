import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { AI_TOOL_REGISTRY, type AiToolRegistryEntry } from '@voltron/shared';
import type { AiToolDetectionResult, AiToolScanResult, AiToolId } from '@voltron/shared';

/** Timeout per tool detection (ms) */
const DETECT_TIMEOUT_MS = 3_000;

/**
 * Executes a command with a timeout. Resolves with stdout or null on failure.
 */
function execWithTimeout(cmd: string, args: string[], timeoutMs = DETECT_TIMEOUT_MS): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const proc = execFile(cmd, args, { timeout: timeoutMs, encoding: 'utf-8' }, (err, stdout) => {
        if (err) return resolve(null);
        resolve(stdout.trim());
      });
      // Safety: ensure we never hang
      const timer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* already dead */ }
        resolve(null);
      }, timeoutMs + 500);
      proc.on('close', () => clearTimeout(timer));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Finds a binary path using `which` (unix) or `where` (windows).
 */
async function findBinary(name: string): Promise<string | null> {
  const cmd = platform() === 'win32' ? 'where' : 'which';
  return execWithTimeout(cmd, [name]);
}

/**
 * Checks if any of the given config directories exist under $HOME.
 */
function checkConfigDirs(dirs: string[]): string | null {
  const home = homedir();
  for (const dir of dirs) {
    const full = join(home, dir);
    if (existsSync(full)) return full;
  }
  return null;
}

/**
 * Checks if any app bundle paths exist (macOS/Linux snap).
 */
function checkAppBundles(paths: string[]): string | null {
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Tries to get version from a binary. Handles various --version output formats.
 */
async function getVersion(binaryPath: string): Promise<string | null> {
  const output = await execWithTimeout(binaryPath, ['--version']);
  if (!output) return null;
  // Extract version-like pattern: 1.2.3, v1.2.3, etc.
  const match = output.match(/v?(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)/);
  return match ? match[1] : output.split('\n')[0].slice(0, 50);
}

/**
 * Checks npm global packages.
 */
async function checkNpmGlobal(packageName: string): Promise<string | null> {
  const output = await execWithTimeout('npm', ['ls', '-g', packageName, '--depth=0', '--json']);
  if (!output) return null;
  try {
    const data = JSON.parse(output);
    const deps = data.dependencies ?? {};
    if (deps[packageName]) return deps[packageName].version ?? 'installed';
  } catch { /* invalid json */ }
  return null;
}

/**
 * Checks pip packages.
 */
async function checkPipPackage(packageName: string): Promise<string | null> {
  // Try pip3 first, then pip
  for (const pip of ['pip3', 'pip']) {
    const output = await execWithTimeout(pip, ['show', packageName]);
    if (output) {
      const versionLine = output.split('\n').find((l) => l.startsWith('Version:'));
      return versionLine?.replace('Version:', '').trim() ?? 'installed';
    }
  }
  return null;
}

/**
 * Checks GitHub CLI extensions.
 */
async function checkGhExtension(extensionName: string): Promise<boolean> {
  const output = await execWithTimeout('gh', ['extension', 'list']);
  if (!output) return false;
  return output.toLowerCase().includes(extensionName.toLowerCase());
}

/**
 * Detects a single AI tool. Isolated — never throws.
 */
async function detectTool(entry: AiToolRegistryEntry): Promise<AiToolDetectionResult> {
  const startTime = Date.now();
  const base: AiToolDetectionResult = {
    toolId: entry.id,
    name: entry.name,
    status: 'not_found',
    tier: entry.tier,
    version: null,
    binaryPath: null,
    detectedVia: '',
    capabilities: {
      canSpawn: entry.spawn !== null,
      canMonitor: entry.tier !== 'readonly',
      structuredOutput: entry.spawn?.streamFormat === 'json-stream',
    },
    error: null,
    detectedAt: startTime,
    scanDurationMs: 0,
  };

  try {
    // Strategy 1: Find binary via which/where
    for (const binName of entry.detection.binaryNames) {
      const path = await findBinary(binName);
      if (path) {
        base.status = 'detected';
        base.binaryPath = path;
        base.detectedVia = `which ${binName}`;
        base.version = await getVersion(path);
        break;
      }
    }

    // Strategy 2: Check npm global packages
    if (base.status !== 'detected') {
      for (const pkg of entry.detection.npmPackages) {
        const ver = await checkNpmGlobal(pkg);
        if (ver) {
          base.status = 'detected';
          base.detectedVia = `npm global: ${pkg}`;
          base.version = ver;
          break;
        }
      }
    }

    // Strategy 3: Check pip packages
    if (base.status !== 'detected') {
      for (const pkg of entry.detection.pipPackages) {
        const ver = await checkPipPackage(pkg);
        if (ver) {
          base.status = 'detected';
          base.detectedVia = `pip: ${pkg}`;
          base.version = ver;
          break;
        }
      }
    }

    // Strategy 4: Check config directories
    if (base.status !== 'detected') {
      const configPath = checkConfigDirs(entry.detection.configDirs);
      if (configPath) {
        base.status = 'detected';
        base.detectedVia = `config dir: ${configPath}`;
      }
    }

    // Strategy 5: Check app bundles (macOS/Linux snap)
    if (base.status !== 'detected') {
      const appPath = checkAppBundles(entry.detection.appBundlePaths);
      if (appPath) {
        base.status = 'detected';
        base.binaryPath = appPath;
        base.detectedVia = `app bundle: ${appPath}`;
      }
    }

    // Strategy 6: Check GitHub CLI extensions
    if (base.status !== 'detected' && entry.detection.ghExtensions.length > 0) {
      for (const ext of entry.detection.ghExtensions) {
        const found = await checkGhExtension(ext);
        if (found) {
          base.status = 'detected';
          base.detectedVia = `gh extension: ${ext}`;
          break;
        }
      }
    }
  } catch (err) {
    base.status = 'error';
    base.error = err instanceof Error ? err.message : String(err);
  }

  base.scanDurationMs = Date.now() - startTime;
  return base;
}

/**
 * AI Tool Detection Engine.
 * Scans the system for known AI CLI tools in parallel.
 */
export class AiDetector {
  private cache: AiToolScanResult | null = null;
  private scanning = false;

  get isScanning(): boolean {
    return this.scanning;
  }

  /**
   * Scan all registered AI tools in parallel.
   * Results are cached until rescan() is called.
   */
  async scan(): Promise<AiToolScanResult> {
    if (this.cache) return this.cache;
    return this.doScan();
  }

  /**
   * Force a fresh scan, clearing the cache.
   */
  async rescan(): Promise<AiToolScanResult> {
    this.cache = null;
    return this.doScan();
  }

  /**
   * Get cached scan result (null if no scan has been performed).
   */
  getCached(): AiToolScanResult | null {
    return this.cache;
  }

  /**
   * Get only tools that can be spawned (tier=spawn and detected).
   */
  getSpawnableTools(): AiToolDetectionResult[] {
    if (!this.cache) return [];
    return this.cache.tools.filter(
      (t) => t.status === 'detected' && t.capabilities.canSpawn,
    );
  }

  private async doScan(): Promise<AiToolScanResult> {
    if (this.scanning) {
      // Wait for in-flight scan
      while (this.scanning) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return this.cache!;
    }

    this.scanning = true;
    const startTime = Date.now();

    try {
      const entries = Object.values(AI_TOOL_REGISTRY);

      // Scan all tools in parallel — each is isolated
      const results = await Promise.allSettled(
        entries.map((entry) => detectTool(entry)),
      );

      const tools: AiToolDetectionResult[] = results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        // Promise.allSettled rejected — shouldn't happen but handle gracefully
        return {
          toolId: entries[i].id as AiToolId,
          name: entries[i].name,
          status: 'error' as const,
          tier: entries[i].tier,
          version: null,
          binaryPath: null,
          detectedVia: '',
          capabilities: { canSpawn: false, canMonitor: false, structuredOutput: false },
          error: r.reason?.message ?? 'Unknown error',
          detectedAt: startTime,
          scanDurationMs: Date.now() - startTime,
        };
      });

      const plat = platform();
      const scanResult: AiToolScanResult = {
        tools,
        scannedAt: Date.now(),
        totalDurationMs: Date.now() - startTime,
        platform: (plat === 'linux' || plat === 'darwin' || plat === 'win32') ? plat : 'unknown',
      };

      this.cache = scanResult;
      return scanResult;
    } finally {
      this.scanning = false;
    }
  }
}
