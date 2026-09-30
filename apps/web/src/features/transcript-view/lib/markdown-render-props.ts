import {
  setCustomComponents,
  type MarkstreamVirtualState,
  type NodeRendererProps,
} from "markstream-vue"
import type { Directive } from "vue"
import ChatCodeBlock from "@features/transcript-view/components/ChatCodeBlock.vue"
import TranscriptMarkdownLink from "@features/transcript-view/components/TranscriptMarkdownLink.vue"

let installed = false

function installChatMarkdownComponents(): void {
  if (installed) return
  installed = true
  setCustomComponents("chat", {
    link: TranscriptMarkdownLink,
    code_block: ChatCodeBlock,
  })
}

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
    fontSize: cssPx("--text-code", 13),
    lineHeight: cssPx("--text-code-line", 24.5),
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
  showExpandButton: false,
  showFontSizeButtons: false,
  enableFontSizeControl: false,
  showPreviewButton: false,
  showLineNumbers: false,
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
    customId: "thought",
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
    codeBlockProps: {
      theme: codeBlockTheme,
      showHeader: false,
      showCopyButton: false,
      showCollapseButton: false,
      showExpandButton: false,
    },
  }
}

export type CodeTokens = { content: string; color?: string }[][]

const TOKEN_CACHE_MAX = 32
const tokenCache = new Map<string, CodeTokens>()

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function")
      requestIdleCallback(() => resolve(), { timeout: 500 })
    else setTimeout(resolve, 0)
  })
}

/** 按 (theme, lang, code) 缓存；未命中时等空闲再分词，不和展开动画抢主线程。 */
export async function highlightCodeTokens(
  code: string,
  lang: string,
  theme: CodeBlockTheme,
): Promise<CodeTokens> {
  const key = `${theme}\0${lang}\0${code}`
  const hit = tokenCache.get(key)

  if (hit) {
    tokenCache.delete(key)
    tokenCache.set(key, hit)
    return hit
  }

  const { getSharedHighlighter } = await import("stream-diffs/pierre")
  const highlighter = await getSharedHighlighter({ themes: [theme], langs: [lang] })
  await idle()
  const tokens = highlighter.codeToTokens(code, { lang, theme }).tokens
  tokenCache.set(key, tokens)

  if (tokenCache.size > TOKEN_CACHE_MAX) tokenCache.delete(tokenCache.keys().next().value ?? "")
  return tokens
}

function renderTokenLine(el: HTMLElement, line: CodeTokens[number]) {
  el.replaceChildren(
    ...line.map((token) => {
      if (!token.color) return token.content
      const span = document.createElement("span")
      span.style.color = token.color
      span.textContent = token.content
      return span
    }),
  )
}

/** 一行 token 直接写 DOM（textContent，不解析 HTML），避免每个 token 一个 vnode。 */
export const vTokenLine: Directive<HTMLElement, CodeTokens[number]> = {
  mounted: (el, { value }) => renderTokenLine(el, value),
  updated: (el, { value, oldValue }) => {
    if (value !== oldValue) renderTokenLine(el, value)
  },
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
