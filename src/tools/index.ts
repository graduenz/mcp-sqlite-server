import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withDatabase } from "../database.js";
import { registerQueryTool } from "./query.js";
import { registerExecuteTool } from "./execute.js";

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

function registerListTablesTool(server: McpServer): void {
  server.registerTool(
    "list_tables",
    {
      description: "List all tables and views in the database",
    },
    async () => {
      try {
        return withDatabase((db) => {
          const rows = db
            .prepare(
              `SELECT name, type FROM sqlite_master
             WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
             ORDER BY type, name`
            )
            .all() as { name: string; type: string }[];

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(rows, null, 2),
              },
            ],
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

function registerDescribeTableTool(server: McpServer): void {
  server.registerTool(
    "describe_table",
    {
      description: "Get detailed schema for a specific table including columns, types, constraints, and indexes",
      inputSchema: {
        table: z
          .string()
          .describe("The name of the table or view to describe"),
      },
    },
    async ({ table }) => {
      try {
        return withDatabase((db) => {
          const columns = db
            .prepare(`PRAGMA table_info("${table}")`)
            .all() as ColumnInfo[];

          if (columns.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Table or view "${table}" not found.`,
                },
              ],
              isError: true,
            };
          }

          const indexes = db
            .prepare(`PRAGMA index_list("${table}")`)
            .all() as IndexInfo[];

          const indexDetails = indexes.map((idx) => {
            const idxColumns = db
              .prepare(`PRAGMA index_info("${idx.name}")`)
              .all() as { seqno: number; cid: number; name: string }[];
            return {
              name: idx.name,
              unique: idx.unique === 1,
              columns: idxColumns.map((c) => c.name),
            };
          });

          const createSql = db
            .prepare(
              `SELECT sql FROM sqlite_master WHERE name = ? AND type IN ('table', 'view')`
            )
            .get(table) as { sql: string } | undefined;

          const result = {
            table,
            columns: columns.map((c) => ({
              name: c.name,
              type: c.type,
              nullable: c.notnull === 0,
              defaultValue: c.dflt_value,
              primaryKey: c.pk > 0,
            })),
            indexes: indexDetails,
            sql: createSql?.sql ?? null,
          };

          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

export function registerTools(
  server: McpServer,
  readonly: boolean
): void {
  registerQueryTool(server);
  registerExecuteTool(server, readonly);
  registerListTablesTool(server);
  registerDescribeTableTool(server);
}
