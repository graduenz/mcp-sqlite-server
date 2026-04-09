# mcp-sqlite-server

An MCP (Model Context Protocol) server that provides tools and resources for interacting with SQLite databases via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

## Table of Contents

- [mcp-sqlite-server](#mcp-sqlite-server)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Configuration](#configuration)
  - [Tools](#tools)
    - [`query`](#query)
    - [`execute`](#execute)
    - [`list_tables`](#list_tables)
    - [`describe_table`](#describe_table)
  - [Resources](#resources)
  - [Contributing](#contributing)
  - [Cursor MCP Configuration](#cursor-mcp-configuration)
    - [Multiple Databases (Two MCP Servers)](#multiple-databases-two-mcp-servers)
  - [License](#license)


## Features

- **Query & Execute** -- run read and write SQL statements
- **Schema Introspection** -- list tables, describe columns/indexes, view full DDL
- **Project-Level Configuration** -- database settings live in a `.mcp-sqlite.json` file, not in the MCP client config
- **WAL Mode** -- enabled by default for better concurrency
- **Read-Only Mode** -- optionally prevent write operations

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, release/publish workflow, build instructions, testing, code conventions, and guidance on adding new tools, resources, and config fields.

## Cursor MCP Configuration

Add the following to `.cursor/mcp.json` in any project that wants to use this server:

```json
{
  "mcpServers": {
    "mcp-sqlite-server": {
      "command": "npx",
      "args": ["-y", "@graduenz/mcp-sqlite-server"]
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
      "command": "npx",
      "args": [
        "-y",
        "@graduenz/mcp-sqlite-server",
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

### Multiple Databases (Two MCP Servers)

If your project has multiple SQLite databases, run one MCP server instance per database.
Each instance needs its own server name in `.cursor/mcp.json` and its own config file passed with `--config`.

```json
{
  "mcpServers": {
    "sqlite-main": {
      "command": "npx",
      "args": [
        "-y",
        "@graduenz/mcp-sqlite-server",
        "--config",
        ".mcp-sqlite.main.json"
      ]
    },
    "sqlite-analytics": {
      "command": "npx",
      "args": [
        "-y",
        "@graduenz/mcp-sqlite-server",
        "--config",
        ".mcp-sqlite.analytics.json"
      ]
    }
  }
}
```

Create a config file for each database:

`.mcp-sqlite.main.json`:

```json
{
  "database": "./data/main.sqlite",
  "readonly": false,
  "wal": true
}
```

`.mcp-sqlite.analytics.json`:

```json
{
  "database": "./data/analytics.sqlite",
  "readonly": true,
  "wal": true
}
```

When prompting in Cursor, specify which MCP server to use (`sqlite-main` or `sqlite-analytics`) based on the database you want to query.

## License

MIT
