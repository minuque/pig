import { spawn } from "node:child_process";

function spawnPnpm(args, cwd, env) {
  const pnpmJs = process.env.npm_execpath;
  if (pnpmJs) return spawn(process.execPath, [pnpmJs, ...args], { cwd, windowsHide: true, env });
  return spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, {
    cwd,
    windowsHide: true,
    env,
  });
}

export function runPnpm(args, cwd) {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const env = { ...process.env, FORCE_COLOR: "0" };
    const child = spawnPnpm(args, cwd, env);
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      out += chunk;
    });
    child.on("error", (error) => {
      resolveRun({
        code: 1,
        out: `${out}${error.message}\n`,
        ms: Date.now() - started,
      });
    });
    child.on("close", (code) => {
      resolveRun({ code: code ?? 1, out, ms: Date.now() - started });
    });
  });
}

export function reportResults(title, results) {
  const failed = [];
  for (const result of results) {
    const status = result.code === 0 ? "ok" : "FAIL";
    const sec = (result.ms / 1000).toFixed(1);
    console.log(`\n=== ${result.name} (${sec}s, ${status}) ===`);
    const body = result.out.trimEnd();
    if (body) console.log(body);
    if (result.code !== 0) failed.push(result.name);
  }
  console.log("");
  if (failed.length) {
    console.error(`${title} failed: ${failed.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${title} passed`);
}
