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

function hasContentArray(value: unknown): value is { content: unknown[] } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.content);
}

function isTextContentItem(value: unknown): value is { type: "text"; text: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.type === "text" && typeof candidate.text === "string";
}

function getTextContent(result: unknown): string {
  if (!hasContentArray(result)) {
    throw new Error("Tool result does not include a content array");
  }

  const firstItem = result.content[0];
  if (!isTextContentItem(firstItem)) {
    throw new Error("Tool result does not include text content");
  }

  return firstItem.text;
}

function getJsonContent<T>(result: unknown): T {
  return JSON.parse(getTextContent(result)) as T;
}

describe("MCP integration (read-write)", () => {
  let tempDir: string;
  let dbPath: string;
  let client: Client;
  let server: McpServer;

  before(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-sqlite-integ-"));
    dbPath = join(tempDir, "test.db");

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

  it("execute with invalid SQL returns isError with execute prefix", async () => {
    const result = await client.callTool({
      name: "execute",
      arguments: { sql: "INSERT INTO does_not_exist(id) VALUES (1)" },
    });
    assert.equal(result.isError, true);
    assert.ok(getTextContent(result).startsWith("Execute error:"));
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

  it("query returns expected response envelope", async () => {
    const result = await client.callTool({
      name: "query",
      arguments: { sql: "SELECT id, name FROM users ORDER BY id" },
    });
    const parsed = getJsonContent<{
      columns: string[];
      rows: { id: number; name: string }[];
      rowCount: number;
    }>(result);
    assert.deepEqual(parsed.columns, ["id", "name"]);
    assert.equal(parsed.rowCount, parsed.rows.length);
  });

  it("query with invalid SQL returns isError", async () => {
    const result = await client.callTool({
      name: "query",
      arguments: { sql: "SELECT * FROM nonexistent_table" },
    });
    assert.equal(result.isError, true);
    assert.ok(getTextContent(result).startsWith("Query error:"));
  });

  it("describe_table returns schema info", async () => {
    await client.callTool({
      name: "execute",
      arguments: {
        sql: "CREATE UNIQUE INDEX idx_users_name ON users(name)",
      },
    });

    const result = await client.callTool({
      name: "describe_table",
      arguments: { table: "users" },
    });
    const parsed = getJsonContent<{
      table: string;
      columns: { name: string; nullable: boolean; defaultValue: string | null }[];
      indexes: { name: string; unique: boolean; columns: string[] }[];
      sql: string;
    }>(result);
    assert.equal(parsed.table, "users");
    assert.equal(parsed.columns.length, 3);
    assert.ok(parsed.sql.includes("CREATE TABLE users"));
    assert.equal(parsed.columns[1].nullable, false);
    assert.equal(parsed.columns[2].defaultValue, null);
    assert.ok(parsed.indexes.some((idx) => idx.name === "idx_users_name"));
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

  it("reads sqlite://tables for empty database in a separate server", async () => {
    const emptyTempDir = mkdtempSync(join(tmpdir(), "mcp-sqlite-empty-"));
    const emptyDbPath = join(emptyTempDir, "empty.db");
    initDatabase({ database: emptyDbPath, readonly: false, wal: false });

    const emptyServer = new McpServer({ name: "empty-server", version: "0.0.1" });
    registerTools(emptyServer, false);
    registerResources(emptyServer);
    const emptyClient = new Client({ name: "empty-client", version: "0.0.1" });
    const [emptyClientTransport, emptyServerTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      emptyClient.connect(emptyClientTransport),
      emptyServer.connect(emptyServerTransport),
    ]);
    try {
      const result = await emptyClient.readResource({ uri: "sqlite://tables" });
      const text = (result.contents[0] as { text: string }).text;
      assert.deepEqual(JSON.parse(text), []);
    } finally {
      await emptyClient.close();
      await emptyServer.close();
      rmSync(emptyTempDir, { recursive: true, force: true });
      initDatabase({ database: dbPath, readonly: false, wal: false });
    }
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

  it("reads schema resource for table names containing %20", async () => {
    await client.callTool({
      name: "execute",
      arguments: {
        sql: 'CREATE TABLE "user%20data" (id INTEGER PRIMARY KEY, value TEXT)',
      },
    });

    const result = await client.readResource({
      uri: "sqlite://tables/user%20data/schema",
    });
    const text = (result.contents[0] as { text: string }).text;
    const schema = JSON.parse(text) as { table: string; columns: unknown[] };
    assert.equal(schema.table, "user%20data");
    assert.equal(schema.columns.length, 2);
    assert.equal(
      (result.contents[0] as { uri: string }).uri,
      "sqlite://tables/user%2520data/schema"
    );
  });

  it("lists dynamic schema resources from the template list callback", async () => {
    const resourcesResult = await client.listResources();
    const uris = resourcesResult.resources.map((r) => r.uri);
    assert.ok(uris.includes("sqlite://tables/users/schema"));
    assert.ok(uris.includes("sqlite://tables/user%2520data/schema"));
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
