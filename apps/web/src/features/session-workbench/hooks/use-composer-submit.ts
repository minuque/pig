import type { Ref } from "vue"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { ComposerAttachmentsApi } from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"

interface ComposerSubmitDeps {
  sessionId(): string | undefined
  welcomeCwd(): string | undefined
  prompt: Ref<string>
  queue: ComposerQueueApi
  attachments: ComposerAttachmentsApi
  scrollToLatest(): void
  submit(text: string, cwd?: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
}

export function useComposerSubmit(deps: ComposerSubmitDeps) {
  function deliver(text: string, batch?: ComposerAttachmentBatch) {
    const id = deps.sessionId()

    if (id) deps.scrollToLatest()
    else if (!deps.welcomeCwd()) return Promise.resolve(false)
    return deps.submit(text, id ? undefined : deps.welcomeCwd(), batch).catch(() => false)
  }

  function sendNow(text: string) {
    const batch = deps.attachments.consumeForSend()

    void deliver(text, batch).then((sent) => {
      if (sent && batch) deps.attachments.settle(batch)
    })
  }

  function sendQueued(item: QueuedPrompt) {
    void deliver(item.text, item.attachments).then((sent) => {
      if (sent) deps.queue.remove(item.id)
    })
  }

  function enqueue(text: string) {
    const batch = deps.attachments.consumeForSend()

    deps.queue.enqueue(text, batch)

    if (batch) deps.attachments.settle(batch)
    deps.prompt.value = ""
  }

  return { deliver, sendNow, sendQueued, enqueue }
}
