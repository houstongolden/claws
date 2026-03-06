/**
 * Shared db reference so proactivity.ts can use getDb without importing index (avoids circular dependency).
 */
import type { PGlite } from "@electric-sql/pglite";

let db: PGlite | null = null;

export function getDb(): PGlite {
  if (!db) throw new Error("Runtime DB not initialized. Call initRuntimeDb first.");
  return db;
}

export function setDb(instance: PGlite): void {
  db = instance;
}

export function clearDb(): void {
  db = null;
}
