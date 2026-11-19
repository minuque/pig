import { watch, type FSWatcher } from "node:fs"
import { basename, dirname } from "node:path"

/** 同一份文件的一串 fs 事件合并成一次通知的窗口。 */
const DEFAULT_DEBOUNCE_MS = 80

interface WatchedFile {
  watcher: FSWatcher
  timer: NodeJS.Timeout | undefined
}

export interface SessionFileWatcherOptions {
  /** sessionId → 会话文件路径；找不到就当没这个会话，不监听。 */
  resolvePath(sessionId: string): Promise<string | undefined>
  debounceMs?: number
}

/** 按需盯住会话文件：有订阅者才开 fs.watch，同一会话共用一份，退订到零就关；盯目录按文件名过滤以兼容原子替换。 */
export class SessionFileWatcher {
  private readonly listeners = new Map<string, Set<() => void>>()
  private readonly files = new Map<string, WatchedFile>()
  private readonly resolving = new Map<string, Promise<void>>()
  private readonly debounceMs: number
  private closed = false

  constructor(private readonly options: SessionFileWatcherOptions) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  }

  /** 订阅一个会话文件的变化；返回退订函数。 */
  subscribe(sessionId: string, listener: () => void): () => void {
    if (this.closed) return () => {}

    const listeners = this.listeners.get(sessionId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(sessionId, listeners)

    if (!this.files.has(sessionId)) void this.open(sessionId)
    return () => this.unsubscribe(sessionId, listener)
  }

  /** 停服：关掉全部 watcher，不留文件句柄。 */
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

  /** 解析路径是异步的：期间退订过就不再建 watcher，同一会话的并发订阅共用一次解析。 */
  private open(sessionId: string): Promise<void> {
    const pending = this.resolving.get(sessionId)

    if (pending) return pending

    const run = (async () => {
      const path = await this.options.resolvePath(sessionId).catch(() => undefined)

      if (!path || this.closed || !this.listeners.has(sessionId)) return
      this.files.set(sessionId, this.watchFile(sessionId, path))
    })()

    this.resolving.set(sessionId, run)
    void run.finally(() => {
      if (this.resolving.get(sessionId) === run) this.resolving.delete(sessionId)
    })
    return run
  }

  private watchFile(sessionId: string, path: string): WatchedFile {
    const name = basename(path).toLowerCase()
    const dir = dirname(path)
    // 目录被删或句柄失效：先放掉，下一次订阅按需重建
    const watcher = watch(dir, (_event, filename) => {
      if (filename && filename.toString().toLowerCase() !== name) return
      this.schedule(sessionId)
    })

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
