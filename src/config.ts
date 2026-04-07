import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export interface Config {
  database: string;
  readonly: boolean;
  wal: boolean;
}

const CONFIG_FILENAME = ".mcp-sqlite.json";

function parseArgs(): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--config");
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

export function loadConfig(): Config {
  const explicitPath = parseArgs();
  const configPath = explicitPath
    ? resolve(explicitPath)
    : resolve(process.cwd(), CONFIG_FILENAME);

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    throw new Error(
      `Config file not found: ${configPath}\n` +
        `Create a ${CONFIG_FILENAME} file or pass --config <path>.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${configPath}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Config file must contain a JSON object: ${configPath}`);
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.database !== "string" || obj.database.trim() === "") {
    throw new Error(
      `Config requires a non-empty "database" string field: ${configPath}`
    );
  }

  const configDir = dirname(configPath);

  return {
    database: resolve(configDir, obj.database),
    readonly: typeof obj.readonly === "boolean" ? obj.readonly : false,
    wal: typeof obj.wal === "boolean" ? obj.wal : true,
  };
}
