/** @ 文件引用候选：cwd 相对路径，目录带尾斜杠。 */
export interface FileSearchEntry {
  path: string
  kind: "file" | "directory"
}

export interface ComposerCommand {
  name: string
  description: string
  /** 模板用法提示，如 "<issue-number>"。 */
  argumentHint?: string
}

export interface FileStatResponse {
  kind: "file" | "directory" | "other"
  size: number
  mtimeMs: number
}

/** 读文本：二进制或超限时只给分类，不给 content。 */
export interface FileTextResponse {
  content?: string
  size: number
  binary: boolean
  tooLarge: boolean
}

/** 目录里的一项。 */
export interface DirectoryEntry {
  name: string
  kind: "file" | "directory"
}

export interface DirectoryListResponse {
  entries: DirectoryEntry[]
}

/** 内容搜索的一条命中：工作区相对路径、行号（从 1 起）与那一行。 */
export interface ContentSearchMatch {
  path: string
  line: number
  text: string
}

/** 内容搜索没搜全的原因，界面据此给出不同的提示。 */
export type SearchTruncation =
  "result-limit" | "deadline" | "candidate-limit" | "content-file-limit" | "content-byte-limit"

export interface ContentSearchResponse {
  matches: ContentSearchMatch[]
  truncated: boolean
  truncationReasons: SearchTruncation[]
}

export const PREVIEW_LINK_MESSAGE_TYPE = "pig-preview-link"

export interface PreviewLinkMessage {
  type: typeof PREVIEW_LINK_MESSAGE_TYPE
  href: string
}

export function isPreviewLinkMessage(value: unknown): value is PreviewLinkMessage {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { type?: unknown; href?: unknown }
  return (
    candidate.type === PREVIEW_LINK_MESSAGE_TYPE &&
    typeof candidate.href === "string" &&
    /^https?:\/\//i.test(candidate.href)
  )
}
