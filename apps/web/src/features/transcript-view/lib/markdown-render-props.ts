import type { NodeRendererProps } from "markstream-vue"
import { codeBlockTypography } from "@features/transcript-view/lib/code-block-options.js"

type CodeBlockTheme = "dark-plus" | "light-plus"

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

/** 吐字只切字；气泡关掉批挂和虚拟化，避免 800×600 占位。历史揭开前仍推迟重节点。 */
export function chatMarkdownProps(input: {
  streaming: boolean
  isDark: boolean
  codeBlockProps: { theme: CodeBlockTheme }
  settleMarkdown?: boolean
}): NodeRendererProps {
  const streaming = input.streaming
  const settle = Boolean(input.settleMarkdown)
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
    viewportPriority: !streaming && !settle,
    deferNodesUntilVisible: !streaming && !settle,
    codeBlockStream: streaming,
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
    nodeVirtual: false,
    maxLiveNodes: 0,
    batchRendering: false,
    isDark: input.isDark,
    codeBlockOptions: codeBlockTypography(),
    ...(input.codeBlockProps ? { codeBlockProps: input.codeBlockProps } : {}),
  }
}
