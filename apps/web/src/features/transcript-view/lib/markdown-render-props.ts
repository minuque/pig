import type { NodeRendererProps } from "markstream-vue"

type CodeBlockTheme = "dark-plus" | "light-plus"

const cssPxCache = new Map<string, number>()

function cssPx(name: string, fallback: number): number {
  if (typeof document === "undefined") return fallback
  const hit = cssPxCache.get(name)

  if (hit !== undefined) return hit
  const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  const value = Number.isFinite(n) ? n : fallback
  cssPxCache.set(name, value)
  return value
}

function codeBlockTypography() {
  return {
    fontSize: cssPx("--text-code", 14),
    lineHeight: cssPx("--text-code-line", 22),
    fontFamily: "var(--font-mono)",
  } as const
}

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

/** 流式分帧；历史长文开窗口，单帧预算压在 8ms。 */
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

/** 空闲时预热 Shiki/wasm，避免第一条代码块卡滚动。 */
export function prefetchHighlighter(): void {
  const run = () => {
    void import("stream-diffs/pierre").then(({ getSharedHighlighter }) => {
      const dark = document.documentElement.classList.contains("dark")
      return getSharedHighlighter({
        themes: [dark ? "dark-plus" : "light-plus"],
        langs: ["typescript"],
      })
    })
  }

  if (typeof requestIdleCallback === "function") requestIdleCallback(run)
  else setTimeout(run, 1)
}
