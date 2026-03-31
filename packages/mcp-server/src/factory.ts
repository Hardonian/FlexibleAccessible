import { ArosMcpServer } from "./server";

export async function createServer() {
  const server = new ArosMcpServer();
  await server.start();
  return server;
}
