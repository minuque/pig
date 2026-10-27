import { spawn } from "node:child_process"

function spawnPnpm(args, cwd, env) {
  const exec = process.env.npm_execpath
  // pnpm 12 起 npm_execpath 是可执行文件，11 及以前是 JS 入口，要经 node 启动
  const viaNode = Boolean(exec && /\.[cm]?js$/.test(exec))
  const fallback = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
  return spawn(viaNode ? process.execPath : (exec ?? fallback), viaNode ? [exec, ...args] : args, {
    cwd,
    windowsHide: true,
    env,
  })
}

export function runPnpm(args, cwd) {
  return new Promise((resolveRun) => {
    const started = Date.now()
    const env = { ...process.env, FORCE_COLOR: "0" }
    const child = spawnPnpm(args, cwd, env)
    let out = ""

    child.stdout.on("data", (chunk) => {
      out += chunk
    })
    child.stderr.on("data", (chunk) => {
      out += chunk
    })
    child.on("error", (error) => {
      resolveRun({
        code: 1,
        out: `${out}${error.message}\n`,
        ms: Date.now() - started,
      })
    })
    child.on("close", (code) => {
      resolveRun({ code: code ?? 1, out, ms: Date.now() - started })
    })
  })
}

export function reportResults(title, results) {
  const failed = []

  for (const result of results) {
    const status = result.code === 0 ? "ok" : "FAIL"
    const sec = (result.ms / 1000).toFixed(1)
    console.log(`\n=== ${result.name} (${sec}s, ${status}) ===`)
    const body = result.out.trimEnd()

    if (body) console.log(body)

    if (result.code !== 0) failed.push(result.name)
  }

  console.log("")

  if (failed.length) {
    console.error(`${title} failed: ${failed.join(", ")}`)
    process.exitCode = 1
    return
  }

  console.log(`${title} passed`)
}
