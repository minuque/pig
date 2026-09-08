const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
const RESET = "\x1b[0m"
const SLOW_RATIO = 0.1

export type MetricRow = {
  label: string
  value: number | null
  p90?: number | null
  previous?: number | null
}

function paint(text: string, color: "green" | "red" | null) {
  if (color === "green") return `${GREEN}${text}${RESET}`
  if (color === "red") return `${RED}${text}${RESET}`
  return text
}

function displayWidth(text: string): number {
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "")
  let width = 0
  for (const ch of plain) width += ch.charCodeAt(0) > 127 ? 2 : 1
  return width
}

function pad(text: string, width: number, align: "left" | "right") {
  const extra = Math.max(0, width - displayWidth(text))
  const space = " ".repeat(extra)
  return align === "right" ? space + text : text + space
}

function formatMs(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${Number(value.toFixed(1))} ms`
}

function changeText(value: number | null, previous: number | null) {
  if (value == null || previous == null || !Number.isFinite(value) || !Number.isFinite(previous))
    return "—"
  const diff = value - previous
  const percent =
    previous === 0 ? "" : ` (${diff > 0 ? "+" : ""}${((diff / previous) * 100).toFixed(1)}%)`
  return `${diff > 0 ? "+" : ""}${formatMs(diff)}${percent}`
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

/** 一张带边框的表。变快为绿，变慢超过 10% 为红。 */
export function reportTable(rows: readonly MetricRow[]) {
  const visible = rows.filter((row) => row.value != null && Number.isFinite(row.value))
  if (visible.length === 0) return

  const cells = visible.map((row) => {
    const color = tone(row.value, row.previous ?? null)
    return {
      label: row.label,
      now: paint(formatMs(row.value), color),
      p90: formatMs(row.p90 ?? null),
      prev: formatMs(row.previous ?? null),
      change: paint(changeText(row.value, row.previous ?? null), color),
    }
  })

  const cols = [
    { key: "label" as const, title: "指标", align: "left" as const },
    { key: "now" as const, title: "本次", align: "right" as const },
    { key: "p90" as const, title: "p90", align: "right" as const },
    { key: "prev" as const, title: "上次", align: "right" as const },
    { key: "change" as const, title: "变化", align: "right" as const },
  ]
  const widths = cols.map((col) =>
    Math.max(displayWidth(col.title), ...cells.map((cell) => displayWidth(cell[col.key]))),
  )
  const aligns = cols.map((col) => col.align)
  const keys = cols.map((col) => col.key)

  console.log(`\n${rule(widths, "┌", "┬", "┐")}`)
  console.log(
    rowLine(
      cols.map((col) => col.title),
      widths,
      aligns,
    ),
  )
  console.log(rule(widths, "├", "┼", "┤"))
  for (const cell of cells)
    console.log(
      rowLine(
        keys.map((key) => cell[key]),
        widths,
        aligns,
      ),
    )
  console.log(rule(widths, "└", "┴", "┘"))
}
