# Adım 3: @voltron/server (İskelet)

## Amaç
Merkezi backend sunucu - Fastify v5 app factory, SQLite veritabanı, repository pattern, temel REST API route'ları.

## Oluşturulan Dosyalar

| Dosya | Amaç |
|-------|------|
| `packages/server/package.json` | Bağımlılıklar: fastify, @fastify/websocket, @fastify/cors, better-sqlite3, xstate, zod, picomatch |
| `packages/server/tsconfig.json` | TS config |
| `src/config.ts` | ServerConfig interface, loadConfig() - env vars'dan config yükleme |
| `src/db/connection.ts` | SQLite singleton (WAL mode, foreign keys, busy timeout, mmap) |
| `src/db/schema.ts` | 8 tablo + 3 trigger: projects, action_log, snapshots, protection_zones, execution_state, state_history, sessions, github_cache |
| `src/db/reset.ts` | DB reset utility |
| `src/db/repositories/projects.ts` | Project CRUD (prepared statement cache) |
| `src/db/repositories/actions.ts` | Action log: insert, findByProject, findByRisk, findByFile, getStats |
| `src/db/repositories/snapshots.ts` | Snapshot CRUD |
| `src/db/repositories/protection-zones.ts` | Zone CRUD, findByProject, findByPath |
| `src/db/repositories/execution-state.ts` | State persistence, upsert, crash recovery |
| `src/db/repositories/state-history.ts` | Append-only state transition log |
| `src/db/repositories/sessions.ts` | WS session tracking |
| `src/db/repositories/github-cache.ts` | GitHub analysis cache (24h TTL) |
| `src/services/event-bus.ts` | Typed pub/sub with error isolation |
| `src/plugins/cors.ts` | CORS config |
| `src/plugins/error-handler.ts` | Global error handler |
| `src/routes/health.ts` | GET /api/health |
| `src/routes/projects.ts` | CRUD /api/projects |
| `src/routes/actions.ts` | GET /api/projects/:id/actions |
| `src/routes/snapshots.ts` | GET /api/projects/:id/snapshots |
| `src/routes/protection.ts` | CRUD /api/projects/:id/zones |
| `src/app.ts` | Fastify app factory - plugin/route registration |
| `src/index.ts` | Entry point + graceful shutdown |

## SQLite Schema Highlights
- **WAL mode**: Concurrent reads, non-blocking writes
- **Prepared statements**: Her repository kendi statement cache'ini tutar
- **Append-only action_log**: DELETE trigger ile korunur (audit trail)
- **system zone protection**: system_default zone'lar silinemez
- **Foreign keys**: ON DELETE CASCADE

## Komutlar
```bash
pnpm --filter @voltron/server build
pnpm --filter @voltron/server start      # Production
pnpm --filter @voltron/server dev        # Development (tsx watch)
```
