export type AttachmentStatus = "idle" | "uploading" | "ready" | "error"

export interface AttachmentUpload {
  status: AttachmentStatus
  progress: number
  error?: string | undefined
}

export type AttachmentUploads = Record<string, AttachmentUpload>

const COMPLETE = 100

export function uploadAt(progress: number): AttachmentUpload {
  const value = Math.min(COMPLETE, Math.max(0, Math.round(progress)))
  return {
    status: value >= COMPLETE ? "ready" : "uploading",
    progress: value,
  }
}

export function failedAt(previous: AttachmentUpload | undefined, error: string): AttachmentUpload {
  return { status: "error", progress: previous?.progress ?? 0, error }
}

export function replaceUpload(
  uploads: AttachmentUploads,
  id: string,
  next: AttachmentUpload | undefined,
): AttachmentUploads {
  const rest = { ...uploads }

  delete rest[id]
  return next ? { ...rest, [id]: next } : rest
}

export function uploadStatus(uploads: AttachmentUploads): Record<string, AttachmentStatus> {
  return Object.fromEntries(
    Object.entries(uploads).map(([id, upload]) => [id, upload.status] as const),
  )
}

export function uploadPercent(uploads: AttachmentUploads): Record<string, number> {
  return Object.fromEntries(
    Object.entries(uploads).map(([id, upload]) => [id, upload.progress] as const),
  )
}

export function uploadErrors(uploads: AttachmentUploads): Record<string, string> {
  return Object.fromEntries(
    Object.entries(uploads)
      .filter(([, upload]) => upload.error !== undefined)
      .map(([id, upload]) => [id, upload.error ?? ""] as const),
  )
}

export function stagedIds(uploads: AttachmentUploads): string[] {
  return Object.entries(uploads)
    .filter(([, upload]) => upload.status === "ready")
    .map(([id]) => id)
}
