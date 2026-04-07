import Database from "better-sqlite3";
import type { Config } from "./config.js";

let db: Database.Database | null = null;

export function openDatabase(config: Config): Database.Database {
  if (db) return db;

  db = new Database(config.database, {
    readonly: config.readonly,
  });

  if (config.wal && !config.readonly) {
    db.pragma("journal_mode = WAL");
  }

  db.pragma("foreign_keys = ON");

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call openDatabase() first.");
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
