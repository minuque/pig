/** 运行时长：不足一秒给毫秒，其余按秒；有分钟时带两位秒；有小时时时分秒都给。 */
export function formatElapsed(elapsedMs: number): string {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.round(elapsedMs)) : 0

  if (elapsed < 1000) return `${elapsed}ms`

  const total = Math.floor(elapsed / 1000)
  const seconds = String(total % 60).padStart(2, "0")
  const minutes = Math.floor(total / 60)

  if (minutes === 0) return `${total}s`
  const hours = Math.floor(minutes / 60)

  if (hours === 0) return `${minutes}m ${seconds}s`
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m ${seconds}s`
}
