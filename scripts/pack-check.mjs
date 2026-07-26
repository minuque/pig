import { spawn, spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temp = await mkdtemp(join(tmpdir(), "npng-pack-check-"));
const npmCli = process.env.npm_execpath;

function npmArgs(args) {
  if (npmCli) return { command: process.execPath, args: [npmCli, ...args] };
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `npm ${args.join(" ")}`],
    };
  }
  return { command: "npm", args };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function runNpm(args, options = {}) {
  const invocation = npmArgs(args);
  return run(invocation.command, invocation.args, options);
}

function pack(workspace) {
  const output = runNpm(["pack", "--json", "--pack-destination", temp, "--workspace", workspace]);
  const report = JSON.parse(output);
  if (!Array.isArray(report) || report.length !== 1 || report[0].error) {
    throw new Error(`Unexpected npm pack report for ${workspace}`);
  }
  return { report: report[0], tarball: join(temp, report[0].filename) };
}

function assertGatewayFiles(files) {
  const allowedFiles = new Set(["package.json", "README", "README.md", "LICENSE", "LICENSE.md"]);
  for (const { path } of files) {
    const allowed = allowedFiles.has(path) || path.startsWith("dist/");
    if (!allowed) throw new Error(`Unexpected gateway package file: ${path}`);
    if (path === "src" || path.startsWith("src/")) {
      throw new Error(`Gateway package contains source: ${path}`);
    }
  }
  for (const required of [
    "package.json",
    "README.md",
    "LICENSE",
    "dist/cli.js",
    "dist/migrations/001-initial.sql",
    "dist/public/index.html",
  ]) {
    if (!files.some(({ path }) => path === required)) {
      throw new Error(`Gateway package is missing ${required}`);
    }
  }
  for (const forbiddenPrefix of ["migrations/", "public/"]) {
    if (files.some(({ path }) => path.startsWith(forbiddenPrefix))) {
      throw new Error(`Gateway package duplicates runtime assets at ${forbiddenPrefix}`);
    }
  }
}

function assertNoWorkspaceLinks(packageJson) {
  for (const section of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    for (const [name, value] of Object.entries(packageJson[section] ?? {})) {
      if (/^(?:workspace:|file:|link:)/.test(String(value))) {
        throw new Error(`Workspace link leaked into package: ${name}=${value}`);
      }
    }
  }
}

function waitForReady(child) {
  return new Promise((resolveReady, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(new Error(`Gateway did not become ready in 15s\n${output}`));
    }, 15_000);
    const consume = (chunk) => {
      output += chunk.toString();
      const origin = /no-pi-no-gang listening at (https?:\/\/[^/#\s]+)/.exec(output)?.[1];
      if (origin !== undefined) {
        clearTimeout(timer);
        resolveReady(origin);
      }
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Gateway exited before ready (${code})\n${output}`));
    });
  });
}

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Gateway did not exit within 15s after SIGTERM"));
    }, 15_000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolveExit(code);
    });
  });
}

try {
  const gateway = pack("no-pi-no-gang");
  assertGatewayFiles(gateway.report.files);

  const unpacked = join(temp, "unpacked");
  await mkdir(unpacked);
  run("tar", ["-xzf", basename(gateway.tarball), "-C", "unpacked"], {
    cwd: temp,
  });
  const packedPackage = JSON.parse(
    await readFile(join(unpacked, "package", "package.json"), "utf8"),
  );
  assertNoWorkspaceLinks(packedPackage);
  await access(join(unpacked, "package", "dist", "cli.js"));

  const contracts = pack("@no-pi-no-gang/contracts");
  const project = join(temp, "install-project");
  await mkdir(project);
  await writeFile(
    join(project, "package.json"),
    JSON.stringify({ name: "pack-check", version: "1.0.0", private: true }),
  );
  runNpm(
    ["install", gateway.tarball, contracts.tarball, "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: project },
  );

  const cli = join(project, "node_modules", "no-pi-no-gang", "dist", "cli.js");
  const help = run(process.execPath, [cli, "--help"], { cwd: project });
  if (!help.includes("no-pi-no-gang")) throw new Error("CLI --help failed");
  const version = run(process.execPath, [cli, "--version"], { cwd: project });
  if (version.trim() !== packedPackage.version) {
    throw new Error(`CLI version mismatch: ${version.trim()}`);
  }

  const dataDir = join(temp, "smoke-data");
  const child = spawn(process.execPath, [cli, "--no-open", "--data-dir", dataDir], {
    cwd: project,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const origin = await waitForReady(child);
  const indexResponse = await fetch(origin);
  const indexHtml = await indexResponse.text();
  if (!indexResponse.ok || !/assets\/index-[^"]+\.js/.test(indexHtml)) {
    throw new Error("Packed Gateway did not serve the built SPA");
  }
  child.kill("SIGTERM");
  const exitCode = await waitForExit(child);
  if (exitCode !== 0 && exitCode !== null) {
    throw new Error(`Gateway exited with code ${exitCode} after SIGTERM`);
  }
  const lock = join(dataDir, "State", "run", "instance.lock");
  const lockModule = pathToFileURL(
    join(project, "node_modules", "no-pi-no-gang", "dist", "platform", "lock.js"),
  ).href;
  run(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { acquireLock } from ${JSON.stringify(lockModule)}; const release = await acquireLock({ lock: ${JSON.stringify(lock)} }); await release();`,
    ],
    { cwd: project },
  );
  try {
    await access(lock);
    throw new Error(`Gateway lock was not released: ${lock}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Gateway lock")) {
      throw error;
    }
  }

  process.stdout.write(
    `gateway: packed ${basename(gateway.tarball)}, installed, CLI and smoke passed\n`,
  );
} finally {
  await rm(temp, {
    recursive: true,
    force: true,
    maxRetries: process.platform === "win32" ? 5 : 0,
    retryDelay: 100,
  });
}
