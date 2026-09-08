import { expect, type Browser, type Page, type Route, type WebSocketRoute } from "@playwright/test"
import {
  ServerMessageDecoder,
  encodeServerMessage,
  type SessionSnapshot,
  type TranscriptItem,
} from "@earendil-works/pi-protocol"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import {
  keyToNextFrame,
  median,
  openSession,
  seedWorkspace,
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

const historyUrl = "**/api/v1/platform/transcript?*"
const card = (page: Page, name: string) =>
  page.locator(".session-card", { has: page.getByText(name, { exact: true }) })

async function nextPaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function rapidSwitch(page: Page) {
  await openSession(page, EMPTY_SESSION_NAME)
  const received = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const delivered = Promise.withResolvers<void>()
  const delayed = async (route: Route) => {
    if (new URL(route.request().url()).searchParams.get("sessionId") !== LONG_SESSION_ID)
      return route.continue()
    const response = await route.fetch()
    received.resolve()
    await release.promise
    await route.fulfill({ response })
    delivered.resolve()
  }
  await page.route(historyUrl, delayed)
  try {
    await card(page, LONG_SESSION_NAME).click()
    await Promise.race([
      received.promise,
      page.waitForTimeout(10_000).then(() => {
        throw new Error("连切场景未捕获长会话历史请求")
      }),
    ])
    const started = performance.now()
    await card(page, SHORT_SESSION_NAME).click()
    await waitForSession(page, SHORT_SESSION_NAME)
    await nextPaint(page)
    const elapsed = performance.now() - started
    release.resolve()
    await delivered.promise
    await nextPaint(page)
    await expect(page).toHaveURL(new RegExp(`/sessions/${SHORT_SESSION_ID}$`))
    await expect(page.locator(".row-user")).toHaveCount(SHORT_TURNS)
    await expect(page.getByText(`${LONG_SESSION_NAME} 提问 1`, { exact: true })).toHaveCount(0)
    return elapsed
  } finally {
    release.resolve()
    await page.unroute(historyUrl, delayed)
  }
}

async function historyRecovery(page: Page) {
  await openSession(page, EMPTY_SESSION_NAME)
  let failures = 0
  const fail = async (route: Route) => {
    if (new URL(route.request().url()).searchParams.get("sessionId") !== SHORT_SESSION_ID)
      return route.continue()
    failures += 1
    await route.fulfill({ status: 503, json: { code: "BENCH_UNAVAILABLE" } })
  }
  await page.route(historyUrl, fail)
  try {
    await card(page, SHORT_SESSION_NAME).click()
    await expect.poll(() => failures).toBeGreaterThan(0)
    await expect(page.locator(".session-loading")).toHaveCount(0)
    await expect(page.locator(".idle-hero")).toBeVisible()
    await expect(page.locator(".row-user")).toHaveCount(0)
    await expect(page.locator(".field[contenteditable]")).toBeVisible()
    await openSession(page, EMPTY_SESSION_NAME)
  } finally {
    await page.unroute(historyUrl, fail)
  }
  const elapsed = await openSession(page, SHORT_SESSION_NAME)
  await expect(page.locator(".row-user")).toHaveCount(SHORT_TURNS)
  return elapsed
}

async function installBridge(page: Page) {
  let socket: WebSocketRoute | undefined
  let upstream: WebSocketRoute | undefined
  let connections = 0
  const snapshots = new Map<string, SessionSnapshot>()
  await page.routeWebSocket("**/api/v1/pi", (route) => {
    socket = route
    upstream = route.connectToServer()
    connections += 1
    const decoder = new ServerMessageDecoder()
    upstream.onMessage((data) => {
      if (typeof data === "string") throw new Error("基准收到非二进制协议消息")
      for (const message of decoder.push(data)) {
        if (message.type === "event" && message.event.type === "session_snapshot")
          snapshots.set(message.event.snapshot.id, message.event.snapshot)
        if (message.type === "response" && message.ok && "session" in message.result)
          snapshots.set(message.result.session.id, message.result.session)
      }
      route.send(data)
    })
  })
  return {
    snapshots,
    connections: () => connections,
    send(message: Parameters<typeof encodeServerMessage>[0]) {
      if (!socket) throw new Error("基准 WebSocket 尚未建立")
      socket.send(Buffer.from(encodeServerMessage(message)))
    },
    async disconnect() {
      snapshots.clear()
      await Promise.all([socket?.close({ code: 1011, reason: "基准断线" }), upstream?.close()])
    },
  }
}

async function stream(page: Page, bridge: Awaited<ReturnType<typeof installBridge>>) {
  const snapshot = bridge.snapshots.get(SHORT_SESSION_ID)
  if (!snapshot) throw new Error("流式场景缺少真实 SessionSnapshot")
  const phase = (value: "turn" | "idle") =>
    bridge.send({
      type: "event",
      event: { type: "session_snapshot", snapshot: { ...snapshot, phase: value } },
    })
  const item = (
    text: string,
  ): Extract<TranscriptItem, { role: "assistant"; status: "streaming" }> => ({
    id: "bench-stream",
    role: "assistant",
    content: [{ type: "text", text }],
    model: snapshot.model,
    timestamp: 1_700_000_000_000,
    status: "streaming",
  })
  phase("turn")
  bridge.send({
    type: "event",
    event: {
      type: "session_progress",
      sessionId: SHORT_SESSION_ID,
      progress: { type: "item_started", item: item("流式基准 0") },
    },
  })
  await expect(page.getByRole("button", { name: "停止当前 Turn", exact: true })).toBeVisible()
  await expect(page.getByText("流式基准 0", { exact: true })).toBeVisible()
  const paints: number[] = []
  const keys: number[] = []
  for (let index = 1; index <= 12; index += 1) {
    const text = `流式基准 ${index}：${"增量内容。".repeat(index * 10)}`
    const started = performance.now()
    bridge.send({
      type: "event",
      event: {
        type: "session_progress",
        sessionId: SHORT_SESSION_ID,
        progress: { type: "item_updated", item: item(text) },
      },
    })
    await expect(page.getByText(text, { exact: true })).toBeVisible()
    await nextPaint(page)
    paints.push(performance.now() - started)
    if (index % 3 === 0) keys.push(await keyToNextFrame(page))
  }
  const finalText = "流式基准完成"
  bridge.send({
    type: "event",
    event: {
      type: "session_progress",
      sessionId: SHORT_SESSION_ID,
      progress: {
        type: "item_finished",
        item: { ...item(finalText), status: "complete", stopReason: "stop" },
      },
    },
  })
  phase("idle")
  await expect(page.getByText(finalText, { exact: true })).toHaveCount(1)
  await expect(page.locator(".row-assistant")).toHaveCount(SHORT_TURNS + 1)
  await expect(page.locator(".row-user")).toHaveCount(SHORT_TURNS)
  await expect(page.getByRole("button", { name: "停止当前 Turn", exact: true })).toHaveCount(0)
  return { streamUpdate: median(paints), streamComposer: median(keys), paints, keys }
}

export async function runEdgeBench(
  browser: Browser,
  origin: string,
  workspaceId: string,
  runs: number,
  resultDir: string,
) {
  const samples = []
  for (let index = 0; index < runs; index += 1) {
    console.log(`边界场景 ${index + 1}/${runs}`)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: "zh-CN",
      colorScheme: "light",
      serviceWorkers: "block",
    })
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)
    try {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await seedWorkspace(page, workspaceId)
      const bridge = await installBridge(page)
      await page.goto(origin)
      await waitForWorkbench(page)
      const rapidSwitchMs = await rapidSwitch(page)
      const historyRecoveryMs = await historyRecovery(page)
      const streamed = await stream(page, bridge)
      const count = bridge.connections()
      const started = performance.now()
      await bridge.disconnect()
      await expect.poll(() => bridge.connections(), { timeout: 30_000 }).toBeGreaterThan(count)
      await expect.poll(() => bridge.snapshots.has(SHORT_SESSION_ID)).toBe(true)
      await waitForSession(page, SHORT_SESSION_NAME)
      await nextPaint(page)
      const reconnectMs = performance.now() - started
      await expect(page.getByText("流式基准完成", { exact: true })).toHaveCount(0)
      await expect(page.locator(".row-assistant")).toHaveCount(SHORT_TURNS)
      samples.push({ rapidSwitchMs, historyRecoveryMs, ...streamed, reconnectMs })
    } catch (error) {
      await mkdir(resultDir, { recursive: true })
      await page.screenshot({ path: join(resultDir, "perf-edges-fail.png") }).catch(() => undefined)
      throw error
    } finally {
      await context.close()
    }
  }
  const metrics = {
    rapidSwitchMs: median(samples.map((sample) => sample.rapidSwitchMs)),
    historyRecoveryMs: median(samples.map((sample) => sample.historyRecoveryMs)),
    streamUpdateMs: median(samples.map((sample) => sample.streamUpdate)),
    streamComposerMs: median(samples.map((sample) => sample.streamComposer)),
    reconnectMs: median(samples.map((sample) => sample.reconnectMs)),
  }
  await mkdir(resultDir, { recursive: true })
  await writeFile(
    join(resultDir, "perf-edges.json"),
    JSON.stringify({ version: 1, runs, browser: browser.version(), metrics, samples }, null, 2) +
      "\n",
  )
  console.log("边界场景通过（流式为协议夹具；耗时包含驱动与断言开销）", metrics)
}
