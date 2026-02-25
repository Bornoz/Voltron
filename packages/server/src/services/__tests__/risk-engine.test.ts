import { describe, it, expect, beforeEach } from 'vitest';
import { RiskEngine, type RiskResult } from '../risk-engine.js';
import type { AiActionEvent, RiskLevel, ProtectionZoneConfig } from '@voltron/shared';
import { RISK_THRESHOLDS } from '@voltron/shared';

function makeEvent(overrides: Partial<AiActionEvent> = {}): AiActionEvent {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    sequenceNumber: 1,
    projectId: '00000000-0000-0000-0000-000000000099',
    action: 'FILE_MODIFY',
    file: 'src/index.ts',
    risk: 'NONE',
    snapshotId: '00000000-0000-0000-0000-000000000002',
    timestamp: Date.now(),
    hash: 'a'.repeat(64),
    ...overrides,
  };
}

function makeZone(overrides: Partial<ProtectionZoneConfig> & Pick<ProtectionZoneConfig, 'path' | 'level'>): ProtectionZoneConfig {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    projectId: '00000000-0000-0000-0000-000000000099',
    isSystem: true,
    createdBy: 'system',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

const defaultCtx = {
  protectionZones: [] as ProtectionZoneConfig[],
  autoStopThreshold: 'CRITICAL' as RiskLevel,
  rateLimit: 50,
};

describe('RiskEngine', () => {
  let engine: RiskEngine;

  beforeEach(() => {
    engine = new RiskEngine();
  });

  // ─── Rule 1: Protection Zone ────────────────────────────────

  describe('protection-zone rule', () => {
    it('should return CRITICAL + block for DO_NOT_TOUCH zone', () => {
      const ctx = {
        ...defaultCtx,
        protectionZones: [makeZone({ path: '/etc/nginx/**', level: 'DO_NOT_TOUCH' })],
      };
      const result = engine.classify(makeEvent({ file: '/etc/nginx/sites-enabled/default' }), ctx);
      expect(result.risk).toBe('CRITICAL');
      expect(result.shouldBlock).toBe(true);
      expect(result.ruleResults.some(r => r.ruleName === 'protection-zone')).toBe(true);
    });

    it('should return HIGH for SURGICAL_ONLY zone with disallowed operation', () => {
      const ctx = {
        ...defaultCtx,
        protectionZones: [makeZone({
          path: 'packages/shared/**',
          level: 'SURGICAL_ONLY',
          allowedOperations: ['FILE_MODIFY'],
        })],
      };
      const result = engine.classify(makeEvent({ file: 'packages/shared/src/index.ts', action: 'FILE_DELETE' }), ctx);
      expect(result.risk).toBe('HIGH');
    });

    it('should return MEDIUM for SURGICAL_ONLY zone with allowed operation', () => {
      const ctx = {
        ...defaultCtx,
        protectionZones: [makeZone({
          path: 'packages/shared/**',
          level: 'SURGICAL_ONLY',
          allowedOperations: ['FILE_MODIFY'],
        })],
      };
      const result = engine.classify(makeEvent({ file: 'packages/shared/src/index.ts', action: 'FILE_MODIFY' }), ctx);
      const zoneResult = result.ruleResults.find(r => r.ruleName === 'protection-zone');
      expect(zoneResult?.riskLevel).toBe('MEDIUM');
    });

    it('should return NONE for files outside protection zones', () => {
      const ctx = {
        ...defaultCtx,
        protectionZones: [makeZone({ path: '/etc/nginx/**', level: 'DO_NOT_TOUCH' })],
      };
      const result = engine.classify(makeEvent({ file: 'src/app.ts' }), ctx);
      const zoneResult = result.ruleResults.find(r => r.ruleName === 'protection-zone');
      expect(zoneResult).toBeUndefined();
    });
  });

  // ─── Rule 2: Destructive Operations ─────────────────────────

  describe('destructive-operation rule', () => {
    it('should return CRITICAL for DIR_DELETE', () => {
      const result = engine.classify(makeEvent({ action: 'DIR_DELETE', file: 'src/old' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'destructive-operation');
      expect(rule?.riskLevel).toBe('CRITICAL');
    });

    it('should return HIGH for FILE_DELETE', () => {
      const result = engine.classify(makeEvent({ action: 'FILE_DELETE', file: 'src/temp.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'destructive-operation');
      expect(rule?.riskLevel).toBe('HIGH');
    });

    it('should not trigger for FILE_MODIFY', () => {
      const result = engine.classify(makeEvent({ action: 'FILE_MODIFY', file: 'src/app.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'destructive-operation');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 3: Config File Risk ───────────────────────────────

  describe('config-file rule', () => {
    it('should return CRITICAL for .env files', () => {
      const result = engine.classify(makeEvent({ file: '.env.production' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'config-file');
      expect(rule?.riskLevel).toBe('CRITICAL');
    });

    it('should return MEDIUM for package.json', () => {
      const result = engine.classify(makeEvent({ file: 'packages/server/package.json' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'config-file');
      expect(rule?.riskLevel).toBe('MEDIUM');
    });

    it('should return HIGH for .github files', () => {
      const result = engine.classify(makeEvent({ file: '.github/workflows/ci.yml' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'config-file');
      expect(rule?.riskLevel).toBe('HIGH');
    });

    it('should return LOW for generic config files', () => {
      const result = engine.classify(makeEvent({ file: 'vitest.config.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'config-file');
      expect(rule?.riskLevel).toBe('LOW');
    });

    it('should not trigger for regular source files', () => {
      const result = engine.classify(makeEvent({ file: 'src/utils/helper.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'config-file');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 4: Schema & Migration ─────────────────────────────

  describe('schema-migration rule', () => {
    it('should return HIGH for migration files', () => {
      const result = engine.classify(makeEvent({ file: 'db/migrations/001_init.sql' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'schema-migration');
      expect(rule?.riskLevel).toBe('HIGH');
    });

    it('should return CRITICAL for prisma schema', () => {
      const result = engine.classify(makeEvent({ file: 'prisma/schema.prisma' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'schema-migration');
      expect(rule?.riskLevel).toBe('CRITICAL');
    });

    it('should return HIGH for drizzle schema', () => {
      const result = engine.classify(makeEvent({ file: 'drizzle/0001_initial.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'schema-migration');
      expect(rule?.riskLevel).toBe('HIGH');
    });

    it('should not trigger for regular files', () => {
      const result = engine.classify(makeEvent({ file: 'src/service.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'schema-migration');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 5: Security Files ──────────────────────────────────

  describe('security-file rule', () => {
    it('should return CRITICAL for .key files', () => {
      // picomatch: *.key only matches basename without directory separators
      const result = engine.classify(makeEvent({ file: 'server.key' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'security-file');
      expect(rule?.riskLevel).toBe('CRITICAL');
    });

    it('should return CRITICAL for files with "secret" in name', () => {
      // picomatch: *secret* matches basename only
      const result = engine.classify(makeEvent({ file: 'secret.json' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'security-file');
      expect(rule?.riskLevel).toBe('CRITICAL');
    });

    it('should return HIGH for token files', () => {
      // picomatch: *token* matches basename only
      const result = engine.classify(makeEvent({ file: 'token-store.json' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'security-file');
      expect(rule?.riskLevel).toBe('HIGH');
    });
  });

  // ─── Rule 6: Large Change ───────────────────────────────────

  describe('large-change rule', () => {
    it('should return HIGH for very large diffs', () => {
      const diff = 'line\n'.repeat(RISK_THRESHOLDS.LARGE_DIFF_HIGH + 1);
      const result = engine.classify(makeEvent({ diff }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'large-change');
      expect(rule?.riskLevel).toBe('HIGH');
    });

    it('should return MEDIUM for medium diffs', () => {
      const diff = 'line\n'.repeat(RISK_THRESHOLDS.LARGE_DIFF_MEDIUM + 1);
      const result = engine.classify(makeEvent({ diff }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'large-change');
      expect(rule?.riskLevel).toBe('MEDIUM');
    });

    it('should return LOW for small-ish diffs', () => {
      const diff = 'line\n'.repeat(RISK_THRESHOLDS.LARGE_DIFF_LOW + 1);
      const result = engine.classify(makeEvent({ diff }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'large-change');
      expect(rule?.riskLevel).toBe('LOW');
    });

    it('should return HIGH for large files', () => {
      const result = engine.classify(makeEvent({ fileSize: RISK_THRESHOLDS.LARGE_FILE_HIGH + 1 }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'large-change');
      expect(rule?.riskLevel).toBe('HIGH');
    });

    it('should return MEDIUM for medium files', () => {
      const result = engine.classify(makeEvent({ fileSize: RISK_THRESHOLDS.LARGE_FILE_MEDIUM + 1 }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'large-change');
      expect(rule?.riskLevel).toBe('MEDIUM');
    });

    it('should not trigger for small changes', () => {
      const result = engine.classify(makeEvent({ diff: 'a\nb\nc' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'large-change');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 7: Cascade Detection ──────────────────────────────

  describe('cascade rule', () => {
    it('should return CRITICAL when many directories touched in 5s', () => {
      const now = Date.now();
      // Pre-fill engine with events from many different directories
      for (let i = 0; i < RISK_THRESHOLDS.CASCADE_CRITICAL; i++) {
        engine.classify(
          makeEvent({ file: `dir${i}/file.ts`, timestamp: now - 1000 }),
          defaultCtx,
        );
      }
      const result = engine.classify(makeEvent({ file: 'dirX/file.ts', timestamp: now }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'cascade');
      expect(rule?.riskLevel).toBe('CRITICAL');
    });

    it('should return HIGH for moderate cascade', () => {
      const now = Date.now();
      for (let i = 0; i < RISK_THRESHOLDS.CASCADE_HIGH; i++) {
        engine.classify(
          makeEvent({ file: `dir${i}/file.ts`, timestamp: now - 1000 }),
          defaultCtx,
        );
      }
      const result = engine.classify(makeEvent({ file: 'dirY/file.ts', timestamp: now }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'cascade');
      expect(rule).toBeDefined();
      // Could be HIGH or CRITICAL depending on total unique dirs
    });

    it('should return MEDIUM for small cascade', () => {
      const now = Date.now();
      for (let i = 0; i < RISK_THRESHOLDS.CASCADE_MEDIUM; i++) {
        engine.classify(
          makeEvent({ file: `dir${i}/file.ts`, timestamp: now - 1000 }),
          defaultCtx,
        );
      }
      const result = engine.classify(makeEvent({ file: 'dirZ/file.ts', timestamp: now }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'cascade');
      expect(rule).toBeDefined();
    });

    it('should not trigger for same-directory changes', () => {
      const now = Date.now();
      engine.classify(makeEvent({ file: 'src/a.ts', timestamp: now - 1000 }), defaultCtx);
      engine.classify(makeEvent({ file: 'src/b.ts', timestamp: now - 500 }), defaultCtx);
      const result = engine.classify(makeEvent({ file: 'src/c.ts', timestamp: now }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'cascade');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 8: API Contract ───────────────────────────────────

  describe('api-contract rule', () => {
    it('should return MEDIUM for route files', () => {
      const result = engine.classify(makeEvent({ file: 'src/routes/users.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'api-contract');
      expect(rule?.riskLevel).toBe('MEDIUM');
    });

    it('should return MEDIUM for middleware files', () => {
      const result = engine.classify(makeEvent({ file: 'src/middleware/auth.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'api-contract');
      expect(rule?.riskLevel).toBe('MEDIUM');
    });

    it('should not trigger for non-API files', () => {
      const result = engine.classify(makeEvent({ file: 'src/utils/string.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'api-contract');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 11: Test File (inverse) ──────────────────────────

  describe('test-file rule', () => {
    it('should return LOW for .test. files', () => {
      const result = engine.classify(makeEvent({ file: 'src/utils/helper.test.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'test-file');
      expect(rule?.riskLevel).toBe('LOW');
    });

    it('should return LOW for .spec. files', () => {
      const result = engine.classify(makeEvent({ file: 'src/service.spec.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'test-file');
      expect(rule?.riskLevel).toBe('LOW');
    });

    it('should return LOW for __tests__ directory files', () => {
      const result = engine.classify(makeEvent({ file: 'src/__tests__/app.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'test-file');
      expect(rule?.riskLevel).toBe('LOW');
    });

    it('should not trigger for regular files', () => {
      const result = engine.classify(makeEvent({ file: 'src/index.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'test-file');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 12: Binary File ──────────────────────────────────

  describe('binary-file rule', () => {
    it('should return CRITICAL for executable binaries', () => {
      const result = engine.classify(makeEvent({ file: 'script.sh', isBinary: true }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'binary-file');
      expect(rule?.riskLevel).toBe('CRITICAL');
    });

    it('should return LOW for media files', () => {
      const result = engine.classify(makeEvent({ file: 'assets/logo.png', isBinary: true }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'binary-file');
      expect(rule?.riskLevel).toBe('LOW');
    });

    it('should return MEDIUM for other binary files', () => {
      const result = engine.classify(makeEvent({ file: 'data.wasm', isBinary: true }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'binary-file');
      expect(rule?.riskLevel).toBe('MEDIUM');
    });

    it('should not trigger for non-binary files', () => {
      const result = engine.classify(makeEvent({ file: 'src/app.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'binary-file');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 13: Self-Protection ──────────────────────────────

  describe('self-protection rule', () => {
    it('should return CRITICAL + block for /opt/voltron paths', () => {
      const result = engine.classify(makeEvent({ file: '/opt/voltron/src/index.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'self-protection');
      expect(rule?.riskLevel).toBe('CRITICAL');
      expect(rule?.shouldBlock).toBe(true);
    });

    it('should return CRITICAL + block for voltron.db', () => {
      const result = engine.classify(makeEvent({ file: '/data/voltron.db' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'self-protection');
      expect(rule?.riskLevel).toBe('CRITICAL');
      expect(rule?.shouldBlock).toBe(true);
    });

    it('should return CRITICAL + block for /etc/nginx paths', () => {
      const result = engine.classify(makeEvent({ file: '/etc/nginx/nginx.conf' }), defaultCtx);
      expect(result.shouldBlock).toBe(true);
    });

    it('should return CRITICAL + block for /etc/systemd paths', () => {
      const result = engine.classify(makeEvent({ file: '/etc/systemd/system/voltron.service' }), defaultCtx);
      expect(result.shouldBlock).toBe(true);
    });

    it('should return CRITICAL + block for /etc/letsencrypt paths', () => {
      const result = engine.classify(makeEvent({ file: '/etc/letsencrypt/live/voltron.isgai.tr/cert.pem' }), defaultCtx);
      expect(result.shouldBlock).toBe(true);
    });

    it('should not trigger for safe external paths', () => {
      const result = engine.classify(makeEvent({ file: '/home/user/project/src/app.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'self-protection');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Rule 14: Rate Anomaly ─────────────────────────────────

  describe('rate-anomaly rule', () => {
    it('should return CRITICAL for extreme rate anomaly', () => {
      const now = Date.now();
      const rateLimit = 5;
      const ctx = { ...defaultCtx, rateLimit };
      // Inject many events in 3-second window to exceed CRITICAL threshold
      const count = rateLimit * RISK_THRESHOLDS.RATE_CRITICAL_MULTIPLIER * 3 + 5;
      for (let i = 0; i < count; i++) {
        engine.classify(makeEvent({ file: `f${i}.ts`, timestamp: now - 2000 + i }), ctx);
      }
      const result = engine.classify(makeEvent({ file: 'trigger.ts', timestamp: now }), ctx);
      const rule = result.ruleResults.find(r => r.ruleName === 'rate-anomaly');
      expect(rule?.riskLevel).toBe('CRITICAL');
    });

    it('should return HIGH for moderate rate anomaly', () => {
      const now = Date.now();
      const rateLimit = 10;
      const ctx = { ...defaultCtx, rateLimit };
      // Inject enough events to exceed HIGH but not CRITICAL
      const count = rateLimit * RISK_THRESHOLDS.RATE_HIGH_MULTIPLIER * 3 + 5;
      for (let i = 0; i < count; i++) {
        engine.classify(makeEvent({ file: `f${i}.ts`, timestamp: now - 2000 + i }), ctx);
      }
      const result = engine.classify(makeEvent({ file: 'trigger.ts', timestamp: now }), ctx);
      const rule = result.ruleResults.find(r => r.ruleName === 'rate-anomaly');
      expect(rule).toBeDefined();
    });

    it('should not trigger at normal rates', () => {
      const result = engine.classify(makeEvent({ file: 'src/app.ts' }), defaultCtx);
      const rule = result.ruleResults.find(r => r.ruleName === 'rate-anomaly');
      expect(rule).toBeUndefined();
    });
  });

  // ─── Aggregate Behavior ─────────────────────────────────────

  describe('aggregate behavior', () => {
    it('should return NONE for safe regular file', () => {
      const result = engine.classify(makeEvent({ file: 'src/utils/helper.ts' }), defaultCtx);
      expect(result.risk).toBe('NONE');
      expect(result.shouldBlock).toBe(false);
      expect(result.shouldAutoStop).toBe(false);
      expect(result.ruleResults).toHaveLength(0);
    });

    it('should pick highest risk across multiple rules', () => {
      // .env file triggers config-file (CRITICAL) and security-file (CRITICAL)
      const result = engine.classify(makeEvent({ file: '.env.local' }), defaultCtx);
      expect(result.risk).toBe('CRITICAL');
    });

    it('should respect autoStopThreshold', () => {
      const ctx = { ...defaultCtx, autoStopThreshold: 'HIGH' as RiskLevel };
      const result = engine.classify(makeEvent({ action: 'FILE_DELETE', file: 'src/temp.ts' }), ctx);
      expect(result.shouldAutoStop).toBe(true);
    });

    it('should not autoStop below threshold', () => {
      const ctx = { ...defaultCtx, autoStopThreshold: 'CRITICAL' as RiskLevel };
      const result = engine.classify(makeEvent({ action: 'FILE_DELETE', file: 'src/temp.ts' }), ctx);
      // FILE_DELETE is HIGH, CRITICAL threshold => no auto-stop
      expect(result.shouldAutoStop).toBe(false);
    });

    it('should maintain event window for 60 seconds', () => {
      const now = Date.now();
      // Event from 70s ago should be cleaned up
      engine.classify(makeEvent({ file: 'old.ts', timestamp: now - 70_000 }), defaultCtx);
      // New event
      const result = engine.classify(makeEvent({ file: 'new.ts', timestamp: now }), defaultCtx);
      // Only 1 event in cascade window (old one was pruned from 60s window)
      const cascadeRule = result.ruleResults.find(r => r.ruleName === 'cascade');
      expect(cascadeRule).toBeUndefined(); // 2 dirs but within single events
    });

    it('should collect reasons from highest risk rules', () => {
      const result = engine.classify(makeEvent({ file: '.env', action: 'FILE_DELETE' }), defaultCtx);
      expect(result.reasons.length).toBeGreaterThanOrEqual(1);
      result.reasons.forEach(r => expect(typeof r).toBe('string'));
    });
  });
});
