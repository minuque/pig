import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { createWriteStream } from "node:fs"
import { mkdir, readdir, rm, rmdir, stat, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { finished } from "node:stream/promises"
import type { PromptOptions } from "@earendil-works/pi-coding-agent"

/** SDK prompt 的图片块形状，直接从 SDK 取，避免手抄结构漂移。 */
export type PromptImage = NonNullable<PromptOptions["images"]>[number]

/** 非图片单文件上限 25MB。 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024
/** 图片单文件上限 3MB：provider 内联上限约 4.5MB base64，3MB 编码后约 4MB。 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
/** 单个 batch 最多 8 个附件。 */
export const MAX_BATCH_ITEMS = 8
/** 单个 session 的 pending 槽最多 32 个附件，防反复 bind 堆内存。 */
export const MAX_PENDING_ITEMS = 32
/** 暂存、pending 与未消费临时文件的存活时间。 */
export const ATTACHMENT_TTL_MS = 30 * 60 * 1000
/** 消费后临时文件续期到 24 小时：路径已写进会话历史，agent 可能很久之后再 read。 */
export const CONSUMED_FILE_TTL_MS = 24 * 60 * 60 * 1000
/** 兜底清理周期。 */
const SWEEP_INTERVAL_MS = 60 * 1000
/** 启动清扫的陈旧阈值：mtime 早于它的残留文件才删，避免误伤同机其他实例。 */
const STALE_FILE_MS = 30 * 60 * 1000
/** 临时文件根目录：os.tmpdir()/pig-attachments/<batch>/。 */
const ROOT_DIR = join(tmpdir(), "pig-attachments")
/** batch 来自客户端且用作目录名，只允许安全字符。 */
const BATCH_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
/** provider 只稳定吃这几种内联图片；svg/bmp/heic 走文件落盘，否则整轮会被拒。 */
const INLINE_IMAGE_PATTERN = /^image\/(png|jpeg|gif|webp)$/i
/** mimeType 会拼进 prompt 文本行，只放行 type/subtype 形状。 */
const MIME_PATTERN = /^[\w.+-]+\/[\w.+-]+$/
/** 文件名保留长度上限。 */
const MAX_NAME_LENGTH = 120
const DEFAULT_MIME = "application/octet-stream"

export type AttachmentErrorCode =
  "PAYLOAD_TOO_LARGE" | "TOO_MANY_ITEMS" | "INVALID_REQUEST" | "BATCH_NOT_FOUND"

export class AttachmentError extends Error {
  constructor(readonly code: AttachmentErrorCode) {
    super(code)
    this.name = "AttachmentError"
  }
}

/** 暂存项在字节落定前就有的身份信息；batch 标记供 discard 摘除 pending 用。 */
interface StagedIdentity {
  id: string
  name: string
  mimeType: string
  batch: string
}

interface StagedBase extends StagedIdentity {
  size: number
}

/** 非图片附件：字节已落盘，只留元数据。 */
export interface StagedFile extends StagedBase {
  kind: "file"
  path: string
}

/** 图片附件：字节留内存，交给 SDK 当 ImageContent。 */
export interface StagedImage extends StagedBase {
  kind: "image"
  data: Buffer
}

export type StagedAttachment = StagedFile | StagedImage

/** prompt 前取走、失败后放回的窄接口，PiHostSession 只依赖这两个方法。 */
export interface AttachmentSink {
  take(sessionId: string): StagedAttachment[]
  restore(sessionId: string, items: readonly StagedAttachment[]): void
}

/** batch 与 session pending 用同一形状：一堆暂存项 + 过期时间。 */
type Slot = { items: StagedAttachment[]; expiresAt: number }

export interface AttachmentStoreOptions {
  /** 清理周期；0 表示不起定时器，由调用方手动 sweep。 */
  sweepIntervalMs?: number
  /** 临时文件根目录；缺省 os.tmpdir()/pig-attachments。 */
  rootDir?: string
}

/**
 * 附件暂存：按 batch 收字节，bind 到 session 的 pending 槽，prompt 时被取走。
 * 非图片落盘（内存只留元数据），图片留内存；定时 sweep 兜底回收。
 */
export class AttachmentStore implements AttachmentSink {
  private readonly batches = new Map<string, Slot>()
  private readonly pending = new Map<string, Slot>()
  /** 临时文件路径 → 过期时间；消费后仍由它兜底删除。 */
  private readonly tempFiles = new Map<string, number>()
  private readonly rootDir: string
  private readonly timer?: ReturnType<typeof setInterval>
  /** 启动清扫进度；生产不等待，测试可 await 求确定性。 */
  readonly ready: Promise<void>

  constructor(options: AttachmentStoreOptions = {}) {
    const interval = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS

    this.rootDir = options.rootDir ?? ROOT_DIR
    this.ready = this.cleanRoot().catch(() => undefined)

    if (interval > 0) this.timer = setInterval(() => void this.sweep(), interval).unref()
  }

  /** 收一个附件；超出限额抛 AttachmentError，不留半个文件。 */
  async stage(input: {
    batch: string
    name: string
    mimeType: string
    stream: AsyncIterable<Uint8Array>
  }): Promise<{ id: string }> {
    if (!BATCH_PATTERN.test(input.batch)) throw new AttachmentError("INVALID_REQUEST")

    const staged = this.batches.get(input.batch)

    if (staged && staged.items.length >= MAX_BATCH_ITEMS)
      throw new AttachmentError("TOO_MANY_ITEMS")

    const identity: StagedIdentity = {
      id: randomUUID(),
      name: sanitizeFileName(input.name),
      mimeType: input.mimeType || DEFAULT_MIME,
      batch: input.batch,
    }
    const item = INLINE_IMAGE_PATTERN.test(identity.mimeType)
      ? await stageImage(identity, input.stream)
      : await stageFile(this.rootDir, identity, input.stream)
    // await 期间可能有同 batch 的另一次 stage 落地：回写前重读，别用旧快照覆盖丢项
    const latest = this.batches.get(input.batch)

    if (latest && latest.items.length >= MAX_BATCH_ITEMS) {
      await this.dropItem(item)
      throw new AttachmentError("TOO_MANY_ITEMS")
    }

    this.batches.set(input.batch, {
      items: [...(latest?.items ?? []), item],
      expiresAt: Date.now() + ATTACHMENT_TTL_MS,
    })

    if (item.kind === "file") this.tempFiles.set(item.path, Date.now() + ATTACHMENT_TTL_MS)
    return { id: identity.id }
  }

  /**
   * 把 batch 的暂存项追加进 session 的 pending 槽。
   * 重复 bind 同一 batch 回 BATCH_NOT_FOUND：batch 已被取走或过期，让客户端看见暂存失败。
   */
  bind(sessionId: string, batch: string): void {
    const record = this.batches.get(batch)

    if (!record) throw new AttachmentError("BATCH_NOT_FOUND")
    const slot = this.pending.get(sessionId)
    const items = [...(slot?.items ?? []), ...record.items]

    if (items.length > MAX_PENDING_ITEMS) throw new AttachmentError("TOO_MANY_ITEMS")
    this.batches.delete(batch)

    // 文件改由 pending 看管：续期，避免还在等 prompt 就被 sweep 删掉
    for (const item of record.items) this.touch(item, ATTACHMENT_TTL_MS)
    this.pending.set(sessionId, { items, expiresAt: Date.now() + ATTACHMENT_TTL_MS })
  }

  /** 取出并清空该 session 的 pending；文件按消费后 TTL 续期，交给 sweep 回收。 */
  take(sessionId: string): StagedAttachment[] {
    const slot = this.pending.get(sessionId)

    if (!slot) return []
    this.pending.delete(sessionId)

    for (const item of slot.items) this.touch(item, CONSUMED_FILE_TTL_MS)
    return slot.items
  }

  /** prompt 失败时把取出的附件放回槽首，避免附件静默丢失。 */
  restore(sessionId: string, items: readonly StagedAttachment[]): void {
    if (!items.length) return
    const slot = this.pending.get(sessionId)

    for (const item of items) this.touch(item, ATTACHMENT_TTL_MS)
    this.pending.set(sessionId, {
      items: [...items, ...(slot?.items ?? [])],
      expiresAt: Date.now() + ATTACHMENT_TTL_MS,
    })
  }

  /** 前端补偿路径：丢弃未 bind 的 batch，并摘掉 pending 里属于它的项与临时文件。 */
  async discard(batch: string): Promise<void> {
    const dropped = [...(this.batches.get(batch)?.items ?? [])]

    this.batches.delete(batch)

    for (const [sessionId, slot] of this.pending) {
      const kept = slot.items.filter((item) => item.batch !== batch)

      if (kept.length === slot.items.length) continue
      dropped.push(...slot.items.filter((item) => item.batch === batch))

      if (kept.length) this.pending.set(sessionId, { items: kept, expiresAt: slot.expiresAt })
      else this.pending.delete(sessionId)
    }

    await Promise.all(dropped.map((item) => this.dropItem(item)))
  }

  /** 会话被删除：丢弃 pending 并删掉它的临时文件。 */
  async clearSession(sessionId: string): Promise<void> {
    const slot = this.pending.get(sessionId)

    this.pending.delete(sessionId)
    await Promise.all((slot?.items ?? []).map((item) => this.dropItem(item)))
  }

  /** 兜底清理：过期 batch / pending 丢弃，过期临时文件删除。now 可注入便于测试。 */
  async sweep(now = Date.now()): Promise<void> {
    for (const [batch, record] of this.batches) {
      if (record.expiresAt <= now) this.batches.delete(batch)
    }

    for (const [sessionId, slot] of this.pending) {
      if (slot.expiresAt <= now) this.pending.delete(sessionId)
    }

    await Promise.all(
      [...this.tempFiles]
        .filter(([, expiresAt]) => expiresAt <= now)
        .map(([path]) => this.dropFile(path)),
    )
  }

  /** 停服：清定时器，删掉本实例登记但还没过期的临时文件。 */
  async dispose(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await Promise.all([...this.tempFiles.keys()].map((path) => this.dropFile(path)))
  }

  /** 启动清扫：删掉 mtime 过旧的残留文件，顺手收掉空的 batch 目录。 */
  private async cleanRoot(now = Date.now()): Promise<void> {
    for (const entry of await readdir(this.rootDir, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue
      const dir = join(this.rootDir, entry.name)

      for (const file of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const path = join(dir, file.name)
        const info = await stat(path).catch(() => undefined)

        if (info && info.mtimeMs >= now - STALE_FILE_MS) continue
        await rm(path, { force: true })
      }

      await rmdir(dir).catch(() => undefined)
    }
  }

  private touch(item: StagedAttachment, ttl: number): void {
    if (item.kind === "file" && this.tempFiles.has(item.path))
      this.tempFiles.set(item.path, Date.now() + ttl)
  }

  private dropItem(item: StagedAttachment): Promise<void> {
    return item.kind === "file" ? this.dropFile(item.path) : Promise.resolve()
  }

  /** 删文件并顺手收掉空的 batch 目录；目录非空时 rmdir 失败可忽略。 */
  private async dropFile(path: string): Promise<void> {
    this.tempFiles.delete(path)
    await rm(path, { force: true })
    await rmdir(dirname(path)).catch(() => undefined)
  }
}

/**
 * 图片转 SDK ImageContent；非图片文件以 <attached_files> 文本块追加到 prompt 末尾，
 * 让 agent 用自己的 read 工具按绝对路径读取。
 */
export function composePrompt(
  text: string,
  staged: readonly StagedAttachment[],
): { text: string; images: PromptImage[] } {
  const images: PromptImage[] = []
  const files: StagedFile[] = []

  for (const item of staged) {
    if (item.kind === "image") {
      images.push({ type: "image", data: item.data.toString("base64"), mimeType: item.mimeType })
    } else {
      files.push(item)
    }
  }

  if (!files.length) return { text, images }

  const lines = files.map(
    (file) => `- ${file.name} — ${file.mimeType} — ${file.size} — ${file.path}`,
  )
  return { text: `${text}\n\n<attached_files>\n${lines.join("\n")}\n</attached_files>`, images }
}

/** 去掉路径分隔符与 Windows 保留字符，保留中文与空格；结果为空时退回占位名。 */
export function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
  return cleaned || "attachment"
}

/** mimeType 会拼进 prompt 文本行，不合形状的退回默认值，不回错以免破坏上传体验。 */
export function sanitizeMimeType(raw: string): string {
  return MIME_PATTERN.test(raw) ? raw : DEFAULT_MIME
}

async function stageImage(
  base: StagedIdentity,
  stream: AsyncIterable<Uint8Array>,
): Promise<StagedImage> {
  const chunks: Uint8Array[] = []
  let size = 0

  for await (const chunk of readBounded(stream, MAX_IMAGE_BYTES)) {
    size += chunk.length
    chunks.push(chunk)
  }

  return { ...base, kind: "image", size, data: Buffer.concat(chunks) }
}

async function stageFile(
  rootDir: string,
  base: StagedIdentity,
  stream: AsyncIterable<Uint8Array>,
): Promise<StagedFile> {
  const dir = join(rootDir, base.batch)
  const path = join(dir, `${base.id.slice(0, 8)}-${base.name}`)

  await mkdir(dir, { recursive: true })
  const sink = createWriteStream(path)
  let size = 0

  try {
    // 等 open 落地：文件不存在时 rm 是空操作，会留下半成品
    await once(sink, "open")

    for await (const chunk of readBounded(stream, MAX_FILE_BYTES)) {
      size += chunk.length

      if (!sink.write(chunk)) await once(sink, "drain")
    }

    sink.end()
    await finished(sink)
  } catch (error) {
    sink.destroy()
    await rm(path, { force: true })
    // 顺带收掉失败留下的空 batch 目录；同 batch 有别的文件时 rmdir 失败可忽略
    await rmdir(dir).catch(() => undefined)
    throw error
  }

  return { ...base, kind: "file", size, path }
}

/**
 * 边读边计数，超限抛 PAYLOAD_TOO_LARGE。
 * 手写迭代而不 for await：提前 return() 会销毁请求流并掐断连接，413 就回不到客户端。
 */
async function* readBounded(
  stream: AsyncIterable<Uint8Array>,
  limit: number,
): AsyncGenerator<Uint8Array> {
  const iterator = stream[Symbol.asyncIterator]()
  let size = 0

  for (;;) {
    const next = await iterator.next()

    if (next.done) return
    size += next.value.length

    if (size > limit) throw new AttachmentError("PAYLOAD_TOO_LARGE")
    yield next.value
  }
}
