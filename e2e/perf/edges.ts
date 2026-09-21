import { expect, type Page } from "@playwright/test"

import { TRANSCRIPT_PAGE_TURNS } from "../../packages/gateway/src/pi/transcript-page.js"
import { STOP_TURN, TURN_TOKEN, installTurnBridge, streamingAssistant } from "../sim-turn.js"
import { armClickStamps, armStamps, clickStamps, pageClockOffset } from "./in-page.js"
import {
  WORKBENCH_TIMEOUT_MS,
  composerInput,
  nextPaint,
  openSession,
  clickSessionCard,
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

/** 短会话夹具轮数少于页大小时，首屏只显示夹具已有的行。 */
const SHORT_PAGE_ROWS = Math.min(TRANSCRIPT_PAGE_TURNS, SHORT_TURNS)
const FIRST_PROMPT = "基准首条提问"
const FIRST_TOKEN = "基准首 token"

type Bridge = Awaited<ReturnType<typeof installTurnBridge>>

const HISTORY_HOLD_KEY = "__pigHistoryHold"

/** pig:// 不进 Playwright route，卡住页面 fetch 才拦得到桌面端历史。 */
async function holdTranscriptFetch(page: Page, sessionId: string) {
  await page.evaluate(
    ({ key, id }) => {
      type Hold = {
        native: typeof fetch
        sessionId: string
        received: number
        delivered: number
        blocked: boolean
        waiters: Array<() => void>
      }

      const previous = Reflect.get(window, key) as Hold | undefined

      if (previous) {
        for (const resume of previous.waiters) resume()
        window.fetch = previous.native
      }

      const hold: Hold = {
        native: window.fetch.bind(window),
        sessionId: id,
        received: 0,
        delivered: 0,
        blocked: true,
        waiters: [],
      }

      Reflect.set(window, key, hold)
      window.fetch = (input, init) => {
        const href =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url
        const url = new URL(href, window.location.href)

        if (url.pathname !== "/api/v1/platform/transcript") return hold.native(input, init)

        if (url.searchParams.get("sessionId") !== hold.sessionId) return hold.native(input, init)
        return hold.native(input, init).then((response) => {
          hold.received += 1

          const gate = hold.blocked
            ? new Promise<void>((resolve) => {
                hold.waiters.push(resolve)
              })
            : Promise.resolve()
          return gate.then(() => {
            hold.delivered += 1
            return response
          })
        })
      }
    },
    { key: HISTORY_HOLD_KEY, id: sessionId },
  )
  return {
    counts: () =>
      page.evaluate((key) => {
        const hold = Reflect.get(window, key) as { received: number; delivered: number } | undefined
        return { received: hold?.received ?? 0, delivered: hold?.delivered ?? 0 }
      }, HISTORY_HOLD_KEY),
    async release() {
      await page.evaluate((key) => {
        const hold = Reflect.get(window, key) as
          { blocked: boolean; waiters: Array<() => void> } | undefined

        if (!hold) return
        hold.blocked = false

        for (const resume of hold.waiters) resume()
        hold.waiters.length = 0
      }, HISTORY_HOLD_KEY)
    },
    async dispose() {
      await page.evaluate((key) => {
        const hold = Reflect.get(window, key) as
          { native: typeof fetch; blocked: boolean; waiters: Array<() => void> } | undefined

        if (!hold) return
        hold.blocked = false

        for (const resume of hold.waiters) resume()
        hold.waiters.length = 0
        window.fetch = hold.native
        Reflect.deleteProperty(window, key)
      }, HISTORY_HOLD_KEY)
    },
  }
}

/** 卡住长会话历史后立刻切短会话，量最终就绪。 */
async function rapidSwitch(page: Page) {
  await openSession(page, EMPTY_SESSION_NAME)
  const hold = await holdTranscriptFetch(page, LONG_SESSION_ID)

  try {
    await clickSessionCard(page, LONG_SESSION_NAME)
    await expect
      .poll(async () => (await hold.counts()).received, {
        timeout: WORKBENCH_TIMEOUT_MS,
        message: "连切场景必须捕获旧历史请求",
      })
      .toBeGreaterThan(0)
    const elapsed = await openSession(page, SHORT_SESSION_NAME)
    await hold.release()
    await expect
      .poll(
        async () => {
          const counts = await hold.counts()
          return counts.delivered === counts.received
        },
        { timeout: WORKBENCH_TIMEOUT_MS },
      )
      .toBe(true)
    await nextPaint(page)
    await expect(page).toHaveURL(new RegExp(`/sessions/${SHORT_SESSION_ID}$`))
    await expect(page.locator(".row-user")).toHaveCount(SHORT_PAGE_ROWS)
    await expect(page.getByText(`${LONG_SESSION_NAME} 提问 1`, { exact: true })).toHaveCount(0)
    return elapsed
  } finally {
    await hold.dispose()
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
  await armClickStamps(page, send, {
    own: { rowText: FIRST_PROMPT },
    token: { bodyIncludes: FIRST_TOKEN },
  })
  await send.click()
  const ownMessageMs = await clickStamps(page, "own")
  await page.waitForURL(/\/sessions\/[^/?#]+$/)
  const sessionId = await bridge.waitForPrompt()
  const snapshot = bridge.snapshots.get(sessionId)

  if (!snapshot) throw new Error("回合场景缺少真实 SessionSnapshot")

  const emit = (
    type: "item_started" | "item_updated",
    item: ReturnType<typeof streamingAssistant>,
  ) => {
    bridge.send({
      type: "event",
      event: { type: "session_progress", sessionId, progress: { type, item } },
    })
  }

  emit("item_started", streamingAssistant(snapshot, FIRST_TOKEN))
  await seen(FIRST_TOKEN)
  const firstTokenMs = await clickStamps(page, "token")
  await expect(stop).toBeVisible()
  const offset = await pageClockOffset(page)
  const lags: number[] = []

  for (let index = 1; index <= 6; index += 1) {
    const marker = `流式跟上 ${index}`
    await armStamps(page, {
      chunk: { bodyIncludes: marker, latestInViewport: true },
    })
    const emitAt = performance.now()
    emit("item_updated", streamingAssistant(snapshot, `${marker}\n${"增量。".repeat(index * 8)}`))
    const hitAt = await clickStamps(page, "chunk")
    lags.push(hitAt + offset - emitAt)
  }

  await armClickStamps(page, stop, {
    aborted: { gone: [".send--abort"], rowText: FIRST_PROMPT },
  })
  await stop.click()
  return {
    ownMessageMs,
    firstTokenMs,
    streamKeepUpMs: Math.max(...lags),
    abortMs: await clickStamps(page, "aborted"),
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
  await expect(page.getByText(TURN_TOKEN, { exact: true })).toHaveCount(0)
  await expect(page.locator(".row-assistant")).toHaveCount(SHORT_PAGE_ROWS)
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

/** 在给定窗口上装桥接后打开工作台：桥接只接管新建的 WS 连接，回合场景跑在这个新文档里。 */
export async function runTurnScenarios(page: Page, origin: string): Promise<EdgeSample> {
  const bridge = await installTurnBridge(page)

  await page.goto(origin)
  await waitForWorkbench(page)

  if (bridge.connections() === 0) throw new Error("回合桥接未接管 WebSocket")

  const turn = await measureTurn(page, bridge)
  const rapidSwitchMs = await rapidSwitch(page)
  const reconnectMs = await reconnect(page, bridge)
  return { ...turn, rapidSwitchMs, reconnectMs }
}
