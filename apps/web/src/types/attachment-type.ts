export interface ComposerAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  url: string
  file: File
}

export interface ComposerAttachmentBatch {
  batch: string
  files: ComposerAttachment[]
  reportProgress?(id: string, progress: number | undefined): void
}
