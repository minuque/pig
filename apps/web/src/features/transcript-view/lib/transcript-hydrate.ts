/** 流式立刻画；历史等揭开、停稳、没有待处理输入。刚打开不算停稳。 */
export function shouldHydrateHeavy(
  streaming: boolean,
  inView: boolean,
  scrollIdle: boolean,
  pendingInput = false,
  openedQuiet = true,
): boolean {
  if (streaming) return true
  return inView && scrollIdle && !pendingInput && openedQuiet
}

export function nextHydrateId(
  rows: readonly { id: string; role: string; streaming?: boolean }[],
  hydrated: ReadonlySet<string>,
  inView: ReadonlySet<string>,
  scrollIdle: boolean,
  pendingInput = false,
  openedQuiet = true,
): string | undefined {
  if (!scrollIdle || pendingInput || !openedQuiet) return undefined

  for (const row of rows) {
    if (row.role !== "assistant" || row.streaming || hydrated.has(row.id)) continue

    if (!shouldHydrateHeavy(false, inView.has(row.id), true, false, true)) continue
    return row.id
  }
}

export function nextRichId(
  rows: readonly { id: string; role: string; streaming?: boolean }[],
  hydrated: ReadonlySet<string>,
  rich: ReadonlySet<string>,
  inView: ReadonlySet<string>,
  scrollIdle: boolean,
  pendingInput = false,
  openedQuiet = true,
): string | undefined {
  if (!scrollIdle || pendingInput || !openedQuiet) return undefined

  for (const row of rows) {
    if (row.role !== "assistant" || row.streaming) continue

    if (!hydrated.has(row.id) || rich.has(row.id)) continue

    if (!inView.has(row.id)) continue
    return row.id
  }
}
