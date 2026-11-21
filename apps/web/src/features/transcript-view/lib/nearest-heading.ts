export function headingBefore(el: HTMLElement | null): string | undefined {
  if (!el) return undefined
  const headings = el.closest(".prose")?.querySelectorAll("h1, h2, h3, h4, h5, h6") ?? []
  const above = [...headings].filter(
    (h) => h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
  )
  return above.at(-1)?.textContent?.trim() || undefined
}
