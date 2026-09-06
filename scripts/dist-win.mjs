import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { cp, mkdir, readFile, realpath, rm } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const root = resolve(import.meta.dirname, "..")
const desktop = join(root, "apps/desktop")
const gateway = join(root, "packages/gateway")
const injectedGateway = join(desktop, "node_modules/@pig/gateway")
const webRoot = join(root, "apps/web/dist")

const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "inherit",
  })
  if (result.status) throw new Error(`${command} failed`)
}

if (process.platform !== "win32") {
  throw new Error("pnpm dist:win 只支持在 Windows 上打 NSIS 安装包")
}

/** Windows 上 pnpm injected 在重建 dist 后会留下旧文件，asar 必须用刚编出来的那份。 */
async function syncInjectedGateway() {
  if (!existsSync(injectedGateway)) {
    throw new Error("未找到注入的 @pig/gateway，请先在仓库根目录执行 pnpm install")
  }
  const srcRoot = await realpath(gateway)
  const destRoot = await realpath(injectedGateway)
  const destDist = join(destRoot, "dist")
  if (srcRoot !== destRoot) {
    await rm(destDist, { recursive: true, force: true })
    await cp(join(srcRoot, "dist"), destDist, { recursive: true })
  }
  if (existsSync(join(destDist, "auth"))) {
    throw new Error("注入的 @pig/gateway 仍含 dist/auth，asar 会打进过期鉴权")
  }
}

/** 对即将打进安装包的 Gateway 做握手：401 或升级失败即中止打包。 */
async function assertDesktopGatewaySurface() {
  if (!existsSync(join(webRoot, "index.html"))) {
    throw new Error("缺少 apps/web/dist，无法写入 extraResources")
  }
  const { default: Gateway } = await import(
    pathToFileURL(join(injectedGateway, "dist/index.js")).href
  )
  const instance = new Gateway({ webRoot, port: 0 })
  const port = await instance.start()
  const origin = `http://127.0.0.1:${port}`

  try {
    const health = await fetch(`${origin}/health`)
    if (!health.ok) throw new Error(`/health ${health.status}`)
    const probe = await fetch(`${origin}/api/v1/platform/context-usage`)
    if (probe.status === 401) throw new Error("注入的 Gateway 仍要求启动认证")
    if (probe.status !== 400) throw new Error(`/api/v1/platform/context-usage ${probe.status}`)
    await new Promise((resolveOpen, reject) => {
      const socket = new WebSocket(`${origin.replace(/^http/, "ws")}/api/v1/pi`)
      const timer = setTimeout(() => {
        socket.close()
        reject(new Error("WebSocket 升级超时"))
      }, 8_000)
      socket.addEventListener("open", () => {
        clearTimeout(timer)
        socket.close()
        resolveOpen()
      })
      socket.addEventListener("error", () => {
        clearTimeout(timer)
        reject(new Error("WebSocket 升级失败"))
      })
    })
  } finally {
    await instance.stop()
  }
}

const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"))

run("pnpm", ["--filter", "@pig/gateway", "build"])
await syncInjectedGateway()
await assertDesktopGatewaySurface()
run("pnpm", ["exec", "tsc", "-p", "tsconfig.main.json"], desktop)

await mkdir(join(desktop, "out/preload"), { recursive: true })
await cp(join(desktop, "src/preload/index.js"), join(desktop, "out/preload/index.js"))

run(
  "pnpm",
  [
    "exec",
    "electron-builder",
    "--win",
    "--x64",
    "--publish",
    "never",
    `-c.extraMetadata.version=${version}`,
  ],
  desktop,
)
