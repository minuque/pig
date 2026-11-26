export function formatThinkingLevel(level: string): string {
  if (!level) return ""
  return level.charAt(0).toUpperCase() + level.slice(1)
}

export function displayThinkingLevel(level: string, levels: readonly string[]): string {
  return levels.includes(level) ? level : (levels[0] ?? "")
}

export function pickerTriggerText(name: string, level: string, levels: readonly string[]): string {
  const formatted = formatThinkingLevel(displayThinkingLevel(level, levels))
  return formatted ? `${name} · ${formatted}` : name
}
