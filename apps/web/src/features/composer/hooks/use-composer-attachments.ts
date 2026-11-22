import { computed, getCurrentInstance, onUnmounted, ref, shallowRef, type Ref } from "vue"
import { MAX_FILE_BYTES, MAX_IMAGE_BYTES } from "@pig/protocol"
import type { ComposerAttachment, ComposerAttachmentBatch } from "@/types/attachment-type.js"
import { errorMessage } from "@client/http.js"
import { stageAttachment } from "@client/platform.js"
import { t } from "@i18n/index.js"
import {
  failedAt,
  replaceUpload,
  stagedIds,
  uploadAt,
  uploadErrors,
  uploadPercent,
  uploadStatus,
  type AttachmentStatus,
  type AttachmentUpload,
  type AttachmentUploads,
} from "@features/composer/lib/attachment-upload.js"
import {
  selectAttachments,
  type PickedFile,
  type SkippedFile,
} from "@features/composer/lib/attachment-select.js"
import { useSessionBuckets } from "@features/composer/hooks/use-session-buckets.js"

export { MAX_FILE_BYTES, MAX_IMAGE_BYTES }

export {
  clipboardFiles,
  MAX_COMPOSER_ATTACHMENTS,
} from "@features/composer/lib/attachment-select.js"

export type { AttachmentStatus } from "@features/composer/lib/attachment-upload.js"

const COMPLETE = 100

export interface ComposerAttachmentsApi {
  files: Ref<ComposerAttachment[]>
  status: Ref<Record<string, AttachmentStatus>>
  progress: Ref<Record<string, number>>
  errors: Ref<Record<string, string>>
  error: Ref<string>
  addFiles(input: FileList | File[] | null | undefined): void
  addDropped(data: DataTransfer | null | undefined): void
  remove(id: string): void
  consumeForSend(): ComposerAttachmentBatch | undefined
  detach(batch: ComposerAttachmentBatch): void
  settle(batch: ComposerAttachmentBatch): void
  retryItem(id: string): void
  dismissError(): void
  setKey(sessionId: string | undefined): void
  handOff(sessionId: string): void
}

interface AttachmentStash {
  files: Ref<ComposerAttachment[]>
  error: Ref<string>
  uploads: Ref<AttachmentUploads>
  batch: string
}

function release(item: ComposerAttachment) {
  if (item.url) URL.revokeObjectURL(item.url)
}

function skipText(item: SkippedFile): string {
  const reason = item.reason

  if (reason.kind === "folder") return `${item.name}（${t("composer.folderNotSupported")}）`

  if (reason.kind === "count")
    return `${item.name}（${t("composer.maxAttachments", { count: reason.count })}）`
  return `${item.name}（${t("composer.overSize", { size: reason.size })}）`
}

function toAttachment(picked: PickedFile): ComposerAttachment {
  return {
    id: crypto.randomUUID(),
    name: picked.name,
    mimeType: picked.mimeType,
    size: picked.size,
    url: picked.image ? URL.createObjectURL(picked.file) : "",
    file: picked.file,
  }
}

