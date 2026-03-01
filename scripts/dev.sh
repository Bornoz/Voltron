#!/bin/bash
set -e

echo "Starting Voltron development environment..."

cd "$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"

# Build shared first
pnpm --filter @voltron/shared build

# Start all services in parallel
pnpm --filter @voltron/server dev &
pnpm --filter @voltron/dashboard dev &
pnpm --filter @voltron/ui-simulator dev &

echo ""
echo "Voltron Dev Environment:"
echo "  Server:    http://localhost:8600"
echo "  Dashboard: http://localhost:6400"
echo "  Simulator: http://localhost:5174"
echo ""

wait
