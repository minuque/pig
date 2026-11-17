import type { SessionTranscriptPage, TranscriptItem } from "@pig/protocol"
import { SessionNotFoundError } from "./runtime-types.js"
import { DiskTranscripts } from "./disk-transcripts.js"
import { lightTranscript } from "./transcript-page.js"
import type { PiHostSession } from "./session-runtime.js"

interface TranscriptSource {
  live(sessionId: string): Pick<PiHostSession, "historyTranscript"> | undefined
  findPath(sessionId: string): Promise<string | undefined>
}

/** 历史读取：活会话读运行时，其余读磁盘（按文件版本缓存）。 */
export class TranscriptReader {
  private readonly disk = new DiskTranscripts()

  constructor(private readonly source: TranscriptSource) {}

  async page(sessionId: string, known?: string): Promise<SessionTranscriptPage> {
    const live = this.source.live(sessionId)

    if (live) {
      const full = live.historyTranscript()
      return {
        items: lightTranscript(full.items),
        timings: full.timings,
        hasMore: false,
        externalTurn: false,
      }
    }

    const read = await this.disk.read(await this.path(sessionId), known)

    if ("unchanged" in read) return read
    return {
      items: lightTranscript(read.items),
      timings: read.timings,
      hasMore: false,
      version: read.version,
      externalTurn: read.unfinished,
    }
  }

  async item(sessionId: string, itemId: string): Promise<TranscriptItem | undefined> {
    const live = this.source.live(sessionId)
    const full = live ? live.historyTranscript() : await this.disk.read(await this.path(sessionId))
    return full.items.find((item) => item.id === itemId)
  }

  private async path(sessionId: string): Promise<string> {
    const path = await this.source.findPath(sessionId)

    if (!path) throw new SessionNotFoundError(`Session ${sessionId} not found`)
    return path
  }
}
