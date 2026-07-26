import { spawnSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const web = join(root, "apps", "web");
const gateway = join(root, "apps", "gateway");

function npmRun(script, workspace) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === "win32" ? "cmd.exe" : "npm";
  const args = npmCli
    ? [npmCli, "run", script, "--workspace", workspace]
    : process.platform === "win32"
      ? ["/d", "/s", "/c", `npm run ${script} --workspace ${workspace}`]
      : ["run", script, "--workspace", workspace];
  const run = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status ?? 1);
}

// 1. Build the web SPA (apps/web/dist; CSS inlined into index.html).
npmRun("build", "@no-pi-no-gang/web");
// 2. Build the gateway server from a clean output tree so removed source files
// cannot leak into the release artifact.
await rm(join(gateway, "dist"), { recursive: true, force: true });
npmRun("build", "no-pi-no-gang");
// 3. Stage runtime assets: migrations plus the web SPA as dist/public.
await rm(join(gateway, "dist", "migrations"), { recursive: true, force: true });
await rm(join(gateway, "dist", "public"), { recursive: true, force: true });
await mkdir(join(gateway, "dist"), { recursive: true });
await cp(join(gateway, "migrations"), join(gateway, "dist", "migrations"), {
  recursive: true,
});
await cp(join(web, "dist"), join(gateway, "dist", "public"), {
  recursive: true,
});
