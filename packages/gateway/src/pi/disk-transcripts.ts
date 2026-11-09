import { stat } from "node:fs/promises"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { TranscriptItem } from "@pig/protocol"
import { TranscriptProjection } from "./transcript.js"
import { readTurnTimings, type TurnTiming } from "./turn-timing.js"

/** 同时缓存的会话数；切回最近打开过的会话不重读文件。 */
const MAX_CACHED = 20

type Projected = { items: TranscriptItem[]; timings: TurnTiming[] }

/** 磁盘会话的投影缓存：按文件 mtime 与大小判定是否失效，最近使用的留下。 */
export class DiskTranscripts {
  private readonly cache = new Map<string, { version: string; value: Projected }>()

  async read(path: string): Promise<Projected> {
    const info = await stat(path)
    const version = `${info.mtimeMs}:${info.size}`
    const cached = this.cache.get(path)
    this.cache.delete(path)

    if (cached?.version === version) {
      this.cache.set(path, cached)
      return cached.value
    }

    const entries = SessionManager.open(path).getBranch()
    const value = {
      items: new TranscriptProjection().transcript(entries),
      timings: readTurnTimings(entries),
    }

    this.cache.set(path, { version, value })

    for (const key of this.cache.keys()) {
      if (this.cache.size <= MAX_CACHED) break
      this.cache.delete(key)
    }

    return value
  }
}
