import { computed, getCurrentInstance, onUnmounted, ref, shallowRef, type Ref } from "vue"
import {
  INLINE_IMAGE_MIME_PATTERN,
  MAX_BATCH_ITEMS,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
} from "@pig/protocol"
import type { ComposerAttachment, ComposerAttachmentBatch } from "@/types/attachment-type.js"
import { t } from "@i18n/index.js"
import { useSessionBuckets } from "@features/composer/hooks/use-session-buckets.js"

export { MAX_FILE_BYTES, MAX_IMAGE_BYTES }

export const MAX_COMPOSER_ATTACHMENTS = MAX_BATCH_ITEMS
const MEGABYTE = 1024 * 1024

export interface ComposerAttachmentsApi {
  files: Ref<ComposerAttachment[]>
  progress: Ref<ReadonlyMap<string, number>>
  error: Ref<string>
  addFiles(input: FileList | File[] | null | undefined): void
  addDropped(data: DataTransfer | null | undefined): void
  remove(id: string): void
  consumeForSend(): ComposerAttachmentBatch | undefined
  settle(batch: ComposerAttachmentBatch): void
  setKey(sessionId: string | undefined): void
  handOff(sessionId: string): void
}

interface AttachmentStash {
  files: Ref<ComposerAttachment[]>
  error: Ref<string>
  progress: Ref<Map<string, number>>
}

function attachmentKey(file: File): string {
  return `${file.name}\0${file.size}\0${file.type}`
}

function displayName(file: File): string {
  return file.name || "attachment"
}

export function clipboardFiles(data: DataTransfer | null | undefined): File[] {
  if (!data) return []
  const seen = new Set<string>()
  const picked: File[] = []
  const push = (file: File | null | undefined) => {
    if (!file || seen.has(attachmentKey(file))) return
    seen.add(attachmentKey(file))
    picked.push(file)
  }

  for (const file of Array.from(data.files)) push(file)

  for (const item of Array.from(data.items)) {
    if (item.kind === "file") push(item.getAsFile())
  }

  return picked
}

export function useComposerAttachments(): ComposerAttachmentsApi {
  const buckets = useSessionBuckets<AttachmentStash>(
    () => ({
      files: shallowRef([]),
      error: ref(""),
      progress: ref(new Map()),
    }),
    (stash) => stash.files.value.forEach(release),
    "attachments",
  )
  const bucket = buckets.current
  const sources = new WeakMap<ComposerAttachmentBatch, AttachmentStash>()
  const files = computed(() => bucket().files.value)
  const error = computed(() => bucket().error.value)
  const progress = computed(() => bucket().progress.value)

  function release(item: ComposerAttachment) {
    if (item.url) URL.revokeObjectURL(item.url)
  }

  function writeProgress(stash: AttachmentStash, id: string, value: number | undefined) {
    const next = new Map(stash.progress.value)

    if (value === undefined) next.delete(id)
    else next.set(id, value)
    stash.progress.value = next
  }

  function apply(input: FileList | File[] | null | undefined, folders: readonly string[]) {
    const stash = bucket()
    const skipped = folders.map((name) => ({
      name,
      reason: t("composer.folderNotSupported"),
    }))
    const current = stash.files.value
    const keys = new Set(current.map((item) => attachmentKey(item.file)))
    const added: ComposerAttachment[] = []

    for (const file of input ? Array.from(input) : []) {
      const key = attachmentKey(file)

      if (keys.has(key)) continue

      if (current.length + added.length >= MAX_COMPOSER_ATTACHMENTS) {
        skipped.push({
          name: displayName(file),
          reason: t("composer.maxAttachments", { count: MAX_COMPOSER_ATTACHMENTS }),
        })
        continue
      }

      const mimeType = file.type || "application/octet-stream"
      const image = INLINE_IMAGE_MIME_PATTERN.test(mimeType)
      const limit = image ? MAX_IMAGE_BYTES : MAX_FILE_BYTES

      if (file.size > limit) {
        skipped.push({
          name: displayName(file),
          reason: t("composer.overSize", { size: limit / MEGABYTE }),
        })
        continue
      }

      keys.add(key)
      added.push({
        id: crypto.randomUUID(),
        name: displayName(file),
        mimeType,
        size: file.size,
        url: image ? URL.createObjectURL(file) : "",
        file,
      })
    }

    if (added.length) {
      stash.files.value = [...current, ...added]
    }

    stash.error.value = skipped.length
      ? t("composer.attachmentSkipped", {
          list: skipped.map((item) => `${item.name}（${item.reason}）`).join("、"),
        })
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
      batch: crypto.randomUUID(),
      files: [...stash.files.value],
      reportProgress: (id, value) => writeProgress(stash, id, value),
    }

    sources.set(batch, stash)
    return batch
  }

  function settle(batch: ComposerAttachmentBatch) {
    const stash = sources.get(batch)

    if (!stash) return
    sources.delete(batch)
    const sent = new Set(batch.files.map((item) => item.id))
    const kept: ComposerAttachment[] = []

    for (const item of stash.files.value) {
      if (sent.has(item.id)) release(item)
      else kept.push(item)
    }

    stash.files.value = kept
    stash.error.value = ""
    stash.progress.value = new Map()
  }

  if (getCurrentInstance() && !buckets.shared) onUnmounted(() => buckets.clearAll())
  return {
    files,
    progress,
    error,
    addFiles,
    addDropped,
    remove,
    consumeForSend,
    settle,
    setKey: buckets.setKey,
    handOff: buckets.handOff,
  }
}
