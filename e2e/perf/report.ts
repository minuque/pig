type MetricRow = {
  label: string
  value: number | null
  previous?: number | null
  unit?: "ms" | "个"
}

export function reportTable(title: string, rows: readonly MetricRow[]) {
  const format = (value: number | null | undefined, unit: string) =>
    value == null || !Number.isFinite(value) ? "—" : `${Number(value.toFixed(1))} ${unit}`

  console.log(`\n${title}`)
  console.table(
    rows.map(({ label, value, previous, unit = "ms" }) => {
      const comparable =
        value != null && previous != null && Number.isFinite(value) && Number.isFinite(previous)
      const diff = comparable ? value - previous : null
      const change =
        diff == null
          ? "—"
          : `${diff > 0 ? "+" : ""}${format(diff, unit)}${previous ? ` (${diff > 0 ? "+" : ""}${((diff / previous) * 100).toFixed(1)}%)` : ""}`
      return { 指标: label, 本次: format(value, unit), 上次: format(previous, unit), 变化: change }
    }),
  )
}
