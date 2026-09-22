import type { MarkstreamVirtualState, NodeRendererProps } from "markstream-vue"
import { installChatMarkdownComponents } from "@features/transcript-view/lib/markdown-components.js"

installChatMarkdownComponents()

type CodeBlockTheme = "github-dark" | "github-light"

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

const codeBlockTheme = { dark: "github-dark", light: "github-light" } as const satisfies Record<
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
const BATCH_BUDGET_MS = 8

/** 历史挂载即终态；流式仍 defer 分帧长高。节点虚拟化交给库，单帧预算 8ms。 */
export function chatMarkdownProps(input: {
  streaming: boolean
  isDark: boolean
  sessionKey?: string
  restoreState?: MarkstreamVirtualState | null
}): NodeRendererProps {
  const streaming = input.streaming
  const props: NodeRendererProps = {
    customId: "chat",
    mode: "chat",
    fade: false,
    isDark: input.isDark,
    final: !streaming,
    typewriter: false,
    smoothStreaming: false,
    nodeVirtual: "auto",
    maxLiveNodes: 0,
    liveNodeBuffer: 0,
    batchRendering: true,
    initialRenderBatchSize: 32,
    renderBatchSize: 48,
    renderBatchDelay: 6,
    renderBatchBudgetMs: BATCH_BUDGET_MS,
    renderBatchIdleTimeoutMs: 60,
    viewportPriority: false,
    deferNodesUntilVisible: streaming,
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

  if (input.sessionKey !== undefined) {
    props.virtualScroll = {
      enabled: !streaming,
      sessionKey: input.sessionKey,
      restoreState: input.restoreState ?? null,
    }
  }

  return props
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
    nodeVirtual: "auto",
    maxLiveNodes: 0,
    batchRendering: true,
    initialRenderBatchSize: 32,
    renderBatchSize: 48,
    renderBatchDelay: 6,
    renderBatchBudgetMs: BATCH_BUDGET_MS,
    renderBatchIdleTimeoutMs: 60,
    deferNodesUntilVisible: true,
    isDark: input.isDark,
    codeBlockOptions: codeBlockTypography(),
    codeBlockProps: { theme: codeBlockTheme },
  }
}

let highlighterWork: Promise<void> | undefined

/** 首屏就预热 Shiki/wasm，不等空闲，避免第一条代码块卡滚动。 */
export function prefetchHighlighter(): void {
  if (highlighterWork) return
  highlighterWork = import("stream-diffs/pierre")
    .then(({ getSharedHighlighter }) => {
      const dark = document.documentElement.classList.contains("dark")
      return getSharedHighlighter({
        themes: [dark ? "github-dark" : "github-light"],
        langs: ["typescript"],
      })
    })
    .then(() => undefined)
    .catch(() => undefined)
}
