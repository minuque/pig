import { computed, ref, type ComputedRef, type Ref, type WritableComputedRef } from "vue"
import type { QueueDraftPatch } from "@features/composer/type.js"
import { createPromptHistory, type PromptHistory } from "@features/composer/lib/prompt-history.js"
import {
  useSessionBuckets,
  type SharedBuckets,
} from "@features/composer/hooks/use-session-buckets.js"

interface DraftStash {
  text: Ref<string>
  history: PromptHistory
}

export interface ComposerDraftApi {
  text: WritableComputedRef<string>
  isEmpty: ComputedRef<boolean>
  editingQueueId: Ref<string | null>
  stashedDraft: ComputedRef<string>
  pushHistory(text: string): void
  historyPrev(): void
  historyNext(): void
  resetHistory(): void
  beginQueueEdit(id: string, text: string): void
  commitQueueEdit(): QueueDraftPatch | undefined
  cancelQueueEdit(): void
  setKey(sessionId: string | undefined): void
  handOff(sessionId: string): void
}

export function useComposerDraft(textRef?: Ref<string>, store?: SharedBuckets): ComposerDraftApi {
  const buckets = useSessionBuckets<DraftStash>(
    () => ({ text: ref(""), history: createPromptHistory() }),
    undefined,
    "draft",
    store,
  )
  const bucket = buckets.current
  const source = () => textRef ?? bucket().text
  const editingQueueId = ref<string | null>(null)
  const stashedDraft = ref("")
  const text = computed({
    get: () => source().value,
    set: (value: string) => {
      source().value = value
    },
  })
  const isEmpty = computed(() => text.value.trim().length === 0)
  const stashedDraftValue = computed(() => stashedDraft.value)

  function finishQueueEdit(restored: string) {
    editingQueueId.value = null
    stashedDraft.value = ""
    text.value = restored
  }

  function beginQueueEdit(id: string, value: string) {
    if (editingQueueId.value === null) stashedDraft.value = text.value
    editingQueueId.value = id
    text.value = value
  }

  function commitQueueEdit(): QueueDraftPatch | undefined {
    const id = editingQueueId.value

    if (id === null) return undefined
    const patch = { id, text: text.value.trim() }

    finishQueueEdit(stashedDraft.value)
    return patch
  }

  function cancelQueueEdit() {
    if (editingQueueId.value === null) return
    finishQueueEdit(stashedDraft.value)
  }

  function pushHistory(value: string) {
    bucket().history.push(value)
  }

  function historyPrev() {
    const next = bucket().history.prev(text.value)

    if (next !== undefined) text.value = next
  }

  function historyNext() {
    const next = bucket().history.next()

    if (next !== undefined) text.value = next
  }

  function resetHistory() {
    bucket().history.resetCursor()
  }

  function setKey(sessionId: string | undefined) {
    if (editingQueueId.value !== null) finishQueueEdit(stashedDraft.value)
    buckets.setKey(sessionId)
  }

  return {
    text,
    isEmpty,
    editingQueueId,
    stashedDraft: stashedDraftValue,
    pushHistory,
    historyPrev,
    historyNext,
    resetHistory,
    beginQueueEdit,
    commitQueueEdit,
    cancelQueueEdit,
    setKey,
    handOff: buckets.handOff,
  }
}
