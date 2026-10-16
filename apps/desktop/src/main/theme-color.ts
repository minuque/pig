/** 渲染进程上报的窗口底色。只收 #rgb / #rrggbb 和 rgb()/rgba()，其余丢弃。 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/

export function parseThemeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const color = value.trim()
  return HEX_COLOR.test(color) || RGB_COLOR.test(color) ? color : undefined
}
