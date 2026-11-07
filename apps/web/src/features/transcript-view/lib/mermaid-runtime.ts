import type { DiagramType } from "pele/lazy"

type Pele = typeof import("pele/lazy")

let peleLoad: Promise<Pele> | null = null
const typeLoads = new Map<DiagramType, Promise<boolean>>()

/** 第一次遇到图时才加载 pele；每种图型单独分包，按需加载。 */
export function loadPele(): Promise<Pele> {
  peleLoad ??= import("pele/lazy")
  return peleLoad
}

export async function loadDiagramType(pele: Pele, type: DiagramType): Promise<boolean> {
  let load = typeLoads.get(type)

  if (!load) {
    load = pele.load(type)
    typeLoads.set(type, load)
  }

  return await load
}

/** 流式中只取写完的行：末行常是半截语法，喂给 pele 必然解析失败。 */
export function settledSource(source: string, live: boolean): string {
  const text = live ? source.slice(0, source.lastIndexOf("\n") + 1) : source
  return text.trim()
}
