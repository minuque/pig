import { getLanguageIcon, languageIconsRevision } from "markstream-vue"
import type {
  EditDiffPreview,
  ToolCallView,
  ToolSummaryDetail,
  TranscriptImage,
} from "@features/transcript-view/type.js"
import {
  isCommandTool,
  toolCommand,
  toolInputPretty,
  toolPath,
  toolWorkingDirectory,
} from "./transcript-format.js"
import { fileLanguage, readToolPreview, type ReadToolPreview } from "./tool-presentation.js"
import { editDiffPreview, toolGroupKey } from "./tool-summary.js"

export function fileDetailIcon(detail: ToolSummaryDetail | null): string {
  void languageIconsRevision.value
  if (detail?.kind !== "file") return ""
  const language = fileLanguage(detail.path)
  if (language === "text") return ""
  return `data:image/svg+xml;utf8,${encodeURIComponent(getLanguageIcon(language))}`
}

type CallBase = {
  item: ToolCallView
  expandable: boolean
}

type CallView =
  | (CallBase & {
      variant: "command"
      command: string
      cwd: string
      outputText: string
      outputImages: TranscriptImage[]
      emptyOutput: string
      commandStatus: "error" | "running" | "success"
      statusLabel: string
    })
  | (CallBase & {
      variant: "read"
      path: string
      preview: ReadToolPreview
    })
  | (CallBase & {
      variant: "edit"
      editPreview: EditDiffPreview
    })
  | (CallBase & {
      variant: "tool"
      inputFull: string
      outputText: string
      outputImages: TranscriptImage[]
      emptyOutput: string
      outputLabel: string
    })

function output(item: ToolCallView, open: boolean) {
  return {
    outputText: open ? item.outputText : "",
    outputImages: open ? item.outputImages : [],
    emptyOutput: item.running ? "(running…)" : "(no output)",
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

export function presentCall(item: ToolCallView, open: boolean): CallView {
  const name = item.toolName.trim().toLowerCase()
  if (isCommandTool(name)) {
    return {
      item,
      expandable: true,
      variant: "command",
      command: toolCommand(item.input),
      cwd: toolWorkingDirectory(item.input),
      ...output(item, open),
      commandStatus: item.isError ? "error" : item.running ? "running" : "success",
      statusLabel: item.isError ? "执行失败" : item.running ? "正在执行" : "执行完成",
    }
  }

  const key = toolGroupKey(item.toolName)
  if (key === "read") {
    const path = toolPath(item.input)
    const out = output(item, open)
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
        item,
        expandable: true,
        variant: "read",
        path,
        preview: readToolPreview(item.input, out.outputText),
      }
    }
    return {
      item,
      expandable: true,
      variant: "tool",
      ...out,
      inputFull: "",
      outputLabel: path || "Read",
    }
  }

  if (key === "edit") {
    const preview = open && !item.isError && !item.running ? editDiffPreview(item.input) : null
    if (preview) {
      return { item, expandable: true, variant: "edit", editPreview: preview }
    }
  }

  return {
    item,
    expandable: hasBody(item),
    variant: "tool",
    ...output(item, open),
    inputFull: open ? toolInputPretty(item.input) : "",
    outputLabel: "输出",
  }
}
