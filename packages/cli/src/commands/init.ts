import fs from "fs";
import path from "path";

export async function run(args: string[]) {
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, "package.json");

  console.log("[AROS] Initializing AROS in current project...");

  // Create .aros.json config
  const arosConfig = {
    projectId: generateId(),
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

  // Create .github/workflows/aros.yml for CI
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
