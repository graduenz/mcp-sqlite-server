#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { initDatabase } from "./database.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

async function main(): Promise<void> {
  const config = loadConfig();

  initDatabase(config);

  const server = new McpServer({
    name: "mcp-sqlite-server",
    version: "1.0.0",
  });

  registerTools(server, config.readonly);
  registerResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    try {
      await Promise.race([
        server.close(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Server close timed out"));
          }, 3000);
        }),
      ]);
    } catch (err) {
      console.error("Fatal during shutdown:", err);
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

try {
  await main();
} catch (err) {
  console.error("Fatal:", err);
  process.exit(1);
}
