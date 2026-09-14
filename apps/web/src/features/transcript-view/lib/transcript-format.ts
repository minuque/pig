import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"

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

const PATH_KEYS = [
  "path",
  "file",
  "file_path",
  "filePath",
  "filename",
  "target_file",
  "targetFile",
] as const

const PATH_CMD_KEYS = [...PATH_KEYS, "command", "cmd"] as const

const TOOL_HINT_KEYS = [...PATH_CMD_KEYS, "query", "pattern", "glob", "url"] as const

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

export function isCommandTool(toolName: string): boolean {
  return ["bash", "powershell", "pwsh"].includes(toolName.trim().toLowerCase())
}

export function toolCommand(input: unknown): string {
  return typeof input === "string" ? input : hintFromKeys(input, ["command", "cmd"])
}

export function toolPath(input: unknown): string {
  return hintFromKeys(input, PATH_KEYS)
}

export function toolWorkingDirectory(input: unknown): string {
  return hintFromKeys(input, ["cwd", "workdir", "working_directory"])
}

export function toolCallDetail(toolName: string, input: unknown): string {
  const name = toolName.trim().toLowerCase()

  if (isCommandTool(name)) {
    const description = hintFromKeys(input, ["description"])
    return description || toolCommand(input)
  }

  return toolInputHint(input)
}
