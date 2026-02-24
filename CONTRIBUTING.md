# Contributing to Voltron

Thank you for your interest in contributing to Voltron. We value every contribution, whether it is a bug fix, a new feature, documentation improvement, or a performance optimization.

This document provides guidelines to help you get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Architecture Guidelines](#architecture-guidelines)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). We are committed to fostering a welcoming and respectful environment for everyone.

---

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (enable via `corepack enable`)
- **Git**

### Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/<your-username>/Voltron.git
cd Voltron

# 3. Install dependencies
pnpm install

# 4. Build all packages
pnpm build

# 5. Start development servers
pnpm dev
```

### Project Structure

Voltron is a monorepo with 5 packages. Understanding their responsibilities is essential:

| Package | Purpose |
|---------|---------|
| `@voltron/shared` | Types, Zod schemas, constants (must build first) |
| `@voltron/interceptor` | File system monitoring, hashing, diffs |
| `@voltron/server` | Fastify API, WebSocket hub, risk engine, state machine |
| `@voltron/dashboard` | React 19 Mission Control UI |
| `@voltron/ui-simulator` | Sandboxed preview and visual editing |

---

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** in the appropriate package(s).

3. **Type-check** your changes:
   ```bash
   pnpm typecheck
   ```

4. **Build** to verify everything compiles:
   ```bash
   pnpm build
   ```

5. **Test locally** by running the dev servers:
   ```bash
   pnpm dev
   ```

6. **Commit** following our conventions (see below).

7. **Push** and open a pull request.

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Tooling, CI, dependencies |

### Scopes

Use the package name as scope when applicable: `server`, `dashboard`, `shared`, `interceptor`, `simulator`.

### Examples

```
feat(server): add dev server auto-start on agent completion
fix(dashboard): resolve iframe refresh on status change
docs: update README with deployment instructions
refactor(shared): simplify Zod schema exports
```

---

## Pull Request Process

1. **One concern per PR.** Keep pull requests focused on a single change.

2. **Describe your changes.** Include:
   - A clear summary of what changed and why
   - Screenshots for UI changes
   - Steps to test the change

3. **Ensure the build passes.** Run `pnpm build` and `pnpm typecheck` before submitting.

4. **Link related issues.** Reference any GitHub issues your PR addresses.

5. **Be responsive to feedback.** Maintainers may request changes during review.

### PR Title Format

Follow the same convention as commits:
```
feat(dashboard): add dark mode toggle
```

---

## Architecture Guidelines

When contributing to Voltron, please adhere to these principles:

### General

- **TypeScript throughout.** No `any` types unless absolutely necessary.
- **ESM modules only.** All packages use ES module syntax.
- **Zod validation** at all system boundaries (API endpoints, WebSocket messages).
- **Prepared statements** for all database queries (SQL injection prevention).

### Backend (Server)

- Follow the existing Fastify plugin and route patterns.
- Use the `EventBus` for inter-service communication.
- All WebSocket message types must be defined in `@voltron/shared`.
- The `action_log` table is **append-only** &mdash; never update or delete rows.

### Frontend (Dashboard)

- Use **Zustand** for state management (one store per domain).
- Follow the existing component structure in `src/components/`.
- Use the `useTranslation()` hook for all user-facing strings.
- Support both Turkish and English locales.

### Critical Rules

- **NEVER** modify files in `/etc/nginx/` or `/etc/systemd/` without explicit approval.
- **NEVER** bypass protection zones or self-protection mechanisms.
- All real-time events must flow through the WebSocket pipeline, not REST polling.

---

## Reporting Issues

Found a bug? Have a suggestion? Please open an issue on GitHub:

1. **Search existing issues** first to avoid duplicates.
2. **Use a descriptive title** that summarizes the problem.
3. **Include reproduction steps** for bugs.
4. **Label appropriately**: `bug`, `enhancement`, `documentation`, `question`.

### Bug Report Template

```
**Describe the bug**
A clear description of what the bug is.

**Steps to reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Environment**
- Node.js version:
- Browser:
- OS:
```

---

## Questions?

If you have questions about contributing, feel free to open a discussion on GitHub or reach out through an issue tagged with `question`.

We appreciate your time and effort in making Voltron better.
