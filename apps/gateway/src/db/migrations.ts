import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import type { DataRoots } from "../types.js";

export const APPLICATION_ID = 0x4e504e47;
export const MAX_SCHEMA = 2;

export class DatabaseError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

type Migration = { name: string; version: number; sql: string };

async function migrations(dir: string): Promise<Migration[]> {
  const names = (await readdir(dir)).filter((name) => /^\d{3}-.+\.sql$/.test(name)).sort();
  const list = await Promise.all(
    names.map(async (name) => ({
      name,
      version: Number(name.slice(0, 3)),
      sql: await readFile(join(dir, name), "utf8"),
    })),
  );
  if (
    list.length !== MAX_SCHEMA ||
    list.some((migration, index) => migration.version !== index + 1)
  ) {
    throw new DatabaseError("migration_history_invalid");
  }
  return list;
}

function validateHistory(db: DatabaseSync, version: number, list: Migration[]): void {
  if (version === 0) return;
  let rows: Array<{ version: number; name: string; checksum: string }>;
  try {
    rows = db
      .prepare("SELECT version,name,checksum FROM migration_history ORDER BY version")
      .all() as Array<{ version: number; name: string; checksum: string }>;
  } catch {
    throw new DatabaseError("migration_history_invalid");
  }
  if (rows.length !== version) {
    throw new DatabaseError("migration_history_invalid");
  }
  for (let index = 0; index < version; index += 1) {
    const row = rows[index];
    const migration = list[index];
    if (
      !row ||
      !migration ||
      row.version !== index + 1 ||
      row.name !== migration.name ||
      row.checksum !== hash(migration.sql)
    ) {
      throw new DatabaseError("migration_history_invalid");
    }
  }
}

function isTrulyEmpty(db: DatabaseSync): boolean {
  return (
    Number(
      (
        db
          .prepare("SELECT count(*) AS count FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'")
          .get() as { count: number }
      ).count,
    ) === 0
  );
}

