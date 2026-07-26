import { homedir, platform } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import type { DataRoots } from "../types.js";
export function resolveDataRoots(override?: string): DataRoots {
  const p = platform();
  const home = homedir();
  const base =
    override ??
    process.env.NO_PI_NO_GANG_DATA_DIR ??
    (p === "win32"
      ? resolve(process.env.LOCALAPPDATA ?? resolve(home, "AppData/Local"), "no-pi-no-gang")
      : p === "darwin"
        ? resolve(home, "Library/Application Support/no-pi-no-gang")
        : resolve(process.env.XDG_DATA_HOME ?? resolve(home, ".local/share"), "no-pi-no-gang"));
  if (!isAbsolute(base)) throw new Error("data_dir_invalid");
  const data = p === "win32" ? resolve(base, "Data") : base;
  const state = override
    ? resolve(base, "State")
    : p === "darwin"
      ? resolve(base, "State")
      : p === "win32"
        ? resolve(base, "State")
        : resolve(process.env.XDG_STATE_HOME ?? resolve(home, ".local/state"), "no-pi-no-gang");
  const cache = override
    ? resolve(base, "Cache")
    : p === "darwin"
      ? resolve(home, "Library/Caches/no-pi-no-gang")
      : p === "win32"
        ? resolve(base, "Cache")
        : resolve(process.env.XDG_CACHE_HOME ?? resolve(home, ".cache"), "no-pi-no-gang");
  const logs = override
    ? resolve(base, "Logs")
    : p === "darwin"
      ? resolve(home, "Library/Logs/no-pi-no-gang")
      : p === "win32"
        ? resolve(base, "Logs")
        : resolve(state, "logs");
  return {
    base: resolve(base),
    data,
    state,
    cache,
    logs,
    database: resolve(data, "app.sqlite3"),
    lock: resolve(state, "run/instance.lock"),
    marker: resolve(state, "run/crash-marker.json"),
    backups: resolve(data, "backups"),
  };
}
export async function ensureRoots(r: DataRoots): Promise<void> {
  await Promise.all(
    [r.data, r.state, r.cache, r.logs, resolve(r.state, "run"), r.backups].map((p) =>
      mkdir(p, { recursive: true, mode: 0o700 }),
    ),
  );
}
