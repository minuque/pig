import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { createWriteStream } from "node:fs"
import { mkdir, readdir, rm, rmdir, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { finished } from "node:stream/promises"
import type { PromptOptions } from "@earendil-works/pi-coding-agent"
import {
  INLINE_IMAGE_PATTERN,
  MAX_BATCH_ITEMS,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
} from "@pig/protocol"

/** SDK prompt 的图片块形状，直接从 SDK 取，避免手抄结构漂移。 */
export type PromptImage = NonNullable<PromptOptions["images"]>[number]

export const ATTACHMENT_TTL_MS = 30 * 60 * 1000
export const CONSUMED_FILE_TTL_MS = 24 * 60 * 60 * 1000
/** 兜底清理周期。 */
const SWEEP_INTERVAL_MS = 60 * 1000
const STALE_FILE_MS = 30 * 60 * 1000
const ROOT_DIR = join(tmpdir(), "pig-attachments")
const BATCH_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const MIME_PATTERN = /^[\w.+-]+\/[\w.+-]+$/
const MAX_NAME_LENGTH = 120
const DEFAULT_MIME = "application/octet-stream"

export type AttachmentErrorCode = "PAYLOAD_TOO_LARGE" | "TOO_MANY_ITEMS" | "INVALID_REQUEST"

export class AttachmentError extends Error {
  constructor(readonly code: AttachmentErrorCode) {
    super(code)
    this.name = "AttachmentError"
  }
}

interface StagedIdentity {
  id: string
  name: string
  mimeType: string
  batch: string
}

interface StagedBase extends StagedIdentity {
  size: number
}

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

export interface AttachmentSink {
  take(batch: string): StagedAttachment[] | undefined
  restore(batch: string, items: readonly StagedAttachment[]): void
}

type Slot = { items: StagedAttachment[]; expiresAt: number }

export interface AttachmentStoreOptions {
  sweepIntervalMs?: number
  rootDir?: string
}

export class AttachmentStore implements AttachmentSink {
  private readonly batches = new Map<string, Slot>()
  private readonly tempFiles = new Map<string, number>()
  private readonly rootDir: string
  private readonly timer?: ReturnType<typeof setInterval>
  readonly ready: Promise<void>

  constructor(options: AttachmentStoreOptions = {}) {
    const interval = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS

    this.rootDir = options.rootDir ?? ROOT_DIR
    this.ready = this.cleanRoot().catch(() => undefined)

    if (interval > 0) this.timer = setInterval(() => void this.sweep(), interval).unref()
  }

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

  take(batch: string): StagedAttachment[] | undefined {
    const record = this.batches.get(batch)

    if (!record) return undefined
    this.batches.delete(batch)

    for (const item of record.items) this.touch(item, CONSUMED_FILE_TTL_MS)
    return record.items
  }

  restore(batch: string, items: readonly StagedAttachment[]): void {
    if (!items.length) return
    const existing = this.batches.get(batch)

    for (const item of items) this.touch(item, ATTACHMENT_TTL_MS)
    this.batches.set(batch, {
      items: [...items, ...(existing?.items ?? [])],
      expiresAt: Date.now() + ATTACHMENT_TTL_MS,
    })
  }

  async discard(batch: string): Promise<void> {
    const dropped = this.batches.get(batch)?.items ?? []

    this.batches.delete(batch)
    await Promise.all(dropped.map((item) => this.dropItem(item)))
  }

  async sweep(now = Date.now()): Promise<void> {
    for (const [batch, record] of this.batches) {
      if (record.expiresAt <= now) this.batches.delete(batch)
    }

    await Promise.all(
      [...this.tempFiles]
        .filter(([, expiresAt]) => expiresAt <= now)
        .map(([path]) => this.dropFile(path)),
    )
  }

  async dispose(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await Promise.all([...this.tempFiles.keys()].map((path) => this.dropFile(path)))
  }

  private async cleanRoot(now = Date.now()): Promise<void> {
    const staleBefore = now - STALE_FILE_MS

    for (const entry of await readdir(this.rootDir, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue
      const dir = join(this.rootDir, entry.name)
      const dirInfo = await stat(dir).catch(() => undefined)

      if (!dirInfo) continue
      const dirIsStale = dirInfo.mtimeMs < staleBefore

      for (const file of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const path = join(dir, file.name)
        const info = await stat(path).catch(() => undefined)

        if (!info || info.mtimeMs >= staleBefore) continue
        await rm(path, { force: true })
      }

      if (dirIsStale) await rmdir(dir).catch(() => undefined)
    }
  }

  private touch(item: StagedAttachment, ttl: number): void {
    if (item.kind === "file" && this.tempFiles.has(item.path))
      this.tempFiles.set(item.path, Date.now() + ttl)
  }

  private dropItem(item: StagedAttachment): Promise<void> {
    return item.kind === "file" ? this.dropFile(item.path) : Promise.resolve()
  }

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
