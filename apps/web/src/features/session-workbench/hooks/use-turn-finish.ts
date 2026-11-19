import { watch } from "vue"
import type { TranscriptItem } from "@/types/common-type.js"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { ComposerQueueApi } from "@features/composer/hooks/use-composer-queue.js"
import { endedCleanly } from "@features/session/index.js"
import { notifyTurnDone } from "@features/settings/index.js"

interface TurnFinishDeps {
  sessionId(): string | undefined
  running(): boolean
  /** 提交中或运行中；泵队前挡住还没落地的发送。 */
  pending(): boolean
  /** 前台会话的合并转录；完成音看最后一条助手。 */
  transcript(): readonly TranscriptItem[]
  queue: ComposerQueueApi
  sound: { play(event: "done"): unknown }
  /** 前台发送：走 sendPrompt，失败把正文回填草稿。 */
  sendForeground(text: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
}

/** 前台轮次结束的收口：完成音与泵队首。后台会话的泵队归壳层的 backgroundPump。 */
export function useTurnFinish(deps: TurnFinishDeps) {
  let abortedTurn = false

  /** Abort 按钮按下：这一轮不算干净收尾。 */
  function markAborted() {
    abortedTurn = true
  }

  /** 泵队首一条：剩下的等下一次轮次结束再发，不会一次把队列全提交。 */
  async function pumpForeground() {
    if (!deps.sessionId() || deps.pending()) return
    const next = deps.queue.shift()

    if (!next) return

    // 失败时 sendPrompt 已把正文回填草稿，队列停止避免连发
    await deps.sendForeground(next.text, next.attachments)
  }

  // 切会话时 running 的下降沿属于旧会话，不算本会话收尾
  watch([deps.running, deps.sessionId], ([now, id], [was, prevId]) => {
    if (id !== prevId) {
      abortedTurn = false
      return
    }

    if (!was || now || !id) return

    const clean = !abortedTurn && deps.queue.sizeFor(id) === 0 && endedCleanly(deps.transcript())

    abortedTurn = false

    if (clean) {
      void deps.sound.play("done")
      void notifyTurnDone()
    }

    void pumpForeground()
  })
  return { markAborted }
}
