/** 工作台体验基准。用法: pnpm test:bench --runs=3 --skip-build --web --headed --turn-only */
import type { Page } from "@playwright/test"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import Gateway from "../../packages/gateway/src/index.js"
import type { DirectoryPort } from "../../packages/gateway/src/directory.js"
import { canonicalizeWorkspacePath } from "../fixtures.js"
import { runTurnBench } from "./edges.js"
import { createDesktopHarness, createWebHarness, type BenchHarness } from "./harness.js"
import {
  captureBenchFailure,
  keyToNextFrame,
  median,
  openSession,
  p90,
  readPaint,
  scrollSessionList,
  scrollTranscript,
  waitForWorkbench,
} from "./measure.js"
import { reportTable, type MetricRow } from "./report.js"
import { LONG_SESSION_NAME, SHORT_SESSION_NAME, seedBenchSessions } from "./seed.js"

const root = resolve(import.meta.dirname, "../..")
const webRoot = join(root, "apps/web/dist")
const resultPath = join(root, "test-results", "perf.json")
const failShot = join(root, "test-results", "perf-fail.png")

type BenchMetrics = {
  coldToWorkbench: number
  coldFcp: number
  coldLcp: number
  sessionFirstOpen: number
  switchLong: number
  longScrollWorstMs: number
  listScrollWorstMs: number
  switchShortRevisit: number
  composerKeyToFrame: number
  ownMessageMs: number
  firstTokenMs: number
  streamKeepUpMs: number
  abortMs: number
  rapidSwitchMs: number
  reconnectMs: number
}

type Args = {
  runs: number
  skipBuild: boolean
  headed: boolean
  turnOnly: boolean
  web: boolean
}

function parseArgs(argv: string[]): Args {
  let runs = 3
  let skipBuild = false
  let headed = false
  let turnOnly = false
  let web = false
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log("用法: pnpm test:bench --runs=3 --skip-build --web --headed --turn-only")
      console.log("默认桌面端 Electron。--web 用 Playwright Chromium 做对照。")
      process.exit(0)
    }
    if (arg === "--") continue
    if (arg === "--skip-build") skipBuild = true
    else if (arg === "--headed") headed = true
    else if (arg === "--web") web = true
    else if (arg === "--turn-only" || arg === "--edges-only") turnOnly = true
    else if (arg.startsWith("--runs=")) {
      const value = Number(arg.slice("--runs=".length))
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("--runs 必须是正安全整数")
      runs = value
    } else throw new Error(`未知参数 ${arg}`)
  }
  return { runs, skipBuild, headed, turnOnly, web }
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

async function openReadyPage(harness: BenchHarness, observers: boolean) {
  const started = performance.now()
  const session = await harness.open(observers)
  try {
    await session.page.goto(session.origin, { waitUntil: "commit" })
    await waitForWorkbench(session.page)
    return { ...session, coldTo: performance.now() - started }
  } catch (error) {
    await captureBenchFailure(session.page, failShot)
    await session.close()
    throw error
  }
}

async function measureStart(page: Page) {
  return readPaint(page)
}

async function measureComposer(page: Page, samples: number): Promise<number> {
  const values: number[] = []
  for (let index = 0; index < samples + 1; index += 1) {
    const ms = await keyToNextFrame(page)
    if (index > 0) values.push(ms)
  }
  return median(values)
}

function collect(values: number[]) {
  return { median: median(values), p90: p90(values) }
}

