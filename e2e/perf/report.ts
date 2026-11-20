const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
const BOLD = "\x1b[1m"
const RESET = "\x1b[0m"
const SLOW_RATIO = 0.1

export type MetricRow = {
  label: string
  group?: string
  value: number | null
  p90?: number | null
  previous?: number | null
  frame?: boolean
  unit?: "ms" | "cls"
}

function paint(text: string, color: "green" | "red" | null) {
  if (color === "green") return `${GREEN}${text}${RESET}`

  if (color === "red") return `${RED}${text}${RESET}`
  return text
}

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

function sectionLine(label: string, innerWidth: number) {
  const text = `${BOLD}${label}${RESET}`
  const rest = Math.max(0, innerWidth - displayWidth(text) - 2)
  const left = Math.floor(rest / 2)
  return `├${"─".repeat(left)} ${text} ${"─".repeat(rest - left)}┤`
}

type CellKey = "label" | "now" | "p90" | "prev" | "fps" | "change"

const regressions: string[] = []

export function regressionsSoFar(): readonly string[] {
  return regressions
}

export function reportTable(rows: readonly MetricRow[]) {
  const visible = rows.filter((row) => row.value != null && Number.isFinite(row.value))

  if (visible.length === 0) return

  for (const row of visible) {
    if (tone(row.value, row.previous ?? null) === "red") regressions.push(row.label)
  }

  const cells = visible.map((row) => {
    const color = tone(row.value, row.previous ?? null)
    const unit = row.unit ?? "ms"
    return {
      group: row.group ?? "",
      label: row.label,
      now: paint(formatMetric(row.value, unit), color),
      p90: formatMetric(row.p90 ?? null, unit),
      prev: formatMetric(row.previous ?? null, unit),
      fps: row.frame ? formatFps(row.value) : "—",
      change: paint(changeText(row.value, row.previous ?? null, unit), color),
    }
  })
  const cols: { key: CellKey; title: string; align: "left" | "right" }[] = [
    { key: "label", title: "指标", align: "left" },
    { key: "now", title: "本次", align: "right" },
    { key: "p90", title: "p90", align: "right" },
  ]
  const comparable = visible.some((row) => row.previous != null && Number.isFinite(row.previous))

  if (comparable) cols.push({ key: "prev", title: "上次", align: "right" })

  if (visible.some((row) => row.frame)) cols.push({ key: "fps", title: "帧率", align: "right" })

  if (comparable) cols.push({ key: "change", title: "变化", align: "right" })

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

  let group = ""
  let started = false

  for (const cell of cells) {
    if (cell.group && cell.group !== group) {
      group = cell.group
      console.log(sectionLine(group, innerWidth))
    } else if (!started) console.log(rule(widths, "├", "┼", "┤"))

    started = true
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
