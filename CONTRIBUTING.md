# Contributing to FlexibleAccessible

We welcome improvements that increase accessibility outcomes and operational reliability.

## Development
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Before opening PR
```bash
npm run lint
npm run typecheck
npm run test
```

## PR expectations
- Focused change set
- Clear description of user impact
- Migration notes if schema/runtime behavior changed
- Security/privacy impact called out when relevant
