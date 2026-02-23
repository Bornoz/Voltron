# Adım 2: @voltron/shared

## Amaç
Tüm paketler tarafından kullanılan ortak tip tanımları, Zod şemaları, sabitler ve yardımcı fonksiyonları merkezi bir pakette toplamak.

## Oluşturulan Dosyalar

| Dosya | Amaç |
|-------|------|
| `packages/shared/package.json` | Paket config, bağımlılıklar (zod, typescript) |
| `packages/shared/tsconfig.json` | TS config (extends base) |
| `src/types/risk.ts` | RiskLevel enum (NONE/LOW/MEDIUM/HIGH/CRITICAL), RISK_VALUE map, OperationType enum |
| `src/types/protection.ts` | ProtectionLevel (DO_NOT_TOUCH/SURGICAL_ONLY/WATCHED), ProtectionZoneConfig |
| `src/types/state.ts` | ExecutionState (IDLE/RUNNING/STOPPED/RESUMING/ERROR), ExecutionContext |
| `src/types/events.ts` | AiActionEvent (temel event şeması - tüm pipeline'ın taşıdığı veri), Snapshot |
| `src/types/project.ts` | ProjectConfig, CreateProjectInput, UpdateProjectInput |
| `src/types/ws-protocol.ts` | WsMessageType (25 tip), WsMessage, ClientRegistration |
| `src/types/github.ts` | DependencyGraph, BreakingChangeReport, ArchitectureComplianceResult |
| `src/types/simulator.ts` | StyleChange, LayoutChange, SimulatorConflict |
| `src/constants/risk-levels.ts` | Risk threshold değerleri, renk kodları |
| `src/constants/protection-zones.ts` | SELF_PROTECTION_PATHS (Voltron kendini korur) |
| `src/constants/event-names.ts` | WS event isimleri |
| `src/constants/defaults.ts` | Default config değerleri (DEFAULTS objesi) |
| `src/utils/hash.ts` | SHA256 hash fonksiyonu (node:crypto) |
| `src/utils/path.ts` | Path normalization, relative path |
| `src/utils/validation.ts` | Zod validation helpers |
| `src/index.ts` | Barrel export (tüm public API) |

## Kritik Tipler

### AiActionEvent
Tüm sistemin temel veri birimi. Interceptor yaratır, server sınıflandırır, dashboard gösterir:
```typescript
{
  id, projectId, timestamp,
  operation: OperationType,    // CREATE/MODIFY/DELETE/RENAME/CHMOD
  filePath, oldPath?,
  hash?, oldHash?,
  diff?, diffSize?,
  snapshotId?,
  riskLevel?: RiskLevel,
  riskReasons?: string[],
  metadata?: Record<string, unknown>
}
```

### WsMessageType (25 mesaj)
CLIENT_REGISTER, ACTION_EVENT, COMMAND_STOP, COMMAND_CONTINUE, STATE_CHANGE, RISK_ALERT, ZONE_VIOLATION, CIRCUIT_BREAKER_TRIP, vb.

## Komutlar
```bash
pnpm --filter @voltron/shared build    # TypeScript → dist/
pnpm --filter @voltron/shared typecheck
```
