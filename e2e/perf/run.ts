/** 工作台性能基准。用法: pnpm test:bench --runs=3 --skip-build --headed */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import Gateway from "../../packages/gateway/src/index.js"
import type { DirectoryPort } from "../../packages/gateway/src/directory.js"
import { canonicalizeWorkspacePath } from "../fixtures.js"
import { runEdgeBench } from "./edges.js"
import {
  captureBenchFailure,
  firstSample,
  keyToNextFrame,
  median,
  newBenchContext,
  openSession,
  p90,
  prepareBenchPage,
  readPaint,
  scrollTranscript,
  waitForWorkbench,
} from "./measure.js"
import { reportTable } from "./report.js"
import {
  EMPTY_SESSION_NAME,
  LONG_SESSION_NAME,
  SHORT_SESSION_NAME,
  seedBenchSessions,
} from "./seed.js"

const root = resolve(import.meta.dirname, "../..")
const webRoot = join(root, "apps/web/dist")
const resultPath = join(root, "test-results", "perf.json")
const failShot = join(root, "test-results", "perf-fail.png")

type BenchMetrics = {
  coldToWorkbench: number
  coldLcp: number
  coldFcp: number
  sessionFirstOpen: number
  sessionFirstOpenFirst: number
  sessionFirstOpenP90: number
  emptyOpen: number
  composerKeyToFrame: number
  switchLong: number
  switchLongFirst: number
  switchLongP90: number
  switchShortRevisit: number
  longScrollWorstMs: number
}

type Args = { runs: number; skipBuild: boolean; headed: boolean; edgesOnly: boolean }

function parseArgs(argv: string[]): Args {
  let runs = 3
  let skipBuild = false
  let headed = false
  let edgesOnly = false
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log("用法: pnpm test:bench --runs=3 --skip-build --headed --edges-only")
      process.exit(0)
    }
    if (arg === "--") continue
    if (arg === "--skip-build") skipBuild = true
    else if (arg === "--headed") headed = true
    else if (arg === "--edges-only") edgesOnly = true
    else if (arg.startsWith("--runs=")) {
      const value = Number(arg.slice("--runs=".length))
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("--runs 必须是正安全整数")
      runs = value
    } else throw new Error(`未知参数 ${arg}`)
  }
  return { runs, skipBuild, headed, edgesOnly }
}

function buildWeb() {
  const pnpm = process.env.npm_execpath
  if (!pnpm) throw new Error("未找到 pnpm，请用 pnpm test:bench 运行")
  console.log("构建 web…")
  const result = spawnSync(process.execPath, [pnpm, "build"], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  })
  if (result.error || result.status !== 0)
    throw new Error("pnpm build 失败", { cause: result.error })
}

async function startGateway(workspaceDir: string, sessionDir: string) {
  const platformPort: DirectoryPort = {
    async selectDirectory() {
      return workspaceDir
    },
    async validateDirectory(path) {
      return path
    },
  }
  const gateway = new Gateway({
    webRoot,
    sessionDir,
    cwd: workspaceDir,
    platformPort,
    port: 0,
  })
  try {
    const port = await gateway.start()
    return { gateway, origin: `http://127.0.0.1:${port}` }
  } catch (error) {
    await gateway.stop()
    throw error
  }
}

async function openPage(
  browser: Browser,
  origin: string,
  workspaceId: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newBenchContext(browser)
  const page = await context.newPage()
  await prepareBenchPage(page, workspaceId, true)
  try {
    await page.goto(origin, { waitUntil: "commit" })
    await waitForWorkbench(page)
  } catch (error) {
    await captureBenchFailure(page, failShot)
    await context.close()
    throw error
  }
  return { context, page }
}

/** 冷启动到工作台可用，并采集 FCP / LCP。 */
async function measureStart(page: Page) {
  const paint = await readPaint(page)
  return { toWorkbench: paint.now, fcp: paint.fcp, lcp: paint.lcp }
}

/** 按键到双 rAF，丢弃首次后取中位数。 */
async function measureComposer(page: Page, samples: number): Promise<number> {
  const values: number[] = []
  for (let index = 0; index < samples + 1; index += 1) {
    const ms = await keyToNextFrame(page)
    if (index > 0) values.push(ms)
  }
  return median(values)
}

function printReport(now: BenchMetrics, prev: BenchMetrics | undefined) {
  console.log("\npig 工作台性能")
  console.log("Gateway 已启动；冷启动 = 新浏览器上下文。reduced-motion。中位数。")
  const row = (label: string, key: keyof BenchMetrics, unit: "ms" | "个" = "ms") => ({
    label,
    value: now[key],
    previous: prev?.[key] ?? null,
    unit,
  })
  reportTable("启动", [
    row("冷启动到工作台", "coldToWorkbench"),
    row("就绪时 LCP 候选值", "coldLcp"),
    row("冷启动 FCP", "coldFcp"),
  ])
  reportTable("会话打开与切换", [
    row("短会话首次", "sessionFirstOpen"),
    row("50 轮会话", "switchLong"),
    row("短会话重访", "switchShortRevisit"),
    row("空会话", "emptyOpen"),
  ])
  reportTable("会话打开（首轮 / p90）", [
    row("短会话首次 首轮", "sessionFirstOpenFirst"),
    row("短会话首次 p90", "sessionFirstOpenP90"),
    row("50 轮会话 首轮", "switchLongFirst"),
    row("50 轮会话 p90", "switchLongP90"),
  ])
  reportTable("输入响应", [row("欢迎页按键到双 rAF", "composerKeyToFrame")])
  reportTable("滚动卡顿", [row("50 轮会话最差耗时", "longScrollWorstMs")])
}

