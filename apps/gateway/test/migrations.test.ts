import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  APPLICATION_ID,
  DatabaseError,
  listBackups,
  openDatabase,
  restoreBackup,
} from "../src/db/migrations.js";
import { removeTempDir, rootsFor, tempDir } from "./helpers.js";

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

async function migrationFixture() {
  const dir = await tempDir();
  cleanups.push(dir);
  const roots = rootsFor(dir);
  const migrationDir = join(dir, "migrations");
  await mkdir(migrationDir, { recursive: true });
  const sql = await readFile(new URL("../migrations/001-initial.sql", import.meta.url), "utf8");
  await writeFile(join(migrationDir, "001-initial.sql"), sql);
  await mkdir(roots.data, { recursive: true });
  return { dir, roots, migrationDir };
}

describe("SQLite migrations", () => {
  it("creates a verified online-backup before migration and supports explicit restore", async () => {
    const { roots, migrationDir } = await migrationFixture();
    const db = await openDatabase(roots, migrationDir);
    expect(
      Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version),
    ).toBe(1);
    db.close();
    const backups = await listBackups(roots);
    expect(backups).toHaveLength(1);
    expect(backups[0]!.valid).toBe(true);
    await restoreBackup(roots, backups[0]!.id);
    const restored = new DatabaseSync(roots.database, { readOnly: true });
    expect(
      Number(
        (
          restored.prepare("PRAGMA application_id").get() as {
            application_id: number;
          }
        ).application_id,
      ),
    ).toBe(APPLICATION_ID);
    expect(
      Number(
        (
          restored.prepare("PRAGMA user_version").get() as {
            user_version: number;
          }
        ).user_version,
      ),
    ).toBe(0);
    restored.close();
  });

  it("fails closed for foreign databases and migration checksum changes", async () => {
    const fixture = await migrationFixture();
    const foreign = new DatabaseSync(fixture.roots.database);
    foreign.exec("PRAGMA application_id=99;");
    foreign.close();
    await expect(
      openDatabase(fixture.roots, fixture.migrationDir),
    ).rejects.toMatchObject<DatabaseError>({ code: "database_not_owned" });

    const replacement = join(fixture.dir, "replacement.sqlite3");
    fixture.roots.database = replacement;
    const first = await openDatabase(fixture.roots, fixture.migrationDir);
    first.close();
    await writeFile(
      join(fixture.migrationDir, "001-initial.sql"),
      "\n" + (await readFile(join(fixture.migrationDir, "001-initial.sql"), "utf8")),
    );
    await expect(
      openDatabase(fixture.roots, fixture.migrationDir),
    ).rejects.toMatchObject<DatabaseError>({
      code: "migration_history_invalid",
    });
  });
});
