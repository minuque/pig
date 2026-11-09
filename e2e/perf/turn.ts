import { expect, type Page } from "@playwright/test"
import type { TranscriptProgress } from "@pig/protocol"

import { installTurnBridge, streamingAssistant } from "../sim-turn.js"
import {
  armClickStamps,
  armStamps,
  clearStamps,
  clickStamps,
  pageClockOffset,
  startKeepAlive,
  stopKeepAlive,
} from "./in-page.js"
import { WORKBENCH_TIMEOUT_MS, composerInput, nextPaint, waitForWorkbench } from "./measure.js"

const FIRST_PROMPT = "基准首条提问"
const FIRST_TOKEN = "基准首 token"
const STREAM_CHUNKS = 6

/** 欢迎页发一句：量点发送到首条助手上屏，再量保活下流式增量的最慢显示延迟。 */
export async function runTurn(page: Page, origin: string) {
  const bridge = await installTurnBridge(page)

  await page.goto(origin)
  await waitForWorkbench(page)

  if (bridge.connections() === 0) throw new Error("回合桥接未接管 WebSocket")

  const send = page.locator("button.send")
  await composerInput(page).fill(FIRST_PROMPT)
  await expect(send).toBeEnabled()
  await armClickStamps(page, send, { token: { bodyIncludes: FIRST_TOKEN } })
  await send.click()
  await page.waitForURL(/\/sessions\/[^/?#]+$/)
  const sessionId = await bridge.waitForPrompt()
  const snapshot = bridge.snapshots.get(sessionId)

  if (!snapshot) throw new Error("回合场景缺少真实 SessionSnapshot")

  const started = streamingAssistant(snapshot, FIRST_TOKEN)
  const emit = (progress: TranscriptProgress) =>
    bridge.send({ type: "event", event: { type: "session_progress", sessionId, progress } })

  emit({ type: "item_started", item: started })
  await expect(page.getByText(FIRST_TOKEN, { exact: true })).toBeVisible({
    timeout: WORKBENCH_TIMEOUT_MS,
  })
  const firstTokenMs = await clickStamps(page, "token")
  const offset = await pageClockOffset(page)
  const lags: number[] = []

  await startKeepAlive(page)
  // 先让保活跑起来，量的是稳态而不是唤醒
  await nextPaint(page)

  try {
    for (let index = 1; index <= STREAM_CHUNKS; index += 1) {
      const marker = `流式稳态 ${index}`
      await armStamps(page, { chunk: { bodyIncludes: marker, latestInViewport: true } })
      const emitAt = performance.now()
      // 与 gateway 一致：同一文本块只发新增文字
      emit({
        type: "assistant_delta",
        messageId: started.id,
        contentIndex: 0,
        kind: "text",
        delta: `\n\n${marker}\n${"增量。".repeat(index * 8)}`,
      })
      lags.push((await clickStamps(page, "chunk")) + offset - emitAt)
    }
  } finally {
    await stopKeepAlive(page)
    await clearStamps(page)
  }

  return { firstTokenMs, streamKeepUpMs: Math.max(...lags) }
}
