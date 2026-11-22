import {
  INLINE_IMAGE_MIME_PATTERN,
  MAX_BATCH_ITEMS,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
} from "@pig/protocol"
import type { ComposerAttachment } from "@/types/attachment-type.js"

export const MAX_COMPOSER_ATTACHMENTS = MAX_BATCH_ITEMS
const MEGABYTE = 1024 * 1024

export type SkipReason =
  { kind: "folder" } | { kind: "count"; count: number } | { kind: "size"; size: number }

export interface SkippedFile {
  name: string
  reason: SkipReason
}

export interface PickedFile {
  name: string
  mimeType: string
  size: number
  image: boolean
  file: File
}

export function attachmentKey(file: File): string {
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

export function selectAttachments(
  input: readonly File[],
  current: readonly ComposerAttachment[],
  folders: readonly string[],
): { picked: PickedFile[]; skipped: SkippedFile[] } {
  const skipped: SkippedFile[] = folders.map((name) => ({ name, reason: { kind: "folder" } }))
  const keys = new Set(current.map((item) => attachmentKey(item.file)))
  const picked: PickedFile[] = []

  for (const file of input) {
    const key = attachmentKey(file)

    if (keys.has(key)) continue

    if (current.length + picked.length >= MAX_COMPOSER_ATTACHMENTS) {
      skipped.push({
        name: displayName(file),
        reason: { kind: "count", count: MAX_COMPOSER_ATTACHMENTS },
      })
      continue
    }

    const mimeType = file.type || "application/octet-stream"
    const image = INLINE_IMAGE_MIME_PATTERN.test(mimeType)
    const limit = image ? MAX_IMAGE_BYTES : MAX_FILE_BYTES

    if (file.size > limit) {
      skipped.push({ name: displayName(file), reason: { kind: "size", size: limit / MEGABYTE } })
      continue
    }

    keys.add(key)
    picked.push({ name: displayName(file), mimeType, size: file.size, image, file })
  }

  return { picked, skipped }
}
