import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { initDatabase } from "../database.js";
import { getFullSchema, getTablesList, getTableSchema } from "./schema.js";

describe("schema helpers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-sqlite-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function setupDatabase(statements: string[] = []): void {
    const dbPath = join(tempDir, "test.db");
    const db = new Database(dbPath);
    try {
      for (const sql of statements) {
        db.exec(sql);
      }
    } finally {
      db.close();
    }
    initDatabase({ database: dbPath, readonly: false, wal: false });
  }

  describe("getFullSchema", () => {
    it("returns 'no objects' message for an empty database", () => {
      setupDatabase();

      const schema = getFullSchema();

      assert.equal(schema, "Database has no user-defined objects.");
    });

    it("returns CREATE statements for tables", () => {
      setupDatabase([
        "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
      ]);

      const schema = getFullSchema();

      assert.ok(schema.includes("-- table: users"));
      assert.ok(schema.includes("CREATE TABLE users"));
    });
  });

  describe("getTablesList", () => {
    it("returns JSON array of tables", () => {
      setupDatabase([
        "CREATE TABLE alpha (id INTEGER PRIMARY KEY)",
        "CREATE TABLE beta (id INTEGER PRIMARY KEY)",
      ]);

      const list = JSON.parse(getTablesList());

      assert.equal(list.length, 2);
      assert.deepEqual(list, [
        { name: "alpha", type: "table" },
        { name: "beta", type: "table" },
      ]);
    });

    it("returns empty array for database with no tables", () => {
      setupDatabase();

      const list = JSON.parse(getTablesList());

      assert.deepEqual(list, []);
    });
  });

  describe("getTableSchema", () => {
    it("returns column and index info for a known table", () => {
      setupDatabase([
        "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT)",
        "CREATE UNIQUE INDEX idx_email ON users (email)",
      ]);

      const result = JSON.parse(getTableSchema("users"));

      assert.equal(result.table, "users");
      assert.equal(result.columns.length, 3);

      const idCol = result.columns.find(
        (c: { name: string }) => c.name === "id"
      );
      assert.equal(idCol.primaryKey, true);
      assert.equal(idCol.type, "INTEGER");

      const nameCol = result.columns.find(
        (c: { name: string }) => c.name === "name"
      );
      assert.equal(nameCol.nullable, false);

      assert.equal(result.indexes.length, 1);
      assert.equal(result.indexes[0].name, "idx_email");
      assert.equal(result.indexes[0].unique, true);
      assert.deepEqual(result.indexes[0].columns, ["email"]);

      assert.ok(result.sql.includes("CREATE TABLE users"));
    });

    it("returns 'not found' for a nonexistent table", () => {
      setupDatabase();

      const result = getTableSchema("nonexistent");

      assert.ok(result.includes('"nonexistent" not found'));
    });
  });
});
