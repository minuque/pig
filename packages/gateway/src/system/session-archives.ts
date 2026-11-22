import { watch, type FSWatcher } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { basename, dirname } from "node:path"
import type { SessionArchives } from "@pig/protocol"
import { pigHomeFile, writeJsonAtomic } from "./pig-file.js"

const DEBOUNCE_MS = 80

export class SessionArchivesError extends Error {}

export class SessionArchivesCorruptedError extends Error {
  constructor(readonly path: string) {
    super(`归档索引文件已损坏：${path}`)
  }
}

export function sessionArchivesFile(sessionDir?: string, pigHome?: string): string {
  return pigHomeFile("session-archives.json", sessionDir, pigHome)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeArchives(raw: Record<string, unknown>, path: string): SessionArchives {
  if (raw.version !== 1 || !isRecord(raw.archives)) throw new SessionArchivesCorruptedError(path)

  const normalized: SessionArchives = {}

  for (const id of Object.keys(raw.archives).sort()) {
    const timestamp = raw.archives[id]

    if (!id || typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp < 0)
      throw new SessionArchivesCorruptedError(path)
    normalized[id] = timestamp
  }

  return normalized
}

function sortArchives(archives: SessionArchives): SessionArchives {
  const sorted: SessionArchives = {}

  for (const id of Object.keys(archives).sort()) {
    const timestamp = archives[id]

    if (timestamp !== undefined) sorted[id] = timestamp
  }

  return sorted
}

function validateIdList(value: unknown, field: string): string[] {
  if (value === undefined) return []

  if (!Array.isArray(value)) throw new SessionArchivesError(`${field} 必须是字符串数组`)
  const ids: string[] = []

  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0)
      throw new SessionArchivesError(`${field} 里的会话 ID 不能为空`)
    ids.push(item)
  }

  return ids
}

function parsePatch(input: unknown): { archive: string[]; unarchive: string[] } {
  if (!isRecord(input)) throw new SessionArchivesError("归档请求必须是对象")

  const unknown = Object.keys(input).filter((key) => key !== "archive" && key !== "unarchive")

  if (unknown.length > 0) throw new SessionArchivesError(`未知归档字段：${unknown.join(", ")}`)
  return {
    archive: validateIdList(input.archive, "archive"),
    unarchive: validateIdList(input.unarchive, "unarchive"),
  }
}

type Loaded = { state: "missing" } | { state: "ok"; archives: SessionArchives }

export class SessionArchivesStore {
  private queue: Promise<unknown> = Promise.resolve()
  private snapshot: string | undefined
  private watcher: FSWatcher | undefined
  private timer: NodeJS.Timeout | undefined
  private onChange: ((archives: SessionArchives) => void) | undefined
  private attaching: Promise<void> | undefined
  private closed = false

  constructor(readonly path: string) {}

  read(): Promise<{ archives: SessionArchives; exists: boolean }> {
    return this.enqueue(async () => {
      const loaded = await this.load()

      if (loaded.state === "missing") {
        this.snapshot ??= "{}"
        return { archives: {}, exists: false }
      }

      this.snapshot ??= JSON.stringify(loaded.archives)
      return { archives: loaded.archives, exists: true }
    })
  }

  patch(input: unknown): Promise<SessionArchives> {
    const { archive, unarchive } = parsePatch(input)
    return this.enqueue(async () => {
      const loaded = await this.load()
      const current = loaded.state === "ok" ? loaded.archives : {}
      const next: SessionArchives = { ...current }
      const now = Date.now()
      let changed = false

      for (const id of archive) {
        if (next[id] === undefined) {
          next[id] = now
          changed = true
        }
      }

      for (const id of unarchive) {
        if (next[id] !== undefined) {
          delete next[id]
          changed = true
        }
      }

      const sorted = sortArchives(next)

      if (!changed) return sorted
      await writeJsonAtomic(this.path, { version: 1, archives: sorted })
      const committed = this.commit(sorted)

      await this.attach()
      return committed
    })
  }

  remove(id: string): Promise<void> {
    if (!id) return Promise.resolve()
    return this.enqueue(async () => {
      let loaded: Loaded

      try {
        loaded = await this.load()
      } catch {
        return
      }

      if (loaded.state === "missing" || loaded.archives[id] === undefined) return
      const next: SessionArchives = { ...loaded.archives }

      delete next[id]
      const sorted = sortArchives(next)

      await writeJsonAtomic(this.path, { version: 1, archives: sorted })
      this.commit(sorted)
      await this.attach()
    })
  }

  watch(onChange: (archives: SessionArchives) => void): void {
    this.onChange = onChange
    this.closed = false
    void this.attach()
  }

  close(): void {
    this.closed = true

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }

    this.watcher?.close()
    this.watcher = undefined
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)

    this.queue = run.catch(() => undefined)
    return run
  }

  private async load(): Promise<Loaded> {
    let text: string

    try {
      text = await readFile(this.path, "utf-8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: "missing" }
      throw error
    }

    let raw: unknown

    try {
      raw = JSON.parse(text)
    } catch {
      throw new SessionArchivesCorruptedError(this.path)
    }

    if (!isRecord(raw)) throw new SessionArchivesCorruptedError(this.path)
    return { state: "ok", archives: normalizeArchives(raw, this.path) }
  }

  private commit(archives: SessionArchives): SessionArchives {
    const key = JSON.stringify(archives)
    const changed = this.snapshot !== key

    this.snapshot = key

    if (changed) this.emit(archives)
    return archives
  }

  private emit(archives: SessionArchives): void {
    try {
      this.onChange?.(archives)
    } catch (error) {
      console.error("session archives listener failed:", error)
    }
  }

  private attach(): Promise<void> {
    if (this.watcher || this.closed) return Promise.resolve()
    this.attaching ??= this.openWatcher().finally(() => {
      this.attaching = undefined
    })
    return this.attaching
  }

  private async openWatcher(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true }).catch(() => undefined)

    if (this.watcher || this.closed) return

    const name = basename(this.path).toLowerCase()
    const loaded = await this.load().catch(() => undefined)

    if (loaded?.state === "ok" && this.snapshot === undefined)
      this.snapshot = JSON.stringify(loaded.archives)
    else if (loaded?.state === "missing" && this.snapshot === undefined) this.snapshot = "{}"

    try {
      const watcher = watch(dirname(this.path), (_event, filename) => {
        if (filename && filename.toString().toLowerCase() !== name) return
        this.schedule()
      })

      watcher.on("error", () => {
        watcher.close()

        if (this.watcher === watcher) this.watcher = undefined
      })

      this.watcher = watcher
    } catch {
      this.watcher = undefined
    }
  }

  private schedule(): void {
    if (this.timer || this.closed) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.flush()
    }, DEBOUNCE_MS)
  }

  private flush(): Promise<void> {
    return this.enqueue(async () => {
      if (this.closed) return
      let loaded: Loaded

      try {
        loaded = await this.load()
      } catch {
        return
      }

      const next = loaded.state === "ok" ? loaded.archives : {}
      const key = JSON.stringify(next)

      if (key === this.snapshot) return
      this.snapshot = key
      this.emit(next)
    })
  }
}
