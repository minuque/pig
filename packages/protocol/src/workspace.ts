/** 环境列表的一项；saved 表示 pig 自己保存过（带默认目录）。 */
export interface EnvironmentInfo {
  id: string
  kind: "local" | "ssh"
  host?: string
  defaultPath?: string
  saved: boolean
}

/** @ 文件引用候选：cwd 相对路径，目录带尾斜杠。 */
export interface FileSearchEntry {
  path: string
  kind: "file" | "directory"
}

/** / 菜单候选：技能与 prompt 模板。 */
export interface ComposerCommand {
  name: string
  description: string
  /** 模板用法提示，如 "<issue-number>"。 */
  argumentHint?: string
}

/** 工作区里一个路径的元信息。 */
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

/** 目录里的一项；ignored 表示被 .gitignore 命中。 */
export interface DirectoryEntry {
  name: string
  kind: "file" | "directory"
  ignored: boolean
}

export interface DirectoryListResponse {
  entries: DirectoryEntry[]
}

/** 工作区里一个改动过的文件；U 是未跟踪。 */
export interface GitFileStatus {
  path: string
  status: "M" | "A" | "D" | "R" | "U"
}

export interface GitStatusResponse {
  repo: boolean
  files: GitFileStatus[]
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
