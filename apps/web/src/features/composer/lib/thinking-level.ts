/** 协议档位原文，仅首字母大写。 */
export function formatThinkingLevel(level: string): string {
  if (!level) return ""

  return level.charAt(0).toUpperCase() + level.slice(1)
}

/** 当前档不在模型档位里时落到第一档，只用于展示。 */
export function displayThinkingLevel(level: string, levels: readonly string[]): string {
  return levels.includes(level) ? level : (levels[0] ?? "")
}

/** 触发器 title / aria-label：模型名 + 当前思考档。 */
export function pickerTriggerText(name: string, level: string, levels: readonly string[]): string {
  const formatted = formatThinkingLevel(displayThinkingLevel(level, levels))

  return formatted ? `${name}，思考强度：${formatted}` : name
}
