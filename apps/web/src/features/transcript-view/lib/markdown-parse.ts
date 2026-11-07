import { createSerializedMarkdownParser, type ComarkParseFn, type Node } from "comark"
import taskList from "comark/plugins/task-list"

/** 不开 html / 组件语法 / frontmatter：助手正文里的 `<div>`、`std::vec`、开头的 `---` 都按原文显示。 */
const plugins = [taskList()]
const FINAL_CACHE_MAX = 200
const finalCache = new Map<string, { text: string; nodes: Node[] }>()

export function createStreamParser(): ComarkParseFn {
  return createSerializedMarkdownParser({
    registerDefaultPlugins: false,
    plugins,
    headingIds: false,
  })
}

/** 终态解析结果按消息缓存，历史行重挂时同步取用，不再解析。 */
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
