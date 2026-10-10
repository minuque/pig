import type { TranscriptItem } from "@/types/common-type.js"
import { bindAttachments, discardAttachments, stageAttachment } from "@client/platform.js"
import type { ComposerAttachmentBatch } from "@features/composer/hooks/use-composer-attachments.js"
import type { LiveSubscription } from "@features/session-workbench/hooks/use-live-subscriptions.js"
import {
  optimisticUserMessage,
  sessionState,
} from "@features/session-workbench/lib/session-state.js"
import type { SessionClientState } from "@features/session-workbench/type.js"

/**
 * 逐个 stage 再 bind 到指定 Session；aborted() 为真则中止并返回 false。
 * 前台提交的 epoch 时效与后台泵队共用。
 */
export async function stageBatchFor(
  id: string,
  batch: ComposerAttachmentBatch,
  aborted: () => boolean,
): Promise<boolean> {
  // 失败/中止时把整批进度清掉：这批文件留在暂存，环不能卡半空
  const resetAll = () => batch.files.forEach((item) => batch.reportProgress?.(item.id, undefined))

  try {
    for (const item of batch.files) {
      // stage 是单请求拿不到逐字节进度：仿 BoardUI 用随机插值爬到 85，
      // 真实 await 落定再顶到 100，环平滑又仍锚定真实完成
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

    await bindAttachments(id, batch.batch)
    return true
  } catch (error) {
    resetAll()
    throw error
  }
}

/** 丢弃批次：幂等清理，失败不挡主流程；成功路径不调用，Gateway 已消费。 */
export function dropBatch(batch: string | undefined): Promise<void> {
  if (!batch) return Promise.resolve()
  return discardAttachments(batch).catch(() => undefined)
}

interface BackgroundSendDeps {
  /** 每 Session 的 UI 私有状态（草稿、本地用户句）。 */
  states: Map<string, SessionClientState>
  /** 后台池里该会话的订阅；不在池里（已切回前台）就不能后台发送。 */
  backgroundSubscription(id: string): LiveSubscription | undefined
  /** 指定会话当前的合并转录，给乐观用户句定锚点。 */
  transcriptFor(id: string): readonly TranscriptItem[]
}

/** 后台泵队：对指定会话提交一条队列消息，复用池里那条连接。 */
export function createBackgroundSender(deps: BackgroundSendDeps) {
  /**
   * 失败时不动队列（由接管者放回队首），也不碰前台的草稿与报错；
   * 未被服务端接受的乐观用户句在 finally 撤掉。
   */
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
      if (attachments && !(await stageBatchFor(id, attachments, () => !pooled()))) {
        await dropBatch(attachments.batch)
        return false
      }

      if (!pooled()) {
        await dropBatch(attachments?.batch)
        return false
      }

      await sub.session.submit(text)
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
