/** 更长列表的前缀是新历史，prev 仍作为后缀出现。 */
export function historyPrepended(
  prev: readonly { readonly id: string }[],
  next: readonly { readonly id: string }[],
): boolean {
  if (prev.length === 0 || next.length <= prev.length) return false
  const offset = next.length - prev.length
  for (let i = 0; i < prev.length; i += 1) {
    if (next[offset + i]?.id !== prev[i]?.id) return false
  }
  return true
}
