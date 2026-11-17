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
