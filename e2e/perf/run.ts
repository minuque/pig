/** 工作台性能基准。用法: pnpm test:bench --runs=3 --skip-build --headed */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import Gateway from "../../packages/gateway/src/index.js"
import type { DirectoryPort } from "../../packages/gateway/src/directory.js"
import {
  inpValue,
  installObservers,
  keyToNextFrame,
  median,
  openSession,
  readInpSamples,
  readLongTasks,
  readPaint,
  scrollTranscript,
  seedWorkspace,
  totalBlockingTime,
  waitForWorkbench,
} from "./measure.js"
import {
  EMPTY_SESSION_NAME,
  STRESS_SESSION_NAME,
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
  coldTbt: number
  hotToWorkbench: number
  sessionFirstOpen: number
  eventTimingP98: number | null
  emptyOpen: number
  stressOpen: number
  stressComposer: number
  stressScrollLongTasks: number
  stressScrollWorstMs: number
  composerKeyToFrame: number
  switchShortFirst: number
  switchLong: number
  switchShortRevisit: number
  longScrollLongTasks: number
  longScrollWorstMs: number
}

type Args = { runs: number; skipBuild: boolean; headed: boolean }

function parseArgs(argv: string[]): Args {
  let runs = 3
  let skipBuild = false
  let headed = false
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log("用法: pnpm test:bench --runs=3 --skip-build --headed")
      process.exit(0)
    }
    if (arg === "--") continue
    if (arg === "--skip-build") skipBuild = true
    else if (arg === "--headed") headed = true
    else if (arg.startsWith("--runs=")) {
      const value = Number(arg.slice("--runs=".length))
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("--runs 必须是正安全整数")
      runs = value
    } else throw new Error(`未知参数 ${arg}`)
  }
  return { runs, skipBuild, headed }
}

function canonicalizeWorkspacePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "")
  return /^[A-Z]:/.test(normalized)
    ? normalized[0]!.toLowerCase() + normalized.slice(1)
    : normalized
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "zh-CN",
    colorScheme: "light",
    serviceWorkers: "block",
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: "reduce" })
  await seedWorkspace(page, workspaceId)
  await installObservers(page)
  page.setDefaultTimeout(30_000)
  try {
    await page.goto(origin, { waitUntil: "commit" })
    await waitForWorkbench(page)
  } catch (error) {
    await mkdir(join(root, "test-results"), { recursive: true })
    await page.screenshot({ path: failShot }).catch(() => undefined)
    await context.close()
    throw error
  }
  return { context, page }
}

async function measureStart(page: Page) {
  const paint = await readPaint(page)
  const tasks = await readLongTasks(page)
  return {
    toWorkbench: paint.now,
    fcp: paint.fcp,
    lcp: paint.lcp,
    tbt: totalBlockingTime(tasks, paint.fcp, paint.now),
  }
}

async function measureComposer(page: Page, samples: number): Promise<number> {
  const values: number[] = []
  for (let index = 0; index < samples + 1; index += 1) {
    const ms = await keyToNextFrame(page)
    if (index > 0) values.push(ms)
  }
  return median(values)
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "n/a"
  if (ms < 10 && Math.abs(ms - Math.round(ms)) >= 0.05) return `${ms.toFixed(1)} ms`
  return `${Math.round(ms)} ms`
}

function deltaText(now: number, prev: number | undefined): string {
  if (prev === undefined || !Number.isFinite(prev) || prev === 0) return ""
  const diff = now - prev
  const ratio = Math.abs(diff / prev)
  if (Math.abs(diff) < 1 || ratio < 0.02) return "（未变）"
  const pct = (ratio * 100).toFixed(0)
  return diff < 0
    ? `（${Math.round(diff)}ms，快 ${pct}%）`
    : `（+${Math.round(diff)}ms，慢 ${pct}%）`
}

function line(label: string, now: number, prev?: number): string {
  return `• ${label}：${formatMs(now)}${deltaText(now, prev)}`
}

