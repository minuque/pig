import type { TranscriptItem } from "@/types/common-type.js"
import { discardAttachments, stageAttachment } from "@client/platform.js"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { LiveSubscription } from "@features/session/hooks/use-live-subscriptions.js"
import { optimisticUserMessage, sessionState } from "@features/session/lib/session-state.js"
import type { SessionClientState } from "@features/session/type.js"

export async function stageBatch(
  batch: ComposerAttachmentBatch,
  aborted: () => boolean,
): Promise<boolean> {
  const resetAll = () => batch.files.forEach((item) => batch.reportProgress?.(item.id, undefined))

  try {
    for (const item of batch.files) {
      batch.reportProgress?.(item.id, 0)
      let shown = 0
      const timer = globalThis.setInterval(() => {
        shown = Math.min(85, shown + (4 + 7 * Math.random()))
        batch.reportProgress?.(item.id, Math.round(shown))
      }, 50)

      try {
        await stageAttachment(batch.batch, item.file)
      } finally {
        globalThis.clearInterval(timer)
      }

      batch.reportProgress?.(item.id, 100)

      if (aborted()) {
        resetAll()
        return false
      }
    }

    if (aborted()) {
      resetAll()
      return false
    }

    return true
  } catch (error) {
    resetAll()
    throw error
  }
}

export function dropBatch(batch: string | undefined): Promise<void> {
  if (!batch) return Promise.resolve()
  return discardAttachments(batch).catch(() => undefined)
}

interface BackgroundSendDeps {
  states: Map<string, SessionClientState>
  backgroundSubscription(id: string): LiveSubscription | undefined
  transcriptFor(id: string): readonly TranscriptItem[]
}

export function createBackgroundSender(deps: BackgroundSendDeps) {
  async function send(
    id: string,
    text: string,
    attachments?: ComposerAttachmentBatch,
  ): Promise<boolean> {
    const sub = deps.backgroundSubscription(id)

    if (!sub || sub.foreground) return false
    const thread = sessionState(deps.states, id)
    const send = optimisticUserMessage(
      text,
      deps.transcriptFor(id).map((item) => item.id),
    )
    const pooled = () => deps.backgroundSubscription(id) === sub
    let accepted = false

    thread.sends.push(send)

    try {
      if (attachments && !(await stageBatch(attachments, () => !pooled()))) {
        await dropBatch(attachments.batch)
        return false
      }

      if (!pooled()) {
        await dropBatch(attachments?.batch)
        return false
      }

      await sub.session.submit(
        text,
        attachments ? { attachmentBatch: attachments.batch } : undefined,
      )
      accepted = true
      return true
    } catch {
      await dropBatch(attachments?.batch)
      return false
    } finally {
      if (!accepted) {
        const index = thread.sends.findIndex((item) => item.item.id === send.item.id)

        if (index >= 0) thread.sends.splice(index, 1)
      }
    }
  }

  return { send }
}
