import { type AiActionEvent, type RiskLevel, type ProtectionZoneConfig, RISK_VALUE, RISK_THRESHOLDS } from '@voltron/shared';
import picomatch from 'picomatch';

interface RuleResult {
  ruleName: string;
  riskLevel: RiskLevel;
  reason: string;
  shouldBlock: boolean;
}

export interface RiskResult {
  risk: RiskLevel;
  reasons: string[];
  shouldBlock: boolean;
  shouldAutoStop: boolean;
  ruleResults: RuleResult[];
}

interface RiskContext {
  protectionZones: ProtectionZoneConfig[];
  autoStopThreshold: RiskLevel;
  recentEvents: AiActionEvent[];
  rateLimit: number;
}

type RiskRule = {
  name: string;
  evaluate: (event: AiActionEvent, ctx: RiskContext) => { risk: RiskLevel; reason: string; block?: boolean };
};

const configFilePatterns: Array<[string | string[], RiskLevel]> = [
  ['.env*', 'CRITICAL'],
  ['**/package.json', 'MEDIUM'],
  ['**/tsconfig*.json', 'MEDIUM'],
  ['**/Dockerfile', 'MEDIUM'],
  ['**/docker-compose*', 'MEDIUM'],
  ['.github/**', 'HIGH'],
  ['*.config.*', 'LOW'],
  ['.gitignore', 'LOW'],
];

const securityFilePatterns: Array<[string | string[], RiskLevel]> = [
  ['*.key', 'CRITICAL'],
  ['*.pem', 'CRITICAL'],
  ['*.cert', 'CRITICAL'],
  ['*secret*', 'CRITICAL'],
  ['*credential*', 'CRITICAL'],
  ['*password*', 'CRITICAL'],
  ['.env*', 'CRITICAL'],
  ['*token*', 'HIGH'],
];