export function useComposerAttachments(): ComposerAttachmentsApi {
  const buckets = useSessionBuckets<AttachmentStash>(
    () => ({
      files: shallowRef([]),
      error: ref(""),
      uploads: ref<AttachmentUploads>({}),
      batch: crypto.randomUUID(),
    }),
    (stash) => stash.files.value.forEach(release),
    "attachments",
  )
  const bucket = buckets.current
  const sources = new WeakMap<ComposerAttachmentBatch, AttachmentStash>()
  const files = computed(() => bucket().files.value)
  const error = computed(() => bucket().error.value)
  const status = computed(() => uploadStatus(bucket().uploads.value))
  const progress = computed(() => uploadPercent(bucket().uploads.value))
  const errors = computed(() => uploadErrors(bucket().uploads.value))

  function writeUpload(stash: AttachmentStash, id: string, next: AttachmentUpload | undefined) {
    stash.uploads.value = replaceUpload(stash.uploads.value, id, next)
  }

  function writeProgress(stash: AttachmentStash, id: string, value: number | undefined) {
    writeUpload(stash, id, value === undefined ? undefined : uploadAt(value))
  }

  function apply(input: FileList | File[] | null | undefined, folders: readonly string[]) {
    const stash = bucket()
    const current = stash.files.value
    const { picked, skipped } = selectAttachments(input ? Array.from(input) : [], current, folders)

    if (picked.length) stash.files.value = [...current, ...picked.map(toAttachment)]

    stash.error.value = skipped.length
      ? t("composer.attachmentSkipped", { list: skipped.map(skipText).join("、") })
      : ""
  }

  function addFiles(input: FileList | File[] | null | undefined) {
    apply(input, [])
  }

  function addDropped(data: DataTransfer | null | undefined) {
    if (!data) return
    const entries = Array.from(data.items).filter((item) => item.kind === "file")

    if (!entries.length) {
      addFiles(data.files)
      return
    }

    const picked: File[] = []
    const folders: string[] = []

    for (const item of entries) {
      const entry = item.webkitGetAsEntry?.()

      if (entry?.isDirectory) {
        folders.push(entry.name)
        continue
      }

      const file = item.getAsFile()

      if (file) picked.push(file)
    }

    apply(picked, folders)
  }

  function remove(id: string) {
    const stash = bucket()
    const kept: ComposerAttachment[] = []

    writeProgress(stash, id, undefined)

    for (const item of stash.files.value) {
      if (item.id === id) release(item)
      else kept.push(item)
    }

    stash.files.value = kept
  }

  function consumeForSend(): ComposerAttachmentBatch | undefined {
    const stash = bucket()

    if (!stash.files.value.length) return undefined

    const batch: ComposerAttachmentBatch = {
      batch: stash.batch,
      files: [...stash.files.value],
      staged: stagedIds(stash.uploads.value),
      reportProgress: (id, value) => writeProgress(stash, id, value),
      reportError: (id, message) =>
        writeUpload(stash, id, failedAt(stash.uploads.value[id], message)),
    }

    stash.batch = crypto.randomUUID()
    sources.set(batch, stash)
    return batch
  }

  function detachFrom(stash: AttachmentStash, batch: ComposerAttachmentBatch) {
    const sent = new Set(batch.files.map((item) => item.id))

    stash.files.value = stash.files.value.filter((item) => !sent.has(item.id))
    stash.error.value = ""
    stash.uploads.value = {}
    stash.batch = crypto.randomUUID()
  }

  function settle(batch: ComposerAttachmentBatch) {
    const stash = sources.get(batch)

    sources.delete(batch)
    batch.files.forEach(release)

    if (stash) detachFrom(stash, batch)
  }

  function detach(batch: ComposerAttachmentBatch) {
    const stash = sources.get(batch)

    if (stash) detachFrom(stash, batch)
  }

  async function stageItem(stash: AttachmentStash, item: ComposerAttachment) {
    writeProgress(stash, item.id, 0)

    try {
      await stageAttachment(stash.batch, item.file, {
        onProgress: (ratio) => writeProgress(stash, item.id, ratio * COMPLETE),
      })
      writeProgress(stash, item.id, COMPLETE)
    } catch (failure) {
      writeUpload(stash, item.id, failedAt(stash.uploads.value[item.id], errorMessage(failure)))
    }
  }

  function retryItem(id: string) {
    const stash = bucket()
    const item = stash.files.value.find((entry) => entry.id === id)
    const state = stash.uploads.value[id]?.status

    if (!item || state === "ready" || state === "uploading") return
    void stageItem(stash, item)
  }

  function dismissError() {
    bucket().error.value = ""
  }

  if (getCurrentInstance() && !buckets.shared) onUnmounted(() => buckets.clearAll())
  return {
    files,
    status,
    progress,
    errors,
    error,
    addFiles,
    addDropped,
    remove,
    consumeForSend,
    detach,
    settle,
    retryItem,
    dismissError,
    setKey: buckets.setKey,
    handOff: buckets.handOff,
  }
}
