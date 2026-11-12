import { readJson, writeJson, type PrefStorage } from "@utils/storage.js"

export const RAIL_SECTIONS = ["environment", "context", "tasks"] as const

export type RailSectionId = (typeof RAIL_SECTIONS)[number]

/** 摘要面板的排列：卡片顺序、收起的、隐藏的；跨会话记住。 */
export interface RailLayout {
  order: RailSectionId[]
  closed: RailSectionId[]
  hidden: RailSectionId[]
}

const KEY = "pig.rail.layout"
const known = (value: unknown): value is RailSectionId =>
  RAIL_SECTIONS.includes(value as RailSectionId)
const pick = (list: unknown) => (Array.isArray(list) ? [...new Set(list.filter(known))] : [])

/** 读存下的排列；缺的卡片补到末尾，未知的丢掉。 */
export function readRailLayout(storage?: PrefStorage): RailLayout {
  const raw = readJson<Partial<RailLayout>>(KEY, storage)
  const order = pick(raw?.order)
  return {
    order: [...order, ...RAIL_SECTIONS.filter((id) => !order.includes(id))],
    closed: pick(raw?.closed),
    hidden: pick(raw?.hidden),
  }
}

export function writeRailLayout(layout: RailLayout, storage?: PrefStorage) {
  writeJson(KEY, layout, storage)
}

/** 在当前显示的卡片里把 id 挪到 toIndex；没显示的卡片留在原位。 */
export function moveShown(
  order: readonly RailSectionId[],
  shown: readonly RailSectionId[],
  id: RailSectionId,
  toIndex: number,
): RailSectionId[] {
  const next = shown.filter((item) => item !== id)

  if (next.length === shown.length) return [...order]
  next.splice(toIndex, 0, id)
  let index = 0
  return order.map((item) => (shown.includes(item) ? next[index++]! : item))
}
