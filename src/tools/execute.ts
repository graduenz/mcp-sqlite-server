import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withDatabase } from "../database.js";

export function registerExecuteTool(
  server: McpServer,
  readonly: boolean
): void {
  server.registerTool(
    "execute",
    {
      description: "Execute a write SQL statement (INSERT, UPDATE, DELETE, CREATE TABLE, etc.)",
      inputSchema: { sql: z.string().describe("The SQL statement to execute") },
    },
    async ({ sql }) => {
      if (readonly) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: database is opened in read-only mode. Write operations are disabled.",
            },
          ],
          isError: true,
        };
      }

      try {
        return withDatabase((db) => {
          const result = db.prepare(sql).run();

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    changes: result.changes,
                    lastInsertRowid: result.lastInsertRowid.toString(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: "text" as const, text: `Execute error: ${message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
