/** 网关层基准：进程内起真实 Gateway，替身供应商驱动 N 个会话同时跑回合。 */
import type { ServerEvent } from "@pig/protocol"
import { mkdir, mkdtemp } from "node:fs/promises"
import { join } from "node:path"
import { monitorEventLoopDelay, performance } from "node:perf_hooks"
import { runInNewContext } from "node:vm"
import { setFlagsFromString } from "node:v8"

import Gateway from "../../packages/gateway/src/index.js"
import {
  FAUX_MODEL,
  createBenchRuntime,
  createFauxScript,
  writeFauxNotes,
  type FauxScript,
} from "../support/faux-runtime.js"
import { connectGateway } from "./gateway-client.js"
import { quantile } from "./measure.js"
import {
  LONG_SESSION_NAME,
  SHORT_SESSION_NAME,
  seedBenchSessions,
  sessionIdOf,
  type BenchSessionName,
} from "./seed.js"

export const GATEWAY_COUNTS = [1, 2, 4, 8] as const

type Count = (typeof GATEWAY_COUNTS)[number]

export type GatewayKey =
  | `gwLoopP99_${Count}`
  | `gwLoopBusy_${Count}`
  | `gwFirstProgress_${Count}`
  | `gwProgressGapP99_${Count}`
  | "gwHeapPerSession"
  | "gwTranscriptMs"
  | "gwTranscriptBytes"

const HEAP_COUNT = 8

setFlagsFromString("--expose-gc")

/** 量堆前先回收：前几批会话已释放，不让它们的垃圾算进这一批；RSS 在 Windows 上会被系统回收成负数。 */
const collect = runInNewContext("gc") as () => void

type Started = Awaited<ReturnType<typeof startFauxGateway>>

async function startFauxGateway(root: string, script: FauxScript) {
  const workspace = join(root, "workspace")
  const sessionDir = join(root, "sessions")
  await mkdir(workspace)
  await mkdir(sessionDir)
  await writeFauxNotes(workspace)
  seedBenchSessions(sessionDir, workspace)
  const runtime = await createBenchRuntime()
  runtime.registerNativeProvider(script.provider)

  const gateway = new Gateway({
    sessionDir,
    cwd: workspace,
    port: 0,
    createRuntime: async () => runtime,
  })
  const port = await gateway.start()
  return { gateway, port, workspace, authorization: gateway.authorizationHeader() }
}

async function fetchTranscript({ port, authorization }: Started, name: BenchSessionName) {
  const started = performance.now()
  const res = await fetch(
    `http://127.0.0.1:${port}/api/v1/platform/transcript?sessionId=${sessionIdOf(name)}`,
    { headers: { authorization } },
  )

  if (!res.ok) throw new Error(`${name}历史 HTTP ${res.status}`)
  const bytes = (await res.arrayBuffer()).byteLength
  return { ms: performance.now() - started, bytes }
}

/** 长会话全文历史：先读短会话吃掉首个请求的扫盘与懒加载，长会话本身仍是首次读盘。 */
async function transcript(started: Started) {
  await fetchTranscript(started, SHORT_SESSION_NAME)
  return fetchTranscript(started, LONG_SESSION_NAME)
}

type Client = Awaited<ReturnType<typeof connectGateway>>

/** 一条连接（同一个窗口）建 N 个会话，同时发 prompt，等全部回合结束；传入的连接不关，会话留着。 */
async function parallelTurns(
  started: Started,
  script: FauxScript,
  count: number,
  { heap = false, held }: { heap?: boolean; held?: Client } = {},
) {
  const client = held ?? (await connectGateway(started.port, started.authorization))

  try {
    if (heap) collect()
    const heapBefore = process.memoryUsage().heapUsed
    const ids = await Promise.all(
      Array.from({ length: count }, async () => {
        const reply = await client.request({
          command: "create_session",
          cwd: started.workspace,
          model: FAUX_MODEL,
        })

        if (!reply.ok || !("session" in reply.result)) throw new Error("网关基准建会话失败")
        return reply.result.session.id
      }),
    )
    const arrivals = new Map<string, number[]>(ids.map((id) => [id, []]))
    client.onEvent((event: ServerEvent, at) => {
      if (event.type === "session_progress") arrivals.get(event.sessionId)?.push(at)
    })
    script.queue(count)
    const loop = monitorEventLoopDelay({ resolution: 1 })
    loop.enable()
    // Windows 时钟 15.6ms 一档，延迟直方图看不见更短的阻塞，占用率补上这一块
    const busyFrom = performance.eventLoopUtilization()
    const sentAt = performance.now()
    const replies = await Promise.all(
      ids.map((sessionId) => client.request({ command: "prompt", sessionId, message: "读笔记" })),
    )

    loop.disable()
    const busy = performance.eventLoopUtilization(busyFrom).utilization * 100

    for (const reply of replies)
      if (!reply.ok) throw new Error(`网关基准回合失败：${reply.error.message}`)

    const gaps = [...arrivals.values()].flatMap((times) =>
      times.slice(1).map((at, index) => at - (times[index] ?? at)),
    )
    const firsts = [...arrivals.values()].map((times) => (times[0] ?? Infinity) - sentAt)

    if (heap) collect()
    return {
      loopP99: loop.percentile(99) / 1e6,
      busy,
      firstProgress: Math.max(...firsts),
      gapP99: quantile(gaps, 0.99),
      heapPerSession: (process.memoryUsage().heapUsed - heapBefore) / count,
    }
  } finally {
    if (!held) client.close()
  }
}

/** 一轮：新起一个网关，先冷读长会话，预热一回合、量 8 会话的堆，再依次跑 N=1、2、4、8。 */
export async function measureGatewayRound(
  temp: string,
): Promise<Partial<Record<GatewayKey, number>>> {
  const script = createFauxScript()
  const started = await startFauxGateway(await mkdtemp(join(temp, "gw-")), script)
  const result: Partial<Record<GatewayKey, number>> = {}

  try {
    const read = await transcript(started)
    result.gwTranscriptMs = read.ms
    result.gwTranscriptBytes = read.bytes
    // 预热：首个回合含模块与资源加载器的冷启动
    const held = await connectGateway(started.port, started.authorization)
    await parallelTurns(started, script, 1, { held })
    // 量堆要在任何连接关掉之前：关掉的连接里的会话异步释放，会把差值拉成负数
    result.gwHeapPerSession = (
      await parallelTurns(started, script, HEAP_COUNT, { heap: true, held })
    ).heapPerSession
    held.close()

    for (const count of GATEWAY_COUNTS) {
      const run = await parallelTurns(started, script, count)
      result[`gwLoopP99_${count}`] = run.loopP99
      result[`gwLoopBusy_${count}`] = run.busy
      result[`gwFirstProgress_${count}`] = run.firstProgress
      result[`gwProgressGapP99_${count}`] = run.gapP99
    }

    return result
  } finally {
    await started.gateway.stop()
  }
}
