import { spawn } from "child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import Gateway from "../packages/gateway/src/index.js"

// Git Bash (MSYS) 不会把 Ctrl+C 转发给 Windows 原生子进程链,信号到不了这里。
// 解法:用 winpty 重新启动自己,winpty 把 Ctrl+C 转成真实 console 信号,即可正常停止。
const WRAPPED = "NPNG_DEV_WINPTY"

// mintty 下 node 的 stdin 是 tty;管道/CI 环境不是,winpty 需要 tty,只有交互终端才包装
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
  // 启动即失败(非零)时回退到直接运行,避免 dev 起不来
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

  // 直接用本进程的 Node 跑 Vite：不向启动器要 npm_execpath，pnpm / npx / IDE 直跑都一样。
  // Vite 的 exports 不包含 bin，先解析 package.json 再拼。
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
    // 非 Windows 用独立进程组,便于整树终止(见 killTree)
    detached: process.platform !== "win32",
  })
  let stopping = false

  // Windows 上 web.kill() 只杀直接子进程,pnpm 下的 vite 会变孤儿,必须杀整棵树
  function killTree(pid: number) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" })
    } else {
      try {
        process.kill(-pid, "SIGTERM")
      } catch {
        // 已退出
      }
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
