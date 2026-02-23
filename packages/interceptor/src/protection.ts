import picomatch from 'picomatch';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import type { ProtectionZoneConfig, OperationType, ProtectionLevel } from '@voltron/shared';
import { SELF_PROTECTION_PATHS } from '@voltron/shared';

interface ZoneCheckResult {
  level: ProtectionLevel;
  zone: ProtectionZoneConfig | null;
  blocked: boolean;
  reason: string;
}

export class ZoneGuard {
  private zones: ProtectionZoneConfig[] = [];
  private matchers = new Map<string, ReturnType<typeof picomatch>>();

  constructor(private projectRoot: string) {}

  setZones(zones: ProtectionZoneConfig[]): void {
    this.zones = zones;
    this.matchers.clear();
    for (const zone of zones) {
      this.matchers.set(zone.id, picomatch(zone.path));
    }
  }

  check(relPath: string, operation: OperationType): ZoneCheckResult {
    // Resolve symlinks
    let resolvedPath = relPath;
    try {
      const fullPath = join(this.projectRoot, relPath);
      const realPath = realpathSync(fullPath);
      resolvedPath = realPath.startsWith(this.projectRoot)
        ? realPath.slice(this.projectRoot.length + 1)
        : realPath;
    } catch {
      // File doesn't exist yet (CREATE) or can't resolve - use original
    }

    // Self-protection (hardcoded, highest priority)
    const fullResolvedPath = join(this.projectRoot, resolvedPath);
    for (const pattern of SELF_PROTECTION_PATHS) {
      if (picomatch.isMatch(fullResolvedPath, pattern) || picomatch.isMatch(resolvedPath, pattern)) {
        return {
          level: 'DO_NOT_TOUCH',
          zone: null,
          blocked: true,
          reason: `Self-protection: ${pattern}`,
        };
      }
    }

    // Check configured zones (most restrictive wins)
    let maxResult: ZoneCheckResult = { level: 'NONE', zone: null, blocked: false, reason: '' };

    for (const zone of this.zones) {
      const matcher = this.matchers.get(zone.id);
      if (!matcher) continue;

      if (matcher(resolvedPath) || matcher(relPath)) {
        if (zone.level === 'DO_NOT_TOUCH') {
          return {
            level: 'DO_NOT_TOUCH',
            zone,
            blocked: true,
            reason: zone.reason ?? `DO_NOT_TOUCH zone: ${zone.path}`,
          };
        }

        if (zone.level === 'SURGICAL_ONLY') {
          const allowed = zone.allowedOperations ?? [];
          const isAllowed = allowed.length === 0 || allowed.includes(operation);
          const blocked = !isAllowed;

          if (blocked) {
            return {
              level: 'SURGICAL_ONLY',
              zone,
              blocked: true,
              reason: `SURGICAL_ONLY zone: ${zone.path}, operation ${operation} not allowed`,
            };
          }

          // Track that we're in a surgical zone even if operation is allowed
          if (maxResult.level === 'NONE') {
            maxResult = {
              level: 'SURGICAL_ONLY',
              zone,
              blocked: false,
              reason: `SURGICAL_ONLY zone: ${zone.path}`,
            };
          }
        }
      }
    }

    return maxResult;
  }
}
