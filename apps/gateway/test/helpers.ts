import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { DataRoots } from "../src/types.js";
import { Store } from "../src/db/store.js";

export async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "npng-gateway-test-"));
}

export async function removeTempDir(path: string): Promise<void> {
  await rm(path, {
    recursive: true,
    force: true,
    maxRetries: process.platform === "win32" ? 5 : 0,
    retryDelay: 50,
  });
}

export function rootsFor(path: string): DataRoots {
  return {
    base: path,
    data: join(path, "data"),
    state: join(path, "state"),
    cache: join(path, "cache"),
    logs: join(path, "logs"),
    database: join(path, "data", "app.sqlite3"),
    lock: join(path, "state", "run", "instance.lock"),
    marker: join(path, "state", "run", "crash-marker.json"),
    backups: join(path, "data", "backups"),
  };
}

export async function openSchemaDatabase(path: string): Promise<DatabaseSync> {
  const db = new DatabaseSync(path);
  const migration = await readFile(
    fileURLToPath(new URL("../migrations/001-initial.sql", import.meta.url)),
    "utf8",
  );
  db.exec(migration);
  db.exec("PRAGMA application_id=0x4e504e47; PRAGMA user_version=1;");
  return db;
}

export async function openStore(path: string): Promise<{ db: DatabaseSync; store: Store }> {
  const db = await openSchemaDatabase(path);
  return { db, store: new Store(db) };
}

export function addPrincipalWorkspaceSession(store: Store, sourcePath: string) {
  const now = "2025-01-01T00:00:00.000Z";
  store.run(
    "INSERT INTO principals(principal_id,display_name,created_at) VALUES(?,?,?)",
    "principal_1",
    "Test User",
    now,
  );
  store.run(
    "INSERT INTO workspaces(workspace_id,principal_id,name,canonical_root,updated_at) VALUES(?,?,?,?,?)",
    "workspace_1",
    "principal_1",
    "Workspace",
    sourcePath,
    now,
  );
  store.run(
    "INSERT INTO sessions(session_id,workspace_id,source_path,name,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    "session_1",
    "workspace_1",
    sourcePath,
    "Session",
    now,
    now,
  );
}
