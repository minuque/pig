import { existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { run } from "../scripts/run.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const webRoot = join(root, "apps/web")
const distEntry = join(webRoot, "dist/index.html")
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

  run("pnpm", ["build:web"], { cwd: root })
}
