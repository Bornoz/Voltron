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
- Session history with replay capability

### Visual Editor
- Click-to-select elements in the live preview
- Drag to reposition, resize, recolor, restyle
- All visual changes are automatically injected into the agent as instructions
- Advanced context menu with 30+ CSS/layout/element/inspector options
- Pixel-perfect coordinates and exact color values (hex + rgb)

### AI Chat
- Inline chat popup for real-time conversation with agents
- Agent responses displayed as chat bubbles
- File attachment support (PNG, JPEG, PDF, TXT, code files)
- Unread message badges and minimizable panel

### Live Preview
- Automatic dev server startup when agent writes trigger files
- Rendered UI preview (not source code) through Voltron proxy
- Editor script injection for visual editing integration

### Activity Timeline
- Chronological view of all agent activities
- Breadcrumb trail with file paths and tool usage
- Phase tracking with status indicators
- Injection history with status tracking
- Persistent across page refreshes (loaded from database)

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

### One-Command Install (Recommended)

The fastest way to get Voltron running. A single command handles everything:

```bash
curl -fsSL https://raw.githubusercontent.com/Bornoz/Voltron/main/setup.sh | sudo bash
```

Or if you already cloned the repository:

```bash
sudo bash setup.sh
```

**What the installer does:**
1. Installs system dependencies (git, curl, jq)
2. Installs/verifies Node.js >= 20
3. Installs pnpm package manager
4. Clones and builds all Voltron packages
5. Installs Claude CLI and guides you through authentication
6. Generates secure environment configuration
7. Creates a systemd service for auto-start
8. Starts Voltron and opens the dashboard in your browser

After installation, access Voltron at: **http://localhost:8600**
Default credentials: `admin` / `voltron2026`

### Manual Installation

#### Prerequisites
- **Node.js** >= 20
- **pnpm** >= 9 (via corepack: `corepack enable`)
- **Git**
- **Claude CLI** (optional, for AI agent features): `npm install -g @anthropic-ai/claude-code`

#### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Bornoz/Voltron.git
cd Voltron

# 2. Install dependencies
pnpm install

# 3. Build all packages (shared must build first)
pnpm build

# 4. Copy environment configuration
cp .env.example .env
# Edit .env with your settings

# 5. Start development servers
pnpm dev
```

### Claude CLI Integration

Voltron uses Claude CLI to power its AI agent features. When Claude is authenticated on your system, Voltron automatically detects and integrates with it.

```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Authenticate (opens browser for login)
claude auth login

# Verify authentication
claude --print -p "Hello" --output-format text --max-tokens 10
```

Once authenticated, you can:
- Spawn AI agents from the Voltron dashboard
- Monitor agent activity in real-time via GPS tracking
- Inject prompts mid-session for course correction
- View agent plans and progress
- Chat with agents via the inline chat popup

### Development Servers

| Service | Port | URL |
|---------|------|-----|
| API Server | 8600 | `http://localhost:8600` |
| Dashboard | 6400 | `http://localhost:6400` |
| UI Simulator | 5174 | `http://localhost:5174` |

### Production Deployment

```bash
# Build for production
pnpm build

# Set environment variables
export NODE_ENV=production
export VOLTRON_PORT=8600
export VOLTRON_INTERCEPTOR_SECRET=$(openssl rand -hex 32)
export VOLTRON_AUTH_SECRET=$(openssl rand -hex 32)
export VOLTRON_CLAUDE_PATH=$(which claude)

# Start server (serves both API and dashboard UI)
node packages/server/dist/index.js
```

Or use the systemd service (created by setup.sh):
```bash
systemctl start voltron
systemctl enable voltron    # Auto-start on boot
journalctl -u voltron -f   # View live logs
```

### Useful Commands

```bash
pnpm build        # Build all packages
pnpm dev          # Start all dev servers
pnpm typecheck    # Type-check all packages
pnpm test         # Run all 309 tests
pnpm clean        # Remove all dist/ directories
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VOLTRON_PORT` | 8600 | Server listening port |
| `VOLTRON_HOST` | 127.0.0.1 | Bind address |
| `VOLTRON_DB_PATH` | data/voltron.db | SQLite database path |
| `VOLTRON_LOG_LEVEL` | info | Log level (fatal/error/warn/info/debug) |
| `VOLTRON_INTERCEPTOR_SECRET` | (required in prod) | HMAC-SHA256 auth secret |
| `VOLTRON_AUTH_SECRET` | (required in prod) | Session auth secret |
| `VOLTRON_CLAUDE_PATH` | claude | Path to Claude CLI binary |
| `VOLTRON_AGENT_MODEL` | claude-haiku-4-5-20251001 | Default AI model |
| `VOLTRON_ADMIN_USER` | (optional) | Admin username |
| `VOLTRON_ADMIN_PASS` | (optional) | Admin password |

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

## Author

**Ömer Akdemir** - Turkey

---

<p align="center">
  <strong>Voltron</strong> &mdash; Because AI agents need governance, not just guardrails.
  <br />
  <sub>Built with discipline. Operated with control.</sub>
</p>
