import { spawnSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const artifactDir = resolve(
  process.env.NPNG_RELEASE_ARTIFACT_DIR ?? join(root, "release-artifact"),
);
const files = await readdir(artifactDir);
const contracts = files.find((file) => file.includes("contracts") && file.endsWith(".tgz"));
const gateway = files.find((file) => file.startsWith("no-pi-no-gang-") && file.endsWith(".tgz"));
if (!contracts || !gateway) throw new Error("Release artifact tarballs are incomplete");
const installDir = join(root, ".release-install");
await rm(installDir, {
  recursive: true,
  force: true,
  maxRetries: process.platform === "win32" ? 5 : 0,
});
await mkdir(installDir);
await writeFile(
  join(installDir, "package.json"),
  JSON.stringify({ name: "release-smoke", private: true }),
);
const npmCli = process.env.npm_execpath;
const args = [
  "install",
  "--no-audit",
  "--no-fund",
  join(artifactDir, contracts),
  join(artifactDir, gateway),
];
const result = spawnSync(
  npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm",
  npmCli ? [npmCli, ...args] : args,
  { cwd: installDir, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(join(installDir, "node_modules", "no-pi-no-gang", "dist", "cli.js"));
