#!/usr/bin/env node
/**
 * npm workspaces sometimes install a second copy of vite under apps/web for
 * @vitejs/plugin-react peer resolution. That copy can lag the hoisted root vite
 * and trip `npm audit` even when the tree hoists a patched version at the root.
 * Remove the nested copy so tooling resolves to the root `vite` (see root overrides).
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const nestedPkg = join("apps", "web", "node_modules", "vite", "package.json");
if (!existsSync(nestedPkg)) {
  process.exit(0);
}

let version = "";
try {
  version = JSON.parse(readFileSync(nestedPkg, "utf8")).version ?? "";
} catch {
  process.exit(0);
}

// Advisory GHSA-* for vite 8.0.0–8.0.4; keep only if it matches patched root.
if (version && version !== "8.0.5") {
  rmSync(join("apps", "web", "node_modules", "vite"), { recursive: true, force: true });
}