function printReport(
  now: Partial<BenchMetrics>,
  p90s: Partial<Record<keyof BenchMetrics, number | undefined>>,
  prev: Partial<BenchMetrics> | undefined,
  runtime: string,
) {
  console.log(`\npig 工作台（${runtime}）`)
  console.log("中位；p90 为 90% 样本上限（3 轮时接近最慢一次）。变快为绿，变慢超过 10% 为红。")
  console.log("滚动卡顿为滚动期间最差动画帧。")
  const row = (label: string, key: keyof BenchMetrics): MetricRow => ({
    label,
    value: now[key] ?? null,
    p90: p90s[key] ?? null,
    previous: prev?.[key] ?? null,
  })
  reportTable([
    row("打开工作台", "coldToWorkbench"),
    row("冷启动 FCP", "coldFcp"),
    row("就绪时 LCP", "coldLcp"),
    row("输入跟手", "composerKeyToFrame"),
    row("短会话打开", "sessionFirstOpen"),
    row("长会话打开", "switchLong"),
    row("长会话滚动卡顿", "longScrollWorstMs"),
    row("侧栏列表滚动卡顿", "listScrollWorstMs"),
    row("切回短会话", "switchShortRevisit"),
    row("发送后自己的话", "ownMessageMs"),
    row("发送后首条助手", "firstTokenMs"),
    row("流式跟上", "streamKeepUpMs"),
    row("点停止", "abortMs"),
    row("连切到短会话", "rapidSwitchMs"),
    row("断线后恢复", "reconnectMs"),
  ])
}

