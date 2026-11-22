import { onBeforeUnmount, ref, watch, type Ref } from "vue"
import type { ComposerAttachmentBatch } from "@/types/attachment-type.js"
import { notify } from "@components/layout/notify.js"
import { t } from "@i18n/index.js"
import type { ComposerAttachmentsApi } from "@features/composer/hooks/use-composer-attachments.js"
import type { ComposerDraftApi } from "@features/composer/hooks/use-composer-draft.js"
import type { ComposerQueueApi, QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import type { QueueDraftPatch, StopPhase } from "@features/composer/type.js"

interface ComposerSubmitDeps {
  sessionId(): string | undefined
  welcomeCwd(): string | undefined
  running(): boolean
  prompt: Ref<string>
  draft: ComposerDraftApi
  queue: ComposerQueueApi
  attachments: ComposerAttachmentsApi
  scrollToLatest(): void
  submit(text: string, cwd?: string, attachments?: ComposerAttachmentBatch): Promise<boolean>
  steer(text: string): Promise<boolean>
  abort(): unknown
}

const STOP_TIMEOUT_MS = 8_000
const LANDED_GUARD_MS = 500

export function useComposerSubmit(deps: ComposerSubmitDeps) {
  const stopPhase = ref<StopPhase>("idle")
  const editingQueueId = deps.draft.editingQueueId
  let stopTimer: ReturnType<typeof setTimeout> | undefined

  function phaseAfter(phase: StopPhase, delay: number, next: StopPhase) {
    if (stopTimer) clearTimeout(stopTimer)
    stopTimer = setTimeout(() => {
      stopTimer = undefined

      if (stopPhase.value === phase) stopPhase.value = next
    }, delay)
  }

  function deliver(text: string, batch?: ComposerAttachmentBatch) {
    const id = deps.sessionId()

    if (id) deps.scrollToLatest()
    else if (!deps.welcomeCwd()) return Promise.resolve(false)
    return deps
      .submit(text, id ? undefined : deps.welcomeCwd(), batch)
      .then((sent) => {
        if (sent && batch) deps.attachments.settle(batch)
        return sent
      })
      .catch(() => false)
  }

  function history(text: string) {
    deps.draft.pushHistory(text)
  }

  function sendNow(text: string) {
    const batch = deps.attachments.consumeForSend()

    if (!text.trim() && !batch) return

    history(text)
    void deliver(text, batch)
  }

  function sendQueued(item: QueuedPrompt) {
    void deliver(item.text, item.attachments).then((sent) => {
      if (sent) deps.queue.remove(item.id)
    })
  }

  function enqueue(text: string) {
    const batch = deps.attachments.consumeForSend()
    const preview = [...deps.attachments.files.value]

    if (!text.trim() && !batch) return

    history(text)
    deps.queue.enqueue(text, batch, preview)

    if (batch) deps.attachments.detach(batch)
    deps.prompt.value = ""
  }

  async function steer(text: string) {
    const typed = text.trim()

    if (!typed) return false

    if (deps.attachments.files.value.length) {
      notify(t("composer.steerNoAttachments"), "warning")
      return false
    }

    const steered = await deps.steer(typed).catch(() => false)

    if (steered) {
      history(typed)
      deps.prompt.value = ""
    }

    return steered
  }

  function beginQueueEdit(item: QueuedPrompt) {
    deps.draft.beginQueueEdit(item.id, item.text)
  }

  function commitQueueEdit(): QueueDraftPatch | undefined {
    const patch = deps.draft.commitQueueEdit()

    if (patch) deps.queue.update(patch)
    return patch
  }

  function cancelQueueEdit() {
    if (editingQueueId.value !== null) deps.draft.cancelQueueEdit()
  }

  function removeQueued(id: string) {
    const item = deps.queue.items.value.find((entry) => entry.id === id)

    if (editingQueueId.value === id) cancelQueueEdit()
    deps.queue.remove(id)

    if (item?.attachments) deps.attachments.settle(item.attachments)
  }

  function abort() {
    if (stopPhase.value === "pending") return

    stopPhase.value = "pending"
    phaseAfter("pending", STOP_TIMEOUT_MS, "timedOut")
    void deps.abort()
  }

  watch(deps.running, (now) => {
    if (now) {
      if (stopPhase.value === "landed") stopPhase.value = "idle"
      return
    }

    if (stopPhase.value !== "pending" && stopPhase.value !== "timedOut") return
    stopPhase.value = "landed"
    phaseAfter("landed", LANDED_GUARD_MS, "idle")
  })

  onBeforeUnmount(() => {
    if (stopTimer) clearTimeout(stopTimer)
  })
  return {
    deliver,
    sendNow,
    sendQueued,
    enqueue,
    steer,
    stopPhase,
    editingQueueId,
    beginQueueEdit,
    commitQueueEdit,
    cancelQueueEdit,
    removeQueued,
    historyPrev: deps.draft.historyPrev,
    historyNext: deps.draft.historyNext,
    abort,
  }
}
