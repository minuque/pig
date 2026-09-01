function cssPx(name: string, fallback: number): number {
  if (typeof document === "undefined") return fallback
  const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(n) ? n : fallback
}

export function codeBlockTypography() {
  return {
    fontSize: cssPx("--text-code", 14),
    lineHeight: cssPx("--text-code-line", 18),
    fontFamily: "var(--font-code)",
  } as const
}
