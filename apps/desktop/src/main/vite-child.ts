import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { viteDevPort } from "./urls.js"

const WEB_ROOT = fileURLToPath(new URL("../../../../apps/web/", import.meta.url))
const webRequire = createRequire(join(WEB_ROOT, "package.json"))
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

/** web 包的 Vite 入口：Vite 的 exports 不包含 bin，只能先解析 package.json 再拼。 */
export function viteBin(): string {
  return join(dirname(webRequire.resolve("vite/package.json")), "bin", "vite.js")
}

export type ViteLaunch = { command: string; args: string[]; env: NodeJS.ProcessEnv }

/**
 * 启动 web dev server 的命令。用调用方自己的 Node 跑：
 * Electron 里 process.execPath 是本体，靠 ELECTRON_RUN_AS_NODE 当 Node 用；纯 Node 下不加这个变量。
 * 因此不依赖启动器注入的 npm_execpath / npm_node_execpath，直接双击或 IDE 启动也能跑。
 */
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
  })
  const windows = process.platform === "win32"
  const child = spawn(launch.command, launch.args, {
    cwd: WEB_ROOT,
    env: launch.env,
    stdio: windows ? ["ignore", "pipe", "pipe"] : "inherit",
    // 非 Windows 用独立进程组，便于整树终止
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

/** 端口空着才轮得到本实例收尾时按端口清理；否则那可能是别人的 Vite。 */
export function isVitePortFree(
  port: number,
  list: (port: number) => number[] = listListeningPids,
): boolean {
  return list(port).length === 0
}

/** 端口必须先空着：占用中的端口多半是另一个实例的 Vite，借来用会被对方退出时连坐。 */
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

/** 等到 Vite 真的能给出 200；子进程先退出就立刻报错，别空等超时。 */
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
    } catch {
      // 尚未监听
    }

    if (Date.now() >= deadline) throw new Error("Vite 开发服务未就绪")
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}
