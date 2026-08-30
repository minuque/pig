import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@earendil-works/pi-protocol"

export type { TranscriptItem }

export type TranscriptImageBlock = { data: string; mimeType: string }

export function isUserItem(item: TranscriptItem): item is UserTranscriptItem {
  return item.role === "user"
}

export function isAssistantItem(item: TranscriptItem): item is AssistantTranscriptItem {
  return item.role === "assistant"
}

export function isToolItem(item: TranscriptItem): item is ToolTranscriptItem {
  return item.role === "tool"
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

/** 用户句有字或图才占行；助手句只凭正文占行，仅思考不占行。 */
export function isVisibleTranscriptItem(item: TranscriptItem): boolean {
  if (isUserItem(item)) return transcriptText(item).length > 0 || transcriptImages(item).length > 0
  if (isAssistantItem(item)) return transcriptText(item).length > 0
  return true
}

/** 空失败助手句是自动重试残留，不进侧栏条数。 */
export function isRetryErrorItem(item: TranscriptItem): boolean {
  if (!isAssistantItem(item)) return false
  if (item.status !== "error" && item.status !== "aborted") return false
  return transcriptText(item).length === 0
}

export function conversationItemCount(items: readonly TranscriptItem[]): number {
  let count = 0
  for (const item of items) {
    if (!isRetryErrorItem(item)) count += 1
  }
  return count
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

/** 折叠顶栏右侧摘要。read 用路径文件名，其余只留失败和短列表条数。 */
export function toolCallSummary(item: {
  toolName?: string
  input?: unknown
  isError: boolean
  running: boolean
  outputText: string
  outputImages: readonly TranscriptImageBlock[]
}): string {
  if (item.isError) return "失败"
  if (item.running) return ""
  if (item.toolName?.trim().toLowerCase() === "read") {
    return toolCallDetail(item.toolName, item.input)
  }
  const count = resultCount(item.outputText)
  if (count != null) return `${count} 条结果`
  if (!item.outputText && item.outputImages.length > 0) {
    return item.outputImages.length === 1 ? "1 张图片" : `${item.outputImages.length} 张图片`
  }
  return ""
}

const KIND_LABELS: Record<string, string> = {
  read: "Read",
  write: "Write",
  edit: "Edit",
  bash: "Run",
  grep: "Search",
  find: "Find",
  ls: "List",
}

const TITLE_OBJECT_MAX = 48

function clipTitleObject(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= TITLE_OBJECT_MAX) return compact
  return `${compact.slice(0, TITLE_OBJECT_MAX - 1)}…`
}

function fileName(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").filter(Boolean).pop()
  return base || path
}

export function toolCallKindLabel(toolName: string): string {
  const name = toolName.trim().toLowerCase()
  return KIND_LABELS[name] ?? (toolName.trim() || "Tool")
}

export function toolCallDetail(toolName: string, input: unknown): string {
  const name = toolName.trim().toLowerCase()
  const hint = clipTitleObject(toolInputHint(input))
  if (!hint) return ""
  if (name === "bash") return `"${hint}"`
  if (name === "read" || name === "write" || name === "edit") return fileName(hint)
  return hint
}

/** 顶栏标题：种类 + 入参对象。 */
export function toolCallTitle(toolName: string, input: unknown): string {
  const kind = toolCallKindLabel(toolName)
  const detail = toolCallDetail(toolName, input)
  return detail ? `${kind} ${detail}` : kind
}
