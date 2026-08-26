import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"

export type TranscriptImageBlock = { data: string; mimeType: string }

export function isUserItem(item: TranscriptItem): item is UserTranscriptItem {
  return item.role === "user"
}

export function isAssistantItem(item: TranscriptItem): item is AssistantTranscriptItem {
  return item.role === "assistant"
}

export function transcriptText(item: TranscriptItem): string {
  return item.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
}

export function transcriptImages(item: TranscriptItem): TranscriptImageBlock[] {
  return item.content
    .filter(
      (block): block is { type: "image"; data: string; mimeType: string } => block.type === "image",
    )
    .map((block) => ({ data: block.data, mimeType: block.mimeType }))
}

export function assistantThinking(item: AssistantTranscriptItem): string[] {
  return item.content
    .filter((block): block is { type: "thinking"; thinking: string } => block.type === "thinking")
    .map((block) => block.thinking)
    .filter(Boolean)
}

export function transcriptImageSrc(data: string, mimeType: string): string {
  if (data.startsWith("data:")) return data
  return `data:${mimeType};base64,${data}`
}

export function isVisibleTranscriptItem(item: TranscriptItem): boolean {
  if (isUserItem(item)) return transcriptText(item).length > 0 || transcriptImages(item).length > 0
  if (isAssistantItem(item))
    return (
      item.status === "streaming" ||
      transcriptText(item).length > 0 ||
      assistantThinking(item).length > 0
    )
  return true
}

/** 可见条目：无文字且无图的用户句、仅有 toolCall 的助手句不占行。流式空助手句要占位。 */
export function conversationRows(items: readonly TranscriptItem[]): TranscriptItem[] {
  return items.filter(isVisibleTranscriptItem)
}

const PATH_CMD_KEYS = [
  "path",
  "file",
  "file_path",
  "filePath",
  "filename",
  "target_file",
  "targetFile",
  "command",
  "cmd",
] as const

const TOOL_HINT_KEYS = [...PATH_CMD_KEYS, "query", "pattern", "glob", "url"] as const

const RESULT_COUNT_MAX_LINES = 40
const RESULT_COUNT_MAX_LINE_LENGTH = 160

function jsonText(value: unknown, pretty = false): string {
  if (value === undefined) return ""
  try {
    return (pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value)) ?? ""
  } catch {
    return ""
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** 空对象 / 空数组不当作可展示入参，避免展开后出现无意义的 `{}`。 */
function hasToolInput(input: unknown): boolean {
  if (input === undefined || input === null) return false
  if (typeof input === "string") return input.length > 0
  if (Array.isArray(input)) return input.length > 0
  if (isRecord(input)) return Object.keys(input).length > 0
  return true
}

function hintFromKeys(input: unknown, keys: readonly string[]): string {
  if (!isRecord(input)) return ""
  for (const key of keys) {
    const value = input[key]
    if (typeof value === "string" && value.trim().length > 0) return value
  }
  return ""
}

/** 顶栏一句话：优先 path / query / cmd 等常用键，否则压成单行 JSON。 */
export function toolInputHint(input: unknown): string {
  if (typeof input === "string") return input
  if (!hasToolInput(input)) return ""
  const named = hintFromKeys(input, TOOL_HINT_KEYS)
  if (named) return named
  if (isRecord(input)) {
    const keys = Object.keys(input)
    if (keys.length === 1) {
      const value = input[keys[0]!]
      if (typeof value === "string" && value.trim().length > 0) return value
    }
  }
  const compact = jsonText(input)
  return compact === "{}" || compact === "[]" || compact === "null" ? "" : compact
}

export function toolInputPretty(input: unknown): string {
  return hasToolInput(input) ? jsonText(input, true) : ""
}

function resultCount(text: string): number | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2 || lines.length > RESULT_COUNT_MAX_LINES) return null
  if (lines.some((line) => line.length > RESULT_COUNT_MAX_LINE_LENGTH)) return null
  return lines.length
}

/**
 * 折叠顶栏右侧摘要。path / cmd 始终压过输出条数，避免 bash 两行输出变成「2 条结果」。
 * 无路径或命令时，短列表才写成「N 条结果」。
 */
export function toolCallSummary(item: ToolTranscriptItem): string {
  if (item.isError) return "失败"
  const pathOrCmd = hintFromKeys(item.input, PATH_CMD_KEYS)
  if (pathOrCmd) return pathOrCmd
  if (item.status !== "running") {
    const text = transcriptText(item)
    const count = resultCount(text)
    if (count != null) return `${count} 条结果`
    const images = transcriptImages(item)
    if (!text && images.length > 0) {
      return images.length === 1 ? "1 张图片" : `${images.length} 张图片`
    }
  }
  return toolInputHint(item.input)
}
