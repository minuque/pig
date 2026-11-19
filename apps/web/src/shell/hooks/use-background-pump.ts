import type { TranscriptItem } from "@/types/common-type.js"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { ComposerQueueApi } from "@features/composer/hooks/use-composer-queue.js"
import { endedCleanly, type BackgroundIdleResult } from "@features/session/index.js"
import { notifyTurnDone } from "@features/settings/index.js"

interface BackgroundPumpDeps {
  /** 两侧输入卡共用的待发队列：会话换到哪一侧都读同一份。 */
  queue: ComposerQueueApi
  sound: { play(event: "done"): unknown }
  /** 后台发送：对指定会话提交，失败由这里回滚队列。 */
  send(id: string, text: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
  /** 指定会话的合并转录：完成音看最后一条助手。 */
  transcriptFor(id: string): readonly TranscriptItem[]
}

/**
 * 后台会话跑完后的泵队与收尾：队列有货就在后台发出去，队列空且干净收尾时响完成音。
 * 挂在 Hub 上全局一次，不跟任何一侧分屏面板的挂载周期绑。
 */
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
