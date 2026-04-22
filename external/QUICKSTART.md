# AccessibleMadeFlexible Quick Start

## Prerequisites
- Node.js 20+
- Docker (for PostgreSQL + Redis)
- npm

## Setup

```bash
# Clone and install
git clone https://github.com/Hardonian/FlexibleAccessible
cd FlexibleAccessible
npm install

# Start services
docker compose up -d

# Configure
cp .env.example .env
# Edit .env with your values

# Setup database
npm run db:generate
npm run db:push
npm run db:seed

# Run
npm run dev
```

## First Scan

1. Sign in at http://localhost:3000
2. Create organization
3. Add site to scan
4. Run scan

## Deploy

```bash
# Docker
docker build -t aros .
docker run -p 3000:3000 aros:latest
```
