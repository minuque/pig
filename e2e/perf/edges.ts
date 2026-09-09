import { expect, type Page, type Route, type WebSocketRoute } from "@playwright/test"

import {
  ClientMessageDecoder,
  ServerMessageDecoder,
  encodeClientMessage,
  encodeServerMessage,
  type SessionSnapshot,
  type TranscriptItem,
} from "@earendil-works/pi-protocol"
import { join } from "node:path"

import type { BenchHarness } from "./harness.js"
import {
  HISTORY_ROUTE,
  WORKBENCH_TIMEOUT_MS,
  captureBenchFailure,
  composerInput,
  nextPaint,
  openSession,
  clickSessionCard,
  waitForLatestInViewport,
  waitForSession,
  waitForWorkbench,
} from "./measure.js"
import {
  EMPTY_SESSION_NAME,
  LONG_SESSION_ID,
  LONG_SESSION_NAME,
  SHORT_SESSION_ID,
  SHORT_SESSION_NAME,
  SHORT_TURNS,
} from "./seed.js"

const FIRST_PROMPT = "基准首条提问"
const FIRST_TOKEN = "基准首 token"
const STREAM_ITEM_ID = "bench-turn"
const STOP_TURN = "停止当前 Turn"

type Bridge = Awaited<ReturnType<typeof installBridge>>

