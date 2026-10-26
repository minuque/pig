import { ref, shallowRef, type Ref, type ShallowRef } from "vue"

import type { TranscriptItem } from "@/types/common-type.js"
import type { ComposerAttachmentsApi } from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerQueueApi } from "@features/composer/hooks/use-composer-queue.js"
import { assistantItem, textBlock, userItem } from "@/stories/fixtures/sessions.js"

/** 模拟回复：带列表的 markdown，逐段追加时能看到结构长出来。 */
export const LIVE_REPLY = `收到，这一轮走本地回放：

- 列宽拖到松手才落定
- 消息逐段追加到正文末尾
- 队列里的下一条自动接上

拖动过程中只有列宽在变，正文不动。`
/** 每段字数与节奏：约 5 字一段，40–60ms 一段，一轮约 1s。 */
const SEGMENT_CHARS = 5
const STEP_MIN_MS = 40
const STEP_MAX_MS = 60
/** 附件落地节奏：进度走到满后清空，与真实发送一致。 */
const SETTLE_MS = 400

type ReplyStatus = "streaming" | "complete" | "aborted"

type LiveReply = { at: number; parts: readonly string[]; step: number; text: string }

export type LiveTurn = {
  /** 追加到样本正文末尾的条目；切样本或卸载时清空。 */
  items: ShallowRef<TranscriptItem[]>
  running: Ref<boolean>
  send: (text: string) => void
  enqueue: (text: string) => void
  abort: () => void
  reset: () => void
}

/** 每段都是到当前为止的全文，追加时直接覆盖最后一条助手消息。 */
function segmentText(text: string): string[] {
  const parts: string[] = []

  for (let end = SEGMENT_CHARS; end < text.length; end += SEGMENT_CHARS)
    parts.push(text.slice(0, end))
  parts.push(text)
  return parts
}

function stepDelay(): number {
  return STEP_MIN_MS + Math.round(Math.random() * (STEP_MAX_MS - STEP_MIN_MS))
}

/** 发送侧本地状态：清空输入、结算附件、跑一轮模拟回复，运行中再来的消息入队。 */
export function createLiveTurn(options: {
  prompt: Ref<string>
  attachments: ComposerAttachmentsApi
  queue: ComposerQueueApi
}): LiveTurn {
  const { prompt, attachments, queue } = options
  const items = shallowRef<TranscriptItem[]>([])
  const running = ref(false)
  let stepTimer = 0
  let settleTimer = 0
  let stamp = Date.now()
  let reply: LiveReply | undefined

  function stopTimer(): void {
    window.clearTimeout(stepTimer)
    stepTimer = 0
  }

  /** 最后一条就是本轮助手消息，换状态或换文本都整条重写。 */
  function write(status: ReplyStatus): void {
    if (!reply) return
    const content = reply.text ? [textBlock(reply.text)] : []

    items.value = [...items.value.slice(0, -1), assistantItem(content, reply.at, status)]
  }

  function start(text: string): void {
    if (!text) return
    stopTimer()
    stamp = Math.max(Date.now(), stamp + 1)
    items.value = [...items.value, userItem(text, stamp), assistantItem([], stamp + 1, "streaming")]
    reply = { at: stamp + 1, parts: segmentText(LIVE_REPLY), step: 0, text: "" }
    running.value = true
    stepTimer = window.setTimeout(advance, stepDelay())
  }

  function advance(): void {
    if (!reply) return
    const part = reply.parts[reply.step]

    if (part !== undefined) {
      reply.text = part
      reply.step += 1
      write("streaming")
    }

    if (reply.step < reply.parts.length) stepTimer = window.setTimeout(advance, stepDelay())
    else finish()
  }

  function finish(): void {
    stopTimer()
    write("complete")
    reply = undefined
    running.value = false

    const following = queue.shift()?.text

    if (following) start(following)
  }

  /** 发送即上传：附件进度走到满后落地清空，不发请求。 */
  function settleAttachments(): void {
    const batch = attachments.consumeForSend()

    if (!batch) return
    batch.files.forEach((item) => batch.reportProgress?.(item.id, 100))
    settleTimer = window.setTimeout(() => attachments.settle(batch), SETTLE_MS)
  }

  function send(text: string): void {
    prompt.value = ""
    settleAttachments()
    start(text.trim())
  }

  /** 运行中入队，空闲时等同直接发送。 */
  function enqueue(text: string): void {
    if (!running.value) {
      send(text)
      return
    }

    prompt.value = ""
    queue.enqueue(text)
  }

  function abort(): void {
    stopTimer()

    if (reply) write("aborted")
    reply = undefined
    running.value = false
  }

  function reset(): void {
    stopTimer()
    window.clearTimeout(settleTimer)
    reply = undefined
    items.value = []
    running.value = false
  }

  return { items, running, send, enqueue, abort, reset }
}
