export interface FontOption {
  value: string
  label: string
  family?: string
}

export function fontOptions(families: readonly string[], current: string): FontOption[] {
  const list = current && !families.includes(current) ? [current, ...families] : families
  return list.map((family) => ({ value: family, label: family, family }))
}
