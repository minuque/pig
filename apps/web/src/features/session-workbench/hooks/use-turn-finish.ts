import { watch } from "vue"
import type { TranscriptItem } from "@/types/common-type.js"
import type { ComposerAttachmentBatch } from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerQueueApi } from "@features/composer/hooks/use-composer-queue.js"

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
  /** 后台发送：对指定会话提交，失败由调用方回滚队列。 */
  sendBackground(id: string, text: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
  /** 指定会话的合并转录；后台完成音判断用。 */
  transcriptFor(id: string): readonly TranscriptItem[]
}

/** 最后一条助手不是 error/aborted 才算干净收尾。 */
function endedCleanly(items: readonly TranscriptItem[]): boolean {
  const last = [...items].reverse().find((item) => item.role === "assistant")
  return last?.role !== "assistant" || (last.status !== "error" && last.status !== "aborted")
}

/** 前台与后台的「轮次结束 → 完成音 / 泵队」收口，index.vue 只负责接线。 */
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

  /** 后台会话跑完：队列有货就直接在后台发出去，否则出池并视情况响完成音。 */
  async function onBackgroundIdle(id: string): Promise<"sent" | "done"> {
    const next = deps.queue.shiftFor(id)

    if (!next) {
      if (endedCleanly(deps.transcriptFor(id))) void deps.sound.play("done")
      return "done"
    }

    if (await deps.sendBackground(id, next.text, next.attachments)) return "sent"

    deps.queue.unshiftFor(id, next)
    return "done"
  }

  // 切会话时 running 的下降沿属于旧会话，不算本会话收尾
  const stop = watch([deps.running, deps.sessionId], ([now, id], [was, prevId]) => {
    if (id !== prevId) {
      abortedTurn = false
      return
    }

    if (!was || now || !id) return

    const clean = !abortedTurn && deps.queue.sizeFor(id) === 0 && endedCleanly(deps.transcript())

    abortedTurn = false

    if (clean) void deps.sound.play("done")
    void pumpForeground()
  })
  return { markAborted, onBackgroundIdle, stop }
}
