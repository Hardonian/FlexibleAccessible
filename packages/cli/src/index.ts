#!/usr/bin/env node

const command = process.argv[2];
const args = process.argv.slice(3);

const commands: Record<string, string> = {
  scan: "./commands/scan",
  fix: "./commands/fix",
  report: "./commands/report",
  init: "./commands/init",
  auth: "./commands/auth",
  ci: "./commands/ci",
  diff: "./commands/diff",
  watch: "./commands/watch",
};

function printHelp() {
  console.log(`
  AROS CLI — Accessibility Remediation OS

  USAGE
    npx aros <command> [options]

  COMMANDS
    scan <url>              Scan a website for accessibility issues
    ci <url>                CI mode: scan and fail on threshold
    diff <url>              Compare scan against a baseline JSON
    watch <url>             Watch mode: scan at intervals
    fix                     Generate remediation suggestions for open findings
    report                  Generate a conformance report
    init                    Initialize AROS in the current project
    auth <api-key>          Authenticate with your AROS API key

  OPTIONS
    --format <json|csv>     Output format (default: json)
    --output <file>         Write output to file
    --ci                    CI mode: exit code 1 if issues found
    --threshold <level>     Minimum severity to report (critical|serious|moderate|minor)
    --api-key <key>         API key for AROS cloud (or set AROS_API_KEY env var)
    --api-url <url>         AROS API URL (default: https://api.aros.dev)

  EXAMPLES
    npx aros scan https://example.com
    npx aros scan https://example.com --format csv --output results.csv
    npx aros ci https://example.com --threshold 95 --fail-on critical
    npx aros diff https://example.com --baseline baseline.json
    npx aros watch https://example.com --interval 30
    npx aros auth arsk_live_abc123
    npx aros fix --api-key arsk_live_abc123
    npx aros report --format json

  MCP SERVER
    To use AROS from Claude Desktop, Cursor, or VS Code, add to your MCP config:
    {
      "mcpServers": {
        "aros": {
          "command": "npx",
          "args": ["@aros/mcp-server"],
          "env": { "DATABASE_URL": "...", "AROS_API_KEY": "..." }
        }
      }
    }
  `);
}

async function main() {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    console.log("1.0.0");
    process.exit(0);
  }

  const modPath = commands[command];
  if (!modPath) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  try {
    const mod = await import(modPath);
    await mod.run(args);
  } catch (err) {
    console.error(`Failed to load command ${command}:`, err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