function printReport(now: BenchMetrics, prev: BenchMetrics | undefined) {
  console.log("")
  console.log("pig 工作台性能")
  console.log("Gateway 已启动；冷启动 = 新浏览器上下文。reduced-motion。中位数。")
  console.log("")
  console.log("启动")
  console.log(line("冷启动到工作台", now.coldToWorkbench, prev?.coldToWorkbench))
  console.log(line("工作台就绪时 LCP 候选值", now.coldLcp, prev?.coldLcp))
  console.log(line("冷启动 FCP", now.coldFcp, prev?.coldFcp))
  console.log(line("到工作台的总阻塞时间", now.coldTbt, prev?.coldTbt))
  console.log(line("热重启到工作台", now.hotToWorkbench, prev?.hotToWorkbench))
  console.log("")
  console.log("交互")
  console.log(line("侧栏会话首次打开", now.sessionFirstOpen, prev?.sessionFirstOpen))
  const inp = now.eventTimingP98 === null ? "无样本" : formatMs(now.eventTimingP98)
  const inpDelta =
    now.eventTimingP98 === null || prev?.eventTimingP98 == null
      ? ""
      : deltaText(now.eventTimingP98, prev.eventTimingP98)
  console.log(`• Event Timing 样本 p98（非完整 INP）：${inp}${inpDelta}`)
  console.log(line("Composer 按键到双 rAF", now.composerKeyToFrame, prev?.composerKeyToFrame))
  console.log(
    `• 会话切换：${formatMs(now.switchShortFirst)} 短会话首次，${formatMs(now.switchLong)} 长会话，${formatMs(now.switchShortRevisit)} 重访`,
  )
  const scroll =
    now.longScrollLongTasks === 0
      ? "零长任务"
      : `${now.longScrollLongTasks} 个长任务，最差 ${formatMs(now.longScrollWorstMs)}`
  console.log(`• 长 Transcript 滚动：${scroll}`)
  console.log(line("空会话打开", now.emptyOpen, prev?.emptyOpen))
  console.log(line("200 轮混合会话打开", now.stressOpen, prev?.stressOpen))
  console.log(line("混合会话 Composer 按键到双 rAF", now.stressComposer, prev?.stressComposer))
  console.log(
    `• 混合会话滚动：${now.stressScrollLongTasks} 个长任务，最差 ${formatMs(now.stressScrollWorstMs)}`,
  )
  console.log("")
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
      if (key === "eventTimingP98" && value === null) continue
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
    const warmup = await openPage(browser, origin, workspaceId)
    await warmup.context.close()

    const coldTo: number[] = []
    const coldLcp: number[] = []
    const coldFcp: number[] = []
    const coldTbt: number[] = []
    const hotTo: number[] = []
    const firstOpen: number[] = []
    const switchLong: number[] = []
    const switchRevisit: number[] = []
    const composer: number[] = []
    const scrollCounts: number[] = []
    const scrollWorst: number[] = []
    const inpSamples: number[] = []
    const emptyOpen: number[] = []
    const stressOpen: number[] = []
    const stressComposer: number[] = []
    const stressScrollCounts: number[] = []
    const stressScrollWorst: number[] = []

    for (let run = 1; run <= args.runs; run += 1) {
      console.log(`测量 ${run}/${args.runs}`)
      const { context, page } = await openPage(browser, origin, workspaceId)
      try {
        const cold = await measureStart(page)
        coldTo.push(cold.toWorkbench)
        coldLcp.push(cold.lcp)
        coldFcp.push(cold.fcp)
        coldTbt.push(cold.tbt)

        await page.reload({ waitUntil: "commit" })
        await waitForWorkbench(page)
        hotTo.push((await measureStart(page)).toWorkbench)

        composer.push(await measureComposer(page, 7))

        const opened = await openSession(page, SHORT_SESSION_NAME)
        firstOpen.push(opened)
        switchLong.push(await openSession(page, LONG_SESSION_NAME))
        switchRevisit.push(await openSession(page, SHORT_SESSION_NAME))
        await openSession(page, LONG_SESSION_NAME)
        const scrolled = await scrollTranscript(page)
        scrollCounts.push(scrolled.count)
        scrollWorst.push(scrolled.worst)
        emptyOpen.push(await openSession(page, EMPTY_SESSION_NAME))
        stressOpen.push(await openSession(page, STRESS_SESSION_NAME))
        stressComposer.push(await measureComposer(page, 7))
        const stressScrolled = await scrollTranscript(page)
        stressScrollCounts.push(stressScrolled.count)
        stressScrollWorst.push(stressScrolled.worst)
        const eventInp = await readInpSamples(page)
        const eventP98 = inpValue(eventInp)
        if (eventP98 !== null) inpSamples.push(eventP98)
      } catch (error) {
        await mkdir(join(root, "test-results"), { recursive: true })
        await page.screenshot({ path: failShot }).catch(() => undefined)
        throw error
      } finally {
        await context.close()
      }
    }

    const metrics: BenchMetrics = {
      coldToWorkbench: median(coldTo),
      coldLcp: median(coldLcp),
      coldFcp: median(coldFcp),
      coldTbt: median(coldTbt),
      hotToWorkbench: median(hotTo),
      sessionFirstOpen: median(firstOpen),
      eventTimingP98: inpSamples.length ? median(inpSamples) : null,
      emptyOpen: median(emptyOpen),
      stressOpen: median(stressOpen),
      stressComposer: median(stressComposer),
      stressScrollLongTasks: Math.round(median(stressScrollCounts)),
      stressScrollWorstMs: median(stressScrollWorst),
      composerKeyToFrame: median(composer),
      switchShortFirst: median(firstOpen),
      switchLong: median(switchLong),
      switchShortRevisit: median(switchRevisit),
      longScrollLongTasks: Math.round(median(scrollCounts)),
      longScrollWorstMs: median(scrollWorst),
    }

    const config = {
      version: 2,
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
      `${JSON.stringify({ config, metrics, samples: { coldTo, coldLcp, coldFcp, coldTbt, hotTo, firstOpen, switchLong, switchRevisit, composer, scrollCounts, scrollWorst, inpSamples, emptyOpen, stressOpen, stressComposer, stressScrollCounts, stressScrollWorst } }, null, 2)}\n`,
    )
    printReport(metrics, previous)
    console.log(`结果已写入 ${resultPath}`)
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
