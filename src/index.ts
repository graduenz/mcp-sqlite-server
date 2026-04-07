import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { openDatabase, closeDatabase } from "./database.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

async function main(): Promise<void> {
  const config = loadConfig();

  openDatabase(config);

  const server = new McpServer({
    name: "mcp-sqlite-server",
    version: "1.0.0",
  });

  registerTools(server, config.readonly);
  registerResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    closeDatabase();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
