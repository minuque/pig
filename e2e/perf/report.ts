const GREEN = "\x1b[32m"
const RESET = "\x1b[0m"

export type MetricRow = {
  label: string
  value: number | null
  p90?: number | null
  previous?: number | null
}

function paint(text: string, on: boolean) {
  return on ? `${GREEN}${text}${RESET}` : text
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

/** 一张表。变快的「本次 / 变化」为绿。 */
export function reportTable(rows: readonly MetricRow[]) {
  const visible = rows.filter((row) => row.value != null && Number.isFinite(row.value))
  if (visible.length === 0) return

  const cells = visible.map((row) => {
    const faster =
      row.value != null &&
      row.previous != null &&
      Number.isFinite(row.value) &&
      Number.isFinite(row.previous) &&
      row.value < row.previous
    return {
      label: row.label,
      now: paint(formatMs(row.value), faster),
      p90: formatMs(row.p90 ?? null),
      prev: formatMs(row.previous ?? null),
      change: paint(changeText(row.value, row.previous ?? null), faster),
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

  const line = (parts: string[]) =>
    parts
      .map((part, index) => pad(part, widths[index] ?? 0, cols[index]?.align ?? "left"))
      .join("  ")

  console.log(`\n${line(cols.map((col) => col.title))}`)
  console.log(line(widths.map((width) => "─".repeat(width))))
  for (const cell of cells) console.log(line(cols.map((col) => cell[col.key])))
}
