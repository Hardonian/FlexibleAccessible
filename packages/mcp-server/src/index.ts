#!/usr/bin/env node
import { createServer } from "./factory";

createServer().catch((err: unknown) => {
  console.error("[AROS MCP] Fatal:", err);
  process.exit(1);
});
