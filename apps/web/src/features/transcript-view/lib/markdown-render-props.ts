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

const HISTORY_LIVE_NODES = 96

const BATCH_BUDGET_MS = 8

const HEAVY_FENCE = /```(?:infographic|mermaid|d2)[^\n]*\n[\s\S]*?```/gi

/** 轻量档去掉图和图表围栏，避免第一下就把主线程卡死。 */
export function withoutHeavyBlocks(text: string): string {
  return text.replace(HEAVY_FENCE, "").trim()
}

/** 流式分帧；历史先轻量，停稳再上 infographic / Mermaid / 高亮。 */
export function chatMarkdownProps(input: {
  streaming: boolean
  isDark: boolean
  rich?: boolean
}): NodeRendererProps {
  const streaming = input.streaming
  const rich = streaming || input.rich === true

  if (!rich) return plainMarkdownProps({ streaming: false, isDark: input.isDark })
  return {
    customId: "chat",
    mode: "chat",
    fade: false,
    isDark: input.isDark,
    final: !streaming,
    typewriter: false,
    smoothStreaming: false,
    nodeVirtual: streaming ? false : true,
    maxLiveNodes: streaming ? 0 : HISTORY_LIVE_NODES,
    batchRendering: true,
    initialRenderBatchSize: streaming ? 8 : 12,
    renderBatchSize: 16,
    renderBatchDelay: 0,
    renderBatchBudgetMs: BATCH_BUDGET_MS,
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

/** 思考 / 预览：轻量 pre，不走增强代码卡片。 */
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
    batchRendering: true,
    renderBatchBudgetMs: BATCH_BUDGET_MS,
    isDark: input.isDark,
    codeBlockOptions: codeBlockTypography(),
    codeBlockProps: { theme: codeBlockTheme },
  }
}
