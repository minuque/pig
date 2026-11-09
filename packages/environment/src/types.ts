export type EntryKind = "file" | "directory"

export interface FileStat {
  kind: EntryKind | "other"
  size: number
  mtimeMs: number
}

export interface DirEntry {
  name: string
  kind: EntryKind
}

export interface SearchEntry {
  /** 相对搜索根的路径，posix 分隔符；目录带尾斜杠。 */
  path: string
  kind: EntryKind
}

/** 与 pi BashOperations.exec 同义：timeout 单位秒，中止抛 "aborted"，超时抛 "timeout:<秒>"。 */
export interface ExecOptions {
  cwd: string
  onData: (data: Buffer) => void
  signal?: AbortSignal
  timeout?: number
  env?: NodeJS.ProcessEnv
}

/** 工具运行的地方：本机或一台 SSH 主机。路径一律是该环境里的绝对路径。 */
export interface Environment {
  /** "local"，或 "ssh://<主机别名>"。 */
  readonly id: string
  exec(command: string, options: ExecOptions): Promise<{ exitCode: number | null }>
  readFile(path: string): Promise<Buffer>
  writeFile(path: string, content: string | Buffer): Promise<void>
  /** 递归建目录，已存在不报错。 */
  mkdir(path: string): Promise<void>
  /** 不存在返回 undefined，其他错误照抛。 */
  stat(path: string): Promise<FileStat | undefined>
  readdir(path: string): Promise<DirEntry[]>
  search(
    root: string,
    query: string,
    options?: { limit?: number; signal?: AbortSignal | undefined },
  ): Promise<SearchEntry[]>
  close(): Promise<void>
}
