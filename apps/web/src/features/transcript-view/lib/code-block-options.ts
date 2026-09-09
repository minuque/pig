const cssPxCache = new Map<string, number>()

function cssPx(name: string, fallback: number): number {
  if (typeof document === "undefined") return fallback
  const hit = cssPxCache.get(name)
  if (hit !== undefined) return hit
  const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  const value = Number.isFinite(n) ? n : fallback
  cssPxCache.set(name, value)
  return value
}

export function codeBlockTypography() {
  return {
    fontSize: cssPx("--text-code", 14),
    lineHeight: cssPx("--text-code-line", 22),
    fontFamily: "var(--font-mono)",
  } as const
}
