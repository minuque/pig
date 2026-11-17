import { stat } from "node:fs/promises"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { TranscriptItem, TurnTiming } from "@pig/protocol"
import { TranscriptProjection } from "./transcript.js"
import { readTurnTimings } from "./turn-timing.js"
import { isTurnUnfinished } from "./turn-state.js"

/** 同时缓存的会话数；切回最近打开过的会话不重读文件。 */
const MAX_CACHED = 20

type Projected = { items: TranscriptItem[]; timings: TurnTiming[] }

/** 一次读盘结果：文件版本、投影、回合是否没结束；known 与版本相同时只回 unchanged。 */
type FullRead = { version: string; unfinished: boolean } & Projected

export type DiskRead = { unchanged: true } | FullRead

/** 磁盘会话的投影缓存：按文件 mtime 与大小判定是否失效，最近使用的留下。 */
export class DiskTranscripts {
  private readonly cache = new Map<
    string,
    { version: string; value: Projected; unfinished: boolean }
  >()

  async read(path: string): Promise<FullRead>
  async read(path: string, known: string | undefined): Promise<DiskRead>
  async read(path: string, known?: string): Promise<DiskRead> {
    const info = await stat(path)
    const version = `${info.mtimeMs}:${info.size}`
    const cached = this.cache.get(path)
    this.cache.delete(path)

    if (known === version) {
      if (cached?.version === version) this.cache.set(path, cached)
      return { unchanged: true }
    }

    if (cached?.version === version) {
      this.cache.set(path, cached)
      return { version, unfinished: cached.unfinished, ...cached.value }
    }

    const entries = SessionManager.open(path).getBranch()
    const value = {
      items: new TranscriptProjection().transcript(entries),
      timings: readTurnTimings(entries),
    }
    const unfinished = isTurnUnfinished(entries)

    this.cache.set(path, { version, value, unfinished })

    for (const key of this.cache.keys()) {
      if (this.cache.size <= MAX_CACHED) break
      this.cache.delete(key)
    }

    return { version, unfinished, ...value }
  }
}
