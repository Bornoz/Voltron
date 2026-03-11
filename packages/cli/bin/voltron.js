#!/usr/bin/env node

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const VERSION = '0.2.0';
const REPO_URL = 'https://github.com/Bornoz/Voltron';
const DEFAULT_PORT = 8600;

// ── Colors ──────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function logo() {
  console.log(`
${c.blue}${c.bold}  ██╗   ██╗ ██████╗ ██╗  ████████╗██████╗  ██████╗ ███╗   ██╗
  ██║   ██║██╔═══██╗██║  ╚══██╔══╝██╔══██╗██╔═══██╗████╗  ██║
  ██║   ██║██║   ██║██║     ██║   ██████╔╝██║   ██║██╔██╗ ██║
  ╚██╗ ██╔╝██║   ██║██║     ██║   ██╔══██╗██║   ██║██║╚██╗██║
   ╚████╔╝ ╚██████╔╝███████╗██║   ██║  ██║╚██████╔╝██║ ╚████║
    ╚═══╝   ╚═════╝ ╚══════╝╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝${c.reset}
  ${c.dim}AI Agent Governance Platform${c.reset}  ${c.cyan}v${VERSION}${c.reset}
`);
}

function help() {
  logo();
  console.log(`${c.bold}USAGE${c.reset}
  ${c.green}npx voltron-ai${c.reset}              Start Voltron (interactive setup)
  ${c.green}npx voltron-ai${c.reset} ${c.yellow}--port 9000${c.reset}  Custom port
  ${c.green}npx voltron-ai${c.reset} ${c.yellow}--demo${c.reset}       Start in demo mode (no Claude CLI needed)

${c.bold}OPTIONS${c.reset}
  ${c.yellow}--port${c.reset} <number>    Server port (default: ${DEFAULT_PORT})
  ${c.yellow}--demo${c.reset}             Auto-start demo on launch
  ${c.yellow}--help${c.reset}             Show this help
  ${c.yellow}--version${c.reset}          Show version

${c.bold}QUICK START${c.reset}
  ${c.dim}# Clone and run${c.reset}
  git clone ${REPO_URL}.git
  cd Voltron
  pnpm install && pnpm build
  cp .env.example .env
  node packages/server/dist/index.js

${c.bold}DOCKER${c.reset}
  ${c.dim}# One command${c.reset}
  docker compose up -d

${c.bold}LEARN MORE${c.reset}
  ${c.cyan}${REPO_URL}${c.reset}
`);
}

// ── Parse args ──────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  help();
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(`voltron-ai v${VERSION}`);
  process.exit(0);
}

const portIdx = args.indexOf('--port');
const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : DEFAULT_PORT;
const demoMode = args.includes('--demo');

// ── Check if Voltron is installed locally ──────────────
function findVoltronRoot() {
  // Check if we're in a Voltron checkout
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'packages/server/dist/index.js'))) return cwd;
  if (existsSync(join(cwd, 'packages/server/src/index.ts'))) return cwd;

  // Check common locations
  const locations = [
    join(process.env.HOME || '~', '.voltron'),
    join(process.env.HOME || '~', 'Voltron'),
    ...(process.env.VOLTRON_ROOT ? [process.env.VOLTRON_ROOT] : []),
  ];
  for (const loc of locations) {
    if (existsSync(join(loc, 'packages/server/dist/index.js'))) return loc;
  }

  return null;
}

// ── Main ────────────────────────────────────────────────
async function main() {
  logo();

  const root = findVoltronRoot();

  if (!root) {
    console.log(`${c.yellow}Voltron is not installed locally.${c.reset}\n`);
    console.log(`${c.bold}Quick install:${c.reset}`);
    console.log(`  ${c.green}git clone ${REPO_URL}.git${c.reset}`);
    console.log(`  ${c.green}cd Voltron && pnpm install && pnpm build${c.reset}`);
    console.log(`  ${c.green}cp .env.example .env${c.reset}`);
    console.log(`  ${c.green}npx voltron-ai${c.reset}  ${c.dim}(run again from Voltron directory)${c.reset}\n`);
    console.log(`${c.bold}Or use Docker:${c.reset}`);
    console.log(`  ${c.green}docker compose up -d${c.reset}\n`);
    process.exit(1);
  }

  const serverEntry = join(root, 'packages/server/dist/index.js');

  if (!existsSync(serverEntry)) {
    console.log(`${c.yellow}Server not built. Building...${c.reset}`);
    try {
      execSync('pnpm build', { cwd: root, stdio: 'inherit' });
    } catch {
      console.error(`${c.red}Build failed. Run 'pnpm build' manually.${c.reset}`);
      process.exit(1);
    }
  }

  // Set environment
  const env = {
    ...process.env,
    VOLTRON_PORT: String(port),
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  console.log(`${c.green}Starting Voltron on port ${port}...${c.reset}`);
  if (demoMode) {
    console.log(`${c.magenta}Demo mode enabled — will auto-start demo after launch${c.reset}`);
  }
  console.log(`${c.dim}Dashboard: http://localhost:${port}${c.reset}\n`);

  const server = spawn('node', [serverEntry], {
    cwd: root,
    env,
    stdio: 'inherit',
  });

  // Auto-start demo after server is ready
  if (demoMode) {
    setTimeout(async () => {
      try {
        const resp = await fetch(`http://localhost:${port}/api/demo/start`, { method: 'POST' });
        if (resp.ok) {
          console.log(`\n${c.magenta}Demo started! Watch the dashboard for live events.${c.reset}\n`);
        }
      } catch {
        // Server might not be ready yet, retry once
        setTimeout(async () => {
          try {
            await fetch(`http://localhost:${port}/api/demo/start`, { method: 'POST' });
          } catch {
            // ignore
          }
        }, 3000);
      }
    }, 2000);
  }

  server.on('close', (code) => {
    process.exit(code ?? 0);
  });

  // Forward signals
  process.on('SIGINT', () => server.kill('SIGINT'));
  process.on('SIGTERM', () => server.kill('SIGTERM'));
}

main().catch((err) => {
  console.error(`${c.red}Error: ${err.message}${c.reset}`);
  process.exit(1);
});
