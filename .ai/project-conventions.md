# mcp-sqlite-server — Project Conventions

## Stack

- **Runtime:** Node.js (ESM, `"type": "module"`)
- **Language:** TypeScript (`strict`, `module: Node16`)
- **SQLite:** `better-sqlite3` (synchronous API)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Validation:** `zod`
- **Test framework:** `node:test` + `node:assert` with `tsx` for TypeScript execution

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

## Database Access

Always use `withDatabase((db) => { ... })` for every DB operation. Never hold a connection open between operations — this is the core fix for the file-locking bug.

```typescript
// CORRECT — connection opened and closed per operation
return withDatabase((db) => {
  return db.prepare("SELECT * FROM t").all();
});

// WRONG — do not use a persistent handle
const db = new Database(...); // never do this outside of withDatabase
```

## Testing

- Test files are colocated next to source files and named `*.test.ts`
- Run tests with: `npm test`
- Generate coverage with: `npm run test:coverage`
- Coverage expectation: after behavior changes, add/update tests to keep coverage as close to 100% as reasonably possible (especially for touched lines/branches and error paths)
- Read coverage in terminal from the `c8` summary (`% Stmts`, `% Branch`, `% Funcs`, `% Lines`) and treat any drop as a regression to fix
- Read file-by-file coverage in HTML at `coverage/lcov-report/index.html`; prioritize files you changed and uncovered branches
- All tests use temporary SQLite databases created in `os.tmpdir()` and cleaned up in `afterEach`
- **Always update or add tests when changing source behavior**
- When adding a new test file, also add it to the `--test` file list in the `"test"` script in `package.json`
- Integration tests live in `src/integration.test.ts` and use `InMemoryTransport` from the MCP SDK

## Documentation

- **`README.md`** covers the public interface: features, setup, configuration, tools, resources, and Cursor MCP config. Update it when any of these change.
- **`CONTRIBUTING.md`** covers the development workflow: building, testing, code conventions, and step-by-step guides for adding tools/resources/config fields. Update it when the workflow or conventions change.
- The test file table in `CONTRIBUTING.md` must be kept in sync with the actual `*.test.ts` files.

## Code Style

- No comments that narrate what the code does — only explain non-obvious intent or trade-offs
- Tool handlers must catch errors and return `{ isError: true }` rather than throwing
- Prefer explicit `finally { db.close() }` for any manual DB handle management (though `withDatabase` handles this automatically)

## SonarQube Scan

SonarQube is used to scan this project in GitHub.
- Organization: `graduenz`.
- Project key: `graduenz_graduenz_mcp-sqlite-server`.
- Analysis snapshots are only indexed after pushing the code, which is done manually, so after fixing SonarQube issues, don't worry about checking if they have been resolved.
