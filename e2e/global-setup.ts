import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export default function globalSetup() {
  if (process.env.PIG_E2E_SKIP_BUILD === "1") return;
  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error("pnpm executable not found; run via pnpm test:e2e");
  const result = spawnSync(process.execPath, [pnpm, "build"], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status) throw new Error("pnpm build failed");
}
