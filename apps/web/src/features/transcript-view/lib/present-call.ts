import { getLanguageIcon, languageIconsRevision } from "markstream-vue"
import type { CallView, ToolCallView, ToolSummaryDetail } from "@features/transcript-view/type.js"
import {
  isCommandTool,
  toolCommand,
  toolInputPretty,
  toolPath,
  toolWorkingDirectory,
} from "./transcript-format.js"
import { fileLanguage, readToolPreview } from "./tool-presentation.js"
import { editDiffPreview, toolGroupKey } from "./tool-summary.js"

export function fileDetailIcon(detail: ToolSummaryDetail | null): string {
  void languageIconsRevision.value
  if (detail?.kind !== "file") return ""
  const language = fileLanguage(detail.path)
  if (language === "text") return ""
  return `data:image/svg+xml;utf8,${encodeURIComponent(getLanguageIcon(language))}`
}

function commandStatus(item: ToolCallView) {
  if (item.isError) return { commandStatus: "error" as const, statusLabel: "执行失败" }
  if (item.running) return { commandStatus: "running" as const, statusLabel: "正在执行" }
  return { commandStatus: "success" as const, statusLabel: "执行完成" }
}

function base(item: ToolCallView, revealed: boolean, expandable: boolean) {
  return { item, revealed, expandable }
}

function revealedOutput(item: ToolCallView, revealed: boolean) {
  return {
    outputText: revealed ? item.outputText : "",
    outputImages: revealed ? item.outputImages : [],
    emptyOutput: item.running ? "(running…)" : "(no output)",
  }
}

function toolBody(item: ToolCallView, revealed: boolean) {
  return {
    ...revealedOutput(item, revealed),
    inputFull: revealed ? toolInputPretty(item.input) : "",
    outputLabel: "输出" as const,
  }
}

function hasBody(item: ToolCallView): boolean {
  return (
    item.running ||
    toolInputPretty(item.input).length > 0 ||
    item.outputText.length > 0 ||
    item.outputImages.length > 0
  )
}

function presentCommand(item: ToolCallView, open: boolean): CallView {
  return {
    ...base(item, open, true),
    variant: "command",
    command: toolCommand(item.input),
    cwd: toolWorkingDirectory(item.input),
    ...revealedOutput(item, open),
    ...commandStatus(item),
  }
}

function presentRead(item: ToolCallView, open: boolean): CallView {
  const path = toolPath(item.input)
  const out = revealedOutput(item, open)
  const canPreview =
    open &&
    Boolean(path) &&
    !item.isError &&
    !item.running &&
    out.outputImages.length === 0 &&
    Boolean(out.outputText) &&
    !/^\[Line \d+ is .+ exceeds /.test(out.outputText)
  if (canPreview && path) {
    return {
      ...base(item, open, true),
      variant: "read",
      path,
      preview: readToolPreview(item.input, out.outputText),
    }
  }
  return {
    ...base(item, open, true),
    variant: "tool",
    ...out,
    inputFull: "",
    outputLabel: path || "Read",
  }
}

function presentEdit(item: ToolCallView, open: boolean): CallView {
  const preview = open && !item.isError && !item.running ? editDiffPreview(item.input) : null
  if (preview) {
    return {
      ...base(item, open, true),
      variant: "edit",
      editPreview: preview,
    }
  }
  return {
    ...base(item, open, hasBody(item)),
    variant: "tool",
    ...toolBody(item, open),
  }
}

function presentTool(item: ToolCallView, open: boolean): CallView {
  return {
    ...base(item, open, hasBody(item)),
    variant: "tool",
    ...toolBody(item, open),
  }
}

export function presentCall(item: ToolCallView, open: boolean): CallView {
  const name = item.toolName.trim().toLowerCase()
  if (isCommandTool(name)) return presentCommand(item, open)
  const key = toolGroupKey(item.toolName)
  if (key === "read") return presentRead(item, open)
  if (key === "edit") return presentEdit(item, open)
  return presentTool(item, open)
}
