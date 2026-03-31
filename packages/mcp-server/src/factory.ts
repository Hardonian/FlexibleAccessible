import { ArosMcpServer } from "./server";

async function main() {
  const server = new ArosMcpServer();
  await server.start();
}

main().catch((err) => {
  console.error("[AROS MCP] Fatal error:", err);
  process.exit(1);
});
