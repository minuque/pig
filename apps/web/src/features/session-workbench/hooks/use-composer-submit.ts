import type { Ref } from "vue"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { ComposerAttachmentsApi } from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"

interface ComposerSubmitDeps {
  sessionId(): string | undefined
  /** 首屏第一条 Prompt 用这个目录建会话。 */
  welcomeCwd(): string | undefined
  prompt: Ref<string>
  queue: ComposerQueueApi
  attachments: ComposerAttachmentsApi
  scrollToLatest(): void
  /** 提交正文；失败返回 false，前台草稿由 lifecycle 回填。 */
  submit(text: string, cwd?: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
}

/** 输入卡的发送与待发队列：附件随这一条走，发送成功才出队。 */
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
      // 只移走这次发出的附件；发送途中新加的留着，被中止或切走时 chips 也留着
      if (sent && batch) deps.attachments.settle(batch)
    })
  }

  /** 发送成功才出队：被拒（提交中、中止、切走）时条目留在队列里。 */
  function sendQueued(item: QueuedPrompt) {
    void deliver(item.text, item.attachments).then((sent) => {
      if (sent) deps.queue.remove(item.id)
    })
  }

  function enqueue(text: string) {
    const batch = deps.attachments.consumeForSend()

    deps.queue.enqueue(text, batch)

    // 附件归队列持有：入队同时清掉输入卡暂存，否则同一批文件会再传一次
    if (batch) deps.attachments.settle(batch)
    deps.prompt.value = ""
  }

  return { deliver, sendNow, sendQueued, enqueue }
}
