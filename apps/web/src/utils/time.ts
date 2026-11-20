export function formatElapsed(
  elapsedMs: number,
  { showMs = true }: { showMs?: boolean } = {},
): string {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs)) : 0

  if (elapsed < 1000) return showMs ? `${elapsed}ms` : "0s"

  const total = Math.floor(elapsed / 1000)
  const seconds = String(total % 60).padStart(2, "0")
  const minutes = Math.floor(total / 60)

  if (minutes === 0) return `${total}s`
  const hours = Math.floor(minutes / 60)

  if (hours === 0) return `${minutes}m ${seconds}s`
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m ${seconds}s`
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
]

export function formatRelative(dateMs: number, nowMs: number, locale: string): string {
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const seconds = Math.round((dateMs - nowMs) / 1000)
  const unit = RELATIVE_UNITS.find(([, span]) => Math.abs(seconds) >= span)
  return unit ? format.format(Math.round(seconds / unit[1]), unit[0]) : format.format(0, "second")
}
