const KILO = 1024
const UNITS = ["KB", "MB", "GB"] as const

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"

  if (bytes < KILO) return `${Math.round(bytes)} B`

  let value = bytes / KILO
  let unit = 0

  while (value >= KILO && unit < UNITS.length - 1) {
    value /= KILO
    unit += 1
  }

  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`
}
