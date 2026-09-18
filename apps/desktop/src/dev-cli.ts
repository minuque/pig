/** 控制台包装 Electron：进程被 SIGINT 打死也能清掉 Vite 占用的端口。 */
import { spawn, spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { viteDevPort } from "./main/urls.js"
import { killPortListeners } from "./main/vite-child.js"

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const desktopRequire = createRequire(join(desktopRoot, "package.json"))

function electronExecutable(): string {
  const value: unknown = desktopRequire("electron")

  if (typeof value !== "string" || value.length === 0) {
    throw new Error("未解析到 Electron 可执行文件")
  }

  return value
}

function killPidTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    })
    return
  }

  try {
    process.kill(pid, "SIGTERM")
  } catch {
    // 已退出
  }
}

const vitePort = viteDevPort()
const watchdog = spawn(
  process.execPath,
  [join(desktopRoot, "scripts/dev-watchdog.mjs"), String(process.pid), String(vitePort)],
  { detached: true, stdio: "ignore", windowsHide: true },
)

watchdog.unref()

const electron = spawn(electronExecutable(), [".", "--", "--dev", ...process.argv.slice(2)], {
  cwd: desktopRoot,
  env: { ...process.env, PIG_VITE_PORT: String(vitePort) },
  stdio: "inherit",
})
let stopping = false

function stop(exitCode = 0): void {
  if (stopping) return
  stopping = true

  if (electron.pid !== undefined) killPidTree(electron.pid)
  killPortListeners(vitePort)
  process.exit(exitCode)
}

process.once("SIGINT", () => stop())

process.once("SIGTERM", () => stop())

if (process.platform === "win32") process.once("SIGBREAK", () => stop())

electron.once("error", () => stop(1))

electron.once("exit", (code, signal) => {
  killPortListeners(vitePort)

  if (stopping) return
  process.exit(code ?? (signal ? 1 : 0))
})
