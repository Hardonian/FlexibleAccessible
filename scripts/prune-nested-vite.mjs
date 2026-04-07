#!/usr/bin/env node
/**
 * npm workspaces sometimes install a second copy of vite under apps/web for
 * @vitejs/plugin-react peer resolution. That copy can lag the hoisted root vite
 * and trip `npm audit` even when the tree hoists a patched version at the root.
 *
 * Remove nested `apps/web/node_modules/vite` when it does not match the hoisted
 * root `node_modules/vite` version (single source of truth from the lockfile / install).
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const nestedPkg = join("apps", "web", "node_modules", "vite", "package.json");
const rootPkg = join("node_modules", "vite", "package.json");

if (!existsSync(nestedPkg) || !existsSync(rootPkg)) {
  process.exit(0);
}

let nestedVersion = "";
let rootVersion = "";
try {
  nestedVersion = JSON.parse(readFileSync(nestedPkg, "utf8")).version ?? "";
  rootVersion = JSON.parse(readFileSync(rootPkg, "utf8")).version ?? "";
} catch {
  process.exit(0);
}

if (nestedVersion && rootVersion && nestedVersion !== rootVersion) {
  rmSync(join("apps", "web", "node_modules", "vite"), { recursive: true, force: true });
}
