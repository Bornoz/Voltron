#!/bin/bash
set -e

echo "Building Voltron..."

cd /opt/voltron

# Build shared first (dependency)
pnpm --filter @voltron/shared build

# Build server, dashboard, simulator in parallel
pnpm --filter @voltron/server build &
pnpm --filter @voltron/dashboard build &
pnpm --filter @voltron/ui-simulator build &
wait

echo "Restarting server..."
sudo systemctl restart voltron

echo "Voltron deployed successfully"
echo "Dashboard: https://voltron.isgai.tr"
echo "Simulator: https://voltron.isgai.tr/simulator/"
echo "API: https://voltron.isgai.tr/api/"
echo "WebSocket: wss://voltron.isgai.tr/ws"
