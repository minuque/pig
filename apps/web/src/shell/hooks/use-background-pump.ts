import type { TranscriptItem } from "@/types/common-type.js"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { ComposerQueueApi } from "@features/composer/hooks/use-composer-queue.js"
import { endedCleanly, type BackgroundIdleResult } from "@features/session/index.js"
import { notifyTurnDone } from "@features/settings/index.js"

interface BackgroundPumpDeps {
  queue: ComposerQueueApi
  sound: { play(event: "done"): unknown }
  send(id: string, text: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
  transcriptFor(id: string): readonly TranscriptItem[]
  announce(id: string, outcome: "complete" | "error"): void
}

function failed(items: readonly TranscriptItem[]): boolean {
  const last = items.findLast((item) => item.role === "assistant")
  return last?.role === "assistant" && last.status === "error"
}

export function createBackgroundPump(deps: BackgroundPumpDeps) {
  async function onIdle(id: string): Promise<BackgroundIdleResult> {
    const next = deps.queue.shiftFor(id)

    if (!next) {
      const items = deps.transcriptFor(id)

      if (endedCleanly(items)) {
        void deps.sound.play("done")
        void notifyTurnDone()
        deps.announce(id, "complete")
      } else if (failed(items)) deps.announce(id, "error")
      return "done"
    }

    if (await deps.send(id, next.text, next.attachments)) return "sent"

    deps.queue.unshiftFor(id, next)
    return "done"
  }

  return { onIdle }
}
