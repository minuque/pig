import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue"
import { useSessionBuckets } from "@features/composer/hooks/use-session-buckets.js"
import type { ComposerAttachmentBatch } from "@features/composer/hooks/use-composer-attachments.js"

export interface QueuedPrompt {
  id: string
  text: string
  /** 入队时从输入卡带走的附件快照；发送时随 prompt 一起 stage + bind。 */
  attachments: ComposerAttachmentBatch | undefined
}

export interface ComposerQueueApi {
  items: ComputedRef<QueuedPrompt[]>
  enqueue(text: string, attachments?: ComposerAttachmentBatch): void
  remove(id: string): void
  /** 拖拽排序：把 id 移到 toIndex。 */
  reorder(id: string, toIndex: number): void
  /** 队首出队：idle 自动发送用。 */
  shift(): QueuedPrompt | undefined
  /** 指定会话的队首出队；后台会话跑完自动泵队用。 */
  shiftFor(sessionId: string): QueuedPrompt | undefined
  /** 后台发送失败：把条目放回指定会话队首。 */
  unshiftFor(sessionId: string, item: QueuedPrompt): void
  /** 指定会话队列长度；后台会话该不该继续泵队用。 */
  sizeFor(sessionId: string): number
  setKey(sessionId: string | undefined): void
}

/**
 * 本地待发队列：内存按 sessionId 分桶（welcome 为 ""）。
 * 轮次结束（running → false）由调用方泵队首；立即发送走 steer。
 */
export function useComposerQueue(): ComposerQueueApi {
  const buckets = useSessionBuckets<ShallowRef<QueuedPrompt[]>>(() => shallowRef([]))
  const bucket = buckets.current
  const items = computed(() => bucket().value)

  function enqueue(text: string, attachments?: ComposerAttachmentBatch) {
    const normalized = text.trim()

    if (!normalized) return
    const current = bucket().value

    bucket().value = [...current, { id: crypto.randomUUID(), text: normalized, attachments }]
  }

  function remove(id: string) {
    const current = bucket().value

    if (!current.some((item) => item.id === id)) return
    bucket().value = current.filter((item) => item.id !== id)
  }

  function reorder(id: string, toIndex: number) {
    const current = bucket().value
    const index = current.findIndex((item) => item.id === id)
    const item = current[index]

    if (index < 0 || !item) return

    const target = Math.max(0, Math.min(current.length - 1, toIndex))

    if (target === index) return

    const moved = [...current]

    moved.splice(index, 1)
    moved.splice(target, 0, item)
    bucket().value = moved
  }

  function shift(): QueuedPrompt | undefined {
    return shiftFrom(bucket())
  }

  function shiftFrom(list: ShallowRef<QueuedPrompt[]>): QueuedPrompt | undefined {
    const head = list.value[0]

    if (!head) return undefined
    list.value = list.value.slice(1)
    return head
  }

  function shiftFor(sessionId: string): QueuedPrompt | undefined {
    return shiftFrom(buckets.forKey(sessionId))
  }

  function unshiftFor(sessionId: string, item: QueuedPrompt) {
    const list = buckets.forKey(sessionId)

    list.value = [item, ...list.value]
  }

  function sizeFor(sessionId: string): number {
    return buckets.forKey(sessionId).value.length
  }

  return {
    items,
    enqueue,
    remove,
    reorder,
    shift,
    shiftFor,
    unshiftFor,
    sizeFor,
    setKey: buckets.setKey,
  }
}
