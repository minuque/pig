export type MarkdownRuntimeNeed = {
  mermaid: boolean
  katex: boolean
  code: boolean
}

/** 末条纯文字不应命中；有围栏/公式才装对应运行时。 */
export function markdownRuntimeNeeds(text: string): MarkdownRuntimeNeed {
  return {
    mermaid: /```[^\n]*\bmermaid\b/i.test(text),
    katex: /\$\$|\\\[|\\\(|\\begin\{/.test(text),
    code: /```/.test(text),
  }
}

export function needsMarkdownRuntime(text: string): boolean {
  const need = markdownRuntimeNeeds(text)
  return need.mermaid || need.katex || need.code
}