async function loadPrevious(
  config: object,
  metrics: BenchMetrics,
): Promise<Partial<BenchMetrics> | undefined> {
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
  let harness: BenchHarness | undefined
  try {
    const workspaceDir = join(temp, "workspace")
    const sessionDir = join(temp, "sessions")
    await mkdir(workspaceDir)
    await mkdir(sessionDir)
    await writeFile(join(workspaceDir, ".keep"), "")
    seedBenchSessions(sessionDir, workspaceDir)
    const workspaceId = canonicalizeWorkspacePath(workspaceDir)

    let origin = ""
    if (args.web) {
      const started = await startGateway(workspaceDir, sessionDir)
      gateway = started.gateway
      origin = started.origin
      console.log(`Gateway ${origin}`)
      harness = await createWebHarness({ headed: args.headed, origin, workspaceId })
    } else {
      if (args.headed) console.log("桌面端基准始终开窗，--headed 只对 --web 生效")
      harness = await createDesktopHarness({ workspaceId, workspaceDir, sessionDir })
    }
    if (!harness) throw new Error("未创建基准运行时")
    const open = {
      coldTo: [] as number[],
      coldFcp: [] as number[],
      coldLcp: [] as number[],
      firstOpen: [] as number[],
      switchLong: [] as number[],
      scroll: [] as number[],
      listScroll: [] as number[],
      switchRevisit: [] as number[],
      composer: [] as number[],
    }

    if (!args.turnOnly) {
      const warmup = await openReadyPage(harness, true)
      await warmup.close()
      for (let run = 1; run <= args.runs; run += 1) {
        console.log(`打开 ${run}/${args.runs}`)
        const session = await openReadyPage(harness, true)
        const { page } = session
        try {
          const cold = await measureStart(page)
          open.coldTo.push(session.coldTo)
          open.coldFcp.push(cold.fcp)
          open.coldLcp.push(cold.lcp)
          open.composer.push(await measureComposer(page, 7))
          open.listScroll.push(await scrollSessionList(page))
          open.firstOpen.push(await openSession(page, SHORT_SESSION_NAME))
          open.switchLong.push(await openSession(page, LONG_SESSION_NAME))
          open.scroll.push(await scrollTranscript(page, LONG_SESSION_NAME))
          open.switchRevisit.push(await openSession(page, SHORT_SESSION_NAME))
        } catch (error) {
          await captureBenchFailure(page, failShot)
          throw error
        } finally {
          await session.close()
        }
      }
    }

    const turns = await runTurnBench(harness, args.runs, join(root, "test-results"))
    const own = turns.samples.map((sample) => sample.ownMessageMs)
    const token = turns.samples.map((sample) => sample.firstTokenMs)
    const stream = turns.samples.map((sample) => sample.streamKeepUpMs)
    const abort = turns.samples.map((sample) => sample.abortMs)
    const rapid = turns.samples.map((sample) => sample.rapidSwitchMs)
    const reconnect = turns.samples.map((sample) => sample.reconnectMs)

    const cold = open.coldTo.length ? collect(open.coldTo) : undefined
    const fcp = open.coldFcp.length ? collect(open.coldFcp) : undefined
    const lcp = open.coldLcp.length ? collect(open.coldLcp) : undefined
    const composer = open.composer.length ? collect(open.composer) : undefined
    const firstOpen = open.firstOpen.length ? collect(open.firstOpen) : undefined
    const switchLong = open.switchLong.length ? collect(open.switchLong) : undefined
    const scroll = open.scroll.length ? collect(open.scroll) : undefined
    const listScroll = open.listScroll.length ? collect(open.listScroll) : undefined
    const switchRevisit = open.switchRevisit.length ? collect(open.switchRevisit) : undefined
    const ownStat = collect(own)
    const tokenStat = collect(token)
    const streamStat = collect(stream)
    const abortStat = collect(abort)
    const rapidStat = collect(rapid)
    const reconnectStat = collect(reconnect)

    const metrics: BenchMetrics = {
      coldToWorkbench: cold?.median ?? Number.NaN,
      coldFcp: fcp?.median ?? Number.NaN,
      coldLcp: lcp?.median ?? Number.NaN,
      sessionFirstOpen: firstOpen?.median ?? Number.NaN,
      switchLong: switchLong?.median ?? Number.NaN,
      longScrollWorstMs: scroll?.median ?? Number.NaN,
      listScrollWorstMs: listScroll?.median ?? Number.NaN,
      switchShortRevisit: switchRevisit?.median ?? Number.NaN,
      composerKeyToFrame: composer?.median ?? Number.NaN,
      ownMessageMs: ownStat.median,
      firstTokenMs: tokenStat.median,
      streamKeepUpMs: streamStat.median,
      abortMs: abortStat.median,
      rapidSwitchMs: rapidStat.median,
      reconnectMs: reconnectStat.median,
    }
    const p90s: Partial<Record<keyof BenchMetrics, number | undefined>> = {
      coldToWorkbench: cold?.p90,
      coldFcp: fcp?.p90,
      coldLcp: lcp?.p90,
      sessionFirstOpen: firstOpen?.p90,
      switchLong: switchLong?.p90,
      longScrollWorstMs: scroll?.p90,
      listScrollWorstMs: listScroll?.p90,
      switchShortRevisit: switchRevisit?.p90,
      composerKeyToFrame: composer?.p90,
      ownMessageMs: ownStat.p90,
      firstTokenMs: tokenStat.p90,
      streamKeepUpMs: streamStat.p90,
      abortMs: abortStat.p90,
      rapidSwitchMs: rapidStat.p90,
      reconnectMs: reconnectStat.p90,
    }

    const config = {
      version: 11,
      runs: args.runs,
      headed: args.headed,
      turnOnly: args.turnOnly,
      web: args.web,
      runtime: harness.runtime,
      browser: harness.runtimeLabel,
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    }
    const stored = Object.fromEntries(
      Object.entries(metrics).filter(([, value]) => Number.isFinite(value)),
    ) as Partial<BenchMetrics>
    const comparable = args.turnOnly ? undefined : await loadPrevious(config, metrics)
    await mkdir(join(root, "test-results"), { recursive: true })
    await writeFile(
      resultPath,
      `${JSON.stringify({ config, metrics: stored, p90s, samples: { ...open, own, token, stream, abort, rapid, reconnect } }, null, 2)}\n`,
    )
    printReport(stored, p90s, comparable, harness.runtimeLabel)
    console.log(`结果已写入 ${resultPath}`)
  } finally {
    try {
      await harness?.close()
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
  if (message.includes("electron.launch") || message.includes("Electron failed")) {
    console.error("未启动 Electron。请先运行: pnpm --filter @pig/desktop exec electron --version")
  }
  process.exitCode = 1
}
