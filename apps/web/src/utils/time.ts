/** 运行计时：不足一小时显示 mm:ss，超过显示 h:mm:ss。 */
export function formatClock(elapsedMs: number): string {
  const total = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs / 1000)) : 0
  const hours = Math.floor(total / 3600)
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
  const seconds = String(total % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
}
