import {
  commandCodeTheme,
  highlightCodeTokens,
  isHighlightable,
} from "@features/transcript-view/lib/code-highlight.js"
import { toolCallVariant } from "@features/transcript-view/lib/tool-run.js"
import { readToolPreview } from "@features/transcript-view/lib/tool-summary.js"
import { toolCommand } from "@features/transcript-view/lib/transcript-format.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

type CodeTheme = Parameters<typeof highlightCodeTokens>[2]

export function warmToolHighlight(call: ToolCallView, dark: boolean, codeTheme: CodeTheme): void {
  const variant = toolCallVariant(call)

  if (variant === "command") {
    const command = toolCommand(call.input)

    if (command) void highlightCodeTokens(command, "bash", commandCodeTheme(dark)).catch(() => {})
    return
  }

  if (variant !== "read" || call.isError || call.running) return
  const { code, language } = readToolPreview(call.input, call.outputText)

  if (isHighlightable(code, language))
    void highlightCodeTokens(code, language, codeTheme).catch(() => {})
}
