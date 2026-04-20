#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const rootClient = path.join(workspaceRoot, 'node_modules', '@prisma', 'client');
const localScope = path.resolve(__dirname, '..', 'node_modules', '@prisma');
const localClient = path.join(localScope, 'client');

if (fs.existsSync(localClient)) {
  process.exit(0);
}

if (!fs.existsSync(rootClient)) {
  console.error('[db:generate] Missing root @prisma/client. Run npm install first.');
  process.exit(1);
}

fs.mkdirSync(localScope, { recursive: true });
const relativeTarget = path.relative(localScope, rootClient);
fs.symlinkSync(relativeTarget, localClient, 'dir');
console.log(`[db:generate] Linked @prisma/client -> ${relativeTarget}`);
