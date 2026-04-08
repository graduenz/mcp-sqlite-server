import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withDatabase } from "../database.js";

export function registerQueryTool(server: McpServer): void {
  server.registerTool(
    "query",
    {
      description: "Execute a read-only SQL query (SELECT) and return results as JSON",
      inputSchema: { sql: z.string().describe("The SQL SELECT query to execute") },
    },
    async ({ sql }) => {
      try {
        return withDatabase((db) => {
          const stmt = db.prepare(sql);
          const rows = stmt.all();
          const columns = stmt.columns().map((c) => c.name);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ columns, rows, rowCount: rows.length }, null, 2),
              },
            ],
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Query error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
