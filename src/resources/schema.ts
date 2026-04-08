import { withDatabase } from "../database.js";

interface MasterRow {
  type: string;
  name: string;
  sql: string | null;
}

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

export function getFullSchema(): string {
  return withDatabase((db) => {
    const rows = db
      .prepare(
        `SELECT type, name, sql FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
       ORDER BY
         CASE type
           WHEN 'table' THEN 1
           WHEN 'view' THEN 2
           WHEN 'index' THEN 3
           WHEN 'trigger' THEN 4
           ELSE 5
         END, name`
      )
      .all() as MasterRow[];

    if (rows.length === 0) {
      return "Database has no user-defined objects.";
    }

    return rows.map((r) => `-- ${r.type}: ${r.name}\n${r.sql};`).join("\n\n");
  });
}

export function getTablesList(): string {
  return withDatabase((db) => {
    const rows = db
      .prepare(
        `SELECT name, type FROM sqlite_master
       WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
       ORDER BY type, name`
      )
      .all() as { name: string; type: string }[];

    return JSON.stringify(rows, null, 2);
  });
}

export function getTableSchema(tableName: string): string {
  return withDatabase((db) => {
    const columns = db
      .prepare(`PRAGMA table_info("${tableName}")`)
      .all() as ColumnInfo[];

    if (columns.length === 0) {
      return `Table or view "${tableName}" not found.`;
    }

    const indexes = db
      .prepare(`PRAGMA index_list("${tableName}")`)
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
      .get(tableName) as { sql: string } | undefined;

    const result = {
      table: tableName,
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

    return JSON.stringify(result, null, 2);
  });
}
