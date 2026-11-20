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

declare const cursorBrand: unique symbol

/** after 游标的正文形式 `<已收条目数>:<最后一条 id>`；只经 encodeCursor / decodeCursor 转换。 */
export type TranscriptCursorToken = string & { readonly [cursorBrand]: true }

export type TranscriptCursor = {
  known?: string | undefined
  after?: TranscriptCursorToken | undefined
}

export function encodeCursor(count: number, lastId: string): TranscriptCursorToken {
  return `${count}:${lastId}` as TranscriptCursorToken
}

/** 形如 encodeCursor 产物的串才转成游标；其余当作没带 after。 */
export function decodeCursor(raw: string): TranscriptCursorToken | undefined {
  const { count } = splitCursor(raw)
  return Number.isInteger(count) && count >= 1 ? (raw as TranscriptCursorToken) : undefined
}

export class TranscriptReader {
  private readonly disk = new DiskTranscripts()

  constructor(private readonly source: TranscriptSource) {}

  async page(sessionId: string, cursor: TranscriptCursor = {}): Promise<SessionTranscriptPage> {
    const live = this.source.live(sessionId)

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

function withItems(
  items: readonly TranscriptItem[],
  after: TranscriptCursorToken | undefined,
  meta: PageMeta,
): SessionTranscriptPage {
  const count = after === undefined ? undefined : prefixLength(items, after)
  return count === undefined
    ? { items: lightTranscript(items), ...meta }
    : { append: lightTranscript(items.slice(count)), ...meta }
}

function splitCursor(token: string): { count: number; lastId: string } {
  const split = token.indexOf(":")
  return { count: Number(token.slice(0, split)), lastId: token.slice(split + 1) }
}

function prefixLength(
  items: readonly TranscriptItem[],
  after: TranscriptCursorToken,
): number | undefined {
  const { count, lastId } = splitCursor(after)

  if (count > items.length) return undefined
  return items[count - 1]?.id === lastId ? count : undefined
}
