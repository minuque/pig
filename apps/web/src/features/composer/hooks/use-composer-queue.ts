import { computed, shallowRef, type ComputedRef, type ShallowRef } from "vue"
import type { ComposerAttachment, ComposerAttachmentBatch } from "@/types/attachment-type.js"
import type { QueueDraftPatch } from "@features/composer/type.js"
import {
  useSessionBuckets,
  type SharedBuckets,
} from "@features/composer/hooks/use-session-buckets.js"

export interface QueuedPrompt {
  id: string
  text: string
  attachments: ComposerAttachmentBatch | undefined
  attachmentsPreview: ComposerAttachment[]
}

export interface ComposerQueueApi {
  items: ComputedRef<QueuedPrompt[]>
  enqueue(text: string, attachments?: ComposerAttachmentBatch, preview?: ComposerAttachment[]): void
  update(patch: QueueDraftPatch): void
  remove(id: string): void
  reorder(id: string, toIndex: number): void
  move(id: string, delta: -1 | 1): void
  shift(): QueuedPrompt | undefined
  shiftFor(sessionId: string): QueuedPrompt | undefined
  unshiftFor(sessionId: string, item: QueuedPrompt): void
  sizeFor(sessionId: string): number
  setKey(sessionId: string | undefined): void
  handOff(sessionId: string): void
}

export function useComposerQueue(store?: SharedBuckets): ComposerQueueApi {
  const buckets = useSessionBuckets<ShallowRef<QueuedPrompt[]>>(
    () => shallowRef([]),
    undefined,
    "queue",
    store,
  )
  const bucket = buckets.current
  const items = computed(() => bucket().value)

  function enqueue(
    text: string,
    attachments?: ComposerAttachmentBatch,
    preview?: ComposerAttachment[],
  ) {
    const normalized = text.trim()

    if (!normalized && !attachments) return
    const current = bucket().value

    bucket().value = [
      ...current,
      {
        id: crypto.randomUUID(),
        text: normalized,
        attachments,
        attachmentsPreview: preview ?? [],
      },
    ]
  }

  function update(patch: QueueDraftPatch) {
    const normalized = patch.text.trim()
    const current = bucket().value

    if (!normalized || !current.some((item) => item.id === patch.id)) return

    bucket().value = current.map((item) =>
      item.id === patch.id ? { ...item, text: normalized } : item,
    )
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

  function move(id: string, delta: -1 | 1) {
    const current = bucket().value
    const index = current.findIndex((item) => item.id === id)

    if (index < 0 || index + delta < 0 || index + delta >= current.length) return
    reorder(id, index + delta)
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
    update,
    remove,
    reorder,
    move,
    shift,
    shiftFor,
    unshiftFor,
    sizeFor,
    setKey: buckets.setKey,
    handOff: buckets.handOff,
  }
}
