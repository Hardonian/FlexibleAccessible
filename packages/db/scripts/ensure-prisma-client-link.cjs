#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const localScope = path.resolve(__dirname, '..', 'node_modules', '@prisma');
const localClient = path.join(localScope, 'client');

if (!fs.existsSync(localClient)) {
  console.log('[db:generate] Installing @prisma/client locally to satisfy Prisma generate...');
  execSync('npm install @prisma/client --no-save', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} else {
  // If it's a symlink, Prisma might fail to generate
  const stat = fs.lstatSync(localClient);
  if (stat.isSymbolicLink()) {
    console.log('[db:generate] Replacing @prisma/client symlink with local installation...');
    fs.rmSync(localClient, { recursive: true, force: true });
    execSync('npm install @prisma/client --no-save', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  }
}
