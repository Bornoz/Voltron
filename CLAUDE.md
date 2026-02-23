# Voltron - AI Operation Control Center

## What is this?
Mission-critical AI agent governance platform. Controls, monitors, and protects AI coding agents.

## Architecture
- Monorepo with pnpm workspaces
- 5 packages: shared, interceptor, server, dashboard, ui-simulator
- TypeScript throughout, ESM modules

## Commands
- `pnpm install` - Install all dependencies
- `pnpm build` - Build all packages (shared first)
- `pnpm dev` - Start dev servers (server:8600, dashboard:6400, simulator:5174)
- `pnpm typecheck` - Type check all packages

## Critical Rules
- NEVER modify files in /etc/nginx/ - existing sites are sacred
- NEVER modify /etc/systemd/ without explicit approval
- All database queries MUST use prepared statements
- All WebSocket messages MUST be validated with Zod schemas
- action_log table is APPEND-ONLY (no UPDATE/DELETE)
- Self-protection zones are hardcoded and non-configurable

## Tech Stack
- Backend: Fastify v5, better-sqlite3, XState v5
- Frontend: React 19, Vite 6, Tailwind v4, Zustand v5
- Validation: Zod
- Real-time: WebSocket (@fastify/websocket)
