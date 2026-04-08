import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { withDatabase } from "../database.js";
import { getFullSchema, getTablesList, getTableSchema } from "./schema.js";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "database-schema",
    "sqlite://schema",
    { description: "Full database schema (all CREATE statements)" },
    async (_uri) => ({
      contents: [
        {
          uri: "sqlite://schema",
          mimeType: "text/plain",
          text: getFullSchema(),
        },
      ],
    })
  );

  server.registerResource(
    "tables-list",
    "sqlite://tables",
    { description: "List of all tables and views" },
    async (_uri) => ({
      contents: [
        {
          uri: "sqlite://tables",
          mimeType: "application/json",
          text: getTablesList(),
        },
      ],
    })
  );

  server.registerResource(
    "table-schema",
    new ResourceTemplate("sqlite://tables/{name}/schema", {
      list: async () => {
        return withDatabase((db) => {
          const rows = db
            .prepare(
              `SELECT name FROM sqlite_master
             WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
             ORDER BY name`
            )
            .all() as { name: string }[];

          return {
            resources: rows.map((r) => ({
              uri: `sqlite://tables/${encodeURIComponent(r.name)}/schema`,
              name: `Schema for ${r.name}`,
            })),
          };
        });
      },
    }),
    { description: "Schema details for a specific table or view" },
    async (_uri, variables) => {
      const name = String(variables.name);
      return {
        contents: [
          {
            uri: `sqlite://tables/${encodeURIComponent(name)}/schema`,
            mimeType: "application/json",
            text: getTableSchema(name),
          },
        ],
      };
    }
  );
}