const BUILT_IN_RULES: RiskRule[] = [
  // Rule 1: Protection Zone Violation
  {
    name: 'protection-zone',
    evaluate: (event, ctx) => {
      for (const zone of ctx.protectionZones) {
        if (picomatch.isMatch(event.file, zone.path)) {
          if (zone.level === 'DO_NOT_TOUCH') {
            return { risk: 'CRITICAL', reason: `DO_NOT_TOUCH zone: ${zone.path}`, block: true };
          }
          if (zone.level === 'SURGICAL_ONLY') {
            const allowed = zone.allowedOperations ?? [];
            if (!allowed.includes(event.action)) {
              return { risk: 'HIGH', reason: `SURGICAL_ONLY zone: ${zone.path}, operation ${event.action} not allowed` };
            }
            return { risk: 'MEDIUM', reason: `SURGICAL_ONLY zone: ${zone.path}` };
          }
        }
      }
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 2: Destructive Operations
  {
    name: 'destructive-operation',
    evaluate: (event) => {
      if (event.action === 'DIR_DELETE') return { risk: 'CRITICAL', reason: 'Recursive directory deletion' };
      if (event.action === 'FILE_DELETE') return { risk: 'HIGH', reason: 'File deletion' };
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 3: Configuration File Risk
  {
    name: 'config-file',
    evaluate: (event) => {
      for (const [pattern, risk] of configFilePatterns) {
        if (picomatch.isMatch(event.file, pattern)) {
          return { risk, reason: `Configuration file: ${event.file}` };
        }
      }
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 4: Schema & Migration Risk
  {
    name: 'schema-migration',
    evaluate: (event) => {
      const file = event.file;
      if (file.includes('/migrations/') || file.match(/\.sql$/)) return { risk: 'HIGH', reason: 'Schema/migration file' };
      if (file.includes('/schema/')) return { risk: 'HIGH', reason: 'Schema file' };
      if (file.includes('prisma/schema.prisma')) return { risk: 'CRITICAL', reason: 'Prisma schema' };
      if (file.startsWith('drizzle/')) return { risk: 'HIGH', reason: 'Drizzle schema' };
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 5: Security-Sensitive Files
  {
    name: 'security-file',
    evaluate: (event) => {
      for (const [pattern, risk] of securityFilePatterns) {
        if (picomatch.isMatch(event.file, pattern)) {
          return { risk, reason: `Security-sensitive file: ${event.file}` };
        }
      }
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 6: Large Change Risk
  {
    name: 'large-change',
    evaluate: (event) => {
      if (event.diff) {
        const lineCount = event.diff.split('\n').length;
        if (lineCount > RISK_THRESHOLDS.LARGE_DIFF_HIGH) return { risk: 'HIGH', reason: `Large diff: ${lineCount} lines` };
        if (lineCount > RISK_THRESHOLDS.LARGE_DIFF_MEDIUM) return { risk: 'MEDIUM', reason: `Medium diff: ${lineCount} lines` };
        if (lineCount > RISK_THRESHOLDS.LARGE_DIFF_LOW) return { risk: 'LOW', reason: `Diff: ${lineCount} lines` };
      }
      if (event.fileSize) {
        if (event.fileSize > RISK_THRESHOLDS.LARGE_FILE_HIGH) return { risk: 'HIGH', reason: `Large file: ${(event.fileSize / 1048576).toFixed(1)}MB` };
        if (event.fileSize > RISK_THRESHOLDS.LARGE_FILE_MEDIUM) return { risk: 'MEDIUM', reason: `Medium file: ${(event.fileSize / 1048576).toFixed(1)}MB` };
      }
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 7: Cascade Detection
  {
    name: 'cascade',
    evaluate: (event, ctx) => {
      const windowStart = event.timestamp - RISK_THRESHOLDS.CASCADE_WINDOW_MS;
      const recentDirs = new Set<string>();
      for (const e of ctx.recentEvents) {
        if (e.timestamp >= windowStart) {
          const dir = e.file.split('/').slice(0, -1).join('/');
          recentDirs.add(dir);
        }
      }
      if (recentDirs.size >= RISK_THRESHOLDS.CASCADE_CRITICAL) return { risk: 'CRITICAL', reason: `Cascade: ${recentDirs.size} directories in 5s` };
      if (recentDirs.size >= RISK_THRESHOLDS.CASCADE_HIGH) return { risk: 'HIGH', reason: `Cascade: ${recentDirs.size} directories in 5s` };
      if (recentDirs.size >= RISK_THRESHOLDS.CASCADE_MEDIUM) return { risk: 'MEDIUM', reason: `Cascade: ${recentDirs.size} directories in 5s` };
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 8: API Contract Risk
  {
    name: 'api-contract',
    evaluate: (event) => {
      const file = event.file;
      if (file.includes('/routes/') || file.includes('/api/') || file.includes('/endpoints/')) {
        return { risk: 'MEDIUM', reason: 'API route file' };
      }
      if (file.includes('controller') || file.includes('middleware')) {
        return { risk: 'MEDIUM', reason: 'Controller/middleware file' };
      }
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 11: Test File Risk (inverse)
  {
    name: 'test-file',
    evaluate: (event) => {
      const file = event.file;
      if (file.includes('/test/') || file.includes('/__tests__/') || file.match(/\.(test|spec)\./)) {
        return { risk: 'LOW', reason: 'Test file (safe)' };
      }
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 12: Binary/Media File Risk
  {
    name: 'binary-file',
    evaluate: (event) => {
      if (event.isBinary) {
        const ext = event.file.split('.').pop()?.toLowerCase() ?? '';
        const execExts = ['exe', 'sh', 'bat', 'cmd', 'ps1', 'bin'];
        if (execExts.includes(ext)) return { risk: 'CRITICAL', reason: 'Executable binary file' };
        const mediaExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'mp4', 'mp3', 'wav'];
        if (mediaExts.includes(ext)) return { risk: 'LOW', reason: 'Media file' };
        return { risk: 'MEDIUM', reason: 'Binary file' };
      }
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 13: Self-Protection
  {
    name: 'self-protection',
    evaluate: (event) => {
      const selfPaths = ['/opt/voltron/**', '**/voltron.db*', '/etc/nginx/**', '/etc/systemd/**', '/etc/letsencrypt/**'];
      for (const pattern of selfPaths) {
        if (picomatch.isMatch(event.file, pattern)) {
          return { risk: 'CRITICAL', reason: `Self-protection: ${event.file}`, block: true };
        }
      }
      return { risk: 'NONE', reason: '' };
    },
  },

  // Rule 14: Rate Anomaly
  {
    name: 'rate-anomaly',
    evaluate: (event, ctx) => {
      const windowStart = event.timestamp - 3000;
      const recentCount = ctx.recentEvents.filter(e => e.timestamp >= windowStart).length;
      const rate = recentCount / 3;
      if (rate > ctx.rateLimit * RISK_THRESHOLDS.RATE_CRITICAL_MULTIPLIER) {
        return { risk: 'CRITICAL', reason: `Rate anomaly: ${rate.toFixed(0)}/s (limit: ${ctx.rateLimit})` };
      }
      if (rate > ctx.rateLimit * RISK_THRESHOLDS.RATE_HIGH_MULTIPLIER) {
        return { risk: 'HIGH', reason: `Rate anomaly: ${rate.toFixed(0)}/s (limit: ${ctx.rateLimit})` };
      }
      return { risk: 'NONE', reason: '' };
    },
  },
];

export class RiskEngine {
  private recentEvents: AiActionEvent[] = [];
  private readonly windowMs = 60_000;

  classify(event: AiActionEvent, context: Omit<RiskContext, 'recentEvents'>): RiskResult {
    // Maintain recent events window
    const cutoff = event.timestamp - this.windowMs;
    this.recentEvents = this.recentEvents.filter(e => e.timestamp > cutoff);
    this.recentEvents.push(event);

    const fullCtx: RiskContext = { ...context, recentEvents: this.recentEvents };
    const results: RuleResult[] = [];

    for (const rule of BUILT_IN_RULES) {
      const result = rule.evaluate(event, fullCtx);
      if (result.risk !== 'NONE') {
        results.push({
          ruleName: rule.name,
          riskLevel: result.risk,
          reason: result.reason,
          shouldBlock: result.block ?? false,
        });
      }
    }

    if (results.length === 0) {
      return { risk: 'NONE', reasons: [], shouldBlock: false, shouldAutoStop: false, ruleResults: [] };
    }

    const maxRisk = results.reduce((max, r) =>
      RISK_VALUE[r.riskLevel] > RISK_VALUE[max.riskLevel] ? r : max,
    );

    const reasons = results
      .filter(r => RISK_VALUE[r.riskLevel] >= RISK_VALUE[maxRisk.riskLevel])
      .map(r => `[${r.ruleName}] ${r.reason}`);

    const shouldBlock = results.some(r => r.shouldBlock);
    const shouldAutoStop = RISK_VALUE[maxRisk.riskLevel] >= RISK_VALUE[context.autoStopThreshold];

    return { risk: maxRisk.riskLevel, reasons, shouldBlock, shouldAutoStop, ruleResults: results };
  }
}
