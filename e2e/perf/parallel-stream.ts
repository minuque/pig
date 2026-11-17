import type { TranscriptProgress } from "@pig/protocol"

import { TURN_STREAM_ID, type installTurnBridge } from "../support/sim-turn.js"

type TurnBridge = Awaited<ReturnType<typeof installTurnBridge>>

/** 网关合帧窗口（session-runtime.ts 的 PROGRESS_COALESCE_MS），界面能收到的最密节奏。 */
const FRAME_MS = 16
export const STREAM_MS = 3_000
/** 每帧 40 字；每 10 帧换一段，贴近真实回答的段落结构。 */
const FILLER = "把快照投到时间线，把输入框留在底栏。".repeat(2) + "继续写"

function frameText(index: number) {
  return FILLER + (index % 10 === 9 ? "\n\n" : "。")
}

export function emitProgress(bridge: TurnBridge, sessionId: string, progress: TranscriptProgress) {
  bridge.send({ type: "event", event: { type: "session_progress", sessionId, progress } })
}

function emitDelta(bridge: TurnBridge, sessionId: string, delta: string) {
  emitProgress(bridge, sessionId, {
    type: "assistant_delta",
    messageId: TURN_STREAM_ID,
    contentIndex: 0,
    kind: "text",
    delta,
  })
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export type BridgeStream = {
  /** 流式窗口结束。 */
  done: Promise<void>
  /** 提前收尾：不定长的流在采样完成时停。 */
  stop(): Promise<void>
  /** 立刻给该会话插一段增量，返回 Node 侧发出时刻。 */
  inject(sessionId: string, delta: string): number
}

/**
 * 按 16ms 一帧给每个会话发 assistant_delta，持续 durationMs，或直到 stop()。
 * Windows 计时器粒度约 15.6ms：按到期帧数补发，平均速率不漂。
 */
export function streamDeltas(
  bridge: TurnBridge,
  sessionIds: readonly string[],
  durationMs = Number.POSITIVE_INFINITY,
): BridgeStream {
  const started = performance.now()
  let total = Math.floor(durationMs / FRAME_MS)
  let sent = 0
  let live = true
  const done = (async () => {
    while (sent < total) {
      const due = Math.min(total, Math.floor((performance.now() - started) / FRAME_MS) + 1)

      for (; sent < due; sent += 1) {
        for (const id of sessionIds) emitDelta(bridge, id, frameText(sent))
      }

      await sleep(Math.max(0, started + sent * FRAME_MS - performance.now()))
    }

    live = false
  })()
  return {
    done,
    stop() {
      total = Math.min(total, sent)
      return done
    },
    inject(sessionId, delta) {
      if (!live) throw new Error("流式窗口已结束，样本落在窗口外")
      const at = performance.now()
      emitDelta(bridge, sessionId, delta)
      return at
    },
  }
}
