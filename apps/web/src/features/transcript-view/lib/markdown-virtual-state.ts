import type { MarkstreamVirtualState } from "markstream-vue"

const SESSION_SCOPE_MAX = 4
const ROW_STATE_LIMIT = 30
const scopes = new Map<string, Map<string, MarkstreamVirtualState>>()

/** 取会话 scope 的状态表，命中就提升到最近使用。 */
function scopeStates(scope: string): Map<string, MarkstreamVirtualState> {
  const hit = scopes.get(scope)

  if (hit) {
    scopes.delete(scope)
    scopes.set(scope, hit)
    return hit
  }

  const created = new Map<string, MarkstreamVirtualState>()

  scopes.set(scope, created)

  while (scopes.size > SESSION_SCOPE_MAX) {
    const oldest = scopes.keys().next().value

    if (oldest === undefined || oldest === scope) break
    scopes.delete(oldest)
  }

  return created
}

/** 行重挂后恢复库内部虚拟状态，按会话 scope 分开存，最多留 4 个会话。 */
export function saveMarkdownVirtualState(
  scope: string,
  rowId: string,
  state: MarkstreamVirtualState,
): void {
  const states = scopeStates(scope)

  states.delete(rowId)
  states.set(rowId, state)

  while (states.size > ROW_STATE_LIMIT) {
    const oldest = states.keys().next().value

    if (oldest === undefined || oldest === rowId) break
    states.delete(oldest)
  }
}

/** 取出缓存的虚拟状态；没有则返回 null 让库按新内容估算。 */
export function takeMarkdownVirtualState(
  scope: string,
  rowId: string,
): MarkstreamVirtualState | null {
  const states = scopeStates(scope)
  const hit = states.get(rowId)

  if (!hit) return null
  states.delete(rowId)
  states.set(rowId, hit)
  return hit
}
