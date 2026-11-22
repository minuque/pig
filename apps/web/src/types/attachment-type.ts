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
  staged?: readonly string[] | undefined
  reportProgress?(id: string, progress: number | undefined): void
  reportError?(id: string, message: string): void
}

export interface SendAttachmentsHooks {
  onDispatched?(): void
  onStageDropped?(): void
}
