import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { fileURLToPath } from "node:url"

import { viteDevPort } from "./urls.js"

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url))

/** CSI / OSC 等 ANSI。Electron 在 Windows 上通常没开 VT，ESC 会显示成 ←[32m。 */
const ANSI_RE = /\u001B\[[\d;?]*[ -/]*[@-~]|\u001B\][^\u0007]*(?:\u0007|\u001B\\)|\u001B[@-Z\\-_]/g

/**
 * Electron 是 GUI 子系统：stdio inherit 会把 Vite 的 UTF-8 字节按系统代码页（中文 GBK）解读，
 * `\r` 也不会回车。改成字符串写入走 WriteConsoleW，并去掉颜色码。
 */
export function prepareInheritedConsoleChunk(raw: string | Buffer): string {
  const text = typeof raw === "string" ? raw : raw.toString("utf8")
  return text.replace(ANSI_RE, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function prepareWindowsConsole(): void {
  try {
    spawnSync("chcp.com", ["65001"], { stdio: "ignore", windowsHide: true })
  } catch {
    // 字符串写入仍走宽字符 API
  }
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

/** Electron 的 process.execPath 是 electron 本体，必须用 pnpm 注入的 Node。 */
export function nodeExecutable(env: NodeJS.ProcessEnv = process.env): string {
  const node = env.npm_node_execpath

  if (!node) throw new Error("未找到 Node 可执行文件（缺少 npm_node_execpath）")
  return node
}

export function pnpmExecutable(env: NodeJS.ProcessEnv = process.env): string {
  const pnpm = env.npm_execpath

  if (!pnpm) throw new Error("未找到 pnpm 可执行文件（缺少 npm_execpath）")
  return pnpm
}

export function spawnVite(env: { GATEWAY_TARGET: string }): ChildProcess {
  const node = nodeExecutable()
  const pnpm = pnpmExecutable()

  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  childEnv.GATEWAY_TARGET = env.GATEWAY_TARGET

  const windows = process.platform === "win32"

  const port = viteDevPort()

  const child = spawn(
    node,
    [pnpm, "--filter", "@pig/web", "dev", "--port", String(port), "--strictPort"],
    {
      cwd: REPO_ROOT,
      env: childEnv,
      stdio: windows ? ["ignore", "pipe", "pipe"] : "inherit",
      // 非 Windows 用独立进程组，便于整树终止
      detached: !windows,
    },
  )

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
      // 已退出
    }
  }
}

/** Electron 被 SIGINT 打死之后，Vite 会脱离进程树，只能按端口补刀。 */
export function killPortListeners(port: number = viteDevPort()): void {
  for (const pid of listListeningPids(port)) {
    if (pid === process.pid) continue
    killPidTree(pid)
  }
}

/** Windows 上 child.kill() 只杀直接子进程，pnpm 下的 vite 会变孤儿，必须杀整棵树。 */
export function killVite(child: ChildProcess): void {
  const pid = child.pid

  if (pid !== undefined) killPidTree(pid)
  killPortListeners()
}

export async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    try {
      await fetch(url)
      return
    } catch {
      // 尚未监听
    }

    if (Date.now() >= deadline) throw new Error("Vite 开发服务未就绪")
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}
