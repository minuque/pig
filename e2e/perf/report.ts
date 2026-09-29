const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"
const SLOW_RATIO = 0.1

export type MetricRow = {
  label: string
  group?: string
  value: number | null
  p90?: number | null
  previous?: number | null
  /** 值是最长帧，帧率列显示换算后的 fps */
  frame?: boolean
  unit?: "ms" | "cls"
}

function paint(text: string, color: "green" | "red" | null) {
  if (color === "green") return `${GREEN}${text}${RESET}`

  if (color === "red") return `${RED}${text}${RESET}`
  return text
}

/** 全角占两格的码点。制表符、破折号按终端的单格宽算。 */
function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    code >= 0x20000
  )
}

function displayWidth(text: string): number {
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "")
  let width = 0

  for (const ch of plain) width += isWide(ch.codePointAt(0) ?? 0) ? 2 : 1
  return width
}

function pad(text: string, width: number, align: "left" | "right") {
  const extra = Math.max(0, width - displayWidth(text))
  const space = " ".repeat(extra)
  return align === "right" ? space + text : text + space
}

function formatMetric(value: number | null | undefined, unit: "ms" | "cls" = "ms") {
  if (value == null || !Number.isFinite(value)) return "—"

  if (unit === "cls") return Number(value.toFixed(3)).toString()
  return `${Number(value.toFixed(1))} ms`
}

function formatFps(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || !(value > 0)) return "—"
  return `约 ${Math.round(1000 / value)} fps`
}

function changeText(value: number | null, previous: number | null, unit: "ms" | "cls" = "ms") {
  if (value == null || previous == null || !Number.isFinite(value) || !Number.isFinite(previous))
    return "—"
  const diff = value - previous
  const percent =
    previous === 0 ? "" : ` (${diff > 0 ? "+" : ""}${((diff / previous) * 100).toFixed(1)}%)`
  return `${diff > 0 ? "+" : ""}${formatMetric(diff, unit)}${percent}`
}

function tone(value: number | null, previous: number | null): "green" | "red" | null {
  if (value == null || previous == null || !Number.isFinite(value) || !Number.isFinite(previous))
    return null

  if (value < previous) return "green"

  if (previous > 0 && (value - previous) / previous > SLOW_RATIO) return "red"
  return null
}

function rule(widths: readonly number[], left: string, mid: string, right: string) {
  return left + widths.map((width) => "─".repeat(width + 2)).join(mid) + right
}

function rowLine(
  parts: string[],
  widths: readonly number[],
  aligns: readonly ("left" | "right")[],
) {
  const inner = parts
    .map((part, index) => ` ${pad(part, widths[index] ?? 0, aligns[index] ?? "left")} `)
    .join("│")
  return `│${inner}│`
}

/** 分组标题行：标题在左，横线填满剩余宽度。 */
function sectionLine(label: string, innerWidth: number) {
  const text = `${DIM}${label}${RESET} `
  return `│ ${text}${"─".repeat(Math.max(0, innerWidth - displayWidth(text) - 2))} │`
}

/** 一张带边框的表。变快为绿，变慢超过 10% 为红。 */
export function reportTable(rows: readonly MetricRow[]) {
  const visible = rows.filter((row) => row.value != null && Number.isFinite(row.value))

  if (visible.length === 0) return

  const cells = visible.map((row) => {
    const color = tone(row.value, row.previous ?? null)
    const unit = row.unit ?? "ms"
    return {
      group: row.group ?? "",
      label: row.label,
      now: paint(formatMetric(row.value, unit), color),
      p90: formatMetric(row.p90 ?? null, unit),
      prev: formatMetric(row.previous ?? null, unit),
      // fps 是派生量，单独成列，不塞进毫秒列
      fps: row.frame ? formatFps(row.value) : "—",
      // 帧指标的差值换算 fps 无意义，变化列只显示 ms
      change: paint(changeText(row.value, row.previous ?? null, unit), color),
    }
  })
  const cols = [
    { key: "label" as const, title: "指标", align: "left" as const },
    { key: "now" as const, title: "本次", align: "right" as const },
    { key: "p90" as const, title: "p90", align: "right" as const },
    { key: "prev" as const, title: "上次", align: "right" as const },
    { key: "fps" as const, title: "帧率", align: "right" as const },
    { key: "change" as const, title: "变化", align: "right" as const },
  ]
  const widths = cols.map((col) =>
    Math.max(displayWidth(col.title), ...cells.map((cell) => displayWidth(cell[col.key]))),
  )
  const aligns = cols.map((col) => col.align)
  const keys = cols.map((col) => col.key)
  const innerWidth = widths.reduce((sum, width) => sum + width + 2, 0) + (widths.length - 1)

  console.log(`\n${rule(widths, "┌", "┬", "┐")}`)
  console.log(
    rowLine(
      cols.map((col) => col.title),
      widths,
      aligns,
    ),
  )
  console.log(rule(widths, "├", "┼", "┤"))

  let group = ""

  for (const cell of cells) {
    if (cell.group && cell.group !== group) {
      if (group) console.log(rule(widths, "├", "┼", "┤"))
      group = cell.group
      console.log(sectionLine(group, innerWidth))
    }

    console.log(
      rowLine(
        keys.map((key) => cell[key]),
        widths,
        aligns,
      ),
    )
  }

  console.log(rule(widths, "└", "┴", "┘"))
}
