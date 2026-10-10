import { computed, getCurrentInstance, onUnmounted, ref, shallowRef, type Ref } from "vue"
import { t } from "@i18n/index.js"
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
  /** 逐文件回写上传进度 0–100，undefined 表示已落地；由 consumeForSend 注入。 */
  reportProgress?(id: string, progress: number | undefined): void
}

export interface ComposerAttachmentsApi {
  files: Ref<ComposerAttachment[]>
  /** 发送中各附件的上传进度 0–100；无此项即未在上传/已落地。 */
  progress: Ref<ReadonlyMap<string, number>>
  /** 上一次附加被跳过的文件与原因；空串表示没有。 */
  error: Ref<string>
  addFiles(input: FileList | File[] | null | undefined): void
  /** 拖入的文件：文件夹跳过并提示，其余走 addFiles。 */
  addDropped(data: DataTransfer | null | undefined): void
  remove(id: string): void
  /** 本次发送要上传的批次；没有附件返回 undefined。成功后由调用方 settle()。 */
  consumeForSend(): ComposerAttachmentBatch | undefined
  /** 从批次来源的桶里只移走这批文件，期间新加的留着。 */
  settle(batch: ComposerAttachmentBatch): void
  /** 附件暂存按会话分桶（welcome 传 undefined），切走再回来还在。 */
  setKey(sessionId: string | undefined): void
}

interface AttachmentStash {
  files: Ref<ComposerAttachment[]>
  error: Ref<string>
  /** 各附件的上传进度 0–100；落地即删键。加附件时是模拟，发送时被真实 stage 接管。 */
  progress: Ref<Map<string, number>>
  /** 模拟上传计时器，按附件 id 记；remove/settle/bucket 释放时清。 */
  simTimers: Map<string, ReturnType<typeof setTimeout>>
}

/** 模拟上传的节奏：单个约 1.1s，新加文件排到队尾。 */
const SIM_STEP_MS = 50
const SIM_DURATION_MS = 1100
const SIM_GAP_MS = 240

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
    () => ({
      files: shallowRef([]),
      error: ref(""),
      progress: ref(new Map()),
      simTimers: new Map(),
    }),
    (stash) => {
      stash.simTimers.forEach((timer) => globalThis.clearTimeout(timer))
      stash.files.value.forEach(release)
    },
  )
  const bucket = buckets.current
  // 批次记住来源桶：欢迎页发送后路由已切到新会话，仍要清欢迎页那桶
  const sources = new WeakMap<ComposerAttachmentBatch, AttachmentStash>()
  const files = computed(() => bucket().files.value)
  const error = computed(() => bucket().error.value)
  const progress = computed(() => bucket().progress.value)

  function release(item: ComposerAttachment) {
    if (item.url) URL.revokeObjectURL(item.url)
  }

  /** 统一写某个桶的进度；Map 整体换引用才能过 shallowRef。 */
  function writeProgress(stash: AttachmentStash, id: string, value: number | undefined) {
    const next = new Map(stash.progress.value)

    if (value === undefined) next.delete(id)
    else next.set(id, value)
    stash.progress.value = next
  }

  /** 停掉某个附件的模拟计时器（remove / 发送接管时调）。 */
  function stopSim(stash: AttachmentStash, id: string) {
    const timer = stash.simTimers.get(id)

    if (timer !== undefined) globalThis.clearTimeout(timer)
    stash.simTimers.delete(id)
  }

  /**
   * 模拟上传：逐个落地，节奏与 BoardUI 一致（时长 + 间隔，进度带随机抖动）。
   * head 是当前在画环的那个；跑到 100 清键算落地，停一拍再带下一个。
   */
  function runSim(stash: AttachmentStash, head: ComposerAttachment) {
    let shown = Math.max(0, stash.progress.value.get(head.id) ?? 0)
    const step = 100 / Math.max(1, SIM_DURATION_MS / SIM_STEP_MS)
    const tick = () => {
      shown = Math.min(100, shown + step * (0.55 + 0.9 * Math.random()))

      if (shown < 100) {
        writeProgress(stash, head.id, Math.round(shown))
        stash.simTimers.set(head.id, globalThis.setTimeout(tick, SIM_STEP_MS))
        return
      }

      writeProgress(stash, head.id, undefined)
      stash.simTimers.delete(head.id)
      stash.simTimers.set(
        head.id,
        globalThis.setTimeout(() => {
          stash.simTimers.delete(head.id)
          pumpSim(stash)
        }, SIM_GAP_MS),
      )
    }

    stash.simTimers.set(head.id, globalThis.setTimeout(tick, SIM_STEP_MS))
  }

  /** 找第一个还在模拟中的文件接着跑；没有就空转。 */
  function pumpSim(stash: AttachmentStash) {
    const next = stash.files.value.find((item) => stash.progress.value.has(item.id))

    if (next && !stash.simTimers.has(next.id)) runSim(stash, next)
  }

  /** 新加的文件标 progress=0 进队列；只在上一个落地后才轮到自己。 */
  function startSim(stash: AttachmentStash, items: ComposerAttachment[]) {
    for (const item of items) writeProgress(stash, item.id, 0)
    pumpSim(stash)
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
      const image = IMAGE_MIME_PATTERN.test(mimeType)
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
      startSim(stash, added)
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

    stopSim(stash, id)
    writeProgress(stash, id, undefined)

    for (const item of stash.files.value) {
      if (item.id === id) release(item)
      else kept.push(item)
    }

    stash.files.value = kept
    // 被移走的是队首时，把下一个还在等模拟的接上
    pumpSim(stash)
  }

  function consumeForSend(): ComposerAttachmentBatch | undefined {
    const stash = bucket()

    if (!stash.files.value.length) return undefined

    // 真实 stage 接管同一份进度：这批文件里还在模拟的全部停掉
    for (const item of stash.files.value) stopSim(stash, item.id)
    stash.simTimers.clear()

    // 每次发送换新 batch：重试不会往上次的批次里追加，去重移除也真的生效
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
    stash.simTimers.forEach((timer) => globalThis.clearTimeout(timer))
    stash.simTimers.clear()
  }

  if (getCurrentInstance()) onUnmounted(() => buckets.clearAll())
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
  }
}
