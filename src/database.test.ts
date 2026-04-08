import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { initDatabase, withDatabase } from "./database.js";
import type { Config } from "./config.js";

describe("database", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-sqlite-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function makeConfig(overrides: Partial<Config> = {}): Config {
    return {
      database: join(tempDir, "test.db"),
      readonly: false,
      wal: true,
      ...overrides,
    };
  }

  describe("initDatabase", () => {
    it("validates connectivity by opening and closing immediately", () => {
      const config = makeConfig();
      assert.doesNotThrow(() => initDatabase(config));
    });

    it("sets WAL journal mode when wal is true", () => {
      const config = makeConfig({ wal: true });
      initDatabase(config);

      const db = new Database(config.database, { readonly: true });
      try {
        const mode = db.pragma("journal_mode", { simple: true });
        assert.equal(mode, "wal");
      } finally {
        db.close();
      }
    });

    it("does not set WAL mode when wal is false", () => {
      const config = makeConfig({ wal: false });
      initDatabase(config);

      const db = new Database(config.database, { readonly: true });
      try {
        const mode = db.pragma("journal_mode", { simple: true });
        assert.equal(mode, "delete");
      } finally {
        db.close();
      }
    });
  });

  describe("withDatabase", () => {
    it("throws if called before initDatabase", () => {
      const scriptPath = join(tempDir, "preinit-check.mjs");
      const databaseModulePath = pathToFileURL(
        join(process.cwd(), "src", "database.ts")
      ).toString();
      writeFileSync(
        scriptPath,
        [
          `import { withDatabase } from "${databaseModulePath}";`,
          "try {",
          "  withDatabase(() => 1);",
          "  process.exit(2);",
          "} catch (err) {",
          "  const msg = err instanceof Error ? err.message : String(err);",
          '  if (!msg.includes("Call initDatabase() first")) process.exit(3);',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", scriptPath],
        { encoding: "utf-8" }
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
    });

    it("provides a working database handle", () => {
      const config = makeConfig();
      initDatabase(config);

      const result = withDatabase((db) => {
        db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
        db.exec("INSERT INTO t (id) VALUES (1)");
        return db.prepare("SELECT id FROM t").all();
      });

      assert.deepEqual(result, [{ id: 1 }]);
    });

    it("releases the file lock after the operation completes", () => {
      const config = makeConfig();
      initDatabase(config);

      withDatabase((db) => {
        db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
      });

      // If the connection is still open, this will throw EBUSY on Windows
      // or EACCES depending on the OS. If properly closed, it succeeds.
      assert.doesNotThrow(() => unlinkSync(config.database));
    });

    it("closes the connection even when the callback throws", () => {
      const config = makeConfig();
      initDatabase(config);

      assert.throws(
        () =>
          withDatabase(() => {
            throw new Error("intentional");
          }),
        /intentional/
      );

      // Connection should still be released -- file should be deletable
      withDatabase((db) => {
        db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
      });
      assert.doesNotThrow(() => unlinkSync(config.database));
    });

    it("has foreign_keys pragma enabled", () => {
      const config = makeConfig();
      initDatabase(config);

      const fkEnabled = withDatabase((db) => {
        return db.pragma("foreign_keys", { simple: true });
      });

      assert.equal(fkEnabled, 1);
    });
  });
});
