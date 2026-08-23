import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const desktop = join(root, "apps/desktop");

const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status) throw new Error(`${command} failed`);
};

if (process.platform !== "win32") {
  throw new Error("pnpm dist:win 只支持在 Windows 上打 NSIS 安装包");
}

const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

run("pnpm", ["--filter", "@pig/gateway", "build"]);
run("pnpm", ["exec", "tsc", "-p", "tsconfig.main.json"], desktop);

await mkdir(join(desktop, "out/preload"), { recursive: true });
await cp(join(desktop, "src/preload/index.js"), join(desktop, "out/preload/index.js"));

run(
  "pnpm",
  [
    "exec",
    "electron-builder",
    "--win",
    "--x64",
    "--publish",
    "never",
    `-c.extraMetadata.version=${version}`,
  ],
  desktop,
);
