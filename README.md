# mcp-sqlite-server

An MCP (Model Context Protocol) server that provides tools and resources for interacting with SQLite databases via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

## Features

- **Query & Execute** -- run read and write SQL statements
- **Schema Introspection** -- list tables, describe columns/indexes, view full DDL
- **Project-Level Configuration** -- database settings live in a `.mcp-sqlite.json` file, not in the MCP client config
- **WAL Mode** -- enabled by default for better concurrency
- **Read-Only Mode** -- optionally prevent write operations

## Setup

```bash
cd mcp-sqlite-server
npm install
npm run build
```

## Configuration

Create a `.mcp-sqlite.json` file in the project/workspace that will use this MCP server:

```json
{
  "database": "./data.sqlite",
  "readonly": false,
  "wal": true
}
```

| Field      | Type    | Default | Description                                                     |
|------------|---------|---------|-----------------------------------------------------------------|
| `database` | string  | —       | **Required.** Path to the SQLite file (relative to config file) |
| `readonly` | boolean | `false` | Open the database in read-only mode                             |
| `wal`      | boolean | `true`  | Enable WAL journal mode                                         |

The server resolves the config file in this order:

1. `--config <path>` CLI argument
2. `.mcp-sqlite.json` in the current working directory

## Tools

### `query`
Execute a read-only SQL query (SELECT) and return results as JSON.

**Input:** `{ "sql": "SELECT * FROM users LIMIT 10" }`

### `execute`
Execute a write SQL statement (INSERT, UPDATE, DELETE, CREATE TABLE, etc.). Disabled in read-only mode.

**Input:** `{ "sql": "INSERT INTO users (name) VALUES ('Alice')" }`

### `list_tables`
List all tables and views in the database.

**Input:** none

### `describe_table`
Get detailed schema for a specific table including columns, types, constraints, and indexes.

**Input:** `{ "table": "users" }`

## Resources

| URI                               | Description                              |
|-----------------------------------|------------------------------------------|
| `sqlite://schema`                 | Full database schema (all DDL statements)|
| `sqlite://tables`                 | List of all tables and views             |
| `sqlite://tables/{name}/schema`   | Schema details for a specific table      |

## Cursor MCP Configuration

Add the following to `.cursor/mcp.json` in any project that wants to use this server:

```json
{
  "mcpServers": {
    "mcp-sqlite-server": {
      "command": "node",
      "args": ["c:/repos/graduenz/mcp-sqlite-server/dist/index.js"]
    }
  }
}
```

The server will look for `.mcp-sqlite.json` in the workspace root (the working directory Cursor launches the server from).

To use an explicit config path:

```json
{
  "mcpServers": {
    "mcp-sqlite-server": {
      "command": "node",
      "args": [
        "c:/repos/graduenz/mcp-sqlite-server/dist/index.js",
        "--config",
        ".mcp-sqlite.json"
      ]
    }
  }
}
```

Then create `.mcp-sqlite.json` in the project root:

```json
{
  "database": "./data.sqlite",
  "readonly": false,
  "wal": true
}
```

## License

MIT
