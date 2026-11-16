/** 相对亮度高于它的底色配深字，否则配浅字：两种字色在这里对比度相等（WCAG）。 */
const INK_CROSSOVER = 0.18

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** 只认不透明的 rgb()：半透明底色叠在主题背景上，字色交给主题。 */
function opaqueLuminance(color: string): number | undefined {
  const parts = color.match(/[\d.]+/g)?.map(Number)

  if (!parts || parts.length < 3 || (parts[3] ?? 1) < 1) return undefined
  const [r = 0, g = 0, b = 0] = parts
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * 作者用 classDef 给节点铺了底色却没给字色时，按底色亮度给标签标上深浅字色。
 * pele 只把底色内联到形状上，字色仍跟主题：深色主题里浅底配浅字就看不清。
 */
export function inkFilledLabels(root: Element) {
  for (const group of root.querySelectorAll(".pele-node, .pele-cluster")) {
    const shape = group.querySelector(":scope > [style*='fill']")

    if (!(shape instanceof SVGElement)) continue
    const luminance = opaqueLuminance(getComputedStyle(shape).fill)

    if (luminance === undefined) continue
    const ink = luminance > INK_CROSSOVER ? "dark" : "light"

    for (const label of group.querySelectorAll(".pele-label, .pele-cluster-label")) {
      if (label instanceof SVGElement && !label.style.fill) label.dataset.ink = ink
    }
  }
}
