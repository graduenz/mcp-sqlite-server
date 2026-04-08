import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  let tempDir: string;
  let savedArgv: string[];

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-sqlite-test-"));
    savedArgv = process.argv;
  });

  afterEach(() => {
    process.argv = savedArgv;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeConfig(filename: string, content: string): string {
    const filePath = join(tempDir, filename);
    writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  function setConfigArg(path: string): void {
    process.argv = ["node", "index.js", "--config", path];
  }

  it("loads a valid config with all fields", () => {
    const configPath = writeConfig(
      "config.json",
      JSON.stringify({ database: "test.db", readonly: true, wal: false })
    );
    setConfigArg(configPath);

    const config = loadConfig();

    assert.equal(config.database, join(tempDir, "test.db"));
    assert.equal(config.readonly, true);
    assert.equal(config.wal, false);
  });

  it("defaults readonly to false and wal to true", () => {
    const configPath = writeConfig(
      "config.json",
      JSON.stringify({ database: "test.db" })
    );
    setConfigArg(configPath);

    const config = loadConfig();

    assert.equal(config.readonly, false);
    assert.equal(config.wal, true);
  });

  it("resolves database path relative to config file directory", () => {
    const configPath = writeConfig(
      "config.json",
      JSON.stringify({ database: "subdir/my.db" })
    );
    setConfigArg(configPath);

    const config = loadConfig();

    assert.equal(config.database, join(tempDir, "subdir", "my.db"));
  });

  it("throws when config file is missing", () => {
    setConfigArg(join(tempDir, "nonexistent.json"));

    assert.throws(() => loadConfig(), /Config file not found/);
  });

  it("throws when config file contains invalid JSON", () => {
    const configPath = writeConfig("config.json", "not-json{{{");
    setConfigArg(configPath);

    assert.throws(() => loadConfig(), /Invalid JSON/);
  });

  it("throws when config is not an object", () => {
    const configPath = writeConfig("config.json", JSON.stringify([1, 2, 3]));
    setConfigArg(configPath);

    assert.throws(() => loadConfig(), /must contain a JSON object/);
  });

  it("throws when database field is missing", () => {
    const configPath = writeConfig("config.json", JSON.stringify({}));
    setConfigArg(configPath);

    assert.throws(() => loadConfig(), /non-empty "database" string/);
  });

  it("throws when database field is empty string", () => {
    const configPath = writeConfig(
      "config.json",
      JSON.stringify({ database: "  " })
    );
    setConfigArg(configPath);

    assert.throws(() => loadConfig(), /non-empty "database" string/);
  });
});
