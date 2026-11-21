import type { Readable } from "node:stream"

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
  path: string
  kind: EntryKind
}

// 外部：与 pi BashOperations.exec 同义，timeout 单位秒，中止抛 "aborted"
export interface ExecOptions {
  cwd: string
  onData: (data: Buffer) => void
  signal?: AbortSignal
  timeout?: number
  env?: NodeJS.ProcessEnv
}

export interface Environment {
  readonly id: string
  exec(command: string, options: ExecOptions): Promise<{ exitCode: number | null }>
  readFile(path: string): Promise<Buffer>
  writeFile(path: string, content: string | Buffer): Promise<void>
  mkdir(path: string): Promise<void>
  stat(path: string): Promise<FileStat | undefined>
  readdir(path: string): Promise<DirEntry[]>
  realpath(path: string): Promise<string>
  readStream(path: string, range?: { start: number; end: number }): Promise<Readable>
  search(
    root: string,
    query: string,
    options?: { limit?: number; signal?: AbortSignal | undefined },
  ): Promise<SearchEntry[]>
  home(): Promise<string>
  close(): Promise<void>
}
