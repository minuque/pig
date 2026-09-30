import { _electron as electron, chromium, type Browser, type Page } from "@playwright/test"
import { mkdtemp, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { newBenchContext, prepareBenchPage, WORKBENCH_TIMEOUT_MS } from "./measure.js"

const desktopRoot = join(import.meta.dirname, "../../apps/desktop")
const desktopRequire = createRequire(join(desktopRoot, "package.json"))

function electronExecutable(): string {
  const value: unknown = desktopRequire("electron")

  if (typeof value !== "string" || value.length === 0)
    throw new Error("未解析到 Electron 可执行文件")
  return value
}

function electronPackageVersion(): string {
  const value: unknown = desktopRequire("electron/package.json")

  if (!value || typeof value !== "object" || !("version" in value))
    throw new Error("未读到 Electron 包版本")
  const version: unknown = Reflect.get(value, "version")

  if (typeof version !== "string" || version.length === 0) throw new Error("Electron 包版本无效")
  return version
}

export type BenchRuntime = "desktop" | "web"

export type BenchSession = {
  page: Page
  origin: string
  size(): Promise<{ width: number; height: number }>
  setSize(width: number, height: number): Promise<void>
  close(): Promise<void>
}

export type BenchHarness = {
  runtime: BenchRuntime
  runtimeLabel: string
  open(observers: boolean): Promise<BenchSession>
  close(): Promise<void>
}

const LIVE_DEV_ENV = new Set([
  "ELECTRON_RUN_AS_NODE",
  "PIG_CDP",
  "PIG_VITE_PORT",
  "PIG_GATEWAY_ORIGIN",
  "GATEWAY_TARGET",
  "GATEWAY_TOKEN",
])

function processEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !LIVE_DEV_ENV.has(key)) env[key] = value
  }

  return Object.assign(env, extra)
}

export async function createWebHarness(options: {
  headed: boolean
  origin: string
  workspaceId: string
}): Promise<BenchHarness> {
  const browser: Browser = await chromium.launch({ headless: !options.headed })
  return {
    runtime: "web",
    runtimeLabel: `chromium ${browser.version()}`,
    async open(observers) {
      const context = await newBenchContext(browser)
      const page = await context.newPage()
      await prepareBenchPage(page, options.workspaceId, observers)
      return {
        page,
        origin: options.origin,
        size: async () => page.viewportSize() ?? { width: 1280, height: 800 },
        setSize: async (width, height) => {
          await page.setViewportSize({ width, height })
        },
        async close() {
          await context.close()
        },
      }
    },
    async close() {
      await browser.close()
    },
  }
}

export async function createDesktopHarness(options: {
  workspaceId: string
  workspaceDir: string
  sessionDir: string
}): Promise<BenchHarness> {
  let runtimeLabel = `electron ${electronPackageVersion()}`
  return {
    runtime: "desktop",
    get runtimeLabel() {
      return runtimeLabel
    },
    async open(observers) {
      const userData = await mkdtemp(join(tmpdir(), "pig-bench-user-"))
      const app = await electron.launch({
        executablePath: electronExecutable(),
        args: [".", `--user-data-dir=${userData}`],
        cwd: desktopRoot,
        env: processEnv({
          PIG_BENCH: "1",
          PIG_CDP: "off",
          PIG_SESSION_DIR: options.sessionDir,
          PIG_CWD: options.workspaceDir,
        }),
        colorScheme: "light",
        timeout: 60_000,
      })
      const dispose = async () => {
        try {
          await app.close()
        } finally {
          await rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
        }
      }

      try {
        const page = await app.firstWindow({ timeout: WORKBENCH_TIMEOUT_MS })
        const origin = await app.evaluate(
          (_electron, name) => process.env[name] ?? "",
          "PIG_GATEWAY_ORIGIN",
        )

        if (!origin) throw new Error("桌面端未写出 Gateway 地址")

        const versions = await app.evaluate(() => ({
          electron: String(Reflect.get(process.versions, "electron") ?? ""),
          chrome: String(Reflect.get(process.versions, "chrome") ?? ""),
        }))

        runtimeLabel = `electron ${versions.electron} chromium ${versions.chrome}`
        await prepareBenchPage(page, options.workspaceId, observers, { reducedMotion: false })
        return {
          page,
          origin,
          size: () =>
            app.evaluate(({ BrowserWindow }) => {
              const win = BrowserWindow.getAllWindows()[0]

              if (!win) throw new Error("桌面窗口不存在")
              const [width, height] = win.getSize()
              return { width, height }
            }),
          setSize: async (width, height) => {
            await app.evaluate(
              ({ BrowserWindow }, dims) => {
                BrowserWindow.getAllWindows()[0]?.setSize(dims.width, dims.height)
              },
              { width, height },
            )
          },
          close: dispose,
        }
      } catch (error) {
        await dispose()
        throw error
      }
    },
    async close() {
      return
    },
  }
}
