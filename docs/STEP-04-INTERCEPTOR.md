# Adım 4: @voltron/interceptor

## Amaç
Dosya sistemi izleme katmanı. AI agent'ın yaptığı her dosya değişikliğini yakalar, hash'ler, diff oluşturur, snapshot alır ve server'a iletir.

## Oluşturulan Dosyalar

| Dosya | Amaç |
|-------|------|
| `packages/interceptor/package.json` | Bağımlılıklar: chokidar, simple-git, picomatch, ws |
| `packages/interceptor/tsconfig.json` | TS config |
| `src/config.ts` | InterceptorConfig - CLI args + env vars parsing |
| `src/watcher.ts` | FileWatcher - chokidar v4, debounce, ignore patterns, rename detection, pause/resume |
| `src/hasher.ts` | HashTracker - SHA256, startup full-scan, incremental updates |
| `src/differ.ts` | DiffGenerator - simple-git unified diff, binary detection, max size limit |
| `src/protection.ts` | ZoneGuard - picomatch glob matching, symlink resolution, self-protection |
| `src/snapshot.ts` | SnapshotManager - simple-git atomic commits, auto-snapshot |
| `src/bridge.ts` | ServerBridge - WS client, auto-reconnect (exponential backoff), message queue, heartbeat |
| `src/reconciler.ts` | Periodic full-scan reconciliation (60s interval), drift detection |
| `src/rate-limiter.ts` | Event rate monitoring, circuit breaker trigger |
| `src/interceptor.ts` | Main orchestrator - tüm bileşenleri birbirine bağlar |
| `src/index.ts` | Entry point - CLI |

## Data Flow
```
[AI Agent dosya yazar]
      ↓
FileWatcher (chokidar) → change event
      ↓
HashTracker → SHA256 hash hesapla, değişim var mı?
      ↓
ZoneGuard → Koruma zone'u ihlali var mı?
      ↓ (violation varsa → ZONE_VIOLATION event)
DiffGenerator → Unified diff oluştur
      ↓
SnapshotManager → Git commit al
      ↓
ServerBridge → AiActionEvent olarak WS ile server'a gönder
```

## Koruma Mekanizmaları
- **Self-protection**: Voltron'un kendi dosyaları (SELF_PROTECTION_PATHS) korunur
- **Symlink resolution**: Symlink'ler gerçek path'e çözümlenir
- **Binary detection**: Binary dosyalar diff yerine [BINARY] marker alır
- **Rate limiting**: Saniyede 50+ event → circuit breaker tetiklenir
- **Reconnect queue**: Server bağlantısı koparsa event'ler kuyrukta bekler

## Komutlar
```bash
pnpm --filter @voltron/interceptor build
pnpm --filter @voltron/interceptor start -- --project-id=xxx --watch-path=/path --server-url=ws://localhost:3099
```
