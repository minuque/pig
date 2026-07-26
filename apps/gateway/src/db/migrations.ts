import { createHash } from "node:crypto";
import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  rename,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import type { DataRoots } from "../types.js";
export const APPLICATION_ID = 0x4e504e47;
export const MAX_SCHEMA = 1;
export class DatabaseError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
type Migration = { name: string; version: number; sql: string };
async function migrations(dir: string): Promise<Migration[]> {
  const names = (await readdir(dir))
    .filter((x) => /^\d{3}-.+\.sql$/.test(x))
    .sort();
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
  )
    throw new DatabaseError("migration_history_invalid");
  return list;
}
function validateHistory(
  db: DatabaseSync,
  version: number,
  list: Migration[],
): void {
  if (version === 0) return;
  let rows: Array<{ version: number; name: string; checksum: string }>;
  try {
    rows = db
      .prepare(
        "SELECT version,name,checksum FROM migration_history ORDER BY version",
      )
      .all() as Array<{ version: number; name: string; checksum: string }>;
  } catch {
    throw new DatabaseError("migration_history_invalid");
  }
  if (rows.length !== version)
    throw new DatabaseError("migration_history_invalid");
  for (let index = 0; index < version; index++) {
    const row = rows[index];
    const migration = list[index];
    if (
      !row ||
      !migration ||
      row.version !== index + 1 ||
      row.name !== migration.name ||
      row.checksum !== hash(migration.sql)
    )
      throw new DatabaseError("migration_history_invalid");
  }
}
export async function openDatabase(
  roots: DataRoots,
  migrationDir: string,
): Promise<DatabaseSync> {
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
    try {
      const id = Number(
        (
          db.prepare("PRAGMA application_id").get() as {
            application_id: number;
          }
        ).application_id,
      );
      if (id !== 0 && id !== APPLICATION_ID)
        throw new DatabaseError("database_not_owned");
      if (id === 0) db.exec(`PRAGMA application_id=${APPLICATION_ID}`);
    } catch (e) {
      if (e instanceof DatabaseError) throw e;
      throw new DatabaseError("database_corrupt");
    }
    const list = await migrations(migrationDir);
    const v = Number(
      (db.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version,
    );
    if (v > MAX_SCHEMA) throw new DatabaseError("database_newer_than_binary");
    validateHistory(db, v, list);
    const pending = list.some((migration) => migration.version > v);
    if (pending) {
      await mkdir(roots.backups, { recursive: true });
      const backupDir = join(roots.backups, `${Date.now()}-schema-${v}`);
      await mkdir(backupDir, { recursive: true });
      const tmp = join(backupDir, "app.sqlite3.tmp");
      await backup(db, tmp);
      const digest = await sha(tmp);
      const check = new DatabaseSync(tmp, { readOnly: true });
      let integrity: string;
      let backupId: number;
      let backupVersion: number;
      try {
        integrity = String(
          (
            check.prepare("PRAGMA integrity_check").get() as {
              integrity_check: string;
            }
          ).integrity_check,
        );
        backupId = Number(
          (
            check.prepare("PRAGMA application_id").get() as {
              application_id: number;
            }
          ).application_id,
        );
        backupVersion = Number(
          (
            check.prepare("PRAGMA user_version").get() as {
              user_version: number;
            }
          ).user_version,
        );
      } finally {
        check.close();
      }
      if (
        integrity !== "ok" ||
        backupId !== APPLICATION_ID ||
        backupVersion !== v
      )
        throw new DatabaseError("backup_invalid");
      await rename(tmp, join(backupDir, "app.sqlite3"));
      await writeFile(
        join(backupDir, "manifest.json"),
        JSON.stringify({
          version: v,
          sha256: digest,
          createdAt: new Date().toISOString(),
        }),
        { mode: 0o600 },
      );
    }
    for (const m of list) {
      if (m.version <= v) continue;
      db.exec("BEGIN IMMEDIATE");
      try {
        db.exec(m.sql);
        db.prepare(
          "INSERT INTO migration_history(version,name,checksum,applied_at) VALUES(?,?,?,?)",
        ).run(m.version, m.name, hash(m.sql), new Date().toISOString());
        db.exec(`PRAGMA user_version=${m.version}`);
        db.exec("COMMIT");
      } catch {
        try {
          db.exec("ROLLBACK");
        } catch {}
        throw new DatabaseError("migration_failed");
      }
    }
    validateHistory(db, MAX_SCHEMA, list);
    if (pending) await pruneBackups(roots);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
function hash(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
async function sha(path: string) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}
async function pruneBackups(roots: DataRoots): Promise<void> {
  const ids = (await readdir(roots.backups)).sort().reverse();
  await Promise.all(
    ids.slice(3).map((id) => rm(join(roots.backups, id), { recursive: true })),
  );
}
export async function listBackups(
  roots: DataRoots,
): Promise<
  Array<{ id: string; version: number; sha256: string; valid: boolean }>
> {
  let out: Array<{
    id: string;
    version: number;
    sha256: string;
    valid: boolean;
  }> = [];
  try {
    for (const id of await readdir(roots.backups)) {
      try {
        const m = JSON.parse(
          await readFile(join(roots.backups, id, "manifest.json"), "utf8"),
        ) as { version: number; sha256: string };
        const actual = await sha(join(roots.backups, id, "app.sqlite3"));
        out.push({
          id,
          version: m.version,
          sha256: m.sha256,
          valid: actual === m.sha256,
        });
      } catch {}
    }
  } catch {}
  return out;
}
export async function restoreBackup(
  roots: DataRoots,
  id: string,
): Promise<void> {
  if (!/^\d+-schema-\d+$/.test(id)) throw new DatabaseError("backup_invalid");
  const p = join(roots.backups, id, "app.sqlite3");
  const digest = await sha(p);
  const entries = await listBackups(roots);
  const b = entries.find((x) => x.id === id);
  if (!b || !b.valid || b.sha256 !== digest)
    throw new DatabaseError("backup_invalid");
  const check = new DatabaseSync(p, { readOnly: true });
  let ok: boolean;
  try {
    ok =
      String(
        (
          check.prepare("PRAGMA integrity_check").get() as {
            integrity_check: string;
          }
        ).integrity_check,
      ) === "ok" &&
      Number(
        (
          check.prepare("PRAGMA application_id").get() as {
            application_id: number;
          }
        ).application_id,
      ) === APPLICATION_ID;
  } finally {
    check.close();
  }
  if (!ok) throw new DatabaseError("backup_invalid");
  const suffix = `.before-restore-${Date.now()}`;
  for (const extension of ["", "-wal", "-shm"]) {
    try {
      await rename(
        roots.database + extension,
        roots.database + extension + suffix,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const temporary = roots.database + ".tmp";
  await writeFile(temporary, await readFile(p), { mode: 0o600 });
  await rename(temporary, roots.database);
  const installed = new DatabaseSync(roots.database, { readOnly: true });
  try {
    const integrity = String(
      (
        installed.prepare("PRAGMA integrity_check").get() as {
          integrity_check: string;
        }
      ).integrity_check,
    );
    const applicationId = Number(
      (
        installed.prepare("PRAGMA application_id").get() as {
          application_id: number;
        }
      ).application_id,
    );
    if (integrity !== "ok" || applicationId !== APPLICATION_ID)
      throw new DatabaseError("backup_invalid");
  } finally {
    installed.close();
  }
}