async function loadPrevious(
  config: object,
  metrics: BenchMetrics,
): Promise<BenchMetrics | undefined> {
  try {
    const raw = JSON.parse(await readFile(resultPath, "utf8")) as unknown
    if (!raw || typeof raw !== "object" || !("config" in raw) || !("metrics" in raw))
      return undefined
    if (JSON.stringify(raw.config) !== JSON.stringify(config)) return undefined
    const previous = raw.metrics
    if (!previous || typeof previous !== "object") return undefined
    for (const key of Object.keys(metrics)) {
      const value: unknown = Reflect.get(previous, key)
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined
    }
    return previous as BenchMetrics
  } catch {
    return undefined
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.skipBuild) buildWeb()

  const temp = await mkdtemp(join(tmpdir(), "pig-bench-"))
  let gateway: Gateway | undefined
  let browser: Browser | undefined
  try {
    const workspaceDir = join(temp, "workspace")
    const sessionDir = join(temp, "sessions")
    await mkdir(workspaceDir)
    await mkdir(sessionDir)
    await writeFile(join(workspaceDir, ".keep"), "")
    seedBenchSessions(sessionDir, workspaceDir)
    const workspaceId = canonicalizeWorkspacePath(workspaceDir)

    const started = await startGateway(workspaceDir, sessionDir)
    gateway = started.gateway
    const { origin } = started
    console.log(`Gateway ${origin}`)

    browser = await chromium.launch({ headless: !args.headed })
    if (args.edgesOnly) {
      await runEdgeBench(browser, origin, workspaceId, args.runs, join(root, "test-results"))
      return
    }
    const warmup = await openPage(browser, origin, workspaceId)
    await warmup.context.close()

    const coldTo: number[] = []
    const coldLcp: number[] = []
    const coldFcp: number[] = []
    const firstOpen: number[] = []
    const switchLong: number[] = []
    const switchRevisit: number[] = []
    const composer: number[] = []
    const scrollWorst: number[] = []
    const emptyOpen: number[] = []

    for (let run = 1; run <= args.runs; run += 1) {
      console.log(`测量 ${run}/${args.runs}`)
      const { context, page } = await openPage(browser, origin, workspaceId)
      try {
        const cold = await measureStart(page)
        coldTo.push(cold.toWorkbench)
        coldLcp.push(cold.lcp)
        coldFcp.push(cold.fcp)

        composer.push(await measureComposer(page, 7))

        firstOpen.push(await openSession(page, SHORT_SESSION_NAME))
        switchLong.push(await openSession(page, LONG_SESSION_NAME))
        switchRevisit.push(await openSession(page, SHORT_SESSION_NAME))
        await openSession(page, LONG_SESSION_NAME)
        scrollWorst.push(await scrollTranscript(page))
        emptyOpen.push(await openSession(page, EMPTY_SESSION_NAME))
      } catch (error) {
        await captureBenchFailure(page, failShot)
        throw error
      } finally {
        await context.close()
      }
    }

    const metrics: BenchMetrics = {
      coldToWorkbench: median(coldTo),
      coldLcp: median(coldLcp),
      coldFcp: median(coldFcp),
      sessionFirstOpen: median(firstOpen),
      sessionFirstOpenFirst: firstSample(firstOpen),
      sessionFirstOpenP90: p90(firstOpen),
      emptyOpen: median(emptyOpen),
      composerKeyToFrame: median(composer),
      switchLong: median(switchLong),
      switchLongFirst: firstSample(switchLong),
      switchLongP90: p90(switchLong),
      switchShortRevisit: median(switchRevisit),
      longScrollWorstMs: median(scrollWorst),
    }

    const config = {
      version: 7,
      runs: args.runs,
      headed: args.headed,
      browser: browser.version(),
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    }
    const previous = await loadPrevious(config, metrics)
    await mkdir(join(root, "test-results"), { recursive: true })
    await writeFile(
      resultPath,
      `${JSON.stringify({ config, metrics, samples: { coldTo, coldLcp, coldFcp, firstOpen, switchLong, switchRevisit, composer, scrollWorst, emptyOpen } }, null, 2)}\n`,
    )
    printReport(metrics, previous)
    console.log(`结果已写入 ${resultPath}`)
    await runEdgeBench(browser, origin, workspaceId, args.runs, join(root, "test-results"))
  } finally {
    try {
      await browser?.close()
    } finally {
      try {
        await gateway?.stop()
      } finally {
        await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
      }
    }
  }
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  if (message.includes("Executable doesn't exist") || message.includes("browserType.launch")) {
    console.error("未找到 Chromium。请先运行: pnpm exec playwright install chromium")
  }
  process.exitCode = 1
}
