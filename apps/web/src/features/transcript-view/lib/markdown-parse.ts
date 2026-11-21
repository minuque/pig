import {
  createSerializedMarkdownParser,
  defineComarkPlugin,
  type ComarkParseFn,
  type MarkdownExitPlugin,
  type Node,
} from "comark"
import taskList from "comark/plugins/task-list"

const SCRIPT_PUNCTUATION = /(?=[\u3000-\u303f\uff00-\uffef\u060c\u061b\u061f\u06d4])[\p{P}\p{S}]/u
const looseDomainsOff: MarkdownExitPlugin = (md) => void md.linkify.set({ fuzzyLink: false })
const endAtScriptPunctuation: MarkdownExitPlugin = (md) => {
  md.core.ruler.after("linkify", "end-autolink-at-script-punctuation", (state) => {
    for (const block of state.tokens) {
      const children = block.type === "inline" ? block.children : null

      if (!children) continue

      for (let index = 0; index + 2 < children.length; index++) {
        const [open, label, close] = children.slice(index, index + 3)

        if (
          open?.type !== "link_open" ||
          open.markup !== "linkify" ||
          label?.type !== "text" ||
          close?.type !== "link_close"
        )
          continue
        const at = label.content.search(/[^!-~]/u)

        if (at <= 0 || !SCRIPT_PUNCTUATION.test(label.content.charAt(at))) continue
        const url = label.content.slice(0, at).replace(/[!"'*,.:;?_~]+$/, "")
        const tail = new state.Token("text", "", 0)
        tail.content = label.content.slice(url.length)
        open.attrSet("href", md.normalizeLink(url))
        label.content = url
        children.splice(index + 3, 0, tail)
      }
    }
  })
}
const strictLinkify = defineComarkPlugin(() => ({
  name: "strict-linkify",
  markdownItPlugins: [looseDomainsOff, endAtScriptPunctuation],
}))
const plugins = [taskList(), strictLinkify()]
const FINAL_CACHE_MAX = 200
const finalCache = new Map<string, { text: string; nodes: Node[] }>()

export function createStreamParser(): ComarkParseFn {
  return createSerializedMarkdownParser({
    registerDefaultPlugins: false,
    plugins,
    headingIds: false,
  })
}

export function cachedFinalNodes(key: string, text: string): Node[] | null {
  const hit = finalCache.get(key)

  if (!hit || hit.text !== text) return null
  finalCache.delete(key)
  finalCache.set(key, hit)
  return hit.nodes
}

export function storeFinalNodes(key: string, text: string, nodes: Node[]): void {
  finalCache.delete(key)
  finalCache.set(key, { text, nodes })

  if (finalCache.size > FINAL_CACHE_MAX) finalCache.delete(finalCache.keys().next().value ?? "")
}
