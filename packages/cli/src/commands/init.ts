import fs from "fs";
import path from "path";
import crypto from "crypto";

export async function run(_args: string[]) {
  const cwd = process.cwd();
  const projectId = crypto.randomUUID().slice(0, 8);

  console.log("[AROS] Initializing AROS in current project...");

  const arosConfig = {
    projectId,
    siteName: path.basename(cwd),
    scanConfig: {
      include: ["/"],
      exclude: ["/api/*", "/admin/*"],
      maxPages: 100,
      axeRules: ["wcag2a", "wcag2aa"],
    },
    ci: {
      threshold: "serious",
      failOnOpen: true,
    },
  };

  fs.writeFileSync(
    path.join(cwd, ".aros.json"),
    JSON.stringify(arosConfig, null, 2),
  );
  console.log("[AROS] Created .aros.json");

  const workflowsDir = path.join(cwd, ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }

  const workflow = `name: A11y Scan
on: [push, pull_request]
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx @aros/cli scan \${{ github.event.repository.url }} --ci --threshold serious
`;

  fs.writeFileSync(path.join(workflowsDir, "aros.yml"), workflow);
  console.log("[AROS] Created .github/workflows/aros.yml");

  console.log("\n[AROS] Initialization complete!");
  console.log("  Run `npx aros scan <url>` to scan your site");
  console.log("  Add AROS_API_KEY to your CI secrets for cloud features");
}
