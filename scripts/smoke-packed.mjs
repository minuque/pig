import { spawn, spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const gateway = join(root, "packages/gateway");
const staging = await mkdtemp(join(tmpdir(), "nono-pack-"));
const install = await mkdtemp(join(tmpdir(), "nono-install-"));
const run = (command, args, cwd = root, capture = false) => {
  const result = spawnSync(command, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: capture ? "pipe" : "inherit",
    encoding: capture ? "utf8" : undefined,
  });
  if (result.status)
    throw new Error(`${command} failed${result.stderr ? `: ${result.stderr}` : ""}`);
  return result.stdout ?? "";
};

try {
  const packOutput = run(
    "npm",
    ["pack", "--json", "--silent", "--pack-destination", staging],
    gateway,
    true,
  ).replaceAll("\r\n", "\n");
  const jsonStart = packOutput.lastIndexOf("[\n  {");
  if (jsonStart < 0) throw new Error("npm pack did not return JSON metadata");
  const [packed] = JSON.parse(packOutput.slice(jsonStart));
  const artifact = join(staging, packed.filename);
  const entries = new Set(packed.files.map(({ path }) => path));
  for (const required of [
    "dist/cli.js",
    "web/index.html",
    "package.json",
    "node_modules/@no-pi-no-gang/contracts/dist/index.js",
  ])
    if (!entries.has(required)) throw new Error(`packed artifact is missing ${required}`);

  const portableArtifact = join(install, "gateway.tgz");
  await cp(artifact, portableArtifact);
  await rm(staging, { recursive: true, force: true });
  await rm(join(gateway, "dist"), { recursive: true, force: true });
  await rm(join(gateway, "web"), { recursive: true, force: true });
  run("npm", ["init", "-y"], install);
  run("npm", ["install", portableArtifact], install);
  const installedPackage = JSON.parse(
    await readFile(join(install, "node_modules/@no-pi-no-gang/gateway/package.json"), "utf8"),
  );
  if (installedPackage.bin?.["no-pi-no-gang"] !== "dist/cli.js")
    throw new Error("packed artifact is missing the CLI bin");
  const bin =
    process.platform === "win32"
      ? join(install, "node_modules/.bin/no-pi-no-gang.cmd")
      : join(install, "node_modules/.bin/no-pi-no-gang");
  const child = spawn(bin, [], {
    cwd: install,
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NO_OPEN: "1",
      BOOTSTRAP_SECRET: "smoke",
      GATEWAY_DB_PATH: join(install, "gateway.sqlite"),
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  try {
    const origin = await new Promise((resolveOrigin, reject) => {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (text) => {
        const match = text.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) resolveOrigin(match[0]);
      });
      child.once("exit", (code) => reject(new Error(`gateway exited ${code}`)));
      setTimeout(() => reject(new Error("gateway readiness timeout")), 10000).unref();
    });
    const health = await fetch(`${origin}/health`);
    const html = await (await fetch(origin)).text();
    const asset = html.match(/(?:src|href)="(\/assets\/[^"]+)"/)?.[1];
    if (
      !health.ok ||
      !html.includes('<div id="app"></div>') ||
      !asset ||
      !(await fetch(`${origin}${asset}`)).ok
    )
      throw new Error("packed smoke assertion failed");
    console.log("packed smoke: artifact, install, bin, Ready, SPA and asset OK");
  } finally {
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill();
    if (child.exitCode === null)
      await new Promise((resolveExit) => child.once("exit", resolveExit));
  }
} finally {
  run("node", [join(root, "scripts/build-package.mjs"), "restore"]);
  await rm(join(gateway, "dist"), { recursive: true, force: true });
  await rm(join(gateway, "web"), { recursive: true, force: true });
  await rm(staging, { recursive: true, force: true });
  await rm(install, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