function asBytes(data: Buffer | ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

/** 卡住长会话历史后立刻切短会话，量最终就绪。 */
async function rapidSwitch(page: Page) {
  await openSession(page, EMPTY_SESSION_NAME)
  let received = 0
  let delivered = 0
  let release = () => {}
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  const delayed = async (route: Route) => {
    if (new URL(route.request().url()).searchParams.get("sessionId") !== LONG_SESSION_ID)
      return route.continue()
    const response = await route.fetch()
    received += 1
    await blocked
    try {
      await route.fulfill({ response })
      delivered += 1
    } catch {
      delivered += 1
    }
  }
  await page.route(HISTORY_ROUTE, delayed)
  try {
    await clickSessionCard(page, LONG_SESSION_NAME)
    await expect.poll(() => received, { message: "连切场景必须捕获旧历史请求" }).toBeGreaterThan(0)
    const started = performance.now()
    await clickSessionCard(page, SHORT_SESSION_NAME)
    await waitForSession(page, SHORT_SESSION_NAME)
    await nextPaint(page)
    const elapsed = performance.now() - started
    release()
    await expect.poll(() => delivered).toBe(received)
    await nextPaint(page)
    await expect(page).toHaveURL(new RegExp(`/sessions/${SHORT_SESSION_ID}$`))
    await expect(page.locator(".row-user")).toHaveCount(SHORT_TURNS)
    await expect(page.getByText(`${LONG_SESSION_NAME} 提问 1`, { exact: true })).toHaveCount(0)
    return elapsed
  } finally {
    release()
    await page.unroute(HISTORY_ROUTE, delayed)
  }
}

async function installBridge(page: Page) {
  let socket: WebSocketRoute | undefined
  let upstream: WebSocketRoute | undefined
  let connections = 0
  let promptSessionId: string | undefined
  let resolvePrompt: ((id: string) => void) | undefined
  const snapshots = new Map<string, SessionSnapshot>()
  await page.routeWebSocket("**/api/v1/pi", (route) => {
    socket = route
    upstream = route.connectToServer()
    connections += 1
    const serverDecoder = new ServerMessageDecoder()
    const clientDecoder = new ClientMessageDecoder()
    const send = (message: Parameters<typeof encodeServerMessage>[0]) => {
      if (!socket) throw new Error("基准 WebSocket 尚未建立")
      socket.send(Buffer.from(encodeServerMessage(message)))
    }
    const reply = (id: string, command: "prompt" | "abort", session: SessionSnapshot) => {
      send({ type: "response", id, ok: true, result: { command, session } })
    }
    const patch = (sessionId: string, phase: "turn" | "idle") => {
      const current = snapshots.get(sessionId)
      if (!current) throw new Error(`基准缺少 SessionSnapshot ${sessionId}`)
      const next = { ...current, phase, revision: current.revision + 1 }
      snapshots.set(sessionId, next)
      return next
    }
    upstream.onMessage((data) => {
      if (typeof data === "string") throw new Error("基准收到非二进制协议消息")
      for (const message of serverDecoder.push(asBytes(data))) {
        if (message.type === "event" && message.event.type === "session_snapshot")
          snapshots.set(message.event.snapshot.id, message.event.snapshot)
        if (message.type === "response" && message.ok && "session" in message.result)
          snapshots.set(message.result.session.id, message.result.session)
      }
      route.send(data)
    })
    route.onMessage((data) => {
      if (typeof data === "string") throw new Error("基准收到非二进制协议消息")
      if (!upstream) throw new Error("基准 WebSocket 尚未连接上游")
      for (const message of clientDecoder.push(asBytes(data))) {
        if (message.type === "request" && message.request.command === "prompt") {
          const sessionId = message.request.sessionId
          const session = patch(sessionId, "turn")
          const userItem = {
            id: "bench-user",
            role: "user" as const,
            content: [{ type: "text" as const, text: message.request.text }],
            timestamp: Date.now(),
          }
          session.transcript = [...session.transcript, userItem]
          send({
            type: "event",
            event: {
              type: "session_progress",
              sessionId,
              progress: { type: "item_started", item: userItem },
            },
          })
          send({ type: "event", event: { type: "session_snapshot", snapshot: session } })
          reply(message.id, "prompt", session)
          promptSessionId = sessionId
          resolvePrompt?.(sessionId)
          continue
        }
        if (message.type === "request" && message.request.command === "abort") {
          const sessionId = message.request.sessionId
          const session = patch(sessionId, "idle")
          send({
            type: "event",
            event: {
              type: "session_progress",
              sessionId,
              progress: {
                type: "item_finished",
                item: {
                  id: STREAM_ITEM_ID,
                  role: "assistant",
                  content: [{ type: "text", text: FIRST_TOKEN }],
                  model: session.model,
                  timestamp: 1_700_000_000_000,
                  status: "aborted",
                  stopReason: "aborted",
                },
              },
            },
          })
          send({ type: "event", event: { type: "session_snapshot", snapshot: session } })
          reply(message.id, "abort", session)
          continue
        }
        upstream.send(Buffer.from(encodeClientMessage(message)))
      }
    })
  })
  return {
    snapshots,
    connections: () => connections,
    send(message: Parameters<typeof encodeServerMessage>[0]) {
      if (!socket) throw new Error("基准 WebSocket 尚未建立")
      socket.send(Buffer.from(encodeServerMessage(message)))
    },
    waitForPrompt() {
      if (promptSessionId) return Promise.resolve(promptSessionId)
      return new Promise<string>((resolve) => {
        resolvePrompt = resolve
      })
    },
    async disconnect() {
      snapshots.clear()
      await Promise.all([socket?.close({ code: 1011, reason: "基准断线" }), upstream?.close()])
    },
  }
}

function assistantItem(
  snapshot: SessionSnapshot,
  text: string,
): Extract<TranscriptItem, { role: "assistant"; status: "streaming" }> {
  return {
    id: STREAM_ITEM_ID,
    role: "assistant",
    content: [{ type: "text", text }],
    model: snapshot.model,
    timestamp: 1_700_000_000_000,
    status: "streaming",
  }
}

/** 欢迎页发送：用户句进时间线就停表；路由落地只给后续回合夹具。 */
async function measureTurn(page: Page, bridge: Bridge) {
  const send = page.locator("button.send")
  const stop = page.getByRole("button", { name: STOP_TURN, exact: true })
  const seen = (text: string, exact = true) =>
    expect(page.getByText(text, { exact })).toBeVisible({ timeout: WORKBENCH_TIMEOUT_MS })
  await composerInput(page).fill(FIRST_PROMPT)
  await expect(send).toBeEnabled()
  const started = performance.now()
  await send.click()
  await expect(page.locator(".row-user").getByText(FIRST_PROMPT, { exact: true })).toBeVisible({
    timeout: WORKBENCH_TIMEOUT_MS,
  })
  const ownMessageMs = performance.now() - started
  await page.waitForURL(/\/sessions\/[^/?#]+$/)
  const sessionId = await bridge.waitForPrompt()
  const snapshot = bridge.snapshots.get(sessionId)
  if (!snapshot) throw new Error("回合场景缺少真实 SessionSnapshot")
  const emit = (
    type: "item_started" | "item_updated",
    item: Extract<TranscriptItem, { role: "assistant"; status: "streaming" }>,
  ) => {
    if (type === "item_started") {
      bridge.send({
        type: "event",
        event: { type: "session_progress", sessionId, progress: { type, item } },
      })
      return
    }
    bridge.send({
      type: "event",
      event: { type: "session_progress", sessionId, progress: { type, item } },
    })
  }
  emit("item_started", assistantItem(snapshot, FIRST_TOKEN))
  await seen(FIRST_TOKEN)
  const firstTokenMs = performance.now() - started
  await expect(stop).toBeVisible()
  const lags: number[] = []
  for (let index = 1; index <= 6; index += 1) {
    const marker = `流式跟上 ${index}`
    const chunkStarted = performance.now()
    emit("item_updated", assistantItem(snapshot, `${marker}\n${"增量。".repeat(index * 8)}`))
    await seen(marker, false)
    await waitForLatestInViewport(page)
    lags.push(performance.now() - chunkStarted)
  }
  const abortStarted = performance.now()
  await stop.click()
  await expect(stop).toHaveCount(0)
  await seen(FIRST_PROMPT)
  return {
    ownMessageMs,
    firstTokenMs,
    streamKeepUpMs: Math.max(...lags),
    abortMs: performance.now() - abortStarted,
  }
}

/** WebSocket 断线后短会话历史恢复，夹具流式文案不得残留。 */
async function reconnect(page: Page, bridge: Bridge) {
  await openSession(page, EMPTY_SESSION_NAME)
  await openSession(page, SHORT_SESSION_NAME)
  const count = bridge.connections()
  const started = performance.now()
  await bridge.disconnect()
  await expect.poll(() => bridge.connections(), { timeout: 30_000 }).toBeGreaterThan(count)
  await expect.poll(() => bridge.snapshots.has(SHORT_SESSION_ID)).toBe(true)
  await expect(page.getByText("连接失败", { exact: true })).toHaveCount(0)
  await waitForSession(page, SHORT_SESSION_NAME)
  await nextPaint(page)
  const elapsed = performance.now() - started
  await expect(page.getByText(FIRST_TOKEN, { exact: true })).toHaveCount(0)
  await expect(page.locator(".row-assistant")).toHaveCount(SHORT_TURNS)
  return elapsed
}

export type EdgeSample = {
  ownMessageMs: number
  firstTokenMs: number
  streamKeepUpMs: number
  abortMs: number
  rapidSwitchMs: number
  reconnectMs: number
}

export async function runTurnBench(
  harness: BenchHarness,
  runs: number,
  resultDir: string,
): Promise<{ samples: EdgeSample[] }> {
  const samples: EdgeSample[] = []
  for (let index = 0; index < runs; index += 1) {
    console.log(`回合 ${index + 1}/${runs}`)
    const session = await harness.open(false)
    const { page } = session
    try {
      const bridge = await installBridge(page)
      await page.goto(session.origin)
      await waitForWorkbench(page)
      const turn = await measureTurn(page, bridge)
      const rapidSwitchMs = await rapidSwitch(page)
      const reconnectMs = await reconnect(page, bridge)
      samples.push({ ...turn, rapidSwitchMs, reconnectMs })
    } catch (error) {
      await captureBenchFailure(page, join(resultDir, "perf-fail.png"))
      throw error
    } finally {
      await session.close()
    }
  }
  return { samples }
}
