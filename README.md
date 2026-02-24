<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/Fastify_v5-000000?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify" />
  <img src="https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="WebSocket" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

<h1 align="center">VOLTRON</h1>
<h3 align="center">AI Operation Control Center</h3>

<p align="center">
  <strong>Real-time governance, monitoring, and protection platform for AI coding agents.</strong>
  <br />
  Control the uncontrollable. Monitor the invisible. Protect the irreversible.
</p>

<p align="center">
  <a href="#architecture">Architecture</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#documentation">Documentation</a> &middot;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## The Problem

AI coding agents (Claude Code, Cursor, Copilot, Devin, etc.) are powerful but operate without guardrails. A single agent can:

- Delete critical production files
- Commit secrets and credentials to version control
- Corrupt system configurations
- Enter infinite loops, generating hundreds of files
- Disable its own control mechanisms

**There is no industry-standard solution for governing AI agents in real-time.**

## The Solution

Voltron is an **agent-agnostic meta-control layer** that sits between AI coding agents and the file system. It intercepts, analyzes, and governs every action in real-time &mdash; giving human operators full visibility and control over autonomous AI operations.

Think of it as **Mission Control for AI Agents**.

---

## Architecture

Voltron is built as a **5-layer monorepo** with clear separation of concerns:

```
 [AI Agent]  writes files
      |
      v
 @voltron/interceptor     Layer 1: Intercept, hash, diff, snapshot
      |
      v (WebSocket)
 @voltron/server           Layer 2: Risk engine, state machine, database
      |
      v (WebSocket)
 @voltron/dashboard        Layer 3: Real-time monitoring & control UI
      |
      v
 @voltron/ui-simulator     Layer 4: Sandboxed preview with live editing
      |
 @voltron/shared           Shared types, schemas, constants
```

| Layer | Package | Responsibility |
|-------|---------|----------------|
| Intercept | `@voltron/interceptor` | File system monitoring, cryptographic hashing, diff generation, snapshots, zone guards |
| Brain | `@voltron/server` | Central API, WebSocket hub, XState state machine, 14-rule risk engine, SQLite persistence |
| Control | `@voltron/dashboard` | Real-time Mission Control UI with action feeds, risk gauges, execution controls |
| Preview | `@voltron/ui-simulator` | Sandboxed UI preview, visual editing, bidirectional sync with agents |
| Foundation | `@voltron/shared` | TypeScript types, Zod validation schemas, shared constants |

---

## Features

### Risk Engine (14 Rules)
Every AI action is classified in real-time:

| Level | Action |
|-------|--------|
| **NONE** | Log only |
| **LOW** | Log + display |
| **MEDIUM** | Log + highlight |
| **HIGH** | Log + alert + requires review |
| **CRITICAL** | Log + alert + **automatic stop** |

### State Machine (XState v5)
Deterministic execution control with full state history:
```
IDLE -> RUNNING -> STOPPED -> RESUMING -> RUNNING
                      ^
                ERROR <-> (recovery)
```

### Protection Zones
- **DO_NOT_TOUCH**: Absolute protection (nginx, SSL, Voltron itself)
- **SURGICAL_ONLY**: Permits only specific operations

### Circuit Breaker
50+ events/second = automatic emergency stop (runaway agent detection).

### Agent Orchestration
- Spawn Claude Code agents directly from the dashboard
- Real-time GPS tracking of agent file navigation
- Plan extraction and progress monitoring
- Prompt injection for mid-session course correction
- Automatic dev server startup with HMR-enabled live preview

### Visual Editor
- Click-to-select elements in the live preview
- Drag to reposition, resize, recolor, restyle
- All visual changes are automatically injected into the agent as instructions

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript (ESM throughout) |
| Backend | Fastify v5, better-sqlite3, XState v5 |
| Frontend | React 19, Vite 6, Tailwind CSS v4, Zustand v5 |
| Validation | Zod (all entry points) |
| Real-time | WebSocket (@fastify/websocket) |
| Charts | Recharts |
| Monorepo | pnpm workspaces |
| Runtime | Node.js >= 20 |

---

## Quick Start

### Prerequisites
- **Node.js** >= 20
- **pnpm** >= 9 (via corepack: `corepack enable`)
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/Bornoz/Voltron.git
cd Voltron

# Install dependencies
pnpm install

# Build all packages (shared must build first)
pnpm build

# Copy environment configuration
cp .env.example .env
# Edit .env with your settings

# Start development servers
pnpm dev
```

### Development Servers

| Service | Port | URL |
|---------|------|-----|
| API Server | 8600 | `http://localhost:8600` |
| Dashboard | 6400 | `http://localhost:6400` |
| UI Simulator | 5174 | `http://localhost:5174` |

### Useful Commands

```bash
pnpm build        # Build all packages
pnpm dev          # Start all dev servers
pnpm typecheck    # Type-check all packages
pnpm clean        # Remove all dist/ directories
```

---

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

| Document | Description |
|----------|-------------|
| [Big Picture](docs/BIG-PICTURE.md) | Platform overview, architecture philosophy |
| [Step 01: Monorepo](docs/STEP-01-MONOREPO.md) | Workspace setup and package structure |
| [Step 02: Shared](docs/STEP-02-SHARED.md) | Common types, schemas, constants |
| [Step 03: Server](docs/STEP-03-SERVER-SKELETON.md) | Backend architecture and API design |
| [Step 04: Interceptor](docs/STEP-04-INTERCEPTOR.md) | File system monitoring and change detection |
| [Step 05: WS + State + Risk](docs/STEP-05-WS-STATE-RISK.md) | WebSocket hub, state machine, risk engine |
| [Step 06: Integration](docs/STEP-06-INTEGRATION.md) | End-to-end pipeline integration |
| [Step 07: Dashboard](docs/STEP-07-DASHBOARD.md) | Mission Control UI implementation |
| [Step 08: Simulator](docs/STEP-08-SIMULATOR.md) | Sandboxed preview and visual editing |
| [Step 09: GitHub](docs/STEP-09-GITHUB.md) | Repository analysis and compliance |
| [Step 10: Deployment](docs/STEP-10-DEPLOYMENT.md) | Production deployment guide |

---

## Project Structure

```
voltron/
  packages/
    shared/          # @voltron/shared - Types, schemas, constants
    interceptor/     # @voltron/interceptor - File system monitoring
    server/          # @voltron/server - API, WebSocket, state machine
    dashboard/       # @voltron/dashboard - React Mission Control UI
    ui-simulator/    # @voltron/ui-simulator - Sandboxed preview
  docs/              # Architecture and implementation documentation
  scripts/           # Development and deployment scripts
  .env.example       # Environment configuration template
```

---

## Contributing

We welcome contributions from the developer community. Whether you are fixing a bug, proposing a new feature, improving documentation, or optimizing performance &mdash; your input is valued.

Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

---

## Security

Voltron handles sensitive operational data. If you discover a security vulnerability, please report it responsibly. See our [Security Policy](SECURITY.md) for details.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Voltron</strong> &mdash; Because AI agents need governance, not just guardrails.
  <br />
  <sub>Built with discipline. Operated with control.</sub>
</p>
