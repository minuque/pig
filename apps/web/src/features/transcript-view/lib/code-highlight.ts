import type { Directive } from "vue"

type CodeBlockTheme = "github-dark" | "github-light"

/** 进程内先到先得，预热这一处决定整条链。 */
const preferredHighlighter = "highlights" as const

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
  const highlighter = await getSharedHighlighter({
    themes: [theme],
    langs: [lang],
    preferredHighlighter,
  })

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
        preferredHighlighter,
      })
    })
    .then(() => undefined)
    .catch(() => undefined)
}
