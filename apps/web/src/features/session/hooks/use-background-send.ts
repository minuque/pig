import type { TranscriptItem } from "@/types/common-type.js"
import { errorMessage } from "@client/http.js"
import { discardAttachments, stageAttachment } from "@client/platform.js"
import type { ComposerAttachment, ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { LiveSubscription } from "@features/session/hooks/use-live-subscriptions.js"
import { optimisticUserMessage, sessionState } from "@features/session/lib/session-state.js"
import type { SessionClientState } from "@features/session/type.js"

export async function stageBatch(
  batch: ComposerAttachmentBatch,
  aborted: () => boolean,
): Promise<boolean> {
  const staged = new Set(batch.staged ?? [])
  const pending = batch.files.filter((item) => !staged.has(item.id))
  const reset = (keep?: ComposerAttachment) => {
    for (const item of pending) {
      if (item !== keep) batch.reportProgress?.(item.id, undefined)
    }
  }

  for (const item of pending) {
    batch.reportProgress?.(item.id, 0)

    try {
      await stageAttachment(batch.batch, item.file, {
        onProgress: (ratio) => batch.reportProgress?.(item.id, ratio * 100),
      })
    } catch (error) {
      reset(item)
      batch.reportError?.(item.id, errorMessage(error))
      throw error
    }

    batch.reportProgress?.(item.id, 100)

    if (aborted()) {
      reset()
      return false
    }
  }

  if (aborted()) {
    reset()
    return false
  }

  return true
}

export function releaseAttachments(files: readonly ComposerAttachment[]) {
  for (const item of files) {
    if (item.url) URL.revokeObjectURL(item.url)
  }
}

export async function dropBatch(batch: ComposerAttachmentBatch | undefined): Promise<void> {
  if (!batch) return
  batch.staged = []
  await discardAttachments(batch.batch).catch(() => undefined)
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
        await dropBatch(attachments)
        return false
      }

      if (!pooled()) {
        await dropBatch(attachments)
        return false
      }

      await sub.session.submit(
        text,
        attachments ? { attachmentBatch: attachments.batch } : undefined,
      )
      accepted = true

      if (attachments) releaseAttachments(attachments.files)
      return true
    } catch {
      await dropBatch(attachments)
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
