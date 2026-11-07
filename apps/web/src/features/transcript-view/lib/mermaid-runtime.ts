let seq = 0
const svgCache = new Map<string, Promise<string>>()
const SVG_CACHE_MAX = 32

async function renderWithPele(source: string): Promise<string> {
  const pele = await import("pele/lazy")
  const type = pele.detectType(source)

  // pele 对未识别图型不抛错，这里拦下，交给调用方显示源码。
  if (!type) throw new Error("unsupported-diagram")
  await pele.load(type)
  const result = await pele.renderAsync(source, { idPrefix: `md-mermaid-${++seq}` })
  return result.svg
}

/** 第一次遇到图时才加载 pele（约 2.2MB）；同一源码只渲染一次。 */
export function renderMermaid(source: string): Promise<string> {
  const hit = svgCache.get(source)

  if (hit) return hit
  const work = renderWithPele(source)
  svgCache.set(source, work)
  work.catch(() => svgCache.delete(source))

  if (svgCache.size > SVG_CACHE_MAX) svgCache.delete(svgCache.keys().next().value ?? "")
  return work
}
