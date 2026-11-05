/** 运行时长：秒；有分钟时带两位秒；有小时时时分秒都给。 */
export function formatElapsed(elapsedMs: number): string {
  const total = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs / 1000)) : 0
  const seconds = String(total % 60).padStart(2, "0")
  const minutes = Math.floor(total / 60)

  if (minutes === 0) return `${total}s`
  const hours = Math.floor(minutes / 60)

  if (hours === 0) return `${minutes}m ${seconds}s`
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m ${seconds}s`
}
