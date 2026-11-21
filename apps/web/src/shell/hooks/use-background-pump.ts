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
}

export function createBackgroundPump(deps: BackgroundPumpDeps) {
  async function onIdle(id: string): Promise<BackgroundIdleResult> {
    const next = deps.queue.shiftFor(id)

    if (!next) {
      if (endedCleanly(deps.transcriptFor(id))) {
        void deps.sound.play("done")
        void notifyTurnDone()
      }

      return "done"
    }

    if (await deps.send(id, next.text, next.attachments)) return "sent"

    deps.queue.unshiftFor(id, next)
    return "done"
  }

  return { onIdle }
}
