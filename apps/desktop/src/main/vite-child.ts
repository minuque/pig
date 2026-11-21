import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { viteDevPort } from "./urls.js"

const WEB_ROOT = fileURLToPath(new URL("../../../../apps/web/", import.meta.url))
const webRequire = createRequire(join(WEB_ROOT, "package.json"))
// 外部：Electron 在 Windows 上通常没开 VT，ESC 会显示成 ←[32m
const ANSI_RE = /\u001B\[[\d;?]*[ -/]*[@-~]|\u001B\][^\u0007]*(?:\u0007|\u001B\\)|\u001B[@-Z\\-_]/g

// 外部：Electron 是 GUI 子系统，stdio inherit 会把 UTF-8 字节按系统代码页解读，\r 也不回车
export function prepareInheritedConsoleChunk(raw: string | Buffer): string {
  const text = typeof raw === "string" ? raw : raw.toString("utf8")
  return text.replace(ANSI_RE, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function prepareWindowsConsole(): void {
  try {
    spawnSync("chcp.com", ["65001"], { stdio: "ignore", windowsHide: true })
  } catch {}
}

function attachWindowsConsole(child: ChildProcess): void {
  prepareWindowsConsole()

  const forward = (src: NodeJS.ReadableStream | null, dest: NodeJS.WriteStream) => {
    if (!src) return
    src.on("data", (chunk: Buffer | string) => {
      dest.write(prepareInheritedConsoleChunk(chunk))
    })
  }

  forward(child.stdout, process.stdout)
  forward(child.stderr, process.stderr)
}

// 外部：Vite 的 exports 不含 bin，只能先解析 package.json 再拼
export function viteBin(): string {
  return join(dirname(webRequire.resolve("vite/package.json")), "bin", "vite.js")
}

export type ViteLaunch = { command: string; args: string[]; env: NodeJS.ProcessEnv }

// 外部：Electron 里 process.execPath 是 GUI 本体，靠 ELECTRON_RUN_AS_NODE 当 Node 用
export function viteLaunch(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  runtime: { execPath: string; electron: boolean } = {
    execPath: process.execPath,
    electron: Boolean(process.versions.electron),
  },
): ViteLaunch {
  return {
    command: runtime.execPath,
    args: [viteBin(), ...args],
    env: runtime.electron ? { ...env, ELECTRON_RUN_AS_NODE: "1" } : { ...env },
  }
}

export function spawnVite(env: { GATEWAY_TARGET: string; GATEWAY_TOKEN: string }): ChildProcess {
  const port = viteDevPort()

  assertVitePortFree(port)

  const launch = viteLaunch(["--port", String(port), "--strictPort"], {
    ...process.env,
    GATEWAY_TARGET: env.GATEWAY_TARGET,
    GATEWAY_TOKEN: env.GATEWAY_TOKEN,
    PIG_DESKTOP_DEV: "1",
  })
  const windows = process.platform === "win32"
  const child = spawn(launch.command, launch.args, {
    cwd: WEB_ROOT,
    env: launch.env,
    stdio: windows ? ["ignore", "pipe", "pipe"] : "inherit",
    detached: !windows,
  })

  if (windows) attachWindowsConsole(child)
  return child
}

function parsePids(stdout: string | null | undefined): number[] {
  if (!stdout) return []
  const pids = new Set<number>()

  for (const token of stdout.split(/[\s,]+/)) {
    const pid = Number(token)

    if (Number.isSafeInteger(pid) && pid > 0) pids.add(pid)
  }

  return [...pids]
}

function listListeningPids(port: number): number[] {
  if (process.platform === "win32") {
    const netstat = spawnSync("netstat", ["-ano", "-p", "TCP"], {
      encoding: "utf8",
      windowsHide: true,
    })
    const pids = new Set<number>()
    const lineRe = new RegExp(`[:\\[]${port}(?:\\]|\\s).*(?:LISTENING|侦听)\\s+(\\d+)\\s*$`, "i")

    for (const line of (netstat.stdout ?? "").split(/\r?\n/)) {
      const match = line.match(lineRe)
      const pid = Number(match?.[1])

      if (Number.isSafeInteger(pid) && pid > 0) pids.add(pid)
    }

    return [...pids]
  }

  const lsof = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
  })
  return parsePids(lsof.stdout)
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
    process.kill(-pid, "SIGTERM")
  } catch {
    try {
      process.kill(pid, "SIGTERM")
    } catch {
      // 外部：kill 目标已退出时抛 ESRCH
    }
  }
}

export function killPortListeners(port: number = viteDevPort()): void {
  for (const pid of listListeningPids(port)) {
    if (pid === process.pid) continue
    killPidTree(pid)
  }
}

// 外部：Windows 上 child.kill() 只杀直接子进程，pnpm 下的 vite 会变孤儿
export function killVite(child: ChildProcess): void {
  const pid = child.pid

  if (pid !== undefined) killPidTree(pid)
  killPortListeners()
}

export function isVitePortFree(
  port: number,
  list: (port: number) => number[] = listListeningPids,
): boolean {
  return list(port).length === 0
}

export function assertVitePortFree(
  port: number,
  list: (port: number) => number[] = listListeningPids,
): void {
  const pids = list(port)

  if (pids.length) {
    throw new Error(
      `Vite 端口 ${port} 已被占用（PID ${pids.join(", ")}），可能已有桌面实例在运行。请先关闭旧窗口，或用 --port 换一个端口。`,
    )
  }
}

export async function waitForHttp(
  url: string,
  timeoutMs = 60_000,
  child?: Pick<ChildProcess, "exitCode" | "signalCode">,
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new Error(
        `Vite 提前退出（code=${child.exitCode ?? "null"}），请检查端口占用或启动日志。`,
      )
    }

    try {
      const response = await fetch(url)

      if (response.ok) return
    } catch {}

    if (Date.now() >= deadline) throw new Error("Vite 开发服务未就绪")
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}
