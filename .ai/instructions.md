# mcp-sqlite-server — Agent Instructions

This is the entrypoint for all AI agent guidelines in this repository. Read this file first, then consult the specific documents listed in the Context Map below.

---

## Context Map

| File | Purpose |
|------|---------|
| `instructions.md` | This file. Entrypoint, Core Mandate, Context Map, and Documentation Protocol. |
| `project-conventions.md` | Tech stack, project structure, database access patterns, testing standards, code style, and CI/quality tooling (SonarQube). |

---

## Core Mandate

**mcp-sqlite-server** is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes SQLite database capabilities to AI agents and MCP clients. It is built to be consumed via `npx @graduenz/mcp-sqlite-server` and configured through a per-project `.mcp-sqlite.json` file.

### What it provides

- **Tools:** `query` (read-only SELECT), `execute` (write statements), `list_tables`, `describe_table`
- **Resources:** `sqlite://schema`, `sqlite://tables`, `sqlite://tables/{name}/schema`
- **Configuration:** database path, read-only mode, WAL mode — all driven by `.mcp-sqlite.json`

### Key invariants every agent must uphold

1. **Never hold a database connection open between operations.** Always use `withDatabase((db) => { ... })`. This is the core fix for the file-locking bug and must never be bypassed.
2. **Tool handlers never throw.** They catch all errors and return `{ isError: true, ... }`.
3. **Test coverage must not regress.** Every behavior change requires updated or new tests.
4. **Documentation stays in sync.** `README.md`, `CONTRIBUTING.md`, and this `.ai/` directory must reflect the current state of the codebase at all times.

### Stack summary

- Node.js ESM · TypeScript strict · `better-sqlite3` (synchronous) · `@modelcontextprotocol/sdk` · `zod` · `node:test` + `tsx`

For full details on conventions, structure, and patterns, see [`project-conventions.md`](./project-conventions.md).

---

## Documentation Protocol

The `.ai/` directory is a living specification. Agents must keep it accurate and up-to-date as the project evolves.

### When to update `.ai/` documents

| Trigger | Action |
|---------|--------|
| New tool or resource added | Update `project-conventions.md` (Project Structure section) and `README.md` |
| New config field added | Update `project-conventions.md` and `README.md` |
| New `.ai/` document created | Add it to the Context Map in this file |
| Testing conventions change | Update the Testing section in `project-conventions.md` |
| Code style rules added or removed | Update the Code Style section in `project-conventions.md` |
| CI/quality tooling changes | Update the SonarQube or relevant section in `project-conventions.md` |
| Large refactor or architectural shift | Review all `.ai/` documents for accuracy; update any section that no longer reflects reality |

### Rules for maintaining this directory

- **Never let the codebase and the `.ai/` rules fall out of sync.** If you change behavior, update the docs in the same task.
- **Prefer editing existing documents** over creating new ones. Only create a new `.ai/` file if the content clearly belongs in its own document (e.g., a large new subsystem).
- **When creating a new `.ai/` file,** add it to the Context Map table above immediately.
- **The Context Map is the source of truth** for what lives in `.ai/`. If a file is not listed there, agents may not know it exists.
- **Evolve, don't accumulate.** Remove or consolidate outdated sections rather than leaving stale guidance alongside new guidance.
