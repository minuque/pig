export interface SessionTab {
  id: string
  title: string
}

/** 新开的会话追加到末尾；已打开的保持原位。 */
export function openSessionTab(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id]
}

/** 拖到目标标签之前；目标为空时追加到末尾。 */
export function moveSessionTab(
  ids: readonly string[],
  draggedId: string,
  overId?: string,
): string[] {
  if (draggedId === overId) return [...ids]

  const next = ids.filter((id) => id !== draggedId)

  if (overId === undefined) return [...next, draggedId]

  const overIndex = next.indexOf(overId)

  if (overIndex < 0) return [...ids]
  next.splice(overIndex, 0, draggedId)
  return next
}

/** 关掉一个标签后应显示的会话：优先右侧，其次左侧，都没有则空。 */
export function sessionTabAfterClose(ids: readonly string[], closedId: string): string | undefined {
  const index = ids.indexOf(closedId)

  if (index < 0) return ids[0]
  return ids[index + 1] ?? ids[index - 1]
}

/** 批量关闭后应显示的会话：锚点还在就留在锚点，否则取剩余第一项。 */
export function sessionTabAfterCloseMany(
  ids: readonly string[],
  closedIds: readonly string[],
  anchorId: string,
): string | undefined {
  const closed = new Set(closedIds)
  const remaining = ids.filter((id) => !closed.has(id))

  if (remaining.includes(anchorId)) return anchorId
  return remaining[0]
}

/** 右键菜单可关闭的范围：锚点左侧、右侧、其余。 */
export function sessionTabsInCloseScope(
  ids: readonly string[],
  anchorId: string,
  scope: "left" | "right" | "others",
): string[] {
  const index = ids.indexOf(anchorId)

  if (index < 0) return []

  if (scope === "left") return ids.slice(0, index)

  if (scope === "right") return ids.slice(index + 1)
  return ids.filter((id) => id !== anchorId)
}
