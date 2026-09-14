import type { NodeRendererProps } from "markstream-vue"
import { codeBlockTypography } from "@features/transcript-view/lib/code-block-options.js"

type CodeBlockTheme = "dark-plus" | "light-plus"

const codeBlockTheme = { dark: "dark-plus", light: "light-plus" } as const satisfies Record<
  "dark" | "light",
  CodeBlockTheme
>

const mermaidProps = {
  renderDebounceMs: 180,
  contentStableDelayMs: 500,
  estimatedPreviewHeightPx: 240,
  showHeader: true,
  showFullscreenButton: true,
} as const

const chatCodeChrome = {
  showHeader: true,
  showCopyButton: true,
  showCollapseButton: true,
  showExpandButton: true,
} as const

/** 流式不切字；非流式推迟代码块等到进视口。 */
export function chatMarkdownProps(input: {
  streaming: boolean
  isDark: boolean
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
    nodeVirtual: false,
    maxLiveNodes: 0,
    batchRendering: false,
    viewportPriority: !streaming,
    deferNodesUntilVisible: !streaming,
    codeBlockStream: streaming,
    codeBlockOptions: {
      ...codeBlockTypography(),
      diffStyle: "unified",
    },
    codeBlockProps: {
      theme: codeBlockTheme,
      ...chatCodeChrome,
    },
    mermaidProps,
  }
}

/** 思考卡 / 预览：轻量 pre，不走增强代码卡片。 */
export function plainMarkdownProps(input: {
  streaming?: boolean
  isDark: boolean
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
    nodeVirtual: false,
    maxLiveNodes: 0,
    batchRendering: false,
    isDark: input.isDark,
    codeBlockOptions: codeBlockTypography(),
    codeBlockProps: { theme: codeBlockTheme },
  }
}
