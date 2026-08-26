import type {
  SessionPhase,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"
import {
  assistantThinking,
  isAssistantItem,
  isToolItem,
  isUserItem,
  isVisibleTranscriptItem,
  transcriptText,
} from "@features/transcript-view/lib/transcript-format.js"

export const EARLIER_ROW_ID = "transcript-earlier"
export const THINKING_ROW_ID = "transcript-thinking"

export type EarlierRow = { id: typeof EARLIER_ROW_ID; role: "earlier" }
export type ThinkingRow = { id: typeof THINKING_ROW_ID; role: "thinking" }
export type WorkRow = {
  id: string
  role: "work"
  mode: "live" | "fold"
  thinking: string[]
  thinkingStreaming: boolean
  tools: ToolTranscriptItem[]
  aborted: boolean
  durationSec: number | null
}
export type TimelineRow = TranscriptItem | EarlierRow | ThinkingRow | WorkRow

export function isEarlierRow(row: TimelineRow): row is EarlierRow {
  return row.role === "earlier"
}

export function isThinkingRow(row: TimelineRow): row is ThinkingRow {
  return row.role === "thinking"
}

export function isWorkRow(row: TimelineRow): row is WorkRow {
  return row.role === "work"
}

type TurnSegment = {
  user: UserTranscriptItem | null
  rest: TranscriptItem[]
}

type TurnWork = {
  thinking: string[]
  thinkingStreaming: boolean
  tools: ToolTranscriptItem[]
  aborted: boolean
  lastTs: number
}

/** 运行中且末条不是流式正文或进行中的工具时，补一条思考占位。 */
export function needsThinkingPlaceholder(
  phase: SessionPhase | undefined,
  items: readonly TranscriptItem[],
): boolean {
  if (phase === undefined || phase === "idle") return false
  const last = items[items.length - 1]
  if (!last) return true
  if (isAssistantItem(last) && last.status === "streaming" && transcriptText(last).length > 0) {
    return false
  }
  if (isToolItem(last) && last.status === "running") return false
  return true
}

function turnSegments(items: readonly TranscriptItem[]): TurnSegment[] {
  const segments: TurnSegment[] = []
  let user: UserTranscriptItem | null = null
  let rest: TranscriptItem[] = []
  const flush = () => {
    if (user || rest.length > 0) segments.push({ user, rest })
  }
  for (const item of items) {
    if (isUserItem(item) && isVisibleTranscriptItem(item)) {
      flush()
      user = item
      rest = []
      continue
    }
    rest.push(item)
  }
  flush()
  return segments
}

function collectWork(rest: readonly TranscriptItem[]): TurnWork {
  const thinking: string[] = []
  const tools: ToolTranscriptItem[] = []
  let thinkingStreaming = false
  let aborted = false
  let lastTs = 0
  for (const item of rest) {
    if (isToolItem(item)) {
      tools.push(item)
      lastTs = Math.max(lastTs, item.timestamp)
      continue
    }
    if (!isAssistantItem(item)) continue
    if (item.status === "aborted") aborted = true
    const blocks = assistantThinking(item)
    if (blocks.length === 0) continue
    thinking.push(...blocks)
    lastTs = Math.max(lastTs, item.timestamp)
    if (item.status === "streaming") thinkingStreaming = true
  }
  return { thinking, thinkingStreaming, tools, aborted, lastTs }
}

function hasWork(work: TurnWork): boolean {
  return work.thinking.length > 0 || work.tools.length > 0
}

export function workDurationSec(start: number, end: number): number | null {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) return null
  if (end < start) return null
  const sec = Math.round((end - start) / 1000)
  return sec >= 1 ? sec : null
}

export function workFoldLabel(row: WorkRow): string {
  if (row.aborted) return "已停止"
  if (row.durationSec != null) return `工作了 ${row.durationSec}s`
  if (row.tools.length > 0) return `${row.tools.length} 次工具调用`
  return "思考过程"
}

function makeWorkRow(id: string, mode: WorkRow["mode"], work: TurnWork, userTs: number): WorkRow {
  return {
    id,
    role: "work",
    mode,
    thinking: work.thinking,
    thinkingStreaming: work.thinkingStreaming,
    tools: work.tools,
    aborted: work.aborted,
    durationSec: workDurationSec(userTs, work.lastTs),
  }
}

function emitAssistantRows(rest: readonly TranscriptItem[], rows: TimelineRow[], work: TurnWork) {
  for (const item of rest) {
    if (!isAssistantItem(item)) continue
    if (transcriptText(item).length > 0) {
      rows.push(item)
      continue
    }
    if ((item.status === "error" || item.status === "aborted") && !hasWork(work)) {
      rows.push(item)
    }
  }
}

function emitFold(segment: TurnSegment, rows: TimelineRow[]) {
  const work = collectWork(segment.rest)
  if (hasWork(work) && segment.user) {
    rows.push(makeWorkRow(`work:${segment.user.id}`, "fold", work, segment.user.timestamp))
  }
  emitAssistantRows(segment.rest, rows, work)
}

