#!/usr/bin/env node
/** 新 worktree 初始化：装依赖 → 构建 gateway → 补齐 electron path.txt → 校验并提示下一步。 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const target = resolve(process.argv[2] ?? repoRoot)

/** 优先用 pnpm 自身的入口（pnpm run 里 npm_execpath 才有值）。 */
function pnpm(args) {
  const exec = process.env.npm_execpath

  if (!exec) return spawnSync("pnpm", args, { cwd: target, stdio: "inherit", shell: true })
  return spawnSync(process.execPath, [exec, ...args], { cwd: target, stdio: "inherit" })
}

function step(name, args) {
  console.log(`\n== ${name} ==`)
  const result = pnpm(args)

  if (result.error || result.status !== 0) {
    console.error(`失败: pnpm ${args.join(" ")}`)
    process.exit(1)
  }
}

function electronDir() {
  const dir = join(target, "node_modules", ".pnpm")

  if (!existsSync(dir)) return undefined
  const name = readdirSync(dir).find((entry) => /^electron@\d/.test(entry))
  return name ? join(dir, name, "node_modules", "electron") : undefined
}

function platformExecutable() {
  if (process.platform === "win32") return "electron.exe"

  if (process.platform === "darwin") return "Electron.app/Contents/MacOS/Electron"
  return "electron"
}

/** electron 的 path.txt 由 postinstall 生成，跳过构建脚本时缺失会让 require('electron') 现下载。 */
function ensureElectron() {
  const dir = electronDir()

  if (!dir) {
    console.warn("未找到 electron 包，跳过")
    return false
  }

  const pathFile = join(dir, "path.txt")
  const executable = platformExecutable()

  if (existsSync(pathFile) && readFileSync(pathFile, "utf-8").trim().length > 0) {
    console.log(`electron path.txt 已就绪：${readFileSync(pathFile, "utf-8").trim()}`)
    return true
  }

  if (!existsSync(join(dir, "dist", executable))) {
    console.warn(
      "electron dist 缺失，需下载：pnpm rebuild electron 或 node node_modules/.../electron/install.js",
    )
    return false
  }

  writeFileSync(pathFile, executable)
  console.log(`已补写 electron path.txt：${executable}`)
  return true
}

function verify() {
  const checks = [
    ["gateway 构建产物", existsSync(join(target, "packages/gateway/dist/cli.js"))],
    ["desktop bin 链接", existsSync(join(target, "apps/desktop/node_modules/.bin/pig"))],
    ["electron 可执行文件", existsSync(join(electronDir() ?? "", "dist", platformExecutable()))],
  ]

  console.log("\n== 校验 ==")

  for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`)

  if (!checks[1][1])
    console.log("  bin 缺失只影响命令行调用 pig，desktop 与 bench 走 @pig/gateway，可忽略")

  if (checks.every(([, ok]) => ok) || (checks[0][1] && checks[2][1]))
    console.log("\n下一步：pnpm test:bench 或 pnpm test:e2e e2e/<spec>")
}

console.log(`初始化 worktree：${target}`)

step("安装依赖", ["install", "--frozen-lockfile"])

step("构建 gateway", ["--filter", "@pig/gateway", "build"])

console.log("\n== electron ==")

ensureElectron()

verify()
