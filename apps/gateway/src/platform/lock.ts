import { open, readFile, rm, writeFile } from "node:fs/promises";
import type { DataRoots } from "../types.js";
export async function acquireLock(roots: DataRoots): Promise<() => Promise<void>> {
  const create = async () => {
    const handle = await open(roots.lock, "wx");
    try {
      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          startedAt: new Date().toISOString(),
        }),
      );
    } finally {
      await handle.close();
    }
  };

  try {
    await create();
  } catch {
    let owner = "unknown";
    try {
      owner = await readFile(roots.lock, "utf8");
      const pid = Number((JSON.parse(owner) as { pid?: unknown }).pid);
      if (!Number.isSafeInteger(pid) || pid <= 0 || processIsAlive(pid)) {
        throw new Error("lock_active");
      }
      await removeLock(roots.lock);
      await create();
    } catch {
      throw new Error(`lock_conflict:${owner.slice(0, 160)}`);
    }
  }
  return () => removeLock(roots.lock);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function removeLock(path: string): Promise<void> {
  await rm(path, {
    force: true,
    maxRetries: process.platform === "win32" ? 5 : 0,
    retryDelay: 50,
  });
}
export async function writeMarker(
  path: string,
  status: "running" | "clean",
  epoch: string,
): Promise<void> {
  await writeFile(path, JSON.stringify({ status, epoch, startedAt: new Date().toISOString() }), {
    mode: 0o600,
  });
}
