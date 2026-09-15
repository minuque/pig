/** 流式立刻画；历史重节点等进视口且滚动停下。 */
export function shouldHydrateHeavy(
  streaming: boolean,
  inView: boolean,
  scrollIdle: boolean,
): boolean {
  return streaming || (inView && scrollIdle)
}

export function nextHydrateId(
  rows: readonly { id: string; role: string; streaming?: boolean }[],
  hydrated: ReadonlySet<string>,
  inView: ReadonlySet<string>,
  scrollIdle: boolean,
): string | undefined {
  if (!scrollIdle) return undefined

  for (const row of rows) {
    if (row.role !== "assistant" || row.streaming || hydrated.has(row.id)) continue

    if (!shouldHydrateHeavy(false, inView.has(row.id), true)) continue
    return row.id
  }
}
