import type {
  AssistantTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  UserTranscriptItem,
} from "@/types/common-type.js"
import { transcriptText } from "@features/session/lib/transcript-text.js"
import type { TranscriptImage } from "@features/transcript-view/type.js"

export function isUserItem(item: TranscriptItem): item is UserTranscriptItem {
  return item.role === "user"
}

export function isAssistantItem(item: TranscriptItem): item is AssistantTranscriptItem {
  return item.role === "assistant"
}

export function isToolItem(item: TranscriptItem): item is ToolTranscriptItem {
  return item.role === "tool"
}

export function transcriptImages(item: TranscriptItem): TranscriptImage[] {
  if (item.role === "task") return []
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
const TOOL_HINT_KEYS = [...PATH_KEYS, "command", "cmd", "query", "pattern", "glob", "url"] as const

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

const COMMAND_STATUS =
  /(?:^|\n\n)(Command exited with code (-?\d+)|Command aborted|Command timed out after \d+ seconds|Command terminated without an exit code)\s*$/

export function splitCommandStatus(
  output: string,
  status: "error" | "running" | "success",
): { body: string; exitCode?: number; statusLine: string } {
  const match = COMMAND_STATUS.exec(output)

  if (!match) {
    return status === "success"
      ? { body: output, exitCode: 0, statusLine: "" }
      : { body: output, statusLine: "" }
  }

  const body = output.slice(0, match.index)
  return match[2] === undefined
    ? { body, statusLine: match[1] ?? "" }
    : { body, exitCode: Number(match[2]), statusLine: "" }
}

export function toolPath(input: unknown): string {
  return hintFromKeys(input, PATH_KEYS)
}

export function toolCallDetail(toolName: string, input: unknown): string {
  const name = toolName.trim().toLowerCase()

  if (isCommandTool(name)) {
    const description = hintFromKeys(input, ["description"])
    return description || toolCommand(input)
  }

  return toolInputHint(input)
}
