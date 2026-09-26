import { computed, getCurrentInstance, onUnmounted, ref, shallowRef, type Ref } from "vue"
import { useSessionBuckets } from "@features/composer/hooks/use-session-buckets.js"

/** 单个 batch 的附件数上限，与 Gateway 的 MAX_BATCH_ITEMS 对齐。 */
export const MAX_COMPOSER_ATTACHMENTS = 8
/** 单张图片上限：图片直接进 SDK images，比普通文件保守得多。 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
/** 单个非图片文件上限，与 Gateway 的 MAX_ATTACHMENT_BYTES 对齐。 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024
const MEGABYTE = 1024 * 1024
/** provider 只稳吃这几种位图，其余（svg / bmp / heic）当普通文件，避免整轮 prompt 失败。 */
const IMAGE_MIME_PATTERN = /^image\/(png|jpeg|gif|webp)$/i

export interface ComposerAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  /** 白名单图片的预览 blob URL；其余为空串，只渲染文件卡片。 */
  url: string
  file: File
}

/** 一次发送要上传的附件：batch id 与当时的文件快照。 */
export interface ComposerAttachmentBatch {
  batch: string
  files: ComposerAttachment[]
}

export interface ComposerAttachmentsApi {
  files: Ref<ComposerAttachment[]>
  /** 上一次附加被跳过的文件与原因；空串表示没有。 */
  error: Ref<string>
  addFiles(input: FileList | File[] | null | undefined): void
  /** 拖入的文件：文件夹跳过并提示，其余走 addFiles。 */
  addDropped(data: DataTransfer | null | undefined): void
  remove(id: string): void
  clear(): void
  /** 本次发送要上传的批次；没有附件返回 undefined。成功后由调用方 clear()。 */
  consumeForSend(): ComposerAttachmentBatch | undefined
  /** 附件暂存按会话分桶（welcome 传 undefined），切走再回来还在。 */
  setKey(sessionId: string | undefined): void
}

interface AttachmentStash {
  files: Ref<ComposerAttachment[]>
  error: Ref<string>
}

/** 去重键：同名同大小同类型视为同一个文件。 */
function attachmentKey(file: File): string {
  return `${file.name}\0${file.size}\0${file.type}`
}

function displayName(file: File): string {
  return file.name || "attachment"
}

/** 剪贴板两路（files / items）收集后按去重键合并；没有文件返回空。 */
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

/**
 * 输入卡本地附件：白名单图片走 blob URL 预览，其余只留文件卡片。
 * 附件按会话暂存在内存，发送时由 sendPrompt 顺序 stage 每个文件再 bind。
 */
export function useComposerAttachments(): ComposerAttachmentsApi {
  // 附件按会话暂存；卸载时释放 blob URL
  const buckets = useSessionBuckets<AttachmentStash>(
    () => ({ files: shallowRef([]), error: ref("") }),
    (stash) => stash.files.value.forEach(release),
  )
  const bucket = buckets.current
  const files = computed(() => bucket().files.value)
  const error = computed(() => bucket().error.value)

  function release(item: ComposerAttachment) {
    if (item.url) URL.revokeObjectURL(item.url)
  }

  function apply(input: FileList | File[] | null | undefined, folders: readonly string[]) {
    const stash = bucket()
    const skipped = folders.map((name) => ({ name, reason: "文件夹不支持" }))
    const current = stash.files.value
    const keys = new Set(current.map((item) => attachmentKey(item.file)))
    const added: ComposerAttachment[] = []

    for (const file of input ? Array.from(input) : []) {
      const key = attachmentKey(file)

      if (keys.has(key)) continue

      if (current.length + added.length >= MAX_COMPOSER_ATTACHMENTS) {
        skipped.push({ name: displayName(file), reason: `最多 ${MAX_COMPOSER_ATTACHMENTS} 个附件` })
        continue
      }

      const mimeType = file.type || "application/octet-stream"
      const image = IMAGE_MIME_PATTERN.test(mimeType)
      const limit = image ? MAX_IMAGE_BYTES : MAX_FILE_BYTES

      if (file.size > limit) {
        skipped.push({ name: displayName(file), reason: `超过 ${limit / MEGABYTE}MB` })
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

    if (added.length) stash.files.value = [...current, ...added]
    stash.error.value = skipped.length
      ? `已跳过 ${skipped.map((item) => `${item.name}（${item.reason}）`).join("、")}`
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

    for (const item of stash.files.value) {
      if (item.id === id) release(item)
      else kept.push(item)
    }

    stash.files.value = kept
  }

  function clear() {
    const stash = bucket()

    for (const item of stash.files.value) release(item)
    stash.files.value = []
    stash.error.value = ""
  }

  function consumeForSend(): ComposerAttachmentBatch | undefined {
    const stash = bucket()

    if (!stash.files.value.length) return undefined
    // 每次发送换新 batch：重试不会往上次的批次里追加，去重移除也真的生效
    return { batch: crypto.randomUUID(), files: [...stash.files.value] }
  }

  if (getCurrentInstance()) onUnmounted(() => buckets.clearAll())
  return {
    files,
    error,
    addFiles,
    addDropped,
    remove,
    clear,
    consumeForSend,
    setKey: buckets.setKey,
  }
}
