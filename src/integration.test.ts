import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { initDatabase } from "./database.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

function getTextContent(result: { content: unknown[] }): string {
  const item = result.content[0] as { type: string; text: string };
  return item.text;
}

describe("MCP integration (read-write)", () => {
  let tempDir: string;
  let client: Client;
  let server: McpServer;

  before(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-sqlite-integ-"));
    const dbPath = join(tempDir, "test.db");

    initDatabase({ database: dbPath, readonly: false, wal: false });

    server = new McpServer({ name: "test-server", version: "0.0.1" });
    registerTools(server, false);
    registerResources(server);

    client = new Client({ name: "test-client", version: "0.0.1" });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  after(async () => {
    await client.close();
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("list_tables returns empty list on fresh database", async () => {
    const result = await client.callTool({ name: "list_tables", arguments: {} });
    const tables = JSON.parse(getTextContent(result));
    assert.deepEqual(tables, []);
  });

  it("execute creates a table", async () => {
    const result = await client.callTool({
      name: "execute",
      arguments: {
        sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT)",
      },
    });
    assert.equal(result.isError, undefined);
  });

  it("list_tables reflects the created table", async () => {
    const result = await client.callTool({ name: "list_tables", arguments: {} });
    const tables = JSON.parse(getTextContent(result));
    assert.equal(tables.length, 1);
    assert.equal(tables[0].name, "users");
    assert.equal(tables[0].type, "table");
  });

  it("execute inserts rows", async () => {
    const result = await client.callTool({
      name: "execute",
      arguments: {
        sql: `INSERT INTO users (name, email) VALUES ('Alice', 'alice@test.com')`,
      },
    });
    const parsed = JSON.parse(getTextContent(result));
    assert.equal(parsed.changes, 1);
  });

  it("query retrieves inserted rows", async () => {
    const result = await client.callTool({
      name: "query",
      arguments: { sql: "SELECT * FROM users" },
    });
    const parsed = JSON.parse(getTextContent(result));
    assert.equal(parsed.rowCount, 1);
    assert.equal(parsed.rows[0].name, "Alice");
    assert.deepEqual(parsed.columns, ["id", "name", "email"]);
  });

  it("query with invalid SQL returns isError", async () => {
    const result = await client.callTool({
      name: "query",
      arguments: { sql: "SELECT * FROM nonexistent_table" },
    });
    assert.equal(result.isError, true);
    assert.ok(getTextContent(result).includes("error"));
  });

  it("describe_table returns schema info", async () => {
    const result = await client.callTool({
      name: "describe_table",
      arguments: { table: "users" },
    });
    const parsed = JSON.parse(getTextContent(result));
    assert.equal(parsed.table, "users");
    assert.equal(parsed.columns.length, 3);
    assert.ok(parsed.sql.includes("CREATE TABLE users"));
  });

  it("describe_table for nonexistent table returns error", async () => {
    const result = await client.callTool({
      name: "describe_table",
      arguments: { table: "nope" },
    });
    assert.equal(result.isError, true);
    assert.ok(getTextContent(result).includes("not found"));
  });

  it("reads sqlite://schema resource", async () => {
    const result = await client.readResource({ uri: "sqlite://schema" });
    const text = (result.contents[0] as { text: string }).text;
    assert.ok(text.includes("CREATE TABLE users"));
  });

  it("reads sqlite://tables resource", async () => {
    const result = await client.readResource({ uri: "sqlite://tables" });
    const text = (result.contents[0] as { text: string }).text;
    const tables = JSON.parse(text);
    assert.equal(tables.length, 1);
    assert.equal(tables[0].name, "users");
  });

  it("reads sqlite://tables/{name}/schema resource", async () => {
    const result = await client.readResource({
      uri: "sqlite://tables/users/schema",
    });
    const text = (result.contents[0] as { text: string }).text;
    const schema = JSON.parse(text);
    assert.equal(schema.table, "users");
    assert.equal(schema.columns.length, 3);
  });
});

describe("MCP integration (readonly mode)", () => {
  let tempDir: string;
  let client: Client;
  let server: McpServer;

  before(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-sqlite-integ-ro-"));
    const dbPath = join(tempDir, "test.db");

    initDatabase({ database: dbPath, readonly: false, wal: false });

    server = new McpServer({ name: "test-server-ro", version: "0.0.1" });
    registerTools(server, true);
    registerResources(server);

    client = new Client({ name: "test-client-ro", version: "0.0.1" });

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  after(async () => {
    await client.close();
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("execute in readonly mode returns error", async () => {
    const result = await client.callTool({
      name: "execute",
      arguments: { sql: "CREATE TABLE t (id INTEGER PRIMARY KEY)" },
    });
    assert.equal(result.isError, true);
    assert.ok(getTextContent(result).includes("read-only"));
  });
});
