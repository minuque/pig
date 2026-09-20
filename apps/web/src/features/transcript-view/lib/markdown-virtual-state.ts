import type { MarkstreamVirtualState } from "markstream-vue"

const STATE_LIMIT = 30
const states = new Map<string, MarkstreamVirtualState>()

/** 行重挂（切会话、hydrate 切换）后恢复库内部虚拟状态，避免整段重排。 */
export function saveMarkdownVirtualState(key: string, state: MarkstreamVirtualState): void {
  states.delete(key)
  states.set(key, state)

  while (states.size > STATE_LIMIT) {
    const oldest = states.keys().next().value

    if (oldest === undefined || oldest === key) break
    states.delete(oldest)
  }
}

/** 取出缓存的虚拟状态；没有则返回 null 让库按新内容估算。 */
export function takeMarkdownVirtualState(key: string): MarkstreamVirtualState | null {
  const hit = states.get(key)

  if (!hit) return null
  states.delete(key)
  states.set(key, hit)
  return hit
}