function validateOwnedDatabase(
  db: DatabaseSync,
  list: Migration[],
  expectedVersion?: number,
): number {
  let integrity: string;
  let applicationId: number;
  let version: number;
  try {
    integrity = String(
      (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check,
    );
    applicationId = Number(
      (db.prepare("PRAGMA application_id").get() as { application_id: number }).application_id,
    );
    version = Number(
      (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version,
    );
  } catch {
    throw new DatabaseError("database_corrupt");
  }
  if (integrity !== "ok") throw new DatabaseError("database_corrupt");
  if (applicationId !== APPLICATION_ID) throw new DatabaseError("database_not_owned");
  if (version > MAX_SCHEMA) throw new DatabaseError("database_newer_than_binary");
  if (expectedVersion !== undefined && version !== expectedVersion)
    throw new DatabaseError("backup_invalid");
  validateHistory(db, version, list);
  return version;
}

export async function openDatabase(roots: DataRoots, migrationDir: string): Promise<DatabaseSync> {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(roots.database, {
      enableForeignKeyConstraints: true,
    });
  } catch {
    throw new DatabaseError("database_corrupt");
  }
  try {
    db.exec("PRAGMA busy_timeout=5000;");
    const list = await migrations(migrationDir);
    const id = Number(
      (db.prepare("PRAGMA application_id").get() as { application_id: number }).application_id,
    );
    if (id === 0) {
      if (!isTrulyEmpty(db)) throw new DatabaseError("database_not_owned");
      db.exec(`PRAGMA application_id=${APPLICATION_ID}`);
    } else if (id !== APPLICATION_ID) {
      throw new DatabaseError("database_not_owned");
    }
    const version = validateOwnedDatabase(db, list);
    const pending = version < MAX_SCHEMA;
    if (pending) await createUpgradeBackup(db, roots, version, list);

    for (const migration of list) {
      if (migration.version <= version) continue;
      db.exec("BEGIN IMMEDIATE");
      try {
        db.exec(migration.sql);
        db.prepare(
          "INSERT INTO migration_history(version,name,checksum,applied_at) VALUES(?,?,?,?)",
        ).run(migration.version, migration.name, hash(migration.sql), new Date().toISOString());
        db.exec(`PRAGMA user_version=${migration.version}`);
        db.exec("COMMIT");
      } catch {
        try {
          db.exec("ROLLBACK");
        } catch {}
        throw new DatabaseError("migration_failed");
      }
    }
    validateOwnedDatabase(db, list, MAX_SCHEMA);
    if (pending) await pruneBackups(roots);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

async function createUpgradeBackup(
  db: DatabaseSync,
  roots: DataRoots,
  version: number,
  list: Migration[],
): Promise<void> {
  await mkdir(roots.backups, { recursive: true });
  const backupDir = join(roots.backups, `${Date.now()}-schema-${version}`);
  await mkdir(backupDir, { recursive: true });
  const temporary = join(backupDir, "app.sqlite3.tmp");
  await backup(db, temporary);
  const check = new DatabaseSync(temporary, { readOnly: true });
  try {
    validateOwnedDatabase(check, list, version);
  } catch {
    throw new DatabaseError("backup_invalid");
  } finally {
    check.close();
  }
  const checksum = await sha(temporary);
  await rename(temporary, join(backupDir, "app.sqlite3"));
  await writeFile(
    join(backupDir, "manifest.json"),
    JSON.stringify({
      version,
      sha256: checksum,
      createdAt: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sha = async (path: string) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

async function pruneBackups(roots: DataRoots): Promise<void> {
  const ids = (await readdir(roots.backups)).sort().reverse();
  await Promise.all(ids.slice(3).map((id) => rm(join(roots.backups, id), { recursive: true })));
}

export async function listBackups(
  roots: DataRoots,
): Promise<Array<{ id: string; version: number; sha256: string; valid: boolean }>> {
  const out: Array<{
    id: string;
    version: number;
    sha256: string;
    valid: boolean;
  }> = [];
  try {
    for (const id of await readdir(roots.backups)) {
      try {
        const manifest = JSON.parse(
          await readFile(join(roots.backups, id, "manifest.json"), "utf8"),
        ) as { version: number; sha256: string };
        const actual = await sha(join(roots.backups, id, "app.sqlite3"));
        out.push({
          id,
          version: manifest.version,
          sha256: manifest.sha256,
          valid: actual === manifest.sha256,
        });
      } catch {}
    }
  } catch {}
  return out;
}

export async function restoreBackup(
  roots: DataRoots,
  id: string,
  migrationDir: string,
): Promise<void> {
  if (!/^\d+-schema-\d+$/.test(id)) throw new DatabaseError("backup_invalid");
  const source = join(roots.backups, id, "app.sqlite3");
  const manifestPath = join(roots.backups, id, "manifest.json");
  let manifest: { version: number; sha256: string };
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if ((await sha(source)) !== manifest.sha256) throw new DatabaseError("backup_invalid");
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError("backup_invalid");
  }
  const list = await migrations(migrationDir);
  const candidate = new DatabaseSync(source, { readOnly: true });
  try {
    validateOwnedDatabase(candidate, list, manifest.version);
  } catch {
    throw new DatabaseError("backup_invalid");
  } finally {
    candidate.close();
  }

  const temporary = `${roots.database}.restore-${Date.now()}.tmp`;
  await writeFile(temporary, await readFile(source), { mode: 0o600 });
  const installedCheck = new DatabaseSync(temporary, { readOnly: true });
  try {
    validateOwnedDatabase(installedCheck, list, manifest.version);
  } catch {
    await rm(temporary, { force: true });
    throw new DatabaseError("backup_invalid");
  } finally {
    installedCheck.close();
  }

  const suffix = `.before-restore-${Date.now()}`;
  const moved: string[] = [];
  try {
    for (const extension of ["", "-wal", "-shm"]) {
      try {
        await rename(roots.database + extension, roots.database + extension + suffix);
        moved.push(extension);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    await rename(temporary, roots.database);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    for (const extension of moved.reverse()) {
      await rename(roots.database + extension + suffix, roots.database + extension).catch(
        () => undefined,
      );
    }
    throw error;
  }
}
