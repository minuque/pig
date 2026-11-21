import { watch } from "vue"
import type { TranscriptItem } from "@/types/common-type.js"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { ComposerQueueApi } from "@features/composer/hooks/use-composer-queue.js"
import { endedCleanly } from "@features/session/index.js"
import { notifyTurnDone } from "@features/settings/index.js"

interface TurnFinishDeps {
  sessionId(): string | undefined
  running(): boolean
  pending(): boolean
  transcript(): readonly TranscriptItem[]
  queue: ComposerQueueApi
  sound: { play(event: "done"): unknown }
  sendForeground(text: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
}

export function useTurnFinish(deps: TurnFinishDeps) {
  let abortedTurn = false

  function markAborted() {
    abortedTurn = true
  }

  async function pumpForeground() {
    if (!deps.sessionId() || deps.pending()) return
    const next = deps.queue.shift()

    if (!next) return

    await deps.sendForeground(next.text, next.attachments)
  }

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
