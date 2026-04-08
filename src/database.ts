import Database from "better-sqlite3";
import type { Config } from "./config.js";

let storedConfig: Config | null = null;

export function initDatabase(config: Config): void {
  storedConfig = config;

  const db = new Database(config.database, {
    readonly: config.readonly,
  });

  try {
    if (config.wal && !config.readonly) {
      db.pragma("journal_mode = WAL");
    }
    db.pragma("foreign_keys = ON");
  } finally {
    db.close();
  }
}

export function withDatabase<T>(fn: (db: Database.Database) => T): T {
  if (!storedConfig) {
    throw new Error("Database not configured. Call initDatabase() first.");
  }

  const db = new Database(storedConfig.database, {
    readonly: storedConfig.readonly,
  });

  db.pragma("foreign_keys = ON");

  try {
    return fn(db);
  } finally {
    db.close();
  }
}
