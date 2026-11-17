/** 工作台核心体验基准。用法: pnpm test:bench --runs=3 --skip-build --web --headed --no-fail */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import Gateway from "../../packages/gateway/src/index.js"
import { run } from "../../scripts/run.mjs"
import type { DirectoryPort } from "../../packages/gateway/src/system/directory.js"
import { createBenchRuntime, createFauxScript } from "../support/faux-runtime.js"
import { canonicalizeWorkspacePath } from "../support/fixtures.js"
import { GATEWAY_COUNTS, measureGatewayRound } from "./gateway.js"
import { createDesktopHarness, createWebHarness, type BenchHarness } from "./harness.js"
import {
  captureBenchFailure,
  keyToNextFrame,
  median,
  openSession,
  p90,
  scrollSessionList,
  scrollTranscript,
  waitForWorkbench,
} from "./measure.js"
import { measureParallel } from "./parallel.js"
import { measureRefetch, prepareRefetch, type RefetchContext } from "./refetch.js"
import { regressionsSoFar, reportTable, type MetricRow } from "./report.js"
import { LONG_SESSION_NAME, SHORT_SESSION_NAME, seedBenchSessions } from "./seed.js"
import { runTurn } from "./turn.js"

const GW = "并行（网关）"
/** 只量用户直接感知的几项；frame=true 的值是最长帧。 */
const METRICS = [
  { key: "coldToWorkbench", label: "打开工作台", group: "启动" },
  { key: "switchLong", label: "长会话打开", group: "会话" },
  { key: "switchShortRevisit", label: "切回短会话", group: "会话" },
  { key: "longScrollWorstMs", label: "长会话滚动", group: "滚动", frame: true },
  { key: "listScrollWorstMs", label: "侧栏列表滚动", group: "滚动", frame: true },
  { key: "composerKeyToFrame", label: "输入跟手", group: "输入与流式" },
  { key: "firstTokenMs", label: "发送后首条助手", group: "输入与流式" },
  { key: "streamKeepUpMs", label: "流式跟上", group: "输入与流式" },
  { key: "splitTypeWhileStream", label: "分屏：右侧流式时左侧输入", group: "并行（界面）" },
  {
    key: "splitDualStreamWorstFrame",
    label: "分屏：两侧同时流式",
    group: "并行（界面）",
    frame: true,
  },
  { key: "splitStreamKeepUp", label: "分屏：两侧流式时左侧跟上", group: "并行（界面）" },
  { key: "bgTypeWhileStream", label: "4 个后台流式时输入", group: "并行（界面）" },
  ...GATEWAY_COUNTS.flatMap((n) => [
    { key: `gwLoopP99_${n}` as const, label: `事件循环 p99（${n} 会话）`, group: GW },
    {
      key: `gwLoopBusy_${n}` as const,
      label: `事件循环占用（${n} 会话）`,
      group: GW,
      unit: "percent" as const,
    },
    { key: `gwFirstProgress_${n}` as const, label: `首帧推送（${n} 会话）`, group: GW },
    { key: `gwProgressGapP99_${n}` as const, label: `推送间隔 p99（${n} 会话）`, group: GW },
  ]),
  { key: "gwHeapPerSession", label: "每会话 JS 堆", group: GW, unit: "bytes" },
  { key: "gwTranscriptMs", label: "长会话全文历史", group: GW },
  { key: "gwTranscriptBytes", label: "长会话全文历史大小", group: GW, unit: "bytes" },
  // 仅 --web：桌面端网关在 Electron 里，注入不了替身供应商
  { key: "turnRefetchCount", label: "一回合历史重拉", group: GW, unit: "count" },
  { key: "turnRefetchBytes", label: "一回合历史重拉字节", group: GW, unit: "bytes" },
] as const satisfies readonly {
  key: string
  label: string
  group: string
  frame?: true
  unit?: MetricRow["unit"]
}[]
/** 离线可选的本地模型：回合由桥接模拟，不会真的发请求。 */
const BENCH_MODELS = {
  providers: {
    local: {
      baseUrl: "http://127.0.0.1:9/v1",
      api: "openai-completions",
      apiKey: "bench",
      models: [{ id: "bench-model" }],
    },
  },
}

type MetricKey = (typeof METRICS)[number]["key"]

type Samples = Record<MetricKey, number[]>

type Args = { runs: number; skipBuild: boolean; headed: boolean; web: boolean }

const root = resolve(import.meta.dirname, "../..")
const webRoot = join(root, "apps/web/dist")
const resultPath = join(root, "test-results", "perf.json")
const failShot = join(root, "test-results", "perf-fail.png")

