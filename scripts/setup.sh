#!/bin/bash
set -e

echo "=== AROS Setup ==="

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }

echo "1. Starting infrastructure services..."
docker compose -f docker/docker-compose.yml up -d

echo "2. Waiting for services to be healthy..."
sleep 3

echo "3. Installing dependencies..."
npm install

echo "4. Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   Created .env from .env.example - please update with your values"
fi

echo "5. Generating Prisma client..."
npm run db:generate

echo "6. Applying database schema..."
if [ "${AROS_USE_MIGRATE:-}" = "1" ]; then
  npm run db:migrate
else
  npm run db:push
fi

echo "7. Seeding database..."
npm run db:seed

echo "8. Ensuring platform bootstrap row..."
npm run bootstrap

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start development:"
echo "  npm run dev          # Start web app on http://localhost:3000"
echo "  npm run dev:worker   # Start background workers (required for live worker status)"
echo ""
echo "Production-style schema: set AROS_USE_MIGRATE=1 before running this script to use db:migrate instead of db:push."
echo ""
echo "Demo credentials:"
echo "  Email: demo@aros.dev"
echo "  Password: demo1234"
