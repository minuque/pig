/** 流式立刻画；历史重节点等进视口、滚动停下且没有待处理输入。 */
export function shouldHydrateHeavy(
  streaming: boolean,
  inView: boolean,
  scrollIdle: boolean,
  pendingInput = false,
): boolean {
  if (streaming) return true
  return inView && scrollIdle && !pendingInput
}

export function nextHydrateId(
  rows: readonly { id: string; role: string; streaming?: boolean }[],
  hydrated: ReadonlySet<string>,
  inView: ReadonlySet<string>,
  scrollIdle: boolean,
  pendingInput = false,
): string | undefined {
  if (!scrollIdle || pendingInput) return undefined

  for (const row of rows) {
    if (row.role !== "assistant" || row.streaming || hydrated.has(row.id)) continue

    if (!shouldHydrateHeavy(false, inView.has(row.id), true, false)) continue
    return row.id
  }
}
