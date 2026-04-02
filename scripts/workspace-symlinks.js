#!/usr/bin/env node
/**
 * Workspace symlink setup for npm workspaces.
 * Creates symlinks from the root node_modules to workspace node_modules
 * for packages that are required at the root level (e.g., eslint-config-next
 * needs `next` accessible from the root workspace for its babel parser).
 */
const { existsSync, symlinkSync, readlinkSync, statSync } = require("fs");
const path = require("path");

const rootNodeModules = path.resolve(__dirname, "..", "node_modules");
const workspacesDir = path.resolve(__dirname, "..");

const packagesToSymlink = [
  {
    from: path.join(workspacesDir, "apps", "web", "node_modules", "next"),
    name: "next",
  },
  {
    from: path.join(workspacesDir, "apps", "web", "node_modules", "sharp"),
    name: "sharp",
  },
];

let linked = false;
for (const { from, name } of packagesToSymlink) {
  const target = path.join(rootNodeModules, name);
  if (!existsSync(from)) continue;

  try {
    const stat = statSync(from);
    const isSymlink = stat.isSymbolicLink();
    if (isSymlink) {
      const existingTarget = readlinkSync(from);
      if (
        existingTarget === target ||
        existingTarget === path.join(workspacesDir, "node_modules", name)
      ) {
        continue;
      }
    }
  } catch {
    // stat failed, will try to create
  }

  if (!existsSync(target)) {
    try {
      symlinkSync(from, target, "dir");
      console.log(`[workspace-symlinks] Linked ${name} -> ${from}`);
      linked = true;
    } catch (err) {
      if (err.code !== "EEXIST") {
        console.warn(
          `[workspace-symlinks] Could not link ${name}: ${err.message}`,
        );
      }
    }
  }
}

if (linked) {
  console.log("[workspace-symlinks] Done.");
}
