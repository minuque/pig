import { existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { run } from "../scripts/run.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const webRoot = join(root, "apps/web")
const distEntry = join(webRoot, "dist/index.html")
const INPUTS = [
  "apps/web/src",
  "apps/web/public",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "apps/web/package.json",
  "packages/ui/src",
  "packages/ui/package.json",
  "packages/protocol/src",
]

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
  return builtAt > Math.max(...INPUTS.map((name) => newestMtime(join(root, name))))
}

export default function globalSetup() {
  if (process.env.PIG_E2E_SKIP_BUILD) return

  if (distIsFresh()) {
    console.log("apps/web/dist 比源文件新，跳过 build:web")
    return
  }

  run("pnpm", ["build:web"], { cwd: root })
}
