import {
  markdownRuntimeNeeds,
  type MarkdownRuntimeNeed,
} from "@features/transcript-view/lib/markdown-runtime-needs.js"

const installed = { mermaid: false, katex: false, code: false }
const queued: string[] = []
let painted = false

async function apply(need: MarkdownRuntimeNeed) {
  const next = {
    katex: need.katex && !installed.katex,
    mermaid: need.mermaid && !installed.mermaid,
    code: need.code && !installed.code,
  }
  if (!next.katex && !next.mermaid && !next.code) return
  if (next.katex) installed.katex = true
  if (next.mermaid) installed.mermaid = true
  if (next.code) installed.code = true
  try {
    if (next.katex) {
      const { installKatexRuntime } = await import("./markdown-runtime-katex.js")
      installKatexRuntime()
    }
    if (next.mermaid) {
      const { installMermaidRuntime } = await import("./markdown-runtime-mermaid.js")
      installMermaidRuntime()
    }
    if (next.code) {
      const { installCodeRuntime } = await import("./markdown-runtime-code.js")
      await installCodeRuntime()
    }
  } catch (error) {
    if (next.katex) installed.katex = false
    if (next.mermaid) installed.mermaid = false
    if (next.code) installed.code = false
    throw error
  }
}

/** 按文本需要动态装 KaTeX / Mermaid / Shiki；纯文字不拉 worker。 */
export function ensureMarkdownRuntime(text: string) {
  const need = markdownRuntimeNeeds(text)
  if (!need.katex && !need.mermaid && !need.code) return
  if (!painted) {
    queued.push(text)
    return
  }
  void apply(need)
}

export function ensureCodeRuntime() {
  if (!painted) {
    queued.push("```\n")
    return
  }
  void apply({ mermaid: false, katex: false, code: true })
}

/** 正文揭开前装齐已排队的运行时，避免 loading 刚撤上翻时再拉 worker。 */
export async function flushMarkdownRuntime() {
  painted = true
  const texts = queued.splice(0)
  const need = { mermaid: false, katex: false, code: false }
  for (const text of texts) {
    const next = markdownRuntimeNeeds(text)
    need.mermaid = need.mermaid || next.mermaid
    need.katex = need.katex || next.katex
    need.code = need.code || next.code
  }
  await apply(need)
}