function parseArgs(argv: string[]): Args {
  const args: Args = { runs: 3, skipBuild: false, headed: false, web: false }

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log("用法: pnpm test:bench --runs=3 --skip-build --web --headed --no-fail")
      console.log(
        "默认桌面端 Electron；--web 用 Playwright Chromium。比上次慢 10% 以上退出码为 1。",
      )
      process.exit(0)
    }

    if (arg === "--skip-build") args.skipBuild = true
    else if (arg === "--headed") args.headed = true
    else if (arg === "--web") args.web = true
    else if (arg === "--no-fail") continue
    else if (arg.startsWith("--runs=")) {
      const value = Number(arg.slice("--runs=".length))

      if (!Number.isSafeInteger(value) || value < 1) throw new Error("--runs 必须是正安全整数")
      args.runs = value
    } else throw new Error(`未知参数 ${arg}`)
  }

  return args
}

async function startGateway(workspaceDir: string, sessionDir: string) {
  const platformPort: DirectoryPort = {
    selectDirectory: async () => workspaceDir,
    validateDirectory: async (path) => path,
  }
  // 与缺省同参的 runtime；替身供应商等界面场景跑完才挂上，前面的数不受影响
  const runtime = await createBenchRuntime()
  const gateway = new Gateway({
    webRoot,
    sessionDir,
    cwd: workspaceDir,
    platformPort,
    port: 0,
    createRuntime: async () => runtime,
  })

  try {
    const port = await gateway.start()
    return { gateway, runtime, origin: gateway.authenticatedUrl(`http://127.0.0.1:${port}`) }
  } catch (error) {
    await gateway.stop()
    throw error
  }
}

/** 输入跟手：丢掉首次（字体与布局预热），取其后七次的中位数。 */
async function composerLatency(page: Parameters<typeof keyToNextFrame>[0]) {
  const values: number[] = []

  for (let index = 0; index < 8; index += 1) {
    const ms = await keyToNextFrame(page)

    if (index > 0) values.push(ms)
  }

  return median(values)
}

/** 一轮：冷启动 → 侧栏滚动 → 打开长会话 → 滚动 → 切回短会话；再开新实例量回合。 */
async function measureRound(harness: BenchHarness, samples: Samples) {
  const session = await harness.open()

  try {
    const { page } = session
    const started = performance.now()
    await page.goto(session.origin, { waitUntil: "commit" })
    await waitForWorkbench(page)
    samples.coldToWorkbench.push(performance.now() - started)
    samples.composerKeyToFrame.push(await composerLatency(page))
    samples.listScrollWorstMs.push(await scrollSessionList(page))
    await openSession(page, SHORT_SESSION_NAME)
    samples.switchLong.push(await openSession(page, LONG_SESSION_NAME))
    samples.longScrollWorstMs.push(await scrollTranscript(page, LONG_SESSION_NAME))
    samples.switchShortRevisit.push(await openSession(page, SHORT_SESSION_NAME))
  } catch (error) {
    await captureBenchFailure(session.page, failShot)
    throw error
  } finally {
    await session.close()
  }

  // 回合用全新实例，避免上一段的会话状态压进建会话路径
  const turn = await harness.open()

  try {
    const result = await runTurn(turn.page, turn.origin)
    samples.firstTokenMs.push(result.firstTokenMs)
    samples.streamKeepUpMs.push(result.streamKeepUpMs)
  } catch (error) {
    await captureBenchFailure(turn.page, failShot)
    throw error
  } finally {
    await turn.close()
  }

  await measureParallel(harness, samples, failShot)
}

/** 4.1：每轮一个新实例，在长会话种子的分叉上跑真实回合。 */
async function measureRefetchRounds(
  harness: BenchHarness,
  context: RefetchContext,
  runs: number,
  samples: Samples,
) {
  await prepareRefetch(context)

  for (let round = 1; round <= runs; round += 1) {
    console.log(`重拉第 ${round}/${runs} 轮`)
    const session = await harness.open()

    try {
      const result = await measureRefetch(session, context, round)
      samples.turnRefetchCount.push(result.count)
      samples.turnRefetchBytes.push(result.bytes)
    } catch (error) {
      await captureBenchFailure(session.page, failShot)
      throw error
    } finally {
      await session.close()
    }
  }
}

