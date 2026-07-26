import type { FullConfig } from "@playwright/test";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

function npm(args: string[], cwd = root): string {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const invocation = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, invocation, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function pack(workspace: string, destination: string): string {
  const report = JSON.parse(
    npm(["pack", "--json", "--pack-destination", destination, "--workspace", workspace]),
  ) as Array<{ filename: string; error?: unknown }>;
  if (report.length !== 1 || report[0]?.error) throw new Error(`npm pack failed for ${workspace}`);
  return join(destination, report[0]!.filename);
}

export default async function globalSetup(_config: FullConfig) {
  if (!process.env.NPNG_RELEASE_ARTIFACT_DIR) npm(["run", "build"]);
  const temp = await mkdtemp(join(tmpdir(), "npng-acceptance-pack-"));
  const project = join(temp, "installed");
  await mkdir(project);
  await writeFile(
    join(project, "package.json"),
    JSON.stringify({ name: "npng-acceptance-install", private: true }),
  );
  let contractsTarball: string;
  let gatewayTarball: string;
  if (process.env.NPNG_RELEASE_ARTIFACT_DIR) {
    const artifactDir = resolve(process.env.NPNG_RELEASE_ARTIFACT_DIR);
    const files = await readdir(artifactDir);
    const contracts = files.find((file) => file.includes("contracts") && file.endsWith(".tgz"));
    const gateway = files.find(
      (file) => file.startsWith("no-pi-no-gang-") && file.endsWith(".tgz"),
    );
    if (!contracts || !gateway) throw new Error("Release artifact tarballs are incomplete");
    contractsTarball = join(artifactDir, contracts);
    gatewayTarball = join(artifactDir, gateway);
  } else {
    contractsTarball = pack("@no-pi-no-gang/contracts", temp);
    gatewayTarball = pack("no-pi-no-gang", temp);
  }
  npm(["install", "--no-audit", "--no-fund", contractsTarball, gatewayTarball], project);
  process.env.NPNG_ACCEPTANCE_INSTALL = project;
  process.env.NPNG_ACCEPTANCE_TARBALL = gatewayTarball;
  return async () => {
    await rm(temp, {
      recursive: true,
      force: true,
      maxRetries: process.platform === "win32" ? 5 : 0,
      retryDelay: 100,
    });
  };
}
