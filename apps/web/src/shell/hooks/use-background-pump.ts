import type { TranscriptItem } from "@/types/common-type.js"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { ComposerQueueApi } from "@features/composer/hooks/use-composer-queue.js"
import { endedCleanly, type BackgroundIdleResult } from "@features/session/index.js"

interface BackgroundPumpDeps {
  queue: ComposerQueueApi
  sound: { play(event: "done" | "attention"): unknown }
  send(id: string, text: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
  transcriptFor(id: string): readonly TranscriptItem[]
  announce(id: string, outcome: "complete" | "error", detail?: string): void
}

function failed(items: readonly TranscriptItem[]): { failed: boolean; errorMessage?: string } {
  const last = items.findLast((item) => item.role === "assistant")

  if (last?.role !== "assistant" || last.status !== "error") return { failed: false }
  return { failed: true, ...(last.errorMessage ? { errorMessage: last.errorMessage } : {}) }
}

export function createBackgroundPump(deps: BackgroundPumpDeps) {
  async function onIdle(id: string): Promise<BackgroundIdleResult> {
    const next = deps.queue.shiftFor(id)

    if (!next) {
      const items = deps.transcriptFor(id)

      if (endedCleanly(items)) {
        void deps.sound.play("done")
        deps.announce(id, "complete")
      } else {
        const failure = failed(items)

        if (failure.failed) {
          void deps.sound.play("attention")
          deps.announce(id, "error", failure.errorMessage)
        }
      }

      return "done"
    }

    if (await deps.send(id, next.text, next.attachments)) return "sent"

    deps.queue.unshiftFor(id, next)
    return "done"
  }

  return { onIdle }
}
