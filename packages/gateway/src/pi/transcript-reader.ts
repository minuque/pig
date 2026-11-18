import type { SessionTranscriptPage, TranscriptItem } from "@pig/protocol"
import { SessionNotFoundError } from "./runtime-types.js"
import { DiskTranscripts } from "./disk-transcripts.js"
import { lightTranscript } from "./transcript-page.js"
import type { PiHostSession } from "./session-runtime.js"

interface TranscriptSource {
  live(
    sessionId: string,
  ): Pick<PiHostSession, "historyTranscript" | "getPhase" | "releaseIfAppended"> | undefined
  findPath(sessionId: string): Promise<string | undefined>
}

/** known：客户端手里的文件版本；after：客户端手里投影的 `<条目数>:<最后一条 id>`。 */
export type TranscriptCursor = { known?: string | undefined; after?: string | undefined }

/** 历史读取：活会话读运行时，其余读磁盘（按文件版本缓存）。 */
export class TranscriptReader {
  private readonly disk = new DiskTranscripts()

  constructor(private readonly source: TranscriptSource) {}

  async page(sessionId: string, cursor: TranscriptCursor = {}): Promise<SessionTranscriptPage> {
    const live = this.source.live(sessionId)

    // 空闲的活会话先核对文件：被别处追加过就释放运行时，改读盘
    if (live && !(live.getPhase() === "idle" && (await live.releaseIfAppended()))) {
      const full = live.historyTranscript()
      return withItems(full.items, cursor.after, {
        timings: full.timings,
        hasMore: false,
        externalTurn: false,
      })
    }

    const read = await this.disk.read(await this.path(sessionId), cursor.known)

    if ("unchanged" in read) return read
    return withItems(read.items, cursor.after, {
      timings: read.timings,
      hasMore: false,
      version: read.version,
      externalTurn: read.unfinished,
    })
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

type PageMeta = Omit<Extract<SessionTranscriptPage, { items: unknown }>, "items">

/** 客户端手里的前缀对得上就只回尾巴，否则回全文。 */
function withItems(
  items: readonly TranscriptItem[],
  after: string | undefined,
  meta: PageMeta,
): SessionTranscriptPage {
  const count = after ? prefixLength(items, after) : undefined
  return count === undefined
    ? { items: lightTranscript(items), ...meta }
    : { append: lightTranscript(items.slice(count)), ...meta }
}

function prefixLength(items: readonly TranscriptItem[], after: string): number | undefined {
  const split = after.indexOf(":")
  const count = Number(after.slice(0, split))

  if (split < 1 || !Number.isInteger(count) || count < 1 || count > items.length) return undefined
  return items[count - 1]?.id === after.slice(split + 1) ? count : undefined
}