/** 同口径（版本、运行时、平台）的上次结果才拿来比较。 */
async function loadPrevious(config: object): Promise<Partial<Record<MetricKey, number>>> {
  try {
    const raw = JSON.parse(await readFile(resultPath, "utf8")) as {
      config?: unknown
      metrics?: Partial<Record<MetricKey, number>>
    }
    return JSON.stringify(raw.config) === JSON.stringify(config) ? (raw.metrics ?? {}) : {}
  } catch {
    return {}
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.skipBuild) run("pnpm", ["build:web"], { cwd: root })

  const temp = await mkdtemp(join(tmpdir(), "pig-bench-"))
  let gateway: Gateway | undefined
  let harness: BenchHarness | undefined
  let refetch: RefetchContext | undefined

  try {
    const workspaceDir = join(temp, "workspace")
    const sessionDir = join(temp, "sessions")
    await mkdir(workspaceDir)
    await mkdir(sessionDir)
    // 隔离本机 ~/.pi：用户扩展不进基准，web 与桌面子进程都读这个变量
    const agentDir = (process.env.PI_CODING_AGENT_DIR = join(temp, "agent"))
    await mkdir(agentDir)
    await writeFile(join(agentDir, "models.json"), JSON.stringify(BENCH_MODELS))
    await writeFile(join(workspaceDir, ".keep"), "")
    seedBenchSessions(sessionDir, workspaceDir)
    const workspaceId = canonicalizeWorkspacePath(workspaceDir)
    const samples = Object.fromEntries(METRICS.map(({ key }) => [key, []])) as unknown as Samples

    // 网关层先跑：纯 Node，不开浏览器
    for (let round = 1; round <= args.runs; round += 1) {
      console.log(`网关第 ${round}/${args.runs} 轮`)

      for (const [key, value] of Object.entries(await measureGatewayRound(temp)))
        samples[key as MetricKey].push(value)
    }

    if (args.web) {
      const started = await startGateway(workspaceDir, sessionDir)
      gateway = started.gateway
      const script = createFauxScript()
      refetch = {
        sessionDir,
        workspaceDir,
        script,
        install: () => started.runtime.registerNativeProvider(script.provider),
      }
      harness = await createWebHarness({ headed: args.headed, origin: started.origin, workspaceId })
    } else {
      harness = await createDesktopHarness({ workspaceId, workspaceDir, sessionDir })
    }

    // 预热一轮不计入：首次冷启动含磁盘与编译缓存
    const warmup = await harness.open()
    await warmup.page.goto(warmup.origin, { waitUntil: "commit" })
    await waitForWorkbench(warmup.page)
    await warmup.close()

    for (let round = 1; round <= args.runs; round += 1) {
      console.log(`第 ${round}/${args.runs} 轮`)
      await measureRound(harness, samples)
    }

    if (refetch) await measureRefetchRounds(harness, refetch, args.runs, samples)

    const config = {
      version: 22,
      runs: args.runs,
      runtime: harness.runtime,
      browser: harness.runtimeLabel,
      platform: process.platform,
      arch: process.arch,
    }
    // 桌面模式没有重拉样本，留空
    const pick = (stat: (values: number[]) => number) =>
      Object.fromEntries(
        METRICS.map(({ key }) => [key, samples[key].length ? stat(samples[key]) : null]),
      )
    const metrics = pick(median)
    const p90s = pick(p90)
    const previous = await loadPrevious(config)

    await mkdir(join(root, "test-results"), { recursive: true })
    await writeFile(resultPath, `${JSON.stringify({ config, metrics, p90s, samples }, null, 2)}\n`)
    console.log(`\npig 工作台（${harness.runtimeLabel}）`)
    reportTable(
      METRICS.map((metric) => ({
        label: metric.label,
        group: metric.group,
        value: metrics[metric.key] ?? null,
        p90: p90s[metric.key] ?? null,
        previous: previous[metric.key] ?? null,
        frame: "frame" in metric,
        ...("unit" in metric ? { unit: metric.unit } : {}),
      })),
    )
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
  const slow = regressionsSoFar()

  if (slow.length && !process.argv.includes("--no-fail")) {
    console.error(`\n${slow.length} 项比上次慢 10% 以上：${slow.join("、")}`)
    console.error("确认是有意取舍就加 --no-fail；上次结果在 test-results/perf.json")
    process.exitCode = 1
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)

  if (message.includes("Executable doesn't exist") || message.includes("browserType.launch"))
    console.error("未找到 Chromium。请先运行: pnpm exec playwright install chromium")

  if (message.includes("electron.launch") || message.includes("Electron failed"))
    console.error("未启动 Electron。请先运行: pnpm rebuild electron")

  process.exitCode = 1
}
