# Contributing to Voltron

Thank you for your interest in contributing to Voltron!

## Development Setup

```bash
# Prerequisites: Node.js >= 20, pnpm >= 9
git clone https://github.com/Bornoz/Voltron.git
cd Voltron
pnpm install
cp .env.example .env
pnpm build
pnpm dev
```

This starts three dev servers:
- **Server**: http://localhost:8600
- **Dashboard**: http://localhost:6400 (proxies API to server)
- **UI Simulator**: http://localhost:5174

## Project Structure

```
packages/
  shared/        # Shared types, constants, Zod schemas
  interceptor/   # File system watcher + risk engine
  server/        # Fastify API + WebSocket + SQLite
  dashboard/     # React 19 + Vite + Tailwind v4
  ui-simulator/  # Live preview iframe sandbox
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages (shared first) |
| `pnpm dev` | Start all dev servers |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm lint` | ESLint check |

## Guidelines

- TypeScript throughout — no `any` types without justification
- All WebSocket messages validated with Zod schemas
- Database queries use prepared statements (SQL injection prevention)
- `action_log` table is append-only (no UPDATE/DELETE)
- All changes must pass `pnpm typecheck && pnpm build && pnpm test`

## Architecture Rules

- **Never** modify `/etc/nginx/` or `/etc/systemd/` configurations
- Self-protection zones are hardcoded and non-configurable
- Backend: Fastify v5, better-sqlite3, XState v5
- Frontend: React 19, Vite 6, Tailwind v4, Zustand v5

## Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run `pnpm typecheck && pnpm build && pnpm test`
5. Submit a pull request

## Reporting Issues

Use the [GitHub Issues](https://github.com/Bornoz/Voltron/issues) page.
