#!/bin/bash
set -e

echo "Setting up Voltron..."

cd /opt/voltron

# Enable corepack for pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Install dependencies
pnpm install

# Create data directory
mkdir -p data

# Create .env from example if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example - please update with real values"
fi

# Build shared package
pnpm --filter @voltron/shared build

echo "Setup complete!"