function emitLive(rest: readonly TranscriptItem[], rows: TimelineRow[], orphanThinking: boolean) {
  let thinking: string[] = []
  let thinkingStreaming = false
  let tools: ToolTranscriptItem[] = []

  const flushTools = () => {
    if (tools.length === 0) return
    const first = tools[0]!
    rows.push(
      makeWorkRow(
        `work:${first.id}`,
        "live",
        { thinking, thinkingStreaming, tools, aborted: false, lastTs: 0 },
        0,
      ),
    )
    thinking = []
    thinkingStreaming = false
    tools = []
  }

  for (const item of rest) {
    if (isToolItem(item)) {
      tools.push(item)
      continue
    }
    if (!isAssistantItem(item)) continue
    const blocks = assistantThinking(item)
    if (blocks.length > 0) {
      thinking.push(...blocks)
      if (item.status === "streaming") thinkingStreaming = true
    }
    if (transcriptText(item).length > 0) {
      flushTools()
      rows.push(item)
    }
  }
  flushTools()
  if (!orphanThinking || thinking.length === 0) return
  const anchor = rest.find((item) => isAssistantItem(item) && assistantThinking(item).length > 0)
  rows.push(
    makeWorkRow(
      `work:think:${anchor?.id ?? "head"}`,
      "live",
      {
        thinking,
        thinkingStreaming,
        tools: [],
        aborted: false,
        lastTs: 0,
      },
      0,
    ),
  )
}

/** 历史 Turn 把思考和工具收进一条折叠；进行中不折叠，连续工具占一行。 */
export function buildTimelineRows(
  items: readonly TranscriptItem[],
  phase: SessionPhase | undefined,
  hasEarlier: boolean,
): TimelineRow[] {
  const rows: TimelineRow[] = []
  if (hasEarlier) rows.push({ id: EARLIER_ROW_ID, role: "earlier" })
  const live = phase !== undefined && phase !== "idle"
  const segments = turnSegments(items)
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const folding = Boolean(segment.user) && !(live && index === segments.length - 1)
    if (segment.user) rows.push(segment.user)
    if (folding) emitFold(segment, rows)
    else emitLive(segment.rest, rows, !segment.user)
  }
  if (needsThinkingPlaceholder(phase, items)) {
    rows.push({ id: THINKING_ROW_ID, role: "thinking" })
  }
  return rows
}

export function toolCardOpen(
  item: ToolTranscriptItem,
  expanded: ReadonlyMap<string, boolean>,
): boolean {
  if (item.status === "running" || item.isError) return true
  return expanded.get(item.id) === true
}

/** 时间线认 Markdown 的 kind：仅助手正文。加载行和工作行不是 Markdown。 */
export function transcriptRowKind(item: TimelineRow): string {
  if (isEarlierRow(item)) return "load-earlier"
  if (isThinkingRow(item)) return "thinking-wait"
  if (isWorkRow(item)) return item.mode === "fold" ? "work-fold" : "tool-group"
  if (item.role === "assistant") return "assistant-markdown"
  if (item.role === "tool") return "tool-call"
  return "user-message"
}

export function transcriptRowContent(item: TimelineRow): string {
  return !isEarlierRow(item) && !isThinkingRow(item) && !isWorkRow(item) && isAssistantItem(item)
    ? transcriptText(item)
    : ""
}

export function transcriptRowFinal(item: TimelineRow): boolean {
  return (
    isEarlierRow(item) ||
    isThinkingRow(item) ||
    isWorkRow(item) ||
    !(isAssistantItem(item) && item.status === "streaming")
  )
}

function estimateWrappedLines(text: string, charsPerLine: number): number {
  if (!text) return 1
  let lines = 0
  for (const part of text.split("\n")) {
    lines += Math.max(1, Math.ceil(part.length / charsPerLine))
  }
  return lines
}

/**
 * 虚拟列表估高：宁可偏高，避免宽度变窄后按 200px 塞进过多未测行。
 * 助手约 48 字/行、26px 行高；用户约 36 字/行、22px 行高。
 */
export function estimateTranscriptRowHeight(item: TimelineRow): number {
  if (isThinkingRow(item)) return 36
  if (isEarlierRow(item)) return 48
  if (isWorkRow(item)) {
    if (item.mode === "fold") return 36
    const thinking = item.thinking.length > 0 ? (item.thinkingStreaming ? 200 : 36) : 0
    return Math.max(48, 16 + thinking + item.tools.length * 48)
  }
  const text = transcriptText(item)
  if (item.role === "user") {
    return Math.min(280, 56 + estimateWrappedLines(text, 36) * 22)
  }
  if (item.role === "tool") return 48
  const height = 36 + estimateWrappedLines(text, 48) * 26
  return Math.min(960, Math.max(160, height))
}
