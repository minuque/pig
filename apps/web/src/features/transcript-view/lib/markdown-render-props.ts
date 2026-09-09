import type { NodeRendererProps } from "markstream-vue"
import { codeBlockTypography } from "@features/transcript-view/lib/code-block-options.js"

type CodeBlockTheme = "dark-plus" | "light-plus"

const mermaidProps = {
  renderDebounceMs: 180,
  contentStableDelayMs: 500,
  showHeader: true,
  showFullscreenButton: true,
} as const

const chatCodeChrome = {
  showHeader: true,
  showCopyButton: true,
  showCollapseButton: true,
  showExpandButton: true,
} as const

/** 聊天正文：吐字由 useTranscriptReveal 控节奏；历史一次画完。 */
export function chatMarkdownProps(input: {
  streaming: boolean
  isDark: boolean
  codeBlockProps: { theme: CodeBlockTheme }
}): NodeRendererProps {
  const streaming = input.streaming
  return {
    customId: "chat",
    mode: "chat",
    fade: false,
    isDark: input.isDark,
    final: !streaming,
    typewriter: false,
    smoothStreaming: false,
    viewportPriority: false,
    deferNodesUntilVisible: false,
    nodeVirtual: false,
    batchRendering: streaming,
    maxLiveNodes: 0,
    codeBlockOptions: {
      ...codeBlockTypography(),
      diffStyle: "unified",
    },
    codeBlockProps: {
      ...input.codeBlockProps,
      ...chatCodeChrome,
    },
    mermaidProps,
  }
}

/** 思考卡 / 预览：轻量 pre，不走增强代码卡片。 */
export function plainMarkdownProps(input: {
  streaming?: boolean
  isDark: boolean
  codeBlockProps?: { theme: CodeBlockTheme }
}): NodeRendererProps {
  const streaming = Boolean(input.streaming)
  return {
    customId: "chat",
    mode: "minimal",
    renderCodeBlocksAsPre: true,
    fade: false,
    final: !streaming,
    typewriter: false,
    smoothStreaming: false,
    isDark: input.isDark,
    codeBlockOptions: codeBlockTypography(),
    ...(input.codeBlockProps ? { codeBlockProps: input.codeBlockProps } : {}),
  }
}
