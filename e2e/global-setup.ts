import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const webRoot = join(root, "apps/web")
const distEntry = join(webRoot, "dist/index.html")

/** 构建入口：pnpm run 里有 npm_execpath，直接跑 playwright 时回落到 PATH 上的 pnpm。 */
function pnpmCommand() {
  const execPath = process.env.npm_execpath

  // pnpm 12 起是可执行文件，11 及以前是 JS 入口，要经 node 启动
  if (execPath && /\.[cm]?js$/.test(execPath))
    return { command: process.execPath, args: [execPath, "build:web"] }

  if (execPath) return { command: execPath, args: ["build:web"] }
  return {
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args: ["build:web"],
  }
}

/** 参与 web 构建的输入；任一文件比 dist 新就得重建。 */
const INPUTS = ["src", "public", "index.html", "vite.config.ts", "package.json"]

function newestMtime(path: string): number {
  if (!existsSync(path)) return 0
  const stat = statSync(path)

  if (!stat.isDirectory()) return stat.mtimeMs

  let newest = 0

  for (const entry of readdirSync(path, { withFileTypes: true })) {
    newest = Math.max(newest, newestMtime(join(path, entry.name)))
  }

  return newest
}

function distIsFresh(): boolean {
  if (!existsSync(distEntry)) return false
  const builtAt = statSync(distEntry).mtimeMs
  return builtAt > Math.max(...INPUTS.map((name) => newestMtime(join(webRoot, name))))
}

export default function globalSetup() {
  // 重跑单个用例时不值得重建
  if (process.env.PIG_E2E_SKIP_BUILD) return

  if (distIsFresh()) {
    console.log("apps/web/dist 比源文件新，跳过 build:web")
    return
  }

  const { command, args } = pnpmCommand()
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" })

  if (result.error || result.status !== 0)
    throw new Error("pnpm build:web 失败", { cause: result.error })
}
