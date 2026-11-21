import { watch, type FSWatcher } from "node:fs"
import { basename, dirname } from "node:path"

const DEFAULT_DEBOUNCE_MS = 80

interface WatchedFile {
  watcher: FSWatcher
  timer: NodeJS.Timeout | undefined
}

export interface SessionFileWatcherOptions {
  resolvePath(sessionId: string): Promise<string | undefined>
  debounceMs?: number
}

// 外部：盯目录按文件名过滤，文件被原子替换（重命名覆盖）后 watcher 不会失效
export class SessionFileWatcher {
  private readonly listeners = new Map<string, Set<() => void>>()
  private readonly files = new Map<string, WatchedFile>()
  private readonly resolving = new Map<string, Promise<void>>()
  private readonly debounceMs: number
  private closed = false

  constructor(private readonly options: SessionFileWatcherOptions) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  }

  subscribe(sessionId: string, listener: () => void): () => void {
    if (this.closed) return () => {}

    const listeners = this.listeners.get(sessionId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(sessionId, listeners)

    if (!this.files.has(sessionId)) void this.open(sessionId)
    return () => this.unsubscribe(sessionId, listener)
  }

  close() {
    this.closed = true

    for (const sessionId of [...this.files.keys()]) this.closeFile(sessionId)
    this.listeners.clear()
  }

  private unsubscribe(sessionId: string, listener: () => void) {
    const listeners = this.listeners.get(sessionId)

    if (!listeners?.delete(listener) || listeners.size > 0) return
    this.listeners.delete(sessionId)
    this.closeFile(sessionId)
  }

  private open(sessionId: string): Promise<void> {
    const pending = this.resolving.get(sessionId)

    if (pending) return pending

    const run = (async () => {
      const path = await this.options.resolvePath(sessionId).catch(() => undefined)

      if (!path || this.closed || !this.listeners.has(sessionId)) return
      const watched = this.watchFile(sessionId, path)

      if (watched) this.files.set(sessionId, watched)
    })()

    this.resolving.set(sessionId, run)
    void run.finally(() => {
      if (this.resolving.get(sessionId) === run) this.resolving.delete(sessionId)
    })
    return run
  }

  private watchFile(sessionId: string, path: string): WatchedFile | undefined {
    const name = basename(path).toLowerCase()
    const dir = dirname(path)
    let watcher: FSWatcher

    try {
      watcher = watch(dir, (_event, filename) => {
        if (filename && filename.toString().toLowerCase() !== name) return
        this.schedule(sessionId)
      })
    } catch {
      return undefined
    }

    watcher.on("error", () => this.closeFile(sessionId))
    watcher.unref()
    return { watcher, timer: undefined }
  }

  private schedule(sessionId: string) {
    const file = this.files.get(sessionId)

    if (!file || file.timer) return
    file.timer = setTimeout(() => {
      file.timer = undefined

      if (this.files.get(sessionId) !== file) return

      for (const listener of this.listeners.get(sessionId) ?? []) this.notify(listener)
    }, this.debounceMs)
    file.timer.unref()
  }

  private notify(listener: () => void) {
    try {
      listener()
    } catch (error) {
      console.error("session watch listener failed:", error)
    }
  }

  private closeFile(sessionId: string) {
    const file = this.files.get(sessionId)

    if (!file) return
    this.files.delete(sessionId)

    if (file.timer) clearTimeout(file.timer)
    file.watcher.close()
  }
}
