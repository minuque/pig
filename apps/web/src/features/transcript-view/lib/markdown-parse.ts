import {
  createSerializedMarkdownParser,
  defineComarkPlugin,
  type ComarkParseFn,
  type MarkdownExitPlugin,
  type Node,
} from "comark"
import taskList from "comark/plugins/task-list"

const looseDomainsOff: MarkdownExitPlugin = (md) => void md.linkify.set({ fuzzyLink: false })
const strictLinkify = defineComarkPlugin(() => ({
  name: "strict-linkify",
  markdownItPlugins: [looseDomainsOff],
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
