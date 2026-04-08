# Contributing to mcp-sqlite-server

## Table of Contents

- [Contributing to mcp-sqlite-server](#contributing-to-mcp-sqlite-server)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Getting Started](#getting-started)
  - [Project Structure](#project-structure)
  - [Building](#building)
  - [Testing](#testing)
  - [Code Conventions](#code-conventions)
    - [Database Access](#database-access)
    - [Error Handling in Tool Handlers](#error-handling-in-tool-handlers)
    - [Comments](#comments)
  - [Making Changes](#making-changes)
    - [Adding a new tool](#adding-a-new-tool)
    - [Adding a new resource](#adding-a-new-resource)
    - [Adding a new config field](#adding-a-new-config-field)
  - [Keeping Documentation in Sync](#keeping-documentation-in-sync)


## Prerequisites

- Node.js >= 18
- npm

## Getting Started

```bash
git clone https://github.com/graduenz/mcp-sqlite-server
cd mcp-sqlite-server
npm install
```

## Project Structure

```
src/
  index.ts              # Entry point: wires config, DB, MCP server, and signals
  config.ts             # Config loading from .mcp-sqlite.json
  database.ts           # initDatabase() and withDatabase() — the only DB access layer
  tools/
    index.ts            # Registers list_tables and describe_table
    query.ts            # Registers query tool
    execute.ts          # Registers execute tool
  resources/
    index.ts            # Registers MCP resources
    schema.ts           # Schema helper functions (getFullSchema, etc.)
```

## Building

```bash
npm run build
```

This compiles TypeScript to `dist/`. Test files are excluded from the build output via `tsconfig.json`.

## Validation

Use explicit typecheck scripts to validate both production and test TypeScript:

```bash
npm run typecheck
npm run typecheck:test
```

Or run the full pipeline:

```bash
npm run validate
```

## Release and npm Publishing

Publishing is automated by [`.github/workflows/publish.yml`](.github/workflows/publish.yml) and runs when a GitHub Release is published.

### One-time maintainer setup

1. Confirm npm access to publish `@graduenz/mcp-sqlite-server`.
2. In npm, configure trusted publishing (OIDC) for this GitHub repository.
3. Ensure repository Actions permissions allow workflows with `id-token: write`.
4. Confirm package metadata in `package.json` is current before first public release.

### Per-release checklist

1. Run:
   - `npm run validate`
   - `npm run build`
2. Bump `package.json` version.
3. Create and push a matching tag: `vX.Y.Z`.
4. Publish a GitHub Release using that tag.
5. Verify `Publish to npm` workflow succeeded.
6. Verify the new version is available on npm.

The workflow fails if tag version and `package.json` version do not match.

## Pull Request Build and SonarCloud

CI workflow [`.github/workflows/build.yml`](.github/workflows/build.yml) runs on pull requests and pushes to `main`.

It performs:

1. dependency installation (`npm ci`)
2. validation (`npm run validate`)
3. test coverage generation (`npm run test:coverage`)
4. SonarCloud scan (`SonarSource/sonarqube-scan-action@v7`)

### SonarCloud prerequisites

1. Set `SONAR_TOKEN` in GitHub repository secrets.
2. Bind this repository to the corresponding SonarCloud project.
3. Set valid values for:
   - `sonar.projectKey`
   - `sonar.organization`
   in [`.github/workflows/build.yml`](.github/workflows/build.yml).

Coverage is provided to SonarCloud via `coverage/lcov.info`.

## Testing

The test suite uses Node's built-in test runner (`node:test`) with TypeScript executed directly via `tsx`. No additional test dependencies are needed.

```bash
npm test
```

Tests are colocated with source files and named `*.test.ts`:

| File | Type | What it covers |
|------|------|----------------|
| `src/config.test.ts` | Unit | Config parsing, defaults, validation errors |
| `src/database.test.ts` | Unit | DB lifecycle, file lock release, error paths |
| `src/resources/schema.test.ts` | Unit | Schema helper output (`getFullSchema`, `getTablesList`, `getTableSchema`) |
| `src/integration.test.ts` | Integration | Full MCP tool/resource calls via `InMemoryTransport` |

All tests create isolated temporary databases in `os.tmpdir()` and clean up after themselves.

When adding a new test file, add it to the `--test` file list in the `"test"` script in `package.json`.

## Code Conventions

### Database Access

All database operations must go through `withDatabase`. It opens a connection, runs the callback, and closes in a `finally` block — releasing the file lock after every operation.

```typescript
// CORRECT
return withDatabase((db) => {
  return db.prepare("SELECT * FROM t").all();
});

// WRONG — never hold a connection open across operations
const db = new Database(...);
// ... later ...
db.close(); // fragile; lock is held in between
```

### Error Handling in Tool Handlers

Tool handlers must catch errors and return them as `{ isError: true }` content rather than throwing, so the MCP client receives a structured error instead of an unhandled rejection.

```typescript
try {
  return withDatabase((db) => { /* ... */ });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
```

### Comments

Do not add comments that narrate what the code does. Only comment on non-obvious intent, trade-offs, or constraints.

## Making Changes

### Adding a new tool

1. Create `src/tools/<name>.ts` and export a `register<Name>Tool(server)` function
2. Call it from `src/tools/index.ts`
3. Add unit tests if there is logic beyond the `withDatabase` call
4. Add integration tests to `src/integration.test.ts`
5. Document the new tool in `README.md` under **Tools**

### Adding a new resource

1. Register it in `src/resources/index.ts`
2. Add any helper functions to `src/resources/schema.ts` (or a new file)
3. Add integration tests to `src/integration.test.ts`
4. Document it in `README.md` under **Resources**

### Adding a new config field

1. Extend the `Config` interface in `src/config.ts` and update `loadConfig()`
2. Add unit tests for valid values, defaults, and validation errors in `src/config.test.ts`
3. Document the new field in `README.md` under **Configuration**

## Keeping Documentation in Sync

- Update `README.md` whenever the public interface changes (tools, resources, config fields, setup steps)
- Update the test table in this file whenever test files are added or removed
- Keep `CONTRIBUTING.md` current when the development workflow changes
