import { createReadStream } from "node:fs"
import { mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { createLocalBashOperations } from "@earendil-works/pi-coding-agent"

import { MAX_DEPTH, MAX_VISITED, SKIP_DIRS, rankEntries, skipAtRoot } from "./search.js"
import type { DirEntry, Environment, ExecOptions, FileStat, SearchEntry } from "./types.js"

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT"

/** 本机：命令走 pi 自己的本地 shell（Windows 上是 Git Bash），文件走 node:fs。 */
export class LocalEnvironment implements Environment {
  readonly id = "local"
  private readonly shell = createLocalBashOperations()

  exec(command: string, { cwd, ...options }: ExecOptions) {
    return this.shell.exec(command, cwd, options)
  }

  readFile(path: string) {
    return readFile(path)
  }

  writeFile(path: string, content: string | Buffer) {
    return writeFile(path, content)
  }

  async mkdir(path: string) {
    await mkdir(path, { recursive: true })
  }

  async stat(path: string): Promise<FileStat | undefined> {
    try {
      const info = await stat(path)
      const kind = info.isFile() ? "file" : info.isDirectory() ? "directory" : "other"
      return { kind, size: info.size, mtimeMs: info.mtimeMs }
    } catch (error) {
      if (missing(error)) return undefined
      throw error
    }
  }

  async readdir(path: string): Promise<DirEntry[]> {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.flatMap((entry): DirEntry[] => {
      if (entry.isDirectory()) return [{ name: entry.name, kind: "directory" }]
      return entry.isFile() ? [{ name: entry.name, kind: "file" }] : []
    })
  }

  realpath(path: string) {
    return realpath(path)
  }

  async readStream(path: string, range?: { start: number; end: number }) {
    return createReadStream(path, range)
  }

  async search(
    root: string,
    query: string,
    options: { limit?: number; signal?: AbortSignal | undefined } = {},
  ) {
    const entries: SearchEntry[] = []
    await walk(root, "", 0, entries, options.signal)
    return rankEntries(entries, query, options.limit)
  }

  async home() {
    return homedir()
  }

  async close() {}
}

async function walk(
  dir: string,
  prefix: string,
  depth: number,
  out: SearchEntry[],
  signal: AbortSignal | undefined,
) {
  if (depth > MAX_DEPTH || out.length >= MAX_VISITED || signal?.aborted) return
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    if (out.length >= MAX_VISITED || signal?.aborted) return

    if (depth === 0 && skipAtRoot(entry.name)) continue
    const isDirectory = entry.isDirectory()

    if (!isDirectory && !entry.isFile()) continue
    const rel = prefix + entry.name
    out.push(isDirectory ? { path: `${rel}/`, kind: "directory" } : { path: rel, kind: "file" })

    if (isDirectory && !SKIP_DIRS.has(entry.name))
      await walk(join(dir, entry.name), `${rel}/`, depth + 1, out, signal)
  }
}
