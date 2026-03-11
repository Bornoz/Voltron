# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-03-11

### Added
- **Quick Prompt Bar** — Persistent inline prompt input at the bottom of the dashboard. Spawn agents or inject instructions mid-session with Ctrl+Enter. Quick action chips for common tasks (Fix bugs, Add tests, Refactor, UI polish).
- **"Try Demo" CTA** — Full-page hero banner when no events exist, compact bar when events are present. Phase progress indicator shows demo state in real-time.
- **Reference Design Upload** — Drag-and-drop a design screenshot in the right panel. AI generates similar UI components based on the reference. Optional instruction text for customization.
- **Getting Started Checklist** — Interactive onboarding widget in the right panel. Auto-tracks progress (demo tried, agent spawned, zones configured, settings customized). Dismissible and persistent.
- **npx CLI Wrapper** — `npx voltron-ai` to start the server. Supports `--port`, `--demo` (auto-start demo), `--help`. Auto-detects local installation.
- **Enhanced Welcome Tour** — 7 steps (was 6). New steps for Interactive Demo and Quick Prompt Bar. Updated existing steps to cover Reference Design Upload.

### Changed
- Login page now shows feature highlights (14 Risk Rules, Real-time Monitor, File Protection, Circuit Breaker).
- Dashboard center panel now has a flex-column layout with QuickPromptBar always visible at bottom.
- Tour step icons updated: Project Selector replaced with Demo step, Agent Tab became Agent Workspace, Visual Editor now mentions Reference Design.

## [0.2.0] - 2026-03-11

### Added
- **Demo Mode** — Try Voltron without Claude CLI. Synthetic events showcase risk engine in real-time.
- **Progressive Disclosure Dashboard** — New users see clean 3-panel view. Power tools unlock as needed.
- **Security Hardening** — Auto-generated passwords, login rate limiting, security headers.
- **README Rewrite** — Story-driven README with horror scenarios, quick start, and feature overview.
- **CHANGELOG** — This file.

### Changed
- `.env.example` no longer ships with default password.
- Config auto-generates admin password if `VOLTRON_ADMIN_PASS` is empty.

## [0.1.0] - 2026-03-01

### Added
- **14-Rule Risk Engine** with 5 severity levels (NONE → CRITICAL).
- **XState v5 State Machine** for deterministic execution control with full audit trail.
- **File System Interceptor** with SHA-256 hashing, unified diffs, and git snapshots.
- **Protection Zones** — DO_NOT_TOUCH (absolute block) and SURGICAL_ONLY (restricted operations).
- **Circuit Breaker** — 50+ events/second triggers automatic emergency stop.
- **Real-time Mission Control Dashboard** with 91 React 19 components.
- **Agent GPS File Tracking** with navigation heatmap and minimap.
- **Visual Editor** — Click-to-select, drag-to-reposition, 30+ CSS context menu options.
- **Inline AI Chat** with file attachment support (PNG, PDF, code files).
- **Smart Setup** — AI-powered automatic project framework detection.
- **Session History** with event replay capability.
- **Prompt Versioning** and mid-session injection.
- **Behavior Scoring** and risk metrics over time.
- **GitHub Repository Analysis** for compliance checking.
- **SQLite Persistence** with 22 tables and full audit trails.
- **WebSocket Real-time** event streaming with slow client detection.
- **HTTP-only Session Authentication** with scrypt password hashing.
- **i18n Support** — English and Turkish translations.
- **393 Test Cases** across server, dashboard, and shared packages.
- **One-command Installer** (setup.sh) with systemd service creation.
- **Docker Support** with Dockerfile and docker-compose.yml.
