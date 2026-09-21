import { enableMermaid } from "markstream-vue"

let runtimeStarted = false
const FILL_HEX = /(?:^|;)\s*fill:\s*(#[0-9a-fA-F]{3,8})/i
const LABEL_COLOR = /(?:^|;)\s*color\s*:/i

function fillLuminance(hex: string): number {
  let h = hex.slice(1)

  if (h.length === 3) h = [...h].map((c) => c + c).join("")
  const n = Number.parseInt(h.slice(0, 6), 16)
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

/** 自定义深色 fill 且未写 color 时，标签改白字。 */
function paintCustomNodeLabels(svg: string): string {
  const wrap = document.createElement("div")

  wrap.innerHTML = svg

  for (const node of wrap.querySelectorAll(".node")) {
    const shape = node.querySelector(
      ":scope > rect, :scope > polygon, :scope > path, :scope > circle",
    )
    const label = node.querySelector(".nodeLabel")

    if (!shape || !label) continue
    const labelStyle = label.getAttribute("style") ?? ""

    if (LABEL_COLOR.test(labelStyle)) continue
    const fill = FILL_HEX.exec(shape.getAttribute("style") ?? "")?.[1]

    if (!fill || fillLuminance(fill) >= 0.45) continue
    const sep = labelStyle && !labelStyle.endsWith(";") ? ";" : ""

    label.setAttribute("style", `${labelStyle}${sep}color:#ffffff`)
  }

  return wrap.innerHTML
}

async function loadMermaid(): Promise<unknown> {
  const mermaid = (await import("mermaid")).default
  const render = mermaid.render.bind(mermaid)

  mermaid.render = (async (...args: Parameters<typeof mermaid.render>) => {
    const result = await render(...args)
    return result.svg ? { ...result, svg: paintCustomNodeLabels(result.svg) } : result
  }) as typeof mermaid.render
  return mermaid
}

/** 第一次进 Transcript 再加载 mermaid，解析走主线程，不打 3MB worker。 */
export function ensureMermaidRuntime(): void {
  if (runtimeStarted) return
  runtimeStarted = true
  enableMermaid(loadMermaid)
}
