import { spawn } from "child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import Gateway from "../packages/gateway/src/index.js"

// 外部：Git Bash (MSYS) 不把 Ctrl+C 转给 Windows 原生子进程链，要用 winpty 重新启动自己
const WRAPPED = "NPNG_DEV_WINPTY"

if (process.env.MSYSTEM && !process.env[WRAPPED] && process.stdin.isTTY) {
  const startedAt = Date.now()
  const winpty = spawn("winpty", [process.execPath, ...process.argv.slice(1)], {
    env: { ...process.env, [WRAPPED]: "1" },
    stdio: "inherit",
  })

  winpty.on("error", () => {
    console.warn("[dev] 未找到 winpty,Ctrl+C 可能无法停止进程。")
    void main()
  })
  winpty.on("exit", (code) => {
    if (code && Date.now() - startedAt < 2000) {
      console.warn("[dev] winpty 启动失败,改用直接运行,Ctrl+C 可能无法停止。")
      void main()
    } else {
      process.exit(code ?? 0)
    }
  })
} else {
  void main()
}

async function main() {
  const gateway = new Gateway()
  const port = await gateway.start()
  const gatewayOrigin = `http://127.0.0.1:${port}`
  const webPort = process.env.PIG_VITE_PORT ?? "5555"
  console.info(`[dev] http://127.0.0.1:${webPort}`)
  console.info(`[dev] ${gateway.authenticatedUrl(gatewayOrigin)}`)

  // 外部：Vite 的 exports 不含 bin，先解析 package.json 再拼
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web")
  const webRequire = createRequire(join(webRoot, "package.json"))
  const viteBin = join(dirname(webRequire.resolve("vite/package.json")), "bin", "vite.js")
  const web = spawn(process.execPath, [viteBin, "--port", webPort], {
    cwd: webRoot,
    env: {
      ...process.env,
      GATEWAY_TARGET: gatewayOrigin,
      GATEWAY_TOKEN: gateway.launchToken,
    },
    stdio: "inherit",
    detached: process.platform !== "win32",
  })
  let stopping = false

  // 外部：Windows 上 kill() 只杀直接子进程，pnpm 下的 vite 会变孤儿
  function killTree(pid: number) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" })
    } else {
      try {
        process.kill(-pid, "SIGTERM")
      } catch {}
    }
  }

  async function stop(exitCode = 0) {
    if (stopping) return
    stopping = true
    killTree(web.pid ?? -1)
    await gateway.stop()
    process.exitCode = exitCode
  }

  web.once("error", () => void stop(1))
  web.once("exit", (code) => void stop(code ?? 0))
  process.once("SIGINT", () => void stop())
  process.once("SIGTERM", () => void stop())
}
