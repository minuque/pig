import { expect, type Page } from "@playwright/test"

import { installTurnBridge, streamingAssistant } from "../support/sim-turn.js"
import type { BenchHarness } from "./harness.js"
import {
  armStamps,
  clearStamps,
  clickStamps,
  pageClockOffset,
  startKeepAlive,
  stopKeepAlive,
} from "./in-page.js"
import {
  WORKBENCH_TIMEOUT_MS,
  captureBenchFailure,
  composerInput,
  keyToNextFrame,
  median,
  nextPaint,
  waitForWorkbench,
  worstFrameDuring,
} from "./measure.js"
import { STREAM_MS, emitProgress, sleep, streamDeltas } from "./parallel-stream.js"

type TurnBridge = Awaited<ReturnType<typeof installTurnBridge>>

export const PARALLEL_KEYS = [
  "splitTypeWhileStream",
  "splitDualStreamWorstFrame",
  "splitStreamKeepUp",
  "bgTypeWhileStream",
] as const

export type ParallelSamples = Record<(typeof PARALLEL_KEYS)[number], number[]>

/** 分屏两侧用两条空历史的列表种子，启动前写进分屏偏好。 */
const LEFT_ID = "bench-list-01"
const RIGHT_ID = "bench-list-02"
const BACKGROUND_COUNT = 4
const KEEP_UP_MARKS = 6
const pane = (side: "left" | "right") => `.workbench-pane[data-side="${side}"]`

/** 同 run.ts 的输入跟手：丢首次，取其后七次中位数；流一直喂到采样完成。 */
async function typeWhileStreaming(page: Page, bridge: TurnBridge, ids: readonly string[]) {
  const stream = streamDeltas(bridge, ids)
  const values: number[] = []

  try {
    for (let index = 0; index < 8; index += 1) {
      const ms = await keyToNextFrame(page)

      if (index > 0) values.push(ms)
    }
  } finally {
    await stream.stop()
  }

  return median(values)
}

/** 在指定范围的 Composer 发一句，等桥接收到该会话的 prompt，再起一条流式助手消息。 */
async function startTurn(page: Page, bridge: TurnBridge, scope: string, prompt: string) {
  const before = bridge.prompted.length
  await page.locator(`${scope} .composer .field`).fill(prompt)
  const send = page.locator(`${scope} button.send`)
  await expect(send).toBeEnabled()
  await send.click()
  await expect
    .poll(() => bridge.prompted.length, { timeout: WORKBENCH_TIMEOUT_MS })
    .toBe(before + 1)
  const sessionId = bridge.prompted[before]
  const snapshot = sessionId ? bridge.snapshots.get(sessionId) : undefined

  if (!sessionId || !snapshot) throw new Error("并行场景缺少真实 SessionSnapshot")
  const token = `${prompt} 首 token`
  emitProgress(bridge, sessionId, {
    type: "item_started",
    item: streamingAssistant(snapshot, token),
  })
  await expect(page.locator(scope).getByText(token, { exact: true })).toBeVisible({
    timeout: WORKBENCH_TIMEOUT_MS,
  })
  return sessionId
}

/** 左侧增量最慢上屏：两侧同时流式，隔一段给左侧插一个标记，量 Node 发出到页面命中。 */
async function keepUpWhileDual(page: Page, bridge: TurnBridge, ids: readonly string[]) {
  const offset = await pageClockOffset(page)
  const lags: number[] = []

  await startKeepAlive(page)
  await nextPaint(page)

  const stream = streamDeltas(bridge, ids)

  try {
    for (let index = 1; index <= KEEP_UP_MARKS; index += 1) {
      await sleep(250)
      const marker = `并行跟上 ${index}`
      await armStamps(page, {
        chunk: { textIn: { selector: `${pane("left")} .transcript-viewport`, text: marker } },
      })
      const emitAt = stream.inject(LEFT_ID, `\n\n${marker}\n\n`)
      lags.push((await clickStamps(page, "chunk")) + offset - emitAt)
    }
  } finally {
    await stream.stop()
    await stopKeepAlive(page)
    await clearStamps(page)
  }

  return Math.max(...lags)
}

async function measureSplit(harness: BenchHarness, samples: ParallelSamples, failShot: string) {
  const session = await harness.open()

  try {
    const { page } = session
    const bridge = await installTurnBridge(page)
    await page.addInitScript(
      ({ left, right }) => {
        const split = { left, right, split: true, focused: "left", ratio: 0.5 }
        localStorage.setItem("pig.split", JSON.stringify(split))
      },
      { left: LEFT_ID, right: RIGHT_ID },
    )
    await page.goto(session.origin)
    await waitForWorkbench(page)
    await page.locator(".split-area.is-split").waitFor({ timeout: WORKBENCH_TIMEOUT_MS })

    if (bridge.connections() === 0) throw new Error("回合桥接未接管 WebSocket")
    const right = await startTurn(page, bridge, pane("right"), "右侧并行提问")

    if (right !== RIGHT_ID) throw new Error(`右侧 prompt 落到了 ${right}`)
    samples.splitTypeWhileStream.push(await typeWhileStreaming(page, bridge, [right]))

    const left = await startTurn(page, bridge, pane("left"), "左侧并行提问")

    if (left !== LEFT_ID) throw new Error(`左侧 prompt 落到了 ${left}`)
    samples.splitDualStreamWorstFrame.push(
      await worstFrameDuring(page, () => streamDeltas(bridge, [left, right], STREAM_MS).done),
    )
    samples.splitStreamKeepUp.push(await keepUpWhileDual(page, bridge, [left, right]))
  } catch (error) {
    await captureBenchFailure(session.page, failShot)
    throw error
  } finally {
    await session.close()
  }
}

/** 在欢迎页开跑回合再点「新建会话」切走，重复四次，四个会话都进后台池。 */
async function measureBackground(
  harness: BenchHarness,
  samples: ParallelSamples,
  failShot: string,
) {
  const session = await harness.open()

  try {
    const { page } = session
    const bridge = await installTurnBridge(page)
    await page.goto(session.origin)
    await waitForWorkbench(page)

    if (bridge.connections() === 0) throw new Error("回合桥接未接管 WebSocket")
    const ids: string[] = []
    const create = page.getByRole("button", { name: "新建会话", exact: true }).first()

    for (let index = 1; index <= BACKGROUND_COUNT; index += 1) {
      const id = await startTurn(page, bridge, ".workbench-pane", `后台并行提问 ${index}`)
      ids.push(id)
      await create.click()
      await page.waitForURL((url) => !url.pathname.startsWith("/sessions/"))
      await expect(composerInput(page)).toBeEditable()
    }

    const running = page.locator("nav.session-list .session-card .working-status")
    await expect(running).toHaveCount(BACKGROUND_COUNT, { timeout: WORKBENCH_TIMEOUT_MS })
    samples.bgTypeWhileStream.push(await typeWhileStreaming(page, bridge, ids))
    // 后台订阅若中途出池，转后台的代价就没量到
    await expect(running).toHaveCount(BACKGROUND_COUNT)
  } catch (error) {
    await captureBenchFailure(session.page, failShot)
    throw error
  } finally {
    await session.close()
  }
}

/** 并行（界面）：分屏一实例，后台池一实例，各用全新状态。 */
export async function measureParallel(
  harness: BenchHarness,
  samples: ParallelSamples,
  failShot: string,
) {
  await measureSplit(harness, samples, failShot)
  await measureBackground(harness, samples, failShot)
}
