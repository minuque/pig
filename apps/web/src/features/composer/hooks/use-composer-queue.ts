import { computed, ref, shallowRef, type ComputedRef, type ShallowRef } from "vue"
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
  setKey(sessionId: string | undefined): void
}

/**
 * 本地待发队列：内存按 sessionId 分桶（welcome 为 ""）。
 * 普通 Map 存每个会话的显式 shallowRef：嵌套在 reactive Map 里的数组不保证触发 computed。
 * 轮次结束（running → false）由调用方 pump 队首；Send now 直接走 steer。
 */
export function useComposerQueue(): ComposerQueueApi {
  const buckets = new Map<string, ShallowRef<QueuedPrompt[]>>()
  const key = ref("")
  const items = computed(() => bucket().value)

  function bucket(): ShallowRef<QueuedPrompt[]> {
    let list = buckets.get(key.value)

    if (!list) {
      list = shallowRef([])
      buckets.set(key.value, list)
    }

    return list
  }

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
    const current = bucket().value
    const head = current[0]

    if (!current.length || !head) return undefined
    bucket().value = current.slice(1)
    return head
  }

  function setKey(sessionId: string | undefined) {
    key.value = sessionId ?? ""
  }

  return { items, enqueue, remove, reorder, shift, setKey }
}
